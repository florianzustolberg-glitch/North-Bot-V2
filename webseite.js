const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

/* =========================================================
   NORTH-BOT-2 KONFIGURATION
========================================================= */

const SITE_NAME = "North-Bot-2";
const OWNER_EMAIL = "florianzustolberg@gmail.com";

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

const TICKET_CATEGORY_ID = "1493423287118729328";

/*
   KEIN Discord-Token hier eintragen.

   Falls du später Discord direkt anbinden willst,
   sollte dafür dein Bot-System verwendet werden.
*/

/* =========================================================
   DATEIEN
========================================================= */

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    products: path.join(DATA_DIR, "products.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    messages: path.join(DATA_DIR, "messages.json"),
    announcements: path.join(DATA_DIR, "announcements.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    orders: path.join(DATA_DIR, "orders.json")
};

/* =========================================================
   DATEIEN AUTOMATISCH ERSTELLEN
========================================================= */

function ensureFile(file, data) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2),
            "utf8"
        );
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.products, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.messages, []);
ensureFile(FILES.announcements, []);

ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "",
    incident: false,
    incidentText: "",
    announcementEnabled: true
});

ensureFile(FILES.orders, []);

/* =========================================================
   JSON HELFER
========================================================= */

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
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

/* =========================================================
   ALLGEMEINE HELFER
========================================================= */

function id() {
    return crypto.randomBytes(8).toString("hex");
}

function passwordHash(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function now() {
    return new Date().toISOString();
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleString(
        "de-DE",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}

function randomCodePart(length = 4) {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < length; i++) {
        result += chars[
            crypto.randomInt(0, chars.length)
        ];
    }

    return result;
}

function createCoinCode() {
    return `NORTH-${randomCodePart()}-${randomCodePart()}`;
}

function createTicketNumber() {
    return `TICKET-${Date.now()
        .toString()
        .slice(-8)}`;
}

function createOrderNumber() {
    return `ORDER-${Date.now()
        .toString()
        .slice(-8)}`;
}

/* =========================================================
   DATEN
========================================================= */

function users() {
    return readJSON(FILES.users, []);
}

function tickets() {
    return readJSON(FILES.tickets, []);
}

function logs() {
    return readJSON(FILES.logs, []);
}

function codes() {
    return readJSON(FILES.codes, []);
}

function products() {
    return readJSON(FILES.products, []);
}

function giveaways() {
    return readJSON(FILES.giveaways, []);
}

function messages() {
    return readJSON(FILES.messages, []);
}

function announcements() {
    return readJSON(FILES.announcements, []);
}

function settings() {
    return readJSON(
        FILES.settings,
        {
            maintenance: false,
            maintenanceText: "",
            incident: false,
            incidentText: "",
            announcementEnabled: true
        }
    );
}

/* =========================================================
   LOG SYSTEM
========================================================= */

function addLog(action, user, details = "") {
    const data = logs();

    data.push({
        id: id(),
        action,
        userId: user?.id || null,
        userEmail: user?.email || "System",
        details,
        date: now()
    });

    /*
       Maximal 2000 Logs behalten.
    */

    if (data.length > 2000) {
        data.splice(
            0,
            data.length - 2000
        );
    }

    writeJSON(FILES.logs, data);
}

/* =========================================================
   USER
========================================================= */

function getUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return users().find(
        user =>
            user.id === req.session.userId
    ) || null;
}

function findUser(userId) {
    return users().find(
        user => user.id === userId
    ) || null;
}

function isOwner(user) {
    return Boolean(
        user &&
        user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
    );
}

function isAdmin(user) {
    if (!user) return false;

    return [
        "owner",
        "admin",
        "manager"
    ].includes(user.role);
}

function isTeam(user) {
    if (!user) return false;

    return [
        "owner",
        "admin",
        "manager",
        "developer",
        "maker",
        "moderator",
        "support"
    ].includes(user.role);
}

/* =========================================================
   BAN PRÜFUNG
========================================================= */

function updateExpiredBan(user) {
    if (
        user &&
        user.banned &&
        user.banUntil &&
        Date.now() >=
            new Date(user.banUntil).getTime()
    ) {
        const all = users();

        const found = all.find(
            u => u.id === user.id
        );

        if (found) {
            found.banned = false;
            found.banUntil = null;
            found.banReason = "";

            writeJSON(
                FILES.users,
                all
            );
        }

        return false;
    }

    return Boolean(user?.banned);
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (updateExpiredBan(user)) {
        return res.redirect("/banned");
    }

    next();
}

function requireAdmin(req, res, next) {
    const user = getUser(req);

    if (!user || !isAdmin(user)) {
        return res.status(403).send(
            page(
                "Keine Berechtigung",
                `
                <div class="card center">
                    <h1>Keine Berechtigung</h1>
                    <p>
                        Du darfst diesen Bereich nicht öffnen.
                    </p>

                    <a class="btn" href="/">
                        Zur Startseite
                    </a>
                </div>
                `,
                user
            )
        );
    }

    next();
}

function requireTeam(req, res, next) {
    const user = getUser(req);

    if (!user || !isTeam(user)) {
        return res.status(403).send(
            page(
                "Keine Berechtigung",
                `
                <div class="card center">
                    <h1>Team-Bereich</h1>
                    <p>
                        Dieser Bereich ist nur für das Team.
                    </p>
                </div>
                `,
                user
            )
        );
    }

    next();
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.urlencoded({
    extended: true,
    limit: "2mb"
}));

app.use(express.json({
    limit: "2mb"
}));

app.use(
    session({
        secret:
            "north-bot-2-session-secret-change-2026",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7,
            httpOnly: true,
            secure: false,
            sameSite: "lax"
        }
    })
);

/* =========================================================
   CSS / DESIGN
========================================================= */

const CSS = `
:root {
    --bg: #090b0f;
    --panel: #11151b;
    --panel2: #161b22;
    --border: #252b34;
    --text: #f4f5f7;
    --muted: #9da3ad;
    --accent: #5865f2;
    --danger: #ed4245;
    --success: #3ba55d;
    --warning: #faa61a;
}

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family:
        Inter,
        Arial,
        Helvetica,
        sans-serif;
}

a {
    color: inherit;
}

nav {
    height: 66px;
    border-bottom:
        1px solid var(--border);

    background:
        rgba(12,15,20,.96);

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 28px;

    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-weight: 800;
    font-size: 20px;
}

.navlinks {
    display: flex;
    gap: 17px;
    align-items: center;
}

.navlinks a {
    text-decoration: none;
    color: var(--muted);
    font-size: 14px;
}

.navlinks a:hover {
    color: white;
}

.container {
    width:
        min(
            1180px,
            calc(100% - 30px)
        );

    margin:
        35px auto 70px;
}

.hero {
    padding:
        65px 20px;

    text-align: center;

    border:
        1px solid var(--border);

    border-radius: 16px;

    background:
        linear-gradient(
            145deg,
            #11151c,
            #0c0f14
        );

    margin-bottom: 22px;
}

.hero h1 {
    font-size: 42px;
    margin: 0 0 12px;
}

.hero p {
    color: var(--muted);
}

.card {
    background: var(--panel);
    border:
        1px solid var(--border);

    border-radius: 13px;
    padding: 23px;
    margin-bottom: 18px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(
            auto-fit,
            minmax(220px,1fr)
        );

    gap: 17px;
}

.stat {
    background: var(--panel2);
    border:
        1px solid var(--border);

    border-radius: 12px;
    padding: 20px;
}

.stat span {
    color: var(--muted);
    font-size: 13px;
}

.stat strong {
    display: block;
    font-size: 28px;
    margin-top: 7px;
}

.btn {
    display: inline-block;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    text-decoration: none;
    padding: 11px 17px;
    cursor: pointer;
    font-weight: 650;
    margin:
        3px 4px 3px 0;
}

.btn:hover {
    filter: brightness(1.1);
}

.btn.red {
    background: var(--danger);
}

.btn.green {
    background: var(--success);
}

.btn.orange {
    background: var(--warning);
    color: #111;
}

.btn.gray {
    background: #303640;
}

input,
textarea,
select {
    width: 100%;
    padding: 12px;

    background: #0b0e13;

    border:
        1px solid #303640;

    border-radius: 8px;

    color: white;

    outline: none;

    margin:
        7px 0 15px;
}

textarea {
    min-height: 130px;
    resize: vertical;
}

label {
    color: #b9bec7;
    font-size: 13px;
}

button {
    font-family: inherit;
}

.badge {
    display: inline-block;

    padding:
        5px 9px;

    border-radius: 6px;

    background: #292f38;

    font-size: 12px;
}

.badge.owner {
    background: #9b59b6;
}

.badge.admin {
    background: #5865f2;
}

.badge.manager {
    background: #3498db;
}

.badge.developer {
    background: #e67e22;
}

.badge.maker {
    background: #16a085;
}

.badge.moderator {
    background: #c0392b;
}

.badge.support {
    background: #2ecc71;
}

.error {
    background: #32191b;
    border:
        1px solid #713033;

    color: #ffb5b5;

    padding: 12px;

    border-radius: 8px;

    margin-bottom: 15px;
}

.success {
    background: #17331f;
    border:
        1px solid #2c7040;

    color: #b8ffc7;

    padding: 12px;

    border-radius: 8px;

    margin-bottom: 15px;
}

.warning {
    background: #392b12;
    border:
        1px solid #7d5d18;

    color: #ffd889;

    padding: 12px;

    border-radius: 8px;

    margin-bottom: 15px;
}

.notice {
    padding: 14px;
    border-radius: 9px;
    margin-bottom: 15px;
}

.notice.maintenance {
    background: #392b12;
    border: 1px solid #7d5d18;
}

.notice.incident {
    background: #35191a;
    border: 1px solid #713033;
}

.item {
    background: var(--panel2);

    border:
        1px solid var(--border);

    border-radius: 10px;

    padding: 17px;

    margin-bottom: 10px;
}

.item h3 {
    margin-top: 0;
}

.muted {
    color: var(--muted);
}

.center {
    text-align: center;
}

.code {
    font-family:
        Consolas,
        monospace;

    font-size: 17px;

    letter-spacing: 1px;

    background: #090b0f;

    padding: 12px;

    border-radius: 7px;
}

.chat {
    max-height: 500px;
    overflow-y: auto;
}

.chat-message {
    padding: 12px;
    border-bottom:
        1px solid var(--border);
}

.chat-message b {
    margin-right: 6px;
}

.chat-message small {
    color: #686f79;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 11px;
    border-bottom:
        1px solid var(--border);
}

th {
    color: var(--muted);
    font-size: 13px;
}

footer {
    color: #606671;
    text-align: center;
    padding: 35px 10px;
}

@media(max-width:700px) {
    nav {
        padding: 0 14px;
    }

    .navlinks {
        gap: 8px;
    }

    .navlinks a {
        font-size: 12px;
    }

    .hero h1 {
        font-size: 32px;
    }

    .container {
        width:
            calc(100% - 20px);
    }
}
`;

/* =========================================================
   SEITEN-LAYOUT
========================================================= */

function page(title, content, user = null) {
    const cfg = settings();

    let notices = "";

    if (
        cfg.maintenance &&
        (!user || !isAdmin(user))
    ) {
        notices += `
            <div class="notice maintenance">
                <b>Wartung</b><br>
                ${escapeHTML(
                    cfg.maintenanceText ||
                    "Die Webseite befindet sich momentan in Wartung."
                )}
            </div>
        `;
    }

    if (cfg.incident) {
        notices += `
            <div class="notice incident">
                <b>Störung</b><br>
                ${escapeHTML(
                    cfg.incidentText ||
                    "Momentan liegt eine Störung vor."
                )}
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta
    name="viewport"
    content="width=device-width, initial-scale=1"
>
<title>
    ${escapeHTML(title)} | ${SITE_NAME}
</title>
<style>
${CSS}
</style>
</head>

<body>

<nav>

    <div class="logo">
        ${SITE_NAME}
    </div>

    <div class="navlinks">

        <a href="/">Start</a>

        ${
            user
                ? `
                    <a href="/dashboard">
                        Dashboard
                    </a>

                    <a href="/tickets">
                        Tickets
                    </a>

                    <a href="/coins">
                        Coins
                    </a>

                    <a href="/chat">
                        Chat
                    </a>

                    ${
                        isTeam(user)
                            ? `
                            <a href="/team-chat">
                                Team
                            </a>
                            `
                            : ""
                    }

                    ${
                        isAdmin(user)
                            ? `
                            <a href="/admin">
                                Admin
                            </a>
                            `
                            : ""
                    }

                    <a href="/profile">
                        Profil
                    </a>

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

<div class="container">

${notices}

${content}

</div>

<footer>
    ${SITE_NAME}
    ·
    <a href="${DISCORD_INVITE}" target="_blank">
        Discord
    </a>
</footer>

</body>
</html>
`;
}

/* =========================================================
   STARTSEITE
========================================================= */

app.get("/", (req, res) => {
    const user = getUser(req);

    const activeGiveaways =
        giveaways().filter(
            g =>
                !g.ended &&
                new Date(g.endAt).getTime() >
                    Date.now()
        );

    res.send(
        page(
            "Startseite",
            `
            <section class="hero">

                <h1>
                    North-Bot-2
                </h1>

                <p>
                    Community, Support und Verwaltung
                    an einem Ort.
                </p>

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
                           href="/login">
                            Anmelden
                        </a>

                        <a class="btn gray"
                           href="/register">
                            Account erstellen
                        </a>
                        `
                }

                <a
                    class="btn gray"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Discord beitreten
                </a>

            </section>

            <div class="grid">

                <div class="card">
                    <h2>Support</h2>
                    <p class="muted">
                        Erstelle ein Ticket und
                        verwalte deine Anfragen.
                    </p>

                    ${
                        user
                            ? `
                            <a class="btn"
                               href="/tickets">
                                Ticket erstellen
                            </a>
                            `
                            : ""
                    }
                </div>

                <div class="card">
                    <h2>Coins</h2>
                    <p class="muted">
                        Sammle Coins, löse Codes ein
                        und kaufe Produkte.
                    </p>

                    ${
                        user
                            ? `
                            <a class="btn"
                               href="/coins">
                                Coins
                            </a>
                            `
                            : ""
                    }
                </div>

                <div class="card">
                    <h2>Gewinnspiele</h2>

                    <p class="muted">
                        Nimm an aktuellen
                        Gewinnspielen teil.
                    </p>

                    <b>
                        ${activeGiveaways.length}
                        aktiv
                    </b>
                </div>

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   REGISTRIERUNG
========================================================= */

app.get("/register", (req, res) => {
    if (getUser(req)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Registrierung",
            `
            <div class="card"
                 style="max-width:520px;margin:auto">

                <h1>Registrieren</h1>

                <form
                    method="POST"
                    action="/register"
                >

                    <label>
                        Name
                    </label>

                    <input
                        name="name"
                        maxlength="40"
                        required
                        autocomplete="name"
                    >

                    <label>
                        E-Mail
                    </label>

                    <input
                        type="email"
                        name="email"
                        required
                        autocomplete="email"
                    >

                    <label>
                        Passwort
                    </label>

                    <input
                        type="password"
                        name="password"
                        minlength="6"
                        required
                        autocomplete="new-password"
                    >

                    <label>
                        Passwort wiederholen
                    </label>

                    <input
                        type="password"
                        name="password2"
                        minlength="6"
                        required
                        autocomplete="new-password"
                    >

                    <button
                        class="btn"
                        type="submit"
                    >
                        Account erstellen
                    </button>

                </form>

                <p class="muted">
                    Bereits registriert?
                    <a href="/login">
                        Anmelden
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", (req, res) => {
    const name =
        String(req.body.name || "")
            .trim()
            .slice(0, 40);

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const password2 =
        String(req.body.password2 || "");

    if (
        !name ||
        !email ||
        !password
    ) {
        return res.send(
            page(
                "Fehler",
                `
                <div class="card">
                    <div class="error">
                        Bitte fülle alle Felder aus.
                    </div>

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
        return res.send(
            page(
                "Fehler",
                `
                <div class="card">
                    <div class="error">
                        Das Passwort muss mindestens
                        6 Zeichen lang sein.
                    </div>

                    <a class="btn"
                       href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    if (password !== password2) {
        return res.send(
            page(
                "Fehler",
                `
                <div class="card">
                    <div class="error">
                        Die Passwörter stimmen nicht überein.
                    </div>

                    <a class="btn"
                       href="/register">
                        Zurück
                    </a>
                </div>
                `
            )
        );
    }

    const all = users();

    if (
        all.some(
            u =>
                u.email.toLowerCase() ===
                email
        )
    ) {
        return res.send(
            page(
                "Fehler",
                `
                <div class="card">
                    <div class="error">
                        Diese E-Mail ist bereits registriert.
                    </div>

                    <a class="btn"
                       href="/login">
                        Zum Login
                    </a>
                </div>
                `
            )
        );
    }

    const user = {
        id: id(),
        name,
        email,
        password: passwordHash(password),

        role:
            email === OWNER_EMAIL
                ? "owner"
                : "user",

        coins: 0,

        banned: false,
        banReason: "",
        banUntil: null,

        dailyClaim: null,

        createdAt: now(),
        lastLogin: null
    };

    all.push(user);

    writeJSON(
        FILES.users,
        all
    );

    addLog(
        "REGISTER",
        user,
        "Account erstellt"
    );

    req.session.userId = user.id;

    res.redirect("/dashboard");
});

/* =========================================================
   LOGIN
========================================================= */

app.get("/login", (req, res) => {
    if (getUser(req)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Login",
            `
            <div class="card"
                 style="max-width:520px;margin:auto">

                <h1>Anmelden</h1>

                <form
                    method="POST"
                    action="/login"
                >

                    <label>
                        E-Mail
                    </label>

                    <input
                        type="email"
                        name="email"
                        required
                        autocomplete="email"
                    >

                    <label>
                        Passwort
                    </label>

                    <input
                        type="password"
                        name="password"
                        required
                        autocomplete="current-password"
                    >

                    <button
                        class="btn"
                        type="submit"
                    >
                        Anmelden
                    </button>

                </form>

                <p class="muted">
                    Noch kein Account?
                    <a href="/register">
                        Registrieren
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post("/login", (req, res) => {
    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const user =
        users().find(
            u =>
                u.email.toLowerCase() ===
                email
        );

    if (!user) {
        return res.send(
            page(
                "Login",
                `
                <div class="card">
                    <div class="error">
                        E-Mail oder Passwort ist falsch.
                    </div>

                    <a class="btn"
                       href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (updateExpiredBan(user)) {
        return res.redirect("/banned");
    }

    if (
        user.password !==
        passwordHash(password)
    ) {
        return res.send(
            page(
                "Login",
                `
                <div class="card">
                    <div class="error">
                        E-Mail oder Passwort ist falsch.
                    </div>

                    <a class="btn"
                       href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    const all = users();

    const found =
        all.find(
            u => u.id === user.id
        );

    if (found) {
        found.lastLogin = now();

        /*
           Owner-E-Mail wird bei jedem Login
           automatisch wieder Owner.
        */

        if (
            found.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase()
        ) {
            found.role = "owner";
        }

        writeJSON(
            FILES.users,
            all
        );
    }

    req.session.regenerate(err => {
        if (err) {
            console.error(err);

            return res.status(500).send(
                page(
                    "Fehler",
                    `
                    <div class="card">
                        <div class="error">
                            Login konnte nicht gestartet werden.
                        </div>
                    </div>
                    `
                )
            );
        }

        req.session.userId =
            user.id;

        req.session.save(
            saveError => {
                if (saveError) {
                    console.error(saveError);

                    return res.status(500).send(
                        page(
                            "Fehler",
                            `
                            <div class="card">
                                <div class="error">
                                    Session konnte nicht gespeichert werden.
                                </div>
                            </div>
                            `
                        )
                    );
                }

                addLog(
                    "LOGIN",
                    user,
                    "Erfolgreich angemeldet"
                );

                res.redirect(
                    "/dashboard"
                );
            }
        );
    });
});

/* =========================================================
   LOGOUT
========================================================= */

app.get("/logout", (req, res) => {
    const user = getUser(req);

    if (user) {
        addLog(
            "LOGOUT",
            user,
            "Abgemeldet"
        );
    }

    req.session.destroy(() => {
        res.redirect("/");
    });
});

/* =========================================================
   BAN SEITE
========================================================= */

app.get("/banned", (req, res) => {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!updateExpiredBan(user)) {
        return res.redirect("/dashboard");
    }

    res.send(
        page(
            "Account gesperrt",
            `
            <div class="card center">

                <h1>
                    Account gesperrt
                </h1>

                <p>
                    Dein Zugang zur Webseite wurde gesperrt.
                </p>

                <p>
                    <b>Grund:</b>
                    ${escapeHTML(
                        user.banReason ||
                        "Kein Grund angegeben"
                    )}
                </p>

                <p>
                    <b>Ende:</b>
                    ${
                        user.banUntil
                            ? formatDate(
                                user.banUntil
                            )
                            : "Dauerhaft"
                    }
                </p>

                <a
                    class="btn"
                    href="${DISCORD_INVITE}"
                    target="_blank"
                >
                    Auf Discord kontaktieren
                </a>

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const myTickets =
            tickets().filter(
                t =>
                    t.userId ===
                    user.id
            );

        const activeGiveaways =
            giveaways().filter(
                g =>
                    !g.ended &&
                    new Date(g.endAt).getTime() >
                        Date.now()
            );

        res.send(
            page(
                "Dashboard",
                `
                <div class="hero">

                    <h1>
                        Willkommen,
                        ${escapeHTML(user.name)}
                    </h1>

                    <p>
                        Dein North-Bot-2 Dashboard
                    </p>

                    <span class="badge ${user.role}">
                        ${escapeHTML(user.role)}
                    </span>

                </div>

                <div class="grid">

                    <div class="stat">
                        <span>Coins</span>
                        <strong>
                            ${Number(user.coins || 0)}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>Tickets</span>
                        <strong>
                            ${myTickets.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>Gewinnspiele</span>
                        <strong>
                            ${activeGiveaways.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>Rolle</span>
                        <strong>
                            ${escapeHTML(user.role)}
                        </strong>
                    </div>

                </div>

                <div class="card">

                    <h2>
                        Tägliche Coins
                    </h2>

                    <p class="muted">
                        Alle 14 Stunden kannst du
                        100 Coins abholen.
                    </p>

                    <a
                        class="btn green"
                        href="/daily"
                    >
                        Daily abholen
                    </a>

                </div>

                <div class="card">

                    <h2>
                        Schnellzugriff
                    </h2>

                    <a
                        class="btn"
                        href="/tickets"
                    >
                        Ticket erstellen
                    </a>

                    <a
                        class="btn"
                        href="/coins"
                    >
                        Coins & Shop
                    </a>

                    <a
                        class="btn"
                        href="/giveaways"
                    >
                        Gewinnspiele
                    </a>

                    <a
                        class="btn"
                        href="/chat"
                    >
                        Community Chat
                    </a>

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   DAILY 100 COINS
========================================================= */

app.get(
    "/daily",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const all = users();

        const found =
            all.find(
                u => u.id === user.id
            );

        const cooldown =
            14 * 60 * 60 * 1000;

        if (
            found.dailyClaim &&
            Date.now() -
                new Date(
                    found.dailyClaim
                ).getTime()
                <
                cooldown
        ) {

            const remaining =
                cooldown -
                (
                    Date.now() -
                    new Date(
                        found.dailyClaim
                    ).getTime()
                );

            const hours =
                Math.floor(
                    remaining /
                    3600000
                );

            const minutes =
                Math.floor(
                    (
                        remaining %
                        3600000
                    ) /
                    60000
                );

            return res.send(
                page(
                    "Daily",
                    `
                    <div class="card center">

                        <h1>
                            Daily bereits abgeholt
                        </h1>

                        <p>
                            Du kannst in
                            <b>
                                ${hours}h
                                ${minutes}m
                            </b>
                            wieder 100 Coins abholen.
                        </p>

                        <a
                            class="btn"
                            href="/dashboard"
                        >
                            Dashboard
                        </a>

                    </div>
                    `,
                    user
                )
            );
        }

        found.coins =
            Number(found.coins || 0) +
            100;

        found.dailyClaim = now();

        writeJSON(
            FILES.users,
            all
        );

        addLog(
            "DAILY",
            found,
            "+100 Coins"
        );

        res.send(
            page(
                "Daily",
                `
                <div class="card center">

                    <div class="success">
                        Du hast
                        <b>100 Coins</b>
                        erhalten.
                    </div>

                    <a
                        class="btn"
                        href="/coins"
                    >
                        Coins anzeigen
                    </a>

                </div>
                `,
                found
            )
        );
    }
);

/* =========================================================
   COINS
========================================================= */

app.get(
    "/coins",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const shop =
            products().filter(
                p => p.enabled !== false
            );

        res.send(
            page(
                "Coins",
                `
                <div class="card">

                    <h1>
                        Meine Coins
                    </h1>

                    <div class="stat">
                        <span>
                            Kontostand
                        </span>

                        <strong>
                            ${Number(
                                user.coins || 0
                            )}
                        </strong>
                    </div>

                </div>

                <div class="card">

                    <h2>
                        Coin-Code einlösen
                    </h2>

                    <p class="muted">
                        Ein Code kann pro Benutzer
                        nur einmal verwendet werden.
                    </p>

                    <form
                        method="POST"
                        action="/coins/redeem"
                    >

                        <input
                            name="code"
                            placeholder="NORTH-XXXX-XXXX"
                            maxlength="30"
                            required
                        >

                        <button
                            class="btn green"
                        >
                            Code einlösen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        Coin Shop
                    </h2>

                    ${
                        shop.length === 0
                            ? `
                            <p class="muted">
                                Noch keine Produkte vorhanden.
                            </p>
                            `
                            : shop.map(
                                product => `
                                <div class="item">

                                    <h3>
                                        ${escapeHTML(
                                            product.name
                                        )}
                                    </h3>

                                    <p>
                                        ${escapeHTML(
                                            product.description ||
                                            ""
                                        )}
                                    </p>

                                    <b>
                                        ${Number(
                                            product.price
                                        )}
                                        Coins
                                    </b>

                                    <br><br>

                                    <form
                                        method="POST"
                                        action="/shop/buy"
                                    >

                                        <input
                                            type="hidden"
                                            name="productId"
                                            value="${product.id}"
                                        >

                                        <button
                                            class="btn"
                                        >
                                            Kaufen
                                        </button>

                                    </form>

                                </div>
                                `
                            ).join("")
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   CODE EINLÖSEN
========================================================= */

app.post(
    "/coins/redeem",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const code =
            String(
                req.body.code || ""
            )
                .trim()
                .toUpperCase();

        const allCodes = codes();

        const found =
            allCodes.find(
                c =>
                    c.code === code
            );

        if (!found) {
            return res.send(
                page(
                    "Code",
                    `
                    <div class="card">

                        <div class="error">
                            Dieser Code existiert nicht.
                        </div>

                        <a
                            class="btn"
                            href="/coins"
                        >
                            Zurück
                        </a>

                    </div>
                    `,
                    user
                )
            );
        }

        if (
            found.disabled ||
            found.remaining <= 0
        ) {
            return res.send(
                page(
                    "Code",
                    `
                    <div class="card">

                        <div class="error">
                            Dieser Code ist nicht mehr verfügbar.
                        </div>

                        <a
                            class="btn"
                            href="/coins"
                        >
                            Zurück
                        </a>

                    </div>
                    `,
                    user
                )
            );
        }

        if (
            found.usedBy.includes(
                user.id
            )
        ) {
            return res.send(
                page(
                    "Code",
                    `
                    <div class="card">

                        <div class="error">
                            Du hast diesen Code bereits eingelöst.
                        </div>

                        <a
                            class="btn"
                            href="/coins"
                        >
                            Zurück
                        </a>

                    </div>
                    `,
                    user
                )
            );
        }

        const allUsers = users();

        const target =
            allUsers.find(
                u => u.id === user.id
            );

        target.coins =
            Number(target.coins || 0) +
            Number(found.coins);

        found.usedBy.push(
            user.id
        );

        found.remaining--;

        writeJSON(
            FILES.users,
            allUsers
        );

        writeJSON(
            FILES.codes,
            allCodes
        );

        addLog(
            "CODE_REDEEM",
            target,
            `${found.code} | +${found.coins} Coins`
        );

        res.send(
            page(
                "Code eingelöst",
                `
                <div class="card center">

                    <div class="success">
                        Code erfolgreich eingelöst.
                        <br><br>
                        Du hast
                        <b>
                            +${Number(found.coins)}
                            Coins
                        </b>
                        erhalten.
                    </div>

                    <a
                        class="btn"
                        href="/coins"
                    >
                        Coins anzeigen
                    </a>

                </div>
                `,
                target
            )
        );
    }
);

/* =========================================================
   SHOP KAUFEN
========================================================= */

app.post(
    "/shop/buy",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const product =
            products().find(
                p =>
                    p.id ===
                    req.body.productId &&
                    p.enabled !== false
            );

        if (!product) {
            return res.redirect("/coins");
        }

        const allUsers = users();

        const target =
            allUsers.find(
                u => u.id === user.id
            );

        if (
            Number(target.coins || 0) <
            Number(product.price)
        ) {
            return res.send(
                page(
                    "Shop",
                    `
                    <div class="card">

                        <div class="error">
                            Du hast nicht genug Coins.
                        </div>

                        <a
                            class="btn"
                            href="/coins"
                        >
                            Zurück
                        </a>

                    </div>
                    `,
                    target
                )
            );
        }

        target.coins -=
            Number(product.price);

        const orders =
            readJSON(
                FILES.orders,
                []
            );

        const order = {
            id: id(),
            number: createOrderNumber(),

            userId: target.id,
            userEmail: target.email,
            userName: target.name,

            productId: product.id,
            productName: product.name,

            price: Number(
                product.price
            ),

            status: "offen",

            createdAt: now()
        };

        orders.push(order);

        writeJSON(
            FILES.users,
            allUsers
        );

        writeJSON(
            FILES.orders,
            orders
        );

        addLog(
            "SHOP_BUY",
            target,
            `${order.number} | ${product.name}`
        );

        res.send(
            page(
                "Bestellung",
                `
                <div class="card center">

                    <div class="success">
                        Bestellung erfolgreich.
                    </div>

                    <h2>
                        Bestellnummer
                    </h2>

                    <div class="code">
                        ${order.number}
                    </div>

                    <p class="muted">
                        Gib diese Bestellnummer
                        bei Bedarf dem Team.
                    </p>

                    <a
                        class="btn"
                        href="/coins"
                    >
                        Zurück zum Shop
                    </a>

                </div>
                `,
                target
            )
        );
    }
);

/* =========================================================
   TICKETS
========================================================= */

app.get(
    "/tickets",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const all =
            tickets();

        const visible =
            isTeam(user)
                ? all
                : all.filter(
                    t =>
                        t.userId ===
                        user.id
                );

        res.send(
            page(
                "Tickets",
                `
                <div class="card">

                    <h1>
                        Support Tickets
                    </h1>

                    <p class="muted">
                        Kategorie:
                        ${TICKET_CATEGORY_ID}
                    </p>

                    <form
                        method="POST"
                        action="/tickets/create"
                    >

                        <label>
                            Betreff
                        </label>

                        <input
                            name="subject"
                            maxlength="100"
                            required
                        >

                        <label>
                            Nachricht
                        </label>

                        <textarea
                            name="message"
                            maxlength="3000"
                            required
                        ></textarea>

                        <button
                            class="btn"
                        >
                            Ticket erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        ${
                            isTeam(user)
                                ? "Alle Tickets"
                                : "Meine Tickets"
                        }
                    </h2>

                    ${
                        visible.length === 0
                            ? `
                            <p class="muted">
                                Keine Tickets vorhanden.
                            </p>
                            `
                            : visible
                                .slice()
                                .reverse()
                                .map(
                                    ticket => `
                                    <div class="item">

                                        <h3>
                                            ${escapeHTML(
                                                ticket.subject
                                            )}
                                        </h3>

                                        <div class="code">
                                            ${ticket.number}
                                        </div>

                                        <p>
                                            ${escapeHTML(
                                                ticket.message
                                            )}
                                        </p>

                                        <p class="muted">
                                            Erstellt von:
                                            ${escapeHTML(
                                                ticket.userName
                                            )}
                                            <br>
                                            ${formatDate(
                                                ticket.createdAt
                                            )}
                                        </p>

                                        <span class="badge">
                                            ${escapeHTML(
                                                ticket.status
                                            )}
                                        </span>

                                        ${
                                            isTeam(user)
                                                ? `
                                                <form
                                                    method="POST"
                                                    action="/tickets/claim"
                                                    style="margin-top:10px"
                                                >

                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value="${ticket.id}"
                                                    >

                                                    <button
                                                        class="btn green"
                                                    >
                                                        Übernehmen
                                                    </button>

                                                </form>

                                                <form
                                                    method="POST"
                                                    action="/tickets/unclaim"
                                                >

                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value="${ticket.id}"
                                                    >

                                                    <button
                                                        class="btn gray"
                                                    >
                                                        Unübernehmen
                                                    </button>

                                                </form>

                                                <form
                                                    method="POST"
                                                    action="/tickets/close"
                                                >

                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value="${ticket.id}"
                                                    >

                                                    <button
                                                        class="btn red"
                                                    >
                                                        Schließen
                                                    </button>

                                                </form>
                                                `
                                                : ""
                                        }

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   TICKET ERSTELLEN
========================================================= */

app.post(
    "/tickets/create",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const ticket = {
            id: id(),
            number: createTicketNumber(),

            userId: user.id,
            userName: user.name,
            userEmail: user.email,

            subject:
                String(
                    req.body.subject || ""
                )
                    .trim()
                    .slice(0, 100),

            message:
                String(
                    req.body.message || ""
                )
                    .trim()
                    .slice(0, 3000),

            status: "offen",

            claimedBy: null,
            claimedByName: null,

            discordCategoryId:
                TICKET_CATEGORY_ID,

            createdAt: now(),
            closedAt: null
        };

        const all =
            tickets();

        all.push(ticket);

        writeJSON(
            FILES.tickets,
            all
        );

        addLog(
            "TICKET_CREATE",
            user,
            ticket.number
        );

        res.redirect("/tickets");
    }
);

/* =========================================================
   TICKET ÜBERNEHMEN
========================================================= */

app.post(
    "/tickets/claim",
    requireTeam,
    (req, res) => {

        const user = getUser(req);

        const all =
            tickets();

        const ticket =
            all.find(
                t =>
                    t.id ===
                    req.body.id
            );

        if (ticket) {
            ticket.status =
                "in_bearbeitung";

            ticket.claimedBy =
                user.id;

            ticket.claimedByName =
                user.name;

            writeJSON(
                FILES.tickets,
                all
            );

            addLog(
                "TICKET_CLAIM",
                user,
                ticket.number
            );
        }

        res.redirect("/tickets");
    }
);

/* =========================================================
   TICKET UNÜBERNEHMEN
========================================================= */

app.post(
    "/tickets/unclaim",
    requireTeam,
    (req, res) => {

        const user = getUser(req);

        const all =
            tickets();

        const ticket =
            all.find(
                t =>
                    t.id ===
                    req.body.id
            );

        if (ticket) {

            ticket.status =
                "offen";

            ticket.claimedBy = null;
            ticket.claimedByName = null;

            writeJSON(
                FILES.tickets,
                all
            );

            addLog(
                "TICKET_UNCLAIM",
                user,
                ticket.number
            );
        }

        res.redirect("/tickets");
    }
);

/* =========================================================
   TICKET SCHLIESSEN
========================================================= */

app.post(
    "/tickets/close",
    requireTeam,
    (req, res) => {

        const user = getUser(req);

        const all =
            tickets();

        const ticket =
            all.find(
                t =>
                    t.id ===
                    req.body.id
            );

        if (ticket) {

            ticket.status =
                "geschlossen";

            ticket.closedAt =
                now();

            writeJSON(
                FILES.tickets,
                all
            );

            addLog(
                "TICKET_CLOSE",
                user,
                ticket.number
            );
        }

        res.redirect("/tickets");
    }
);

/* =========================================================
   COMMUNITY CHAT
========================================================= */

app.get(
    "/chat",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const msgs =
            messages()
                .filter(
                    m =>
                        m.channel ===
                        "community"
                )
                .slice(-100);

        res.send(
            page(
                "Community Chat",
                `
                <div class="card">

                    <h1>
                        Community Chat
                    </h1>

                    <div class="chat">

                        ${
                            msgs.length === 0
                                ? `
                                <p class="muted">
                                    Noch keine Nachrichten.
                                </p>
                                `
                                : msgs.map(
                                    msg => `
                                    <div class="chat-message">

                                        <b>
                                            ${escapeHTML(
                                                msg.userName
                                            )}
                                        </b>

                                        <small>
                                            ${formatDate(
                                                msg.createdAt
                                            )}
                                        </small>

                                        <div>
                                            ${escapeHTML(
                                                msg.message
                                            )}
                                        </div>

                                    </div>
                                    `
                                ).join("")
                        }

                    </div>

                </div>

                <div class="card">

                    <form
                        method="POST"
                        action="/chat/send"
                    >

                        <textarea
                            name="message"
                            maxlength="1000"
                            placeholder="Nachricht schreiben..."
                            required
                        ></textarea>

                        <button
                            class="btn"
                        >
                            Senden
                        </button>

                    </form>

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    "/chat/send",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const message =
            String(
                req.body.message || ""
            )
                .trim()
                .slice(0, 1000);

        if (!message) {
            return res.redirect(
                "/chat"
            );
        }

        const all =
            messages();

        all.push({
            id: id(),

            channel:
                "community",

            userId:
                user.id,

            userName:
                user.name,

            message,

            createdAt:
                now()
        });

        if (all.length > 3000) {
            all.splice(
                0,
                all.length - 3000
            );
        }

        writeJSON(
            FILES.messages,
            all
        );

        res.redirect(
            "/chat"
        );
    }
);

/* =========================================================
   TEAM CHAT
========================================================= */

app.get(
    "/team-chat",
    requireTeam,
    (req, res) => {

        const user = getUser(req);

        const msgs =
            messages()
                .filter(
                    m =>
                        m.channel ===
                        "team"
                )
                .slice(-100);

        res.send(
            page(
                "Team Chat",
                `
                <div class="card">

                    <h1>
                        Team Chat
                    </h1>

                    <p class="muted">
                        Dieser Bereich ist nur
                        für Teammitglieder sichtbar.
                    </p>

                    <div class="chat">

                        ${
                            msgs.length === 0
                                ? `
                                <p class="muted">
                                    Noch keine Nachrichten.
                                </p>
                                `
                                : msgs.map(
                                    msg => `
                                    <div class="chat-message">

                                        <b>
                                            ${escapeHTML(
                                                msg.userName
                                            )}
                                        </b>

                                        <small>
                                            ${formatDate(
                                                msg.createdAt
                                            )}
                                        </small>

                                        <div>
                                            ${escapeHTML(
                                                msg.message
                                            )}
                                        </div>

                                    </div>
                                    `
                                ).join("")
                        }

                    </div>

                </div>

                <div class="card">

                    <form
                        method="POST"
                        action="/team-chat/send"
                    >

                        <textarea
                            name="message"
                            maxlength="2000"
                            required
                        ></textarea>

                        <button
                            class="btn"
                        >
                            Senden
                        </button>

                    </form>

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    "/team-chat/send",
    requireTeam,
    (req, res) => {

        const user = getUser(req);

        const message =
            String(
                req.body.message || ""
            )
                .trim()
                .slice(0, 2000);

        if (!message) {
            return res.redirect(
                "/team-chat"
            );
        }

        const all =
            messages();

        all.push({
            id: id(),

            channel:
                "team",

            userId:
                user.id,

            userName:
                user.name,

            message,

            createdAt:
                now()
        });

        writeJSON(
            FILES.messages,
            all
        );

        addLog(
            "TEAM_CHAT",
            user,
            message.slice(0, 100)
        );

        res.redirect(
            "/team-chat"
        );
    }
);

/* =========================================================
   GEWINNSPIELE
========================================================= */

app.get(
    "/giveaways",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const all =
            giveaways();

        const active =
            all.filter(
                g =>
                    !g.ended &&
                    new Date(g.endAt).getTime() >
                        Date.now()
            );

        res.send(
            page(
                "Gewinnspiele",
                `
                <div class="card">

                    <h1>
                        Gewinnspiele
                    </h1>

                    <p class="muted">
                        Nimm an unseren
                        Community-Gewinnspielen teil.
                    </p>

                </div>

                ${
                    active.length === 0
                        ? `
                        <div class="card">
                            <p class="muted">
                                Aktuell gibt es
                                keine Gewinnspiele.
                            </p>
                        </div>
                        `
                        : active.map(
                            giveaway => {

                                const joined =
                                    giveaway.entries
                                        .includes(
                                            user.id
                                        );

                                return `
                                <div class="card">

                                    <h2>
                                        ${escapeHTML(
                                            giveaway.title
                                        )}
                                    </h2>

                                    <p>
                                        ${escapeHTML(
                                            giveaway.description
                                        )}
                                    </p>

                                    <p>
                                        <b>
                                            Gewinn:
                                        </b>
                                        ${escapeHTML(
                                            giveaway.prize
                                        )}
                                    </p>

                                    <p class="muted">
                                        Ende:
                                        ${formatDate(
                                            giveaway.endAt
                                        )}
                                    </p>

                                    ${
                                        joined
                                            ? `
                                            <span class="badge">
                                                Bereits teilgenommen
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
                                                    value="${giveaway.id}"
                                                >

                                                <button
                                                    class="btn green"
                                                >
                                                    Teilnehmen
                                                </button>

                                            </form>
                                            `
                                    }

                                </div>
                                `;
                            }
                        ).join("")
                }
                `,
                user
            )
        );
    }
);

app.post(
    "/giveaways/join",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const all =
            giveaways();

        const giveaway =
            all.find(
                g =>
                    g.id ===
                    req.body.id
            );

        if (!giveaway) {
            return res.redirect(
                "/giveaways"
            );
        }

        if (
            giveaway.ended ||
            new Date(
                giveaway.endAt
            ).getTime() <=
                Date.now()
        ) {
            return res.redirect(
                "/giveaways"
            );
        }

        if (
            !giveaway.entries.includes(
                user.id
            )
        ) {
            giveaway.entries.push(
                user.id
            );

            writeJSON(
                FILES.giveaways,
                all
            );

            addLog(
                "GIVEAWAY_JOIN",
                user,
                giveaway.title
            );
        }

        res.redirect(
            "/giveaways"
        );
    }
);

/* =========================================================
   PROFIL
========================================================= */

app.get(
    "/profile",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        res.send(
            page(
                "Profil",
                `
                <div class="card">

                    <h1>
                        Mein Profil
                    </h1>

                    <form
                        method="POST"
                        action="/profile"
                    >

                        <label>
                            Name
                        </label>

                        <input
                            name="name"
                            value="${escapeHTML(
                                user.name
                            )}"
                            maxlength="40"
                            required
                        >

                        <button
                            class="btn"
                        >
                            Profil speichern
                        </button>

                    </form>

                </div>

                <div class="card">

                    <p>
                        <b>E-Mail:</b>
                        ${escapeHTML(
                            user.email
                        )}
                    </p>

                    <p>
                        <b>Rolle:</b>
                        ${escapeHTML(
                            user.role
                        )}
                    </p>

                    <p>
                        <b>Coins:</b>
                        ${Number(
                            user.coins || 0
                        )}
                    </p>

                    <p>
                        <b>Registriert:</b>
                        ${formatDate(
                            user.createdAt
                        )}
                    </p>

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    "/profile",
    requireLogin,
    (req, res) => {

        const user = getUser(req);

        const all =
            users();

        const found =
            all.find(
                u =>
                    u.id ===
                    user.id
            );

        if (found) {
            found.name =
                String(
                    req.body.name || ""
                )
                    .trim()
                    .slice(0, 40);

            writeJSON(
                FILES.users,
                all
            );

            addLog(
                "PROFILE_UPDATE",
                found,
                "Name geändert"
            );
        }

        res.redirect(
            "/profile"
        );
    }
);

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        const user = getUser(req);

        const allUsers =
            users();

        const allTickets =
            tickets();

        const allCodes =
            codes();

        const allProducts =
            products();

        const allGiveaways =
            giveaways();

        const allLogs =
            logs();

        const allOrders =
            readJSON(
                FILES.orders,
                []
            );

        const totalCoins =
            allUsers.reduce(
                (sum, u) =>
                    sum +
                    Number(
                        u.coins || 0
                    ),
                0
            );

        res.send(
            page(
                "Admin Panel",
                `
                <div class="hero">

                    <h1>
                        Admin Panel
                    </h1>

                    <p>
                        North-Bot-2 Verwaltung
                    </p>

                    <span class="badge ${user.role}">
                        ${escapeHTML(
                            user.role
                        )}
                    </span>

                </div>

                <div class="grid">

                    <div class="stat">
                        <span>
                            Benutzer
                        </span>
                        <strong>
                            ${allUsers.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Tickets
                        </span>
                        <strong>
                            ${allTickets.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Coin Codes
                        </span>
                        <strong>
                            ${allCodes.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Produkte
                        </span>
                        <strong>
                            ${allProducts.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Gewinnspiele
                        </span>
                        <strong>
                            ${allGiveaways.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Logs
                        </span>
                        <strong>
                            ${allLogs.length}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Coins im System
                        </span>
                        <strong>
                            ${totalCoins}
                        </strong>
                    </div>

                    <div class="stat">
                        <span>
                            Bestellungen
                        </span>
                        <strong>
                            ${allOrders.length}
                        </strong>
                    </div>

                </div>

                <br>

                <div class="grid">

                    <div class="card">
                        <h2>
                            Benutzer
                        </h2>

                        <p>
                            Accounts, Rollen,
                            Coins und Bans verwalten.
                        </p>

                        <a
                            class="btn"
                            href="/admin/users"
                        >
                            Benutzer verwalten
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Coin Codes
                        </h2>

                        <p>
                            Codes erstellen,
                            ansehen und deaktivieren.
                        </p>

                        <a
                            class="btn"
                            href="/admin/codes"
                        >
                            Codes verwalten
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Coin Shop
                        </h2>

                        <p>
                            Produkte hinzufügen
                            und Preise ändern.
                        </p>

                        <a
                            class="btn"
                            href="/admin/shop"
                        >
                            Shop verwalten
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Gewinnspiele
                        </h2>

                        <p>
                            Gewinnspiele für
                            Webseiten-Nutzer erstellen.
                        </p>

                        <a
                            class="btn"
                            href="/admin/giveaways"
                        >
                            Gewinnspiele
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Webseite
                        </h2>

                        <p>
                            Wartung, Störung
                            und Ankündigungen.
                        </p>

                        <a
                            class="btn"
                            href="/admin/site"
                        >
                            Webseite verwalten
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Logs
                        </h2>

                        <p>
                            Aktionen auf der
                            Webseite kontrollieren.
                        </p>

                        <a
                            class="btn"
                            href="/admin/logs"
                        >
                            Logs anzeigen
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Bestellungen
                        </h2>

                        <p>
                            Shop-Bestellungen
                            anzeigen.
                        </p>

                        <a
                            class="btn"
                            href="/admin/orders"
                        >
                            Bestellungen
                        </a>
                    </div>

                    <div class="card">
                        <h2>
                            Tickets
                        </h2>

                        <p>
                            Support-Tickets
                            verwalten.
                        </p>

                        <a
                            class="btn"
                            href="/tickets"
                        >
                            Tickets
                        </a>
                    </div>

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   ADMIN BENUTZER
========================================================= */

app.get(
    "/admin/users",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            users();

        res.send(
            page(
                "Benutzer",
                `
                <div class="card">

                    <h1>
                        Benutzerverwaltung
                    </h1>

                    <p class="muted">
                        ${all.length}
                        registrierte Benutzer
                    </p>

                </div>

                ${all.map(
                    user => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(
                                user.name
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                user.email
                            )}
                        </p>

                        <span class="badge ${user.role}">
                            ${escapeHTML(
                                user.role
                            )}
                        </span>

                        <p>
                            Coins:
                            <b>
                                ${Number(
                                    user.coins || 0
                                )}
                            </b>
                        </p>

                        <p>
                            Status:
                            ${
                                user.banned
                                    ? "<b>GEBANNT</b>"
                                    : "Aktiv"
                            }
                        </p>

                        ${
                            user.id !==
                            admin.id
                                ? `
                                <form
                                    method="POST"
                                    action="/admin/user/role"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${user.id}"
                                    >

                                    <label>
                                        Rolle
                                    </label>

                                    <select name="role">

                                        ${
                                            [
                                                "user",
                                                "support",
                                                "moderator",
                                                "developer",
                                                "maker",
                                                "manager",
                                                "admin"
                                            ].map(
                                                role =>
                                                    `
                                                    <option
                                                        value="${role}"
                                                        ${
                                                            user.role === role
                                                                ? "selected"
                                                                : ""
                                                        }
                                                    >
                                                        ${role}
                                                    </option>
                                                    `
                                            ).join("")
                                        }

                                    </select>

                                    <button
                                        class="btn"
                                    >
                                        Rolle speichern
                                    </button>

                                </form>

                                <form
                                    method="POST"
                                    action="/admin/user/coins"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${user.id}"
                                    >

                                    <label>
                                        Coins hinzufügen/entfernen
                                    </label>

                                    <input
                                        type="number"
                                        name="amount"
                                        placeholder="z.B. 500 oder -100"
                                        required
                                    >

                                    <button
                                        class="btn green"
                                    >
                                        Coins ändern
                                    </button>

                                </form>

                                <form
                                    method="POST"
                                    action="/admin/user/ban"
                                >

                                    <input
                                        type="hidden"
                                        name="id"
                                        value="${user.id}"
                                    >

                                    <label>
                                        Ban-Dauer in Minuten
                                    </label>

                                    <input
                                        type="number"
                                        name="minutes"
                                        min="1"
                                        placeholder="z.B. 1"
                                    >

                                    <label>
                                        Grund
                                    </label>

                                    <input
                                        name="reason"
                                        maxlength="300"
                                        placeholder="Grund"
                                        required
                                    >

                                    <button
                                        class="btn red"
                                    >
                                        Ban
                                    </button>

                                </form>

                                ${
                                    user.banned
                                        ? `
                                        <form
                                            method="POST"
                                            action="/admin/user/unban"
                                        >

                                            <input
                                                type="hidden"
                                                name="id"
                                                value="${user.id}"
                                            >

                                            <button
                                                class="btn green"
                                            >
                                                Unban
                                            </button>

                                        </form>
                                        `
                                        : ""
                                }
                                `
                                : `
                                <p>
                                    <b>
                                        Owner
                                    </b>
                                </p>
                                `
                        }

                    </div>
                    `
                ).join("")}
                `,
                admin
            )
        );
    }
);

/* =========================================================
   ADMIN ROLLE
========================================================= */

app.post(
    "/admin/user/role",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            users();

        const target =
            all.find(
                u =>
                    u.id ===
                    req.body.id
            );

        if (!target) {
            return res.redirect(
                "/admin/users"
            );
        }

        if (
            isOwner(target) &&
            !isOwner(admin)
        ) {
            return res.redirect(
                "/admin/users"
            );
        }

        if (
            req.body.role ===
            "owner"
        ) {
            return res.redirect(
                "/admin/users"
            );
        }

        target.role =
            String(
                req.body.role || "user"
            );

        writeJSON(
            FILES.users,
            all
        );

        addLog(
            "ROLE_CHANGE",
            admin,
            `${target.email} -> ${target.role}`
        );

        res.redirect(
            "/admin/users"
        );
    }
);

/* =========================================================
   ADMIN COINS
========================================================= */

app.post(
    "/admin/user/coins",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const amount =
            Number(
                req.body.amount
            );

        if (
            !Number.isFinite(amount)
        ) {
            return res.redirect(
                "/admin/users"
            );
        }

        const all =
            users();

        const target =
            all.find(
                u =>
                    u.id ===
                    req.body.id
            );

        if (!target) {
            return res.redirect(
                "/admin/users"
            );
        }

        target.coins =
            Math.max(
                0,
                Number(
                    target.coins || 0
                ) +
                amount
            );

        writeJSON(
            FILES.users,
            all
        );

        addLog(
            "COINS_CHANGE",
            admin,
            `${target.email} | ${amount}`
        );

        res.redirect(
            "/admin/users"
        );
    }
);

/* =========================================================
   ADMIN BAN
========================================================= */

app.post(
    "/admin/user/ban",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            users();

        const target =
            all.find(
                u =>
                    u.id ===
                    req.body.id
            );

        if (!target) {
            return res.redirect(
                "/admin/users"
            );
        }

        /*
           Owner darf nicht von einem normalen
           Admin gebannt werden.
        */

        if (
            isOwner(target) &&
            !isOwner(admin)
        ) {
            return res.redirect(
                "/admin/users"
            );
        }

        const minutes =
            Number(
                req.body.minutes || 0
            );

        target.banned =
            true;

        target.banReason =
            String(
                req.body.reason || ""
            )
                .trim()
                .slice(0, 300);

        if (
            Number.isFinite(minutes) &&
            minutes > 0
        ) {
            target.banUntil =
                new Date(
                    Date.now() +
                    minutes *
                    60 *
                    1000
                ).toISOString();
        } else {
            target.banUntil = null;
        }

        writeJSON(
            FILES.users,
            all
        );

        addLog(
            "BAN",
            admin,
            `${target.email} | ${target.banReason} | ${
                target.banUntil
                    ? formatDate(
                        target.banUntil
                    )
                    : "dauerhaft"
            }`
        );

        res.redirect(
            "/admin/users"
        );
    }
);

/* =========================================================
   ADMIN UNBAN
========================================================= */

app.post(
    "/admin/user/unban",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            users();

        const target =
            all.find(
                u =>
                    u.id ===
                    req.body.id
            );

        if (!target) {
            return res.redirect(
                "/admin/users"
            );
        }

        target.banned =
            false;

        target.banUntil =
            null;

        target.banReason =
            "";

        writeJSON(
            FILES.users,
            all
        );

        addLog(
            "UNBAN",
            admin,
            target.email
        );

        res.redirect(
            "/admin/users"
        );
    }
);

/* =========================================================
   COIN CODES ADMIN
========================================================= */

app.get(
    "/admin/codes",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            codes();

        res.send(
            page(
                "Coin Codes",
                `
                <div class="card">

                    <h1>
                        Coin Codes
                    </h1>

                    <p class="muted">
                        Jeder Benutzer kann
                        jeden Code nur einmal einlösen.
                    </p>

                    <form
                        method="POST"
                        action="/admin/codes/create"
                    >

                        <label>
                            Anzahl Coins
                        </label>

                        <input
                            type="number"
                            name="coins"
                            min="1"
                            value="100"
                            required
                        >

                        <label>
                            Anzahl Einlösungen
                        </label>

                        <input
                            type="number"
                            name="uses"
                            min="1"
                            value="1"
                            required
                        >

                        <button
                            class="btn green"
                        >
                            Code erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        Vorhandene Codes
                    </h2>

                    ${
                        all.length === 0
                            ? `
                            <p class="muted">
                                Keine Codes vorhanden.
                            </p>
                            `
                            : all
                                .slice()
                                .reverse()
                                .map(
                                    code => `
                                    <div class="item">

                                        <div class="code">
                                            ${escapeHTML(
                                                code.code
                                            )}
                                        </div>

                                        <p>
                                            <b>
                                                ${Number(
                                                    code.coins
                                                )}
                                                Coins
                                            </b>
                                        </p>

                                        <p>
                                            Übrig:
                                            <b>
                                                ${Number(
                                                    code.remaining
                                                )}
                                            </b>
                                        </p>

                                        <p>
                                            Eingelöst:
                                            ${
                                                code.usedBy.length
                                            }
                                        </p>

                                        <p>
                                            Status:
                                            ${
                                                code.disabled
                                                    ? "Deaktiviert"
                                                    : "Aktiv"
                                            }
                                        </p>

                                        ${
                                            !code.disabled &&
                                            code.remaining > 0
                                                ? `
                                                <form
                                                    method="POST"
                                                    action="/admin/codes/disable"
                                                >

                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value="${code.id}"
                                                    >

                                                    <button
                                                        class="btn red"
                                                    >
                                                        Deaktivieren
                                                    </button>

                                                </form>
                                                `
                                                : ""
                                        }

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>
                `,
                admin
            )
        );
    }
);

/* =========================================================
   CODE ERSTELLEN
========================================================= */

app.post(
    "/admin/codes/create",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const coinAmount =
            Number(
                req.body.coins
            );

        const uses =
            Number(
                req.body.uses
            );

        if (
            !Number.isFinite(
                coinAmount
            ) ||
            coinAmount < 1 ||
            !Number.isFinite(uses) ||
            uses < 1
        ) {
            return res.redirect(
                "/admin/codes"
            );
        }

        const all =
            codes();

        const code = {
            id: id(),

            code:
                createCoinCode(),

            coins:
                Math.floor(
                    coinAmount
                ),

            remaining:
                Math.floor(
                    uses
                ),

            usedBy: [],

            disabled: false,

            createdBy:
                admin.email,

            createdAt:
                now()
        };

        all.push(code);

        writeJSON(
            FILES.codes,
            all
        );

        addLog(
            "CODE_CREATE",
            admin,
            `${code.code} | ${code.coins} Coins | ${code.remaining} Uses`
        );

        res.redirect(
            "/admin/codes"
        );
    }
);

/* =========================================================
   CODE DEAKTIVIEREN
========================================================= */

app.post(
    "/admin/codes/disable",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            codes();

        const code =
            all.find(
                c =>
                    c.id ===
                    req.body.id
            );

        if (code) {
            code.disabled = true;

            writeJSON(
                FILES.codes,
                all
            );

            addLog(
                "CODE_DISABLE",
                admin,
                code.code
            );
        }

        res.redirect(
            "/admin/codes"
        );
    }
);

/* =========================================================
   ADMIN SHOP
========================================================= */

app.get(
    "/admin/shop",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            products();

        res.send(
            page(
                "Shop Verwaltung",
                `
                <div class="card">

                    <h1>
                        Coin Shop
                    </h1>

                    <form
                        method="POST"
                        action="/admin/shop/create"
                    >

                        <label>
                            Produktname
                        </label>

                        <input
                            name="name"
                            maxlength="100"
                            required
                        >

                        <label>
                            Beschreibung
                        </label>

                        <textarea
                            name="description"
                            maxlength="1000"
                        ></textarea>

                        <label>
                            Preis in Coins
                        </label>

                        <input
                            type="number"
                            name="price"
                            min="1"
                            required
                        >

                        <button
                            class="btn green"
                        >
                            Produkt hinzufügen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        Produkte
                    </h2>

                    ${
                        all.length === 0
                            ? `
                            <p class="muted">
                                Keine Produkte.
                            </p>
                            `
                            : all.map(
                                product => `
                                <div class="item">

                                    <h3>
                                        ${escapeHTML(
                                            product.name
                                        )}
                                    </h3>

                                    <p>
                                        ${escapeHTML(
                                            product.description ||
                                            ""
                                        )}
                                    </p>

                                    <b>
                                        ${Number(
                                            product.price
                                        )}
                                        Coins
                                    </b>

                                    <p>
                                        Status:
                                        ${
                                            product.enabled !== false
                                                ? "Aktiv"
                                                : "Deaktiviert"
                                        }
                                    </p>

                                    <form
                                        method="POST"
                                        action="/admin/shop/toggle"
                                    >

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${product.id}"
                                        >

                                        <button
                                            class="btn gray"
                                        >
                                            ${
                                                product.enabled !== false
                                                    ? "Deaktivieren"
                                                    : "Aktivieren"
                                            }
                                        </button>

                                    </form>

                                </div>
                                `
                            ).join("")
                    }

                </div>
                `,
                admin
            )
        );
    }
);

/* =========================================================
   SHOP PRODUKT ERSTELLEN
========================================================= */

app.post(
    "/admin/shop/create",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const price =
            Number(
                req.body.price
            );

        if (
            !Number.isFinite(price) ||
            price < 1
        ) {
            return res.redirect(
                "/admin/shop"
            );
        }

        const all =
            products();

        const product = {
            id: id(),

            name:
                String(
                    req.body.name || ""
                )
                    .trim()
                    .slice(0, 100),

            description:
                String(
                    req.body.description || ""
                )
                    .trim()
                    .slice(0, 1000),

            price:
                Math.floor(price),

            enabled:
                true,

            createdBy:
                admin.email,

            createdAt:
                now()
        };

        all.push(product);

        writeJSON(
            FILES.products,
            all
        );

        addLog(
            "PRODUCT_CREATE",
            admin,
            product.name
        );

        res.redirect(
            "/admin/shop"
        );
    }
);

/* =========================================================
   SHOP TOGGLE
========================================================= */

app.post(
    "/admin/shop/toggle",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            products();

        const product =
            all.find(
                p =>
                    p.id ===
                    req.body.id
            );

        if (product) {
            product.enabled =
                product.enabled === false;

            writeJSON(
                FILES.products,
                all
            );

            addLog(
                "PRODUCT_TOGGLE",
                admin,
                product.name
            );
        }

        res.redirect(
            "/admin/shop"
        );
    }
);

/* =========================================================
   ADMIN GEWINNSPIELE
========================================================= */

app.get(
    "/admin/giveaways",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            giveaways();

        res.send(
            page(
                "Gewinnspiele",
                `
                <div class="card">

                    <h1>
                        Gewinnspiel erstellen
                    </h1>

                    <form
                        method="POST"
                        action="/admin/giveaways/create"
                    >

                        <label>
                            Titel
                        </label>

                        <input
                            name="title"
                            maxlength="100"
                            required
                        >

                        <label>
                            Beschreibung
                        </label>

                        <textarea
                            name="description"
                            maxlength="1000"
                            required
                        ></textarea>

                        <label>
                            Gewinn
                        </label>

                        <input
                            name="prize"
                            maxlength="200"
                            placeholder="z.B. 1000 Coins"
                            required
                        >

                        <label>
                            Dauer in Stunden
                        </label>

                        <input
                            type="number"
                            name="hours"
                            min="1"
                            value="24"
                            required
                        >

                        <button
                            class="btn green"
                        >
                            Gewinnspiel erstellen
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        Gewinnspiele
                    </h2>

                    ${
                        all.length === 0
                            ? `
                            <p class="muted">
                                Noch keine Gewinnspiele.
                            </p>
                            `
                            : all
                                .slice()
                                .reverse()
                                .map(
                                    giveaway => `
                                    <div class="item">

                                        <h3>
                                            ${escapeHTML(
                                                giveaway.title
                                            )}
                                        </h3>

                                        <p>
                                            ${escapeHTML(
                                                giveaway.description
                                            )}
                                        </p>

                                        <p>
                                            Gewinn:
                                            <b>
                                                ${escapeHTML(
                                                    giveaway.prize
                                                )}
                                            </b>
                                        </p>

                                        <p>
                                            Teilnehmer:
                                            <b>
                                                ${giveaway.entries.length}
                                            </b>
                                        </p>

                                        <p>
                                            Ende:
                                            ${formatDate(
                                                giveaway.endAt
                                            )}
                                        </p>

                                        <span class="badge">
                                            ${
                                                giveaway.ended
                                                    ? "Beendet"
                                                    : "Aktiv"
                                            }
                                        </span>

                                        ${
                                            !giveaway.ended
                                                ? `
                                                <form
                                                    method="POST"
                                                    action="/admin/giveaways/end"
                                                >

                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value="${giveaway.id}"
                                                    >

                                                    <button
                                                        class="btn red"
                                                    >
                                                        Beenden
                                                    </button>

                                                </form>
                                                `
                                                : ""
                                        }

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>
                `,
                admin
            )
        );
    }
);

/* =========================================================
   GEWINNSPIEL ERSTELLEN
========================================================= */

app.post(
    "/admin/giveaways/create",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const hours =
            Number(
                req.body.hours
            );

        if (
            !Number.isFinite(hours) ||
            hours < 1
        ) {
            return res.redirect(
                "/admin/giveaways"
            );
        }

        const all =
            giveaways();

        const giveaway = {
            id: id(),

            title:
                String(
                    req.body.title || ""
                )
                    .trim()
                    .slice(0, 100),

            description:
                String(
                    req.body.description || ""
                )
                    .trim()
                    .slice(0, 1000),

            prize:
                String(
                    req.body.prize || ""
                )
                    .trim()
                    .slice(0, 200),

            entries: [],

            endAt:
                new Date(
                    Date.now() +
                    hours *
                    60 *
                    60 *
                    1000
                ).toISOString(),

            ended:
                false,

            createdBy:
                admin.email,

            createdAt:
                now()
        };

        all.push(
            giveaway
        );

        writeJSON(
            FILES.giveaways,
            all
        );

        addLog(
            "GIVEAWAY_CREATE",
            admin,
            giveaway.title
        );

        res.redirect(
            "/admin/giveaways"
        );
    }
);

/* =========================================================
   GEWINNSPIEL BEENDEN
========================================================= */

app.post(
    "/admin/giveaways/end",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            giveaways();

        const giveaway =
            all.find(
                g =>
                    g.id ===
                    req.body.id
            );

        if (giveaway) {
            giveaway.ended = true;

            writeJSON(
                FILES.giveaways,
                all
            );

            addLog(
                "GIVEAWAY_END",
                admin,
                giveaway.title
            );
        }

        res.redirect(
            "/admin/giveaways"
        );
    }
);

/* =========================================================
   ADMIN WEBSEITE / WARTUNG / STÖRUNG
========================================================= */

app.get(
    "/admin/site",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const cfg =
            settings();

        res.send(
            page(
                "Webseite",
                `
                <div class="card">

                    <h1>
                        Webseiten-Einstellungen
                    </h1>

                    <form
                        method="POST"
                        action="/admin/site/save"
                    >

                        <h2>
                            Wartung
                        </h2>

                        <label>
                            Wartung aktiv
                        </label>

                        <select
                            name="maintenance"
                        >

                            <option
                                value="false"
                                ${
                                    !cfg.maintenance
                                        ? "selected"
                                        : ""
                                }
                            >
                                Nein
                            </option>

                            <option
                                value="true"
                                ${
                                    cfg.maintenance
                                        ? "selected"
                                        : ""
                                }
                            >
                                Ja
                            </option>

                        </select>

                        <label>
                            Wartungstext
                        </label>

                        <textarea
                            name="maintenanceText"
                        >${escapeHTML(
                            cfg.maintenanceText
                        )}</textarea>

                        <h2>
                            Störung
                        </h2>

                        <label>
                            Störung aktiv
                        </label>

                        <select
                            name="incident"
                        >

                            <option
                                value="false"
                                ${
                                    !cfg.incident
                                        ? "selected"
                                        : ""
                                }
                            >
                                Nein
                            </option>

                            <option
                                value="true"
                                ${
                                    cfg.incident
                                        ? "selected"
                                        : ""
                                }
                            >
                                Ja
                            </option>

                        </select>

                        <label>
                            Störungstext
                        </label>

                        <textarea
                            name="incidentText"
                        >${escapeHTML(
                            cfg.incidentText
                        )}</textarea>

                        <button
                            class="btn green"
                        >
                            Einstellungen speichern
                        </button>

                    </form>

                </div>
                `,
                admin
            )
        );
    }
);

app.post(
    "/admin/site/save",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const cfg =
            settings();

        cfg.maintenance =
            req.body.maintenance ===
            "true";

        cfg.maintenanceText =
            String(
                req.body.maintenanceText ||
                ""
            )
                .trim()
                .slice(0, 1000);

        cfg.incident =
            req.body.incident ===
            "true";

        cfg.incidentText =
            String(
                req.body.incidentText ||
                ""
            )
                .trim()
                .slice(0, 1000);

        writeJSON(
            FILES.settings,
            cfg
        );

        addLog(
            "SITE_SETTINGS",
            admin,
            `Wartung=${cfg.maintenance} Störung=${cfg.incident}`
        );

        res.redirect(
            "/admin/site"
        );
    }
);

/* =========================================================
   ADMIN LOGS
========================================================= */

app.get(
    "/admin/logs",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            logs()
                .slice()
                .reverse();

        res.send(
            page(
                "Logs",
                `
                <div class="card">

                    <h1>
                        Log System
                    </h1>

                    <p class="muted">
                        ${all.length}
                        gespeicherte Aktionen
                    </p>

                </div>

                <div class="card">

                    <table>

                        <thead>
                            <tr>
                                <th>
                                    Zeit
                                </th>

                                <th>
                                    Aktion
                                </th>

                                <th>
                                    Benutzer
                                </th>

                                <th>
                                    Details
                                </th>
                            </tr>
                        </thead>

                        <tbody>

                            ${
                                all
                                    .slice(0, 500)
                                    .map(
                                        log => `
                                        <tr>

                                            <td>
                                                ${formatDate(
                                                    log.date
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    log.action
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    log.userEmail
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    log.details
                                                )}
                                            </td>

                                        </tr>
                                        `
                                    )
                                    .join("")
                            }

                        </tbody>

                    </table>

                </div>
                `,
                admin
            )
        );
    }
);

/* =========================================================
   ADMIN BESTELLUNGEN
========================================================= */

app.get(
    "/admin/orders",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const all =
            readJSON(
                FILES.orders,
                []
            )
                .slice()
                .reverse();

        res.send(
            page(
                "Bestellungen",
                `
                <div class="card">

                    <h1>
                        Bestellungen
                    </h1>

                    ${
                        all.length === 0
                            ? `
                            <p class="muted">
                                Keine Bestellungen vorhanden.
                            </p>
                            `
                            : all.map(
                                order => `
                                <div class="item">

                                    <div class="code">
                                        ${escapeHTML(
                                            order.number
                                        )}
                                    </div>

                                    <h3>
                                        ${escapeHTML(
                                            order.productName
                                        )}
                                    </h3>

                                    <p>
                                        Benutzer:
                                        ${escapeHTML(
                                            order.userName
                                        )}
                                        <br>

                                        E-Mail:
                                        ${escapeHTML(
                                            order.userEmail
                                        )}
                                    </p>

                                    <p>
                                        Preis:
                                        <b>
                                            ${Number(
                                                order.price
                                            )}
                                            Coins
                                        </b>
                                    </p>

                                    <p>
                                        ${formatDate(
                                            order.createdAt
                                        )}
                                    </p>

                                </div>
                                `
                            ).join("")
                    }

                </div>
                `,
                admin
            )
        );
    }
);

/* =========================================================
   ALTE TICKETS / ADMIN TICKETS
========================================================= */

app.get(
    "/admin/tickets",
    requireTeam,
    (req, res) => {
        res.redirect(
            "/tickets"
        );
    }
);

/* =========================================================
   AUTOMATISCHE OWNER-REPARATUR
========================================================= */

function ensureOwner() {

    const all =
        users();

    const owner =
        all.find(
            u =>
                u.email.toLowerCase() ===
                OWNER_EMAIL.toLowerCase()
        );

    /*
       Wenn der Owner bereits registriert ist,
       wird die Rolle automatisch korrigiert.
    */

    if (owner) {
        if (
            owner.role !==
            "owner"
        ) {
            owner.role =
                "owner";

            writeJSON(
                FILES.users,
                all
            );
        }
    }
}

/* =========================================================
   ABGELAUFENE GEWINNSPIELE MARKIEREN
========================================================= */

function updateGiveaways() {

    const all =
        giveaways();

    let changed = false;

    for (const giveaway of all) {

        if (
            !giveaway.ended &&
            new Date(
                giveaway.endAt
            ).getTime() <=
                Date.now()
        ) {
            giveaway.ended =
                true;

            changed = true;
        }
    }

    if (changed) {
        writeJSON(
            FILES.giveaways,
            all
        );
    }
}

/* =========================================================
   PERIODISCHE AUFGABEN
========================================================= */

setInterval(
    () => {
        try {
            ensureOwner();
            updateGiveaways();
        } catch (error) {
            console.error(
                "Background error:",
                error
            );
        }
    },
    60 * 1000
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        const user =
            getUser(req);

        res.status(404).send(
            page(
                "404",
                `
                <div class="card center">

                    <h1>
                        404
                    </h1>

                    <p>
                        Diese Seite existiert nicht.
                    </p>

                    <a
                        class="btn"
                        href="/"
                    >
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
   SERVER START
========================================================= */

ensureOwner();

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            `${SITE_NAME} Webseite gestartet`
        );

        console.log(
            `Port: ${PORT}`
        );

        console.log(
            `Owner: ${OWNER_EMAIL}`
        );

        console.log(
            `Ticket Kategorie: ${TICKET_CATEGORY_ID}`
        );

        console.log(
            "===================================="
        );
    }
);
```
