"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ADMIN_EMAIL =
    "florianzustolberg@gmail.com";

const EXTRA_SERVER_PRICE_CENTS = 500;

// ======================================================
// PFADE
// ======================================================

const DATA_DIR =
    path.join(__dirname, "data");

const SERVERS_DIR =
    path.join(__dirname, "minecraft-servers");

const USERS_FILE =
    path.join(DATA_DIR, "users.json");

const SERVERS_FILE =
    path.join(DATA_DIR, "servers.json");

const PURCHASES_FILE =
    path.join(DATA_DIR, "purchases.json");

const SETTINGS_FILE =
    path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

fs.mkdirSync(SERVERS_DIR, {
    recursive: true
});


// ======================================================
// JSON
// ======================================================

function ensureFile(file, fallback) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(
                fallback,
                null,
                2
            ),
            "utf8"
        );
    }
}

function readJSON(file, fallback) {
    try {
        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );
    } catch {
        return fallback;
    }
}

function saveJSON(file, data) {
    const temp =
        file +
        "." +
        crypto.randomBytes(5).toString("hex") +
        ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );

    fs.renameSync(
        temp,
        file
    );
}

ensureFile(
    USERS_FILE,
    []
);

ensureFile(
    SERVERS_FILE,
    []
);

ensureFile(
    PURCHASES_FILE,
    []
);

ensureFile(
    SETTINGS_FILE,
    {
        maintenance: false,
        outage: false,
        outageText: ""
    }
);

let users =
    readJSON(
        USERS_FILE,
        []
    );

let servers =
    readJSON(
        SERVERS_FILE,
        []
    );

let purchases =
    readJSON(
        PURCHASES_FILE,
        []
    );

let settings =
    readJSON(
        SETTINGS_FILE,
        {
            maintenance: false,
            outage: false,
            outageText: ""
        }
    );


// ======================================================
// RUNTIME
// ======================================================

const sessions =
    new Map();

const processes =
    new Map();


// ======================================================
// EXPRESS
// ======================================================

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);


// ======================================================
// HILFSFUNKTIONEN
// ======================================================

function makeId(prefix) {
    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        crypto
            .randomBytes(6)
            .toString("hex")
    );
}

function now() {
    return new Date()
        .toISOString();
}

function clean(value, max) {
    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            max
        );
}

function cleanServerName(value) {
    return clean(
        value,
        32
    )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
        );
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}

function hashPassword(password) {
    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");

    const hash =
        crypto
            .scryptSync(
                password,
                salt,
                64
            )
            .toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(
    password,
    stored
) {
    try {
        const parts =
            String(stored)
                .split(":");

        if (
            parts.length !== 2
        ) {
            return false;
        }

        const hash =
            crypto
                .scryptSync(
                    password,
                    parts[0],
                    64
                )
                .toString("hex");

        const a =
            Buffer.from(
                hash,
                "hex"
            );

        const b =
            Buffer.from(
                parts[1],
                "hex"
            );

        if (
            a.length !==
            b.length
        ) {
            return false;
        }

        return crypto
            .timingSafeEqual(
                a,
                b
            );
    } catch {
        return false;
    }
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
    };
}

function isAdminEmail(email) {
    return (
        String(email || "")
            .toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
    );
}

function getUserFromSession(
    req
) {
    const header =
        req.headers.authorization ||
        "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    const token =
        header.slice(7);

    const session =
        sessions.get(token);

    if (!session) {
        return null;
    }

    if (
        Date.now() -
        session.createdAt >
        1000 * 60 * 60 * 24 * 7
    ) {
        sessions.delete(token);
        return null;
    }

    return (
        users.find(
            user =>
                user.email.toLowerCase() ===
                session.email.toLowerCase()
        ) || null
    );
}

function requireLogin(
    req,
    res,
    next
) {
    const user =
        getUserFromSession(
            req
        );

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Du musst angemeldet sein."
        });
    }

    req.user = user;

    next();
}

function requireAdmin(
    req,
    res,
    next
) {
    const user =
        getUserFromSession(
            req
        );

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Du musst angemeldet sein."
        });
    }

    if (
        !isAdminEmail(
            user.email
        )
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Nur der Owner hat Zugriff."
        });
    }

    req.user = user;

    next();
}

function serverFolder(
    serverId
) {
    return path.join(
        SERVERS_DIR,
        serverId
    );
}

function logFolder(
    serverId
) {
    return path.join(
        serverFolder(
            serverId
        ),
        "logs"
    );
}

function logFile(
    serverId
) {
    return path.join(
        logFolder(
            serverId
        ),
        "console.log"
    );
}

function addLog(
    server,
    message
) {
    try {
        fs.mkdirSync(
            logFolder(
                server.id
            ),
            {
                recursive: true
            }
        );

        const line =
            "[" +
            now() +
            "] " +
            String(message) +
            "\n";

        fs.appendFileSync(
            logFile(
                server.id
            ),
            line,
            "utf8"
        );
    } catch (error) {
        console.error(
            "Log-Fehler:",
            error.message
        );
    }
}

function serverIsRunning(
    serverId
) {
    return processes.has(
        serverId
    );
}

function publicServer(
    server
) {
    return {
        id: server.id,
        name: server.name,
        owner: server.owner,
        port: server.port,
        status:
            serverIsRunning(
                server.id
            )
                ? "online"
                : "offline",
        createdAt:
            server.createdAt,
        suspended:
            Boolean(
                server.suspended
            ),
        maintenance:
            Boolean(
                server.maintenance
            )
    };
}


// ======================================================
// AUTH API
// ======================================================

app.post(
    "/api/register",
    (req, res) => {

        const username =
            clean(
                req.body.username,
                24
            );

        const email =
            clean(
                req.body.email,
                120
            ).toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        if (
            !username ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Alle Felder sind erforderlich."
            });
        }

        if (
            !/^[a-zA-Z0-9_]{3,24}$/
                .test(username)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Benutzername muss 3-24 Zeichen haben."
            });
        }

        if (
            !validEmail(email)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Ungültige E-Mail."
            });
        }

        if (
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Passwort muss mindestens 8 Zeichen haben."
            });
        }

        if (
            users.some(
                user =>
                    user.username
                        .toLowerCase() ===
                    username.toLowerCase()
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Benutzername bereits vorhanden."
            });
        }

        if (
            users.some(
                user =>
                    user.email
                        .toLowerCase() ===
                    email
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "E-Mail bereits registriert."
            });
        }

        const user = {
            id:
                makeId("user"),

            username,

            email,

            password:
                hashPassword(
                    password
                ),

            role:
                isAdminEmail(
                    email
                )
                    ? "owner"
                    : "user",

            createdAt:
                now(),

            serverLimit:
                1
        };

        users.push(user);

        saveJSON(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            message:
                "Registrierung erfolgreich."
        });
    }
);


app.post(
    "/api/login",
    (req, res) => {

        const login =
            clean(
                req.body.login,
                120
            ).toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const user =
            users.find(
                entry =>
                    entry.email
                        .toLowerCase() ===
                        login ||
                    entry.username
                        .toLowerCase() ===
                        login
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "Login-Daten falsch."
            });
        }

        if (
            !verifyPassword(
                password,
                user.password
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Login-Daten falsch."
            });
        }

        const token =
            crypto
                .randomBytes(48)
                .toString("hex");

        sessions.set(
            token,
            {
                email:
                    user.email,
                createdAt:
                    Date.now()
            }
        );

        res.json({
            success: true,
            token,
            user:
                publicUser(user),
            admin:
                isAdminEmail(
                    user.email
                )
        });
    }
);


app.post(
    "/api/logout",
    requireLogin,
    (req, res) => {

        const header =
            req.headers.authorization ||
            "";

        const token =
            header.startsWith(
                "Bearer "
            )
                ? header.slice(7)
                : null;

        if (token) {
            sessions.delete(
                token
            );
        }

        res.json({
            success: true,
            message:
                "Erfolgreich abgemeldet."
        });
    }
);


app.get(
    "/api/me",
    requireLogin,
    (req, res) => {

        res.json({
            success: true,
            user:
                publicUser(
                    req.user
                ),
            admin:
                isAdminEmail(
                    req.user.email
                )
        });
    }
);


// ======================================================
// SERVER LIMIT
// ======================================================

function getUserServers(
    user
) {
    return servers.filter(
        server =>
            server.owner
                .toLowerCase() ===
            user.email
                .toLowerCase()
    );
}

function getExtraServerCount(
    user
) {
    return purchases.filter(
        purchase =>
            purchase.userEmail
                .toLowerCase() ===
            user.email
                .toLowerCase() &&
            purchase.status ===
                "paid"
    ).length;
}

function getServerLimit(
    user
) {
    if (
        isAdminEmail(
            user.email
        )
    ) {
        return Infinity;
    }

    return (
        1 +
        getExtraServerCount(
            user
        )
    );
}


// ======================================================
// SERVER ERSTELLEN
// ======================================================

app.post(
    "/api/servers",
    requireLogin,
    (req, res) => {

        const name =
            cleanServerName(
                req.body.name
            );

        const port =
            Number(
                req.body.port
            );

        const owned =
            getUserServers(
                req.user
            );

        const limit =
            getServerLimit(
                req.user
            );

        if (
            owned.length >= limit
        ) {
            return res.status(403).json({
                success: false,
                code:
                    "SERVER_LIMIT",
                message:
                    "Dein Server-Limit ist erreicht. Der nächste Server kostet 5 €."
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message:
                    "Ungültiger Servername."
            });
        }

        if (
            !Number.isInteger(
                port
            ) ||
            port < 1024 ||
            port > 65535
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Port muss zwischen 1024 und 65535 liegen."
            });
        }

        if (
            servers.some(
                server =>
                    server.port ===
                    port
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Dieser Port wird bereits verwendet."
            });
        }

        const id =
            makeId(
                "server"
            );

        const folder =
            serverFolder(
                id
            );

        fs.mkdirSync(
            folder,
            {
                recursive: true
            }
        );

        fs.mkdirSync(
            logFolder(id),
            {
                recursive: true
            }
        );

        const server = {
            id,
            name,
            owner:
                req.user.email,
            port,
            createdAt:
                now(),
            suspended:
                false,
            maintenance:
                false
        };

        servers.push(server);

        saveJSON(
            SERVERS_FILE,
            servers
        );

        addLog(
            server,
            "Server erstellt."
        );

        res.json({
            success: true,
            server:
                publicServer(
                    server
                )
        });
    }
);


// ======================================================
// MEINE SERVER
// ======================================================

app.get(
    "/api/servers",
    requireLogin,
    (req, res) => {

        res.json({
            success: true,
            limit:
                getServerLimit(
                    req.user
                ),
            used:
                getUserServers(
                    req.user
                ).length,
            priceNext:
                EXTRA_SERVER_PRICE_CENTS,
            servers:
                getUserServers(
                    req.user
                ).map(
                    publicServer
                )
        });
    }
);


// ======================================================
// EXTRA SERVER KAUFEN
// ======================================================

app.post(
    "/api/purchase/server",
    requireLogin,
    (req, res) => {

        if (
            isAdminEmail(
                req.user.email
            )
        ) {
            return res.json({
                success: true,
                free:
                    true,
                message:
                    "Als Owner brauchst du keinen Kauf."
            });
        }

        const existing =
            purchases.find(
                purchase =>
                    purchase.userEmail
                        .toLowerCase() ===
                    req.user.email
                        .toLowerCase() &&
                    purchase.status ===
                        "pending"
            );

        if (existing) {
            return res.json({
                success: true,
                purchase:
                    existing,
                message:
                    "Es existiert bereits eine offene Bestellung."
            });
        }

        const purchase = {
            id:
                makeId(
                    "purchase"
                ),

            userEmail:
                req.user.email,

            priceCents:
                EXTRA_SERVER_PRICE_CENTS,

            status:
                "pending",

            createdAt:
                now()
        };

        purchases.push(
            purchase
        );

        saveJSON(
            PURCHASES_FILE,
            purchases
        );

        res.json({
            success: true,
            purchase,
            message:
                "5-€-Bestellung wurde angelegt. Für echtes Bezahlen muss hier dein Zahlungsanbieter angebunden werden."
        });
    }
);


// ======================================================
// ADMIN: KAUF ALS BEZAHLT MARKIEREN
// ======================================================

app.post(
    "/api/admin/purchases/:id/approve",
    requireAdmin,
    (req, res) => {

        const purchase =
            purchases.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message:
                    "Kauf nicht gefunden."
            });
        }

        purchase.status =
            "paid";

        purchase.paidAt =
            now();

        saveJSON(
            PURCHASES_FILE,
            purchases
        );

        res.json({
            success: true,
            message:
                "Zusätzlicher Server freigeschaltet."
        });
    }
);


// ======================================================
// MINECRAFT START
// ======================================================

function startMinecraft(
    server
) {
    if (
        processes.has(
            server.id
        )
    ) {
        return {
            success: true,
            message:
                "Server läuft bereits."
        };
    }

    if (
        server.suspended
    ) {
        return {
            success: false,
            message:
                "Server ist gesperrt."
        };
    }

    if (
        settings.maintenance &&
        !isAdminEmail(
            server.owner
        )
    ) {
        return {
            success: false,
            message:
                "Hosting befindet sich in Wartung."
        };
    }

    const folder =
        serverFolder(
            server.id
        );

    const jar =
        path.join(
            folder,
            "server.jar"
        );

    if (
        !fs.existsSync(
            jar
        )
    ) {
        addLog(
            server,
            "START FEHLER: server.jar fehlt."
        );

        return {
            success: false,
            message:
                "server.jar fehlt im Serverordner."
        };
    }

    const eula =
        path.join(
            folder,
            "eula.txt"
        );

    if (
        !fs.existsSync(
            eula
        )
    ) {
        fs.writeFileSync(
            eula,
            "eula=true\n",
            "utf8"
        );
    }

    addLog(
        server,
        "Minecraft wird gestartet."
    );

    const child =
        spawn(
            "java",
            [
                "-Xms1G",
                "-Xmx2G",
                "-jar",
                "server.jar",
                "nogui"
            ],
            {
                cwd:
                    folder,
                env:
                    process.env
            }
        );

    processes.set(
        server.id,
        child
    );

    child.stdout.on(
        "data",
        data => {

            const text =
                data.toString();

            process.stdout.write(
                "[" +
                server.name +
                "] " +
                text
            );

            addLog(
                server,
                text.trim()
            );
        }
    );

    child.stderr.on(
        "data",
        data => {

            const text =
                data.toString();

            process.stderr.write(
                "[" +
                server.name +
                "] " +
                text
            );

            addLog(
                server,
                "ERROR: " +
                text.trim()
            );
        }
    );

    child.on(
        "error",
        error => {

            processes.delete(
                server.id
            );

            addLog(
                server,
                "Prozessfehler: " +
                error.message
            );
        }
    );

    child.on(
        "close",
        code => {

            processes.delete(
                server.id
            );

            addLog(
                server,
                "Minecraft beendet. Exit-Code: " +
                code
            );
        }
    );

    return {
        success: true,
        message:
            "Server wird gestartet."
    };
}


app.post(
    "/api/servers/:id/start",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        res.json(
            startMinecraft(
                server
            )
        );
    }
);


// ======================================================
// STOP
// ======================================================

app.post(
    "/api/servers/:id/stop",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.json({
                success: true,
                message:
                    "Server ist bereits offline."
            });
        }

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        addLog(
            server,
            "Stop angefordert."
        );

        res.json({
            success: true,
            message:
                "Server wird gestoppt."
        });
    }
);


// ======================================================
// RESTART
// ======================================================

app.post(
    "/api/servers/:id/restart",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.json({
                success: false,
                message:
                    "Server ist offline."
            });
        }

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        addLog(
            server,
            "Neustart angefordert."
        );

        setTimeout(
            () => {

                if (
                    !processes.has(
                        server.id
                    )
                ) {
                    startMinecraft(
                        server
                    );
                }

            },
            6000
        );

        res.json({
            success: true,
            message:
                "Server wird neugestartet."
        });
    }
);


// ======================================================
// COMMAND
// ======================================================

app.post(
    "/api/servers/:id/command",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        const command =
            clean(
                req.body.command,
                500
            );

        if (!command) {
            return res.status(400).json({
                success: false,
                message:
                    "Kein Befehl."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.status(400).json({
                success: false,
                message:
                    "Server ist offline."
            });
        }

        try {

            child.stdin.write(
                command +
                "\n"
            );

            addLog(
                server,
                "COMMAND: " +
                command
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);


// ======================================================
// LOGS
// ======================================================

app.get(
    "/api/servers/:id/logs",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false
            });
        }

        const file =
            logFile(
                server.id
            );

        if (
            !fs.existsSync(
                file
            )
        ) {
            return res.json({
                success: true,
                logs: ""
            });
        }

        let logs =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (
            logs.length >
            100000
        ) {
            logs =
                logs.slice(
                    -100000
                );
        }

        res.json({
            success: true,
            logs
        });
    }
);


// ======================================================
// SERVER LÖSCHEN
// ======================================================

app.delete(
    "/api/servers/:id",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        if (
            server.owner
                .toLowerCase() !==
            req.user.email
                .toLowerCase() &&
            !isAdminEmail(
                req.user.email
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (child) {

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}

            processes.delete(
                server.id
            );
        }

        servers =
            servers.filter(
                item =>
                    item.id !==
                    server.id
            );

        saveJSON(
            SERVERS_FILE,
            servers
        );

        try {
            fs.rmSync(
                serverFolder(
                    server.id
                ),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (error) {
            console.error(
                error.message
            );
        }

        res.json({
            success: true,
            message:
                "Server gelöscht."
        });
    }
);


// ======================================================
// ADMIN: ALLE SERVER
// ======================================================

app.get(
    "/api/admin/servers",
    requireAdmin,
    (req, res) => {

        res.json({
            success: true,
            servers:
                servers.map(
                    publicServer
                )
        });
    }
);


// ======================================================
// ADMIN: ALLE SERVER STOPPEN
// ======================================================

app.post(
    "/api/admin/stop-all",
    requireAdmin,
    (req, res) => {

        let stopped =
            0;

        for (
            const server of servers
        ) {

            const child =
                processes.get(
                    server.id
                );

            if (!child) {
                continue;
            }

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {
                try {
                    child.kill();
                } catch {}
            }

            addLog(
                server,
                "OWNER: Server heruntergefahren."
            );

            stopped++;
        }

        res.json({
            success: true,
            stopped
        });
    }
);


// ======================================================
// ADMIN: SERVER SPERREN
// ======================================================

app.post(
    "/api/admin/servers/:id/suspend",
    requireAdmin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        server.suspended =
            true;

        const child =
            processes.get(
                server.id
            );

        if (child) {
            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}

            processes.delete(
                server.id
            );
        }

        saveJSON(
            SERVERS_FILE,
            servers
        );

        addLog(
            server,
            "OWNER: Server gesperrt."
        );

        res.json({
            success: true,
            message:
                "Server gesperrt."
        });
    }
);


// ======================================================
// ADMIN: SERVER ENTSPERREN
// ======================================================

app.post(
    "/api/admin/servers/:id/unsuspend",
    requireAdmin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        server.suspended =
            false;

        saveJSON(
            SERVERS_FILE,
            servers
        );

        addLog(
            server,
            "OWNER: Server entsperrt."
        );

        res.json({
            success: true,
            message:
                "Server entsperrt."
        });
    }
);


// ======================================================
// ADMIN: SERVER WARTUNG
// ======================================================

app.post(
    "/api/admin/servers/:id/maintenance",
    requireAdmin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        server.maintenance =
            Boolean(
                req.body.enabled
            );

        saveJSON(
            SERVERS_FILE,
            servers
        );

        addLog(
            server,
            "OWNER: Wartungsmodus " +
            (
                server.maintenance
                    ? "aktiviert."
                    : "deaktiviert."
            )
        );

        res.json({
            success: true,
            maintenance:
                server.maintenance
        });
    }
);


// ======================================================
// ADMIN: SERVER LÖSCHEN
// ======================================================

app.delete(
    "/api/admin/servers/:id",
    requireAdmin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (child) {
            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}

            processes.delete(
                server.id
            );
        }

        servers =
            servers.filter(
                item =>
                    item.id !==
                    server.id
            );

        saveJSON(
            SERVERS_FILE,
            servers
        );

        try {
            fs.rmSync(
                serverFolder(
                    server.id
                ),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}

        res.json({
            success: true,
            message:
                "Server gelöscht."
        });
    }
);


// ======================================================
// ADMIN: WARTUNG GESAMTE WEBSITE
// ======================================================

app.post(
    "/api/admin/maintenance",
    requireAdmin,
    (req, res) => {

        settings.maintenance =
            Boolean(
                req.body.enabled
            );

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        res.json({
            success: true,
            maintenance:
                settings.maintenance
        });
    }
);


// ======================================================
// ADMIN: STÖRUNG
// ======================================================

app.post(
    "/api/admin/outage",
    requireAdmin,
    (req, res) => {

        settings.outage =
            Boolean(
                req.body.enabled
            );

        settings.outageText =
            clean(
                req.body.text,
                500
            );

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        res.json({
            success: true,
            outage:
                settings.outage,
            outageText:
                settings.outageText
        });
    }
);


// ======================================================
// ADMIN: BENUTZER
// ======================================================

app.get(
    "/api/admin/users",
    requireAdmin,
    (req, res) => {

        res.json({
            success: true,
            users:
                users.map(
                    publicUser
                )
        });
    }
);


// ======================================================
// ADMIN: KÄUFE
// ======================================================

app.get(
    "/api/admin/purchases",
    requireAdmin,
    (req, res) => {

        res.json({
            success: true,
            purchases
        });
    }
);


// ======================================================
// WEBSITE HTML
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.send(`
<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
>

<meta
    name="theme-color"
    content="#07120a"
>

<title>
Minecraft Host Console
</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;

    min-height: 100vh;

    color: white;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        radial-gradient(
            circle at 50% 0%,
            #1d4820,
            #061006 45%,
            #020302 100%
        );
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

nav {
    position: sticky;

    top: 0;

    z-index: 50;

    display: flex;

    justify-content: space-between;

    align-items: center;

    gap: 15px;

    padding:
        14px 20px;

    background:
        rgba(2,8,3,.95);

    border-bottom:
        1px solid
        rgba(85,190,80,.2);

    backdrop-filter:
        blur(12px);
}

.logo {
    font-size: 20px;
    font-weight: 900;
}

.nav-buttons {
    display:
        flex;

    gap:
        8px;

    flex-wrap:
        wrap;
}

button {
    padding:
        10px 14px;

    border: 0;

    border-radius:
        7px;

    color:
        white;

    background:
        #3f9139;
}

button:hover {
    filter:
        brightness(1.13);
}

.red {
    background:
        #9f3535;
}

.orange {
    background:
        #a96d2e;
}

.dark {
    background:
        #1a241c;
}

.page {
    width:
        min(
            1150px,
            calc(100% - 24px)
        );

    margin:
        25px auto 80px;
}

.hero {
    padding:
        55px 20px;

    text-align:
        center;

    border-radius:
        18px;

    background:
        rgba(7,16,8,.88);

    border:
        1px solid
        rgba(90,200,80,.2);

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.35);
}

.hero h1 {
    margin: 0;

    font-size:
        clamp(
            36px,
            8vw,
            75px
        );
}

.hero p {
    color:
        #aeb9ae;

    line-height:
        1.6;
}

.status {
    display:
        inline-block;

    margin-top:
        15px;

    padding:
        8px 14px;

    border-radius:
        999px;

    background:
        rgba(75,180,65,.15);

    color:
        #82e77a;
}

.grid {
    display:
        grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                260px,
                1fr
            )
        );

    gap:
        15px;

    margin-top:
        20px;
}

.box {
    padding:
        20px;

    border-radius:
        12px;

    background:
        rgba(7,15,8,.92);

    border:
        1px solid
        rgba(90,200,80,.16);
}

.box h2 {
    margin-top: 0;
}

.form {
    display:
        grid;

    gap:
        9px;
}

input,
textarea {
    width: 100%;

    padding:
        12px;

    border:
        1px solid
        #304332;

    border-radius:
        7px;

    color: white;

    background:
        #0b110c;

    outline:
        none;
}

textarea {
    min-height:
        160px;

    resize:
        vertical;

    font-family:
        monospace;
}

input:focus,
textarea:focus {
    border-color:
        #55bf4e;
}

.hidden {
    display:
        none !important;
}

.server {
    padding:
        17px;

    border-radius:
        10px;

    background:
        #0b130c;

    border:
        1px solid
        #2b3c2e;
}

.server h3 {
    margin-top:
        0;
}

.server-actions {
    display:
        flex;

    gap:
        7px;

    flex-wrap:
        wrap;

    margin-top:
        12px;
}

.online {
    color:
        #79e66d;
}

.offline {
    color:
        #e17878;
}

.console {
    margin-top:
        12px;

    min-height:
        220px;

    max-height:
        450px;

    overflow:
        auto;

    padding:
        14px;

    white-space:
        pre-wrap;

    word-break:
        break-word;

    background:
        #020402;

    color:
        #a3e79c;

    border-radius:
        8px;

    font:
        12px
        Consolas,
        monospace;
}

.modal {
    position:
        fixed;

    inset:
        0;

    z-index:
        200;

    display:
        none;

    align-items:
        center;

    justify-content:
        center;

    padding:
        15px;

    background:
        rgba(0,0,0,.76);

    backdrop-filter:
        blur(8px);
}

.modal.active {
    display:
        flex;
}

.modal-box {
    width:
        min(
            430px,
            100%
        );

    padding:
        24px;

    border:
        1px solid
        #345438;

    border-radius:
        12px;

    background:
        #081009;

    box-shadow:
        0 30px 90px
        rgba(0,0,0,.8);
}

.modal-top {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    margin-bottom:
        15px;
}

.close {
    background:
        transparent;

    font-size:
        26px;

    padding:
        4px 8px;
}

.admin-panel {
    border-color:
        rgba(230,170,60,.35);
}

.buy-card {
    border-color:
        rgba(230,180,70,.35);
}

@media (max-width:600px) {

    nav {
        flex-direction:
            column;

        align-items:
            flex-start;
    }

    .page {
        width:
            calc(100% - 12px);

        margin-top:
            15px;
    }

    .hero {
        padding:
            42px 15px;
    }

    .box {
        padding:
            15px;
    }

    .server-actions button {
        flex:
            1 1 auto;
    }

}

</style>

</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Host Console
</div>

<div
    class="nav-buttons"
    id="navButtons"
>

<button
    onclick="openModal('loginModal')"
>
🔑 Anmelden
</button>

<button
    onclick="openModal('registerModal')"
>
📝 Registrieren
</button>

</div>

</nav>

<main class="page">

<section class="hero">

<h1>
Minecraft Host Console
</h1>

<p>
Dein eigener Minecraft-Server.
</p>

<div
    id="systemStatus"
    class="status"
>
🟢 System online
</div>

</section>


<section
    id="accountBox"
    class="box hidden"
>

<h2>
👤 Konto
</h2>

<p id="accountInfo"></p>

</section>


<section
    id="hostingBox"
    class="box hidden"
>

<h2>
🖥️ Mein Hosting
</h2>

<p id="serverLimitInfo"></p>

<div class="grid">

<div class="box">

<h3>
➕ Server erstellen
</h3>

<div class="form">

<input
    id="serverName"
    placeholder="Servername"
    maxlength="32"
>

<input
    id="serverPort"
    type="number"
    min="1024"
    max="65535"
    placeholder="Port, z.B. 25565"
>

<button
    onclick="createServer()"
>
🚀 Server erstellen
</button>

</div>

</div>


<div
    id="buyExtra"
    class="box buy-card"
>

<h3>
💶 Weiteren Server
</h3>

<p>
Dein erster Server ist kostenlos.
Jeder weitere kostet 5 €.
</p>

<button
    class="orange"
    onclick="buyServer()"
>
💳 Server für 5 € kaufen
</button>

</div>

</div>


<h2>
Meine Server
</h2>

<div
    id="serverList"
    class="grid"
></div>

</section>


<section
    id="adminBox"
    class="box admin-panel hidden"
>

<h2>
👑 Owner Host Console
</h2>

<p>
Nur für:
<strong>
${ADMIN_EMAIL}
</strong>
</p>

<div class="server-actions">

<button
    class="orange"
    onclick="setMaintenance(true)"
>
🛠️ Website-Wartung AN
</button>

<button
    class="dark"
    onclick="setMaintenance(false)"
>
✅ Website-Wartung AUS
</button>

<button
    class="red"
    onclick="stopAll()"
>
⛔ Alle Server stoppen
</button>

<button
    class="red"
    onclick="setOutage(true)"
>
🚨 Störung AN
</button>

<button
    class="dark"
    onclick="setOutage(false)"
>
✅ Störung AUS
</button>

</div>

<br>

<input
    id="outageText"
    placeholder="Störungstext"
>

<h2>
🖥️ Alle Server
</h2>

<div
    id="adminServers"
    class="grid"
></div>

<h2>
💳 Extra-Server-Käufe
</h2>

<div
    id="adminPurchases"
    class="grid"
></div>

<h2>
👥 Benutzer
</h2>

<div
    id="adminUsers"
    class="grid"
></div>

</section>

</main>


<!-- LOGIN -->

<div
    class="modal"
    id="loginModal"
>

<div class="modal-box">

<div class="modal-top">

<h2>
🔑 Anmeldung
</h2>

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

</div>

<div class="form">

<input
    id="loginInput"
    placeholder="Benutzername oder E-Mail"
>

<input
    id="loginPassword"
    type="password"
    placeholder="Passwort"
>

<button
    onclick="login()"
>
Anmelden
</button>

</div>

<p id="loginMessage"></p>

</div>

</div>


<!-- REGISTER -->

<div
    class="modal"
    id="registerModal"
>

<div class="modal-box">

<div class="modal-top">

<h2>
📝 Registrierung
</h2>

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

</div>

<div class="form">

<input
    id="registerUsername"
    placeholder="Benutzername"
    maxlength="24"
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
    onclick="registerUser()"
>
Konto erstellen
</button>

</div>

<p id="registerMessage"></p>

</div>

</div>


<script>

let authToken =
    localStorage.getItem(
        "minecraft_host_token"
    ) || "";

let currentUser =
    null;

let pollTimers = {};


function openModal(id) {

    closeModals();

    document
        .getElementById(id)
        .classList
        .add("active");
}


function closeModals() {

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(
            modal =>
                modal
                    .classList
                    .remove("active")
        );
}


async function api(
    url,
    options = {}
) {

    const headers =
        options.headers || {};

    headers[
        "Content-Type"
    ] =
        "application/json";

    if (authToken) {
        headers[
            "Authorization"
        ] =
            "Bearer " +
            authToken;
    }

    options.headers =
        headers;

    const response =
        await fetch(
            url,
            options
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch {}

    return {
        response,
        data
    };
}


/* =====================================================
   REGISTER
===================================================== */

async function registerUser() {

    const username =
        document
            .getElementById(
                "registerUsername"
            )
            .value
            .trim();

    const email =
        document
            .getElementById(
                "registerEmail"
            )
            .value
            .trim();

    const password =
        document
            .getElementById(
                "registerPassword"
            )
            .value;

    const result =
        await api(
            "/api/register",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        username,
                        email,
                        password
                    })
            }
        );

    document
        .getElementById(
            "registerMessage"
        )
        .textContent =
            result.data.message ||
            "Fehler.";

    if (
        result.data.success
    ) {

        setTimeout(
            () => {

                closeModals();

                openModal(
                    "loginModal"
                );

            },
            1000
        );
    }
}


/* =====================================================
   LOGIN
===================================================== */

async function login() {

    const loginValue =
        document
            .getElementById(
                "loginInput"
            )
            .value
            .trim();

    const password =
        document
            .getElementById(
                "loginPassword"
            )
            .value;

    const result =
        await api(
            "/api/login",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        login:
                            loginValue,
                        password
                    })
            }
        );

    if (
        !result.data.success
    ) {

        document
            .getElementById(
                "loginMessage"
            )
            .textContent =
                "❌ " +
                (
                    result.data.message ||
                    "Login fehlgeschlagen."
                );

        return;
    }

    authToken =
        result.data.token;

    currentUser =
        result.data.user;

    localStorage.setItem(
        "minecraft_host_token",
        authToken
    );

    closeModals();

    updateUI();

    await loadServers();

    if (
        currentUser.admin
    ) {
        await loadAdmin();
    }
}


/* =====================================================
   UI
===================================================== */

function updateUI() {

    if (!currentUser) {
        return;
    }

    document
        .getElementById(
            "accountBox"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "hostingBox"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "accountInfo"
        )
        .textContent =
            currentUser.username +
            " – " +
            currentUser.email;

    document
        .getElementById(
            "navButtons"
        )
        .innerHTML =
            "<button class='dark' onclick='logout()'>🚪 Logout</button>";

    if (
        currentUser.admin
    ) {

        document
            .getElementById(
                "adminBox"
            )
            .classList
            .remove("hidden");
    }
}


/* =====================================================
   LOAD CURRENT LOGIN
===================================================== */

async function restoreLogin() {

    if (!authToken) {
        return;
    }

    const result =
        await api(
            "/api/me"
        );

    if (
        !result.data.success
    ) {

        authToken = "";

        localStorage.removeItem(
            "minecraft_host_token"
        );

        return;
    }

    currentUser =
        result.data.user;

    updateUI();

    await loadServers();

    if (
        currentUser.admin
    ) {
        await loadAdmin();
    }
}


/* =====================================================
   LOGOUT
===================================================== */

async function logout() {

    await api(
        "/api/logout",
        {
            method:
                "POST"
        }
    );

    authToken = "";

    currentUser =
        null;

    localStorage.removeItem(
        "minecraft_host_token"
    );

    location.reload();
}


/* =====================================================
   SERVER
===================================================== */

async function createServer() {

    const name =
        document
            .getElementById(
                "serverName"
            )
            .value
            .trim();

    const port =
        Number(
            document
                .getElementById(
                    "serverPort"
                )
                .value
        );

    const result =
        await api(
            "/api/servers",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        name,
                        port
                    })
            }
        );

    if (
        !result.data.success &&
        result.data.code ===
            "SERVER_LIMIT"
    ) {

        const buy =
            confirm(
                "Dein kostenloser Server ist bereits vergeben. Einen weiteren Server kannst du für 5 € bestellen. Jetzt Kaufauftrag erstellen?"
            );

        if (buy) {
            await buyServer();
        }

        return;
    }

    alert(
        result.data.message ||
        (
            result.data.success
                ? "Server erstellt."
                : "Fehler."
        )
    );

    if (
        result.data.success
    ) {

        document
            .getElementById(
                "serverName"
            )
            .value = "";

        document
            .getElementById(
                "serverPort"
            )
            .value = "";

        await loadServers();
    }
}


async function loadServers() {

    if (!authToken) {
        return;
    }

    const result =
        await api(
            "/api/servers"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    document
        .getElementById(
            "serverLimitInfo"
        )
        .textContent =
            "Server: " +
            result.data.used +
            " / " +
            (
                result.data.limit === Infinity
                    ? "∞"
                    : result.data.limit
            );

    const container =
        document
            .getElementById(
                "serverList"
            );

    container.innerHTML = "";

    if (
        result.data.servers.length === 0
    ) {

        container.innerHTML =
            "<div class='box'>Noch keine Server.</div>";

        return;
    }

    result.data.servers.forEach(
        server => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "server";

            card.innerHTML =
                "<h3>⛏️ " +
                escapeHtml(
                    server.name
                ) +
                "</h3>" +

                "<p>IP/Host: " +
                escapeHtml(
                    location.hostname
                ) +
                "</p>" +

                "<p>Port: " +
                server.port +
                "</p>" +

                "<p>Status: " +
                "<strong class='" +
                (
                    server.status ===
                    "online"
                        ? "online"
                        : "offline"
                ) +
                "'>" +
                escapeHtml(
                    server.status
                ) +
                "</strong></p>" +

                (
                    server.suspended
                        ? "<p class='offline'>🔒 Gesperrt</p>"
                        : ""
                ) +

                (
                    server.maintenance
                        ? "<p class='orange'>🛠️ Wartung</p>"
                        : ""
                ) +

                "<div class='server-actions'>" +

                "<button onclick=\"serverAction('" +
                server.id +
                "','start')\">" +
                "▶ Start" +
                "</button>" +

                "<button class='red' onclick=\"serverAction('" +
                server.id +
                "','stop')\">" +
                "⏹ Stop" +
                "</button>" +

                "<button class='orange' onclick=\"serverAction('" +
                server.id +
                "','restart')\">" +
                "🔄 Restart" +
                "</button>" +

                "<button class='dark' onclick=\"toggleConsole('" +
                server.id +
                "')\">" +
                "📟 Console" +
                "</button>" +

                "<button class='red' onclick=\"deleteServer('" +
                server.id +
                "')\">" +
                "🗑 Löschen" +
                "</button>" +

                "</div>" +

                "<div id='console-" +
                server.id +
                "' class='hidden'>" +

                "<div class='console' id='logs-" +
                server.id +
                "'>" +
                "Noch keine Logs." +
                "</div>" +

                "<div class='server-actions'>" +

                "<input id='command-" +
                server.id +
                "' placeholder='Minecraft-Befehl'>" +

                "<button onclick=\"sendCommand('" +
                server.id +
                "')\">" +
                "➤ Senden" +
                "</button>" +

                "</div>" +

                "</div>";

            container.appendChild(
                card
            );
        }
    );
}


async function serverAction(
    id,
    action
) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/" +
            action,
            {
                method:
                    "POST"
            }
        );

    if (
        !result.data.success
    ) {
        alert(
            result.data.message ||
            "Fehler."
        );
    }

    setTimeout(
        loadServers,
        1000
    );
}


function toggleConsole(id) {

    const element =
        document
            .getElementById(
                "console-" +
                id
            );

    if (!element) {
        return;
    }

    element.classList.toggle(
        "hidden"
    );

    loadLogs(id);

    if (
        !pollTimers[id]
    ) {

        pollTimers[id] =
            setInterval(
                () => loadLogs(id),
                3000
            );
    }
}


async function loadLogs(id) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/logs"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "logs-" +
                id
            );

    if (!box) {
        return;
    }

    box.textContent =
        result.data.logs ||
        "Noch keine Logs.";

    box.scrollTop =
        box.scrollHeight;
}


async function sendCommand(id) {

    const input =
        document
            .getElementById(
                "command-" +
                id
            );

    const command =
        input.value.trim();

    if (!command) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/command",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        command
                    })
            }
        );

    if (
        !result.data.success
    ) {
        alert(
            result.data.message ||
            "Fehler."
        );

        return;
    }

    input.value = "";

    setTimeout(
        () => loadLogs(id),
        400
    );
}


async function deleteServer(
    id
) {

    if (
        !confirm(
            "Server wirklich löschen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ),
            {
                method:
                    "DELETE"
            }
        );

    alert(
        result.data.message ||
        "Fertig."
    );

    await loadServers();

    if (
        currentUser &&
        currentUser.admin
    ) {
        await loadAdmin();
    }
}


/* =====================================================
   KAUF
===================================================== */

async function buyServer() {

    const result =
        await api(
            "/api/purchase/server",
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Kaufauftrag erstellt."
    );

    if (
        currentUser &&
        currentUser.admin
    ) {
        loadAdmin();
    }
}


/* =====================================================
   ADMIN
===================================================== */

async function loadAdmin() {

    if (
        !currentUser ||
        !currentUser.admin
    ) {
        return;
    }

    const serverResult =
        await api(
            "/api/admin/servers"
        );

    const serverBox =
        document
            .getElementById(
                "adminServers"
            );

    serverBox.innerHTML = "";

    serverResult.data.servers
        .forEach(
            server => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "server";

                card.innerHTML =
                    "<h3>⛏️ " +
                    escapeHtml(
                        server.name
                    ) +
                    "</h3>" +

                    "<p>Besitzer: " +
                    escapeHtml(
                        server.owner
                    ) +
                    "</p>" +

                    "<p>Status: " +
                    escapeHtml(
                        server.status
                    ) +
                    "</p>" +

                    "<p>Port: " +
                    server.port +
                    "</p>" +

                    "<div class='server-actions'>" +

                    "<button onclick=\"serverAction('" +
                    server.id +
                    "','start')\">▶</button>" +

                    "<button class='red' onclick=\"serverAction('" +
                    server.id +
                    "','stop')\">⏹</button>" +

                    "<button class='orange' onclick=\"serverAction('" +
                    server.id +
                    "','restart')\">🔄</button>" +

                    "<button onclick=\"suspendServer('" +
                    server.id +
                    "')\">🔒 Sperren</button>" +

                    "<button onclick=\"unsuspendServer('" +
                    server.id +
                    "')\">🔓 Entsperren</button>" +

                    "<button class='red' onclick=\"adminDeleteServer('" +
                    server.id +
                    "')\">🗑 Löschen</button>" +

                    "</div>";

                serverBox.appendChild(
                    card
                );
            }
        );


    const purchaseResult =
        await api(
            "/api/admin/purchases"
        );

    const purchaseBox =
        document
            .getElementById(
                "adminPurchases"
            );

    purchaseBox.innerHTML = "";

    purchaseResult.data.purchases
        .forEach(
            purchase => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "server";

                card.innerHTML =
                    "<h3>💳 5 € Server</h3>" +

                    "<p>" +
                    escapeHtml(
                        purchase.userEmail
                    ) +
                    "</p>" +

                    "<p>Status: " +
                    escapeHtml(
                        purchase.status
                    ) +
                    "</p>" +

                    (
                        purchase.status ===
                        "pending"

                            ? "<button class='green' onclick=\"approvePurchase('" +
                              purchase.id +
                              "')\">✅ Freischalten</button>"

                            : ""
                    );

                purchaseBox.appendChild(
                    card
                );
            }
        );


    const userResult =
        await api(
            "/api/admin/users"
        );

    const userBox =
        document
            .getElementById(
                "adminUsers"
            );

    userBox.innerHTML = "";

    userResult.data.users
        .forEach(
            user => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "server";

                card.innerHTML =
                    "<h3>👤 " +
                    escapeHtml(
                        user.username
                    ) +
                    "</h3>" +

                    "<p>" +
                    escapeHtml(
                        user.email
                    ) +
                    "</p>" +

                    "<p>Rolle: " +
                    escapeHtml(
                        user.role
                    ) +
                    "</p>";

                userBox.appendChild(
                    card
                );
            }
        );
}


async function approvePurchase(
    id
) {

    const result =
        await api(
            "/api/admin/purchases/" +
            encodeURIComponent(
                id
            ) +
            "/approve",
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Fertig."
    );

    loadAdmin();
}


async function suspendServer(
    id
) {

    await api(
        "/api/admin/servers/" +
        encodeURIComponent(
            id
        ) +
        "/suspend",
        {
            method:
                "POST"
        }
    );

    loadAdmin();
}


async function unsuspendServer(
    id
) {

    await api(
        "/api/admin/servers/" +
        encodeURIComponent(
            id
        ) +
        "/unsuspend",
        {
            method:
                "POST"
        }
    );

    loadAdmin();
}


async function adminDeleteServer(
    id
) {

    if (
        !confirm(
            "Server endgültig löschen?"
        )
    ) {
        return;
    }

    await api(
        "/api/admin/servers/" +
        encodeURIComponent(
            id
        ),
        {
            method:
                "DELETE"
        }
    );

    loadAdmin();
}


/* =====================================================
   ADMIN WEBSITE
===================================================== */

async function stopAll() {

    if (
        !confirm(
            "Wirklich alle Minecraft-Server stoppen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/stop-all",
            {
                method:
                    "POST"
            }
        );

    alert(
        "Gestoppte Server: " +
        (
            result.data.stopped ||
            0
        )
    );

    loadAdmin();
}


async function setMaintenance(
    enabled
) {

    await api(
        "/api/admin/maintenance",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    enabled
                })
        }
    );

    updateStatus();

    alert(
        enabled
            ? "Website-Wartung aktiviert."
            : "Website-Wartung deaktiviert."
    );
}


async function setOutage(
    enabled
) {

    const text =
        document
            .getElementById(
                "outageText"
            )
            .value;

    await api(
        "/api/admin/outage",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    enabled,
                    text
                })
        }
    );

    updateStatus();

    alert(
        enabled
            ? "Störungsmodus aktiviert."
            : "Störungsmodus deaktiviert."
    );
}


/* =====================================================
   SYSTEM STATUS
===================================================== */

async function updateStatus() {

    const result =
        await api(
            "/api/status"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const element =
        document
            .getElementById(
                "systemStatus"
            );

    if (
        result.data.maintenance
    ) {

        element.textContent =
            "🛠️ Website in Wartung";

        element.style.color =
            "#f1bd68";

        return;
    }

    if (
        result.data.outage
    ) {

        element.textContent =
            "🚨 " +
            (
                result.data.outageText ||
                "Störung"
            );

        element.style.color =
            "#ff7878";

        return;
    }

    element.textContent =
        "🟢 System online";

    element.style.color =
        "#82e77a";
}


/* =====================================================
   HTML SICHER
===================================================== */

function escapeHtml(
    value
) {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =====================================================
   START
===================================================== */

updateStatus();

restoreLogin();

setInterval(
    updateStatus,
    5000
);

setInterval(
    () => {

        if (!currentUser) {
            return;
        }

        loadServers();

        if (
            currentUser.admin
        ) {
            loadAdmin();
        }

    },
    5000
);

</script>

</body>

</html>
        `);
    }
);


// ======================================================
// 404
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({
            success: false,
            message:
                "Seite nicht gefunden."
        });
    }
);


// ======================================================
// FEHLER
// ======================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ SERVER FEHLER:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(
                error
            );
        }

        res.status(500).json({
            success: false,
            message:
                "Interner Serverfehler."
        });
    }
);


// ======================================================
// START
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "⛏️ MINECRAFT HOST CONSOLE"
        );

        console.log(
            "========================================"
        );

        console.log(
            "🌐 Port:",
            PORT
        );

        console.log(
            "👑 Owner:",
            ADMIN_EMAIL
        );

        console.log(
            "🆓 1 Server kostenlos"
        );

        console.log(
            "💶 Weitere Server: 5 €"
        );

        console.log(
            "📟 Konsole + Logs: AKTIV"
        );

        console.log(
            "🛠️ Wartung: AKTIV"
        );

        console.log(
            "🚨 Störungssystem: AKTIV"
        );

        console.log(
            "========================================"
        );
    }
);


// ======================================================
// SAUBER HERUNTERFAHREN
// ======================================================

function shutdown() {

    console.log(
        "🛑 Hosting wird beendet..."
    );

    for (
        const child
        of processes.values()
    ) {

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        try {
            child.kill();
        } catch {}
    }

    processes.clear();

    process.exit(0);
}

process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);
