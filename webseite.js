"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const ADMIN_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const SERVER_DIR = path.join(__dirname, "minecraft-servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVER_DIR, { recursive: true });

function ensureFile(file, data) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);
ensureFile(SETTINGS_FILE, {
    maintenance: false,
    outage: false,
    outageText: ""
});

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error("JSON-Fehler:", error.message);
        return fallback;
    }
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2),
            "utf8"
        );
        return true;
    } catch (error) {
        console.error("Speicherfehler:", error.message);
        return false;
    }
}

let users = readJSON(USERS_FILE, []);
let servers = readJSON(SERVERS_FILE, []);
let settings = readJSON(SETTINGS_FILE, {
    maintenance: false,
    outage: false,
    outageText: ""
});

const sessions = new Map();
const processes = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

function makeId(prefix) {
    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        crypto.randomBytes(5).toString("hex")
    );
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return salt + ":" + hash;
}

function checkPassword(password, stored) {
    try {
        const parts = String(stored).split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const original = parts[1];

        const hash = crypto
            .scryptSync(password, salt, 64)
            .toString("hex");

        const a = Buffer.from(hash, "hex");
        const b = Buffer.from(original, "hex");

        if (a.length !== b.length) {
            return false;
        }

        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function newSession(email) {
    const token = crypto.randomBytes(48).toString("hex");

    sessions.set(token, {
        email: email,
        createdAt: Date.now()
    });

    return token;
}

function getSession(req) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token = header.slice(7);

    return sessions.get(token) || null;
}

function requireLogin(req, res, next) {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Nicht angemeldet."
        });
    }

    req.sessionUser = session;
    next();
}

function requireAdmin(req, res, next) {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Nicht angemeldet."
        });
    }

    if (
        session.email.toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
    ) {
        return res.status(403).json({
            success: false,
            message: "Kein Admin-Zugriff."
        });
    }

    req.sessionUser = session;
    next();
}

function cleanServerName(value) {
    return String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32);
}

function getServer(id) {
    return servers.find(server => server.id === id);
}

function serverFolder(id) {
    return path.join(SERVER_DIR, id);
}

function logFolder(id) {
    return path.join(serverFolder(id), "logs");
}

function logFile(id) {
    return path.join(logFolder(id), "console.log");
}

function log(server, text) {
    try {
        fs.mkdirSync(logFolder(server.id), {
            recursive: true
        });

        const line =
            "[" +
            new Date().toISOString() +
            "] " +
            String(text) +
            "\n";

        fs.appendFileSync(
            logFile(server.id),
            line,
            "utf8"
        );
    } catch (error) {
        console.error("Log-Fehler:", error.message);
    }
}

function serverStatus(server) {
    return processes.has(server.id)
        ? "online"
        : "offline";
}

function publicServer(server) {
    return {
        id: server.id,
        name: server.name,
        owner: server.owner,
        port: server.port,
        status: serverStatus(server),
        createdAt: server.createdAt
    };
}

/* =========================================================
   AUTH
========================================================= */

app.post("/api/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Bitte alle Felder ausfüllen."
        });
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        return res.status(400).json({
            success: false,
            message:
                "Benutzername muss 3-24 Zeichen haben."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            success: false,
            message: "Ungültige E-Mail."
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message:
                "Passwort muss mindestens 8 Zeichen haben."
        });
    }

    if (
        users.some(
            user =>
                user.username.toLowerCase() ===
                username.toLowerCase()
        )
    ) {
        return res.status(409).json({
            success: false,
            message: "Benutzername bereits vergeben."
        });
    }

    if (
        users.some(
            user =>
                user.email.toLowerCase() === email
        )
    ) {
        return res.status(409).json({
            success: false,
            message: "E-Mail bereits registriert."
        });
    }

    users.push({
        id: makeId("user"),
        username: username,
        email: email,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
    });

    saveJSON(USERS_FILE, users);

    res.json({
        success: true,
        message: "Registrierung erfolgreich."
    });
});

app.post("/api/login", (req, res) => {
    const login = String(req.body.login || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    const user = users.find(
        entry =>
            entry.username.toLowerCase() === login ||
            entry.email.toLowerCase() === login
    );

    if (!user || !checkPassword(password, user.password)) {
        return res.status(401).json({
            success: false,
            message: "Login-Daten falsch."
        });
    }

    const token = newSession(user.email);

    res.json({
        success: true,
        token: token,
        user: {
            username: user.username,
            email: user.email,
            admin:
                user.email.toLowerCase() ===
                ADMIN_EMAIL.toLowerCase()
        }
    });
});

app.post("/api/logout", requireLogin, (req, res) => {
    const token = String(
        req.headers.authorization || ""
    ).slice(7);

    sessions.delete(token);

    res.json({
        success: true
    });
});

app.get("/api/me", requireLogin, (req, res) => {
    const user = users.find(
        entry =>
            entry.email.toLowerCase() ===
            req.sessionUser.email.toLowerCase()
    );

    if (!user) {
        return res.status(404).json({
            success: false
        });
    }

    res.json({
        success: true,
        user: {
            username: user.username,
            email: user.email,
            admin:
                user.email.toLowerCase() ===
                ADMIN_EMAIL.toLowerCase()
        }
    });
});

/* =========================================================
   SYSTEM STATUS
========================================================= */

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        maintenance: settings.maintenance,
        outage: settings.outage,
        outageText: settings.outageText,
        servers: servers.length,
        online: servers.filter(
            server => processes.has(server.id)
        ).length
    });
});

/* =========================================================
   SERVER
========================================================= */

app.get("/api/servers", requireLogin, (req, res) => {
    res.json({
        success: true,
        servers: servers
            .filter(
                server =>
                    server.owner.toLowerCase() ===
                    req.sessionUser.email.toLowerCase()
            )
            .map(publicServer)
    });
});

app.post("/api/servers", requireLogin, (req, res) => {
    const name = cleanServerName(req.body.name);
    const port = Number(req.body.port);

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Ungültiger Servername."
        });
    }

    if (
        !Number.isInteger(port) ||
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
                server.port === port
        )
    ) {
        return res.status(409).json({
            success: false,
            message: "Dieser Port wird bereits verwendet."
        });
    }

    const id = makeId("server");

    const folder = serverFolder(id);

    fs.mkdirSync(folder, {
        recursive: true
    });

    fs.mkdirSync(logFolder(id), {
        recursive: true
    });

    const server = {
        id: id,
        name: name,
        owner: req.sessionUser.email,
        port: port,
        createdAt: new Date().toISOString()
    };

    servers.push(server);

    saveJSON(
        SERVERS_FILE,
        servers
    );

    log(
        server,
        "Server erstellt."
    );

    res.json({
        success: true,
        server: publicServer(server)
    });
});

app.post(
    "/api/servers/:id/start",
    requireLogin,
    (req, res) => {
        const server = getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (
            server.owner.toLowerCase() !==
            req.sessionUser.email.toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        if (processes.has(server.id)) {
            return res.json({
                success: true,
                message: "Server läuft bereits."
            });
        }

        const folder = serverFolder(server.id);
        const jar = path.join(folder, "server.jar");

        if (!fs.existsSync(jar)) {
            log(
                server,
                "START FEHLER: server.jar fehlt."
            );

            return res.status(400).json({
                success: false,
                message:
                    "server.jar fehlt im Serverordner."
            });
        }

        const eula = path.join(
            folder,
            "eula.txt"
        );

        if (!fs.existsSync(eula)) {
            fs.writeFileSync(
                eula,
                "eula=true\n",
                "utf8"
            );
        }

        log(
            server,
            "Minecraft Server startet."
        );

        const child = spawn(
            "java",
            [
                "-Xms1G",
                "-Xmx2G",
                "-jar",
                "server.jar",
                "nogui"
            ],
            {
                cwd: folder,
                env: process.env
            }
        );

        processes.set(
            server.id,
            child
        );

        child.stdout.on(
            "data",
            data => {
                const text = data.toString();

                process.stdout.write(
                    "[" +
                    server.name +
                    "] " +
                    text
                );

                log(
                    server,
                    text.trim()
                );
            }
        );

        child.stderr.on(
            "data",
            data => {
                const text = data.toString();

                process.stderr.write(
                    "[" +
                    server.name +
                    "] " +
                    text
                );

                log(
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

                log(
                    server,
                    "PROZESS FEHLER: " +
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

                log(
                    server,
                    "Minecraft beendet. Exit-Code: " +
                    code
                );
            }
        );

        res.json({
            success: true,
            message: "Server wird gestartet."
        });
    }
);

app.post(
    "/api/servers/:id/stop",
    requireLogin,
    (req, res) => {
        const server = getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (
            server.owner.toLowerCase() !==
            req.sessionUser.email.toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        const child = processes.get(
            server.id
        );

        if (!child) {
            return res.json({
                success: true,
                message: "Server ist offline."
            });
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

        log(
            server,
            "Stop angefordert."
        );

        res.json({
            success: true,
            message: "Server wird gestoppt."
        });
    }
);

app.post(
    "/api/servers/:id/restart",
    requireLogin,
    (req, res) => {
        const server = getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (
            server.owner.toLowerCase() !==
            req.sessionUser.email.toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        const child = processes.get(
            server.id
        );

        if (!child) {
            return res.status(400).json({
                success: false,
                message: "Server ist offline."
            });
        }

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        log(
            server,
            "Neustart angefordert."
        );

        setTimeout(
            () => {
                if (!processes.has(server.id)) {
                    startMinecraftProcess(
                        server
                    );
                }
            },
            5000
        );

        res.json({
            success: true,
            message: "Server wird neugestartet."
        });
    }
);

function startMinecraftProcess(server) {
    const folder = serverFolder(
        server.id
    );

    const jar = path.join(
        folder,
        "server.jar"
    );

    if (!fs.existsSync(jar)) {
        log(
            server,
            "RESTART FEHLER: server.jar fehlt."
        );
        return;
    }

    const child = spawn(
        "java",
        [
            "-Xms1G",
            "-Xmx2G",
            "-jar",
            "server.jar",
            "nogui"
        ],
        {
            cwd: folder,
            env: process.env
        }
    );

    processes.set(
        server.id,
        child
    );

    child.stdout.on(
        "data",
        data => {
            log(
                server,
                data.toString().trim()
            );
        }
    );

    child.stderr.on(
        "data",
        data => {
            log(
                server,
                "ERROR: " +
                data.toString().trim()
            );
        }
    );

    child.on(
        "close",
        code => {
            processes.delete(
                server.id
            );

            log(
                server,
                "Minecraft beendet. Exit-Code: " +
                code
            );
        }
    );

    child.on(
        "error",
        error => {
            processes.delete(
                server.id
            );

            log(
                server,
                "Prozessfehler: " +
                error.message
            );
        }
    );

    log(
        server,
        "Minecraft neu gestartet."
    );
}

/* =========================================================
   KONSOLE / LOGS
========================================================= */

app.post(
    "/api/servers/:id/command",
    requireLogin,
    (req, res) => {
        const server = getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (
            server.owner.toLowerCase() !==
            req.sessionUser.email.toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        const command = String(
            req.body.command || ""
        )
            .trim()
            .slice(0, 500);

        if (!command) {
            return res.status(400).json({
                success: false,
                message: "Kein Befehl."
            });
        }

        const child = processes.get(
            server.id
        );

        if (!child) {
            return res.status(400).json({
                success: false,
                message: "Server ist offline."
            });
        }

        try {
            child.stdin.write(
                command +
                "\n"
            );

            log(
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

app.get(
    "/api/servers/:id/logs",
    requireLogin,
    (req, res) => {
        const server = getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (
            server.owner.toLowerCase() !==
            req.sessionUser.email.toLowerCase() &&
            req.sessionUser.email.toLowerCase() !==
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        const file = logFile(
            server.id
        );

        if (!fs.existsSync(file)) {
            return res.json({
                success: true,
                logs: ""
            });
        }

        let logs = fs.readFileSync(
            file,
            "utf8"
        );

        if (logs.length > 100000) {
            logs = logs.slice(
                -100000
            );
        }

        res.json({
            success: true,
            logs
        });
    }
);

/* =========================================================
   SERVER LÖSCHEN
========================================================= */

app.delete(
    "/api/servers/:id",
    requireLogin,
    (req, res) => {
        const server = getServer(
            req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        const isOwner =
            server.owner.toLowerCase() ===
            req.sessionUser.email.toLowerCase();

        const isAdmin =
            req.sessionUser.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase();

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Keine Berechtigung."
            });
        }

        const child = processes.get(
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

        servers = servers.filter(
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
                "Ordner löschen:",
                error.message
            );
        }

        res.json({
            success: true,
            message: "Server gelöscht."
        });
    }
);

/* =========================================================
   ADMIN
========================================================= */

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

app.post(
    "/api/admin/stop-all",
    requireAdmin,
    (req, res) => {
        let count = 0;

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

            log(
                server,
                "ADMIN: Server gestoppt."
            );

            count++;
        }

        res.json({
            success: true,
            stopped: count
        });
    }
);

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

app.post(
    "/api/admin/outage",
    requireAdmin,
    (req, res) => {
        settings.outage =
            Boolean(
                req.body.enabled
            );

        settings.outageText =
            String(
                req.body.text || ""
            )
                .trim()
                .slice(0, 500);

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

/* =========================================================
   WEBSITE
========================================================= */

app.get(
    "*",
    (req, res) => {
        res.send(`<!DOCTYPE html>
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

<title>Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;

    min-height: 100vh;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at top,
            #18391c,
            #071008 45%,
            #020302
        );
}

nav {
    position: sticky;
    top: 0;
    z-index: 20;

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 15px;

    padding:
        14px 20px;

    background:
        rgba(2,8,3,.94);

    border-bottom:
        1px solid
        rgba(90,200,80,.2);
}

.logo {
    font-weight: 900;
    font-size: 20px;
}

.nav-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

button {
    border: 0;

    padding:
        10px 14px;

    border-radius:
        7px;

    cursor: pointer;

    color: white;

    background:
        #3f9439;
}

button:hover {
    filter:
        brightness(1.12);
}

.red {
    background:
        #a33838;
}

.orange {
    background:
        #a66b2c;
}

.dark {
    background:
        #1b241c;
}

.main {
    width:
        min(
            1100px,
            calc(100% - 24px)
        );

    margin:
        30px auto 80px;
}

.hero {
    text-align: center;

    padding:
        65px 20px;

    border-radius:
        18px;

    background:
        rgba(7,16,8,.88);

    border:
        1px solid
        rgba(90,200,80,.2);

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.4);
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
        #aeb8ae;

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
        rgba(70,170,60,.15);

    color:
        #7ee676;
}

.box {
    margin-top:
        20px;

    padding:
        22px;

    border-radius:
        12px;

    background:
        rgba(7,15,8,.92);

    border:
        1px solid
        rgba(90,200,80,.15);
}

.grid {
    display: grid;

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
}

.server {
    padding:
        18px;

    border-radius:
        10px;

    background:
        #0b130c;

    border:
        1px solid
        #273829;
}

.online {
    color:
        #77df6d;
}

.offline {
    color:
        #df7777;
}

input,
textarea {
    width: 100%;

    padding:
        12px;

    margin:
        6px 0;

    border-radius:
        7px;

    border:
        1px solid
        #304332;

    background:
        #0a100b;

    color:
        white;

    outline:
        none;
}

textarea {
    min-height:
        180px;

    font-family:
        monospace;
}

.console {
    margin-top:
        10px;

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

    background:
        #020402;

    border-radius:
        7px;

    color:
        #9eea98;

    font-family:
        monospace;

    font-size:
        12px;
}

.actions {
    display:
        flex;

    gap:
        7px;

    flex-wrap:
        wrap;

    margin-top:
        10px;
}

.modal {
    position:
        fixed;

    inset:
        0;

    z-index:
        100;

    display:
        none;

    justify-content:
        center;

    align-items:
        center;

    padding:
        15px;

    background:
        rgba(0,0,0,.75);

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
        25px;

    border-radius:
        12px;

    background:
        #081009;

    border:
        1px solid
        #355637;
}

.close {
    float: right;

    background:
        transparent;

    font-size:
        24px;
}

.hidden {
    display:
        none !important;
}

@media(max-width:600px) {

    nav {
        flex-direction:
            column;

        align-items:
            flex-start;
    }

    .main {
        width:
            calc(100% - 12px);

        margin-top:
            15px;
    }

    .hero {
        padding:
            45px 15px;
    }

    .box {
        padding:
            15px;
    }

    .actions button {
        flex:
            1 1 auto;
    }

}

</style>

</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Hosting
</div>

<div class="nav-buttons">

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

<button
    id="logoutBtn"
    class="dark hidden"
    onclick="logout()"
>
🚪 Logout
</button>

</div>

</nav>

<main class="main">

<section class="hero">

<h1>
Minecraft Hosting
</h1>

<p>
Deine Minecraft-Server. Deine Kontrolle.
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
👤 Mein Konto
</h2>

<p id="accountInfo"></p>

</section>

<section
    id="hostingBox"
    class="box hidden"
>

<h2>
🖥️ Server erstellen
</h2>

<input
    id="serverName"
    placeholder="Servername"
    maxlength="32"
>

<input
    id="serverPort"
    type="number"
    placeholder="Port z.B. 25565"
    min="1024"
    max="65535"
>

<button
    onclick="createServer()"
>
➕ Server erstellen
</button>

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
    class="box hidden"
>

<h2>
👑 Admin Panel
</h2>

<p>
Nur für:
${ADMIN_EMAIL}
</p>

<div class="actions">

<button
    class="orange"
    onclick="maintenance(true)"
>
🛠️ Wartung AN
</button>

<button
    class="dark"
    onclick="maintenance(false)"
>
🟢 Wartung AUS
</button>

<button
    class="red"
    onclick="stopAll()"
>
⛔ Alle Server stoppen
</button>

</div>

<br>

<input
    id="outageText"
    placeholder="Störungstext"
>

<div class="actions">

<button
    class="red"
    onclick="outage(true)"
>
🚨 Störung AN
</button>

<button
    class="dark"
    onclick="outage(false)"
>
🟢 Störung AUS
</button>

</div>

<h2>
Server
</h2>

<div
    id="adminServerList"
    class="grid"
></div>

</section>

</main>

<!-- LOGIN -->

<div
    id="loginModal"
    class="modal"
>

<div class="modal-box">

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

<h2>
🔑 Anmeldung
</h2>

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

<p id="loginMessage"></p>

</div>

</div>

<!-- REGISTER -->

<div
    id="registerModal"
    class="modal"
>

<div class="modal-box">

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

<h2>
📝 Registrierung
</h2>

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
    onclick="register()"
>
Konto erstellen
</button>

<p id="registerMessage"></p>

</div>

</div>

<script>

let authToken =
    localStorage.getItem(
        "hosting_token"
    ) || "";

let currentUser = null;

function openModal(id) {
    closeModals();

    document
        .getElementById(id)
        .classList
        .add("active");
}

function closeModals() {
    document
        .querySelectorAll(".modal")
        .forEach(
            modal =>
                modal.classList
                    .remove("active")
        );
}

async function api(
    url,
    options = {}
) {
    options.headers =
        options.headers || {};

    options.headers[
        "Content-Type"
    ] =
        "application/json";

    if (authToken) {
        options.headers[
            "Authorization"
        ] =
            "Bearer " +
            authToken;
    }

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

async function register() {

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
        "hosting_token",
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

async function logout() {

    await api(
        "/api/logout",
        {
            method:
                "POST"
        }
    );

    authToken = "";

    currentUser = null;

    localStorage.removeItem(
        "hosting_token"
    );

    location.reload();
}

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
            "hosting_token"
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
            "logoutBtn"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "accountInfo"
        )
        .textContent =
            "Angemeldet als " +
            currentUser.username +
            " (" +
            currentUser.email +
            ")";

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

    alert(
        result.data.message ||
        "Server erstellt."
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

        if (
            currentUser &&
            currentUser.admin
        ) {
            await loadAdmin();
        }
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
            "<p>Noch keine Server.</p>";

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
                escapeHTML(
                    server.name
                ) +
                "</h3>" +

                "<p>IP / Host: " +
                escapeHTML(
                    window.location.hostname
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
                escapeHTML(
                    server.status
                ) +
                "</strong>" +
                "</p>" +

                "<div class='actions'>" +

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

                "<button class='dark' onclick=\"openConsole('" +
                server.id +
                "')\">" +
                "📟 Konsole" +
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

                "<div id='logs-" +
                server.id +
                "' class='console'>" +
                "Noch keine Logs." +
                "</div>" +

                "<div class='actions'>" +

                "<input id='command-" +
                server.id +
                "' placeholder='Minecraft-Befehl'>" +

                "<button onclick=\"sendCommand('" +
                server.id +
                "')\">" +
                "➤" +
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
            encodeURIComponent(id) +
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

async function deleteServer(id) {

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
            encodeURIComponent(id),
            {
                method:
                    "DELETE"
            }
        );

    alert(
        result.data.message ||
        "Fertig."
    );

    loadServers();

    if (
        currentUser &&
        currentUser.admin
    ) {
        loadAdmin();
    }
}

async function openConsole(id) {

    document
        .getElementById(
            "console-" + id
        )
        .classList
        .toggle(
            "hidden"
        );

    await loadLogs(id);
}

async function loadLogs(id) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(id) +
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
                "logs-" + id
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
                "command-" + id
            );

    const command =
        input.value.trim();

    if (!command) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(id) +
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
        500
    );
}

async function loadAdmin() {

    if (
        !currentUser ||
        !currentUser.admin
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/servers"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const container =
        document
            .getElementById(
                "adminServerList"
            );

    container.innerHTML = "";

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
                escapeHTML(
                    server.name
                ) +
                "</h3>" +

                "<p>Besitzer: " +
                escapeHTML(
                    server.owner
                ) +
                "</p>" +

                "<p>Port: " +
                server.port +
                "</p>" +

                "<p>Status: " +
                escapeHTML(
                    server.status
                ) +
                "</p>" +

                "<div class='actions'>" +

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

                "</div>";

            container.appendChild(
                card
            );
        }
    );
}

async function stopAll() {

    if (
        !confirm(
            "Wirklich alle Server stoppen?"
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

    setTimeout(
        loadAdmin,
        1000
    );
}

async function maintenance(
    enabled
) {

    const result =
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

    if (
        result.data.success
    ) {
        updateStatus();
    }
}

async function outage(
    enabled
) {

    const text =
        document
            .getElementById(
                "outageText"
            )
            .value;

    const result =
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

    if (
        result.data.success
    ) {
        updateStatus();
    }
}

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
            "🛠️ Webseite in Wartung";

        element.style.color =
            "#f2bd68";

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
            "#ff7777";

        return;
    }

    element.textContent =
        "🟢 System online";

    element.style.color =
        "#7ee676";
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   START
========================================================= */

restoreLogin();
updateStatus();

setInterval(
    updateStatus,
    5000
);

setInterval(
    async () => {

        if (!currentUser) {
            return;
        }

        await loadServers();

        if (currentUser.admin) {
            await loadAdmin();
        }

    },
    5000
);

</script>

</body>
</html>`);
});

/* =========================================================
   FEHLER
========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "❌ SERVER FEHLER:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            message:
                "Interner Serverfehler."
        });
    }
);

/* =========================================================
   START
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "======================================"
        );
        console.log(
            "⛏️ Minecraft Hosting gestartet"
        );
        console.log(
            "🌐 Port:",
            PORT
        );
        console.log(
            "👑 Admin:",
            ADMIN_EMAIL
        );
        console.log(
            "🖥️ Server:",
            servers.length
        );
        console.log(
            "======================================"
        );
    }
);
