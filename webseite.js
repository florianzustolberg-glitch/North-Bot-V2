"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = "florianzustolberg@gmail.com";
const JAVA = process.env.JAVA_COMMAND || "java";
const SERVER_RAM = Number(process.env.SERVER_RAM_MB || 5120);

const DATA_DIR = path.join(__dirname, "data");
const SERVERS_DIR = path.join(__dirname, "minecraft-servers");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVERS_DIR, { recursive: true });

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    servers: path.join(DATA_DIR, "servers.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    settings: path.join(DATA_DIR, "settings.json")
};

function createFile(file, data) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
}

createFile(FILES.users, []);
createFile(FILES.orders, []);
createFile(FILES.servers, []);
createFile(FILES.logs, []);
createFile(FILES.settings, {
    maintenance: false,
    maintenanceMessage: "Die Webseite befindet sich momentan im Wartungsmodus."
});

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function makeId(prefix) {
    return prefix + "-" + crypto.randomBytes(8).toString("hex");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function addLog(type, message) {
    const logs = readJSON(FILES.logs, []);

    logs.unshift({
        id: makeId("log"),
        type,
        message,
        date: new Date().toISOString()
    });

    writeJSON(FILES.logs, logs.slice(0, 5000));

    console.log(`[${type}] ${message}`);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000
        }
    })
);

/* =========================================================
   AUTH
========================================================= */

function getUser(req) {
    if (!req.session.userId) return null;

    return readJSON(FILES.users, []).find(
        user => user.id === req.session.userId
    ) || null;
}

function isAdmin(req) {
    const user = getUser(req);

    return (
        user &&
        user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
}

function isBanned(user) {
    if (!user || !user.bannedUntil) return false;

    if (user.bannedUntil === "permanent") {
        return true;
    }

    return new Date(user.bannedUntil).getTime() > Date.now();
}

function requireLogin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isAdmin(req) && isBanned(user)) {
        return res.status(403).send(
            page(
                req,
                "Account gesperrt",
                `
                <div class="card center">
                    <h1>🚫 Account gesperrt</h1>
                    <p>${escapeHTML(
                        user.banReason || "Kein Grund angegeben"
                    )}</p>
                    <p>
                        ${
                            user.bannedUntil === "permanent"
                                ? "Dauerhaft"
                                : escapeHTML(user.bannedUntil)
                        }
                    </p>
                </div>
                `
            )
        );
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!isAdmin(req)) {
        return res.status(403).send(
            page(
                req,
                "403",
                `
                <div class="card center">
                    <h1>403</h1>
                    <p>Nur der Administrator darf diese Seite öffnen.</p>
                </div>
                `
            )
        );
    }

    next();
}

function checkMaintenance(req, res, next) {
    const settings = readJSON(FILES.settings, {});

    if (settings.maintenance && !isAdmin(req)) {
        return res.status(503).send(
            page(
                req,
                "Wartung",
                `
                <div class="hero">
                    <h1>🔧 Wartung</h1>
                    <p>
                        ${escapeHTML(
                            settings.maintenanceMessage ||
                                "Die Webseite ist momentan nicht verfügbar."
                        )}
                    </p>
                </div>
                `
            )
        );
    }

    next();
}

/* =========================================================
   HTML
========================================================= */

function page(req, title, content) {
    const user = getUser(req);

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHTML(title)} | Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #070907;
    color: white;
    font-family: Arial, sans-serif;
}

header {
    background: #0c100d;
    border-bottom: 1px solid #292e29;
}

.nav {
    max-width: 1250px;
    margin: auto;
    min-height: 65px;
    padding: 10px 16px;

    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
}

.logo {
    color: #63ff78;
    text-decoration: none;
    font-weight: bold;
    font-size: 21px;
}

nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

nav a {
    color: #aaa;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 8px;
}

nav a:hover {
    background: #202520;
    color: white;
}

.container {
    max-width: 1250px;
    width: calc(100% - 24px);
    margin: 25px auto;
}

.hero {
    text-align: center;
    padding: 65px 10px;
}

.hero h1 {
    font-size: clamp(40px, 8vw, 75px);
    margin: 0 0 15px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(230px, 1fr));

    gap: 15px;
}

.card {
    background: #111511;
    border: 1px solid #292e29;
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 15px;
}

.center {
    text-align: center;
}

.form {
    max-width: 520px;
    margin: 40px auto;
}

input,
select,
textarea {
    width: 100%;
    padding: 12px;
    margin: 6px 0 15px;

    border-radius: 8px;
    border: 1px solid #353b35;

    background: #070907;
    color: white;
}

textarea {
    min-height: 100px;
}

button,
.btn {
    display: inline-block;

    border: 0;
    border-radius: 8px;

    padding: 11px 15px;

    background: #63f474;
    color: #071008;

    font-weight: bold;
    text-decoration: none;

    cursor: pointer;
}

button:hover,
.btn:hover {
    opacity: .85;
}

.dark {
    background: #292d2a;
    color: white;
}

.red {
    background: #d94b4b;
    color: white;
}

.yellow {
    background: #e1bd42;
    color: black;
}

.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.price {
    font-size: 35px;
    font-weight: bold;
    color: #63ff78;
}

.status {
    display: inline-block;
    padding: 5px 8px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: bold;
}

.running {
    background: #153b1b;
    color: #70ff82;
}

.stopped {
    background: #421919;
    color: #ff8b8b;
}

.pending {
    background: #403717;
    color: #ffe06c;
}

.accepted {
    background: #153b1b;
    color: #70ff82;
}

.rejected {
    background: #421919;
    color: #ff8b8b;
}

.console {
    background: #020302;

    border: 1px solid #303630;
    border-radius: 10px;

    height: 460px;

    overflow-y: auto;

    padding: 15px;

    white-space: pre-wrap;

    font-family: Consolas, monospace;
    font-size: 13px;

    color: #aaffb0;
}

.metric {
    font-size: 28px;
    font-weight: bold;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 9px;
    border-bottom: 1px solid #292e29;
    text-align: left;
}

.muted {
    color: #858b86;
}

.danger {
    border-color: #702d2d;
}

</style>

</head>

<body>

<header>

<div class="nav">

<a class="logo" href="/">
⛏ Minecraft Hosting
</a>

<nav>

<a href="/">Home</a>

${
    user
        ? `
<a href="/dashboard">Dashboard</a>
<a href="/order">Server bestellen</a>

${
    isAdmin(req)
        ? `<a href="/admin">👑 Admin</a>`
        : ""
}

<a href="/logout">Logout</a>
`
        : `
<a href="/login">Anmelden</a>
<a href="/register">Registrieren</a>
`
}

</nav>

</div>

</header>

<main class="container">

${content}

</main>

<footer class="center muted">

Minecraft Hosting © ${new Date().getFullYear()}

</footer>

</body>
</html>
`;
}

/* =========================================================
   SERVER FUNCTIONS
========================================================= */

const processes = new Map();

function findServer(serverId) {
    return readJSON(FILES.servers, []).find(
        server => server.id === serverId
    ) || null;
}

function saveServer(server) {
    const servers = readJSON(FILES.servers, []);

    const index = servers.findIndex(
        x => x.id === server.id
    );

    if (index === -1) {
        servers.push(server);
    } else {
        servers[index] = server;
    }

    writeJSON(FILES.servers, servers);
}

function serverDirectory(server) {
    return path.join(SERVERS_DIR, server.id);
}

function addServerConsole(server, text) {
    const timestamp = new Date().toISOString();

    const lines = String(text)
        .replace(/\r/g, "")
        .split("\n");

    for (const line of lines) {
        if (!line.trim()) continue;

        server.console =
            (server.console || "") +
            `[${timestamp}] ${line}\n`;
    }

    if ((server.console || "").length > 200000) {
        server.console =
            server.console.slice(-200000);
    }

    saveServer(server);
}

function serverProcess(server) {
    return processes.get(server.id);
}

async function startMinecraft(server) {
    if (serverProcess(server)) {
        return {
            ok: false,
            message: "Server läuft bereits."
        };
    }

    const directory = serverDirectory(server);

    fs.mkdirSync(directory, {
        recursive: true
    });

    const jar = path.join(
        directory,
        "server.jar"
    );

    /*
     * Die JAR muss entweder bereits im Serverordner liegen
     * oder über MINECRAFT_JAR_URL bereitgestellt werden.
     */

    if (!fs.existsSync(jar)) {
        return {
            ok: false,
            message:
                "server.jar fehlt. Stelle MINECRAFT_JAR_URL als Render Environment Variable ein."
        };
    }

    fs.writeFileSync(
        path.join(directory, "eula.txt"),
        "eula=true\n"
    );

    fs.writeFileSync(
        path.join(directory, "server.properties"),
        [
            `server-port=${server.port}`,
            "server-ip=",
            `motd=${server.name}`,
            "online-mode=true",
            "enable-command-block=true",
            "spawn-protection=0",
            "view-distance=10",
            "simulation-distance=10"
        ].join("\n") + "\n"
    );

    const child = spawn(
        JAVA,
        [
            "-Xms512M",
            `-Xmx${server.ramMB}M`,
            "-jar",
            "server.jar",
            "nogui"
        ],
        {
            cwd: directory,
            stdio: [
                "pipe",
                "pipe",
                "pipe"
            ]
        }
    );

    processes.set(
        server.id,
        child
    );

    server.status = "running";
    server.pid = child.pid;
    server.startedAt =
        new Date().toISOString();

    saveServer(server);

    addServerConsole(
        server,
        `Minecraft-Prozess gestartet. PID: ${child.pid}`
    );

    child.stdout.on(
        "data",
        data => {
            addServerConsole(
                server,
                data.toString()
            );
        }
    );

    child.stderr.on(
        "data",
        data => {
            addServerConsole(
                server,
                data.toString()
            );
        }
    );

    child.on(
        "error",
        error => {
            addServerConsole(
                server,
                "PROZESS FEHLER: " +
                    error.message
            );
        }
    );

    child.on(
        "close",
        code => {
            processes.delete(server.id);

            server.status = "stopped";
            server.pid = null;

            saveServer(server);

            addServerConsole(
                server,
                `Minecraft wurde beendet. Exit-Code: ${code}`
            );

            addLog(
                "SERVER_STOP",
                `${server.name} beendet`
            );
        }
    );

    addLog(
        "SERVER_START",
        `${server.name} gestartet`
    );

    return {
        ok: true
    };
}

function stopMinecraft(server) {
    const child =
        serverProcess(server);

    if (!child) {
        server.status = "stopped";
        server.pid = null;
        saveServer(server);

        return;
    }

    try {
        child.stdin.write("stop\n");
    } catch {}

    setTimeout(() => {
        if (processes.has(server.id)) {
            try {
                child.kill("SIGTERM");
            } catch {}
        }
    }, 15000);
}

function sendMinecraftCommand(
    server,
    command
) {
    const child =
        serverProcess(server);

    if (!child) {
        return {
            ok: false,
            message: "Der Server läuft nicht."
        };
    }

    command = String(command || "")
        .trim();

    if (!command) {
        return {
            ok: false,
            message: "Kein Befehl eingegeben."
        };
    }

    try {
        child.stdin.write(
            command + "\n"
        );

        addServerConsole(
            server,
            `> ${command}`
        );

        return {
            ok: true
        };
    } catch (error) {
        return {
            ok: false,
            message: error.message
        };
    }
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    const settings =
        readJSON(FILES.settings, {});

    if (
        settings.maintenance &&
        !isAdmin(req)
    ) {
        return res.send(
            page(
                req,
                "Wartung",
                `
                <div class="hero">
                    <h1>🔧 Wartung</h1>

                    <p>
                    ${escapeHTML(
                        settings.maintenanceMessage
                    )}
                    </p>
                </div>
                `
            )
        );
    }

    res.send(
        page(
            req,
            "Home",
            `
            <section class="hero">

                <h1>⛏ Minecraft Hosting</h1>

                <p>
                Erstelle und verwalte deine Minecraft-Server.
                </p>

                <div class="actions"
                     style="justify-content:center">

                    <a class="btn"
                       href="${
                           getUser(req)
                               ? "/dashboard"
                               : "/register"
                       }">
                        Jetzt starten
                    </a>

                    <a class="btn dark"
                       href="/order">
                        Server bestellen
                    </a>

                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h2>🆓 1 Server kostenlos</h2>
                    <p>
                    Der erste Server eines Accounts
                    ist kostenlos.
                    </p>
                </div>

                <div class="card">
                    <h2>💶 Weitere Server</h2>
                    <p>
                    Weitere Server können für 5 €
                    bestellt werden.
                    </p>
                </div>

                <div class="card">
                    <h2>🖥 Echte Konsole</h2>
                    <p>
                    Minecraft-Ausgaben werden
                    direkt vom Java-Prozess empfangen.
                    </p>
                </div>

                <div class="card">
                    <h2>📊 Serververwaltung</h2>
                    <p>
                    Start, Stop, Neustart,
                    Konsole und Logs.
                    </p>
                </div>

            </div>
            `
        )
    );
});

/* =========================================================
   REGISTER
========================================================= */

app.get("/register", (req, res) => {
    res.send(
        page(
            req,
            "Registrieren",
            `
            <div class="card form">

                <h1>Registrieren</h1>

                <form method="POST">

                    <label>Benutzername</label>

                    <input
                        name="username"
                        minlength="3"
                        maxlength="30"
                        required
                    >

                    <label>E-Mail</label>

                    <input
                        type="email"
                        name="email"
                        required
                    >

                    <label>Passwort</label>

                    <input
                        type="password"
                        name="password"
                        minlength="6"
                        required
                    >

                    <button>
                        Account erstellen
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post(
    "/register",
    async (req, res) => {
        const username =
            String(
                req.body.username || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            ).trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const users =
            readJSON(FILES.users, []);

        if (
            users.some(
                user =>
                    user.email.toLowerCase() ===
                    email
            )
        ) {
            return res.status(400).send(
                page(
                    req,
                    "Fehler",
                    `
                    <div class="card center">
                        <h2>
                        Diese E-Mail ist bereits registriert.
                        </h2>
                    </div>
                    `
                )
            );
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );

        const user = {
            id: makeId("user"),
            username,
            email,
            passwordHash,
            createdAt:
                new Date().toISOString(),
            bannedUntil: null,
            banReason: null
        };

        users.push(user);

        writeJSON(
            FILES.users,
            users
        );

        addLog(
            "REGISTER",
            email
        );

        res.redirect(
            "/login?registered=1"
        );
    }
);

/* =========================================================
   LOGIN
========================================================= */

app.get("/login", (req, res) => {
    res.send(
        page(
            req,
            "Anmelden",
            `
            <div class="card form">

                <h1>🔐 Anmelden</h1>

                ${
                    req.query.registered
                        ? `
                        <div class="card">
                            Registrierung erfolgreich.
                        </div>
                        `
                        : ""
                }

                <form method="POST">

                    <label>E-Mail</label>

                    <input
                        type="email"
                        name="email"
                        required
                    >

                    <label>Passwort</label>

                    <input
                        type="password"
                        name="password"
                        required
                    >

                    <button>
                        Anmelden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post(
    "/login",
    async (req, res) => {
        const email =
            String(
                req.body.email || ""
            ).trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const users =
            readJSON(FILES.users, []);

        const user =
            users.find(
                x =>
                    x.email.toLowerCase() ===
                    email
            );

        if (
            !user ||
            !(await bcrypt.compare(
                password,
                user.passwordHash
            ))
        ) {
            return res.status(401).send(
                page(
                    req,
                    "Fehler",
                    `
                    <div class="card center">
                        <h2>
                        E-Mail oder Passwort falsch.
                        </h2>
                    </div>
                    `
                )
            );
        }

        if (isBanned(user)) {
            return res.status(403).send(
                page(
                    req,
                    "Gesperrt",
                    `
                    <div class="card center">
                        <h1>🚫 Gesperrt</h1>

                        <p>
                        ${escapeHTML(
                            user.banReason ||
                                "Kein Grund"
                        )}
                        </p>
                    </div>
                    `
                )
            );
        }

        req.session.userId =
            user.id;

        addLog(
            "LOGIN",
            email
        );

        res.redirect(
            "/dashboard"
        );
    }
);

app.get(
    "/logout",
    (req, res) => {
        req.session.destroy(
            () => res.redirect("/")
        );
    }
);

/* =========================================================
   ORDER
========================================================= */

app.get(
    "/order",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const user =
            getUser(req);

        const count =
            readJSON(
                FILES.servers,
                []
            ).filter(
                server =>
                    server.ownerId ===
                    user.id
            ).length;

        const price =
            count === 0
                ? 0
                : 5;

        res.send(
            page(
                req,
                "Server bestellen",
                `
                <div class="card form">

                    <h1>
                    ⛏ Server bestellen
                    </h1>

                    <div class="card">

                        <h2>
                        ${
                            price === 0
                                ? "🆓 Kostenlos"
                                : "💶 5 €"
                        }
                        </h2>

                    </div>

                    <form method="POST">

                        <label>
                        Servername
                        </label>

                        <input
                            name="serverName"
                            maxlength="40"
                            required
                        >

                        <label>
                        Minecraft Version
                        </label>

                        <select name="version">

                            <option>
                            1.21.8
                            </option>

                            <option>
                            1.21.7
                            </option>

                            <option>
                            1.21.6
                            </option>

                            <option>
                            1.20.6
                            </option>

                        </select>

                        <button>
                        Bestellung absenden
                        </button>

                    </form>

                </div>
                `
            )
        );
    }
);

app.post(
    "/order",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const user =
            getUser(req);

        const serverName =
            String(
                req.body.serverName || ""
            ).trim();

        const version =
            String(
                req.body.version ||
                    "1.21.8"
            );

        const count =
            readJSON(
                FILES.servers,
                []
            ).filter(
                server =>
                    server.ownerId ===
                    user.id
            ).length;

        const order = {
            id: makeId("order"),

            orderNumber:
                "MC-" +
                Date.now()
                    .toString(36)
                    .toUpperCase() +
                "-" +
                crypto
                    .randomBytes(3)
                    .toString("hex")
                    .toUpperCase(),

            userId: user.id,

            username:
                user.username,

            email:
                user.email,

            serverName,

            version,

            price:
                count === 0
                    ? 0
                    : 5,

            status:
                "pending",

            createdAt:
                new Date().toISOString()
        };

        const orders =
            readJSON(
                FILES.orders,
                []
            );

        orders.push(order);

        writeJSON(
            FILES.orders,
            orders
        );

        addLog(
            "ORDER",
            order.orderNumber
        );

        res.send(
            page(
                req,
                "Bestellung",
                `
                <div class="card center">

                    <h1>
                    ✅ Bestellung erstellt
                    </h1>

                    <h2>
                    ${escapeHTML(
                        order.orderNumber
                    )}
                    </h2>

                    <p>
                    Ein Admin muss die Bestellung
                    zuerst annehmen.
                    </p>

                    <a
                        class="btn"
                        href="/dashboard">
                        Dashboard
                    </a>

                </div>
                `
            )
        );
    }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    "/dashboard",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const user =
            getUser(req);

        const servers =
            readJSON(
                FILES.servers,
                []
            ).filter(
                server =>
                    server.ownerId ===
                    user.id
            );

        const orders =
            readJSON(
                FILES.orders,
                []
            )
            .filter(
                order =>
                    order.userId ===
                    user.id
            )
            .reverse();

        res.send(
            page(
                req,
                "Dashboard",
                `
                <h1>
                👋 Hallo ${escapeHTML(
                    user.username
                )}
                </h1>

                <div class="grid">

                    <div class="card">

                        <h3>
                        Server
                        </h3>

                        <div class="price">
                        ${servers.length}
                        </div>

                    </div>

                    <div class="card">

                        <h3>
                        Bestellungen
                        </h3>

                        <div class="price">
                        ${orders.length}
                        </div>

                    </div>

                </div>

                <div class="card">

                    <h2>
                    🖥 Meine Server
                    </h2>

                    ${
                        servers.length
                            ? servers
                                  .map(
                                      server => `
                                      <div class="card">

                                          <h3>
                                          ${escapeHTML(
                                              server.name
                                          )}
                                          </h3>

                                          <p>
                                          IP:
                                          ${escapeHTML(
                                              server.address
                                          )}
                                          </p>

                                          <span
                                            class="status ${
                                                server.status ===
                                                "running"
                                                    ? "running"
                                                    : "stopped"
                                            }">

                                            ${escapeHTML(
                                                server.status
                                            )}

                                          </span>

                                          <a
                                            class="btn"
                                            href="/server/${
                                                server.id
                                            }">

                                            Verwalten

                                          </a>

                                      </div>
                                      `
                                  )
                                  .join("")
                            : `<p class="muted">
                                Noch keine Server.
                               </p>`
                    }

                </div>

                <div class="card">

                    <h2>
                    📦 Bestellungen
                    </h2>

                    ${
                        orders.length
                            ? orders
                                  .map(
                                      order => `
                                      <p>

                                      <b>
                                      ${escapeHTML(
                                          order.orderNumber
                                      )}
                                      </b>

                                      –
                                      ${escapeHTML(
                                          order.serverName
                                      )}

                                      –
                                      ${order.price.toFixed(
                                          2
                                      )} €

                                      –
                                      <span class="status ${
                                          order.status
                                      }">

                                      ${escapeHTML(
                                          order.status
                                      )}

                                      </span>

                                      </p>
                                      `
                                  )
                                  .join("")
                            : `<p class="muted">
                                Keine Bestellungen.
                               </p>`
                    }

                </div>
                `
            )
        );
    }
);

/* =========================================================
   SERVER PAGE
========================================================= */

app.get(
    "/server/:id",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        res.send(
            page(
                req,
                server.name,
                `
                <div class="card">

                    <h1>
                    ⛏ ${escapeHTML(
                        server.name
                    )}
                    </h1>

                    <p>
                    IP:
                    <b>
                    ${escapeHTML(
                        server.address
                    )}
                    </b>
                    </p>

                    <p>
                    Version:
                    ${escapeHTML(
                        server.version
                    )}

                    · Port:
                    ${server.port}

                    · RAM:
                    ${server.ramMB} MB

                    </p>

                    <div class="grid">

                        <div class="card">

                            <h3>
                            Status
                            </h3>

                            <div
                                id="status"
                                class="metric">

                                ${escapeHTML(
                                    server.status
                                )}

                            </div>

                        </div>

                        <div class="card">

                            <h3>
                            RAM
                            </h3>

                            <div
                                id="ram"
                                class="metric">

                                0 MB

                            </div>

                        </div>

                        <div class="card">

                            <h3>
                            CPU
                            </h3>

                            <div
                                id="cpu"
                                class="metric">

                                0 %

                            </div>

                        </div>

                    </div>

                    <div class="actions">

                        <form
                            method="POST"
                            action="/server/${
                                server.id
                            }/start">

                            <button>
                            ▶ Start
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/server/${
                                server.id
                            }/stop">

                            <button class="dark">
                            ⏹ Stop
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/server/${
                                server.id
                            }/restart">

                            <button class="yellow">
                            🔄 Neustart
                            </button>

                        </form>

                    </div>

                </div>

                <div class="card">

                    <h2>
                    🖥 Echte Minecraft-Konsole
                    </h2>

                    <pre
                        id="console"
                        class="console">${escapeHTML(
                            server.console ||
                                "Noch keine Ausgabe."
                        )}</pre>

                    <form
                        id="commandForm">

                        <input
                            id="command"
                            placeholder="Minecraft-Befehl, z.B. say Hallo"
                            autocomplete="off"
                        >

                        <button>
                        Befehl senden
                        </button>

                    </form>

                </div>

<script>

const consoleBox =
    document.getElementById("console");

const commandInput =
    document.getElementById("command");

document
.getElementById("commandForm")
.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const command =
            commandInput.value.trim();

        if (!command) return;

        const response =
            await fetch(
                "/api/server/${
                    server.id
                }/command",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        command
                    })
                }
            );

        const result =
            await response.json();

        if (!result.ok) {
            alert(
                result.message ||
                "Fehler"
            );

            return;
        }

        commandInput.value = "";

    }
);

async function updateServer() {

    try {

        const response =
            await fetch(
                "/api/server/${
                    server.id
                }/state"
            );

        const data =
            await response.json();

        if (!data.ok) return;

        consoleBox.textContent =
            data.console;

        document
            .getElementById("status")
            .textContent =
                data.status;

        document
            .getElementById("ram")
            .textContent =
                data.ram + " MB";

        document
            .getElementById("cpu")
            .textContent =
                data.cpu + " %";

        consoleBox.scrollTop =
            consoleBox.scrollHeight;

    } catch {}

}

setInterval(
    updateServer,
    1000
);

updateServer();

</script>
                `
            )
        );
    }
);

/* =========================================================
   SERVER API
========================================================= */

app.get(
    "/api/server/:id/state",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.json({
                ok: false
            });
        }

        const process =
            serverProcess(server);

        let ram = 0;

        if (process) {
            try {
                ram = Math.round(
                    process.pid
                        ? process.memoryUsage
                            ? 0
                            : 0
                        : 0
                );
            } catch {}
        }

        res.json({
            ok: true,
            status: server.status,
            console:
                server.console || "",
            ram,
            cpu: process ? 0 : 0
        });
    }
);

app.post(
    "/api/server/:id/command",
    requireLogin,
    checkMaintenance,
    (req, res) => {
        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.status(403).json({
                ok: false,
                message: "Kein Zugriff."
            });
        }

        res.json(
            sendMinecraftCommand(
                server,
                req.body.command
            )
        );
    }
);

/* =========================================================
   START / STOP / RESTART
========================================================= */

app.post(
    "/server/:id/start",
    requireLogin,
    checkMaintenance,
    async (req, res) => {

        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const result =
            await startMinecraft(
                server
            );

        if (!result.ok) {
            addServerConsole(
                server,
                "START FEHLER: " +
                    result.message
            );
        }

        res.redirect(
            "/server/" +
                server.id
        );
    }
);

app.post(
    "/server/:id/stop",
    requireLogin,
    checkMaintenance,
    (req, res) => {

        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        stopMinecraft(server);

        addLog(
            "SERVER_STOP_REQUEST",
            server.name
        );

        res.redirect(
            "/server/" +
                server.id
        );
    }
);

app.post(
    "/server/:id/restart",
    requireLogin,
    checkMaintenance,
    async (req, res) => {

        const server =
            findServer(
                req.params.id
            );

        const user =
            getUser(req);

        if (
            !server ||
            (
                server.ownerId !== user.id &&
                !isAdmin(req)
            )
        ) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        stopMinecraft(server);

        setTimeout(
            () => {
                startMinecraft(
                    server
                ).catch(error => {
                    addServerConsole(
                        server,
                        "RESTART FEHLER: " +
                            error.message
                    );
                });
            },
            3000
        );

        res.redirect(
            "/server/" +
                server.id
        );
    }
);

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get(
    "/admin",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const users =
            readJSON(
                FILES.users,
                []
            );

        const orders =
            readJSON(
                FILES.orders,
                []
            ).reverse();

        const servers =
            readJSON(
                FILES.servers,
                []
            );

        const logs =
            readJSON(
                FILES.logs,
                []
            );

        const settings =
            readJSON(
                FILES.settings,
                {}
            );

        const running =
            servers.filter(
                server =>
                    serverProcess(server)
            ).length;

        const totalMemory =
            os.totalmem();

        const freeMemory =
            os.freemem();

        const usedMemory =
            totalMemory -
            freeMemory;

        res.send(
            page(
                req,
                "Admin",
                `
                <h1>
                👑 Admin Panel
                </h1>

                <div class="grid">

                    <div class="card">

                        <h3>
                        Server
                        </h3>

                        <div class="price">
                        ${servers.length}
                        </div>

                    </div>

                    <div class="card">

                        <h3>
                        Laufende Server
                        </h3>

                        <div class="price">
                        ${running}
                        </div>

                    </div>

                    <div class="card">

                        <h3>
                        RAM-Auslastung
                        </h3>

                        <div class="price">

                        ${Math.round(
                            usedMemory /
                                1024 /
                                1024 /
                                1024 *
                                10
                        ) / 10}

                        GB

                        </div>

                        <p class="muted">

                        von

                        ${Math.round(
                            totalMemory /
                                1024 /
                                1024 /
                                1024 *
                                10
                        ) / 10}

                        GB

                        </p>

                    </div>

                </div>

                <div class="card">

                    <h2>
                    🔧 Wartungsmodus
                    </h2>

                    <form
                        method="POST"
                        action="/admin/maintenance">

                        <textarea
                            name="message"
                            placeholder="Wartungstext">${escapeHTML(
                                settings.maintenanceMessage ||
                                    ""
                            )}</textarea>

                        <div class="actions">

                            <button
                                name="action"
                                value="on">

                                🔧 Wartung AN
                                + Server stoppen

                            </button>

                            <button
                                class="dark"
                                name="action"
                                value="off">

                                Wartung AUS

                            </button>

                        </div>

                    </form>

                </div>

                <div class="card">

                    <h2>
                    📦 Bestellungen
                    </h2>

                    ${
                        orders.length
                            ? orders
                                  .map(
                                      order => `
                                      <div class="card">

                                          <b>
                                          ${escapeHTML(
                                              order.orderNumber
                                          )}
                                          </b>

                                          <p>
                                          ${escapeHTML(
                                              order.serverName
                                          )}

                                          ·

                                          ${escapeHTML(
                                              order.email
                                          )}

                                          ·

                                          ${order.price.toFixed(
                                              2
                                          )} €

                                          </p>

                                          <span
                                            class="status ${
                                                order.status
                                            }">

                                            ${escapeHTML(
                                                order.status
                                            )}

                                          </span>

                                          ${
                                              order.status ===
                                              "pending"
                                                  ? `
                                                  <div class="actions">

                                                      <form
                                                        method="POST"
                                                        action="/admin/order/${order.id}/accept">

                                                        <button>
                                                        ✅ Annehmen
                                                        </button>

                                                      </form>

                                                      <form
                                                        method="POST"
                                                        action="/admin/order/${order.id}/reject">

                                                        <button class="red">
                                                        ❌ Ablehnen
                                                        </button>

                                                      </form>

                                                  </div>
                                                  `
                                                  : ""
                                          }

                                      </div>
                                      `
                                  )
                                  .join("")
                            : "<p>Keine Bestellungen.</p>"
                    }

                </div>

                <div class="card">

                    <h2>
                    🖥 Alle Server
                    </h2>

                    ${
                        servers.length
                            ? servers
                                  .map(
                                      server => `
                                      <div class="card">

                                          <h3>
                                          ${escapeHTML(
                                              server.name
                                          )}
                                          </h3>

                                          <p>
                                          ${escapeHTML(
                                              server.address
                                          )}
                                          </p>

                                          <a
                                            class="btn"
                                            href="/server/${server.id}">

                                            Konsole

                                          </a>

                                          <form
                                            style="display:inline"
                                            method="POST"
                                            action="/admin/server/${server.id}/delete"
                                            onsubmit="return confirm('Server wirklich löschen?')">

                                            <button
                                                class="red">

                                                🗑 Löschen

                                            </button>

                                          </form>

                                      </div>
                                      `
                                  )
                                  .join("")
                            : "<p>Keine Server.</p>"
                    }

                </div>

                <div class="card">

                    <h2>
                    👥 Benutzer sperren
                    </h2>

                    ${
                        users
                            .map(
                                user => `
                                <div class="card">

                                    <b>
                                    ${escapeHTML(
                                        user.username
                                    )}
                                    </b>

                                    <p>
                                    ${escapeHTML(
                                        user.email
                                    )}
                                    </p>

                                    ${
                                        user.email.toLowerCase() !==
                                        ADMIN_EMAIL.toLowerCase()
                                            ? `
                                            <form
                                                method="POST"
                                                action="/admin/user/${user.id}/ban">

                                                <input
                                                    name="reason"
                                                    placeholder="Grund"
                                                    required
                                                >

                                                <select
                                                    name="duration">

                                                    <option value="1h">
                                                    1 Stunde
                                                    </option>

                                                    <option value="1d">
                                                    1 Tag
                                                    </option>

                                                    <option value="7d">
                                                    7 Tage
                                                    </option>

                                                    <option value="30d">
                                                    30 Tage
                                                    </option>

                                                    <option value="permanent">
                                                    Dauerhaft
                                                    </option>

                                                </select>

                                                <button
                                                    class="red">

                                                    🚫 Sperren

                                                </button>

                                            </form>

                                            ${
                                                user.bannedUntil
                                                    ? `
                                                    <form
                                                        method="POST"
                                                        action="/admin/user/${user.id}/unban">

                                                        <button class="dark">
                                                        Sperre aufheben
                                                        </button>

                                                    </form>
                                                    `
                                                    : ""
                                            }

                                            `
                                            : `
                                            <p class="muted">
                                            👑 Hauptadministrator
                                            </p>
                                            `
                                    }

                                </div>
                                `
                            )
                            .join("")
                    }

                </div>

                <div class="card">

                    <h2>
                    📜 System-Logs
                    </h2>

                    <pre class="console">${escapeHTML(
                        logs
                            .slice(0, 300)
                            .map(
                                log =>
                                    `[${log.date}] [${log.type}] ${log.message}`
                            )
                            .join("\n")
                    )}</pre>

                </div>
                `
            )
        );
    }
);

/* =========================================================
   ADMIN - ORDER ACCEPT
========================================================= */

app.post(
    "/admin/order/:id/accept",
    requireLogin,
    requireAdmin,
    async (req, res) => {

        const orders =
            readJSON(
                FILES.orders,
                []
            );

        const order =
            orders.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!order) {
            return res.status(404).send(
                "Bestellung nicht gefunden."
            );
        }

        if (
            order.status !==
            "pending"
        ) {
            return res.redirect(
                "/admin"
            );
        }

        const servers =
            readJSON(
                FILES.servers,
                []
            );

        const usedPorts =
            new Set(
                servers.map(
                    x =>
                        Number(x.port)
                )
            );

        let port = 25565;

        while (
            usedPorts.has(port)
        ) {
            port++;
        }

        const server = {
            id: makeId("server"),

            orderId:
                order.id,

            orderNumber:
                order.orderNumber,

            ownerId:
                order.userId,

            username:
                order.username,

            email:
                order.email,

            name:
                order.serverName,

            version:
                order.version,

            port,

            address:
                `${process.env.MINECRAFT_HOST || "localhost"}:${port}`,

            ramMB:
                SERVER_RAM,

            status:
                "stopped",

            pid:
                null,

            console:
                "",

            createdAt:
                new Date().toISOString()
        };

        servers.push(
            server
        );

        writeJSON(
            FILES.servers,
            servers
        );

        order.status =
            "accepted";

        order.reviewedAt =
            new Date().toISOString();

        writeJSON(
            FILES.orders,
            orders
        );

        addLog(
            "ORDER_ACCEPTED",
            `${order.orderNumber} -> ${server.address}`
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN - ORDER REJECT
========================================================= */

app.post(
    "/admin/order/:id/reject",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const orders =
            readJSON(
                FILES.orders,
                []
            );

        const order =
            orders.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!order) {
            return res.status(404).send(
                "Bestellung nicht gefunden."
            );
        }

        order.status =
            "rejected";

        order.reviewedAt =
            new Date().toISOString();

        writeJSON(
            FILES.orders,
            orders
        );

        addLog(
            "ORDER_REJECTED",
            order.orderNumber
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN - DELETE SERVER
========================================================= */

app.post(
    "/admin/server/:id/delete",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const server =
            findServer(
                req.params.id
            );

        if (!server) {
            return res.redirect(
                "/admin"
            );
        }

        stopMinecraft(
            server
        );

        const servers =
            readJSON(
                FILES.servers,
                []
            ).filter(
                x =>
                    x.id !==
                    server.id
            );

        writeJSON(
            FILES.servers,
            servers
        );

        try {
            fs.rmSync(
                serverDirectory(
                    server
                ),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}

        addLog(
            "SERVER_DELETE",
            server.name
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN - MAINTENANCE
========================================================= */

app.post(
    "/admin/maintenance",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const settings =
            readJSON(
                FILES.settings,
                {}
            );

        settings.maintenance =
            req.body.action ===
            "on";

        settings.maintenanceMessage =
            String(
                req.body.message ||
                    "Die Webseite befindet sich im Wartungsmodus."
            );

        writeJSON(
            FILES.settings,
            settings
        );

        if (
            settings.maintenance
        ) {
            const servers =
                readJSON(
                    FILES.servers,
                    []
                );

            for (
                const server
                of servers
            ) {
                if (
                    serverProcess(
                        server
                    )
                ) {
                    stopMinecraft(
                        server
                    );
                }
            }

            addLog(
                "MAINTENANCE",
                "Wartungsmodus AN - Server werden gestoppt"
            );
        } else {
            addLog(
                "MAINTENANCE",
                "Wartungsmodus AUS"
            );
        }

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN - BAN
========================================================= */

function banDuration(
    duration
) {
    const durations = {
        "1h": 60 * 60 * 1000,

        "1d":
            24 *
            60 *
            60 *
            1000,

        "7d":
            7 *
            24 *
            60 *
            60 *
            1000,

        "30d":
            30 *
            24 *
            60 *
            60 *
            1000
    };

    return durations[
        duration
    ] || 0;
}

app.post(
    "/admin/user/:id/ban",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const users =
            readJSON(
                FILES.users,
                []
            );

        const user =
            users.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!user) {
            return res.redirect(
                "/admin"
            );
        }

        if (
            user.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.status(403).send(
                "Der Hauptadministrator kann nicht gesperrt werden."
            );
        }

        const duration =
            String(
                req.body.duration ||
                    "1d"
            );

        user.banReason =
            String(
                req.body.reason ||
                    "Kein Grund"
            );

        if (
            duration ===
            "permanent"
        ) {
            user.bannedUntil =
                "permanent";
        } else {
            user.bannedUntil =
                new Date(
                    Date.now() +
                        banDuration(
                            duration
                        )
                ).toISOString();
        }

        writeJSON(
            FILES.users,
            users
        );

        addLog(
            "BAN",
            `${user.email} - ${user.banReason}`
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN - UNBAN
========================================================= */

app.post(
    "/admin/user/:id/unban",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const users =
            readJSON(
                FILES.users,
                []
            );

        const user =
            users.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (user) {

            user.bannedUntil =
                null;

            user.banReason =
                null;

            writeJSON(
                FILES.users,
                users
            );

            addLog(
                "UNBAN",
                user.email
            );
        }

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Minecraft Hosting läuft auf Port ${PORT}`
        );

        addLog(
            "SYSTEM",
            `Webseite gestartet auf Port ${PORT}`
        );

    }
);

/* =========================================================
   CLEAN SHUTDOWN
========================================================= */

function shutdown() {

    console.log(
        "Server wird heruntergefahren..."
    );

    const servers =
        readJSON(
            FILES.servers,
            []
        );

    for (
        const server
        of servers
    ) {
        if (
            serverProcess(
                server
            )
        ) {
            stopMinecraft(
                server
            );
        }
    }

    setTimeout(
        () => process.exit(0),
        3000
    );
}

process.on(
    "SIGTERM",
    shutdown
);

process.on(
    "SIGINT",
    shutdown
);
