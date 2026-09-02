```javascript
/**
 * ============================================================
 * FLORIAN / WEISSERHAI MINECRAFT HOSTING
 * ============================================================
 *
 * Datei: webseite.js
 *
 * Start:
 *   node webseite.js
 *
 * Benötigt:
 *   npm install express
 *
 * Environment:
 *   PORT=10000
 *   OWNER_EMAIL=florianzustolberg@gmail.com
 *   OWNER_PASSWORD=DEIN_PASSWORT
 *   SESSION_SECRET=irgendein-langer-geheimer-string
 *
 * Minecraft:
 *   Lege minecraft_server.jar in:
 *
 *   ./minecraft_server.jar
 *
 * Java muss auf dem Server installiert sein.
 *
 * ============================================================
 */

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

/* ============================================================
   KONFIGURATION
   ============================================================ */

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const OWNER_EMAIL =
    String(process.env.OWNER_EMAIL || "florianzustolberg@gmail.com")
        .trim()
        .toLowerCase();

const OWNER_PASSWORD =
    String(process.env.OWNER_PASSWORD || "278263");

const SESSION_SECRET =
    String(
        process.env.SESSION_SECRET ||
        "CHANGE_THIS_SESSION_SECRET_7f92c8a4b1e9d6"
    );

const BASE_DIR = __dirname;

const DATA_DIR = path.join(BASE_DIR, "data");
const SERVERS_DIR = path.join(BASE_DIR, "minecraft-servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");

const MINECRAFT_JAR = path.join(BASE_DIR, "minecraft_server.jar");

/* ============================================================
   EXPRESS
   ============================================================ */

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

/* ============================================================
   VERZEICHNISSE
   ============================================================ */

function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

ensureDirectory(DATA_DIR);
ensureDirectory(SERVERS_DIR);

/* ============================================================
   JSON-DATEIEN
   ============================================================ */

function readJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2),
                "utf8"
            );

            return fallback;
        }

        const content = fs.readFileSync(file, "utf8").trim();

        if (!content) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2),
                "utf8"
            );

            return fallback;
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("JSON-Lesefehler:", file, error.message);
        return fallback;
    }
}

function writeJson(file, data) {
    const temporary = `${file}.tmp`;

    fs.writeFileSync(
        temporary,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(temporary, file);
}

let users = readJson(USERS_FILE, []);
let servers = readJson(SERVERS_FILE, []);

/* ============================================================
   HILFSFUNKTIONEN
   ============================================================ */

function id() {
    return crypto.randomUUID();
}

function hash(value) {
    return crypto
        .createHash("sha256")
        .update(SESSION_SECRET + String(value))
        .digest("hex");
}

function passwordHash(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function createToken() {
    return crypto.randomBytes(48).toString("hex");
}

function now() {
    return new Date().toISOString();
}

function cleanName(value) {
    return String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9ÄÖÜäöüß _-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 40);
}

function safeServerName(value) {
    const name = cleanName(value);

    if (!name) {
        return "minecraft-server";
    }

    return name;
}

function findUserByEmail(email) {
    return users.find(
        user =>
            String(user.email).toLowerCase() ===
            String(email).toLowerCase()
    );
}

function findUserById(userId) {
    return users.find(user => user.id === userId);
}

function findServer(serverId) {
    return servers.find(server => server.id === serverId);
}

function serverDirectory(server) {
    return path.join(SERVERS_DIR, server.id);
}

function isOwner(user) {
    return (
        user &&
        String(user.email).toLowerCase() === OWNER_EMAIL
    );
}

/* ============================================================
   COOKIE
   ============================================================ */

function parseCookies(req) {
    const cookies = {};

    const header = req.headers.cookie;

    if (!header) {
        return cookies;
    }

    for (const item of header.split(";")) {
        const index = item.indexOf("=");

        if (index === -1) continue;

        const key = item.substring(0, index).trim();
        const value = item.substring(index + 1).trim();

        cookies[key] = decodeURIComponent(value);
    }

    return cookies;
}

function setAuthCookie(res, token) {
    const signature = hash(token);

    res.setHeader(
        "Set-Cookie",
        [
            `north_auth=${encodeURIComponent(token)}`,
            `north_sig=${encodeURIComponent(signature)}`,
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=2592000"
        ].join("; ")
    );
}

function clearAuthCookie(res) {
    res.setHeader(
        "Set-Cookie",
        [
            "north_auth=",
            "north_sig=",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=0"
        ].join("; ")
    );
}

/* ============================================================
   AUTH
   ============================================================ */

function getCurrentUser(req) {
    const cookies = parseCookies(req);

    const token = cookies.north_auth;
    const signature = cookies.north_sig;

    if (!token || !signature) {
        return null;
    }

    if (hash(token) !== signature) {
        return null;
    }

    const user = users.find(
        item => item.sessionToken === token
    );

    if (!user) {
        return null;
    }

    if (user.banned) {
        return null;
    }

    return user;
}

function requireAuth(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Nicht eingeloggt."
        });
    }

    req.user = user;
    next();
}

function requireOwner(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Nicht eingeloggt."
        });
    }

    if (!isOwner(user)) {
        return res.status(403).json({
            success: false,
            error: "Nur der Owner darf diese Funktion benutzen."
        });
    }

    req.user = user;
    next();
}

/* ============================================================
   OWNER AUTOMATISCH ANLEGEN
   ============================================================ */

function ensureOwner() {
    let owner = findUserByEmail(OWNER_EMAIL);

    if (!owner) {
        owner = {
            id: id(),
            username: "Florian",
            email: OWNER_EMAIL,
            password: passwordHash(OWNER_PASSWORD),
            sessionToken: null,
            coins: 999999999,
            role: "owner",
            banned: false,
            createdAt: now()
        };

        users.push(owner);
        writeJson(USERS_FILE, users);

        console.log(
            `Owner automatisch erstellt: ${OWNER_EMAIL}`
        );
    } else {
        owner.role = "owner";
        owner.banned = false;

        writeJson(USERS_FILE, users);
    }
}

ensureOwner();

/* ============================================================
   SERVER-PROZESSE
   ============================================================ */

const processes = new Map();

function getProcess(serverId) {
    return processes.get(serverId) || null;
}

function serverIsRunning(serverId) {
    const process = getProcess(serverId);

    return Boolean(
        process &&
        process.child &&
        !process.child.killed &&
        process.child.exitCode === null
    );
}

function appendServerLog(server, text) {
    const line =
        `[${new Date().toLocaleString("de-DE")}] ${text}`;

    server.logs = Array.isArray(server.logs)
        ? server.logs
        : [];

    server.logs.push(line);

    if (server.logs.length > 500) {
        server.logs = server.logs.slice(-500);
    }

    writeJson(SERVERS_FILE, servers);
}

function startMinecraft(server) {
    if (!server) {
        throw new Error("Server nicht gefunden.");
    }

    if (server.locked) {
        throw new Error("Dieser Server wurde gesperrt.");
    }

    if (server.maintenance) {
        throw new Error(
            "Der Server befindet sich im Wartungsmodus."
        );
    }

    if (serverIsRunning(server.id)) {
        return;
    }

    const directory = serverDirectory(server);

    ensureDirectory(directory);

    if (!fs.existsSync(MINECRAFT_JAR)) {
        throw new Error(
            "minecraft_server.jar wurde nicht gefunden. Lege die Datei neben webseite.js."
        );
    }

    const eulaFile = path.join(directory, "eula.txt");

    if (!fs.existsSync(eulaFile)) {
        fs.writeFileSync(
            eulaFile,
            "eula=true\n",
            "utf8"
        );
    }

    const memory = server.memory || "1G";

    const child = spawn(
        "java",
        [
            `-Xms${memory}`,
            `-Xmx${memory}`,
            "-jar",
            MINECRAFT_JAR,
            "nogui"
        ],
        {
            cwd: directory,
            windowsHide: true
        }
    );

    const processData = {
        child,
        output: []
    };

    processes.set(server.id, processData);

    server.status = "running";
    server.startedAt = now();

    appendServerLog(
        server,
        "Minecraft-Server wurde gestartet."
    );

    child.stdout.on("data", data => {
        const text = data.toString();

        processData.output.push(text);

        if (processData.output.length > 300) {
            processData.output.shift();
        }

        appendServerLog(server, text.trim());
    });

    child.stderr.on("data", data => {
        const text = data.toString();

        processData.output.push(text);

        appendServerLog(
            server,
            `ERROR: ${text.trim()}`
        );
    });

    child.on("close", (code, signal) => {
        server.status = "offline";
        server.lastExitCode = code;
        server.lastSignal = signal || null;

        appendServerLog(
            server,
            `Minecraft-Prozess beendet. Code: ${code}`
        );

        processes.delete(server.id);
    });

    child.on("error", error => {
        server.status = "offline";

        appendServerLog(
            server,
            `Prozessfehler: ${error.message}`
        );

        processes.delete(server.id);
    });

    writeJson(SERVERS_FILE, servers);
}

function stopMinecraft(server) {
    if (!server) {
        throw new Error("Server nicht gefunden.");
    }

    const processData = getProcess(server.id);

    if (!processData || !processData.child) {
        server.status = "offline";
        writeJson(SERVERS_FILE, servers);
        return;
    }

    try {
        processData.child.stdin.write("stop\n");
    } catch (error) {
        try {
            processData.child.kill();
        } catch {}
    }

    server.status = "stopping";

    appendServerLog(
        server,
        "Stop-Befehl an Minecraft gesendet."
    );
}

function restartMinecraft(server) {
    stopMinecraft(server);

    setTimeout(() => {
        try {
            startMinecraft(server);
        } catch (error) {
            appendServerLog(
                server,
                `Neustart fehlgeschlagen: ${error.message}`
            );
        }
    }, 3000);
}

function sendMinecraftCommand(server, command) {
    const processData = getProcess(server.id);

    if (!processData || !processData.child) {
        throw new Error("Server läuft nicht.");
    }

    const text = String(command || "").trim();

    if (!text) {
        throw new Error("Kein Befehl angegeben.");
    }

    processData.child.stdin.write(text + "\n");

    appendServerLog(
        server,
        `KONSOLE: ${text}`
    );
}

/* ============================================================
   SERVER-DATEIEN
   ============================================================ */

function safeResolveInsideServer(server, requestedPath) {
    const root = path.resolve(serverDirectory(server));

    let clean = String(requestedPath || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    if (!clean) {
        clean = "server.properties";
    }

    const target = path.resolve(root, clean);

    if (
        target !== root &&
        !target.startsWith(root + path.sep)
    ) {
        throw new Error("Ungültiger Dateipfad.");
    }

    return target;
}

function listFilesRecursive(directory, relative = "") {
    const result = [];

    if (!fs.existsSync(directory)) {
        return result;
    }

    const entries = fs.readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (
            entry.name === "logs" &&
            relative === ""
        ) {
            continue;
        }

        const relativePath = path.join(
            relative,
            entry.name
        );

        const absolutePath = path.join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {
            result.push({
                type: "directory",
                path: relativePath
            });

            result.push(
                ...listFilesRecursive(
                    absolutePath,
                    relativePath
                )
            );
        } else {
            let size = 0;

            try {
                size = fs.statSync(absolutePath).size;
            } catch {}

            result.push({
                type: "file",
                path: relativePath,
                size
            });
        }
    }

    return result;
}

/* ============================================================
   API - STATUS
   ============================================================ */

app.get("/api/status", (req, res) => {
    const user = getCurrentUser(req);

    res.json({
        success: true,
        loggedIn: Boolean(user),
        user: user
            ? {
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                role: user.role,
                owner: isOwner(user)
            }
            : null
    });
});

/* ============================================================
   API - REGISTRIERUNG
   ============================================================ */

app.post("/api/register", (req, res) => {
    try {
        const username = String(
            req.body.username || ""
        ).trim();

        const email = String(
            req.body.email || ""
        ).trim().toLowerCase();

        const password = String(
            req.body.password || ""
        );

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                error: "Der Benutzername muss mindestens 3 Zeichen haben."
            });
        }

        if (
            !email.includes("@") ||
            email.length < 5
        ) {
            return res.status(400).json({
                success: false,
                error: "Ungültige E-Mail-Adresse."
            });
        }

        if (password.length < 4) {
            return res.status(400).json({
                success: false,
                error: "Das Passwort muss mindestens 4 Zeichen haben."
            });
        }

        if (findUserByEmail(email)) {
            return res.status(409).json({
                success: false,
                error: "Diese E-Mail ist bereits registriert."
            });
        }

        const user = {
            id: id(),
            username,
            email,
            password: passwordHash(password),
            sessionToken: createToken(),
            coins: 0,
            role: "user",
            banned: false,
            createdAt: now()
        };

        users.push(user);

        writeJson(USERS_FILE, users);

        setAuthCookie(res, user.sessionToken);

        res.json({
            success: true,
            message: "Registrierung erfolgreich.",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                role: user.role,
                owner: isOwner(user)
            }
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Registrierung fehlgeschlagen."
        });
    }
});

/* ============================================================
   API - LOGIN
   ============================================================ */

app.post("/api/login", (req, res) => {
    try {
        const email = String(
            req.body.email || ""
        ).trim().toLowerCase();

        const password = String(
            req.body.password || ""
        );

        const user = findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "E-Mail oder Passwort falsch."
            });
        }

        if (user.banned) {
            return res.status(403).json({
                success: false,
                error: "Dieses Konto wurde gesperrt."
            });
        }

        if (
            passwordHash(password) !==
            user.password
        ) {
            return res.status(401).json({
                success: false,
                error: "E-Mail oder Passwort falsch."
            });
        }

        user.sessionToken = createToken();

        writeJson(USERS_FILE, users);

        setAuthCookie(
            res,
            user.sessionToken
        );

        res.json({
            success: true,
            message: "Login erfolgreich.",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                role: user.role,
                owner: isOwner(user)
            }
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Login fehlgeschlagen."
        });
    }
});

/* ============================================================
   API - LOGOUT
   ============================================================ */

app.post("/api/logout", requireAuth, (req, res) => {
    req.user.sessionToken = null;

    writeJson(USERS_FILE, users);

    clearAuthCookie(res);

    res.json({
        success: true
    });
});

/* ============================================================
   API - PROFIL
   ============================================================ */

app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            coins: req.user.coins,
            role: req.user.role,
            owner: isOwner(req.user),
            createdAt: req.user.createdAt
        }
    });
});

/* ============================================================
   API - SERVER LISTE
   ============================================================ */

app.get("/api/servers", requireAuth, (req, res) => {
    const visibleServers = servers.filter(
        server =>
            isOwner(req.user) ||
            server.ownerId === req.user.id
    );

    res.json({
        success: true,
        servers: visibleServers.map(server => ({
            id: server.id,
            name: server.name,
            status: server.status,
            ownerId: server.ownerId,
            memory: server.memory,
            locked: server.locked,
            maintenance: server.maintenance,
            createdAt: server.createdAt,
            startedAt: server.startedAt || null
        }))
    });
});

/* ============================================================
   API - SERVER ERSTELLEN
   ============================================================ */

app.post("/api/servers", requireAuth, (req, res) => {
    try {
        if (req.user.banned) {
            return res.status(403).json({
                success: false,
                error: "Konto gesperrt."
            });
        }

        const name = safeServerName(
            req.body.name
        );

        const memory = String(
            req.body.memory || "1G"
        ).trim();

        if (!/^\d+(M|G)$/i.test(memory)) {
            return res.status(400).json({
                success: false,
                error: "Ungültiger RAM-Wert. Beispiel: 1G oder 2048M."
            });
        }

        const server = {
            id: id(),
            name,
            ownerId: req.user.id,
            memory,
            status: "offline",
            locked: false,
            maintenance: false,
            createdAt: now(),
            startedAt: null,
            logs: []
        };

        servers.push(server);

        ensureDirectory(
            serverDirectory(server)
        );

        fs.writeFileSync(
            path.join(
                serverDirectory(server),
                "eula.txt"
            ),
            "eula=true\n",
            "utf8"
        );

        fs.writeFileSync(
            path.join(
                serverDirectory(server),
                "server.properties"
            ),
            [
                "motd=Florian Minecraft Hosting",
                "server-port=25565",
                "online-mode=true",
                "difficulty=normal",
                "gamemode=survival",
                "max-players=20"
            ].join("\n") + "\n",
            "utf8"
        );

        appendServerLog(
            server,
            `Server "${name}" wurde erstellt.`
        );

        res.json({
            success: true,
            server
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/* ============================================================
   API - SERVER DETAILS
   ============================================================ */

app.get(
    "/api/servers/:id",
    requireAuth,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        if (
            !isOwner(req.user) &&
            server.ownerId !== req.user.id
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        res.json({
            success: true,
            server: {
                ...server,
                running: serverIsRunning(
                    server.id
                )
            }
        });
    }
);

/* ============================================================
   API - SERVER START
   ============================================================ */

app.post(
    "/api/servers/:id/start",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            startMinecraft(server);

            res.json({
                success: true,
                message: "Server wird gestartet."
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - SERVER STOP
   ============================================================ */

app.post(
    "/api/servers/:id/stop",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            stopMinecraft(server);

            res.json({
                success: true,
                message: "Server wird heruntergefahren."
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - SERVER RESTART
   ============================================================ */

app.post(
    "/api/servers/:id/restart",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            restartMinecraft(server);

            res.json({
                success: true,
                message: "Server wird neu gestartet."
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - KONSOLE
   ============================================================ */

app.post(
    "/api/servers/:id/console",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            sendMinecraftCommand(
                server,
                req.body.command
            );

            res.json({
                success: true
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - LOGS
   ============================================================ */

app.get(
    "/api/servers/:id/logs",
    requireAuth,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        if (
            !isOwner(req.user) &&
            server.ownerId !== req.user.id
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        res.json({
            success: true,
            logs: server.logs || []
        });
    }
);

/* ============================================================
   API - DATEIEN AUFLISTEN
   ============================================================ */

app.get(
    "/api/servers/:id/files",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            const directory =
                serverDirectory(server);

            ensureDirectory(directory);

            res.json({
                success: true,
                files: listFilesRecursive(
                    directory
                )
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - DATEI LESEN
   ============================================================ */

app.get(
    "/api/servers/:id/file",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            const target =
                safeResolveInsideServer(
                    server,
                    req.query.path
                );

            if (!fs.existsSync(target)) {
                return res.status(404).json({
                    success: false,
                    error: "Datei nicht gefunden."
                });
            }

            if (
                !fs.statSync(target).isFile()
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Das ist keine Datei."
                });
            }

            const content =
                fs.readFileSync(
                    target,
                    "utf8"
                );

            res.json({
                success: true,
                path: req.query.path,
                content
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - DATEI SCHREIBEN
   ============================================================ */

app.put(
    "/api/servers/:id/file",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            const relativePath =
                String(
                    req.body.path || ""
                ).trim();

            if (!relativePath) {
                return res.status(400).json({
                    success: false,
                    error: "Kein Dateipfad angegeben."
                });
            }

            const target =
                safeResolveInsideServer(
                    server,
                    relativePath
                );

            const content =
                String(
                    req.body.content || ""
                );

            ensureDirectory(
                path.dirname(target)
            );

            fs.writeFileSync(
                target,
                content,
                "utf8"
            );

            appendServerLog(
                server,
                `Datei geändert: ${relativePath}`
            );

            res.json({
                success: true,
                message: "Datei gespeichert."
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - DATEI ERSTELLEN
   ============================================================ */

app.post(
    "/api/servers/:id/file",
    requireAuth,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            const relativePath =
                String(
                    req.body.path || ""
                ).trim();

            if (!relativePath) {
                return res.status(400).json({
                    success: false,
                    error: "Kein Dateipfad."
                });
            }

            const target =
                safeResolveInsideServer(
                    server,
                    relativePath
                );

            if (fs.existsSync(target)) {
                return res.status(409).json({
                    success: false,
                    error: "Datei existiert bereits."
                });
            }

            ensureDirectory(
                path.dirname(target)
            );

            fs.writeFileSync(
                target,
                String(
                    req.body.content || ""
                ),
                "utf8"
            );

            res.json({
                success: true
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   API - SERVER LÖSCHEN
   ============================================================ */

app.delete(
    "/api/servers/:id",
    requireAuth,
    (req, res) => {
        try {
            const index =
                servers.findIndex(
                    server =>
                        server.id ===
                        req.params.id
                );

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            const server =
                servers[index];

            if (
                !isOwner(req.user) &&
                server.ownerId !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    error: "Keine Berechtigung."
                });
            }

            if (
                serverIsRunning(server.id)
            ) {
                stopMinecraft(server);
            }

            processes.delete(
                server.id
            );

            const directory =
                serverDirectory(server);

            if (fs.existsSync(directory)) {
                fs.rmSync(
                    directory,
                    {
                        recursive: true,
                        force: true
                    }
                );
            }

            servers.splice(index, 1);

            writeJson(
                SERVERS_FILE,
                servers
            );

            res.json({
                success: true,
                message: "Server gelöscht."
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   OWNER - ALLE SERVER
   ============================================================ */

app.get(
    "/api/owner/servers",
    requireOwner,
    (req, res) => {
        res.json({
            success: true,
            servers: servers.map(server => ({
                id: server.id,
                name: server.name,
                ownerId: server.ownerId,
                status: server.status,
                locked: server.locked,
                maintenance: server.maintenance,
                running: serverIsRunning(
                    server.id
                ),
                createdAt: server.createdAt
            }))
        });
    }
);

/* ============================================================
   OWNER - ALLE USER
   ============================================================ */

app.get(
    "/api/owner/users",
    requireOwner,
    (req, res) => {
        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                role: user.role,
                banned: user.banned,
                createdAt: user.createdAt
            }))
        });
    }
);

/* ============================================================
   OWNER - COINS GEBEN
   ============================================================ */

app.post(
    "/api/owner/users/:id/coins",
    requireOwner,
    (req, res) => {
        const user = findUserById(
            req.params.id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        const amount =
            Number(req.body.amount);

        if (
            !Number.isFinite(amount) ||
            !Number.isInteger(amount)
        ) {
            return res.status(400).json({
                success: false,
                error: "Ungültige Coin-Anzahl."
            });
        }

        user.coins =
            Math.max(
                0,
                Number(user.coins || 0) +
                amount
            );

        writeJson(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            coins: user.coins
        });
    }
);

/* ============================================================
   OWNER - USER BAN
   ============================================================ */

app.post(
    "/api/owner/users/:id/ban",
    requireOwner,
    (req, res) => {
        const user = findUserById(
            req.params.id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (isOwner(user)) {
            return res.status(400).json({
                success: false,
                error: "Der Owner kann nicht gebannt werden."
            });
        }

        user.banned = true;
        user.sessionToken = null;

        writeJson(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            message: "Benutzer gesperrt."
        });
    }
);

/* ============================================================
   OWNER - USER ENTSPERREN
   ============================================================ */

app.post(
    "/api/owner/users/:id/unban",
    requireOwner,
    (req, res) => {
        const user = findUserById(
            req.params.id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        user.banned = false;

        writeJson(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            message: "Benutzer entsperrt."
        });
    }
);

/* ============================================================
   OWNER - USER LÖSCHEN
   ============================================================ */

app.delete(
    "/api/owner/users/:id",
    requireOwner,
    (req, res) => {
        const index =
            users.findIndex(
                user =>
                    user.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (
            isOwner(users[index])
        ) {
            return res.status(400).json({
                success: false,
                error: "Der Owner kann nicht gelöscht werden."
            });
        }

        users.splice(index, 1);

        writeJson(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            message: "Benutzer gelöscht."
        });
    }
);

/* ============================================================
   OWNER - SERVER SPERREN
   ============================================================ */

app.post(
    "/api/owner/servers/:id/lock",
    requireOwner,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        server.locked = true;

        if (serverIsRunning(server.id)) {
            stopMinecraft(server);
        }

        appendServerLog(
            server,
            "Server vom Owner gesperrt."
        );

        res.json({
            success: true
        });
    }
);

/* ============================================================
   OWNER - SERVER ENTSPERREN
   ============================================================ */

app.post(
    "/api/owner/servers/:id/unlock",
    requireOwner,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        server.locked = false;

        appendServerLog(
            server,
            "Server vom Owner entsperrt."
        );

        res.json({
            success: true
        });
    }
);

/* ============================================================
   OWNER - WARTUNG
   ============================================================ */

app.post(
    "/api/owner/servers/:id/maintenance",
    requireOwner,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const enabled =
            Boolean(req.body.enabled);

        server.maintenance =
            enabled;

        if (
            enabled &&
            serverIsRunning(server.id)
        ) {
            stopMinecraft(server);
        }

        appendServerLog(
            server,
            enabled
                ? "Wartungsmodus aktiviert."
                : "Wartungsmodus deaktiviert."
        );

        res.json({
            success: true,
            maintenance:
                server.maintenance
        });
    }
);

/* ============================================================
   OWNER - SERVER START
   ============================================================ */

app.post(
    "/api/owner/servers/:id/start",
    requireOwner,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            startMinecraft(server);

            res.json({
                success: true
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   OWNER - SERVER STOP
   ============================================================ */

app.post(
    "/api/owner/servers/:id/stop",
    requireOwner,
    (req, res) => {
        try {
            const server = findServer(
                req.params.id
            );

            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            stopMinecraft(server);

            res.json({
                success: true
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   OWNER - ALLE SERVER HERUNTERFAHREN
   ============================================================ */

app.post(
    "/api/owner/shutdown-all",
    requireOwner,
    (req, res) => {
        let stopped = 0;

        for (const server of servers) {
            if (
                serverIsRunning(server.id)
            ) {
                try {
                    stopMinecraft(server);
                    stopped++;
                } catch {}
            }
        }

        res.json({
            success: true,
            stopped
        });
    }
);

/* ============================================================
   OWNER - SERVER LÖSCHEN
   ============================================================ */

app.delete(
    "/api/owner/servers/:id",
    requireOwner,
    (req, res) => {
        try {
            const index =
                servers.findIndex(
                    server =>
                        server.id ===
                        req.params.id
                );

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Server nicht gefunden."
                });
            }

            const server =
                servers[index];

            if (
                serverIsRunning(server.id)
            ) {
                stopMinecraft(server);
            }

            processes.delete(
                server.id
            );

            const directory =
                serverDirectory(server);

            if (fs.existsSync(directory)) {
                fs.rmSync(
                    directory,
                    {
                        recursive: true,
                        force: true
                    }
                );
            }

            servers.splice(index, 1);

            writeJson(
                SERVERS_FILE,
                servers
            );

            res.json({
                success: true
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   OWNER - SERVER UMBENENNEN
   ============================================================ */

app.patch(
    "/api/owner/servers/:id",
    requireOwner,
    (req, res) => {
        const server = findServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const name = safeServerName(
            req.body.name
        );

        server.name = name;

        writeJson(
            SERVERS_FILE,
            servers
        );

        res.json({
            success: true,
            server
        });
    }
);

/* ============================================================
   OWNER - USER ROLLE
   ============================================================ */

app.post(
    "/api/owner/users/:id/role",
    requireOwner,
    (req, res) => {
        const user = findUserById(
            req.params.id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (isOwner(user)) {
            return res.status(400).json({
                success: false,
                error: "Owner-Rolle kann nicht geändert werden."
            });
        }

        const allowed = [
            "user",
            "support",
            "moderator",
            "admin"
        ];

        const role = String(
            req.body.role || "user"
        ).toLowerCase();

        if (!allowed.includes(role)) {
            return res.status(400).json({
                success: false,
                error: "Ungültige Rolle."
            });
        }

        user.role = role;

        writeJson(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            role
        });
    }
);

/* ============================================================
   HTML
   ============================================================ */

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Florian / WeisserHai Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        #0a0f18;

    color: #fff;
}

button,
input,
textarea,
select {
    font: inherit;
}

button {
    cursor: pointer;
}

.nav {
    height: 70px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 25px;

    background: #101826;

    border-bottom:
        1px solid #243148;

    position: sticky;
    top: 0;
    z-index: 100;
}

.logo {
    font-size: 21px;
    font-weight: bold;
}

.logo span {
    color: #55a7ff;
}

.nav-user {
    display: flex;
    gap: 10px;
    align-items: center;
}

.container {
    max-width: 1250px;
    margin: 0 auto;
    padding: 30px 20px;
}

.card {
    background: #111a29;
    border: 1px solid #243148;
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 20px;
}

.auth {
    max-width: 430px;
    margin: 80px auto;
}

h1,
h2,
h3 {
    margin-top: 0;
}

input,
textarea,
select {
    width: 100%;
    padding: 12px;
    margin: 7px 0 13px;

    background: #0a101b;
    border: 1px solid #2b3b56;
    border-radius: 9px;

    color: #fff;
}

textarea {
    min-height: 300px;
    resize: vertical;

    font-family:
        Consolas,
        monospace;
}

button {
    border: 0;
    border-radius: 9px;
    padding: 11px 15px;
    background: #3185e5;
    color: white;
    font-weight: bold;
}

button:hover {
    opacity: .88;
}

button.danger {
    background: #d64040;
}

button.success {
    background: #26995d;
}

button.warning {
    background: #c38b28;
}

button.secondary {
    background: #303e55;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(270px, 1fr));

    gap: 18px;
}

.server {
    background: #0c1421;
    border: 1px solid #263650;
    border-radius: 13px;
    padding: 18px;
}

.server-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 12px;
    background: #303e55;
}

.status.running {
    background: #167346;
}

.status.offline {
    background: #4b5566;
}

.status.locked {
    background: #a53535;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 15px;
}

.hidden {
    display: none !important;
}

.error {
    color: #ff7171;
    margin: 10px 0;
}

.success-text {
    color: #55df99;
}

.muted {
    color: #9aa8bd;
}

.console {
    background: #05080d;
    border: 1px solid #263650;
    border-radius: 10px;
    padding: 12px;

    height: 330px;
    overflow: auto;

    white-space: pre-wrap;

    font-family: Consolas, monospace;
    font-size: 13px;
}

.row {
    display: flex;
    gap: 10px;
}

.row > * {
    flex: 1;
}

.top-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 11px;
    border-bottom: 1px solid #263650;
    text-align: left;
}

.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 6px;
    background: #273650;
    font-size: 12px;
}

.owner {
    background:
        linear-gradient(
            135deg,
            #101c30,
            #142947
        );
    border-color: #3d83ca;
}

#toast {
    position: fixed;
    right: 20px;
    bottom: 20px;

    background: #18253a;
    border: 1px solid #344966;

    padding: 13px 17px;
    border-radius: 10px;

    display: none;

    z-index: 1000;
}

</style>
</head>

<body>

<div class="nav">

    <div class="logo">
        Florian /
        <span>WeisserHai Minecraft Hosting</span>
    </div>

    <div id="navUser" class="nav-user"></div>

</div>

<div class="container">

    <div id="authPage">

        <div class="auth card">

            <h1>Willkommen</h1>

            <p class="muted">
                Minecraft Hosting
            </p>

            <div id="loginBox">

                <h2>Login</h2>

                <input
                    id="loginEmail"
                    type="email"
                    placeholder="E-Mail"
                >

                <input
                    id="loginPassword"
                    type="password"
                    placeholder="Passwort"
                >

                <button
                    onclick="login()"
                    style="width:100%"
                >
                    Einloggen
                </button>

                <br><br>

                <button
                    class="secondary"
                    onclick="showRegister()"
                    style="width:100%"
                >
                    Neues Konto erstellen
                </button>

                <div id="loginError" class="error"></div>

            </div>

            <div id="registerBox" class="hidden">

                <h2>Registrieren</h2>

                <input
                    id="registerUsername"
                    placeholder="Benutzername"
                >

                <input
                    id="registerEmail"
                    type="email"
                    placeholder="E-Mail"
                >

                <input
                    id="registerPassword"
                    type="password"
                    placeholder="Passwort"
                >

                <button
                    onclick="register()"
                    style="width:100%"
                >
                    Registrieren
                </button>

                <br><br>

                <button
                    class="secondary"
                    onclick="showLogin()"
                    style="width:100%"
                >
                    Zurück zum Login
                </button>

                <div
                    id="registerError"
                    class="error"
                ></div>

            </div>

        </div>

    </div>

    <div id="appPage" class="hidden">

        <div class="top-actions">

            <button onclick="showDashboard()">
                Dashboard
            </button>

            <button
                id="ownerButton"
                class="warning hidden"
                onclick="showOwner()"
            >
                Owner Panel
            </button>

            <button
                class="secondary"
                onclick="logout()"
            >
                Logout
            </button>

        </div>

        <div id="dashboardPage">

            <div class="card">

                <h1>Dein Minecraft Hosting</h1>

                <p class="muted">
                    Erstelle und verwalte deine Minecraft-Server.
                </p>

                <div class="row">

                    <div>
                        <label>Servername</label>

                        <input
                            id="newServerName"
                            placeholder="Mein Minecraft Server"
                        >
                    </div>

                    <div>
                        <label>RAM</label>

                        <select id="newServerMemory">

                            <option value="1G">
                                1 GB
                            </option>

                            <option value="2G">
                                2 GB
                            </option>

                            <option value="4G">
                                4 GB
                            </option>

                            <option value="8G">
                                8 GB
                            </option>

                        </select>

                    </div>

                </div>

                <button onclick="createServer()">
                    + Server erstellen
                </button>

            </div>

            <div class="card">

                <h2>Meine Server</h2>

                <div
                    id="serverList"
                    class="grid"
                ></div>

            </div>

        </div>

        <div id="serverPage" class="hidden">

            <div class="top-actions">

                <button
                    class="secondary"
                    onclick="showDashboard()"
                >
                    ← Zurück
                </button>

            </div>

            <div
                id="serverDetails"
            ></div>

            <div class="card">

                <h2>Konsole</h2>

                <div
                    id="console"
                    class="console"
                ></div>

                <div class="row">

                    <input
                        id="consoleCommand"
                        placeholder="Minecraft-Befehl, z.B. say Hallo"
                        onkeydown="if(event.key==='Enter') sendCommand()"
                    >

                    <button
                        onclick="sendCommand()"
                    >
                        Senden
                    </button>

                </div>

            </div>

            <div class="card">

                <h2>Dateien / Coding</h2>

                <div class="row">

                    <div>

                        <h3>Dateien</h3>

                        <div id="fileList"></div>

                    </div>

                    <div>

                        <input
                            id="filePath"
                            placeholder="z.B. server.properties"
                        >

                        <textarea
                            id="fileContent"
                            placeholder="Dateiinhalt..."
                        ></textarea>

                        <div class="actions">

                            <button
                                onclick="loadFile()"
                            >
                                Datei laden
                            </button>

                            <button
                                onclick="saveFile()"
                                class="success"
                            >
                                Speichern
                            </button>

                            <button
                                onclick="createFile()"
                                class="secondary"
                            >
                                Neue Datei
                            </button>

                        </div>

                    </div>

                </div>

            </div>

        </div>

        <div
            id="ownerPage"
            class="hidden"
        >

            <div class="card owner">

                <h1>👑 Owner Panel</h1>

                <p class="muted">
                    Nur für
                    florianzustolberg@gmail.com
                </p>

                <button
                    class="danger"
                    onclick="shutdownAll()"
                >
                    Alle Server herunterfahren
                </button>

            </div>

            <div class="card">

                <h2>Alle Server</h2>

                <div id="ownerServers"></div>

            </div>

            <div class="card">

                <h2>Benutzer</h2>

                <div id="ownerUsers"></div>

            </div>

        </div>

    </div>

</div>

<div id="toast"></div>

<script>

let currentUser = null;
let currentServer = null;

function toast(message) {

    const el =
        document.getElementById("toast");

    el.textContent = message;
    el.style.display = "block";

    setTimeout(() => {
        el.style.display = "none";
    }, 3000);
}

async function api(url, options = {}) {

    const response =
        await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                "Content-Type":
                    "application/json",
                ...(options.headers || {})
            }
        });

    let data = {};

    try {
        data = await response.json();
    } catch {}

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Anfrage fehlgeschlagen."
        );
    }

    return data;
}

function showLogin() {

    document
        .getElementById("loginBox")
        .classList.remove("hidden");

    document
        .getElementById("registerBox")
        .classList.add("hidden");
}

function showRegister() {

    document
        .getElementById("loginBox")
        .classList.add("hidden");

    document
        .getElementById("registerBox")
        .classList.remove("hidden");
}

async function login() {

    const email =
        document.getElementById(
            "loginEmail"
        ).value;

    const password =
        document.getElementById(
            "loginPassword"
        ).value;

    try {

        const data =
            await api(
                "/api/login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

        currentUser = data.user;

        openApp();

        toast(
            "Erfolgreich eingeloggt."
        );

    } catch (error) {

        document
            .getElementById(
                "loginError"
            )
            .textContent =
            error.message;
    }
}

async function register() {

    const username =
        document.getElementById(
            "registerUsername"
        ).value;

    const email =
        document.getElementById(
            "registerEmail"
        ).value;

    const password =
        document.getElementById(
            "registerPassword"
        ).value;

    try {

        const data =
            await api(
                "/api/register",
                {
                    method: "POST",
                    body: JSON.stringify({
                        username,
                        email,
                        password
                    })
                }
            );

        currentUser = data.user;

        openApp();

        toast(
            "Konto erstellt."
        );

    } catch (error) {

        document
            .getElementById(
                "registerError"
            )
            .textContent =
            error.message;
    }
}

async function logout() {

    try {
        await api(
            "/api/logout",
            {
                method: "POST"
            }
        );
    } catch {}

    currentUser = null;
    currentServer = null;

    document
        .getElementById("appPage")
        .classList.add("hidden");

    document
        .getElementById("authPage")
        .classList.remove("hidden");

    showLogin();

    toast("Ausgeloggt.");
}

function openApp() {

    document
        .getElementById("authPage")
        .classList.add("hidden");

    document
        .getElementById("appPage")
        .classList.remove("hidden");

    const nav =
        document.getElementById(
            "navUser"
        );

    nav.innerHTML =
        "<span>" +
        escapeHtml(
            currentUser.username
        ) +
        "</span> " +
        "<span class='badge'>" +
        escapeHtml(
            currentUser.coins
        ) +
        " Coins</span>";

    if (currentUser.owner) {

        document
            .getElementById(
                "ownerButton"
            )
            .classList.remove(
                "hidden"
            );

    } else {

        document
            .getElementById(
                "ownerButton"
            )
            .classList.add(
                "hidden"
            );
    }

    showDashboard();
}

function showDashboard() {

    document
        .getElementById(
            "dashboardPage"
        )
        .classList.remove(
            "hidden"
        );

    document
        .getElementById(
            "serverPage"
        )
        .classList.add(
            "hidden"
        );

    document
        .getElementById(
            "ownerPage"
        )
        .classList.add(
            "hidden"
        );

    loadServers();
}

function showOwner() {

    if (!currentUser.owner) {
        return;
    }

    document
        .getElementById(
            "dashboardPage"
        )
        .classList.add(
            "hidden"
        );

    document
        .getElementById(
            "serverPage"
        )
        .classList.add(
            "hidden"
        );

    document
        .getElementById(
            "ownerPage"
        )
        .classList.remove(
            "hidden"
        );

    loadOwner();
}

async function loadServers() {

    try {

        const data =
            await api(
                "/api/servers"
            );

        const list =
            document.getElementById(
                "serverList"
            );

        if (!data.servers.length) {

            list.innerHTML =
                "<p class='muted'>" +
                "Noch keine Server." +
                "</p>";

            return;
        }

        list.innerHTML =
            data.servers.map(
                server => {

                    let status =
                        server.status;

                    let statusClass =
                        status === "running"
                            ? "running"
                            : "offline";

                    if (server.locked) {
                        statusClass =
                            "locked";
                    }

                    return \`
                        <div class="server">

                            <div class="server-title">

                                <h3>
                                    \${escapeHtml(
                                        server.name
                                    )}
                                </h3>

                                <span
                                    class="status \${statusClass}"
                                >
                                    \${server.locked
                                        ? "GESPERRT"
                                        : escapeHtml(
                                            status
                                        )}
                                </span>

                            </div>

                            <p class="muted">
                                RAM:
                                \${escapeHtml(
                                    server.memory
                                )}
                            </p>

                            <div class="actions">

                                <button
                                    onclick="openServer('\${server.id}')"
                                >
                                    Verwalten
                                </button>

                                <button
                                    class="success"
                                    onclick="serverAction('\${server.id}', 'start')"
                                >
                                    Start
                                </button>

                                <button
                                    class="warning"
                                    onclick="serverAction('\${server.id}', 'restart')"
                                >
                                    Neustart
                                </button>

                                <button
                                    class="danger"
                                    onclick="serverAction('\${server.id}', 'stop')"
                                >
                                    Stop
                                </button>

                            </div>

                        </div>
                    \`;
                }
            ).join("");

    } catch (error) {

        toast(error.message);
    }
}

async function createServer() {

    const name =
        document.getElementById(
            "newServerName"
        ).value;

    const memory =
        document.getElementById(
            "newServerMemory"
        ).value;

    try {

        await api(
            "/api/servers",
            {
                method: "POST",
                body: JSON.stringify({
                    name,
                    memory
                })
            }
        );

        document.getElementById(
            "newServerName"
        ).value = "";

        toast(
            "Minecraft-Server erstellt."
        );

        loadServers();

    } catch (error) {

        toast(error.message);
    }
}

async function serverAction(
    id,
    action
) {

    try {

        await api(
            "/api/servers/" +
            id +
            "/" +
            action,
            {
                method: "POST"
            }
        );

        toast(
            "Aktion ausgeführt."
        );

        loadServers();

        if (
            currentServer &&
            currentServer.id === id
        ) {
            loadServerDetails();
        }

    } catch (error) {

        toast(error.message);
    }
}

async function openServer(id) {

    currentServer = {
        id
    };

    document
        .getElementById(
            "dashboardPage"
        )
        .classList.add(
            "hidden"
        );

    document
        .getElementById(
            "serverPage"
        )
        .classList.remove(
            "hidden"
        );

    await loadServerDetails();
    await loadLogs();
    await loadFiles();
}

async function loadServerDetails() {

    if (!currentServer) return;

    try {

        const data =
            await api(
                "/api/servers/" +
                currentServer.id
            );

        currentServer =
            data.server;

        const el =
            document.getElementById(
                "serverDetails"
            );

        el.innerHTML = \`
            <div class="card">

                <h1>
                    \${escapeHtml(
                        currentServer.name
                    )}
                </h1>

                <p class="muted">
                    Status:
                    \${escapeHtml(
                        currentServer.status
                    )}
                </p>

                <p>
                    RAM:
                    \${escapeHtml(
                        currentServer.memory
                    )}
                </p>

                <p>
                    \${currentServer.locked
                        ? "🔒 Server gesperrt"
                        : "🔓 Server nicht gesperrt"}
                </p>

                <p>
                    \${currentServer.maintenance
                        ? "🛠 Wartungsmodus aktiv"
                        : ""}
                </p>

                <div class="actions">

                    <button
                        class="success"
                        onclick="serverAction('${currentServer.id}', 'start')"
                    >
                        Start
                    </button>

                    <button
                        class="warning"
                        onclick="serverAction('${currentServer.id}', 'restart')"
                    >
                        Neustart
                    </button>

                    <button
                        class="danger"
                        onclick="serverAction('${currentServer.id}', 'stop')"
                    >
                        Stop
                    </button>

                    <button
                        class="secondary"
                        onclick="loadServerDetails()"
                    >
                        Aktualisieren
                    </button>

                </div>

            </div>
        \`;

    } catch (error) {

        toast(error.message);
    }
}

async function loadLogs() {

    if (!currentServer) return;

    try {

        const data =
            await api(
                "/api/servers/" +
                currentServer.id +
                "/logs"
            );

        const consoleEl =
            document.getElementById(
                "console"
            );

        consoleEl.textContent =
            data.logs.join("\\n");

        consoleEl.scrollTop =
            consoleEl.scrollHeight;

    } catch (error) {

        toast(error.message);
    }
}

async function sendCommand() {

    const input =
        document.getElementById(
            "consoleCommand"
        );

    const command =
        input.value.trim();

    if (!command) return;

    try {

        await api(
            "/api/servers/" +
            currentServer.id +
            "/console",
            {
                method: "POST",
                body: JSON.stringify({
                    command
                })
            }
        );

        input.value = "";

        await loadLogs();

    } catch (error) {

        toast(error.message);
    }
}

async function loadFiles() {

    if (!currentServer) return;

    try {

        const data =
            await api(
                "/api/servers/" +
                currentServer.id +
                "/files"
            );

        const list =
            document.getElementById(
                "fileList"
            );

        list.innerHTML =
            data.files.map(
                file => \`
                    <div
                        style="
                            padding:8px;
                            border-bottom:1px solid #263650;
                        "
                    >

                        \${file.type === "file"
                            ? "📄"
                            : "📁"}

                        <a
                            href="#"
                            onclick="selectFile('\${encodeURIComponent(file.path)}');return false;"
                            style="color:#62b0ff"
                        >
                            \${escapeHtml(
                                file.path
                            )}
                        </a>

                    </div>
                \`
            ).join("");

    } catch (error) {

        toast(error.message);
    }
}

async function selectFile(encoded) {

    const file =
        decodeURIComponent(encoded);

    document.getElementById(
        "filePath"
    ).value = file;

    await loadFile();
}

async function loadFile() {

    const file =
        document.getElementById(
            "filePath"
        ).value.trim();

    if (!file) {
        toast(
            "Dateipfad eingeben."
        );
        return;
    }

    try {

        const data =
            await api(
                "/api/servers/" +
                currentServer.id +
                "/file?path=" +
                encodeURIComponent(file)
            );

        document.getElementById(
            "fileContent"
        ).value =
            data.content;

    } catch (error) {

        toast(error.message);
    }
}

async function saveFile() {

    const file =
        document.getElementById(
            "filePath"
        ).value.trim();

    const content =
        document.getElementById(
            "fileContent"
        ).value;

    try {

        await api(
            "/api/servers/" +
            currentServer.id +
            "/file",
            {
                method: "PUT",
                body: JSON.stringify({
                    path: file,
                    content
                })
            }
        );

        toast(
            "Datei gespeichert."
        );

        loadFiles();

    } catch (error) {

        toast(error.message);
    }
}

async function createFile() {

    const file =
        document.getElementById(
            "filePath"
        ).value.trim();

    if (!file) {
        toast(
            "Dateipfad eingeben."
        );
        return;
    }

    try {

        await api(
            "/api/servers/" +
            currentServer.id +
            "/file",
            {
                method: "POST",
                body: JSON.stringify({
                    path: file,
                    content: ""
                })
            }
        );

        toast(
            "Datei erstellt."
        );

        loadFiles();

    } catch (error) {

        toast(error.message);
    }
}

async function loadOwner() {

    try {

        const serverData =
            await api(
                "/api/owner/servers"
            );

        const userData =
            await api(
                "/api/owner/users"
            );

        renderOwnerServers(
            serverData.servers
        );

        renderOwnerUsers(
            userData.users
        );

    } catch (error) {

        toast(error.message);
    }
}

function renderOwnerServers(
    list
) {

    const el =
        document.getElementById(
            "ownerServers"
        );

    if (!list.length) {

        el.innerHTML =
            "<p class='muted'>" +
            "Keine Server vorhanden." +
            "</p>";

        return;
    }

    el.innerHTML =
        list.map(
            server => \`

                <div class="server">

                    <h3>
                        \${escapeHtml(
                            server.name
                        )}
                    </h3>

                    <p class="muted">
                        Besitzer:
                        \${escapeHtml(
                            server.ownerId
                        )}
                    </p>

                    <p>
                        Status:
                        \${escapeHtml(
                            server.status
                        )}
                    </p>

                    <p>
                        \${server.locked
                            ? "🔒 Gesperrt"
                            : "🔓 Frei"}
                    </p>

                    <div class="actions">

                        <button
                            class="success"
                            onclick="ownerServerAction('${server.id}', 'start')"
                        >
                            Start
                        </button>

                        <button
                            class="danger"
                            onclick="ownerServerAction('${server.id}', 'stop')"
                        >
                            Stop
                        </button>

                        <button
                            class="warning"
                            onclick="ownerMaintenance('${server.id}', true)"
                        >
                            Wartung an
                        </button>

                        <button
                            class="secondary"
                            onclick="ownerMaintenance('${server.id}', false)"
                        >
                            Wartung aus
                        </button>

                        <button
                            class="warning"
                            onclick="ownerLock('${server.id}', ${!server.locked})"
                        >
                            \${server.locked
                                ? "Entsperren"
                                : "Sperren"}
                        </button>

                        <button
                            class="danger"
                            onclick="ownerDeleteServer('${server.id}')"
                        >
                            Löschen
                        </button>

                    </div>

                </div>

            \`
        ).join("");
}

function renderOwnerUsers(
    list
) {

    const el =
        document.getElementById(
            "ownerUsers"
        );

    if (!list.length) {

        el.innerHTML =
            "<p>Keine Benutzer.</p>";

        return;
    }

    el.innerHTML =
        \`
        <table>

            <thead>

                <tr>
                    <th>User</th>
                    <th>E-Mail</th>
                    <th>Coins</th>
                    <th>Rolle</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                </tr>

            </thead>

            <tbody>

                \${list.map(
                    user => \`

                    <tr>

                        <td>
                            \${escapeHtml(
                                user.username
                            )}
                        </td>

                        <td>
                            \${escapeHtml(
                                user.email
                            )}
                        </td>

                        <td>
                            \${escapeHtml(
                                user.coins
                            )}
                        </td>

                        <td>
                            \${escapeHtml(
                                user.role
                            )}
                        </td>

                        <td>
                            \${user.banned
                                ? "🔴 Gebannt"
                                : "🟢 Aktiv"}
                        </td>

                        <td>

                            <div class="actions">

                                <button
                                    onclick="giveCoins('${user.id}')"
                                >
                                    + Coins
                                </button>

                                <button
                                    class="warning"
                                    onclick="setRole('${user.id}')"
                                >
                                    Rolle
                                </button>

                                \${user.banned
                                    ? \`
                                        <button
                                            class="success"
                                            onclick="unbanUser('${user.id}')"
                                        >
                                            Entbannen
                                        </button>
                                      \`
                                    : \`
                                        <button
                                            class="danger"
                                            onclick="banUser('${user.id}')"
                                        >
                                            Bannen
                                        </button>
                                      \`}

                                <button
                                    class="danger"
                                    onclick="deleteUser('${user.id}')"
                                >
                                    Löschen
                                </button>

                            </div>

                        </td>

                    </tr>

                    \`
                ).join("")}

            </tbody>

        </table>
        \`;
}

async function ownerServerAction(
    id,
    action
) {

    try {

        await api(
            "/api/owner/servers/" +
            id +
            "/" +
            action,
            {
                method: "POST"
            }
        );

        toast(
            "Server-Aktion ausgeführt."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function ownerMaintenance(
    id,
    enabled
) {

    try {

        await api(
            "/api/owner/servers/" +
            id +
            "/maintenance",
            {
                method: "POST",
                body: JSON.stringify({
                    enabled
                })
            }
        );

        toast(
            enabled
                ? "Wartung aktiviert."
                : "Wartung deaktiviert."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function ownerLock(
    id,
    lock
) {

    try {

        await api(
            "/api/owner/servers/" +
            id +
            "/" +
            (lock
                ? "lock"
                : "unlock"),
            {
                method: "POST"
            }
        );

        toast(
            lock
                ? "Server gesperrt."
                : "Server entsperrt."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function ownerDeleteServer(
    id
) {

    if (
        !confirm(
            "Diesen Minecraft-Server wirklich löschen?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/owner/servers/" +
            id,
            {
                method: "DELETE"
            }
        );

        toast(
            "Server gelöscht."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function shutdownAll() {

    if (
        !confirm(
            "Wirklich ALLE Minecraft-Server herunterfahren?"
        )
    ) {
        return;
    }

    try {

        const data =
            await api(
                "/api/owner/shutdown-all",
                {
                    method: "POST"
                }
            );

        toast(
            data.stopped +
            " Server heruntergefahren."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function giveCoins(
    userId
) {

    const amount =
        prompt(
            "Wie viele Coins sollen gegeben werden?"
        );

    if (amount === null) {
        return;
    }

    try {

        await api(
            "/api/owner/users/" +
            userId +
            "/coins",
            {
                method: "POST",
                body: JSON.stringify({
                    amount:
                        Number(amount)
                })
            }
        );

        toast(
            "Coins geändert."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function banUser(
    userId
) {

    if (
        !confirm(
            "Benutzer wirklich bannen?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/owner/users/" +
            userId +
            "/ban",
            {
                method: "POST"
            }
        );

        toast(
            "Benutzer gebannt."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function unbanUser(
    userId
) {

    try {

        await api(
            "/api/owner/users/" +
            userId +
            "/unban",
            {
                method: "POST"
            }
        );

        toast(
            "Benutzer entbannt."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function deleteUser(
    userId
) {

    if (
        !confirm(
            "Benutzer wirklich löschen?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/owner/users/" +
            userId,
            {
                method: "DELETE"
            }
        );

        toast(
            "Benutzer gelöscht."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

async function setRole(
    userId
) {

    const role =
        prompt(
            "Rolle eingeben: user, support, moderator oder admin"
        );

    if (!role) return;

    try {

        await api(
            "/api/owner/users/" +
            userId +
            "/role",
            {
                method: "POST",
                body: JSON.stringify({
                    role
                })
            }
        );

        toast(
            "Rolle geändert."
        );

        loadOwner();

    } catch (error) {

        toast(error.message);
    }
}

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ============================================================
   AUTO LOGIN
   ============================================================ */

async function checkLogin() {

    try {

        const data =
            await api(
                "/api/status"
            );

        if (
            data.loggedIn &&
            data.user
        ) {

            currentUser =
                data.user;

            openApp();

        } else {

            document
                .getElementById(
                    "authPage"
                )
                .classList.remove(
                    "hidden"
                );

        }

    } catch {

        document
            .getElementById(
                "authPage"
            )
            .classList.remove(
                "hidden"
            );
    }
}

/* ============================================================
   AUTOMATISCHE AKTUALISIERUNG
   ============================================================ */

setInterval(() => {

    if (
        currentServer &&
        !document
            .getElementById(
                "serverPage"
            )
            .classList.contains(
                "hidden"
            )
    ) {

        loadServerDetails();
        loadLogs();
    }

}, 5000);

/* ============================================================
   START
   ============================================================ */

checkLogin();

</script>

</body>
</html>`;

/* ============================================================
   WEBSEITE
   ============================================================ */

app.get("/", (req, res) => {
    res.type("html").send(HTML);
});

/* ============================================================
   404
   ============================================================ */

app.use((req, res) => {

    if (
        req.path.startsWith("/api/")
    ) {

        return res.status(404).json({
            success: false,
            error: "API-Endpunkt nicht gefunden."
        });
    }

    res.status(404).send(
        "Seite nicht gefunden."
    );
});

/* ============================================================
   ERROR HANDLER
   ============================================================ */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            error:
                "Interner Serverfehler."
        });
    }
);

/* ============================================================
   PROZESSE BEIM BEENDEN STOPPEN
   ============================================================ */

function shutdown() {

    console.log(
        "Fahre Minecraft-Server herunter..."
    );

    for (const [
        serverId,
        processData
    ] of processes) {

        try {

            processData.child.stdin.write(
                "stop\n"
            );

        } catch {

            try {
                processData.child.kill();
            } catch {}
        }
    }

    setTimeout(() => {
        process.exit(0);
    }, 5000);
}

process.on(
    "SIGTERM",
    shutdown
);

process.on(
    "SIGINT",
    shutdown
);

/* ============================================================
   SERVER STARTEN
   ============================================================ */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "=========================================="
        );
        console.log(
            " Florian / WeisserHai Minecraft Hosting"
        );
        console.log(
            "=========================================="
        );
        console.log(
            `Webseite läuft auf Port ${PORT}`
        );
        console.log(
            `Owner: ${OWNER_EMAIL}`
        );
        console.log(
            `Minecraft JAR: ${MINECRAFT_JAR}`
        );
        console.log(
            "=========================================="
        );
        console.log("");
    }
);
```
