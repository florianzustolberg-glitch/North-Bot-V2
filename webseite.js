// ============================================================
// NORTH-BOT-2 WEBSEITE
// ============================================================
// Start:
//   node webseite.js
//
// Render Start Command:
//   node webseite.js
//
// Benötigte Pakete:
//   express
//   express-session
//   bcryptjs
//
// Keine .env benötigt.
// ============================================================

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// KONFIGURATION
// ============================================================

const app = express();

const PORT = process.env.PORT || 10000;

const SITE_NAME = "North-Bot-2";

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

const TICKET_CATEGORY_ID = "1493423287118729328";

const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const CODES_FILE = path.join(DATA_DIR, "codes.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const GIVEAWAYS_FILE = path.join(DATA_DIR, "giveaways.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const TEAM_CHAT_FILE = path.join(DATA_DIR, "team-chat.json");

// ============================================================
// DATENORDNER
// ============================================================

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
// JSON HILFSFUNKTIONEN
// ============================================================

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            ensureFile(file, fallback);
            return fallback;
        }

        const content = fs.readFileSync(file, "utf8");

        if (!content.trim()) {
            return fallback;
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("JSON Fehler:", file, error.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ============================================================
// DATEIEN ANLEGEN
// ============================================================

ensureFile(USERS_FILE, []);
ensureFile(TICKETS_FILE, []);
ensureFile(LOGS_FILE, []);
ensureFile(CODES_FILE, []);
ensureFile(PRODUCTS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(GIVEAWAYS_FILE, []);
ensureFile(SETTINGS_FILE, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich derzeit in Wartung.",
    disturbance: false,
    disturbanceText: "Aktuell kann es zu Einschränkungen kommen.",
    announcement: ""
});
ensureFile(CHAT_FILE, []);
ensureFile(TEAM_CHAT_FILE, []);

// ============================================================
// DEFAULT OWNER
// ============================================================

function createOwnerIfMissing() {
    const users = readJSON(USERS_FILE, []);

    const exists = users.some(
        user => user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
    );

    if (!exists) {
        const password = crypto.randomBytes(18).toString("hex");

        const owner = {
            id: crypto.randomUUID(),
            username: "Florian",
            email: OWNER_EMAIL,
            password: bcrypt.hashSync(password, 12),
            role: "owner",
            coins: 0,
            banned: false,
            banUntil: null,
            banReason: null,
            createdAt: new Date().toISOString(),
            lastDaily: null
        };

        users.push(owner);
        writeJSON(USERS_FILE, users);

        console.log("======================================");
        console.log("OWNER ANGELEGT");
        console.log("E-Mail:", OWNER_EMAIL);
        console.log("Passwort:", password);
        console.log("======================================");
    }
}

createOwnerIfMissing();

// ============================================================
// EXPRESS
// ============================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "north-bot-2-session-secret-change-this",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

// ============================================================
// ESCAPE
// ============================================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// ID / CODES
// ============================================================

function randomPart(length = 4) {
    const chars = "0123456789";

    let result = "";

    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
}

function generateCoinCode() {
    let code;

    const codes = readJSON(CODES_FILE, []);

    do {
        code = "NORTH-" + randomPart(4) + "-" + randomPart(4);
    } while (codes.some(item => item.code === code));

    return code;
}

function generateOrderNumber() {
    return (
        "NB-" +
        new Date().getFullYear() +
        "-" +
        randomPart(4) +
        "-" +
        randomPart(4)
    );
}

function generateBetaNumber() {
    return (
        "BETA-" +
        randomPart(4) +
        "-" +
        randomPart(4)
    );
}

// ============================================================
// LOG SYSTEM
// ============================================================

function addLog(type, message, user = null) {
    const logs = readJSON(LOGS_FILE, []);

    logs.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        userId: user ? user.id : null,
        username: user ? user.username : null,
        time: new Date().toISOString()
    });

    if (logs.length > 1000) {
        logs.splice(1000);
    }

    writeJSON(LOGS_FILE, logs);
}

// ============================================================
// USER
// ============================================================

function getUsers() {
    return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
    writeJSON(USERS_FILE, users);
}

function getCurrentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    const users = getUsers();

    return (
        users.find(user => user.id === req.session.userId) ||
        null
    );
}

function findUserByEmail(email) {
    const users = getUsers();

    return users.find(
        user =>
            user.email.toLowerCase() ===
            email.toLowerCase()
    );
}

// ============================================================
// ROLLEN
// ============================================================

const STAFF_ROLES = [
    "owner",
    "admin",
    "manager",
    "developer",
    "moderator"
];

function isStaff(user) {
    return user && STAFF_ROLES.includes(user.role);
}

function isOwner(user) {
    return user && user.role === "owner";
}

function canManageUsers(user) {
    return user && ["owner", "admin", "manager"].includes(user.role);
}

function canManageShop(user) {
    return user && ["owner", "admin", "manager"].includes(user.role);
}

function canManageGiveaways(user) {
    return user && ["owner", "admin", "manager"].includes(user.role);
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
        const now = Date.now();

        if (
            user.banUntil &&
            new Date(user.banUntil).getTime() <= now
        ) {
            user.banned = false;
            user.banUntil = null;
            user.banReason = null;

            const users = getUsers();
            const index = users.findIndex(
                item => item.id === user.id
            );

            if (index !== -1) {
                users[index] = user;
                saveUsers(users);
            }
        } else {
            req.session.destroy(() => {
                res.redirect("/banned");
            });

            return;
        }
    }

    req.user = user;

    next();
}

function requireStaff(req, res, next) {
    const user = getCurrentUser(req);

    if (!user || !isStaff(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Du hast keine Berechtigung für diesen Bereich.</p>
                    <a class="button" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    req.user = user;

    next();
}

// ============================================================
// HTML
// ============================================================

function page(title, content, req = null) {
    const user = req ? getCurrentUser(req) : null;

    const settings = readJSON(SETTINGS_FILE, {});

    let alerts = "";

    if (settings.maintenance) {
        alerts += `
        <div class="alert maintenance">
            <strong>Wartung</strong>
            <span>${escapeHTML(settings.maintenanceText)}</span>
        </div>
        `;
    }

    if (settings.disturbance) {
        alerts += `
        <div class="alert disturbance">
            <strong>Störung</strong>
            <span>${escapeHTML(settings.disturbanceText)}</span>
        </div>
        `;
    }

    if (settings.announcement) {
        alerts += `
        <div class="alert announcement">
            <strong>Ankündigung</strong>
            <span>${escapeHTML(settings.announcement)}</span>
        </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHTML(title)} | ${SITE_NAME}</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family:
        Inter,
        Arial,
        Helvetica,
        sans-serif;
    background: #0b0d11;
    color: #f4f5f7;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    background: #101319;
    border-bottom: 1px solid #20242d;
    position: sticky;
    top: 0;
    z-index: 100;
}

.logo {
    font-weight: 800;
    font-size: 20px;
    letter-spacing: -0.5px;
}

.logo span {
    color: #7c8cff;
}

.navlinks {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.navlinks a {
    color: #aeb4c1;
    padding: 9px 12px;
    border-radius: 8px;
}

.navlinks a:hover {
    background: #181c24;
    color: #fff;
}

.container {
    width: min(1180px, calc(100% - 30px));
    margin: 0 auto;
}

main {
    padding: 40px 0 70px;
}

.hero {
    padding: 70px 0;
}

.hero h1 {
    font-size: clamp(42px, 8vw, 78px);
    line-height: .95;
    margin: 0 0 20px;
    letter-spacing: -4px;
}

.hero h1 span {
    color: #8995ff;
}

.hero p {
    max-width: 680px;
    color: #aeb4c1;
    font-size: 18px;
    line-height: 1.7;
}

.buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 28px;
}

.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 17px;
    border-radius: 9px;
    border: 1px solid #2a2f3a;
    background: #181c24;
    color: #fff;
    cursor: pointer;
}

.button:hover {
    background: #202530;
}

.button.primary {
    background: #7784ff;
    border-color: #7784ff;
}

.button.primary:hover {
    background: #6976ee;
}

.button.danger {
    background: #8e3030;
    border-color: #8e3030;
}

.button.green {
    background: #28734d;
    border-color: #28734d;
}

.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.grid.two {
    grid-template-columns: repeat(2, 1fr);
}

.grid.four {
    grid-template-columns: repeat(4, 1fr);
}

.card {
    background: #11151c;
    border: 1px solid #222832;
    border-radius: 12px;
    padding: 22px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.card p {
    color: #aeb4c1;
    line-height: 1.6;
}

.stat {
    font-size: 30px;
    font-weight: 800;
}

.muted {
    color: #8f97a5;
}

form {
    display: grid;
    gap: 13px;
}

input,
textarea,
select {
    width: 100%;
    background: #0b0e13;
    color: #fff;
    border: 1px solid #2b313c;
    border-radius: 8px;
    padding: 12px 13px;
    outline: none;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

input:focus,
textarea:focus,
select:focus {
    border-color: #7885ff;
}

label {
    color: #b8beca;
    font-size: 14px;
}

.alert {
    margin: 15px auto;
    width: min(1180px, calc(100% - 30px));
    padding: 14px 17px;
    border-radius: 9px;
    display: flex;
    gap: 12px;
    align-items: center;
    border: 1px solid #303641;
    background: #151921;
}

.alert.maintenance {
    border-color: #786020;
}

.alert.disturbance {
    border-color: #713939;
}

.alert.announcement {
    border-color: #384b82;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 12px 10px;
    text-align: left;
    border-bottom: 1px solid #252b35;
    vertical-align: top;
}

th {
    color: #9fa7b5;
    font-size: 13px;
}

.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 6px;
    background: #202531;
    color: #c9cfda;
    font-size: 12px;
}

.badge.owner {
    background: #5c3b1f;
    color: #ffc87c;
}

.badge.admin {
    background: #29376b;
    color: #aab8ff;
}

.badge.developer {
    background: #263d32;
    color: #9de0b7;
}

.badge.manager {
    background: #3f2d54;
    color: #d4b4ff;
}

.badge.moderator {
    background: #4a3030;
    color: #ffb1b1;
}

.chat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 500px;
    overflow-y: auto;
    margin-bottom: 15px;
}

.message {
    padding: 12px;
    background: #171b23;
    border-radius: 9px;
}

.message strong {
    display: block;
    margin-bottom: 4px;
}

.message small {
    color: #747d8b;
}

.ticket {
    display: block;
    border: 1px solid #292f39;
    background: #151920;
    border-radius: 10px;
    padding: 17px;
    margin-bottom: 10px;
}

.ticket:hover {
    border-color: #485167;
}

.empty {
    padding: 35px;
    text-align: center;
    color: #7f8794;
}

.footer {
    border-top: 1px solid #20242d;
    padding: 30px 0;
    color: #727a88;
    font-size: 14px;
}

@media (max-width: 850px) {
    .grid,
    .grid.two,
    .grid.four {
        grid-template-columns: 1fr;
    }

    .nav {
        height: auto;
        padding: 15px;
        gap: 12px;
        align-items: flex-start;
        flex-direction: column;
    }

    .hero h1 {
        letter-spacing: -2px;
    }

    table {
        display: block;
        overflow-x: auto;
    }
}

</style>
</head>

<body>

<nav class="nav">

<a class="logo" href="/">
    NORTH<span>-BOT-2</span>
</a>

<div class="navlinks">

<a href="/">Start</a>

${
    user
        ? `
<a href="/dashboard">Dashboard</a>
<a href="/tickets">Tickets</a>
<a href="/shop">Shop</a>
<a href="/giveaways">Gewinnspiele</a>
<a href="/chat">Chat</a>
<a href="/profile">Profil</a>

${
    isStaff(user)
        ? `<a href="/admin">Admin Panel</a>`
        : ""
}

<a href="/logout">Logout</a>
`
        : `
<a href="/login">Login</a>
<a href="/register">Registrieren</a>
`
}

<a href="${DISCORD_INVITE}" target="_blank">Discord</a>

</div>

</nav>

${alerts}

<main>

<div class="container">

${content}

</div>

</main>

<footer class="footer">

<div class="container">

${SITE_NAME} · Discord:
<a href="${DISCORD_INVITE}" target="_blank">
    ${DISCORD_INVITE}
</a>

</div>

</footer>

</body>
</html>
`;
}

// ============================================================
// STARTSEITE
// ============================================================

app.get("/", (req, res) => {
    res.send(
        page(
            "Startseite",
            `
            <section class="hero">

                <h1>
                    North<span>-Bot-2</span>
                </h1>

                <p>
                    Eine zentrale Webseite für Benutzer,
                    Tickets, Coins, Gewinnspiele, Shop,
                    Team-Systeme und Administration.
                </p>

                <div class="buttons">
                    <a class="button primary" href="/register">
                        Account erstellen
                    </a>

                    <a class="button" href="/login">
                        Einloggen
                    </a>

                    <a
                        class="button"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Discord beitreten
                    </a>
                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h3>Tickets</h3>
                    <p>
                        Erstelle Support-Tickets direkt über
                        deinen Account.
                    </p>
                </div>

                <div class="card">
                    <h3>Coins</h3>
                    <p>
                        Sammle Coins und löse sie im Shop ein.
                    </p>
                </div>

                <div class="card">
                    <h3>Community</h3>
                    <p>
                        Chat, Gewinnspiele und weitere
                        Community-Funktionen.
                    </p>
                </div>

            </div>
            `
        )
    );
});

// ============================================================
// REGISTER
// ============================================================

app.get("/register", (req, res) => {
    if (getCurrentUser(req)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Registrieren",
            `
            <div class="card">

                <h1>Account erstellen</h1>

                <form method="POST" action="/register">

                    <label>Name</label>
                    <input
                        name="username"
                        minlength="2"
                        maxlength="30"
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

                    <button class="button primary" type="submit">
                        Registrieren
                    </button>

                </form>

                <p>
                    Bereits registriert?
                    <a href="/login">Einloggen</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");

    if (
        username.length < 2 ||
        username.length > 30 ||
        password.length < 6 ||
        !email.includes("@")
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h1>Registrierung fehlgeschlagen</h1>
                    <p>Bitte überprüfe deine Eingaben.</p>
                    <a class="button" href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    if (findUserByEmail(email)) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h1>E-Mail bereits vorhanden</h1>
                    <a class="button" href="/login">
                        Zum Login
                    </a>
                </div>
                `
            )
        );
    }

    const users = getUsers();

    const user = {
        id: crypto.randomUUID(),
        username,
        email,
        password: bcrypt.hashSync(password, 12),
        role: "user",
        coins: 0,
        banned: false,
        banUntil: null,
        banReason: null,
        createdAt: new Date().toISOString(),
        lastDaily: null
    };

    users.push(user);

    saveUsers(users);

    addLog(
        "register",
        "Neuer Benutzer registriert.",
        user
    );

    req.session.userId = user.id;

    res.redirect("/dashboard");
});

// ============================================================
// LOGIN
// ============================================================

app.get("/login", (req, res) => {
    res.send(
        page(
            "Login",
            `
            <div class="card">

                <h1>Login</h1>

                <form method="POST" action="/login">

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

                    <button
                        class="button primary"
                        type="submit"
                    >
                        Einloggen
                    </button>

                </form>

                <p>
                    Noch keinen Account?
                    <a href="/register">Registrieren</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");

    const user = findUserByEmail(email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).send(
            page(
                "Login",
                `
                <div class="card">
                    <h1>Login fehlgeschlagen</h1>
                    <p>E-Mail oder Passwort ist falsch.</p>
                    <a class="button" href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (user.banned) {
        const now = Date.now();

        if (
            !user.banUntil ||
            new Date(user.banUntil).getTime() > now
        ) {
            return res.redirect("/banned");
        }
    }

    req.session.userId = user.id;

    addLog(
        "login",
        "Benutzer hat sich eingeloggt.",
        user
    );

    res.redirect("/dashboard");
});

// ============================================================
// LOGOUT
// ============================================================

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// ============================================================
// BANNED
// ============================================================

app.get("/banned", (req, res) => {
    res.send(
        page(
            "Gebannt",
            `
            <div class="card">

                <h1>Account gesperrt</h1>

                <p>
                    Dein Account wurde von der Administration
                    gesperrt.
                </p>

                <p>
                    Wenn du glaubst, dass die Sperre falsch ist,
                    komm bitte auf unseren Discord.
                </p>

                <a
                    class="button primary"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Discord öffnen
                </a>

            </div>
            `
        )
    );
});

// ============================================================
// DASHBOARD
// ============================================================

app.get("/dashboard", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Dashboard",
            `
            <h1>Dashboard</h1>

            <div class="grid four">

                <div class="card">
                    <div class="muted">Coins</div>
                    <div class="stat">
                        ${user.coins}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Rolle</div>
                    <div class="stat">
                        ${escapeHTML(user.role)}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Tickets</div>
                    <div class="stat">
                        ${
                            readJSON(TICKETS_FILE, []).filter(
                                t => t.userId === user.id
                            ).length
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Account</div>
                    <div class="stat">
                        Aktiv
                    </div>
                </div>

            </div>

            <br>

            <div class="card">

                <h2>Daily Coins</h2>

                <p>
                    Alle 14 Stunden kannst du 100 Coins
                    kostenlos erhalten.
                </p>

                <form method="POST" action="/daily">
                    <button class="button green">
                        100 Coins abholen
                    </button>
                </form>

            </div>
            `
        )
    );
});

// ============================================================
// DAILY
// ============================================================

app.post("/daily", requireLogin, (req, res) => {
    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.user.id
    );

    if (index === -1) {
        return res.redirect("/login");
    }

    const user = users[index];

    const now = Date.now();

    if (user.lastDaily) {
        const elapsed =
            now - new Date(user.lastDaily).getTime();

        const fourteenHours =
            14 * 60 * 60 * 1000;

        if (elapsed < fourteenHours) {
            return res.send(
                page(
                    "Daily",
                    `
                    <div class="card">
                        <h1>Noch nicht verfügbar</h1>
                        <p>
                            Deine nächsten 100 Coins kannst du
                            nach 14 Stunden wieder abholen.
                        </p>
                        <a class="button" href="/dashboard">
                            Dashboard
                        </a>
                    </div>
                    `,
                    req
                )
            );
        }
    }

    user.coins += 100;
    user.lastDaily = new Date().toISOString();

    users[index] = user;

    saveUsers(users);

    addLog(
        "daily",
        "Benutzer hat 100 Daily-Coins erhalten.",
        user
    );

    res.redirect("/dashboard");
});

// ============================================================
// PROFIL
// ============================================================

app.get("/profile", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Profil",
            `
            <div class="card">

                <h1>Profil bearbeiten</h1>

                <form method="POST" action="/profile">

                    <label>Name</label>

                    <input
                        name="username"
                        value="${escapeHTML(user.username)}"
                        minlength="2"
                        maxlength="30"
                        required
                    >

                    <label>E-Mail</label>

                    <input
                        value="${escapeHTML(user.email)}"
                        disabled
                    >

                    <button class="button primary">
                        Speichern
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/profile", requireLogin, (req, res) => {
    const username = String(req.body.username || "").trim();

    if (username.length < 2 || username.length > 30) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h1>Ungültiger Name</h1>
                    <a class="button" href="/profile">
                        Zurück
                    </a>
                </div>
                `,
                req
            )
        );
    }

    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.user.id
    );

    if (index === -1) {
        return res.redirect("/login");
    }

    users[index].username = username;

    saveUsers(users);

    addLog(
        "profile",
        "Benutzer hat seinen Namen geändert.",
        users[index]
    );

    res.redirect("/profile");
});

// ============================================================
// TICKETS
// ============================================================

app.get("/tickets", requireLogin, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const visibleTickets = tickets.filter(ticket => {
        if (ticket.userId === req.user.id) {
            return true;
        }

        if (
            isStaff(req.user) &&
            ticket.assignedTo &&
            ticket.assignedTo === req.user.id
        ) {
            return true;
        }

        return isStaff(req.user);
    });

    const list = visibleTickets.length
        ? visibleTickets
              .map(
                  ticket => `
            <a class="ticket" href="/tickets/${ticket.id}">

                <strong>
                    #${escapeHTML(ticket.number)}
                </strong>

                <div>
                    ${escapeHTML(ticket.subject)}
                </div>

                <small>
                    Status:
                    ${escapeHTML(ticket.status)}
                </small>

            </a>
            `
              )
              .join("")
        : `<div class="empty">Keine Tickets vorhanden.</div>`;

    res.send(
        page(
            "Tickets",
            `
            <div class="buttons">
                <a class="button primary" href="/tickets/create">
                    Neues Ticket
                </a>
            </div>

            <br>

            ${list}
            `,
            req
        )
    );
});

// ============================================================
// TICKET ERSTELLEN
// ============================================================

app.get("/tickets/create", requireLogin, (req, res) => {
    res.send(
        page(
            "Ticket erstellen",
            `
            <div class="card">

                <h1>Support-Ticket</h1>

                <p>
                    Dein Ticket ist nur für dich und das
                    zuständige Team sichtbar.
                </p>

                <form method="POST" action="/tickets/create">

                    <label>Betreff</label>

                    <input
                        name="subject"
                        maxlength="100"
                        required
                        placeholder="Worum geht es?"
                    >

                    <label>Nachricht</label>

                    <textarea
                        name="message"
                        maxlength="4000"
                        required
                        placeholder="Beschreibe dein Anliegen..."
                    ></textarea>

                    <button class="button primary">
                        Ticket erstellen
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/tickets/create", requireLogin, (req, res) => {
    const subject =
        String(req.body.subject || "").trim();

    const message =
        String(req.body.message || "").trim();

    if (!subject || !message) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h1>Ticket konnte nicht erstellt werden.</h1>
                    <a class="button" href="/tickets/create">
                        Zurück
                    </a>
                </div>
                `,
                req
            )
        );
    }

    const tickets = readJSON(TICKETS_FILE, []);

    const ticket = {
        id: crypto.randomUUID(),
        number:
            randomPart(4) +
            "-" +
            randomPart(4),
        userId: req.user.id,
        username: req.user.username,
        subject,
        message,
        categoryId: TICKET_CATEGORY_ID,
        status: "open",
        assignedTo: null,
        assignedUsername: null,
        createdAt: new Date().toISOString(),
        closedAt: null,
        replies: []
    };

    tickets.push(ticket);

    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "ticket_created",
        "Neues Ticket erstellt: #" + ticket.number,
        req.user
    );

    res.redirect("/tickets/" + ticket.id);
});

// ============================================================
// TICKET ANSEHEN
// ============================================================

app.get("/tickets/:id", requireLogin, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const ticket = tickets.find(
        item => item.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send(
            page(
                "Ticket",
                `
                <div class="card">
                    <h1>Ticket nicht gefunden</h1>
                </div>
                `,
                req
            )
        );
    }

    const allowed =
        ticket.userId === req.user.id ||
        isStaff(req.user);

    if (!allowed) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                </div>
                `,
                req
            )
        );
    }

    const replies = ticket.replies
        .map(
            reply => `
            <div class="message">

                <strong>
                    ${escapeHTML(reply.username)}
                </strong>

                <div>
                    ${escapeHTML(reply.message)}
                </div>

                <small>
                    ${new Date(reply.createdAt).toLocaleString("de-DE")}
                </small>

            </div>
            `
        )
        .join("");

    res.send(
        page(
            "Ticket #" + ticket.number,
            `
            <div class="card">

                <h1>
                    Ticket #${escapeHTML(ticket.number)}
                </h1>

                <p>
                    <strong>
                        ${escapeHTML(ticket.subject)}
                    </strong>
                </p>

                <p>
                    ${escapeHTML(ticket.message)}
                </p>

                <p class="muted">
                    Status:
                    ${escapeHTML(ticket.status)}
                </p>

                ${
                    ticket.assignedUsername
                        ? `
                        <p>
                            Übernommen von:
                            ${escapeHTML(ticket.assignedUsername)}
                        </p>
                        `
                        : ""
                }

            </div>

            <br>

            <div class="card">

                <h2>Antworten</h2>

                <div class="chat">
                    ${replies || '<div class="empty">Noch keine Antworten.</div>'}
                </div>

                ${
                    ticket.status !== "closed"
                        ? `
                    <form method="POST"
                        action="/tickets/${ticket.id}/reply">

                        <textarea
                            name="message"
                            maxlength="4000"
                            required
                            placeholder="Antwort schreiben..."
                        ></textarea>

                        <button class="button primary">
                            Antworten
                        </button>

                    </form>
                    `
                        : ""
                }

            </div>

            <br>

            ${
                isStaff(req.user)
                    ? `
                    <div class="card">

                        <h2>Team</h2>

                        ${
                            ticket.status !== "closed"
                                ? `
                                <div class="buttons">

                                    <form
                                        method="POST"
                                        action="/tickets/${ticket.id}/take"
                                    >
                                        <button class="button green">
                                            Übernehmen
                                        </button>
                                    </form>

                                    <form
                                        method="POST"
                                        action="/tickets/${ticket.id}/release"
                                    >
                                        <button class="button">
                                            Freigeben
                                        </button>
                                    </form>

                                    <form
                                        method="POST"
                                        action="/tickets/${ticket.id}/close"
                                    >
                                        <button class="button danger">
                                            Schließen
                                        </button>
                                    </form>

                                </div>
                                `
                                : "<p>Ticket geschlossen.</p>"
                        }

                    </div>
                    `
                    : ""
            }
            `,
            req
        )
    );
});

// ============================================================
// TICKET ANTWORT
// ============================================================

app.post("/tickets/:id/reply", requireLogin, (req, res) => {
    const message =
        String(req.body.message || "").trim();

    if (!message) {
        return res.redirect("/tickets/" + req.params.id);
    }

    const tickets = readJSON(TICKETS_FILE, []);

    const index = tickets.findIndex(
        ticket => ticket.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    const ticket = tickets[index];

    if (
        ticket.userId !== req.user.id &&
        !isStaff(req.user)
    ) {
        return res.status(403).send("Kein Zugriff");
    }

    ticket.replies.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    tickets[index] = ticket;

    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "ticket_reply",
        "Antwort in Ticket #" + ticket.number,
        req.user
    );

    res.redirect("/tickets/" + ticket.id);
});

// ============================================================
// TICKET ÜBERNEHMEN
// ============================================================

app.post("/tickets/:id/take", requireStaff, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const index = tickets.findIndex(
        ticket => ticket.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    tickets[index].assignedTo = req.user.id;
    tickets[index].assignedUsername = req.user.username;

    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "ticket_take",
        "Ticket #" +
            tickets[index].number +
            " wurde übernommen.",
        req.user
    );

    res.redirect("/tickets/" + req.params.id);
});

// ============================================================
// TICKET FREIGEBEN
// ============================================================

app.post("/tickets/:id/release", requireStaff, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const index = tickets.findIndex(
        ticket => ticket.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    tickets[index].assignedTo = null;
    tickets[index].assignedUsername = null;

    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "ticket_release",
        "Ticket #" +
            tickets[index].number +
            " wurde freigegeben.",
        req.user
    );

    res.redirect("/tickets/" + req.params.id);
});

// ============================================================
// TICKET SCHLIESSEN
// ============================================================

app.post("/tickets/:id/close", requireStaff, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const index = tickets.findIndex(
        ticket => ticket.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    tickets[index].status = "closed";
    tickets[index].closedAt =
        new Date().toISOString();

    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "ticket_close",
        "Ticket #" +
            tickets[index].number +
            " wurde geschlossen.",
        req.user
    );

    res.redirect("/tickets/" + req.params.id);
});

// ============================================================
// COIN CODES
// ============================================================

app.get("/codes", requireStaff, (req, res) => {
    const codes = readJSON(CODES_FILE, []);

    res.send(
        page(
            "Coin Codes",
            `
            <div class="card">

                <h1>Coin-Codes</h1>

                <form method="POST" action="/admin/codes/create">

                    <label>Coins</label>

                    <input
                        type="number"
                        name="coins"
                        min="1"
                        max="100000"
                        value="100"
                        required
                    >

                    <button class="button primary">
                        Code erstellen
                    </button>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>Vorhandene Codes</h2>

                ${
                    codes.length
                        ? `
                        <table>

                            <tr>
                                <th>Code</th>
                                <th>Coins</th>
                                <th>Status</th>
                                <th>Benutzer</th>
                            </tr>

                            ${codes
                                .map(
                                    code => `
                                    <tr>

                                        <td>
                                            <strong>
                                                ${escapeHTML(code.code)}
                                            </strong>
                                        </td>

                                        <td>
                                            ${code.coins}
                                        </td>

                                        <td>
                                            ${
                                                code.used
                                                    ? "Eingelöst"
                                                    : "Verfügbar"
                                            }
                                        </td>

                                        <td>
                                            ${
                                                code.usedByUsername
                                                    ? escapeHTML(
                                                          code.usedByUsername
                                                      )
                                                    : "-"
                                            }
                                        </td>

                                    </tr>
                                    `
                                )
                                .join("")}

                        </table>
                        `
                        : `<div class="empty">Keine Codes.</div>`
                }

            </div>
            `,
            req
        )
    );
});

app.post("/admin/codes/create", requireStaff, (req, res) => {
    const coins = Number(req.body.coins);

    if (!Number.isInteger(coins) || coins < 1) {
        return res.redirect("/codes");
    }

    const codes = readJSON(CODES_FILE, []);

    const code = {
        id: crypto.randomUUID(),
        code: generateCoinCode(),
        coins,
        used: false,
        usedBy: null,
        usedByUsername: null,
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
        usedAt: null
    };

    codes.push(code);

    writeJSON(CODES_FILE, codes);

    addLog(
        "code_create",
        "Coin-Code " +
            code.code +
            " mit " +
            coins +
            " Coins erstellt.",
        req.user
    );

    res.redirect("/codes");
});

// ============================================================
// CODE EINLÖSEN
// ============================================================

app.get("/redeem", requireLogin, (req, res) => {
    res.send(
        page(
            "Code einlösen",
            `
            <div class="card">

                <h1>Coin-Code einlösen</h1>

                <p>
                    Ein Code kann nur einmal von einem Benutzer
                    eingelöst werden.
                </p>

                <form method="POST" action="/redeem">

                    <input
                        name="code"
                        required
                        placeholder="NORTH-1234-1234"
                        autocomplete="off"
                    >

                    <button class="button primary">
                        Einlösen
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/redeem", requireLogin, (req, res) => {
    const input =
        String(req.body.code || "")
            .trim()
            .toUpperCase();

    const codes = readJSON(CODES_FILE, []);

    const index = codes.findIndex(
        code => code.code === input
    );

    if (index === -1) {
        return res.send(
            page(
                "Code",
                `
                <div class="card">
                    <h1>Code nicht gefunden</h1>
                    <a class="button" href="/redeem">
                        Zurück
                    </a>
                </div>
                `,
                req
            )
        );
    }

    const code = codes[index];

    if (code.used) {
        return res.send(
            page(
                "Code",
                `
                <div class="card">
                    <h1>Code bereits verwendet</h1>
                    <p>Dieser Code kann nicht erneut eingelöst werden.</p>
                </div>
                `,
                req
            )
        );
    }

    const users = getUsers();

    const userIndex = users.findIndex(
        user => user.id === req.user.id
    );

    if (userIndex === -1) {
        return res.redirect("/login");
    }

    users[userIndex].coins += code.coins;

    code.used = true;
    code.usedBy = req.user.id;
    code.usedByUsername = req.user.username;
    code.usedAt = new Date().toISOString();

    codes[index] = code;

    saveUsers(users);
    writeJSON(CODES_FILE, codes);

    addLog(
        "code_redeem",
        "Code " +
            code.code +
            " eingelöst. +" +
            code.coins +
            " Coins.",
        users[userIndex]
    );

    res.send(
        page(
            "Code eingelöst",
            `
            <div class="card">

                <h1>Code eingelöst</h1>

                <p>
                    Du hast
                    <strong>${code.coins}</strong>
                    Coins erhalten.
                </p>

                <a class="button primary" href="/dashboard">
                    Dashboard
                </a>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// SHOP
// ============================================================

app.get("/shop", requireLogin, (req, res) => {
    const products = readJSON(PRODUCTS_FILE, []);

    const content = products.length
        ? products
              .map(
                  product => `
                <div class="card">

                    <h2>
                        ${escapeHTML(product.name)}
                    </h2>

                    <p>
                        ${escapeHTML(product.description)}
                    </p>

                    <strong>
                        ${product.price} Coins
                    </strong>

                    <br><br>

                    <form
                        method="POST"
                        action="/shop/${product.id}/buy"
                    >
                        <button class="button primary">
                            Kaufen
                        </button>
                    </form>

                </div>
                `
              )
              .join("")
        : `<div class="empty">Noch keine Produkte vorhanden.</div>`;

    res.send(
        page(
            "Shop",
            `
            <h1>Coin-Shop</h1>

            <p class="muted">
                Dein Guthaben:
                <strong>${req.user.coins} Coins</strong>
            </p>

            <div class="grid">
                ${content}
            </div>
            `,
            req
        )
    );
});

// ============================================================
// SHOP PRODUKT ERSTELLEN
// ============================================================

app.post("/admin/products/create", requireStaff, (req, res) => {
    if (!canManageShop(req.user)) {
        return res.status(403).send("Kein Zugriff");
    }

    const name =
        String(req.body.name || "").trim();

    const description =
        String(req.body.description || "").trim();

    const price = Number(req.body.price);

    if (!name || !Number.isInteger(price) || price < 1) {
        return res.redirect("/admin");
    }

    const products = readJSON(PRODUCTS_FILE, []);

    products.push({
        id: crypto.randomUUID(),
        name,
        description,
        price,
        createdAt: new Date().toISOString()
    });

    writeJSON(PRODUCTS_FILE, products);

    addLog(
        "product_create",
        "Produkt " + name + " erstellt.",
        req.user
    );

    res.redirect("/admin");
});

// ============================================================
// PRODUKT KAUFEN
// ============================================================

app.post("/shop/:id/buy", requireLogin, (req, res) => {
    const products = readJSON(PRODUCTS_FILE, []);

    const product = products.find(
        item => item.id === req.params.id
    );

    if (!product) {
        return res.redirect("/shop");
    }

    const users = getUsers();

    const userIndex = users.findIndex(
        user => user.id === req.user.id
    );

    if (userIndex === -1) {
        return res.redirect("/login");
    }

    if (users[userIndex].coins < product.price) {
        return res.send(
            page(
                "Shop",
                `
                <div class="card">
                    <h1>Nicht genug Coins</h1>
                    <p>
                        Du benötigst ${product.price} Coins.
                    </p>
                    <a class="button" href="/shop">
                        Zum Shop
                    </a>
                </div>
                `,
                req
            )
        );
    }

    users[userIndex].coins -= product.price;

    const orders = readJSON(ORDERS_FILE, []);

    const order = {
        id: crypto.randomUUID(),
        number: generateOrderNumber(),
        productId: product.id,
        productName: product.name,
        userId: req.user.id,
        username: req.user.username,
        price: product.price,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    orders.push(order);

    saveUsers(users);
    writeJSON(ORDERS_FILE, orders);

    addLog(
        "order",
        "Bestellung " +
            order.number +
            " erstellt.",
        users[userIndex]
    );

    res.send(
        page(
            "Bestellung",
            `
            <div class="card">

                <h1>Bestellung erstellt</h1>

                <p>
                    Produkt:
                    <strong>
                        ${escapeHTML(product.name)}
                    </strong>
                </p>

                <p>
                    Bestellnummer:
                    <strong>
                        ${escapeHTML(order.number)}
                    </strong>
                </p>

                <p>
                    Deine Bestellung wurde an das Team
                    übermittelt.
                </p>

                <a class="button primary" href="/shop">
                    Zurück zum Shop
                </a>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// CHAT
// ============================================================

app.get("/chat", requireLogin, (req, res) => {
    const messages = readJSON(CHAT_FILE, []);

    const html = messages.length
        ? messages
              .slice(-100)
              .map(
                  message => `
                    <div class="message">

                        <strong>
                            ${escapeHTML(message.username)}
                        </strong>

                        <div>
                            ${escapeHTML(message.message)}
                        </div>

                        <small>
                            ${new Date(
                                message.createdAt
                            ).toLocaleString("de-DE")}
                        </small>

                    </div>
                    `
              )
              .join("")
        : `<div class="empty">Noch keine Nachrichten.</div>`;

    res.send(
        page(
            "Chat",
            `
            <div class="card">

                <h1>Community-Chat</h1>

                <div class="chat">
                    ${html}
                </div>

                <form method="POST" action="/chat">

                    <textarea
                        name="message"
                        maxlength="1000"
                        required
                        placeholder="Nachricht..."
                    ></textarea>

                    <button class="button primary">
                        Senden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/chat", requireLogin, (req, res) => {
    const message =
        String(req.body.message || "").trim();

    if (!message) {
        return res.redirect("/chat");
    }

    const messages = readJSON(CHAT_FILE, []);

    messages.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    if (messages.length > 500) {
        messages.splice(0, messages.length - 500);
    }

    writeJSON(CHAT_FILE, messages);

    addLog(
        "chat",
        "Neue Chat-Nachricht.",
        req.user
    );

    res.redirect("/chat");
});

// ============================================================
// TEAM CHAT
// ============================================================

app.get("/team-chat", requireStaff, (req, res) => {
    const messages = readJSON(TEAM_CHAT_FILE, []);

    const html = messages.length
        ? messages
              .slice(-100)
              .map(
                  message => `
                    <div class="message">

                        <strong>
                            ${escapeHTML(message.username)}
                        </strong>

                        <div>
                            ${escapeHTML(message.message)}
                        </div>

                        <small>
                            ${new Date(
                                message.createdAt
                            ).toLocaleString("de-DE")}
                        </small>

                    </div>
                    `
              )
              .join("")
        : `<div class="empty">Noch keine Team-Nachrichten.</div>`;

    res.send(
        page(
            "Team Chat",
            `
            <div class="card">

                <h1>Team Chat</h1>

                <div class="chat">
                    ${html}
                </div>

                <form method="POST" action="/team-chat">

                    <textarea
                        name="message"
                        maxlength="2000"
                        required
                        placeholder="Team-Nachricht..."
                    ></textarea>

                    <button class="button primary">
                        Senden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/team-chat", requireStaff, (req, res) => {
    const message =
        String(req.body.message || "").trim();

    if (!message) {
        return res.redirect("/team-chat");
    }

    const messages =
        readJSON(TEAM_CHAT_FILE, []);

    messages.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        message,
        createdAt: new Date().toISOString()
    });

    if (messages.length > 500) {
        messages.splice(0, messages.length - 500);
    }

    writeJSON(TEAM_CHAT_FILE, messages);

    addLog(
        "team_chat",
        "Neue Team-Chat-Nachricht.",
        req.user
    );

    res.redirect("/team-chat");
});

// ============================================================
// GEWINNSPIELE
// ============================================================

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = readJSON(GIVEAWAYS_FILE, []);

    const content = giveaways.length
        ? giveaways
              .map(giveaway => {
                  const entered =
                      giveaway.entries.includes(
                          req.user.id
                      );

                  return `
                    <div class="card">

                        <h2>
                            ${escapeHTML(giveaway.title)}
                        </h2>

                        <p>
                            ${escapeHTML(
                                giveaway.description
                            )}
                        </p>

                        <p>
                            Preis:
                            <strong>
                                ${escapeHTML(
                                    giveaway.prize
                                )}
                            </strong>
                        </p>

                        <p class="muted">
                            Teilnehmer:
                            ${giveaway.entries.length}
                        </p>

                        ${
                            entered
                                ? `
                                <span class="badge">
                                    Du nimmst bereits teil
                                </span>
                                `
                                : `
                                <form
                                    method="POST"
                                    action="/giveaways/${giveaway.id}/join"
                                >
                                    <button class="button primary">
                                        Teilnehmen
                                    </button>
                                </form>
                                `
                        }

                    </div>
                    `;
              })
              .join("")
        : `<div class="empty">Keine aktiven Gewinnspiele.</div>`;

    res.send(
        page(
            "Gewinnspiele",
            `
            <h1>Gewinnspiele</h1>

            <div class="grid">
                ${content}
            </div>
            `,
            req
        )
    );
});

// ============================================================
// GEWINNSPIEL TEILNAHME
// ============================================================

app.post(
    "/giveaways/:id/join",
    requireLogin,
    (req, res) => {
        const giveaways =
            readJSON(GIVEAWAYS_FILE, []);

        const index = giveaways.findIndex(
            giveaway =>
                giveaway.id === req.params.id
        );

        if (index === -1) {
            return res.redirect("/giveaways");
        }

        if (
            !giveaways[index].entries.includes(
                req.user.id
            )
        ) {
            giveaways[index].entries.push(
                req.user.id
            );

            writeJSON(
                GIVEAWAYS_FILE,
                giveaways
            );

            addLog(
                "giveaway_join",
                "Benutzer hat an einem Gewinnspiel teilgenommen.",
                req.user
            );
        }

        res.redirect("/giveaways");
    }
);

// ============================================================
// ADMIN PANEL
// ============================================================

app.get("/admin", requireStaff, (req, res) => {
    const users = getUsers();
    const tickets = readJSON(TICKETS_FILE, []);
    const logs = readJSON(LOGS_FILE, []);
    const codes = readJSON(CODES_FILE, []);
    const products = readJSON(PRODUCTS_FILE, []);
    const orders = readJSON(ORDERS_FILE, []);
    const giveaways = readJSON(GIVEAWAYS_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});

    res.send(
        page(
            "Admin Panel",
            `
            <h1>Admin Panel</h1>

            <div class="grid four">

                <div class="card">
                    <div class="muted">Benutzer</div>
                    <div class="stat">${users.length}</div>
                </div>

                <div class="card">
                    <div class="muted">Tickets</div>
                    <div class="stat">${tickets.length}</div>
                </div>

                <div class="card">
                    <div class="muted">Codes</div>
                    <div class="stat">${codes.length}</div>
                </div>

                <div class="card">
                    <div class="muted">Bestellungen</div>
                    <div class="stat">${orders.length}</div>
                </div>

            </div>

            <br>

            <div class="grid two">

                <div class="card">

                    <h2>System</h2>

                    <div class="buttons">

                        <a class="button" href="/admin/settings">
                            Wartung / Störung
                        </a>

                        <a class="button" href="/admin/logs">
                            Logs
                        </a>

                        <a class="button" href="/admin/users">
                            Benutzer
                        </a>

                        <a class="button" href="/admin/orders">
                            Bestellungen
                        </a>

                    </div>

                </div>

                <div class="card">

                    <h2>Community</h2>

                    <div class="buttons">

                        <a class="button" href="/team-chat">
                            Team Chat
                        </a>

                        <a class="button" href="/admin/giveaways">
                            Gewinnspiele
                        </a>

                        <a class="button" href="/codes">
                            Coin Codes
                        </a>

                    </div>

                </div>

            </div>

            <br>

            <div class="card">

                <h2>Shop-Produkt erstellen</h2>

                <form method="POST"
                    action="/admin/products/create">

                    <label>Name</label>

                    <input
                        name="name"
                        maxlength="100"
                        required
                    >

                    <label>Beschreibung</label>

                    <textarea
                        name="description"
                        maxlength="1000"
                    ></textarea>

                    <label>Preis in Coins</label>

                    <input
                        type="number"
                        name="price"
                        min="1"
                        required
                    >

                    <button class="button primary">
                        Produkt erstellen
                    </button>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>Produkte</h2>

                ${
                    products.length
                        ? `
                        <table>

                        <tr>
                            <th>Name</th>
                            <th>Preis</th>
                        </tr>

                        ${products
                            .map(
                                product => `
                                <tr>
                                    <td>
                                        ${escapeHTML(
                                            product.name
                                        )}
                                    </td>
                                    <td>
                                        ${product.price}
                                        Coins
                                    </td>
                                </tr>
                                `
                            )
                            .join("")}

                        </table>
                        `
                        : `<div class="empty">Keine Produkte.</div>`
                }

            </div>

            <br>

            <div class="card">

                <h2>Systemstatus</h2>

                <p>
                    Wartung:
                    <strong>
                        ${settings.maintenance ? "AN" : "AUS"}
                    </strong>
                </p>

                <p>
                    Störung:
                    <strong>
                        ${settings.disturbance ? "AN" : "AUS"}
                    </strong>
                </p>

                <p>
                    Ankündigung:
                    <strong>
                        ${
                            settings.announcement
                                ? "Vorhanden"
                                : "Keine"
                        }
                    </strong>
                </p>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// ADMIN USERS
// ============================================================

app.get("/admin/users", requireStaff, (req, res) => {
    const users = getUsers();

    res.send(
        page(
            "Benutzer",
            `
            <h1>Registrierte Benutzer</h1>

            <div class="card">

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
                                ${escapeHTML(
                                    user.username
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    user.email
                                )}
                            </td>

                            <td>
                                <span class="badge ${escapeHTML(
                                    user.role
                                )}">
                                    ${escapeHTML(
                                        user.role
                                    )}
                                </span>
                            </td>

                            <td>
                                ${user.coins}
                            </td>

                            <td>
                                ${
                                    user.banned
                                        ? "Gebannt"
                                        : "Aktiv"
                                }
                            </td>

                            <td>

                                ${
                                    canManageUsers(
                                        req.user
                                    ) &&
                                    user.id !== req.user.id
                                        ? `
                                        <div class="buttons">

                                        <form
                                            method="POST"
                                            action="/admin/users/${user.id}/ban"
                                        >

                                            <input
                                                type="hidden"
                                                name="minutes"
                                                value="1"
                                            >

                                            <input
                                                type="hidden"
                                                name="reason"
                                                value="Test-Bann"
                                            >

                                            <button class="button danger">
                                                1 Min bannen
                                            </button>

                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/users/${user.id}/kick"
                                        >

                                            <button class="button">
                                                Kick
                                            </button>

                                        </form>

                                        </div>
                                        `
                                        : ""
                                }

                            </td>

                        </tr>
                        `
                    )
                    .join("")}

            </table>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// USER BAN
// ============================================================

app.post(
    "/admin/users/:id/ban",
    requireStaff,
    (req, res) => {
        if (!canManageUsers(req.user)) {
            return res.status(403).send("Kein Zugriff");
        }

        if (req.params.id === req.user.id) {
            return res.redirect("/admin/users");
        }

        const minutes =
            Number(req.body.minutes) || 1;

        const reason =
            String(
                req.body.reason || "Kein Grund angegeben"
            ).trim();

        const users = getUsers();

        const index = users.findIndex(
            user => user.id === req.params.id
        );

        if (index === -1) {
            return res.redirect("/admin/users");
        }

        const user = users[index];

        if (
            user.role === "owner" &&
            !isOwner(req.user)
        ) {
            return res.status(403).send("Owner kann nur vom Owner verwaltet werden.");
        }

        user.banned = true;
        user.banReason = reason;

        user.banUntil = new Date(
            Date.now() +
                minutes * 60 * 1000
        ).toISOString();

        users[index] = user;

        saveUsers(users);

        addLog(
            "ban",
            user.username +
                " wurde für " +
                minutes +
                " Minuten gebannt. Grund: " +
                reason,
            req.user
        );

        res.redirect("/admin/users");
    }
);

// ============================================================
// KICK
// ============================================================

app.post(
    "/admin/users/:id/kick",
    requireStaff,
    (req, res) => {
        if (!canManageUsers(req.user)) {
            return res.status(403).send("Kein Zugriff");
        }

        const users = getUsers();

        const user = users.find(
            item => item.id === req.params.id
        );

        if (!user) {
            return res.redirect("/admin/users");
        }

        addLog(
            "kick",
            user.username +
                " wurde von der Webseite ausgeloggt.",
            req.user
        );

        // Alle Sessions des Users werden beim nächsten
        // Request ungültig, wenn die Session nicht vorhanden ist.
        // Für eine echte Multi-Session-Sperre kann später ein
        // Session-Store ergänzt werden.

        res.redirect("/admin/users");
    }
);

// ============================================================
// ADMIN SETTINGS
// ============================================================

app.get(
    "/admin/settings",
    requireStaff,
    (req, res) => {
        const settings =
            readJSON(SETTINGS_FILE, {});

        res.send(
            page(
                "System Einstellungen",
                `
                <div class="card">

                    <h1>Systemstatus</h1>

                    <form
                        method="POST"
                        action="/admin/settings"
                    >

                        <label>
                            Wartung
                        </label>

                        <select name="maintenance">
                            <option
                                value="false"
                                ${
                                    !settings.maintenance
                                        ? "selected"
                                        : ""
                                }
                            >
                                Aus
                            </option>

                            <option
                                value="true"
                                ${
                                    settings.maintenance
                                        ? "selected"
                                        : ""
                                }
                            >
                                An
                            </option>
                        </select>

                        <label>
                            Wartungstext
                        </label>

                        <textarea name="maintenanceText">${escapeHTML(
                            settings.maintenanceText || ""
                        )}</textarea>

                        <label>
                            Störung
                        </label>

                        <select name="disturbance">
                            <option
                                value="false"
                                ${
                                    !settings.disturbance
                                        ? "selected"
                                        : ""
                                }
                            >
                                Aus
                            </option>

                            <option
                                value="true"
                                ${
                                    settings.disturbance
                                        ? "selected"
                                        : ""
                                }
                            >
                                An
                            </option>
                        </select>

                        <label>
                            Störungstext
                        </label>

                        <textarea name="disturbanceText">${escapeHTML(
                            settings.disturbanceText || ""
                        )}</textarea>

                        <label>
                            Ankündigung
                        </label>

                        <textarea
                            name="announcement"
                            placeholder="Ankündigung..."
                        >${escapeHTML(
                            settings.announcement || ""
                        )}</textarea>

                        <button class="button primary">
                            Speichern
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
    "/admin/settings",
    requireStaff,
    (req, res) => {
        const settings =
            readJSON(SETTINGS_FILE, {});

        settings.maintenance =
            req.body.maintenance === "true";

        settings.maintenanceText =
            String(
                req.body.maintenanceText || ""
            ).trim();

        settings.disturbance =
            req.body.disturbance === "true";

        settings.disturbanceText =
            String(
                req.body.disturbanceText || ""
            ).trim();

        settings.announcement =
            String(
                req.body.announcement || ""
            ).trim();

        writeJSON(
            SETTINGS_FILE,
            settings
        );

        addLog(
            "settings",
            "Systemstatus wurde geändert.",
            req.user
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN LOGS
// ============================================================

app.get(
    "/admin/logs",
    requireStaff,
    (req, res) => {
        const logs =
            readJSON(LOGS_FILE, []);

        res.send(
            page(
                "Logs",
                `
                <div class="card">

                    <h1>Logs</h1>

                    ${
                        logs.length
                            ? `
                            <table>

                            <tr>
                                <th>Zeit</th>
                                <th>Typ</th>
                                <th>Benutzer</th>
                                <th>Aktion</th>
                            </tr>

                            ${logs
                                .map(
                                    log => `
                                    <tr>

                                        <td>
                                            ${new Date(
                                                log.time
                                            ).toLocaleString(
                                                "de-DE"
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                log.type
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                log.username ||
                                                    "-"
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                log.message
                                            )}
                                        </td>

                                    </tr>
                                    `
                                )
                                .join("")}

                            </table>
                            `
                            : `<div class="empty">Keine Logs.</div>`
                    }

                </div>
                `,
                req
            )
        );
    }
);

// ============================================================
// ADMIN BESTELLUNGEN
// ============================================================

app.get(
    "/admin/orders",
    requireStaff,
    (req, res) => {
        const orders =
            readJSON(ORDERS_FILE, []);

        res.send(
            page(
                "Bestellungen",
                `
                <div class="card">

                    <h1>Bestellungen</h1>

                    ${
                        orders.length
                            ? `
                            <table>

                            <tr>
                                <th>Bestellnummer</th>
                                <th>User</th>
                                <th>Produkt</th>
                                <th>Coins</th>
                                <th>Status</th>
                            </tr>

                            ${orders
                                .map(
                                    order => `
                                    <tr>

                                        <td>
                                            ${escapeHTML(
                                                order.number
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                order.username
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                order.productName
                                            )}
                                        </td>

                                        <td>
                                            ${order.price}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                order.status
                                            )}
                                        </td>

                                    </tr>
                                    `
                                )
                                .join("")}

                            </table>
                            `
                            : `<div class="empty">Keine Bestellungen.</div>`
                    }

                </div>
                `,
                req
            )
        );
    }
);

// ============================================================
// ADMIN GEWINNSPIELE
// ============================================================

app.get(
    "/admin/giveaways",
    requireStaff,
    (req, res) => {
        const giveaways =
            readJSON(GIVEAWAYS_FILE, []);

        res.send(
            page(
                "Gewinnspiele",
                `
                <div class="card">

                    <h1>Gewinnspiel erstellen</h1>

                    <form
                        method="POST"
                        action="/admin/giveaways/create"
                    >

                        <label>Titel</label>

                        <input
                            name="title"
                            maxlength="100"
                            required
                        >

                        <label>Beschreibung</label>

                        <textarea
                            name="description"
                            maxlength="1000"
                        ></textarea>

                        <label>Gewinn</label>

                        <input
                            name="prize"
                            maxlength="200"
                            required
                        >

                        <button class="button primary">
                            Gewinnspiel erstellen
                        </button>

                    </form>

                </div>

                <br>

                <div class="card">

                    <h2>Aktive Gewinnspiele</h2>

                    ${
                        giveaways.length
                            ? giveaways
                                  .map(
                                      giveaway => `
                                      <div class="ticket">

                                          <strong>
                                              ${escapeHTML(
                                                  giveaway.title
                                              )}
                                          </strong>

                                          <p>
                                              ${escapeHTML(
                                                  giveaway.prize
                                              )}
                                          </p>

                                          <p>
                                              Teilnehmer:
                                              ${
                                                  giveaway
                                                      .entries
                                                      .length
                                              }
                                          </p>

                                      </div>
                                      `
                                  )
                                  .join("")
                            : `<div class="empty">
                                Keine Gewinnspiele.
                               </div>`
                    }

                </div>
                `,
                req
            )
        );
    }
);

app.post(
    "/admin/giveaways/create",
    requireStaff,
    (req, res) => {
        if (!canManageGiveaways(req.user)) {
            return res.status(403).send("Kein Zugriff");
        }

        const title =
            String(req.body.title || "").trim();

        const description =
            String(
                req.body.description || ""
            ).trim();

        const prize =
            String(req.body.prize || "").trim();

        if (!title || !prize) {
            return res.redirect(
                "/admin/giveaways"
            );
        }

        const giveaways =
            readJSON(GIVEAWAYS_FILE, []);

        giveaways.push({
            id: crypto.randomUUID(),
            title,
            description,
            prize,
            entries: [],
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        });

        writeJSON(
            GIVEAWAYS_FILE,
            giveaways
        );

        addLog(
            "giveaway_create",
            "Gewinnspiel " +
                title +
                " erstellt.",
            req.user
        );

        res.redirect("/admin/giveaways");
    }
);

// ============================================================
// BETA / DEVELOPER NUMMER
// ============================================================

app.get(
    "/developer",
    requireLogin,
    (req, res) => {
        const allowedRoles = [
            "owner",
            "admin",
            "manager",
            "developer"
        ];

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).send(
                page(
                    "Developer",
                    `
                    <div class="card">
                        <h1>Kein Zugriff</h1>
                    </div>
                    `,
                    req
                )
            );
        }

        const betaNumber =
            generateBetaNumber();

        res.send(
            page(
                "Developer",
                `
                <div class="card">

                    <h1>Developer-Bereich</h1>

                    <p>
                        Für neue Projekte oder Aufträge kann
                        eine Beta-/Auftragsnummer erzeugt werden.
                    </p>

                    <div class="card">

                        <h2>
                            ${betaNumber}
                        </h2>

                        <p class="muted">
                            Diese Nummer muss dem Team
                            auf Discord mitgeteilt werden.
                        </p>

                    </div>

                    <a
                        class="button primary"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Discord öffnen
                    </a>

                </div>
                `,
                req
            )
        );
    }
);

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
    res.status(404).send(
        page(
            "404",
            `
            <div class="card">

                <h1>404</h1>

                <p>
                    Diese Seite wurde nicht gefunden.
                </p>

                <a class="button primary" href="/">
                    Zur Startseite
                </a>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).send(
        page(
            "Fehler",
            `
            <div class="card">

                <h1>Interner Fehler</h1>

                <p>
                    Bei der Verarbeitung ist ein Fehler
                    aufgetreten.
                </p>

                <a class="button" href="/">
                    Startseite
                </a>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log(" North-Bot-2 Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port:", PORT);
    console.log("Discord:", DISCORD_INVITE);
    console.log("Owner:", OWNER_EMAIL);
    console.log("Ticket Kategorie:", TICKET_CATEGORY_ID);
    console.log("======================================");
});
