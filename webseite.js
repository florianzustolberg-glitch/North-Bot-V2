/*
========================================================
 NORTH-BOT 2 - WEBSEITE
 Komplett neue Version
 Node.js + Express
 Keine .env
 Keine express-session
 JSON-Datenbank
========================================================
*/

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

/*
========================================================
 DATEIEN
========================================================
*/

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    sessions: path.join(DATA_DIR, "sessions.json"),
    messages: path.join(DATA_DIR, "messages.json"),
    teamMessages: path.join(DATA_DIR, "teamMessages.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    announcements: path.join(DATA_DIR, "announcements.json"),
    applications: path.join(DATA_DIR, "applications.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    settings: path.join(DATA_DIR, "settings.json")
};

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.sessions, []);
ensureFile(FILES.messages, []);
ensureFile(FILES.teamMessages, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.applications, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.settings, {
    maintenance: {
        enabled: false,
        title: "Wartung",
        text: "Die Webseite wird momentan gewartet."
    },
    outage: {
        enabled: false,
        title: "Störung",
        text: "Momentan gibt es eine technische Störung."
    }
});

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

        if (!raw) return fallback;

        return JSON.parse(raw);
    } catch (error) {
        console.error("JSON Fehler:", file, error.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

/*
========================================================
 ADMIN
========================================================

 Diese E-Mail ist automatisch Owner.
 Weitere Admins können im Admin-Panel hinzugefügt werden.
========================================================
*/

const OWNER_EMAIL = "florianzustolberg@gmail.com";

let adminEmails = [
    OWNER_EMAIL
];

function isAdminEmail(email) {
    if (!email) return false;

    return adminEmails.includes(String(email).toLowerCase());
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
 COOKIE SESSION SYSTEM
========================================================
*/

function createToken() {
    return crypto.randomBytes(48).toString("hex");
}

function setCookie(res, name, value, maxAgeSeconds) {
    const safeValue = encodeURIComponent(value);

    res.setHeader(
        "Set-Cookie",
        `${name}=${safeValue}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax`
    );
}

function clearCookie(res, name) {
    res.setHeader(
        "Set-Cookie",
        `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
    );
}

function getCookies(req) {
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

function getCurrentUser(req) {
    const cookies = getCookies(req);

    if (!cookies.north_session) {
        return null;
    }

    const sessions = readJSON(FILES.sessions, []);

    const session = sessions.find(
        s => s.token === cookies.north_session
    );

    if (!session) return null;

    if (session.expiresAt && Date.now() > session.expiresAt) {
        const remaining = sessions.filter(
            s => s.token !== cookies.north_session
        );

        writeJSON(FILES.sessions, remaining);
        return null;
    }

    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === session.userId
    );

    if (!user) return null;

    if (user.banned && user.banUntil) {
        if (Date.now() < user.banUntil) {
            return user;
        }

        user.banned = false;
        user.banReason = "";
        user.banUntil = null;

        writeJSON(FILES.users, users);
    }

    return user;
}

function loginUser(res, user) {
    const sessions = readJSON(FILES.sessions, []);

    const token = createToken();

    sessions.push({
        token,
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 30)
    });

    writeJSON(FILES.sessions, sessions);

    setCookie(
        res,
        "north_session",
        token,
        60 * 60 * 24 * 30
    );
}

function logoutUser(req, res) {
    const cookies = getCookies(req);

    if (cookies.north_session) {
        const sessions = readJSON(FILES.sessions, []);

        const filtered = sessions.filter(
            s => s.token !== cookies.north_session
        );

        writeJSON(FILES.sessions, filtered);
    }

    clearCookie(res, "north_session");
}

/*
========================================================
 PASSWORT HASHING
========================================================
*/

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    try {
        const [salt, originalHash] = stored.split(":");

        if (!salt || !originalHash) {
            return false;
        }

        const hash = crypto
            .scryptSync(password, salt, 64)
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(originalHash, "hex")
        );
    } catch {
        return false;
    }
}

/*
========================================================
 HILFSFUNKTIONEN
========================================================
*/

function id(prefix = "id") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function clean(value, max = 5000) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function escapeHTML(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(timestamp) {
    if (!timestamp) return "-";

    return new Date(timestamp).toLocaleString(
        "de-DE",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}

function generateCode() {
    const part = () =>
        crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();

    return `NORTH-${part()}-${part()}`;
}

function generateOrderNumber() {
    return `NB-${Date.now().toString().slice(-8)}-${crypto
        .randomBytes(2)
        .toString("hex")
        .toUpperCase()}`;
}

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
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

    if (!isAdminEmail(user.email)) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `
            <div class="card">
                <h1>Kein Zugriff</h1>
                <p>Du hast keine Berechtigung für diesen Bereich.</p>
                <a class="btn" href="/">Zur Startseite</a>
            </div>
            `
        ));
    }

    req.user = user;
    next();
}

function addLog(type, text, user = null, extra = {}) {
    const logs = readJSON(FILES.logs, []);

    logs.unshift({
        id: id("log"),
        type,
        text,
        userId: user ? user.id : null,
        email: user ? user.email : null,
        createdAt: Date.now(),
        ...extra
    });

    if (logs.length > 3000) {
        logs.length = 3000;
    }

    writeJSON(FILES.logs, logs);
}

/*
========================================================
 SEITEN DESIGN
========================================================
*/

function page(title, content, user = null) {
    const loggedIn = !!user;
    const admin = user && isAdminEmail(user.email);

    return `<!DOCTYPE html>
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
    font-family: Arial, Helvetica, sans-serif;
    background: #0b0d11;
    color: #f2f4f7;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 70px;
    border-bottom: 1px solid #242831;
    background: #101319;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-size: 22px;
    font-weight: 800;
}

.logo span {
    color: #7289da;
}

.navlinks {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.navlinks a {
    padding: 9px 13px;
    border-radius: 7px;
    color: #b7bdc8;
}

.navlinks a:hover {
    background: #1b1f27;
    color: white;
}

.container {
    max-width: 1180px;
    margin: auto;
    padding: 35px 20px;
}

.hero {
    padding: 70px 30px;
    border-bottom: 1px solid #252a33;
}

.hero-inner {
    max-width: 1180px;
    margin: auto;
}

.hero h1 {
    font-size: 46px;
    margin: 0 0 12px;
}

.hero p {
    max-width: 720px;
    color: #aeb5c1;
    font-size: 18px;
    line-height: 1.6;
}

.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
}

.grid2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
}

.card {
    background: #11151b;
    border: 1px solid #272d36;
    border-radius: 12px;
    padding: 22px;
    margin-bottom: 18px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #929aa7;
}

.stat {
    font-size: 30px;
    font-weight: 800;
    margin-top: 8px;
}

.btn {
    display: inline-block;
    border: 0;
    border-radius: 7px;
    padding: 11px 16px;
    background: #5865f2;
    color: white;
    cursor: pointer;
    font-size: 14px;
}

.btn:hover {
    background: #4752c4;
}

.btn.gray {
    background: #272d36;
}

.btn.red {
    background: #b83232;
}

.btn.green {
    background: #287b49;
}

.btn.orange {
    background: #9a6425;
}

input,
textarea,
select {
    width: 100%;
    padding: 12px;
    border: 1px solid #303640;
    border-radius: 7px;
    background: #0b0e13;
    color: white;
    outline: none;
    margin: 7px 0 14px;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    color: #b9c0ca;
    font-size: 14px;
}

.form {
    max-width: 550px;
    margin: 30px auto;
}

.alert {
    padding: 13px;
    border-radius: 8px;
    margin-bottom: 16px;
    background: #20252d;
    border: 1px solid #303640;
}

.alert.red {
    background: #33191b;
    border-color: #713236;
}

.alert.green {
    background: #173121;
    border-color: #2d6742;
}

.alert.orange {
    background: #342715;
    border-color: #705429;
}

.table {
    width: 100%;
    border-collapse: collapse;
}

.table th,
.table td {
    padding: 11px;
    border-bottom: 1px solid #282e37;
    text-align: left;
    vertical-align: top;
}

.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 20px;
    background: #262c35;
    color: #cbd0d8;
    font-size: 12px;
}

.badge.admin {
    background: #463f86;
}

.badge.owner {
    background: #7d3b3b;
}

.ticket {
    border: 1px solid #292f38;
    border-radius: 9px;
    padding: 16px;
    margin-bottom: 10px;
    background: #10141a;
}

.message {
    padding: 12px;
    border-bottom: 1px solid #252b34;
}

.message:last-child {
    border-bottom: 0;
}

.message-name {
    font-weight: 700;
}

.message-time {
    color: #737c88;
    font-size: 12px;
}

.coin {
    color: #f1c75b;
    font-weight: 800;
}

.product {
    border: 1px solid #2b313a;
    border-radius: 10px;
    padding: 18px;
}

.footer {
    border-top: 1px solid #252a32;
    margin-top: 60px;
    padding: 30px;
    color: #747d89;
    text-align: center;
}

.status {
    padding: 14px;
    margin-bottom: 15px;
    border-radius: 8px;
}

.status.maintenance {
    background: #392e16;
    border: 1px solid #705a2a;
}

.status.outage {
    background: #3a1b1b;
    border: 1px solid #753535;
}

.small {
    font-size: 13px;
}

.center {
    text-align: center;
}

@media(max-width: 800px) {
    .grid,
    .grid2 {
        grid-template-columns: 1fr;
    }

    .hero h1 {
        font-size: 34px;
    }

    .nav {
        height: auto;
        min-height: 70px;
        gap: 12px;
        padding: 15px;
        align-items: flex-start;
    }

    .navlinks {
        justify-content: flex-end;
    }

    .table {
        display: block;
        overflow-x: auto;
    }
}

</style>
</head>

<body>

<nav class="nav">

<a class="logo" href="/">
    NORTH<span>BOT</span>
</a>

<div class="navlinks">

<a href="/">Start</a>

${loggedIn ? `
<a href="/dashboard">Dashboard</a>
<a href="/tickets">Tickets</a>
<a href="/chat">Chat</a>
<a href="/shop">Shop</a>
<a href="/giveaways">Gewinnspiele</a>
<a href="/applications">Bewerbung</a>
<a href="/profile">Profil</a>
${admin ? `<a href="/admin">Admin</a>` : ""}
<a href="/logout">Logout</a>
` : `
<a href="/login">Login</a>
<a href="/register">Registrieren</a>
`}

</div>
</nav>

${content}

<footer class="footer">
    North Bot · Discord Community ·
    <a href="${DISCORD_INVITE}" target="_blank">Discord</a>
</footer>

</body>
</html>`;
}

/*
========================================================
 STATUS
========================================================
*/

function statusHTML() {
    const settings = readJSON(FILES.settings, {
        maintenance: { enabled: false },
        outage: { enabled: false }
    });

    let html = "";

    if (settings.maintenance.enabled) {
        html += `
        <div class="status maintenance">
            <strong>Wartung</strong><br>
            ${escapeHTML(settings.maintenance.title)}<br>
            <span class="small">
                ${escapeHTML(settings.maintenance.text)}
            </span>
        </div>
        `;
    }

    if (settings.outage.enabled) {
        html += `
        <div class="status outage">
            <strong>Störung</strong><br>
            ${escapeHTML(settings.outage.title)}<br>
            <span class="small">
                ${escapeHTML(settings.outage.text)}
            </span>
        </div>
        `;
    }

    return html;
}

/*
========================================================
 STARTSEITE
========================================================
*/

app.get("/", (req, res) => {
    const user = getCurrentUser(req);

    res.send(page(
        "Startseite",
        `
        <section class="hero">
            <div class="hero-inner">
                ${statusHTML()}

                <h1>North Bot</h1>

                <p>
                    Community-Webseite für North Bot.
                    Konten, Tickets, Coins, Shop, Gewinnspiele,
                    Bewerbungen und Verwaltung an einem Ort.
                </p>

                ${
                    user
                    ? `
                    <a class="btn" href="/dashboard">
                        Zum Dashboard
                    </a>
                    `
                    : `
                    <a class="btn" href="/register">
                        Konto erstellen
                    </a>

                    <a class="btn gray" href="/login">
                        Einloggen
                    </a>
                    `
                }
            </div>
        </section>

        <div class="container">

            <div class="grid">

                <div class="card">
                    <h3>Tickets</h3>
                    <p class="muted">
                        Erstelle Support-Tickets und behalte deine Anfragen
                        im Blick.
                    </p>
                </div>

                <div class="card">
                    <h3>Coins</h3>
                    <p class="muted">
                        Sammle Coins und löse Codes ein.
                    </p>
                </div>

                <div class="card">
                    <h3>Community</h3>
                    <p class="muted">
                        Chat, Gewinnspiele und Bewerbungen.
                    </p>
                </div>

            </div>

        </div>
        `,
        user
    ));
});

/*
========================================================
 REGISTRIERUNG
========================================================
*/

app.get("/register", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(page(
        "Registrieren",
        `
        <div class="container">

            <div class="form card">

                <h1>Konto erstellen</h1>

                <p class="muted">
                    Erstelle dein North-Bot-Webkonto.
                </p>

                <form method="POST" action="/register">

                    <label>Name</label>
                    <input
                        name="name"
                        maxlength="40"
                        required
                    >

                    <label>E-Mail</label>
                    <input
                        type="email"
                        name="email"
                        maxlength="120"
                        required
                    >

                    <label>Passwort</label>
                    <input
                        type="password"
                        name="password"
                        minlength="6"
                        required
                    >

                    <button class="btn" type="submit">
                        Registrieren
                    </button>

                </form>

                <p class="small muted">
                    Bereits registriert?
                    <a href="/login">Einloggen</a>
                </p>

            </div>

        </div>
        `
    ));
});

app.post("/register", (req, res) => {
    const name = clean(req.body.name, 40);
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
        return res.send(page(
            "Fehler",
            `
            <div class="container">
                <div class="alert red">
                    Bitte alle Felder ausfüllen.
                    Das Passwort muss mindestens 6 Zeichen haben.
                </div>
                <a class="btn" href="/register">Zurück</a>
            </div>
            `
        ));
    }

    const users = readJSON(FILES.users, []);

    if (users.some(u => u.email === email)) {
        return res.send(page(
            "Fehler",
            `
            <div class="container">
                <div class="alert red">
                    Diese E-Mail-Adresse ist bereits registriert.
                </div>
                <a class="btn" href="/login">Zum Login</a>
            </div>
            `
        ));
    }

    const user = {
        id: id("user"),
        name,
        email,
        password: hashPassword(password),
        coins: 0,
        role: isAdminEmail(email) ? "owner" : "user",
        banned: false,
        banReason: "",
        banUntil: null,
        dailyLastClaim: null,
        createdAt: Date.now()
    };

    users.push(user);

    writeJSON(FILES.users, users);

    addLog(
        "register",
        `Neues Konto erstellt: ${email}`,
        user
    );

    loginUser(res, user);

    res.redirect("/dashboard");
});

/*
========================================================
 LOGIN
========================================================
*/

app.get("/login", (req, res) => {
    const user = getCurrentUser(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(page(
        "Login",
        `
        <div class="container">

            <div class="form card">

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

                    <button class="btn" type="submit">
                        Einloggen
                    </button>

                </form>

                <p class="small muted">
                    Noch kein Konto?
                    <a href="/register">Registrieren</a>
                </p>

            </div>

        </div>
        `
    ));
});

app.post("/login", (req, res) => {
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.email === email
    );

    if (!user || !verifyPassword(password, user.password)) {
        addLog(
            "login_failed",
            `Fehlgeschlagener Login: ${email}`
        );

        return res.send(page(
            "Login fehlgeschlagen",
            `
            <div class="container">
                <div class="alert red">
                    E-Mail oder Passwort ist falsch.
                </div>

                <a class="btn" href="/login">
                    Erneut versuchen
                </a>
            </div>
            `
        ));
    }

    if (user.banned) {
        if (!user.banUntil || Date.now() < user.banUntil) {
            return res.redirect("/banned");
        }

        user.banned = false;
        user.banUntil = null;
        user.banReason = "";

        writeJSON(FILES.users, users);
    }

    loginUser(res, user);

    addLog(
        "login",
        `Login: ${email}`,
        user
    );

    res.redirect("/dashboard");
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
            `Logout: ${user.email}`,
            user
        );
    }

    logoutUser(req, res);

    res.redirect("/login");
});

/*
========================================================
 BANNED SEITE
========================================================
*/

app.get("/banned", (req, res) => {
    const user = getCurrentUser(req);

    let reason = "Kein Grund angegeben.";
    let until = "";

    if (user) {
        reason = user.banReason || reason;

        if (user.banUntil) {
            until = `
            <p>
                Ban endet:
                <strong>${formatDate(user.banUntil)}</strong>
            </p>
            `;
        }
    }

    res.send(page(
        "Gebannt",
        `
        <div class="container">

            <div class="card center">

                <h1>Account gesperrt</h1>

                <p>
                    Dein Webseitenkonto wurde gesperrt.
                </p>

                <p>
                    <strong>Grund:</strong><br>
                    ${escapeHTML(reason)}
                </p>

                ${until}

                <p class="muted">
                    Wenn du glaubst, dass der Ban falsch ist,
                    gehe auf unseren Discord und wende dich an das Team.
                </p>

                <a
                    class="btn"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Auf Discord entsperren lassen
                </a>

            </div>

        </div>
        `
    ));
});

/*
========================================================
 DASHBOARD
========================================================
*/

app.get("/dashboard", requireLogin, (req, res) => {
    const user = req.user;

    const tickets = readJSON(FILES.tickets, [])
        .filter(t => t.userId === user.id);

    const applications = readJSON(FILES.applications, [])
        .filter(a => a.userId === user.id);

    res.send(page(
        "Dashboard",
        `
        <div class="container">

            ${statusHTML()}

            <h1>Dashboard</h1>

            <p class="muted">
                Willkommen zurück, ${escapeHTML(user.name)}.
            </p>

            <div class="grid">

                <div class="card">
                    <div class="muted">Coins</div>
                    <div class="stat coin">
                        ${Number(user.coins || 0)}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Tickets</div>
                    <div class="stat">
                        ${tickets.length}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Bewerbungen</div>
                    <div class="stat">
                        ${applications.length}
                    </div>
                </div>

            </div>

            <div class="card">

                <h2>Daily Coins</h2>

                <p class="muted">
                    Alle 14 Stunden kannst du 100 Coins abholen.
                </p>

                <form method="POST" action="/daily">
                    <button class="btn green">
                        100 Coins abholen
                    </button>
                </form>

            </div>

            <div class="card">

                <h2>Schnellzugriff</h2>

                <a class="btn" href="/tickets">
                    Tickets
                </a>

                <a class="btn gray" href="/chat">
                    Chat
                </a>

                <a class="btn gray" href="/shop">
                    Coin-Shop
                </a>

                <a class="btn gray" href="/applications">
                    Bewerbung
                </a>

            </div>

        </div>
        `,
        user
    ));
});

/*
========================================================
 DAILY 100 COINS / 14 STUNDEN
========================================================
*/

app.post("/daily", requireLogin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === req.user.id
    );

    const now = Date.now();
    const cooldown = 14 * 60 * 60 * 1000;

    if (
        user.dailyLastClaim &&
        now - user.dailyLastClaim < cooldown
    ) {
        const remaining =
            cooldown - (now - user.dailyLastClaim);

        const hours = Math.floor(
            remaining / 3600000
        );

        const minutes = Math.floor(
            (remaining % 3600000) / 60000
        );

        return res.send(page(
            "Daily",
            `
            <div class="container">

                <div class="alert orange">
                    Du kannst deine 100 Coins noch nicht abholen.
                    <br>
                    Noch ungefähr ${hours}h ${minutes}min.
                </div>

                <a class="btn" href="/dashboard">
                    Zurück
                </a>

            </div>
            `,
            req.user
        ));
    }

    user.coins = Number(user.coins || 0) + 100;
    user.dailyLastClaim = now;

    writeJSON(FILES.users, users);

    addLog(
        "daily",
        `${user.email} hat 100 Daily-Coins erhalten.`,
        user
    );

    res.redirect("/dashboard");
});

/*
========================================================
 PROFIL
========================================================
*/

app.get("/profile", requireLogin, (req, res) => {
    const user = req.user;

    res.send(page(
        "Profil",
        `
        <div class="container">

            <div class="card">

                <h1>Mein Profil</h1>

                <p>
                    <span class="badge">
                        ${escapeHTML(user.role || "user")}
                    </span>
                </p>

                <p class="muted">
                    E-Mail: ${escapeHTML(user.email)}
                </p>

                <p>
                    Coins:
                    <strong class="coin">
                        ${Number(user.coins || 0)}
                    </strong>
                </p>

            </div>

            <div class="card">

                <h2>Profil bearbeiten</h2>

                <form method="POST" action="/profile">

                    <label>Name</label>

                    <input
                        name="name"
                        maxlength="40"
                        value="${escapeHTML(user.name)}"
                        required
                    >

                    <button class="btn">
                        Speichern
                    </button>

                </form>

            </div>

            <div class="card">

                <h2>Passwort ändern</h2>

                <form method="POST" action="/profile/password">

                    <label>Aktuelles Passwort</label>

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

                    <button class="btn">
                        Passwort ändern
                    </button>

                </form>

            </div>

        </div>
        `,
        user
    ));
});

app.post("/profile", requireLogin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === req.user.id
    );

    user.name = clean(req.body.name, 40);

    writeJSON(FILES.users, users);

    addLog(
        "profile",
        `${user.email} hat den Namen geändert.`,
        user
    );

    res.redirect("/profile");
});

app.post("/profile/password", requireLogin, (req, res) => {
    const oldPassword = String(
        req.body.oldPassword || ""
    );

    const newPassword = String(
        req.body.newPassword || ""
    );

    if (newPassword.length < 6) {
        return res.send(page(
            "Fehler",
            `
            <div class="container">
                <div class="alert red">
                    Das neue Passwort muss mindestens 6 Zeichen haben.
                </div>
            </div>
            `,
            req.user
        ));
    }

    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!verifyPassword(oldPassword, user.password)) {
        return res.send(page(
            "Fehler",
            `
            <div class="container">
                <div class="alert red">
                    Das aktuelle Passwort ist falsch.
                </div>
            </div>
            `,
            req.user
        ));
    }

    user.password = hashPassword(newPassword);

    writeJSON(FILES.users, users);

    addLog(
        "password",
        `${user.email} hat das Passwort geändert.`,
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
    const tickets = readJSON(FILES.tickets, [])
        .filter(t => {
            if (isAdminEmail(req.user.email)) {
                return true;
            }

            return t.userId === req.user.id;
        });

    res.send(page(
        "Tickets",
        `
        <div class="container">

            <div class="card">

                <h1>Tickets</h1>

                <p class="muted">
                    Deine Tickets und Tickets, auf die du als Admin Zugriff hast.
                </p>

                <a class="btn" href="/tickets/new">
                    Neues Ticket
                </a>

            </div>

            ${
                tickets.length
                ? tickets.map(ticket => `
                    <div class="ticket">

                        <h3>
                            ${escapeHTML(ticket.title)}
                        </h3>

                        <p class="muted">
                            ${escapeHTML(ticket.category)}
                            · ${escapeHTML(ticket.status)}
                            · ${formatDate(ticket.createdAt)}
                        </p>

                        <a
                            class="btn gray"
                            href="/tickets/${ticket.id}"
                        >
                            Ticket öffnen
                        </a>

                    </div>
                `).join("")
                : `
                <div class="card">
                    <p class="muted">
                        Noch keine Tickets vorhanden.
                    </p>
                </div>
                `
            }

        </div>
        `,
        req.user
    ));
});

app.get("/tickets/new", requireLogin, (req, res) => {
    res.send(page(
        "Neues Ticket",
        `
        <div class="container">

            <div class="form card">

                <h1>Neues Ticket</h1>

                <form method="POST" action="/tickets/new">

                    <label>Titel</label>

                    <input
                        name="title"
                        maxlength="100"
                        required
                    >

                    <label>Kategorie</label>

                    <select name="category">

                        <option>Support</option>
                        <option>Technik</option>
                        <option>Bestellung</option>
                        <option>Developer</option>
                        <option>Sonstiges</option>

                    </select>

                    <label>Nachricht</label>

                    <textarea
                        name="message"
                        maxlength="5000"
                        required
                    ></textarea>

                    <button class="btn">
                        Ticket erstellen
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/tickets/new", requireLogin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = {
        id: id("ticket"),
        ticketNumber: `T-${Date.now().toString().slice(-8)}`,
        userId: req.user.id,
        userName: req.user.name,
        title: clean(req.body.title, 100),
        category: clean(req.body.category, 50),
        status: "offen",
        createdAt: Date.now(),
        closedAt: null,
        messages: [
            {
                id: id("message"),
                userId: req.user.id,
                userName: req.user.name,
                message: clean(req.body.message, 5000),
                createdAt: Date.now()
            }
        ]
    };

    tickets.push(ticket);

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_create",
        `Ticket ${ticket.ticketNumber} erstellt.`,
        req.user,
        {
            ticketId: ticket.id
        }
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send(page(
            "Ticket nicht gefunden",
            `
            <div class="container">
                <div class="card">
                    <h1>Ticket nicht gefunden</h1>
                </div>
            </div>
            `,
            req.user
        ));
    }

    const allowed =
        isAdminEmail(req.user.email) ||
        ticket.userId === req.user.id;

    if (!allowed) {
        return res.status(403).send("Kein Zugriff");
    }

    res.send(page(
        `Ticket ${ticket.ticketNumber}`,
        `
        <div class="container">

            <div class="card">

                <h1>${escapeHTML(ticket.title)}</h1>

                <p class="muted">
                    ${escapeHTML(ticket.ticketNumber)}
                    · ${escapeHTML(ticket.category)}
                    · ${escapeHTML(ticket.status)}
                </p>

            </div>

            <div class="card">

                ${
                    ticket.messages.map(m => `
                        <div class="message">

                            <div class="message-name">
                                ${escapeHTML(m.userName)}
                            </div>

                            <div class="message-time">
                                ${formatDate(m.createdAt)}
                            </div>

                            <p>
                                ${escapeHTML(m.message)}
                            </p>

                        </div>
                    `).join("")
                }

            </div>

            ${
                ticket.status !== "geschlossen"
                ? `
                <div class="card">

                    <form method="POST"
                          action="/tickets/${ticket.id}/message">

                        <textarea
                            name="message"
                            placeholder="Nachricht..."
                            required
                        ></textarea>

                        <button class="btn">
                            Nachricht senden
                        </button>

                    </form>

                    <br>

                    <form method="POST"
                          action="/tickets/${ticket.id}/close">

                        <button class="btn red">
                            Ticket schließen
                        </button>

                    </form>

                </div>
                `
                : `
                <div class="alert">
                    Dieses Ticket ist geschlossen.
                </div>
                `
            }

        </div>
        `,
        req.user
    ));
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Ticket nicht gefunden");
    }

    const allowed =
        isAdminEmail(req.user.email) ||
        ticket.userId === req.user.id;

    if (!allowed) {
        return res.status(403).send("Kein Zugriff");
    }

    if (ticket.status === "geschlossen") {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    ticket.messages.push({
        id: id("message"),
        userId: req.user.id,
        userName: req.user.name,
        message: clean(req.body.message, 5000),
        createdAt: Date.now()
    });

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_message",
        `Neue Nachricht in ${ticket.ticketNumber}.`,
        req.user,
        {
            ticketId: ticket.id
        }
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.post("/tickets/:id/close", requireLogin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send("Nicht gefunden");
    }

    const allowed =
        isAdminEmail(req.user.email) ||
        ticket.userId === req.user.id;

    if (!allowed) {
        return res.status(403).send("Kein Zugriff");
    }

    ticket.status = "geschlossen";
    ticket.closedAt = Date.now();

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_close",
        `Ticket ${ticket.ticketNumber} geschlossen.`,
        req.user,
        {
            ticketId: ticket.id
        }
    );

    res.redirect(`/tickets/${ticket.id}`);
});

/*
========================================================
 USER CHAT
========================================================
*/

app.get("/chat", requireLogin, (req, res) => {
    const messages = readJSON(FILES.messages, []);

    res.send(page(
        "Chat",
        `
        <div class="container">

            <div class="card">

                <h1>Community Chat</h1>

                <div style="max-height:500px;overflow:auto;">

                    ${
                        messages.slice(0, 100).reverse().map(m => `
                            <div class="message">

                                <div class="message-name">
                                    ${escapeHTML(m.name)}
                                </div>

                                <div class="message-time">
                                    ${formatDate(m.createdAt)}
                                </div>

                                <div>
                                    ${escapeHTML(m.message)}
                                </div>

                            </div>
                        `).join("")
                    }

                </div>

            </div>

            <div class="card">

                <form method="POST" action="/chat">

                    <textarea
                        name="message"
                        maxlength="1000"
                        placeholder="Schreibe eine Nachricht..."
                        required
                    ></textarea>

                    <button class="btn">
                        Senden
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/chat", requireLogin, (req, res) => {
    const messages = readJSON(FILES.messages, []);

    messages.push({
        id: id("chat"),
        userId: req.user.id,
        name: req.user.name,
        message: clean(req.body.message, 1000),
        createdAt: Date.now()
    });

    if (messages.length > 5000) {
        messages.splice(0, messages.length - 5000);
    }

    writeJSON(FILES.messages, messages);

    res.redirect("/chat");
});

/*
========================================================
 COIN CODES
========================================================
*/

app.get("/codes", requireLogin, (req, res) => {
    res.send(page(
        "Coin Codes",
        `
        <div class="container">

            <div class="card">

                <h1>Coin-Code einlösen</h1>

                <p class="muted">
                    Jeder Code kann pro Benutzer nur einmal eingelöst werden.
                </p>

                <form method="POST" action="/codes/redeem">

                    <input
                        name="code"
                        placeholder="NORTH-XXXXXX-XXXXXX"
                        required
                    >

                    <button class="btn">
                        Code einlösen
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/codes/redeem", requireLogin, (req, res) => {
    const codeValue = clean(
        req.body.code,
        100
    ).toUpperCase();

    const codes = readJSON(FILES.codes, []);
    const users = readJSON(FILES.users, []);

    const code = codes.find(
        c => String(c.code).toUpperCase() === codeValue
    );

    if (!code) {
        return res.send(page(
            "Code",
            `
            <div class="container">
                <div class="alert red">
                    Der Code existiert nicht.
                </div>
                <a class="btn" href="/codes">Zurück</a>
            </div>
            `,
            req.user
        ));
    }

    if (code.disabled) {
        return res.send(page(
            "Code",
            `
            <div class="container">
                <div class="alert red">
                    Dieser Code wurde deaktiviert.
                </div>
            </div>
            `,
            req.user
        ));
    }

    if (code.expiresAt && Date.now() > code.expiresAt) {
        return res.send(page(
            "Code",
            `
            <div class="container">
                <div class="alert red">
                    Dieser Code ist abgelaufen.
                </div>
            </div>
            `,
            req.user
        ));
    }

    code.usedBy = code.usedBy || [];

    if (code.usedBy.includes(req.user.id)) {
        return res.send(page(
            "Code",
            `
            <div class="container">
                <div class="alert orange">
                    Du hast diesen Code bereits eingelöst.
                </div>
            </div>
            `,
            req.user
        ));
    }

    code.usedBy.push(req.user.id);

    const user = users.find(
        u => u.id === req.user.id
    );

    user.coins =
        Number(user.coins || 0) +
        Number(code.coins || 0);

    writeJSON(FILES.codes, codes);
    writeJSON(FILES.users, users);

    addLog(
        "code_redeem",
        `${user.email} hat ${code.coins} Coins erhalten.`,
        user,
        {
            code: code.code
        }
    );

    res.send(page(
        "Code eingelöst",
        `
        <div class="container">

            <div class="alert green">
                Code erfolgreich eingelöst.
                <br>
                Du hast
                <strong>${Number(code.coins || 0)}</strong>
                Coins erhalten.
            </div>

            <a class="btn" href="/dashboard">
                Zum Dashboard
            </a>

        </div>
        `,
        user
    ));
});

/*
========================================================
 SHOP
========================================================
*/

app.get("/shop", requireLogin, (req, res) => {
    const shop = readJSON(FILES.shop, []);

    res.send(page(
        "Coin-Shop",
        `
        <div class="container">

            <div class="card">

                <h1>Coin-Shop</h1>

                <p>
                    Deine Coins:
                    <strong class="coin">
                        ${Number(req.user.coins || 0)}
                    </strong>
                </p>

            </div>

            <div class="grid">

                ${
                    shop.filter(p => !p.disabled).map(product => `
                        <div class="product">

                            <h2>
                                ${escapeHTML(product.name)}
                            </h2>

                            <p class="muted">
                                ${escapeHTML(product.description)}
                            </p>

                            <p class="coin">
                                ${Number(product.price)} Coins
                            </p>

                            <form method="POST"
                                  action="/shop/${product.id}/buy">

                                <button class="btn">
                                    Kaufen
                                </button>

                            </form>

                        </div>
                    `).join("")
                }

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/shop/:id/buy", requireLogin, (req, res) => {
    const shop = readJSON(FILES.shop, []);
    const users = readJSON(FILES.users, []);
    const orders = readJSON(FILES.orders, []);

    const product = shop.find(
        p => p.id === req.params.id
    );

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!product || product.disabled) {
        return res.send(page(
            "Shop",
            `
            <div class="container">
                <div class="alert red">
                    Produkt nicht gefunden.
                </div>
            </div>
            `,
            user
        ));
    }

    if (Number(user.coins || 0) < Number(product.price)) {
        return res.send(page(
            "Shop",
            `
            <div class="container">
                <div class="alert red">
                    Du hast nicht genügend Coins.
                </div>
            </div>
            `,
            user
        ));
    }

    user.coins -= Number(product.price);

    const order = {
        id: id("order"),
        orderNumber: generateOrderNumber(),
        userId: user.id,
        userName: user.name,
        email: user.email,
        productId: product.id,
        productName: product.name,
        price: Number(product.price),
        status: "offen",
        createdAt: Date.now()
    };

    orders.unshift(order);

    writeJSON(FILES.users, users);
    writeJSON(FILES.orders, orders);

    addLog(
        "order",
        `${user.email} hat ${product.name} gekauft.`,
        user,
        {
            orderNumber: order.orderNumber
        }
    );

    res.send(page(
        "Bestellung",
        `
        <div class="container">

            <div class="card center">

                <h1>Bestellung erfolgreich</h1>

                <p>
                    Deine Bestellung wurde erstellt.
                </p>

                <p>
                    Bestellnummer:
                </p>

                <h2>
                    ${escapeHTML(order.orderNumber)}
                </h2>

                <p class="muted">
                    Gib diese Nummer bei Bedarf dem Team auf Discord.
                </p>

                <a
                    class="btn"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Discord öffnen
                </a>

            </div>

        </div>
        `,
        user
    ));
});

/*
========================================================
 GEWINNSPIELE
========================================================
*/

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    res.send(page(
        "Gewinnspiele",
        `
        <div class="container">

            <h1>Gewinnspiele</h1>

            ${
                giveaways.length
                ? giveaways.map(g => {

                    const joined =
                        (g.participants || [])
                            .includes(req.user.id);

                    return `
                    <div class="card">

                        <h2>
                            ${escapeHTML(g.title)}
                        </h2>

                        <p>
                            Gewinn:
                            <strong>
                                ${escapeHTML(g.prize)}
                            </strong>
                        </p>

                        <p class="muted">
                            Ende:
                            ${formatDate(g.endsAt)}
                        </p>

                        <p>
                            Teilnehmer:
                            ${(g.participants || []).length}
                        </p>

                        ${
                            joined
                            ? `
                            <div class="alert green">
                                Du nimmst bereits teil.
                            </div>
                            `
                            : `
                            <form method="POST"
                                  action="/giveaways/${g.id}/join">

                                <button class="btn">
                                    Teilnehmen
                                </button>

                            </form>
                            `
                        }

                    </div>
                    `;
                }).join("")
                : `
                <div class="card">
                    <p class="muted">
                        Aktuell gibt es keine Gewinnspiele.
                    </p>
                </div>
                `
            }

        </div>
        `,
        req.user
    ));
});

app.post("/giveaways/:id/join", requireLogin, (req, res) => {
    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    const giveaway = giveaways.find(
        g => g.id === req.params.id
    );

    if (!giveaway) {
        return res.redirect("/giveaways");
    }

    giveaway.participants =
        giveaway.participants || [];

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);

        writeJSON(
            FILES.giveaways,
            giveaways
        );

        addLog(
            "giveaway_join",
            `${req.user.email} nimmt an ${giveaway.title} teil.`,
            req.user
        );
    }

    res.redirect("/giveaways");
});

/*
========================================================
 BEWERBUNGEN
========================================================
*/

app.get("/applications", requireLogin, (req, res) => {
    const applications =
        readJSON(FILES.applications, [])
        .filter(a => a.userId === req.user.id);

    res.send(page(
        "Bewerbungen",
        `
        <div class="container">

            <div class="card">

                <h1>Bewerbungen</h1>

                <p class="muted">
                    Bewirb dich als Moderator oder Developer.
                </p>

                <a class="btn" href="/applications/new">
                    Neue Bewerbung
                </a>

            </div>

            ${
                applications.map(a => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(a.applicationNumber)}
                        </h3>

                        <p>
                            Bereich:
                            <strong>
                                ${escapeHTML(a.type)}
                            </strong>
                        </p>

                        <p>
                            Status:
                            <span class="badge">
                                ${escapeHTML(a.status)}
                            </span>
                        </p>

                        <p class="muted">
                            ${formatDate(a.createdAt)}
                        </p>

                    </div>
                `).join("")
            }

        </div>
        `,
        req.user
    ));
});

app.get("/applications/new", requireLogin, (req, res) => {
    res.send(page(
        "Bewerbung",
        `
        <div class="container">

            <div class="form card">

                <h1>Bewerbung</h1>

                <form method="POST"
                      action="/applications/new">

                    <label>Bereich</label>

                    <select name="type">

                        <option>Moderator</option>
                        <option>Developer</option>

                    </select>

                    <label>Warum möchtest du ins Team?</label>

                    <textarea
                        name="motivation"
                        maxlength="5000"
                        required
                    ></textarea>

                    <label>Erfahrung</label>

                    <textarea
                        name="experience"
                        maxlength="5000"
                        required
                    ></textarea>

                    <button class="btn">
                        Bewerbung absenden
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/applications/new", requireLogin, (req, res) => {
    const applications =
        readJSON(FILES.applications, []);

    const application = {
        id: id("application"),
        applicationNumber:
            `APP-${Date.now().toString().slice(-8)}`,
        userId: req.user.id,
        name: req.user.name,
        email: req.user.email,
        type: clean(req.body.type, 40),
        motivation: clean(req.body.motivation, 5000),
        experience: clean(req.body.experience, 5000),
        status: "offen",
        createdAt: Date.now()
    };

    applications.unshift(application);

    writeJSON(
        FILES.applications,
        applications
    );

    addLog(
        "application",
        `${req.user.email} hat eine Bewerbung erstellt.`,
        req.user,
        {
            applicationNumber:
                application.applicationNumber
        }
    );

    res.redirect("/applications");
});

/*
========================================================
 ADMIN PANEL
========================================================
*/

app.get("/admin", requireAdmin, (req, res) => {
    const users = readJSON(FILES.users, []);
    const tickets = readJSON(FILES.tickets, []);
    const logs = readJSON(FILES.logs, []);
    const codes = readJSON(FILES.codes, []);
    const shop = readJSON(FILES.shop, []);
    const giveaways = readJSON(FILES.giveaways, []);
    const applications = readJSON(FILES.applications, []);
    const orders = readJSON(FILES.orders, []);
    const settings = readJSON(FILES.settings, {});

    const totalCoins = users.reduce(
        (sum, u) => sum + Number(u.coins || 0),
        0
    );

    res.send(page(
        "Admin Panel",
        `
        <div class="container">

            <h1>Admin Panel</h1>

            <p class="muted">
                Verwaltung für Owner und Admins.
            </p>

            <div class="grid">

                <div class="card">
                    <div class="muted">Users</div>
                    <div class="stat">
                        ${users.length}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Coins</div>
                    <div class="stat coin">
                        ${totalCoins}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Tickets</div>
                    <div class="stat">
                        ${tickets.length}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Codes</div>
                    <div class="stat">
                        ${codes.length}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Produkte</div>
                    <div class="stat">
                        ${shop.length}
                    </div>
                </div>

                <div class="card">
                    <div class="muted">Logs</div>
                    <div class="stat">
                        ${logs.length}
                    </div>
                </div>

            </div>

            <div class="grid2">

                <div class="card">

                    <h2>Verwaltung</h2>

                    <p>
                        <a class="btn" href="/admin/users">
                            Benutzer
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/tickets">
                            Tickets
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/codes">
                            Coin-Codes
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/shop">
                            Coin-Shop
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/orders">
                            Bestellungen
                        </a>
                    </p>

                </div>

                <div class="card">

                    <h2>Community</h2>

                    <p>
                        <a class="btn" href="/admin/giveaways">
                            Gewinnspiele
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/applications">
                            Bewerbungen
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/team-chat">
                            Team Chat
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/logs">
                            Logs
                        </a>
                    </p>

                    <p>
                        <a class="btn" href="/admin/status">
                            Wartung / Störung
                        </a>
                    </p>

                </div>

            </div>

            <div class="card">

                <h2>Admin hinzufügen</h2>

                <form method="POST"
                      action="/admin/admins/add">

                    <input
                        type="email"
                        name="email"
                        placeholder="E-Mail-Adresse"
                        required
                    >

                    <button class="btn">
                        Admin hinzufügen
                    </button>

                </form>

                <p class="small muted">
                    Aktuelle Admins:
                    ${adminEmails.map(
                        e => escapeHTML(e)
                    ).join(", ")}
                </p>

            </div>

        </div>
        `,
        req.user
    ));
});

/*
========================================================
 ADMIN USERS
========================================================
*/

app.get("/admin/users", requireAdmin, (req, res) => {
    const users = readJSON(FILES.users, []);

    res.send(page(
        "Benutzerverwaltung",
        `
        <div class="container">

            <div class="card">

                <h1>Benutzer</h1>

                <table class="table">

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Coins</th>
                        <th>Status</th>
                        <th>Aktion</th>
                    </tr>

                    ${
                        users.map(u => `
                        <tr>

                            <td>
                                ${escapeHTML(u.name)}
                            </td>

                            <td>
                                ${escapeHTML(u.email)}
                            </td>

                            <td>
                                <span class="badge ${
                                    isAdminEmail(u.email)
                                    ? "admin"
                                    : ""
                                }">
                                    ${escapeHTML(u.role || "user")}
                                </span>
                            </td>

                            <td class="coin">
                                ${Number(u.coins || 0)}
                            </td>

                            <td>
                                ${
                                    u.banned
                                    ? `<span class="badge">
                                        GEBANNT
                                       </span>`
                                    : "Aktiv"
                                }
                            </td>

                            <td>

                                ${
                                    !isAdminEmail(u.email)
                                    ? `
                                    <form method="POST"
                                          action="/admin/users/${u.id}/ban">

                                        <input
                                            name="reason"
                                            placeholder="Ban-Grund"
                                            required
                                        >

                                        <select name="duration">

                                            <option value="1">
                                                1 Minute
                                            </option>

                                            <option value="10">
                                                10 Minuten
                                            </option>

                                            <option value="60">
                                                1 Stunde
                                            </option>

                                            <option value="1440">
                                                1 Tag
                                            </option>

                                            <option value="10080">
                                                7 Tage
                                            </option>

                                            <option value="0">
                                                Permanent
                                            </option>

                                        </select>

                                        <button class="btn red">
                                            Ban
                                        </button>

                                    </form>

                                    <form method="POST"
                                          action="/admin/users/${u.id}/kick"
                                          style="margin-top:8px;">

                                        <button class="btn orange">
                                            Kick
                                        </button>

                                    </form>

                                    ${
                                        u.banned
                                        ? `
                                        <form method="POST"
                                              action="/admin/users/${u.id}/unban"
                                              style="margin-top:8px;">

                                            <button class="btn green">
                                                Unban
                                            </button>

                                        </form>
                                        `
                                        : ""
                                    }

                                    `
                                    : `
                                    <span class="badge owner">
                                        OWNER
                                    </span>
                                    `
                                }

                            </td>

                        </tr>
                        `).join("")
                    }

                </table>

            </div>

        </div>
        `,
        req.user
    ));
});

/*
========================================================
 ADMIN BAN
========================================================
*/

app.post("/admin/users/:id/ban", requireAdmin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin/users");
    }

    if (isAdminEmail(user.email)) {
        return res.status(403).send("Admins können nicht gebannt werden.");
    }

    const reason = clean(
        req.body.reason,
        500
    );

    const duration = Number(
        req.body.duration || 0
    );

    user.banned = true;
    user.banReason = reason;

    if (duration > 0) {
        user.banUntil =
            Date.now() +
            duration * 60 * 1000;
    } else {
        user.banUntil = null;
    }

    writeJSON(FILES.users, users);

    addLog(
        "ban",
        `${user.email} wurde gebannt. Grund: ${reason}`,
        req.user,
        {
            targetUserId: user.id,
            duration
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 UNBAN
========================================================
*/

app.post("/admin/users/:id/unban", requireAdmin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin/users");
    }

    user.banned = false;
    user.banReason = "";
    user.banUntil = null;

    writeJSON(FILES.users, users);

    addLog(
        "unban",
        `${user.email} wurde entbannt.`,
        req.user,
        {
            targetUserId: user.id
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 KICK
========================================================
*/

app.post("/admin/users/:id/kick", requireAdmin, (req, res) => {
    const sessions = readJSON(FILES.sessions, []);

    const filtered = sessions.filter(
        s => s.userId !== req.params.id
    );

    writeJSON(FILES.sessions, filtered);

    addLog(
        "kick",
        `Benutzer ${req.params.id} wurde ausgeloggt.`,
        req.user,
        {
            targetUserId: req.params.id
        }
    );

    res.redirect("/admin/users");
});

/*
========================================================
 ADMIN HINZUFÜGEN
========================================================
*/

app.post("/admin/admins/add", requireAdmin, (req, res) => {
    const email = clean(
        req.body.email,
        120
    ).toLowerCase();

    if (
        email &&
        !adminEmails.includes(email)
    ) {
        adminEmails.push(email);
    }

    addLog(
        "admin_add",
        `Admin hinzugefügt: ${email}`,
        req.user
    );

    res.redirect("/admin");
});

/*
========================================================
 ADMIN CODES
========================================================
*/

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = readJSON(FILES.codes, []);

    res.send(page(
        "Coin-Codes",
        `
        <div class="container">

            <div class="card">

                <h1>Coin-Codes</h1>

                <form method="POST"
                      action="/admin/codes/create">

                    <label>Coins</label>

                    <input
                        type="number"
                        name="coins"
                        min="1"
                        max="1000000"
                        required
                    >

                    <label>Anzahl</label>

                    <input
                        type="number"
                        name="amount"
                        min="1"
                        max="100"
                        value="1"
                        required
                    >

                    <label>Gültigkeit in Tagen</label>

                    <input
                        type="number"
                        name="days"
                        min="0"
                        value="0"
                    >

                    <button class="btn">
                        Codes erstellen
                    </button>

                </form>

            </div>

            <div class="card">

                <h2>Erstellte Codes</h2>

                <table class="table">

                    <tr>
                        <th>Code</th>
                        <th>Coins</th>
                        <th>Benutzt</th>
                        <th>Gültig bis</th>
                    </tr>

                    ${
                        codes.map(c => `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHTML(c.code)}
                                </strong>
                            </td>

                            <td class="coin">
                                ${Number(c.coins)}
                            </td>

                            <td>
                                ${(c.usedBy || []).length}
                            </td>

                            <td>
                                ${
                                    c.expiresAt
                                    ? formatDate(c.expiresAt)
                                    : "Unbegrenzt"
                                }
                            </td>

                        </tr>
                        `).join("")
                    }

                </table>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/admin/codes/create", requireAdmin, (req, res) => {
    const codes = readJSON(FILES.codes, []);

    const coins = Math.max(
        1,
        Number(req.body.coins || 1)
    );

    const amount = Math.min(
        100,
        Math.max(1, Number(req.body.amount || 1))
    );

    const days = Math.max(
        0,
        Number(req.body.days || 0)
    );

    for (let i = 0; i < amount; i++) {
        codes.unshift({
            id: id("code"),
            code: generateCode(),
            coins,
            usedBy: [],
            disabled: false,
            createdAt: Date.now(),
            expiresAt:
                days > 0
                ? Date.now() +
                  days * 24 * 60 * 60 * 1000
                : null
        });
    }

    writeJSON(FILES.codes, codes);

    addLog(
        "codes_create",
        `${amount} Codes mit ${coins} Coins erstellt.`,
        req.user
    );

    res.redirect("/admin/codes");
});

/*
========================================================
 ADMIN SHOP
========================================================
*/

app.get("/admin/shop", requireAdmin, (req, res) => {
    const shop = readJSON(FILES.shop, []);

    res.send(page(
        "Shop Verwaltung",
        `
        <div class="container">

            <div class="card">

                <h1>Coin-Shop verwalten</h1>

                <form method="POST"
                      action="/admin/shop/create">

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

                    <button class="btn">
                        Produkt hinzufügen
                    </button>

                </form>

            </div>

            ${
                shop.map(p => `
                <div class="card">

                    <h2>
                        ${escapeHTML(p.name)}
                    </h2>

                    <p>
                        ${escapeHTML(p.description)}
                    </p>

                    <p class="coin">
                        ${Number(p.price)} Coins
                    </p>

                    <p>
                        Status:
                        ${p.disabled ? "Deaktiviert" : "Aktiv"}
                    </p>

                    <form method="POST"
                          action="/admin/shop/${p.id}/toggle">

                        <button class="btn gray">
                            ${
                                p.disabled
                                ? "Aktivieren"
                                : "Deaktivieren"
                            }
                        </button>

                    </form>

                </div>
                `).join("")
            }

        </div>
        `,
        req.user
    ));
});

app.post("/admin/shop/create", requireAdmin, (req, res) => {
    const shop = readJSON(FILES.shop, []);

    shop.unshift({
        id: id("product"),
        name: clean(req.body.name, 100),
        description: clean(req.body.description, 1000),
        price: Math.max(
            1,
            Number(req.body.price || 1)
        ),
        disabled: false,
        createdAt: Date.now()
    });

    writeJSON(FILES.shop, shop);

    addLog(
        "shop_create",
        "Neues Shop-Produkt erstellt.",
        req.user
    );

    res.redirect("/admin/shop");
});

app.post("/admin/shop/:id/toggle", requireAdmin, (req, res) => {
    const shop = readJSON(FILES.shop, []);

    const product = shop.find(
        p => p.id === req.params.id
    );

    if (product) {
        product.disabled = !product.disabled;
    }

    writeJSON(FILES.shop, shop);

    res.redirect("/admin/shop");
});

/*
========================================================
 ADMIN TICKETS
========================================================
*/

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    res.send(page(
        "Ticket Verwaltung",
        `
        <div class="container">

            <div class="card">

                <h1>Alle Tickets</h1>

                ${
                    tickets.map(t => `
                    <div class="ticket">

                        <h3>
                            ${escapeHTML(t.ticketNumber)}
                        </h3>

                        <p>
                            ${escapeHTML(t.title)}
                        </p>

                        <p class="muted">
                            User:
                            ${escapeHTML(t.userName)}
                            ·
                            ${escapeHTML(t.status)}
                        </p>

                        <a
                            class="btn"
                            href="/tickets/${t.id}"
                        >
                            Öffnen
                        </a>

                    </div>
                    `).join("")
                }

            </div>

        </div>
        `,
        req.user
    ));
});

/*
========================================================
 ADMIN BESTELLUNGEN
========================================================
*/

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = readJSON(FILES.orders, []);

    res.send(page(
        "Bestellungen",
        `
        <div class="container">

            <div class="card">

                <h1>Bestellungen</h1>

                <table class="table">

                    <tr>
                        <th>Bestellnummer</th>
                        <th>User</th>
                        <th>Produkt</th>
                        <th>Preis</th>
                        <th>Status</th>
                    </tr>

                    ${
                        orders.map(o => `
                        <tr>

                            <td>
                                ${escapeHTML(o.orderNumber)}
                            </td>

                            <td>
                                ${escapeHTML(o.email)}
                            </td>

                            <td>
                                ${escapeHTML(o.productName)}
                            </td>

                            <td class="coin">
                                ${Number(o.price)}
                            </td>

                            <td>
                                ${escapeHTML(o.status)}
                            </td>

                        </tr>
                        `).join("")
                    }

                </table>

            </div>

        </div>
        `,
        req.user
    ));
});

/*
========================================================
 ADMIN GEWINNSPIELE
========================================================
*/

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    res.send(page(
        "Gewinnspiele verwalten",
        `
        <div class="container">

            <div class="card">

                <h1>Gewinnspiel erstellen</h1>

                <form method="POST"
                      action="/admin/giveaways/create">

                    <label>Titel</label>

                    <input
                        name="title"
                        maxlength="100"
                        required
                    >

                    <label>Gewinn</label>

                    <input
                        name="prize"
                        maxlength="200"
                        required
                    >

                    <label>Dauer in Stunden</label>

                    <input
                        type="number"
                        name="hours"
                        min="1"
                        value="24"
                        required
                    >

                    <button class="btn">
                        Gewinnspiel erstellen
                    </button>

                </form>

            </div>

            ${
                giveaways.map(g => `
                <div class="card">

                    <h2>
                        ${escapeHTML(g.title)}
                    </h2>

                    <p>
                        Gewinn:
                        ${escapeHTML(g.prize)}
                    </p>

                    <p>
                        Teilnehmer:
                        ${(g.participants || []).length}
                    </p>

                    <p class="muted">
                        Ende:
                        ${formatDate(g.endsAt)}
                    </p>

                    <form method="POST"
                          action="/admin/giveaways/${g.id}/finish">

                        <button class="btn red">
                            Beenden
                        </button>

                    </form>

                </div>
                `).join("")
            }

        </div>
        `,
        req.user
    ));
});

app.post("/admin/giveaways/create", requireAdmin, (req, res) => {
    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    const hours = Math.max(
        1,
        Number(req.body.hours || 24)
    );

    giveaways.unshift({
        id: id("giveaway"),
        title: clean(req.body.title, 100),
        prize: clean(req.body.prize, 200),
        participants: [],
        createdAt: Date.now(),
        endsAt: Date.now() +
            hours * 60 * 60 * 1000,
        status: "aktiv",
        winnerId: null
    });

    writeJSON(
        FILES.giveaways,
        giveaways
    );

    addLog(
        "giveaway_create",
        "Gewinnspiel erstellt.",
        req.user
    );

    res.redirect("/admin/giveaways");
});

app.post("/admin/giveaways/:id/finish", requireAdmin, (req, res) => {
    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    const giveaway = giveaways.find(
        g => g.id === req.params.id
    );

    if (giveaway) {
        giveaway.status = "beendet";

        const participants =
            giveaway.participants || [];

        if (participants.length > 0) {
            giveaway.winnerId =
                participants[
                    Math.floor(
                        Math.random() *
                        participants.length
                    )
                ];
        }
    }

    writeJSON(
        FILES.giveaways,
        giveaways
    );

    addLog(
        "giveaway_finish",
        "Gewinnspiel beendet.",
        req.user
    );

    res.redirect("/admin/giveaways");
});

/*
========================================================
 ADMIN BEWERBUNGEN
========================================================
*/

app.get("/admin/applications", requireAdmin, (req, res) => {
    const applications =
        readJSON(FILES.applications, []);

    res.send(page(
        "Bewerbungen",
        `
        <div class="container">

            <div class="card">

                <h1>Bewerbungen</h1>

                ${
                    applications.map(a => `
                    <div class="ticket">

                        <h2>
                            ${escapeHTML(a.applicationNumber)}
                        </h2>

                        <p>
                            <strong>
                                ${escapeHTML(a.name)}
                            </strong>
                            ·
                            ${escapeHTML(a.type)}
                        </p>

                        <p>
                            ${escapeHTML(a.motivation)}
                        </p>

                        <p>
                            ${escapeHTML(a.experience)}
                        </p>

                        <p>
                            Status:
                            ${escapeHTML(a.status)}
                        </p>

                        <form method="POST"
                              action="/admin/applications/${a.id}/status">

                            <select name="status">

                                <option>offen</option>
                                <option>angenommen</option>
                                <option>abgelehnt</option>

                            </select>

                            <button class="btn">
                                Status ändern
                            </button>

                        </form>

                    </div>
                    `).join("")
                }

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/admin/applications/:id/status", requireAdmin, (req, res) => {
    const applications =
        readJSON(FILES.applications, []);

    const application = applications.find(
        a => a.id === req.params.id
    );

    if (application) {
        application.status =
            clean(req.body.status, 40);
    }

    writeJSON(
        FILES.applications,
        applications
    );

    addLog(
        "application_status",
        `Bewerbung ${req.params.id} geändert.`,
        req.user
    );

    res.redirect("/admin/applications");
});

/*
========================================================
 TEAM CHAT
========================================================
*/

app.get("/admin/team-chat", requireAdmin, (req, res) => {
    const messages =
        readJSON(FILES.teamMessages, []);

    res.send(page(
        "Team Chat",
        `
        <div class="container">

            <div class="card">

                <h1>Team Chat</h1>

                <div style="max-height:600px;overflow:auto;">

                    ${
                        messages.slice(-200).map(m => `
                        <div class="message">

                            <div class="message-name">
                                ${escapeHTML(m.name)}
                            </div>

                            <div class="message-time">
                                ${formatDate(m.createdAt)}
                            </div>

                            <p>
                                ${escapeHTML(m.message)}
                            </p>

                        </div>
                        `).join("")
                    }

                </div>

            </div>

            <div class="card">

                <form method="POST"
                      action="/admin/team-chat">

                    <textarea
                        name="message"
                        maxlength="2000"
                        required
                        placeholder="Team-Nachricht..."
                    ></textarea>

                    <button class="btn">
                        Senden
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/admin/team-chat", requireAdmin, (req, res) => {
    const messages =
        readJSON(FILES.teamMessages, []);

    messages.push({
        id: id("teamchat"),
        userId: req.user.id,
        name: req.user.name,
        message: clean(
            req.body.message,
            2000
        ),
        createdAt: Date.now()
    });

    if (messages.length > 5000) {
        messages.splice(
            0,
            messages.length - 5000
        );
    }

    writeJSON(
        FILES.teamMessages,
        messages
    );

    addLog(
        "team_chat",
        `${req.user.email} schrieb im Team-Chat.`,
        req.user
    );

    res.redirect("/admin/team-chat");
});

/*
========================================================
 ADMIN LOGS
========================================================
*/

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = readJSON(FILES.logs, []);

    res.send(page(
        "Logs",
        `
        <div class="container">

            <div class="card">

                <h1>Logs</h1>

                <p class="muted">
                    ${logs.length} Einträge
                </p>

                <table class="table">

                    <tr>
                        <th>Zeit</th>
                        <th>Typ</th>
                        <th>User</th>
                        <th>Aktion</th>
                    </tr>

                    ${
                        logs.map(l => `
                        <tr>

                            <td>
                                ${formatDate(l.createdAt)}
                            </td>

                            <td>
                                <span class="badge">
                                    ${escapeHTML(l.type)}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(l.email || "-")}
                            </td>

                            <td>
                                ${escapeHTML(l.text)}
                            </td>

                        </tr>
                        `).join("")
                    }

                </table>

            </div>

        </div>
        `,
        req.user
    ));
});

/*
========================================================
 WARTUNG / STÖRUNG
========================================================
*/

app.get("/admin/status", requireAdmin, (req, res) => {
    const settings =
        readJSON(FILES.settings, {
            maintenance: {},
            outage: {}
        });

    res.send(page(
        "Status",
        `
        <div class="container">

            <div class="card">

                <h1>Wartung</h1>

                <form method="POST"
                      action="/admin/status/maintenance">

                    <label>
                        Aktiv
                    </label>

                    <select name="enabled">

                        <option
                            value="true"
                            ${settings.maintenance.enabled ? "selected" : ""}
                        >
                            Ja
                        </option>

                        <option
                            value="false"
                            ${!settings.maintenance.enabled ? "selected" : ""}
                        >
                            Nein
                        </option>

                    </select>

                    <label>Titel</label>

                    <input
                        name="title"
                        value="${escapeHTML(settings.maintenance.title || "Wartung")}"
                    >

                    <label>Text</label>

                    <textarea
                        name="text"
                    >${escapeHTML(settings.maintenance.text || "")}</textarea>

                    <button class="btn">
                        Wartung speichern
                    </button>

                </form>

            </div>

            <div class="card">

                <h1>Störung</h1>

                <form method="POST"
                      action="/admin/status/outage">

                    <label>
                        Aktiv
                    </label>

                    <select name="enabled">

                        <option
                            value="true"
                            ${settings.outage.enabled ? "selected" : ""}
                        >
                            Ja
                        </option>

                        <option
                            value="false"
                            ${!settings.outage.enabled ? "selected" : ""}
                        >
                            Nein
                        </option>

                    </select>

                    <label>Titel</label>

                    <input
                        name="title"
                        value="${escapeHTML(settings.outage.title || "Störung")}"
                    >

                    <label>Text</label>

                    <textarea
                        name="text"
                    >${escapeHTML(settings.outage.text || "")}</textarea>

                    <button class="btn">
                        Störung speichern
                    </button>

                </form>

            </div>

        </div>
        `,
        req.user
    ));
});

app.post("/admin/status/maintenance", requireAdmin, (req, res) => {
    const settings =
        readJSON(FILES.settings, {});

    settings.maintenance = {
        enabled: req.body.enabled === "true",
        title: clean(req.body.title, 150),
        text: clean(req.body.text, 1000)
    };

    writeJSON(
        FILES.settings,
        settings
    );

    addLog(
        "maintenance",
        `Wartungsstatus geändert: ${
            settings.maintenance.enabled
            ? "AN"
            : "AUS"
        }`,
        req.user
    );

    res.redirect("/admin/status");
});

app.post("/admin/status/outage", requireAdmin, (req, res) => {
    const settings =
        readJSON(FILES.settings, {});

    settings.outage = {
        enabled: req.body.enabled === "true",
        title: clean(req.body.title, 150),
        text: clean(req.body.text, 1000)
    };

    writeJSON(
        FILES.settings,
        settings
    );

    addLog(
        "outage",
        `Störungsstatus geändert: ${
            settings.outage.enabled
            ? "AN"
            : "AUS"
        }`,
        req.user
    );

    res.redirect("/admin/status");
});

/*
========================================================
 404
========================================================
*/

app.use((req, res) => {
    const user = getCurrentUser(req);

    res.status(404).send(page(
        "404",
        `
        <div class="container">

            <div class="card center">

                <h1>404</h1>

                <p>
                    Diese Seite wurde nicht gefunden.
                </p>

                <a class="btn" href="/">
                    Startseite
                </a>

            </div>

        </div>
        `,
        user
    ));
});

/*
========================================================
 FEHLERHANDLER
========================================================
*/

app.use((error, req, res, next) => {
    console.error("Webseitenfehler:", error);

    const user = getCurrentUser(req);

    res.status(500).send(page(
        "Fehler",
        `
        <div class="container">

            <div class="alert red">
                Bei der Verarbeitung ist ein Fehler aufgetreten.
            </div>

            <a class="btn" href="/">
                Startseite
            </a>

        </div>
        `,
        user
    ));
});

/*
========================================================
 AUTOMATISCHE BEREINIGUNG
========================================================
*/

setInterval(() => {

    try {

        const sessions =
            readJSON(FILES.sessions, []);

        const now = Date.now();

        const validSessions =
            sessions.filter(
                s => !s.expiresAt ||
                     s.expiresAt > now
            );

        writeJSON(
            FILES.sessions,
            validSessions
        );

        const users =
            readJSON(FILES.users, []);

        let changed = false;

        for (const user of users) {

            if (
                user.banned &&
                user.banUntil &&
                now >= user.banUntil
            ) {

                user.banned = false;
                user.banReason = "";
                user.banUntil = null;

                changed = true;
            }
        }

        if (changed) {
            writeJSON(FILES.users, users);
        }

    } catch (error) {
        console.error(
            "Automatische Bereinigung:",
            error.message
        );
    }

}, 60 * 1000);

/*
========================================================
 START
========================================================
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
