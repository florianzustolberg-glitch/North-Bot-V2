/*
===========================================================
 NORTH BOT 2 - WEBSEITE
 Komplett neue Version
 Node.js 18+ / 20+ / 22+ / 24+
===========================================================

Benötigt:
  npm install express

Start:
  node webseite.js

Die folgenden Dateien werden automatisch erstellt:
  users.json
  sessions.json
  tickets.json
  codes.json
  shop.json
  giveaways.json
  logs.json
  applications.json
  orders.json
  announcements.json
  settings.json
  teamchat.json

KEIN .env notwendig.
===========================================================
*/

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

/*
===========================================================
 KONFIGURATION
===========================================================
*/

const OWNER_EMAIL = "florianzustolberg@gmail.com";

// Nur für den ersten Login.
// Nach dem ersten Login sollte das Passwort geändert werden.
const OWNER_INITIAL_PASSWORD = "278263";

const COOKIE_NAME = "north_session";

const DAILY_COINS = 100;
const DAILY_INTERVAL = 14 * 60 * 60 * 1000;

/*
===========================================================
 DATEIEN
===========================================================
*/

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    sessions: path.join(DATA_DIR, "sessions.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    applications: path.join(DATA_DIR, "applications.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    announcements: path.join(DATA_DIR, "announcements.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    teamchat: path.join(DATA_DIR, "teamchat.json")
};

/*
===========================================================
 STANDARD-DATEN
===========================================================
*/

const DEFAULT_SETTINGS = {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    outage: false,
    outageText: "Momentan liegt eine Störung vor.",
    announcement: "",
    announcementEnabled: false
};

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.sessions, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.applications, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.settings, DEFAULT_SETTINGS);
ensureFile(FILES.teamchat, []);

/*
===========================================================
 JSON HELPERS
===========================================================
*/

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            writeJSON(file, fallback);
            return fallback;
        }

        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
            writeJSON(file, fallback);
            return fallback;
        }

        return JSON.parse(raw);
    } catch (err) {
        console.error("JSON Fehler:", file, err.message);

        try {
            writeJSON(file, fallback);
        } catch (_) {}

        return fallback;
    }
}

function writeJSON(file, data) {
    const temp = `${file}.tmp`;

    fs.writeFileSync(
        temp,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(temp, file);
}

function getUsers() {
    return readJSON(FILES.users, []);
}

function saveUsers(data) {
    writeJSON(FILES.users, data);
}

function getSessions() {
    return readJSON(FILES.sessions, []);
}

function saveSessions(data) {
    writeJSON(FILES.sessions, data);
}

function getTickets() {
    return readJSON(FILES.tickets, []);
}

function saveTickets(data) {
    writeJSON(FILES.tickets, data);
}

function getCodes() {
    return readJSON(FILES.codes, []);
}

function saveCodes(data) {
    writeJSON(FILES.codes, data);
}

function getShop() {
    return readJSON(FILES.shop, []);
}

function saveShop(data) {
    writeJSON(FILES.shop, data);
}

function getGiveaways() {
    return readJSON(FILES.giveaways, []);
}

function saveGiveaways(data) {
    writeJSON(FILES.giveaways, data);
}

function getLogs() {
    return readJSON(FILES.logs, []);
}

function saveLogs(data) {
    writeJSON(FILES.logs, data);
}

function getApplications() {
    return readJSON(FILES.applications, []);
}

function saveApplications(data) {
    writeJSON(FILES.applications, data);
}

function getOrders() {
    return readJSON(FILES.orders, []);
}

function saveOrders(data) {
    writeJSON(FILES.orders, data);
}

function getAnnouncements() {
    return readJSON(FILES.announcements, []);
}

function saveAnnouncements(data) {
    writeJSON(FILES.announcements, data);
}

function getSettings() {
    return {
        ...DEFAULT_SETTINGS,
        ...readJSON(FILES.settings, DEFAULT_SETTINGS)
    };
}

function saveSettings(data) {
    writeJSON(FILES.settings, data);
}

function getTeamChat() {
    return readJSON(FILES.teamchat, []);
}

function saveTeamChat(data) {
    writeJSON(FILES.teamchat, data);
}

/*
===========================================================
 HILFSFUNKTIONEN
===========================================================
*/

function id(prefix = "id") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

function randomPart(length = 4) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";

    for (let i = 0; i < length; i++) {
        result += chars[crypto.randomInt(0, chars.length)];
    }

    return result;
}

function createCode() {
    let code;

    do {
        code = `NORTH-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
    } while (getCodes().some(c => c.code === code));

    return code;
}

function createOrderNumber() {
    return `NB-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
}

function createBetaNumber() {
    return `BETA-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function verifyPassword(password, hash) {
    return hashPassword(password) === hash;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
    if (!timestamp) return "-";

    return new Date(timestamp).toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function parseDuration(value) {
    if (!value) return null;

    const match = String(value)
        .trim()
        .toLowerCase()
        .match(/^(\d+)\s*(s|m|h|d)$/);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2];

    if (unit === "s") return amount * 1000;
    if (unit === "m") return amount * 60 * 1000;
    if (unit === "h") return amount * 60 * 60 * 1000;
    if (unit === "d") return amount * 24 * 60 * 60 * 1000;

    return null;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getUserById(userId) {
    return getUsers().find(user => user.id === userId);
}

function getUserByEmail(email) {
    const normalized = normalizeEmail(email);

    return getUsers().find(
        user => normalizeEmail(user.email) === normalized
    );
}

function isAdmin(user) {
    if (!user) return false;

    return (
        user.role === "owner" ||
        user.role === "admin" ||
        user.role === "manager"
    );
}

function isStaff(user) {
    if (!user) return false;

    return (
        isAdmin(user) ||
        user.role === "moderator" ||
        user.role === "developer"
    );
}

function roleName(role) {
    const names = {
        owner: "Owner",
        admin: "Admin",
        manager: "Manager",
        moderator: "Moderator",
        developer: "Developer",
        user: "User"
    };

    return names[role] || "User";
}

function logAction(action, actor, details = {}) {
    const logs = getLogs();

    logs.unshift({
        id: id("log"),
        action,
        actorId: actor?.id || null,
        actorEmail: actor?.email || "System",
        details,
        createdAt: Date.now()
    });

    if (logs.length > 5000) {
        logs.length = 5000;
    }

    saveLogs(logs);
}

function createSession(userId) {
    const sessions = getSessions();

    const token = crypto.randomBytes(48).toString("hex");

    sessions.push({
        token,
        userId,
        createdAt: Date.now(),
        lastUsed: Date.now()
    });

    if (sessions.length > 2000) {
        sessions.splice(0, sessions.length - 2000);
    }

    saveSessions(sessions);

    return token;
}

function destroySession(token) {
    if (!token) return;

    const sessions = getSessions();
    const filtered = sessions.filter(s => s.token !== token);

    saveSessions(filtered);
}

function getCookie(req, name) {
    const cookies = String(req.headers.cookie || "")
        .split(";")
        .map(part => part.trim());

    for (const cookie of cookies) {
        const index = cookie.indexOf("=");

        if (index === -1) continue;

        const key = cookie.slice(0, index);

        if (key === name) {
            return decodeURIComponent(cookie.slice(index + 1));
        }
    }

    return null;
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );
}

function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
}

function currentUser(req) {
    const token = getCookie(req, COOKIE_NAME);

    if (!token) return null;

    const sessions = getSessions();
    const session = sessions.find(s => s.token === token);

    if (!session) return null;

    const user = getUserById(session.userId);

    if (!user) {
        destroySession(token);
        return null;
    }

    if (user.bannedUntil && user.bannedUntil > Date.now()) {
        return null;
    }

    if (user.bannedUntil && user.bannedUntil <= Date.now()) {
        user.bannedUntil = null;
        user.banReason = null;

        const users = getUsers();
        const index = users.findIndex(u => u.id === user.id);

        if (index !== -1) {
            users[index] = user;
            saveUsers(users);
        }
    }

    session.lastUsed = Date.now();

    const index = sessions.findIndex(s => s.token === token);

    if (index !== -1) {
        sessions[index] = session;
        saveSessions(sessions);
    }

    return user;
}

/*
===========================================================
 OWNER AUTOMATISCH ANLEGEN
===========================================================
*/

function ensureOwner() {
    const users = getUsers();

    let owner = users.find(
        user => normalizeEmail(user.email) === OWNER_EMAIL
    );

    if (!owner) {
        owner = {
            id: id("user"),
            name: "Florian",
            email: OWNER_EMAIL,
            passwordHash: hashPassword(OWNER_INITIAL_PASSWORD),
            role: "owner",
            coins: 0,
            createdAt: Date.now(),
            lastDaily: 0,
            bannedUntil: null,
            banReason: null,
            kickedUntil: null,
            usedCodes: [],
            purchasedItems: [],
            joinedGiveaways: [],
            betaNumbers: []
        };

        users.push(owner);
        saveUsers(users);

        console.log("Owner-Konto wurde automatisch erstellt.");
        console.log("E-Mail:", OWNER_EMAIL);
        console.log("Initiales Passwort:", OWNER_INITIAL_PASSWORD);
    } else {
        let changed = false;

        if (owner.role !== "owner") {
            owner.role = "owner";
            changed = true;
        }

        if (typeof owner.coins !== "number") {
            owner.coins = 0;
            changed = true;
        }

        if (!Array.isArray(owner.usedCodes)) {
            owner.usedCodes = [];
            changed = true;
        }

        if (!Array.isArray(owner.purchasedItems)) {
            owner.purchasedItems = [];
            changed = true;
        }

        if (!Array.isArray(owner.joinedGiveaways)) {
            owner.joinedGiveaways = [];
            changed = true;
        }

        if (!Array.isArray(owner.betaNumbers)) {
            owner.betaNumbers = [];
            changed = true;
        }

        if (changed) {
            saveUsers(users);
        }
    }
}

ensureOwner();

/*
===========================================================
 EXPRESS
===========================================================
*/

app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

app.use(express.json({
    limit: "1mb"
}));

/*
===========================================================
 AUTH MIDDLEWARE
===========================================================
*/

function requireLogin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    req.user = user;

    next();
}

function requireAdmin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Du benötigst Admin-Rechte für diesen Bereich.</p>
                    <a class="btn" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    req.user = user;

    next();
}

/*
===========================================================
 HTML DESIGN
===========================================================
*/

function page(title, content, user = null) {
    const settings = getSettings();

    const nav = user
        ? `
            <a href="/">Home</a>
            <a href="/tickets">Tickets</a>
            <a href="/coins">Coins</a>
            <a href="/shop">Shop</a>
            <a href="/giveaways">Gewinnspiele</a>
            <a href="/applications">Bewerbungen</a>
            <a href="/chat">Chat</a>
            ${
                isAdmin(user)
                    ? `<a href="/admin">Admin</a>`
                    : ""
            }
            <a href="/profile">Profil</a>
            <a href="/logout">Logout</a>
        `
        : `
            <a href="/login">Login</a>
            <a href="/register">Registrieren</a>
        `;

    let statusBar = "";

    if (settings.maintenance) {
        statusBar += `
            <div class="alert warning">
                <b>Wartung</b><br>
                ${escapeHTML(settings.maintenanceText)}
            </div>
        `;
    }

    if (settings.outage) {
        statusBar += `
            <div class="alert danger">
                <b>Störung</b><br>
                ${escapeHTML(settings.outageText)}
            </div>
        `;
    }

    if (settings.announcementEnabled && settings.announcement) {
        statusBar += `
            <div class="alert info">
                <b>Ankündigung</b><br>
                ${escapeHTML(settings.announcement)}
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} | North Bot</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #0c0f14;
    color: #f2f4f7;
    font-family: Arial, Helvetica, sans-serif;
}

a {
    color: inherit;
    text-decoration: none;
}

.top {
    min-height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 15px 5%;
    background: #11151c;
    border-bottom: 1px solid #252b35;
    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: .4px;
}

.logo span {
    color: #7289da;
}

.nav {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.nav a {
    padding: 9px 12px;
    border-radius: 8px;
    color: #aeb7c5;
}

.nav a:hover {
    background: #1b212b;
    color: white;
}

.container {
    width: min(1200px, 92%);
    margin: 35px auto;
}

.hero {
    padding: 55px 35px;
    border: 1px solid #252b35;
    background: #11151c;
    border-radius: 18px;
    margin-bottom: 25px;
}

.hero h1 {
    margin-top: 0;
    font-size: 42px;
}

.hero p {
    color: #aeb7c5;
    font-size: 17px;
    line-height: 1.6;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 15px;
}

.card {
    background: #11151c;
    border: 1px solid #252b35;
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 15px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #8e98a7;
}

.stat {
    font-size: 30px;
    font-weight: 800;
    margin: 10px 0;
}

input,
select,
textarea {
    width: 100%;
    background: #0b0e13;
    border: 1px solid #303744;
    color: white;
    padding: 12px;
    border-radius: 9px;
    margin: 6px 0 14px;
    outline: none;
}

textarea {
    min-height: 110px;
    resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
    border-color: #7289da;
}

button,
.btn {
    display: inline-block;
    border: 0;
    background: #5865f2;
    color: white;
    padding: 11px 16px;
    border-radius: 9px;
    cursor: pointer;
    font-weight: 700;
}

button:hover,
.btn:hover {
    opacity: .9;
}

.btn.secondary {
    background: #252b35;
}

.btn.danger {
    background: #d64545;
}

.btn.success {
    background: #2f9e68;
}

.btn.warning {
    background: #b98222;
}

.badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 99px;
    background: #252b35;
    color: #dce2eb;
    font-size: 12px;
}

.badge.owner {
    background: #7357d9;
}

.badge.admin {
    background: #5865f2;
}

.badge.developer {
    background: #258f72;
}

.badge.moderator {
    background: #a86f2b;
}

.alert {
    margin: 15px auto;
    width: min(1200px, 92%);
    padding: 14px 17px;
    border-radius: 10px;
    border: 1px solid #303744;
}

.alert.warning {
    background: #2a2111;
    border-color: #795d1f;
}

.alert.danger {
    background: #2c1518;
    border-color: #7d3038;
}

.alert.info {
    background: #131d32;
    border-color: #304d82;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 11px;
    text-align: left;
    border-bottom: 1px solid #252b35;
    vertical-align: top;
}

th {
    color: #9da7b6;
    font-size: 13px;
}

.small {
    font-size: 13px;
}

.form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
}

.message {
    padding: 12px;
    border-radius: 10px;
    background: #171c24;
    border: 1px solid #252b35;
    margin-bottom: 9px;
}

.footer {
    margin-top: 60px;
    padding: 35px;
    text-align: center;
    color: #707a89;
    border-top: 1px solid #252b35;
}

.coins {
    color: #f0c75e;
    font-weight: 800;
}

.price {
    color: #7ed9a9;
    font-weight: 800;
}

.center {
    text-align: center;
}

.danger-text {
    color: #ff7272;
}

.success-text {
    color: #6ee7a3;
}

@media(max-width: 800px) {
    .top {
        align-items: flex-start;
        flex-direction: column;
    }

    .nav {
        justify-content: flex-start;
    }

    .hero h1 {
        font-size: 32px;
    }

    table {
        display: block;
        overflow-x: auto;
    }
}
</style>
</head>

<body>

<header class="top">
    <div class="logo">
        NORTH <span>BOT</span>
    </div>

    <nav class="nav">
        ${nav}
    </nav>
</header>

${statusBar}

<main class="container">
${content}
</main>

<footer class="footer">
    North Bot 2 · Discord Community ·
    <a href="${DISCORD_INVITE}" target="_blank">Discord</a>
</footer>

</body>
</html>
`;
}

/*
===========================================================
 HOME
===========================================================
*/

app.get("/", (req, res) => {
    const user = currentUser(req);

    if (!user) {
        return res.send(
            page(
                "Startseite",
                `
                <section class="hero">
                    <h1>North Bot</h1>
                    <p>
                        Community-Webseite für Tickets, Coins,
                        Gewinnspiele, Shop, Bewerbungen und Team-Systeme.
                    </p>

                    <a class="btn" href="/login">Anmelden</a>
                    <a class="btn secondary" href="/register">Registrieren</a>
                    <a class="btn secondary" href="${DISCORD_INVITE}" target="_blank">
                        Discord
                    </a>
                </section>

                <div class="grid">
                    <div class="card">
                        <h3>Tickets</h3>
                        <p class="muted">
                            Erstelle Tickets und kommuniziere mit dem Team.
                        </p>
                    </div>

                    <div class="card">
                        <h3>Coins</h3>
                        <p class="muted">
                            Sammle Coins über Daily-Belohnungen und Codes.
                        </p>
                    </div>

                    <div class="card">
                        <h3>Shop</h3>
                        <p class="muted">
                            Tausche deine Coins gegen Produkte ein.
                        </p>
                    </div>

                    <div class="card">
                        <h3>Gewinnspiele</h3>
                        <p class="muted">
                            Nimm an Community-Gewinnspielen teil.
                        </p>
                    </div>
                </div>
                `
            )
        );
    }

    const activeTickets = getTickets()
        .filter(t => t.status === "open")
        .filter(t => t.userId === user.id || isAdmin(user))
        .length;

    res.send(
        page(
            "Dashboard",
            `
            <section class="hero">
                <h1>Willkommen, ${escapeHTML(user.name)}</h1>

                <p>
                    Du bist als
                    <span class="badge ${escapeHTML(user.role)}">
                        ${escapeHTML(roleName(user.role))}
                    </span>
                    angemeldet.
                </p>

                <a class="btn" href="/tickets">Tickets</a>
                <a class="btn secondary" href="/coins">Coins</a>
                <a class="btn secondary" href="/shop">Shop</a>
            </section>

            <div class="grid">

                <div class="card">
                    <h3>Deine Coins</h3>
                    <div class="stat coins">
                        ${Number(user.coins || 0)}
                    </div>
                    <a class="btn secondary" href="/coins">
                        Coins öffnen
                    </a>
                </div>

                <div class="card">
                    <h3>Offene Tickets</h3>
                    <div class="stat">
                        ${activeTickets}
                    </div>
                    <a class="btn secondary" href="/tickets">
                        Tickets öffnen
                    </a>
                </div>

                <div class="card">
                    <h3>Gewinnspiele</h3>
                    <div class="stat">
                        ${getGiveaways().filter(g => g.status === "open").length}
                    </div>
                    <a class="btn secondary" href="/giveaways">
                        Gewinnspiele
                    </a>
                </div>

                ${
                    isAdmin(user)
                        ? `
                        <div class="card">
                            <h3>Adminpanel</h3>
                            <p class="muted">
                                Benutzer, Coins, Codes, Tickets,
                                Logs und Systeme verwalten.
                            </p>
                            <a class="btn" href="/admin">
                                Adminpanel
                            </a>
                        </div>
                        `
                        : ""
                }

            </div>
            `,
            user
        )
    );
});

/*
===========================================================
 REGISTRIERUNG
===========================================================
*/

app.get("/register", (req, res) => {
    res.send(
        page(
            "Registrieren",
            `
            <div class="card">
                <h1>Konto erstellen</h1>

                <form method="POST" action="/register">

                    <label>Name</label>
                    <input
                        name="name"
                        required
                        maxlength="40"
                        placeholder="Dein Name"
                    >

                    <label>E-Mail</label>
                    <input
                        type="email"
                        name="email"
                        required
                        maxlength="120"
                        placeholder="name@example.de"
                    >

                    <label>Passwort</label>
                    <input
                        type="password"
                        name="password"
                        required
                        minlength="6"
                        maxlength="100"
                    >

                    <label>Passwort wiederholen</label>
                    <input
                        type="password"
                        name="password2"
                        required
                        minlength="6"
                        maxlength="100"
                    >

                    <button type="submit">
                        Registrieren
                    </button>
                </form>

                <p class="muted">
                    Bereits registriert?
                    <a href="/login">Jetzt anmelden</a>
                </p>
            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");

    if (name.length < 2) {
        return res.status(400).send(
            page(
                "Fehler",
                `<div class="card"><h2>Fehler</h2><p>Name ist zu kurz.</p><a class="btn" href="/register">Zurück</a></div>`
            )
        );
    }

    if (!email.includes("@")) {
        return res.status(400).send(
            page(
                "Fehler",
                `<div class="card"><h2>Fehler</h2><p>Ungültige E-Mail-Adresse.</p><a class="btn" href="/register">Zurück</a></div>`
            )
        );
    }

    if (password.length < 6) {
        return res.status(400).send(
            page(
                "Fehler",
                `<div class="card"><h2>Fehler</h2><p>Das Passwort muss mindestens 6 Zeichen haben.</p><a class="btn" href="/register">Zurück</a></div>`
            )
        );
    }

    if (password !== password2) {
        return res.status(400).send(
            page(
                "Fehler",
                `<div class="card"><h2>Fehler</h2><p>Die Passwörter stimmen nicht überein.</p><a class="btn" href="/register">Zurück</a></div>`
            )
        );
    }

    if (getUserByEmail(email)) {
        return res.status(409).send(
            page(
                "Fehler",
                `<div class="card"><h2>Konto existiert bereits</h2><p>Diese E-Mail-Adresse ist bereits registriert.</p><a class="btn" href="/login">Zum Login</a></div>`
            )
        );
    }

    const users = getUsers();

    const user = {
        id: id("user"),
        name,
        email,
        passwordHash: hashPassword(password),
        role: "user",
        coins: 0,
        createdAt: Date.now(),
        lastDaily: 0,
        bannedUntil: null,
        banReason: null,
        kickedUntil: null,
        usedCodes: [],
        purchasedItems: [],
        joinedGiveaways: [],
        betaNumbers: []
    };

    users.push(user);
    saveUsers(users);

    logAction(
        "REGISTER",
        user,
        {
            email: user.email
        }
    );

    const token = createSession(user.id);

    setSessionCookie(res, token);

    res.redirect("/");
});

/*
===========================================================
 LOGIN
===========================================================
*/

app.get("/login", (req, res) => {
    const user = currentUser(req);

    if (user) {
        return res.redirect("/");
    }

    res.send(
        page(
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
                        Anmelden
                    </button>

                </form>

                <p class="muted">
                    Noch kein Konto?
                    <a href="/register">Registrieren</a>
                </p>
            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    const user = getUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="card">
                    <h2>Login fehlgeschlagen</h2>
                    <p>
                        E-Mail oder Passwort ist falsch.
                    </p>
                    <a class="btn" href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (user.bannedUntil && user.bannedUntil > Date.now()) {
        return res.status(403).send(
            page(
                "Gebannt",
                `
                <div class="card">
                    <h2>Dein Konto ist gebannt.</h2>

                    <p>
                        Grund:
                        <b>${escapeHTML(user.banReason || "Kein Grund angegeben")}</b>
                    </p>

                    <p>
                        Ban endet:
                        <b>${formatDate(user.bannedUntil)}</b>
                    </p>

                    <a
                        class="btn"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Im Discord entbannen lassen
                    </a>
                </div>
                `
            )
        );
    }

    if (
        user.kickedUntil &&
        user.kickedUntil > Date.now()
    ) {
        return res.status(403).send(
            page(
                "Kick",
                `
                <div class="card">
                    <h2>Du wurdest temporär gekickt.</h2>
                    <p>
                        Du kannst dich wieder anmelden ab:
                        <b>${formatDate(user.kickedUntil)}</b>
                    </p>
                </div>
                `
            )
        );
    }

    const token = createSession(user.id);

    setSessionCookie(res, token);

    logAction(
        "LOGIN",
        user
    );

    res.redirect("/");
});

/*
===========================================================
 LOGOUT
===========================================================
*/

app.get("/logout", (req, res) => {
    const token = getCookie(req, COOKIE_NAME);
    const user = currentUser(req);

    destroySession(token);
    clearSessionCookie(res);

    if (user) {
        logAction(
            "LOGOUT",
            user
        );
    }

    res.redirect("/login");
});

/*
===========================================================
 PROFIL
===========================================================
*/

app.get("/profile", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Profil",
            `
            <div class="card">
                <h1>Mein Profil</h1>

                <p>
                    Rolle:
                    <span class="badge ${escapeHTML(user.role)}">
                        ${escapeHTML(roleName(user.role))}
                    </span>
                </p>

                <p>
                    Coins:
                    <span class="coins">
                        ${Number(user.coins || 0)}
                    </span>
                </p>

                <p class="muted">
                    Registriert: ${formatDate(user.createdAt)}
                </p>
            </div>

            <div class="card">
                <h2>Profil bearbeiten</h2>

                <form method="POST" action="/profile">

                    <label>Name</label>
                    <input
                        name="name"
                        value="${escapeHTML(user.name)}"
                        maxlength="40"
                        required
                    >

                    <button>
                        Speichern
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Passwort ändern</h2>

                <form method="POST" action="/profile/password">

                    <label>Altes Passwort</label>
                    <input
                        type="password"
                        name="oldPassword"
                        required
                    >

                    <label>Neues Passwort</label>
                    <input
                        type="password"
                        name="newPassword"
                        minlength="6"
                        required
                    >

                    <label>Neues Passwort wiederholen</label>
                    <input
                        type="password"
                        name="newPassword2"
                        minlength="6"
                        required
                    >

                    <button>
                        Passwort ändern
                    </button>

                </form>
            </div>
            `,
            user
        )
    );
});

app.post("/profile", requireLogin, (req, res) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === req.user.id);

    if (index === -1) {
        return res.redirect("/logout");
    }

    const name = String(req.body.name || "").trim();

    if (name.length >= 2 && name.length <= 40) {
        users[index].name = name;
        saveUsers(users);

        logAction(
            "PROFILE_NAME_CHANGED",
            req.user,
            {
                name
            }
        );
    }

    res.redirect("/profile");
});

app.post("/profile/password", requireLogin, (req, res) => {
    const oldPassword = String(req.body.oldPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const newPassword2 = String(req.body.newPassword2 || "");

    if (!verifyPassword(oldPassword, req.user.passwordHash)) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Altes Passwort falsch.</h2>
                    <a class="btn" href="/profile">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    if (newPassword.length < 6 || newPassword !== newPassword2) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Neues Passwort ungültig.</h2>
                    <a class="btn" href="/profile">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    const users = getUsers();
    const index = users.findIndex(u => u.id === req.user.id);

    users[index].passwordHash = hashPassword(newPassword);

    saveUsers(users);

    logAction(
        "PASSWORD_CHANGED",
        req.user
    );

    res.redirect("/profile");
});

/*
===========================================================
 DAILY COINS
===========================================================
*/

function claimDaily(user) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === user.id);

    if (index === -1) {
        return {
            ok: false,
            message: "Benutzer nicht gefunden."
        };
    }

    const now = Date.now();
    const last = Number(users[index].lastDaily || 0);

    if (last && now - last < DAILY_INTERVAL) {
        const remaining = DAILY_INTERVAL - (now - last);

        return {
            ok: false,
            remaining,
            message: `Daily bereits abgeholt. Noch ${Math.ceil(remaining / 60000)} Minuten.`
        };
    }

    users[index].coins = Number(users[index].coins || 0) + DAILY_COINS;
    users[index].lastDaily = now;

    saveUsers(users);

    logAction(
        "DAILY_COINS",
        user,
        {
            coins: DAILY_COINS
        }
    );

    return {
        ok: true,
        coins: DAILY_COINS
    };
}

app.post("/coins/daily", requireLogin, (req, res) => {
    const result = claimDaily(req.user);

    if (!result.ok) {
        return res.send(
            page(
                "Daily",
                `
                <div class="card">
                    <h2>Daily</h2>
                    <p>${escapeHTML(result.message)}</p>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    res.send(
        page(
            "Daily",
            `
            <div class="card center">
                <h2>Daily abgeholt!</h2>
                <p class="coins">
                    +${DAILY_COINS} Coins
                </p>
                <a class="btn" href="/coins">Weiter</a>
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 COINS
===========================================================
*/

app.get("/coins", requireLogin, (req, res) => {
    const freshUser = getUserById(req.user.id);

    res.send(
        page(
            "Coins",
            `
            <div class="card">
                <h1>Coins</h1>

                <div class="stat coins">
                    ${Number(freshUser.coins || 0)}
                </div>

                <p class="muted">
                    Alle 14 Stunden kannst du
                    ${DAILY_COINS} Daily-Coins abholen.
                </p>

                <form method="POST" action="/coins/daily">
                    <button>
                        Daily abholen
                    </button>
                </form>
            </div>

            <div class="card">
                <h2>Code einlösen</h2>

                <form method="POST" action="/coins/redeem">

                    <label>Coin-Code</label>

                    <input
                        name="code"
                        placeholder="NORTH-XXXX-XXXX-XXXX"
                        required
                        maxlength="40"
                    >

                    <button>
                        Code einlösen
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Deine eingelösten Codes</h2>

                ${
                    freshUser.usedCodes?.length
                        ? freshUser.usedCodes
                            .map(code => `
                                <div class="message">
                                    ${escapeHTML(code)}
                                </div>
                            `)
                            .join("")
                        : `<p class="muted">Noch keine Codes eingelöst.</p>`
                }
            </div>
            `,
            freshUser
        )
    );
});

app.post("/coins/redeem", requireLogin, (req, res) => {
    const input = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const codes = getCodes();

    const code = codes.find(
        c => String(c.code).toUpperCase() === input
    );

    if (!code) {
        return res.status(404).send(
            page(
                "Code",
                `
                <div class="card">
                    <h2>Code nicht gefunden</h2>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    if (code.disabled) {
        return res.status(400).send(
            page(
                "Code",
                `
                <div class="card">
                    <h2>Dieser Code ist deaktiviert.</h2>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    if (
        code.expiresAt &&
        code.expiresAt < Date.now()
    ) {
        return res.status(400).send(
            page(
                "Code",
                `
                <div class="card">
                    <h2>Dieser Code ist abgelaufen.</h2>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    const users = getUsers();
    const index = users.findIndex(u => u.id === req.user.id);

    if (index === -1) {
        return res.redirect("/logout");
    }

    if (!Array.isArray(users[index].usedCodes)) {
        users[index].usedCodes = [];
    }

    if (users[index].usedCodes.includes(code.code)) {
        return res.status(400).send(
            page(
                "Code",
                `
                <div class="card">
                    <h2>Code bereits eingelöst</h2>
                    <p>
                        Du kannst denselben Code nur einmal benutzen.
                    </p>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    if (
        code.maxUses !== null &&
        Number(code.uses || 0) >= Number(code.maxUses)
    ) {
        return res.status(400).send(
            page(
                "Code",
                `
                <div class="card">
                    <h2>Code aufgebraucht</h2>
                    <a class="btn" href="/coins">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    users[index].coins =
        Number(users[index].coins || 0) +
        Number(code.coins || 0);

    users[index].usedCodes.push(code.code);

    saveUsers(users);

    const codeIndex = codes.findIndex(c => c.id === code.id);

    if (codeIndex !== -1) {
        codes[codeIndex].uses =
            Number(codes[codeIndex].uses || 0) + 1;

        codes[codeIndex].lastUsedBy = req.user.id;
        codes[codeIndex].lastUsedAt = Date.now();
    }

    saveCodes(codes);

    logAction(
        "CODE_REDEEM",
        req.user,
        {
            code: code.code,
            coins: code.coins
        }
    );

    res.send(
        page(
            "Code eingelöst",
            `
            <div class="card center">
                <h2>Code erfolgreich eingelöst!</h2>

                <div class="stat coins">
                    +${Number(code.coins || 0)} Coins
                </div>

                <a class="btn" href="/coins">
                    Weiter
                </a>
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 SHOP
===========================================================
*/

app.get("/shop", requireLogin, (req, res) => {
    const shop = getShop();
    const user = getUserById(req.user.id);

    res.send(
        page(
            "Coin Shop",
            `
            <div class="hero">
                <h1>Coin Shop</h1>
                <p>
                    Dein Guthaben:
                    <span class="coins">
                        ${Number(user.coins || 0)} Coins
                    </span>
                </p>
            </div>

            <div class="grid">
                ${
                    shop.length
                        ? shop.map(item => `
                            <div class="card">
                                <h2>
                                    ${escapeHTML(item.name)}
                                </h2>

                                <p class="muted">
                                    ${escapeHTML(item.description || "")}
                                </p>

                                <p class="price">
                                    ${Number(item.price)} Coins
                                </p>

                                <form
                                    method="POST"
                                    action="/shop/buy/${encodeURIComponent(item.id)}"
                                >
                                    <button
                                        ${item.stock === 0 ? "disabled" : ""}
                                    >
                                        ${
                                            item.stock === 0
                                                ? "Ausverkauft"
                                                : "Kaufen"
                                        }
                                    </button>
                                </form>
                            </div>
                        `).join("")
                        : `
                            <div class="card">
                                <h2>Shop leer</h2>
                                <p class="muted">
                                    Momentan gibt es keine Produkte.
                                </p>
                            </div>
                        `
                }
            </div>
            `,
            user
        )
    );
});

app.post("/shop/buy/:id", requireLogin, (req, res) => {
    const shop = getShop();
    const users = getUsers();

    const item = shop.find(
        product => product.id === req.params.id
    );

    const userIndex = users.findIndex(
        u => u.id === req.user.id
    );

    if (!item || userIndex === -1) {
        return res.redirect("/shop");
    }

    if (Number(item.stock) === 0) {
        return res.status(400).send(
            page(
                "Shop",
                `
                <div class="card">
                    <h2>Ausverkauft</h2>
                    <a class="btn" href="/shop">Shop</a>
                </div>
                `,
                req.user
            )
        );
    }

    if (Number(users[userIndex].coins || 0) < Number(item.price)) {
        return res.status(400).send(
            page(
                "Shop",
                `
                <div class="card">
                    <h2>Nicht genug Coins</h2>
                    <p>
                        Du benötigst ${Number(item.price)} Coins.
                    </p>
                    <a class="btn" href="/coins">Coins</a>
                </div>
                `,
                req.user
            )
        );
    }

    users[userIndex].coins -= Number(item.price);

    if (!Array.isArray(users[userIndex].purchasedItems)) {
        users[userIndex].purchasedItems = [];
    }

    const order = {
        id: id("order"),
        orderNumber: createOrderNumber(),
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        status: "open",
        betaNumber:
            item.developer || item.requiresBeta
                ? createBetaNumber()
                : null,
        createdAt: Date.now()
    };

    users[userIndex].purchasedItems.push(order.id);

    if (
        Number(item.stock) > 0 &&
        Number(item.stock) !== -1
    ) {
        const itemIndex = shop.findIndex(
            product => product.id === item.id
        );

        if (itemIndex !== -1) {
            shop[itemIndex].stock--;
        }
    }

    saveUsers(users);
    saveShop(shop);

    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    logAction(
        "SHOP_PURCHASE",
        req.user,
        {
            orderNumber: order.orderNumber,
            item: item.name,
            price: item.price
        }
    );

    res.send(
        page(
            "Bestellung",
            `
            <div class="card">
                <h2>Bestellung erfolgreich</h2>

                <p>
                    Bestellnummer:
                    <b>${escapeHTML(order.orderNumber)}</b>
                </p>

                ${
                    order.betaNumber
                        ? `
                        <p>
                            Beta-/Entwicklernummer:
                            <b>${escapeHTML(order.betaNumber)}</b>
                        </p>

                        <p class="muted">
                            Diese Nummer musst du dem Team im Discord geben,
                            wenn für das Produkt eine Entwicklerprüfung
                            erforderlich ist.
                        </p>
                        `
                        : ""
                }

                <a
                    class="btn"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Zum Discord
                </a>

                <a class="btn secondary" href="/shop">
                    Shop
                </a>
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 TICKETS
===========================================================
*/

function ticketVisible(ticket, user) {
    return (
        isAdmin(user) ||
        ticket.userId === user.id
    );
}

app.get("/tickets", requireLogin, (req, res) => {
    const tickets = getTickets()
        .filter(ticket => ticketVisible(ticket, req.user));

    res.send(
        page(
            "Tickets",
            `
            <div class="hero">
                <h1>Tickets</h1>
                <p>
                    Eigene Tickets sehen nur du und die Admins.
                </p>

                <a class="btn" href="/tickets/new">
                    Ticket erstellen
                </a>
            </div>

            ${
                tickets.length
                    ? tickets.map(ticket => `
                        <div class="card">

                            <h2>
                                ${escapeHTML(ticket.subject)}
                            </h2>

                            <span class="badge">
                                ${escapeHTML(ticket.status)}
                            </span>

                            <p class="muted">
                                Erstellt:
                                ${formatDate(ticket.createdAt)}
                            </p>

                            <p>
                                ${escapeHTML(ticket.message)}
                            </p>

                            <a
                                class="btn"
                                href="/tickets/${encodeURIComponent(ticket.id)}"
                            >
                                Ticket öffnen
                            </a>
                        </div>
                    `).join("")
                    : `
                        <div class="card">
                            <h2>Keine Tickets</h2>
                        </div>
                    `
            }
            `,
            req.user
        )
    );
});

app.get("/tickets/new", requireLogin, (req, res) => {
    res.send(
        page(
            "Ticket erstellen",
            `
            <div class="card">
                <h1>Ticket erstellen</h1>

                <form method="POST" action="/tickets">

                    <label>Betreff</label>
                    <input
                        name="subject"
                        maxlength="100"
                        required
                    >

                    <label>Nachricht</label>
                    <textarea
                        name="message"
                        maxlength="5000"
                        required
                    ></textarea>

                    <button>
                        Ticket erstellen
                    </button>

                </form>
            </div>
            `,
            req.user
        )
    );
});

app.post("/tickets", requireLogin, (req, res) => {
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!subject || !message) {
        return res.redirect("/tickets/new");
    }

    const tickets = getTickets();

    const ticket = {
        id: id("ticket"),
        number: `T-${randomPart(6)}`,
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        subject,
        message,
        status: "open",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        closedAt: null
    };

    tickets.unshift(ticket);

    saveTickets(tickets);

    logAction(
        "TICKET_CREATE",
        req.user,
        {
            ticketId: ticket.id,
            number: ticket.number
        }
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const ticket = getTickets().find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send(
            page(
                "Ticket",
                `<div class="card"><h2>Ticket nicht gefunden.</h2></div>`,
                req.user
            )
        );
    }

    if (!ticketVisible(ticket, req.user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `<div class="card"><h2>Dieses Ticket gehört dir nicht.</h2></div>`,
                req.user
            )
        );
    }

    res.send(
        page(
            `Ticket ${ticket.number}`,
            `
            <div class="card">
                <h1>
                    ${escapeHTML(ticket.subject)}
                </h1>

                <p>
                    Ticket:
                    <b>${escapeHTML(ticket.number)}</b>
                </p>

                <span class="badge">
                    ${escapeHTML(ticket.status)}
                </span>

                <p class="muted">
                    Erstellt:
                    ${formatDate(ticket.createdAt)}
                </p>

                <div class="message">
                    <b>
                        ${escapeHTML(ticket.userName)}
                    </b>

                    <p>
                        ${escapeHTML(ticket.message)}
                    </p>
                </div>

                ${
                    ticket.messages
                        .map(message => `
                            <div class="message">
                                <b>
                                    ${escapeHTML(message.userName)}
                                </b>

                                <span class="muted small">
                                    ${formatDate(message.createdAt)}
                                </span>

                                <p>
                                    ${escapeHTML(message.text)}
                                </p>
                            </div>
                        `)
                        .join("")
                }

                ${
                    ticket.status === "open"
                        ? `
                        <form
                            method="POST"
                            action="/tickets/${encodeURIComponent(ticket.id)}/message"
                        >

                            <textarea
                                name="message"
                                placeholder="Nachricht..."
                                maxlength="5000"
                                required
                            ></textarea>

                            <button>
                                Nachricht senden
                            </button>

                        </form>
                        `
                        : `
                        <p class="muted">
                            Dieses Ticket wurde geschlossen.
                        </p>
                        `
                }

                ${
                    isAdmin(req.user) &&
                    ticket.status === "open"
                        ? `
                        <form
                            method="POST"
                            action="/tickets/${encodeURIComponent(ticket.id)}/close"
                            style="margin-top:10px"
                        >
                            <button class="btn danger">
                                Ticket schließen
                            </button>
                        </form>
                        `
                        : ""
                }

            </div>
            `,
            req.user
        )
    );
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const tickets = getTickets();

    const index = tickets.findIndex(
        t => t.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    const ticket = tickets[index];

    if (!ticketVisible(ticket, req.user)) {
        return res.status(403).send("Kein Zugriff");
    }

    if (ticket.status !== "open") {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    const message = String(req.body.message || "").trim();

    if (!message) {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    ticket.messages.push({
        id: id("message"),
        userId: req.user.id,
        userName: req.user.name,
        text: message,
        createdAt: Date.now()
    });

    ticket.updatedAt = Date.now();

    saveTickets(tickets);

    logAction(
        "TICKET_MESSAGE",
        req.user,
        {
            ticketId: ticket.id
        }
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.post("/tickets/:id/close", requireAdmin, (req, res) => {
    const tickets = getTickets();

    const index = tickets.findIndex(
        t => t.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/tickets");
    }

    tickets[index].status = "closed";
    tickets[index].closedAt = Date.now();
    tickets[index].updatedAt = Date.now();

    saveTickets(tickets);

    logAction(
        "TICKET_CLOSE",
        req.user,
        {
            ticketId: tickets[index].id
        }
    );

    res.redirect(`/tickets/${tickets[index].id}`);
});

/*
===========================================================
 GEWINNSPIELE
===========================================================
*/

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = getGiveaways();
    const user = getUserById(req.user.id);

    res.send(
        page(
            "Gewinnspiele",
            `
            <div class="hero">
                <h1>Gewinnspiele</h1>
                <p>
                    Nimm an Community-Gewinnspielen teil.
                </p>
            </div>

            ${
                giveaways.length
                    ? giveaways.map(g => {
                        const joined =
                            Array.isArray(g.participants) &&
                            g.participants.includes(user.id);

                        return `
                        <div class="card">
                            <h2>
                                ${escapeHTML(g.title)}
                            </h2>

                            <p>
                                ${escapeHTML(g.description || "")}
                            </p>

                            <p>
                                Gewinn:
                                <b>${escapeHTML(g.prize)}</b>
                            </p>

                            <p class="muted">
                                Ende:
                                ${formatDate(g.endsAt)}
                            </p>

                            ${
                                g.status === "open"
                                    ? joined
                                        ? `<span class="badge">Teilgenommen</span>`
                                        : `
                                        <form
                                            method="POST"
                                            action="/giveaways/${encodeURIComponent(g.id)}/join"
                                        >
                                            <button>
                                                Teilnehmen
                                            </button>
                                        </form>
                                        `
                                    : `<span class="badge">Beendet</span>`
                            }
                        </div>
                        `;
                    }).join("")
                    : `
                        <div class="card">
                            <h2>Keine Gewinnspiele</h2>
                            <p class="muted">
                                Momentan läuft kein Gewinnspiel.
                            </p>
                        </div>
                    `
            }
            `,
            user
        )
    );
});

app.post("/giveaways/:id/join", requireLogin, (req, res) => {
    const giveaways = getGiveaways();

    const index = giveaways.findIndex(
        g => g.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/giveaways");
    }

    const giveaway = giveaways[index];

    if (giveaway.status !== "open") {
        return res.redirect("/giveaways");
    }

    if (
        giveaway.endsAt &&
        giveaway.endsAt < Date.now()
    ) {
        giveaway.status = "closed";
        saveGiveaways(giveaways);

        return res.redirect("/giveaways");
    }

    if (!Array.isArray(giveaway.participants)) {
        giveaway.participants = [];
    }

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);
        saveGiveaways(giveaways);

        logAction(
            "GIVEAWAY_JOIN",
            req.user,
            {
                giveawayId: giveaway.id
            }
        );
    }

    res.redirect("/giveaways");
});

/*
===========================================================
 BEWERBUNGEN
===========================================================
*/

app.get("/applications", requireLogin, (req, res) => {
    const applications = getApplications()
        .filter(a => a.userId === req.user.id);

    res.send(
        page(
            "Bewerbungen",
            `
            <div class="hero">
                <h1>Bewerbungen</h1>

                <p>
                    Bewirb dich als Moderator oder Developer.
                </p>

                <a class="btn" href="/applications/new">
                    Bewerbung erstellen
                </a>
            </div>

            ${
                applications.length
                    ? applications.map(a => `
                        <div class="card">
                            <h2>
                                ${escapeHTML(a.type)}
                            </h2>

                            <span class="badge">
                                ${escapeHTML(a.status)}
                            </span>

                            <p>
                                ${escapeHTML(a.text)}
                            </p>

                            <p class="muted">
                                ${formatDate(a.createdAt)}
                            </p>
                        </div>
                    `).join("")
                    : `
                    <div class="card">
                        <p class="muted">
                            Du hast noch keine Bewerbung erstellt.
                        </p>
                    </div>
                    `
            }
            `,
            req.user
        )
    );
});

app.get("/applications/new", requireLogin, (req, res) => {
    res.send(
        page(
            "Bewerbung",
            `
            <div class="card">
                <h1>Bewerbung</h1>

                <form method="POST" action="/applications">

                    <label>Bereich</label>

                    <select name="type" required>
                        <option value="Moderator">
                            Moderator
                        </option>

                        <option value="Developer">
                            Developer
                        </option>
                    </select>

                    <label>Warum möchtest du ins Team?</label>

                    <textarea
                        name="text"
                        maxlength="8000"
                        required
                    ></textarea>

                    <button>
                        Bewerbung absenden
                    </button>

                </form>
            </div>
            `,
            req.user
        )
    );
});

app.post("/applications", requireLogin, (req, res) => {
    const type =
        req.body.type === "Developer"
            ? "Developer"
            : "Moderator";

    const text = String(req.body.text || "").trim();

    if (text.length < 20) {
        return res.status(400).send(
            page(
                "Bewerbung",
                `
                <div class="card">
                    <h2>Die Bewerbung ist zu kurz.</h2>
                    <a class="btn" href="/applications/new">
                        Zurück
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    const applications = getApplications();

    const application = {
        id: id("application"),
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        type,
        text,
        status: "offen",
        createdAt: Date.now(),
        reviewedBy: null,
        reviewedAt: null
    };

    applications.unshift(application);

    saveApplications(applications);

    logAction(
        "APPLICATION_CREATE",
        req.user,
        {
            applicationId: application.id,
            type
        }
    );

    res.redirect("/applications");
});

/*
===========================================================
 ÖFFENTLICHER CHAT
===========================================================
*/

app.get("/chat", requireLogin, (req, res) => {
    const messages = getLogs()
        .filter(log => log.action === "CHAT_MESSAGE")
        .slice(0, 100)
        .reverse();

    res.send(
        page(
            "Community Chat",
            `
            <div class="card">
                <h1>Community Chat</h1>

                ${
                    messages.length
                        ? messages.map(log => `
                            <div class="message">
                                <b>
                                    ${escapeHTML(log.actorEmail)}
                                </b>

                                <span class="muted small">
                                    ${formatDate(log.createdAt)}
                                </span>

                                <p>
                                    ${escapeHTML(log.details.message)}
                                </p>
                            </div>
                        `).join("")
                        : `
                        <p class="muted">
                            Noch keine Nachrichten.
                        </p>
                        `
                }
            </div>

            <div class="card">
                <form method="POST" action="/chat">

                    <textarea
                        name="message"
                        maxlength="2000"
                        placeholder="Nachricht schreiben..."
                        required
                    ></textarea>

                    <button>
                        Senden
                    </button>

                </form>
            </div>
            `,
            req.user
        )
    );
});

app.post("/chat", requireLogin, (req, res) => {
    const message = String(req.body.message || "").trim();

    if (!message) {
        return res.redirect("/chat");
    }

    logAction(
        "CHAT_MESSAGE",
        req.user,
        {
            message
        }
    );

    res.redirect("/chat");
});

/*
===========================================================
 TEAM CHAT
===========================================================
*/

app.get("/team-chat", requireLogin, (req, res) => {
    if (!isStaff(req.user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `<div class="card"><h2>Nur Teammitglieder können den Team-Chat sehen.</h2></div>`,
                req.user
            )
        );
    }

    const messages = getTeamChat();

    res.send(
        page(
            "Team Chat",
            `
            <div class="card">
                <h1>Team Chat</h1>

                ${
                    messages.length
                        ? messages.map(message => `
                            <div class="message">
                                <b>
                                    ${escapeHTML(message.userName)}
                                </b>

                                <span class="badge">
                                    ${escapeHTML(roleName(message.role))}
                                </span>

                                <span class="muted small">
                                    ${formatDate(message.createdAt)}
                                </span>

                                <p>
                                    ${escapeHTML(message.text)}
                                </p>
                            </div>
                        `).join("")
                        : `<p class="muted">Noch keine Nachrichten.</p>`
                }
            </div>

            <div class="card">
                <form method="POST" action="/team-chat">

                    <textarea
                        name="message"
                        maxlength="4000"
                        required
                        placeholder="Team-Nachricht..."
                    ></textarea>

                    <button>
                        Senden
                    </button>

                </form>
            </div>
            `,
            req.user
        )
    );
});

app.post("/team-chat", requireLogin, (req, res) => {
    if (!isStaff(req.user)) {
        return res.status(403).send("Kein Zugriff");
    }

    const text = String(req.body.message || "").trim();

    if (!text) {
        return res.redirect("/team-chat");
    }

    const messages = getTeamChat();

    messages.push({
        id: id("teammsg"),
        userId: req.user.id,
        userName: req.user.name,
        role: req.user.role,
        text,
        createdAt: Date.now()
    });

    if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
    }

    saveTeamChat(messages);

    logAction(
        "TEAM_CHAT_MESSAGE",
        req.user
    );

    res.redirect("/team-chat");
});

/*
===========================================================
 ADMINPANEL
===========================================================
*/

app.get("/admin", requireAdmin, (req, res) => {
    const users = getUsers();
    const tickets = getTickets();
    const codes = getCodes();
    const shop = getShop();
    const giveaways = getGiveaways();
    const applications = getApplications();
    const orders = getOrders();
    const logs = getLogs();

    res.send(
        page(
            "Adminpanel",
            `
            <div class="hero">
                <h1>Adminpanel</h1>

                <p>
                    Angemeldet als
                    <b>${escapeHTML(req.user.name)}</b>
                    -
                    <span class="badge ${escapeHTML(req.user.role)}">
                        ${escapeHTML(roleName(req.user.role))}
                    </span>
                </p>
            </div>

            <div class="grid">

                <div class="card">
                    <h3>Registrierte User</h3>
                    <div class="stat">
                        ${users.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Coins im System</h3>
                    <div class="stat coins">
                        ${users.reduce(
                            (sum, user) =>
                                sum + Number(user.coins || 0),
                            0
                        )}
                    </div>
                </div>

                <div class="card">
                    <h3>Tickets</h3>
                    <div class="stat">
                        ${tickets.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Codes</h3>
                    <div class="stat">
                        ${codes.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Shop-Produkte</h3>
                    <div class="stat">
                        ${shop.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Gewinnspiele</h3>
                    <div class="stat">
                        ${giveaways.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Bewerbungen</h3>
                    <div class="stat">
                        ${applications.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="stat">
                        ${orders.length}
                    </div>
                </div>

            </div>

            <div class="card">
                <h2>Admin-Bereiche</h2>

                <div class="grid">
                    <a class="btn" href="/admin/users">
                        Benutzer
                    </a>

                    <a class="btn" href="/admin/codes">
                        Coin-Codes
                    </a>

                    <a class="btn" href="/admin/shop">
                        Shop
                    </a>

                    <a class="btn" href="/admin/giveaways">
                        Gewinnspiele
                    </a>

                    <a class="btn" href="/admin/applications">
                        Bewerbungen
                    </a>

                    <a class="btn" href="/admin/orders">
                        Bestellungen
                    </a>

                    <a class="btn" href="/admin/tickets">
                        Tickets
                    </a>

                    <a class="btn" href="/admin/announcements">
                        Wartung / Störung / Ankündigungen
                    </a>

                    <a class="btn" href="/admin/logs">
                        Logs
                    </a>

                    <a class="btn" href="/team-chat">
                        Team Chat
                    </a>
                </div>
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 ADMIN USER
===========================================================
*/

app.get("/admin/users", requireAdmin, (req, res) => {
    const users = getUsers();

    res.send(
        page(
            "Benutzerverwaltung",
            `
            <div class="card">
                <h1>Benutzerverwaltung</h1>

                <p class="muted">
                    Hier kannst du Rollen, Coins, Kick und Bans verwalten.
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Rolle</th>
                            <th>Coins</th>
                            <th>Status</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>

                    <tbody>

                    ${users.map(user => `
                        <tr>

                            <td>
                                <b>${escapeHTML(user.name)}</b>
                                <br>
                                <span class="muted small">
                                    ${escapeHTML(user.email)}
                                </span>
                            </td>

                            <td>
                                <span class="badge ${escapeHTML(user.role)}">
                                    ${escapeHTML(roleName(user.role))}
                                </span>
                            </td>

                            <td>
                                <span class="coins">
                                    ${Number(user.coins || 0)}
                                </span>
                            </td>

                            <td>
                                ${
                                    user.bannedUntil &&
                                    user.bannedUntil > Date.now()
                                        ? `
                                        <span class="badge">
                                            BAN bis
                                            ${formatDate(user.bannedUntil)}
                                        </span>
                                        `
                                        : "Aktiv"
                                }
                            </td>

                            <td>

                                ${
                                    user.id === req.user.id
                                        ? `<span class="muted">Eigenes Konto</span>`
                                        : `
                                        <form
                                            method="POST"
                                            action="/admin/users/${encodeURIComponent(user.id)}/role"
                                        >
                                            <select name="role">
                                                <option value="user" ${user.role === "user" ? "selected" : ""}>
                                                    User
                                                </option>

                                                <option value="moderator" ${user.role === "moderator" ? "selected" : ""}>
                                                    Moderator
                                                </option>

                                                <option value="developer" ${user.role === "developer" ? "selected" : ""}>
                                                    Developer
                                                </option>

                                                <option value="manager" ${user.role === "manager" ? "selected" : ""}>
                                                    Manager
                                                </option>

                                                <option value="admin" ${user.role === "admin" ? "selected" : ""}>
                                                    Admin
                                                </option>
                                            </select>

                                            <button>
                                                Rolle speichern
                                            </button>
                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/users/${encodeURIComponent(user.id)}/coins"
                                        >
                                            <input
                                                name="amount"
                                                type="number"
                                                placeholder="+/- Coins"
                                                required
                                            >

                                            <button class="btn success">
                                                Coins ändern
                                            </button>
                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/users/${encodeURIComponent(user.id)}/kick"
                                        >
                                            <input
                                                name="duration"
                                                placeholder="z.B. 1m"
                                                required
                                            >

                                            <input
                                                name="reason"
                                                placeholder="Kick-Grund"
                                                required
                                            >

                                            <button class="btn warning">
                                                Kick
                                            </button>
                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/users/${encodeURIComponent(user.id)}/ban"
                                        >
                                            <input
                                                name="duration"
                                                placeholder="z.B. 1m, 1h, 7d"
                                                required
                                            >

                                            <input
                                                name="reason"
                                                placeholder="Ban-Grund"
                                                required
                                            >

                                            <button class="btn danger">
                                                Ban
                                            </button>
                                        </form>

                                        ${
                                            user.bannedUntil
                                                ? `
                                                <form
                                                    method="POST"
                                                    action="/admin/users/${encodeURIComponent(user.id)}/unban"
                                                >
                                                    <button class="btn success">
                                                        Entbannen
                                                    </button>
                                                </form>
                                                `
                                                : ""
                                        }

                                        <form
                                            method="POST"
                                            action="/admin/users/${encodeURIComponent(user.id)}/delete"
                                            onsubmit="return confirm('Konto wirklich löschen?')"
                                        >
                                            <button class="btn danger">
                                                Konto löschen
                                            </button>
                                        </form>
                                        `
                                }

                            </td>

                        </tr>
                    `).join("")}

                    </tbody>
                </table>
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 ADMIN ROLLE
===========================================================
*/

app.post("/admin/users/:id/role", requireAdmin, (req, res) => {
    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    const target = users[index];

    if (target.role === "owner") {
        return res.status(403).send(
            page(
                "Fehler",
                `
                <div class="card">
                    <h2>Der Owner kann nicht über dieses Panel entfernt werden.</h2>
                    <a class="btn" href="/admin/users">Zurück</a>
                </div>
                `,
                req.user
            )
        );
    }

    const allowed = [
        "user",
        "moderator",
        "developer",
        "manager",
        "admin"
    ];

    const newRole = String(req.body.role || "user");

    if (!allowed.includes(newRole)) {
        return res.redirect("/admin/users");
    }

    target.role = newRole;

    saveUsers(users);

    logAction(
        "ROLE_CHANGE",
        req.user,
        {
            targetUserId: target.id,
            targetEmail: target.email,
            role: newRole
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN COINS
===========================================================
*/

app.post("/admin/users/:id/coins", requireAdmin, (req, res) => {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount === 0) {
        return res.redirect("/admin/users");
    }

    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    users[index].coins =
        Math.max(
            0,
            Number(users[index].coins || 0) + amount
        );

    saveUsers(users);

    logAction(
        "ADMIN_COINS_CHANGE",
        req.user,
        {
            targetUserId: users[index].id,
            amount
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN KICK
===========================================================
*/

app.post("/admin/users/:id/kick", requireAdmin, (req, res) => {
    const duration = parseDuration(req.body.duration);
    const reason = String(req.body.reason || "").trim();

    if (!duration || !reason) {
        return res.redirect("/admin/users");
    }

    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    if (users[index].role === "owner") {
        return res.status(403).send(
            "Der Owner kann nicht gekickt werden."
        );
    }

    users[index].kickedUntil = Date.now() + duration;
    users[index].kickReason = reason;

    saveUsers(users);

    logAction(
        "WEB_KICK",
        req.user,
        {
            targetUserId: users[index].id,
            reason,
            duration
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN BAN
===========================================================
*/

app.post("/admin/users/:id/ban", requireAdmin, (req, res) => {
    const duration = parseDuration(req.body.duration);
    const reason = String(req.body.reason || "").trim();

    if (!duration || !reason) {
        return res.redirect("/admin/users");
    }

    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    if (users[index].role === "owner") {
        return res.status(403).send(
            "Der Owner kann nicht gebannt werden."
        );
    }

    users[index].bannedUntil = Date.now() + duration;
    users[index].banReason = reason;

    saveUsers(users);

    logAction(
        "WEB_BAN",
        req.user,
        {
            targetUserId: users[index].id,
            reason,
            duration
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN UNBAN
===========================================================
*/

app.post("/admin/users/:id/unban", requireAdmin, (req, res) => {
    const users = getUsers();

    const index = users.findIndex(
        user => user.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    users[index].bannedUntil = null;
    users[index].banReason = null;

    saveUsers(users);

    logAction(
        "WEB_UNBAN",
        req.user,
        {
            targetUserId: users[index].id
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN USER LÖSCHEN
===========================================================
*/

app.post("/admin/users/:id/delete", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        user => user.id === req.params.id
    );

    if (!target) {
        return res.redirect("/admin/users");
    }

    if (target.role === "owner") {
        return res.status(403).send(
            "Der Owner kann nicht gelöscht werden."
        );
    }

    const filtered = users.filter(
        user => user.id !== target.id
    );

    saveUsers(filtered);

    const sessions = getSessions().filter(
        session => session.userId !== target.id
    );

    saveSessions(sessions);

    logAction(
        "USER_DELETE",
        req.user,
        {
            targetUserId: target.id,
            targetEmail: target.email
        }
    );

    res.redirect("/admin/users");
});

/*
===========================================================
 ADMIN CODES
===========================================================
*/

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = getCodes();

    res.send(
        page(
            "Coin-Codes",
            `
            <div class="card">
                <h1>Coin-Codes</h1>

                <p class="muted">
                    Codes haben das Format:
                    NORTH-XXXX-XXXX-XXXX
                </p>

                <form method="POST" action="/admin/codes">

                    <label>Coins</label>
                    <input
                        name="coins"
                        type="number"
                        min="1"
                        required
                        placeholder="100"
                    >

                    <label>Maximale Nutzungen</label>
                    <input
                        name="maxUses"
                        type="number"
                        min="1"
                        placeholder="Leer = unbegrenzt"
                    >

                    <label>Gültigkeit</label>
                    <input
                        name="duration"
                        placeholder="z.B. 7d oder leer"
                    >

                    <button>
                        Code erstellen
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Vorhandene Codes</h2>

                ${
                    codes.length
                        ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Coins</th>
                                    <th>Nutzung</th>
                                    <th>Ablauf</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>

                            ${codes.map(code => `
                                <tr>
                                    <td>
                                        <b>${escapeHTML(code.code)}</b>
                                    </td>

                                    <td class="coins">
                                        ${Number(code.coins)}
                                    </td>

                                    <td>
                                        ${Number(code.uses || 0)}
                                        /
                                        ${
                                            code.maxUses === null
                                                ? "∞"
                                                : Number(code.maxUses)
                                        }
                                    </td>

                                    <td>
                                        ${
                                            code.expiresAt
                                                ? formatDate(code.expiresAt)
                                                : "Kein Ablauf"
                                        }
                                    </td>

                                    <td>
                                        ${
                                            code.disabled
                                                ? "Deaktiviert"
                                                : "Aktiv"
                                        }
                                    </td>

                                    <td>
                                        <form
                                            method="POST"
                                            action="/admin/codes/${encodeURIComponent(code.id)}/toggle"
                                        >
                                            <button class="btn secondary">
                                                ${
                                                    code.disabled
                                                        ? "Aktivieren"
                                                        : "Deaktivieren"
                                                }
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            `).join("")}

                            </tbody>
                        </table>
                        `
                        : `<p class="muted">Noch keine Codes.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

app.post("/admin/codes", requireAdmin, (req, res) => {
    const coins = Number(req.body.coins);
    const maxUsesRaw = String(req.body.maxUses || "").trim();
    const durationRaw = String(req.body.duration || "").trim();

    if (!Number.isFinite(coins) || coins <= 0) {
        return res.redirect("/admin/codes");
    }

    const maxUses =
        maxUsesRaw === ""
            ? null
            : Math.max(1, Number(maxUsesRaw));

    const duration =
        durationRaw
            ? parseDuration(durationRaw)
            : null;

    const code = {
        id: id("code"),
        code: createCode(),
        coins,
        maxUses,
        uses: 0,
        disabled: false,
        createdBy: req.user.id,
        createdAt: Date.now(),
        expiresAt:
            duration
                ? Date.now() + duration
                : null,
        lastUsedBy: null,
        lastUsedAt: null
    };

    const codes = getCodes();

    codes.unshift(code);

    saveCodes(codes);

    logAction(
        "CODE_CREATE",
        req.user,
        {
            code: code.code,
            coins: code.coins
        }
    );

    res.redirect("/admin/codes");
});

app.post("/admin/codes/:id/toggle", requireAdmin, (req, res) => {
    const codes = getCodes();

    const index = codes.findIndex(
        code => code.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/codes");
    }

    codes[index].disabled = !codes[index].disabled;

    saveCodes(codes);

    logAction(
        "CODE_TOGGLE",
        req.user,
        {
            code: codes[index].code,
            disabled: codes[index].disabled
        }
    );

    res.redirect("/admin/codes");
});

/*
===========================================================
 ADMIN SHOP
===========================================================
*/

app.get("/admin/shop", requireAdmin, (req, res) => {
    const shop = getShop();

    res.send(
        page(
            "Shop Verwaltung",
            `
            <div class="card">
                <h1>Shop-Produkt erstellen</h1>

                <form method="POST" action="/admin/shop">

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
                        name="price"
                        type="number"
                        min="1"
                        required
                    >

                    <label>Bestand</label>
                    <input
                        name="stock"
                        type="number"
                        min="-1"
                        value="-1"
                        required
                    >

                    <label>
                        <input
                            type="checkbox"
                            name="developer"
                            value="1"
                            style="width:auto"
                        >
                        Entwickler-/Beta-Nummer erforderlich
                    </label>

                    <button>
                        Produkt erstellen
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Produkte</h2>

                ${
                    shop.length
                        ? shop.map(item => `
                            <div class="message">
                                <h3>
                                    ${escapeHTML(item.name)}
                                </h3>

                                <p>
                                    ${escapeHTML(item.description || "")}
                                </p>

                                <p class="price">
                                    ${Number(item.price)} Coins
                                </p>

                                <p>
                                    Bestand:
                                    ${
                                        Number(item.stock) === -1
                                            ? "Unbegrenzt"
                                            : Number(item.stock)
                                    }
                                </p>

                                ${
                                    item.developer
                                        ? `<span class="badge developer">Developer/Beta</span>`
                                        : ""
                                }

                                <form
                                    method="POST"
                                    action="/admin/shop/${encodeURIComponent(item.id)}/delete"
                                    style="margin-top:10px"
                                >
                                    <button class="btn danger">
                                        Löschen
                                    </button>
                                </form>
                            </div>
                        `).join("")
                        : `<p class="muted">Keine Produkte.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

app.post("/admin/shop", requireAdmin, (req, res) => {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const price = Number(req.body.price);
    const stock = Number(req.body.stock);

    if (
        !name ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(stock)
    ) {
        return res.redirect("/admin/shop");
    }

    const shop = getShop();

    const item = {
        id: id("product"),
        name,
        description,
        price,
        stock,
        developer: req.body.developer === "1",
        requiresBeta: req.body.developer === "1",
        createdBy: req.user.id,
        createdAt: Date.now()
    };

    shop.push(item);

    saveShop(shop);

    logAction(
        "SHOP_CREATE",
        req.user,
        {
            itemId: item.id,
            name
        }
    );

    res.redirect("/admin/shop");
});

app.post("/admin/shop/:id/delete", requireAdmin, (req, res) => {
    const shop = getShop();

    const item = shop.find(
        product => product.id === req.params.id
    );

    if (!item) {
        return res.redirect("/admin/shop");
    }

    saveShop(
        shop.filter(product => product.id !== item.id)
    );

    logAction(
        "SHOP_DELETE",
        req.user,
        {
            itemId: item.id,
            name: item.name
        }
    );

    res.redirect("/admin/shop");
});

/*
===========================================================
 ADMIN GEWINNSPIELE
===========================================================
*/

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = getGiveaways();

    res.send(
        page(
            "Gewinnspiele Verwaltung",
            `
            <div class="card">
                <h1>Gewinnspiel erstellen</h1>

                <form method="POST" action="/admin/giveaways">

                    <label>Titel</label>
                    <input
                        name="title"
                        required
                        maxlength="100"
                    >

                    <label>Beschreibung</label>
                    <textarea
                        name="description"
                        maxlength="2000"
                    ></textarea>

                    <label>Gewinn</label>
                    <input
                        name="prize"
                        required
                        maxlength="200"
                    >

                    <label>Dauer</label>
                    <input
                        name="duration"
                        placeholder="z.B. 24h"
                        required
                    >

                    <button>
                        Gewinnspiel erstellen
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Gewinnspiele</h2>

                ${
                    giveaways.length
                        ? giveaways.map(g => `
                            <div class="message">
                                <h3>
                                    ${escapeHTML(g.title)}
                                </h3>

                                <p>
                                    ${escapeHTML(g.description)}
                                </p>

                                <p>
                                    Gewinn:
                                    <b>${escapeHTML(g.prize)}</b>
                                </p>

                                <p>
                                    Teilnehmer:
                                    ${g.participants?.length || 0}
                                </p>

                                <p class="muted">
                                    Ende:
                                    ${formatDate(g.endsAt)}
                                </p>

                                <form
                                    method="POST"
                                    action="/admin/giveaways/${encodeURIComponent(g.id)}/close"
                                >
                                    <button class="btn danger">
                                        Beenden
                                    </button>
                                </form>
                            </div>
                        `).join("")
                        : `<p class="muted">Keine Gewinnspiele.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

app.post("/admin/giveaways", requireAdmin, (req, res) => {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const prize = String(req.body.prize || "").trim();
    const duration = parseDuration(req.body.duration);

    if (!title || !prize || !duration) {
        return res.redirect("/admin/giveaways");
    }

    const giveaways = getGiveaways();

    const giveaway = {
        id: id("giveaway"),
        title,
        description,
        prize,
        participants: [],
        status: "open",
        createdBy: req.user.id,
        createdAt: Date.now(),
        endsAt: Date.now() + duration,
        winnerId: null
    };

    giveaways.unshift(giveaway);

    saveGiveaways(giveaways);

    logAction(
        "GIVEAWAY_CREATE",
        req.user,
        {
            giveawayId: giveaway.id
        }
    );

    res.redirect("/admin/giveaways");
});

app.post("/admin/giveaways/:id/close", requireAdmin, (req, res) => {
    const giveaways = getGiveaways();

    const index = giveaways.findIndex(
        g => g.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/giveaways");
    }

    const giveaway = giveaways[index];

    giveaway.status = "closed";

    if (
        Array.isArray(giveaway.participants) &&
        giveaway.participants.length
    ) {
        const winnerIndex = crypto.randomInt(
            0,
            giveaway.participants.length
        );

        giveaway.winnerId =
            giveaway.participants[winnerIndex];
    }

    saveGiveaways(giveaways);

    logAction(
        "GIVEAWAY_CLOSE",
        req.user,
        {
            giveawayId: giveaway.id,
            winnerId: giveaway.winnerId
        }
    );

    res.redirect("/admin/giveaways");
});

/*
===========================================================
 ADMIN BEWERBUNGEN
===========================================================
*/

app.get("/admin/applications", requireAdmin, (req, res) => {
    const applications = getApplications();

    res.send(
        page(
            "Bewerbungen",
            `
            <div class="card">
                <h1>Bewerbungen</h1>

                ${
                    applications.length
                        ? applications.map(a => `
                            <div class="message">

                                <h2>
                                    ${escapeHTML(a.type)}
                                </h2>

                                <p>
                                    <b>${escapeHTML(a.userName)}</b>
                                    <br>
                                    ${escapeHTML(a.userEmail)}
                                </p>

                                <span class="badge">
                                    ${escapeHTML(a.status)}
                                </span>

                                <p>
                                    ${escapeHTML(a.text)}
                                </p>

                                <form
                                    method="POST"
                                    action="/admin/applications/${encodeURIComponent(a.id)}"
                                >

                                    <select name="status">
                                        <option value="offen">
                                            Offen
                                        </option>

                                        <option value="angenommen">
                                            Angenommen
                                        </option>

                                        <option value="abgelehnt">
                                            Abgelehnt
                                        </option>
                                    </select>

                                    <button>
                                        Status speichern
                                    </button>

                                </form>

                            </div>
                        `).join("")
                        : `<p class="muted">Keine Bewerbungen.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

app.post("/admin/applications/:id", requireAdmin, (req, res) => {
    const applications = getApplications();

    const index = applications.findIndex(
        a => a.id === req.params.id
    );

    if (index === -1) {
        return res.redirect("/admin/applications");
    }

    const allowed = [
        "offen",
        "angenommen",
        "abgelehnt"
    ];

    if (allowed.includes(req.body.status)) {
        applications[index].status = req.body.status;
        applications[index].reviewedBy = req.user.id;
        applications[index].reviewedAt = Date.now();
    }

    saveApplications(applications);

    logAction(
        "APPLICATION_REVIEW",
        req.user,
        {
            applicationId: applications[index].id,
            status: applications[index].status
        }
    );

    res.redirect("/admin/applications");
});

/*
===========================================================
 ADMIN BESTELLUNGEN
===========================================================
*/

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = getOrders();

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
                            <thead>
                                <tr>
                                    <th>Bestellnummer</th>
                                    <th>User</th>
                                    <th>Produkt</th>
                                    <th>Preis</th>
                                    <th>Beta</th>
                                    <th>Status</th>
                                    <th>Datum</th>
                                </tr>
                            </thead>

                            <tbody>

                            ${orders.map(order => `
                                <tr>
                                    <td>
                                        <b>
                                            ${escapeHTML(order.orderNumber)}
                                        </b>
                                    </td>

                                    <td>
                                        ${escapeHTML(order.userName)}
                                        <br>
                                        <span class="muted small">
                                            ${escapeHTML(order.userEmail)}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHTML(order.itemName)}
                                    </td>

                                    <td class="coins">
                                        ${Number(order.price)}
                                    </td>

                                    <td>
                                        ${
                                            order.betaNumber
                                                ? escapeHTML(order.betaNumber)
                                                : "-"
                                        }
                                    </td>

                                    <td>
                                        ${escapeHTML(order.status)}
                                    </td>

                                    <td>
                                        ${formatDate(order.createdAt)}
                                    </td>
                                </tr>
                            `).join("")}

                            </tbody>
                        </table>
                        `
                        : `<p class="muted">Keine Bestellungen.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 ADMIN TICKETS
===========================================================
*/

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = getTickets();

    res.send(
        page(
            "Ticketverwaltung",
            `
            <div class="card">
                <h1>Alle Tickets</h1>

                ${
                    tickets.length
                        ? tickets.map(ticket => `
                            <div class="message">

                                <h2>
                                    ${escapeHTML(ticket.number)}
                                </h2>

                                <p>
                                    <b>
                                        ${escapeHTML(ticket.subject)}
                                    </b>
                                </p>

                                <p>
                                    User:
                                    ${escapeHTML(ticket.userName)}
                                    <br>
                                    ${escapeHTML(ticket.userEmail)}
                                </p>

                                <span class="badge">
                                    ${escapeHTML(ticket.status)}
                                </span>

                                <br><br>

                                <a
                                    class="btn"
                                    href="/tickets/${encodeURIComponent(ticket.id)}"
                                >
                                    Öffnen
                                </a>

                            </div>
                        `).join("")
                        : `<p class="muted">Keine Tickets.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 ADMIN WARTUNG / STÖRUNG / ANKÜNDIGUNG
===========================================================
*/

app.get("/admin/announcements", requireAdmin, (req, res) => {
    const settings = getSettings();
    const announcements = getAnnouncements();

    res.send(
        page(
            "Status & Ankündigungen",
            `
            <div class="card">
                <h1>Wartung</h1>

                <form method="POST" action="/admin/settings/maintenance">

                    <label>
                        <input
                            type="checkbox"
                            name="enabled"
                            value="1"
                            style="width:auto"
                            ${settings.maintenance ? "checked" : ""}
                        >
                        Wartung aktiv
                    </label>

                    <textarea
                        name="text"
                        maxlength="1000"
                    >${escapeHTML(settings.maintenanceText)}</textarea>

                    <button>
                        Wartung speichern
                    </button>

                </form>
            </div>

            <div class="card">
                <h1>Störung</h1>

                <form method="POST" action="/admin/settings/outage">

                    <label>
                        <input
                            type="checkbox"
                            name="enabled"
                            value="1"
                            style="width:auto"
                            ${settings.outage ? "checked" : ""}
                        >
                        Störung aktiv
                    </label>

                    <textarea
                        name="text"
                        maxlength="1000"
                    >${escapeHTML(settings.outageText)}</textarea>

                    <button>
                        Störung speichern
                    </button>

                </form>
            </div>

            <div class="card">
                <h1>Aktuelle Ankündigung</h1>

                <form method="POST" action="/admin/settings/announcement">

                    <label>
                        <input
                            type="checkbox"
                            name="enabled"
                            value="1"
                            style="width:auto"
                            ${settings.announcementEnabled ? "checked" : ""}
                        >
                        Ankündigung anzeigen
                    </label>

                    <textarea
                        name="text"
                        maxlength="3000"
                    >${escapeHTML(settings.announcement)}</textarea>

                    <button>
                        Ankündigung speichern
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Neue Ankündigung speichern</h2>

                <form method="POST" action="/admin/announcements">

                    <input
                        name="title"
                        placeholder="Titel"
                        maxlength="100"
                        required
                    >

                    <textarea
                        name="text"
                        placeholder="Ankündigung..."
                        maxlength="3000"
                        required
                    ></textarea>

                    <button>
                        Veröffentlichen
                    </button>

                </form>
            </div>

            <div class="card">
                <h2>Ankündigungsarchiv</h2>

                ${
                    announcements.length
                        ? announcements.map(a => `
                            <div class="message">
                                <h3>
                                    ${escapeHTML(a.title)}
                                </h3>

                                <p>
                                    ${escapeHTML(a.text)}
                                </p>

                                <span class="muted small">
                                    ${formatDate(a.createdAt)}
                                </span>
                            </div>
                        `).join("")
                        : `<p class="muted">Noch keine Ankündigungen.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

app.post("/admin/settings/maintenance", requireAdmin, (req, res) => {
    const settings = getSettings();

    settings.maintenance = req.body.enabled === "1";

    settings.maintenanceText =
        String(req.body.text || "").trim() ||
        DEFAULT_SETTINGS.maintenanceText;

    saveSettings(settings);

    logAction(
        "MAINTENANCE_CHANGE",
        req.user,
        {
            enabled: settings.maintenance
        }
    );

    res.redirect("/admin/announcements");
});

app.post("/admin/settings/outage", requireAdmin, (req, res) => {
    const settings = getSettings();

    settings.outage = req.body.enabled === "1";

    settings.outageText =
        String(req.body.text || "").trim() ||
        DEFAULT_SETTINGS.outageText;

    saveSettings(settings);

    logAction(
        "OUTAGE_CHANGE",
        req.user,
        {
            enabled: settings.outage
        }
    );

    res.redirect("/admin/announcements");
});

app.post("/admin/settings/announcement", requireAdmin, (req, res) => {
    const settings = getSettings();

    settings.announcementEnabled =
        req.body.enabled === "1";

    settings.announcement =
        String(req.body.text || "").trim();

    saveSettings(settings);

    logAction(
        "ANNOUNCEMENT_CHANGE",
        req.user,
        {
            enabled: settings.announcementEnabled
        }
    );

    res.redirect("/admin/announcements");
});

app.post("/admin/announcements", requireAdmin, (req, res) => {
    const title = String(req.body.title || "").trim();
    const text = String(req.body.text || "").trim();

    if (!title || !text) {
        return res.redirect("/admin/announcements");
    }

    const announcements = getAnnouncements();

    announcements.unshift({
        id: id("announcement"),
        title,
        text,
        createdBy: req.user.id,
        createdAt: Date.now()
    });

    if (announcements.length > 200) {
        announcements.length = 200;
    }

    saveAnnouncements(announcements);

    logAction(
        "ANNOUNCEMENT_CREATE",
        req.user,
        {
            title
        }
    );

    res.redirect("/admin/announcements");
});

/*
===========================================================
 ADMIN LOGS
===========================================================
*/

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = getLogs();

    res.send(
        page(
            "Logs",
            `
            <div class="card">
                <h1>System-Logs</h1>

                <p class="muted">
                    Die letzten ${Math.min(logs.length, 500)} Aktionen.
                </p>

                ${
                    logs.length
                        ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Zeit</th>
                                    <th>Aktion</th>
                                    <th>User</th>
                                    <th>Details</th>
                                </tr>
                            </thead>

                            <tbody>

                            ${logs.slice(0, 500).map(log => `
                                <tr>
                                    <td>
                                        ${formatDate(log.createdAt)}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHTML(log.action)}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHTML(log.actorEmail)}
                                    </td>

                                    <td>
                                        <span class="small">
                                            ${escapeHTML(
                                                JSON.stringify(log.details || {})
                                            )}
                                        </span>
                                    </td>
                                </tr>
                            `).join("")}

                            </tbody>
                        </table>
                        `
                        : `<p class="muted">Keine Logs.</p>`
                }
            </div>
            `,
            req.user
        )
    );
});

/*
===========================================================
 ADMIN DATEN EXPORT
===========================================================
*/

app.get("/admin/export/users", requireAdmin, (req, res) => {
    const users = getUsers();

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.setHeader(
        "Content-Disposition",
        'attachment; filename="north-users-export.json"'
    );

    res.send(
        JSON.stringify(
            users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                coins: user.coins,
                createdAt: user.createdAt,
                bannedUntil: user.bannedUntil,
                banReason: user.banReason
            })),
            null,
            2
        )
    );
});

/*
===========================================================
 API: USER STATUS
===========================================================
*/

app.get("/api/me", requireLogin, (req, res) => {
    const user = getUserById(req.user.id);

    res.json({
        ok: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            coins: Number(user.coins || 0),
            createdAt: user.createdAt
        }
    });
});

/*
===========================================================
 API: STATUS
===========================================================
*/

app.get("/api/status", (req, res) => {
    const settings = getSettings();

    res.json({
        ok: true,
        maintenance: settings.maintenance,
        outage: settings.outage,
        announcementEnabled: settings.announcementEnabled,
        announcement: settings.announcement
    });
});

/*
===========================================================
 404
===========================================================
*/

app.use((req, res) => {
    const user = currentUser(req);

    res.status(404).send(
        page(
            "404",
            `
            <div class="card center">
                <h1>404</h1>
                <h2>Seite nicht gefunden</h2>

                <p class="muted">
                    Diese Seite existiert nicht.
                </p>

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
===========================================================
 ERROR HANDLER
===========================================================
*/

app.use((err, req, res, next) => {
    console.error("Webseiten-Fehler:", err);

    const user = currentUser(req);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send(
        page(
            "Fehler",
            `
            <div class="card">
                <h1>Ein Fehler ist aufgetreten</h1>

                <p>
                    Die Anfrage konnte nicht verarbeitet werden.
                </p>

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
===========================================================
 AUTOMATISCHE SYSTEMPFLEGE
===========================================================
*/

// Abgelaufene Sessions löschen
setInterval(() => {
    try {
        const sessions = getSessions();

        const cutoff =
            Date.now() - 30 * 24 * 60 * 60 * 1000;

        const filtered = sessions.filter(
            session =>
                Number(session.lastUsed || session.createdAt) > cutoff
        );

        if (filtered.length !== sessions.length) {
            saveSessions(filtered);
        }
    } catch (err) {
        console.error(
            "Session-Cleanup Fehler:",
            err.message
        );
    }
}, 60 * 60 * 1000);

// Abgelaufene Gewinnspiele schließen
setInterval(() => {
    try {
        const giveaways = getGiveaways();

        let changed = false;

        for (const giveaway of giveaways) {
            if (
                giveaway.status === "open" &&
                giveaway.endsAt &&
                giveaway.endsAt <= Date.now()
            ) {
                giveaway.status = "closed";

                if (
                    Array.isArray(giveaway.participants) &&
                    giveaway.participants.length
                ) {
                    const winnerIndex = crypto.randomInt(
                        0,
                        giveaway.participants.length
                    );

                    giveaway.winnerId =
                        giveaway.participants[winnerIndex];
                }

                changed = true;
            }
        }

        if (changed) {
            saveGiveaways(giveaways);
        }
    } catch (err) {
        console.error(
            "Giveaway-Cleanup Fehler:",
            err.message
        );
    }
}, 60 * 1000);

/*
===========================================================
 SERVER
===========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("======================================");
    console.log(" North-Bot-2 Webseite");
    console.log("======================================");
    console.log(`Server läuft auf Port: ${PORT}`);
    console.log(`Discord: ${DISCORD_INVITE}`);
    console.log(`Owner: ${OWNER_EMAIL}`);
    console.log("======================================");
    console.log("");
});
