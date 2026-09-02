"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;
const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "minecraft-data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);
ensureFile(SESSIONS_FILE, {});

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

function users() {
    return readJSON(USERS_FILE, []);
}

function servers() {
    return readJSON(SERVERS_FILE, []);
}

function sessions() {
    return readJSON(SESSIONS_FILE, {});
}

function saveUsers(data) {
    writeJSON(USERS_FILE, data);
}

function saveServers(data) {
    writeJSON(SERVERS_FILE, data);
}

function saveSessions(data) {
    writeJSON(SESSIONS_FILE, data);
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

function id(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(8).toString("hex") +
        "_" +
        Date.now().toString(36)
    );
}

function clean(value, max = 50) {
    return String(value || "")
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, max);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parseCookies(req) {
    const result = {};

    const cookie = req.headers.cookie || "";

    for (const part of cookie.split(";")) {
        const index = part.indexOf("=");

        if (index === -1) continue;

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();

        result[key] = decodeURIComponent(value);
    }

    return result;
}

function getUser(req) {
    const cookies = parseCookies(req);

    if (!cookies.session) {
        return null;
    }

    const sessionData = sessions()[cookies.session];

    if (!sessionData) {
        return null;
    }

    const allUsers = users();

    return allUsers.find(
        user => user.id === sessionData.userId
    ) || null;
}

function createSession(userId, res) {
    const token = crypto.randomBytes(32).toString("hex");

    const allSessions = sessions();

    allSessions[token] = {
        userId,
        createdAt: Date.now()
    };

    saveSessions(allSessions);

    res.setHeader(
        "Set-Cookie",
        `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`
    );
}

function destroySession(req, res) {
    const cookies = parseCookies(req);

    if (cookies.session) {
        const allSessions = sessions();
        delete allSessions[cookies.session];
        saveSessions(allSessions);
    }

    res.setHeader(
        "Set-Cookie",
        "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );
}

function requireLogin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
        destroySession(req, res);
        return res.status(403).send(page(
            "Konto gesperrt",
            `
            <div class="card">
                <h1>Konto gesperrt</h1>
                <p>Dein Konto wurde gesperrt.</p>
                <a class="button" href="/login">Zur Anmeldung</a>
            </div>
            `
        ));
    }

    req.user = user;
    next();
}

function requireOwner(req, res, next) {
    const user = getUser(req);

    if (!user || user.email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `
            <div class="card">
                <h1>Kein Zugriff</h1>
                <p>Dieser Bereich ist nur für den Owner verfügbar.</p>
                <a class="button" href="/">Zurück</a>
            </div>
            `
        ));
    }

    req.user = user;
    next();
}

function page(title, content, user = null) {
    const loggedIn = !!user;

    return `<!DOCTYPE html>
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
    font-family: Arial, Helvetica, sans-serif;
    background: #0b0f14;
    color: #f5f5f5;
}

nav {
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    background: #111820;
    border-bottom: 1px solid #26313c;
}

.logo {
    color: #55e36b;
    font-size: 22px;
    font-weight: 800;
}

nav a {
    color: #ddd;
    text-decoration: none;
    margin-left: 18px;
}

nav a:hover {
    color: #55e36b;
}

.container {
    width: min(1100px, calc(100% - 30px));
    margin: 40px auto;
}

.hero {
    padding: 50px 35px;
    background: #111820;
    border: 1px solid #26313c;
    border-radius: 16px;
    margin-bottom: 25px;
}

.hero h1 {
    font-size: 42px;
    margin: 0 0 12px;
}

.hero p {
    color: #aeb7c1;
    font-size: 17px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
}

.card {
    background: #111820;
    border: 1px solid #26313c;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 20px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #9ba7b3;
}

.button {
    display: inline-block;
    border: 0;
    background: #55e36b;
    color: #071009;
    padding: 11px 17px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 700;
    cursor: pointer;
    margin-top: 8px;
}

.button:hover {
    filter: brightness(1.08);
}

.button.danger {
    background: #ef5350;
    color: white;
}

.button.gray {
    background: #303b47;
    color: white;
}

input,
select {
    width: 100%;
    padding: 13px;
    margin: 7px 0 14px;
    border-radius: 8px;
    border: 1px solid #34404c;
    background: #0b0f14;
    color: white;
    outline: none;
}

label {
    color: #cbd3db;
    font-size: 14px;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 6px;
    background: #25322a;
    color: #65e57b;
    font-size: 13px;
}

.status.offline {
    background: #30282a;
    color: #ff7373;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid #26313c;
}

small {
    color: #8f9ba7;
}

.notice {
    padding: 13px;
    border-radius: 8px;
    background: #17251a;
    border: 1px solid #315a37;
    margin-bottom: 18px;
}

.error {
    background: #29191a;
    border-color: #6a3032;
    color: #ff9c9c;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

form {
    margin: 0;
}

@media(max-width: 600px) {
    nav {
        padding: 0 15px;
    }

    nav a {
        margin-left: 8px;
        font-size: 13px;
    }

    .hero h1 {
        font-size: 30px;
    }
}
</style>
</head>

<body>

<nav>
    <div class="logo">⛏ Minecraft Hosting</div>

    <div>
        <a href="/">Start</a>
        ${
            loggedIn
                ? `
                    <a href="/dashboard">Dashboard</a>
                    ${
                        user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
                            ? `<a href="/admin">Admin</a>`
                            : ""
                    }
                    <a href="/logout">Logout</a>
                `
                : `
                    <a href="/login">Login</a>
                    <a href="/register">Registrieren</a>
                `
        }
    </div>
</nav>

<main class="container">
${content}
</main>

</body>
</html>`;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =========================
   STARTSEITE
========================= */

app.get("/", (req, res) => {
    const user = getUser(req);

    res.send(page(
        "Minecraft Hosting",
        `
        <section class="hero">
            <h1>Minecraft Hosting</h1>
            <p>
                Erstelle deinen eigenen Minecraft-Server und verwalte ihn
                über dein persönliches Dashboard.
            </p>

            ${
                user
                    ? `<a class="button" href="/dashboard">Zum Dashboard</a>`
                    : `
                        <a class="button" href="/register">Kostenlos starten</a>
                        <a class="button gray" href="/login">Anmelden</a>
                    `
            }
        </section>

        <div class="grid">

            <div class="card">
                <h3>🆓 Kostenloser Server</h3>
                <p class="muted">
                    Jeder registrierte Benutzer kann einen kostenlosen
                    Minecraft-Server erstellen.
                </p>
            </div>

            <div class="card">
                <h3>⚙️ Einfach verwalten</h3>
                <p class="muted">
                    Servername, Minecraft-Version und Einstellungen
                    können über das Dashboard verwaltet werden.
                </p>
            </div>

            <div class="card">
                <h3>📊 Serverstatus</h3>
                <p class="muted">
                    Behalte deine Server und ihren aktuellen Status
                    im Blick.
                </p>
            </div>

        </div>
        `,
        user
    ));
});

/* =========================
   REGISTRIERUNG
========================= */

app.get("/register", (req, res) => {
    const user = getUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(page(
        "Registrieren",
        `
        <div class="card">
            <h1>Registrieren</h1>

            <form method="POST" action="/register">

                <label>Name</label>
                <input
                    name="name"
                    maxlength="40"
                    required
                    placeholder="Dein Name"
                >

                <label>E-Mail</label>
                <input
                    type="email"
                    name="email"
                    required
                    placeholder="name@example.com"
                >

                <label>Passwort</label>
                <input
                    type="password"
                    name="password"
                    minlength="6"
                    required
                    placeholder="Mindestens 6 Zeichen"
                >

                <button class="button" type="submit">
                    Konto erstellen
                </button>

            </form>

            <p class="muted">
                Du hast bereits ein Konto?
                <a href="/login">Jetzt anmelden</a>
            </p>
        </div>
        `
    ));
});

app.post("/register", (req, res) => {
    const name = clean(req.body.name, 40);
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
        return res.status(400).send(page(
            "Registrierung",
            `
            <div class="card">
                <div class="notice error">
                    Bitte fülle alle Felder korrekt aus.
                </div>
                <a class="button" href="/register">Zurück</a>
            </div>
            `
        ));
    }

    const allUsers = users();

    if (allUsers.some(user => user.email === email)) {
        return res.status(400).send(page(
            "Registrierung",
            `
            <div class="card">
                <div class="notice error">
                    Diese E-Mail-Adresse ist bereits registriert.
                </div>
                <a class="button" href="/login">Zum Login</a>
            </div>
            `
        ));
    }

    const newUser = {
        id: id("user"),
        name,
        email,
        password: hashPassword(password),
        createdAt: Date.now(),
        banned: false
    };

    allUsers.push(newUser);
    saveUsers(allUsers);

    createSession(newUser.id, res);

    res.redirect("/dashboard");
});

/* =========================
   LOGIN
========================= */

app.get("/login", (req, res) => {
    const user = getUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(page(
        "Login",
        `
        <div class="card">
            <h1>Anmelden</h1>

            <form method="POST" action="/login">

                <label>E-Mail</label>
                <input
                    type="email"
                    name="email"
                    required
                    placeholder="name@example.com"
                >

                <label>Passwort</label>
                <input
                    type="password"
                    name="password"
                    required
                    placeholder="Passwort"
                >

                <button class="button" type="submit">
                    Anmelden
                </button>

            </form>

            <p class="muted">
                Noch kein Konto?
                <a href="/register">Registrieren</a>
            </p>
        </div>
        `
    ));
});

app.post("/login", (req, res) => {
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    const user = users().find(
        item =>
            item.email === email &&
            item.password === hashPassword(password)
    );

    if (!user) {
        return res.status(401).send(page(
            "Login",
            `
            <div class="card">
                <div class="notice error">
                    E-Mail oder Passwort ist falsch.
                </div>

                <a class="button" href="/login">
                    Erneut versuchen
                </a>
            </div>
            `
        ));
    }

    if (user.banned) {
        return res.status(403).send(page(
            "Konto gesperrt",
            `
            <div class="card">
                <h1>Konto gesperrt</h1>
                <p>Dieses Konto ist derzeit gesperrt.</p>
            </div>
            `
        ));
    }

    createSession(user.id, res);

    res.redirect("/dashboard");
});

/* =========================
   LOGOUT
========================= */

app.get("/logout", (req, res) => {
    destroySession(req, res);
    res.redirect("/");
});

/* =========================
   DASHBOARD
========================= */

app.get("/dashboard", requireLogin, (req, res) => {
    const allServers = servers();

    const ownServers = allServers.filter(
        server => server.ownerId === req.user.id
    );

    const canCreate =
        req.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase() ||
        ownServers.length < 1;

    res.send(page(
        "Dashboard",
        `
        <div class="hero">
            <h1>Hallo ${escapeHTML(req.user.name)} 👋</h1>
            <p>
                Willkommen in deinem Minecraft-Hosting-Dashboard.
            </p>
        </div>

        ${
            canCreate
                ? `
                <div class="card">
                    <h2>Neuen Server erstellen</h2>

                    <p class="muted">
                        ${
                            req.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
                                ? "Als Owner kannst du unbegrenzt viele Server erstellen."
                                : "Du kannst einen kostenlosen Server erstellen."
                        }
                    </p>

                    <a class="button" href="/servers/create">
                        + Server erstellen
                    </a>
                </div>
                `
                : `
                <div class="card">
                    <h2>Limit erreicht</h2>
                    <p class="muted">
                        Du hast bereits deinen kostenlosen Server.
                    </p>
                `
        }

        <div class="card">
            <h2>Meine Minecraft-Server</h2>

            ${
                ownServers.length === 0
                    ? `
                    <p class="muted">
                        Du hast noch keinen Server.
                    </p>
                    `
                    : `
                    <div class="grid">
                        ${ownServers.map(server => `
                            <div class="card">
                                <h3>${escapeHTML(server.name)}</h3>

                                <p>
                                    <span class="status ${server.status !== "online" ? "offline" : ""}">
                                        ${escapeHTML(server.status)}
                                    </span>
                                </p>

                                <p>
                                    <small>
                                        ID: ${escapeHTML(server.id)}
                                    </small>
                                </p>

                                <p class="muted">
                                    Version:
                                    ${escapeHTML(server.version)}
                                </p>

                                <p class="muted">
                                    RAM:
                                    ${escapeHTML(server.ram)} MB
                                </p>

                                <div class="actions">
                                    <a class="button" href="/servers/${encodeURIComponent(server.id)}">
                                        Verwalten
                                    </a>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                    `
            }
        </div>
        `,
        req.user
    ));
});

/* =========================
   SERVER ERSTELLEN
========================= */

app.get("/servers/create", requireLogin, (req, res) => {
    const allServers = servers();

    const ownServers = allServers.filter(
        server => server.ownerId === req.user.id
    );

    const isOwner =
        req.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isOwner && ownServers.length >= 1) {
        return res.status(403).send(page(
            "Serverlimit",
            `
            <div class="card">
                <h1>Serverlimit erreicht</h1>
                <p>
                    Du kannst maximal einen kostenlosen Server besitzen.
                </p>
                <a class="button" href="/dashboard">
                    Dashboard
                </a>
            </div>
            `,
            req.user
        ));
    }

    res.send(page(
        "Server erstellen",
        `
        <div class="card">
            <h1>Minecraft-Server erstellen</h1>

            <form method="POST" action="/servers/create">

                <label>Servername</label>
                <input
                    name="name"
                    maxlength="50"
                    required
                    placeholder="Mein Minecraft Server"
                >

                <label>Minecraft-Version</label>
                <select name="version" required>
                    <option value="1.21.8">1.21.8</option>
                    <option value="1.21.7">1.21.7</option>
                    <option value="1.21.6">1.21.6</option>
                    <option value="1.21.5">1.21.5</option>
                    <option value="1.21.4">1.21.4</option>
                    <option value="1.21.3">1.21.3</option>
                    <option value="1.21.2">1.21.2</option>
                    <option value="1.21.1">1.21.1</option>
                </select>

                <label>RAM</label>
                <select name="ram">
                    <option value="1024">1024 MB</option>
                    <option value="2048">2048 MB</option>
                    <option value="3072">3072 MB</option>
                    <option value="4096">4096 MB</option>
                </select>

                <button class="button" type="submit">
                    Server erstellen
                </button>

            </form>
        </div>
        `,
        req.user
    ));
});

app.post("/servers/create", requireLogin, (req, res) => {
    const allServers = servers();

    const ownServers = allServers.filter(
        server => server.ownerId === req.user.id
    );

    const isOwner =
        req.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isOwner && ownServers.length >= 1) {
        return res.status(403).send("Serverlimit erreicht.");
    }

    const name = clean(req.body.name, 50);
    const version = clean(req.body.version, 20);
    const ram = Number(req.body.ram);

    const allowedRAM = [1024, 2048, 3072, 4096];

    if (
        !name ||
        !version ||
        !allowedRAM.includes(ram)
    ) {
        return res.status(400).send("Ungültige Serverdaten.");
    }

    const server = {
        id: id("mc"),
        ownerId: req.user.id,
        name,
        version,
        ram,
        status: "offline",
        createdAt: Date.now(),
        address: null,
        port: null
    };

    allServers.push(server);
    saveServers(allServers);

    res.redirect("/dashboard");
});

/* =========================
   SERVER VERWALTUNG
========================= */

app.get("/servers/:id", requireLogin, (req, res) => {
    const server = servers().find(
        item =>
            item.id === req.params.id &&
            item.ownerId === req.user.id
    );

    if (!server) {
        return res.status(404).send(page(
            "Server nicht gefunden",
            `
            <div class="card">
                <h1>Server nicht gefunden</h1>
                <a class="button" href="/dashboard">
                    Dashboard
                </a>
            </div>
            `,
            req.user
        ));
    }

    res.send(page(
        escapeHTML(server.name),
        `
        <div class="hero">
            <h1>${escapeHTML(server.name)}</h1>

            <p>
                <span class="status ${server.status !== "online" ? "offline" : ""}">
                    ${escapeHTML(server.status)}
                </span>
            </p>

            <p class="muted">
                Server-ID:
                ${escapeHTML(server.id)}
            </p>
        </div>

        <div class="grid">

            <div class="card">
                <h3>Minecraft</h3>

                <p>
                    Version:
                    <strong>${escapeHTML(server.version)}</strong>
                </p>

                <p>
                    RAM:
                    <strong>${escapeHTML(server.ram)} MB</strong>
                </p>

                <p>
                    Adresse:
                    <strong>
                        ${
                            server.address
                                ? escapeHTML(server.address)
                                : "Noch nicht zugewiesen"
                        }
                    </strong>
                </p>

                <p>
                    Port:
                    <strong>
                        ${
                            server.port
                                ? escapeHTML(server.port)
                                : "Noch nicht zugewiesen"
                        }
                    </strong>
                </p>
            </div>

            <div class="card">
                <h3>Serversteuerung</h3>

                <div class="actions">

                    <form method="POST"
                          action="/servers/${encodeURIComponent(server.id)}/start">
                        <button class="button" type="submit">
                            ▶ Start
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${encodeURIComponent(server.id)}/stop">
                        <button class="button gray" type="submit">
                            ■ Stop
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${encodeURIComponent(server.id)}/restart">
                        <button class="button" type="submit">
                            ↻ Neustart
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${encodeURIComponent(server.id)}/delete"
                          onsubmit="return confirm('Server wirklich löschen?')">
                        <button class="button danger" type="submit">
                            🗑 Löschen
                        </button>
                    </form>

                </div>
            </div>

        </div>

        <div class="card">
            <h2>Hinweis</h2>
            <p class="muted">
                Die Webseite verwaltet hier die Serverdaten.
                Für echte Minecraft-Prozesse muss später noch ein
                Minecraft-Server-Backend angebunden werden.
            </p>
        </div>
        `,
        req.user
    ));
});

/* =========================
   START
========================= */

app.post("/servers/:id/start", requireLogin, (req, res) => {
    const allServers = servers();

    const server = allServers.find(
        item =>
            item.id === req.params.id &&
            item.ownerId === req.user.id
    );

    if (!server) {
        return res.status(404).send("Server nicht gefunden.");
    }

    server.status = "online";

    saveServers(allServers);

    res.redirect(`/servers/${encodeURIComponent(server.id)}`);
});

/* =========================
   STOP
========================= */

app.post("/servers/:id/stop", requireLogin, (req, res) => {
    const allServers = servers();

    const server = allServers.find(
        item =>
            item.id === req.params.id &&
            item.ownerId === req.user.id
    );

    if (!server) {
        return res.status(404).send("Server nicht gefunden.");
    }

    server.status = "offline";

    saveServers(allServers);

    res.redirect(`/servers/${encodeURIComponent(server.id)}`);
});

/* =========================
   RESTART
========================= */

app.post("/servers/:id/restart", requireLogin, (req, res) => {
    const allServers = servers();

    const server = allServers.find(
        item =>
            item.id === req.params.id &&
            item.ownerId === req.user.id
    );

    if (!server) {
        return res.status(404).send("Server nicht gefunden.");
    }

    server.status = "restarting";

    saveServers(allServers);

    setTimeout(() => {
        const updated = servers();

        const current = updated.find(
            item => item.id === server.id
        );

        if (current) {
            current.status = "online";
            saveServers(updated);
        }
    }, 2000);

    res.redirect(`/servers/${encodeURIComponent(server.id)}`);
});

/* =========================
   SERVER LÖSCHEN
========================= */

app.post("/servers/:id/delete", requireLogin, (req, res) => {
    const allServers = servers();

    const index = allServers.findIndex(
        item =>
            item.id === req.params.id &&
            item.ownerId === req.user.id
    );

    if (index === -1) {
        return res.status(404).send("Server nicht gefunden.");
    }

    allServers.splice(index, 1);

    saveServers(allServers);

    res.redirect("/dashboard");
});

/* =========================
   ADMIN PANEL
========================= */

app.get("/admin", requireOwner, (req, res) => {
    const allUsers = users();
    const allServers = servers();

    res.send(page(
        "Admin Panel",
        `
        <div class="hero">
            <h1>Owner Panel</h1>
            <p>
                Minecraft Hosting Verwaltung
            </p>
        </div>

        <div class="grid">

            <div class="card">
                <h3>👥 Benutzer</h3>
                <h2>${allUsers.length}</h2>
            </div>

            <div class="card">
                <h3>🖥️ Server</h3>
                <h2>${allServers.length}</h2>
            </div>

            <div class="card">
                <h3>🟢 Online</h3>
                <h2>
                    ${allServers.filter(s => s.status === "online").length}
                </h2>
            </div>

        </div>

        <div class="card">
            <h2>Benutzer</h2>

            <table>
                <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Registriert</th>
                    <th>Status</th>
                    <th>Aktion</th>
                </tr>

                ${allUsers.map(user => `
                    <tr>
                        <td>${escapeHTML(user.name)}</td>
                        <td>${escapeHTML(user.email)}</td>
                        <td>
                            ${new Date(user.createdAt).toLocaleDateString("de-DE")}
                        </td>
                        <td>
                            ${
                                user.banned
                                    ? "Gesperrt"
                                    : "Aktiv"
                            }
                        </td>
                        <td>
                            ${
                                user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
                                    ? "<small>Owner</small>"
                                    : `
                                    <form method="POST"
                                          action="/admin/users/${encodeURIComponent(user.id)}/toggle-ban">
                                        <button class="button ${
                                            user.banned ? "" : "danger"
                                        }" type="submit">
                                            ${
                                                user.banned
                                                    ? "Entsperren"
                                                    : "Sperren"
                                            }
                                        </button>
                                    </form>
                                    `
                            }
                        </td>
                    </tr>
                `).join("")}
            </table>
        </div>

        <div class="card">
            <h2>Alle Minecraft-Server</h2>

            ${
                allServers.length === 0
                    ? "<p class='muted'>Keine Server vorhanden.</p>"
                    : `
                    <table>
                        <tr>
                            <th>Name</th>
                            <th>Version</th>
                            <th>RAM</th>
                            <th>Status</th>
                        </tr>

                        ${allServers.map(server => `
                            <tr>
                                <td>${escapeHTML(server.name)}</td>
                                <td>${escapeHTML(server.version)}</td>
                                <td>${escapeHTML(server.ram)} MB</td>
                                <td>${escapeHTML(server.status)}</td>
                            </tr>
                        `).join("")}
                    </table>
                    `
            }
        </div>
        `,
        req.user
    ));
});

/* =========================
   ADMIN BAN
========================= */

app.post(
    "/admin/users/:id/toggle-ban",
    requireOwner,
    (req, res) => {
        const allUsers = users();

        const user = allUsers.find(
            item => item.id === req.params.id
        );

        if (!user) {
            return res.status(404).send("Benutzer nicht gefunden.");
        }

        if (
            user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
        ) {
            return res.status(403).send(
                "Der Owner kann nicht gesperrt werden."
            );
        }

        user.banned = !user.banned;

        saveUsers(allUsers);

        res.redirect("/admin");
    }
);

/* =========================
   404
========================= */

app.use((req, res) => {
    const user = getUser(req);

    res.status(404).send(page(
        "404",
        `
        <div class="card">
            <h1>404</h1>
            <p>Diese Seite wurde nicht gefunden.</p>
            <a class="button" href="/">Zur Startseite</a>
        </div>
        `,
        user
    ));
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
    console.error("Webseiten-Fehler:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send(page(
        "Fehler",
        `
        <div class="card">
            <h1>Serverfehler</h1>
            <p>
                Es ist ein interner Fehler aufgetreten.
            </p>

            <a class="button" href="/">
                Zur Startseite
            </a>
        </div>
        `
    ));
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log(" Minecraft Hosting Webseite");
    console.log("======================================");
    console.log(`Server läuft auf Port: ${PORT}`);
    console.log(`Owner: ${OWNER_EMAIL}`);
    console.log("======================================");
});
