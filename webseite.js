```javascript
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ======================================================
// KONFIGURATION
// ======================================================

const ADMIN_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const SERVERS_DIR = path.join(__dirname, "minecraft-servers");

const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVERS_DIR, { recursive: true });

// ======================================================
// DATEN
// ======================================================

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2)
            );
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error("Dateifehler:", error.message);
        return fallback;
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

let servers = readJSON(SERVERS_FILE, []);

let settings = readJSON(
    SETTINGS_FILE,
    {
        maintenance: false,
        outage: false,
        outageText: "Keine Störung."
    }
);

// ======================================================
// MINECRAFT PROZESSE
// ======================================================

const processes = new Map();

// ======================================================
// HILFSFUNKTIONEN
// ======================================================

function cleanName(name) {
    return String(name || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32);
}

function getServer(id) {
    return servers.find(
        server => server.id === id
    );
}

function getServerFolder(id) {
    return path.join(
        SERVERS_DIR,
        id
    );
}

function getLogFolder(id) {
    return path.join(
        getServerFolder(id),
        "logs"
    );
}

function getLogFile(id) {
    return path.join(
        getLogFolder(id),
        "console.log"
    );
}

function writeLog(server, text) {
    const folder = getLogFolder(server.id);

    fs.mkdirSync(
        folder,
        {
            recursive: true
        }
    );

    fs.appendFileSync(
        getLogFile(server.id),
        `[${new Date().toISOString()}] ${text}\n`
    );
}

function isRunning(id) {
    return processes.has(id);
}

function publicServer(server) {
    return {
        id: server.id,
        name: server.name,
        port: server.port,
        owner: server.owner,
        createdAt: server.createdAt,
        status: isRunning(server.id)
            ? "online"
            : "offline"
    };
}

// ======================================================
// EXPRESS
// ======================================================

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);

// ======================================================
// STATUS
// ======================================================

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        maintenance: settings.maintenance,
        outage: settings.outage,
        outageText: settings.outageText,
        serverCount: servers.length,
        onlineServers: servers.filter(
            server => isRunning(server.id)
        ).length
    });
});

// ======================================================
// DEMO USER
// ======================================================

app.post("/api/login", (req, res) => {
    const email = String(
        req.body.email || ""
    )
        .trim()
        .toLowerCase();

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Bitte E-Mail eingeben."
        });
    }

    res.json({
        success: true,
        user: {
            email,
            admin:
                email === ADMIN_EMAIL.toLowerCase()
        }
    });
});

// ======================================================
// SERVER LISTE
// ======================================================

app.get("/api/servers", (req, res) => {
    res.json({
        success: true,
        servers: servers.map(publicServer)
    });
});

// ======================================================
// SERVER ERSTELLEN
// ======================================================

app.post("/api/servers", (req, res) => {
    const name = cleanName(req.body.name);
    const port = Number(req.body.port);
    const owner = String(
        req.body.owner || "Gast"
    ).trim();

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
                server.name.toLowerCase() ===
                name.toLowerCase()
        )
    ) {
        return res.status(409).json({
            success: false,
            message: "Servername existiert bereits."
        });
    }

    if (
        servers.some(
            server => server.port === port
        )
    ) {
        return res.status(409).json({
            success: false,
            message: "Port wird bereits verwendet."
        });
    }

    const id = crypto.randomUUID();

    const folder = getServerFolder(id);

    fs.mkdirSync(folder, {
        recursive: true
    });

    fs.mkdirSync(
        getLogFolder(id),
        {
            recursive: true
        }
    );

    const server = {
        id,
        name,
        port,
        owner,
        createdAt:
            new Date().toISOString()
    };

    servers.push(server);

    saveJSON(
        SERVERS_FILE,
        servers
    );

    writeLog(
        server,
        `Server ${name} wurde erstellt.`
    );

    res.json({
        success: true,
        server: publicServer(server)
    });
});

// ======================================================
// SERVER START
// ======================================================

app.post(
    "/api/servers/:id/start",
    (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        if (isRunning(server.id)) {
            return res.json({
                success: true,
                message: "Server läuft bereits."
            });
        }

        const folder =
            getServerFolder(server.id);

        const jar =
            path.join(folder, "server.jar");

        if (!fs.existsSync(jar)) {
            writeLog(
                server,
                "START FEHLER: server.jar fehlt."
            );

            return res.status(400).json({
                success: false,
                message:
                    "server.jar wurde nicht gefunden."
            });
        }

        const eula =
            path.join(folder, "eula.txt");

        if (!fs.existsSync(eula)) {
            fs.writeFileSync(
                eula,
                "eula=true\n"
            );
        }

        writeLog(
            server,
            "Minecraft wird gestartet."
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

                const text =
                    data.toString();

                process.stdout.write(
                    `[${server.name}] ${text}`
                );

                writeLog(
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
                    `[${server.name}] ${text}`
                );

                writeLog(
                    server,
                    "ERROR: " +
                    text.trim()
                );
            }
        );

        child.on(
            "error",
            error => {

                writeLog(
                    server,
                    "PROZESS FEHLER: " +
                    error.message
                );

                processes.delete(
                    server.id
                );
            }
        );

        child.on(
            "close",
            code => {

                processes.delete(
                    server.id
                );

                writeLog(
                    server,
                    `Minecraft beendet. Exit-Code: ${code}`
                );
            }
        );

        res.json({
            success: true,
            message: "Server wird gestartet."
        });
    }
);

// ======================================================
// SERVER STOP
// ======================================================

app.post(
    "/api/servers/:id/stop",
    (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        const child =
            processes.get(server.id);

        if (!child) {
            return res.json({
                success: true,
                message: "Server ist bereits offline."
            });
        }

        writeLog(
            server,
            "Stop-Befehl gesendet."
        );

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {
            try {
                child.kill();
            } catch {}
        }

        res.json({
            success: true,
            message: "Server wird gestoppt."
        });
    }
);

// ======================================================
// RESTART
// ======================================================

app.post(
    "/api/servers/:id/restart",
    async (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        const child =
            processes.get(server.id);

        if (!child) {
            return res.status(400).json({
                success: false,
                message: "Server ist offline."
            });
        }

        writeLog(
            server,
            "Neustart angefordert."
        );

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        setTimeout(() => {

            if (!isRunning(server.id)) {

                const folder =
                    getServerFolder(server.id);

                const newChild =
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
                            cwd: folder,
                            env: process.env
                        }
                    );

                processes.set(
                    server.id,
                    newChild
                );

                newChild.stdout.on(
                    "data",
                    data => {

                        writeLog(
                            server,
                            data
                                .toString()
                                .trim()
                        );
                    }
                );

                newChild.stderr.on(
                    "data",
                    data => {

                        writeLog(
                            server,
                            "ERROR: " +
                            data
                                .toString()
                                .trim()
                        );
                    }
                );

                newChild.on(
                    "close",
                    code => {

                        processes.delete(
                            server.id
                        );

                        writeLog(
                            server,
                            `Restart-Prozess beendet: ${code}`
                        );
                    }
                );

                writeLog(
                    server,
                    "Server wurde neu gestartet."
                );
            }

        }, 8000);

        res.json({
            success: true,
            message: "Neustart gestartet."
        });
    }
);

// ======================================================
// KONSOLE
// ======================================================

app.post(
    "/api/servers/:id/command",
    (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const command =
            String(
                req.body.command || ""
            ).trim();

        if (!command) {
            return res.status(400).json({
                success: false,
                message: "Kein Befehl."
            });
        }

        const child =
            processes.get(server.id);

        if (!child) {
            return res.status(400).json({
                success: false,
                message: "Server ist offline."
            });
        }

        try {

            child.stdin.write(
                command + "\n"
            );

            writeLog(
                server,
                "COMMAND: " + command
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ======================================================
// LOGS
// ======================================================

app.get(
    "/api/servers/:id/logs",
    (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const file =
            getLogFile(server.id);

        if (!fs.existsSync(file)) {
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

        if (logs.length > 100000) {
            logs =
                logs.slice(-100000);
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
    (req, res) => {

        const server =
            getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: "Server nicht gefunden."
            });
        }

        const child =
            processes.get(server.id);

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
                    item.id !== server.id
            );

        saveJSON(
            SERVERS_FILE,
            servers
        );

        try {
            fs.rmSync(
                getServerFolder(server.id),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (error) {
            console.error(
                "Löschen:",
                error.message
            );
        }

        res.json({
            success: true,
            message: "Server gelöscht."
        });
    }
);

// ======================================================
// ADMIN
// ======================================================

function adminOnly(req, res, next) {

    const email =
        String(
            req.headers["x-admin-email"] || ""
        )
            .trim()
            .toLowerCase();

    if (
        email !==
        ADMIN_EMAIL.toLowerCase()
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Kein Zugriff auf das Admin-Panel."
        });
    }

    next();
}

// ======================================================
// ADMIN SERVER
// ======================================================

app.get(
    "/api/admin/servers",
    adminOnly,
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
// ADMIN ALLE STOPPEN
// ======================================================

app.post(
    "/api/admin/stop-all",
    adminOnly,
    (req, res) => {

        let stopped = 0;

        for (
            const server of servers
        ) {

            const child =
                processes.get(server.id);

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

            writeLog(
                server,
                "ADMIN: Server gestoppt."
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
// ADMIN WARTUNG
// ======================================================

app.post(
    "/api/admin/maintenance",
    adminOnly,
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
// ADMIN STÖRUNG
// ======================================================

app.post(
    "/api/admin/outage",
    adminOnly,
    (req, res) => {

        settings.outage =
            Boolean(
                req.body.enabled
            );

        if (
            typeof req.body.text ===
            "string"
        ) {
            settings.outageText =
                req.body.text
                    .trim()
                    .slice(0, 500);
        }

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
// WEBSITE
// ======================================================

app.get("/", (req, res) => {

    res.send(`
<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, sans-serif;
    color: white;

    min-height: 100vh;

    background:
        radial-gradient(
            circle at top,
            #1c4522,
            #071008 45%,
            #020302
        );
}

nav {
    position: sticky;
    top: 0;

    z-index: 10;

    padding: 16px 22px;

    display: flex;
    justify-content: space-between;
    align-items: center;

    background:
        rgba(2,7,3,.92);

    border-bottom:
        1px solid
        rgba(100,220,90,.2);
}

.logo {
    font-size: 21px;
    font-weight: 900;
}

.container {
    width:
        min(1100px, calc(100% - 24px));

    margin:
        25px auto 80px;
}

.hero {
    text-align: center;

    padding:
        65px 20px;

    border-radius: 18px;

    background:
        rgba(7,15,8,.85);

    border:
        1px solid
        rgba(100,220,90,.2);
}

.hero h1 {
    font-size:
        clamp(35px, 8vw, 75px);

    margin: 0;
}

.hero p {
    color: #aeb8ae;
}

.status {
    display: inline-block;

    margin-top: 15px;

    padding: 8px 14px;

    border-radius: 20px;

    background:
        rgba(70,170,60,.15);

    color: #82df78;
}

.box {
    margin-top: 20px;

    padding: 22px;

    border-radius: 13px;

    background:
        rgba(7,15,8,.9);

    border:
        1px solid
        rgba(100,220,90,.15);
}

input {
    width: 100%;

    padding: 12px;

    margin-bottom: 9px;

    border-radius: 7px;

    border:
        1px solid #304332;

    background: #0a100b;

    color: white;
}

button {
    border: 0;

    padding: 11px 15px;

    border-radius: 7px;

    cursor: pointer;

    color: white;

    background: #398d35;
}

button:hover {
    filter: brightness(1.15);
}

.red {
    background: #a53636;
}

.orange {
    background: #a46b2c;
}

.dark {
    background: #172018;
}

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(260px, 1fr)
        );

    gap: 14px;
}

.server {
    padding: 18px;

    border-radius: 10px;

    background: #0b130c;

    border:
        1px solid #273829;
}

.online {
    color: #76dc6c;
}

.offline {
    color: #df7777;
}

.actions {
    display: flex;

    gap: 7px;

    flex-wrap: wrap;
}

.console {
    margin-top: 12px;

    padding: 14px;

    min-height: 220px;

    max-height: 450px;

    overflow: auto;

    white-space: pre-wrap;

    font-family: monospace;

    font-size: 12px;

    background: #020402;

    color: #9fe999;

    border-radius: 8px;
}

.hidden {
    display: none;
}

.admin {
    border-color:
        rgba(230,170,60,.35);
}

@media(max-width:600px) {

    nav {
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
    }

    .container {
        width:
            calc(100% - 12px);
    }

    .hero {
        padding:
            45px 15px;
    }

    .box {
        padding: 15px;
    }

    .actions button {
        flex: 1;
    }
}

</style>

</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Hosting
</div>

<div>

<button onclick="login()">
🔑 Anmeldung
</button>

</div>

</nav>

<div class="container">

<section class="hero">

<h1>
Minecraft Hosting
</h1>

<p>
Erstelle und verwalte deine Minecraft-Server.
</p>

<div
    class="status"
    id="status"
>
🟢 System online
</div>

</section>

<section class="box">

<h2>
🔑 Anmeldung
</h2>

<input
    id="email"
    type="email"
    placeholder="E-Mail-Adresse"
>

<button onclick="login()">
Anmelden
</button>

<p id="loginMessage"></p>

</section>

<section
    class="box hidden"
    id="hosting"
>

<h2>
⛏️ Server erstellen
</h2>

<input
    id="serverName"
    placeholder="Servername"
>

<input
    id="serverPort"
    type="number"
    placeholder="Port, z.B. 25565"
>

<button onclick="createServer()">
➕ Server erstellen
</button>

<h2>
Meine Server
</h2>

<div
    class="grid"
    id="servers"
></div>

</section>

<section
    class="box admin hidden"
    id="admin"
>

<h2>
👑 Admin Panel
</h2>

<p>
Admin: ${ADMIN_EMAIL}
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
⛔ ALLE SERVER STOPPEN
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

<h3>
📊 Server
</h3>

<div
    class="grid"
    id="adminServers"
></div>

</section>

</div>

<script>

let email = "";

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

    if (
        email
    ) {
        options.headers[
            "x-admin-email"
        ] =
            email;
    }

    const response =
        await fetch(
            url,
            options
        );

    return await response.json();
}

function login() {

    const value =
        document
            .getElementById("email")
            .value
            .trim()
            .toLowerCase();

    if (!value) {

        document
            .getElementById(
                "loginMessage"
            )
            .textContent =
                "Bitte E-Mail eingeben.";

        return;
    }

    email = value;

    localStorage.setItem(
        "hostingEmail",
        email
    );

    document
        .getElementById(
            "hosting"
        )
        .classList
        .remove("hidden");

    if (
        email ===
        "${ADMIN_EMAIL.toLowerCase()}"
    ) {

        document
            .getElementById(
                "admin"
            )
            .classList
            .remove("hidden");

        loadAdmin();
    }

    loadServers();

    document
        .getElementById(
            "loginMessage"
        )
        .textContent =
            "✅ Angemeldet als " +
            email;
}

async function createServer() {

    const name =
        document
            .getElementById(
                "serverName"
            )
            .value;

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
                method: "POST",
                body:
                    JSON.stringify({
                        name,
                        port,
                        owner: email
                    })
            }
        );

    alert(
        result.message ||
        "Server erstellt."
    );

    if (
        result.success
    ) {
        loadServers();
        loadAdmin();
    }
}

async function loadServers() {

    const result =
        await api(
            "/api/servers"
        );

    const container =
        document
            .getElementById(
                "servers"
            );

    container.innerHTML = "";

    result.servers.forEach(
        server => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "server";

            div.innerHTML = \`
<h3>
⛏️ \${escapeHtml(server.name)}
</h3>

<p>
Status:
<strong class="\${
    server.status === "online"
        ? "online"
        : "offline"
}">
\${server.status}
</strong>
</p>

<p>
Port: \${server.port}
</p>

<div class="actions">

<button onclick="serverAction(
'\${server.id}',
'start'
)">
▶️ Start
</button>

<button
class="red"
onclick="serverAction(
'\${server.id}',
'stop'
)"
>
⏹️ Stop
</button>

<button
class="orange"
onclick="serverAction(
'\${server.id}',
'restart'
)"
>
🔄 Restart
</button>

<button
class="dark"
onclick="showConsole(
'\${server.id}'
)"
>
📟 Konsole
</button>

<button
class="red"
onclick="deleteServer(
'\${server.id}'
)"
>
🗑️ Löschen
</button>

</div>

<div
id="console-\${server.id}"
class="hidden"
>

<div
class="console"
id="logs-\${server.id}"
>
</div>

<br>

<input
id="command-\${server.id}"
placeholder="Minecraft-Befehl"
>

<button
onclick="sendCommand(
'\${server.id}'
)"
>
➤ Senden
</button>

</div>
\`;

            container.appendChild(
                div
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
            id +
            "/" +
            action,
            {
                method: "POST"
            }
        );

    if (
        !result.success
    ) {
        alert(
            result.message
        );
    }

    setTimeout(
        loadServers,
        1200
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
            id,
            {
                method: "DELETE"
            }
        );

    alert(
        result.message
    );

    loadServers();
    loadAdmin();
}

async function showConsole(id) {

    const box =
        document
            .getElementById(
                "console-" + id
            );

    box.classList.toggle(
        "hidden"
    );

    await loadLogs(id);
}

async function loadLogs(id) {

    const result =
        await api(
            "/api/servers/" +
            id +
            "/logs"
        );

    const element =
        document
            .getElementById(
                "logs-" + id
            );

    if (!element) {
        return;
    }

    element.textContent =
        result.logs ||
        "Noch keine Logs.";

    element.scrollTop =
        element.scrollHeight;
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
            id +
            "/command",
            {
                method: "POST",
                body:
                    JSON.stringify({
                        command
                    })
            }
        );

    if (
        !result.success
    ) {
        alert(
            result.message
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
        email !==
        "${ADMIN_EMAIL.toLowerCase()}"
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/servers"
        );

    const container =
        document
            .getElementById(
                "adminServers"
            );

    container.innerHTML = "";

    result.servers.forEach(
        server => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "server";

            div.innerHTML = \`
<h3>
⛏️ \${escapeHtml(server.name)}
</h3>

<p>
Status: \${server.status}
</p>

<p>
Port: \${server.port}
</p>

<div class="actions">

<button
onclick="serverAction(
'\${server.id}',
'start'
)"
>
▶️
</button>

<button
class="red"
onclick="serverAction(
'\${server.id}',
'stop'
)"
>
⏹️
</button>

<button
class="orange"
onclick="serverAction(
'\${server.id}',
'restart'
)"
>
🔄
</button>

</div>
\`;

            container.appendChild(
                div
            );
        }
    );
}

async function stopAll() {

    if (
        !confirm(
            "ALLE Server stoppen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/stop-all",
            {
                method: "POST"
            }
        );

    alert(
        "Gestoppt: " +
        result.stopped
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
                method: "POST",
                body:
                    JSON.stringify({
                        enabled
                    })
            }
        );

    alert(
        enabled
            ? "Wartung aktiviert."
            : "Wartung deaktiviert."
    );

    updateStatus();
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
                method: "POST",
                body:
                    JSON.stringify({
                        enabled,
                        text
                    })
            }
        );

    alert(
        enabled
            ? "Störung aktiviert."
            : "Störung deaktiviert."
    );

    updateStatus();
}

async function updateStatus() {

    const result =
        await api(
            "/api/status"
        );

    const status =
        document
            .getElementById(
                "status"
            );

    if (
        result.maintenance
    ) {

        status.textContent =
            "🛠️ Wartungsarbeiten";

        return;
    }

    if (
        result.outage
    ) {

        status.textContent =
            "🚨 " +
            result.outageText;

        return;
    }

    status.textContent =
        "🟢 System online";
}

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ======================================================
// AUTOMATISCH EINLOGGEN
// ======================================================

window.addEventListener(
    "load",
    () => {

        const saved =
            localStorage.getItem(
                "hostingEmail"
            );

        if (saved) {

            document
                .getElementById(
                    "email"
                )
                .value = saved;

            login();
        }

        updateStatus();

        setInterval(
            updateStatus,
            5000
        );

        setInterval(
            () => {

                if (email) {
                    loadServers();

                    if (
                        email ===
                        "${ADMIN_EMAIL.toLowerCase()}"
                    ) {
                        loadAdmin();
                    }
                }

            },
            5000
        );
    }
);

// ======================================================
// SERVER START
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "⛏️ MINECRAFT HOSTING"
        );
        console.log(
            "======================================"
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
            "📦 Server:",
            servers.length
        );
        console.log(
            "======================================"
        );
        console.log("");
    }
);
```
