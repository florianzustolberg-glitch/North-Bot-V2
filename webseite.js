const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

// ============================================================
// NORTH-BOT-2 WEBSEITE
// ============================================================

// Discord Bot Token hier einsetzen.
// NICHT öffentlich auf GitHub hochladen!
const DISCORD_BOT_TOKEN = "DEIN_DISCORD_BOT_TOKEN";

// Discord Server
const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

// Ticket-Kategorie in Discord
const TICKET_CATEGORY_ID = "1493423287118729328";

// Admin
const OWNER_EMAIL = "florianzustolberg@gmail.com";

// ============================================================
// DATEIEN
// ============================================================

const DATA_DIR = __dirname;

const USERS_FILE = path.join(DATA_DIR, "users.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CODES_FILE = path.join(DATA_DIR, "codes.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const GIVEAWAYS_FILE = path.join(DATA_DIR, "giveaways.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const TEAMCHAT_FILE = path.join(DATA_DIR, "teamchat.json");
const BETAS_FILE = path.join(DATA_DIR, "betas.json");

// ============================================================
// DATENBANK-HILFEN
// ============================================================

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

function readJSON(file, fallback) {
    try {
        ensureFile(file, fallback);
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureFile(USERS_FILE, []);
ensureFile(TICKETS_FILE, []);
ensureFile(LOGS_FILE, []);
ensureFile(PRODUCTS_FILE, []);
ensureFile(CODES_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(GIVEAWAYS_FILE, []);
ensureFile(TEAMCHAT_FILE, []);
ensureFile(BETAS_FILE, []);

ensureFile(SETTINGS_FILE, {
    maintenance: {
        enabled: false,
        title: "Wartung",
        text: "Die Webseite befindet sich aktuell in Wartung."
    },
    outage: {
        enabled: false,
        title: "Störung",
        text: "Aktuell liegt eine Störung vor."
    },
    announcement: {
        enabled: false,
        title: "",
        text: ""
    }
});

// ============================================================
// EXPRESS
// ============================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: crypto.randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// ============================================================
// ID SYSTEM
// ============================================================

function randomCode(length = 8) {
    return crypto
        .randomBytes(length)
        .toString("hex")
        .toUpperCase()
        .slice(0, length);
}

function makeId(prefix) {
    return `${prefix}-${new Date().getFullYear()}-${randomCode(7)}`;
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

// ============================================================
// BENUTZER
// ============================================================

function getUsers() {
    return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
    writeJSON(USERS_FILE, users);
}

function getUserById(id) {
    return getUsers().find(u => u.id === id);
}

function getUserByEmail(email) {
    return getUsers().find(
        u => u.email.toLowerCase() === email.toLowerCase()
    );
}

function isAdmin(user) {
    if (!user) return false;

    return (
        user.role === "admin" ||
        user.role === "owner" ||
        user.role === "manager" ||
        user.role === "developer" ||
        user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
    );
}

function canManage(user) {
    return isAdmin(user);
}

// ============================================================
// USER ERSTELLEN / MIGRATION
// ============================================================

function normalizeUser(user) {
    if (!user.id) user.id = makeId("USER");

    if (typeof user.coins !== "number") user.coins = 0;

    if (!user.role) user.role = "user";

    if (!Array.isArray(user.usedCodes)) {
        user.usedCodes = [];
    }

    if (!Array.isArray(user.orders)) {
        user.orders = [];
    }

    if (!Array.isArray(user.tickets)) {
        user.tickets = [];
    }

    if (!Array.isArray(user.bans)) {
        user.bans = [];
    }

    if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
    }

    if (!user.lastDaily) {
        user.lastDaily = null;
    }

    if (typeof user.kicked !== "boolean") {
        user.kicked = false;
    }

    return user;
}

function migrateUsers() {
    const users = getUsers().map(normalizeUser);
    saveUsers(users);
}

migrateUsers();

// ============================================================
// BAN SYSTEM
// ============================================================

function activeBan(user) {
    if (!user || !Array.isArray(user.bans)) return null;

    const now = Date.now();

    return (
        user.bans.find(ban => {
            if (!ban.active) return false;

            if (!ban.expiresAt) return true;

            return new Date(ban.expiresAt).getTime() > now;
        }) || null
    );
}

// ============================================================
// LOG SYSTEM
// ============================================================

function addLog(type, message, user = null, extra = {}) {
    const logs = readJSON(LOGS_FILE, []);

    logs.unshift({
        id: makeId("LOG"),
        type,
        message,
        userId: user?.id || null,
        email: user?.email || null,
        username: user?.username || null,
        timestamp: new Date().toISOString(),
        extra
    });

    // Maximal 5000 Logs
    if (logs.length > 5000) {
        logs.splice(5000);
    }

    writeJSON(LOGS_FILE, logs);
}

// ============================================================
// HTML
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function page(title, content, user = null) {
    const settings = readJSON(SETTINGS_FILE, {});

    let banner = "";

    if (settings.maintenance?.enabled) {
        banner += `
        <div class="banner maintenance">
            <strong>🛠️ ${escapeHTML(settings.maintenance.title)}</strong>
            <span>${escapeHTML(settings.maintenance.text)}</span>
        </div>
        `;
    }

    if (settings.outage?.enabled) {
        banner += `
        <div class="banner outage">
            <strong>🚨 ${escapeHTML(settings.outage.title)}</strong>
            <span>${escapeHTML(settings.outage.text)}</span>
        </div>
        `;
    }

    if (settings.announcement?.enabled) {
        banner += `
        <div class="banner announcement">
            <strong>📢 ${escapeHTML(settings.announcement.title)}</strong>
            <span>${escapeHTML(settings.announcement.text)}</span>
        </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} | North-Bot-2</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background:
        radial-gradient(circle at top left, rgba(40,90,255,.18), transparent 35%),
        radial-gradient(circle at bottom right, rgba(150,60,255,.15), transparent 35%),
        #070914;
    color: #fff;
    min-height: 100vh;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 72px;
    padding: 0 6%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(8,10,25,.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,.08);
    position: sticky;
    top: 0;
    z-index: 50;
}

.logo {
    font-size: 21px;
    font-weight: 800;
}

.logo span {
    color: #6d8cff;
}

.navlinks {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.navlinks a {
    padding: 9px 13px;
    border-radius: 10px;
    color: #bfc5dd;
}

.navlinks a:hover {
    background: rgba(255,255,255,.07);
    color: white;
}

.container {
    width: min(1180px, 92%);
    margin: 40px auto;
}

.hero {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.hero-box {
    max-width: 850px;
}

.hero h1 {
    font-size: clamp(45px, 8vw, 90px);
    margin: 0 0 20px;
    letter-spacing: -4px;
}

.hero h1 span {
    color: #718cff;
}

.hero p {
    color: #adb5d1;
    font-size: 19px;
    line-height: 1.7;
}

.buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 30px;
}

.btn {
    border: 0;
    cursor: pointer;
    display: inline-block;
    padding: 13px 20px;
    border-radius: 12px;
    background: #718cff;
    color: white;
    font-weight: 700;
    transition: .2s;
}

.btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
}

.btn.secondary {
    background: rgba(255,255,255,.08);
}

.btn.danger {
    background: #e05252;
}

.btn.green {
    background: #31a86d;
}

.box {
    background: rgba(15,18,38,.75);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 18px;
    padding: 25px;
    margin-bottom: 20px;
    box-shadow: 0 20px 70px rgba(0,0,0,.2);
}

.center {
    text-align: center;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 18px;
}

.stat {
    padding: 22px;
    background: rgba(255,255,255,.04);
    border-radius: 14px;
}

.stat h2 {
    margin: 0 0 8px;
}

.muted {
    color: #8992b1;
}

input,
textarea,
select {
    width: 100%;
    padding: 13px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.1);
    background: #0c1022;
    color: white;
    margin: 7px 0 14px;
    outline: none;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    display: block;
    color: #c5cae0;
    font-weight: 600;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid rgba(255,255,255,.07);
}

th {
    color: #aab3d2;
}

.banner {
    padding: 15px 6%;
    display: flex;
    gap: 15px;
    align-items: center;
    flex-wrap: wrap;
}

.maintenance {
    background: #7b5c16;
}

.outage {
    background: #7b2020;
}

.announcement {
    background: #254b91;
}

.badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 12px;
    background: rgba(255,255,255,.1);
}

.card {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 15px;
    padding: 20px;
}

.ticket {
    border-left: 3px solid #718cff;
}

footer {
    text-align: center;
    padding: 45px;
    color: #727b99;
}

hr {
    border: 0;
    border-top: 1px solid rgba(255,255,255,.08);
    margin: 25px 0;
}

@media(max-width:700px) {
    .nav {
        height: auto;
        padding: 15px 5%;
        gap: 15px;
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
    North-<span>Bot-2</span>
</a>

<div class="navlinks">

<a href="/">Home</a>
<a href="/shop">Shop</a>
<a href="/tickets">Tickets</a>
<a href="/chat">Chat</a>

${
    user
        ? `
<a href="/profile">Profil</a>
<a href="/coins">🪙 ${user.coins || 0}</a>
${
    isAdmin(user)
        ? `<a href="/admin">Admin Panel</a>`
        : ""
}
<a href="/logout">Logout</a>
`
        : `
<a href="/login">Anmelden</a>
<a href="/register">Registrieren</a>
`
}

</div>
</nav>

${banner}

${content}

<footer>
North-Bot-2 · © ${new Date().getFullYear()}
</footer>

</body>
</html>
`;
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const user = getUserById(req.session.userId);

    if (!user) {
        req.session.destroy(() => {});
        return res.redirect("/login");
    }

    const ban = activeBan(user);

    if (ban) {
        return res.send(
            page(
                "Gebannt",
                `
                <div class="container">
                    <div class="box center">
                        <h1>🔨 Du bist gebannt</h1>
                        <p>${escapeHTML(ban.reason || "Kein Grund angegeben")}</p>
                        <p class="muted">
                            ${
                                ban.expiresAt
                                    ? "Ende: " +
                                      new Date(ban.expiresAt).toLocaleString(
                                          "de-DE"
                                      )
                                    : "Dieser Ban ist dauerhaft."
                            }
                        </p>

                        <a class="btn" href="${DISCORD_INVITE}" target="_blank">
                            Auf Discord entbannen lassen
                        </a>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const user = getUserById(req.session.userId);

    if (!isAdmin(user)) {
        return res.status(403).send(
            page(
                "Keine Berechtigung",
                `
                <div class="container">
                    <div class="box center">
                        <h1>⛔ Keine Berechtigung</h1>
                        <p>Du hast keinen Zugriff auf diesen Bereich.</p>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    req.user = user;
    next();
}

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
    const user = req.session.userId
        ? getUserById(req.session.userId)
        : null;

    res.send(
        page(
            "Home",
            `
            <section class="hero">
                <div class="hero-box">

                    <h1>
                        North-<span>Bot-2</span>
                    </h1>

                    <p>
                        Die offizielle North-Bot-2 Plattform.
                        Tickets, Coins, Shop, Support, Gewinnspiele
                        und viele weitere Systeme an einem Ort.
                    </p>

                    <div class="buttons">

                        <a class="btn"
                           href="${DISCORD_INVITE}"
                           target="_blank">
                            💬 Unserem Discord beitreten
                        </a>

                        ${
                            user
                                ? `<a class="btn secondary" href="/profile">
                                    Mein Profil
                                   </a>`
                                : `<a class="btn secondary" href="/register">
                                    Konto erstellen
                                   </a>`
                        }

                    </div>

                </div>
            </section>
            `,
            user
        )
    );
});

// ============================================================
// REGISTER
// ============================================================

app.get("/register", (req, res) => {
    res.send(
        page(
            "Registrieren",
            `
            <div class="container">

                <div class="box" style="max-width:550px;margin:auto">

                    <h1>Registrieren</h1>

                    <form method="POST" action="/register">

                        <label>Name</label>
                        <input
                            name="username"
                            required
                            minlength="3"
                            maxlength="32"
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

                        <button class="btn">
                            Konto erstellen
                        </button>

                    </form>

                    <hr>

                    <p class="muted">
                        Bereits registriert?
                        <a href="/login">Anmelden</a>
                    </p>

                </div>

            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || password.length < 6) {
        return res.send(
            page(
                "Fehler",
                `
                <div class="container">
                    <div class="box">
                        <h1>❌ Fehler</h1>
                        <p>Bitte alle Felder korrekt ausfüllen.</p>
                    </div>
                </div>
                `
            )
        );
    }

    const users = getUsers();

    if (users.some(u => u.email.toLowerCase() === email)) {
        return res.send(
            page(
                "Fehler",
                `
                <div class="container">
                    <div class="box">
                        <h1>❌ E-Mail bereits registriert</h1>
                        <a class="btn" href="/login">Anmelden</a>
                    </div>
                </div>
                `
            )
        );
    }

    const user = normalizeUser({
        id: makeId("USER"),
        username,
        email,
        password: hashPassword(password),
        role:
            email.toLowerCase() === OWNER_EMAIL.toLowerCase()
                ? "owner"
                : "user",
        coins: 0,
        usedCodes: [],
        orders: [],
        tickets: [],
        bans: [],
        lastDaily: null,
        kicked: false,
        createdAt: new Date().toISOString()
    });

    users.push(user);
    saveUsers(users);

    addLog(
        "REGISTER",
        `Benutzer ${username} wurde registriert.`,
        user
    );

    req.session.userId = user.id;

    res.redirect("/profile");
});

// ============================================================
// LOGIN
// ============================================================

app.get("/login", (req, res) => {
    res.send(
        page(
            "Anmelden",
            `
            <div class="container">

                <div class="box" style="max-width:550px;margin:auto">

                    <h1>Anmelden</h1>

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

                        <button class="btn">
                            Anmelden
                        </button>

                    </form>

                    <hr>

                    <p class="muted">
                        Noch kein Konto?
                        <a href="/register">Registrieren</a>
                    </p>

                </div>

            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = getUserByEmail(email);

    if (
        !user ||
        user.password !== hashPassword(password)
    ) {
        return res.send(
            page(
                "Login Fehler",
                `
                <div class="container">
                    <div class="box center">
                        <h1>❌ Login fehlgeschlagen</h1>
                        <p>E-Mail oder Passwort ist falsch.</p>
                        <a class="btn" href="/login">Zurück</a>
                    </div>
                </div>
                `
            )
        );
    }

    const ban = activeBan(user);

    if (ban) {
        return res.send(
            page(
                "Gebannt",
                `
                <div class="container">
                    <div class="box center">

                        <h1>🔨 Gebannt</h1>

                        <p>
                            ${escapeHTML(
                                ban.reason || "Kein Grund angegeben"
                            )}
                        </p>

                        <a
                            class="btn"
                            href="${DISCORD_INVITE}"
                            target="_blank"
                        >
                            Auf Discord entbannen lassen
                        </a>

                    </div>
                </div>
                `,
                user
            )
        );
    }

    req.session.userId = user.id;

    addLog(
        "LOGIN",
        `${user.username} hat sich angemeldet.`,
        user
    );

    res.redirect("/profile");
});

// ============================================================
// LOGOUT
// ============================================================

app.get("/logout", (req, res) => {
    const user = req.session.userId
        ? getUserById(req.session.userId)
        : null;

    if (user) {
        addLog(
            "LOGOUT",
            `${user.username} hat sich abgemeldet.`,
            user
        );
    }

    req.session.destroy(() => {
        res.redirect("/");
    });
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
            <div class="container">

                <div class="box">

                    <h1>👤 Mein Profil</h1>

                    <div class="grid">

                        <div class="stat">
                            <div class="muted">Benutzername</div>
                            <h2>${escapeHTML(user.username)}</h2>
                        </div>

                        <div class="stat">
                            <div class="muted">Coins</div>
                            <h2>🪙 ${user.coins}</h2>
                        </div>

                        <div class="stat">
                            <div class="muted">Rolle</div>
                            <h2>${escapeHTML(user.role)}</h2>
                        </div>

                        <div class="stat">
                            <div class="muted">Benutzer-ID</div>
                            <h2>${escapeHTML(user.id)}</h2>
                        </div>

                    </div>

                </div>

                <div class="box">

                    <h2>Profil bearbeiten</h2>

                    <form method="POST" action="/profile/edit">

                        <label>Name</label>

                        <input
                            name="username"
                            value="${escapeHTML(user.username)}"
                            maxlength="32"
                            required
                        >

                        <button class="btn">
                            Speichern
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>🪙 Coins</h2>

                    <a class="btn" href="/coins">
                        Coins & Codes
                    </a>

                </div>

            </div>
            `,
            user
        )
    );
});

app.post("/profile/edit", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    const oldName = user.username;

    user.username =
        String(req.body.username || "")
            .trim()
            .slice(0, 32) || oldName;

    saveUsers(users);

    addLog(
        "PROFILE_EDIT",
        `${oldName} hat den Profilnamen geändert.`,
        user,
        {
            oldName,
            newName: user.username
        }
    );

    res.redirect("/profile");
});

// ============================================================
// COINS
// ============================================================

app.get("/coins", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Coins",
            `
            <div class="container">

                <div class="box center">

                    <h1>🪙 ${user.coins} Coins</h1>

                    <p class="muted">
                        Deine Coins kannst du im Shop verwenden.
                    </p>

                </div>

                <div class="box">

                    <h2>🎁 Coin-Code einlösen</h2>

                    <form method="POST" action="/coins/redeem">

                        <label>Code</label>

                        <input
                            name="code"
                            placeholder="z.B. NORTH-100-XXXX"
                            required
                        >

                        <button class="btn">
                            Code einlösen
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>🎁 Daily Coins</h2>

                    <p>
                        Alle <strong>14 Stunden</strong> kannst du
                        <strong>100 Coins</strong> kostenlos abholen.
                    </p>

                    <form method="POST" action="/coins/daily">

                        <button class="btn green">
                            100 Coins abholen
                        </button>

                    </form>

                </div>

                <div class="buttons">

                    <a class="btn" href="/shop">
                        🛒 Zum Shop
                    </a>

                </div>

            </div>
            `,
            user
        )
    );
});

// ============================================================
// DAILY
// ============================================================

app.post("/coins/daily", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    const now = Date.now();

    if (user.lastDaily) {
        const last = new Date(user.lastDaily).getTime();

        if (now - last < 14 * 60 * 60 * 1000) {
            const remaining =
                14 * 60 * 60 * 1000 -
                (now - last);

            const hours = Math.floor(
                remaining / 3600000
            );

            const minutes = Math.floor(
                (remaining % 3600000) / 60000
            );

            return res.send(
                page(
                    "Daily",
                    `
                    <div class="container">
                        <div class="box center">
                            <h1>⏳ Noch nicht verfügbar</h1>
                            <p>
                                Du kannst deine nächsten
                                <strong>100 Coins</strong>
                                in etwa
                                ${hours}h ${minutes}m
                                abholen.
                            </p>
                            <a class="btn" href="/coins">Zurück</a>
                        </div>
                    </div>
                    `,
                    user
                )
            );
        }
    }

    const oldCoins = user.coins;

    user.coins += 100;
    user.lastDaily = new Date().toISOString();

    saveUsers(users);

    addLog(
        "DAILY_COINS",
        `${user.username} erhielt 100 Daily Coins.`,
        user,
        {
            amount: 100,
            before: oldCoins,
            after: user.coins
        }
    );

    res.redirect("/coins");
});

// ============================================================
// COIN CODE EINLÖSEN
// ============================================================

app.post("/coins/redeem", requireLogin, (req, res) => {
    const codeValue = String(
        req.body.code || ""
    ).trim().toUpperCase();

    const users = getUsers();
    const codes = readJSON(CODES_FILE, []);

    const user = users.find(
        u => u.id === req.user.id
    );

    const code = codes.find(
        c =>
            String(c.code).toUpperCase() === codeValue
    );

    if (!code) {
        return res.send(
            page(
                "Code",
                `
                <div class="container">
                    <div class="box center">
                        <h1>❌ Ungültiger Code</h1>
                        <a class="btn" href="/coins">Zurück</a>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    if (code.disabled) {
        return res.send(
            page(
                "Code",
                `
                <div class="container">
                    <div class="box center">
                        <h1>❌ Code deaktiviert</h1>
                        <a class="btn" href="/coins">Zurück</a>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    if (code.expiresAt) {
        if (
            new Date(code.expiresAt).getTime() <
            Date.now()
        ) {
            return res.send(
                page(
                    "Code",
                    `
                    <div class="container">
                        <div class="box center">
                            <h1>❌ Code abgelaufen</h1>
                            <a class="btn" href="/coins">Zurück</a>
                        </div>
                    </div>
                    `,
                    user
                )
            );
        }
    }

    if (
        Array.isArray(user.usedCodes) &&
        user.usedCodes.includes(code.code)
    ) {
        return res.send(
            page(
                "Code",
                `
                <div class="container">
                    <div class="box center">
                        <h1>❌ Bereits eingelöst</h1>
                        <p>
                            Du kannst denselben Code nur
                            einmal verwenden.
                        </p>
                        <a class="btn" href="/coins">Zurück</a>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    const oldCoins = user.coins;

    user.coins += Number(code.amount || 0);

    if (!Array.isArray(user.usedCodes)) {
        user.usedCodes = [];
    }

    user.usedCodes.push(code.code);

    code.usedCount =
        Number(code.usedCount || 0) + 1;

    if (code.maxUses) {
        if (code.usedCount >= code.maxUses) {
            code.disabled = true;
        }
    }

    saveUsers(users);
    writeJSON(CODES_FILE, codes);

    addLog(
        "COIN_CODE",
        `${user.username} löste einen Coin-Code ein.`,
        user,
        {
            code: code.code,
            amount: code.amount,
            before: oldCoins,
            after: user.coins
        }
    );

    res.send(
        page(
            "Code eingelöst",
            `
            <div class="container">
                <div class="box center">

                    <h1>✅ Erfolgreich</h1>

                    <h2>
                        +${Number(code.amount || 0)} 🪙
                    </h2>

                    <p>
                        Dein neues Guthaben:
                        <strong>${user.coins} Coins</strong>
                    </p>

                    <a class="btn" href="/coins">
                        Weiter
                    </a>

                </div>
            </div>
            `,
            user
        )
    );
});

// ============================================================
// SHOP
// ============================================================

app.get("/shop", (req, res) => {
    const user = req.session.userId
        ? getUserById(req.session.userId)
        : null;

    const products = readJSON(PRODUCTS_FILE, []);

    res.send(
        page(
            "Shop",
            `
            <div class="container">

                <div class="box">

                    <h1>🛒 Coins Shop</h1>

                    <p class="muted">
                        Kaufe Produkte mit deinen Coins.
                    </p>

                </div>

                <div class="grid">

                    ${
                        products.length
                            ? products
                                  .map(
                                      product => `
                            <div class="card">

                                <h2>
                                    ${escapeHTML(product.name)}
                                </h2>

                                <p class="muted">
                                    ${escapeHTML(
                                        product.description || ""
                                    )}
                                </p>

                                <h3>
                                    🪙 ${Number(product.price || 0)}
                                </h3>

                                ${
                                    user
                                        ? `
                                    <form
                                        method="POST"
                                        action="/shop/buy"
                                    >

                                        <input
                                            type="hidden"
                                            name="productId"
                                            value="${escapeHTML(
                                                product.id
                                            )}"
                                        >

                                        <button class="btn">
                                            Kaufen
                                        </button>

                                    </form>
                                    `
                                        : `
                                    <a
                                        class="btn"
                                        href="/login"
                                    >
                                        Anmelden
                                    </a>
                                    `
                                }

                            </div>
                            `
                                  )
                                  .join("")
                            : `
                            <div class="box center">
                                <h2>Aktuell keine Produkte</h2>
                                <p class="muted">
                                    Admins können Produkte
                                    im Admin Panel erstellen.
                                </p>
                            </div>
                            `
                    }

                </div>

            </div>
            `,
            user
        )
    );
});

// ============================================================
// SHOP KAUFEN
// ============================================================

app.post("/shop/buy", requireLogin, (req, res) => {
    const productId = req.body.productId;

    const products = readJSON(PRODUCTS_FILE, []);
    const users = getUsers();
    const orders = readJSON(ORDERS_FILE, []);

    const product = products.find(
        p => p.id === productId
    );

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!product) {
        return res.status(404).send("Produkt nicht gefunden.");
    }

    const price = Number(product.price || 0);

    if (user.coins < price) {
        return res.send(
            page(
                "Nicht genug Coins",
                `
                <div class="container">
                    <div class="box center">
                        <h1>❌ Nicht genug Coins</h1>
                        <p>
                            Du benötigst ${price} Coins.
                            Du hast ${user.coins}.
                        </p>
                        <a class="btn" href="/coins">
                            Coins verdienen
                        </a>
                    </div>
                </div>
                `,
                user
            )
        );
    }

    const before = user.coins;

    user.coins -= price;

    const order = {
        id: makeId("ORDER"),
        orderNumber: makeId("NB"),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.name,
        price,
        coinsBefore: before,
        coinsAfter: user.coins,
        status: "Offen",
        createdAt: new Date().toISOString()
    };

    orders.push(order);

    if (!Array.isArray(user.orders)) {
        user.orders = [];
    }

    user.orders.push(order.id);

    saveUsers(users);
    writeJSON(ORDERS_FILE, orders);

    addLog(
        "SHOP_PURCHASE",
        `${user.username} kaufte ${product.name}.`,
        user,
        {
            orderId: order.id,
            orderNumber: order.orderNumber,
            product: product.name,
            price
        }
    );

    res.send(
        page(
            "Bestellung",
            `
            <div class="container">

                <div class="box center">

                    <h1>✅ Bestellung erstellt</h1>

                    <p>
                        Deine Bestellung wurde erfolgreich
                        erstellt.
                    </p>

                    <h2>
                        ${escapeHTML(order.orderNumber)}
                    </h2>

                    <p class="muted">
                        Produkt:
                        ${escapeHTML(order.productName)}
                    </p>

                    <p>
                        Status:
                        <span class="badge">
                            ${escapeHTML(order.status)}
                        </span>
                    </p>

                    <a class="btn" href="/orders">
                        Meine Bestellungen
                    </a>

                </div>

            </div>
            `,
            user
        )
    );
});

// ============================================================
// BESTELLUNGEN
// ============================================================

app.get("/orders", requireLogin, (req, res) => {
    const orders = readJSON(ORDERS_FILE, []);

    const ownOrders = orders.filter(
        o => o.userId === req.user.id
    );

    res.send(
        page(
            "Bestellungen",
            `
            <div class="container">

                <div class="box">
                    <h1>📦 Meine Bestellungen</h1>
                </div>

                ${
                    ownOrders.length
                        ? ownOrders
                              .map(
                                  order => `
                            <div class="box">

                                <h2>
                                    ${escapeHTML(
                                        order.productName
                                    )}
                                </h2>

                                <p>
                                    Bestellnummer:
                                    <strong>
                                        ${escapeHTML(
                                            order.orderNumber
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Preis:
                                    🪙 ${order.price}
                                </p>

                                <p>
                                    Status:
                                    <span class="badge">
                                        ${escapeHTML(
                                            order.status
                                        )}
                                    </span>
                                </p>

                                <p class="muted">
                                    ${new Date(
                                        order.createdAt
                                    ).toLocaleString("de-DE")}
                                </p>

                            </div>
                            `
                              )
                              .join("")
                        : `
                        <div class="box center">
                            <h2>Noch keine Bestellungen</h2>
                        </div>
                        `
                }

            </div>
            `,
            req.user
        )
    );
});

// ============================================================
// TICKETS
// ============================================================

app.get("/tickets", requireLogin, (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const ownTickets = tickets.filter(
        t =>
            t.userId === req.user.id ||
            isAdmin(req.user)
    );

    res.send(
        page(
            "Tickets",
            `
            <div class="container">

                <div class="box">

                    <h1>🎟️ Support Tickets</h1>

                    <p>
                        ${
                            isAdmin(req.user)
                                ? "Als Admin siehst du alle Tickets."
                                : "Du siehst nur deine eigenen Tickets."
                        }
                    </p>

                    <form method="POST" action="/tickets/create">

                        <label>Betreff</label>

                        <input
                            name="subject"
                            maxlength="100"
                            required
                        >

                        <label>Nachricht</label>

                        <textarea
                            name="message"
                            maxlength="2000"
                            required
                        ></textarea>

                        <button class="btn">
                            Ticket erstellen
                        </button>

                    </form>

                </div>

                ${
                    ownTickets.length
                        ? ownTickets
                              .map(
                                  ticket => `
                            <div class="box ticket">

                                <h2>
                                    ${escapeHTML(
                                        ticket.subject
                                    )}
                                </h2>

                                <p>
                                    Ticket:
                                    <strong>
                                        ${escapeHTML(
                                            ticket.ticketNumber
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Status:
                                    <span class="badge">
                                        ${escapeHTML(
                                            ticket.status
                                        )}
                                    </span>
                                </p>

                                <p>
                                    ${escapeHTML(
                                        ticket.message
                                    )}
                                </p>

                                ${
                                    ticket.claimedBy
                                        ? `
                                        <p>
                                            Übernommen von:
                                            ${escapeHTML(
                                                ticket.claimedByName ||
                                                    ticket.claimedBy
                                            )}
                                        </p>
                                        `
                                        : ""
                                }

                                ${
                                    isAdmin(req.user)
                                        ? `
                                    <div class="buttons">

                                        ${
                                            ticket.status !==
                                            "geschlossen"
                                                ? `
                                            <form
                                                method="POST"
                                                action="/admin/tickets/claim"
                                            >
                                                <input
                                                    type="hidden"
                                                    name="id"
                                                    value="${escapeHTML(
                                                        ticket.id
                                                    )}"
                                                >
                                                <button class="btn">
                                                    ${
                                                        ticket.claimedBy
                                                            ? "Übernehmen"
                                                            : "Übernehmen"
                                                    }
                                                </button>
                                            </form>

                                            <form
                                                method="POST"
                                                action="/admin/tickets/unclaim"
                                            >
                                                <input
                                                    type="hidden"
                                                    name="id"
                                                    value="${escapeHTML(
                                                        ticket.id
                                                    )}"
                                                >
                                                <button class="btn secondary">
                                                    Nicht übernehmen
                                                </button>
                                            </form>

                                            <form
                                                method="POST"
                                                action="/admin/tickets/close"
                                            >
                                                <input
                                                    type="hidden"
                                                    name="id"
                                                    value="${escapeHTML(
                                                        ticket.id
                                                    )}"
                                                >
                                                <button class="btn danger">
                                                    Schließen
                                                </button>
                                            </form>
                                            `
                                                : ""
                                        }

                                    </div>
                                    `
                                        : ""
                                }

                            </div>
                            `
                              )
                              .join("")
                        : `
                        <div class="box center">
                            <h2>Keine Tickets</h2>
                        </div>
                        `
                }

            </div>
            `,
            req.user
        )
    );
});

// ============================================================
// TICKET ERSTELLEN
// ============================================================

app.post("/tickets/create", requireLogin, async (req, res) => {
    const tickets = readJSON(TICKETS_FILE, []);

    const ticket = {
        id: makeId("TICKET"),
        ticketNumber: makeId("TICKET"),
        userId: req.user.id,
        username: req.user.username,
        subject:
            String(req.body.subject || "")
                .trim()
                .slice(0, 100),
        message:
            String(req.body.message || "")
                .trim()
                .slice(0, 2000),
        status: "offen",
        claimedBy: null,
        claimedByName: null,
        discordChannelId: null,
        createdAt: new Date().toISOString()
    };

    tickets.push(ticket);

    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!Array.isArray(user.tickets)) {
        user.tickets = [];
    }

    user.tickets.push(ticket.id);

    saveUsers(users);
    writeJSON(TICKETS_FILE, tickets);

    addLog(
        "TICKET_CREATE",
        `${user.username} erstellte ${ticket.ticketNumber}.`,
        user,
        {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber
        }
    );

    // Optionaler Discord-Versuch.
    // Falls kein gültiger Bot-Token gesetzt wurde,
    // bleibt das Ticket trotzdem auf der Webseite.
    await createDiscordTicket(ticket, user);

    res.redirect("/tickets");
});

// ============================================================
// DISCORD TICKET
// ============================================================

async function discordRequest(endpoint, options = {}) {
    if (
        !DISCORD_BOT_TOKEN ||
        DISCORD_BOT_TOKEN === "DEIN_DISCORD_BOT_TOKEN"
    ) {
        return null;
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10${endpoint}`,
            {
                ...options,
                headers: {
                    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            }
        );

        if (!response.ok) {
            console.log(
                "Discord API Fehler:",
                response.status,
                await response.text()
            );

            return null;
        }

        return await response.json();
    } catch (error) {
        console.log("Discord Request Fehler:", error.message);
        return null;
    }
}

async function createDiscordTicket(ticket, user) {
    if (
        !DISCORD_BOT_TOKEN ||
        DISCORD_BOT_TOKEN === "DEIN_DISCORD_BOT_TOKEN"
    ) {
        return;
    }

    // Ohne Server-ID kann die Discord-API keinen Channel
    // direkt erstellen.
    // Deshalb wird nur versucht, falls DISCORD_GUILD_ID
    // vorhanden ist.
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!guildId) {
        return;
    }

    const channel = await discordRequest(
        `/guilds/${guildId}/channels`,
        {
            method: "POST",
            body: JSON.stringify({
                name: `ticket-${randomCode(4).toLowerCase()}`,
                type: 0,
                parent_id: TICKET_CATEGORY_ID,
                topic: `North-Bot-2 Ticket ${ticket.ticketNumber} | User: ${user.username}`,
                permission_overwrites: []
            })
        }
    );

    if (!channel?.id) {
        return;
    }

    const tickets = readJSON(TICKETS_FILE, []);

    const savedTicket = tickets.find(
        t => t.id === ticket.id
    );

    if (savedTicket) {
        savedTicket.discordChannelId = channel.id;
        writeJSON(TICKETS_FILE, tickets);
    }

    await discordRequest(
        `/channels/${channel.id}/messages`,
        {
            method: "POST",
            body: JSON.stringify({
                content:
                    `📩 **Neues North-Bot-2 Ticket**\n\n` +
                    `**Ticket:** ${ticket.ticketNumber}\n` +
                    `**User:** ${user.username}\n` +
                    `**Betreff:** ${ticket.subject}\n\n` +
                    `Bitte im Web-Admin-Panel bearbeiten.`
            })
        }
    );
}

// ============================================================
// TICKET ADMIN
// ============================================================

function findTicket(id) {
    const tickets = readJSON(TICKETS_FILE, []);

    return {
        tickets,
        ticket: tickets.find(t => t.id === id)
    };
}

app.post(
    "/admin/tickets/claim",
    requireAdmin,
    (req, res) => {
        const result = findTicket(req.body.id);

        if (!result.ticket) {
            return res.redirect("/tickets");
        }

        result.ticket.claimedBy = req.user.id;
        result.ticket.claimedByName = req.user.username;

        writeJSON(TICKETS_FILE, result.tickets);

        addLog(
            "TICKET_CLAIM",
            `${req.user.username} übernahm ${result.ticket.ticketNumber}.`,
            req.user
        );

        res.redirect("/tickets");
    }
);

app.post(
    "/admin/tickets/unclaim",
    requireAdmin,
    (req, res) => {
        const result = findTicket(req.body.id);

        if (!result.ticket) {
            return res.redirect("/tickets");
        }

        result.ticket.claimedBy = null;
        result.ticket.claimedByName = null;

        writeJSON(TICKETS_FILE, result.tickets);

        addLog(
            "TICKET_UNCLAIM",
            `${req.user.username} gab ${result.ticket.ticketNumber} frei.`,
            req.user
        );

        res.redirect("/tickets");
    }
);

app.post(
    "/admin/tickets/close",
    requireAdmin,
    (req, res) => {
        const result = findTicket(req.body.id);

        if (!result.ticket) {
            return res.redirect("/tickets");
        }

        result.ticket.status = "geschlossen";
        result.ticket.closedAt =
            new Date().toISOString();
        result.ticket.closedBy =
            req.user.username;

        writeJSON(TICKETS_FILE, result.tickets);

        addLog(
            "TICKET_CLOSE",
            `${req.user.username} schloss ${result.ticket.ticketNumber}.`,
            req.user
        );

        res.redirect("/tickets");
    }
);

// ============================================================
// CHAT
// ============================================================

app.get("/chat", requireLogin, (req, res) => {
    const messages = readJSON(
        TEAMCHAT_FILE,
        []
    ).filter(m => m.type === "public");

    res.send(
        page(
            "Chat",
            `
            <div class="container">

                <div class="box">

                    <h1>💬 Community Chat</h1>

                    <form method="POST" action="/chat/send">

                        <textarea
                            name="message"
                            maxlength="1000"
                            placeholder="Nachricht schreiben..."
                            required
                        ></textarea>

                        <button class="btn">
                            Senden
                        </button>

                    </form>

                </div>

                ${
                    messages
                        .map(
                            msg => `
                            <div class="box">

                                <strong>
                                    ${escapeHTML(
                                        msg.username
                                    )}
                                </strong>

                                <span class="muted">
                                    · ${new Date(
                                        msg.timestamp
                                    ).toLocaleString("de-DE")}
                                </span>

                                <p>
                                    ${escapeHTML(
                                        msg.message
                                    )}
                                </p>

                            </div>
                            `
                        )
                        .join("")
                }

            </div>
            `,
            req.user
        )
    );
});

app.post("/chat/send", requireLogin, (req, res) => {
    const messages = readJSON(
        TEAMCHAT_FILE,
        []
    );

    const message =
        String(req.body.message || "")
            .trim()
            .slice(0, 1000);

    if (!message) {
        return res.redirect("/chat");
    }

    messages.push({
        id: makeId("MSG"),
        type: "public",
        userId: req.user.id,
        username: req.user.username,
        message,
        timestamp: new Date().toISOString()
    });

    if (messages.length > 3000) {
        messages.splice(0, messages.length - 3000);
    }

    writeJSON(TEAMCHAT_FILE, messages);

    addLog(
        "CHAT",
        `${req.user.username} schrieb im Chat.`,
        req.user
    );

    res.redirect("/chat");
});

// ============================================================
// ADMIN PANEL
// ============================================================

app.get("/admin", requireAdmin, (req, res) => {
    const users = getUsers();
    const tickets = readJSON(TICKETS_FILE, []);
    const logs = readJSON(LOGS_FILE, []);
    const orders = readJSON(ORDERS_FILE, []);
    const products = readJSON(PRODUCTS_FILE, []);
    const codes = readJSON(CODES_FILE, []);
    const giveaways = readJSON(GIVEAWAYS_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});

    const totalCoins = users.reduce(
        (sum, user) => sum + Number(user.coins || 0),
        0
    );

    res.send(
        page(
            "Admin Panel",
            `
            <div class="container">

                <div class="box">

                    <h1>👑 North-Bot-2 Admin Panel</h1>

                    <p class="muted">
                        Eingeloggt als
                        ${escapeHTML(req.user.username)}
                    </p>

                </div>

                <div class="grid">

                    <div class="stat">
                        <h2>${users.length}</h2>
                        <span class="muted">
                            Registrierte User
                        </span>
                    </div>

                    <div class="stat">
                        <h2>${totalCoins}</h2>
                        <span class="muted">
                            Coins insgesamt
                        </span>
                    </div>

                    <div class="stat">
                        <h2>${tickets.length}</h2>
                        <span class="muted">
                            Tickets
                        </span>
                    </div>

                    <div class="stat">
                        <h2>${orders.length}</h2>
                        <span class="muted">
                            Bestellungen
                        </span>
                    </div>

                    <div class="stat">
                        <h2>${products.length}</h2>
                        <span class="muted">
                            Produkte
                        </span>
                    </div>

                    <div class="stat">
                        <h2>${codes.length}</h2>
                        <span class="muted">
                            Coin-Codes
                        </span>
                    </div>

                </div>

                <div class="box">

                    <h2>🪙 Coins verwalten</h2>

                    <form method="POST" action="/admin/coins">

                        <label>User-ID oder E-Mail</label>

                        <input
                            name="user"
                            required
                        >

                        <label>Aktion</label>

                        <select name="action">
                            <option value="add">
                                Coins hinzufügen
                            </option>
                            <option value="remove">
                                Coins entfernen
                            </option>
                            <option value="set">
                                Coins setzen
                            </option>
                        </select>

                        <label>Anzahl</label>

                        <input
                            type="number"
                            name="amount"
                            min="0"
                            required
                        >

                        <button class="btn">
                            Ausführen
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>🎟️ Coin-Code erstellen</h2>

                    <form method="POST" action="/admin/codes/create">

                        <label>Coins</label>

                        <input
                            type="number"
                            name="amount"
                            min="1"
                            required
                        >

                        <label>Max. Verwendungen</label>

                        <input
                            type="number"
                            name="maxUses"
                            min="1"
                            value="1"
                            required
                        >

                        <button class="btn">
                            Code erstellen
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>🛒 Produkt erstellen</h2>

                    <form method="POST" action="/admin/products/create">

                        <label>Name</label>

                        <input
                            name="name"
                            required
                        >

                        <label>Beschreibung</label>

                        <textarea
                            name="description"
                        ></textarea>

                        <label>Preis in Coins</label>

                        <input
                            type="number"
                            name="price"
                            min="1"
                            required
                        >

                        <button class="btn">
                            Produkt erstellen
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>📢 Status & Ankündigung</h2>

                    <form method="POST" action="/admin/settings">

                        <label>Wartung</label>

                        <select name="maintenanceEnabled">
                            <option value="false">
                                Aus
                            </option>
                            <option
                                value="true"
                                ${
                                    settings.maintenance
                                        ?.enabled
                                        ? "selected"
                                        : ""
                                }
                            >
                                An
                            </option>
                        </select>

                        <input
                            name="maintenanceTitle"
                            placeholder="Wartung Titel"
                            value="${escapeHTML(
                                settings.maintenance?.title || ""
                            )}"
                        >

                        <textarea
                            name="maintenanceText"
                            placeholder="Wartung Text"
                        >${escapeHTML(
                            settings.maintenance?.text || ""
                        )}</textarea>

                        <label>Störung</label>

                        <select name="outageEnabled">
                            <option value="false">
                                Aus
                            </option>
                            <option
                                value="true"
                                ${
                                    settings.outage
                                        ?.enabled
                                        ? "selected"
                                        : ""
                                }
                            >
                                An
                            </option>
                        </select>

                        <input
                            name="outageTitle"
                            placeholder="Störung Titel"
                            value="${escapeHTML(
                                settings.outage?.title || ""
                            )}"
                        >

                        <textarea
                            name="outageText"
                            placeholder="Störung Text"
                        >${escapeHTML(
                            settings.outage?.text || ""
                        )}</textarea>

                        <label>Ankündigung</label>

                        <select name="announcementEnabled">
                            <option value="false">
                                Aus
                            </option>
                            <option
                                value="true"
                                ${
                                    settings.announcement
                                        ?.enabled
                                        ? "selected"
                                        : ""
                                }
                            >
                                An
                            </option>
                        </select>

                        <input
                            name="announcementTitle"
                            placeholder="Ankündigung Titel"
                            value="${escapeHTML(
                                settings.announcement?.title || ""
                            )}"
                        >

                        <textarea
                            name="announcementText"
                            placeholder="Ankündigung Text"
                        >${escapeHTML(
                            settings.announcement?.text || ""
                        )}</textarea>

                        <button class="btn">
                            Speichern
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>👥 Benutzerverwaltung</h2>

                    <table>

                        <tr>
                            <th>User</th>
                            <th>E-Mail</th>
                            <th>Coins</th>
                            <th>Rolle</th>
                            <th>Status</th>
                            <th>Aktion</th>
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
                                    🪙 ${user.coins}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        user.role
                                    )}
                                </td>

                                <td>
                                    ${
                                        activeBan(user)
                                            ? "🔨 Gebannt"
                                            : "✅ Aktiv"
                                    }
                                </td>

                                <td>

                                    <form
                                        method="POST"
                                        action="/admin/users/ban"
                                    >

                                        <input
                                            type="hidden"
                                            name="userId"
                                            value="${escapeHTML(
                                                user.id
                                            )}"
                                        >

                                        <input
                                            name="reason"
                                            placeholder="Grund"
                                            required
                                        >

                                        <select name="duration">
                                            <option value="1">
                                                1 Stunde
                                            </option>
                                            <option value="24">
                                                24 Stunden
                                            </option>
                                            <option value="168">
                                                7 Tage
                                            </option>
                                            <option value="720">
                                                30 Tage
                                            </option>
                                            <option value="permanent">
                                                Permanent
                                            </option>
                                        </select>

                                        <button class="btn danger">
                                            Ban
                                        </button>

                                    </form>

                                    <form
                                        method="POST"
                                        action="/admin/users/unban"
                                    >

                                        <input
                                            type="hidden"
                                            name="userId"
                                            value="${escapeHTML(
                                                user.id
                                            )}"
                                        >

                                        <button class="btn green">
                                            Entbannen
                                        </button>

                                    </form>

                                </td>

                            </tr>
                            `
                            )
                            .join("")}

                    </table>

                </div>

                <div class="box">

                    <h2>📦 Bestellungen</h2>

                    <table>

                        <tr>
                            <th>Nummer</th>
                            <th>User</th>
                            <th>Produkt</th>
                            <th>Preis</th>
                            <th>Status</th>
                        </tr>

                        ${orders
                            .map(
                                order => `
                            <tr>

                                <td>
                                    ${escapeHTML(
                                        order.orderNumber
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
                                    🪙 ${order.price}
                                </td>

                                <td>

                                    <form
                                        method="POST"
                                        action="/admin/orders/status"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(
                                                order.id
                                            )}"
                                        >

                                        <select name="status">

                                            <option
                                                ${
                                                    order.status ===
                                                    "Offen"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Offen
                                            </option>

                                            <option
                                                ${
                                                    order.status ===
                                                    "In Bearbeitung"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                In Bearbeitung
                                            </option>

                                            <option
                                                ${
                                                    order.status ===
                                                    "Abgeschlossen"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Abgeschlossen
                                            </option>

                                        </select>

                                        <button class="btn">
                                            Speichern
                                        </button>

                                    </form>

                                </td>

                            </tr>
                            `
                            )
                            .join("")}

                    </table>

                </div>

                <div class="box">

                    <h2>📝 Logs</h2>

                    <table>

                        <tr>
                            <th>Zeit</th>
                            <th>Typ</th>
                            <th>User</th>
                            <th>Aktion</th>
                            <th>ID</th>
                        </tr>

                        ${logs
                            .slice(0, 100)
                            .map(
                                log => `
                            <tr>

                                <td>
                                    ${new Date(
                                        log.timestamp
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
                                        log.username || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        log.message
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        log.id
                                    )}
                                </td>

                            </tr>
                            `
                            )
                            .join("")}

                    </table>

                </div>

                <div class="box">

                    <h2>💬 Team Chat</h2>

                    <form
                        method="POST"
                        action="/admin/teamchat"
                    >

                        <textarea
                            name="message"
                            maxlength="2000"
                            required
                            placeholder="Team-Nachricht..."
                        ></textarea>

                        <button class="btn">
                            Nachricht senden
                        </button>

                    </form>

                </div>

            </div>
            `,
            req.user
        )
    );
});

// ============================================================
// ADMIN COINS
// ============================================================

app.post(
    "/admin/coins",
    requireAdmin,
    (req, res) => {
        const users = getUsers();

        const search =
            String(req.body.user || "")
                .trim()
                .toLowerCase();

        const amount = Math.max(
            0,
            Number(req.body.amount || 0)
        );

        const action = req.body.action;

        const user = users.find(
            u =>
                u.id.toLowerCase() === search ||
                u.email.toLowerCase() === search
        );

        if (!user) {
            return res.status(404).send(
                page(
                    "User nicht gefunden",
                    `
                    <div class="container">
                        <div class="box center">
                            <h1>❌ User nicht gefunden</h1>
                            <a class="btn" href="/admin">
                                Zurück
                            </a>
                        </div>
                    </div>
                    `,
                    req.user
                )
            );
        }

        const before = user.coins;

        if (action === "add") {
            user.coins += amount;
        }

        if (action === "remove") {
            user.coins = Math.max(
                0,
                user.coins - amount
            );
        }

        if (action === "set") {
            user.coins = amount;
        }

        saveUsers(users);

        addLog(
            "ADMIN_COINS",
            `${req.user.username} änderte Coins von ${user.username}.`,
            req.user,
            {
                targetUserId: user.id,
                action,
                amount,
                before,
                after: user.coins
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN CODE ERSTELLEN
// ============================================================

app.post(
    "/admin/codes/create",
    requireAdmin,
    (req, res) => {
        const codes = readJSON(CODES_FILE, []);

        const amount = Math.max(
            1,
            Number(req.body.amount || 0)
        );

        const maxUses = Math.max(
            1,
            Number(req.body.maxUses || 1)
        );

        const code = {
            id: makeId("CODE"),
            code: `NORTH-${amount}-${randomCode(8)}`,
            amount,
            maxUses,
            usedCount: 0,
            disabled: false,
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };

        codes.push(code);

        writeJSON(CODES_FILE, codes);

        addLog(
            "CODE_CREATE",
            `${req.user.username} erstellte einen Coin-Code.`,
            req.user,
            {
                code: code.code,
                amount
            }
        );

        res.send(
            page(
                "Code erstellt",
                `
                <div class="container">

                    <div class="box center">

                        <h1>✅ Code erstellt</h1>

                        <h2>
                            ${escapeHTML(code.code)}
                        </h2>

                        <p>
                            Wert:
                            🪙 ${code.amount}
                        </p>

                        <p>
                            Max. Nutzungen:
                            ${code.maxUses}
                        </p>

                        <a class="btn" href="/admin">
                            Admin Panel
                        </a>

                    </div>

                </div>
                `,
                req.user
            )
        );
    }
);

// ============================================================
// ADMIN PRODUKT
// ============================================================

app.post(
    "/admin/products/create",
    requireAdmin,
    (req, res) => {
        const products = readJSON(
            PRODUCTS_FILE,
            []
        );

        const product = {
            id: makeId("PRODUCT"),
            name:
                String(req.body.name || "")
                    .trim()
                    .slice(0, 100),
            description:
                String(req.body.description || "")
                    .trim()
                    .slice(0, 2000),
            price: Math.max(
                1,
                Number(req.body.price || 0)
            ),
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };

        products.push(product);

        writeJSON(PRODUCTS_FILE, products);

        addLog(
            "PRODUCT_CREATE",
            `${req.user.username} erstellte ${product.name}.`,
            req.user,
            {
                productId: product.id
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN BESTELLSTATUS
// ============================================================

app.post(
    "/admin/orders/status",
    requireAdmin,
    (req, res) => {
        const orders = readJSON(
            ORDERS_FILE,
            []
        );

        const order = orders.find(
            o => o.id === req.body.id
        );

        if (!order) {
            return res.redirect("/admin");
        }

        order.status =
            String(req.body.status || "Offen");

        order.updatedAt =
            new Date().toISOString();

        order.updatedBy =
            req.user.username;

        writeJSON(ORDERS_FILE, orders);

        addLog(
            "ORDER_STATUS",
            `${req.user.username} änderte den Status von ${order.orderNumber}.`,
            req.user,
            {
                orderId: order.id,
                status: order.status
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN BAN
// ============================================================

app.post(
    "/admin/users/ban",
    requireAdmin,
    (req, res) => {
        const users = getUsers();

        const user = users.find(
            u => u.id === req.body.userId
        );

        if (!user) {
            return res.redirect("/admin");
        }

        // Owner nicht bannbar
        if (
            user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
        ) {
            return res.send(
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="box center">
                            <h1>❌ Owner kann nicht gebannt werden.</h1>
                            <a class="btn" href="/admin">
                                Zurück
                            </a>
                        </div>
                    </div>
                    `,
                    req.user
                )
            );
        }

        let expiresAt = null;

        if (req.body.duration !== "permanent") {
            const hours = Number(
                req.body.duration || 1
            );

            expiresAt = new Date(
                Date.now() +
                    hours * 60 * 60 * 1000
            ).toISOString();
        }

        if (!Array.isArray(user.bans)) {
            user.bans = [];
        }

        user.bans.forEach(
            ban => (ban.active = false)
        );

        const ban = {
            id: makeId("BAN"),
            reason:
                String(req.body.reason || "")
                    .trim()
                    .slice(0, 1000),
            expiresAt,
            active: true,
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };

        user.bans.push(ban);

        saveUsers(users);

        addLog(
            "BAN",
            `${req.user.username} bannte ${user.username}.`,
            req.user,
            {
                targetUserId: user.id,
                banId: ban.id,
                reason: ban.reason,
                expiresAt
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN UNBAN
// ============================================================

app.post(
    "/admin/users/unban",
    requireAdmin,
    (req, res) => {
        const users = getUsers();

        const user = users.find(
            u => u.id === req.body.userId
        );

        if (!user) {
            return res.redirect("/admin");
        }

        if (Array.isArray(user.bans)) {
            user.bans.forEach(
                ban => (ban.active = false)
            );
        }

        saveUsers(users);

        addLog(
            "UNBAN",
            `${req.user.username} entbannte ${user.username}.`,
            req.user,
            {
                targetUserId: user.id
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// TEAM CHAT
// ============================================================

app.post(
    "/admin/teamchat",
    requireAdmin,
    (req, res) => {
        const messages = readJSON(
            TEAMCHAT_FILE,
            []
        );

        messages.push({
            id: makeId("TEAM"),
            type: "team",
            userId: req.user.id,
            username: req.user.username,
            message:
                String(req.body.message || "")
                    .trim()
                    .slice(0, 2000),
            timestamp: new Date().toISOString()
        });

        writeJSON(
            TEAMCHAT_FILE,
            messages
        );

        addLog(
            "TEAM_CHAT",
            `${req.user.username} schrieb im Teamchat.`,
            req.user
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN SETTINGS
// ============================================================

app.post(
    "/admin/settings",
    requireAdmin,
    (req, res) => {
        const settings = readJSON(
            SETTINGS_FILE,
            {}
        );

        settings.maintenance = {
            enabled:
                req.body.maintenanceEnabled ===
                "true",
            title:
                String(
                    req.body.maintenanceTitle || ""
                ).slice(0, 100),
            text:
                String(
                    req.body.maintenanceText || ""
                ).slice(0, 2000)
        };

        settings.outage = {
            enabled:
                req.body.outageEnabled ===
                "true",
            title:
                String(
                    req.body.outageTitle || ""
                ).slice(0, 100),
            text:
                String(
                    req.body.outageText || ""
                ).slice(0, 2000)
        };

        settings.announcement = {
            enabled:
                req.body.announcementEnabled ===
                "true",
            title:
                String(
                    req.body.announcementTitle || ""
                ).slice(0, 100),
            text:
                String(
                    req.body.announcementText || ""
                ).slice(0, 2000)
        };

        writeJSON(
            SETTINGS_FILE,
            settings
        );

        addLog(
            "SETTINGS",
            `${req.user.username} änderte Webseiteinstellungen.`,
            req.user
        );

        res.redirect("/admin");
    }
);

// ============================================================
// ADMIN GEWINNSPIELE
// ============================================================

app.post(
    "/admin/giveaway/create",
    requireAdmin,
    (req, res) => {
        const giveaways = readJSON(
            GIVEAWAYS_FILE,
            []
        );

        const giveaway = {
            id: makeId("GIVEAWAY"),
            title:
                String(req.body.title || "")
                    .trim()
                    .slice(0, 100),
            prize:
                String(req.body.prize || "")
                    .trim()
                    .slice(0, 500),
            winnerCount: Math.max(
                1,
                Number(req.body.winnerCount || 1)
            ),
            participants: [],
            active: true,
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };

        giveaways.push(giveaway);

        writeJSON(
            GIVEAWAYS_FILE,
            giveaways
        );

        addLog(
            "GIVEAWAY_CREATE",
            `${req.user.username} erstellte ein Gewinnspiel.`,
            req.user,
            {
                giveawayId: giveaway.id
            }
        );

        res.redirect("/admin");
    }
);

// ============================================================
// GEWINNSPIELE USER
// ============================================================

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = readJSON(
        GIVEAWAYS_FILE,
        []
    );

    const active = giveaways.filter(
        g => g.active
    );

    res.send(
        page(
            "Gewinnspiele",
            `
            <div class="container">

                <div class="box">
                    <h1>🎉 Gewinnspiele</h1>
                </div>

                ${
                    active.length
                        ? active
                              .map(
                                  g => `
                            <div class="box">

                                <h2>
                                    ${escapeHTML(
                                        g.title
                                    )}
                                </h2>

                                <p>
                                    Gewinn:
                                    ${escapeHTML(
                                        g.prize
                                    )}
                                </p>

                                <p>
                                    Teilnehmer:
                                    ${g.participants.length}
                                </p>

                                <form
                                    method="POST"
                                    action="/giveaways/join"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(
                                            g.id
                                        )}"
                                    >

                                    <button class="btn">
                                        Teilnehmen
                                    </button>

                                </form>

                            </div>
                            `
                              )
                              .join("")
                        : `
                        <div class="box center">
                            <h2>Keine aktiven Gewinnspiele</h2>
                        </div>
                        `
                }

            </div>
            `,
            req.user
        )
    );
});

app.post(
    "/giveaways/join",
    requireLogin,
    (req, res) => {
        const giveaways = readJSON(
            GIVEAWAYS_FILE,
            []
        );

        const giveaway = giveaways.find(
            g => g.id === req.body.id
        );

        if (!giveaway || !giveaway.active) {
            return res.redirect("/giveaways");
        }

        if (
            !giveaway.participants.includes(
                req.user.id
            )
        ) {
            giveaway.participants.push(
                req.user.id
            );

            writeJSON(
                GIVEAWAYS_FILE,
                giveaways
            );

            addLog(
                "GIVEAWAY_JOIN",
                `${req.user.username} nahm an einem Gewinnspiel teil.`,
                req.user,
                {
                    giveawayId: giveaway.id
                }
            );
        }

        res.redirect("/giveaways");
    }
);

// ============================================================
// BETA / DEVELOPER NUMMERN
// ============================================================

app.post(
    "/admin/beta/create",
    requireAdmin,
    (req, res) => {
        const betas = readJSON(
            BETAS_FILE,
            []
        );

        const beta = {
            id: makeId("BETA"),
            number: `NB-BETA-${randomCode(10)}`,
            type:
                String(req.body.type || "developer"),
            createdBy: req.user.id,
            usedBy: null,
            usedAt: null,
            createdAt: new Date().toISOString()
        };

        betas.push(beta);

        writeJSON(
            BETAS_FILE,
            betas
        );

        addLog(
            "BETA_CREATE",
            `${req.user.username} erstellte eine Betatestnummer.`,
            req.user,
            {
                betaNumber: beta.number
            }
        );

        res.send(
            page(
                "Betatestnummer",
                `
                <div class="container">
                    <div class="box center">

                        <h1>🧑‍💻 Betatestnummer</h1>

                        <h2>
                            ${escapeHTML(
                                beta.number
                            )}
                        </h2>

                        <p>
                            Diese Nummer kann dem
                            Team zur Prüfung gegeben werden.
                        </p>

                        <a class="btn" href="/admin">
                            Admin Panel
                        </a>

                    </div>
                </div>
                `,
                req.user
            )
        );
    }
);

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
    const user = req.session.userId
        ? getUserById(req.session.userId)
        : null;

    res.status(404).send(
        page(
            "404",
            `
            <div class="container">

                <div class="box center">

                    <h1>404</h1>

                    <p>
                        Diese Seite wurde nicht gefunden.
                    </p>

                    <a class="btn" href="/">
                        Zur Startseite
                    </a>

                </div>

            </div>
            `,
            user
        )
    );
});

// ============================================================
// SERVER
// ============================================================

app.listen(PORT, () => {
    console.log("======================================");
    console.log("      NORTH-BOT-2 WEBSEITE");
    console.log("======================================");
    console.log(`Webseite läuft auf Port ${PORT}`);
    console.log(`Discord: ${DISCORD_INVITE}`);
    console.log("======================================");
});
