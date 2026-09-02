"use strict";

/*
==========================================================
 Florian / WeisserHai Minecraft Hosting
 komplette webseite.js
==========================================================

Start:
node webseite.js

Pakete:
npm install express express-session bcryptjs

ENV:
PORT=10000
SESSION_SECRET=ein-langes-geheimes-geheimnis

OWNER:
florianzustolberg@gmail.com

Daten:
data/users.json
data/servers.json
data/settings.json
data/logs.json

WICHTIG:
Diese Datei ist die Weboberfläche und Verwaltung.
Für echte Minecraft-Java-Prozesse muss ein Minecraft-
Backend/Docker-System angebunden werden.
==========================================================
*/

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
    "CHANGE_ME_TO_A_LONG_RANDOM_SECRET";

const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   DATEIEN
========================================================= */

function ensureFile(file, value) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(value, null, 2),
            "utf8"
        );
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);

ensureFile(SETTINGS_FILE, {
    maintenance: false,
    maintenanceText:
        "Die Minecraft-Server werden momentan gewartet.",
    globalServerLock: false
});

ensureFile(LOGS_FILE, []);

/* =========================================================
   JSON
========================================================= */

function readJSON(file, fallback) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error(
            "Fehler beim Lesen:",
            file,
            error.message
        );

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

function users() {
    return readJSON(USERS_FILE, []);
}

function servers() {
    return readJSON(SERVERS_FILE, []);
}

function settings() {
    return readJSON(SETTINGS_FILE, {
        maintenance: false,
        maintenanceText:
            "Die Minecraft-Server werden momentan gewartet.",
        globalServerLock: false
    });
}

function logs() {
    return readJSON(LOGS_FILE, []);
}

/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function uid(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(10).toString("hex")
    );
}

function now() {
    return new Date().toISOString();
}

function clean(value, max = 100) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}

function validServerName(name) {
    return /^[a-zA-Z0-9äöüÄÖÜß _.-]{2,40}$/.test(
        name
    );
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function findUserById(id) {
    return users().find(
        user => user.id === id
    );
}

function findUserByEmail(email) {
    return users().find(
        user =>
            user.email.toLowerCase() ===
            email.toLowerCase()
    );
}

function isOwner(user) {
    return (
        user &&
        user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
    );
}

function addLog(action, user, details = "") {
    const list = logs();

    list.push({
        id: uid("log"),
        action,
        userId: user ? user.id : null,
        email: user ? user.email : null,
        details,
        time: now()
    });

    if (list.length > 5000) {
        list.splice(
            0,
            list.length - 5000
        );
    }

    writeJSON(LOGS_FILE, list);
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure:
                process.env.NODE_ENV ===
                "production",
            sameSite: "lax",
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
);

/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return findUserById(
        req.session.userId
    );
}

/* =========================================================
   LOGIN MIDDLEWARE
========================================================= */

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
        req.session.destroy(() => {});

        return res.status(403).send(
            page(
                "Account gesperrt",
                `
                <div class="card">
                    <h1>🚫 Account gesperrt</h1>
                    <p>
                        Dein Account wurde vom Owner gesperrt.
                    </p>
                    <a class="btn" href="/login">
                        Zum Login
                    </a>
                </div>
                `
            )
        );
    }

    req.user = user;

    next();
}

function requireOwner(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isOwner(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card">
                    <h1>403</h1>
                    <p>
                        Dieser Bereich ist nur für den Owner.
                    </p>
                    <a class="btn" href="/">
                        Startseite
                    </a>
                </div>
                `,
                user
            )
        );
    }

    req.user = user;

    next();
}

/* =========================================================
   MAINTENANCE
========================================================= */

function maintenanceMiddleware(
    req,
    res,
    next
) {
    const current = settings();
    const user = getCurrentUser(req);

    if (
        current.maintenance &&
        !isOwner(user) &&
        !req.path.startsWith("/login") &&
        !req.path.startsWith("/register") &&
        !req.path.startsWith("/health") &&
        !req.path.startsWith("/logout")
    ) {
        return res.status(503).send(
            page(
                "Wartung",
                `
                <div class="card center">
                    <div class="big">🛠️</div>

                    <h1>Wartungsarbeiten</h1>

                    <p>
                        ${escapeHTML(
                            current.maintenanceText
                        )}
                    </p>

                    <p class="muted">
                        Bitte versuche es später erneut.
                    </p>

                    ${
                        user
                            ? `
                            <a class="btn"
                               href="/logout">
                                Logout
                            </a>
                            `
                            : ""
                    }
                </div>
                `,
                user
            )
        );
    }

    next();
}

app.use(maintenanceMiddleware);

/* =========================================================
   HTML
========================================================= */

function page(
    title,
    content,
    user = null
) {
    const owner = isOwner(user);

    const current = settings();

    return `
<!DOCTYPE html>
<html lang="de">
<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${escapeHTML(title)}
    | Florian/WeisserHai
</title>

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

    color: #fff;

    background:
        radial-gradient(
            circle at top,
            #164a7c,
            #07111f 50%,
            #03070d
        );
}

nav {
    position: sticky;
    top: 0;
    z-index: 100;

    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 20px;

    padding: 17px 5%;

    background:
        rgba(3, 8, 16, .94);

    border-bottom:
        1px solid
        rgba(255,255,255,.08);

    backdrop-filter: blur(15px);
}

.logo {
    font-size: 20px;
    font-weight: 900;
}

.navlinks {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
}

.navlinks a {
    color: #fff;
    text-decoration: none;

    padding: 9px 12px;

    border-radius: 9px;
}

.navlinks a:hover {
    background:
        rgba(255,255,255,.1);
}

.container {
    width: min(1150px, 92%);
    margin: 35px auto;
}

.hero {
    text-align: center;
    padding: 70px 10px;
}

.hero h1 {
    margin: 0;

    font-size:
        clamp(40px, 7vw, 76px);
}

.hero h2 {
    color: #7db9ff;
}

.hero p {
    color: #aab9cc;
    font-size: 18px;
}

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(250px, 1fr)
        );

    gap: 18px;
}

.card {
    background:
        rgba(10, 22, 38, .9);

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius: 18px;

    padding: 23px;

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.2);

    margin-bottom: 18px;
}

.card h1,
.card h2,
.card h3 {
    margin-top: 0;
}

.center {
    text-align: center;
}

.big {
    font-size: 60px;
}

.muted {
    color: #91a2b8;
}

.btn,
button {
    display: inline-block;

    border: 0;

    padding:
        11px 16px;

    border-radius: 10px;

    color: #fff;

    background: #247fff;

    text-decoration: none;

    cursor: pointer;

    font-weight: 700;
}

button:hover,
.btn:hover {
    filter: brightness(1.15);
}

.green {
    background: #159b69;
}

.red {
    background: #d53c52;
}

.orange {
    background: #d48a19;
}

.gray {
    background: #405066;
}

input,
select,
textarea {
    display: block;

    width: 100%;

    margin:
        7px 0 15px;

    padding: 13px;

    color: #fff;

    background: #071322;

    border:
        1px solid
        #2d415a;

    border-radius: 10px;

    outline: none;
}

textarea {
    min-height: 180px;

    resize: vertical;

    font-family: monospace;
}

.actions {
    display: flex;

    flex-wrap: wrap;

    gap: 8px;
}

.badge {
    display: inline-block;

    padding:
        5px 9px;

    border-radius: 999px;

    background:
        rgba(255,255,255,.08);

    font-size: 13px;
}

.online {
    color: #48e49b;
}

.offline {
    color: #ff6579;
}

.locked {
    color: #ffb443;
}

.stat {
    font-size: 34px;
    font-weight: 900;
}

.alert {
    padding: 14px;

    border-radius: 11px;

    margin:
        10px 0;

    background:
        rgba(37,127,255,.12);

    border:
        1px solid
        rgba(37,127,255,.3);
}

.alert-red {
    background:
        rgba(213,60,82,.13);

    border-color:
        rgba(213,60,82,.35);
}

.alert-orange {
    background:
        rgba(212,138,25,.13);

    border-color:
        rgba(212,138,25,.35);
}

table {
    width: 100%;

    border-collapse:
        collapse;

    overflow: hidden;
}

th,
td {
    padding:
        11px 7px;

    text-align: left;

    border-bottom:
        1px solid
        rgba(255,255,255,.08);
}

.code {
    padding: 15px;

    background: #02060b;

    border:
        1px solid
        #26364a;

    border-radius: 10px;

    font-family: monospace;

    overflow: auto;
}

footer {
    padding: 45px 5%;

    text-align: center;

    color: #6f8097;
}

small {
    color: #8394a9;
}

</style>

</head>

<body>

<nav>

    <div class="logo">
        ⛏️ Florian/WeisserHai
    </div>

    <div class="navlinks">

        <a href="/">
            Home
        </a>

        ${
            user
                ? `
                    <a href="/dashboard">
                        Dashboard
                    </a>

                    <a href="/servers">
                        Server
                    </a>

                    ${
                        owner
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
                        Login
                    </a>

                    <a href="/register">
                        Registrieren
                    </a>
                `
        }

    </div>

</nav>

<main class="container">

${
    current.maintenance &&
    owner
        ? `
        <div class="alert alert-orange">
            🛠️ Wartung ist aktuell
            <strong>AKTIV</strong>.
        </div>
        `
        : ""
}

${content}

</main>

<footer>
    Florian/WeisserHai Minecraft Hosting
    <br>
    <small>
        Minecraft Server Hosting
    </small>
</footer>

</body>
</html>
`;
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    const user = getCurrentUser(req);

    res.send(
        page(
            "Minecraft Hosting",
            `
            <section class="hero">

                <h1>
                    Florian/WeisserHai
                </h1>

                <h2>
                    Minecraft Hosting
                </h2>

                <p>
                    Einfach Minecraft-Server erstellen
                    und verwalten.
                </p>

                <div class="actions"
                     style="justify-content:center;">

                    ${
                        user
                            ? `
                            <a class="btn"
                               href="/dashboard">
                                Dashboard
                            </a>
                            `
                            : `
                            <a class="btn"
                               href="/register">
                                Kostenlos starten
                            </a>

                            <a class="btn gray"
                               href="/login">
                                Login
                            </a>
                            `
                    }

                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h3>🆓 Kostenloser Server</h3>
                    <p class="muted">
                        Jeder normale Benutzer kann
                        einen kostenlosen Server erstellen.
                    </p>
                </div>

                <div class="card">
                    <h3>🖥️ Verwaltung</h3>
                    <p class="muted">
                        Serverstatus, Dateien,
                        Einstellungen und Konsole.
                    </p>
                </div>

                <div class="card">
                    <h3>👑 Owner-System</h3>
                    <p class="muted">
                        Der Owner kann alle Server
                        und Benutzer verwalten.
                    </p>
                </div>

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   REGISTER
========================================================= */

app.get("/register", (req, res) => {
    if (getCurrentUser(req)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Registrieren",
            `
            <div class="card"
                 style="max-width:520px;margin:auto;">

                <h1>Account erstellen</h1>

                <form method="POST"
                      action="/register">

                    <label>Name</label>

                    <input
                        name="name"
                        minlength="2"
                        maxlength="40"
                        required
                        placeholder="Dein Name"
                    >

                    <label>E-Mail</label>

                    <input
                        name="email"
                        type="email"
                        required
                        placeholder="name@example.com"
                    >

                    <label>Passwort</label>

                    <input
                        name="password"
                        type="password"
                        minlength="6"
                        required
                        placeholder="Mindestens 6 Zeichen"
                    >

                    <button type="submit">
                        Registrieren
                    </button>

                </form>

                <p class="muted">
                    Bereits registriert?
                    <a href="/login">
                        Jetzt einloggen
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", async (req, res) => {
    const name = clean(
        req.body.name,
        40
    );

    const email = clean(
        req.body.email,
        120
    ).toLowerCase();

    const password =
        String(req.body.password || "");

    if (
        !name ||
        !validEmail(email)
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Ungültige Daten</h2>
                    <a class="btn"
                       href="/register">
                        Zurück
                    </a>
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
                    <h2>
                        Passwort zu kurz
                    </h2>

                    <p>
                        Mindestens 6 Zeichen.
                    </p>

                    <a class="btn"
                       href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    const list = users();

    if (
        list.some(
            user =>
                user.email.toLowerCase() ===
                email
        )
    ) {
        return res.status(409).send(
            page(
                "Account vorhanden",
                `
                <div class="card">
                    <h2>
                        E-Mail bereits registriert
                    </h2>

                    <a class="btn"
                       href="/login">
                        Zum Login
                    </a>
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
        id: uid("user"),

        name,
        email,

        passwordHash,

        role:
            email === OWNER_EMAIL
                ? "owner"
                : "user",

        coins: 0,

        banned: false,

        createdAt: now(),

        lastLogin: null
    };

    list.push(user);

    writeJSON(
        USERS_FILE,
        list
    );

    req.session.userId = user.id;

    addLog(
        "REGISTER",
        user,
        "Account erstellt"
    );

    res.redirect("/dashboard");
});

/* =========================================================
   LOGIN
========================================================= */

app.get("/login", (req, res) => {
    if (getCurrentUser(req)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Login",
            `
            <div class="card"
                 style="max-width:520px;margin:auto;">

                <h1>Login</h1>

                <form method="POST"
                      action="/login">

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
                    Noch keinen Account?
                    <a href="/register">
                        Registrieren
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post("/login", async (req, res) => {
    const email = clean(
        req.body.email,
        120
    ).toLowerCase();

    const password =
        String(req.body.password || "");

    const user =
        findUserByEmail(email);

    if (!user) {
        return res.status(401).send(
            page(
                "Login",
                `
                <div class="card">
                    <h2>
                        Login fehlgeschlagen
                    </h2>

                    <p>
                        E-Mail oder Passwort ist falsch.
                    </p>

                    <a class="btn"
                       href="/login">
                        Erneut versuchen
                    </a>
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
                    <h2>
                        🚫 Account gesperrt
                    </h2>

                    <p>
                        Dieser Account wurde gebannt.
                    </p>
                </div>
                `
            )
        );
    }

    const valid =
        await bcrypt.compare(
            password,
            user.passwordHash
        );

    if (!valid) {
        return res.status(401).send(
            page(
                "Login",
                `
                <div class="card">
                    <h2>
                        Login fehlgeschlagen
                    </h2>

                    <p>
                        E-Mail oder Passwort ist falsch.
                    </p>

                    <a class="btn"
                       href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    const list = users();

    const stored =
        list.find(
            x => x.id === user.id
        );

    if (stored) {
        stored.lastLogin = now();
    }

    writeJSON(
        USERS_FILE,
        list
    );

    req.session.userId = user.id;

    addLog(
        "LOGIN",
        user
    );

    res.redirect("/dashboard");
});

/* =========================================================
   LOGOUT
========================================================= */

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {
        const myServers =
            servers().filter(
                server =>
                    server.ownerId ===
                    req.user.id
            );

        const current =
            settings();

        res.send(
            page(
                "Dashboard",
                `
                <div class="card">

                    <h1>
                        Hallo
                        ${escapeHTML(
                            req.user.name
                        )}
                        👋
                    </h1>

                    <p class="muted">
                        ${escapeHTML(
                            req.user.email
                        )}
                    </p>

                    ${
                        isOwner(req.user)
                            ? `
                            <div class="alert">
                                👑
                                <strong>
                                    OWNER
                                </strong>
                                <br>
                                Du hast Zugriff auf
                                alle Server und Benutzer.
                            </div>
                            `
                            : ""
                    }

                    ${
                        current.globalServerLock &&
                        !isOwner(req.user)
                            ? `
                            <div class="alert alert-orange">
                                🔒
                                Servererstellung und
                                Serverstarts sind momentan
                                gesperrt.
                            </div>
                            `
                            : ""
                    }

                </div>

                <div class="grid">

                    <div class="card">
                        <h3>
                            🖥️ Meine Server
                        </h3>

                        <div class="stat">
                            ${myServers.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>
                            🪙 Coins
                        </h3>

                        <div class="stat">
                            ${Number(
                                req.user.coins || 0
                            )}
                        </div>
                    </div>

                    <div class="card">
                        <h3>
                            👤 Rolle
                        </h3>

                        <div class="stat">
                            ${escapeHTML(
                                req.user.role
                            ).toUpperCase()}
                        </div>
                    </div>

                </div>

                <div class="actions">

                    <a class="btn"
                       href="/servers">
                        🖥️ Meine Server
                    </a>

                    <a class="btn green"
                       href="/servers/create">
                        + Server erstellen
                    </a>

                    ${
                        isOwner(req.user)
                            ? `
                            <a class="btn orange"
                               href="/admin">
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
    }
);

/* =========================================================
   SERVER LISTE
========================================================= */

app.get(
    "/servers",
    requireLogin,
    (req, res) => {
        const list =
            servers().filter(
                server =>
                    server.ownerId ===
                    req.user.id
            );

        res.send(
            page(
                "Meine Server",
                `
                <div class="actions"
                     style="justify-content:space-between;">

                    <h1>
                        Meine Minecraft-Server
                    </h1>

                    <a class="btn green"
                       href="/servers/create">
                        + Server erstellen
                    </a>

                </div>

                <div class="grid">

                    ${
                        list.length
                            ? list
                                  .map(
                                      server =>
                                          serverCard(
                                              server,
                                              req.user
                                          )
                                  )
                                  .join("")
                            : `
                            <div class="card">

                                <h2>
                                    Noch kein Server
                                </h2>

                                <p class="muted">
                                    Du hast noch keinen
                                    Minecraft-Server.
                                </p>

                                <a class="btn"
                                   href="/servers/create">
                                    Jetzt erstellen
                                </a>

                            </div>
                            `
                    }

                </div>
                `,
                req.user
            )
        );
    }
);

function serverCard(
    server,
    user
) {
    let status;

    if (server.locked) {
        status =
            `<span class="locked">
                🔒 Gesperrt
             </span>`;
    } else if (
        server.status ===
        "running"
    ) {
        status =
            `<span class="online">
                ● Online
             </span>`;
    } else {
        status =
            `<span class="offline">
                ● Offline
             </span>`;
    }

    return `
    <div class="card">

        <h2>
            ${escapeHTML(
                server.name
            )}
        </h2>

        <p>
            ${status}
        </p>

        <p class="muted">

            Version:
            ${escapeHTML(
                server.version
            )}

            <br>

            Typ:
            ${escapeHTML(
                server.type
            )}

            <br>

            RAM:
            ${server.ram} MB

        </p>

        <div class="actions">

            <a class="btn"
               href="/servers/${server.id}">
                Verwalten
            </a>

            ${
                !server.locked
                    ? `
                    <form method="POST"
                          action="/servers/${server.id}/start">
                        <button class="green">
                            Start
                        </button>
                    </form>

                    <form method="POST"
                          action="/servers/${server.id}/stop">
                        <button class="orange">
                            Stop
                        </button>
                    </form>
                    `
                    : ""
            }

        </div>

    </div>
    `;
}

/* =========================================================
   SERVER ERSTELLEN
========================================================= */

app.get(
    "/servers/create",
    requireLogin,
    (req, res) => {
        const current =
            settings();

        const amount =
            servers().filter(
                server =>
                    server.ownerId ===
                    req.user.id
            ).length;

        if (
            !isOwner(req.user) &&
            current.globalServerLock
        ) {
            return res.status(403).send(
                page(
                    "Gesperrt",
                    `
                    <div class="card">

                        <h1>
                            🔒 Servererstellung gesperrt
                        </h1>

                        <p>
                            Der Owner hat die
                            Servererstellung momentan
                            deaktiviert.
                        </p>

                    </div>
                    `,
                    req.user
                )
            );
        }

        if (
            !isOwner(req.user) &&
            amount >= 1
        ) {
            return res.send(
                page(
                    "Limit",
                    `
                    <div class="card">

                        <h1>
                            Server-Limit erreicht
                        </h1>

                        <p>
                            Normale Benutzer können
                            einen kostenlosen Server
                            besitzen.
                        </p>

                        <a class="btn"
                           href="/servers">
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

                    <h1>
                        Minecraft-Server erstellen
                    </h1>

                    <form method="POST"
                          action="/servers/create">

                        <label>
                            Servername
                        </label>

                        <input
                            name="name"
                            minlength="2"
                            maxlength="40"
                            required
                            placeholder="Mein Server"
                        >

                        <label>
                            Minecraft-Version
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
                                1.21.5
                            </option>

                            <option>
                                1.21.4
                            </option>

                            <option>
                                1.20.6
                            </option>

                            <option>
                                1.20.4
                            </option>

                        </select>

                        <label>
                            Server-Typ
                        </label>

                        <select name="type">

                            <option>
                                Vanilla
                            </option>

                            <option>
                                Paper
                            </option>

                            <option>
                                Fabric
                            </option>

                            <option>
                                Forge
                            </option>

                        </select>

                        <button class="green"
                                type="submit">
                            Server erstellen
                        </button>

                    </form>

                </div>
                `,
                req.user
            )
        );
    }
);

app.post(
    "/servers/create",
    requireLogin,
    (req, res) => {
        const current =
            settings();

        if (
            current.globalServerLock &&
            !isOwner(req.user)
        ) {
            return res.status(403).send(
                "Servererstellung gesperrt."
            );
        }

        const name =
            clean(
                req.body.name,
                40
            );

        const version =
            clean(
                req.body.version,
                30
            );

        const type =
            clean(
                req.body.type,
                30
            );

        if (
            !validServerName(name)
        ) {
            return res.status(400).send(
                "Ungültiger Servername."
            );
        }

        const allowed =
            [
                "Vanilla",
                "Paper",
                "Fabric",
                "Forge"
            ];

        if (
            !allowed.includes(type)
        ) {
            return res.status(400).send(
                "Ungültiger Servertyp."
            );
        }

        const amount =
            servers().filter(
                server =>
                    server.ownerId ===
                    req.user.id
            ).length;

        if (
            !isOwner(req.user) &&
            amount >= 1
        ) {
            return res.status(403).send(
                "Server-Limit erreicht."
            );
        }

        const list = servers();

        const server = {
            id: uid("server"),

            ownerId:
                req.user.id,

            ownerEmail:
                req.user.email,

            name,

            version,

            type,

            status:
                "offline",

            locked:
                false,

            lockReason:
                null,

            ram:
                2048,

            cpu:
                100,

            storage:
                10240,

            createdAt:
                now(),

            updatedAt:
                now(),

            files: {
                "server.properties":
                    `motd=${name}\n` +
                    "max-players=20\n" +
                    "online-mode=true\n" +
                    "difficulty=normal\n" +
                    "gamemode=survival\n",

                "README.txt":
                    "Florian/WeisserHai Minecraft Server\n"
            },

            console: [],

            settings: {
                whitelist:
                    false,

                backup:
                    true,

                autoStart:
                    false
            }
        };

        list.push(server);

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            "SERVER_CREATE",
            req.user,
            server.name
        );

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   SERVER DETAIL
========================================================= */

app.get(
    "/servers/:id",
    requireLogin,
    (req, res) => {
        const server =
            servers().find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        if (
            server.ownerId !==
                req.user.id &&
            !isOwner(req.user)
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        const files =
            Object.keys(
                server.files || {}
            );

        res.send(
            page(
                server.name,
                `
                <div class="card">

                    <h1>
                        ${escapeHTML(
                            server.name
                        )}
                    </h1>

                    <p>
                        ${
                            server.locked
                                ? `
                                <span class="locked">
                                    🔒 Gesperrt
                                </span>
                                `
                                : server.status ===
                                  "running"
                                ? `
                                <span class="online">
                                    ● Online
                                </span>
                                `
                                : `
                                <span class="offline">
                                    ● Offline
                                </span>
                                `
                        }
                    </p>

                    ${
                        server.locked
                            ? `
                            <div class="alert alert-red">
                                Dieser Server wurde gesperrt.

                                ${
                                    server.lockReason
                                        ? `
                                        <br>
                                        Grund:
                                        ${escapeHTML(
                                            server.lockReason
                                        )}
                                        `
                                        : ""
                                }
                            </div>
                            `
                            : ""
                    }

                    <p class="muted">

                        Server-ID:
                        ${escapeHTML(
                            server.id
                        )}

                        <br>

                        Version:
                        ${escapeHTML(
                            server.version
                        )}

                        <br>

                        Typ:
                        ${escapeHTML(
                            server.type
                        )}

                    </p>

                    <div class="actions">

                        ${
                            !server.locked
                                ? `
                                <form method="POST"
                                      action="/servers/${server.id}/start">

                                    <button class="green">
                                        ▶ Start
                                    </button>

                                </form>

                                <form method="POST"
                                      action="/servers/${server.id}/stop">

                                    <button class="orange">
                                        ■ Stop
                                    </button>

                                </form>

                                <form method="POST"
                                      action="/servers/${server.id}/restart">

                                    <button>
                                        ↻ Neustart
                                    </button>

                                </form>
                                `
                                : ""
                        }

                        ${
                            isOwner(req.user)
                                ? `
                                <form method="POST"
                                      action="/admin/servers/${server.id}/toggle-lock">

                                    <button class="orange">
                                        ${
                                            server.locked
                                                ? "🔓 Entsperren"
                                                : "🔒 Sperren"
                                        }
                                    </button>

                                </form>
                                `
                                : ""
                        }

                        <form method="POST"
                              action="/servers/${server.id}/delete"
                              onsubmit="return confirm('Server wirklich löschen?')">

                            <button class="red">
                                🗑️ Löschen
                            </button>

                        </form>

                    </div>

                </div>

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

                <div class="card">

                    <h2>
                        📁 Serverdateien
                    </h2>

                    ${
                        files.length
                            ? files
                                  .map(
                                      file =>
                                          `
                                          <p>
                                              <a class="btn gray"
                                                 href="/servers/${server.id}/files/${encodeURIComponent(file)}">
                                                  ${escapeHTML(
                                                      file
                                                  )}
                                              </a>
                                          </p>
                                          `
                                  )
                                  .join("")
                            : "<p>Keine Dateien.</p>"
                    }

                </div>

                <div class="card">

                    <h2>
                        📝 Datei erstellen / bearbeiten
                    </h2>

                    <form method="POST"
                          action="/servers/${server.id}/files">

                        <label>
                            Dateiname
                        </label>

                        <input
                            name="filename"
                            maxlength="100"
                            required
                            placeholder="plugins/mein-plugin.txt"
                        >

                        <label>
                            Inhalt / Code
                        </label>

                        <textarea
                            name="content"
                            placeholder="Hier deinen Code eintragen..."
                        ></textarea>

                        <button>
                            Datei speichern
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        🖥️ Konsole
                    </h2>

                    <div class="code">

                        ${
                            server.console &&
                            server.console.length
                                ? server.console
                                      .slice(-100)
                                      .map(
                                          x =>
                                              escapeHTML(
                                                  x
                                              )
                                      )
                                      .join(
                                          "<br>"
                                      )
                                : "Keine Einträge."
                        }

                    </div>

                </div>
                `,
                req.user
            )
        );
    }
);

/* =========================================================
   SERVER GET OWNED
========================================================= */

function getServerForUser(
    req
) {
    const list = servers();

    const server =
        list.find(
            x =>
                x.id ===
                req.params.id
        );

    if (!server) {
        return null;
    }

    if (
        server.ownerId !==
            req.user.id &&
        !isOwner(req.user)
    ) {
        return null;
    }

    return {
        server,
        list
    };
}

/* =========================================================
   START
========================================================= */

app.post(
    "/servers/:id/start",
    requireLogin,
    (req, res) => {
        const result =
            getServerForUser(req);

        if (!result) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const current =
            settings();

        const server =
            result.server;

        if (
            current.globalServerLock &&
            !isOwner(req.user)
        ) {
            return res.status(403).send(
                "Serverstarts sind momentan gesperrt."
            );
        }

        if (server.locked) {
            return res.status(403).send(
                "Dieser Server ist gesperrt."
            );
        }

        server.status =
            "starting";

        server.updatedAt =
            now();

        server.console ||= [];

        server.console.push(
            `[${now()}] Server wird gestartet.`
        );

        writeJSON(
            SERVERS_FILE,
            result.list
        );

        addLog(
            "SERVER_START",
            req.user,
            server.name
        );

        /*
        HIER später:
        echtes Minecraft Backend / Docker
        */

        setTimeout(() => {
            const list =
                servers();

            const item =
                list.find(
                    x =>
                        x.id ===
                        server.id
                );

            if (!item) {
                return;
            }

            if (item.locked) {
                item.status =
                    "offline";

                writeJSON(
                    SERVERS_FILE,
                    list
                );

                return;
            }

            item.status =
                "running";

            item.updatedAt =
                now();

            item.console ||= [];

            item.console.push(
                `[${now()}] Server ist online.`
            );

            writeJSON(
                SERVERS_FILE,
                list
            );
        }, 1500);

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   STOP
========================================================= */

app.post(
    "/servers/:id/stop",
    requireLogin,
    (req, res) => {
        const result =
            getServerForUser(req);

        if (!result) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const server =
            result.server;

        server.status =
            "stopping";

        server.console ||= [];

        server.console.push(
            `[${now()}] Server wird gestoppt.`
        );

        server.updatedAt =
            now();

        writeJSON(
            SERVERS_FILE,
            result.list
        );

        addLog(
            "SERVER_STOP",
            req.user,
            server.name
        );

        setTimeout(() => {
            const list =
                servers();

            const item =
                list.find(
                    x =>
                        x.id ===
                        server.id
                );

            if (!item) {
                return;
            }

            item.status =
                "offline";

            item.updatedAt =
                now();

            item.console ||= [];

            item.console.push(
                `[${now()}] Server ist offline.`
            );

            writeJSON(
                SERVERS_FILE,
                list
            );
        }, 1000);

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   RESTART
========================================================= */

app.post(
    "/servers/:id/restart",
    requireLogin,
    (req, res) => {
        const result =
            getServerForUser(req);

        if (!result) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const server =
            result.server;

        if (server.locked) {
            return res.status(403).send(
                "Server ist gesperrt."
            );
        }

        server.status =
            "starting";

        server.console ||= [];

        server.console.push(
            `[${now()}] Server wird neu gestartet.`
        );

        writeJSON(
            SERVERS_FILE,
            result.list
        );

        addLog(
            "SERVER_RESTART",
            req.user,
            server.name
        );

        setTimeout(() => {
            const list =
                servers();

            const item =
                list.find(
                    x =>
                        x.id ===
                        server.id
                );

            if (!item) {
                return;
            }

            item.status =
                "running";

            item.updatedAt =
                now();

            item.console ||= [];

            item.console.push(
                `[${now()}] Neustart abgeschlossen.`
            );

            writeJSON(
                SERVERS_FILE,
                list
            );
        }, 1500);

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   DELETE
========================================================= */

app.post(
    "/servers/:id/delete",
    requireLogin,
    (req, res) => {
        const list =
            servers();

        const server =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        if (
            server.ownerId !==
                req.user.id &&
            !isOwner(req.user)
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        const newList =
            list.filter(
                x =>
                    x.id !==
                    server.id
            );

        writeJSON(
            SERVERS_FILE,
            newList
        );

        addLog(
            "SERVER_DELETE",
            req.user,
            server.name
        );

        res.redirect("/servers");
    }
);

/* =========================================================
   FILES
========================================================= */

app.get(
    "/servers/:id/files/:filename",
    requireLogin,
    (req, res) => {
        const result =
            getServerForUser(req);

        if (!result) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const filename =
            req.params.filename;

        const content =
            result.server.files &&
            result.server.files[
                filename
            ];

        if (
            typeof content !==
            "string"
        ) {
            return res.status(404).send(
                "Datei nicht gefunden."
            );
        }

        res.send(
            page(
                filename,
                `
                <div class="card">

                    <h1>
                        📄
                        ${escapeHTML(
                            filename
                        )}
                    </h1>

                    <form method="POST"
                          action="/servers/${result.server.id}/files">

                        <input
                            type="hidden"
                            name="filename"
                            value="${escapeHTML(
                                filename
                            )}"
                        >

                        <textarea
                            name="content"
                        >${escapeHTML(
                            content
                        )}</textarea>

                        <button>
                            Speichern
                        </button>

                    </form>

                    <br>

                    <a class="btn gray"
                       href="/servers/${result.server.id}">
                        Zurück
                    </a>

                </div>
                `,
                req.user
            )
        );
    }
);

/* =========================================================
   SAVE FILE
========================================================= */

app.post(
    "/servers/:id/files",
    requireLogin,
    (req, res) => {
        const result =
            getServerForUser(req);

        if (!result) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        let filename =
            clean(
                req.body.filename,
                100
            );

        const content =
            String(
                req.body.content || ""
            ).slice(
                0,
                500000
            );

        filename =
            filename
                .replace(
                    /\\/g,
                    "/"
                )
                .replace(
                    /^\/+/,
                    ""
                );

        if (
            !filename ||
            filename.includes(
                ".."
            ) ||
            filename.startsWith(
                ".env"
            )
        ) {
            return res.status(400).send(
                "Ungültiger Dateiname."
            );
        }

        result.server.files ||=
            {};

        result.server.files[
            filename
        ] = content;

        result.server.updatedAt =
            now();

        writeJSON(
            SERVERS_FILE,
            result.list
        );

        addLog(
            "FILE_SAVE",
            req.user,
            `${result.server.name}: ${filename}`
        );

        res.redirect(
            `/servers/${result.server.id}/files/${encodeURIComponent(filename)}`
        );
    }
);

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get(
    "/admin",
    requireOwner,
    (req, res) => {
        const userList =
            users();

        const serverList =
            servers();

        const logList =
            logs()
                .slice(-100)
                .reverse();

        const current =
            settings();

        res.send(
            page(
                "Owner Admin Panel",
                `
                <div class="card">

                    <h1>
                        👑 Owner Admin Panel
                    </h1>

                    <p>
                        Angemeldet als:
                        <strong>
                            ${escapeHTML(
                                req.user.email
                            )}
                        </strong>
                    </p>

                    <div class="alert">
                        Du hast vollständige
                        Owner-Rechte.
                    </div>

                </div>

                <div class="grid">

                    <div class="card">
                        <h3>
                            👥 Benutzer
                        </h3>

                        <div class="stat">
                            ${userList.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>
                            🖥️ Server
                        </h3>

                        <div class="stat">
                            ${serverList.length}
                        </div>
                    </div>

                    <div class="card">
                        <h3>
                            📋 Logs
                        </h3>

                        <div class="stat">
                            ${logs().length}
                        </div>
                    </div>

                </div>

                <div class="card">

                    <h2>
                        🛠️ Globale Verwaltung
                    </h2>

                    <p>
                        Wartung:
                        ${
                            current.maintenance
                                ? `
                                <strong class="orange">
                                    AKTIV
                                </strong>
                                `
                                : `
                                <strong class="online">
                                    AUS
                                </strong>
                                `
                        }
                    </p>

                    <form method="POST"
                          action="/admin/maintenance">

                        <label>
                            Wartungstext
                        </label>

                        <input
                            name="text"
                            maxlength="300"
                            value="${escapeHTML(
                                current.maintenanceText
                            )}"
                        >

                        <button
                            class="orange"
                            type="submit">

                            ${
                                current.maintenance
                                    ? "🟢 Wartung beenden"
                                    : "🛠️ Wartung aktivieren"
                            }

                        </button>

                    </form>

                    <hr>

                    <h3>
                        🔒 Globale Serversperre
                    </h3>

                    <p class="muted">
                        Wenn aktiviert, können normale
                        Benutzer keine Server starten.
                    </p>

                    <form method="POST"
                          action="/admin/global-lock">

                        <button class="orange">
                            ${
                                current.globalServerLock
                                    ? "🔓 Globale Sperre deaktivieren"
                                    : "🔒 Globale Sperre aktivieren"
                            }
                        </button>

                    </form>

                    <hr>

                    <h3>
                        🚨 Notfall
                    </h3>

                    <form method="POST"
                          action="/admin/shutdown-all"
                          onsubmit="return confirm('ALLE Server herunterfahren?')">

                        <button class="red">
                            🛑 ALLE SERVER HERUNTERFAHREN
                        </button>

                    </form>

                    <br>

                    <form method="POST"
                          action="/admin/lock-all"
                          onsubmit="return confirm('ALLE Server sperren?')">

                        <button class="orange">
                            🔒 ALLE SERVER SPERREN
                        </button>

                    </form>

                    <br>

                    <form method="POST"
                          action="/admin/unlock-all">

                        <button class="green">
                            🔓 ALLE SERVER ENTSPERREN
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        🖥️ Alle Server
                    </h2>

                    <table>

                        <tr>
                            <th>Name</th>
                            <th>Besitzer</th>
                            <th>Status</th>
                            <th>Aktionen</th>
                        </tr>

                        ${
                            serverList.length
                                ? serverList
                                      .map(
                                          server =>
                                              `
                                              <tr>

                                                  <td>
                                                      ${escapeHTML(
                                                          server.name
                                                      )}
                                                  </td>

                                                  <td>
                                                      ${escapeHTML(
                                                          server.ownerEmail
                                                      )}
                                                  </td>

                                                  <td>
                                                      ${
                                                          server.locked
                                                              ? "🔒 Gesperrt"
                                                              : server.status ===
                                                                "running"
                                                              ? "🟢 Online"
                                                              : "🔴 Offline"
                                                      }
                                                  </td>

                                                  <td>

                                                      <div class="actions">

                                                          <a class="btn"
                                                             href="/servers/${server.id}">
                                                              Öffnen
                                                          </a>

                                                          <form method="POST"
                                                                action="/admin/servers/${server.id}/toggle-lock">

                                                              <button class="orange">
                                                                  ${
                                                                      server.locked
                                                                          ? "Entsperren"
                                                                          : "Sperren"
                                                                  }
                                                              </button>

                                                          </form>

                                                          <form method="POST"
                                                                action="/admin/servers/${server.id}/stop">

                                                              <button class="orange">
                                                                  Stop
                                                              </button>

                                                          </form>

                                                          <form method="POST"
                                                                action="/admin/servers/${server.id}/delete"
                                                                onsubmit="return confirm('Server wirklich löschen?')">

                                                              <button class="red">
                                                                  Löschen
                                                              </button>

                                                          </form>

                                                      </div>

                                                  </td>

                                              </tr>
                                              `
                                      )
                                      .join("")
                                : `
                                <tr>
                                    <td colspan="4">
                                        Keine Server.
                                    </td>
                                </tr>
                                `
                        }

                    </table>

                </div>

                <div class="card">

                    <h2>
                        👥 Benutzerverwaltung
                    </h2>

                    <table>

                        <tr>
                            <th>Name</th>
                            <th>E-Mail</th>
                            <th>Rolle</th>
                            <th>Coins</th>
                            <th>Status</th>
                            <th>Aktionen</th>
                        </tr>

                        ${
                            userList
                                .map(
                                    user =>
                                        `
                                        <tr>

                                            <td>
                                                ${escapeHTML(
                                                    user.name
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    user.email
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    user.role
                                                )}
                                            </td>

                                            <td>
                                                ${Number(
                                                    user.coins || 0
                                                )}
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
                                                    isOwner(user)
                                                        ? `
                                                        <span class="badge">
                                                            👑 OWNER
                                                        </span>
                                                        `
                                                        : `
                                                        <div class="actions">

                                                            <form method="POST"
                                                                  action="/admin/users/${user.id}/coins">

                                                                <input
                                                                    type="number"
                                                                    name="amount"
                                                                    min="1"
                                                                    max="1000000"
                                                                    required
                                                                    placeholder="Coins"
                                                                    style="width:100px;margin:0;"
                                                                >

                                                                <button class="green">
                                                                    + Coins
                                                                </button>

                                                            </form>

                                                            <form method="POST"
                                                                  action="/admin/users/${user.id}/toggle-ban">

                                                                <button class="red">
                                                                    ${
                                                                        user.banned
                                                                            ? "Entbannen"
                                                                            : "Bannen"
                                                                    }
                                                                </button>

                                                            </form>

                                                            <form method="POST"
                                                                  action="/admin/users/${user.id}/role">

                                                                <select
                                                                    name="role"
                                                                    style="width:130px;margin:0;"
                                                                >

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
                                                }

                                            </td>

                                        </tr>
                                        `
                                )
                                .join("")
                        }

                    </table>

                </div>

                <div class="card">

                    <h2>
                        📋 Owner-Logs
                    </h2>

                    ${
                        logList.length
                            ? `
                            <table>

                                <tr>
                                    <th>Zeit</th>
                                    <th>Aktion</th>
                                    <th>E-Mail</th>
                                    <th>Details</th>
                                </tr>

                                ${logList
                                    .map(
                                        log =>
                                            `
                                            <tr>

                                                <td>
                                                    ${escapeHTML(
                                                        log.time
                                                    )}
                                                </td>

                                                <td>
                                                    ${escapeHTML(
                                                        log.action
                                                    )}
                                                </td>

                                                <td>
                                                    ${escapeHTML(
                                                        log.email ||
                                                        "-"
                                                    )}
                                                </td>

                                                <td>
                                                    ${escapeHTML(
                                                        log.details ||
                                                        ""
                                                    )}
                                                </td>

                                            </tr>
                                            `
                                    )
                                    .join("")}

                            </table>
                            `
                            : `
                            <p>
                                Keine Logs.
                            </p>
                            `
                    }

                </div>
                `,
                req.user
            )
        );
    }
);

/* =========================================================
   ADMIN MAINTENANCE
========================================================= */

app.post(
    "/admin/maintenance",
    requireOwner,
    (req, res) => {
        const current =
            settings();

        current.maintenance =
            !current.maintenance;

        const text =
            clean(
                req.body.text,
                300
            );

        if (text) {
            current.maintenanceText =
                text;
        }

        writeJSON(
            SETTINGS_FILE,
            current
        );

        addLog(
            current.maintenance
                ? "MAINTENANCE_ON"
                : "MAINTENANCE_OFF",
            req.user,
            current.maintenanceText
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   GLOBAL LOCK
========================================================= */

app.post(
    "/admin/global-lock",
    requireOwner,
    (req, res) => {
        const current =
            settings();

        current.globalServerLock =
            !current.globalServerLock;

        writeJSON(
            SETTINGS_FILE,
            current
        );

        addLog(
            current.globalServerLock
                ? "GLOBAL_SERVER_LOCK_ON"
                : "GLOBAL_SERVER_LOCK_OFF",
            req.user
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   SHUTDOWN ALL
========================================================= */

app.post(
    "/admin/shutdown-all",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        for (const server of list) {
            server.status =
                "offline";

            server.updatedAt =
                now();

            server.console ||= [];

            server.console.push(
                `[${now()}] Owner: Alle Server wurden heruntergefahren.`
            );
        }

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            "GLOBAL_SHUTDOWN",
            req.user,
            `${list.length} Server heruntergefahren`
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   LOCK ALL
========================================================= */

app.post(
    "/admin/lock-all",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        for (const server of list) {
            server.locked =
                true;

            server.lockReason =
                "Vom Owner gesperrt.";

            server.status =
                "offline";

            server.updatedAt =
                now();

            server.console ||= [];

            server.console.push(
                `[${now()}] Owner: Server gesperrt.`
            );
        }

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            "LOCK_ALL_SERVERS",
            req.user,
            `${list.length} Server gesperrt`
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   UNLOCK ALL
========================================================= */

app.post(
    "/admin/unlock-all",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        for (const server of list) {
            server.locked =
                false;

            server.lockReason =
                null;

            server.updatedAt =
                now();
        }

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            "UNLOCK_ALL_SERVERS",
            req.user,
            `${list.length} Server entsperrt`
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   ADMIN SERVER LOCK
========================================================= */

app.post(
    "/admin/servers/:id/toggle-lock",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        const server =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        server.locked =
            !server.locked;

        server.lockReason =
            server.locked
                ? "Vom Owner gesperrt."
                : null;

        if (server.locked) {
            server.status =
                "offline";
        }

        server.updatedAt =
            now();

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            server.locked
                ? "SERVER_LOCK"
                : "SERVER_UNLOCK",
            req.user,
            server.name
        );

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   ADMIN SERVER STOP
========================================================= */

app.post(
    "/admin/servers/:id/stop",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        const server =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        server.status =
            "offline";

        server.updatedAt =
            now();

        server.console ||= [];

        server.console.push(
            `[${now()}] Owner hat den Server gestoppt.`
        );

        writeJSON(
            SERVERS_FILE,
            list
        );

        addLog(
            "OWNER_SERVER_STOP",
            req.user,
            server.name
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   ADMIN SERVER DELETE
========================================================= */

app.post(
    "/admin/servers/:id/delete",
    requireOwner,
    (req, res) => {
        const list =
            servers();

        const server =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const newList =
            list.filter(
                x =>
                    x.id !==
                    server.id
            );

        writeJSON(
            SERVERS_FILE,
            newList
        );

        addLog(
            "OWNER_SERVER_DELETE",
            req.user,
            server.name
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   ADMIN COINS
========================================================= */

app.post(
    "/admin/users/:id/coins",
    requireOwner,
    (req, res) => {
        const list =
            users();

        const user =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!user) {
            return res.status(404).send(
                "Benutzer nicht gefunden."
            );
        }

        if (isOwner(user)) {
            return res.status(403).send(
                "Owner kann nicht verändert werden."
            );
        }

        const amount =
            Number(
                req.body.amount
            );

        if (
            !Number.isInteger(
                amount
            ) ||
            amount < 1 ||
            amount > 1000000
        ) {
            return res.status(400).send(
                "Ungültige Coin-Anzahl."
            );
        }

        user.coins =
            Number(
                user.coins || 0
            ) + amount;

        writeJSON(
            USERS_FILE,
            list
        );

        addLog(
            "ADD_COINS",
            req.user,
            `${user.email}: +${amount} Coins`
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   ADMIN BAN
========================================================= */

app.post(
    "/admin/users/:id/toggle-ban",
    requireOwner,
    (req, res) => {
        const list =
            users();

        const user =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!user) {
            return res.status(404).send(
                "Benutzer nicht gefunden."
            );
        }

        if (isOwner(user)) {
            return res.status(403).send(
                "Der Owner kann nicht gebannt werden."
            );
        }

        user.banned =
            !user.banned;

        writeJSON(
            USERS_FILE,
            list
        );

        addLog(
            user.banned
                ? "USER_BAN"
                : "USER_UNBAN",
            req.user,
            user.email
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   ADMIN ROLE
========================================================= */

app.post(
    "/admin/users/:id/role",
    requireOwner,
    (req, res) => {
        const list =
            users();

        const user =
            list.find(
                x =>
                    x.id ===
                    req.params.id
            );

        if (!user) {
            return res.status(404).send(
                "Benutzer nicht gefunden."
            );
        }

        if (isOwner(user)) {
            return res.status(403).send(
                "Owner-Rolle kann nicht geändert werden."
            );
        }

        const allowed = [
            "user",
            "moderator",
            "developer"
        ];

        const role =
            clean(
                req.body.role,
                30
            );

        if (
            !allowed.includes(
                role
            )
        ) {
            return res.status(400).send(
                "Ungültige Rolle."
            );
        }

        user.role =
            role;

        writeJSON(
            USERS_FILE,
            list
        );

        addLog(
            "ROLE_CHANGE",
            req.user,
            `${user.email}: ${role}`
        );

        res.redirect("/admin");
    }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {
        res.json({
            ok: true,
            service:
                "Florian/WeisserHai Minecraft Hosting",
            time: now()
        });
    }
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {
        const user =
            getCurrentUser(req);

        res.status(404).send(
            page(
                "404",
                `
                <div class="card center">

                    <div class="big">
                        404
                    </div>

                    <h2>
                        Seite nicht gefunden
                    </h2>

                    <a class="btn"
                       href="/">
                        Zur Startseite
                    </a>

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   ERROR
========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "Webseitenfehler:",
            error
        );

        res.status(500).send(
            page(
                "Fehler",
                `
                <div class="card center">

                    <div class="big">
                        ⚠️
                    </div>

                    <h1>
                        Interner Fehler
                    </h1>

                    <p>
                        Die Anfrage konnte
                        nicht verarbeitet werden.
                    </p>

                    <a class="btn"
                       href="/">
                        Startseite
                    </a>

                </div>
                `
            )
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
            "======================================"
        );

        console.log(
            " Florian/WeisserHai Minecraft Hosting"
        );

        console.log(
            "======================================"
        );

        console.log(
            `Server läuft auf Port: ${PORT}`
        );

        console.log(
            `Owner: ${OWNER_EMAIL}`
        );

        console.log(
            "======================================"
        );
    }
);
