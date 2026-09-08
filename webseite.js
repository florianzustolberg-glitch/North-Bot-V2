"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const https = require("https");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = "florianzustolberg@gmail.com";
const JAVA = process.env.JAVA_COMMAND || "java";

const BASE = __dirname;
const DATA = path.join(BASE, "data");
const SERVERS = path.join(BASE, "minecraft-servers");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(SERVERS, { recursive: true });

const files = {
    users: path.join(DATA, "users.json"),
    orders: path.join(DATA, "orders.json"),
    servers: path.join(DATA, "servers.json"),
    logs: path.join(DATA, "logs.json"),
    settings: path.join(DATA, "settings.json")
};

function ensure(file, value) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(value, null, 2)
        );
    }
}

ensure(files.users, []);
ensure(files.orders, []);
ensure(files.servers, []);
ensure(files.logs, []);
ensure(files.settings, {
    maintenance: false,
    maintenanceMessage:
        "Die Webseite befindet sich im Wartungsmodus."
});

function read(file, fallback = []) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return fallback;
    }
}

function write(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function id(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(8).toString("hex")
    );
}

function esc(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function log(type, message) {
    const logs = read(files.logs);

    logs.unshift({
        id: id("log"),
        type,
        message,
        time: new Date().toISOString()
    });

    write(
        files.logs,
        logs.slice(0, 5000)
    );

    console.log(
        `[${type}] ${message}`
    );
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge:
                30 *
                24 *
                60 *
                60 *
                1000
        }
    })
);

/* =========================================================
   AUTH
========================================================= */

function user(req) {
    if (!req.session.userId) {
        return null;
    }

    return read(files.users).find(
        x =>
            x.id ===
            req.session.userId
    ) || null;
}

function admin(req) {
    const u = user(req);

    return (
        u &&
        u.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
    );
}

function logged(req, res, next) {
    if (!user(req)) {
        return res.redirect("/login");
    }

    next();
}

function onlyAdmin(req, res, next) {
    if (!admin(req)) {
        return res.status(403).send(
            html(
                req,
                "Kein Zugriff",
                `
                <div class="card center">
                    <h1>403</h1>
                    <p>
                    Nur der Administrator hat Zugriff.
                    </p>
                </div>
                `
            )
        );
    }

    next();
}

function maintenance(req, res, next) {
    const settings =
        read(files.settings, {});

    if (
        settings.maintenance &&
        !admin(req)
    ) {
        return res.status(503).send(
            html(
                req,
                "Wartung",
                `
                <div class="hero">
                    <h1>🔧 Wartung</h1>

                    <p>
                    ${esc(
                        settings.maintenanceMessage
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

function html(req, title, content) {
    const u = user(req);

    return `
<!DOCTYPE html>
<html lang="de">
<head>

<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>${esc(title)} | Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #070a08;
    color: #fff;
    font-family: Arial, sans-serif;
}

header {
    background: #101510;
    border-bottom: 1px solid #293229;
}

.nav {
    max-width: 1250px;
    margin: auto;
    min-height: 65px;
    padding: 10px 18px;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
}

.logo {
    color: #67ff7b;
    text-decoration: none;
    font-size: 20px;
    font-weight: bold;
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

nav a {
    color: #aaa;
    text-decoration: none;
    padding: 9px 11px;
    border-radius: 8px;
}

nav a:hover {
    background: #222922;
    color: white;
}

main {
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
        repeat(auto-fit,minmax(230px,1fr));
    gap: 15px;
}

.card {
    background: #111711;
    border: 1px solid #2b332b;
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
    background: #070a08;
    color: white;
    border: 1px solid #353d35;
    border-radius: 8px;
    padding: 12px;
    margin: 6px 0 14px;
}

textarea {
    min-height: 110px;
}

button,
.btn {
    border: 0;
    border-radius: 8px;
    padding: 11px 15px;
    background: #67f477;
    color: #061007;
    font-weight: bold;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
}

button:hover,
.btn:hover {
    opacity: .85;
}

.dark {
    background: #303630;
    color: white;
}

.red {
    background: #d74747;
    color: white;
}

.yellow {
    background: #e1bd42;
    color: black;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.metric {
    font-size: 30px;
    font-weight: bold;
    color: #67ff7b;
}

.console {
    background: #020302;
    border: 1px solid #303830;
    border-radius: 10px;
    height: 480px;
    overflow-y: auto;
    padding: 15px;
    color: #9cffaa;
    white-space: pre-wrap;
    font-family: Consolas, monospace;
    font-size: 13px;
}

.status {
    display: inline-block;
    padding: 5px 8px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: bold;
}

.running {
    background: #173d1d;
    color: #75ff87;
}

.stopped {
    background: #421919;
    color: #ff8585;
}

.pending {
    background: #433b17;
    color: #ffe267;
}

.accepted {
    background: #173d1d;
    color: #75ff87;
}

.rejected {
    background: #421919;
    color: #ff8585;
}

.muted {
    color: #858c86;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 10px;
    border-bottom: 1px solid #292e29;
    text-align: left;
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
    u
        ? `
        <a href="/dashboard">
        Dashboard
        </a>

        <a href="/order">
        Server bestellen
        </a>

        ${
            admin(req)
                ? `
                <a href="/admin">
                👑 Admin
                </a>
                `
                : ""
        }

        <a href="/logout">
        Logout
        </a>
        `
        : `
        <a href="/login">
        Anmeldung
        </a>

        <a href="/register">
        Registrierung
        </a>
        `
}

</nav>

</div>

</header>

<main>

${content}

</main>

<footer class="center muted">
Minecraft Hosting
</footer>

</body>
</html>
`;
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    const settings =
        read(files.settings, {});

    if (
        settings.maintenance &&
        !admin(req)
    ) {
        return res.send(
            html(
                req,
                "Wartung",
                `
                <div class="hero">

                    <h1>
                    🔧 Wartung
                    </h1>

                    <p>
                    ${esc(
                        settings.maintenanceMessage
                    )}
                    </p>

                </div>
                `
            )
        );
    }

    res.send(
        html(
            req,
            "Home",
            `
            <div class="hero">

                <h1>
                ⛏ Minecraft Hosting
                </h1>

                <p>
                Minecraft-Server online verwalten.
                </p>

                <div class="actions"
                     style="justify-content:center">

                    <a class="btn"
                       href="${
                           user(req)
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

            </div>

            <div class="grid">

                <div class="card">
                    <h2>🆓 Erster Server</h2>
                    <p>
                    Ein Server pro Benutzer kostenlos.
                    </p>
                </div>

                <div class="card">
                    <h2>💶 Weitere Server</h2>
                    <p>
                    Weitere Server werden mit
                    5 € Bestellung angelegt.
                    </p>
                </div>

                <div class="card">
                    <h2>🖥 Konsole</h2>
                    <p>
                    Echte Minecraft-Prozessausgabe.
                    </p>
                </div>

                <div class="card">
                    <h2>🌐 Automatische IP</h2>
                    <p>
                    Der Server bekommt automatisch
                    einen freien Port.
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
        html(
            req,
            "Registrieren",
            `
            <div class="card form">

                <h1>
                Registrierung
                </h1>

                <form method="POST">

                    <label>
                    Benutzername
                    </label>

                    <input
                        name="username"
                        minlength="3"
                        maxlength="30"
                        required
                    >

                    <label>
                    E-Mail
                    </label>

                    <input
                        type="email"
                        name="email"
                        required
                    >

                    <label>
                    Passwort
                    </label>

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

        if (
            username.length < 3 ||
            password.length < 6 ||
            !email.includes("@")
        ) {
            return res.status(400).send(
                "Ungültige Eingaben."
            );
        }

        const users =
            read(files.users);

        if (
            users.some(
                x =>
                    x.email.toLowerCase() ===
                    email
            )
        ) {
            return res.status(400).send(
                "E-Mail bereits registriert."
            );
        }

        const hash =
            await bcrypt.hash(
                password,
                12
            );

        users.push({
            id: id("user"),
            username,
            email,
            passwordHash: hash,
            createdAt:
                new Date().toISOString(),
            bannedUntil: null,
            banReason: null
        });

        write(
            files.users,
            users
        );

        log(
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
        html(
            req,
            "Login",
            `
            <div class="card form">

                <h1>
                🔐 Anmeldung
                </h1>

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

                    <label>
                    E-Mail
                    </label>

                    <input
                        type="email"
                        name="email"
                        required
                    >

                    <label>
                    Passwort
                    </label>

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
            )
            .trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const u =
            read(files.users).find(
                x =>
                    x.email.toLowerCase() ===
                    email
            );

        if (
            !u ||
            !(await bcrypt.compare(
                password,
                u.passwordHash
            ))
        ) {
            return res.status(401).send(
                html(
                    req,
                    "Login Fehler",
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

        if (
            u.bannedUntil ===
            "permanent"
        ) {
            return res.status(403).send(
                "Dieser Account ist dauerhaft gesperrt."
            );
        }

        if (
            u.bannedUntil &&
            new Date(
                u.bannedUntil
            ).getTime() > Date.now()
        ) {
            return res.status(403).send(
                `Account gesperrt: ${esc(
                    u.banReason
                )}`
            );
        }

        req.session.userId =
            u.id;

        log(
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
            () =>
                res.redirect("/")
        );
    }
);

/* =========================================================
   ORDER
========================================================= */

app.get(
    "/order",
    logged,
    maintenance,
    (req, res) => {

        const u =
            user(req);

        const count =
            read(files.servers)
                .filter(
                    x =>
                        x.ownerId ===
                        u.id
                )
                .length;

        const price =
            count === 0
                ? 0
                : 5;

        res.send(
            html(
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
                                : "💶 5,00 €"
                        }
                        </h2>

                        <p>
                        ${
                            price === 0
                                ? "Dein erster Server ist kostenlos."
                                : "Dies ist ein zusätzlicher Server."
                        }
                        </p>

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

                            <option value="1.21.8">
                            1.21.8
                            </option>

                            <option value="1.21.7">
                            1.21.7
                            </option>

                            <option value="1.21.6">
                            1.21.6
                            </option>

                        </select>

                        <button>
                        Bestellung erstellen
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
    logged,
    maintenance,
    (req, res) => {

        const u =
            user(req);

        const name =
            String(
                req.body.serverName || ""
            ).trim();

        const version =
            String(
                req.body.version ||
                    "1.21.8"
            );

        const count =
            read(files.servers)
                .filter(
                    x =>
                        x.ownerId ===
                        u.id
                )
                .length;

        const order = {
            id: id("order"),

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

            userId: u.id,

            username:
                u.username,

            email:
                u.email,

            serverName: name,

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
            read(files.orders);

        orders.push(order);

        write(
            files.orders,
            orders
        );

        log(
            "ORDER",
            order.orderNumber
        );

        res.send(
            html(
                req,
                "Bestellung",
                `
                <div class="card center">

                    <h1>
                    ✅ Bestellung erstellt
                    </h1>

                    <h2>
                    ${esc(
                        order.orderNumber
                    )}
                    </h2>

                    <p>
                    Die Bestellung wartet auf
                    die Freigabe durch den Admin.
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
    logged,
    maintenance,
    (req, res) => {

        const u =
            user(req);

        const servers =
            read(files.servers)
                .filter(
                    x =>
                        x.ownerId ===
                        u.id
                );

        const orders =
            read(files.orders)
                .filter(
                    x =>
                        x.userId ===
                        u.id
                )
                .reverse();

        res.send(
            html(
                req,
                "Dashboard",
                `
                <h1>
                👋 ${esc(
                    u.username
                )}
                </h1>

                <div class="grid">

                    <div class="card">
                        <h3>Server</h3>
                        <div class="metric">
                        ${servers.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>Bestellungen</h3>
                        <div class="metric">
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
                            ? servers.map(
                                s => `
                                <div class="card">

                                    <h2>
                                    ${esc(
                                        s.name
                                    )}
                                    </h2>

                                    <p>
                                    IP:
                                    <b>
                                    ${esc(
                                        s.address
                                    )}
                                    </b>
                                    </p>

                                    <span
                                        class="status ${
                                            s.status ===
                                            "running"
                                                ? "running"
                                                : "stopped"
                                        }">

                                        ${esc(
                                            s.status
                                        )}

                                    </span>

                                    <br><br>

                                    <a
                                        class="btn"
                                        href="/server/${s.id}">

                                        Verwalten

                                    </a>

                                </div>
                                `
                            ).join("")
                            : `
                            <p class="muted">
                            Du hast noch keinen Server.
                            </p>
                            `
                    }

                </div>

                <div class="card">

                    <h2>
                    📦 Bestellungen
                    </h2>

                    ${
                        orders.length
                            ? orders.map(
                                o => `
                                <div class="card">

                                    <b>
                                    ${esc(
                                        o.orderNumber
                                    )}
                                    </b>

                                    <p>
                                    ${esc(
                                        o.serverName
                                    )}
                                    </p>

                                    <span
                                        class="status ${
                                            o.status
                                        }">

                                        ${esc(
                                            o.status
                                        )}

                                    </span>

                                </div>
                                `
                            ).join("")
                            : `
                            <p class="muted">
                            Keine Bestellungen.
                            </p>
                            `
                    }

                </div>
                `
            )
        );
    }
);

/* =========================================================
   SERVER PROCESS
========================================================= */

const processes = new Map();

function getServer(serverId) {
    return read(files.servers).find(
        x =>
            x.id ===
            serverId
    ) || null;
}

function serverPath(server) {
    return path.join(
        SERVERS,
        server.id
    );
}

/* =========================================================
   DOWNLOAD
   Automatische Minecraft JAR
========================================================= */

function download(url, destination) {
    return new Promise(
        (resolve, reject) => {

            const file =
                fs.createWriteStream(
                    destination
                );

            https.get(
                url,
                response => {

                    if (
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        return download(
                            response.headers.location,
                            destination
                        )
                        .then(resolve)
                        .catch(reject);
                    }

                    if (
                        response.statusCode !==
                        200
                    ) {
                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        return reject(
                            new Error(
                                `Download HTTP ${response.statusCode}`
                            )
                        );
                    }

                    response.pipe(
                        file
                    );

                    file.on(
                        "finish",
                        () => {
                            file.close(
                                resolve
                            );
                        }
                    );

                }
            ).on(
                "error",
                error => {
                    file.close();

                    try {
                        fs.unlinkSync(
                            destination
                        );
                    } catch {}

                    reject(error);
                }
            );
        }
    );
}

/*
 * Lädt die offizielle Mojang-Version-Metadatei
 * und anschließend die Server-JAR.
 */
async function downloadMinecraftJar(
    server
) {

    const directory =
        serverPath(server);

    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );

    const jar =
        path.join(
            directory,
            "server.jar"
        );

    if (
        fs.existsSync(jar) &&
        fs.statSync(jar).size > 1000000
    ) {
        return jar;
    }

    addConsole(
        server,
        `Lade Minecraft ${server.version} herunter...`
    );

    const manifest =
        await fetchJSON(
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
        );

    const version =
        manifest.versions.find(
            x =>
                x.id ===
                server.version
        );

    if (!version) {
        throw new Error(
            "Minecraft-Version nicht gefunden: " +
                server.version
        );
    }

    const versionData =
        await fetchJSON(
            version.url
        );

    if (
        !versionData.downloads ||
        !versionData.downloads.server
    ) {
        throw new Error(
            "Für diese Minecraft-Version ist keine Server-JAR verfügbar."
        );
    }

    await download(
        versionData.downloads.server.url,
        jar
    );

    addConsole(
        server,
        "Minecraft server.jar wurde heruntergeladen."
    );

    return jar;
}

function fetchJSON(url) {
    return new Promise(
        (resolve, reject) => {

            https.get(
                url,
                response => {

                    let data = "";

                    response.on(
                        "data",
                        chunk => {
                            data +=
                                chunk.toString();
                        }
                    );

                    response.on(
                        "end",
                        () => {

                            if (
                                response.statusCode !==
                                200
                            ) {
                                return reject(
                                    new Error(
                                        `HTTP ${response.statusCode}`
                                    )
                                );
                            }

                            try {
                                resolve(
                                    JSON.parse(
                                        data
                                    )
                                );
                            } catch (
                                error
                            ) {
                                reject(
                                    error
                                );
                            }
                        }
                    );

                }
            ).on(
                "error",
                reject
            );
        }
    );
}

/* =========================================================
   SERVER CONFIG
========================================================= */

function saveServer(server) {
    const servers =
        read(files.servers);

    const index =
        servers.findIndex(
            x =>
                x.id ===
                server.id
        );

    if (index === -1) {
        servers.push(server);
    } else {
        servers[index] =
            server;
    }

    write(
        files.servers,
        servers
    );
}

function addConsole(
    server,
    text
) {

    const lines =
        String(text)
            .replace(/\r/g, "")
            .split("\n");

    for (
        const line
        of lines
    ) {

        if (!line.trim()) {
            continue;
        }

        server.console =
            (
                server.console ||
                ""
            ) +
            `[${new Date().toISOString()}] ${line}\n`;
    }

    if (
        server.console.length >
        300000
    ) {
        server.console =
            server.console.slice(
                -300000
            );
    }

    saveServer(
        server
    );
}

function freePort() {

    const servers =
        read(files.servers);

    const used =
        new Set(
            servers.map(
                x =>
                    Number(x.port)
            )
        );

    let port = 25565;

    while (
        used.has(port)
    ) {
        port++;
    }

    return port;
}

/* =========================================================
   START MINECRAFT
========================================================= */

async function startMinecraft(
    server
) {

    if (
        processes.has(
            server.id
        )
    ) {
        return {
            ok: false,
            message:
                "Server läuft bereits."
        };
    }

    try {

        const directory =
            serverPath(server);

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );

        const jar =
            await downloadMinecraftJar(
                server
            );

        fs.writeFileSync(
            path.join(
                directory,
                "eula.txt"
            ),
            "eula=true\n"
        );

        fs.writeFileSync(
            path.join(
                directory,
                "server.properties"
            ),
            [
                `server-port=${server.port}`,
                "server-ip=",
                `motd=${server.name}`,
                "online-mode=true",
                "enable-command-block=true",
                "spawn-protection=0",
                "view-distance=10",
                "simulation-distance=10"
            ].join("\n") +
                "\n"
        );

        addConsole(
            server,
            "Starte Minecraft Java..."
        );

        const child =
            spawn(
                JAVA,
                [
                    "-Xms512M",
                    `-Xmx${server.ramMB}M`,
                    "-jar",
                    jar,
                    "nogui"
                ],
                {
                    cwd:
                        directory,
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

        server.status =
            "running";

        server.pid =
            child.pid;

        server.startedAt =
            new Date().toISOString();

        saveServer(
            server
        );

        child.stdout.on(
            "data",
            data => {

                addConsole(
                    server,
                    data.toString()
                );

            }
        );

        child.stderr.on(
            "data",
            data => {

                addConsole(
                    server,
                    data.toString()
                );

            }
        );

        child.on(
            "error",
            error => {

                addConsole(
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

                server.status =
                    "stopped";

                server.pid =
                    null;

                saveServer(
                    server
                );

                addConsole(
                    server,
                    `Minecraft beendet. Exit-Code: ${code}`
                );

                log(
                    "SERVER_STOP",
                    server.name
                );

            }
        );

        log(
            "SERVER_START",
            `${server.name} auf Port ${server.port}`
        );

        return {
            ok: true
        };

    } catch (error) {

        addConsole(
            server,
            "START FEHLER: " +
                error.message
        );

        return {
            ok: false,
            message:
                error.message
        };
    }
}

/* =========================================================
   STOP
========================================================= */

function stopMinecraft(
    server
) {

    const process =
        processes.get(
            server.id
        );

    if (!process) {

        server.status =
            "stopped";

        server.pid =
            null;

        saveServer(
            server
        );

        return;
    }

    try {
        process.stdin.write(
            "stop\n"
        );
    } catch {}

    setTimeout(
        () => {

            if (
                processes.has(
                    server.id
                )
            ) {
                try {
                    process.kill(
                        "SIGTERM"
                    );
                } catch {}
            }

        },
        15000
    );
}

/* =========================================================
   SERVER PAGE
========================================================= */

app.get(
    "/server/:id",
    logged,
    maintenance,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        res.send(
            html(
                req,
                server.name,
                `
                <div class="card">

                    <h1>
                    ⛏ ${esc(
                        server.name
                    )}
                    </h1>

                    <p>
                    IP:
                    <b>
                    ${esc(
                        server.address
                    )}
                    </b>
                    </p>

                    <p>
                    Version:
                    ${esc(
                        server.version
                    )}
                    </p>

                    <p>
                    RAM:
                    ${server.ramMB} MB
                    </p>

                    <div class="actions">

                        <form
                            method="POST"
                            action="/server/${server.id}/start">

                            <button>
                            ▶ Start
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/server/${server.id}/stop">

                            <button class="dark">
                            ⏹ Stop
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/server/${server.id}/restart">

                            <button class="yellow">
                            🔄 Neustart
                            </button>

                        </form>

                    </div>

                </div>

                <div class="grid">

                    <div class="card">
                        <h3>Status</h3>
                        <div id="status"
                             class="metric">
                            ${esc(
                                server.status
                            )}
                        </div>
                    </div>

                    <div class="card">
                        <h3>RAM</h3>
                        <div id="ram"
                             class="metric">
                            0 MB
                        </div>
                    </div>

                    <div class="card">
                        <h3>PID</h3>
                        <div id="pid"
                             class="metric">
                            ${server.pid || "-"}
                        </div>
                    </div>

                </div>

                <div class="card">

                    <h2>
                    🖥 Minecraft-Konsole
                    </h2>

                    <pre
                        id="console"
                        class="console">${esc(
                            server.console ||
                                "Noch keine Ausgabe."
                        )}</pre>

                    <form
                        id="commandForm">

                        <input
                            id="command"
                            autocomplete="off"
                            placeholder="Minecraft-Befehl eingeben"
                        >

                        <button>
                        Befehl senden
                        </button>

                    </form>

                </div>

<script>

const consoleBox =
    document.getElementById(
        "console"
    );

const command =
    document.getElementById(
        "command"
    );

document
    .getElementById(
        "commandForm"
    )
    .addEventListener(
        "submit",
        async e => {

            e.preventDefault();

            const value =
                command.value.trim();

            if (!value) return;

            const response =
                await fetch(
                    "/api/server/${server.id}/command",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                command:
                                    value
                            })
                    }
                );

            const data =
                await response.json();

            if (!data.ok) {
                alert(
                    data.message ||
                    "Fehler"
                );
                return;
            }

            command.value = "";

        }
    );

async function refresh() {

    try {

        const response =
            await fetch(
                "/api/server/${server.id}/state"
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
                data.ram +
                " MB";

        document
            .getElementById("pid")
            .textContent =
                data.pid ||
                "-";

        consoleBox.scrollTop =
            consoleBox.scrollHeight;

    } catch {}

}

setInterval(
    refresh,
    1000
);

refresh();

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
    logged,
    maintenance,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.json({
                ok: false
            });
        }

        let ram = 0;

        const child =
            processes.get(
                server.id
            );

        if (child) {

            try {

                const status =
                    fs.readFileSync(
                        `/proc/${child.pid}/status`,
                        "utf8"
                    );

                const match =
                    status.match(
                        /VmRSS:\s+(\d+)\s+kB/
                    );

                if (match) {
                    ram =
                        Math.round(
                            Number(
                                match[1]
                            ) / 1024
                        );
                }

            } catch {}

        }

        res.json({
            ok: true,
            status:
                server.status,
            console:
                server.console || "",
            pid:
                server.pid,
            ram
        });
    }
);

app.post(
    "/api/server/:id/command",
    logged,
    maintenance,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.status(403).json({
                ok: false,
                message:
                    "Kein Zugriff."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.json({
                ok: false,
                message:
                    "Server läuft nicht."
            });
        }

        const command =
            String(
                req.body.command || ""
            ).trim();

        if (!command) {
            return res.json({
                ok: false,
                message:
                    "Kein Befehl."
            });
        }

        try {

            child.stdin.write(
                command + "\n"
            );

            addConsole(
                server,
                `> ${command}`
            );

            res.json({
                ok: true
            });

        } catch (error) {

            res.json({
                ok: false,
                message:
                    error.message
            });

        }
    }
);

/* =========================================================
   START / STOP / RESTART
========================================================= */

app.post(
    "/server/:id/start",
    logged,
    maintenance,
    async (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.status(404).send(
                "Nicht gefunden."
            );
        }

        await startMinecraft(
            server
        );

        res.redirect(
            `/server/${server.id}`
        );
    }
);

app.post(
    "/server/:id/stop",
    logged,
    maintenance,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.status(404).send(
                "Nicht gefunden."
            );
        }

        stopMinecraft(
            server
        );

        res.redirect(
            `/server/${server.id}`
        );
    }
);

app.post(
    "/server/:id/restart",
    logged,
    maintenance,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        const u =
            user(req);

        if (
            !server ||
            (
                server.ownerId !== u.id &&
                !admin(req)
            )
        ) {
            return res.status(404).send(
                "Nicht gefunden."
            );
        }

        stopMinecraft(
            server
        );

        setTimeout(
            () => {
                startMinecraft(
                    server
                );
            },
            3000
        );

        res.redirect(
            `/server/${server.id}`
        );
    }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
    "/admin",
    logged,
    onlyAdmin,
    (req, res) => {

        const users =
            read(files.users);

        const orders =
            read(files.orders)
                .reverse();

        const servers =
            read(files.servers);

        const logs =
            read(files.logs);

        const settings =
            read(files.settings, {});

        const running =
            servers.filter(
                s =>
                    processes.has(
                        s.id
                    )
            ).length;

        res.send(
            html(
                req,
                "Admin Panel",
                `
                <h1>
                👑 Admin Panel
                </h1>

                <div class="grid">

                    <div class="card">
                        <h3>Benutzer</h3>
                        <div class="metric">
                        ${users.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>Server</h3>
                        <div class="metric">
                        ${servers.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>Laufend</h3>
                        <div class="metric">
                        ${running}
                        </div>
                    </div>

                    <div class="card">
                        <h3>CPU</h3>
                        <div id="cpu"
                             class="metric">
                        ${os.loadavg()[0].toFixed(2)}
                        </div>
                    </div>

                </div>

                <div class="card">

                    <h2>
                    🔧 Wartung
                    </h2>

                    <form
                        method="POST"
                        action="/admin/maintenance">

                        <textarea
                            name="message">${esc(
                                settings.maintenanceMessage ||
                                ""
                            )}</textarea>

                        <div class="actions">

                            <button
                                name="action"
                                value="on">

                                🔧 Wartung AN
                                + alle Server stoppen

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
                            ? orders.map(
                                o => `
                                <div class="card">

                                    <b>
                                    ${esc(
                                        o.orderNumber
                                    )}
                                    </b>

                                    <p>
                                    Server:
                                    ${esc(
                                        o.serverName
                                    )}
                                    </p>

                                    <p>
                                    Kunde:
                                    ${esc(
                                        o.email
                                    )}
                                    </p>

                                    <p>
                                    Preis:
                                    ${o.price.toFixed(2)}
                                    €
                                    </p>

                                    <span
                                        class="status ${o.status}">

                                        ${esc(
                                            o.status
                                        )}

                                    </span>

                                    ${
                                        o.status ===
                                        "pending"
                                            ? `
                                            <div
                                                class="actions">

                                                <form
                                                    method="POST"
                                                    action="/admin/order/${o.id}/accept">

                                                    <button>
                                                    ✅ Annehmen
                                                    </button>

                                                </form>

                                                <form
                                                    method="POST"
                                                    action="/admin/order/${o.id}/reject">

                                                    <button
                                                        class="red">

                                                        ❌ Ablehnen

                                                    </button>

                                                </form>

                                            </div>
                                            `
                                            : ""
                                    }

                                </div>
                                `
                            ).join("")
                            : "<p>Keine Bestellungen.</p>"
                    }

                </div>

                <div class="card">

                    <h2>
                    🖥 Alle Server
                    </h2>

                    ${
                        servers.length
                            ? servers.map(
                                s => `
                                <div class="card">

                                    <h2>
                                    ${esc(
                                        s.name
                                    )}
                                    </h2>

                                    <p>
                                    ${esc(
                                        s.address
                                    )}
                                    </p>

                                    <span
                                        class="status ${
                                            s.status ===
                                            "running"
                                                ? "running"
                                                : "stopped"
                                        }">

                                        ${esc(
                                            s.status
                                        )}

                                    </span>

                                    <br><br>

                                    <a
                                        class="btn"
                                        href="/server/${s.id}">

                                        Konsole

                                    </a>

                                    <form
                                        style="display:inline"
                                        method="POST"
                                        action="/admin/server/${s.id}/delete"
                                        onsubmit="return confirm('Server wirklich löschen?')">

                                        <button
                                            class="red">

                                            🗑 Löschen

                                        </button>

                                    </form>

                                </div>
                                `
                            ).join("")
                            : "<p>Keine Server.</p>"
                    }

                </div>

                <div class="card">

                    <h2>
                    👥 Benutzer
                    </h2>

                    ${
                        users.map(
                            u => `
                            <div class="card">

                                <b>
                                ${esc(
                                    u.username
                                )}
                                </b>

                                <p>
                                ${esc(
                                    u.email
                                )}
                                </p>

                                ${
                                    u.email.toLowerCase() !==
                                    ADMIN_EMAIL.toLowerCase()
                                        ? `
                                        <form
                                            method="POST"
                                            action="/admin/user/${u.id}/ban">

                                            <input
                                                name="reason"
                                                placeholder="Sperrgrund"
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
                                            u.bannedUntil
                                                ? `
                                                <form
                                                    method="POST"
                                                    action="/admin/user/${u.id}/unban">

                                                    <button
                                                        class="dark">

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
                        ).join("")
                    }

                </div>

                <div class="card">

                    <h2>
                    📜 Logs
                    </h2>

                    <pre class="console">${esc(
                        logs
                            .slice(0, 300)
                            .map(
                                x =>
                                    `[${x.time}] [${x.type}] ${x.message}`
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
   ADMIN ORDER ACCEPT
========================================================= */

app.post(
    "/admin/order/:id/accept",
    logged,
    onlyAdmin,
    (req, res) => {

        const orders =
            read(files.orders);

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

        const server = {
            id: id("server"),

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

            port:
                freePort(),

            address:
                `${
                    process.env.MINECRAFT_HOST ||
                    "localhost"
                }:${freePort()}`,

            ramMB:
                Number(
                    process.env.SERVER_RAM_MB ||
                    5120
                ),

            status:
                "stopped",

            pid:
                null,

            console:
                "",

            createdAt:
                new Date().toISOString()
        };

        /*
         * Port muss identisch sein.
         */
        server.address =
            `${
                process.env.MINECRAFT_HOST ||
                "localhost"
            }:${server.port}`;

        const servers =
            read(files.servers);

        servers.push(
            server
        );

        write(
            files.servers,
            servers
        );

        order.status =
            "accepted";

        order.reviewedAt =
            new Date().toISOString();

        write(
            files.orders,
            orders
        );

        log(
            "ORDER_ACCEPTED",
            `${order.orderNumber} -> ${server.address}`
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN ORDER REJECT
========================================================= */

app.post(
    "/admin/order/:id/reject",
    logged,
    onlyAdmin,
    (req, res) => {

        const orders =
            read(files.orders);

        const order =
            orders.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (order) {

            order.status =
                "rejected";

            order.reviewedAt =
                new Date().toISOString();

            write(
                files.orders,
                orders
            );

            log(
                "ORDER_REJECTED",
                order.orderNumber
            );
        }

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   ADMIN DELETE
========================================================= */

app.post(
    "/admin/server/:id/delete",
    logged,
    onlyAdmin,
    (req, res) => {

        const server =
            getServer(
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
            read(files.servers)
                .filter(
                    x =>
                        x.id !==
                        server.id
                );

        write(
            files.servers,
            servers
        );

        try {
            fs.rmSync(
                serverPath(server),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}

        log(
            "SERVER_DELETE",
            server.name
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   MAINTENANCE
========================================================= */

app.post(
    "/admin/maintenance",
    logged,
    onlyAdmin,
    (req, res) => {

        const settings =
            read(
                files.settings,
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

        write(
            files.settings,
            settings
        );

        if (
            settings.maintenance
        ) {

            const servers =
                read(files.servers);

            for (
                const server
                of servers
            ) {

                if (
                    processes.has(
                        server.id
                    )
                ) {
                    stopMinecraft(
                        server
                    );
                }

            }

            log(
                "MAINTENANCE_ON",
                "Wartungsmodus aktiviert."
            );

        } else {

            log(
                "MAINTENANCE_OFF",
                "Wartungsmodus deaktiviert."
            );

        }

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   BAN
========================================================= */

function durationMs(
    value
) {

    const map = {
        "1h":
            60 *
            60 *
            1000,

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

    return (
        map[value] ||
        0
    );
}

app.post(
    "/admin/user/:id/ban",
    logged,
    onlyAdmin,
    (req, res) => {

        const users =
            read(files.users);

        const u =
            users.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!u) {
            return res.redirect(
                "/admin"
            );
        }

        if (
            u.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.status(403).send(
                "Der Hauptadministrator kann nicht gesperrt werden."
            );
        }

        u.banReason =
            String(
                req.body.reason ||
                    "Kein Grund"
            );

        if (
            req.body.duration ===
            "permanent"
        ) {
            u.bannedUntil =
                "permanent";
        } else {
            u.bannedUntil =
                new Date(
                    Date.now() +
                    durationMs(
                        req.body.duration
                    )
                ).toISOString();
        }

        write(
            files.users,
            users
        );

        log(
            "BAN",
            `${u.email}: ${u.banReason}`
        );

        res.redirect(
            "/admin"
        );
    }
);

/* =========================================================
   UNBAN
========================================================= */

app.post(
    "/admin/user/:id/unban",
    logged,
    onlyAdmin,
    (req, res) => {

        const users =
            read(files.users);

        const u =
            users.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (u) {

            u.bannedUntil =
                null;

            u.banReason =
                null;

            write(
                files.users,
                users
            );

            log(
                "UNBAN",
                u.email
            );
        }

        res.redirect(
            "/admin"
        );
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
            `Minecraft Hosting läuft auf ${PORT}`
        );

        log(
            "SYSTEM",
            `Webseite gestartet auf Port ${PORT}`
        );

    }
);

/* =========================================================
   SHUTDOWN
========================================================= */

function shutdown() {

    console.log(
        "Herunterfahren..."
    );

    const servers =
        read(files.servers);

    for (
        const server
        of servers
    ) {

        if (
            processes.has(
                server.id
            )
        ) {
            stopMinecraft(
                server
            );
        }

    }

    setTimeout(
        () => {
            process.exit(0);
        },
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
