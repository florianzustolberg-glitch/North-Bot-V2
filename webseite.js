/*
===========================================================
                 NORTH-BOT-2 WEBSITE
===========================================================

Node.js + Express

Start:
    node webseite.js

Website:
    http://localhost:3000

Render:
    Start Command:
    node webseite.js

Benötigte Dateien:
    package.json
    users.json
    tickets.json

Automatisch erstellt:
    chat.json
    shop.json
    codes.json
    settings.json
    beta.json

===========================================================
*/

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

/*
===========================================================
                     KONFIGURATION
===========================================================
*/

const SITE_NAME = "North-Bot-2";

/*
  HIER deine Admin-E-Mail-Adressen eintragen.

  Der Benutzer muss sich mit dieser E-Mail registrieren,
  damit er anschließend die entsprechende Rolle erhält.
*/

const OWNER_EMAILS = [
    "florianzustolberg@gmail.com"
];

const ADMIN_EMAILS = [
    "florianzustolberg@gmail.com"
];

/*
  Teamrollen
*/

const TEAM_ROLES = [
    "Owner",
    "Admin",
    "Manager",
    "Developer",
    "Moderator",
    "Supporter",
    "User"
];

/*
===========================================================
                       JSON DATEIEN
===========================================================
*/

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    chat: path.join(DATA_DIR, "chat.json"),
    shop: path.join(DATA_DIR, "shop.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    beta: path.join(DATA_DIR, "beta.json")
};

function ensureFile(file, defaultData) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(defaultData, null, 2),
            "utf8"
        );
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.chat, []);
ensureFile(FILES.shop, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Website befindet sich momentan in Wartung.",
    incident: false,
    incidentText: "Aktuell liegt eine Störung vor.",
    incidentLevel: "normal"
});
ensureFile(FILES.beta, {
    nextNumber: 1000
});

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
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

/*
===========================================================
                       DATEN
===========================================================
*/

function users() {
    return readJSON(FILES.users, []);
}

function tickets() {
    return readJSON(FILES.tickets, []);
}

function chatMessages() {
    return readJSON(FILES.chat, []);
}

function shopItems() {
    return readJSON(FILES.shop, []);
}

function codes() {
    return readJSON(FILES.codes, []);
}

function settings() {
    return readJSON(FILES.settings, {});
}

function betaData() {
    return readJSON(FILES.beta, {
        nextNumber: 1000
    });
}

/*
===========================================================
                       SESSION
===========================================================
*/

const sessions = new Map();

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");

    sessions.set(token, {
        userId,
        created: Date.now()
    });

    return token;
}

function getSession(req) {
    const token = req.headers.cookie
        ?.split(";")
        .map(x => x.trim())
        .find(x => x.startsWith("north_session="))
        ?.split("=")[1];

    if (!token) return null;

    const session = sessions.get(token);

    if (!session) return null;

    const list = users();

    return list.find(
        user => user.id === session.userId
    ) || null;
}

function requireLogin(req, res, next) {
    const user = getSession(req);

    if (!user) {
        return res.redirect("/login");
    }

    req.user = user;

    next();
}

function isAdmin(user) {
    if (!user) return false;

    if (
        OWNER_EMAILS
            .map(x => x.toLowerCase())
            .includes(user.email.toLowerCase())
    ) {
        return true;
    }

    if (
        ADMIN_EMAILS
            .map(x => x.toLowerCase())
            .includes(user.email.toLowerCase())
    ) {
        return true;
    }

    return [
        "Owner",
        "Admin",
        "Manager"
    ].includes(user.role);
}

function isTeam(user) {
    if (!user) return false;

    return [
        "Owner",
        "Admin",
        "Manager",
        "Developer",
        "Moderator",
        "Supporter"
    ].includes(user.role);
}

/*
===========================================================
                       EXPRESS
===========================================================
*/

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());

/*
===========================================================
                       HTML
===========================================================
*/

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function layout(title, content, user = null) {

    const s = settings();

    let alert = "";

    if (s.maintenance && !isAdmin(user)) {
        alert += `
        <div class="alert maintenance">
            🔧 <b>Wartung</b><br>
            ${escapeHTML(s.maintenanceText)}
        </div>
        `;
    }

    if (s.incident) {
        alert += `
        <div class="alert incident">
            🚨 <b>Störung</b><br>
            ${escapeHTML(s.incidentText)}
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
    content="width=device-width, initial-scale=1.0"
>

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
    background:
        radial-gradient(
            circle at top,
            #18233d 0%,
            #080b13 45%,
            #05070b 100%
        );
    color: #fff;
    min-height: 100vh;
}

a {
    color: inherit;
    text-decoration: none;
}

.navbar {
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    border-bottom: 1px solid rgba(255,255,255,.08);
    background: rgba(5,7,12,.82);
    backdrop-filter: blur(15px);
    position: sticky;
    top: 0;
    z-index: 100;
}

.logo {
    font-size: 21px;
    font-weight: 800;
}

.logo span {
    color: #6ea8ff;
}

.nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.nav a {
    padding: 10px 14px;
    border-radius: 10px;
    color: #b8c0d0;
    transition: .2s;
}

.nav a:hover {
    background: rgba(255,255,255,.07);
    color: #fff;
}

.container {
    width: min(1180px, calc(100% - 30px));
    margin: 35px auto;
}

.hero {
    text-align: center;
    padding: 90px 20px;
}

.hero h1 {
    font-size: clamp(42px, 7vw, 85px);
    margin: 0;
}

.hero h1 span {
    color: #6ea8ff;
}

.hero p {
    color: #aeb7c9;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
}

.box {
    background: rgba(15,19,31,.82);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 15px 45px rgba(0,0,0,.25);
}

.box h2,
.box h3 {
    margin-top: 0;
}

.center {
    text-align: center;
}

.btn {
    display: inline-block;
    border: 0;
    padding: 12px 17px;
    border-radius: 11px;
    background: #4f8cff;
    color: white;
    cursor: pointer;
    font-weight: 700;
    margin: 4px;
}

.btn:hover {
    filter: brightness(1.1);
}

.btn.red {
    background: #e34b5f;
}

.btn.green {
    background: #32b879;
}

.btn.gray {
    background: #343b4b;
}

input,
textarea,
select {
    width: 100%;
    margin-top: 7px;
    margin-bottom: 14px;
    padding: 13px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    background: #0c101a;
    color: white;
    outline: none;
}

textarea {
    min-height: 130px;
    resize: vertical;
}

label {
    color: #b9c1d0;
    font-size: 14px;
}

.badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(79,140,255,.15);
    color: #78aaff;
    font-size: 12px;
    font-weight: 700;
}

.alert {
    margin: 15px auto;
    padding: 15px 20px;
    border-radius: 12px;
    width: min(1180px, calc(100% - 30px));
}

.maintenance {
    background: rgba(255,170,0,.12);
    border: 1px solid rgba(255,170,0,.25);
}

.incident {
    background: rgba(255,70,80,.12);
    border: 1px solid rgba(255,70,80,.25);
}

.stat {
    font-size: 34px;
    font-weight: 800;
}

.small {
    color: #8e98ab;
    font-size: 13px;
}

.ticket {
    border-left: 3px solid #4f8cff;
    margin-bottom: 12px;
}

.chat {
    max-height: 500px;
    overflow-y: auto;
    padding: 10px;
    background: #080b12;
    border-radius: 14px;
}

.message {
    padding: 12px;
    margin-bottom: 8px;
    background: #111725;
    border-radius: 10px;
}

.footer {
    text-align: center;
    padding: 50px 20px;
    color: #677188;
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
}

@media(max-width: 700px) {

    .navbar {
        height: auto;
        padding: 15px;
        align-items: flex-start;
        gap: 10px;
        flex-direction: column;
    }

    .nav {
        width: 100%;
    }

    .hero {
        padding: 55px 10px;
    }

}

</style>

</head>

<body>

<nav class="navbar">

<a href="/" class="logo">
North<span>-Bot-2</span>
</a>

<div class="nav">

<a href="/">Home</a>
<a href="/chat">Chat</a>
<a href="/shop">Shop</a>

${user ? `
<a href="/tickets">Tickets</a>
<a href="/profile">Profil</a>
<a href="/logout">Logout</a>
` : `
<a href="/login">Login</a>
<a href="/register">Registrieren</a>
`}

${isAdmin(user) ? `
<a href="/admin">Admin</a>
` : ""}

</div>

</nav>

${alert}

<main class="container">

${content}

</main>

<footer class="footer">

${SITE_NAME} • Website

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

    const user = getSession(req);

    res.send(layout(
        "Home",
        `
        <section class="hero">

            <h1>
                North<span>-Bot-2</span>
            </h1>

            <p>
                Die offizielle Website von North-Bot-2.
            </p>

            <div>

                <a
                    class="btn"
                    href="https://discord.gg/NJEVq6Pk6x"
                    target="_blank"
                >
                    Discord beitreten
                </a>

                ${
                    user
                    ? `
                    <a
                        class="btn gray"
                        href="/dashboard"
                    >
                        Dashboard
                    </a>
                    `
                    : `
                    <a
                        class="btn gray"
                        href="/register"
                    >
                        Account erstellen
                    </a>
                    `
                }

            </div>

        </section>

        <div class="grid">

            <div class="box">
                <h3>🎫 Support</h3>
                <p>
                    Erstelle ein Ticket und erhalte Hilfe.
                </p>
            </div>

            <div class="box">
                <h3>🪙 Coins</h3>
                <p>
                    Sammle Coins und kaufe Gegenstände.
                </p>
            </div>

            <div class="box">
                <h3>💬 Community</h3>
                <p>
                    Tausche dich mit anderen Nutzern aus.
                </p>
            </div>

            <div class="box">
                <h3>🛡️ Team</h3>
                <p>
                    Verwaltungssystem für das North-Bot-2 Team.
                </p>
            </div>

        </div>
        `,
        user
    ));
});

/*
===========================================================
                     REGISTER
===========================================================
*/

app.get("/register", (req, res) => {

    res.send(layout(
        "Registrierung",
        `
        <div class="box" style="max-width:500px;margin:auto">

            <h2>Account erstellen</h2>

            <form method="POST" action="/register">

                <label>Name</label>
                <input
                    name="name"
                    required
                    maxlength="32"
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

                <button class="btn" type="submit">
                    Registrieren
                </button>

            </form>

            <p class="small">
                Bereits registriert?
                <a href="/login">Jetzt anmelden</a>
            </p>

        </div>
        `
    ));
});

app.post("/register", (req, res) => {

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
        return res.send(
            layout(
                "Fehler",
                `
                <div class="box center">
                    <h2>❌ Ungültige Angaben</h2>
                    <a class="btn" href="/register">
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
            u => u.email.toLowerCase() === email
        )
    ) {
        return res.send(
            layout(
                "Fehler",
                `
                <div class="box center">
                    <h2>❌ E-Mail bereits registriert</h2>
                    <a class="btn" href="/login">
                        Zum Login
                    </a>
                </div>
                `
            )
        );
    }

    let role = "User";

    if (OWNER_EMAILS.includes(email)) {
        role = "Owner";
    } else if (ADMIN_EMAILS.includes(email)) {
        role = "Admin";
    }

    const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: crypto
            .createHash("sha256")
            .update(password)
            .digest("hex"),
        role,
        coins: 0,
        banned: false,
        banReason: "",
        banUntil: null,
        createdAt: new Date().toISOString()
    };

    list.push(user);

    writeJSON(FILES.users, list);

    const token = createSession(user.id);

    res.setHeader(
        "Set-Cookie",
        `north_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );

    res.redirect("/dashboard");
});

/*
===========================================================
                         LOGIN
===========================================================
*/

app.get("/login", (req, res) => {

    res.send(layout(
        "Login",
        `
        <div class="box" style="max-width:500px;margin:auto">

            <h2>🔐 Anmeldung</h2>

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

        </div>
        `
    ));
});

app.post("/login", (req, res) => {

    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    const hash = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

    const user = users().find(
        u =>
            u.email.toLowerCase() === email &&
            u.passwordHash === hash
    );

    if (!user) {
        return res.send(
            layout(
                "Login fehlgeschlagen",
                `
                <div class="box center">
                    <h2>❌ Login fehlgeschlagen</h2>
                    <p>E-Mail oder Passwort ist falsch.</p>
                    <a class="btn" href="/login">
                        Erneut versuchen
                    </a>
                </div>
                `
            )
        );
    }

    if (user.banned) {

        let text = `
            <h2>🚫 Du wurdest gebannt.</h2>
            <p>
                Grund:
                <b>${escapeHTML(user.banReason || "Kein Grund angegeben")}</b>
            </p>
            <p>
                Bitte gehe auf unseren Discord,
                um dich entbannen zu lassen.
            </p>

            <a
                class="btn"
                href="https://discord.gg/NJEVq6Pk6x"
                target="_blank"
            >
                Discord
            </a>
        `;

        if (
            user.banUntil &&
            new Date(user.banUntil).getTime() <= Date.now()
        ) {

            user.banned = false;
            user.banReason = "";
            user.banUntil = null;

            writeJSON(FILES.users, users());

        } else {

            return res.send(
                layout(
                    "Gebannt",
                    `<div class="box center">${text}</div>`
                )
            );
        }
    }

    const token = createSession(user.id);

    res.setHeader(
        "Set-Cookie",
        `north_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );

    res.redirect("/dashboard");
});

/*
===========================================================
                         LOGOUT
===========================================================
*/

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
        "north_session=; HttpOnly; Path=/; Max-Age=0"
    );

    res.redirect("/");
});

/*
===========================================================
                       DASHBOARD
===========================================================
*/

app.get("/dashboard", requireLogin, (req, res) => {

    const user = req.user;

    res.send(layout(
        "Dashboard",
        `
        <h1>👋 Willkommen, ${escapeHTML(user.name)}</h1>

        <div class="grid">

            <div class="box">
                <div class="small">Rolle</div>
                <div class="stat">
                    ${escapeHTML(user.role)}
                </div>
            </div>

            <div class="box">
                <div class="small">Coins</div>
                <div class="stat">
                    🪙 ${user.coins || 0}
                </div>
            </div>

            <div class="box">
                <div class="small">Tickets</div>
                <div class="stat">
                    ${
                        tickets().filter(
                            t => t.userId === user.id
                        ).length
                    }
                </div>
            </div>

        </div>

        <br>

        <div class="grid">

            <a href="/tickets" class="box">
                <h3>🎫 Meine Tickets</h3>
                <p>Support-Tickets verwalten.</p>
            </a>

            <a href="/chat" class="box">
                <h3>💬 Community Chat</h3>
                <p>Mit anderen Nutzern schreiben.</p>
            </a>

            <a href="/shop" class="box">
                <h3>🛒 Coins Shop</h3>
                <p>Deine Coins ausgeben.</p>
            </a>

            <a href="/profile" class="box">
                <h3>👤 Profil</h3>
                <p>Profil bearbeiten.</p>
            </a>

        </div>

        ${
            isAdmin(user)
            ? `
            <br>

            <div class="box">

                <h2>🛡️ Administration</h2>

                <a
                    href="/admin"
                    class="btn"
                >
                    Admin Panel öffnen
                </a>

            </div>
            `
            : ""
        }
        `,
        user
    ));
});

/*
===========================================================
                         PROFIL
===========================================================
*/

app.get("/profile", requireLogin, (req, res) => {

    const user = req.user;

    res.send(layout(
        "Profil",
        `
        <div class="box">

            <h2>👤 Profil bearbeiten</h2>

            <form method="POST" action="/profile">

                <label>Name</label>

                <input
                    name="name"
                    value="${escapeHTML(user.name)}"
                    maxlength="32"
                    required
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

                <button class="btn">
                    Speichern
                </button>

            </form>

        </div>
        `,
        user
    ));
});

app.post("/profile", requireLogin, (req, res) => {

    const name = String(req.body.name || "")
        .trim()
        .slice(0, 32);

    const list = users();

    const index = list.findIndex(
        u => u.id === req.user.id
    );

    if (index === -1) {
        return res.redirect("/logout");
    }

    list[index].name = name || list[index].name;

    writeJSON(FILES.users, list);

    res.redirect("/profile");
});

/*
===========================================================
                         TICKETS
===========================================================
*/

app.get("/tickets", requireLogin, (req, res) => {

    const user = req.user;

    const list = tickets().filter(ticket => {

        if (ticket.userId === user.id) {
            return true;
        }

        if (isAdmin(user)) {
            return true;
        }

        if (
            isTeam(user) &&
            ticket.assignedTo === user.id
        ) {
            return true;
        }

        return false;
    });

    res.send(layout(
        "Tickets",
        `
        <div class="box">

            <h2>🎫 Support</h2>

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
                    maxlength="3000"
                    required
                    placeholder="Beschreibe dein Problem..."
                ></textarea>

                <button class="btn">
                    🎫 Ticket erstellen
                </button>

            </form>

        </div>

        <br>

        ${
            list.length === 0
            ? `
            <div class="box center">
                Noch keine Tickets vorhanden.
            </div>
            `
            : list.map(ticket => `

                <div class="box ticket">

                    <h3>
                        ${escapeHTML(ticket.subject)}
                    </h3>

                    <span class="badge">
                        ${escapeHTML(ticket.status)}
                    </span>

                    <p>
                        ${escapeHTML(ticket.message)}
                    </p>

                    <p class="small">
                        Ticket #${escapeHTML(ticket.id)}
                    </p>

                    <a
                        class="btn"
                        href="/tickets/${ticket.id}"
                    >
                        Öffnen
                    </a>

                </div>

            `).join("")
        }
        `,
        user
    ));
});

app.post("/tickets/create", requireLogin, (req, res) => {

    const subject = String(req.body.subject || "")
        .trim()
        .slice(0, 100);

    const message = String(req.body.message || "")
        .trim()
        .slice(0, 3000);

    if (!subject || !message) {
        return res.redirect("/tickets");
    }

    const list = tickets();

    const ticket = {
        id: crypto.randomBytes(4).toString("hex"),
        userId: req.user.id,
        username: req.user.name,
        subject,
        message,
        status: "Offen",
        assignedTo: null,
        createdAt: new Date().toISOString(),
        messages: []
    };

    list.push(ticket);

    writeJSON(FILES.tickets, list);

    res.redirect(`/tickets/${ticket.id}`);
});

/*
===========================================================
                     TICKET ANZEIGEN
===========================================================
*/

app.get("/tickets/:id", requireLogin, (req, res) => {

    const user = req.user;

    const ticket = tickets().find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.status(404).send(
            layout(
                "Ticket",
                `
                <div class="box center">
                    <h2>Ticket nicht gefunden.</h2>
                </div>
                `,
                user
            )
        );
    }

    const allowed =
        ticket.userId === user.id ||
        isAdmin(user) ||
        ticket.assignedTo === user.id;

    if (!allowed) {
        return res.status(403).send(
            layout(
                "Keine Berechtigung",
                `
                <div class="box center">
                    <h2>🚫 Keine Berechtigung</h2>
                    <p>
                        Dieses Ticket ist privat.
                    </p>
                </div>
                `,
                user
            )
        );
    }

    res.send(layout(
        `Ticket #${ticket.id}`,
        `
        <div class="box">

            <h2>
                🎫 ${escapeHTML(ticket.subject)}
            </h2>

            <span class="badge">
                ${escapeHTML(ticket.status)}
            </span>

            <p>
                <b>${escapeHTML(ticket.username)}</b>
            </p>

            <p>
                ${escapeHTML(ticket.message)}
            </p>

        </div>

        <br>

        <div class="box">

            <h3>💬 Ticket Chat</h3>

            <div class="chat">

                ${
                    ticket.messages.length === 0
                    ? `
                    <div class="small">
                        Noch keine Antworten.
                    </div>
                    `
                    : ticket.messages.map(m => `
                        <div class="message">

                            <b>
                                ${escapeHTML(m.username)}
                            </b>

                            ${
                                m.role
                                ? `
                                <span class="badge">
                                    ${escapeHTML(m.role)}
                                </span>
                                `
                                : ""
                            }

                            <p>
                                ${escapeHTML(m.message)}
                            </p>

                        </div>
                    `).join("")
                }

            </div>

            ${
                ticket.status !== "Geschlossen"
                ? `
                <form
                    method="POST"
                    action="/tickets/${ticket.id}/message"
                >

                    <textarea
                        name="message"
                        required
                        maxlength="3000"
                        placeholder="Antwort schreiben..."
                    ></textarea>

                    <button class="btn">
                        Senden
                    </button>

                </form>
                `
                : `
                <p class="small">
                    Dieses Ticket ist geschlossen.
                </p>
                `
            }

        </div>

        ${
            isTeam(user)
            ? `
            <br>

            <div class="box">

                <h3>🛡️ Team</h3>

                ${
                    ticket.assignedTo
                    ? `
                    <p>
                        Übernommen von:
                        <b>
                            ${escapeHTML(
                                users().find(
                                    x =>
                                        x.id === ticket.assignedTo
                                )?.name || "Unbekannt"
                            )}
                        </b>
                    </p>

                    <form
                        method="POST"
                        action="/tickets/${ticket.id}/unassign"
                        style="display:inline"
                    >

                        <button class="btn gray">
                            Unübernehmen
                        </button>

                    </form>
                    `
                    : `
                    <form
                        method="POST"
                        action="/tickets/${ticket.id}/assign"
                        style="display:inline"
                    >

                        <button class="btn">
                            Übernehmen
                        </button>

                    </form>
                    `
                }

                ${
                    ticket.status !== "Geschlossen"
                    ? `
                    <form
                        method="POST"
                        action="/tickets/${ticket.id}/close"
                        style="display:inline"
                    >

                        <button class="btn red">
                            Ticket schließen
                        </button>

                    </form>
                    `
                    : ""
                }

            </div>
            `
            : ""
        }
        `,
        user
    ));
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {

    const list = tickets();

    const ticket = list.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.redirect("/tickets");
    }

    const allowed =
        ticket.userId === req.user.id ||
        isAdmin(req.user) ||
        ticket.assignedTo === req.user.id;

    if (!allowed) {
        return res.status(403).send("Forbidden");
    }

    if (ticket.status === "Geschlossen") {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    const message = String(req.body.message || "")
        .trim()
        .slice(0, 3000);

    if (message) {
        ticket.messages.push({
            id: crypto.randomUUID(),
            userId: req.user.id,
            username: req.user.name,
            role: req.user.role,
            message,
            createdAt: new Date().toISOString()
        });
    }

    writeJSON(FILES.tickets, list);

    res.redirect(`/tickets/${ticket.id}`);
});

/*
===========================================================
                  TICKET ÜBERNEHMEN
===========================================================
*/

app.post("/tickets/:id/assign", requireLogin, (req, res) => {

    if (!isTeam(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const list = tickets();

    const ticket = list.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.redirect("/tickets");
    }

    ticket.assignedTo = req.user.id;

    writeJSON(FILES.tickets, list);

    res.redirect(`/tickets/${ticket.id}`);
});

/*
===========================================================
                  TICKET UNÜBERNEHMEN
===========================================================
*/

app.post("/tickets/:id/unassign", requireLogin, (req, res) => {

    if (!isTeam(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const list = tickets();

    const ticket = list.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.redirect("/tickets");
    }

    if (
        ticket.assignedTo !== req.user.id &&
        !isAdmin(req.user)
    ) {
        return res.status(403).send("Forbidden");
    }

    ticket.assignedTo = null;

    writeJSON(FILES.tickets, list);

    res.redirect(`/tickets/${ticket.id}`);
});

/*
===========================================================
                       TICKET CLOSE
===========================================================
*/

app.post("/tickets/:id/close", requireLogin, (req, res) => {

    if (!isTeam(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const list = tickets();

    const ticket = list.find(
        t => t.id === req.params.id
    );

    if (!ticket) {
        return res.redirect("/tickets");
    }

    ticket.status = "Geschlossen";

    writeJSON(FILES.tickets, list);

    res.redirect(`/tickets/${ticket.id}`);
});

/*
===========================================================
                         CHAT
===========================================================
*/

app.get("/chat", requireLogin, (req, res) => {

    const messages = chatMessages();

    res.send(layout(
        "Chat",
        `
        <div class="box">

            <h2>💬 Community Chat</h2>

            <div class="chat">

                ${
                    messages.length === 0
                    ? `
                    <p class="small">
                        Noch keine Nachrichten.
                    </p>
                    `
                    : messages.slice(-100).map(m => `
                        <div class="message">

                            <b>
                                ${escapeHTML(m.username)}
                            </b>

                            <span class="badge">
                                ${escapeHTML(m.role)}
                            </span>

                            <p>
                                ${escapeHTML(m.message)}
                            </p>

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

                <button class="btn">
                    Senden
                </button>

            </form>

        </div>
        `,
        req.user
    ));
});

app.post("/chat", requireLogin, (req, res) => {

    const message = String(req.body.message || "")
        .trim()
        .slice(0, 1000);

    if (!message) {
        return res.redirect("/chat");
    }

    const list = chatMessages();

    list.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        username: req.user.name,
        role: req.user.role,
        message,
        createdAt: new Date().toISOString()
    });

    if (list.length > 500) {
        list.splice(0, list.length - 500);
    }

    writeJSON(FILES.chat, list);

    res.redirect("/chat");
});

/*
===========================================================
                         SHOP
===========================================================
*/

app.get("/shop", requireLogin, (req, res) => {

    const items = shopItems();

    res.send(layout(
        "Coins Shop",
        `
        <div class="box">

            <h2>🛒 Coins Shop</h2>

            <p>
                Dein Kontostand:
                <b>🪙 ${req.user.coins || 0}</b>
            </p>

        </div>

        <br>

        <div class="grid">

            ${
                items.length === 0
                ? `
                <div class="box center">
                    Noch keine Produkte vorhanden.
                </div>
                `
                : items.map(item => `

                    <div class="box">

                        <h3>
                            ${escapeHTML(item.name)}
                        </h3>

                        <p>
                            ${escapeHTML(item.description || "")}
                        </p>

                        <p>
                            🪙
                            <b>${item.price}</b>
                        </p>

                        <form
                            method="POST"
                            action="/shop/${item.id}/buy"
                        >

                            <button class="btn">
                                Kaufen
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

app.post("/shop/:id/buy", requireLogin, (req, res) => {

    const item = shopItems().find(
        x => x.id === req.params.id
    );

    if (!item) {
        return res.redirect("/shop");
    }

    const list = users();

    const index = list.findIndex(
        x => x.id === req.user.id
    );

    if (
        index === -1 ||
        (list[index].coins || 0) < item.price
    ) {
        return res.send(
            layout(
                "Shop",
                `
                <div class="box center">
                    <h2>❌ Nicht genug Coins</h2>
                    <a class="btn" href="/shop">
                        Zurück zum Shop
                    </a>
                </div>
                `,
                req.user
            )
        );
    }

    list[index].coins -= item.price;

    writeJSON(FILES.users, list);

    res.redirect("/shop");
});

/*
===========================================================
                     COIN CODES
===========================================================
*/

app.post("/redeem", requireLogin, (req, res) => {

    const codeValue = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const list = codes();

    const code = list.find(
        x => x.code === codeValue
    );

    if (!code || code.usedBy.includes(req.user.id)) {
        return res.redirect("/dashboard");
    }

    if (code.expiresAt) {
        if (
            new Date(code.expiresAt).getTime() < Date.now()
        ) {
            return res.redirect("/dashboard");
        }
    }

    const userList = users();

    const user = userList.find(
        x => x.id === req.user.id
    );

    if (!user) {
        return res.redirect("/logout");
    }

    user.coins =
        (user.coins || 0) +
        Number(code.coins || 0);

    code.usedBy.push(user.id);

    writeJSON(FILES.users, userList);
    writeJSON(FILES.codes, list);

    res.redirect("/dashboard");
});

/*
===========================================================
                      ADMIN PANEL
===========================================================
*/

app.get("/admin", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send(
            layout(
                "Kein Zugriff",
                `
                <div class="box center">

                    <h2>🚫 Kein Zugriff</h2>

                    <p>
                        Dieser Bereich ist nur für das Team.
                    </p>

                </div>
                `,
                req.user
            )
        );
    }

    const list = users();
    const ticketList = tickets();
    const shop = shopItems();
    const codeList = codes();
    const s = settings();

    res.send(layout(
        "Admin Panel",
        `
        <h1>🛡️ North-Bot-2 Admin Panel</h1>

        <div class="grid">

            <div class="box">
                <div class="small">
                    Registrierte User
                </div>
                <div class="stat">
                    ${list.length}
                </div>
            </div>

            <div class="box">
                <div class="small">
                    Tickets
                </div>
                <div class="stat">
                    ${ticketList.length}
                </div>
            </div>

            <div class="box">
                <div class="small">
                    Shop Items
                </div>
                <div class="stat">
                    ${shop.length}
                </div>
            </div>

            <div class="box">
                <div class="small">
                    Codes
                </div>
                <div class="stat">
                    ${codeList.length}
                </div>
            </div>

        </div>

        <br>

        <div class="box">

            <h2>🔧 Wartung & Störung</h2>

            <form method="POST" action="/admin/settings">

                <label>
                    Wartungsmodus
                </label>

                <select name="maintenance">

                    <option
                        value="false"
                        ${!s.maintenance ? "selected" : ""}
                    >
                        Aus
                    </option>

                    <option
                        value="true"
                        ${s.maintenance ? "selected" : ""}
                    >
                        An
                    </option>

                </select>

                <label>
                    Wartungstext
                </label>

                <textarea name="maintenanceText">${escapeHTML(
                    s.maintenanceText
                )}</textarea>

                <label>
                    Störung
                </label>

                <select name="incident">

                    <option
                        value="false"
                        ${!s.incident ? "selected" : ""}
                    >
                        Keine Störung
                    </option>

                    <option
                        value="true"
                        ${s.incident ? "selected" : ""}
                    >
                        Störung aktiv
                    </option>

                </select>

                <label>
                    Störungstext
                </label>

                <textarea name="incidentText">${escapeHTML(
                    s.incidentText
                )}</textarea>

                <label>
                    Störungsstufe
                </label>

                <select name="incidentLevel">

                    <option
                        value="normal"
                        ${s.incidentLevel === "normal" ? "selected" : ""}
                    >
                        Normal
                    </option>

                    <option
                        value="critical"
                        ${s.incidentLevel === "critical" ? "selected" : ""}
                    >
                        Kritisch
                    </option>

                </select>

                <button class="btn">
                    Einstellungen speichern
                </button>

            </form>

        </div>

        <br>

        <div class="box">

            <h2>🪙 Coin-Code erstellen</h2>

            <form method="POST" action="/admin/code">

                <label>Code</label>

                <input
                    name="code"
                    placeholder="NORTH-100"
                    required
                >

                <label>Coins</label>

                <input
                    type="number"
                    name="coins"
                    min="1"
                    required
                >

                <button class="btn green">
                    Code erstellen
                </button>

            </form>

            <p class="small">
                Jeder Benutzer kann jeden Code nur einmal benutzen.
            </p>

        </div>

        <br>

        <div class="box">

            <h2>🛒 Shop-Artikel hinzufügen</h2>

            <form method="POST" action="/admin/shop">

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
                    Artikel hinzufügen
                </button>

            </form>

        </div>

        <br>

        <div class="box">

            <h2>👥 Benutzer</h2>

            <div style="overflow-x:auto">

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
                    list.map(u => `

                    <tr>

                        <td>
                            ${escapeHTML(u.name)}
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
                            🪙 ${u.coins || 0}
                        </td>

                        <td>
                            ${
                                u.banned
                                ? "🚫 Gebannt"
                                : "✅ Aktiv"
                            }
                        </td>

                        <td>

                            <a
                                class="btn gray"
                                href="/admin/user/${u.id}"
                            >
                                Verwalten
                            </a>

                        </td>

                    </tr>

                    `).join("")
                }

            </table>

            </div>

        </div>

        <br>

        <div class="box">

            <h2>🎫 Tickets</h2>

            ${
                ticketList.length === 0
                ? `
                <p>
                    Keine Tickets.
                </p>
                `
                : ticketList.map(t => `

                <div class="message">

                    <b>
                        #${escapeHTML(t.id)}
                    </b>

                    —
                    ${escapeHTML(t.subject)}

                    <br>

                    <span class="small">
                        ${escapeHTML(t.username)}
                        •
                        ${escapeHTML(t.status)}
                    </span>

                    <br><br>

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
        `,
        req.user
    ));
});

/*
===========================================================
                ADMIN SETTINGS
===========================================================
*/

app.post("/admin/settings", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const s = settings();

    s.maintenance =
        req.body.maintenance === "true";

    s.maintenanceText =
        String(
            req.body.maintenanceText ||
            "Die Website befindet sich momentan in Wartung."
        ).slice(0, 1000);

    s.incident =
        req.body.incident === "true";

    s.incidentText =
        String(
            req.body.incidentText ||
            "Aktuell liegt eine Störung vor."
        ).slice(0, 1000);

    s.incidentLevel =
        req.body.incidentLevel === "critical"
            ? "critical"
            : "normal";

    writeJSON(FILES.settings, s);

    res.redirect("/admin");
});

/*
===========================================================
                    ADMIN COIN CODE
===========================================================
*/

app.post("/admin/code", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const codeValue = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const coinAmount =
        Number(req.body.coins || 0);

    if (!codeValue || coinAmount <= 0) {
        return res.redirect("/admin");
    }

    const list = codes();

    if (
        list.some(
            x => x.code === codeValue
        )
    ) {
        return res.redirect("/admin");
    }

    list.push({
        id: crypto.randomUUID(),
        code: codeValue,
        coins: coinAmount,
        usedBy: [],
        createdAt: new Date().toISOString()
    });

    writeJSON(FILES.codes, list);

    res.redirect("/admin");
});

/*
===========================================================
                    ADMIN SHOP ITEM
===========================================================
*/

app.post("/admin/shop", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const name = String(req.body.name || "")
        .trim()
        .slice(0, 100);

    const description = String(
        req.body.description || ""
    )
        .trim()
        .slice(0, 1000);

    const price = Number(req.body.price || 0);

    if (!name || price <= 0) {
        return res.redirect("/admin");
    }

    const list = shopItems();

    list.push({
        id: crypto.randomUUID(),
        name,
        description,
        price,
        createdAt: new Date().toISOString()
    });

    writeJSON(FILES.shop, list);

    res.redirect("/admin");
});

/*
===========================================================
                   ADMIN USER VERWALTEN
===========================================================
*/

app.get("/admin/user/:id", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const user = users().find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin");
    }

    res.send(layout(
        "Benutzer verwalten",
        `
        <div class="box">

            <h2>
                👤 ${escapeHTML(user.name)}
            </h2>

            <p>
                E-Mail:
                <b>${escapeHTML(user.email)}</b>
            </p>

            <p>
                Coins:
                <b>🪙 ${user.coins || 0}</b>
            </p>

            <p>
                Status:
                ${
                    user.banned
                    ? "🚫 Gebannt"
                    : "✅ Aktiv"
                }
            </p>

        </div>

        <br>

        <div class="box">

            <h2>🏷️ Rolle ändern</h2>

            <form
                method="POST"
                action="/admin/user/${user.id}/role"
            >

                <select name="role">

                    ${
                        TEAM_ROLES.map(role => `
                        <option
                            value="${role}"
                            ${user.role === role ? "selected" : ""}
                        >
                            ${role}
                        </option>
                        `).join("")
                    }

                </select>

                <button class="btn">
                    Rolle speichern
                </button>

            </form>

        </div>

        <br>

        <div class="box">

            <h2>🪙 Coins ändern</h2>

            <form
                method="POST"
                action="/admin/user/${user.id}/coins"
            >

                <label>
                    Anzahl
                </label>

                <input
                    type="number"
                    name="coins"
                    required
                >

                <button class="btn">
                    Coins setzen
                </button>

            </form>

        </div>

        <br>

        <div class="box">

            <h2>🚫 Benutzer bannen</h2>

            <form
                method="POST"
                action="/admin/user/${user.id}/ban"
            >

                <label>
                    Grund
                </label>

                <textarea
                    name="reason"
                    required
                    placeholder="Banngrund..."
                ></textarea>

                <label>
                    Dauer
                </label>

                <select name="duration">

                    <option value="1h">
                        1 Stunde
                    </option>

                    <option value="1d">
                        1 Tag
                    </option>

                    <option value="7d">
                        7 Tage
                    </option>

                    <option value="30d">
                        30 Tage
                    </option>

                    <option value="permanent">
                        Permanent
                    </option>

                </select>

                <button class="btn red">
                    Benutzer bannen
                </button>

            </form>

        </div>

        ${
            user.banned
            ? `
            <br>

            <div class="box">

                <h2>🔓 Entbannen</h2>

                <form
                    method="POST"
                    action="/admin/user/${user.id}/unban"
                >

                    <button class="btn green">
                        Benutzer entbannen
                    </button>

                </form>

            </div>
            `
            : ""
        }

        <br>

        <a
            href="/admin"
            class="btn gray"
        >
            ← Zurück
        </a>
        `,
        req.user
    ));
});

/*
===========================================================
                     ROLLE ÄNDERN
===========================================================
*/

app.post("/admin/user/:id/role", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const role = TEAM_ROLES.includes(req.body.role)
        ? req.body.role
        : "User";

    const list = users();

    const user = list.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin");
    }

    /*
      Nur Owner darf Owner/Admin-Rollen vergeben.
    */

    if (
        ["Owner", "Admin"].includes(role) &&
        req.user.role !== "Owner"
    ) {
        return res.status(403).send(
            "Nur Owner dürfen diese Rolle vergeben."
        );
    }

    user.role = role;

    writeJSON(FILES.users, list);

    res.redirect(`/admin/user/${user.id}`);
});

/*
===========================================================
                       COINS SETZEN
===========================================================
*/

app.post("/admin/user/:id/coins", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const amount = Number(req.body.coins);

    if (!Number.isFinite(amount) || amount < 0) {
        return res.redirect("/admin");
    }

    const list = users();

    const user = list.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin");
    }

    user.coins = Math.floor(amount);

    writeJSON(FILES.users, list);

    res.redirect(`/admin/user/${user.id}`);
});

/*
===========================================================
                         BAN
===========================================================
*/

function banDate(duration) {

    const now = Date.now();

    switch (duration) {

        case "1h":
            return new Date(
                now + 60 * 60 * 1000
            ).toISOString();

        case "1d":
            return new Date(
                now + 24 * 60 * 60 * 1000
            ).toISOString();

        case "7d":
            return new Date(
                now + 7 * 24 * 60 * 60 * 1000
            ).toISOString();

        case "30d":
            return new Date(
                now + 30 * 24 * 60 * 60 * 1000
            ).toISOString();

        case "permanent":
            return null;

        default:
            return null;
    }
}

app.post("/admin/user/:id/ban", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const list = users();

    const user = list.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin");
    }

    /*
      Owner kann nicht von normalen Admins gebannt werden.
    */

    if (
        user.role === "Owner" &&
        req.user.role !== "Owner"
    ) {
        return res.status(403).send(
            "Owner kann nur von Owner verwaltet werden."
        );
    }

    user.banned = true;

    user.banReason =
        String(
            req.body.reason ||
            "Kein Grund angegeben"
        ).slice(0, 1000);

    user.banUntil =
        banDate(req.body.duration);

    writeJSON(FILES.users, list);

    res.redirect(`/admin/user/${user.id}`);
});

/*
===========================================================
                         UNBAN
===========================================================
*/

app.post("/admin/user/:id/unban", requireLogin, (req, res) => {

    if (!isAdmin(req.user)) {
        return res.status(403).send("Forbidden");
    }

    const list = users();

    const user = list.find(
        u => u.id === req.params.id
    );

    if (!user) {
        return res.redirect("/admin");
    }

    user.banned = false;
    user.banReason = "";
    user.banUntil = null;

    writeJSON(FILES.users, list);

    res.redirect(`/admin/user/${user.id}`);
});

/*
===========================================================
                   BETA NUMMER SYSTEM
===========================================================
*/

app.get("/beta", requireLogin, (req, res) => {

    const allowedRoles = [
        "Owner",
        "Admin",
        "Manager",
        "Developer"
    ];

    if (!allowedRoles.includes(req.user.role)) {

        return res.status(403).send(
            layout(
                "Beta",
                `
                <div class="box center">

                    <h2>🚫 Kein Zugriff</h2>

                    <p>
                        Nur Developer, Manager,
                        Admins und Owner können
                        Beta-Nummern erhalten.
                    </p>

                </div>
                `,
                req.user
            )
        );
    }

    const beta = betaData();

    /*
      Pro Benutzer nur eine Beta-Nummer.
    */

    if (!req.user.betaNumber) {

        const list = users();

        const user = list.find(
            x => x.id === req.user.id
        );

        user.betaNumber =
            `NORTH-BETA-${beta.nextNumber}`;

        beta.nextNumber++;

        writeJSON(FILES.users, list);
        writeJSON(FILES.beta, beta);
    }

    res.send(layout(
        "Beta",
        `
        <div class="box center">

            <h1>🧑‍💻 Beta Zugang</h1>

            <p>
                Deine persönliche Beta-Nummer:
            </p>

            <div
                style="
                    font-size:32px;
                    font-weight:800;
                    margin:25px 0;
                "
            >
                ${escapeHTML(
                    users().find(
                        x => x.id === req.user.id
                    ).betaNumber
                )}
            </div>

            <p class="small">
                Gib diese Nummer bei deinem
                Ansprechpartner im North-Bot-2 Team an.
            </p>

        </div>
        `,
        req.user
    ));
});

/*
===========================================================
                       404
===========================================================
*/

app.use((req, res) => {

    res.status(404).send(
        layout(
            "404",
            `
            <div class="box center">

                <h1>404</h1>

                <h2>Seite nicht gefunden</h2>

                <a
                    href="/"
                    class="btn"
                >
                    Zur Startseite
                </a>

            </div>
            `,
            getSession(req)
        )
    );
});

/*
===========================================================
                       SERVER
===========================================================
*/

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================================");
    console.log(`   ${SITE_NAME} Website`);
    console.log("==============================================");
    console.log(`   Port: ${PORT}`);
    console.log(`   Status: ONLINE`);
    console.log("==============================================");
    console.log("");

});
