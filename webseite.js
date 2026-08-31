```js
// ============================================================
// NORTH-BOT-2 WEBSEITE
// Komplettes Websystem
// Keine .env nötig
// Keine express-session nötig
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

// ------------------------------------------------------------
// GRUNDEINSTELLUNGEN
// ------------------------------------------------------------

const SITE_NAME = "North-Bot-2";
const DISCORD_LINK = "https://discord.gg/NJEVq6Pk6x";

// Deine Admin-/Owner-Mail
const OWNER_EMAIL = "florianzustolberg@gmail.com";

// ------------------------------------------------------------
// DATEIEN
// ------------------------------------------------------------

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    products: path.join(DATA_DIR, "products.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    messages: path.join(DATA_DIR, "messages.json"),
    settings: path.join(DATA_DIR, "settings.json")
};

// ------------------------------------------------------------
// JSON HELPERS
// ------------------------------------------------------------

function ensureFile(file, fallback) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.products, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.messages, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    incident: false,
    incidentText: "Aktuell liegt eine Störung vor.",
    announcement: "",
    announcementTitle: ""
});

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

function id() {
    return crypto.randomBytes(8).toString("hex");
}

function now() {
    return Date.now();
}

// ------------------------------------------------------------
// PASSWORT
// ------------------------------------------------------------

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto
        .pbkdf2Sync(password, salt, 120000, 64, "sha512")
        .toString("hex");

    return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
    try {
        const [salt, original] = stored.split(":");

        const hash = crypto
            .pbkdf2Sync(password, salt, 120000, 64, "sha512")
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash),
            Buffer.from(original)
        );
    } catch {
        return false;
    }
}

// ------------------------------------------------------------
// TOKEN SYSTEM
// ------------------------------------------------------------

const sessions = new Map();

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
        userId,
        created: now()
    });
    return token;
}

function getUserFromRequest(req) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) return null;

    const session = sessions.get(token);

    if (!session) return null;

    const users = readJSON(FILES.users, []);
    return users.find(u => u.id === session.userId) || null;
}

function auth(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.status(401).json({
            error: "Nicht eingeloggt."
        });
    }

    if (isBanned(user)) {
        return res.status(403).json({
            error: "Du bist gebannt.",
            banned: true,
            ban: user.ban
        });
    }

    req.user = user;
    next();
}

function admin(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.status(401).json({
            error: "Nicht eingeloggt."
        });
    }

    if (!isStaff(user)) {
        return res.status(403).json({
            error: "Keine Berechtigung."
        });
    }

    req.user = user;
    next();
}

// ------------------------------------------------------------
// ROLLEN
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// BAN SYSTEM
// ------------------------------------------------------------

function isBanned(user) {
    if (!user || !user.ban || !user.ban.active) {
        return false;
    }

    // Permanent
    if (user.ban.expiresAt === null) {
        return true;
    }

    // Ban abgelaufen
    if (Date.now() >= user.ban.expiresAt) {
        user.ban.active = false;

        const users = readJSON(FILES.users, []);
        const index = users.findIndex(u => u.id === user.id);

        if (index !== -1) {
            users[index] = user;
            writeJSON(FILES.users, users);
        }

        return false;
    }

    return true;
}

function parseBanDuration(value) {
    if (!value) return null;

    const match = String(value).match(/^(\d+)\s*(m|min|minute|minutes|h|hour|hours|d|day|days|w|week|weeks)$/i);

    if (!match) return null;

    const number = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith("m")) return number * 60 * 1000;
    if (unit.startsWith("h")) return number * 60 * 60 * 1000;
    if (unit.startsWith("d")) return number * 24 * 60 * 60 * 1000;
    if (unit.startsWith("w")) return number * 7 * 24 * 60 * 60 * 1000;

    return null;
}

// ------------------------------------------------------------
// LOG SYSTEM
// ------------------------------------------------------------

function addLog(action, user, details = {}) {
    const logs = readJSON(FILES.logs, []);

    logs.unshift({
        id: id(),
        action,
        userId: user?.id || null,
        username: user?.username || "System",
        time: now(),
        details
    });

    writeJSON(FILES.logs, logs.slice(0, 1000));
}

// ------------------------------------------------------------
// EXPRESS
// ------------------------------------------------------------

app.use(express.json({
    limit: "1mb"
}));

app.use(express.urlencoded({
    extended: true
}));

// ------------------------------------------------------------
// CSS
// ------------------------------------------------------------

const CSS = `
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background: #0b0d12;
    color: #f1f3f7;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 70px;
    background: #10131a;
    border-bottom: 1px solid #202532;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6%;
    position: sticky;
    top: 0;
    z-index: 10;
}

.logo {
    font-size: 21px;
    font-weight: 800;
}

.logo span {
    color: #7289da;
}

.navlinks {
    display: flex;
    gap: 20px;
    align-items: center;
}

.navlinks a {
    color: #aeb4c0;
}

.navlinks a:hover {
    color: white;
}

.container {
    width: min(1150px, 92%);
    margin: 40px auto;
}

.hero {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.hero h1 {
    font-size: clamp(42px, 8vw, 80px);
    margin: 0;
}

.hero p {
    color: #9da4b1;
    font-size: 18px;
}

.btn {
    display: inline-block;
    border: 0;
    border-radius: 9px;
    padding: 12px 18px;
    background: #5865f2;
    color: white;
    cursor: pointer;
    font-weight: 700;
    margin: 4px;
}

.btn:hover {
    filter: brightness(1.12);
}

.btn.red {
    background: #ed4245;
}

.btn.green {
    background: #3ba55c;
}

.btn.gray {
    background: #252a35;
}

.card {
    background: #11151d;
    border: 1px solid #202633;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 18px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
}

input,
textarea,
select {
    width: 100%;
    padding: 12px;
    background: #0b0e14;
    color: white;
    border: 1px solid #2b3240;
    border-radius: 8px;
    margin: 6px 0 14px;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    color: #aeb4c0;
    font-size: 14px;
}

.badge {
    display: inline-block;
    background: #252a35;
    border-radius: 20px;
    padding: 5px 10px;
    font-size: 12px;
}

.badge.admin {
    background: #5865f2;
}

.alert {
    padding: 14px 18px;
    border-radius: 10px;
    margin: 15px 0;
    background: #241e12;
    border: 1px solid #6c531c;
}

.danger {
    background: #281417;
    border-color: #72272b;
}

.success {
    background: #122519;
    border-color: #245c34;
}

.ticket {
    border: 1px solid #252c39;
    padding: 16px;
    border-radius: 10px;
    margin: 10px 0;
}

.message {
    background: #171b24;
    border-radius: 9px;
    padding: 12px;
    margin: 8px 0;
}

.small {
    color: #858d9b;
    font-size: 13px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

td,
th {
    border-bottom: 1px solid #242a35;
    padding: 12px;
    text-align: left;
}

footer {
    margin-top: 80px;
    padding: 30px;
    text-align: center;
    border-top: 1px solid #202532;
    color: #777f8e;
}
`;

function page(title, content, user = null) {
    const settings = readJSON(FILES.settings, {});

    let status = "";

    if (settings.maintenance) {
        status += `
        <div class="alert">
            🔧 <b>Wartung</b><br>
            ${escapeHTML(settings.maintenanceText || "")}
        </div>`;
    }

    if (settings.incident) {
        status += `
        <div class="alert danger">
            🚨 <b>Störung</b><br>
            ${escapeHTML(settings.incidentText || "")}
        </div>`;
    }

    if (settings.announcement) {
        status += `
        <div class="alert">
            📢 <b>${escapeHTML(settings.announcementTitle || "Ankündigung")}</b><br>
            ${escapeHTML(settings.announcement)}
        </div>`;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} – ${SITE_NAME}</title>
<style>${CSS}</style>
</head>

<body>

<nav class="nav">

<a class="logo" href="/">
    North<span>-Bot-2</span>
</a>

<div class="navlinks">

<a href="/">Start</a>
<a href="/shop">Shop</a>
<a href="/giveaways">Gewinnspiele</a>
<a href="/chat">Chat</a>

${
    user
        ? `
        <a href="/dashboard">Dashboard</a>
        ${isStaff(user) ? `<a href="/admin">Admin</a>` : ""}
        <a href="/logout">Logout</a>
        `
        :
        `
        <a href="/login">Login</a>
        <a href="/register">Registrieren</a>
        `
}

<a class="btn" href="${DISCORD_LINK}" target="_blank">
Discord
</a>

</div>
</nav>

<div class="container">

${status}

${content}

</div>

<footer>
North-Bot-2 © ${new Date().getFullYear()} ·
<a href="${DISCORD_LINK}" target="_blank">Discord</a>
</footer>

</body>
</html>
`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ------------------------------------------------------------
// HOME
// ------------------------------------------------------------

app.get("/", (req, res) => {
    const user = getUserFromRequest(req);

    res.send(page("Startseite", `
        <section class="hero">
            <div>
                <h1>North-Bot-2</h1>

                <p>
                    Discord. Community. Support.
                </p>

                <p>
                    Alles an einem Ort.
                </p>

                <a class="btn" href="${DISCORD_LINK}" target="_blank">
                    Discord beitreten
                </a>

                ${
                    user
                        ? `<a class="btn gray" href="/dashboard">Zum Dashboard</a>`
                        : `<a class="btn gray" href="/register">Konto erstellen</a>`
                }
            </div>
        </section>
    `, user));
});

// ------------------------------------------------------------
// REGISTER
// ------------------------------------------------------------

app.get("/register", (req, res) => {
    res.send(page("Registrieren", `
        <div class="card">
            <h1>Konto erstellen</h1>

            <form method="POST" action="/api/register">

                <label>Name</label>
                <input name="username" required minlength="3" maxlength="30">

                <label>E-Mail</label>
                <input type="email" name="email" required>

                <label>Passwort</label>
                <input type="password" name="password" required minlength="6">

                <button class="btn" type="submit">
                    Registrieren
                </button>

            </form>

            <p class="small">
                Du hast bereits ein Konto?
                <a href="/login">Login</a>
            </p>
        </div>
    `));
});

app.post("/api/register", (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.send("Bitte alle Felder ausfüllen.");
    }

    const users = readJSON(FILES.users, []);

    if (
        users.some(
            u => u.email.toLowerCase() === String(email).toLowerCase()
        )
    ) {
        return res.send("Diese E-Mail ist bereits registriert.");
    }

    const user = {
        id: id(),
        username: String(username).trim(),
        email: String(email).toLowerCase().trim(),
        password: hashPassword(password),

        role:
            String(email).toLowerCase() === OWNER_EMAIL.toLowerCase()
                ? "owner"
                : "user",

        coins: 0,

        lastDaily: 0,

        ban: {
            active: false,
            reason: "",
            expiresAt: null,
            bannedBy: null
        },

        createdAt: now()
    };

    users.push(user);
    writeJSON(FILES.users, users);

    addLog("REGISTER", user, {
        email: user.email
    });

    res.redirect("/login?registered=1");
});

// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

app.get("/login", (req, res) => {
    res.send(page("Login", `
        <div class="card">
            <h1>Login</h1>

            ${
                req.query.registered
                    ? `<div class="alert success">
                        Konto erfolgreich erstellt.
                       </div>`
                    : ""
            }

            <form method="POST" action="/api/login">

                <label>E-Mail</label>
                <input type="email" name="email" required>

                <label>Passwort</label>
                <input type="password" name="password" required>

                <button class="btn" type="submit">
                    Einloggen
                </button>

            </form>
        </div>
    `));
});

app.post("/api/login", (req, res) => {
    const users = readJSON(FILES.users, []);

    const user = users.find(
        u => u.email.toLowerCase() === String(req.body.email).toLowerCase()
    );

    if (!user || !checkPassword(req.body.password, user.password)) {
        return res.send("E-Mail oder Passwort falsch.");
    }

    if (isBanned(user)) {
        return res.send(`
            ${page("Gebannt", `
                <div class="card">
                    <h1>🚫 Du bist gebannt</h1>

                    <p>
                        <b>Grund:</b>
                        ${escapeHTML(user.ban.reason)}
                    </p>

                    ${
                        user.ban.expiresAt
                            ? `<p>
                                <b>Ban endet:</b>
                                ${new Date(user.ban.expiresAt).toLocaleString("de-DE")}
                               </p>`
                            : `<p><b>Dauer:</b> Permanent</p>`
                    }

                    <a class="btn" href="${DISCORD_LINK}" target="_blank">
                        Auf Discord gehen
                    </a>
                </div>
            `)}
        `);
    }

    const token = createSession(user.id);

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="0;url=/dashboard">
</head>
<body>
<script>
localStorage.setItem("north_token", ${JSON.stringify(token)});
window.location.href="/dashboard";
</script>
</body>
</html>
`);
});

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------

app.get("/logout", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (token) sessions.delete(token);

    res.send(`
        <script>
        localStorage.removeItem("north_token");
        window.location.href="/";
        </script>
    `);
});

// ------------------------------------------------------------
// API USER
// ------------------------------------------------------------

app.get("/api/me", auth, (req, res) => {
    const safe = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        coins: req.user.coins,
        createdAt: req.user.createdAt,
        lastDaily: req.user.lastDaily
    };

    res.json(safe);
});

// ------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------

app.get("/dashboard", (req, res) => {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.send(`
            ${page("Gebannt", `
                <div class="card">
                    <h1>🚫 Du bist gebannt</h1>

                    <p>
                    ${escapeHTML(user.ban.reason)}
                    </p>

                    <a class="btn" href="${DISCORD_LINK}" target="_blank">
                        Discord öffnen
                    </a>
                </div>
            `)}
        `);
    }

    const tickets = readJSON(FILES.tickets, [])
        .filter(t => t.userId === user.id);

    res.send(page("Dashboard", `
        <h1>Dashboard</h1>

        <div class="grid">

            <div class="card">
                <h3>Profil</h3>
                <h2>${escapeHTML(user.username)}</h2>
                <span class="badge">${escapeHTML(user.role)}</span>
            </div>

            <div class="card">
                <h3>Coins</h3>
                <h2>🪙 ${user.coins}</h2>
                <a class="btn" href="/shop">Shop</a>
            </div>

            <div class="card">
                <h3>Tickets</h3>
                <h2>${tickets.length}</h2>
                <a class="btn" href="/tickets">Tickets</a>
            </div>

        </div>

        <div class="card">

            <h2>Profil bearbeiten</h2>

            <form method="POST" action="/api/profile">

                <label>Name</label>
                <input
                    name="username"
                    value="${escapeHTML(user.username)}"
                    minlength="3"
                    maxlength="30"
                    required
                >

                <button class="btn">
                    Speichern
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Daily Coins</h2>

            <p>
                Alle 14 Stunden kannst du 100 Coins erhalten.
            </p>

            <form method="POST" action="/api/daily">

                <button class="btn green">
                    🪙 100 Coins abholen
                </button>

            </form>

        </div>
    `, user));
});

// ------------------------------------------------------------
// PROFIL
// ------------------------------------------------------------

app.post("/api/profile", auth, (req, res) => {
    const users = readJSON(FILES.users, []);

    const index = users.findIndex(u => u.id === req.user.id);

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    users[index].username =
        String(req.body.username || req.user.username).trim();

    writeJSON(FILES.users, users);

    addLog("PROFILE_UPDATE", users[index]);

    res.redirect("/dashboard");
});

// ------------------------------------------------------------
// DAILY COINS
// ------------------------------------------------------------

app.post("/api/daily", auth, (req, res) => {
    const users = readJSON(FILES.users, []);

    const index = users.findIndex(u => u.id === req.user.id);

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    const user = users[index];

    const cooldown = 14 * 60 * 60 * 1000;

    if (now() - user.lastDaily < cooldown) {
        const remaining = cooldown - (now() - user.lastDaily);

        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor(
            (remaining % 3600000) / 60000
        );

        return res.send(`
            ${page("Daily", `
                <div class="card">
                    <h1>⏳ Noch nicht verfügbar</h1>
                    <p>
                    Du kannst deine 100 Coins in
                    ${hours}h ${minutes}m abholen.
                    </p>
                    <a class="btn" href="/dashboard">
                    Zurück
                    </a>
                </div>
            `, user)}
        `);
    }

    user.coins += 100;
    user.lastDaily = now();

    writeJSON(FILES.users, users);

    addLog("DAILY_COINS", user, {
        amount: 100
    });

    res.redirect("/dashboard");
});

// ------------------------------------------------------------
// TICKETS
// ------------------------------------------------------------

app.get("/tickets", (req, res) => {
    const user = getUserFromRequest(req);

    if (!user) return res.redirect("/login");

    const tickets = readJSON(FILES.tickets, [])
        .filter(t => t.userId === user.id);

    res.send(page("Tickets", `
        <h1>Support</h1>

        <div class="card">

            <h2>Neues Ticket</h2>

            <form method="POST" action="/api/tickets">

                <label>Betreff</label>
                <input name="subject" required maxlength="100">

                <label>Nachricht</label>
                <textarea name="message" required maxlength="3000"></textarea>

                <button class="btn">
                    Ticket erstellen
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Meine Tickets</h2>

            ${
                tickets.length
                    ? tickets.map(t => `
                        <div class="ticket">

                            <b>${escapeHTML(t.subject)}</b>

                            <p class="small">
                            Ticket #${t.id}
                            </p>

                            <p>
                            ${escapeHTML(t.message)}
                            </p>

                            <span class="badge">
                            ${escapeHTML(t.status)}
                            </span>

                        </div>
                    `).join("")
                    : "<p>Noch keine Tickets.</p>"
            }

        </div>
    `, user));
});

app.post("/api/tickets", auth, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = {
        id: id(),
        number: `T-${Date.now().toString().slice(-8)}`,
        userId: req.user.id,
        username: req.user.username,
        subject: String(req.body.subject || "Support"),
        message: String(req.body.message || ""),
        status: "offen",
        claimedBy: null,
        createdAt: now(),
        messages: []
    };

    tickets.push(ticket);

    writeJSON(FILES.tickets, tickets);

    addLog("TICKET_CREATE", req.user, {
        ticketId: ticket.id,
        number: ticket.number
    });

    res.redirect("/tickets");
});

// ------------------------------------------------------------
// CHAT
// ------------------------------------------------------------

app.get("/chat", (req, res) => {
    const user = getUserFromRequest(req);

    const messages = readJSON(FILES.messages, [])
        .filter(m => m.type === "public")
        .slice(-100);

    res.send(page("Chat", `
        <h1>Community-Chat</h1>

        <div class="card">

            ${
                user
                    ? `
                    <form method="POST" action="/api/chat">
                        <input
                            name="message"
                            maxlength="500"
                            placeholder="Nachricht..."
                            required
                        >
                        <button class="btn">
                            Senden
                        </button>
                    </form>
                    `
                    :
                    `
                    <p>
                    Du musst eingeloggt sein, um zu schreiben.
                    </p>
                    `
            }

        </div>

        <div class="card">

            ${
                messages.length
                    ? messages.map(m => `
                        <div class="message">

                            <b>${escapeHTML(m.username)}</b>

                            <span class="badge">
                            ${escapeHTML(m.role)}
                            </span>

                            <p>
                            ${escapeHTML(m.message)}
                            </p>

                            <span class="small">
                            ${new Date(m.time).toLocaleString("de-DE")}
                            </span>

                        </div>
                    `).join("")
                    : "<p>Noch keine Nachrichten.</p>"
            }

        </div>
    `, user));
});

app.post("/api/chat", auth, (req, res) => {
    const messages = readJSON(FILES.messages, []);

    messages.push({
        id: id(),
        type: "public",
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        message: String(req.body.message || "").slice(0, 500),
        time: now()
    });

    writeJSON(FILES.messages, messages.slice(-1000));

    res.redirect("/chat");
});

// ------------------------------------------------------------
// TEAM CHAT
// ------------------------------------------------------------

app.get("/team-chat", (req, res) => {
    const user = getUserFromRequest(req);

    if (!user || !isStaff(user)) {
        return res.status(403).send("Keine Berechtigung.");
    }

    const messages = readJSON(FILES.messages, [])
        .filter(m => m.type === "team")
        .slice(-100);

    res.send(page("Team-Chat", `
        <h1>Team-Chat</h1>

        <div class="card">

            <form method="POST" action="/api/team-chat">

                <input
                    name="message"
                    maxlength="1000"
                    placeholder="Team-Nachricht..."
                    required
                >

                <button class="btn">
                    Senden
                </button>

            </form>

        </div>

        <div class="card">

            ${
                messages.map(m => `
                    <div class="message">

                        <b>${escapeHTML(m.username)}</b>

                        <span class="badge admin">
                        ${escapeHTML(m.role)}
                        </span>

                        <p>
                        ${escapeHTML(m.message)}
                        </p>

                    </div>
                `).join("")
            }

        </div>
    `, user));
});

app.post("/api/team-chat", admin, (req, res) => {
    const messages = readJSON(FILES.messages, []);

    messages.push({
        id: id(),
        type: "team",
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        message: String(req.body.message || "").slice(0, 1000),
        time: now()
    });

    writeJSON(FILES.messages, messages.slice(-1000));

    addLog("TEAM_CHAT", req.user);

    res.redirect("/team-chat");
});

// ------------------------------------------------------------
// CODES
// ------------------------------------------------------------

function generateCode() {
    function part() {
        return Math.floor(1000 + Math.random() * 9000);
    }

    return `${part()}-${part()}-${part()}`;
}

app.get("/codes", admin, (req, res) => {
    const codes = readJSON(FILES.codes, []);

    res.send(page("Coins-Codes", `
        <h1>Coins-Codes</h1>

        <div class="card">

            <h2>Code erstellen</h2>

            <form method="POST" action="/api/codes">

                <label>Coins</label>
                <input
                    type="number"
                    name="coins"
                    min="1"
                    value="100"
                    required
                >

                <button class="btn">
                    Code erstellen
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Codes</h2>

            <table>

            <tr>
                <th>Code</th>
                <th>Coins</th>
                <th>Status</th>
            </tr>

            ${
                codes.map(c => `
                    <tr>
                        <td>
                            <b>${escapeHTML(c.code)}</b>
                        </td>
                        <td>${c.coins}</td>
                        <td>
                            ${c.used ? "Verwendet" : "Offen"}
                        </td>
                    </tr>
                `).join("")
            }

            </table>

        </div>
    `, req.user));
});

app.post("/api/codes", admin, (req, res) => {
    const codes = readJSON(FILES.codes, []);

    const code = {
        id: id(),
        code: generateCode(),
        coins: Math.max(1, Number(req.body.coins) || 100),
        used: false,
        usedBy: null,
        createdBy: req.user.id,
        createdAt: now()
    };

    codes.push(code);

    writeJSON(FILES.codes, codes);

    addLog("CODE_CREATE", req.user, {
        code: code.code,
        coins: code.coins
    });

    res.redirect("/codes");
});

// User löst Code ein
app.post("/api/redeem", auth, (req, res) => {
    const codes = readJSON(FILES.codes, []);
    const users = readJSON(FILES.users, []);

    const code = codes.find(
        c => c.code === String(req.body.code || "").trim()
    );

    if (!code) {
        return res.send("Code nicht gefunden.");
    }

    if (code.used) {
        return res.send("Dieser Code wurde bereits verwendet.");
    }

    const index = users.findIndex(u => u.id === req.user.id);

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    users[index].coins += code.coins;

    code.used = true;
    code.usedBy = req.user.id;
    code.usedAt = now();

    writeJSON(FILES.users, users);
    writeJSON(FILES.codes, codes);

    addLog("CODE_REDEEM", req.user, {
        code: code.code,
        coins: code.coins
    });

    res.redirect("/dashboard");
});

// ------------------------------------------------------------
// SHOP
// ------------------------------------------------------------

app.get("/shop", (req, res) => {
    const user = getUserFromRequest(req);
    const products = readJSON(FILES.products, [])
        .filter(p => p.active !== false);

    res.send(page("Shop", `
        <h1>Coins-Shop</h1>

        <div class="grid">

            ${
                products.length
                    ? products.map(p => `
                        <div class="card">

                            <h2>${escapeHTML(p.name)}</h2>

                            <p>
                            ${escapeHTML(p.description)}
                            </p>

                            <h3>
                            🪙 ${p.price}
                            </h3>

                            ${
                                user
                                    ? `
                                    <form method="POST" action="/api/shop/buy">
                                        <input
                                            type="hidden"
                                            name="productId"
                                            value="${p.id}"
                                        >
                                        <button class="btn">
                                            Kaufen
                                        </button>
                                    </form>
                                    `
                                    :
                                    `<a class="btn" href="/login">
                                    Login
                                    </a>`
                            }

                        </div>
                    `).join("")
                    : "<p>Noch keine Produkte.</p>"
            }

        </div>
    `, user));
});

app.post("/api/shop/buy", auth, (req, res) => {
    const products = readJSON(FILES.products, []);
    const users = readJSON(FILES.users, []);

    const product = products.find(
        p => p.id === req.body.productId && p.active !== false
    );

    if (!product) {
        return res.send("Produkt nicht gefunden.");
    }

    const index = users.findIndex(u => u.id === req.user.id);

    if (users[index].coins < product.price) {
        return res.send("Du hast nicht genug Coins.");
    }

    users[index].coins -= product.price;

    const orderNumber =
        `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    writeJSON(FILES.users, users);

    addLog("SHOP_PURCHASE", req.user, {
        product: product.name,
        orderNumber,
        price: product.price
    });

    res.send(`
        ${page("Bestellung", `
            <div class="card">
                <h1>Bestellung erstellt</h1>

                <p>
                Deine Bestellung wurde erstellt.
                </p>

                <h2>
                ${orderNumber}
                </h2>

                <p class="small">
                Diese Bestellnummer kannst du dem Team auf Discord geben.
                </p>

                <a class="btn" href="${DISCORD_LINK}" target="_blank">
                    Discord öffnen
                </a>

                <a class="btn gray" href="/shop">
                    Zum Shop
                </a>
            </div>
        `, users[index])}
    `);
});

// ------------------------------------------------------------
// ADMIN – PRODUKTE
// ------------------------------------------------------------

app.post("/api/admin/products", admin, (req, res) => {
    const products = readJSON(FILES.products, []);

    products.push({
        id: id(),
        name: String(req.body.name || "Produkt"),
        description: String(req.body.description || ""),
        price: Math.max(1, Number(req.body.price) || 1),
        active: true,
        createdBy: req.user.id,
        createdAt: now()
    });

    writeJSON(FILES.products, products);

    addLog("PRODUCT_CREATE", req.user);

    res.redirect("/admin");
});

// ------------------------------------------------------------
// GEWINNSPIELE
// ------------------------------------------------------------

app.get("/giveaways", (req, res) => {
    const user = getUserFromRequest(req);

    const giveaways = readJSON(FILES.giveaways, [])
        .filter(g => g.active);

    res.send(page("Gewinnspiele", `
        <h1>Gewinnspiele</h1>

        <div class="grid">

            ${
                giveaways.length
                    ? giveaways.map(g => `
                        <div class="card">

                            <h2>
                            🎁 ${escapeHTML(g.title)}
                            </h2>

                            <p>
                            ${escapeHTML(g.description)}
                            </p>

                            <p>
                            Gewinner:
                            <b>${g.winners}</b>
                            </p>

                            <p class="small">
                            Ende:
                            ${new Date(g.endsAt).toLocaleString("de-DE")}
                            </p>

                            ${
                                user
                                    ? `
                                    <form method="POST" action="/api/giveaways/join">

                                        <input
                                            type="hidden"
                                            name="id"
                                            value="${g.id}"
                                        >

                                        <button class="btn">
                                            Teilnehmen
                                        </button>

                                    </form>
                                    `
                                    :
                                    `<a class="btn" href="/login">
                                    Login zum Teilnehmen
                                    </a>`
                            }

                        </div>
                    `).join("")
                    : "<p>Aktuell gibt es keine aktiven Gewinnspiele.</p>"
            }

        </div>
    `, user));
});

app.post("/api/giveaways/join", auth, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    const giveaway = giveaways.find(
        g => g.id === req.body.id && g.active
    );

    if (!giveaway) {
        return res.send("Gewinnspiel nicht gefunden.");
    }

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);
    }

    writeJSON(FILES.giveaways, giveaways);

    addLog("GIVEAWAY_JOIN", req.user, {
        giveawayId: giveaway.id
    });

    res.redirect("/giveaways");
});

// ------------------------------------------------------------
// ADMIN PANEL
// ------------------------------------------------------------

app.get("/admin", admin, (req, res) => {
    const users = readJSON(FILES.users, []);
    const tickets = readJSON(FILES.tickets, []);
    const codes = readJSON(FILES.codes, []);
    const logs = readJSON(FILES.logs, []);
    const products = readJSON(FILES.products, []);
    const giveaways = readJSON(FILES.giveaways, []);
    const settings = readJSON(FILES.settings, {});

    const totalCoins = users.reduce(
        (sum, u) => sum + (Number(u.coins) || 0),
        0
    );

    res.send(page("Admin Panel", `

        <h1>Admin Panel</h1>

        <p>
            Willkommen,
            <b>${escapeHTML(req.user.username)}</b>
            <span class="badge admin">
            ${escapeHTML(req.user.role)}
            </span>
        </p>

        <div class="grid">

            <div class="card">
                <h3>Benutzer</h3>
                <h2>${users.length}</h2>
            </div>

            <div class="card">
                <h3>Tickets</h3>
                <h2>${tickets.length}</h2>
            </div>

            <div class="card">
                <h3>Coins im System</h3>
                <h2>🪙 ${totalCoins}</h2>
            </div>

            <div class="card">
                <h3>Codes</h3>
                <h2>${codes.length}</h2>
            </div>

            <div class="card">
                <h3>Produkte</h3>
                <h2>${products.length}</h2>
            </div>

            <div class="card">
                <h3>Gewinnspiele</h3>
                <h2>${giveaways.length}</h2>
            </div>

        </div>

        <div class="card">

            <h2>Website-Status</h2>

            <form method="POST" action="/api/admin/settings">

                <label>
                    Wartung
                </label>

                <select name="maintenance">
                    <option value="false" ${!settings.maintenance ? "selected" : ""}>
                        Aus
                    </option>
                    <option value="true" ${settings.maintenance ? "selected" : ""}>
                        An
                    </option>
                </select>

                <label>Wartungstext</label>

                <textarea name="maintenanceText">${escapeHTML(
                    settings.maintenanceText || ""
                )}</textarea>

                <label>
                    Störung
                </label>

                <select name="incident">
                    <option value="false" ${!settings.incident ? "selected" : ""}>
                        Aus
                    </option>
                    <option value="true" ${settings.incident ? "selected" : ""}>
                        An
                    </option>
                </select>

                <label>Störungstext</label>

                <textarea name="incidentText">${escapeHTML(
                    settings.incidentText || ""
                )}</textarea>

                <label>Ankündigungstitel</label>

                <input
                    name="announcementTitle"
                    value="${escapeHTML(settings.announcementTitle || "")}"
                >

                <label>Ankündigung</label>

                <textarea name="announcement">${escapeHTML(
                    settings.announcement || ""
                )}</textarea>

                <button class="btn">
                    Status speichern
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Coins-Code erstellen</h2>

            <form method="POST" action="/api/codes">

                <input
                    type="number"
                    name="coins"
                    min="1"
                    value="100"
                    required
                >

                <button class="btn">
                    Code generieren
                </button>

            </form>

            <a class="btn gray" href="/codes">
                Alle Codes ansehen
            </a>

        </div>

        <div class="card">

            <h2>Produkt erstellen</h2>

            <form method="POST" action="/api/admin/products">

                <input
                    name="name"
                    placeholder="Produktname"
                    required
                >

                <input
                    name="price"
                    type="number"
                    min="1"
                    placeholder="Preis"
                    required
                >

                <textarea
                    name="description"
                    placeholder="Beschreibung"
                ></textarea>

                <button class="btn">
                    Produkt erstellen
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Gewinnspiel erstellen</h2>

            <form method="POST" action="/api/admin/giveaway">

                <input
                    name="title"
                    placeholder="Titel"
                    required
                >

                <textarea
                    name="description"
                    placeholder="Beschreibung"
                ></textarea>

                <input
                    name="hours"
                    type="number"
                    min="1"
                    value="24"
                    placeholder="Dauer in Stunden"
                    required
                >

                <input
                    name="winners"
                    type="number"
                    min="1"
                    value="1"
                    placeholder="Gewinner"
                    required
                >

                <button class="btn">
                    Gewinnspiel erstellen
                </button>

            </form>

        </div>

        <div class="card">

            <h2>Benutzerverwaltung</h2>

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

                            <td>
                            ${escapeHTML(u.username)}
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
                            ${isBanned(u) ? "🚫 Gebannt" : "✅ Aktiv"}
                            </td>

                            <td>

                            ${
                                u.id !== req.user.id
                                    ? `
                                    <form
                                        method="POST"
                                        action="/api/admin/ban"
                                    >

                                        <input
                                            type="hidden"
                                            name="userId"
                                            value="${u.id}"
                                        >

                                        <input
                                            name="reason"
                                            placeholder="Grund"
                                            required
                                        >

                                        <select name="duration">

                                            <option value="1m">
                                                1 Minute
                                            </option>

                                            <option value="10m">
                                                10 Minuten
                                            </option>

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
                                            Ban
                                        </button>

                                    </form>

                                    <form
                                        method="POST"
                                        action="/api/admin/unban"
                                    >

                                        <input
                                            type="hidden"
                                            name="userId"
                                            value="${u.id}"
                                        >

                                        <button class="btn green">
                                            Unban
                                        </button>

                                    </form>
                                    `
                                    : "<span class='small'>Du selbst</span>"
                            }

                            </td>

                        </tr>
                    `).join("")
                }

            </table>

        </div>

        <div class="card">

            <h2>Tickets</h2>

            ${
                tickets.map(t => `
                    <div class="ticket">

                        <b>
                        ${escapeHTML(t.number)}
                        </b>

                        <p>
                        ${escapeHTML(t.subject)}
                        </p>

                        <p class="small">
                        Erstellt von:
                        ${escapeHTML(t.username)}
                        </p>

                        <span class="badge">
                        ${escapeHTML(t.status)}
                        </span>

                        ${
                            t.claimedBy
                                ? `
                                <p>
                                Übernommen von:
                                ${escapeHTML(t.claimedBy)}
                                </p>
                                `
                                : ""
                        }

                        <form
                            method="POST"
                            action="/api/admin/ticket/claim"
                            style="display:inline"
                        >

                            <input
                                type="hidden"
                                name="id"
                                value="${t.id}"
                            >

                            <button class="btn">
                                Übernehmen
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/api/admin/ticket/unclaim"
                            style="display:inline"
                        >

                            <input
                                type="hidden"
                                name="id"
                                value="${t.id}"
                            >

                            <button class="btn gray">
                                Nicht übernehmen
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/api/admin/ticket/close"
                            style="display:inline"
                        >

                            <input
                                type="hidden"
                                name="id"
                                value="${t.id}"
                            >

                            <button class="btn red">
                                Schließen
                            </button>

                        </form>

                    </div>
                `).join("")
            }

        </div>

        <div class="card">

            <h2>Team</h2>

            <a class="btn" href="/team-chat">
                Team-Chat
            </a>

            <a class="btn gray" href="/admin/logs">
                Logs
            </a>

        </div>

    `, req.user));
});

// ------------------------------------------------------------
// ADMIN BAN
// ------------------------------------------------------------

app.post("/api/admin/ban", admin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const index = users.findIndex(
        u => u.id === req.body.userId
    );

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    if (users[index].id === req.user.id) {
        return res.send("Du kannst dich nicht selbst bannen.");
    }

    // Nur Owner darf Staff bannen
    if (
        isStaff(users[index]) &&
        !isOwner(req.user)
    ) {
        return res.send(
            "Nur der Owner kann Teammitglieder bannen."
        );
    }

    let expiresAt = null;

    if (req.body.duration !== "permanent") {
        const duration = parseBanDuration(req.body.duration);

        if (!duration) {
            return res.send("Ungültige Ban-Dauer.");
        }

        expiresAt = now() + duration;
    }

    users[index].ban = {
        active: true,
        reason: String(req.body.reason || "Kein Grund angegeben"),
        expiresAt,
        bannedBy: req.user.id,
        bannedByName: req.user.username,
        createdAt: now()
    };

    writeJSON(FILES.users, users);

    addLog("USER_BAN", req.user, {
        target: users[index].username,
        reason: users[index].ban.reason,
        expiresAt
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// UNBAN
// ------------------------------------------------------------

app.post("/api/admin/unban", admin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const index = users.findIndex(
        u => u.id === req.body.userId
    );

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    users[index].ban = {
        active: false,
        reason: "",
        expiresAt: null,
        bannedBy: null
    };

    writeJSON(FILES.users, users);

    addLog("USER_UNBAN", req.user, {
        target: users[index].username
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// TICKET CLAIM
// ------------------------------------------------------------

app.post("/api/admin/ticket/claim", admin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.body.id
    );

    if (!ticket) return res.send("Ticket nicht gefunden.");

    ticket.claimedBy = req.user.username;

    writeJSON(FILES.tickets, tickets);

    addLog("TICKET_CLAIM", req.user, {
        ticket: ticket.number
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// TICKET UNCLAIM
// ------------------------------------------------------------

app.post("/api/admin/ticket/unclaim", admin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.body.id
    );

    if (!ticket) return res.send("Ticket nicht gefunden.");

    ticket.claimedBy = null;

    writeJSON(FILES.tickets, tickets);

    addLog("TICKET_UNCLAIM", req.user, {
        ticket: ticket.number
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// TICKET CLOSE
// ------------------------------------------------------------

app.post("/api/admin/ticket/close", admin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(
        t => t.id === req.body.id
    );

    if (!ticket) return res.send("Ticket nicht gefunden.");

    ticket.status = "geschlossen";
    ticket.closedAt = now();
    ticket.closedBy = req.user.username;

    writeJSON(FILES.tickets, tickets);

    addLog("TICKET_CLOSE", req.user, {
        ticket: ticket.number
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------

app.post("/api/admin/settings", admin, (req, res) => {
    const settings = readJSON(FILES.settings, {});

    settings.maintenance =
        req.body.maintenance === "true";

    settings.maintenanceText =
        String(req.body.maintenanceText || "");

    settings.incident =
        req.body.incident === "true";

    settings.incidentText =
        String(req.body.incidentText || "");

    settings.announcementTitle =
        String(req.body.announcementTitle || "");

    settings.announcement =
        String(req.body.announcement || "");

    writeJSON(FILES.settings, settings);

    addLog("WEBSITE_SETTINGS", req.user);

    res.redirect("/admin");
});

// ------------------------------------------------------------
// ADMIN GEWINNSPIEL
// ------------------------------------------------------------

app.post("/api/admin/giveaway", admin, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    const hours = Math.max(
        1,
        Number(req.body.hours) || 24
    );

    const giveaway = {
        id: id(),
        title: String(req.body.title || "Gewinnspiel"),
        description: String(req.body.description || ""),
        winners: Math.max(
            1,
            Number(req.body.winners) || 1
        ),
        endsAt: now() + hours * 60 * 60 * 1000,
        participants: [],
        active: true,
        createdBy: req.user.id,
        createdAt: now()
    };

    giveaways.push(giveaway);

    writeJSON(FILES.giveaways, giveaways);

    addLog("GIVEAWAY_CREATE", req.user, {
        title: giveaway.title
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// ADMIN LOGS
// ------------------------------------------------------------

app.get("/admin/logs", admin, (req, res) => {
    const logs = readJSON(FILES.logs, []);

    res.send(page("Logs", `
        <h1>System-Logs</h1>

        <div class="card">

            ${
                logs.length
                    ? logs.slice(0, 300).map(log => `
                        <div class="message">

                            <b>
                            ${escapeHTML(log.action)}
                            </b>

                            <p>
                            Benutzer:
                            ${escapeHTML(log.username)}
                            </p>

                            <p class="small">
                            ${new Date(log.time).toLocaleString("de-DE")}
                            </p>

                            ${
                                Object.keys(log.details || {}).length
                                    ? `
                                    <pre style="white-space:pre-wrap">
${escapeHTML(JSON.stringify(log.details, null, 2))}
                                    </pre>
                                    `
                                    : ""
                            }

                        </div>
                    `).join("")
                    : "<p>Keine Logs.</p>"
            }

        </div>

        <a class="btn gray" href="/admin">
            Zurück
        </a>

    `, req.user));
});

// ------------------------------------------------------------
// ADMIN USER API
// ------------------------------------------------------------

app.get("/api/admin/users", admin, (req, res) => {
    const users = readJSON(FILES.users, []);

    res.json(
        users.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            coins: u.coins,
            banned: isBanned(u),
            createdAt: u.createdAt
        }))
    );
});

// ------------------------------------------------------------
// ROLLEN ÄNDERN
// ------------------------------------------------------------

app.post("/api/admin/role", admin, (req, res) => {
    if (!isOwner(req.user)) {
        return res.status(403).send(
            "Nur der Owner kann Rollen ändern."
        );
    }

    const allowed = [
        "user",
        "moderator",
        "developer",
        "manager",
        "admin",
        "owner"
    ];

    if (!allowed.includes(req.body.role)) {
        return res.send("Ungültige Rolle.");
    }

    const users = readJSON(FILES.users, []);

    const index = users.findIndex(
        u => u.id === req.body.userId
    );

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    users[index].role = req.body.role;

    writeJSON(FILES.users, users);

    addLog("ROLE_CHANGE", req.user, {
        target: users[index].username,
        role: req.body.role
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// COINS ADMIN
// ------------------------------------------------------------

app.post("/api/admin/coins", admin, (req, res) => {
    const users = readJSON(FILES.users, []);

    const index = users.findIndex(
        u => u.id === req.body.userId
    );

    if (index === -1) {
        return res.send("User nicht gefunden.");
    }

    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount)) {
        return res.send("Ungültiger Betrag.");
    }

    users[index].coins += amount;

    if (users[index].coins < 0) {
        users[index].coins = 0;
    }

    writeJSON(FILES.users, users);

    addLog("COINS_CHANGE", req.user, {
        target: users[index].username,
        amount
    });

    res.redirect("/admin");
});

// ------------------------------------------------------------
// API WEBSITE STATUS
// ------------------------------------------------------------

app.get("/api/status", (req, res) => {
    const settings = readJSON(FILES.settings, {});

    res.json({
        name: SITE_NAME,
        maintenance: settings.maintenance,
        maintenanceText: settings.maintenanceText,
        incident: settings.incident,
        incidentText: settings.incidentText,
        announcementTitle: settings.announcementTitle,
        announcement: settings.announcement,
        discord: DISCORD_LINK
    });
});

// ------------------------------------------------------------
// 404
// ------------------------------------------------------------

app.use((req, res) => {
    const user = getUserFromRequest(req);

    res.status(404).send(page("404", `
        <div class="card">
            <h1>404</h1>
            <p>Diese Seite wurde nicht gefunden.</p>

            <a class="btn" href="/">
                Startseite
            </a>
        </div>
    `, user));
});

// ------------------------------------------------------------
// SERVER
// ------------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
    console.log("==========================================");
    console.log(`${SITE_NAME} Webserver gestartet`);
    console.log(`Port: ${PORT}`);
    console.log(`Discord: ${DISCORD_LINK}`);
    console.log(`Owner: ${OWNER_EMAIL}`);
    console.log("==========================================");
});
```
