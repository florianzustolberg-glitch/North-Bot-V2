/*
===========================================================
 NORTH-BOT-2 WEBSEITE
===========================================================

Start:
    node webseite.js

Benötigte Pakete:
    express
    bcryptjs

Die Daten werden automatisch gespeichert in:
    users.json
    tickets.json
    codes.json
    logs.json
    shop.json
    giveaways.json
    announcements.json
    settings.json
    teamchat.json
    orders.json
    beta.json

Render:
    Start Command:
        node webseite.js

===========================================================
*/

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();

const PORT = process.env.PORT || 3000;

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    announcements: path.join(DATA_DIR, "announcements.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    teamchat: path.join(DATA_DIR, "teamchat.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    beta: path.join(DATA_DIR, "beta.json")
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =========================================================
   JSON DATABASE
========================================================= */

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "",
    incident: false,
    incidentText: "",
    announcement: ""
});
ensureFile(FILES.teamchat, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.beta, []);

function read(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return [];
    }
}

function write(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function id() {
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   OWNER / ADMIN
========================================================= */

const OWNER_EMAIL = "florianzustolberg@gmail.com";

const ADMIN_EMAILS = [
    "florianzustolberg@gmail.com"
];

const STAFF_ROLES = [
    "owner",
    "admin",
    "manager",
    "developer",
    "moderator"
];

function getRole(user) {
    if (!user) return "user";

    if (user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        return "owner";
    }

    if (ADMIN_EMAILS.some(e => e.toLowerCase() === user.email.toLowerCase())) {
        return "admin";
    }

    return user.role || "user";
}

function isStaff(user) {
    return user && STAFF_ROLES.includes(getRole(user));
}

function isOwner(user) {
    return user && getRole(user) === "owner";
}

/* =========================================================
   SIMPLE LOGIN SYSTEM
========================================================= */

const sessions = new Map();

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");

    sessions.set(token, {
        userId,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7
    });

    return token;
}

function currentUser(req) {
    const token = req.headers.cookie
        ? req.headers.cookie
            .split(";")
            .map(x => x.trim())
            .find(x => x.startsWith("north_session="))
        : null;

    if (!token) return null;

    const sessionToken = token.split("=")[1];

    if (!sessionToken) return null;

    const session = sessions.get(sessionToken);

    if (!session) return null;

    if (session.expires < Date.now()) {
        sessions.delete(sessionToken);
        return null;
    }

    const users = read(FILES.users);

    return users.find(u => u.id === session.userId) || null;
}

function setSession(res, userId) {
    const token = createSession(userId);

    res.setHeader(
        "Set-Cookie",
        "north_session=" + token + "; HttpOnly; Path=/; SameSite=Lax"
    );
}

/* =========================================================
   LOGGING
========================================================= */

function logAction(action, user, details = "") {
    const logs = read(FILES.logs);

    logs.unshift({
        id: id(),
        time: now(),
        action,
        userId: user ? user.id : null,
        email: user ? user.email : null,
        details
    });

    write(FILES.logs, logs.slice(0, 2000));
}

/* =========================================================
   LAYOUT
========================================================= */

function page(title, content, user = null) {
    const settings = read(FILES.settings);

    let alert = "";

    if (settings.maintenance) {
        alert += `
        <div class="notice maintenance">
            <b>WARTUNG</b>
            <div>${escapeHtml(settings.maintenanceText)}</div>
        </div>
        `;
    }

    if (settings.incident) {
        alert += `
        <div class="notice incident">
            <b>STÖRUNG</b>
            <div>${escapeHtml(settings.incidentText)}</div>
        </div>
        `;
    }

    if (settings.announcement) {
        alert += `
        <div class="notice announcement">
            <b>ANKÜNDIGUNG</b>
            <div>${escapeHtml(settings.announcement)}</div>
        </div>
        `;
    }

    const nav = user
        ? `
        <a href="/">Startseite</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/tickets">Tickets</a>
        <a href="/shop">Shop</a>
        <a href="/giveaways">Gewinnspiele</a>
        <a href="/chat">Chat</a>
        <a href="/profile">Profil</a>
        ${isStaff(user) ? `<a href="/admin">Admin</a>` : ""}
        <a href="/logout">Logout</a>
        `
        : `
        <a href="/">Startseite</a>
        <a href="/login">Login</a>
        <a href="/register">Registrieren</a>
        `;

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHtml(title)} | North-Bot-2</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0c0f14;
    color: #e8edf5;
}

header {
    background: #11161d;
    border-bottom: 1px solid #252c36;
    padding: 18px 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    position: sticky;
    top: 0;
    z-index: 10;
}

.logo {
    font-size: 21px;
    font-weight: bold;
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

nav a {
    color: #cbd3df;
    text-decoration: none;
    padding: 8px 11px;
    border-radius: 7px;
}

nav a:hover {
    background: #1d2530;
    color: white;
}

main {
    width: min(1100px, 94%);
    margin: 35px auto;
}

.hero {
    padding: 65px 30px;
    border: 1px solid #242b35;
    border-radius: 14px;
    background: #11161d;
}

.hero h1 {
    font-size: 46px;
    margin: 0 0 10px;
}

.hero p {
    color: #9faaba;
    font-size: 17px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 15px;
}

.box {
    background: #11161d;
    border: 1px solid #252d38;
    border-radius: 12px;
    padding: 20px;
}

.box h2,
.box h3 {
    margin-top: 0;
}

input,
textarea,
select {
    width: 100%;
    background: #0c1015;
    border: 1px solid #303946;
    color: white;
    padding: 11px;
    border-radius: 7px;
    margin: 6px 0 12px;
}

textarea {
    min-height: 100px;
    resize: vertical;
}

button,
.button {
    display: inline-block;
    background: #5865f2;
    border: 0;
    color: white;
    padding: 10px 15px;
    border-radius: 7px;
    text-decoration: none;
    cursor: pointer;
    font-weight: bold;
}

button:hover,
.button:hover {
    opacity: .88;
}

.button.gray {
    background: #29313c;
}

.button.red {
    background: #d83a3a;
}

.button.green {
    background: #278a55;
}

.button.gold {
    background: #b78324;
}

.notice {
    margin: 15px auto;
    width: min(1100px, 94%);
    padding: 15px;
    border-radius: 9px;
}

.maintenance {
    background: #40351a;
    border: 1px solid #816b29;
}

.incident {
    background: #461d1d;
    border: 1px solid #913737;
}

.announcement {
    background: #1d3048;
    border: 1px solid #365b83;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    border-bottom: 1px solid #29313c;
    padding: 10px;
    text-align: left;
}

.small {
    color: #909baa;
    font-size: 13px;
}

.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 5px;
    background: #252d38;
    font-size: 12px;
}

.message {
    padding: 10px;
    margin: 8px 0;
    background: #171d25;
    border-radius: 8px;
}

footer {
    text-align: center;
    color: #717b89;
    padding: 50px 20px;
}

.stat {
    font-size: 30px;
    font-weight: bold;
}

</style>
</head>

<body>

<header>

<div class="logo">North-Bot-2</div>

<nav>
${nav}
</nav>

</header>

${alert}

<main>

${content}

</main>

<footer>
North-Bot-2 · <a href="${DISCORD_INVITE}" target="_blank" style="color:#7d8cff;">Discord</a>
</footer>

</body>
</html>
`;
}

/* =========================================================
   STARTSEITE
========================================================= */

app.get("/", (req, res) => {

    const user = currentUser(req);

    res.send(page("Startseite", `
    
    <section class="hero">

        <h1>North-Bot-2</h1>

        <p>
            Willkommen auf der offiziellen Webseite von North-Bot-2.
        </p>

        <p>
            Community, Support, Tickets, Shop und weitere Systeme.
        </p>

        <br>

        <a class="button" href="${DISCORD_INVITE}" target="_blank">
            Discord beitreten
        </a>

        ${
            user
                ? `<a class="button gray" href="/dashboard">Dashboard</a>`
                : `<a class="button gray" href="/register">Konto erstellen</a>`
        }

    </section>

    <br>

    <div class="grid">

        <div class="box">
            <h3>🎫 Support</h3>
            <p>Erstelle Tickets direkt über die Webseite.</p>
        </div>

        <div class="box">
            <h3>🪙 Coins</h3>
            <p>Sammle Coins und nutze sie im Shop.</p>
        </div>

        <div class="box">
            <h3>🎉 Gewinnspiele</h3>
            <p>Nimm an aktiven Gewinnspielen teil.</p>
        </div>

        <div class="box">
            <h3>💬 Community</h3>
            <p>Chatte mit anderen Benutzern.</p>
        </div>

    </div>

    `, user));
});

/* =========================================================
   REGISTER
========================================================= */

app.get("/register", (req, res) => {

    res.send(page("Registrieren", `

    <div class="box">

        <h1>Registrieren</h1>

        <form method="POST" action="/register">

            <label>Name</label>
            <input name="name" required maxlength="40">

            <label>E-Mail</label>
            <input type="email" name="email" required>

            <label>Passwort</label>
            <input type="password" name="password" required minlength="6">

            <button type="submit">Konto erstellen</button>

        </form>

    </div>

    `));
});

app.post("/register", async (req, res) => {

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
        return res.status(400).send("Ungültige Daten.");
    }

    const users = read(FILES.users);

    if (users.some(u => u.email.toLowerCase() === email)) {
        return res.send(page("Fehler", `
            <div class="box">
                <h2>E-Mail bereits registriert</h2>
                <a class="button" href="/login">Zum Login</a>
            </div>
        `));
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
        id: id(),
        name,
        email,
        passwordHash,
        role: email === OWNER_EMAIL ? "owner" : "user",
        coins: 0,
        banned: false,
        banUntil: null,
        banReason: "",
        usedCodes: [],
        dailyClaim: null,
        createdAt: now()
    };

    users.push(user);

    write(FILES.users, users);

    logAction("REGISTER", user, "Neuer Benutzer");

    setSession(res, user.id);

    res.redirect("/dashboard");
});

/* =========================================================
   LOGIN
========================================================= */

app.get("/login", (req, res) => {

    res.send(page("Login", `

    <div class="box">

        <h1>Login</h1>

        <form method="POST" action="/login">

            <label>E-Mail</label>
            <input type="email" name="email" required>

            <label>Passwort</label>
            <input type="password" name="password" required>

            <button type="submit">Einloggen</button>

        </form>

    </div>

    `));
});

app.post("/login", async (req, res) => {

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const users = read(FILES.users);

    const user = users.find(
        u => u.email.toLowerCase() === email
    );

    if (!user) {
        return res.status(401).send("Login fehlgeschlagen.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
        return res.status(401).send("Login fehlgeschlagen.");
    }

    if (user.banned) {

        if (user.banUntil && Date.now() >= user.banUntil) {

            user.banned = false;
            user.banUntil = null;
            user.banReason = "";

            write(FILES.users, users);

        } else {

            const until = user.banUntil
                ? new Date(user.banUntil).toLocaleString("de-DE")
                : "unbegrenzt";

            return res.send(page("Gesperrt", `

            <div class="box">

                <h1>Konto gesperrt</h1>

                <p>
                    Grund:
                    <b>${escapeHtml(user.banReason || "Kein Grund angegeben")}</b>
                </p>

                <p>
                    Ende:
                    <b>${until}</b>
                </p>

                <a class="button" href="${DISCORD_INVITE}" target="_blank">
                    Auf Discord Entbannung beantragen
                </a>

            </div>

            `));
        }
    }

    setSession(res, user.id);

    logAction("LOGIN", user);

    res.redirect("/dashboard");
});

/* =========================================================
   LOGOUT
========================================================= */

app.get("/logout", (req, res) => {

    const cookie = req.headers.cookie || "";

    const tokenPart = cookie
        .split(";")
        .map(x => x.trim())
        .find(x => x.startsWith("north_session="));

    if (tokenPart) {
        sessions.delete(tokenPart.split("=")[1]);
    }

    res.setHeader(
        "Set-Cookie",
        "north_session=; HttpOnly; Path=/; Max-Age=0"
    );

    res.redirect("/");
});

/* =========================================================
   AUTH CHECK
========================================================= */

function requireLogin(req, res, next) {

    const user = currentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (user.banned) {
        return res.redirect("/login");
    }

    req.user = user;

    next();
}

function requireStaff(req, res, next) {

    const user = currentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isStaff(user)) {
        return res.status(403).send("Keine Berechtigung.");
    }

    req.user = user;

    next();
}

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/dashboard", requireLogin, (req, res) => {

    const user = req.user;

    res.send(page("Dashboard", `

    <h1>Dashboard</h1>

    <div class="grid">

        <div class="box">
            <h3>Benutzer</h3>
            <div class="stat">${escapeHtml(user.name)}</div>
        </div>

        <div class="box">
            <h3>Coins</h3>
            <div class="stat">${user.coins}</div>
        </div>

        <div class="box">
            <h3>Rolle</h3>
            <div class="stat">${escapeHtml(getRole(user))}</div>
        </div>

    </div>

    <br>

    <div class="box">

        <h2>Daily Coins</h2>

        <p>
            Alle 14 Stunden kannst du 100 Coins abholen.
        </p>

        <form method="POST" action="/daily">

            <button type="submit">
                100 Coins abholen
            </button>

        </form>

    </div>

    `, user));
});

/* =========================================================
   DAILY COINS
========================================================= */

app.post("/daily", requireLogin, (req, res) => {

    const users = read(FILES.users);

    const user = users.find(u => u.id === req.user.id);

    const cooldown = 14 * 60 * 60 * 1000;

    if (
        user.dailyClaim &&
        Date.now() - user.dailyClaim < cooldown
    ) {

        const remaining =
            cooldown - (Date.now() - user.dailyClaim);

        const hours = Math.floor(
            remaining / 1000 / 60 / 60
        );

        return res.send(page("Daily", `
            <div class="box">
                <h2>Noch nicht verfügbar</h2>
                <p>
                    Du kannst deine nächsten 100 Coins
                    in ungefähr ${hours} Stunden abholen.
                </p>
                <a class="button" href="/dashboard">Zurück</a>
            </div>
        `, user));
    }

    user.coins += 100;
    user.dailyClaim = Date.now();

    write(FILES.users, users);

    logAction("DAILY_COINS", user, "+100 Coins");

    res.redirect("/dashboard");
});

/* =========================================================
   PROFILE
========================================================= */

app.get("/profile", requireLogin, (req, res) => {

    const user = req.user;

    res.send(page("Profil", `

    <div class="box">

        <h1>Profil bearbeiten</h1>

        <form method="POST" action="/profile">

            <label>Name</label>

            <input
                name="name"
                value="${escapeHtml(user.name)}"
                maxlength="40"
                required
            >

            <button type="submit">
                Speichern
            </button>

        </form>

    </div>

    `, user));
});

app.post("/profile", requireLogin, (req, res) => {

    const users = read(FILES.users);

    const user = users.find(u => u.id === req.user.id);

    user.name = String(req.body.name || user.name)
        .trim()
        .slice(0, 40);

    write(FILES.users, users);

    logAction("PROFILE_EDIT", user);

    res.redirect("/profile");
});

/* =========================================================
   TICKETS
========================================================= */

app.get("/tickets", requireLogin, (req, res) => {

    const tickets = read(FILES.tickets);

    const ownTickets = tickets.filter(
        t => t.userId === req.user.id
    );

    res.send(page("Tickets", `

    <h1>Meine Tickets</h1>

    <div class="box">

        <form method="POST" action="/tickets/create">

            <label>Betreff</label>
            <input name="subject" required maxlength="100">

            <label>Nachricht</label>
            <textarea name="message" required></textarea>

            <button type="submit">
                Ticket erstellen
            </button>

        </form>

    </div>

    <br>

    ${
        ownTickets.length
        ? ownTickets.map(ticket => `
        
        <div class="box">

            <h3>
                ${escapeHtml(ticket.subject)}
            </h3>

            <p>
                ${escapeHtml(ticket.message)}
            </p>

            <span class="badge">
                ${escapeHtml(ticket.status)}
            </span>

            ${
                ticket.assignedTo
                ? `<p class="small">Übernommen von: ${escapeHtml(ticket.assignedTo)}</p>`
                : ""
            }

        </div>

        `).join("")
        : `
        <div class="box">
            Noch keine Tickets.
        </div>
        `
    }

    `, req.user));
});

app.post("/tickets/create", requireLogin, (req, res) => {

    const tickets = read(FILES.tickets);

    const ticket = {
        id: id(),
        number: "T-" + Math.floor(100000 + Math.random() * 900000),
        userId: req.user.id,
        username: req.user.name,
        subject: String(req.body.subject || "").slice(0, 100),
        message: String(req.body.message || "").slice(0, 5000),
        status: "offen",
        assignedTo: null,
        createdAt: now(),
        messages: []
    };

    tickets.push(ticket);

    write(FILES.tickets, tickets);

    logAction(
        "TICKET_CREATE",
        req.user,
        ticket.number
    );

    res.redirect("/tickets");
});

/* =========================================================
   ADMIN TICKETS
========================================================= */

app.get("/admin/tickets", requireStaff, (req, res) => {

    const tickets = read(FILES.tickets);

    res.send(page("Ticketverwaltung", `

    <h1>Tickets</h1>

    ${
        tickets.map(t => `

        <div class="box">

            <h3>
                ${escapeHtml(t.number)}
                ·
                ${escapeHtml(t.subject)}
            </h3>

            <p>
                Benutzer:
                ${escapeHtml(t.username)}
            </p>

            <p>
                ${escapeHtml(t.message)}
            </p>

            <p>
                Status:
                <span class="badge">
                    ${escapeHtml(t.status)}
                </span>
            </p>

            <form method="POST" action="/admin/tickets/toggle">

                <input type="hidden" name="id" value="${t.id}">

                <button type="submit">
                    ${t.assignedTo ? "Nicht übernehmen" : "Übernehmen"}
                </button>

            </form>

            <br>

            <form method="POST" action="/admin/tickets/close">

                <input type="hidden" name="id" value="${t.id}">

                <button class="button red">
                    Schließen
                </button>

            </form>

        </div>

        `).join("")
    }

    `, req.user));
});

app.post("/admin/tickets/toggle", requireStaff, (req, res) => {

    const tickets = read(FILES.tickets);

    const ticket = tickets.find(t => t.id === req.body.id);

    if (!ticket) return res.redirect("/admin/tickets");

    if (ticket.assignedTo) {
        ticket.assignedTo = null;
    } else {
        ticket.assignedTo = req.user.name;
    }

    write(FILES.tickets, tickets);

    logAction(
        "TICKET_ASSIGN",
        req.user,
        ticket.number
    );

    res.redirect("/admin/tickets");
});

app.post("/admin/tickets/close", requireStaff, (req, res) => {

    const tickets = read(FILES.tickets);

    const ticket = tickets.find(t => t.id === req.body.id);

    if (ticket) {
        ticket.status = "geschlossen";
    }

    write(FILES.tickets, tickets);

    logAction(
        "TICKET_CLOSE",
        req.user,
        ticket ? ticket.number : ""
    );

    res.redirect("/admin/tickets");
});

/* =========================================================
   COIN CODES
========================================================= */

function generateCode() {

    const part = () =>
        Math.floor(1000 + Math.random() * 9000);

    return part() + "-" + part() + "-" + part();
}

app.get("/codes", requireStaff, (req, res) => {

    const codes = read(FILES.codes);

    res.send(page("Coin Codes", `

    <h1>Coin Codes</h1>

    <div class="box">

        <form method="POST" action="/admin/codes/create">

            <label>Coins</label>

            <input
                type="number"
                name="amount"
                min="1"
                max="1000000"
                value="100"
                required
            >

            <button type="submit">
                Code erstellen
            </button>

        </form>

    </div>

    <br>

    <div class="box">

        <h2>Codes</h2>

        <table>

        <tr>
            <th>Code</th>
            <th>Coins</th>
            <th>Benutzt</th>
        </tr>

        ${
            codes.map(c => `
            <tr>
                <td>
                    <b>${escapeHtml(c.code)}</b>
                </td>

                <td>
                    ${c.amount}
                </td>

                <td>
                    ${c.used ? "Ja" : "Nein"}
                </td>
            </tr>
            `).join("")
        }

        </table>

    </div>

    `, req.user));
});

app.post("/admin/codes/create", requireStaff, (req, res) => {

    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.redirect("/codes");
    }

    const codes = read(FILES.codes);

    let code = generateCode();

    while (codes.some(c => c.code === code)) {
        code = generateCode();
    }

    codes.push({
        id: id(),
        code,
        amount: Math.floor(amount),
        used: false,
        usedBy: null,
        createdBy: req.user.id,
        createdAt: now()
    });

    write(FILES.codes, codes);

    logAction(
        "CODE_CREATE",
        req.user,
        code + " / " + amount + " Coins"
    );

    res.redirect("/codes");
});

/* =========================================================
   CODE EINLÖSEN
========================================================= */

app.get("/redeem", requireLogin, (req, res) => {

    res.send(page("Code einlösen", `

    <div class="box">

        <h1>Coin-Code einlösen</h1>

        <form method="POST" action="/redeem">

            <input
                name="code"
                placeholder="1234-5678-9012"
                required
            >

            <button type="submit">
                Einlösen
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/redeem", requireLogin, (req, res) => {

    const codeValue = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const codes = read(FILES.codes);
    const users = read(FILES.users);

    const code = codes.find(c => c.code === codeValue);

    const user = users.find(
        u => u.id === req.user.id
    );

    if (!code) {
        return res.send(page("Code", `
            <div class="box">
                <h2>Code nicht gefunden.</h2>
                <a class="button" href="/redeem">Zurück</a>
            </div>
        `, user));
    }

    if (code.used) {
        return res.send(page("Code", `
            <div class="box">
                <h2>Dieser Code wurde bereits verwendet.</h2>
            </div>
        `, user));
    }

    if (user.usedCodes.includes(code.id)) {
        return res.send(page("Code", `
            <div class="box">
                <h2>Du hast diesen Code bereits eingelöst.</h2>
            </div>
        `, user));
    }

    user.coins += code.amount;
    user.usedCodes.push(code.id);

    code.used = true;
    code.usedBy = user.id;
    code.usedAt = now();

    write(FILES.users, users);
    write(FILES.codes, codes);

    logAction(
        "CODE_REDEEM",
        user,
        code.code + " / +" + code.amount
    );

    res.send(page("Code", `
        <div class="box">
            <h2>Code erfolgreich eingelöst!</h2>
            <p>Du hast ${code.amount} Coins erhalten.</p>
            <a class="button" href="/dashboard">Dashboard</a>
        </div>
    `, user));
});

/* =========================================================
   SHOP
========================================================= */

app.get("/shop", requireLogin, (req, res) => {

    const shop = read(FILES.shop);

    res.send(page("Coin Shop", `

    <h1>Coin Shop</h1>

    <div class="grid">

    ${
        shop.filter(x => x.active !== false).map(item => `

        <div class="box">

            <h2>${escapeHtml(item.name)}</h2>

            <p>${escapeHtml(item.description)}</p>

            <p>
                <b>${item.price} Coins</b>
            </p>

            <form method="POST" action="/shop/buy">

                <input
                    type="hidden"
                    name="id"
                    value="${item.id}"
                >

                <button type="submit">
                    Kaufen
                </button>

            </form>

        </div>

        `).join("")
    }

    </div>

    `, req.user));
});

app.post("/shop/buy", requireLogin, (req, res) => {

    const shop = read(FILES.shop);
    const users = read(FILES.users);
    const orders = read(FILES.orders);

    const item = shop.find(i => i.id === req.body.id);
    const user = users.find(u => u.id === req.user.id);

    if (!item) return res.redirect("/shop");

    if (user.coins < item.price) {
        return res.send(page("Shop", `
            <div class="box">
                <h2>Nicht genügend Coins.</h2>
                <a class="button" href="/shop">Zurück</a>
            </div>
        `, user));
    }

    user.coins -= item.price;

    const order = {
        id: id(),
        number: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        userId: user.id,
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        status: "offen",
        createdAt: now()
    };

    orders.push(order);

    write(FILES.users, users);
    write(FILES.orders, orders);

    logAction(
        "SHOP_PURCHASE",
        user,
        order.number
    );

    res.send(page("Bestellung", `
        <div class="box">

            <h1>Bestellung erstellt</h1>

            <p>
                Bestellnummer:
                <b>${order.number}</b>
            </p>

            <p>
                Produkt:
                ${escapeHtml(item.name)}
            </p>

            <a class="button" href="/dashboard">
                Zum Dashboard
            </a>

        </div>
    `, user));
});

/* =========================================================
   ADMIN SHOP
========================================================= */

app.get("/admin/shop", requireStaff, (req, res) => {

    const shop = read(FILES.shop);

    res.send(page("Shop Verwaltung", `

    <h1>Shop Verwaltung</h1>

    <div class="box">

        <form method="POST" action="/admin/shop/add">

            <label>Name</label>
            <input name="name" required>

            <label>Beschreibung</label>
            <textarea name="description"></textarea>

            <label>Preis</label>
            <input type="number" name="price" min="1" required>

            <button type="submit">
                Produkt hinzufügen
            </button>

        </form>

    </div>

    <br>

    ${
        shop.map(item => `

        <div class="box">

            <h3>${escapeHtml(item.name)}</h3>

            <p>${escapeHtml(item.description)}</p>

            <p>${item.price} Coins</p>

        </div>

        `).join("")
    }

    `, req.user));
});

app.post("/admin/shop/add", requireStaff, (req, res) => {

    const shop = read(FILES.shop);

    shop.push({
        id: id(),
        name: String(req.body.name || "").slice(0, 100),
        description: String(req.body.description || "").slice(0, 500),
        price: Math.max(1, Number(req.body.price) || 1),
        active: true,
        createdAt: now()
    });

    write(FILES.shop, shop);

    logAction("SHOP_ADD", req.user);

    res.redirect("/admin/shop");
});

/* =========================================================
   GEWINNSPIELE
========================================================= */

app.get("/giveaways", requireLogin, (req, res) => {

    const giveaways = read(FILES.giveaways);

    res.send(page("Gewinnspiele", `

    <h1>Gewinnspiele</h1>

    ${
        giveaways.length
        ? giveaways.map(g => `

        <div class="box">

            <h2>${escapeHtml(g.title)}</h2>

            <p>${escapeHtml(g.description)}</p>

            <p>
                Preis:
                <b>${escapeHtml(g.prize)}</b>
            </p>

            <p>
                Ende:
                ${new Date(g.endsAt).toLocaleString("de-DE")}
            </p>

            ${
                g.participants.includes(req.user.id)
                ? `<span class="badge">Teilgenommen</span>`
                : `
                <form method="POST" action="/giveaways/join">

                    <input
                        type="hidden"
                        name="id"
                        value="${g.id}"
                    >

                    <button class="button gold">
                        Teilnehmen
                    </button>

                </form>
                `
            }

        </div>

        `).join("")
        : `
        <div class="box">
            Aktuell gibt es keine Gewinnspiele.
        </div>
        `
    }

    `, req.user));
});

app.post("/giveaways/join", requireLogin, (req, res) => {

    const giveaways = read(FILES.giveaways);

    const giveaway = giveaways.find(
        g => g.id === req.body.id
    );

    if (!giveaway) return res.redirect("/giveaways");

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);
    }

    write(FILES.giveaways, giveaways);

    logAction(
        "GIVEAWAY_JOIN",
        req.user,
        giveaway.title
    );

    res.redirect("/giveaways");
});

/* =========================================================
   ADMIN GEWINNSPIELE
========================================================= */

app.get("/admin/giveaways", requireStaff, (req, res) => {

    res.send(page("Gewinnspiele verwalten", `

    <h1>Gewinnspiele verwalten</h1>

    <div class="box">

        <form method="POST" action="/admin/giveaways/create">

            <label>Titel</label>
            <input name="title" required>

            <label>Beschreibung</label>
            <textarea name="description"></textarea>

            <label>Preis</label>
            <input name="prize" required>

            <label>Ende</label>
            <input type="datetime-local" name="endsAt" required>

            <button type="submit">
                Gewinnspiel erstellen
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/admin/giveaways/create", requireStaff, (req, res) => {

    const giveaways = read(FILES.giveaways);

    giveaways.push({
        id: id(),
        title: String(req.body.title || ""),
        description: String(req.body.description || ""),
        prize: String(req.body.prize || ""),
        endsAt: new Date(req.body.endsAt).toISOString(),
        participants: [],
        createdAt: now(),
        createdBy: req.user.id
    });

    write(FILES.giveaways, giveaways);

    logAction(
        "GIVEAWAY_CREATE",
        req.user
    );

    res.redirect("/admin/giveaways");
});

/* =========================================================
   CHAT
========================================================= */

app.get("/chat", requireLogin, (req, res) => {

    const messages = read(FILES.teamchat)
        .filter(m => !m.teamOnly)
        .slice(-100);

    res.send(page("Chat", `

    <h1>Community Chat</h1>

    <div class="box">

        ${
            messages.map(m => `

            <div class="message">

                <b>${escapeHtml(m.username)}</b>

                <span class="small">
                    ${new Date(m.time).toLocaleString("de-DE")}
                </span>

                <div>
                    ${escapeHtml(m.message)}
                </div>

            </div>

            `).join("")
        }

    </div>

    <br>

    <div class="box">

        <form method="POST" action="/chat">

            <textarea
                name="message"
                maxlength="1000"
                required
            ></textarea>

            <button type="submit">
                Senden
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/chat", requireLogin, (req, res) => {

    const messages = read(FILES.teamchat);

    messages.push({
        id: id(),
        username: req.user.name,
        userId: req.user.id,
        message: String(req.body.message || "").slice(0, 1000),
        teamOnly: false,
        time: now()
    });

    write(FILES.teamchat, messages.slice(-1000));

    res.redirect("/chat");
});

/* =========================================================
   TEAM CHAT
========================================================= */

app.get("/admin/teamchat", requireStaff, (req, res) => {

    const messages = read(FILES.teamchat)
        .filter(m => m.teamOnly)
        .slice(-100);

    res.send(page("Team Chat", `

    <h1>Team Chat</h1>

    <div class="box">

    ${
        messages.map(m => `

        <div class="message">

            <b>${escapeHtml(m.username)}</b>

            <span class="badge">
                ${escapeHtml(getRole(
                    read(FILES.users).find(u => u.id === m.userId)
                ))}
            </span>

            <div>
                ${escapeHtml(m.message)}
            </div>

        </div>

        `).join("")
    }

    </div>

    <br>

    <div class="box">

        <form method="POST" action="/admin/teamchat">

            <textarea name="message" required></textarea>

            <button type="submit">
                Team-Nachricht senden
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/admin/teamchat", requireStaff, (req, res) => {

    const messages = read(FILES.teamchat);

    messages.push({
        id: id(),
        username: req.user.name,
        userId: req.user.id,
        message: String(req.body.message || "").slice(0, 2000),
        teamOnly: true,
        time: now()
    });

    write(FILES.teamchat, messages.slice(-1000));

    logAction(
        "TEAM_CHAT",
        req.user
    );

    res.redirect("/admin/teamchat");
});

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get("/admin", requireStaff, (req, res) => {

    const users = read(FILES.users);
    const tickets = read(FILES.tickets);
    const codes = read(FILES.codes);
    const logs = read(FILES.logs);
    const orders = read(FILES.orders);
    const giveaways = read(FILES.giveaways);
    const shop = read(FILES.shop);

    const coins = users.reduce(
        (sum, u) => sum + (Number(u.coins) || 0),
        0
    );

    res.send(page("Admin Panel", `

    <h1>Admin Panel</h1>

    <div class="grid">

        <div class="box">
            <h3>Benutzer</h3>
            <div class="stat">${users.length}</div>
        </div>

        <div class="box">
            <h3>Coins im System</h3>
            <div class="stat">${coins}</div>
        </div>

        <div class="box">
            <h3>Tickets</h3>
            <div class="stat">${tickets.length}</div>
        </div>

        <div class="box">
            <h3>Codes</h3>
            <div class="stat">${codes.length}</div>
        </div>

        <div class="box">
            <h3>Bestellungen</h3>
            <div class="stat">${orders.length}</div>
        </div>

        <div class="box">
            <h3>Gewinnspiele</h3>
            <div class="stat">${giveaways.length}</div>
        </div>

    </div>

    <br>

    <div class="grid">

        <a class="button" href="/admin/users">Benutzer</a>

        <a class="button" href="/admin/tickets">Tickets</a>

        <a class="button" href="/codes">Coin Codes</a>

        <a class="button" href="/admin/shop">Shop</a>

        <a class="button" href="/admin/giveaways">Gewinnspiele</a>

        <a class="button" href="/admin/teamchat">Team Chat</a>

        <a class="button" href="/admin/logs">Logs</a>

        <a class="button" href="/admin/orders">Bestellungen</a>

        <a class="button" href="/admin/status">Wartung / Störung</a>

        <a class="button" href="/admin/announcement">Ankündigung</a>

        <a class="button" href="/admin/beta">Beta / Produkte</a>

    </div>

    `, req.user));
});

/* =========================================================
   ADMIN USERS
========================================================= */

app.get("/admin/users", requireStaff, (req, res) => {

    const users = read(FILES.users);

    res.send(page("Benutzer", `

    <h1>Registrierte Benutzer</h1>

    <div class="box">

    <table>

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

            <td>${escapeHtml(u.name)}</td>

            <td>${escapeHtml(u.email)}</td>

            <td>${escapeHtml(getRole(u))}</td>

            <td>${u.coins}</td>

            <td>
                ${
                    u.banned
                    ? `<span class="badge">Gesperrt</span>`
                    : `<span class="badge">Aktiv</span>`
                }
            </td>

            <td>

            ${
                u.id === req.user.id
                ? `<span class="small">Eigenes Konto</span>`
                : `

                <form method="POST" action="/admin/users/ban">

                    <input type="hidden" name="id" value="${u.id}">

                    <input
                        name="minutes"
                        type="number"
                        min="0"
                        placeholder="Minuten"
                        value="1"
                    >

                    <input
                        name="reason"
                        placeholder="Grund"
                        required
                    >

                    <button class="button red">
                        ${u.banned ? "Ban ändern" : "Bannen"}
                    </button>

                </form>

                <br>

                ${
                    u.banned
                    ? `
                    <form method="POST" action="/admin/users/unban">

                        <input
                            type="hidden"
                            name="id"
                            value="${u.id}"
                        >

                        <button class="button green">
                            Entbannen
                        </button>

                    </form>
                    `
                    : ""
                }

                `
            }

            </td>

        </tr>

        `).join("")
    }

    </table>

    </div>

    `, req.user));
});

/* =========================================================
   BAN
========================================================= */

app.post("/admin/users/ban", requireStaff, (req, res) => {

    const users = read(FILES.users);

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) return res.redirect("/admin/users");

    if (
        getRole(target) === "owner" &&
        !isOwner(req.user)
    ) {
        return res.status(403).send("Owner kann nur vom Owner geändert werden.");
    }

    const minutes = Number(req.body.minutes);

    target.banned = true;
    target.banReason =
        String(req.body.reason || "Kein Grund angegeben").slice(0, 500);

    if (
        Number.isFinite(minutes) &&
        minutes > 0
    ) {
        target.banUntil =
            Date.now() + minutes * 60 * 1000;
    } else {
        target.banUntil = null;
    }

    write(FILES.users, users);

    logAction(
        "USER_BAN",
        req.user,
        target.email + " / " + minutes + " Minuten"
    );

    res.redirect("/admin/users");
});

/* =========================================================
   UNBAN
========================================================= */

app.post("/admin/users/unban", requireStaff, (req, res) => {

    const users = read(FILES.users);

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) return res.redirect("/admin/users");

    if (
        getRole(target) === "owner" &&
        !isOwner(req.user)
    ) {
        return res.status(403).send("Keine Berechtigung.");
    }

    target.banned = false;
    target.banUntil = null;
    target.banReason = "";

    write(FILES.users, users);

    logAction(
        "USER_UNBAN",
        req.user,
        target.email
    );

    res.redirect("/admin/users");
});

/* =========================================================
   LOGS
========================================================= */

app.get("/admin/logs", requireStaff, (req, res) => {

    const logs = read(FILES.logs);

    res.send(page("Logs", `

    <h1>System Logs</h1>

    <div class="box">

    <table>

    <tr>
        <th>Zeit</th>
        <th>Aktion</th>
        <th>Benutzer</th>
        <th>Details</th>
    </tr>

    ${
        logs.slice(0, 300).map(l => `

        <tr>

            <td>
                ${new Date(l.time).toLocaleString("de-DE")}
            </td>

            <td>
                <span class="badge">
                    ${escapeHtml(l.action)}
                </span>
            </td>

            <td>
                ${escapeHtml(l.email || "-")}
            </td>

            <td>
                ${escapeHtml(l.details || "-")}
            </td>

        </tr>

        `).join("")
    }

    </table>

    </div>

    `, req.user));
});

/* =========================================================
   BESTELLUNGEN
========================================================= */

app.get("/admin/orders", requireStaff, (req, res) => {

    const orders = read(FILES.orders);

    res.send(page("Bestellungen", `

    <h1>Bestellungen</h1>

    <div class="box">

    <table>

    <tr>
        <th>Bestellnummer</th>
        <th>Produkt</th>
        <th>Benutzer</th>
        <th>Coins</th>
        <th>Status</th>
    </tr>

    ${
        orders.map(o => `

        <tr>

            <td>
                <b>${escapeHtml(o.number)}</b>
            </td>

            <td>
                ${escapeHtml(o.itemName)}
            </td>

            <td>
                ${escapeHtml(o.userId)}
            </td>

            <td>
                ${o.price}
            </td>

            <td>
                ${escapeHtml(o.status)}
            </td>

        </tr>

        `).join("")
    }

    </table>

    </div>

    `, req.user));
});

/* =========================================================
   WARTUNG / STÖRUNG
========================================================= */

app.get("/admin/status", requireStaff, (req, res) => {

    const settings = read(FILES.settings);

    res.send(page("Status", `

    <h1>Webseiten Status</h1>

    <div class="box">

        <form method="POST" action="/admin/status">

            <h3>Wartung</h3>

            <select name="maintenance">

                <option value="false" ${!settings.maintenance ? "selected" : ""}>
                    Aus
                </option>

                <option value="true" ${settings.maintenance ? "selected" : ""}>
                    An
                </option>

            </select>

            <textarea
                name="maintenanceText"
                placeholder="Wartungstext"
            >${escapeHtml(settings.maintenanceText)}</textarea>

            <h3>Störung</h3>

            <select name="incident">

                <option value="false" ${!settings.incident ? "selected" : ""}>
                    Aus
                </option>

                <option value="true" ${settings.incident ? "selected" : ""}>
                    An
                </option>

            </select>

            <textarea
                name="incidentText"
                placeholder="Störungstext"
            >${escapeHtml(settings.incidentText)}</textarea>

            <button type="submit">
                Status speichern
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/admin/status", requireStaff, (req, res) => {

    const settings = read(FILES.settings);

    settings.maintenance =
        req.body.maintenance === "true";

    settings.maintenanceText =
        String(req.body.maintenanceText || "");

    settings.incident =
        req.body.incident === "true";

    settings.incidentText =
        String(req.body.incidentText || "");

    write(FILES.settings, settings);

    logAction(
        "STATUS_UPDATE",
        req.user
    );

    res.redirect("/admin/status");
});

/* =========================================================
   ANKÜNDIGUNG
========================================================= */

app.get("/admin/announcement", requireStaff, (req, res) => {

    const settings = read(FILES.settings);

    res.send(page("Ankündigung", `

    <div class="box">

        <h1>Ankündigung</h1>

        <form method="POST" action="/admin/announcement">

            <textarea
                name="announcement"
                placeholder="Ankündigung"
            >${escapeHtml(settings.announcement)}</textarea>

            <button type="submit">
                Speichern
            </button>

        </form>

    </div>

    `, req.user));
});

app.post("/admin/announcement", requireStaff, (req, res) => {

    const settings = read(FILES.settings);

    settings.announcement =
        String(req.body.announcement || "").slice(0, 2000);

    write(FILES.settings, settings);

    logAction(
        "ANNOUNCEMENT_UPDATE",
        req.user
    );

    res.redirect("/admin/announcement");
});

/* =========================================================
   BETA / PRODUKT NUMMERN
========================================================= */

function productNumber() {

    return "NB2-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
}

app.get("/admin/beta", requireStaff, (req, res) => {

    const beta = read(FILES.beta);

    res.send(page("Beta / Produkte", `

    <h1>Beta- und Produktnummern</h1>

    <div class="box">

        <form method="POST" action="/admin/beta/create">

            <label>Typ</label>

            <select name="type">

                <option value="beta">Beta</option>
                <option value="product">Produkt</option>
                <option value="developer">Developer</option>

            </select>

            <label>Name</label>
            <input name="name" required>

            <button type="submit">
                Nummer erstellen
            </button>

        </form>

    </div>

    <br>

    ${
        beta.map(b => `

        <div class="box">

            <b>${escapeHtml(b.number)}</b>

            <p>
                ${escapeHtml(b.type)}
                ·
                ${escapeHtml(b.name)}
            </p>

            <p class="small">
                Diese Nummer kann dem Team auf Discord mitgeteilt werden.
            </p>

        </div>

        `).join("")
    }

    `, req.user));
});

app.post("/admin/beta/create", requireStaff, (req, res) => {

    const beta = read(FILES.beta);

    const item = {
        id: id(),
        number: productNumber(),
        type: String(req.body.type || "product"),
        name: String(req.body.name || "").slice(0, 100),
        createdBy: req.user.id,
        createdAt: now()
    };

    beta.unshift(item);

    write(FILES.beta, beta);

    logAction(
        "BETA_PRODUCT_CREATE",
        req.user,
        item.number
    );

    res.redirect("/admin/beta");
});

/* =========================================================
   OWNER ROLE VERWALTUNG
========================================================= */

app.get("/admin/roles", requireOwner, (req, res) => {

    const users = read(FILES.users);

    res.send(page("Rollen", `

    <h1>Rollenverwaltung</h1>

    <div class="box">

    ${
        users.map(u => `

        <form
            method="POST"
            action="/admin/roles"
            style="margin-bottom:15px;"
        >

            <b>${escapeHtml(u.name)}</b>
            <span class="small">
                ${escapeHtml(u.email)}
            </span>

            <select name="role">

                ${STAFF_ROLES.map(role => `
                    <option
                        value="${role}"
                        ${getRole(u) === role ? "selected" : ""}
                    >
                        ${role}
                    </option>
                `).join("")}

                <option
                    value="user"
                    ${getRole(u) === "user" ? "selected" : ""}
                >
                    user
                </option>

            </select>

            <input
                type="hidden"
                name="id"
                value="${u.id}"
            >

            <button type="submit">
                Speichern
            </button>

        </form>

        `).join("")
    }

    </div>

    `, req.user));
});

function requireOwner(req, res, next) {

    const user = currentUser(req);

    if (!user) return res.redirect("/login");

    if (!isOwner(user)) {
        return res.status(403).send("Nur der Owner darf diese Aktion durchführen.");
    }

    req.user = user;

    next();
}

app.post("/admin/roles", requireOwner, (req, res) => {

    const users = read(FILES.users);

    const target = users.find(
        u => u.id === req.body.id
    );

    if (!target) return res.redirect("/admin/roles");

    if (
        target.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
    ) {
        target.role = "owner";
    } else {
        target.role = STAFF_ROLES.includes(req.body.role)
            ? req.body.role
            : "user";
    }

    write(FILES.users, users);

    logAction(
        "ROLE_CHANGE",
        req.user,
        target.email + " -> " + target.role
    );

    res.redirect("/admin/roles");
});

/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    const user = currentUser(req);

    res.status(404).send(page("404", `

    <div class="box">

        <h1>404</h1>

        <p>Diese Seite wurde nicht gefunden.</p>

        <a class="button" href="/">
            Startseite
        </a>

    </div>

    `, user));
});

/* =========================================================
   SERVER
========================================================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("======================================");
    console.log(" North-Bot-2 Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port: " + PORT);
    console.log("Discord: " + DISCORD_INVITE);
    console.log("Owner: " + OWNER_EMAIL);
    console.log("======================================");
    console.log("");

});
