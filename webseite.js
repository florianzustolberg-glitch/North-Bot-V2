"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const net = require("net");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET =
    process.env.SESSION_SECRET || "CHANGE_THIS_SESSION_SECRET";

const ADMIN_EMAIL = "florianzustolberg@gmail.com";

// ----------------------------------------------------
// CONFIG
// ----------------------------------------------------

const HOST_ADDRESS =
    process.env.HOST_ADDRESS || "localhost";

const PUBLIC_HOST =
    process.env.PUBLIC_HOST || "localhost";

const MIN_MINECRAFT_PORT =
    Number(process.env.MIN_MINECRAFT_PORT || 25565);

const MAX_MINECRAFT_PORT =
    Number(process.env.MAX_MINECRAFT_PORT || 25650);

const JAVA_COMMAND =
    process.env.JAVA_COMMAND || "java";

const MEMORY_MB =
    Number(process.env.DEFAULT_MEMORY_MB || 1024);

const BASE_DIR = path.join(__dirname, "minecraft-data");

const DATA_DIR = path.join(BASE_DIR, "data");
const SERVERS_DIR = path.join(BASE_DIR, "servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

// ----------------------------------------------------
// DIRECTORIES
// ----------------------------------------------------

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVERS_DIR, { recursive: true });

// ----------------------------------------------------
// FILE HELPERS
// ----------------------------------------------------

function ensureJSON(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(defaultValue, null, 2)
        );
    }
}

ensureJSON(USERS_FILE, []);
ensureJSON(ORDERS_FILE, []);
ensureJSON(SERVERS_FILE, []);
ensureJSON(SETTINGS_FILE, {
    maintenance: false,
    message: "Die Webseite befindet sich im Wartungsmodus."
});
ensureJSON(LOGS_FILE, []);

function readJSON(file, fallback) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function getUsers() {
    return readJSON(USERS_FILE, []);
}

function getOrders() {
    return readJSON(ORDERS_FILE, []);
}

function getServers() {
    return readJSON(SERVERS_FILE, []);
}

function getSettings() {
    return readJSON(SETTINGS_FILE, {
        maintenance: false,
        message: ""
    });
}

function getLogs() {
    return readJSON(LOGS_FILE, []);
}

// ----------------------------------------------------
// LOGGING
// ----------------------------------------------------

function addSystemLog(type, message, user = "SYSTEM") {
    const data = getLogs();

    data.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        user,
        time: new Date().toISOString()
    });

    if (data.length > 2000) {
        data.length = 2000;
    }

    writeJSON(LOGS_FILE, data);

    console.log(
        `[${type}] ${user}: ${message}`
    );
}

// ----------------------------------------------------
// HTML
// ----------------------------------------------------

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function statusClass(status) {
    if (status === "running") return "running";
    if (status === "stopped") return "stopped";
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";

    return "default";
}

function layout(title, content, req) {
    let user = null;

    if (req?.session?.userId) {
        user = getUsers().find(
            u => u.id === req.session.userId
        );
    }

    const isAdmin =
        user &&
        user.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase();

    return `
<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>${escapeHTML(title)} - Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background:
        radial-gradient(
            circle at top,
            #18301e,
            #0b0b0b 55%
        );
    color: white;
    font-family:
        Arial,
        Helvetica,
        sans-serif;
    min-height: 100vh;
}

header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(8,8,8,.94);
    border-bottom:
        1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(12px);
}

.nav {
    max-width: 1200px;
    margin: auto;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
}

.logo {
    color: #62ff79;
    font-size: 20px;
    font-weight: 800;
    text-decoration: none;
}

nav {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
}

nav a {
    color: #ddd;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 9px;
}

nav a:hover {
    background: #202020;
    color: white;
}

.container {
    max-width: 1150px;
    width: calc(100% - 30px);
    margin: 35px auto;
}

.hero {
    text-align: center;
    padding: 60px 10px;
}

.hero h1 {
    font-size: clamp(36px, 7vw, 72px);
    margin-bottom: 12px;
}

.hero p {
    color: #aaa;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
}

.card {
    background: rgba(20,20,20,.94);
    border:
        1px solid rgba(255,255,255,.09);
    border-radius: 16px;
    padding: 20px;
    box-shadow:
        0 15px 40px rgba(0,0,0,.2);
}

.form {
    max-width: 500px;
    margin: 30px auto;
}

.center {
    text-align: center;
}

input,
select,
textarea {
    width: 100%;
    padding: 12px;
    margin-top: 7px;
    margin-bottom: 15px;
    border:
        1px solid #333;
    border-radius: 9px;
    background: #0e0e0e;
    color: white;
}

button,
.button {
    display: inline-block;
    border: none;
    background: #45d85b;
    color: #061008;
    padding: 11px 16px;
    border-radius: 9px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
}

button:hover,
.button:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
}

.secondary {
    background: #292929 !important;
    color: white !important;
}

.danger {
    background: #d94141 !important;
    color: white !important;
}

.warning {
    background: #d6a331 !important;
    color: #111 !important;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 800;
}

.status.running {
    background: #163b1d;
    color: #6dff83;
}

.status.stopped {
    background: #3e1919;
    color: #ff8b8b;
}

.status.pending {
    background: #493b15;
    color: #ffd65d;
}

.status.rejected {
    background: #451818;
    color: #ff8888;
}

.status.default {
    background: #333;
    color: #ddd;
}

.notice {
    background: #17331c;
    border: 1px solid #2e7138;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 15px;
}

.error {
    background: #391919;
    border-color: #7d3333;
}

.price {
    font-size: 35px;
    color: #69ff7c;
    font-weight: 800;
}

.console {
    background: #050505;
    color: #baffc1;
    border:
        1px solid #292929;
    border-radius: 12px;
    padding: 15px;
    min-height: 350px;
    max-height: 600px;
    overflow: auto;
    font-family:
        Consolas,
        "Courier New",
        monospace;
    white-space: pre-wrap;
    word-break: break-word;
}

.console-input {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.console-input input {
    margin: 0;
    flex: 1;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 11px;
    text-align: left;
    border-bottom:
        1px solid #292929;
}

.muted {
    color: #999;
}

footer {
    text-align: center;
    color: #666;
    padding: 40px;
}

@media(max-width:700px) {

    .nav {
        flex-direction: column;
    }

    nav {
        justify-content: center;
    }

    .container {
        width: calc(100% - 20px);
        margin-top: 20px;
    }

    .console-input {
        flex-direction: column;
    }

    table {
        display: block;
        overflow-x: auto;
    }

}

</style>

</head>

<body>

<header>

<div class="nav">

<a href="/" class="logo">
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
                isAdmin
                    ? `<a href="/admin">Admin</a>`
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

<footer>
Minecraft Hosting © ${new Date().getFullYear()}
</footer>

</body>

</html>
`;
}

// ----------------------------------------------------
// EXPRESS
// ----------------------------------------------------

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7
        }
    })
);

// ----------------------------------------------------
// AUTH
// ----------------------------------------------------

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const user = getUsers().find(
        u => u.id === req.session.userId
    );

    if (
        !user ||
        user.email.toLowerCase() !==
            ADMIN_EMAIL.toLowerCase()
    ) {
        return res.status(403).send(
            layout(
                "Kein Zugriff",
                `
                <div class="card center">
                    <h1>403</h1>
                    <p>Kein Zugriff.</p>
                    <a class="button" href="/">
                        Zur Startseite
                    </a>
                </div>
                `,
                req
            )
        );
    }

    next();
}

// ----------------------------------------------------
// HOME
// ----------------------------------------------------

app.get("/", (req, res) => {

    const s = getSettings();

    if (s.maintenance) {
        return res.send(
            layout(
                "Wartung",
                `
                <div class="hero">

                    <h1>🔧 Wartung</h1>

                    <p>
                        ${escapeHTML(s.message)}
                    </p>

                </div>
                `,
                req
            )
        );
    }

    res.send(
        layout(
            "Home",
            `
            <section class="hero">

                <h1>⛏ Minecraft Hosting</h1>

                <p>
                    Echte Minecraft-Server,
                    echte Konsole und automatische Ports.
                </p>

                <div class="actions"
                     style="justify-content:center">

                    <a
                        class="button"
                        href="/register"
                    >
                        Account erstellen
                    </a>

                    <a
                        class="button secondary"
                        href="/order"
                    >
                        Server bestellen
                    </a>

                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h2>🟢 1 Server kostenlos</h2>
                    <p>
                        Der erste Server ist kostenlos.
                    </p>
                </div>

                <div class="card">
                    <h2>💶 Weitere Server</h2>
                    <p>
                        Jeder weitere Server kostet 5 €.
                    </p>
                </div>

                <div class="card">
                    <h2>🖥 Echte Konsole</h2>
                    <p>
                        Die Konsole zeigt die tatsächlichen
                        Minecraft-Logs.
                    </p>
                </div>

                <div class="card">
                    <h2>🌐 Automatischer Port</h2>
                    <p>
                        Jeder Server bekommt automatisch
                        einen freien Minecraft-Port.
                    </p>
                </div>

            </div>
            `,
            req
        )
    );
});

// ----------------------------------------------------
// REGISTER
// ----------------------------------------------------

app.get("/register", (req, res) => {

    res.send(
        layout(
            "Registrieren",
            `
            <div class="card form">

                <h2>Registrieren</h2>

                <form method="POST"
                      action="/register">

                    <label>Benutzername</label>

                    <input
                        name="username"
                        required
                        minlength="3"
                        maxlength="30"
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
                        required
                        minlength="6"
                    >

                    <button type="submit">
                        Registrieren
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/register", async (req, res) => {

    const username =
        String(req.body.username || "").trim();

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    if (
        username.length < 3 ||
        !email ||
        password.length < 6
    ) {
        return res.status(400).send(
            layout(
                "Fehler",
                `
                <div class="card error">
                    Ungültige Eingaben.
                </div>
                `,
                req
            )
        );
    }

    const data = getUsers();

    if (
        data.some(
            u =>
                u.email.toLowerCase() ===
                email
        )
    ) {
        return res.status(400).send(
            layout(
                "Fehler",
                `
                <div class="card error">
                    E-Mail bereits registriert.
                </div>
                `,
                req
            )
        );
    }

    if (
        data.some(
            u =>
                u.username.toLowerCase() ===
                username.toLowerCase()
        )
    ) {
        return res.status(400).send(
            layout(
                "Fehler",
                `
                <div class="card error">
                    Benutzername bereits vergeben.
                </div>
                `,
                req
            )
        );
    }

    const passwordHash =
        await bcrypt.hash(password, 12);

    data.push({
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash,
        createdAt:
            new Date().toISOString()
    });

    writeJSON(USERS_FILE, data);

    addSystemLog(
        "REGISTER",
        `Benutzer registriert: ${username}`,
        username
    );

    res.redirect("/login?registered=1");
});

// ----------------------------------------------------
// LOGIN
// ----------------------------------------------------

app.get("/login", (req, res) => {

    const success =
        req.query.registered === "1";

    res.send(
        layout(
            "Anmelden",
            `
            <div class="card form">

                ${
                    success
                        ? `
                        <div class="notice">
                            Registrierung erfolgreich.
                        </div>
                        `
                        : ""
                }

                <h2>Anmelden</h2>

                <form method="POST"
                      action="/login">

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

                    <button type="submit">
                        Anmelden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/login", async (req, res) => {

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const user = getUsers().find(
        u =>
            u.email.toLowerCase() ===
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
            layout(
                "Fehler",
                `
                <div class="card error">
                    E-Mail oder Passwort falsch.
                    <br><br>
                    <a class="button"
                       href="/login">
                        Zurück
                    </a>
                </div>
                `,
                req
            )
        );
    }

    req.session.userId = user.id;

    addSystemLog(
        "LOGIN",
        `Login: ${user.username}`,
        user.username
    );

    res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/");
    });

});

// ----------------------------------------------------
// DASHBOARD
// ----------------------------------------------------

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {

        const user = getUsers().find(
            u =>
                u.id ===
                req.session.userId
        );

        const myServers =
            getServers().filter(
                s =>
                    s.ownerId ===
                    user.id
            );

        const myOrders =
            getOrders()
                .filter(
                    o =>
                        o.userId ===
                        user.id
                )
                .sort(
                    (a, b) =>
                        new Date(b.createdAt) -
                        new Date(a.createdAt)
                );

        res.send(
            layout(
                "Dashboard",
                `
                <h1>
                    👋 Hallo
                    ${escapeHTML(user.username)}
                </h1>

                <div class="grid">

                    <div class="card">
                        <h3>Server</h3>
                        <div class="price">
                            ${myServers.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>Bestellungen</h3>
                        <div class="price">
                            ${myOrders.length}
                        </div>
                    </div>

                </div>

                <br>

                <div class="card">

                    <h2>🖥 Deine Server</h2>

                    ${
                        myServers.length === 0
                            ? `
                            <p class="muted">
                                Noch kein Server.
                            </p>
                            `
                            :
                            myServers
                                .map(
                                    s => `
                                    <div class="card">

                                        <h3>
                                            ${escapeHTML(
                                                s.name
                                            )}
                                        </h3>

                                        <p>
                                            IP:
                                            <strong>
                                                ${escapeHTML(
                                                    s.address
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Status:
                                            <span class="status ${
                                                statusClass(
                                                    s.status
                                                )
                                            }">
                                                ${escapeHTML(
                                                    s.status
                                                )}
                                            </span>
                                        </p>

                                        <a
                                            class="button"
                                            href="/server/${
                                                encodeURIComponent(
                                                    s.id
                                                )
                                            }"
                                        >
                                            Verwalten
                                        </a>

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>

                <br>

                <div class="card">

                    <h2>📦 Bestellungen</h2>

                    ${
                        myOrders.length === 0
                            ? `
                            <p class="muted">
                                Keine Bestellungen.
                            </p>
                            `
                            :
                            `
                            <table>

                                <tr>
                                    <th>Bestellung</th>
                                    <th>Server</th>
                                    <th>Preis</th>
                                    <th>Status</th>
                                </tr>

                                ${myOrders
                                    .map(
                                        o => `
                                        <tr>

                                            <td>
                                                ${escapeHTML(
                                                    o.orderNumber
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    o.serverName
                                                )}
                                            </td>

                                            <td>
                                                ${o.price.toFixed(
                                                    2
                                                )} €
                                            </td>

                                            <td>
                                                <span class="status ${
                                                    statusClass(
                                                        o.status
                                                    )
                                                }">
                                                    ${escapeHTML(
                                                        o.status
                                                    )}
                                                </span>
                                            </td>

                                        </tr>
                                        `
                                    )
                                    .join("")}

                            </table>
                            `
                    }

                </div>
                `,
                req
            )
        );
    }
);

// ----------------------------------------------------
// ORDER
// ----------------------------------------------------

app.get(
    "/order",
    requireLogin,
    (req, res) => {

        const user = getUsers().find(
            u =>
                u.id ===
                req.session.userId
        );

        const amount =
            getServers().filter(
                s =>
                    s.ownerId ===
                    user.id
            ).length;

        const price =
            amount === 0
                ? 0
                : 5;

        res.send(
            layout(
                "Server bestellen",
                `
                <div class="card form">

                    <h2>
                        ⛏ Minecraft-Server bestellen
                    </h2>

                    <div class="notice">

                        ${
                            price === 0
                                ? "🎉 Dein erster Server ist kostenlos."
                                : "💶 Dieser Server kostet 5 €."
                        }

                    </div>

                    <form
                        method="POST"
                        action="/order"
                    >

                        <label>
                            Servername
                        </label>

                        <input
                            name="serverName"
                            required
                            maxlength="40"
                            placeholder="Mein Server"
                        >

                        <label>
                            Minecraft-Version
                        </label>

                        <select name="version">

                            <option value="1.21.8">
                                1.21.8
                            </option>

                            <option value="1.21.6">
                                1.21.6
                            </option>

                            <option value="1.21.5">
                                1.21.5
                            </option>

                            <option value="1.21.4">
                                1.21.4
                            </option>

                            <option value="1.20.6">
                                1.20.6
                            </option>

                        </select>

                        <p>
                            Preis:
                            <strong>
                                ${price.toFixed(2)} €
                            </strong>
                        </p>

                        <button type="submit">
                            Bestellung absenden
                        </button>

                    </form>

                </div>
                `,
                req
            )
        );
    }
);

app.post(
    "/order",
    requireLogin,
    (req, res) => {

        const user = getUsers().find(
            u =>
                u.id ===
                req.session.userId
        );

        const serverName =
            String(
                req.body.serverName || ""
            ).trim();

        const version =
            String(
                req.body.version || "1.21.8"
            ).trim();

        if (!serverName) {
            return res.status(400).send(
                "Servername fehlt."
            );
        }

        const count =
            getServers().filter(
                s =>
                    s.ownerId ===
                    user.id
            ).length;

        const price =
            count === 0
                ? 0
                : 5;

        const order = {
            id: crypto.randomUUID(),

            orderNumber:
                "MC-" +
                Date.now().toString(36).toUpperCase() +
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

            price,

            status: "pending",

            createdAt:
                new Date().toISOString(),

            reviewedAt: null
        };

        const data =
            getOrders();

        data.push(order);

        writeJSON(
            ORDERS_FILE,
            data
        );

        addSystemLog(
            "ORDER",
            `Neue Bestellung ${order.orderNumber}`,
            user.username
        );

        res.send(
            layout(
                "Bestellung",
                `
                <div class="card center">

                    <h1>
                        ✅ Bestellung erstellt
                    </h1>

                    <div class="notice">

                        <strong>
                            Bestellnummer:
                        </strong>

                        <br><br>

                        ${escapeHTML(
                            order.orderNumber
                        )}

                    </div>

                    <p>
                        Ein Admin muss die Bestellung
                        zuerst annehmen.
                    </p>

                    <a
                        class="button"
                        href="/dashboard"
                    >
                        Dashboard
                    </a>

                </div>
                `,
                req
            )
        );
    }
);

// ----------------------------------------------------
// PORT CHECK
// ----------------------------------------------------

function isPortFree(port) {

    return new Promise(resolve => {

        const server =
            net.createServer();

        server.once(
            "error",
            () => {
                resolve(false);
            }
        );

        server.once(
            "listening",
            () => {

                server.close(
                    () => resolve(true)
                );

            }
        );

        server.listen(
            port,
            "0.0.0.0"
        );

    });

}

async function findFreePort() {

    const used =
        new Set(
            getServers()
                .map(
                    s =>
                        Number(s.port)
                )
                .filter(Boolean)
        );

    for (
        let port =
            MIN_MINECRAFT_PORT;
        port <= MAX_MINECRAFT_PORT;
        port++
    ) {

        if (used.has(port)) {
            continue;
        }

        if (
            await isPortFree(port)
        ) {
            return port;
        }

    }

    throw new Error(
        "Kein freier Minecraft-Port verfügbar."
    );
}

// ----------------------------------------------------
// MINECRAFT DOWNLOAD
// ----------------------------------------------------

async function downloadMinecraftJar(
    version,
    destination
) {

    const manifestURL =
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

    const manifestResponse =
        await fetch(
            manifestURL
        );

    if (!manifestResponse.ok) {
        throw new Error(
            "Minecraft-Versionen konnten nicht geladen werden."
        );
    }

    const manifest =
        await manifestResponse.json();

    const versionInfo =
        manifest.versions.find(
            v =>
                v.id ===
                version
        );

    if (!versionInfo) {
        throw new Error(
            `Minecraft-Version ${version} wurde nicht gefunden.`
        );
    }

    const versionResponse =
        await fetch(
            versionInfo.url
        );

    if (!versionResponse.ok) {
        throw new Error(
            "Minecraft-Versionsdaten konnten nicht geladen werden."
        );
    }

    const versionData =
        await versionResponse.json();

    const jarURL =
        versionData.downloads?.server?.url;

    if (!jarURL) {
        throw new Error(
            "Für diese Version wurde kein Server-JAR gefunden."
        );
    }

    const response =
        await fetch(jarURL);

    if (!response.ok) {
        throw new Error(
            `Minecraft-JAR konnte nicht heruntergeladen werden. HTTP ${response.status}`
        );
    }

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    fs.writeFileSync(
        destination,
        buffer
    );

    return destination;
}

// ----------------------------------------------------
// SERVER PROCESS MANAGER
// ----------------------------------------------------

const processes =
    new Map();

const liveClients =
    new Map();

function getServerById(id) {

    return getServers().find(
        s =>
            s.id === id
    );

}

function saveServer(server) {

    const data =
        getServers();

    const index =
        data.findIndex(
            s =>
                s.id ===
                server.id
        );

    if (index === -1) {
        return;
    }

    data[index] =
        server;

    writeJSON(
        SERVERS_FILE,
        data
    );

}

function appendServerLog(
    server,
    text
) {

    const line =
        `[${new Date().toISOString()}] ${text}`;

    server.console =
        (server.console || "") +
        line +
        "\n";

    if (
        server.console.length >
        50000
    ) {
        server.console =
            server.console.slice(
                -50000
            );
    }

    saveServer(server);

    const clients =
        liveClients.get(
            server.id
        );

    if (clients) {

        for (
            const res of clients
        ) {

            res.write(
                `data: ${JSON.stringify({
                    type: "log",
                    text: line
                })}\n\n`
            );

        }

    }

}

function broadcastStatus(
    server
) {

    const clients =
        liveClients.get(
            server.id
        );

    if (!clients) {
        return;
    }

    for (
        const res of clients
    ) {

        res.write(
            `data: ${JSON.stringify({
                type: "status",
                status: server.status
            })}\n\n`
        );

    }

}

// ----------------------------------------------------
// START REAL MINECRAFT SERVER
// ----------------------------------------------------

async function startMinecraftServer(
    server
) {

    if (
        processes.has(server.id)
    ) {
        return {
            ok: false,
            message: "Server läuft bereits."
        };
    }

    const serverDirectory =
        path.join(
            SERVERS_DIR,
            server.id
        );

    fs.mkdirSync(
        serverDirectory,
        {
            recursive: true
        }
    );

    const jar =
        path.join(
            serverDirectory,
            "server.jar"
        );

    appendServerLog(
        server,
        "Starte Minecraft-Server..."
    );

    if (
        !fs.existsSync(jar)
    ) {

        appendServerLog(
            server,
            `Lade Minecraft ${server.version} herunter...`
        );

        try {

            await downloadMinecraftJar(
                server.version,
                jar
            );

        } catch (error) {

            appendServerLog(
                server,
                `Download-Fehler: ${error.message}`
            );

            server.status =
                "stopped";

            saveServer(server);

            return {
                ok: false,
                message:
                    error.message
            };

        }

    }

    fs.writeFileSync(
        path.join(
            serverDirectory,
            "eula.txt"
        ),
        "eula=true\n"
    );

    fs.writeFileSync(
        path.join(
            serverDirectory,
            "server.properties"
        ),
        [
            `server-port=${server.port}`,
            `server-ip=`,
            "enable-rcon=false",
            "online-mode=true",
            "motd=My Minecraft Server",
            "enable-command-block=true",
            "spawn-protection=0",
            "view-distance=10",
            "simulation-distance=10"
        ].join("\n") +
            "\n"
    );

    const javaArgs = [
        `-Xms${server.memory}M`,
        `-Xmx${server.memory}M`,
        "-jar",
        "server.jar",
        "nogui"
    ];

    let child;

    try {

        child =
            spawn(
                JAVA_COMMAND,
                javaArgs,
                {
                    cwd:
                        serverDirectory,

                    stdio: [
                        "pipe",
                        "pipe",
                        "pipe"
                    ]
                }
            );

    } catch (error) {

        appendServerLog(
            server,
            `Java konnte nicht gestartet werden: ${error.message}`
        );

        return {
            ok: false,
            message:
                error.message
        };

    }

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

    saveServer(server);

    broadcastStatus(server);

    child.stdout.on(
        "data",
        data => {

            const text =
                data.toString();

            appendServerLog(
                server,
                text.trimEnd()
            );

        }
    );

    child.stderr.on(
        "data",
        data => {

            const text =
                data.toString();

            appendServerLog(
                server,
                text.trimEnd()
            );

        }
    );

    child.on(
        "error",
        error => {

            appendServerLog(
                server,
                `Java-Prozess Fehler: ${error.message}`
            );

            processes.delete(
                server.id
            );

            server.status =
                "stopped";

            server.pid =
                null;

            saveServer(server);

            broadcastStatus(server);

        }
    );

    child.on(
        "close",
        code => {

            appendServerLog(
                server,
                `Minecraft-Prozess beendet. Exit-Code: ${code}`
            );

            processes.delete(
                server.id
            );

            server.status =
                "stopped";

            server.pid =
                null;

            saveServer(server);

            broadcastStatus(server);

        }
    );

    appendServerLog(
        server,
        `Minecraft-Prozess gestartet. PID: ${child.pid}`
    );

    return {
        ok: true
    };

}

// ----------------------------------------------------
// STOP REAL MINECRAFT SERVER
// ----------------------------------------------------

function stopMinecraftServer(
    server
) {

    const child =
        processes.get(
            server.id
        );

    if (!child) {

        server.status =
            "stopped";

        server.pid =
            null;

        saveServer(server);

        return {
            ok: true,
            message:
                "Server läuft nicht."
        };

    }

    try {

        child.stdin.write(
            "stop\n"
        );

    } catch {
        // ignored
    }

    setTimeout(
        () => {

            if (
                processes.has(
                    server.id
                )
            ) {

                try {
                    child.kill(
                        "SIGTERM"
                    );
                } catch {}

            }

        },
        15000
    );

    return {
        ok: true
    };

}

// ----------------------------------------------------
// SEND MINECRAFT COMMAND
// ----------------------------------------------------

function sendMinecraftCommand(
    server,
    command
) {

    const child =
        processes.get(
            server.id
        );

    if (!child) {
        return {
            ok: false,
            message:
                "Der Server läuft nicht."
        };
    }

    const clean =
        String(command || "")
            .trim();

    if (!clean) {
        return {
            ok: false,
            message:
                "Kein Befehl."
        };
    }

    try {

        child.stdin.write(
            clean + "\n"
        );

        appendServerLog(
            server,
            `> ${clean}`
        );

        return {
            ok: true
        };

    } catch (error) {

        return {
            ok: false,
            message:
                error.message
        };

    }

}

// ----------------------------------------------------
// SERVER PAGE
// ----------------------------------------------------

app.get(
    "/server/:id",
    requireLogin,
    (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        if (
            server.ownerId !==
            req.session.userId
        ) {

            const user =
                getUsers().find(
                    u =>
                        u.id ===
                        req.session.userId
                );

            if (
                !user ||
                user.email.toLowerCase() !==
                    ADMIN_EMAIL.toLowerCase()
            ) {
                return res.status(403).send(
                    "Kein Zugriff."
                );
            }

        }

        res.send(
            layout(
                server.name,
                `
                <div class="card">

                    <h1>
                        ⛏ ${escapeHTML(
                            server.name
                        )}
                    </h1>

                    <p>
                        <strong>Adresse:</strong>
                        <br>
                        ${escapeHTML(
                            server.address
                        )}
                    </p>

                    <p>
                        <strong>Version:</strong>
                        ${escapeHTML(
                            server.version
                        )}
                    </p>

                    <p>
                        <strong>Port:</strong>
                        ${server.port}
                    </p>

                    <p>
                        <strong>Status:</strong>

                        <span
                            id="status"
                            class="status ${
                                statusClass(
                                    server.status
                                )
                            }"
                        >
                            ${escapeHTML(
                                server.status
                            )}
                        </span>

                    </p>

                    <div class="actions">

                        <form
                            method="POST"
                            action="/server/${
                                encodeURIComponent(
                                    server.id
                                )
                            }/start"
                        >
                            <button>
                                ▶ Start
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/server/${
                                encodeURIComponent(
                                    server.id
                                )
                            }/stop"
                        >
                            <button class="secondary">
                                ⏹ Stop
                            </button>
                        </form>

                    </div>

                </div>

                <br>

                <div class="card">

                    <h2>🖥 Minecraft-Konsole</h2>

                    <pre
                        id="console"
                        class="console"
                    >${escapeHTML(
                        server.console ||
                        "Keine Logs vorhanden."
                    )}</pre>

                    <div class="console-input">

                        <input
                            id="command"
                            placeholder="Minecraft-Befehl, z.B. say Hallo"
                            autocomplete="off"
                        >

                        <button
                            type="button"
                            onclick="sendCommand()"
                        >
                            Senden
                        </button>

                    </div>

                </div>

<script>

const consoleElement =
    document.getElementById("console");

const commandElement =
    document.getElementById("command");

const statusElement =
    document.getElementById("status");

const eventSource =
    new EventSource(
        "/server/${encodeURIComponent(
            server.id
        )}/events"
    );

eventSource.onmessage =
    function(event) {

        const data =
            JSON.parse(event.data);

        if (
            data.type === "log"
        ) {

            consoleElement.textContent +=
                data.text + "\\n";

            consoleElement.scrollTop =
                consoleElement.scrollHeight;

        }

        if (
            data.type === "status"
        ) {

            statusElement.textContent =
                data.status;

            statusElement.className =
                "status " +
                (
                    data.status === "running"
                        ? "running"
                        : "stopped"
                );

        }

    };

function sendCommand() {

    const command =
        commandElement.value.trim();

    if (!command) {
        return;
    }

    fetch(
        "/api/server/${encodeURIComponent(
            server.id
        )}/command",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({
                    command
                })
        }
    )
    .then(
        response =>
            response.json()
    )
    .then(
        data => {

            if (!data.ok) {
                alert(
                    data.message ||
                    "Fehler"
                );
                return;
            }

            commandElement.value = "";

        }
    );

}

commandElement.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter"
        ) {
            sendCommand();
        }

    }
);

</script>
                `,
                req
            )
        );
    }
);

// ----------------------------------------------------
// LIVE SERVER EVENTS
// ----------------------------------------------------

app.get(
    "/server/:id/events",
    requireLogin,
    (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).end();
        }

        const user =
            getUsers().find(
                u =>
                    u.id ===
                    req.session.userId
            );

        const allowed =
            server.ownerId ===
                req.session.userId ||
            (
                user &&
                user.email.toLowerCase() ===
                    ADMIN_EMAIL.toLowerCase()
            );

        if (!allowed) {
            return res.status(403).end();
        }

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.flushHeaders();

        if (
            !liveClients.has(
                server.id
            )
        ) {

            liveClients.set(
                server.id,
                new Set()
            );

        }

        const clients =
            liveClients.get(
                server.id
            );

        clients.add(res);

        res.write(
            `data: ${JSON.stringify({
                type: "status",
                status: server.status
            })}\n\n`
        );

        const keepAlive =
            setInterval(
                () => {
                    res.write(": ping\n\n");
                },
                15000
            );

        req.on(
            "close",
            () => {

                clearInterval(
                    keepAlive
                );

                clients.delete(
                    res
                );

            }
        );

    }
);

// ----------------------------------------------------
// START API
// ----------------------------------------------------

app.post(
    "/server/:id/start",
    requireLogin,
    async (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        if (
            server.ownerId !==
            req.session.userId
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        const result =
            await startMinecraftServer(
                server
            );

        if (!result.ok) {
            return res.status(400).send(
                result.message
            );
        }

        addSystemLog(
            "SERVER_START",
            `Server gestartet: ${server.name}`
        );

        res.redirect(
            `/server/${encodeURIComponent(
                server.id
            )}`
        );

    }
);

// ----------------------------------------------------
// STOP API
// ----------------------------------------------------

app.post(
    "/server/:id/stop",
    requireLogin,
    (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        if (
            server.ownerId !==
            req.session.userId
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        stopMinecraftServer(
            server
        );

        addSystemLog(
            "SERVER_STOP",
            `Server gestoppt: ${server.name}`
        );

        res.redirect(
            `/server/${encodeURIComponent(
                server.id
            )}`
        );

    }
);

// ----------------------------------------------------
// COMMAND API
// ----------------------------------------------------

app.post(
    "/api/server/:id/command",
    requireLogin,
    (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                ok: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const user =
            getUsers().find(
                u =>
                    u.id ===
                    req.session.userId
            );

        const allowed =
            server.ownerId ===
                req.session.userId ||
            (
                user &&
                user.email.toLowerCase() ===
                    ADMIN_EMAIL.toLowerCase()
            );

        if (!allowed) {
            return res.status(403).json({
                ok: false,
                message:
                    "Kein Zugriff."
            });
        }

        const result =
            sendMinecraftCommand(
                server,
                req.body.command
            );

        res.json(result);

    }
);

// ----------------------------------------------------
// ADMIN PANEL
// ----------------------------------------------------

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        const allOrders =
            getOrders().sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

        const allServers =
            getServers();

        const pending =
            allOrders.filter(
                o =>
                    o.status ===
                    "pending"
            );

        const s =
            getSettings();

        res.send(
            layout(
                "Admin Panel",
                `
                <h1>🛠 Admin Panel</h1>

                <div class="grid">

                    <div class="card">
                        <h3>
                            Offene Bestellungen
                        </h3>

                        <div class="price">
                            ${pending.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>
                            Minecraft-Server
                        </h3>

                        <div class="price">
                            ${allServers.length}
                        </div>
                    </div>

                </div>

                <br>

                <div class="card">

                    <h2>
                        📦 Bestellungen
                    </h2>

                    ${
                        allOrders.length === 0
                            ? `
                            <p>
                                Keine Bestellungen.
                            </p>
                            `
                            :
                            allOrders
                                .map(
                                    o => `
                                    <div class="card">

                                        <h3>
                                            ${escapeHTML(
                                                o.serverName
                                            )}
                                        </h3>

                                        <p>
                                            Bestellnummer:
                                            <strong>
                                                ${escapeHTML(
                                                    o.orderNumber
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Kunde:
                                            ${escapeHTML(
                                                o.username
                                            )}
                                            –
                                            ${escapeHTML(
                                                o.email
                                            )}
                                        </p>

                                        <p>
                                            Version:
                                            ${escapeHTML(
                                                o.version
                                            )}
                                        </p>

                                        <p>
                                            Preis:
                                            ${o.price.toFixed(
                                                2
                                            )} €
                                        </p>

                                        <p>
                                            Status:

                                            <span
                                                class="status ${
                                                    statusClass(
                                                        o.status
                                                    )
                                                }"
                                            >
                                                ${escapeHTML(
                                                    o.status
                                                )}
                                            </span>
                                        </p>

                                        ${
                                            o.status ===
                                            "pending"
                                                ? `
                                                <div
                                                    class="actions"
                                                >

                                                    <form
                                                        method="POST"
                                                        action="/admin/order/${
                                                            encodeURIComponent(
                                                                o.id
                                                            )
                                                        }/accept"
                                                    >
                                                        <button>
                                                            ✅ Annehmen
                                                        </button>
                                                    </form>

                                                    <form
                                                        method="POST"
                                                        action="/admin/order/${
                                                            encodeURIComponent(
                                                                o.id
                                                            )
                                                        }/reject"
                                                    >
                                                        <button
                                                            class="danger"
                                                        >
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
                    }

                </div>

                <br>

                <div class="card">

                    <h2>
                        🖥 Alle Minecraft-Server
                    </h2>

                    ${
                        allServers.length === 0
                            ? `
                            <p>
                                Noch keine Server.
                            </p>
                            `
                            :
                            allServers
                                .map(
                                    s => `
                                    <div class="card">

                                        <h3>
                                            ${escapeHTML(
                                                s.name
                                            )}
                                        </h3>

                                        <p>
                                            Besitzer:
                                            ${escapeHTML(
                                                s.username
                                            )}
                                        </p>

                                        <p>
                                            IP:
                                            <strong>
                                                ${escapeHTML(
                                                    s.address
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Status:
                                            <span
                                                class="status ${
                                                    statusClass(
                                                        s.status
                                                    )
                                                }"
                                            >
                                                ${escapeHTML(
                                                    s.status
                                                )}
                                            </span>
                                        </p>

                                        <a
                                            class="button"
                                            href="/server/${
                                                encodeURIComponent(
                                                    s.id
                                                )
                                            }"
                                        >
                                            Konsole
                                        </a>

                                        <div
                                            class="actions"
                                        >

                                            <form
                                                method="POST"
                                                action="/admin/server/${
                                                    encodeURIComponent(
                                                        s.id
                                                    )
                                                }/start"
                                            >
                                                <button>
                                                    ▶ Start
                                                </button>
                                            </form>

                                            <form
                                                method="POST"
                                                action="/admin/server/${
                                                    encodeURIComponent(
                                                        s.id
                                                    )
                                                }/stop"
                                            >
                                                <button
                                                    class="secondary"
                                                >
                                                    ⏹ Stop
                                                </button>
                                            </form>

                                        </div>

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>

                <br>

                <div class="card">

                    <h2>
                        🔧 Wartungsmodus
                    </h2>

                    <p>
                        Status:
                        ${
                            s.maintenance
                                ? "AKTIV"
                                : "AUS"
                        }
                    </p>

                    <form
                        method="POST"
                        action="/admin/maintenance"
                    >

                        <textarea
                            name="message"
                            rows="4"
                        >${escapeHTML(
                            s.message
                        )}</textarea>

                        <div
                            class="actions"
                        >

                            <button
                                name="action"
                                value="on"
                            >
                                Wartung aktivieren
                            </button>

                            <button
                                name="action"
                                value="off"
                                class="secondary"
                            >
                                Wartung deaktivieren
                            </button>

                        </div>

                    </form>

                </div>

                <br>

                <div class="card">

                    <h2>
                        📜 System-Logs
                    </h2>

                    <pre class="console">${
                        getLogs()
                            .slice(0, 300)
                            .map(
                                l =>
                                    `[${l.time}] [${l.type}] ${l.user}: ${l.message}`
                            )
                            .join("\n")
                    }</pre>

                </div>
                `,
                req
            )
        );

    }
);

// ----------------------------------------------------
// ACCEPT ORDER
// ----------------------------------------------------

app.post(
    "/admin/order/:id/accept",
    requireAdmin,
    async (req, res) => {

        const orderData =
            getOrders();

        const order =
            orderData.find(
                o =>
                    o.id ===
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

        try {

            const port =
                await findFreePort();

            const serverId =
                "srv-" +
                crypto
                    .randomBytes(6)
                    .toString("hex");

            const server = {
                id: serverId,

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
                    `${PUBLIC_HOST}:${port}`,

                memory:
                    MEMORY_MB,

                status:
                    "stopped",

                pid:
                    null,

                console:
                    "",

                createdAt:
                    new Date().toISOString(),

                startedAt:
                    null
            };

            const serverData =
                getServers();

            serverData.push(
                server
            );

            writeJSON(
                SERVERS_FILE,
                serverData
            );

            order.status =
                "accepted";

            order.reviewedAt =
                new Date().toISOString();

            saveOrders(
                orderData
            );

            addSystemLog(
                "ORDER_ACCEPTED",
                `Bestellung ${order.orderNumber} angenommen. Server ${server.name} erhält Port ${port}.`
            );

            res.redirect(
                "/admin"
            );

        } catch (error) {

            console.error(error);

            return res.status(500).send(
                `
                Fehler beim Annehmen:
                ${escapeHTML(
                    error.message
                )}
                `
            );

        }

    }
);

// ----------------------------------------------------
// REJECT ORDER
// ----------------------------------------------------

app.post(
    "/admin/order/:id/reject",
    requireAdmin,
    (req, res) => {

        const data =
            getOrders();

        const order =
            data.find(
                o =>
                    o.id ===
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
            ORDERS_FILE,
            data
        );

        addSystemLog(
            "ORDER_REJECTED",
            `Bestellung ${order.orderNumber} abgelehnt.`
        );

        res.redirect(
            "/admin"
        );

    }
);

// ----------------------------------------------------
// ADMIN START
// ----------------------------------------------------

app.post(
    "/admin/server/:id/start",
    requireAdmin,
    async (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        await startMinecraftServer(
            server
        );

        addSystemLog(
            "ADMIN_START",
            `Admin startete ${server.name}`
        );

        res.redirect(
            `/server/${encodeURIComponent(
                server.id
            )}`
        );

    }
);

// ----------------------------------------------------
// ADMIN STOP
// ----------------------------------------------------

app.post(
    "/admin/server/:id/stop",
    requireAdmin,
    (req, res) => {

        const server =
            getServerById(
                req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        stopMinecraftServer(
            server
        );

        addSystemLog(
            "ADMIN_STOP",
            `Admin stoppte ${server.name}`
        );

        res.redirect(
            "/admin"
        );

    }
);

// ----------------------------------------------------
// MAINTENANCE
// ----------------------------------------------------

app.post(
    "/admin/maintenance",
    requireAdmin,
    (req, res) => {

        const data =
            getSettings();

        data.maintenance =
            req.body.action === "on";

        data.message =
            String(
                req.body.message ||
                "Die Webseite befindet sich im Wartungsmodus."
            ).trim();

        writeJSON(
            SETTINGS_FILE,
            data
        );

        addSystemLog(
            "MAINTENANCE",
            data.maintenance
                ? "Wartungsmodus aktiviert."
                : "Wartungsmodus deaktiviert."
        );

        res.redirect(
            "/admin"
        );

    }
);

// ----------------------------------------------------
// 404
// ----------------------------------------------------

app.use(
    (req, res) => {

        res.status(404).send(
            layout(
                "404",
                `
                <div class="card center">

                    <h1>404</h1>

                    <p>
                        Seite nicht gefunden.
                    </p>

                    <a
                        class="button"
                        href="/"
                    >
                        Home
                    </a>

                </div>
                `,
                req
            )
        );

    }
);

// ----------------------------------------------------
// ERROR
// ----------------------------------------------------

app.use(
    (error, req, res, next) => {

        console.error(error);

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).send(
            layout(
                "Fehler",
                `
                <div class="card error">

                    <h2>
                        ❌ Interner Fehler
                    </h2>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>
                `,
                req
            )
        );

    }
);

// ----------------------------------------------------
// START EXISTING SERVERS
// ----------------------------------------------------

async function startExistingServers() {

    const data =
        getServers();

    for (
        const server of data
    ) {

        server.status =
            "stopped";

        server.pid =
            null;

        saveServer(server);

    }

}

// ----------------------------------------------------
// SERVER START
// ----------------------------------------------------

app.listen(
    PORT,
    async () => {

        console.log(
            "=========================================="
        );

        console.log(
            " Minecraft Hosting"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Webseite: Port ${PORT}`
        );

        console.log(
            `Minecraft Ports: ${MIN_MINECRAFT_PORT}-${MAX_MINECRAFT_PORT}`
        );

        console.log(
            `Minecraft Host: ${PUBLIC_HOST}`
        );

        console.log(
            `Admin: ${ADMIN_EMAIL}`
        );

        console.log(
            "=========================================="
        );

        await startExistingServers();

        addSystemLog(
            "SYSTEM",
            `Webseite gestartet auf Port ${PORT}`
        );

    }
);
