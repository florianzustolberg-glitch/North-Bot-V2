// ============================================================
// NORTH-BOT-2 WEBSEITE
// Komplettes Websystem
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";
const OWNER_EMAIL = "florianzustolberg@gmail.com";
const OWNER_PASSWORD = "278263";

const DATA_DIR = path.join(__dirname, "data");

const FILES = {
    users: path.join(__dirname, "users.json"),
    tickets: path.join(__dirname, "tickets.json"),
    codes: path.join(__dirname, "codes.json"),
    logs: path.join(__dirname, "logs.json"),
    products: path.join(__dirname, "products.json"),
    giveaways: path.join(__dirname, "giveaways.json"),
    announcements: path.join(__dirname, "announcements.json"),
    settings: path.join(__dirname, "settings.json")
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("X-Powered-By", "North-Bot-2");
    next();
});

// ============================================================
// DATEIEN
// ============================================================

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        return JSON.parse(raw);
    } catch (err) {
        console.error("JSON Fehler:", file, err.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.products, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    incident: false,
    incidentText: "",
    announcement: ""
});

// ============================================================
// KONTO-RESET
// ============================================================

// Alle alten Konten werden entfernt.
// Danach wird nur der Owner neu angelegt.

let users = readJSON(FILES.users, []);

if (!users.some(u => String(u.email).toLowerCase() === OWNER_EMAIL.toLowerCase())) {
    users = [];
    writeJSON(FILES.users, users);
}

// ============================================================
// PASSWORT
// ============================================================

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function createId(prefix = "") {
    return (
        prefix +
        Date.now().toString(36) +
        crypto.randomBytes(5).toString("hex")
    );
}

function clean(value, max = 500) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max);
}

// ============================================================
// OWNER
// ============================================================

users = readJSON(FILES.users, []);

const ownerExists = users.some(
    u => String(u.email).toLowerCase() === OWNER_EMAIL.toLowerCase()
);

if (!ownerExists) {
    users.push({
        id: createId("USR-"),
        email: OWNER_EMAIL,
        password: hashPassword(OWNER_PASSWORD),
        username: "Florian",
        role: "Owner",
        coins: 0,
        banned: false,
        banReason: null,
        banUntil: null,
        createdAt: new Date().toISOString(),
        lastLogin: null
    });

    writeJSON(FILES.users, users);
}

// ============================================================
// SESSION-SYSTEM OHNE EXPRESS-SESSION
// ============================================================

const sessions = new Map();

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");

    sessions.set(token, {
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now()
    });

    return token;
}

function getUserFromRequest(req) {
    const token = req.headers.cookie
        ?.split(";")
        .map(x => x.trim())
        .find(x => x.startsWith("north_session="))
        ?.split("=")[1];

    if (!token) return null;

    const session = sessions.get(token);

    if (!session) return null;

    session.lastActivity = Date.now();

    const list = readJSON(FILES.users, []);

    return list.find(u => u.id === session.userId) || null;
}

function requireLogin(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    if (!["Owner", "Admin", "Manager", "Developer"].includes(user.role)) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `
            <div class="card">
                <h1>Kein Zugriff</h1>
                <p>Du hast keine Berechtigung für diesen Bereich.</p>
                <a class="button" href="/">Zur Startseite</a>
            </div>
            `
        ));
    }

    req.user = user;
    next();
}

// ============================================================
// BAN
// ============================================================

function isBanned(user) {
    if (!user.banned) return false;

    if (user.banUntil) {
        const until = new Date(user.banUntil).getTime();

        if (Date.now() >= until) {
            user.banned = false;
            user.banUntil = null;
            user.banReason = null;

            const list = readJSON(FILES.users, []);
            const index = list.findIndex(x => x.id === user.id);

            if (index !== -1) {
                list[index] = user;
                writeJSON(FILES.users, list);
            }

            return false;
        }
    }

    return true;
}

// ============================================================
// LOGS
// ============================================================

function addLog(type, message, user = null) {
    const logs = readJSON(FILES.logs, []);

    logs.unshift({
        id: createId("LOG-"),
        type,
        message,
        userId: user?.id || null,
        email: user?.email || null,
        date: new Date().toISOString()
    });

    writeJSON(FILES.logs, logs.slice(0, 1000));
}

// ============================================================
// HTML
// ============================================================

function page(title, content, user = null) {
    const logged = !!user;

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${clean(title, 100)} | North-Bot-2</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0b0d12;
    color: #f2f3f5;
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
    padding: 0 35px;
    background: #11141b;
    border-bottom: 1px solid #242936;
}

.logo {
    font-size: 22px;
    font-weight: 800;
}

.navlinks {
    display: flex;
    gap: 10px;
    align-items: center;
}

.navlinks a {
    padding: 10px 14px;
    border-radius: 8px;
    color: #b8beca;
}

.navlinks a:hover {
    background: #1c212b;
    color: white;
}

.container {
    width: min(1180px, calc(100% - 30px));
    margin: 35px auto;
}

.hero {
    padding: 70px 30px;
    text-align: center;
}

.hero h1 {
    font-size: 52px;
    margin-bottom: 15px;
}

.hero p {
    color: #aeb5c1;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit,minmax(230px,1fr));
    gap: 18px;
}

.card {
    background: #11141b;
    border: 1px solid #242936;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 18px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.muted {
    color: #9ca3af;
}

.button {
    display: inline-block;
    padding: 11px 17px;
    border-radius: 8px;
    background: #5865f2;
    color: white;
    border: 0;
    cursor: pointer;
    margin: 4px;
}

.button.secondary {
    background: #252b37;
}

.button.danger {
    background: #d83b3b;
}

.button.success {
    background: #268c5a;
}

input,
textarea,
select {
    width: 100%;
    padding: 12px;
    margin: 7px 0 14px;
    border-radius: 8px;
    border: 1px solid #303744;
    background: #0c0f15;
    color: white;
    outline: none;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    color: #c7ccd5;
    font-size: 14px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid #252b35;
}

.badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 6px;
    background: #252b37;
    font-size: 12px;
}

.warning {
    padding: 14px;
    background: #352b16;
    border: 1px solid #715b28;
    border-radius: 8px;
    margin-bottom: 20px;
}

.dangerbox {
    padding: 14px;
    background: #351a1a;
    border: 1px solid #713333;
    border-radius: 8px;
    margin-bottom: 20px;
}

.successbox {
    padding: 14px;
    background: #163524;
    border: 1px solid #286544;
    border-radius: 8px;
    margin-bottom: 20px;
}

.footer {
    text-align: center;
    padding: 40px;
    color: #707784;
}

@media(max-width:700px) {
    .nav {
        padding: 0 15px;
    }

    .navlinks {
        gap: 3px;
    }

    .navlinks a {
        padding: 8px;
        font-size: 13px;
    }

    .hero h1 {
        font-size: 36px;
    }
}

</style>
</head>

<body>

<nav class="nav">

<div class="logo">
North-Bot-2
</div>

<div class="navlinks">

<a href="/">Start</a>
<a href="/shop">Shop</a>
<a href="/giveaways">Gewinnspiele</a>

${
logged
? `
<a href="/dashboard">Dashboard</a>
<a href="/tickets">Tickets</a>
<a href="/profile">Profil</a>
${["Owner","Admin","Manager","Developer"].includes(user.role)
? `<a href="/admin">Admin</a>`
: ""}
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

<div class="container">

${content}

</div>

<div class="footer">
North-Bot-2 · <a href="${DISCORD_INVITE}" target="_blank">Discord</a>
</div>

</body>
</html>
`;
}

// ============================================================
// STARTSEITE
// ============================================================

app.get("/", (req, res) => {

    const user = getUserFromRequest(req);
    const settings = readJSON(FILES.settings, {});

    let alert = "";

    if (settings.maintenance) {
        alert += `
        <div class="warning">
            <strong>Wartung</strong><br>
            ${clean(settings.maintenanceText)}
        </div>
        `;
    }

    if (settings.incident) {
        alert += `
        <div class="dangerbox">
            <strong>Störung</strong><br>
            ${clean(settings.incidentText)}
        </div>
        `;
    }

    if (settings.announcement) {
        alert += `
        <div class="successbox">
            <strong>Ankündigung</strong><br>
            ${clean(settings.announcement)}
        </div>
        `;
    }

    res.send(page(
        "Startseite",
        `
        ${alert}

        <section class="hero">

            <h1>North-Bot-2</h1>

            <p>
                Deine zentrale North-Bot-2 Plattform.
            </p>

            <a class="button" href="/register">
                Konto erstellen
            </a>

            <a class="button secondary" href="${DISCORD_INVITE}" target="_blank">
                Discord beitreten
            </a>

        </section>

        <div class="grid">

            <div class="card">
                <h3>🎫 Tickets</h3>
                <p class="muted">
                    Erstelle Support-Tickets direkt über die Webseite.
                </p>
            </div>

            <div class="card">
                <h3>💰 Coins</h3>
                <p class="muted">
                    Sammle Coins und löse sie im Shop ein.
                </p>
            </div>

            <div class="card">
                <h3>🎉 Gewinnspiele</h3>
                <p class="muted">
                    Nimm an laufenden Gewinnspielen teil.
                </p>
            </div>

            <div class="card">
                <h3>🛠️ Support</h3>
                <p class="muted">
                    Erhalte Hilfe vom North-Bot-2 Team.
                </p>
            </div>

        </div>
        `,
        user
    ));
});

// ============================================================
// REGISTER
// ============================================================

app.get("/register", (req, res) => {

    const user = getUserFromRequest(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    res.send(page(
        "Registrieren",
        `
        <div class="card">

            <h1>Registrieren</h1>

            <p class="muted">
                Erstelle dein neues North-Bot-2 Konto.
            </p>

            <form method="POST" action="/register">

                <label>Benutzername</label>
                <input
                    name="username"
                    minlength="2"
                    maxlength="32"
                    required
                >

                <label>E-Mail</label>
                <input
                    type="email"
                    name="email"
                    placeholder="deine@email.de"
                    required
                >

                <label>Passwort</label>
                <input
                    type="password"
                    name="password"
                    minlength="6"
                    required
                >

                <button class="button" type="submit">
                    Registrieren
                </button>

            </form>

            <p>
                Bereits registriert?
                <a href="/login">Login</a>
            </p>

        </div>
        `
    ));
});

app.post("/register", (req, res) => {

    const username = clean(req.body.username, 32);
    const email = clean(req.body.email, 150).toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || password.length < 6) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="dangerbox">
                    Bitte fülle alle Felder korrekt aus.
                </div>
                <a class="button" href="/register">Zurück</a>
                `
            )
        );
    }

    const list = readJSON(FILES.users, []);

    if (list.some(u => String(u.email).toLowerCase() === email)) {
        return res.status(409).send(
            page(
                "Fehler",
                `
                <div class="dangerbox">
                    Diese E-Mail ist bereits registriert.
                </div>
                <a class="button" href="/login">Zum Login</a>
                `
            )
        );
    }

    const newUser = {
        id: createId("USR-"),
        email,
        password: hashPassword(password),
        username,
        role: "User",
        coins: 0,
        banned: false,
        banReason: null,
        banUntil: null,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };

    list.push(newUser);
    writeJSON(FILES.users, list);

    addLog(
        "REGISTER",
        "Neuer Benutzer registriert: " + email,
        newUser
    );

    res.redirect("/login?registered=1");
});

// ============================================================
// LOGIN
// ============================================================

app.get("/login", (req, res) => {

    const user = getUserFromRequest(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    const registered = req.query.registered === "1";

    res.send(page(
        "Login",
        `
        ${registered
        ? `
        <div class="successbox">
            Registrierung erfolgreich. Du kannst dich jetzt anmelden.
        </div>
        `
        : ""}

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

                <button class="button" type="submit">
                    Einloggen
                </button>

            </form>

            <p>
                Noch kein Konto?
                <a href="/register">Registrieren</a>
            </p>

        </div>
        `
    ));
});

app.post("/login", (req, res) => {

    const email = clean(req.body.email, 150).toLowerCase();
    const password = String(req.body.password || "");

    const list = readJSON(FILES.users, []);

    const user = list.find(
        u => String(u.email).toLowerCase() === email
    );

    if (!user) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="dangerbox">
                    E-Mail oder Passwort ist falsch.
                </div>

                <a class="button" href="/login">Erneut versuchen</a>
                `
            )
        );
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    if (user.password !== hashPassword(password)) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="dangerbox">
                    E-Mail oder Passwort ist falsch.
                </div>

                <a class="button" href="/login">Erneut versuchen</a>
                `
            )
        );
    }

    user.lastLogin = new Date().toISOString();

    const index = list.findIndex(x => x.id === user.id);

    if (index !== -1) {
        list[index] = user;
        writeJSON(FILES.users, list);
    }

    const token = createSession(user.id);

    res.setHeader(
        "Set-Cookie",
        `north_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );

    addLog(
        "LOGIN",
        "Benutzer hat sich eingeloggt.",
        user
    );

    res.redirect("/dashboard");
});

// ============================================================
// LOGOUT
// ============================================================

app.get("/logout", (req, res) => {

    const cookie = req.headers.cookie
        ?.split(";")
        .map(x => x.trim())
        .find(x => x.startsWith("north_session="));

    if (cookie) {
        const token = cookie.split("=")[1];
        sessions.delete(token);
    }

    res.setHeader(
        "Set-Cookie",
        "north_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );

    res.redirect("/");
});

// ============================================================
// BANNED
// ============================================================

app.get("/banned", (req, res) => {

    const user = getUserFromRequest(req);

    let reason = "Kein Grund angegeben.";
    let until = "Unbefristet";

    if (user) {
        reason = user.banReason || reason;

        if (user.banUntil) {
            until = new Date(user.banUntil).toLocaleString("de-DE");
        }
    }

    res.send(page(
        "Gebannt",
        `
        <div class="card">

            <h1>Du wurdest gebannt</h1>

            <p>
                Dein Zugang zu North-Bot-2 wurde gesperrt.
            </p>

            <p>
                <strong>Grund:</strong>
                ${clean(reason)}
            </p>

            <p>
                <strong>Ende:</strong>
                ${clean(until)}
            </p>

            <a
                class="button"
                href="${DISCORD_INVITE}"
                target="_blank"
            >
                Im Discord entbannen lassen
            </a>

        </div>
        `
    ));
});

// ============================================================
// DASHBOARD
// ============================================================

app.get("/dashboard", requireLogin, (req, res) => {

    const user = req.user;

    res.send(page(
        "Dashboard",
        `
        <div class="card">

            <h1>Willkommen, ${clean(user.username)}!</h1>

            <p class="muted">
                Deine North-Bot-2 Übersicht.
            </p>

        </div>

        <div class="grid">

            <div class="card">
                <h3>💰 Coins</h3>
                <h2>${Number(user.coins || 0)}</h2>
            </div>

            <div class="card">
                <h3>👤 Rolle</h3>
                <p>${clean(user.role)}</p>
            </div>

            <div class="card">
                <h3>🎫 Tickets</h3>
                <a class="button" href="/tickets">
                    Tickets öffnen
                </a>
            </div>

            <div class="card">
                <h3>🛒 Shop</h3>
                <a class="button" href="/shop">
                    Shop öffnen
                </a>
            </div>

        </div>
        `,
        user
    ));
});

// ============================================================
// PROFIL
// ============================================================

app.get("/profile", requireLogin, (req, res) => {

    res.send(page(
        "Profil",
        `
        <div class="card">

            <h1>Profil bearbeiten</h1>

            <form method="POST" action="/profile">

                <label>Benutzername</label>

                <input
                    name="username"
                    value="${clean(req.user.username)}"
                    minlength="2"
                    maxlength="32"
                    required
                >

                <button class="button" type="submit">
                    Speichern
                </button>

            </form>

        </div>
        `,
        req.user
    ));
});

app.post("/profile", requireLogin, (req, res) => {

    const username = clean(req.body.username, 32);

    if (!username) {
        return res.redirect("/profile");
    }

    const list = readJSON(FILES.users, []);

    const index = list.findIndex(x => x.id === req.user.id);

    if (index === -1) {
        return res.redirect("/login");
    }

    list[index].username = username;

    writeJSON(FILES.users, list);

    addLog(
        "PROFILE",
        "Benutzername geändert.",
        list[index]
    );

    res.redirect("/profile");
});

// ============================================================
// TICKETS
// ============================================================

app.get("/tickets", requireLogin, (req, res) => {

    const tickets = readJSON(FILES.tickets, []);

    const ownTickets = tickets.filter(
        t => t.userId === req.user.id
    );

    let rows = ownTickets.map(t => `
        <div class="card">

            <h3>${clean(t.subject)}</h3>

            <p>${clean(t.message)}</p>

            <span class="badge">
                ${clean(t.status)}
            </span>

            <p class="muted">
                ${new Date(t.createdAt).toLocaleString("de-DE")}
            </p>

        </div>
    `).join("");

    if (!rows) {
        rows = `
        <div class="card">
            <p class="muted">
                Du hast noch keine Tickets.
            </p>
        </div>
        `;
    }

    res.send(page(
        "Tickets",
        `
        <div class="card">

            <h1>Support</h1>

            <p>
                Erstelle ein Ticket. Es ist für dich und das Team sichtbar.
            </p>

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
                    maxlength="3000"
                    required
                ></textarea>

                <button class="button" type="submit">
                    Ticket erstellen
                </button>

            </form>

        </div>

        <h2>Meine Tickets</h2>

        ${rows}
        `,
        req.user
    ));
});

app.post("/tickets", requireLogin, (req, res) => {

    const subject = clean(req.body.subject, 100);
    const message = clean(req.body.message, 3000);

    if (!subject || !message) {
        return res.redirect("/tickets");
    }

    const tickets = readJSON(FILES.tickets, []);

    const ticket = {
        id: createId("TICKET-"),
        userId: req.user.id,
        username: req.user.username,
        email: req.user.email,
        subject,
        message,
        status: "Offen",
        claimedBy: null,
        createdAt: new Date().toISOString()
    };

    tickets.push(ticket);

    writeJSON(FILES.tickets, tickets);

    addLog(
        "TICKET_CREATE",
        `Ticket erstellt: ${ticket.id}`,
        req.user
    );

    res.redirect("/tickets");
});

// ============================================================
// ADMIN PANEL
// ============================================================

app.get("/admin", requireAdmin, (req, res) => {

    const usersList = readJSON(FILES.users, []);
    const tickets = readJSON(FILES.tickets, []);
    const logs = readJSON(FILES.logs, []);
    const codes = readJSON(FILES.codes, []);
    const giveaways = readJSON(FILES.giveaways, []);

    const totalCoins = usersList.reduce(
        (sum, u) => sum + Number(u.coins || 0),
        0
    );

    const userRows = usersList.map(u => `
        <tr>

            <td>${clean(u.username)}</td>

            <td>${clean(u.email)}</td>

            <td>
                <span class="badge">
                    ${clean(u.role)}
                </span>
            </td>

            <td>
                ${Number(u.coins || 0)}
            </td>

            <td>
                ${u.banned ? "Gebannt" : "Aktiv"}
            </td>

            <td>

                <form
                    method="POST"
                    action="/admin/user/ban"
                    style="display:inline"
                >

                    <input
                        type="hidden"
                        name="id"
                        value="${clean(u.id)}"
                    >

                    <input
                        type="hidden"
                        name="minutes"
                        value="1"
                    >

                    <input
                        type="hidden"
                        name="reason"
                        value="Test-Ban"
                    >

                    <button
                        class="button danger"
                        type="submit"
                    >
                        1 Min Ban
                    </button>

                </form>

                <form
                    method="POST"
                    action="/admin/user/unban"
                    style="display:inline"
                >

                    <input
                        type="hidden"
                        name="id"
                        value="${clean(u.id)}"
                    >

                    <button
                        class="button success"
                        type="submit"
                    >
                        Entbannen
                    </button>

                </form>

            </td>

        </tr>
    `).join("");

    res.send(page(
        "Admin Panel",
        `

        <h1>Admin Panel</h1>

        <div class="grid">

            <div class="card">
                <h3>Benutzer</h3>
                <h2>${usersList.length}</h2>
            </div>

            <div class="card">
                <h3>Coins</h3>
                <h2>${totalCoins}</h2>
            </div>

            <div class="card">
                <h3>Tickets</h3>
                <h2>${tickets.length}</h2>
            </div>

            <div class="card">
                <h3>Codes</h3>
                <h2>${codes.length}</h2>
            </div>

            <div class="card">
                <h3>Gewinnspiele</h3>
                <h2>${giveaways.length}</h2>
            </div>

        </div>

        <div class="card">

            <h2>Wartung / Störung / Ankündigung</h2>

            <form method="POST" action="/admin/settings">

                <label>
                    Wartung aktiv
                </label>

                <select name="maintenance">

                    <option value="false">Nein</option>
                    <option value="true">Ja</option>

                </select>

                <label>Wartungstext</label>

                <textarea name="maintenanceText"></textarea>

                <label>
                    Störung aktiv
                </label>

                <select name="incident">

                    <option value="false">Nein</option>
                    <option value="true">Ja</option>

                </select>

                <label>Störungstext</label>

                <textarea name="incidentText"></textarea>

                <label>Ankündigung</label>

                <textarea name="announcement"></textarea>

                <button class="button" type="submit">
                    Speichern
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Benutzer</h2>

            <div style="overflow:auto">

            <table>

                <thead>

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Coins</th>
                        <th>Status</th>
                        <th>Aktionen</th>
                    </tr>

                </thead>

                <tbody>

                    ${userRows}

                </tbody>

            </table>

            </div>

        </div>

        <div class="card">

            <h2>Neuen Code erstellen</h2>

            <form method="POST" action="/admin/code">

                <label>Coins</label>

                <input
                    type="number"
                    name="coins"
                    min="1"
                    max="100000"
                    required
                >

                <button class="button" type="submit">
                    Code erstellen
                </button>

            </form>

            <p class="muted">
                Jeder Code kann pro Benutzer nur einmal eingelöst werden.
            </p>

        </div>

        <div class="card">

            <h2>Logs</h2>

            ${logs.slice(0, 100).map(log => `
                <div style="
                    padding:10px 0;
                    border-bottom:1px solid #252b35;
                ">

                    <strong>${clean(log.type)}</strong>

                    <br>

                    ${clean(log.message)}

                    <br>

                    <small class="muted">
                        ${new Date(log.date).toLocaleString("de-DE")}
                    </small>

                </div>
            `).join("")}

        </div>

        <div class="card">

            <h2>Team-Chat</h2>

            <form method="POST" action="/admin/team-chat">

                <textarea
                    name="message"
                    placeholder="Nachricht an das Team..."
                    required
                ></textarea>

                <button class="button" type="submit">
                    Senden
                </button>

            </form>

        </div>

        `,
        req.user
    ));
});

// ============================================================
// ADMIN SETTINGS
// ============================================================

app.post("/admin/settings", requireAdmin, (req, res) => {

    const settings = {
        maintenance: req.body.maintenance === "true",
        maintenanceText: clean(req.body.maintenanceText, 2000),
        incident: req.body.incident === "true",
        incidentText: clean(req.body.incidentText, 2000),
        announcement: clean(req.body.announcement, 2000)
    };

    writeJSON(FILES.settings, settings);

    addLog(
        "SETTINGS",
        "Webseiten-Einstellungen geändert.",
        req.user
    );

    res.redirect("/admin");
});

// ============================================================
// ADMIN BAN
// ============================================================

app.post("/admin/user/ban", requireAdmin, (req, res) => {

    const id = clean(req.body.id);
    const reason = clean(req.body.reason, 500) || "Kein Grund";
    const minutes = Math.max(
        1,
        Math.min(
            525600,
            Number(req.body.minutes) || 1
        )
    );

    const list = readJSON(FILES.users, []);

    const target = list.find(u => u.id === id);

    if (!target) {
        return res.redirect("/admin");
    }

    if (target.role === "Owner") {
        return res.redirect("/admin");
    }

    target.banned = true;
    target.banReason = reason;
    target.banUntil = new Date(
        Date.now() + minutes * 60 * 1000
    ).toISOString();

    writeJSON(FILES.users, list);

    addLog(
        "BAN",
        `${target.email} für ${minutes} Minuten gebannt. Grund: ${reason}`,
        req.user
    );

    res.redirect("/admin");
});

// ============================================================
// ADMIN UNBAN
// ============================================================

app.post("/admin/user/unban", requireAdmin, (req, res) => {

    const id = clean(req.body.id);

    const list = readJSON(FILES.users, []);

    const target = list.find(u => u.id === id);

    if (!target) {
        return res.redirect("/admin");
    }

    target.banned = false;
    target.banReason = null;
    target.banUntil = null;

    writeJSON(FILES.users, list);

    addLog(
        "UNBAN",
        `${target.email} wurde entbannt.`,
        req.user
    );

    res.redirect("/admin");
});

// ============================================================
// COIN CODES
// ============================================================

function generateCode() {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    function part() {

        let output = "";

        for (let i = 0; i < 4; i++) {
            output += chars[
                crypto.randomInt(0, chars.length)
            ];
        }

        return output;
    }

    return `NORTH-${part()}-${part()}`;
}

app.post("/admin/code", requireAdmin, (req, res) => {

    const coins = Math.max(
        1,
        Math.min(
            100000,
            Number(req.body.coins) || 0
        )
    );

    const codes = readJSON(FILES.codes, []);

    let code = generateCode();

    while (codes.some(c => c.code === code)) {
        code = generateCode();
    }

    codes.push({
        id: createId("CODE-"),
        code,
        coins,
        usedBy: [],
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    });

    writeJSON(FILES.codes, codes);

    addLog(
        "CODE_CREATE",
        `Code ${code} mit ${coins} Coins erstellt.`,
        req.user
    );

    res.send(page(
        "Code erstellt",
        `
        <div class="card">

            <h1>Code erstellt</h1>

            <p>
                Dein neuer Code:
            </p>

            <h2>${clean(code)}</h2>

            <p>
                Wert:
                <strong>${coins} Coins</strong>
            </p>

            <p class="muted">
                Dieser Code kann von jedem Benutzer nur einmal eingelöst werden.
            </p>

            <a class="button" href="/admin">
                Zurück zum Admin Panel
            </a>

        </div>
        `,
        req.user
    ));
});

// ============================================================
// CODE EINLÖSEN
// ============================================================

app.get("/redeem", requireLogin, (req, res) => {

    res.send(page(
        "Code einlösen",
        `
        <div class="card">

            <h1>Code einlösen</h1>

            <form method="POST" action="/redeem">

                <label>Code</label>

                <input
                    name="code"
                    placeholder="NORTH-XXXX-XXXX"
                    required
                >

                <button class="button" type="submit">
                    Einlösen
                </button>

            </form>

        </div>
        `,
        req.user
    ));
});

app.post("/redeem", requireLogin, (req, res) => {

    const input = clean(req.body.code, 100).toUpperCase();

    const codes = readJSON(FILES.codes, []);

    const code = codes.find(
        c => String(c.code).toUpperCase() === input
    );

    if (!code) {
        return res.send(page(
            "Code ungültig",
            `
            <div class="dangerbox">
                Dieser Code existiert nicht.
            </div>

            <a class="button" href="/redeem">
                Zurück
            </a>
            `,
            req.user
        ));
    }

    if (!Array.isArray(code.usedBy)) {
        code.usedBy = [];
    }

    if (code.usedBy.includes(req.user.id)) {
        return res.send(page(
            "Code bereits verwendet",
            `
            <div class="warning">
                Du hast diesen Code bereits eingelöst.
            </div>

            <a class="button" href="/dashboard">
                Dashboard
            </a>
            `,
            req.user
        ));
    }

    const usersList = readJSON(FILES.users, []);

    const index = usersList.findIndex(
        u => u.id === req.user.id
    );

    if (index === -1) {
        return res.redirect("/login");
    }

    usersList[index].coins =
        Number(usersList[index].coins || 0) +
        Number(code.coins || 0);

    code.usedBy.push(req.user.id);

    writeJSON(FILES.users, usersList);
    writeJSON(FILES.codes, codes);

    addLog(
        "CODE_REDEEM",
        `${req.user.email} hat ${code.coins} Coins erhalten.`,
        req.user
    );

    res.send(page(
        "Code eingelöst",
        `
        <div class="successbox">

            <h2>Code erfolgreich eingelöst!</h2>

            <p>
                Du hast
                <strong>${Number(code.coins)} Coins</strong>
                erhalten.
            </p>

        </div>

        <a class="button" href="/dashboard">
            Dashboard
        </a>
        `,
        usersList[index]
    ));
});

// ============================================================
// DAILY COINS
// ============================================================

app.post("/daily", requireLogin, (req, res) => {

    const list = readJSON(FILES.users, []);

    const index = list.findIndex(
        u => u.id === req.user.id
    );

    if (index === -1) {
        return res.redirect("/login");
    }

    const now = Date.now();

    if (list[index].lastDaily) {

        const diff =
            now - new Date(list[index].lastDaily).getTime();

        const fourteenHours =
            14 * 60 * 60 * 1000;

        if (diff < fourteenHours) {
            return res.send(page(
                "Daily",
                `
                <div class="warning">
                    Du kannst deine 100 Coins erst wieder nach 14 Stunden abholen.
                </div>

                <a class="button" href="/dashboard">
                    Dashboard
                </a>
                `,
                list[index]
            ));
        }
    }

    list[index].coins =
        Number(list[index].coins || 0) + 100;

    list[index].lastDaily =
        new Date().toISOString();

    writeJSON(FILES.users, list);

    addLog(
        "DAILY",
        `${list[index].email} hat 100 Daily-Coins erhalten.`,
        list[index]
    );

    res.redirect("/dashboard");
});

// ============================================================
// SHOP
// ============================================================

app.get("/shop", (req, res) => {

    const user = getUserFromRequest(req);
    const products = readJSON(FILES.products, []);

    let content = `
    <div class="card">

        <h1>Coins Shop</h1>

        <p class="muted">
            Kaufe Produkte mit deinen Coins.
        </p>

    </div>
    `;

    if (!products.length) {

        content += `
        <div class="card">
            <p class="muted">
                Aktuell sind keine Produkte verfügbar.
            </p>
        </div>
        `;

    } else {

        content += `<div class="grid">`;

        for (const product of products) {

            content += `
            <div class="card">

                <h3>${clean(product.name)}</h3>

                <p>
                    ${clean(product.description)}
                </p>

                <strong>
                    ${Number(product.price)} Coins
                </strong>

                ${
                    user
                    ? `
                    <form method="POST" action="/shop/buy">

                        <input
                            type="hidden"
                            name="id"
                            value="${clean(product.id)}"
                        >

                        <button class="button" type="submit">
                            Kaufen
                        </button>

                    </form>
                    `
                    : `
                    <p>
                        <a class="button" href="/login">
                            Einloggen
                        </a>
                    </p>
                    `
                }

            </div>
            `;
        }

        content += `</div>`;
    }

    res.send(page("Shop", content, user));
});

app.post("/shop/buy", requireLogin, (req, res) => {

    const products = readJSON(FILES.products, []);
    const list = readJSON(FILES.users, []);

    const product = products.find(
        p => p.id === clean(req.body.id)
    );

    const index = list.findIndex(
        u => u.id === req.user.id
    );

    if (!product || index === -1) {
        return res.redirect("/shop");
    }

    const price = Number(product.price || 0);

    if (Number(list[index].coins || 0) < price) {
        return res.send(page(
            "Nicht genug Coins",
            `
            <div class="warning">
                Du hast nicht genügend Coins.
            </div>

            <a class="button" href="/shop">
                Zum Shop
            </a>
            `,
            list[index]
        ));
    }

    list[index].coins -= price;

    writeJSON(FILES.users, list);

    addLog(
        "SHOP_PURCHASE",
        `${list[index].email} kaufte ${product.name}.`,
        list[index]
    );

    res.send(page(
        "Bestellung",
        `
        <div class="successbox">

            <h2>Bestellung erfolgreich</h2>

            <p>
                Produkt:
                <strong>${clean(product.name)}</strong>
            </p>

            <p>
                Bestellnummer:
                <strong>${createId("ORDER-").toUpperCase()}</strong>
            </p>

        </div>

        <a class="button" href="/shop">
            Zurück zum Shop
        </a>
        `,
        list[index]
    ));
});

// ============================================================
// GEWINNSPIELE
// ============================================================

app.get("/giveaways", (req, res) => {

    const user = getUserFromRequest(req);
    const giveaways = readJSON(FILES.giveaways, []);

    let content = `
    <div class="card">

        <h1>Gewinnspiele</h1>

        <p class="muted">
            Nimm an den aktuellen North-Bot-2 Gewinnspielen teil.
        </p>

    </div>
    `;

    if (!giveaways.length) {

        content += `
        <div class="card">
            <p class="muted">
                Aktuell läuft kein Gewinnspiel.
            </p>
        </div>
        `;

    } else {

        for (const giveaway of giveaways) {

            content += `
            <div class="card">

                <h2>${clean(giveaway.title)}</h2>

                <p>
                    ${clean(giveaway.description)}
                </p>

                <p>
                    Preis:
                    <strong>${clean(giveaway.prize)}</strong>
                </p>

                <p>
                    Teilnehmer:
                    ${Array.isArray(giveaway.entries)
                    ? giveaway.entries.length
                    : 0}
                </p>

                ${
                    user
                    ? `
                    <form method="POST" action="/giveaways/join">

                        <input
                            type="hidden"
                            name="id"
                            value="${clean(giveaway.id)}"
                        >

                        <button class="button" type="submit">
                            Teilnehmen
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
            `;
        }
    }

    res.send(page(
        "Gewinnspiele",
        content,
        user
    ));
});

app.post("/giveaways/join", requireLogin, (req, res) => {

    const giveaways = readJSON(FILES.giveaways, []);

    const giveaway = giveaways.find(
        g => g.id === clean(req.body.id)
    );

    if (!giveaway) {
        return res.redirect("/giveaways");
    }

    if (!Array.isArray(giveaway.entries)) {
        giveaway.entries = [];
    }

    if (!giveaway.entries.includes(req.user.id)) {
        giveaway.entries.push(req.user.id);

        writeJSON(
            FILES.giveaways,
            giveaways
        );

        addLog(
            "GIVEAWAY",
            `${req.user.email} nimmt an ${giveaway.title} teil.`,
            req.user
        );
    }

    res.redirect("/giveaways");
});

// ============================================================
// ADMIN GEWINNSPIEL ERSTELLEN
// ============================================================

app.post("/admin/giveaway", requireAdmin, (req, res) => {

    const title = clean(req.body.title, 100);
    const description = clean(req.body.description, 1000);
    const prize = clean(req.body.prize, 200);

    if (!title || !prize) {
        return res.redirect("/admin");
    }

    const giveaways = readJSON(
        FILES.giveaways,
        []
    );

    giveaways.push({
        id: createId("GIVE-"),
        title,
        description,
        prize,
        entries: [],
        createdAt: new Date().toISOString(),
        createdBy: req.user.id
    });

    writeJSON(
        FILES.giveaways,
        giveaways
    );

    addLog(
        "GIVEAWAY_CREATE",
        `Gewinnspiel erstellt: ${title}`,
        req.user
    );

    res.redirect("/admin");
});

// ============================================================
// SERVER
// ============================================================

app.get("/health", (req, res) => {

    res.json({
        status: "ok",
        name: "North-Bot-2",
        uptime: process.uptime()
    });

});

app.listen(PORT, "0.0.0.0", () => {

    console.log("======================================");
    console.log(" North-Bot-2 Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port:", PORT);
    console.log("Discord:", DISCORD_INVITE);
    console.log("Owner:", OWNER_EMAIL);
    console.log("======================================");

});
