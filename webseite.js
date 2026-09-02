/*
==========================================================
 Florian / WeisserHai Minecraft Hosting
 webseite.js
==========================================================

Benötigte Pakete:
npm install express express-session bcryptjs

Start:
node webseite.js

Umgebungsvariablen:
PORT=10000
SESSION_SECRET=dein-langes-geheimes-passwort

Owner:
florianzustolberg@gmail.com

Hinweis:
Dieser Code verwaltet die Hosting-Oberfläche und Serverdaten.
Für echte Minecraft-Prozesse muss später ein Minecraft/Docker
Backend angebunden werden.
==========================================================
*/

"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "CHANGE_THIS_SESSION_SECRET_123456789";

const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(defaultValue, null, 2),
            "utf8"
        );
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);
ensureFile(ORDERS_FILE, []);

function readJSON(file, fallback = []) {
    try {
        const raw = fs.readFileSync(file, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        console.error("JSON-Lesefehler:", file, error.message);

        try {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2),
                "utf8"
            );
        } catch {}

        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

function loadUsers() {
    return readJSON(USERS_FILE, []);
}

function loadServers() {
    return readJSON(SERVERS_FILE, []);
}

function loadOrders() {
    return readJSON(ORDERS_FILE, []);
}

function saveUsers(data) {
    writeJSON(USERS_FILE, data);
}

function saveServers(data) {
    writeJSON(SERVERS_FILE, data);
}

function saveOrders(data) {
    writeJSON(ORDERS_FILE, data);
}

function id(prefix = "id") {
    return (
        prefix +
        "_" +
        crypto.randomBytes(8).toString("hex") +
        "_" +
        Date.now()
    );
}

function clean(value, max = 100) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validServerName(name) {
    return /^[a-zA-Z0-9äöüÄÖÜß _.-]{2,40}$/.test(name);
}

function isOwner(user) {
    return (
        user &&
        String(user.email).toLowerCase() === OWNER_EMAIL
    );
}

function findUserByEmail(email) {
    const users = loadUsers();

    return users.find(
        user =>
            String(user.email).toLowerCase() ===
            String(email).toLowerCase()
    );
}

function currentUser(req) {
    if (!req.session.userId) return null;

    const users = loadUsers();

    return (
        users.find(user => user.id === req.session.userId) ||
        null
    );
}

function requireLogin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
        req.session.destroy(() => {});
        return res.status(403).send(page(
            "Gesperrt",
            `
            <div class="card">
                <h1>Account gesperrt</h1>
                <p>Dieser Account wurde vom Administrator gesperrt.</p>
                <a class="btn" href="/login">Zum Login</a>
            </div>
            `
        ));
    }

    req.user = user;
    next();
}

function requireOwner(req, res, next) {
    const user = currentUser(req);

    if (!user || !isOwner(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card">
                    <h1>403</h1>
                    <p>Nur der Owner darf diesen Bereich öffnen.</p>
                    <a class="btn" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    req.user = user;
    next();
}

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24 * 30
        }
    })
);

function page(title, content, user = null) {
    const owner = user && isOwner(user);

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} | Florian/WeisserHai</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background:
        radial-gradient(circle at top, #173c67 0%, #08111f 45%, #050a12 100%);
    color: #fff;
    min-height: 100vh;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 18px 5%;
    background: rgba(3, 8, 17, .85);
    border-bottom: 1px solid rgba(255,255,255,.08);
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(15px);
}

.logo {
    font-size: 21px;
    font-weight: 800;
}

.navlinks {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.navlinks a {
    color: #fff;
    text-decoration: none;
    padding: 9px 13px;
    border-radius: 10px;
}

.navlinks a:hover {
    background: rgba(255,255,255,.1);
}

.container {
    width: min(1150px, 92%);
    margin: 40px auto;
}

.hero {
    padding: 70px 30px;
    text-align: center;
}

.hero h1 {
    font-size: clamp(38px, 7vw, 75px);
    margin: 0 0 15px;
}

.hero p {
    color: #b9c6d8;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
}

.card {
    background: rgba(11, 23, 40, .88);
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0,0,0,.2);
}

.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #9eacc0;
}

input,
select,
textarea {
    width: 100%;
    padding: 13px;
    margin: 7px 0 15px;
    border: 1px solid #31435b;
    border-radius: 10px;
    background: #0b1627;
    color: #fff;
    outline: none;
}

textarea {
    min-height: 180px;
    resize: vertical;
    font-family: monospace;
}

button,
.btn {
    display: inline-block;
    border: 0;
    border-radius: 10px;
    padding: 12px 17px;
    background: #2585ff;
    color: white;
    text-decoration: none;
    cursor: pointer;
    font-weight: 700;
}

button:hover,
.btn:hover {
    filter: brightness(1.12);
}

.btn-danger {
    background: #d83b52;
}

.btn-success {
    background: #159b68;
}

.btn-warning {
    background: #d78b18;
}

form {
    margin: 0;
}

.badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
    color: #cbd7e6;
    font-size: 13px;
}

.online {
    color: #4ee59b;
}

.offline {
    color: #ff7185;
}

.stat {
    font-size: 35px;
    font-weight: 800;
    margin-top: 8px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(255,255,255,.08);
    text-align: left;
}

.actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
}

.alert {
    padding: 13px;
    border-radius: 10px;
    margin-bottom: 18px;
    background: rgba(37,133,255,.13);
    border: 1px solid rgba(37,133,255,.3);
}

.warning {
    background: rgba(220,150,30,.13);
    border-color: rgba(220,150,30,.3);
}

footer {
    padding: 50px 5%;
    text-align: center;
    color: #75849a;
}

.code {
    font-family: monospace;
    background: #050a12;
    border: 1px solid #25344a;
    border-radius: 10px;
    padding: 14px;
    overflow: auto;
}

@media (max-width: 700px) {
    nav {
        align-items: flex-start;
        flex-direction: column;
    }

    .hero {
        padding: 45px 10px;
    }

    th:nth-child(2),
    td:nth-child(2) {
        display: none;
    }
}
</style>
</head>

<body>

<nav>
    <div class="logo">⛏️ Florian/WeisserHai</div>

    <div class="navlinks">
        <a href="/">Home</a>

        ${
            user
                ? `
                    <a href="/dashboard">Dashboard</a>
                    <a href="/servers">Server</a>
                    ${
                        owner
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

<footer>
    Florian/WeisserHai Minecraft Hosting<br>
    Minecraft Server Hosting
</footer>

</body>
</html>
`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function serverStatus(server) {
    if (server.status === "running") {
        return `<span class="online">● Online</span>`;
    }

    if (server.status === "starting") {
        return `<span class="badge">◌ Startet</span>`;
    }

    if (server.status === "stopping") {
        return `<span class="badge">◌ Stoppt</span>`;
    }

    return `<span class="offline">● Offline</span>`;
}

function countUserServers(userId) {
    return loadServers().filter(
        server => server.ownerId === userId
    ).length;
}

function createServerObject(user, name, version, type) {
    return {
        id: id("server"),
        ownerId: user.id,
        ownerEmail: user.email,

        name,
        version,
        type,

        status: "offline",

        ram: 2048,
        cpu: 100,
        storage: 10240,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        files: {
            "server.properties":
                `motd=${name}\n` +
                `max-players=20\n` +
                `online-mode=true\n` +
                `difficulty=normal\n` +
                `gamemode=survival\n`,

            "README.txt":
                "Florian/WeisserHai Minecraft Server\n"
        },

        console: [],

        settings: {
            autoStart: false,
            backup: true,
            whitelist: false
        }
    };
}

/*
==========================================================
 HOME
==========================================================
*/

app.get("/", (req, res) => {
    const user = currentUser(req);

    res.send(
        page(
            "Minecraft Hosting",
            `
            <section class="hero">
                <h1>Florian/WeisserHai</h1>
                <h2>Minecraft Hosting</h2>

                <p>
                    Erstelle deinen eigenen Minecraft-Server
                    und verwalte ihn über dein Dashboard.
                </p>

                <div style="margin-top:25px;">
                    ${
                        user
                            ? `<a class="btn" href="/dashboard">
                                Zum Dashboard
                               </a>`
                            : `
                               <a class="btn" href="/register">
                                   Kostenlos starten
                               </a>
                               <a class="btn" href="/login">
                                   Login
                               </a>
                              `
                    }
                </div>
            </section>

            <div class="grid">

                <div class="card">
                    <h3>🆓 Kostenlos</h3>
                    <p class="muted">
                        Jeder normale Benutzer kann einen kostenlosen
                        Minecraft-Server erstellen.
                    </p>
                </div>

                <div class="card">
                    <h3>⚙️ Serververwaltung</h3>
                    <p class="muted">
                        Server starten, stoppen, Einstellungen ändern
                        und Dateien verwalten.
                    </p>
                </div>

                <div class="card">
                    <h3>👑 Owner</h3>
                    <p class="muted">
                        Der Owner kann unbegrenzt viele Server erstellen
                        und Benutzer verwalten.
                    </p>
                </div>

            </div>
            `,
            user
        )
    );
});

/*
==========================================================
 REGISTER
==========================================================
*/

app.get("/register", (req, res) => {
    const user = currentUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Registrieren",
            `
            <div class="card" style="max-width:520px;margin:auto;">
                <h1>Account erstellen</h1>

                <form method="POST" action="/register">

                    <label>Name</label>
                    <input
                        name="name"
                        required
                        minlength="2"
                        maxlength="40"
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
                        required
                        minlength="6"
                        placeholder="Mindestens 6 Zeichen"
                    >

                    <button type="submit">
                        Registrieren
                    </button>

                </form>

                <p class="muted">
                    Bereits registriert?
                    <a href="/login">Einloggen</a>
                </p>
            </div>
            `
        )
    );
});

app.post("/register", async (req, res) => {
    const name = clean(req.body.name, 40);
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !validEmail(email)) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Ungültige Angaben</h2>
                    <p>Bitte überprüfe Name und E-Mail.</p>
                    <a class="btn" href="/register">Zurück</a>
                </div>
                `
            )
        );
    }

    if (password.length < 6) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Passwort zu kurz</h2>
                    <p>Das Passwort muss mindestens 6 Zeichen haben.</p>
                    <a class="btn" href="/register">Zurück</a>
                </div>
                `
            )
        );
    }

    const users = loadUsers();

    if (
        users.some(
            user =>
                String(user.email).toLowerCase() === email
        )
    ) {
        return res.status(409).send(
            page(
                "Account vorhanden",
                `
                <div class="card">
                    <h2>E-Mail bereits registriert</h2>
                    <a class="btn" href="/login">Zum Login</a>
                </div>
                `
            )
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = {
        id: id("user"),
        name,
        email,
        passwordHash,

        role:
            email === OWNER_EMAIL
                ? "owner"
                : "user",

        banned: false,
        coins: 0,

        createdAt: new Date().toISOString(),
        lastLogin: null
    };

    users.push(newUser);
    saveUsers(users);

    req.session.userId = newUser.id;

    res.redirect("/dashboard");
});

/*
==========================================================
 LOGIN
==========================================================
*/

app.get("/login", (req, res) => {
    const user = currentUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Login",
            `
            <div class="card" style="max-width:520px;margin:auto;">
                <h1>Login</h1>

                <form method="POST" action="/login">

                    <label>E-Mail</label>
                    <input
                        type="email"
                        name="email"
                        required
                        autocomplete="email"
                    >

                    <label>Passwort</label>
                    <input
                        type="password"
                        name="password"
                        required
                        autocomplete="current-password"
                    >

                    <button type="submit">
                        Einloggen
                    </button>

                </form>

                <p class="muted">
                    Noch kein Account?
                    <a href="/register">Registrieren</a>
                </p>
            </div>
            `
        )
    );
});

app.post("/login", async (req, res) => {
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    const users = loadUsers();

    const user = users.find(
        item =>
            String(item.email).toLowerCase() === email
    );

    if (!user) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="card">
                    <h2>Login fehlgeschlagen</h2>
                    <p>E-Mail oder Passwort ist falsch.</p>
                    <a class="btn" href="/login">Erneut versuchen</a>
                </div>
                `
            )
        );
    }

    if (user.banned) {
        return res.status(403).send(
            page(
                "Gesperrt",
                `
                <div class="card">
                    <h2>Account gesperrt</h2>
                    <p>Dieser Account wurde gesperrt.</p>
                </div>
                `
            )
        );
    }

    const valid = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!valid) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="card">
                    <h2>Login fehlgeschlagen</h2>
                    <p>E-Mail oder Passwort ist falsch.</p>
                    <a class="btn" href="/login">Erneut versuchen</a>
                </div>
                `
            )
        );
    }

    user.lastLogin = new Date().toISOString();

    saveUsers(users);

    req.session.userId = user.id;

    res.redirect("/dashboard");
});

/*
==========================================================
 LOGOUT
==========================================================
*/

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

/*
==========================================================
 DASHBOARD
==========================================================
*/

app.get("/dashboard", requireLogin, (req, res) => {
    const servers = loadServers().filter(
        server => server.ownerId === req.user.id
    );

    res.send(
        page(
            "Dashboard",
            `
            <div class="card">
                <h1>Hallo ${escapeHTML(req.user.name)} 👋</h1>

                <p class="muted">
                    Eingeloggt als
                    ${escapeHTML(req.user.email)}
                </p>

                ${
                    isOwner(req.user)
                        ? `
                        <div class="alert">
                            👑 Du bist der Owner.
                            Du kannst unbegrenzt Minecraft-Server erstellen.
                        </div>
                        `
                        : `
                        <div class="alert">
                            🆓 Dein kostenloser Server:
                            ${servers.length}/1
                        </div>
                        `
                }
            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h3>Meine Server</h3>
                    <div class="stat">${servers.length}</div>
                </div>

                <div class="card">
                    <h3>Coins</h3>
                    <div class="stat">${req.user.coins || 0}</div>
                </div>

                <div class="card">
                    <h3>Rolle</h3>
                    <div class="stat">
                        ${
                            isOwner(req.user)
                                ? "OWNER"
                                : "USER"
                        }
                    </div>
                </div>

            </div>

            <br>

            <div class="actions">
                <a class="btn" href="/servers">
                    Server verwalten
                </a>

                <a class="btn btn-success" href="/servers/create">
                    + Server erstellen
                </a>

                ${
                    isOwner(req.user)
                        ? `
                        <a class="btn btn-warning" href="/admin">
                            👑 Admin Panel
                        </a>
                        `
                        : ""
                }
            </div>
            `,
            req.user
        )
    );
});

/*
==========================================================
 SERVER LIST
==========================================================
*/

app.get("/servers", requireLogin, (req, res) => {
    const servers = loadServers().filter(
        server => server.ownerId === req.user.id
    );

    const cards = servers
        .map(
            server => `
            <div class="card">

                <h2>${escapeHTML(server.name)}</h2>

                <p>
                    ${serverStatus(server)}
                </p>

                <p class="muted">
                    Version:
                    ${escapeHTML(server.version)}
                    <br>
                    Typ:
                    ${escapeHTML(server.type)}
                    <br>
                    RAM:
                    ${server.ram} MB
                </p>

                <div class="actions">

                    <a class="btn"
                       href="/servers/${server.id}">
                        Verwalten
                    </a>

                    <form method="POST"
                          action="/servers/${server.id}/start">
                        <button type="submit"
                                class="btn-success">
                            Start
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${server.id}/stop">
                        <button type="submit"
                                class="btn-warning">
                            Stop
                        </button>
                    </form>

                </div>

            </div>
            `
        )
        .join("");

    res.send(
        page(
            "Meine Server",
            `
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
                <h1>Meine Minecraft-Server</h1>

                <a class="btn btn-success"
                   href="/servers/create">
                    + Neuer Server
                </a>
            </div>

            <br>

            <div class="grid">
                ${
                    cards ||
                    `
                    <div class="card">
                        <h2>Noch kein Server</h2>
                        <p class="muted">
                            Erstelle jetzt deinen ersten Minecraft-Server.
                        </p>
                        <a class="btn" href="/servers/create">
                            Server erstellen
                        </a>
                    </div>
                    `
                }
            </div>
            `,
            req.user
        )
    );
});

/*
==========================================================
 CREATE SERVER PAGE
==========================================================
*/

app.get("/servers/create", requireLogin, (req, res) => {
    const amount = countUserServers(req.user.id);

    if (!isOwner(req.user) && amount >= 1) {
        return res.send(
            page(
                "Limit erreicht",
                `
                <div class="card">
                    <h1>Server-Limit erreicht</h1>

                    <p>
                        Normale Benutzer können einen kostenlosen
                        Minecraft-Server besitzen.
                    </p>

                    <p>
                        Als Owner kannst du unbegrenzt viele Server erstellen.
                    </p>

                    <a class="btn" href="/servers">
                        Zurück
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    res.send(
        page(
            "Server erstellen",
            `
            <div class="card">

                <h1>Minecraft-Server erstellen</h1>

                <form method="POST"
                      action="/servers/create">

                    <label>Servername</label>

                    <input
                        name="name"
                        required
                        minlength="2"
                        maxlength="40"
                        placeholder="Mein Minecraft Server"
                    >

                    <label>Minecraft-Version</label>

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

                        <option value="1.21.5">
                            1.21.5
                        </option>

                        <option value="1.21.4">
                            1.21.4
                        </option>

                        <option value="1.20.6">
                            1.20.6
                        </option>

                        <option value="1.20.4">
                            1.20.4
                        </option>

                    </select>

                    <label>Server-Typ</label>

                    <select name="type">

                        <option value="Vanilla">
                            Vanilla
                        </option>

                        <option value="Paper">
                            Paper
                        </option>

                        <option value="Fabric">
                            Fabric
                        </option>

                        <option value="Forge">
                            Forge
                        </option>

                    </select>

                    <button type="submit">
                        Server erstellen
                    </button>

                </form>

            </div>
            `,
            req.user
        )
    );
});

/*
==========================================================
 CREATE SERVER
==========================================================
*/

app.post("/servers/create", requireLogin, (req, res) => {
    const name = clean(req.body.name, 40);
    const version = clean(req.body.version, 30);
    const type = clean(req.body.type, 30);

    if (!validServerName(name)) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Ungültiger Servername</h2>
                    <p>
                        Verwende nur Buchstaben, Zahlen,
                        Leerzeichen, Punkte, Bindestriche oder Unterstriche.
                    </p>
                    <a class="btn" href="/servers/create">
                        Zurück
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    const allowedTypes = [
        "Vanilla",
        "Paper",
        "Fabric",
        "Forge"
    ];

    if (!allowedTypes.includes(type)) {
        return res.status(400).send("Ungültiger Servertyp.");
    }

    const amount = countUserServers(req.user.id);

    if (!isOwner(req.user) && amount >= 1) {
        return res.status(403).send(
            page(
                "Limit",
                `
                <div class="card">
                    <h2>Server-Limit erreicht</h2>
                    <a class="btn" href="/servers">
                        Zurück
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    const servers = loadServers();

    const server = createServerObject(
        req.user,
        name,
        version,
        type
    );

    servers.push(server);

    saveServers(servers);

    res.redirect(`/servers/${server.id}`);
});

/*
==========================================================
 SERVER DETAIL
==========================================================
*/

app.get("/servers/:id", requireLogin, (req, res) => {
    const servers = loadServers();

    const server = servers.find(
        item => item.id === req.params.id
    );

    if (!server) {
        return res.status(404).send(
            page(
                "Nicht gefunden",
                `
                <div class="card">
                    <h2>Server nicht gefunden.</h2>
                    <a class="btn" href="/servers">
                        Zurück
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    if (
        server.ownerId !== req.user.id &&
        !isOwner(req.user)
    ) {
        return res.status(403).send("Kein Zugriff.");
    }

    const files = Object.keys(server.files || {});

    res.send(
        page(
            server.name,
            `
            <div class="card">

                <h1>${escapeHTML(server.name)}</h1>

                <p>
                    ${serverStatus(server)}
                </p>

                <p class="muted">
                    ID:
                    ${escapeHTML(server.id)}
                    <br>
                    Version:
                    ${escapeHTML(server.version)}
                    <br>
                    Typ:
                    ${escapeHTML(server.type)}
                </p>

                <div class="actions">

                    <form method="POST"
                          action="/servers/${server.id}/start">
                        <button class="btn-success">
                            ▶ Start
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${server.id}/stop">
                        <button class="btn-warning">
                            ■ Stop
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${server.id}/restart">
                        <button>
                            ↻ Neustart
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${server.id}/delete"
                          onsubmit="return confirm('Server wirklich löschen?')">
                        <button class="btn-danger">
                            Server löschen
                        </button>
                    </form>

                </div>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h3>RAM</h3>
                    <div class="stat">
                        ${server.ram} MB
                    </div>
                </div>

                <div class="card">
                    <h3>CPU</h3>
                    <div class="stat">
                        ${server.cpu}%
                    </div>
                </div>

                <div class="card">
                    <h3>Speicher</h3>
                    <div class="stat">
                        ${server.storage} MB
                    </div>
                </div>

            </div>

            <br>

            <div class="card">

                <h2>📁 Dateien</h2>

                ${
                    files.length
                        ? files
                              .map(
                                  file => `
                                <p>
                                    <a class="btn"
                                       href="/servers/${server.id}/files/${encodeURIComponent(file)}">
                                        ${escapeHTML(file)}
                                    </a>
                                </p>
                                `
                              )
                              .join("")
                        : "<p>Keine Dateien.</p>"
                }

            </div>

            <br>

            <div class="card">

                <h2>💻 Server-Code / Datei erstellen</h2>

                <form method="POST"
                      action="/servers/${server.id}/files">

                    <label>Dateiname</label>

                    <input
                        name="filename"
                        required
                        maxlength="100"
                        placeholder="plugins/mein-plugin.txt"
                    >

                    <label>Inhalt</label>

                    <textarea
                        name="content"
                        placeholder="Dein Code oder Dateiinhalt..."
                    ></textarea>

                    <button type="submit">
                        Datei speichern
                    </button>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>🖥️ Konsole</h2>

                <div class="code">
                    ${
                        server.console &&
                        server.console.length
                            ? server.console
                                  .slice(-100)
                                  .map(line =>
                                      escapeHTML(line)
                                  )
                                  .join("<br>")
                            : "Noch keine Konsoleneinträge."
                    }
                </div>

            </div>
            `,
            req.user
        )
    );
});

/*
==========================================================
 START SERVER
==========================================================
*/

function getOwnedServer(req) {
    const servers = loadServers();

    const server = servers.find(
        item => item.id === req.params.id
    );

    if (!server) return null;

    if (
        server.ownerId !== req.user.id &&
        !isOwner(req.user)
    ) {
        return null;
    }

    return {
        server,
        servers
    };
}

app.post(
    "/servers/:id/start",
    requireLogin,
    (req, res) => {
        const result = getOwnedServer(req);

        if (!result) {
            return res.status(404).send("Server nicht gefunden.");
        }

        const { server, servers } = result;

        server.status = "starting";
        server.updatedAt = new Date().toISOString();

        server.console ||= [];

        server.console.push(
            `[${new Date().toISOString()}] Server wird gestartet.`
        );

        saveServers(servers);

        /*
        Hier kann später das echte Minecraft-Backend
        angeschlossen werden.
        */

        setTimeout(() => {
            const current = loadServers();

            const item = current.find(
                x => x.id === server.id
            );

            if (!item) return;

            item.status = "running";
            item.updatedAt = new Date().toISOString();

            item.console ||= [];

            item.console.push(
                `[${new Date().toISOString()}] Server ist online.`
            );

            saveServers(current);
        }, 1500);

        res.redirect(`/servers/${server.id}`);
    }
);

/*
==========================================================
 STOP SERVER
==========================================================
*/

app.post(
    "/servers/:id/stop",
    requireLogin,
    (req, res) => {
        const result = getOwnedServer(req);

        if (!result) {
            return res.status(404).send("Server nicht gefunden.");
        }

        const { server, servers } = result;

        server.status = "stopping";
        server.updatedAt = new Date().toISOString();

        server.console ||= [];

        server.console.push(
            `[${new Date().toISOString()}] Server wird gestoppt.`
        );

        saveServers(servers);

        setTimeout(() => {
            const current = loadServers();

            const item = current.find(
                x => x.id === server.id
            );

            if (!item) return;

            item.status = "offline";
            item.updatedAt = new Date().toISOString();

            item.console ||= [];

            item.console.push(
                `[${new Date().toISOString()}] Server ist offline.`
            );

            saveServers(current);
        }, 1000);

        res.redirect(`/servers/${server.id}`);
    }
);

/*
==========================================================
 RESTART
==========================================================
*/

app.post(
    "/servers/:id/restart",
    requireLogin,
    (req, res) => {
        const result = getOwnedServer(req);

        if (!result) {
            return res.status(404).send("Server nicht gefunden.");
        }

        const { server, servers } = result;

        server.status = "starting";
        server.updatedAt = new Date().toISOString();

        server.console ||= [];

        server.console.push(
            `[${new Date().toISOString()}] Server wird neu gestartet.`
        );

        saveServers(servers);

        setTimeout(() => {
            const current = loadServers();

            const item = current.find(
                x => x.id === server.id
            );

            if (!item) return;

            item.status = "running";
            item.updatedAt = new Date().toISOString();

            item.console ||= [];

            item.console.push(
                `[${new Date().toISOString()}] Neustart abgeschlossen.`
            );

            saveServers(current);
        }, 1500);

        res.redirect(`/servers/${server.id}`);
    }
);

/*
==========================================================
 DELETE SERVER
==========================================================
*/

app.post(
    "/servers/:id/delete",
    requireLogin,
    (req, res) => {
        const servers = loadServers();

        const server = servers.find(
            item => item.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden.");
        }

        if (
            server.ownerId !== req.user.id &&
            !isOwner(req.user)
        ) {
            return res.status(403).send("Kein Zugriff.");
        }

        const filtered = servers.filter(
            item => item.id !== server.id
        );

        saveServers(filtered);

        res.redirect("/servers");
    }
);

/*
==========================================================
 FILE VIEW
==========================================================
*/

app.get(
    "/servers/:id/files/:filename",
    requireLogin,
    (req, res) => {
        const servers = loadServers();

        const server = servers.find(
            item => item.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden.");
        }

        if (
            server.ownerId !== req.user.id &&
            !isOwner(req.user)
        ) {
            return res.status(403).send("Kein Zugriff.");
        }

        const filename = req.params.filename;

        if (
            !server.files ||
            typeof server.files[filename] !== "string"
        ) {
            return res.status(404).send("Datei nicht gefunden.");
        }

        res.send(
            page(
                filename,
                `
                <div class="card">

                    <h1>${escapeHTML(filename)}</h1>

                    <form method="POST"
                          action="/servers/${server.id}/files">

                        <input
                            type="hidden"
                            name="filename"
                            value="${escapeHTML(filename)}"
                        >

                        <textarea
                            name="content"
                        >${escapeHTML(server.files[filename])}</textarea>

                        <button type="submit">
                            Speichern
                        </button>

                    </form>

                    <br>

                    <a class="btn"
                       href="/servers/${server.id}">
                        Zurück zum Server
                    </a>

                </div>
                `,
                req.user
            )
        );
    }
);

/*
==========================================================
 SAVE FILE
==========================================================
*/

app.post(
    "/servers/:id/files",
    requireLogin,
    (req, res) => {
        const servers = loadServers();

        const server = servers.find(
            item => item.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden.");
        }

        if (
            server.ownerId !== req.user.id &&
            !isOwner(req.user)
        ) {
            return res.status(403).send("Kein Zugriff.");
        }

        let filename = clean(req.body.filename, 100);

        const content = String(
            req.body.content || ""
        ).slice(0, 500000);

        filename = filename
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

        if (
            !filename ||
            filename.includes("..") ||
            filename.startsWith(".env")
        ) {
            return res.status(400).send(
                "Ungültiger Dateiname."
            );
        }

        server.files ||= {};

        server.files[filename] = content;

        server.updatedAt = new Date().toISOString();

        saveServers(servers);

        res.redirect(
            `/servers/${server.id}/files/${encodeURIComponent(filename)}`
        );
    }
);

/*
==========================================================
 ADMIN PANEL
==========================================================
*/

app.get("/admin", requireOwner, (req, res) => {
    const users = loadUsers();
    const servers = loadServers();
    const orders = loadOrders();

    res.send(
        page(
            "Admin Panel",
            `
            <div class="card">

                <h1>👑 Owner Admin Panel</h1>

                <p>
                    Angemeldet als:
                    <strong>
                        ${escapeHTML(req.user.email)}
                    </strong>
                </p>

                <div class="alert">
                    Du hast vollständige Owner-Rechte.
                </div>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h3>Benutzer</h3>
                    <div class="stat">
                        ${users.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Server</h3>
                    <div class="stat">
                        ${servers.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="stat">
                        ${orders.length}
                    </div>
                </div>

            </div>

            <br>

            <div class="card">

                <h2>👥 Benutzerverwaltung</h2>

                <table>

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Coins</th>
                        <th>Status</th>
                        <th>Aktionen</th>
                    </tr>

                    ${users
                        .map(
                            user => `
                            <tr>

                                <td>
                                    ${escapeHTML(user.name)}
                                </td>

                                <td>
                                    ${escapeHTML(user.email)}
                                </td>

                                <td>
                                    ${escapeHTML(user.role)}
                                </td>

                                <td>
                                    ${user.coins || 0}
                                </td>

                                <td>
                                    ${
                                        user.banned
                                            ? "🚫 Gebannt"
                                            : "✅ Aktiv"
                                    }
                                </td>

                                <td>

                                    ${
                                        user.email.toLowerCase() !==
                                        OWNER_EMAIL
                                            ? `
                                            <div class="actions">

                                                <form method="POST"
                                                      action="/admin/users/${user.id}/coins">
                                                    <input
                                                        type="number"
                                                        name="amount"
                                                        min="1"
                                                        max="1000000"
                                                        placeholder="Coins"
                                                        style="width:110px;margin:0;"
                                                        required
                                                    >
                                                    <button class="btn-success">
                                                        + Coins
                                                    </button>
                                                </form>

                                                <form method="POST"
                                                      action="/admin/users/${user.id}/toggle-ban">

                                                    <button class="btn-danger">
                                                        ${
                                                            user.banned
                                                                ? "Entbannen"
                                                                : "Bannen"
                                                        }
                                                    </button>

                                                </form>

                                                <form method="POST"
                                                      action="/admin/users/${user.id}/role">

                                                    <select name="role"
                                                            style="width:auto;margin:0;">

                                                        <option value="user"
                                                            ${
                                                                user.role ===
                                                                "user"
                                                                    ? "selected"
                                                                    : ""
                                                            }>
                                                            User
                                                        </option>

                                                        <option value="moderator"
                                                            ${
                                                                user.role ===
                                                                "moderator"
                                                                    ? "selected"
                                                                    : ""
                                                            }>
                                                            Moderator
                                                        </option>

                                                        <option value="developer"
                                                            ${
                                                                user.role ===
                                                                "developer"
                                                                    ? "selected"
                                                                    : ""
                                                            }>
                                                            Developer
                                                        </option>

                                                    </select>

                                                    <button>
                                                        Rolle
                                                    </button>

                                                </form>

                                            </div>
                                            `
                                            : `
                                            <span class="badge">
                                                OWNER
                                            </span>
                                            `
                                    }

                                </td>

                            </tr>
                            `
                        )
                        .join("")}

                </table>

            </div>

            <br>

            <div class="card">

                <h2>🖥️ Alle Server</h2>

                <table>

                    <tr>
                        <th>Name</th>
                        <th>Owner</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Aktion</th>
                    </tr>

                    ${servers
                        .map(
                            server => `
                            <tr>

                                <td>
                                    ${escapeHTML(server.name)}
                                </td>

                                <td>
                                    ${escapeHTML(server.ownerEmail)}
                                </td>

                                <td>
                                    ${escapeHTML(server.version)}
                                </td>

                                <td>
                                    ${serverStatus(server)}
                                </td>

                                <td>

                                    <a class="btn"
                                       href="/servers/${server.id}">
                                        Öffnen
                                    </a>

                                    <form
                                        method="POST"
                                        action="/admin/servers/${server.id}/delete"
                                        style="display:inline;"
                                        onsubmit="return confirm('Server wirklich löschen?')"
                                    >
                                        <button class="btn-danger">
                                            Löschen
                                        </button>
                                    </form>

                                </td>

                            </tr>
                            `
                        )
                        .join("")}

                </table>

            </div>
            `,
            req.user
        )
    );
});

/*
==========================================================
 ADMIN: COINS
==========================================================
*/

app.post(
    "/admin/users/:id/coins",
    requireOwner,
    (req, res) => {
        const users = loadUsers();

        const user = users.find(
            item => item.id === req.params.id
        );

        if (!user) {
            return res.status(404).send("Benutzer nicht gefunden.");
        }

        if (user.email.toLowerCase() === OWNER_EMAIL) {
            return res.status(403).send(
                "Owner kann hier nicht verändert werden."
            );
        }

        const amount = Number(req.body.amount);

        if (
            !Number.isInteger(amount) ||
            amount < 1 ||
            amount > 1000000
        ) {
            return res.status(400).send(
                "Ungültige Coin-Anzahl."
            );
        }

        user.coins = Number(user.coins || 0) + amount;

        saveUsers(users);

        res.redirect("/admin");
    }
);

/*
==========================================================
 ADMIN: BAN
==========================================================
*/

app.post(
    "/admin/users/:id/toggle-ban",
    requireOwner,
    (req, res) => {
        const users = loadUsers();

        const user = users.find(
            item => item.id === req.params.id
        );

        if (!user) {
            return res.status(404).send("Benutzer nicht gefunden.");
        }

        if (
            user.email.toLowerCase() ===
            OWNER_EMAIL
        ) {
            return res.status(403).send(
                "Der Owner kann nicht gebannt werden."
            );
        }

        user.banned = !user.banned;

        saveUsers(users);

        res.redirect("/admin");
    }
);

/*
==========================================================
 ADMIN: ROLE
==========================================================
*/

app.post(
    "/admin/users/:id/role",
    requireOwner,
    (req, res) => {
        const users = loadUsers();

        const user = users.find(
            item => item.id === req.params.id
        );

        if (!user) {
            return res.status(404).send("Benutzer nicht gefunden.");
        }

        if (
            user.email.toLowerCase() ===
            OWNER_EMAIL
        ) {
            return res.status(403).send(
                "Owner-Rolle kann nicht geändert werden."
            );
        }

        const allowedRoles = [
            "user",
            "moderator",
            "developer"
        ];

        const role = String(req.body.role || "");

        if (!allowedRoles.includes(role)) {
            return res.status(400).send(
                "Ungültige Rolle."
            );
        }

        user.role = role;

        saveUsers(users);

        res.redirect("/admin");
    }
);

/*
==========================================================
 ADMIN DELETE SERVER
==========================================================
*/

app.post(
    "/admin/servers/:id/delete",
    requireOwner,
    (req, res) => {
        const servers = loadServers();

        const filtered = servers.filter(
            server => server.id !== req.params.id
        );

        saveServers(filtered);

        res.redirect("/admin");
    }
);

/*
==========================================================
 ADMIN SERVER START
==========================================================
*/

app.post(
    "/admin/servers/:id/start",
    requireOwner,
    (req, res) => {
        const servers = loadServers();

        const server = servers.find(
            item => item.id === req.params.id
        );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        server.status = "running";
        server.updatedAt = new Date().toISOString();

        server.console ||= [];

        server.console.push(
            `[${new Date().toISOString()}] Owner hat den Server gestartet.`
        );

        saveServers(servers);

        res.redirect("/admin");
    }
);

/*
==========================================================
 ADMIN SERVER STOP
==========================================================
*/

app.post(
    "/admin/servers/:id/stop",
    requireOwner,
    (req, res) => {
        const servers = loadServers();

        const server = servers.find(
            item => item.id === req.params.id
        );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        server.status = "offline";
        server.updatedAt = new Date().toISOString();

        server.console ||= [];

        server.console.push(
            `[${new Date().toISOString()}] Owner hat den Server gestoppt.`
        );

        saveServers(servers);

        res.redirect("/admin");
    }
);

/*
==========================================================
 HEALTH CHECK
==========================================================
*/

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Florian/WeisserHai Minecraft Hosting",
        time: new Date().toISOString()
    });
});

/*
==========================================================
 404
==========================================================
*/

app.use((req, res) => {
    const user = currentUser(req);

    res.status(404).send(
        page(
            "404",
            `
            <div class="card">
                <h1>404</h1>
                <p>Diese Seite wurde nicht gefunden.</p>
                <a class="btn" href="/">
                    Zur Startseite
                </a>
            </div>
            `,
            user
        )
    );
});

/*
==========================================================
 ERROR HANDLER
==========================================================
*/

app.use((err, req, res, next) => {
    console.error("Webseiten-Fehler:", err);

    res.status(500).send(
        page(
            "Serverfehler",
            `
            <div class="card">
                <h1>500</h1>
                <p>
                    Ein interner Fehler ist aufgetreten.
                </p>

                <a class="btn" href="/">
                    Zur Startseite
                </a>
            </div>
            `
        )
    );
});

/*
==========================================================
 START
==========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log(" Florian/WeisserHai Minecraft Hosting");
    console.log("======================================");
    console.log(`Server läuft auf Port: ${PORT}`);
    console.log(`Owner: ${OWNER_EMAIL}`);
    console.log("======================================");
});
