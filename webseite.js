/*
 * ============================================================
 * NORTH-BOT-2 WEBSEITE
 * ============================================================
 *
 * Start:
 *   node webseite.js
 *
 * Enthalten:
 *   - Registrierung / Login / Logout
 *   - Profile bearbeiten
 *   - Coins
 *   - Daily Coins alle 14 Stunden
 *   - Coin-Codes
 *   - Coin-Shop
 *   - Bestellungen
 *   - Tickets
 *   - User-Chat
 *   - Team-Chat
 *   - Gewinnspiele
 *   - Wartung
 *   - Störung
 *   - Ankündigungen
 *   - User-Verwaltung
 *   - Web-Ban mit Grund + Zeitraum
 *   - Web-Kick
 *   - Admin-Panel
 *   - Logs
 *   - Beta-/Produktnummern
 *   - Rollen
 *   - JSON-Datenspeicherung
 *
 * Kein Discord Webhook.
 * ============================================================
 */

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

// ============================================================
// KONFIGURATION
// ============================================================

const SITE_NAME = "North-Bot-2";
const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
// JSON DATEIEN
// ============================================================

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    products: path.join(DATA_DIR, "products.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    chats: path.join(DATA_DIR, "chats.json"),
    teamChat: path.join(DATA_DIR, "teamChat.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    announcements: path.join(DATA_DIR, "announcements.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    beta: path.join(DATA_DIR, "beta.json")
};

function ensureFile(file, defaultData) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.products, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.chats, []);
ensureFile(FILES.teamChat, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.beta, []);

ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    outage: false,
    outageText: "Aktuell liegt eine Störung vor.",
    outageLevel: "critical"
});

// ============================================================
// JSON FUNKTIONEN
// ============================================================

function readJSON(file, fallback = []) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
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

function getCodes() {
    return readJSON(FILES.codes, []);
}

function saveCodes(data) {
    writeJSON(FILES.codes, data);
}

function getProducts() {
    return readJSON(FILES.products, []);
}

function saveProducts(data) {
    writeJSON(FILES.products, data);
}

function getOrders() {
    return readJSON(FILES.orders, []);
}

function saveOrders(data) {
    writeJSON(FILES.orders, data);
}

function getLogs() {
    return readJSON(FILES.logs, []);
}

function saveLogs(data) {
    writeJSON(FILES.logs, data);
}

function getChats() {
    return readJSON(FILES.chats, []);
}

function saveChats(data) {
    writeJSON(FILES.chats, data);
}

function getTeamChat() {
    return readJSON(FILES.teamChat, []);
}

function saveTeamChat(data) {
    writeJSON(FILES.teamChat, data);
}

function getGiveaways() {
    return readJSON(FILES.giveaways, []);
}

function saveGiveaways(data) {
    writeJSON(FILES.giveaways, data);
}

function getAnnouncements() {
    return readJSON(FILES.announcements, []);
}

function saveAnnouncements(data) {
    writeJSON(FILES.announcements, data);
}

function getBeta() {
    return readJSON(FILES.beta, []);
}

function saveBeta(data) {
    writeJSON(FILES.beta, data);
}

function getSettings() {
    return readJSON(FILES.settings, {
        maintenance: false,
        maintenanceText: "",
        outage: false,
        outageText: "",
        outageLevel: "critical"
    });
}

function saveSettings(data) {
    writeJSON(FILES.settings, data);
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function id(prefix = "") {
    return prefix + crypto.randomBytes(6).toString("hex");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(date) {
    return new Date(date).toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function now() {
    return new Date().toISOString();
}

function randomCode(prefix = "NB") {
    return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function generateOrderNumber() {
    return "NB-ORDER-" + Date.now().toString().slice(-8) + "-" +
        crypto.randomBytes(2).toString("hex").toUpperCase();
}

function generateBetaNumber() {
    return "NB-BETA-" + Date.now().toString().slice(-8) + "-" +
        crypto.randomBytes(2).toString("hex").toUpperCase();
}

// ============================================================
// LOG SYSTEM
// ============================================================

function addLog(type, message, user = null) {
    const logs = getLogs();

    logs.unshift({
        id: id("log_"),
        type,
        message,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userName: user?.name || null,
        createdAt: now()
    });

    if (logs.length > 5000) {
        logs.length = 5000;
    }

    saveLogs(logs);
}

// ============================================================
// ROLLEN
// ============================================================

const ROLE_LEVELS = {
    user: 0,
    developer: 50,
    moderator: 60,
    manager: 80,
    admin: 90,
    owner: 100
};

function normalizeRole(role) {
    return String(role || "user").toLowerCase();
}

function isAdmin(user) {
    if (!user) return false;

    return (
        normalizeRole(user.role) === "owner" ||
        normalizeRole(user.role) === "admin" ||
        normalizeRole(user.role) === "manager" ||
        normalizeRole(user.role) === "moderator" ||
        user.email === OWNER_EMAIL
    );
}

function isStaff(user) {
    if (!user) return false;

    return (
        isAdmin(user) ||
        normalizeRole(user.role) === "developer"
    );
}

function hasRole(user, role) {
    if (!user) return false;

    if (user.email === OWNER_EMAIL) {
        return true;
    }

    return ROLE_LEVELS[normalizeRole(user.role)] >= ROLE_LEVELS[role];
}

// ============================================================
// EXPRESS
// ============================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "north-bot-2-web-session-secret-2026",
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
// USER SESSION
// ============================================================

function getCurrentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    const users = getUsers();

    return users.find(u => u.id === req.session.userId) || null;
}

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.bannedUntil) {
        const until = new Date(user.bannedUntil);

        if (until > new Date()) {
            return res.status(403).send(
                renderPage(
                    "Gebannt",
                    `
                    <div class="card danger">
                        <h1>🔨 Du wurdest gebannt</h1>
                        <p><b>Grund:</b> ${escapeHTML(user.banReason || "Kein Grund angegeben")}</p>
                        <p><b>Gebannt bis:</b> ${formatDate(user.bannedUntil)}</p>
                        <p>Gehe auf unseren Discord, um dich entbannen zu lassen.</p>
                        <a class="button" href="https://discord.gg/NJEVq6Pk6x" target="_blank">
                            Discord öffnen
                        </a>
                    </div>
                    `
                )
            );
        }
    }

    if (user.kickedUntil) {
        const until = new Date(user.kickedUntil);

        if (until > new Date()) {
            return res.status(403).send(
                renderPage(
                    "Ausgeschlossen",
                    `
                    <div class="card warning">
                        <h1>👢 Du wurdest vorübergehend ausgeschlossen</h1>
                        <p>${escapeHTML(user.kickReason || "Kein Grund angegeben")}</p>
                        <p>Bis: ${formatDate(user.kickedUntil)}</p>
                    </div>
                    `
                )
            );
        }
    }

    next();
}

function requireAdmin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user || !isAdmin(user)) {
        return res.status(403).send(
            renderPage(
                "Keine Berechtigung",
                `
                <div class="card danger">
                    <h1>⛔ Keine Berechtigung</h1>
                    <p>Du hast keinen Zugriff auf diesen Bereich.</p>
                    <a class="button" href="/">Zur Startseite</a>
                </div>
                `
            )
        );
    }

    next();
}

function requireStaff(req, res, next) {
    const user = getCurrentUser(req);

    if (!user || !isStaff(user)) {
        return res.status(403).send(
            renderPage(
                "Keine Berechtigung",
                `
                <div class="card danger">
                    <h1>⛔ Team-Bereich</h1>
                    <p>Nur Teammitglieder können diesen Bereich öffnen.</p>
                </div>
                `
            )
        );
    }

    next();
}

// ============================================================
// CSS / DESIGN
// ============================================================

const CSS = `
* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background:
        radial-gradient(circle at top left, rgba(100, 80, 255, .12), transparent 35%),
        radial-gradient(circle at top right, rgba(0, 190, 255, .08), transparent 35%),
        #07090f;
    color: #f4f6ff;
    min-height: 100vh;
}

a {
    color: inherit;
    text-decoration: none;
}

nav {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 6%;
    background: rgba(7, 9, 15, .88);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid rgba(255,255,255,.07);
}

.logo {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -.5px;
}

.logo span {
    color: #7c7cff;
}

.navlinks {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
}

.navlinks a {
    padding: 9px 13px;
    border-radius: 10px;
    color: #b8bfd5;
    transition: .2s;
}

.navlinks a:hover {
    background: rgba(255,255,255,.07);
    color: white;
}

.container {
    width: min(1200px, 92%);
    margin: 0 auto;
}

.hero {
    padding: 100px 0 80px;
    text-align: center;
}

.hero h1 {
    font-size: clamp(42px, 8vw, 82px);
    margin: 0;
    line-height: .95;
    letter-spacing: -4px;
}

.gradient {
    background: linear-gradient(90deg, #fff, #8b8cff, #6bdcff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.hero p {
    color: #aeb5ca;
    font-size: 18px;
    max-width: 680px;
    margin: 25px auto;
    line-height: 1.7;
}

.buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
}

.button,
button {
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: linear-gradient(135deg, #6666ff, #8b6dff);
    color: white;
    padding: 11px 17px;
    border-radius: 11px;
    font-weight: 800;
    transition: .2s;
}

.button:hover,
button:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
}

.button.secondary {
    background: rgba(255,255,255,.07);
}

.button.danger,
button.danger {
    background: #b82f4b;
}

.button.green,
button.green {
    background: #16885c;
}

.button.warning,
button.warning {
    background: #9c6b16;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
    margin: 25px 0;
}

.card {
    background: rgba(16, 19, 30, .86);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 15px 45px rgba(0,0,0,.15);
}

.card h2,
.card h3 {
    margin-top: 0;
}

.card p {
    color: #abb2c7;
    line-height: 1.65;
}

.center {
    text-align: center;
}

.danger {
    border-color: rgba(255, 60, 90, .3);
}

.warning {
    border-color: rgba(255, 190, 40, .3);
}

.success {
    border-color: rgba(40, 220, 150, .3);
}

input,
textarea,
select {
    width: 100%;
    background: #0b0e17;
    color: white;
    border: 1px solid #262c3d;
    border-radius: 10px;
    padding: 12px 13px;
    outline: none;
    margin-top: 7px;
    margin-bottom: 15px;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    display: block;
    color: #c7ccdb;
    font-weight: 700;
    font-size: 14px;
}

form {
    margin-top: 10px;
}

.stat {
    font-size: 32px;
    font-weight: 900;
}

.muted {
    color: #858da5;
}

.badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 99px;
    background: rgba(120,120,255,.12);
    color: #a8a8ff;
    font-size: 12px;
    font-weight: 800;
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
    padding: 12px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    text-align: left;
    vertical-align: top;
}

th {
    color: #bfc5d8;
}

.chat {
    max-height: 500px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.message {
    padding: 12px;
    border-radius: 12px;
    background: #0d111c;
    border: 1px solid rgba(255,255,255,.05);
}

.message strong {
    color: #9e9eff;
}

footer {
    margin-top: 80px;
    padding: 40px 0;
    border-top: 1px solid rgba(255,255,255,.06);
    text-align: center;
    color: #717991;
}

.alert {
    padding: 13px 16px;
    margin: 15px auto;
    border-radius: 12px;
    max-width: 1200px;
}

.alert.red {
    background: rgba(255, 50, 70, .12);
    border: 1px solid rgba(255,50,70,.25);
}

.alert.yellow {
    background: rgba(255, 190, 30, .12);
    border: 1px solid rgba(255,190,30,.25);
}

.alert.blue {
    background: rgba(70, 100, 255, .12);
    border: 1px solid rgba(70,100,255,.25);
}

.kpi {
    font-size: 13px;
    color: #8991a8;
}

@media (max-width: 700px) {
    nav {
        align-items: flex-start;
        gap: 15px;
        flex-direction: column;
    }

    .hero {
        padding-top: 60px;
    }

    .hero h1 {
        letter-spacing: -2px;
    }
}
`;

// ============================================================
// HTML LAYOUT
// ============================================================

function renderPage(title, content, req = null) {
    const user = req ? getCurrentUser(req) : null;
    const settings = getSettings();

    let statusHTML = "";

    if (settings.maintenance && (!user || !isAdmin(user))) {
        statusHTML += `
        <div class="alert yellow">
            🛠️ <b>Wartung:</b> ${escapeHTML(settings.maintenanceText)}
        </div>
        `;
    }

    if (settings.outage) {
        statusHTML += `
        <div class="alert red">
            🔴 <b>Störung:</b> ${escapeHTML(settings.outageText)}
        </div>
        `;
    }

    let navigation = `
        <a href="/">Startseite</a>
        <a href="/shop">Shop</a>
        <a href="/giveaways">Gewinnspiele</a>
        <a href="/announcement">Ankündigungen</a>
    `;

    if (user) {
        navigation += `
            <a href="/dashboard">Dashboard</a>
            <a href="/tickets">Tickets</a>
            <a href="/chat">Chat</a>
            <a href="/profile">Profil</a>
        `;

        if (isStaff(user)) {
            navigation += `<a href="/team-chat">Team-Chat</a>`;
        }

        if (isAdmin(user)) {
            navigation += `<a href="/admin">Admin</a>`;
        }

        navigation += `
            <a href="/logout">Logout</a>
        `;
    } else {
        navigation += `
            <a href="/login">Login</a>
            <a href="/register">Registrieren</a>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} • ${SITE_NAME}</title>
<style>${CSS}</style>
</head>
<body>

<nav>
    <a class="logo" href="/">North<span>-Bot-2</span></a>

    <div class="navlinks">
        ${navigation}
    </div>
</nav>

${statusHTML}

<main class="container">
    ${content}
</main>

<footer>
    <b>${SITE_NAME}</b><br>
    Moderne Community-Webseite
</footer>

</body>
</html>
`;
}

// ============================================================
// MAINTENANCE MIDDLEWARE
// ============================================================

app.use((req, res, next) => {
    const settings = getSettings();

    const allowed = [
        "/login",
        "/register",
        "/logout",
        "/api"
    ];

    if (
        settings.maintenance &&
        !allowed.some(x => req.path.startsWith(x))
    ) {
        const user = getCurrentUser(req);

        if (!user || !isAdmin(user)) {
            return res.status(503).send(
                renderPage(
                    "Wartung",
                    `
                    <div class="hero">
                        <h1>🛠️ <span class="gradient">Coming Soon!</span></h1>
                        <p>
                            ${escapeHTML(settings.maintenanceText)}
                        </p>
                    </div>
                    `
                )
            );
        }
    }

    next();
});

// ============================================================
// STARTSEITE
// ============================================================

app.get("/", (req, res) => {
    const user = getCurrentUser(req);
    const giveaways = getGiveaways().filter(g => !g.ended);
    const announcements = getAnnouncements().slice(0, 3);

    res.send(
        renderPage(
            "Startseite",
            `
            <section class="hero">
                <h1>
                    Willkommen bei<br>
                    <span class="gradient">North-Bot-2</span>
                </h1>

                <p>
                    Die zentrale Webseite für Community, Support,
                    Tickets, Coins, Gewinnspiele und Team-Systeme.
                </p>

                <div class="buttons">
                    <a class="button" href="https://discord.gg/NJEVq6Pk6x" target="_blank">
                        💬 Discord beitreten
                    </a>

                    ${
                        user
                            ? `<a class="button secondary" href="/dashboard">Dashboard</a>`
                            : `<a class="button secondary" href="/register">Account erstellen</a>`
                    }
                </div>
            </section>

            <div class="grid">

                <div class="card">
                    <h2>🎟️ Support</h2>
                    <p>
                        Erstelle direkt auf der Webseite ein Support-Ticket.
                        Deine Tickets sehen nur du und das Team.
                    </p>
                </div>

                <div class="card">
                    <h2>🪙 Coins</h2>
                    <p>
                        Sammle Coins über Daily-Belohnungen,
                        Codes und Gewinnspiele.
                    </p>
                </div>

                <div class="card">
                    <h2>🛒 Shop</h2>
                    <p>
                        Tausche deine Coins gegen Produkte
                        aus dem North-Bot-2 Shop.
                    </p>
                </div>

                <div class="card">
                    <h2>🎁 Gewinnspiele</h2>
                    <p>
                        Nimm an Gewinnspielen teil und gewinne
                        Coins oder andere Preise.
                    </p>
                </div>

            </div>

            ${
                announcements.length
                    ? `
                    <div class="card">
                        <h2>📢 Neueste Ankündigungen</h2>

                        ${announcements.map(a => `
                            <div class="message">
                                <strong>${escapeHTML(a.title)}</strong>
                                <p>${escapeHTML(a.text)}</p>
                                <span class="muted">${formatDate(a.createdAt)}</span>
                            </div>
                        `).join("")}
                    </div>
                    `
                    : ""
            }

            ${
                giveaways.length
                    ? `
                    <div class="card">
                        <h2>🎁 Aktuelle Gewinnspiele</h2>

                        <div class="grid">
                            ${giveaways.slice(0, 3).map(g => `
                                <div class="card">
                                    <h3>${escapeHTML(g.title)}</h3>
                                    <p>${escapeHTML(g.description)}</p>
                                    <span class="badge">
                                        ${g.participants.length} Teilnehmer
                                    </span>
                                    <br><br>
                                    <a class="button" href="/giveaways">
                                        Teilnehmen
                                    </a>
                                </div>
                            `).join("")}
                        </div>
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
// REGISTER
// ============================================================

app.get("/register", (req, res) => {
    res.send(
        renderPage(
            "Registrieren",
            `
            <div class="hero">
                <h1><span class="gradient">Account erstellen</span></h1>
                <p>Erstelle deinen North-Bot-2 Account.</p>
            </div>

            <div class="card" style="max-width:600px;margin:auto;">
                <form method="POST" action="/register">

                    <label>Name</label>
                    <input
                        name="name"
                        required
                        maxlength="30"
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

                    <button type="submit">Registrieren</button>
                </form>
            </div>
            `
        )
    );
});

app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send(
            renderPage(
                "Fehler",
                `<div class="card danger"><h2>❌ Bitte alle Felder ausfüllen.</h2></div>`
            )
        );
    }

    const users = getUsers();

    if (
        users.some(
            u => u.email.toLowerCase() === email.toLowerCase()
        )
    ) {
        return res.status(400).send(
            renderPage(
                "Fehler",
                `<div class="card danger"><h2>❌ Diese E-Mail ist bereits registriert.</h2></div>`
            )
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
        id: id("usr_"),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role:
            email.trim().toLowerCase() === OWNER_EMAIL
                ? "owner"
                : "user",
        coins: 0,
        lastDaily: null,
        bannedUntil: null,
        banReason: null,
        kickedUntil: null,
        kickReason: null,
        createdAt: now()
    };

    users.push(user);
    saveUsers(users);

    addLog(
        "REGISTER",
        `Neuer Benutzer registriert: ${user.email}`,
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
        renderPage(
            "Login",
            `
            <div class="hero">
                <h1><span class="gradient">Login</span></h1>
            </div>

            <div class="card" style="max-width:600px;margin:auto;">
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

                    <button type="submit">Einloggen</button>
                </form>

                <br>

                <a class="button secondary" href="/register">
                    Noch keinen Account?
                </a>
            </div>
            `
        )
    );
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const users = getUsers();

    const user = users.find(
        u => u.email.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
        return res.status(401).send(
            renderPage(
                "Login",
                `
                <div class="card danger">
                    <h2>❌ Login fehlgeschlagen</h2>
                    <p>E-Mail oder Passwort ist falsch.</p>
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
            renderPage(
                "Login",
                `
                <div class="card danger">
                    <h2>❌ Login fehlgeschlagen</h2>
                    <p>E-Mail oder Passwort ist falsch.</p>
                </div>
                `
            )
        );
    }

    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        return res.status(403).send(
            renderPage(
                "Gebannt",
                `
                <div class="card danger">
                    <h1>🔨 Gebannt</h1>
                    <p>
                        <b>Grund:</b>
                        ${escapeHTML(user.banReason || "Kein Grund")}
                    </p>
                    <p>
                        <b>Bis:</b>
                        ${formatDate(user.bannedUntil)}
                    </p>
                    <p>Gehe auf unseren Discord, um dich entbannen zu lassen.</p>
                    <a class="button" href="https://discord.gg/NJEVq6Pk6x" target="_blank">
                        Discord
                    </a>
                </div>
                `
            )
        );
    }

    req.session.userId = user.id;

    addLog(
        "LOGIN",
        `${user.email} hat sich eingeloggt.`,
        user
    );

    res.redirect("/dashboard");
});

// ============================================================
// LOGOUT
// ============================================================

app.get("/logout", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        addLog(
            "LOGOUT",
            `${user.email} hat sich ausgeloggt.`,
            user
        );
    }

    req.session.destroy(() => {
        res.redirect("/");
    });
});

// ============================================================
// DASHBOARD
// ============================================================

app.get("/dashboard", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const dailyAvailable =
        !user.lastDaily ||
        Date.now() - new Date(user.lastDaily).getTime() >=
            14 * 60 * 60 * 1000;

    const tickets = getTickets().filter(
        t => t.userId === user.id
    );

    const orders = getOrders().filter(
        o => o.userId === user.id
    );

    res.send(
        renderPage(
            "Dashboard",
            `
            <div class="hero">
                <h1>Hallo <span class="gradient">${escapeHTML(user.name)}</span> 👋</h1>
                <p>Dein North-Bot-2 Dashboard</p>
            </div>

            <div class="grid">

                <div class="card center">
                    <div class="kpi">Coins</div>
                    <div class="stat">🪙 ${user.coins}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Rolle</div>
                    <div class="stat" style="font-size:22px;">
                        ${escapeHTML(user.role)}
                    </div>
                </div>

                <div class="card center">
                    <div class="kpi">Tickets</div>
                    <div class="stat">${tickets.length}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Bestellungen</div>
                    <div class="stat">${orders.length}</div>
                </div>

            </div>

            <div class="card">
                <h2>🎁 Daily Coins</h2>

                ${
                    dailyAvailable
                        ? `
                        <p>Du kannst jetzt deine 100 Daily-Coins abholen.</p>
                        <form method="POST" action="/daily">
                            <button class="green">
                                🪙 100 Coins abholen
                            </button>
                        </form>
                        `
                        : `
                        <p>
                            Deine Daily-Belohnung ist noch nicht verfügbar.
                        </p>
                        <span class="badge">
                            Alle 14 Stunden
                        </span>
                        `
                }
            </div>

            <div class="grid">

                <div class="card">
                    <h2>🎟️ Support</h2>
                    <p>Erstelle ein neues Ticket.</p>
                    <a class="button" href="/tickets/new">
                        Ticket erstellen
                    </a>
                </div>

                <div class="card">
                    <h2>🪙 Coin-Code</h2>
                    <p>Hast du einen Coin-Code?</p>
                    <a class="button" href="/redeem">
                        Code einlösen
                    </a>
                </div>

                <div class="card">
                    <h2>🛒 Shop</h2>
                    <p>Gib deine Coins im Shop aus.</p>
                    <a class="button" href="/shop">
                        Shop öffnen
                    </a>
                </div>

                <div class="card">
                    <h2>👤 Profil</h2>
                    <p>Name und Profil bearbeiten.</p>
                    <a class="button secondary" href="/profile">
                        Profil bearbeiten
                    </a>
                </div>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// DAILY
// ============================================================

app.post("/daily", requireLogin, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.session.userId);

    if (!user) {
        return res.redirect("/login");
    }

    const cooldown = 14 * 60 * 60 * 1000;

    if (
        user.lastDaily &&
        Date.now() - new Date(user.lastDaily).getTime() < cooldown
    ) {
        return res.redirect("/dashboard");
    }

    user.coins += 100;
    user.lastDaily = now();

    saveUsers(users);

    addLog(
        "DAILY",
        `${user.email} hat 100 Daily-Coins erhalten.`,
        user
    );

    res.redirect("/dashboard");
});

// ============================================================
// PROFIL
// ============================================================

app.get("/profile", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    res.send(
        renderPage(
            "Profil",
            `
            <div class="hero">
                <h1><span class="gradient">Dein Profil</span></h1>
            </div>

            <div class="card" style="max-width:700px;margin:auto;">

                <form method="POST" action="/profile">

                    <label>Name</label>
                    <input
                        name="name"
                        maxlength="30"
                        required
                        value="${escapeHTML(user.name)}"
                    >

                    <label>E-Mail</label>
                    <input
                        value="${escapeHTML(user.email)}"
                        disabled
                    >

                    <label>Rolle</label>
                    <input
                        value="${escapeHTML(user.role)}"
                        disabled
                    >

                    <button type="submit">
                        Profil speichern
                    </button>
                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/profile", requireLogin, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.session.userId);

    user.name = String(req.body.name || user.name)
        .trim()
        .slice(0, 30);

    saveUsers(users);

    addLog(
        "PROFILE",
        `${user.email} hat sein Profil bearbeitet.`,
        user
    );

    res.redirect("/profile");
});

// ============================================================
// TICKETS
// ============================================================

app.get("/tickets", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const tickets = getTickets().filter(
        t => t.userId === user.id
    );

    res.send(
        renderPage(
            "Meine Tickets",
            `
            <div class="hero">
                <h1><span class="gradient">Meine Tickets</span></h1>
                <p>Nur du und das Team können deine Tickets sehen.</p>
            </div>

            <a class="button" href="/tickets/new">
                🎟️ Neues Ticket
            </a>

            <div class="grid">

                ${
                    tickets.length
                        ? tickets.map(t => `
                            <div class="card">
                                <span class="badge">${escapeHTML(t.status)}</span>

                                <h2>${escapeHTML(t.subject)}</h2>

                                <p>
                                    ${escapeHTML(t.message)}
                                </p>

                                <p class="muted">
                                    ${formatDate(t.createdAt)}
                                </p>

                                <a class="button" href="/tickets/${t.id}">
                                    Ticket öffnen
                                </a>
                            </div>
                        `).join("")
                        : `
                        <div class="card">
                            <h2>Keine Tickets</h2>
                            <p>Du hast noch kein Ticket erstellt.</p>
                        </div>
                        `
                }

            </div>
            `,
            req
        )
    );
});

app.get("/tickets/new", requireLogin, (req, res) => {
    res.send(
        renderPage(
            "Ticket erstellen",
            `
            <div class="hero">
                <h1><span class="gradient">Support-Ticket</span></h1>
            </div>

            <div class="card" style="max-width:750px;margin:auto;">

                <form method="POST" action="/tickets/new">

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
                        maxlength="3000"
                        required
                        placeholder="Beschreibe dein Problem..."
                    ></textarea>

                    <button type="submit">
                        🎟️ Ticket erstellen
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/tickets/new", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const tickets = getTickets();

    const ticket = {
        id: id("ticket_"),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        subject: String(req.body.subject || "").trim(),
        message: String(req.body.message || "").trim(),
        status: "offen",
        claimedBy: null,
        claimedByName: null,
        messages: [],
        createdAt: now(),
        updatedAt: now()
    };

    tickets.unshift(ticket);
    saveTickets(tickets);

    addLog(
        "TICKET_CREATE",
        `${user.email} hat Ticket ${ticket.id} erstellt.`,
        user
    );

    res.redirect("/tickets/" + ticket.id);
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const ticket = getTickets().find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send(
            renderPage(
                "Ticket",
                `<div class="card danger"><h2>Ticket nicht gefunden.</h2></div>`,
                req
            )
        );
    }

    // Nur Ersteller oder Admin
    if (
        ticket.userId !== user.id &&
        !isAdmin(user)
    ) {
        return res.status(403).send(
            renderPage(
                "Ticket",
                `<div class="card danger"><h2>⛔ Kein Zugriff auf dieses Ticket.</h2></div>`,
                req
            )
        );
    }

    res.send(
        renderPage(
            "Ticket",
            `
            <div class="hero">
                <h1><span class="gradient">${escapeHTML(ticket.subject)}</span></h1>
                <p>Ticket-ID: ${escapeHTML(ticket.id)}</p>
            </div>

            <div class="card">

                <span class="badge">
                    ${escapeHTML(ticket.status)}
                </span>

                ${
                    ticket.claimedBy
                        ? `
                        <p>
                            👤 Übernommen von
                            <b>${escapeHTML(ticket.claimedByName)}</b>
                        </p>
                        `
                        : `
                        <p>⏳ Noch nicht übernommen.</p>
                        `
                }

                <hr>

                <div class="chat">

                    <div class="message">
                        <strong>${escapeHTML(ticket.userName)}</strong>
                        <p>${escapeHTML(ticket.message)}</p>
                    </div>

                    ${(ticket.messages || []).map(m => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(m.userName)}
                                ${
                                    m.staff
                                        ? `<span class="badge">TEAM</span>`
                                        : ""
                                }
                            </strong>

                            <p>${escapeHTML(m.text)}</p>

                            <span class="muted">
                                ${formatDate(m.createdAt)}
                            </span>
                        </div>
                    `).join("")}

                </div>

                ${
                    ticket.status !== "geschlossen"
                        ? `
                        <form method="POST" action="/tickets/${ticket.id}/message">

                            <label>Antwort</label>

                            <textarea
                                name="message"
                                required
                                maxlength="3000"
                            ></textarea>

                            <button type="submit">
                                Nachricht senden
                            </button>

                        </form>
                        `
                        : `
                        <div class="card warning">
                            Dieses Ticket ist geschlossen.
                        </div>
                        `
                }

                ${
                    isAdmin(user)
                        ? `
                        <hr>

                        <div class="buttons">

                            ${
                                !ticket.claimedBy
                                    ? `
                                    <form method="POST" action="/admin/tickets/${ticket.id}/claim">
                                        <button class="green">
                                            👤 Übernehmen
                                        </button>
                                    </form>
                                    `
                                    : `
                                    <form method="POST" action="/admin/tickets/${ticket.id}/unclaim">
                                        <button class="warning">
                                            ↩️ Unübernehmen
                                        </button>
                                    </form>
                                    `
                            }

                            ${
                                ticket.status !== "geschlossen"
                                    ? `
                                    <form method="POST" action="/admin/tickets/${ticket.id}/close">
                                        <button class="danger">
                                            🔒 Schließen
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
            `,
            req
        )
    );
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const tickets = getTickets();

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Ticket nicht gefunden.");
    }

    if (
        ticket.userId !== user.id &&
        !isAdmin(user)
    ) {
        return res.status(403).send("Kein Zugriff.");
    }

    if (ticket.status === "geschlossen") {
        return res.redirect("/tickets/" + ticket.id);
    }

    ticket.messages.push({
        id: id("msg_"),
        userId: user.id,
        userName: user.name,
        text: String(req.body.message || "").trim(),
        staff: isStaff(user),
        createdAt: now()
    });

    ticket.updatedAt = now();

    saveTickets(tickets);

    addLog(
        "TICKET_MESSAGE",
        `${user.email} hat auf Ticket ${ticket.id} geantwortet.`,
        user
    );

    res.redirect("/tickets/" + ticket.id);
});

// ============================================================
// ADMIN TICKET AKTIONEN
// ============================================================

app.post(
    "/admin/tickets/:id/claim",
    requireAdmin,
    (req, res) => {
        const user = getCurrentUser(req);
        const tickets = getTickets();

        const ticket = tickets.find(
            t => t.id === req.params.id
        );

        if (!ticket) {
            return res.status(404).send("Ticket nicht gefunden.");
        }

        ticket.claimedBy = user.id;
        ticket.claimedByName = user.name;
        ticket.status = "in_bearbeitung";
        ticket.updatedAt = now();

        saveTickets(tickets);

        addLog(
            "TICKET_CLAIM",
            `${user.name} hat Ticket ${ticket.id} übernommen.`,
            user
        );

        res.redirect("/tickets/" + ticket.id);
    }
);

app.post(
    "/admin/tickets/:id/unclaim",
    requireAdmin,
    (req, res) => {
        const user = getCurrentUser(req);
        const tickets = getTickets();

        const ticket = tickets.find(
            t => t.id === req.params.id
        );

        if (!ticket) {
            return res.status(404).send("Ticket nicht gefunden.");
        }

        ticket.claimedBy = null;
        ticket.claimedByName = null;
        ticket.status = "offen";
        ticket.updatedAt = now();

        saveTickets(tickets);

        addLog(
            "TICKET_UNCLAIM",
            `${user.name} hat Ticket ${ticket.id} freigegeben.`,
            user
        );

        res.redirect("/tickets/" + ticket.id);
    }
);

app.post(
    "/admin/tickets/:id/close",
    requireAdmin,
    (req, res) => {
        const user = getCurrentUser(req);
        const tickets = getTickets();

        const ticket = tickets.find(
            t => t.id === req.params.id
        );

        if (!ticket) {
            return res.status(404).send("Ticket nicht gefunden.");
        }

        ticket.status = "geschlossen";
        ticket.updatedAt = now();

        saveTickets(tickets);

        addLog(
            "TICKET_CLOSE",
            `${user.name} hat Ticket ${ticket.id} geschlossen.`,
            user
        );

        res.redirect("/tickets/" + ticket.id);
    }
);

// ============================================================
// COIN CODE EINLÖSEN
// ============================================================

app.get("/redeem", requireLogin, (req, res) => {
    res.send(
        renderPage(
            "Coin-Code",
            `
            <div class="hero">
                <h1><span class="gradient">Coin-Code</span></h1>
                <p>Jeder Code kann pro Benutzer nur einmal verwendet werden.</p>
            </div>

            <div class="card" style="max-width:600px;margin:auto;">

                <form method="POST" action="/redeem">

                    <label>Code</label>

                    <input
                        name="code"
                        required
                        placeholder="NB-XXXXXX"
                    >

                    <button type="submit">
                        🪙 Einlösen
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/redeem", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const codeValue = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const codes = getCodes();

    const code = codes.find(
        c => c.code.toUpperCase() === codeValue
    );

    if (!code) {
        return res.status(400).send(
            renderPage(
                "Code",
                `
                <div class="card danger">
                    <h2>❌ Code nicht gefunden.</h2>
                </div>
                `,
                req
            )
        );
    }

    if (!code.active) {
        return res.status(400).send(
            renderPage(
                "Code",
                `
                <div class="card danger">
                    <h2>❌ Dieser Code ist deaktiviert.</h2>
                </div>
                `,
                req
            )
        );
    }

    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
        return res.status(400).send(
            renderPage(
                "Code",
                `
                <div class="card danger">
                    <h2>❌ Dieser Code ist abgelaufen.</h2>
                </div>
                `,
                req
            )
        );
    }

    code.usedBy = code.usedBy || [];

    if (code.usedBy.includes(user.id)) {
        return res.status(400).send(
            renderPage(
                "Code",
                `
                <div class="card warning">
                    <h2>⚠️ Bereits eingelöst</h2>
                    <p>Du hast diesen Code bereits verwendet.</p>
                </div>
                `,
                req
            )
        );
    }

    code.usedBy.push(user.id);

    const users = getUsers();
    const databaseUser = users.find(u => u.id === user.id);

    databaseUser.coins += Number(code.coins);

    saveCodes(codes);
    saveUsers(users);

    addLog(
        "COIN_CODE",
        `${user.email} hat Code ${code.code} eingelöst und ${code.coins} Coins erhalten.`,
        user
    );

    res.send(
        renderPage(
            "Erfolgreich",
            `
            <div class="card success center">
                <h1>✅ Erfolgreich!</h1>
                <p>
                    Du hast
                    <b>${code.coins} Coins</b>
                    erhalten.
                </p>

                <a class="button" href="/dashboard">
                    Zum Dashboard
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

app.get("/shop", (req, res) => {
    const products = getProducts().filter(
        p => p.active !== false
    );

    res.send(
        renderPage(
            "Shop",
            `
            <div class="hero">
                <h1><span class="gradient">Coin-Shop</span></h1>
                <p>Kaufe Produkte mit deinen Coins.</p>
            </div>

            <div class="grid">

                ${
                    products.length
                        ? products.map(p => `
                            <div class="card">
                                <span class="badge">
                                    ${p.price} Coins
                                </span>

                                <h2>
                                    ${escapeHTML(p.name)}
                                </h2>

                                <p>
                                    ${escapeHTML(p.description)}
                                </p>

                                <p>
                                    Bestand:
                                    ${p.stock === -1 ? "∞" : p.stock}
                                </p>

                                ${
                                    getCurrentUser(req)
                                        ? `
                                        <form method="POST" action="/shop/buy">

                                            <input
                                                type="hidden"
                                                name="productId"
                                                value="${escapeHTML(p.id)}"
                                            >

                                            <button
                                                ${p.stock === 0 ? "disabled" : ""}
                                            >
                                                🛒 Kaufen
                                            </button>

                                        </form>
                                        `
                                        : `
                                        <a class="button" href="/login">
                                            Einloggen
                                        </a>
                                        `
                                }

                            </div>
                        `).join("")
                        : `
                        <div class="card center">
                            <h2>🛒 Noch keine Produkte</h2>
                            <p>Das Team hat noch keine Produkte hinzugefügt.</p>
                        </div>
                        `
                }

            </div>
            `,
            req
        )
    );
});

app.post("/shop/buy", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const products = getProducts();
    const product = products.find(
        p => p.id === req.body.productId
    );

    if (!product || product.active === false) {
        return res.status(404).send("Produkt nicht gefunden.");
    }

    if (
        product.stock !== -1 &&
        product.stock <= 0
    ) {
        return res.status(400).send("Nicht mehr verfügbar.");
    }

    if (user.coins < product.price) {
        return res.status(400).send(
            renderPage(
                "Shop",
                `
                <div class="card danger">
                    <h2>❌ Nicht genug Coins</h2>
                    <p>
                        Du brauchst ${product.price} Coins.
                    </p>
                    <p>
                        Du hast ${user.coins} Coins.
                    </p>
                </div>
                `,
                req
            )
        );
    }

    const users = getUsers();
    const databaseUser = users.find(u => u.id === user.id);

    databaseUser.coins -= product.price;

    if (product.stock !== -1) {
        product.stock--;
    }

    saveUsers(users);
    saveProducts(products);

    const orders = getOrders();

    const order = {
        id: id("order_"),
        orderNumber: generateOrderNumber(),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        productId: product.id,
        productName: product.name,
        price: product.price,
        status: "offen",
        createdAt: now()
    };

    orders.unshift(order);

    saveOrders(orders);

    addLog(
        "SHOP_ORDER",
        `${user.email} hat ${product.name} bestellt. Bestellnummer: ${order.orderNumber}`,
        user
    );

    res.send(
        renderPage(
            "Bestellung",
            `
            <div class="card success center">

                <h1>✅ Bestellung erstellt</h1>

                <p>
                    Produkt:
                    <b>${escapeHTML(product.name)}</b>
                </p>

                <p>
                    Bestellnummer:
                    <b>${escapeHTML(order.orderNumber)}</b>
                </p>

                <p>
                    Das Team kann deine Bestellung jetzt bearbeiten.
                </p>

                <a class="button" href="/dashboard">
                    Dashboard
                </a>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// USER CHAT
// ============================================================

app.get("/chat", requireLogin, (req, res) => {
    const user = getCurrentUser(req);
    const chats = getChats();

    res.send(
        renderPage(
            "Chat",
            `
            <div class="hero">
                <h1><span class="gradient">Community Chat</span></h1>
            </div>

            <div class="card">

                <div class="chat">

                    ${chats.map(m => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(m.userName)}
                            </strong>

                            <span class="badge">
                                ${escapeHTML(m.role)}
                            </span>

                            <p>
                                ${escapeHTML(m.text)}
                            </p>

                            <span class="muted">
                                ${formatDate(m.createdAt)}
                            </span>
                        </div>
                    `).join("")}

                </div>

                <form method="POST" action="/chat">

                    <label>Nachricht</label>

                    <textarea
                        name="text"
                        maxlength="1000"
                        required
                        placeholder="Schreibe etwas..."
                    ></textarea>

                    <button type="submit">
                        💬 Senden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/chat", requireLogin, (req, res) => {
    const user = getCurrentUser(req);
    const chats = getChats();

    chats.push({
        id: id("chat_"),
        userId: user.id,
        userName: user.name,
        role: user.role,
        text: String(req.body.text || "").trim(),
        createdAt: now()
    });

    if (chats.length > 1000) {
        chats.splice(0, chats.length - 1000);
    }

    saveChats(chats);

    addLog(
        "CHAT",
        `${user.email} hat im Community-Chat geschrieben.`,
        user
    );

    res.redirect("/chat");
});

// ============================================================
// TEAM CHAT
// ============================================================

app.get("/team-chat", requireStaff, (req, res) => {
    const messages = getTeamChat();

    res.send(
        renderPage(
            "Team-Chat",
            `
            <div class="hero">
                <h1><span class="gradient">Team-Chat</span></h1>
                <p>Nur Teammitglieder können diesen Bereich sehen.</p>
            </div>

            <div class="card">

                <div class="chat">

                    ${messages.map(m => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(m.userName)}
                            </strong>

                            <span class="badge">
                                ${escapeHTML(m.role)}
                            </span>

                            <p>${escapeHTML(m.text)}</p>

                            <span class="muted">
                                ${formatDate(m.createdAt)}
                            </span>
                        </div>
                    `).join("")}

                </div>

                <form method="POST" action="/team-chat">

                    <label>Team-Nachricht</label>

                    <textarea
                        name="text"
                        required
                        maxlength="2000"
                    ></textarea>

                    <button type="submit">
                        💬 Senden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/team-chat", requireStaff, (req, res) => {
    const user = getCurrentUser(req);
    const messages = getTeamChat();

    messages.push({
        id: id("team_"),
        userId: user.id,
        userName: user.name,
        role: user.role,
        text: String(req.body.text || "").trim(),
        createdAt: now()
    });

    if (messages.length > 2000) {
        messages.splice(0, messages.length - 2000);
    }

    saveTeamChat(messages);

    addLog(
        "TEAM_CHAT",
        `${user.email} hat im Team-Chat geschrieben.`,
        user
    );

    res.redirect("/team-chat");
});

// ============================================================
// GEWINNSPIELE
// ============================================================

app.get("/giveaways", (req, res) => {
    const user = getCurrentUser(req);
    const giveaways = getGiveaways();

    res.send(
        renderPage(
            "Gewinnspiele",
            `
            <div class="hero">
                <h1><span class="gradient">🎁 Gewinnspiele</span></h1>
                <p>Nimm an unseren Community-Gewinnspielen teil.</p>
            </div>

            <div class="grid">

                ${
                    giveaways.length
                        ? giveaways.map(g => {
                            const joined =
                                user &&
                                g.participants.includes(user.id);

                            return `
                            <div class="card">

                                <span class="badge">
                                    ${g.ended ? "Beendet" : "Aktiv"}
                                </span>

                                <h2>${escapeHTML(g.title)}</h2>

                                <p>
                                    ${escapeHTML(g.description)}
                                </p>

                                <p>
                                    🎁 Gewinn:
                                    <b>${escapeHTML(g.prize)}</b>
                                </p>

                                <p>
                                    👥 ${g.participants.length}
                                    Teilnehmer
                                </p>

                                ${
                                    !g.ended && user && !joined
                                        ? `
                                        <form method="POST" action="/giveaways/join">

                                            <input
                                                type="hidden"
                                                name="giveawayId"
                                                value="${escapeHTML(g.id)}"
                                            >

                                            <button>
                                                🎁 Teilnehmen
                                            </button>

                                        </form>
                                        `
                                        : joined
                                            ? `<span class="badge">✅ Du nimmst teil</span>`
                                            : ""
                                }

                            </div>
                            `;
                        }).join("")
                        : `
                        <div class="card center">
                            <h2>Keine Gewinnspiele</h2>
                            <p>Momentan läuft kein Gewinnspiel.</p>
                        </div>
                        `
                }

            </div>
            `,
            req
        )
    );
});

app.post("/giveaways/join", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    const giveaways = getGiveaways();

    const giveaway = giveaways.find(
        g => g.id === req.body.giveawayId
    );

    if (!giveaway || giveaway.ended) {
        return res.status(400).send("Gewinnspiel nicht verfügbar.");
    }

    if (!giveaway.participants.includes(user.id)) {
        giveaway.participants.push(user.id);
        saveGiveaways(giveaways);

        addLog(
            "GIVEAWAY_JOIN",
            `${user.email} nimmt an ${giveaway.title} teil.`,
            user
        );
    }

    res.redirect("/giveaways");
});

// ============================================================
// ANKÜNDIGUNGEN
// ============================================================

app.get("/announcement", (req, res) => {
    const announcements = getAnnouncements();

    res.send(
        renderPage(
            "Ankündigungen",
            `
            <div class="hero">
                <h1><span class="gradient">📢 Ankündigungen</span></h1>
            </div>

            ${announcements.map(a => `
                <div class="card">

                    <h2>${escapeHTML(a.title)}</h2>

                    <p>
                        ${escapeHTML(a.text)}
                    </p>

                    <span class="muted">
                        ${formatDate(a.createdAt)}
                    </span>

                </div>
            `).join("")}
            `,
            req
        )
    );
});

// ============================================================
// ADMIN PANEL
// ============================================================

app.get("/admin", requireAdmin, (req, res) => {
    const users = getUsers();
    const tickets = getTickets();
    const codes = getCodes();
    const products = getProducts();
    const orders = getOrders();
    const giveaways = getGiveaways();
    const logs = getLogs();
    const announcements = getAnnouncements();
    const settings = getSettings();

    const openTickets = tickets.filter(
        t => t.status !== "geschlossen"
    ).length;

    res.send(
        renderPage(
            "Admin Panel",
            `
            <div class="hero">
                <h1><span class="gradient">Admin Panel</span></h1>
                <p>
                    Willkommen ${escapeHTML(getCurrentUser(req).name)}.
                </p>
            </div>

            <div class="grid">

                <div class="card center">
                    <div class="kpi">Benutzer</div>
                    <div class="stat">${users.length}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Offene Tickets</div>
                    <div class="stat">${openTickets}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Coin-Codes</div>
                    <div class="stat">${codes.length}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Produkte</div>
                    <div class="stat">${products.length}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Bestellungen</div>
                    <div class="stat">${orders.length}</div>
                </div>

                <div class="card center">
                    <div class="kpi">Gewinnspiele</div>
                    <div class="stat">${giveaways.length}</div>
                </div>

            </div>

            <div class="grid">

                <div class="card">
                    <h2>🔑 Coin-Codes</h2>
                    <p>Codes erstellen und verwalten.</p>
                    <a class="button" href="/admin/codes">
                        Codes öffnen
                    </a>
                </div>

                <div class="card">
                    <h2>👥 Benutzer</h2>
                    <p>Registrierte Benutzer verwalten.</p>
                    <a class="button" href="/admin/users">
                        Benutzer öffnen
                    </a>
                </div>

                <div class="card">
                    <h2>🎟️ Tickets</h2>
                    <p>Support-Tickets verwalten.</p>
                    <a class="button" href="/admin/tickets">
                        Tickets öffnen
                    </a>
                </div>

                <div class="card">
                    <h2>🛒 Shop</h2>
                    <p>Produkte hinzufügen und verwalten.</p>
                    <a class="button" href="/admin/products">
                        Shop verwalten
                    </a>
                </div>

                <div class="card">
                    <h2>📦 Bestellungen</h2>
                    <p>Produktbestellungen ansehen.</p>
                    <a class="button" href="/admin/orders">
                        Bestellungen
                    </a>
                </div>

                <div class="card">
                    <h2>🎁 Gewinnspiele</h2>
                    <p>Gewinnspiele für Benutzer erstellen.</p>
                    <a class="button" href="/admin/giveaways">
                        Gewinnspiele
                    </a>
                </div>

                <div class="card">
                    <h2>📢 Ankündigungen</h2>
                    <a class="button" href="/admin/announcements">
                        Verwalten
                    </a>
                </div>

                <div class="card">
                    <h2>🛠️ Status</h2>
                    <a class="button" href="/admin/status">
                        Wartung / Störung
                    </a>
                </div>

                <div class="card">
                    <h2>📋 Logs</h2>
                    <a class="button" href="/admin/logs">
                        Logs anzeigen
                    </a>
                </div>

                <div class="card">
                    <h2>👨‍💻 Beta-Nummern</h2>
                    <a class="button" href="/admin/beta">
                        Beta-System
                    </a>
                </div>

            </div>

            <div class="card">

                <h2>⚡ Schnellaktionen</h2>

                <form method="POST" action="/admin/coins/add">

                    <label>Benutzer-ID</label>
                    <input name="userId" required>

                    <label>Coins</label>
                    <input type="number" name="coins" min="1" required>

                    <button class="green">
                        🪙 Coins hinzufügen
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// ADMIN COINS
// ============================================================

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = getCodes();

    res.send(
        renderPage(
            "Coin-Codes",
            `
            <div class="hero">
                <h1><span class="gradient">🔑 Coin-Codes</span></h1>
            </div>

            <div class="card">

                <h2>Neuen Code erstellen</h2>

                <form method="POST" action="/admin/codes/create">

                    <label>Coins</label>
                    <input
                        type="number"
                        name="coins"
                        min="1"
                        required
                        value="100"
                    >

                    <label>Eigener Code (optional)</label>
                    <input
                        name="code"
                        placeholder="Leer lassen für automatischen Code"
                    >

                    <button type="submit">
                        🔑 Code erstellen
                    </button>

                </form>

            </div>

            <div class="card">

                <h2>Alle Codes</h2>

                <div class="table-wrap">

                <table>

                    <tr>
                        <th>Code</th>
                        <th>Coins</th>
                        <th>Status</th>
                        <th>Benutzt</th>
                        <th>Aktion</th>
                    </tr>

                    ${codes.map(c => `
                        <tr>

                            <td>
                                <b>${escapeHTML(c.code)}</b>
                            </td>

                            <td>
                                🪙 ${c.coins}
                            </td>

                            <td>
                                ${c.active ? "🟢 Aktiv" : "🔴 Inaktiv"}
                            </td>

                            <td>
                                ${c.usedBy?.length || 0}
                            </td>

                            <td>

                                <form method="POST" action="/admin/codes/toggle">
                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(c.id)}"
                                    >
                                    <button class="warning">
                                        ${c.active ? "Deaktivieren" : "Aktivieren"}
                                    </button>
                                </form>

                            </td>

                        </tr>
                    `).join("")}

                </table>

                </div>

            </div>
            `,
            req
        )
    );
});

app.post("/admin/codes/create", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);

    const codes = getCodes();

    let code = String(req.body.code || "").trim().toUpperCase();

    if (!code) {
        code = randomCode("NB");
    }

    if (codes.some(c => c.code === code)) {
        return res.status(400).send("Code existiert bereits.");
    }

    const newCode = {
        id: id("code_"),
        code,
        coins: Number(req.body.coins),
        active: true,
        usedBy: [],
        createdBy: user.id,
        createdByName: user.name,
        createdAt: now(),
        expiresAt: null
    };

    codes.unshift(newCode);

    saveCodes(codes);

    addLog(
        "CODE_CREATE",
        `${user.name} hat Coin-Code ${code} mit ${newCode.coins} Coins erstellt.`,
        user
    );

    res.redirect("/admin/codes");
});

app.post("/admin/codes/toggle", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);

    const codes = getCodes();

    const code = codes.find(
        c => c.id === req.body.id
    );

    if (code) {
        code.active = !code.active;

        saveCodes(codes);

        addLog(
            "CODE_TOGGLE",
            `${user.name} hat Coin-Code ${code.code} geändert.`,
            user
        );
    }

    res.redirect("/admin/codes");
});

// ============================================================
// ADMIN USERS
// ============================================================

app.get("/admin/users", requireAdmin, (req, res) => {
    const users = getUsers();

    res.send(
        renderPage(
            "Benutzer",
            `
            <div class="hero">
                <h1><span class="gradient">👥 Benutzer</span></h1>
                <p>Alle registrierten Benutzer.</p>
            </div>

            <div class="card">

            <div class="table-wrap">

            <table>

                <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Rolle</th>
                    <th>Coins</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                </tr>

                ${users.map(u => `
                    <tr>

                        <td>
                            <b>${escapeHTML(u.name)}</b>
                        </td>

                        <td>
                            ${escapeHTML(u.email)}
                        </td>

                        <td>
                            <span class="badge">
                                ${escapeHTML(u.role)}
                            </span>
                        </td>

                        <td>
                            🪙 ${u.coins}
                        </td>

                        <td>
                            ${
                                u.bannedUntil &&
                                new Date(u.bannedUntil) > new Date()
                                    ? "🔨 Gebannt"
                                    : u.kickedUntil &&
                                      new Date(u.kickedUntil) > new Date()
                                        ? "👢 Kick"
                                        : "🟢 Aktiv"
                            }
                        </td>

                        <td>

                            <form method="POST" action="/admin/users/coins">

                                <input
                                    type="hidden"
                                    name="userId"
                                    value="${escapeHTML(u.id)}"
                                >

                                <input
                                    type="number"
                                    name="coins"
                                    placeholder="Coins"
                                    min="0"
                                >

                                <button>
                                    Coins
                                </button>

                            </form>

                            <form method="POST" action="/admin/users/role">

                                <input
                                    type="hidden"
                                    name="userId"
                                    value="${escapeHTML(u.id)}"
                                >

                                <select name="role">
                                    <option value="user">User</option>
                                    <option value="developer">Developer</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                    <option value="owner">Owner</option>
                                </select>

                                <button>
                                    Rolle
                                </button>

                            </form>

                            <form method="POST" action="/admin/users/ban">

                                <input
                                    type="hidden"
                                    name="userId"
                                    value="${escapeHTML(u.id)}"
                                >

                                <input
                                    name="reason"
                                    placeholder="Ban-Grund"
                                    required
                                >

                                <select name="duration">
                                    <option value="1h">1 Stunde</option>
                                    <option value="6h">6 Stunden</option>
                                    <option value="1d">1 Tag</option>
                                    <option value="7d">7 Tage</option>
                                    <option value="30d">30 Tage</option>
                                    <option value="permanent">Permanent</option>
                                </select>

                                <button class="danger">
                                    🔨 Ban
                                </button>

                            </form>

                            <form method="POST" action="/admin/users/kick">

                                <input
                                    type="hidden"
                                    name="userId"
                                    value="${escapeHTML(u.id)}"
                                >

                                <input
                                    name="reason"
                                    placeholder="Kick-Grund"
                                    required
                                >

                                <button class="warning">
                                    👢 Kick
                                </button>

                            </form>

                            <form method="POST" action="/admin/users/unban">

                                <input
                                    type="hidden"
                                    name="userId"
                                    value="${escapeHTML(u.id)}"
                                >

                                <button class="green">
                                    🔓 Entbannen
                                </button>

                            </form>

                        </td>

                    </tr>
                `).join("")}

            </table>

            </div>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// ADMIN COINS USER
// ============================================================

app.post("/admin/coins/add", requireAdmin, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.body.userId);

    if (!user) {
        return res.status(404).send("Benutzer nicht gefunden.");
    }

    const amount = Number(req.body.coins);

    user.coins += amount;

    saveUsers(users);

    addLog(
        "ADMIN_COINS",
        `${getCurrentUser(req).name} hat ${amount} Coins an ${user.email} vergeben.`,
        getCurrentUser(req)
    );

    res.redirect("/admin");
});

app.post("/admin/users/coins", requireAdmin, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.body.userId);

    if (!user) {
        return res.status(404).send("Nicht gefunden.");
    }

    const amount = Number(req.body.coins);

    if (amount >= 0) {
        user.coins = amount;
    }

    saveUsers(users);

    addLog(
        "ADMIN_COINS_SET",
        `${getCurrentUser(req).name} hat die Coins von ${user.email} auf ${amount} gesetzt.`,
        getCurrentUser(req)
    );

    res.redirect("/admin/users");
});

// ============================================================
// ROLLEN
// ============================================================

app.post("/admin/users/role", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const users = getUsers();
    const user = users.find(u => u.id === req.body.userId);

    if (!user) {
        return res.status(404).send("Nicht gefunden.");
    }

    const requestedRole = normalizeRole(req.body.role);

    // Owner darf alles
    if (admin.email !== OWNER_EMAIL) {
        if (
            ROLE_LEVELS[requestedRole] >=
            ROLE_LEVELS.owner
        ) {
            return res.status(403).send(
                "Nur der Owner darf Owner vergeben."
            );
        }
    }

    user.role = requestedRole;

    saveUsers(users);

    addLog(
        "ROLE_CHANGE",
        `${admin.name} hat ${user.email} die Rolle ${requestedRole} gegeben.`,
        admin
    );

    res.redirect("/admin/users");
});

// ============================================================
// BAN
// ============================================================

function durationToMilliseconds(duration) {
    switch (duration) {
        case "1h":
            return 60 * 60 * 1000;
        case "6h":
            return 6 * 60 * 60 * 1000;
        case "1d":
            return 24 * 60 * 60 * 1000;
        case "7d":
            return 7 * 24 * 60 * 60 * 1000;
        case "30d":
            return 30 * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
}

app.post("/admin/users/ban", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.userId
    );

    if (!user) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        user.email === OWNER_EMAIL &&
        admin.email !== OWNER_EMAIL
    ) {
        return res.status(403).send(
            "Der Owner kann nicht gebannt werden."
        );
    }

    const duration = durationToMilliseconds(
        req.body.duration
    );

    user.banReason = String(
        req.body.reason || "Kein Grund"
    );

    user.bannedUntil = duration
        ? new Date(Date.now() + duration).toISOString()
        : "9999-12-31T23:59:59.999Z";

    saveUsers(users);

    addLog(
        "BAN",
        `${admin.name} hat ${user.email} gebannt. Grund: ${user.banReason}`,
        admin
    );

    res.redirect("/admin/users");
});

// ============================================================
// UNBAN
// ============================================================

app.post("/admin/users/unban", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.userId
    );

    if (!user) {
        return res.status(404).send("Nicht gefunden.");
    }

    user.bannedUntil = null;
    user.banReason = null;

    saveUsers(users);

    addLog(
        "UNBAN",
        `${admin.name} hat ${user.email} entbannt.`,
        admin
    );

    res.redirect("/admin/users");
});

// ============================================================
// KICK
// ============================================================

app.post("/admin/users/kick", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.userId
    );

    if (!user) {
        return res.status(404).send("Nicht gefunden.");
    }

    if (
        user.email === OWNER_EMAIL &&
        admin.email !== OWNER_EMAIL
    ) {
        return res.status(403).send(
            "Der Owner kann nicht gekickt werden."
        );
    }

    user.kickReason = String(
        req.body.reason || "Kein Grund"
    );

    user.kickedUntil =
        new Date(
            Date.now() + 10 * 60 * 1000
        ).toISOString();

    saveUsers(users);

    addLog(
        "KICK",
        `${admin.name} hat ${user.email} gekickt. Grund: ${user.kickReason}`,
        admin
    );

    res.redirect("/admin/users");
});

// ============================================================
// ADMIN TICKETS
// ============================================================

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = getTickets();

    res.send(
        renderPage(
            "Ticketverwaltung",
            `
            <div class="hero">
                <h1><span class="gradient">🎟️ Tickets</span></h1>
            </div>

            <div class="grid">

            ${tickets.map(t => `
                <div class="card">

                    <span class="badge">
                        ${escapeHTML(t.status)}
                    </span>

                    <h2>
                        ${escapeHTML(t.subject)}
                    </h2>

                    <p>
                        Benutzer:
                        <b>${escapeHTML(t.userName)}</b>
                    </p>

                    <p>
                        ${escapeHTML(t.userEmail)}
                    </p>

                    <p>
                        ${escapeHTML(t.message)}
                    </p>

                    <a class="button" href="/tickets/${t.id}">
                        Ticket öffnen
                    </a>

                </div>
            `).join("")}

            </div>
            `,
            req
        )
    );
});

// ============================================================
// SHOP ADMIN
// ============================================================

app.get("/admin/products", requireAdmin, (req, res) => {
    const products = getProducts();

    res.send(
        renderPage(
            "Produkte",
            `
            <div class="hero">
                <h1><span class="gradient">🛒 Shop verwalten</span></h1>
            </div>

            <div class="card">

                <h2>Produkt hinzufügen</h2>

                <form method="POST" action="/admin/products/create">

                    <label>Name</label>
                    <input name="name" required>

                    <label>Beschreibung</label>
                    <textarea name="description" required></textarea>

                    <label>Preis in Coins</label>
                    <input
                        type="number"
                        name="price"
                        min="1"
                        required
                    >

                    <label>Bestand (-1 = unendlich)</label>
                    <input
                        type="number"
                        name="stock"
                        value="-1"
                        required
                    >

                    <button type="submit">
                        Produkt erstellen
                    </button>

                </form>

            </div>

            <div class="grid">

                ${products.map(p => `
                    <div class="card">

                        <h2>${escapeHTML(p.name)}</h2>

                        <p>
                            ${escapeHTML(p.description)}
                        </p>

                        <p>
                            🪙 ${p.price}
                        </p>

                        <p>
                            Bestand:
                            ${p.stock === -1 ? "∞" : p.stock}
                        </p>

                        <form method="POST" action="/admin/products/toggle">

                            <input
                                type="hidden"
                                name="id"
                                value="${escapeHTML(p.id)}"
                            >

                            <button class="warning">
                                ${p.active === false ? "Aktivieren" : "Deaktivieren"}
                            </button>

                        </form>

                    </div>
                `).join("")}

            </div>
            `,
            req
        )
    );
});

app.post("/admin/products/create", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const products = getProducts();

    const product = {
        id: id("product_"),
        name: String(req.body.name || "").trim(),
        description: String(req.body.description || "").trim(),
        price: Number(req.body.price),
        stock: Number(req.body.stock),
        active: true,
        createdBy: admin.id,
        createdAt: now()
    };

    products.unshift(product);

    saveProducts(products);

    addLog(
        "PRODUCT_CREATE",
        `${admin.name} hat Produkt ${product.name} erstellt.`,
        admin
    );

    res.redirect("/admin/products");
});

app.post("/admin/products/toggle", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const products = getProducts();

    const product = products.find(
        p => p.id === req.body.id
    );

    if (product) {
        product.active = product.active === false;

        saveProducts(products);

        addLog(
            "PRODUCT_TOGGLE",
            `${admin.name} hat Produkt ${product.name} geändert.`,
            admin
        );
    }

    res.redirect("/admin/products");
});

// ============================================================
// BESTELLUNGEN
// ============================================================

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = getOrders();

    res.send(
        renderPage(
            "Bestellungen",
            `
            <div class="hero">
                <h1><span class="gradient">📦 Bestellungen</span></h1>
            </div>

            <div class="card">

            <div class="table-wrap">

            <table>

                <tr>
                    <th>Bestellnummer</th>
                    <th>User</th>
                    <th>Produkt</th>
                    <th>Coins</th>
                    <th>Status</th>
                    <th>Datum</th>
                </tr>

                ${orders.map(o => `
                    <tr>
                        <td>
                            <b>${escapeHTML(o.orderNumber)}</b>
                        </td>

                        <td>
                            ${escapeHTML(o.userName)}<br>
                            ${escapeHTML(o.userEmail)}
                        </td>

                        <td>
                            ${escapeHTML(o.productName)}
                        </td>

                        <td>
                            🪙 ${o.price}
                        </td>

                        <td>
                            ${escapeHTML(o.status)}
                        </td>

                        <td>
                            ${formatDate(o.createdAt)}
                        </td>
                    </tr>
                `).join("")}

            </table>

            </div>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// ADMIN GEWINNSPIELE
// ============================================================

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = getGiveaways();

    res.send(
        renderPage(
            "Gewinnspiele",
            `
            <div class="hero">
                <h1><span class="gradient">🎁 Gewinnspiele</span></h1>
            </div>

            <div class="card">

                <form method="POST" action="/admin/giveaways/create">

                    <label>Titel</label>
                    <input name="title" required>

                    <label>Beschreibung</label>
                    <textarea name="description" required></textarea>

                    <label>Gewinn</label>
                    <input
                        name="prize"
                        required
                        placeholder="z.B. 500 Coins"
                    >

                    <button type="submit">
                        🎁 Gewinnspiel erstellen
                    </button>

                </form>

            </div>

            <div class="grid">

                ${giveaways.map(g => `
                    <div class="card">

                        <span class="badge">
                            ${g.ended ? "Beendet" : "Aktiv"}
                        </span>

                        <h2>${escapeHTML(g.title)}</h2>

                        <p>${escapeHTML(g.description)}</p>

                        <p>
                            Gewinn:
                            <b>${escapeHTML(g.prize)}</b>
                        </p>

                        <p>
                            Teilnehmer:
                            ${g.participants.length}
                        </p>

                        ${
                            !g.ended
                                ? `
                                <form method="POST" action="/admin/giveaways/end">

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${escapeHTML(g.id)}"
                                    >

                                    <button class="danger">
                                        Gewinnspiel beenden
                                    </button>

                                </form>
                                `
                                : ""
                        }

                    </div>
                `).join("")}

            </div>
            `,
            req
        )
    );
});

app.post("/admin/giveaways/create", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const giveaways = getGiveaways();

    const giveaway = {
        id: id("giveaway_"),
        title: String(req.body.title || "").trim(),
        description: String(req.body.description || "").trim(),
        prize: String(req.body.prize || "").trim(),
        participants: [],
        ended: false,
        winnerId: null,
        createdBy: admin.id,
        createdAt: now()
    };

    giveaways.unshift(giveaway);

    saveGiveaways(giveaways);

    addLog(
        "GIVEAWAY_CREATE",
        `${admin.name} hat Gewinnspiel ${giveaway.title} erstellt.`,
        admin
    );

    res.redirect("/admin/giveaways");
});

app.post("/admin/giveaways/end", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const giveaways = getGiveaways();

    const giveaway = giveaways.find(
        g => g.id === req.body.id
    );

    if (!giveaway) {
        return res.status(404).send("Nicht gefunden.");
    }

    giveaway.ended = true;

    if (giveaway.participants.length > 0) {
        const winnerIndex =
            Math.floor(
                Math.random() *
                giveaway.participants.length
            );

        giveaway.winnerId =
            giveaway.participants[winnerIndex];

        const users = getUsers();

        const winner = users.find(
            u => u.id === giveaway.winnerId
        );

        // Wenn Gewinn z.B. "500 Coins" enthält,
        // werden die Coins automatisch gutgeschrieben.
        const match =
            String(giveaway.prize).match(/(\\d+)/);

        if (winner && match) {
            const coins = Number(match[1]);
            winner.coins += coins;
            saveUsers(users);

            addLog(
                "GIVEAWAY_WINNER",
                `${winner.name} hat das Gewinnspiel ${giveaway.title} gewonnen und ${coins} Coins erhalten.`,
                winner
            );
        }
    }

    saveGiveaways(giveaways);

    addLog(
        "GIVEAWAY_END",
        `${admin.name} hat Gewinnspiel ${giveaway.title} beendet.`,
        admin
    );

    res.redirect("/admin/giveaways");
});

// ============================================================
// ANKÜNDIGUNGEN ADMIN
// ============================================================

app.get("/admin/announcements", requireAdmin, (req, res) => {
    const announcements = getAnnouncements();

    res.send(
        renderPage(
            "Ankündigungen",
            `
            <div class="hero">
                <h1><span class="gradient">📢 Ankündigungen</span></h1>
            </div>

            <div class="card">

                <form method="POST" action="/admin/announcements/create">

                    <label>Titel</label>
                    <input name="title" required>

                    <label>Text</label>
                    <textarea name="text" required></textarea>

                    <button type="submit">
                        📢 Veröffentlichen
                    </button>

                </form>

            </div>

            ${announcements.map(a => `
                <div class="card">

                    <h2>${escapeHTML(a.title)}</h2>

                    <p>${escapeHTML(a.text)}</p>

                    <span class="muted">
                        ${formatDate(a.createdAt)}
                    </span>

                </div>
            `).join("")}
            `,
            req
        )
    );
});

app.post(
    "/admin/announcements/create",
    requireAdmin,
    (req, res) => {
        const admin = getCurrentUser(req);

        const announcements = getAnnouncements();

        announcements.unshift({
            id: id("announcement_"),
            title: String(req.body.title || "").trim(),
            text: String(req.body.text || "").trim(),
            createdBy: admin.id,
            createdByName: admin.name,
            createdAt: now()
        });

        saveAnnouncements(announcements);

        addLog(
            "ANNOUNCEMENT",
            `${admin.name} hat eine Ankündigung veröffentlicht.`,
            admin
        );

        res.redirect("/admin/announcements");
    }
);

// ============================================================
// STATUS: WARTUNG / STÖRUNG
// ============================================================

app.get("/admin/status", requireAdmin, (req, res) => {
    const settings = getSettings();

    res.send(
        renderPage(
            "Status",
            `
            <div class="hero">
                <h1><span class="gradient">🛠️ Status-System</span></h1>
            </div>

            <div class="card">

                <h2>🛠️ Wartung</h2>

                <form method="POST" action="/admin/status/maintenance">

                    <label>Wartung aktiv</label>

                    <select name="enabled">
                        <option
                            value="false"
                            ${!settings.maintenance ? "selected" : ""}
                        >
                            Nein
                        </option>

                        <option
                            value="true"
                            ${settings.maintenance ? "selected" : ""}
                        >
                            Ja
                        </option>
                    </select>

                    <label>Wartungstext</label>

                    <textarea name="text">${escapeHTML(
                        settings.maintenanceText
                    )}</textarea>

                    <button type="submit">
                        Wartung speichern
                    </button>

                </form>

            </div>

            <div class="card">

                <h2>🔴 Störung</h2>

                <form method="POST" action="/admin/status/outage">

                    <label>Störung aktiv</label>

                    <select name="enabled">
                        <option
                            value="false"
                            ${!settings.outage ? "selected" : ""}
                        >
                            Nein
                        </option>

                        <option
                            value="true"
                            ${settings.outage ? "selected" : ""}
                        >
                            Ja
                        </option>
                    </select>

                    <label>Störungstext</label>

                    <textarea name="text">${escapeHTML(
                        settings.outageText
                    )}</textarea>

                    <label>Störungsstufe</label>

                    <select name="level">

                        <option
                            value="critical"
                            ${settings.outageLevel === "critical" ? "selected" : ""}
                        >
                            Kritisch
                        </option>

                        <option
                            value="warning"
                            ${settings.outageLevel === "warning" ? "selected" : ""}
                        >
                            Warnung
                        </option>

                    </select>

                    <button class="danger" type="submit">
                        Störung speichern
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post(
    "/admin/status/maintenance",
    requireAdmin,
    (req, res) => {
        const admin = getCurrentUser(req);

        const settings = getSettings();

        settings.maintenance =
            req.body.enabled === "true";

        settings.maintenanceText =
            String(req.body.text || "").trim();

        saveSettings(settings);

        addLog(
            "MAINTENANCE",
            `${admin.name} hat Wartungsstatus geändert.`,
            admin
        );

        res.redirect("/admin/status");
    }
);

app.post(
    "/admin/status/outage",
    requireAdmin,
    (req, res) => {
        const admin = getCurrentUser(req);

        const settings = getSettings();

        settings.outage =
            req.body.enabled === "true";

        settings.outageText =
            String(req.body.text || "").trim();

        settings.outageLevel =
            String(req.body.level || "critical");

        saveSettings(settings);

        addLog(
            "OUTAGE",
            `${admin.name} hat Störungsstatus geändert.`,
            admin
        );

        res.redirect("/admin/status");
    }
);

// ============================================================
// LOGS
// ============================================================

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = getLogs();

    res.send(
        renderPage(
            "Logs",
            `
            <div class="hero">
                <h1><span class="gradient">📋 Logs</span></h1>
                <p>Aktivitäten der Webseite.</p>
            </div>

            <div class="card">

            <div class="table-wrap">

            <table>

                <tr>
                    <th>Typ</th>
                    <th>Nachricht</th>
                    <th>User</th>
                    <th>Zeit</th>
                </tr>

                ${logs.slice(0, 500).map(l => `
                    <tr>

                        <td>
                            <span class="badge">
                                ${escapeHTML(l.type)}
                            </span>
                        </td>

                        <td>
                            ${escapeHTML(l.message)}
                        </td>

                        <td>
                            ${escapeHTML(l.userName || "-")}<br>
                            <span class="muted">
                                ${escapeHTML(l.userEmail || "")}
                            </span>
                        </td>

                        <td>
                            ${formatDate(l.createdAt)}
                        </td>

                    </tr>
                `).join("")}

            </table>

            </div>

            </div>
            `,
            req
        )
    );
});

// ============================================================
// BETA NUMMERN
// ============================================================

app.get("/admin/beta", requireAdmin, (req, res) => {
    const beta = getBeta();

    res.send(
        renderPage(
            "Beta-System",
            `
            <div class="hero">
                <h1><span class="gradient">👨‍💻 Beta-Nummern</span></h1>
                <p>
                    Beta-/Produktnummern für Developer,
                    Manager und Owner.
                </p>
            </div>

            <div class="card">

                <h2>Neue Nummer erstellen</h2>

                <form method="POST" action="/admin/beta/create">

                    <label>Typ</label>

                    <select name="type">
                        <option value="BETA">Beta</option>
                        <option value="PRODUCT">Produkt</option>
                        <option value="BUILD">Build</option>
                    </select>

                    <label>Beschreibung</label>

                    <textarea
                        name="description"
                        required
                    ></textarea>

                    <button type="submit">
                        Nummer erstellen
                    </button>

                </form>

            </div>

            <div class="card">

                <h2>Erstellte Nummern</h2>

                ${beta.map(b => `
                    <div class="message">

                        <span class="badge">
                            ${escapeHTML(b.type)}
                        </span>

                        <h3>
                            ${escapeHTML(b.number)}
                        </h3>

                        <p>
                            ${escapeHTML(b.description)}
                        </p>

                        <p>
                            Erstellt von:
                            <b>${escapeHTML(b.createdByName)}</b>
                        </p>

                        <span class="muted">
                            ${formatDate(b.createdAt)}
                        </span>

                    </div>
                `).join("")}

            </div>
            `,
            req
        )
    );
});

app.post("/admin/beta/create", requireAdmin, (req, res) => {
    const admin = getCurrentUser(req);

    const beta = getBeta();

    const type =
        String(req.body.type || "BETA").toUpperCase();

    let number;

    if (type === "PRODUCT") {
        number =
            "NB-PROD-" +
            Date.now().toString().slice(-8) +
            "-" +
            crypto.randomBytes(2).toString("hex").toUpperCase();
    } else if (type === "BUILD") {
        number =
            "NB-BUILD-" +
            Date.now().toString().slice(-8) +
            "-" +
            crypto.randomBytes(2).toString("hex").toUpperCase();
    } else {
        number = generateBetaNumber();
    }

    const entry = {
        id: id("beta_"),
        type,
        number,
        description: String(
            req.body.description || ""
        ).trim(),
        createdBy: admin.id,
        createdByName: admin.name,
        createdAt: now()
    };

    beta.unshift(entry);

    saveBeta(beta);

    addLog(
        "BETA_CREATE",
        `${admin.name} hat Nummer ${number} erstellt.`,
        admin
    );

    res.redirect("/admin/beta");
});

// ============================================================
// API - ÖFFENTLICHER STATUS
// ============================================================

app.get("/api/status", (req, res) => {
    const settings = getSettings();

    res.json({
        name: SITE_NAME,
        online: true,
        maintenance: settings.maintenance,
        outage: settings.outage,
        outageLevel: settings.outageLevel,
        updatedAt: now()
    });
});

// ============================================================
// API - USER INFO
// ============================================================

app.get("/api/me", requireLogin, (req, res) => {
    const user = getCurrentUser(req);

    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        coins: user.coins
    });
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
    res.status(404).send(
        renderPage(
            "404",
            `
            <div class="hero">
                <h1><span class="gradient">404</span></h1>
                <p>Diese Seite wurde nicht gefunden.</p>

                <a class="button" href="/">
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

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).send(
        renderPage(
            "Fehler",
            `
            <div class="card danger">
                <h1>❌ Interner Fehler</h1>
                <p>
                    Bei der Verarbeitung ist ein Fehler aufgetreten.
                </p>
                <a class="button" href="/">
                    Zur Startseite
                </a>
            </div>
            `,
            req
        )
    );
});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("==============================================");
    console.log("          NORTH-BOT-2 WEBSEITE");
    console.log("==============================================");
    console.log("Webseite läuft.");
    console.log("Port:", PORT);
    console.log("Owner:", OWNER_EMAIL);
    console.log("==============================================");
});
