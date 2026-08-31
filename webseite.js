/*
========================================================
 NORTH BOT V2 - WEBSEITE
========================================================
 Benötigt:
   npm install express

 Start:
   node webseite.js

 Keine .env
 Keine express-session
 Daten werden automatisch als JSON gespeichert.

 Enthalten:
 - Registrierung / Login
 - Dauerhafter Login (30 Tage)
 - Profil bearbeiten
 - Rollen: owner / admin / manager / developer / moderator / user
 - Admin Panel
 - Benutzerverwaltung
 - Temporäre Bans
 - Kick
 - Wartung
 - Störung
 - Ankündigungen
 - Tickets
 - Bewerbungen
 - Coins
 - Daily Coins
 - Coin-Codes
 - Coin-Shop
 - Gewinnspiele
 - Team-Chat
 - User-Chat
 - Logs
 - Bestellungen
 - Beta-Nummern
 - Produktverwaltung
========================================================
*/

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";
const OWNER_EMAIL = "florianzustolberg@gmail.com";

/*
========================================================
 DATEIEN
========================================================
*/

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    sessions: path.join(DATA_DIR, "sessions.json"),
    applications: path.join(DATA_DIR, "applications.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    chats: path.join(DATA_DIR, "chats.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    announcements: path.join(DATA_DIR, "announcements.json")
};

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.sessions, []);
ensureFile(FILES.applications, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.chats, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    outage: false,
    outageText: "Aktuell liegt eine Störung vor.",
    announcement: "",
    announcementEnabled: false
});
ensureFile(FILES.announcements, []);

/*
========================================================
 JSON FUNKTIONEN
========================================================
*/

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
            return fallback;
        }

        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
            return fallback;
        }

        return JSON.parse(raw);
    } catch (err) {
        console.error("JSON-Fehler:", file, err.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getUsers() {
    return readJSON(FILES.users, []);
}

function saveUsers(data) {
    writeJSON(FILES.users, data);
}

function getTickets() {
    return readJSON(FILES.tickets, []);
}

function saveTickets(data) {
    writeJSON(FILES.tickets, data);
}

function getSessions() {
    return readJSON(FILES.sessions, []);
}

function saveSessions(data) {
    writeJSON(FILES.sessions, data);
}

function getApplications() {
    return readJSON(FILES.applications, []);
}

function saveApplications(data) {
    writeJSON(FILES.applications, data);
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

function getChats() {
    return readJSON(FILES.chats, []);
}

function saveChats(data) {
    writeJSON(FILES.chats, data);
}

function getLogs() {
    return readJSON(FILES.logs, []);
}

function saveLogs(data) {
    writeJSON(FILES.logs, data);
}

function getOrders() {
    return readJSON(FILES.orders, []);
}

function saveOrders(data) {
    writeJSON(FILES.orders, data);
}

function getSettings() {
    return readJSON(FILES.settings, {
        maintenance: false,
        maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
        outage: false,
        outageText: "Aktuell liegt eine Störung vor.",
        announcement: "",
        announcementEnabled: false
    });
}

function saveSettings(data) {
    writeJSON(FILES.settings, data);
}

function getAnnouncements() {
    return readJSON(FILES.announcements, []);
}

function saveAnnouncements(data) {
    writeJSON(FILES.announcements, data);
}

/*
========================================================
 EXPRESS
========================================================
*/

app.use(express.urlencoded({
    extended: true,
    limit: "2mb"
}));

app.use(express.json({
    limit: "2mb"
}));

/*
========================================================
 HILFSFUNKTIONEN
========================================================
*/

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function randomHex(bytes = 24) {
    return crypto.randomBytes(bytes).toString("hex");
}

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function id(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + randomHex(3);
}

function betaNumber() {
    return (
        "BETA-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function orderNumber() {
    return (
        "ORD-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function applicationNumber() {
    return (
        "APP-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function ticketNumber() {
    return (
        "TICKET-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function codeNumber() {
    return (
        "NORTH-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9äöüß]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}

/*
========================================================
 PASSWORT HASH
========================================================
*/

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .pbkdf2Sync(
            String(password),
            salt,
            120000,
            64,
            "sha512"
        )
        .toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(password, stored) {
    try {
        if (!stored || !stored.includes(":")) {
            return false;
        }

        const parts = stored.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const originalHash = parts[1];

        const newHash = crypto
            .pbkdf2Sync(
                String(password),
                salt,
                120000,
                64,
                "sha512"
            )
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(originalHash, "hex"),
            Buffer.from(newHash, "hex")
        );
    } catch {
        return false;
    }
}

/*
========================================================
 COOKIE
========================================================
*/

function parseCookies(req) {
    const header = req.headers.cookie || "";
    const cookies = {};

    header.split(";").forEach(part => {
        const index = part.indexOf("=");

        if (index === -1) return;

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();

        cookies[key] = decodeURIComponent(value);
    });

    return cookies;
}

function setLoginCookie(res, token) {
    const secure = process.env.NODE_ENV === "production"
        ? " Secure;"
        : "";

    res.setHeader(
        "Set-Cookie",
        "north_auth=" +
        encodeURIComponent(token) +
        "; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax;" +
        secure
    );
}

function clearLoginCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "north_auth=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
    );
}

/*
========================================================
 LOGIN
========================================================
*/

function getCurrentUser(req) {
    const cookies = parseCookies(req);
    const token = cookies.north_auth;

    if (!token) {
        return null;
    }

    const sessions = getSessions();

    const session = sessions.find(
        s =>
            s.token === token &&
            s.expiresAt > Date.now()
    );

    if (!session) {
        return null;
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === session.userId
    );

    if (!user) {
        return null;
    }

    if (user.bannedUntil && user.bannedUntil > Date.now()) {
        return {
            ...user,
            _banned: true
        };
    }

    return user;
}

function createSession(userId) {
    const sessions = getSessions();

    const token = randomHex(48);

    sessions.push({
        id: id("session"),
        token,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    writeJSON(
        FILES.sessions,
        sessions.filter(
            s => s.expiresAt > Date.now()
        )
    );

    return token;
}

function destroySession(req) {
    const cookies = parseCookies(req);

    if (!cookies.north_auth) {
        return;
    }

    const sessions = getSessions().filter(
        s => s.token !== cookies.north_auth
    );

    saveSessions(sessions);
}

/*
========================================================
 ROLLEN
========================================================
*/

const ADMIN_ROLES = [
    "owner",
    "admin",
    "manager"
];

const TEAM_ROLES = [
    "owner",
    "admin",
    "manager",
    "developer",
    "moderator"
];

function hasRole(user, roles) {
    if (!user) return false;

    return roles.includes(
        String(user.role || "").toLowerCase()
    );
}

function isAdmin(user) {
    return hasRole(user, ADMIN_ROLES);
}

function isTeam(user) {
    return hasRole(user, TEAM_ROLES);
}

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user._banned) {
        return res.redirect("/banned");
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                req,
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Du benötigst Administrator-Rechte.</p>
                    <a class="button" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    req.user = user;
    next();
}

function requireTeam(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isTeam(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                req,
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Dieser Bereich ist nur für das Team.</p>
                    <a class="button" href="/">Zurück</a>
                </div>
                `
            )
        );
    }

    req.user = user;
    next();
}

/*
========================================================
 LOG
========================================================
*/

function addLog(action, user, details = {}) {
    const logs = getLogs();

    logs.unshift({
        id: id("log"),
        action,
        userId: user ? user.id : null,
        userName: user ? user.username : "System",
        details,
        createdAt: new Date().toISOString()
    });

    if (logs.length > 5000) {
        logs.length = 5000;
    }

    saveLogs(logs);
}

/*
========================================================
 USER ERSTELLEN
========================================================
*/

function createUser(username, email, password, role = "user") {
    const users = getUsers();

    const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

    if (
        users.some(
            u =>
                String(u.email).toLowerCase() ===
                normalizedEmail
        )
    ) {
        return null;
    }

    const newUser = {
        id: id("user"),
        username: String(username).trim(),
        email: normalizedEmail,
        password: hashPassword(password),
        role,
        coins: 0,
        createdAt: new Date().toISOString(),
        lastDaily: null,
        bannedUntil: null,
        banReason: null,
        kicked: false,
        betaNumber: betaNumber()
    };

    users.push(newUser);

    saveUsers(users);

    return newUser;
}

/*
========================================================
 OWNER AUTOMATISCH ANLEGEN
========================================================
*/

function ensureOwner() {
    const users = getUsers();

    let owner = users.find(
        u =>
            String(u.email).toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
    );

    if (!owner) {
        owner = {
            id: id("user"),
            username: "Florian",
            email: OWNER_EMAIL,
            password: hashPassword("278263"),
            role: "owner",
            coins: 0,
            createdAt: new Date().toISOString(),
            lastDaily: null,
            bannedUntil: null,
            banReason: null,
            kicked: false,
            betaNumber: betaNumber()
        };

        users.push(owner);
        saveUsers(users);

        console.log(
            "Owner-Konto erstellt:",
            OWNER_EMAIL
        );
    } else {
        owner.role = "owner";
        saveUsers(users);
    }
}

ensureOwner();

/*
========================================================
 DESIGN
========================================================
*/

function page(title, req, content) {
    const user = req ? getCurrentUser(req) : null;
    const settings = getSettings();

    const maintenanceVisible =
        settings.maintenance &&
        (!user || !isAdmin(user));

    const outageVisible =
        settings.outage &&
        (!user || !isAdmin(user));

    let notices = "";

    if (maintenanceVisible) {
        notices += `
        <div class="notice warning">
            <strong>Wartung</strong>
            <span>${escapeHTML(settings.maintenanceText)}</span>
        </div>
        `;
    }

    if (outageVisible) {
        notices += `
        <div class="notice danger">
            <strong>Störung</strong>
            <span>${escapeHTML(settings.outageText)}</span>
        </div>
        `;
    }

    if (settings.announcementEnabled && settings.announcement) {
        notices += `
        <div class="notice info">
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
<title>${escapeHTML(title)} | North Bot</title>

<style>
* {
    box-sizing: border-box;
}

html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0d0f13;
    color: #e9edf2;
}

body {
    min-height: 100vh;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 64px;
    border-bottom: 1px solid #252932;
    background: #111318;
    display: flex;
    align-items: center;
    padding: 0 28px;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: .3px;
}

.nav-links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.nav-links a {
    padding: 8px 11px;
    border-radius: 7px;
    color: #aeb6c2;
    font-size: 14px;
}

.nav-links a:hover {
    background: #1b1f27;
    color: #fff;
}

.nav-right {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
}

.container {
    width: min(1150px, calc(100% - 32px));
    margin: 35px auto;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
}

.card {
    background: #15181e;
    border: 1px solid #272c35;
    border-radius: 10px;
    padding: 20px;
}

.card h1,
.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #8e98a6;
}

.button {
    display: inline-block;
    border: 0;
    background: #5865f2;
    color: white;
    border-radius: 7px;
    padding: 10px 15px;
    cursor: pointer;
    font-size: 14px;
}

.button:hover {
    filter: brightness(1.1);
}

.button.secondary {
    background: #252a33;
}

.button.danger {
    background: #c43c4b;
}

.button.success {
    background: #318a59;
}

input,
textarea,
select {
    width: 100%;
    background: #0e1014;
    border: 1px solid #303641;
    color: #fff;
    padding: 11px;
    border-radius: 7px;
    margin-top: 6px;
    margin-bottom: 13px;
    outline: none;
}

input:focus,
textarea:focus,
select:focus {
    border-color: #5865f2;
}

label {
    font-size: 13px;
    color: #aeb6c2;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

.form {
    max-width: 500px;
}

.center {
    text-align: center;
}

.notice {
    padding: 13px 16px;
    border-radius: 8px;
    margin-bottom: 15px;
    display: flex;
    gap: 12px;
    align-items: center;
    border: 1px solid #303641;
}

.notice.warning {
    background: #27200e;
    border-color: #695318;
}

.notice.danger {
    background: #291316;
    border-color: #6b2931;
}

.notice.info {
    background: #121c2e;
    border-color: #263f6a;
}

.stat {
    font-size: 30px;
    font-weight: 700;
    margin: 7px 0;
}

.small {
    font-size: 13px;
}

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 11px;
    border-bottom: 1px solid #292e36;
    vertical-align: top;
}

th {
    color: #8e98a6;
    font-size: 13px;
}

.badge {
    display: inline-block;
    background: #242932;
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 12px;
}

.badge.owner {
    background: #5b3510;
}

.badge.admin {
    background: #39215e;
}

.badge.manager {
    background: #173d54;
}

.badge.developer {
    background: #174d3b;
}

.badge.moderator {
    background: #49321a;
}

.chat {
    max-height: 450px;
    overflow-y: auto;
    border: 1px solid #292e36;
    padding: 12px;
    border-radius: 8px;
    background: #0e1014;
}

.message {
    padding: 10px;
    border-bottom: 1px solid #242831;
}

.message:last-child {
    border-bottom: 0;
}

.footer {
    border-top: 1px solid #252932;
    margin-top: 50px;
    padding: 30px;
    color: #737d8b;
    text-align: center;
}

.hero {
    padding: 50px 0;
}

.hero h1 {
    font-size: clamp(32px, 6vw, 56px);
    margin-bottom: 10px;
}

.hero p {
    color: #9da7b5;
    max-width: 650px;
    line-height: 1.6;
}

.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 15px;
}

hr {
    border: 0;
    border-top: 1px solid #292e36;
    margin: 22px 0;
}

.danger-text {
    color: #f07878;
}

.success-text {
    color: #66c994;
}

@media (max-width: 750px) {
    .nav {
        height: auto;
        padding: 14px;
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .nav-right {
        margin-left: 0;
    }

    .container {
        width: min(100% - 20px, 1150px);
        margin-top: 20px;
    }
}
</style>
</head>

<body>

<nav class="nav">

    <a class="logo" href="/">North Bot</a>

    <div class="nav-links">
        <a href="/">Start</a>

        ${
            user
            ? `
            <a href="/tickets">Tickets</a>
            <a href="/applications">Bewerbungen</a>
            <a href="/coins">Coins</a>
            <a href="/shop">Shop</a>
            <a href="/giveaways">Gewinnspiele</a>
            <a href="/chat">Chat</a>
            <a href="/profile">Profil</a>
            `
            : ""
        }

        ${
            user && isTeam(user)
            ? `<a href="/team-chat">Team-Chat</a>`
            : ""
        }

        ${
            user && isAdmin(user)
            ? `<a href="/admin">Admin</a>`
            : ""
        }
    </div>

    <div class="nav-right">
        ${
            user
            ? `
                <span class="small muted">
                    ${escapeHTML(user.username)}
                </span>
                <a class="button secondary" href="/logout">
                    Abmelden
                </a>
            `
            : `
                <a class="button secondary" href="/login">Login</a>
                <a class="button" href="/register">Registrieren</a>
            `
        }
    </div>

</nav>

<div class="container">

${notices}

${content}

</div>

<footer class="footer">
    North Bot V2 ·
    <a href="${DISCORD_INVITE}" target="_blank">
        Discord
    </a>
</footer>

</body>
</html>
`;
}

/*
========================================================
 HOME
========================================================
*/

app.get("/", (req, res) => {
    const user = getCurrentUser(req);

    if (user && user._banned) {
        return res.redirect("/banned");
    }

    res.send(
        page(
            "Start",
            req,
            `
            <section class="hero">

                <h1>North Bot</h1>

                <p>
                    Webseite für Community, Support,
                    Bewerbungen, Coins und Teamverwaltung.
                </p>

                <div class="actions">
                    ${
                        user
                        ? `
                            <a class="button" href="/tickets">
                                Support öffnen
                            </a>

                            <a class="button secondary" href="/profile">
                                Profil
                            </a>
                        `
                        : `
                            <a class="button" href="/register">
                                Konto erstellen
                            </a>

                            <a class="button secondary" href="/login">
                                Anmelden
                            </a>
                        `
                    }

                    <a
                        class="button secondary"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Discord
                    </a>
                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h3>Support</h3>
                    <p class="muted">
                        Erstelle ein Ticket und verwalte
                        deine Support-Anfragen.
                    </p>
                </div>

                <div class="card">
                    <h3>Coins</h3>
                    <p class="muted">
                        Sammle Coins, löse Codes ein
                        und kaufe Produkte.
                    </p>
                </div>

                <div class="card">
                    <h3>Bewerbungen</h3>
                    <p class="muted">
                        Bewirb dich als Moderator
                        oder Developer.
                    </p>
                </div>

                <div class="card">
                    <h3>Community</h3>
                    <p class="muted">
                        Chat, Gewinnspiele und
                        weitere Community-Systeme.
                    </p>
                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 REGISTER
========================================================
*/

app.get("/register", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        return res.redirect("/");
    }

    res.send(
        page(
            "Registrieren",
            req,
            `
            <div class="card form">

                <h1>Registrieren</h1>

                <p class="muted">
                    Erstelle dein North-Bot-Konto.
                </p>

                <form method="POST" action="/register">

                    <label>Benutzername</label>
                    <input
                        name="username"
                        required
                        minlength="2"
                        maxlength="32"
                        autocomplete="username"
                    >

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
                        minlength="6"
                        autocomplete="new-password"
                    >

                    <button class="button" type="submit">
                        Konto erstellen
                    </button>

                </form>

                <hr>

                <p class="small muted">
                    Bereits registriert?
                    <a href="/login">Jetzt anmelden</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (
        username.length < 2 ||
        username.length > 32 ||
        password.length < 6 ||
        !email.includes("@")
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                req,
                `
                <div class="card">
                    <h1>Registrierung fehlgeschlagen</h1>
                    <p>
                        Bitte überprüfe deine Angaben.
                    </p>
                    <a class="button" href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    const users = getUsers();

    if (
        users.some(
            u =>
                String(u.email).toLowerCase() === email
        )
    ) {
        return res.status(409).send(
            page(
                "Fehler",
                req,
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

    const newUser = createUser(
        username,
        email,
        password,
        "user"
    );

    if (!newUser) {
        return res.status(500).send("Registrierung fehlgeschlagen.");
    }

    addLog(
        "user_register",
        newUser,
        {
            email: newUser.email
        }
    );

    const token = createSession(newUser.id);

    setLoginCookie(res, token);

    res.redirect("/");
});

/*
========================================================
 LOGIN
========================================================
*/

app.get("/login", (req, res) => {
    const user = getCurrentUser(req);

    if (user && !user._banned) {
        return res.redirect("/");
    }

    res.send(
        page(
            "Login",
            req,
            `
            <div class="card form">

                <h1>Anmelden</h1>

                <p class="muted">
                    Du bleibst nach dem Login
                    30 Tage angemeldet.
                </p>

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

                    <button class="button" type="submit">
                        Anmelden
                    </button>

                </form>

                <hr>

                <p class="small muted">
                    Noch kein Konto?
                    <a href="/register">Registrieren</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    const users = getUsers();

    const user = users.find(
        u =>
            String(u.email).toLowerCase() === email
    );

    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).send(
            page(
                "Login",
                req,
                `
                <div class="card form">
                    <h1>Login fehlgeschlagen</h1>

                    <p class="danger-text">
                        E-Mail oder Passwort ist falsch.
                    </p>

                    <a class="button" href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (
        user.bannedUntil &&
        user.bannedUntil > Date.now()
    ) {
        return res.redirect("/banned");
    }

    if (
        user.bannedUntil &&
        user.bannedUntil <= Date.now()
    ) {
        user.bannedUntil = null;
        user.banReason = null;
        saveUsers(users);
    }

    user.kicked = false;
    saveUsers(users);

    const token = createSession(user.id);

    setLoginCookie(res, token);

    addLog(
        "login",
        user
    );

    res.redirect("/");
});

/*
========================================================
 LOGOUT
========================================================
*/

app.get("/logout", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        addLog(
            "logout",
            user
        );
    }

    destroySession(req);
    clearLoginCookie(res);

    res.redirect("/login");
});

/*
========================================================
 BANNED
========================================================
*/

app.get("/banned", (req, res) => {
    const user = getCurrentUser(req);

    if (!user || !user._banned) {
        return res.redirect("/");
    }

    const users = getUsers();

    const realUser = users.find(
        u => u.id === user.id
    );

    const until = realUser.bannedUntil
        ? new Date(realUser.bannedUntil).toLocaleString("de-DE")
        : "Unbekannt";

    res.send(
        page(
            "Gebannt",
            req,
            `
            <div class="card center">

                <h1>Account gesperrt</h1>

                <p>
                    Dein Zugang zur Webseite wurde
                    vorübergehend gesperrt.
                </p>

                <p class="muted">
                    Grund:
                    ${escapeHTML(realUser.banReason || "Kein Grund angegeben")}
                </p>

                <p class="muted">
                    Ende:
                    ${escapeHTML(until)}
                </p>

                <div class="actions" style="justify-content:center">

                    <a
                        class="button"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Auf Discord gehen
                    </a>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 PROFIL
========================================================
*/

app.get("/profile", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Profil",
            req,
            `
            <div class="grid">

                <div class="card">

                    <h1>Profil</h1>

                    <p>
                        <strong>Name:</strong>
                        ${escapeHTML(user.username)}
                    </p>

                    <p>
                        <strong>E-Mail:</strong>
                        ${escapeHTML(user.email)}
                    </p>

                    <p>
                        <strong>Rolle:</strong>
                        <span class="badge ${escapeHTML(user.role)}">
                            ${escapeHTML(user.role)}
                        </span>
                    </p>

                    <p>
                        <strong>Coins:</strong>
                        ${Number(user.coins || 0)}
                    </p>

                    <p>
                        <strong>Beta-Nummer:</strong>
                        ${escapeHTML(user.betaNumber || "-")}
                    </p>

                </div>

                <div class="card form">

                    <h2>Profil bearbeiten</h2>

                    <form method="POST" action="/profile">

                        <label>Benutzername</label>

                        <input
                            name="username"
                            value="${escapeHTML(user.username)}"
                            required
                            minlength="2"
                            maxlength="32"
                        >

                        <label>Neue E-Mail</label>

                        <input
                            type="email"
                            name="email"
                            value="${escapeHTML(user.email)}"
                            required
                        >

                        <label>
                            Neues Passwort
                            <span class="muted">
                                (leer lassen = unverändert)
                            </span>
                        </label>

                        <input
                            type="password"
                            name="password"
                            minlength="6"
                        >

                        <button class="button" type="submit">
                            Speichern
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post("/profile", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/logout");
    }

    const username = String(
        req.body.username || user.username
    ).trim();

    const email = String(
        req.body.email || user.email
    ).trim().toLowerCase();

    const password = String(
        req.body.password || ""
    );

    if (username.length < 2) {
        return res.status(400).send("Name zu kurz.");
    }

    const emailTaken = users.some(
        u =>
            u.id !== user.id &&
            String(u.email).toLowerCase() === email
    );

    if (emailTaken) {
        return res.status(409).send(
            "Diese E-Mail wird bereits verwendet."
        );
    }

    user.username = username;
    user.email = email;

    if (password) {
        user.password = hashPassword(password);
    }

    saveUsers(users);

    addLog(
        "profile_update",
        user
    );

    res.redirect("/profile");
});

/*
========================================================
 TICKETS
========================================================
*/

app.get("/tickets", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ownTickets = tickets
        .filter(
            t =>
                t.userId === req.user.id ||
                isAdmin(req.user) ||
                isTeam(req.user)
        )
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

    res.send(
        page(
            "Tickets",
            req,
            `
            <div class="card">

                <h1>Support</h1>

                <p class="muted">
                    Erstelle ein Support-Ticket.
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
                        maxlength="5000"
                        required
                    ></textarea>

                    <button class="button" type="submit">
                        Ticket erstellen
                    </button>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>Meine Tickets</h2>

                ${
                    ownTickets.length === 0
                    ? `
                        <p class="muted">
                            Noch keine Tickets.
                        </p>
                    `
                    : `
                        <div class="table-wrap">

                        <table>

                            <tr>
                                <th>Nummer</th>
                                <th>Betreff</th>
                                <th>Status</th>
                                <th>Erstellt</th>
                                <th></th>
                            </tr>

                            ${ownTickets.map(t => `
                                <tr>

                                    <td>
                                        ${escapeHTML(t.number)}
                                    </td>

                                    <td>
                                        ${escapeHTML(t.subject)}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHTML(t.status)}
                                        </span>
                                    </td>

                                    <td>
                                        ${new Date(t.createdAt).toLocaleString("de-DE")}
                                    </td>

                                    <td>
                                        <a
                                            class="button secondary"
                                            href="/tickets/${encodeURIComponent(t.id)}"
                                        >
                                            Öffnen
                                        </a>
                                    </td>

                                </tr>
                            `).join("")}

                        </table>

                        </div>
                    `
                }

            </div>
            `
        )
    );
});

app.post("/tickets/create", requireLogin, (req, res) => {
    const subject = String(
        req.body.subject || ""
    ).trim();

    const message = String(
        req.body.message || ""
    ).trim();

    if (!subject || !message) {
        return res.status(400).send(
            "Betreff und Nachricht fehlen."
        );
    }

    const ticket = {
        id: id("ticket"),
        number: ticketNumber(),
        userId: req.user.id,
        username: req.user.username,
        subject,
        message,
        status: "offen",
        claimedBy: null,
        claimedByName: null,
        createdAt: new Date().toISOString(),
        closedAt: null,
        messages: [
            {
                id: id("message"),
                userId: req.user.id,
                username: req.user.username,
                message,
                createdAt: new Date().toISOString()
            }
        ]
    };

    const tickets = getTickets();

    tickets.push(ticket);

    saveTickets(tickets);

    addLog(
        "ticket_create",
        req.user,
        {
            ticket: ticket.number
        }
    );

    /*
      Der Bot kann tickets.json überwachen und daraus
      den Discord-Ticketkanal erstellen.
    */

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Ticket nicht gefunden.");
    }

    const allowed =
        ticket.userId === req.user.id ||
        isTeam(req.user);

    if (!allowed) {
        return res.status(403).send("Kein Zugriff.");
    }

    res.send(
        page(
            ticket.number,
            req,
            `
            <div class="card">

                <h1>
                    ${escapeHTML(ticket.subject)}
                </h1>

                <p class="muted">
                    ${escapeHTML(ticket.number)}
                </p>

                <p>
                    Status:
                    <span class="badge">
                        ${escapeHTML(ticket.status)}
                    </span>
                </p>

                ${
                    ticket.claimedByName
                    ? `
                        <p class="small">
                            Übernommen von:
                            <strong>
                                ${escapeHTML(ticket.claimedByName)}
                            </strong>
                        </p>
                    `
                    : ""
                }

                <div class="chat">

                    ${ticket.messages.map(m => `
                        <div class="message">

                            <strong>
                                ${escapeHTML(m.username)}
                            </strong>

                            <span class="muted small">
                                ${new Date(m.createdAt).toLocaleString("de-DE")}
                            </span>

                            <div>
                                ${escapeHTML(m.message)}
                            </div>

                        </div>
                    `).join("")}

                </div>

                ${
                    ticket.status !== "geschlossen"
                    ? `
                    <form method="POST" action="/tickets/${encodeURIComponent(ticket.id)}/message">

                        <label>Antwort</label>

                        <textarea
                            name="message"
                            required
                            maxlength="5000"
                        ></textarea>

                        <button class="button" type="submit">
                            Senden
                        </button>

                    </form>
                    `
                    : `
                    <p class="muted">
                        Dieses Ticket ist geschlossen.
                    </p>
                    `
                }

                ${
                    isTeam(req.user) &&
                    ticket.status !== "geschlossen"
                    ? `
                    <hr>

                    <div class="actions">

                        ${
                            ticket.claimedBy
                            ? `
                                <form
                                    method="POST"
                                    action="/tickets/${encodeURIComponent(ticket.id)}/unclaim"
                                >
                                    <button class="button secondary">
                                        Nicht übernehmen
                                    </button>
                                </form>
                            `
                            : `
                                <form
                                    method="POST"
                                    action="/tickets/${encodeURIComponent(ticket.id)}/claim"
                                >
                                    <button class="button">
                                        Übernehmen
                                    </button>
                                </form>
                            `
                        }

                        <form
                            method="POST"
                            action="/tickets/${encodeURIComponent(ticket.id)}/close"
                        >
                            <button class="button danger">
                                Schließen
                            </button>
                        </form>

                    </div>
                    `
                    : ""
                }

            </div>
            `
        )
    );
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        ticket.userId !== req.user.id &&
        !isTeam(req.user)
    ) {
        return res.status(403).send("Kein Zugriff.");
    }

    if (ticket.status === "geschlossen") {
        return res.status(400).send("Ticket geschlossen.");
    }

    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect(
            "/tickets/" +
            encodeURIComponent(ticket.id)
        );
    }

    ticket.messages.push({
        id: id("message"),
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    saveTickets(tickets);

    addLog(
        "ticket_message",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/claim", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.claimedBy = req.user.id;
    ticket.claimedByName = req.user.username;

    saveTickets(tickets);

    addLog(
        "ticket_claim",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/unclaim", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.claimedBy = null;
    ticket.claimedByName = null;

    saveTickets(tickets);

    addLog(
        "ticket_unclaim",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/close", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.status = "geschlossen";
    ticket.closedAt = new Date().toISOString();

    saveTickets(tickets);

    addLog(
        "ticket_close",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

/*
========================================================
 BEWERBUNGEN
========================================================
*/

app.get("/applications", requireLogin, (req, res) => {
    const applications = getApplications();

    const own = applications.filter(
        a => a.userId === req.user.id
    );

    res.send(
        page(
            "Bewerbungen",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Bewerbung</h1>

                    <form method="POST" action="/applications">

                        <label>Bereich</label>

                        <select name="type" required>

                            <option value="moderator">
                                Moderator
                            </option>

                            <option value="developer">
                                Developer
                            </option>

                        </select>

                        <label>Discord-Name / ID</label>

                        <input
                            name="discord"
                            required
                            maxlength="100"
                        >

                        <label>Alter</label>

                        <input
                            name="age"
                            type="number"
                            min="1"
                            max="100"
                            required
                        >

                        <label>Erfahrung</label>

                        <textarea
                            name="experience"
                            required
                        ></textarea>

                        <label>Warum möchtest du ins Team?</label>

                        <textarea
                            name="motivation"
                            required
                        ></textarea>

                        <label>Warum sollten wir dich nehmen?</label>

                        <textarea
                            name="reason"
                            required
                        ></textarea>

                        <button class="button" type="submit">
                            Bewerbung absenden
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Meine Bewerbungen</h2>

                    ${
                        own.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Bewerbung.
                            </p>
                        `
                        : own.map(a => `
                            <div class="card">

                                <strong>
                                    ${escapeHTML(a.number)}
                                </strong>

                                <p>
                                    ${escapeHTML(a.type)}
                                </p>

                                <span class="badge">
                                    ${escapeHTML(a.status)}
                                </span>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/applications", requireLogin, (req, res) => {
    const type = String(
        req.body.type || ""
    ).trim().toLowerCase();

    if (
        type !== "moderator" &&
        type !== "developer"
    ) {
        return res.status(400).send("Ungültiger Bereich.");
    }

    const application = {
        id: id("application"),
        number: applicationNumber(),
        userId: req.user.id,
        username: req.user.username,
        type,
        discord: String(req.body.discord || "").trim(),
        age: String(req.body.age || "").trim(),
        experience: String(req.body.experience || "").trim(),
        motivation: String(req.body.motivation || "").trim(),
        reason: String(req.body.reason || "").trim(),
        status: "offen",
        createdAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null
    };

    const applications = getApplications();

    applications.push(application);

    saveApplications(applications);

    addLog(
        "application_create",
        req.user,
        {
            application: application.number,
            type
        }
    );

    res.redirect("/applications");
});

/*
========================================================
 COINS
========================================================
*/

app.get("/coins", requireLogin, (req, res) => {
    const user = req.user;

    const canDaily =
        !user.lastDaily ||
        Date.now() - new Date(user.lastDaily).getTime()
        >= 14 * 60 * 60 * 1000;

    res.send(
        page(
            "Coins",
            req,
            `
            <div class="grid">

                <div class="card">

                    <h1>Coins</h1>

                    <div class="stat">
                        ${Number(user.coins || 0)}
                    </div>

                    <p class="muted">
                        Dein aktueller Kontostand.
                    </p>

                </div>

                <div class="card">

                    <h2>Daily</h2>

                    <p>
                        Alle 14 Stunden bekommst du
                        <strong>100 Coins</strong>.
                    </p>

                    ${
                        canDaily
                        ? `
                            <form method="POST" action="/coins/daily">

                                <button class="button" type="submit">
                                    100 Coins abholen
                                </button>

                            </form>
                        `
                        : `
                            <p class="muted">
                                Daily bereits abgeholt.
                            </p>
                        `
                    }

                </div>

                <div class="card">

                    <h2>Code einlösen</h2>

                    <form method="POST" action="/coins/redeem">

                        <input
                            name="code"
                            placeholder="NORTH-1234-5678"
                            required
                        >

                        <button class="button" type="submit">
                            Einlösen
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post("/coins/daily", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    if (
        user.lastDaily &&
        Date.now() -
        new Date(user.lastDaily).getTime()
        < 14 * 60 * 60 * 1000
    ) {
        return res.redirect("/coins");
    }

    user.coins = Number(user.coins || 0) + 100;
    user.lastDaily = new Date().toISOString();

    saveUsers(users);

    addLog(
        "daily_coins",
        user,
        {
            amount: 100
        }
    );

    res.redirect("/coins");
});

app.post("/coins/redeem", requireLogin, (req, res) => {
    const entered = String(
        req.body.code || ""
    ).trim().toUpperCase();

    const codes = getCodes();

    const code = codes.find(
        c =>
            String(c.code).toUpperCase() === entered &&
            c.active !== false
    );

    if (!code) {
        return res.status(400).send(
            page(
                "Code",
                req,
                `
                <div class="card">
                    <h1>Code ungültig</h1>
                    <p>
                        Dieser Code existiert nicht
                        oder ist deaktiviert.
                    </p>
                    <a class="button" href="/coins">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    if (
        code.expiresAt &&
        new Date(code.expiresAt).getTime() < Date.now()
    ) {
        return res.status(400).send(
            "Dieser Code ist abgelaufen."
        );
    }

    if (!Array.isArray(code.usedBy)) {
        code.usedBy = [];
    }

    if (code.usedBy.includes(req.user.id)) {
        return res.status(400).send(
            "Du hast diesen Code bereits verwendet."
        );
    }

    if (
        code.maxUses &&
        code.usedBy.length >= Number(code.maxUses)
    ) {
        return res.status(400).send(
            "Dieser Code wurde bereits zu oft verwendet."
        );
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    const amount = Number(code.coins || 0);

    user.coins = Number(user.coins || 0) + amount;

    code.usedBy.push(user.id);

    saveUsers(users);
    saveCodes(codes);

    addLog(
        "code_redeem",
        user,
        {
            code: code.code,
            coins: amount
        }
    );

    res.redirect("/coins");
});

/*
========================================================
 SHOP
========================================================
*/

app.get("/shop", requireLogin, (req, res) => {
    const products = getShop()
        .filter(p => p.active !== false);

    res.send(
        page(
            "Shop",
            req,
            `
            <div class="card">

                <h1>Coins-Shop</h1>

                <p class="muted">
                    Coins: ${Number(req.user.coins || 0)}
                </p>

            </div>

            <br>

            <div class="grid">

                ${
                    products.length === 0
                    ? `
                        <div class="card">
                            <p class="muted">
                                Noch keine Produkte.
                            </p>
                        </div>
                    `
                    : products.map(p => `
                        <div class="card">

                            <h2>
                                ${escapeHTML(p.name)}
                            </h2>

                            <p class="muted">
                                ${escapeHTML(p.description || "")}
                            </p>

                            <strong>
                                ${Number(p.price)} Coins
                            </strong>

                            <div class="actions">

                                <form
                                    method="POST"
                                    action="/shop/buy"
                                >

                                    <input
                                        type="hidden"
                                        name="productId"
                                        value="${escapeHTML(p.id)}"
                                    >

                                    <button
                                        class="button"
                                        type="submit"
                                    >
                                        Kaufen
                                    </button>

                                </form>

                            </div>

                        </div>
                    `).join("")
                }

            </div>
            `
        )
    );
});

app.post("/shop/buy", requireLogin, (req, res) => {
    const products = getShop();

    const product = products.find(
        p =>
            p.id === req.body.productId &&
            p.active !== false
    );

    if (!product) {
        return res.status(404).send(
            "Produkt nicht gefunden."
        );
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    const price = Number(product.price || 0);

    if (Number(user.coins || 0) < price) {
        return res.status(400).send(
            page(
                "Shop",
                req,
                `
                <div class="card">
                    <h1>Nicht genug Coins</h1>
                    <p>
                        Du benötigst ${price} Coins.
                    </p>
                    <a class="button" href="/shop">
                        Zurück zum Shop
                    </a>
                </div>
                `
            )
        );
    }

    user.coins -= price;

    const order = {
        id: id("order"),
        number: orderNumber(),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.name,
        price,
        status: "offen",
        createdAt: new Date().toISOString()
    };

    const orders = getOrders();

    orders.push(order);

    saveUsers(users);
    saveOrders(orders);

    addLog(
        "shop_purchase",
        user,
        {
            order: order.number,
            product: product.name,
            price
        }
    );

    res.send(
        page(
            "Bestellung",
            req,
            `
            <div class="card center">

                <h1>Bestellung erstellt</h1>

                <p>
                    Deine Bestellung wurde gespeichert.
                </p>

                <p>
                    Bestellnummer:
                </p>

                <h2>
                    ${escapeHTML(order.number)}
                </h2>

                <p class="muted">
                    Diese Nummer kannst du dem Team
                    auf Discord geben.
                </p>

                <a
                    class="button"
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

/*
========================================================
 GEWINNSPIELE
========================================================
*/

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = getGiveaways()
        .filter(g => g.active !== false);

    res.send(
        page(
            "Gewinnspiele",
            req,
            `
            <div class="card">

                <h1>Gewinnspiele</h1>

                <p class="muted">
                    Nimm an laufenden Gewinnspielen teil.
                </p>

            </div>

            <br>

            <div class="grid">

                ${
                    giveaways.length === 0
                    ? `
                        <div class="card">
                            <p class="muted">
                                Momentan läuft kein Gewinnspiel.
                            </p>
                        </div>
                    `
                    : giveaways.map(g => {

                        const joined =
                            Array.isArray(g.participants) &&
                            g.participants.includes(req.user.id);

                        return `
                        <div class="card">

                            <h2>
                                ${escapeHTML(g.title)}
                            </h2>

                            <p>
                                ${escapeHTML(g.description || "")}
                            </p>

                            <p>
                                Preis:
                                <strong>
                                    ${escapeHTML(g.prize || "-")}
                                </strong>
                            </p>

                            ${
                                joined
                                ? `
                                    <span class="badge">
                                        Teilnahme gespeichert
                                    </span>
                                `
                                : `
                                    <form
                                        method="POST"
                                        action="/giveaways/join"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(g.id)}"
                                        >

                                        <button
                                            class="button"
                                            type="submit"
                                        >
                                            Teilnehmen
                                        </button>

                                    </form>
                                `
                            }

                        </div>
                        `;
                    }).join("")
                }

            </div>
            `
        )
    );
});

app.post("/giveaways/join", requireLogin, (req, res) => {
    const giveaways = getGiveaways();

    const giveaway = giveaways.find(
        g =>
            g.id === req.body.id &&
            g.active !== false
    );

    if (!giveaway) {
        return res.status(404).send(
            "Gewinnspiel nicht gefunden."
        );
    }

    if (!Array.isArray(giveaway.participants)) {
        giveaway.participants = [];
    }

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);
        saveGiveaways(giveaways);

        addLog(
            "giveaway_join",
            req.user,
            {
                giveaway: giveaway.title
            }
        );
    }

    res.redirect("/giveaways");
});

/*
========================================================
 USER CHAT
========================================================
*/

app.get("/chat", requireLogin, (req, res) => {
    const chats = getChats()
        .filter(c => c.type === "public")
        .slice(-100);

    res.send(
        page(
            "Chat",
            req,
            `
            <div class="card">

                <h1>Community Chat</h1>

                <div class="chat">

                    ${
                        chats.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Nachrichten.
                            </p>
                        `
                        : chats.map(m => `
                            <div class="message">

                                <strong>
                                    ${escapeHTML(m.username)}
                                </strong>

                                <span class="muted small">
                                    ${new Date(m.createdAt).toLocaleString("de-DE")}
                                </span>

                                <div>
                                    ${escapeHTML(m.message)}
                                </div>

                            </div>
                        `).join("")
                    }

                </div>

                <br>

                <form method="POST" action="/chat">

                    <textarea
                        name="message"
                        required
                        maxlength="1000"
                        placeholder="Nachricht schreiben..."
                    ></textarea>

                    <button class="button">
                        Senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post("/chat", requireLogin, (req, res) => {
    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect("/chat");
    }

    const chats = getChats();

    chats.push({
        id: id("chat"),
        type: "public",
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    if (chats.length > 5000) {
        chats.splice(0, chats.length - 5000);
    }

    saveChats(chats);

    addLog(
        "public_chat",
        req.user
    );

    res.redirect("/chat");
});

/*
========================================================
 TEAM CHAT
========================================================
*/

app.get("/team-chat", requireTeam, (req, res) => {
    const chats = getChats()
        .filter(c => c.type === "team")
        .slice(-100);

    res.send(
        page(
            "Team Chat",
            req,
            `
            <div class="card">

                <h1>Team-Chat</h1>

                <p class="muted">
                    Nur Owner, Admin, Manager,
                    Developer und Moderator.
                </p>

                <div class="chat">

                    ${
                        chats.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Nachrichten.
                            </p>
                        `
                        : chats.map(m => `
                            <div class="message">

                                <strong>
                                    ${escapeHTML(m.username)}
                                </strong>

                                <span class="badge">
                                    ${escapeHTML(m.role || "")}
                                </span>

                                <span class="muted small">
                                    ${new Date(m.createdAt).toLocaleString("de-DE")}
                                </span>

                                <div>
                                    ${escapeHTML(m.message)}
                                </div>

                            </div>
                        `).join("")
                    }

                </div>

                <br>

                <form method="POST" action="/team-chat">

                    <textarea
                        name="message"
                        required
                        maxlength="2000"
                    ></textarea>

                    <button class="button">
                        Senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post("/team-chat", requireTeam, (req, res) => {
    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect("/team-chat");
    }

    const chats = getChats();

    chats.push({
        id: id("teamchat"),
        type: "team",
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        message,
        createdAt: new Date().toISOString()
    });

    if (chats.length > 5000) {
        chats.splice(0, chats.length - 5000);
    }

    saveChats(chats);

    addLog(
        "team_chat",
        req.user
    );

    res.redirect("/team-chat");
});

/*
========================================================
 ADMIN DASHBOARD
========================================================
*/

app.get("/admin", requireAdmin, (req, res) => {
    const users = getUsers();
    const tickets = getTickets();
    const applications = getApplications();
    const codes = getCodes();
    const products = getShop();
    const giveaways = getGiveaways();
    const logs = getLogs();
    const orders = getOrders();

    res.send(
        page(
            "Admin Panel",
            req,
            `
            <div class="card">

                <h1>Admin Panel</h1>

                <p class="muted">
                    Willkommen,
                    ${escapeHTML(req.user.username)}.
                </p>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h3>Benutzer</h3>
                    <div class="stat">${users.length}</div>
                </div>

                <div class="card">
                    <h3>Tickets</h3>
                    <div class="stat">${tickets.length}</div>
                </div>

                <div class="card">
                    <h3>Bewerbungen</h3>
                    <div class="stat">${applications.length}</div>
                </div>

                <div class="card">
                    <h3>Codes</h3>
                    <div class="stat">${codes.length}</div>
                </div>

                <div class="card">
                    <h3>Produkte</h3>
                    <div class="stat">${products.length}</div>
                </div>

                <div class="card">
                    <h3>Gewinnspiele</h3>
                    <div class="stat">${giveaways.length}</div>
                </div>

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="stat">${orders.length}</div>
                </div>

                <div class="card">
                    <h3>Logs</h3>
                    <div class="stat">${logs.length}</div>
                </div>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h2>Verwaltung</h2>

                    <div class="actions">
                        <a class="button" href="/admin/users">
                            Benutzer
                        </a>

                        <a class="button" href="/admin/applications">
                            Bewerbungen
                        </a>

                        <a class="button" href="/admin/tickets">
                            Tickets
                        </a>

                        <a class="button" href="/admin/codes">
                            Codes
                        </a>

                        <a class="button" href="/admin/shop">
                            Shop
                        </a>

                        <a class="button" href="/admin/giveaways">
                            Gewinnspiele
                        </a>

                        <a class="button" href="/admin/orders">
                            Bestellungen
                        </a>

                        <a class="button" href="/admin/logs">
                            Logs
                        </a>

                        <a class="button" href="/admin/settings">
                            Webseite
                        </a>
                    </div>

                </div>

                <div class="card">

                    <h2>Systemstatus</h2>

                    <p>
                        Wartung:
                        ${
                            getSettings().maintenance
                            ? `<span class="badge">AN</span>`
                            : `<span class="badge">AUS</span>`
                        }
                    </p>

                    <p>
                        Störung:
                        ${
                            getSettings().outage
                            ? `<span class="badge">AN</span>`
                            : `<span class="badge">AUS</span>`
                        }
                    </p>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN USERS
========================================================
*/

app.get("/admin/users", requireAdmin, (req, res) => {
    const users = getUsers();

    res.send(
        page(
            "Benutzer",
            req,
            `
            <div class="card">

                <h1>Benutzerverwaltung</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Coins</th>
                        <th>Ban</th>
                        <th>Aktionen</th>
                    </tr>

                    ${users.map(u => `
                        <tr>

                            <td>
                                ${escapeHTML(u.username)}
                            </td>

                            <td>
                                ${escapeHTML(u.email)}
                            </td>

                            <td>
                                <span class="badge ${escapeHTML(u.role)}">
                                    ${escapeHTML(u.role)}
                                </span>
                            </td>

                            <td>
                                ${Number(u.coins || 0)}
                            </td>

                            <td>
                                ${
                                    u.bannedUntil &&
                                    u.bannedUntil > Date.now()
                                    ? `
                                        bis
                                        ${new Date(u.bannedUntil).toLocaleString("de-DE")}
                                    `
                                    : "Nein"
                                }
                            </td>

                            <td>

                                <form
                                    method="POST"
                                    action="/admin/user/role"
                                    style="margin-bottom:7px"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(u.id)}"
                                    >

                                    <select name="role">

                                        <option value="user" ${u.role === "user" ? "selected" : ""}>
                                            user
                                        </option>

                                        <option value="moderator" ${u.role === "moderator" ? "selected" : ""}>
                                            moderator
                                        </option>

                                        <option value="developer" ${u.role === "developer" ? "selected" : ""}>
                                            developer
                                        </option>

                                        <option value="manager" ${u.role === "manager" ? "selected" : ""}>
                                            manager
                                        </option>

                                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>
                                            admin
                                        </option>

                                        <option value="owner" ${u.role === "owner" ? "selected" : ""}>
                                            owner
                                        </option>

                                    </select>

                                    <button class="button secondary">
                                        Rolle
                                    </button>

                                </form>

                                <form
                                    method="POST"
                                    action="/admin/user/coins"
                                    style="margin-bottom:7px"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(u.id)}"
                                    >

                                    <input
                                        name="coins"
                                        type="number"
                                        placeholder="Coins"
                                    >

                                    <button class="button secondary">
                                        Coins setzen
                                    </button>

                                </form>

                                ${
                                    u.email.toLowerCase() !==
                                    OWNER_EMAIL.toLowerCase()
                                    ? `
                                    <form
                                        method="POST"
                                        action="/admin/user/ban"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(u.id)}"
                                        >

                                        <input
                                            name="minutes"
                                            type="number"
                                            min="1"
                                            placeholder="Minuten"
                                            required
                                        >

                                        <input
                                            name="reason"
                                            placeholder="Grund"
                                            required
                                        >

                                        <button
                                            class="button danger"
                                            type="submit"
                                        >
                                            Ban
                                        </button>

                                    </form>

                                    <form
                                        method="POST"
                                        action="/admin/user/unban"
                                        style="margin-top:7px"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(u.id)}"
                                        >

                                        <button
                                            class="button success"
                                            type="submit"
                                        >
                                            Unban
                                        </button>

                                    </form>
                                    `
                                    : `
                                        <span class="muted small">
                                            Owner geschützt
                                        </span>
                                    `
                                }

                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/user/role", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("User nicht gefunden.");
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        target.role = "owner";
    } else {
        const allowed = [
            "user",
            "moderator",
            "developer",
            "manager",
            "admin",
            "owner"
        ];

        if (!allowed.includes(req.body.role)) {
            return res.status(400).send("Ungültige Rolle.");
        }

        target.role = req.body.role;
    }

    saveUsers(users);

    addLog(
        "user_role",
        req.user,
        {
            target: target.email,
            role: target.role
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/coins", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    const coins = Number(req.body.coins);

    if (!Number.isFinite(coins) || coins < 0) {
        return res.status(400).send("Ungültige Coins.");
    }

    target.coins = Math.floor(coins);

    saveUsers(users);

    addLog(
        "admin_coins_set",
        req.user,
        {
            target: target.email,
            coins: target.coins
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/ban", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        return res.status(403).send(
            "Der Owner kann nicht gebannt werden."
        );
    }

    const minutes = Number(req.body.minutes);

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {
        return res.status(400).send(
            "Ungültige Dauer."
        );
    }

    target.bannedUntil =
        Date.now() +
        minutes * 60 * 1000;

    target.banReason =
        String(req.body.reason || "Kein Grund");

    saveUsers(users);

    /*
      Alle aktiven Sessions des gebannten Users löschen.
    */

    const sessions = getSessions().filter(
        s => s.userId !== target.id
    );

    saveSessions(sessions);

    addLog(
        "user_ban",
        req.user,
        {
            target: target.email,
            minutes,
            reason: target.banReason
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/unban", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    target.bannedUntil = null;
    target.banReason = null;

    saveUsers(users);

    addLog(
        "user_unban",
        req.user,
        {
            target: target.email
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 ADMIN BEWERBUNGEN
========================================================
*/

app.get("/admin/applications", requireAdmin, (req, res) => {
    const applications = getApplications();

    res.send(
        page(
            "Bewerbungen",
            req,
            `
            <div class="card">

                <h1>Bewerbungen</h1>

                ${
                    applications.length === 0
                    ? `<p class="muted">Keine Bewerbungen.</p>`
                    : `
                    <div class="table-wrap">

                    <table>

                        <tr>
                            <th>Nummer</th>
                            <th>User</th>
                            <th>Bereich</th>
                            <th>Details</th>
                            <th>Status</th>
                            <th>Aktion</th>
                        </tr>

                        ${applications.map(a => `
                            <tr>

                                <td>
                                    ${escapeHTML(a.number)}
                                </td>

                                <td>
                                    ${escapeHTML(a.username)}
                                </td>

                                <td>
                                    ${escapeHTML(a.type)}
                                </td>

                                <td>
                                    <strong>Discord:</strong>
                                    ${escapeHTML(a.discord)}
                                    <br><br>

                                    <strong>Alter:</strong>
                                    ${escapeHTML(a.age)}
                                    <br><br>

                                    <strong>Erfahrung:</strong>
                                    ${escapeHTML(a.experience)}
                                    <br><br>

                                    <strong>Motivation:</strong>
                                    ${escapeHTML(a.motivation)}
                                    <br><br>

                                    <strong>Warum:</strong>
                                    ${escapeHTML(a.reason)}
                                </td>

                                <td>
                                    ${escapeHTML(a.status)}
                                </td>

                                <td>

                                    ${
                                        a.status === "offen"
                                        ? `
                                        <form
                                            method="POST"
                                            action="/admin/application/status"
                                        >

                                            <input
                                                type="hidden"
                                                name="id"
                                                value="${escapeHTML(a.id)}"
                                            >

                                            <select name="status">

                                                <option value="angenommen">
                                                    Annehmen
                                                </option>

                                                <option value="abgelehnt">
                                                    Ablehnen
                                                </option>

                                            </select>

                                            <input
                                                name="reason"
                                                placeholder="Grund"
                                            >

                                            <button class="button">
                                                Speichern
                                            </button>

                                        </form>
                                        `
                                        : `
                                            <span class="muted">
                                                Bearbeitet
                                            </span>
                                        `
                                    }

                                </td>

                            </tr>
                        `).join("")}

                    </table>

                    </div>
                    `
                }

            </div>
            `
        )
    );
});

app.post("/admin/application/status", requireAdmin, (req, res) => {
    const applications = getApplications();

    const application = applications.find(
        a => a.id === req.body.id
    );

    if (!application) {
        return res.status(404).send(
            "Bewerbung nicht gefunden."
        );
    }

    const status = String(
        req.body.status || ""
    );

    if (
        status !== "angenommen" &&
        status !== "abgelehnt"
    ) {
        return res.status(400).send(
            "Ungültiger Status."
        );
    }

    application.status = status;
    application.reviewedBy = req.user.username;
    application.reviewedAt = new Date().toISOString();
    application.reviewReason =
        String(req.body.reason || "").trim();

    saveApplications(applications);

    addLog(
        "application_status",
        req.user,
        {
            application: application.number,
            status,
            reason: application.reviewReason
        }
    );

    res.redirect("/admin/applications");
});

/*
========================================================
 ADMIN CODES
========================================================
*/

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = getCodes();

    res.send(
        page(
            "Codes",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Coin-Code erstellen</h1>

                    <form method="POST" action="/admin/codes/create">

                        <label>Coins</label>

                        <input
                            type="number"
                            name="coins"
                            min="1"
                            value="100"
                            required
                        >

                        <label>Max. Benutzer</label>

                        <input
                            type="number"
                            name="maxUses"
                            min="1"
                            value="1"
                            required
                        >

                        <button class="button">
                            Code erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Vorhandene Codes</h2>

                    ${
                        codes.length === 0
                        ? `<p class="muted">Keine Codes.</p>`
                        : `
                        <div class="table-wrap">

                        <table>

                            <tr>
                                <th>Code</th>
                                <th>Coins</th>
                                <th>Nutzung</th>
                                <th>Status</th>
                            </tr>

                            ${codes.map(c => `
                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHTML(c.code)}
                                        </strong>
                                    </td>

                                    <td>
                                        ${Number(c.coins)}
                                    </td>

                                    <td>
                                        ${
                                            Array.isArray(c.usedBy)
                                            ? c.usedBy.length
                                            : 0
                                        }
                                        /
                                        ${Number(c.maxUses)}
                                    </td>

                                    <td>
                                        ${
                                            c.active !== false
                                            ? "Aktiv"
                                            : "Deaktiviert"
                                        }
                                    </td>

                                </tr>
                            `).join("")}

                        </table>

                        </div>
                        `
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/codes/create", requireAdmin, (req, res) => {
    const coins = Number(req.body.coins);
    const maxUses = Number(req.body.maxUses);

    if (
        !Number.isFinite(coins) ||
        coins < 1 ||
        !Number.isFinite(maxUses) ||
        maxUses < 1
    ) {
        return res.status(400).send(
            "Ungültige Werte."
        );
    }

    const codes = getCodes();

    const code = {
        id: id("code"),
        code: codeNumber(),
        coins: Math.floor(coins),
        maxUses: Math.floor(maxUses),
        usedBy: [],
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    };

    codes.push(code);

    saveCodes(codes);

    addLog(
        "code_create",
        req.user,
        {
            code: code.code,
            coins: code.coins,
            maxUses: code.maxUses
        }
    );

    res.redirect("/admin/codes");
});

/*
========================================================
 ADMIN SHOP
========================================================
*/

app.get("/admin/shop", requireAdmin, (req, res) => {
    const products = getShop();

    res.send(
        page(
            "Shop Verwaltung",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Produkt hinzufügen</h1>

                    <form method="POST" action="/admin/shop/create">

                        <label>Name</label>

                        <input
                            name="name"
                            required
                            maxlength="100"
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

                        <button class="button">
                            Produkt erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Produkte</h2>

                    ${
                        products.length === 0
                        ? `<p class="muted">Keine Produkte.</p>`
                        : products.map(p => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(p.name)}
                                </h3>

                                <p>
                                    ${escapeHTML(p.description || "")}
                                </p>

                                <strong>
                                    ${Number(p.price)} Coins
                                </strong>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/shop/create", requireAdmin, (req, res) => {
    const name = String(
        req.body.name || ""
    ).trim();

    const description = String(
        req.body.description || ""
    ).trim();

    const price = Number(req.body.price);

    if (
        !name ||
        !Number.isFinite(price) ||
        price < 1
    ) {
        return res.status(400).send(
            "Ungültige Produktdaten."
        );
    }

    const products = getShop();

    products.push({
        id: id("product"),
        name,
        slug: slugify(name),
        description,
        price: Math.floor(price),
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    });

    saveShop(products);

    addLog(
        "shop_product_create",
        req.user,
        {
            product: name
        }
    );

    res.redirect("/admin/shop");
});

/*
========================================================
 ADMIN GEWINNSPIELE
========================================================
*/

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = getGiveaways();

    res.send(
        page(
            "Gewinnspiele",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Gewinnspiel erstellen</h1>

                    <form
                        method="POST"
                        action="/admin/giveaways/create"
                    >

                        <label>Titel</label>

                        <input
                            name="title"
                            required
                        >

                        <label>Beschreibung</label>

                        <textarea
                            name="description"
                        ></textarea>

                        <label>Gewinn</label>

                        <input
                            name="prize"
                            required
                        >

                        <button class="button">
                            Erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Gewinnspiele</h2>

                    ${
                        giveaways.length === 0
                        ? `<p class="muted">Keine Gewinnspiele.</p>`
                        : giveaways.map(g => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(g.title)}
                                </h3>

                                <p>
                                    ${escapeHTML(g.description || "")}
                                </p>

                                <p>
                                    Gewinn:
                                    ${escapeHTML(g.prize || "")}
                                </p>

                                <p>
                                    Teilnehmer:
                                    ${
                                        Array.isArray(g.participants)
                                        ? g.participants.length
                                        : 0
                                    }
                                </p>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/giveaways/create", requireAdmin, (req, res) => {
    const title = String(
        req.body.title || ""
    ).trim();

    const description = String(
        req.body.description || ""
    ).trim();

    const prize = String(
        req.body.prize || ""
    ).trim();

    if (!title || !prize) {
        return res.status(400).send(
            "Titel und Gewinn sind erforderlich."
        );
    }

    const giveaways = getGiveaways();

    giveaways.push({
        id: id("giveaway"),
        title,
        description,
        prize,
        participants: [],
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    });

    saveGiveaways(giveaways);

    addLog(
        "giveaway_create",
        req.user,
        {
            title
        }
    );

    res.redirect("/admin/giveaways");
});

/*
========================================================
 ADMIN TICKETS
========================================================
*/

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = getTickets();

    res.send(
        page(
            "Ticketverwaltung",
            req,
            `
            <div class="card">

                <h1>Tickets</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Nummer</th>
                        <th>User</th>
                        <th>Betreff</th>
                        <th>Status</th>
                        <th>Übernommen</th>
                        <th></th>
                    </tr>

                    ${tickets.map(t => `
                        <tr>

                            <td>
                                ${escapeHTML(t.number)}
                            </td>

                            <td>
                                ${escapeHTML(t.username)}
                            </td>

                            <td>
                                ${escapeHTML(t.subject)}
                            </td>

                            <td>
                                ${escapeHTML(t.status)}
                            </td>

                            <td>
                                ${escapeHTML(t.claimedByName || "-")}
                            </td>

                            <td>
                                <a
                                    class="button secondary"
                                    href="/tickets/${encodeURIComponent(t.id)}"
                                >
                                    Öffnen
                                </a>
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN BESTELLUNGEN
========================================================
*/

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = getOrders();

    res.send(
        page(
            "Bestellungen",
            req,
            `
            <div class="card">

                <h1>Bestellungen</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Bestellnummer</th>
                        <th>User</th>
                        <th>Produkt</th>
                        <th>Preis</th>
                        <th>Status</th>
                        <th>Datum</th>
                    </tr>

                    ${orders.map(o => `
                        <tr>

                            <td>
                                ${escapeHTML(o.number)}
                            </td>

                            <td>
                                ${escapeHTML(o.username)}
                            </td>

                            <td>
                                ${escapeHTML(o.productName)}
                            </td>

                            <td>
                                ${Number(o.price)}
                            </td>

                            <td>
                                ${escapeHTML(o.status)}
                            </td>

                            <td>
                                ${new Date(o.createdAt).toLocaleString("de-DE")}
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN LOGS
========================================================
*/

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = getLogs();

    res.send(
        page(
            "Logs",
            req,
            `
            <div class="card">

                <h1>Logs</h1>

                <p class="muted">
                    Die letzten ${logs.length} Einträge.
                </p>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Zeit</th>
                        <th>Aktion</th>
                        <th>User</th>
                        <th>Details</th>
                    </tr>

                    ${logs.map(log => `
                        <tr>

                            <td>
                                ${new Date(log.createdAt).toLocaleString("de-DE")}
                            </td>

                            <td>
                                <span class="badge">
                                    ${escapeHTML(log.action)}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(log.userName)}
                            </td>

                            <td>
                                ${escapeHTML(
                                    JSON.stringify(log.details || {})
                                )}
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN WEBSEITE / WARTUNG / STÖRUNG / ANKÜNDIGUNG
========================================================
*/

app.get("/admin/settings", requireAdmin, (req, res) => {
    const settings = getSettings();

    res.send(
        page(
            "Webseite",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Wartung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/maintenance"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.maintenanceText)}</textarea>

                        <button
                            class="button"
                            name="enabled"
                            value="true"
                        >
                            Wartung aktivieren
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Wartung deaktivieren
                        </button>

                    </form>

                </div>

                <div class="card form">

                    <h1>Störung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/outage"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.outageText)}</textarea>

                        <button
                            class="button danger"
                            name="enabled"
                            value="true"
                        >
                            Störung aktivieren
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Störung deaktivieren
                        </button>

                    </form>

                </div>

                <div class="card form">

                    <h1>Ankündigung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/announcement"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.announcement)}</textarea>

                        <button
                            class="button"
                            name="enabled"
                            value="true"
                        >
                            Anzeigen
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Ausblenden
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post(
    "/admin/settings/maintenance",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.maintenance =
            req.body.enabled === "true";

        settings.maintenanceText =
            String(
                req.body.text ||
                "Die Webseite befindet sich momentan in Wartung."
            ).trim();

        saveSettings(settings);

        addLog(
            "maintenance_change",
            req.user,
            {
                enabled: settings.maintenance
            }
        );

        res.redirect("/admin/settings");
    }
);

app.post(
    "/admin/settings/outage",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.outage =
            req.body.enabled === "true";

        settings.outageText =
            String(
                req.body.text ||
                "Aktuell liegt eine Störung vor."
            ).trim();

        saveSettings(settings);

        addLog(
            "outage_change",
            req.user,
            {
                enabled: settings.outage
            }
        );

        res.redirect("/admin/settings");
    }
);

app.post(
    "/admin/settings/announcement",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.announcementEnabled =
            req.body.enabled === "true";

        settings.announcement =
            String(
                req.body.text || ""
            ).trim();

        saveSettings(settings);

        const announcements =
            getAnnouncements();

        announcements.unshift({
            id: id("announcement"),
            text: settings.announcement,
            enabled: settings.announcementEnabled,
            createdBy: req.user.username,
            createdAt: new Date().toISOString()
        });

        saveAnnouncements(
            announcements.slice(0, 100)
        );

        addLog(
            "announcement_change",
            req.user,
            {
                enabled:
                    settings.announcementEnabled
            }
        );

        res.redirect("/admin/settings");
    }
);

/*
========================================================
 ADMIN KICK
========================================================
*/

app.post("/admin/user/kick", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send(
            "User nicht gefunden."
        );
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        return res.status(403).send(
            "Owner kann nicht gekickt werden."
        );
    }

    target.kicked = true;

    saveUsers(users);

    const sessions = getSessions().filter(
        s => s.userId !== target.id
    );

    saveSessions(sessions);

    addLog(
        "user_kick",
        req.user,
        {
            target: target.email
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 404
========================================================
*/

app.use((req, res) => {
    res.status(404).send(
        page(
            "Nicht gefunden",
            req,
            `
            <div class="card center">

                <h1>404</h1>

                <p>
                    Diese Seite wurde nicht gefunden.
                </p>

                <a class="button" href="/">
                    Zur Startseite
                </a>

            </div>
            `
        )
    );
});

/*
========================================================
 ERROR HANDLER
========================================================
*/

app.use((err, req, res, next) => {
    console.error("Webseiten-Fehler:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send(
        page(
            "Fehler",
            req,
            `
            <div class="card">

                <h1>Fehler</h1>

                <p>
                    Bei der Verarbeitung ist ein Fehler aufgetreten.
                </p>

                <a class="button" href="/">
                    Zur Startseite
                </a>

            </div>
            `
        )
    );
});

/*
========================================================
 START
========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("======================================");
    console.log(" North Bot V2 Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port:", PORT);
    console.log("Discord:", DISCORD_INVITE);
    console.log("Owner:", OWNER_EMAIL);
    console.log("======================================");
});/*
========================================================
 NORTH BOT V2 - WEBSEITE
========================================================
 Benötigt:
   npm install express

 Start:
   node webseite.js

 Keine .env
 Keine express-session
 Daten werden automatisch als JSON gespeichert.

 Enthalten:
 - Registrierung / Login
 - Dauerhafter Login (30 Tage)
 - Profil bearbeiten
 - Rollen: owner / admin / manager / developer / moderator / user
 - Admin Panel
 - Benutzerverwaltung
 - Temporäre Bans
 - Kick
 - Wartung
 - Störung
 - Ankündigungen
 - Tickets
 - Bewerbungen
 - Coins
 - Daily Coins
 - Coin-Codes
 - Coin-Shop
 - Gewinnspiele
 - Team-Chat
 - User-Chat
 - Logs
 - Bestellungen
 - Beta-Nummern
 - Produktverwaltung
========================================================
*/

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";
const OWNER_EMAIL = "florianzustolberg@gmail.com";

/*
========================================================
 DATEIEN
========================================================
*/

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    sessions: path.join(DATA_DIR, "sessions.json"),
    applications: path.join(DATA_DIR, "applications.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    chats: path.join(DATA_DIR, "chats.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    announcements: path.join(DATA_DIR, "announcements.json")
};

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.sessions, []);
ensureFile(FILES.applications, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.chats, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    outage: false,
    outageText: "Aktuell liegt eine Störung vor.",
    announcement: "",
    announcementEnabled: false
});
ensureFile(FILES.announcements, []);

/*
========================================================
 JSON FUNKTIONEN
========================================================
*/

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
            return fallback;
        }

        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
            return fallback;
        }

        return JSON.parse(raw);
    } catch (err) {
        console.error("JSON-Fehler:", file, err.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getUsers() {
    return readJSON(FILES.users, []);
}

function saveUsers(data) {
    writeJSON(FILES.users, data);
}

function getTickets() {
    return readJSON(FILES.tickets, []);
}

function saveTickets(data) {
    writeJSON(FILES.tickets, data);
}

function getSessions() {
    return readJSON(FILES.sessions, []);
}

function saveSessions(data) {
    writeJSON(FILES.sessions, data);
}

function getApplications() {
    return readJSON(FILES.applications, []);
}

function saveApplications(data) {
    writeJSON(FILES.applications, data);
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

function getChats() {
    return readJSON(FILES.chats, []);
}

function saveChats(data) {
    writeJSON(FILES.chats, data);
}

function getLogs() {
    return readJSON(FILES.logs, []);
}

function saveLogs(data) {
    writeJSON(FILES.logs, data);
}

function getOrders() {
    return readJSON(FILES.orders, []);
}

function saveOrders(data) {
    writeJSON(FILES.orders, data);
}

function getSettings() {
    return readJSON(FILES.settings, {
        maintenance: false,
        maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
        outage: false,
        outageText: "Aktuell liegt eine Störung vor.",
        announcement: "",
        announcementEnabled: false
    });
}

function saveSettings(data) {
    writeJSON(FILES.settings, data);
}

function getAnnouncements() {
    return readJSON(FILES.announcements, []);
}

function saveAnnouncements(data) {
    writeJSON(FILES.announcements, data);
}

/*
========================================================
 EXPRESS
========================================================
*/

app.use(express.urlencoded({
    extended: true,
    limit: "2mb"
}));

app.use(express.json({
    limit: "2mb"
}));

/*
========================================================
 HILFSFUNKTIONEN
========================================================
*/

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function randomHex(bytes = 24) {
    return crypto.randomBytes(bytes).toString("hex");
}

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function id(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + randomHex(3);
}

function betaNumber() {
    return (
        "BETA-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function orderNumber() {
    return (
        "ORD-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function applicationNumber() {
    return (
        "APP-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function ticketNumber() {
    return (
        "TICKET-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function codeNumber() {
    return (
        "NORTH-" +
        randomNumber(1000, 9999) +
        "-" +
        randomNumber(1000, 9999)
    );
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9äöüß]+/gi, "-")
        .replace(/^-+|-+$/g, "");
}

/*
========================================================
 PASSWORT HASH
========================================================
*/

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .pbkdf2Sync(
            String(password),
            salt,
            120000,
            64,
            "sha512"
        )
        .toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(password, stored) {
    try {
        if (!stored || !stored.includes(":")) {
            return false;
        }

        const parts = stored.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const originalHash = parts[1];

        const newHash = crypto
            .pbkdf2Sync(
                String(password),
                salt,
                120000,
                64,
                "sha512"
            )
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(originalHash, "hex"),
            Buffer.from(newHash, "hex")
        );
    } catch {
        return false;
    }
}

/*
========================================================
 COOKIE
========================================================
*/

function parseCookies(req) {
    const header = req.headers.cookie || "";
    const cookies = {};

    header.split(";").forEach(part => {
        const index = part.indexOf("=");

        if (index === -1) return;

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();

        cookies[key] = decodeURIComponent(value);
    });

    return cookies;
}

function setLoginCookie(res, token) {
    const secure = process.env.NODE_ENV === "production"
        ? " Secure;"
        : "";

    res.setHeader(
        "Set-Cookie",
        "north_auth=" +
        encodeURIComponent(token) +
        "; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax;" +
        secure
    );
}

function clearLoginCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "north_auth=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
    );
}

/*
========================================================
 LOGIN
========================================================
*/

function getCurrentUser(req) {
    const cookies = parseCookies(req);
    const token = cookies.north_auth;

    if (!token) {
        return null;
    }

    const sessions = getSessions();

    const session = sessions.find(
        s =>
            s.token === token &&
            s.expiresAt > Date.now()
    );

    if (!session) {
        return null;
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === session.userId
    );

    if (!user) {
        return null;
    }

    if (user.bannedUntil && user.bannedUntil > Date.now()) {
        return {
            ...user,
            _banned: true
        };
    }

    return user;
}

function createSession(userId) {
    const sessions = getSessions();

    const token = randomHex(48);

    sessions.push({
        id: id("session"),
        token,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    writeJSON(
        FILES.sessions,
        sessions.filter(
            s => s.expiresAt > Date.now()
        )
    );

    return token;
}

function destroySession(req) {
    const cookies = parseCookies(req);

    if (!cookies.north_auth) {
        return;
    }

    const sessions = getSessions().filter(
        s => s.token !== cookies.north_auth
    );

    saveSessions(sessions);
}

/*
========================================================
 ROLLEN
========================================================
*/

const ADMIN_ROLES = [
    "owner",
    "admin",
    "manager"
];

const TEAM_ROLES = [
    "owner",
    "admin",
    "manager",
    "developer",
    "moderator"
];

function hasRole(user, roles) {
    if (!user) return false;

    return roles.includes(
        String(user.role || "").toLowerCase()
    );
}

function isAdmin(user) {
    return hasRole(user, ADMIN_ROLES);
}

function isTeam(user) {
    return hasRole(user, TEAM_ROLES);
}

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user._banned) {
        return res.redirect("/banned");
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                req,
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Du benötigst Administrator-Rechte.</p>
                    <a class="button" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    req.user = user;
    next();
}

function requireTeam(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isTeam(user)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                req,
                `
                <div class="card">
                    <h1>Kein Zugriff</h1>
                    <p>Dieser Bereich ist nur für das Team.</p>
                    <a class="button" href="/">Zurück</a>
                </div>
                `
            )
        );
    }

    req.user = user;
    next();
}

/*
========================================================
 LOG
========================================================
*/

function addLog(action, user, details = {}) {
    const logs = getLogs();

    logs.unshift({
        id: id("log"),
        action,
        userId: user ? user.id : null,
        userName: user ? user.username : "System",
        details,
        createdAt: new Date().toISOString()
    });

    if (logs.length > 5000) {
        logs.length = 5000;
    }

    saveLogs(logs);
}

/*
========================================================
 USER ERSTELLEN
========================================================
*/

function createUser(username, email, password, role = "user") {
    const users = getUsers();

    const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

    if (
        users.some(
            u =>
                String(u.email).toLowerCase() ===
                normalizedEmail
        )
    ) {
        return null;
    }

    const newUser = {
        id: id("user"),
        username: String(username).trim(),
        email: normalizedEmail,
        password: hashPassword(password),
        role,
        coins: 0,
        createdAt: new Date().toISOString(),
        lastDaily: null,
        bannedUntil: null,
        banReason: null,
        kicked: false,
        betaNumber: betaNumber()
    };

    users.push(newUser);

    saveUsers(users);

    return newUser;
}

/*
========================================================
 OWNER AUTOMATISCH ANLEGEN
========================================================
*/

function ensureOwner() {
    const users = getUsers();

    let owner = users.find(
        u =>
            String(u.email).toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
    );

    if (!owner) {
        owner = {
            id: id("user"),
            username: "Florian",
            email: OWNER_EMAIL,
            password: hashPassword("278263"),
            role: "owner",
            coins: 0,
            createdAt: new Date().toISOString(),
            lastDaily: null,
            bannedUntil: null,
            banReason: null,
            kicked: false,
            betaNumber: betaNumber()
        };

        users.push(owner);
        saveUsers(users);

        console.log(
            "Owner-Konto erstellt:",
            OWNER_EMAIL
        );
    } else {
        owner.role = "owner";
        saveUsers(users);
    }
}

ensureOwner();

/*
========================================================
 DESIGN
========================================================
*/

function page(title, req, content) {
    const user = req ? getCurrentUser(req) : null;
    const settings = getSettings();

    const maintenanceVisible =
        settings.maintenance &&
        (!user || !isAdmin(user));

    const outageVisible =
        settings.outage &&
        (!user || !isAdmin(user));

    let notices = "";

    if (maintenanceVisible) {
        notices += `
        <div class="notice warning">
            <strong>Wartung</strong>
            <span>${escapeHTML(settings.maintenanceText)}</span>
        </div>
        `;
    }

    if (outageVisible) {
        notices += `
        <div class="notice danger">
            <strong>Störung</strong>
            <span>${escapeHTML(settings.outageText)}</span>
        </div>
        `;
    }

    if (settings.announcementEnabled && settings.announcement) {
        notices += `
        <div class="notice info">
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
<title>${escapeHTML(title)} | North Bot</title>

<style>
* {
    box-sizing: border-box;
}

html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0d0f13;
    color: #e9edf2;
}

body {
    min-height: 100vh;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 64px;
    border-bottom: 1px solid #252932;
    background: #111318;
    display: flex;
    align-items: center;
    padding: 0 28px;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: .3px;
}

.nav-links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.nav-links a {
    padding: 8px 11px;
    border-radius: 7px;
    color: #aeb6c2;
    font-size: 14px;
}

.nav-links a:hover {
    background: #1b1f27;
    color: #fff;
}

.nav-right {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
}

.container {
    width: min(1150px, calc(100% - 32px));
    margin: 35px auto;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
}

.card {
    background: #15181e;
    border: 1px solid #272c35;
    border-radius: 10px;
    padding: 20px;
}

.card h1,
.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #8e98a6;
}

.button {
    display: inline-block;
    border: 0;
    background: #5865f2;
    color: white;
    border-radius: 7px;
    padding: 10px 15px;
    cursor: pointer;
    font-size: 14px;
}

.button:hover {
    filter: brightness(1.1);
}

.button.secondary {
    background: #252a33;
}

.button.danger {
    background: #c43c4b;
}

.button.success {
    background: #318a59;
}

input,
textarea,
select {
    width: 100%;
    background: #0e1014;
    border: 1px solid #303641;
    color: #fff;
    padding: 11px;
    border-radius: 7px;
    margin-top: 6px;
    margin-bottom: 13px;
    outline: none;
}

input:focus,
textarea:focus,
select:focus {
    border-color: #5865f2;
}

label {
    font-size: 13px;
    color: #aeb6c2;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

.form {
    max-width: 500px;
}

.center {
    text-align: center;
}

.notice {
    padding: 13px 16px;
    border-radius: 8px;
    margin-bottom: 15px;
    display: flex;
    gap: 12px;
    align-items: center;
    border: 1px solid #303641;
}

.notice.warning {
    background: #27200e;
    border-color: #695318;
}

.notice.danger {
    background: #291316;
    border-color: #6b2931;
}

.notice.info {
    background: #121c2e;
    border-color: #263f6a;
}

.stat {
    font-size: 30px;
    font-weight: 700;
    margin: 7px 0;
}

.small {
    font-size: 13px;
}

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 11px;
    border-bottom: 1px solid #292e36;
    vertical-align: top;
}

th {
    color: #8e98a6;
    font-size: 13px;
}

.badge {
    display: inline-block;
    background: #242932;
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 12px;
}

.badge.owner {
    background: #5b3510;
}

.badge.admin {
    background: #39215e;
}

.badge.manager {
    background: #173d54;
}

.badge.developer {
    background: #174d3b;
}

.badge.moderator {
    background: #49321a;
}

.chat {
    max-height: 450px;
    overflow-y: auto;
    border: 1px solid #292e36;
    padding: 12px;
    border-radius: 8px;
    background: #0e1014;
}

.message {
    padding: 10px;
    border-bottom: 1px solid #242831;
}

.message:last-child {
    border-bottom: 0;
}

.footer {
    border-top: 1px solid #252932;
    margin-top: 50px;
    padding: 30px;
    color: #737d8b;
    text-align: center;
}

.hero {
    padding: 50px 0;
}

.hero h1 {
    font-size: clamp(32px, 6vw, 56px);
    margin-bottom: 10px;
}

.hero p {
    color: #9da7b5;
    max-width: 650px;
    line-height: 1.6;
}

.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 15px;
}

hr {
    border: 0;
    border-top: 1px solid #292e36;
    margin: 22px 0;
}

.danger-text {
    color: #f07878;
}

.success-text {
    color: #66c994;
}

@media (max-width: 750px) {
    .nav {
        height: auto;
        padding: 14px;
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .nav-right {
        margin-left: 0;
    }

    .container {
        width: min(100% - 20px, 1150px);
        margin-top: 20px;
    }
}
</style>
</head>

<body>

<nav class="nav">

    <a class="logo" href="/">North Bot</a>

    <div class="nav-links">
        <a href="/">Start</a>

        ${
            user
            ? `
            <a href="/tickets">Tickets</a>
            <a href="/applications">Bewerbungen</a>
            <a href="/coins">Coins</a>
            <a href="/shop">Shop</a>
            <a href="/giveaways">Gewinnspiele</a>
            <a href="/chat">Chat</a>
            <a href="/profile">Profil</a>
            `
            : ""
        }

        ${
            user && isTeam(user)
            ? `<a href="/team-chat">Team-Chat</a>`
            : ""
        }

        ${
            user && isAdmin(user)
            ? `<a href="/admin">Admin</a>`
            : ""
        }
    </div>

    <div class="nav-right">
        ${
            user
            ? `
                <span class="small muted">
                    ${escapeHTML(user.username)}
                </span>
                <a class="button secondary" href="/logout">
                    Abmelden
                </a>
            `
            : `
                <a class="button secondary" href="/login">Login</a>
                <a class="button" href="/register">Registrieren</a>
            `
        }
    </div>

</nav>

<div class="container">

${notices}

${content}

</div>

<footer class="footer">
    North Bot V2 ·
    <a href="${DISCORD_INVITE}" target="_blank">
        Discord
    </a>
</footer>

</body>
</html>
`;
}

/*
========================================================
 HOME
========================================================
*/

app.get("/", (req, res) => {
    const user = getCurrentUser(req);

    if (user && user._banned) {
        return res.redirect("/banned");
    }

    res.send(
        page(
            "Start",
            req,
            `
            <section class="hero">

                <h1>North Bot</h1>

                <p>
                    Webseite für Community, Support,
                    Bewerbungen, Coins und Teamverwaltung.
                </p>

                <div class="actions">
                    ${
                        user
                        ? `
                            <a class="button" href="/tickets">
                                Support öffnen
                            </a>

                            <a class="button secondary" href="/profile">
                                Profil
                            </a>
                        `
                        : `
                            <a class="button" href="/register">
                                Konto erstellen
                            </a>

                            <a class="button secondary" href="/login">
                                Anmelden
                            </a>
                        `
                    }

                    <a
                        class="button secondary"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Discord
                    </a>
                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h3>Support</h3>
                    <p class="muted">
                        Erstelle ein Ticket und verwalte
                        deine Support-Anfragen.
                    </p>
                </div>

                <div class="card">
                    <h3>Coins</h3>
                    <p class="muted">
                        Sammle Coins, löse Codes ein
                        und kaufe Produkte.
                    </p>
                </div>

                <div class="card">
                    <h3>Bewerbungen</h3>
                    <p class="muted">
                        Bewirb dich als Moderator
                        oder Developer.
                    </p>
                </div>

                <div class="card">
                    <h3>Community</h3>
                    <p class="muted">
                        Chat, Gewinnspiele und
                        weitere Community-Systeme.
                    </p>
                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 REGISTER
========================================================
*/

app.get("/register", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        return res.redirect("/");
    }

    res.send(
        page(
            "Registrieren",
            req,
            `
            <div class="card form">

                <h1>Registrieren</h1>

                <p class="muted">
                    Erstelle dein North-Bot-Konto.
                </p>

                <form method="POST" action="/register">

                    <label>Benutzername</label>
                    <input
                        name="username"
                        required
                        minlength="2"
                        maxlength="32"
                        autocomplete="username"
                    >

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
                        minlength="6"
                        autocomplete="new-password"
                    >

                    <button class="button" type="submit">
                        Konto erstellen
                    </button>

                </form>

                <hr>

                <p class="small muted">
                    Bereits registriert?
                    <a href="/login">Jetzt anmelden</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (
        username.length < 2 ||
        username.length > 32 ||
        password.length < 6 ||
        !email.includes("@")
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                req,
                `
                <div class="card">
                    <h1>Registrierung fehlgeschlagen</h1>
                    <p>
                        Bitte überprüfe deine Angaben.
                    </p>
                    <a class="button" href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    const users = getUsers();

    if (
        users.some(
            u =>
                String(u.email).toLowerCase() === email
        )
    ) {
        return res.status(409).send(
            page(
                "Fehler",
                req,
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

    const newUser = createUser(
        username,
        email,
        password,
        "user"
    );

    if (!newUser) {
        return res.status(500).send("Registrierung fehlgeschlagen.");
    }

    addLog(
        "user_register",
        newUser,
        {
            email: newUser.email
        }
    );

    const token = createSession(newUser.id);

    setLoginCookie(res, token);

    res.redirect("/");
});

/*
========================================================
 LOGIN
========================================================
*/

app.get("/login", (req, res) => {
    const user = getCurrentUser(req);

    if (user && !user._banned) {
        return res.redirect("/");
    }

    res.send(
        page(
            "Login",
            req,
            `
            <div class="card form">

                <h1>Anmelden</h1>

                <p class="muted">
                    Du bleibst nach dem Login
                    30 Tage angemeldet.
                </p>

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

                    <button class="button" type="submit">
                        Anmelden
                    </button>

                </form>

                <hr>

                <p class="small muted">
                    Noch kein Konto?
                    <a href="/register">Registrieren</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    const users = getUsers();

    const user = users.find(
        u =>
            String(u.email).toLowerCase() === email
    );

    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).send(
            page(
                "Login",
                req,
                `
                <div class="card form">
                    <h1>Login fehlgeschlagen</h1>

                    <p class="danger-text">
                        E-Mail oder Passwort ist falsch.
                    </p>

                    <a class="button" href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (
        user.bannedUntil &&
        user.bannedUntil > Date.now()
    ) {
        return res.redirect("/banned");
    }

    if (
        user.bannedUntil &&
        user.bannedUntil <= Date.now()
    ) {
        user.bannedUntil = null;
        user.banReason = null;
        saveUsers(users);
    }

    user.kicked = false;
    saveUsers(users);

    const token = createSession(user.id);

    setLoginCookie(res, token);

    addLog(
        "login",
        user
    );

    res.redirect("/");
});

/*
========================================================
 LOGOUT
========================================================
*/

app.get("/logout", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        addLog(
            "logout",
            user
        );
    }

    destroySession(req);
    clearLoginCookie(res);

    res.redirect("/login");
});

/*
========================================================
 BANNED
========================================================
*/

app.get("/banned", (req, res) => {
    const user = getCurrentUser(req);

    if (!user || !user._banned) {
        return res.redirect("/");
    }

    const users = getUsers();

    const realUser = users.find(
        u => u.id === user.id
    );

    const until = realUser.bannedUntil
        ? new Date(realUser.bannedUntil).toLocaleString("de-DE")
        : "Unbekannt";

    res.send(
        page(
            "Gebannt",
            req,
            `
            <div class="card center">

                <h1>Account gesperrt</h1>

                <p>
                    Dein Zugang zur Webseite wurde
                    vorübergehend gesperrt.
                </p>

                <p class="muted">
                    Grund:
                    ${escapeHTML(realUser.banReason || "Kein Grund angegeben")}
                </p>

                <p class="muted">
                    Ende:
                    ${escapeHTML(until)}
                </p>

                <div class="actions" style="justify-content:center">

                    <a
                        class="button"
                        href="${DISCORD_INVITE}"
                        target="_blank"
                    >
                        Auf Discord gehen
                    </a>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 PROFIL
========================================================
*/

app.get("/profile", requireLogin, (req, res) => {
    const user = req.user;

    res.send(
        page(
            "Profil",
            req,
            `
            <div class="grid">

                <div class="card">

                    <h1>Profil</h1>

                    <p>
                        <strong>Name:</strong>
                        ${escapeHTML(user.username)}
                    </p>

                    <p>
                        <strong>E-Mail:</strong>
                        ${escapeHTML(user.email)}
                    </p>

                    <p>
                        <strong>Rolle:</strong>
                        <span class="badge ${escapeHTML(user.role)}">
                            ${escapeHTML(user.role)}
                        </span>
                    </p>

                    <p>
                        <strong>Coins:</strong>
                        ${Number(user.coins || 0)}
                    </p>

                    <p>
                        <strong>Beta-Nummer:</strong>
                        ${escapeHTML(user.betaNumber || "-")}
                    </p>

                </div>

                <div class="card form">

                    <h2>Profil bearbeiten</h2>

                    <form method="POST" action="/profile">

                        <label>Benutzername</label>

                        <input
                            name="username"
                            value="${escapeHTML(user.username)}"
                            required
                            minlength="2"
                            maxlength="32"
                        >

                        <label>Neue E-Mail</label>

                        <input
                            type="email"
                            name="email"
                            value="${escapeHTML(user.email)}"
                            required
                        >

                        <label>
                            Neues Passwort
                            <span class="muted">
                                (leer lassen = unverändert)
                            </span>
                        </label>

                        <input
                            type="password"
                            name="password"
                            minlength="6"
                        >

                        <button class="button" type="submit">
                            Speichern
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post("/profile", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/logout");
    }

    const username = String(
        req.body.username || user.username
    ).trim();

    const email = String(
        req.body.email || user.email
    ).trim().toLowerCase();

    const password = String(
        req.body.password || ""
    );

    if (username.length < 2) {
        return res.status(400).send("Name zu kurz.");
    }

    const emailTaken = users.some(
        u =>
            u.id !== user.id &&
            String(u.email).toLowerCase() === email
    );

    if (emailTaken) {
        return res.status(409).send(
            "Diese E-Mail wird bereits verwendet."
        );
    }

    user.username = username;
    user.email = email;

    if (password) {
        user.password = hashPassword(password);
    }

    saveUsers(users);

    addLog(
        "profile_update",
        user
    );

    res.redirect("/profile");
});

/*
========================================================
 TICKETS
========================================================
*/

app.get("/tickets", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ownTickets = tickets
        .filter(
            t =>
                t.userId === req.user.id ||
                isAdmin(req.user) ||
                isTeam(req.user)
        )
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

    res.send(
        page(
            "Tickets",
            req,
            `
            <div class="card">

                <h1>Support</h1>

                <p class="muted">
                    Erstelle ein Support-Ticket.
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
                        maxlength="5000"
                        required
                    ></textarea>

                    <button class="button" type="submit">
                        Ticket erstellen
                    </button>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>Meine Tickets</h2>

                ${
                    ownTickets.length === 0
                    ? `
                        <p class="muted">
                            Noch keine Tickets.
                        </p>
                    `
                    : `
                        <div class="table-wrap">

                        <table>

                            <tr>
                                <th>Nummer</th>
                                <th>Betreff</th>
                                <th>Status</th>
                                <th>Erstellt</th>
                                <th></th>
                            </tr>

                            ${ownTickets.map(t => `
                                <tr>

                                    <td>
                                        ${escapeHTML(t.number)}
                                    </td>

                                    <td>
                                        ${escapeHTML(t.subject)}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHTML(t.status)}
                                        </span>
                                    </td>

                                    <td>
                                        ${new Date(t.createdAt).toLocaleString("de-DE")}
                                    </td>

                                    <td>
                                        <a
                                            class="button secondary"
                                            href="/tickets/${encodeURIComponent(t.id)}"
                                        >
                                            Öffnen
                                        </a>
                                    </td>

                                </tr>
                            `).join("")}

                        </table>

                        </div>
                    `
                }

            </div>
            `
        )
    );
});

app.post("/tickets/create", requireLogin, (req, res) => {
    const subject = String(
        req.body.subject || ""
    ).trim();

    const message = String(
        req.body.message || ""
    ).trim();

    if (!subject || !message) {
        return res.status(400).send(
            "Betreff und Nachricht fehlen."
        );
    }

    const ticket = {
        id: id("ticket"),
        number: ticketNumber(),
        userId: req.user.id,
        username: req.user.username,
        subject,
        message,
        status: "offen",
        claimedBy: null,
        claimedByName: null,
        createdAt: new Date().toISOString(),
        closedAt: null,
        messages: [
            {
                id: id("message"),
                userId: req.user.id,
                username: req.user.username,
                message,
                createdAt: new Date().toISOString()
            }
        ]
    };

    const tickets = getTickets();

    tickets.push(ticket);

    saveTickets(tickets);

    addLog(
        "ticket_create",
        req.user,
        {
            ticket: ticket.number
        }
    );

    /*
      Der Bot kann tickets.json überwachen und daraus
      den Discord-Ticketkanal erstellen.
    */

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Ticket nicht gefunden.");
    }

    const allowed =
        ticket.userId === req.user.id ||
        isTeam(req.user);

    if (!allowed) {
        return res.status(403).send("Kein Zugriff.");
    }

    res.send(
        page(
            ticket.number,
            req,
            `
            <div class="card">

                <h1>
                    ${escapeHTML(ticket.subject)}
                </h1>

                <p class="muted">
                    ${escapeHTML(ticket.number)}
                </p>

                <p>
                    Status:
                    <span class="badge">
                        ${escapeHTML(ticket.status)}
                    </span>
                </p>

                ${
                    ticket.claimedByName
                    ? `
                        <p class="small">
                            Übernommen von:
                            <strong>
                                ${escapeHTML(ticket.claimedByName)}
                            </strong>
                        </p>
                    `
                    : ""
                }

                <div class="chat">

                    ${ticket.messages.map(m => `
                        <div class="message">

                            <strong>
                                ${escapeHTML(m.username)}
                            </strong>

                            <span class="muted small">
                                ${new Date(m.createdAt).toLocaleString("de-DE")}
                            </span>

                            <div>
                                ${escapeHTML(m.message)}
                            </div>

                        </div>
                    `).join("")}

                </div>

                ${
                    ticket.status !== "geschlossen"
                    ? `
                    <form method="POST" action="/tickets/${encodeURIComponent(ticket.id)}/message">

                        <label>Antwort</label>

                        <textarea
                            name="message"
                            required
                            maxlength="5000"
                        ></textarea>

                        <button class="button" type="submit">
                            Senden
                        </button>

                    </form>
                    `
                    : `
                    <p class="muted">
                        Dieses Ticket ist geschlossen.
                    </p>
                    `
                }

                ${
                    isTeam(req.user) &&
                    ticket.status !== "geschlossen"
                    ? `
                    <hr>

                    <div class="actions">

                        ${
                            ticket.claimedBy
                            ? `
                                <form
                                    method="POST"
                                    action="/tickets/${encodeURIComponent(ticket.id)}/unclaim"
                                >
                                    <button class="button secondary">
                                        Nicht übernehmen
                                    </button>
                                </form>
                            `
                            : `
                                <form
                                    method="POST"
                                    action="/tickets/${encodeURIComponent(ticket.id)}/claim"
                                >
                                    <button class="button">
                                        Übernehmen
                                    </button>
                                </form>
                            `
                        }

                        <form
                            method="POST"
                            action="/tickets/${encodeURIComponent(ticket.id)}/close"
                        >
                            <button class="button danger">
                                Schließen
                            </button>
                        </form>

                    </div>
                    `
                    : ""
                }

            </div>
            `
        )
    );
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        ticket.userId !== req.user.id &&
        !isTeam(req.user)
    ) {
        return res.status(403).send("Kein Zugriff.");
    }

    if (ticket.status === "geschlossen") {
        return res.status(400).send("Ticket geschlossen.");
    }

    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect(
            "/tickets/" +
            encodeURIComponent(ticket.id)
        );
    }

    ticket.messages.push({
        id: id("message"),
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    saveTickets(tickets);

    addLog(
        "ticket_message",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/claim", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.claimedBy = req.user.id;
    ticket.claimedByName = req.user.username;

    saveTickets(tickets);

    addLog(
        "ticket_claim",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/unclaim", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.claimedBy = null;
    ticket.claimedByName = null;

    saveTickets(tickets);

    addLog(
        "ticket_unclaim",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

app.post("/tickets/:id/close", requireTeam, (req, res) => {
    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden.");
    }

    ticket.status = "geschlossen";
    ticket.closedAt = new Date().toISOString();

    saveTickets(tickets);

    addLog(
        "ticket_close",
        req.user,
        {
            ticket: ticket.number
        }
    );

    res.redirect(
        "/tickets/" +
        encodeURIComponent(ticket.id)
    );
});

/*
========================================================
 BEWERBUNGEN
========================================================
*/

app.get("/applications", requireLogin, (req, res) => {
    const applications = getApplications();

    const own = applications.filter(
        a => a.userId === req.user.id
    );

    res.send(
        page(
            "Bewerbungen",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Bewerbung</h1>

                    <form method="POST" action="/applications">

                        <label>Bereich</label>

                        <select name="type" required>

                            <option value="moderator">
                                Moderator
                            </option>

                            <option value="developer">
                                Developer
                            </option>

                        </select>

                        <label>Discord-Name / ID</label>

                        <input
                            name="discord"
                            required
                            maxlength="100"
                        >

                        <label>Alter</label>

                        <input
                            name="age"
                            type="number"
                            min="1"
                            max="100"
                            required
                        >

                        <label>Erfahrung</label>

                        <textarea
                            name="experience"
                            required
                        ></textarea>

                        <label>Warum möchtest du ins Team?</label>

                        <textarea
                            name="motivation"
                            required
                        ></textarea>

                        <label>Warum sollten wir dich nehmen?</label>

                        <textarea
                            name="reason"
                            required
                        ></textarea>

                        <button class="button" type="submit">
                            Bewerbung absenden
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Meine Bewerbungen</h2>

                    ${
                        own.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Bewerbung.
                            </p>
                        `
                        : own.map(a => `
                            <div class="card">

                                <strong>
                                    ${escapeHTML(a.number)}
                                </strong>

                                <p>
                                    ${escapeHTML(a.type)}
                                </p>

                                <span class="badge">
                                    ${escapeHTML(a.status)}
                                </span>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/applications", requireLogin, (req, res) => {
    const type = String(
        req.body.type || ""
    ).trim().toLowerCase();

    if (
        type !== "moderator" &&
        type !== "developer"
    ) {
        return res.status(400).send("Ungültiger Bereich.");
    }

    const application = {
        id: id("application"),
        number: applicationNumber(),
        userId: req.user.id,
        username: req.user.username,
        type,
        discord: String(req.body.discord || "").trim(),
        age: String(req.body.age || "").trim(),
        experience: String(req.body.experience || "").trim(),
        motivation: String(req.body.motivation || "").trim(),
        reason: String(req.body.reason || "").trim(),
        status: "offen",
        createdAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null
    };

    const applications = getApplications();

    applications.push(application);

    saveApplications(applications);

    addLog(
        "application_create",
        req.user,
        {
            application: application.number,
            type
        }
    );

    res.redirect("/applications");
});

/*
========================================================
 COINS
========================================================
*/

app.get("/coins", requireLogin, (req, res) => {
    const user = req.user;

    const canDaily =
        !user.lastDaily ||
        Date.now() - new Date(user.lastDaily).getTime()
        >= 14 * 60 * 60 * 1000;

    res.send(
        page(
            "Coins",
            req,
            `
            <div class="grid">

                <div class="card">

                    <h1>Coins</h1>

                    <div class="stat">
                        ${Number(user.coins || 0)}
                    </div>

                    <p class="muted">
                        Dein aktueller Kontostand.
                    </p>

                </div>

                <div class="card">

                    <h2>Daily</h2>

                    <p>
                        Alle 14 Stunden bekommst du
                        <strong>100 Coins</strong>.
                    </p>

                    ${
                        canDaily
                        ? `
                            <form method="POST" action="/coins/daily">

                                <button class="button" type="submit">
                                    100 Coins abholen
                                </button>

                            </form>
                        `
                        : `
                            <p class="muted">
                                Daily bereits abgeholt.
                            </p>
                        `
                    }

                </div>

                <div class="card">

                    <h2>Code einlösen</h2>

                    <form method="POST" action="/coins/redeem">

                        <input
                            name="code"
                            placeholder="NORTH-1234-5678"
                            required
                        >

                        <button class="button" type="submit">
                            Einlösen
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post("/coins/daily", requireLogin, (req, res) => {
    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    if (
        user.lastDaily &&
        Date.now() -
        new Date(user.lastDaily).getTime()
        < 14 * 60 * 60 * 1000
    ) {
        return res.redirect("/coins");
    }

    user.coins = Number(user.coins || 0) + 100;
    user.lastDaily = new Date().toISOString();

    saveUsers(users);

    addLog(
        "daily_coins",
        user,
        {
            amount: 100
        }
    );

    res.redirect("/coins");
});

app.post("/coins/redeem", requireLogin, (req, res) => {
    const entered = String(
        req.body.code || ""
    ).trim().toUpperCase();

    const codes = getCodes();

    const code = codes.find(
        c =>
            String(c.code).toUpperCase() === entered &&
            c.active !== false
    );

    if (!code) {
        return res.status(400).send(
            page(
                "Code",
                req,
                `
                <div class="card">
                    <h1>Code ungültig</h1>
                    <p>
                        Dieser Code existiert nicht
                        oder ist deaktiviert.
                    </p>
                    <a class="button" href="/coins">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    if (
        code.expiresAt &&
        new Date(code.expiresAt).getTime() < Date.now()
    ) {
        return res.status(400).send(
            "Dieser Code ist abgelaufen."
        );
    }

    if (!Array.isArray(code.usedBy)) {
        code.usedBy = [];
    }

    if (code.usedBy.includes(req.user.id)) {
        return res.status(400).send(
            "Du hast diesen Code bereits verwendet."
        );
    }

    if (
        code.maxUses &&
        code.usedBy.length >= Number(code.maxUses)
    ) {
        return res.status(400).send(
            "Dieser Code wurde bereits zu oft verwendet."
        );
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    const amount = Number(code.coins || 0);

    user.coins = Number(user.coins || 0) + amount;

    code.usedBy.push(user.id);

    saveUsers(users);
    saveCodes(codes);

    addLog(
        "code_redeem",
        user,
        {
            code: code.code,
            coins: amount
        }
    );

    res.redirect("/coins");
});

/*
========================================================
 SHOP
========================================================
*/

app.get("/shop", requireLogin, (req, res) => {
    const products = getShop()
        .filter(p => p.active !== false);

    res.send(
        page(
            "Shop",
            req,
            `
            <div class="card">

                <h1>Coins-Shop</h1>

                <p class="muted">
                    Coins: ${Number(req.user.coins || 0)}
                </p>

            </div>

            <br>

            <div class="grid">

                ${
                    products.length === 0
                    ? `
                        <div class="card">
                            <p class="muted">
                                Noch keine Produkte.
                            </p>
                        </div>
                    `
                    : products.map(p => `
                        <div class="card">

                            <h2>
                                ${escapeHTML(p.name)}
                            </h2>

                            <p class="muted">
                                ${escapeHTML(p.description || "")}
                            </p>

                            <strong>
                                ${Number(p.price)} Coins
                            </strong>

                            <div class="actions">

                                <form
                                    method="POST"
                                    action="/shop/buy"
                                >

                                    <input
                                        type="hidden"
                                        name="productId"
                                        value="${escapeHTML(p.id)}"
                                    >

                                    <button
                                        class="button"
                                        type="submit"
                                    >
                                        Kaufen
                                    </button>

                                </form>

                            </div>

                        </div>
                    `).join("")
                }

            </div>
            `
        )
    );
});

app.post("/shop/buy", requireLogin, (req, res) => {
    const products = getShop();

    const product = products.find(
        p =>
            p.id === req.body.productId &&
            p.active !== false
    );

    if (!product) {
        return res.status(404).send(
            "Produkt nicht gefunden."
        );
    }

    const users = getUsers();

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!user) {
        return res.redirect("/login");
    }

    const price = Number(product.price || 0);

    if (Number(user.coins || 0) < price) {
        return res.status(400).send(
            page(
                "Shop",
                req,
                `
                <div class="card">
                    <h1>Nicht genug Coins</h1>
                    <p>
                        Du benötigst ${price} Coins.
                    </p>
                    <a class="button" href="/shop">
                        Zurück zum Shop
                    </a>
                </div>
                `
            )
        );
    }

    user.coins -= price;

    const order = {
        id: id("order"),
        number: orderNumber(),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.name,
        price,
        status: "offen",
        createdAt: new Date().toISOString()
    };

    const orders = getOrders();

    orders.push(order);

    saveUsers(users);
    saveOrders(orders);

    addLog(
        "shop_purchase",
        user,
        {
            order: order.number,
            product: product.name,
            price
        }
    );

    res.send(
        page(
            "Bestellung",
            req,
            `
            <div class="card center">

                <h1>Bestellung erstellt</h1>

                <p>
                    Deine Bestellung wurde gespeichert.
                </p>

                <p>
                    Bestellnummer:
                </p>

                <h2>
                    ${escapeHTML(order.number)}
                </h2>

                <p class="muted">
                    Diese Nummer kannst du dem Team
                    auf Discord geben.
                </p>

                <a
                    class="button"
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

/*
========================================================
 GEWINNSPIELE
========================================================
*/

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = getGiveaways()
        .filter(g => g.active !== false);

    res.send(
        page(
            "Gewinnspiele",
            req,
            `
            <div class="card">

                <h1>Gewinnspiele</h1>

                <p class="muted">
                    Nimm an laufenden Gewinnspielen teil.
                </p>

            </div>

            <br>

            <div class="grid">

                ${
                    giveaways.length === 0
                    ? `
                        <div class="card">
                            <p class="muted">
                                Momentan läuft kein Gewinnspiel.
                            </p>
                        </div>
                    `
                    : giveaways.map(g => {

                        const joined =
                            Array.isArray(g.participants) &&
                            g.participants.includes(req.user.id);

                        return `
                        <div class="card">

                            <h2>
                                ${escapeHTML(g.title)}
                            </h2>

                            <p>
                                ${escapeHTML(g.description || "")}
                            </p>

                            <p>
                                Preis:
                                <strong>
                                    ${escapeHTML(g.prize || "-")}
                                </strong>
                            </p>

                            ${
                                joined
                                ? `
                                    <span class="badge">
                                        Teilnahme gespeichert
                                    </span>
                                `
                                : `
                                    <form
                                        method="POST"
                                        action="/giveaways/join"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(g.id)}"
                                        >

                                        <button
                                            class="button"
                                            type="submit"
                                        >
                                            Teilnehmen
                                        </button>

                                    </form>
                                `
                            }

                        </div>
                        `;
                    }).join("")
                }

            </div>
            `
        )
    );
});

app.post("/giveaways/join", requireLogin, (req, res) => {
    const giveaways = getGiveaways();

    const giveaway = giveaways.find(
        g =>
            g.id === req.body.id &&
            g.active !== false
    );

    if (!giveaway) {
        return res.status(404).send(
            "Gewinnspiel nicht gefunden."
        );
    }

    if (!Array.isArray(giveaway.participants)) {
        giveaway.participants = [];
    }

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);
        saveGiveaways(giveaways);

        addLog(
            "giveaway_join",
            req.user,
            {
                giveaway: giveaway.title
            }
        );
    }

    res.redirect("/giveaways");
});

/*
========================================================
 USER CHAT
========================================================
*/

app.get("/chat", requireLogin, (req, res) => {
    const chats = getChats()
        .filter(c => c.type === "public")
        .slice(-100);

    res.send(
        page(
            "Chat",
            req,
            `
            <div class="card">

                <h1>Community Chat</h1>

                <div class="chat">

                    ${
                        chats.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Nachrichten.
                            </p>
                        `
                        : chats.map(m => `
                            <div class="message">

                                <strong>
                                    ${escapeHTML(m.username)}
                                </strong>

                                <span class="muted small">
                                    ${new Date(m.createdAt).toLocaleString("de-DE")}
                                </span>

                                <div>
                                    ${escapeHTML(m.message)}
                                </div>

                            </div>
                        `).join("")
                    }

                </div>

                <br>

                <form method="POST" action="/chat">

                    <textarea
                        name="message"
                        required
                        maxlength="1000"
                        placeholder="Nachricht schreiben..."
                    ></textarea>

                    <button class="button">
                        Senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post("/chat", requireLogin, (req, res) => {
    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect("/chat");
    }

    const chats = getChats();

    chats.push({
        id: id("chat"),
        type: "public",
        userId: req.user.id,
        username: req.user.username,
        message,
        createdAt: new Date().toISOString()
    });

    if (chats.length > 5000) {
        chats.splice(0, chats.length - 5000);
    }

    saveChats(chats);

    addLog(
        "public_chat",
        req.user
    );

    res.redirect("/chat");
});

/*
========================================================
 TEAM CHAT
========================================================
*/

app.get("/team-chat", requireTeam, (req, res) => {
    const chats = getChats()
        .filter(c => c.type === "team")
        .slice(-100);

    res.send(
        page(
            "Team Chat",
            req,
            `
            <div class="card">

                <h1>Team-Chat</h1>

                <p class="muted">
                    Nur Owner, Admin, Manager,
                    Developer und Moderator.
                </p>

                <div class="chat">

                    ${
                        chats.length === 0
                        ? `
                            <p class="muted">
                                Noch keine Nachrichten.
                            </p>
                        `
                        : chats.map(m => `
                            <div class="message">

                                <strong>
                                    ${escapeHTML(m.username)}
                                </strong>

                                <span class="badge">
                                    ${escapeHTML(m.role || "")}
                                </span>

                                <span class="muted small">
                                    ${new Date(m.createdAt).toLocaleString("de-DE")}
                                </span>

                                <div>
                                    ${escapeHTML(m.message)}
                                </div>

                            </div>
                        `).join("")
                    }

                </div>

                <br>

                <form method="POST" action="/team-chat">

                    <textarea
                        name="message"
                        required
                        maxlength="2000"
                    ></textarea>

                    <button class="button">
                        Senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post("/team-chat", requireTeam, (req, res) => {
    const message = String(
        req.body.message || ""
    ).trim();

    if (!message) {
        return res.redirect("/team-chat");
    }

    const chats = getChats();

    chats.push({
        id: id("teamchat"),
        type: "team",
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        message,
        createdAt: new Date().toISOString()
    });

    if (chats.length > 5000) {
        chats.splice(0, chats.length - 5000);
    }

    saveChats(chats);

    addLog(
        "team_chat",
        req.user
    );

    res.redirect("/team-chat");
});

/*
========================================================
 ADMIN DASHBOARD
========================================================
*/

app.get("/admin", requireAdmin, (req, res) => {
    const users = getUsers();
    const tickets = getTickets();
    const applications = getApplications();
    const codes = getCodes();
    const products = getShop();
    const giveaways = getGiveaways();
    const logs = getLogs();
    const orders = getOrders();

    res.send(
        page(
            "Admin Panel",
            req,
            `
            <div class="card">

                <h1>Admin Panel</h1>

                <p class="muted">
                    Willkommen,
                    ${escapeHTML(req.user.username)}.
                </p>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h3>Benutzer</h3>
                    <div class="stat">${users.length}</div>
                </div>

                <div class="card">
                    <h3>Tickets</h3>
                    <div class="stat">${tickets.length}</div>
                </div>

                <div class="card">
                    <h3>Bewerbungen</h3>
                    <div class="stat">${applications.length}</div>
                </div>

                <div class="card">
                    <h3>Codes</h3>
                    <div class="stat">${codes.length}</div>
                </div>

                <div class="card">
                    <h3>Produkte</h3>
                    <div class="stat">${products.length}</div>
                </div>

                <div class="card">
                    <h3>Gewinnspiele</h3>
                    <div class="stat">${giveaways.length}</div>
                </div>

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="stat">${orders.length}</div>
                </div>

                <div class="card">
                    <h3>Logs</h3>
                    <div class="stat">${logs.length}</div>
                </div>

            </div>

            <br>

            <div class="grid">

                <div class="card">
                    <h2>Verwaltung</h2>

                    <div class="actions">
                        <a class="button" href="/admin/users">
                            Benutzer
                        </a>

                        <a class="button" href="/admin/applications">
                            Bewerbungen
                        </a>

                        <a class="button" href="/admin/tickets">
                            Tickets
                        </a>

                        <a class="button" href="/admin/codes">
                            Codes
                        </a>

                        <a class="button" href="/admin/shop">
                            Shop
                        </a>

                        <a class="button" href="/admin/giveaways">
                            Gewinnspiele
                        </a>

                        <a class="button" href="/admin/orders">
                            Bestellungen
                        </a>

                        <a class="button" href="/admin/logs">
                            Logs
                        </a>

                        <a class="button" href="/admin/settings">
                            Webseite
                        </a>
                    </div>

                </div>

                <div class="card">

                    <h2>Systemstatus</h2>

                    <p>
                        Wartung:
                        ${
                            getSettings().maintenance
                            ? `<span class="badge">AN</span>`
                            : `<span class="badge">AUS</span>`
                        }
                    </p>

                    <p>
                        Störung:
                        ${
                            getSettings().outage
                            ? `<span class="badge">AN</span>`
                            : `<span class="badge">AUS</span>`
                        }
                    </p>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN USERS
========================================================
*/

app.get("/admin/users", requireAdmin, (req, res) => {
    const users = getUsers();

    res.send(
        page(
            "Benutzer",
            req,
            `
            <div class="card">

                <h1>Benutzerverwaltung</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Coins</th>
                        <th>Ban</th>
                        <th>Aktionen</th>
                    </tr>

                    ${users.map(u => `
                        <tr>

                            <td>
                                ${escapeHTML(u.username)}
                            </td>

                            <td>
                                ${escapeHTML(u.email)}
                            </td>

                            <td>
                                <span class="badge ${escapeHTML(u.role)}">
                                    ${escapeHTML(u.role)}
                                </span>
                            </td>

                            <td>
                                ${Number(u.coins || 0)}
                            </td>

                            <td>
                                ${
                                    u.bannedUntil &&
                                    u.bannedUntil > Date.now()
                                    ? `
                                        bis
                                        ${new Date(u.bannedUntil).toLocaleString("de-DE")}
                                    `
                                    : "Nein"
                                }
                            </td>

                            <td>

                                <form
                                    method="POST"
                                    action="/admin/user/role"
                                    style="margin-bottom:7px"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(u.id)}"
                                    >

                                    <select name="role">

                                        <option value="user" ${u.role === "user" ? "selected" : ""}>
                                            user
                                        </option>

                                        <option value="moderator" ${u.role === "moderator" ? "selected" : ""}>
                                            moderator
                                        </option>

                                        <option value="developer" ${u.role === "developer" ? "selected" : ""}>
                                            developer
                                        </option>

                                        <option value="manager" ${u.role === "manager" ? "selected" : ""}>
                                            manager
                                        </option>

                                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>
                                            admin
                                        </option>

                                        <option value="owner" ${u.role === "owner" ? "selected" : ""}>
                                            owner
                                        </option>

                                    </select>

                                    <button class="button secondary">
                                        Rolle
                                    </button>

                                </form>

                                <form
                                    method="POST"
                                    action="/admin/user/coins"
                                    style="margin-bottom:7px"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(u.id)}"
                                    >

                                    <input
                                        name="coins"
                                        type="number"
                                        placeholder="Coins"
                                    >

                                    <button class="button secondary">
                                        Coins setzen
                                    </button>

                                </form>

                                ${
                                    u.email.toLowerCase() !==
                                    OWNER_EMAIL.toLowerCase()
                                    ? `
                                    <form
                                        method="POST"
                                        action="/admin/user/ban"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(u.id)}"
                                        >

                                        <input
                                            name="minutes"
                                            type="number"
                                            min="1"
                                            placeholder="Minuten"
                                            required
                                        >

                                        <input
                                            name="reason"
                                            placeholder="Grund"
                                            required
                                        >

                                        <button
                                            class="button danger"
                                            type="submit"
                                        >
                                            Ban
                                        </button>

                                    </form>

                                    <form
                                        method="POST"
                                        action="/admin/user/unban"
                                        style="margin-top:7px"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${escapeHTML(u.id)}"
                                        >

                                        <button
                                            class="button success"
                                            type="submit"
                                        >
                                            Unban
                                        </button>

                                    </form>
                                    `
                                    : `
                                        <span class="muted small">
                                            Owner geschützt
                                        </span>
                                    `
                                }

                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/user/role", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("User nicht gefunden.");
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        target.role = "owner";
    } else {
        const allowed = [
            "user",
            "moderator",
            "developer",
            "manager",
            "admin",
            "owner"
        ];

        if (!allowed.includes(req.body.role)) {
            return res.status(400).send("Ungültige Rolle.");
        }

        target.role = req.body.role;
    }

    saveUsers(users);

    addLog(
        "user_role",
        req.user,
        {
            target: target.email,
            role: target.role
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/coins", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    const coins = Number(req.body.coins);

    if (!Number.isFinite(coins) || coins < 0) {
        return res.status(400).send("Ungültige Coins.");
    }

    target.coins = Math.floor(coins);

    saveUsers(users);

    addLog(
        "admin_coins_set",
        req.user,
        {
            target: target.email,
            coins: target.coins
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/ban", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        return res.status(403).send(
            "Der Owner kann nicht gebannt werden."
        );
    }

    const minutes = Number(req.body.minutes);

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {
        return res.status(400).send(
            "Ungültige Dauer."
        );
    }

    target.bannedUntil =
        Date.now() +
        minutes * 60 * 1000;

    target.banReason =
        String(req.body.reason || "Kein Grund");

    saveUsers(users);

    /*
      Alle aktiven Sessions des gebannten Users löschen.
    */

    const sessions = getSessions().filter(
        s => s.userId !== target.id
    );

    saveSessions(sessions);

    addLog(
        "user_ban",
        req.user,
        {
            target: target.email,
            minutes,
            reason: target.banReason
        }
    );

    res.redirect("/admin/users");
});

app.post("/admin/user/unban", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send("Nicht gefunden.");
    }

    target.bannedUntil = null;
    target.banReason = null;

    saveUsers(users);

    addLog(
        "user_unban",
        req.user,
        {
            target: target.email
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 ADMIN BEWERBUNGEN
========================================================
*/

app.get("/admin/applications", requireAdmin, (req, res) => {
    const applications = getApplications();

    res.send(
        page(
            "Bewerbungen",
            req,
            `
            <div class="card">

                <h1>Bewerbungen</h1>

                ${
                    applications.length === 0
                    ? `<p class="muted">Keine Bewerbungen.</p>`
                    : `
                    <div class="table-wrap">

                    <table>

                        <tr>
                            <th>Nummer</th>
                            <th>User</th>
                            <th>Bereich</th>
                            <th>Details</th>
                            <th>Status</th>
                            <th>Aktion</th>
                        </tr>

                        ${applications.map(a => `
                            <tr>

                                <td>
                                    ${escapeHTML(a.number)}
                                </td>

                                <td>
                                    ${escapeHTML(a.username)}
                                </td>

                                <td>
                                    ${escapeHTML(a.type)}
                                </td>

                                <td>
                                    <strong>Discord:</strong>
                                    ${escapeHTML(a.discord)}
                                    <br><br>

                                    <strong>Alter:</strong>
                                    ${escapeHTML(a.age)}
                                    <br><br>

                                    <strong>Erfahrung:</strong>
                                    ${escapeHTML(a.experience)}
                                    <br><br>

                                    <strong>Motivation:</strong>
                                    ${escapeHTML(a.motivation)}
                                    <br><br>

                                    <strong>Warum:</strong>
                                    ${escapeHTML(a.reason)}
                                </td>

                                <td>
                                    ${escapeHTML(a.status)}
                                </td>

                                <td>

                                    ${
                                        a.status === "offen"
                                        ? `
                                        <form
                                            method="POST"
                                            action="/admin/application/status"
                                        >

                                            <input
                                                type="hidden"
                                                name="id"
                                                value="${escapeHTML(a.id)}"
                                            >

                                            <select name="status">

                                                <option value="angenommen">
                                                    Annehmen
                                                </option>

                                                <option value="abgelehnt">
                                                    Ablehnen
                                                </option>

                                            </select>

                                            <input
                                                name="reason"
                                                placeholder="Grund"
                                            >

                                            <button class="button">
                                                Speichern
                                            </button>

                                        </form>
                                        `
                                        : `
                                            <span class="muted">
                                                Bearbeitet
                                            </span>
                                        `
                                    }

                                </td>

                            </tr>
                        `).join("")}

                    </table>

                    </div>
                    `
                }

            </div>
            `
        )
    );
});

app.post("/admin/application/status", requireAdmin, (req, res) => {
    const applications = getApplications();

    const application = applications.find(
        a => a.id === req.body.id
    );

    if (!application) {
        return res.status(404).send(
            "Bewerbung nicht gefunden."
        );
    }

    const status = String(
        req.body.status || ""
    );

    if (
        status !== "angenommen" &&
        status !== "abgelehnt"
    ) {
        return res.status(400).send(
            "Ungültiger Status."
        );
    }

    application.status = status;
    application.reviewedBy = req.user.username;
    application.reviewedAt = new Date().toISOString();
    application.reviewReason =
        String(req.body.reason || "").trim();

    saveApplications(applications);

    addLog(
        "application_status",
        req.user,
        {
            application: application.number,
            status,
            reason: application.reviewReason
        }
    );

    res.redirect("/admin/applications");
});

/*
========================================================
 ADMIN CODES
========================================================
*/

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = getCodes();

    res.send(
        page(
            "Codes",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Coin-Code erstellen</h1>

                    <form method="POST" action="/admin/codes/create">

                        <label>Coins</label>

                        <input
                            type="number"
                            name="coins"
                            min="1"
                            value="100"
                            required
                        >

                        <label>Max. Benutzer</label>

                        <input
                            type="number"
                            name="maxUses"
                            min="1"
                            value="1"
                            required
                        >

                        <button class="button">
                            Code erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Vorhandene Codes</h2>

                    ${
                        codes.length === 0
                        ? `<p class="muted">Keine Codes.</p>`
                        : `
                        <div class="table-wrap">

                        <table>

                            <tr>
                                <th>Code</th>
                                <th>Coins</th>
                                <th>Nutzung</th>
                                <th>Status</th>
                            </tr>

                            ${codes.map(c => `
                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHTML(c.code)}
                                        </strong>
                                    </td>

                                    <td>
                                        ${Number(c.coins)}
                                    </td>

                                    <td>
                                        ${
                                            Array.isArray(c.usedBy)
                                            ? c.usedBy.length
                                            : 0
                                        }
                                        /
                                        ${Number(c.maxUses)}
                                    </td>

                                    <td>
                                        ${
                                            c.active !== false
                                            ? "Aktiv"
                                            : "Deaktiviert"
                                        }
                                    </td>

                                </tr>
                            `).join("")}

                        </table>

                        </div>
                        `
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/codes/create", requireAdmin, (req, res) => {
    const coins = Number(req.body.coins);
    const maxUses = Number(req.body.maxUses);

    if (
        !Number.isFinite(coins) ||
        coins < 1 ||
        !Number.isFinite(maxUses) ||
        maxUses < 1
    ) {
        return res.status(400).send(
            "Ungültige Werte."
        );
    }

    const codes = getCodes();

    const code = {
        id: id("code"),
        code: codeNumber(),
        coins: Math.floor(coins),
        maxUses: Math.floor(maxUses),
        usedBy: [],
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    };

    codes.push(code);

    saveCodes(codes);

    addLog(
        "code_create",
        req.user,
        {
            code: code.code,
            coins: code.coins,
            maxUses: code.maxUses
        }
    );

    res.redirect("/admin/codes");
});

/*
========================================================
 ADMIN SHOP
========================================================
*/

app.get("/admin/shop", requireAdmin, (req, res) => {
    const products = getShop();

    res.send(
        page(
            "Shop Verwaltung",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Produkt hinzufügen</h1>

                    <form method="POST" action="/admin/shop/create">

                        <label>Name</label>

                        <input
                            name="name"
                            required
                            maxlength="100"
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

                        <button class="button">
                            Produkt erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Produkte</h2>

                    ${
                        products.length === 0
                        ? `<p class="muted">Keine Produkte.</p>`
                        : products.map(p => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(p.name)}
                                </h3>

                                <p>
                                    ${escapeHTML(p.description || "")}
                                </p>

                                <strong>
                                    ${Number(p.price)} Coins
                                </strong>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/shop/create", requireAdmin, (req, res) => {
    const name = String(
        req.body.name || ""
    ).trim();

    const description = String(
        req.body.description || ""
    ).trim();

    const price = Number(req.body.price);

    if (
        !name ||
        !Number.isFinite(price) ||
        price < 1
    ) {
        return res.status(400).send(
            "Ungültige Produktdaten."
        );
    }

    const products = getShop();

    products.push({
        id: id("product"),
        name,
        slug: slugify(name),
        description,
        price: Math.floor(price),
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    });

    saveShop(products);

    addLog(
        "shop_product_create",
        req.user,
        {
            product: name
        }
    );

    res.redirect("/admin/shop");
});

/*
========================================================
 ADMIN GEWINNSPIELE
========================================================
*/

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = getGiveaways();

    res.send(
        page(
            "Gewinnspiele",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Gewinnspiel erstellen</h1>

                    <form
                        method="POST"
                        action="/admin/giveaways/create"
                    >

                        <label>Titel</label>

                        <input
                            name="title"
                            required
                        >

                        <label>Beschreibung</label>

                        <textarea
                            name="description"
                        ></textarea>

                        <label>Gewinn</label>

                        <input
                            name="prize"
                            required
                        >

                        <button class="button">
                            Erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>Gewinnspiele</h2>

                    ${
                        giveaways.length === 0
                        ? `<p class="muted">Keine Gewinnspiele.</p>`
                        : giveaways.map(g => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(g.title)}
                                </h3>

                                <p>
                                    ${escapeHTML(g.description || "")}
                                </p>

                                <p>
                                    Gewinn:
                                    ${escapeHTML(g.prize || "")}
                                </p>

                                <p>
                                    Teilnehmer:
                                    ${
                                        Array.isArray(g.participants)
                                        ? g.participants.length
                                        : 0
                                    }
                                </p>

                            </div>
                        `).join("")
                    }

                </div>

            </div>
            `
        )
    );
});

app.post("/admin/giveaways/create", requireAdmin, (req, res) => {
    const title = String(
        req.body.title || ""
    ).trim();

    const description = String(
        req.body.description || ""
    ).trim();

    const prize = String(
        req.body.prize || ""
    ).trim();

    if (!title || !prize) {
        return res.status(400).send(
            "Titel und Gewinn sind erforderlich."
        );
    }

    const giveaways = getGiveaways();

    giveaways.push({
        id: id("giveaway"),
        title,
        description,
        prize,
        participants: [],
        active: true,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    });

    saveGiveaways(giveaways);

    addLog(
        "giveaway_create",
        req.user,
        {
            title
        }
    );

    res.redirect("/admin/giveaways");
});

/*
========================================================
 ADMIN TICKETS
========================================================
*/

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = getTickets();

    res.send(
        page(
            "Ticketverwaltung",
            req,
            `
            <div class="card">

                <h1>Tickets</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Nummer</th>
                        <th>User</th>
                        <th>Betreff</th>
                        <th>Status</th>
                        <th>Übernommen</th>
                        <th></th>
                    </tr>

                    ${tickets.map(t => `
                        <tr>

                            <td>
                                ${escapeHTML(t.number)}
                            </td>

                            <td>
                                ${escapeHTML(t.username)}
                            </td>

                            <td>
                                ${escapeHTML(t.subject)}
                            </td>

                            <td>
                                ${escapeHTML(t.status)}
                            </td>

                            <td>
                                ${escapeHTML(t.claimedByName || "-")}
                            </td>

                            <td>
                                <a
                                    class="button secondary"
                                    href="/tickets/${encodeURIComponent(t.id)}"
                                >
                                    Öffnen
                                </a>
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN BESTELLUNGEN
========================================================
*/

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = getOrders();

    res.send(
        page(
            "Bestellungen",
            req,
            `
            <div class="card">

                <h1>Bestellungen</h1>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Bestellnummer</th>
                        <th>User</th>
                        <th>Produkt</th>
                        <th>Preis</th>
                        <th>Status</th>
                        <th>Datum</th>
                    </tr>

                    ${orders.map(o => `
                        <tr>

                            <td>
                                ${escapeHTML(o.number)}
                            </td>

                            <td>
                                ${escapeHTML(o.username)}
                            </td>

                            <td>
                                ${escapeHTML(o.productName)}
                            </td>

                            <td>
                                ${Number(o.price)}
                            </td>

                            <td>
                                ${escapeHTML(o.status)}
                            </td>

                            <td>
                                ${new Date(o.createdAt).toLocaleString("de-DE")}
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN LOGS
========================================================
*/

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = getLogs();

    res.send(
        page(
            "Logs",
            req,
            `
            <div class="card">

                <h1>Logs</h1>

                <p class="muted">
                    Die letzten ${logs.length} Einträge.
                </p>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Zeit</th>
                        <th>Aktion</th>
                        <th>User</th>
                        <th>Details</th>
                    </tr>

                    ${logs.map(log => `
                        <tr>

                            <td>
                                ${new Date(log.createdAt).toLocaleString("de-DE")}
                            </td>

                            <td>
                                <span class="badge">
                                    ${escapeHTML(log.action)}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(log.userName)}
                            </td>

                            <td>
                                ${escapeHTML(
                                    JSON.stringify(log.details || {})
                                )}
                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `
        )
    );
});

/*
========================================================
 ADMIN WEBSEITE / WARTUNG / STÖRUNG / ANKÜNDIGUNG
========================================================
*/

app.get("/admin/settings", requireAdmin, (req, res) => {
    const settings = getSettings();

    res.send(
        page(
            "Webseite",
            req,
            `
            <div class="grid">

                <div class="card form">

                    <h1>Wartung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/maintenance"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.maintenanceText)}</textarea>

                        <button
                            class="button"
                            name="enabled"
                            value="true"
                        >
                            Wartung aktivieren
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Wartung deaktivieren
                        </button>

                    </form>

                </div>

                <div class="card form">

                    <h1>Störung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/outage"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.outageText)}</textarea>

                        <button
                            class="button danger"
                            name="enabled"
                            value="true"
                        >
                            Störung aktivieren
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Störung deaktivieren
                        </button>

                    </form>

                </div>

                <div class="card form">

                    <h1>Ankündigung</h1>

                    <form
                        method="POST"
                        action="/admin/settings/announcement"
                    >

                        <label>
                            Text
                        </label>

                        <textarea name="text">${escapeHTML(settings.announcement)}</textarea>

                        <button
                            class="button"
                            name="enabled"
                            value="true"
                        >
                            Anzeigen
                        </button>

                        <button
                            class="button secondary"
                            name="enabled"
                            value="false"
                        >
                            Ausblenden
                        </button>

                    </form>

                </div>

            </div>
            `
        )
    );
});

app.post(
    "/admin/settings/maintenance",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.maintenance =
            req.body.enabled === "true";

        settings.maintenanceText =
            String(
                req.body.text ||
                "Die Webseite befindet sich momentan in Wartung."
            ).trim();

        saveSettings(settings);

        addLog(
            "maintenance_change",
            req.user,
            {
                enabled: settings.maintenance
            }
        );

        res.redirect("/admin/settings");
    }
);

app.post(
    "/admin/settings/outage",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.outage =
            req.body.enabled === "true";

        settings.outageText =
            String(
                req.body.text ||
                "Aktuell liegt eine Störung vor."
            ).trim();

        saveSettings(settings);

        addLog(
            "outage_change",
            req.user,
            {
                enabled: settings.outage
            }
        );

        res.redirect("/admin/settings");
    }
);

app.post(
    "/admin/settings/announcement",
    requireAdmin,
    (req, res) => {

        const settings = getSettings();

        settings.announcementEnabled =
            req.body.enabled === "true";

        settings.announcement =
            String(
                req.body.text || ""
            ).trim();

        saveSettings(settings);

        const announcements =
            getAnnouncements();

        announcements.unshift({
            id: id("announcement"),
            text: settings.announcement,
            enabled: settings.announcementEnabled,
            createdBy: req.user.username,
            createdAt: new Date().toISOString()
        });

        saveAnnouncements(
            announcements.slice(0, 100)
        );

        addLog(
            "announcement_change",
            req.user,
            {
                enabled:
                    settings.announcementEnabled
            }
        );

        res.redirect("/admin/settings");
    }
);

/*
========================================================
 ADMIN KICK
========================================================
*/

app.post("/admin/user/kick", requireAdmin, (req, res) => {
    const users = getUsers();

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) {
        return res.status(404).send(
            "User nicht gefunden."
        );
    }

    if (
        target.email.toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    ) {
        return res.status(403).send(
            "Owner kann nicht gekickt werden."
        );
    }

    target.kicked = true;

    saveUsers(users);

    const sessions = getSessions().filter(
        s => s.userId !== target.id
    );

    saveSessions(sessions);

    addLog(
        "user_kick",
        req.user,
        {
            target: target.email
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 404
========================================================
*/

app.use((req, res) => {
    res.status(404).send(
        page(
            "Nicht gefunden",
            req,
            `
            <div class="card center">

                <h1>404</h1>

                <p>
                    Diese Seite wurde nicht gefunden.
                </p>

                <a class="button" href="/">
                    Zur Startseite
                </a>

            </div>
            `
        )
    );
});

/*
========================================================
 ERROR HANDLER
========================================================
*/

app.use((err, req, res, next) => {
    console.error("Webseiten-Fehler:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send(
        page(
            "Fehler",
            req,
            `
            <div class="card">

                <h1>Fehler</h1>

                <p>
                    Bei der Verarbeitung ist ein Fehler aufgetreten.
                </p>

                <a class="button" href="/">
                    Zur Startseite
                </a>

            </div>
            `
        )
    );
});

/*
========================================================
 START
========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("======================================");
    console.log(" North Bot V2 Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port:", PORT);
    console.log("Discord:", DISCORD_INVITE);
    console.log("Owner:", OWNER_EMAIL);
    console.log("======================================");
});
