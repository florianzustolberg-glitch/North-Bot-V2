const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    products: path.join(DATA_DIR, "products.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    messages: path.join(DATA_DIR, "messages.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    beta: path.join(DATA_DIR, "beta.json")
};

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

createFile(FILES.users, []);
createFile(FILES.tickets, []);
createFile(FILES.codes, []);
createFile(FILES.products, []);
createFile(FILES.orders, []);
createFile(FILES.logs, []);
createFile(FILES.giveaways, []);
createFile(FILES.messages, []);
createFile(FILES.beta, []);

createFile(FILES.settings, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan in Wartung.",
    incident: false,
    incidentText: "Aktuell liegt eine Störung vor.",
    announcement: "",
    announcementTitle: "Ankündigung"
});

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function users() {
    return readJSON(FILES.users, []);
}

function saveUsers(data) {
    writeJSON(FILES.users, data);
}

function settings() {
    return readJSON(FILES.settings, {});
}

function saveSettings(data) {
    writeJSON(FILES.settings, data);
}

function addLog(type, message, user = null) {
    const logs = readJSON(FILES.logs, []);

    logs.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        user,
        date: new Date().toISOString()
    });

    writeJSON(FILES.logs, logs.slice(0, 1000));
}

function generateId(prefix = "") {
    return prefix + crypto.randomBytes(6).toString("hex");
}

function generateCoinCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    function part(length) {
        let result = "";

        for (let i = 0; i < length; i++) {
            result += chars[crypto.randomInt(0, chars.length)];
        }

        return result;
    }

    return `NORTH-${part(4)}-${part(4)}`;
}

function generateOrderNumber() {
    const year = new Date().getFullYear();
    const number = crypto.randomInt(100000, 999999);

    return `NORTH-${year}-${number}`;
}

function generateBetaNumber() {
    const number = crypto.randomInt(100000, 999999);

    return `BETA-${number}`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function findUser(id) {
    return users().find(u => u.id === id);
}

function isAdmin(user) {
    if (!user) return false;

    return (
        user.role === "owner" ||
        user.role === "admin" ||
        user.role === "manager" ||
        user.role === "developer"
    );
}

function isStaff(user) {
    if (!user) return false;

    return (
        user.role === "owner" ||
        user.role === "admin" ||
        user.role === "manager" ||
        user.role === "developer" ||
        user.role === "moderator"
    );
}

function currentUser(req) {
    if (!req.session.userId) return null;

    return findUser(req.session.userId) || null;
}

function requireLogin(req, res, next) {
    if (!currentUser(req)) {
        return res.redirect("/login");
    }

    next();
}

function requireAdmin(req, res, next) {
    const user = currentUser(req);

    if (!user || !isAdmin(user)) {
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

    next();
}

function requireStaff(req, res, next) {
    const user = currentUser(req);

    if (!user || !isStaff(user)) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `
            <div class="card">
                <h1>Kein Zugriff</h1>
                <p>Dieser Bereich ist nur für das Team.</p>
            </div>
            `
        ));
    }

    next();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "north-bot-2-session-secret-change-this",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

function page(title, content, req = null) {
    const user = req ? currentUser(req) : null;
    const s = settings();

    let alerts = "";

    if (s.maintenance) {
        alerts += `
        <div class="alert maintenance">
            <strong>Wartung</strong>
            <span>${escapeHTML(s.maintenanceText)}</span>
        </div>
        `;
    }

    if (s.incident) {
        alerts += `
        <div class="alert incident">
            <strong>Störung</strong>
            <span>${escapeHTML(s.incidentText)}</span>
        </div>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} · North-Bot-2</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #0b0d11;
    color: #f2f4f7;
    font-family: Arial, Helvetica, sans-serif;
}

a {
    color: inherit;
    text-decoration: none;
}

.nav {
    height: 68px;
    border-bottom: 1px solid #20242b;
    background: #0e1116;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    position: sticky;
    top: 0;
    z-index: 20;
}

.logo {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -.4px;
}

.logo span {
    color: #7d8cff;
}

.navlinks {
    display: flex;
    align-items: center;
    gap: 18px;
}

.navlinks a {
    color: #aeb5c0;
    font-size: 14px;
}

.navlinks a:hover {
    color: white;
}

.container {
    width: min(1150px, calc(100% - 30px));
    margin: 35px auto;
}

.hero {
    padding: 55px 0 35px;
}

.hero h1 {
    font-size: 48px;
    line-height: 1;
    margin: 0 0 18px;
    letter-spacing: -2px;
}

.hero p {
    max-width: 650px;
    color: #aeb5c0;
    font-size: 17px;
    line-height: 1.7;
}

.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.card {
    background: #11151b;
    border: 1px solid #232832;
    border-radius: 10px;
    padding: 22px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

.card p {
    color: #aeb5c0;
    line-height: 1.6;
}

.button {
    display: inline-block;
    border: 0;
    background: #7d8cff;
    color: white;
    padding: 11px 17px;
    border-radius: 7px;
    cursor: pointer;
    font-weight: 600;
    margin-top: 8px;
}

.button:hover {
    background: #6d7bf0;
}

.button.gray {
    background: #242a33;
}

.button.red {
    background: #b83a45;
}

.button.green {
    background: #287d52;
}

input,
textarea,
select {
    width: 100%;
    background: #0b0e13;
    border: 1px solid #2a3039;
    color: white;
    padding: 12px;
    border-radius: 7px;
    margin: 7px 0 15px;
    outline: none;
}

textarea {
    min-height: 120px;
    resize: vertical;
}

label {
    font-size: 13px;
    color: #aeb5c0;
}

.form {
    max-width: 500px;
    margin: 60px auto;
}

.stat {
    font-size: 28px;
    font-weight: 700;
    margin-top: 10px;
}

.muted {
    color: #89919d;
}

.alert {
    padding: 13px 18px;
    margin: 15px auto;
    width: min(1150px, calc(100% - 30px));
    border-radius: 7px;
    border: 1px solid;
    display: flex;
    gap: 12px;
}

.maintenance {
    background: #17150e;
    border-color: #7b6524;
}

.incident {
    background: #190f11;
    border-color: #773139;
}

.announcement {
    margin-bottom: 25px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    border-bottom: 1px solid #242932;
    padding: 13px 9px;
    font-size: 14px;
}

th {
    color: #9da5b1;
}

.badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 5px;
    background: #242a33;
    font-size: 12px;
}

.ticket {
    border-left: 3px solid #7d8cff;
}

.message {
    padding: 12px;
    border-bottom: 1px solid #242932;
}

.message strong {
    display: block;
    margin-bottom: 4px;
}

.footer {
    margin-top: 70px;
    padding: 30px 0;
    border-top: 1px solid #20242b;
    color: #777f8b;
    font-size: 13px;
}

@media(max-width:800px) {
    .grid {
        grid-template-columns: 1fr;
    }

    .hero h1 {
        font-size: 37px;
    }

    .nav {
        padding: 0 15px;
    }

    .navlinks {
        gap: 8px;
    }

    .navlinks a:nth-child(n+4) {
        display: none;
    }
}
</style>
</head>

<body>

<nav class="nav">
    <a class="logo" href="/">North-<span>Bot-2</span></a>

    <div class="navlinks">
        <a href="/">Start</a>
        <a href="/shop">Shop</a>
        <a href="/chat">Chat</a>
        ${user ? `<a href="/dashboard">Dashboard</a>` : ""}
        ${user && isAdmin(user) ? `<a href="/admin">Admin</a>` : ""}
        ${
            user
                ? `<a href="/logout">Abmelden</a>`
                : `<a href="/login">Anmelden</a>`
        }
    </div>
</nav>

${alerts}

<main class="container">
${content}
</main>

<footer class="footer">
    <div class="container">
        North-Bot-2 · Community & Support
    </div>
</footer>

</body>
</html>
`;
}

/* =========================
   STARTSEITE
========================= */

app.get("/", (req, res) => {
    const s = settings();

    res.send(page(
        "Startseite",
        `
        ${
            s.announcement
                ? `
                <div class="card announcement">
                    <h3>${escapeHTML(s.announcementTitle)}</h3>
                    <p>${escapeHTML(s.announcement)}</p>
                </div>
                `
                : ""
        }

        <section class="hero">
            <h1>North-Bot-2</h1>

            <p>
                Eine zentrale Plattform für Community, Support,
                Tickets, Coins, Shop und Teamverwaltung.
            </p>

            <a class="button" href="/register">Konto erstellen</a>
            <a class="button gray" href="https://discord.gg/NJEVq6Pk6x" target="_blank">
                Discord beitreten
            </a>
        </section>

        <div class="grid">
            <div class="card">
                <h3>Support</h3>
                <p>
                    Erstelle Tickets direkt über die Webseite
                    und behalte deine Anfragen im Überblick.
                </p>
            </div>

            <div class="card">
                <h3>Coins</h3>
                <p>
                    Sammle Coins über Daily-Belohnungen,
                    Codes und Gewinnspiele.
                </p>
            </div>

            <div class="card">
                <h3>Shop</h3>
                <p>
                    Verwende deine Coins für verfügbare
                    Produkte.
                </p>
            </div>
        </div>
        `,
        req
    ));
});

/* =========================
   REGISTER
========================= */

app.get("/register", (req, res) => {
    res.send(page(
        "Registrieren",
        `
        <div class="card form">
            <h1>Registrieren</h1>

            <form method="POST" action="/register">

                <label>Name</label>
                <input
                    name="name"
                    maxlength="32"
                    required
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
                    minlength="6"
                    required
                    autocomplete="new-password"
                >

                <button class="button" type="submit">
                    Konto erstellen
                </button>
            </form>

            <p>
                Bereits registriert?
                <a href="/login" style="color:#8795ff">Anmelden</a>
            </p>
        </div>
        `
    ));
});

app.post("/register", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
        return res.send(page(
            "Fehler",
            `
            <div class="card">
                <h2>Registrierung fehlgeschlagen</h2>
                <p>Bitte fülle alle Felder aus. Das Passwort muss mindestens 6 Zeichen haben.</p>
                <a class="button" href="/register">Zurück</a>
            </div>
            `
        ));
    }

    const list = users();

    if (list.some(u => u.email === email)) {
        return res.send(page(
            "Fehler",
            `
            <div class="card">
                <h2>E-Mail bereits vorhanden</h2>
                <p>Für diese E-Mail-Adresse existiert bereits ein Konto.</p>
                <a class="button" href="/login">Anmelden</a>
            </div>
            `
        ));
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
        id: generateId("usr_"),
        name,
        email,
        password: passwordHash,
        role: "user",
        coins: 0,
        createdAt: new Date().toISOString(),
        lastDaily: null,
        banned: false,
        banReason: null,
        banUntil: null,
        kicked: false,
        redeemedCodes: [],
        purchasedProducts: [],
        discordId: null
    };

    list.push(user);
    saveUsers(list);

    addLog("register", `Neuer Benutzer: ${name}`, user.id);

    req.session.userId = user.id;

    res.redirect("/dashboard");
});

/* =========================
   LOGIN
========================= */

app.get("/login", (req, res) => {
    res.send(page(
        "Anmelden",
        `
        <div class="card form">
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

                <button class="button" type="submit">
                    Anmelden
                </button>
            </form>

            <p>
                Noch kein Konto?
                <a href="/register" style="color:#8795ff">
                    Registrieren
                </a>
            </p>
        </div>
        `
    ));
});

app.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = users().find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.send(page(
            "Fehler",
            `
            <div class="card">
                <h2>Anmeldung fehlgeschlagen</h2>
                <p>E-Mail oder Passwort ist falsch.</p>
                <a class="button" href="/login">Zurück</a>
            </div>
            `
        ));
    }

    if (user.banned) {
        const active =
            !user.banUntil ||
            new Date(user.banUntil).getTime() > Date.now();

        if (active) {
            return res.send(page(
                "Gebannt",
                `
                <div class="card">
                    <h1>Du bist gebannt</h1>
                    <p>
                        <strong>Grund:</strong>
                        ${escapeHTML(user.banReason || "Kein Grund angegeben")}
                    </p>

                    <p>
                        ${
                            user.banUntil
                                ? `Ban bis: ${escapeHTML(
                                    new Date(user.banUntil).toLocaleString("de-DE")
                                )}`
                                : "Der Ban ist dauerhaft."
                        }
                    </p>

                    <p>
                        Bitte gehe auf unseren Discord,
                        wenn du einen Entbannungsantrag stellen möchtest.
                    </p>

                    <a
                        class="button"
                        href="https://discord.gg/NJEVq6Pk6x"
                        target="_blank"
                    >
                        Discord öffnen
                    </a>
                </div>
                `
            ));
        }

        user.banned = false;
        user.banReason = null;
        user.banUntil = null;

        const all = users();
        const index = all.findIndex(u => u.id === user.id);

        if (index !== -1) {
            all[index] = user;
            saveUsers(all);
        }
    }

    req.session.userId = user.id;

    addLog("login", `${user.name} hat sich angemeldet`, user.id);

    res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

/* =========================
   DASHBOARD
========================= */

app.get("/dashboard", requireLogin, (req, res) => {
    const user = currentUser(req);

    const dailyReady =
        !user.lastDaily ||
        Date.now() - new Date(user.lastDaily).getTime() >=
            14 * 60 * 60 * 1000;

    const tickets = readJSON(FILES.tickets, [])
        .filter(t => t.userId === user.id);

    res.send(page(
        "Dashboard",
        `
        <div class="hero">
            <h1>Hallo ${escapeHTML(user.name)}</h1>
            <p>Dein persönlicher Bereich.</p>
        </div>

        <div class="grid">

            <div class="card">
                <h3>Coins</h3>
                <div class="stat">${user.coins}</div>
                <p>Dein aktuelles Guthaben.</p>
            </div>

            <div class="card">
                <h3>Rolle</h3>
                <div class="stat">${escapeHTML(user.role)}</div>
                <p>Deine Webseite-Berechtigung.</p>
            </div>

            <div class="card">
                <h3>Daily</h3>

                ${
                    dailyReady
                        ? `
                        <p>Deine nächste Belohnung ist verfügbar.</p>
                        <form method="POST" action="/daily">
                            <button class="button green">
                                100 Coins abholen
                            </button>
                        </form>
                        `
                        : `
                        <p>
                            Du hast deine Daily bereits abgeholt.
                        </p>
                        `
                }
            </div>

        </div>

        <br>

        <div class="grid">

            <div class="card">
                <h3>Profil</h3>
                <p>Bearbeite Name, E-Mail und Passwort.</p>
                <a class="button" href="/profile">Profil bearbeiten</a>
            </div>

            <div class="card">
                <h3>Ticket</h3>
                <p>Erstelle eine Support-Anfrage.</p>
                <a class="button" href="/tickets/new">Ticket erstellen</a>
            </div>

            <div class="card">
                <h3>Coins-Code</h3>
                <p>Löse einen einmaligen Code ein.</p>
                <a class="button" href="/redeem">Code einlösen</a>
            </div>

        </div>

        <br>

        <div class="card">
            <h2>Meine Tickets</h2>

            ${
                tickets.length
                    ? `
                    <table>
                        <tr>
                            <th>Ticket</th>
                            <th>Status</th>
                            <th>Datum</th>
                            <th></th>
                        </tr>

                        ${tickets.map(t => `
                            <tr>
                                <td>${escapeHTML(t.subject)}</td>
                                <td>
                                    <span class="badge">
                                        ${escapeHTML(t.status)}
                                    </span>
                                </td>
                                <td>
                                    ${new Date(t.createdAt).toLocaleString("de-DE")}
                                </td>
                                <td>
                                    <a class="button" href="/tickets/${t.id}">
                                        Öffnen
                                    </a>
                                </td>
                            </tr>
                        `).join("")}
                    </table>
                    `
                    : `
                    <p>Noch keine Tickets vorhanden.</p>
                    `
            }
        </div>
        `,
        req
    ));
});

/* =========================
   DAILY
========================= */

app.post("/daily", requireLogin, (req, res) => {
    const all = users();
    const index = all.findIndex(u => u.id === req.session.userId);

    if (index === -1) {
        return res.redirect("/login");
    }

    const user = all[index];

    if (
        user.lastDaily &&
        Date.now() - new Date(user.lastDaily).getTime() <
            14 * 60 * 60 * 1000
    ) {
        return res.redirect("/dashboard");
    }

    user.coins += 100;
    user.lastDaily = new Date().toISOString();

    all[index] = user;
    saveUsers(all);

    addLog(
        "daily",
        `${user.name} hat 100 Coins erhalten`,
        user.id
    );

    res.redirect("/dashboard");
});

/* =========================
   PROFILE
========================= */

app.get("/profile", requireLogin, (req, res) => {
    const user = currentUser(req);

    res.send(page(
        "Profil",
        `
        <div class="card form">
            <h1>Profil bearbeiten</h1>

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
                    type="email"
                    name="email"
                    value="${escapeHTML(user.email)}"
                    required
                >

                <label>Neues Passwort</label>
                <input
                    type="password"
                    name="password"
                    minlength="6"
                    placeholder="Leer lassen, wenn unverändert"
                >

                <button class="button">
                    Speichern
                </button>

            </form>
        </div>
        `,
        req
    ));
});

app.post("/profile", requireLogin, async (req, res) => {
    const all = users();
    const index = all.findIndex(u => u.id === req.session.userId);

    if (index === -1) {
        return res.redirect("/login");
    }

    const user = all[index];

    user.name = String(req.body.name || "").trim();
    user.email = String(req.body.email || "").trim().toLowerCase();

    if (req.body.password) {
        user.password = await bcrypt.hash(
            String(req.body.password),
            12
        );
    }

    all[index] = user;
    saveUsers(all);

    addLog(
        "profile",
        `${user.name} hat sein Profil geändert`,
        user.id
    );

    res.redirect("/profile");
});

/* =========================
   COIN CODE
========================= */

app.get("/redeem", requireLogin, (req, res) => {
    res.send(page(
        "Code einlösen",
        `
        <div class="card form">
            <h1>Coins-Code</h1>

            <p>
                Jeder Code kann von einem Benutzer nur einmal
                eingelöst werden.
            </p>

            <form method="POST" action="/redeem">
                <label>Code</label>

                <input
                    name="code"
                    placeholder="NORTH-XXXX-XXXX"
                    required
                >

                <button class="button">
                    Einlösen
                </button>
            </form>
        </div>
        `,
        req
    ));
});

app.post("/redeem", requireLogin, (req, res) => {
    const user = currentUser(req);
    const codeValue = String(req.body.code || "")
        .trim()
        .toUpperCase();

    const codes = readJSON(FILES.codes, []);
    const index = codes.findIndex(c =>
        c.code === codeValue &&
        c.active !== false
    );

    if (index === -1) {
        return res.send(page(
            "Code ungültig",
            `
            <div class="card">
                <h2>Code nicht gefunden</h2>
                <p>Der eingegebene Code existiert nicht oder ist nicht mehr aktiv.</p>
                <a class="button" href="/redeem">Zurück</a>
            </div>
            `,
            req
        ));
    }

    const code = codes[index];

    if (code.usedBy && code.usedBy.includes(user.id)) {
        return res.send(page(
            "Code bereits benutzt",
            `
            <div class="card">
                <h2>Bereits eingelöst</h2>
                <p>Du hast diesen Code bereits verwendet.</p>
            </div>
            `,
            req
        ));
    }

    if (!code.usedBy) {
        code.usedBy = [];
    }

    if (code.singleUse && code.usedBy.length >= 1) {
        return res.send(page(
            "Code nicht verfügbar",
            `
            <div class="card">
                <h2>Code bereits verwendet</h2>
                <p>Dieser Code wurde bereits verwendet.</p>
            </div>
            `,
            req
        ));
    }

    code.usedBy.push(user.id);

    const allUsers = users();
    const userIndex = allUsers.findIndex(u => u.id === user.id);

    if (userIndex === -1) {
        return res.redirect("/login");
    }

    allUsers[userIndex].coins += Number(code.coins || 0);

    writeJSON(FILES.codes, codes);
    saveUsers(allUsers);

    addLog(
        "code",
        `${user.name} hat ${code.coins} Coins eingelöst`,
        user.id
    );

    res.send(page(
        "Code eingelöst",
        `
        <div class="card">
            <h2>Code eingelöst</h2>
            <p>
                Dir wurden
                <strong>${Number(code.coins || 0)} Coins</strong>
                gutgeschrieben.
            </p>

            <a class="button" href="/dashboard">
                Zum Dashboard
            </a>
        </div>
        `,
        req
    ));
});

/* =========================
   SHOP
========================= */

app.get("/shop", (req, res) => {
    const products = readJSON(FILES.products, []);

    res.send(page(
        "Shop",
        `
        <div class="hero">
            <h1>Shop</h1>
            <p>Produkte mit deinen Coins kaufen.</p>
        </div>

        <div class="grid">

        ${
            products.length
                ? products.map(product => `
                    <div class="card">
                        <h3>${escapeHTML(product.name)}</h3>

                        <p>
                            ${escapeHTML(product.description || "")}
                        </p>

                        <div class="stat">
                            ${Number(product.price)} Coins
                        </div>

                        ${
                            currentUser(req)
                                ? `
                                <form method="POST" action="/shop/buy">
                                    <input
                                        type="hidden"
                                        name="productId"
                                        value="${escapeHTML(product.id)}"
                                    >

                                    <button class="button">
                                        Kaufen
                                    </button>
                                </form>
                                `
                                : `
                                <a class="button" href="/login">
                                    Anmelden
                                </a>
                                `
                        }
                    </div>
                `).join("")
                : `
                    <div class="card">
                        <h3>Noch keine Produkte</h3>
                        <p>Der Shop wird momentan aufgebaut.</p>
                    </div>
                `
        }

        </div>
        `,
        req
    ));
});

app.post("/shop/buy", requireLogin, (req, res) => {
    const user = currentUser(req);
    const productId = String(req.body.productId || "");

    const products = readJSON(FILES.products, []);
    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.redirect("/shop");
    }

    if (user.coins < product.price) {
        return res.send(page(
            "Nicht genug Coins",
            `
            <div class="card">
                <h2>Nicht genug Coins</h2>
                <p>Du benötigst ${product.price} Coins.</p>
                <p>Du hast ${user.coins} Coins.</p>
                <a class="button" href="/shop">Zurück zum Shop</a>
            </div>
            `,
            req
        ));
    }

    const allUsers = users();
    const index = allUsers.findIndex(u => u.id === user.id);

    allUsers[index].coins -= product.price;

    const orders = readJSON(FILES.orders, []);

    const order = {
        id: generateId("order_"),
        orderNumber: generateOrderNumber(),
        userId: user.id,
        productId: product.id,
        productName: product.name,
        price: product.price,
        status: "offen",
        createdAt: new Date().toISOString()
    };

    orders.push(order);

    if (!allUsers[index].purchasedProducts) {
        allUsers[index].purchasedProducts = [];
    }

    allUsers[index].purchasedProducts.push(order.id);

    saveUsers(allUsers);
    writeJSON(FILES.orders, orders);

    addLog(
        "order",
        `${user.name} hat ${product.name} bestellt (${order.orderNumber})`,
        user.id
    );

    res.send(page(
        "Bestellung",
        `
        <div class="card">
            <h2>Bestellung erfolgreich</h2>

            <p>Deine Bestellung wurde erstellt.</p>

            <p>
                <strong>Bestellnummer:</strong>
                ${escapeHTML(order.orderNumber)}
            </p>

            <p>
                <strong>Produkt:</strong>
                ${escapeHTML(order.productName)}
            </p>

            <p>
                <strong>Preis:</strong>
                ${order.price} Coins
            </p>

            <a
                class="button"
                href="https://discord.gg/NJEVq6Pk6x"
                target="_blank"
            >
                Zum Discord
            </a>
        </div>
        `,
        req
    ));
});

/* =========================
   TICKETS
========================= */

app.get("/tickets/new", requireLogin, (req, res) => {
    res.send(page(
        "Ticket erstellen",
        `
        <div class="card form">
            <h1>Support-Ticket</h1>

            <form method="POST" action="/tickets/new">

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

                <button class="button">
                    Ticket erstellen
                </button>

            </form>
        </div>
        `,
        req
    ));
});

app.post("/tickets/new", requireLogin, (req, res) => {
    const user = currentUser(req);

    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!subject || !message) {
        return res.redirect("/tickets/new");
    }

    const tickets = readJSON(FILES.tickets, []);

    const ticket = {
        id: generateId("ticket_"),
        userId: user.id,
        subject,
        status: "offen",
        claimedBy: null,
        createdAt: new Date().toISOString(),
        messages: [
            {
                id: generateId("msg_"),
                userId: user.id,
                name: user.name,
                message,
                date: new Date().toISOString()
            }
        ]
    };

    tickets.push(ticket);

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket",
        `${user.name} hat ein Ticket erstellt: ${subject}`,
        user.id
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.get("/tickets/:id", requireLogin, (req, res) => {
    const user = currentUser(req);
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(t => t.id === req.params.id);

    if (!ticket) {
        return res.status(404).send(page(
            "Ticket nicht gefunden",
            `<div class="card"><h2>Ticket nicht gefunden</h2></div>`,
            req
        ));
    }

    if (ticket.userId !== user.id && !isStaff(user)) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `<div class="card"><h2>Dieses Ticket gehört nicht dir.</h2></div>`,
            req
        ));
    }

    res.send(page(
        `Ticket · ${ticket.subject}`,
        `
        <div class="card ticket">

            <h1>${escapeHTML(ticket.subject)}</h1>

            <p>
                Status:
                <span class="badge">
                    ${escapeHTML(ticket.status)}
                </span>
            </p>

            ${
                ticket.claimedBy
                    ? `
                    <p>
                        Übernommen von:
                        ${escapeHTML(
                            findUser(ticket.claimedBy)?.name || "Team"
                        )}
                    </p>
                    `
                    : ""
            }

        </div>

        <br>

        <div class="card">

            <h2>Nachrichten</h2>

            ${
                ticket.messages.length
                    ? ticket.messages.map(m => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(m.name)}
                            </strong>

                            <span>
                                ${escapeHTML(m.message)}
                            </span>

                            <div class="muted">
                                ${new Date(m.date).toLocaleString("de-DE")}
                            </div>
                        </div>
                    `).join("")
                    : "<p>Noch keine Nachrichten.</p>"
            }

        </div>

        <br>

        <div class="card">

            <form method="POST" action="/tickets/${ticket.id}/message">

                <label>Antwort</label>

                <textarea
                    name="message"
                    maxlength="5000"
                    required
                ></textarea>

                <button class="button">
                    Nachricht senden
                </button>

            </form>

            ${
                isStaff(user)
                    ? `
                    <hr style="border-color:#242932;margin:25px 0">

                    ${
                        !ticket.claimedBy
                            ? `
                            <form method="POST"
                                action="/tickets/${ticket.id}/claim">
                                <button class="button green">
                                    Übernehmen
                                </button>
                            </form>
                            `
                            : `
                            <form method="POST"
                                action="/tickets/${ticket.id}/unclaim">
                                <button class="button gray">
                                    Nicht mehr übernehmen
                                </button>
                            </form>
                            `
                    }

                    <form method="POST"
                        action="/tickets/${ticket.id}/close">
                        <button class="button red">
                            Schließen
                        </button>
                    </form>
                    `
                    : ""
            }

        </div>
        `,
        req
    ));
});

app.post("/tickets/:id/message", requireLogin, (req, res) => {
    const user = currentUser(req);
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(t => t.id === req.params.id);

    if (!ticket) {
        return res.redirect("/dashboard");
    }

    if (ticket.userId !== user.id && !isStaff(user)) {
        return res.status(403).send("Kein Zugriff");
    }

    if (ticket.status === "geschlossen") {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    const message = String(req.body.message || "").trim();

    if (!message) {
        return res.redirect(`/tickets/${ticket.id}`);
    }

    ticket.messages.push({
        id: generateId("msg_"),
        userId: user.id,
        name: user.name,
        message,
        date: new Date().toISOString()
    });

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_message",
        `${user.name} schrieb in Ticket ${ticket.subject}`,
        user.id
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.post("/tickets/:id/claim", requireStaff, (req, res) => {
    const user = currentUser(req);
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(t => t.id === req.params.id);

    if (!ticket) {
        return res.redirect("/admin/tickets");
    }

    ticket.claimedBy = user.id;

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_claim",
        `${user.name} hat Ticket ${ticket.subject} übernommen`,
        user.id
    );

    res.redirect(`/tickets/${ticket.id}`);
});

app.post("/tickets/:id/unclaim", requireStaff, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(t => t.id === req.params.id);

    if (!ticket) {
        return res.redirect("/admin/tickets");
    }

    ticket.claimedBy = null;

    writeJSON(FILES.tickets, tickets);

    res.redirect(`/tickets/${ticket.id}`);
});

app.post("/tickets/:id/close", requireStaff, (req, res) => {
    const user = currentUser(req);
    const tickets = readJSON(FILES.tickets, []);

    const ticket = tickets.find(t => t.id === req.params.id);

    if (!ticket) {
        return res.redirect("/admin/tickets");
    }

    ticket.status = "geschlossen";

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_close",
        `${user.name} hat Ticket ${ticket.subject} geschlossen`,
        user.id
    );

    res.redirect(`/tickets/${ticket.id}`);
});

/* =========================
   CHAT
========================= */

app.get("/chat", requireLogin, (req, res) => {
    const messages = readJSON(FILES.messages, []);

    res.send(page(
        "Community Chat",
        `
        <div class="hero">
            <h1>Community Chat</h1>
            <p>Chatte mit anderen Webseiten-Benutzern.</p>
        </div>

        <div class="card">

            ${
                messages.length
                    ? messages.slice(0, 100).map(m => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(m.name)}
                            </strong>

                            <span>
                                ${escapeHTML(m.message)}
                            </span>

                            <div class="muted">
                                ${new Date(m.date).toLocaleString("de-DE")}
                            </div>
                        </div>
                    `).join("")
                    : "<p>Noch keine Nachrichten.</p>"
            }

            <br>

            <form method="POST" action="/chat">

                <textarea
                    name="message"
                    maxlength="1000"
                    placeholder="Nachricht schreiben..."
                    required
                ></textarea>

                <button class="button">
                    Senden
                </button>

            </form>

        </div>
        `,
        req
    ));
});

app.post("/chat", requireLogin, (req, res) => {
    const user = currentUser(req);
    const message = String(req.body.message || "").trim();

    if (!message) {
        return res.redirect("/chat");
    }

    const messages = readJSON(FILES.messages, []);

    messages.unshift({
        id: generateId("chat_"),
        userId: user.id,
        name: user.name,
        message,
        date: new Date().toISOString()
    });

    writeJSON(FILES.messages, messages.slice(0, 1000));

    res.redirect("/chat");
});

/* =========================
   ADMIN PANEL
========================= */

app.get("/admin", requireAdmin, (req, res) => {
    const list = users();
    const tickets = readJSON(FILES.tickets, []);
    const codes = readJSON(FILES.codes, []);
    const products = readJSON(FILES.products, []);
    const orders = readJSON(FILES.orders, []);
    const giveaways = readJSON(FILES.giveaways, []);
    const logs = readJSON(FILES.logs, []);

    const totalCoins = list.reduce(
        (sum, user) => sum + Number(user.coins || 0),
        0
    );

    res.send(page(
        "Admin Panel",
        `
        <div class="hero">
            <h1>Admin Panel</h1>
            <p>Verwaltung von North-Bot-2.</p>
        </div>

        <div class="grid">

            <div class="card">
                <h3>Benutzer</h3>
                <div class="stat">${list.length}</div>
            </div>

            <div class="card">
                <h3>Tickets</h3>
                <div class="stat">${tickets.length}</div>
            </div>

            <div class="card">
                <h3>Coins</h3>
                <div class="stat">${totalCoins}</div>
            </div>

        </div>

        <br>

        <div class="grid">

            <div class="card">
                <h3>Benutzer</h3>
                <a class="button" href="/admin/users">Öffnen</a>
            </div>

            <div class="card">
                <h3>Tickets</h3>
                <a class="button" href="/admin/tickets">Öffnen</a>
            </div>

            <div class="card">
                <h3>Codes</h3>
                <a class="button" href="/admin/codes">Öffnen</a>
            </div>

            <div class="card">
                <h3>Shop</h3>
                <a class="button" href="/admin/products">Öffnen</a>
            </div>

            <div class="card">
                <h3>Bestellungen</h3>
                <a class="button" href="/admin/orders">Öffnen</a>
            </div>

            <div class="card">
                <h3>Gewinnspiele</h3>
                <a class="button" href="/admin/giveaways">Öffnen</a>
            </div>

            <div class="card">
                <h3>Team Chat</h3>
                <a class="button" href="/admin/team-chat">Öffnen</a>
            </div>

            <div class="card">
                <h3>Logs</h3>
                <a class="button" href="/admin/logs">Öffnen</a>
            </div>

            <div class="card">
                <h3>Webseite</h3>
                <a class="button" href="/admin/settings">Öffnen</a>
            </div>

            <div class="card">
                <h3>Beta-Nummern</h3>
                <a class="button" href="/admin/beta">Öffnen</a>
            </div>

        </div>
        `,
        req
    ));
});

/* =========================
   ADMIN USERS
========================= */

app.get("/admin/users", requireAdmin, (req, res) => {
    const list = users();

    res.send(page(
        "Benutzerverwaltung",
        `
        <div class="card">
            <h1>Benutzer</h1>

            <table>
                <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Rolle</th>
                    <th>Coins</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                </tr>

                ${list.map(u => `
                    <tr>
                        <td>${escapeHTML(u.name)}</td>
                        <td>${escapeHTML(u.email)}</td>
                        <td>${escapeHTML(u.role)}</td>
                        <td>${u.coins}</td>

                        <td>
                            ${
                                u.banned
                                    ? `<span class="badge">Gebannt</span>`
                                    : `<span class="badge">Aktiv</span>`
                            }
                        </td>

                        <td>
                            <a class="button" href="/admin/users/${u.id}">
                                Bearbeiten
                            </a>
                        </td>
                    </tr>
                `).join("")}
            </table>
        </div>
        `,
        req
    ));
});

app.get("/admin/users/:id", requireAdmin, (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        return res.redirect("/admin/users");
    }

    res.send(page(
        "Benutzer bearbeiten",
        `
        <div class="card form">

            <h1>${escapeHTML(user.name)}</h1>

            <form method="POST"
                action="/admin/users/${user.id}">

                <label>Name</label>
                <input
                    name="name"
                    value="${escapeHTML(user.name)}"
                    required
                >

                <label>Rolle</label>

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

                    <option value="owner" ${user.role === "owner" ? "selected" : ""}>
                        Owner
                    </option>
                </select>

                <label>Coins</label>
                <input
                    type="number"
                    name="coins"
                    value="${Number(user.coins || 0)}"
                    min="0"
                >

                <button class="button">
                    Speichern
                </button>

            </form>

            <hr style="border-color:#242932;margin:25px 0">

            <h3>Webseiten-Ban</h3>

            <form method="POST"
                action="/admin/users/${user.id}/ban">

                <label>Grund</label>

                <input
                    name="reason"
                    placeholder="Grund"
                    required
                >

                <label>Dauer</label>

                <select name="duration">
                    <option value="1h">1 Stunde</option>
                    <option value="6h">6 Stunden</option>
                    <option value="1d">1 Tag</option>
                    <option value="7d">7 Tage</option>
                    <option value="30d">30 Tage</option>
                    <option value="permanent">Permanent</option>
                </select>

                <button class="button red">
                    User bannen
                </button>

            </form>

            ${
                user.banned
                    ? `
                    <form method="POST"
                        action="/admin/users/${user.id}/unban"
                        style="margin-top:10px">

                        <button class="button green">
                            Entbannen
                        </button>
                    </form>
                    `
                    : ""
            }

        </div>
        `,
        req
    ));
});

app.post("/admin/users/:id", requireAdmin, (req, res) => {
    const all = users();
    const index = all.findIndex(u => u.id === req.params.id);

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    all[index].name = String(req.body.name || "").trim();
    all[index].role = String(req.body.role || "user");
    all[index].coins = Math.max(
        0,
        Number(req.body.coins || 0)
    );

    saveUsers(all);

    addLog(
        "admin_user",
        `Benutzer ${all[index].name} wurde geändert`,
        currentUser(req).id
    );

    res.redirect(`/admin/users/${req.params.id}`);
});

app.post("/admin/users/:id/ban", requireAdmin, (req, res) => {
    const all = users();
    const index = all.findIndex(u => u.id === req.params.id);

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    const reason =
        String(req.body.reason || "Kein Grund angegeben").trim();

    const duration = String(req.body.duration || "permanent");

    let until = null;

    const durations = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000
    };

    if (durations[duration]) {
        until = new Date(
            Date.now() + durations[duration]
        ).toISOString();
    }

    all[index].banned = true;
    all[index].banReason = reason;
    all[index].banUntil = until;

    saveUsers(all);

    addLog(
        "ban",
        `${all[index].name} wurde gebannt: ${reason}`,
        currentUser(req).id
    );

    res.redirect(`/admin/users/${req.params.id}`);
});

app.post("/admin/users/:id/unban", requireAdmin, (req, res) => {
    const all = users();
    const index = all.findIndex(u => u.id === req.params.id);

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    all[index].banned = false;
    all[index].banReason = null;
    all[index].banUntil = null;

    saveUsers(all);

    addLog(
        "unban",
        `${all[index].name} wurde entbannt`,
        currentUser(req).id
    );

    res.redirect(`/admin/users/${req.params.id}`);
});

/* =========================
   ADMIN CODES
========================= */

app.get("/admin/codes", requireAdmin, (req, res) => {
    const codes = readJSON(FILES.codes, []);

    res.send(page(
        "Codes",
        `
        <div class="card">
            <h1>Coin-Codes</h1>

            <form method="POST" action="/admin/codes/create">

                <label>Coins</label>
                <input
                    type="number"
                    name="coins"
                    min="1"
                    value="100"
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

                <label>
                    <input
                        type="checkbox"
                        name="singleUse"
                        checked
                        style="width:auto"
                    >
                    Einmalig
                </label>

                <br>

                <button class="button">
                    Codes erstellen
                </button>

            </form>
        </div>

        <br>

        <div class="card">

            <h2>Erstellte Codes</h2>

            ${
                codes.length
                    ? `
                    <table>
                        <tr>
                            <th>Code</th>
                            <th>Coins</th>
                            <th>Benutzt</th>
                            <th>Status</th>
                        </tr>

                        ${codes.map(c => `
                            <tr>
                                <td>
                                    <strong>
                                        ${escapeHTML(c.code)}
                                    </strong>
                                </td>

                                <td>${c.coins}</td>

                                <td>
                                    ${(c.usedBy || []).length}
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
                    `
                    : "<p>Noch keine Codes erstellt.</p>"
            }

        </div>
        `,
        req
    ));
});

app.post("/admin/codes/create", requireAdmin, (req, res) => {
    const coins = Math.max(1, Number(req.body.coins || 100));
    const amount = Math.min(
        100,
        Math.max(1, Number(req.body.amount || 1))
    );

    const singleUse =
        req.body.singleUse === "on";

    const codes = readJSON(FILES.codes, []);

    for (let i = 0; i < amount; i++) {
        codes.unshift({
            id: generateId("code_"),
            code: generateCoinCode(),
            coins,
            singleUse,
            usedBy: [],
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: currentUser(req).id
        });
    }

    writeJSON(FILES.codes, codes);

    addLog(
        "code_create",
        `${amount} Code(s) mit ${coins} Coins erstellt`,
        currentUser(req).id
    );

    res.redirect("/admin/codes");
});

/* =========================
   ADMIN PRODUCTS
========================= */

app.get("/admin/products", requireAdmin, (req, res) => {
    const products = readJSON(FILES.products, []);

    res.send(page(
        "Shopverwaltung",
        `
        <div class="card form">

            <h1>Produkt hinzufügen</h1>

            <form method="POST" action="/admin/products/create">

                <label>Name</label>
                <input name="name" required>

                <label>Beschreibung</label>
                <textarea name="description"></textarea>

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

        <br>

        <div class="card">

            <h2>Produkte</h2>

            ${
                products.length
                    ? products.map(p => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(p.name)}
                            </strong>

                            <span>
                                ${p.price} Coins
                            </span>

                            <form method="POST"
                                action="/admin/products/${p.id}/delete">

                                <button class="button red">
                                    Löschen
                                </button>

                            </form>
                        </div>
                    `).join("")
                    : "<p>Noch keine Produkte.</p>"
            }

        </div>
        `,
        req
    ));
});

app.post("/admin/products/create", requireAdmin, (req, res) => {
    const products = readJSON(FILES.products, []);

    products.push({
        id: generateId("product_"),
        name: String(req.body.name || "").trim(),
        description: String(req.body.description || "").trim(),
        price: Math.max(1, Number(req.body.price || 1)),
        createdAt: new Date().toISOString()
    });

    writeJSON(FILES.products, products);

    addLog(
        "product_create",
        "Produkt erstellt",
        currentUser(req).id
    );

    res.redirect("/admin/products");
});

app.post("/admin/products/:id/delete", requireAdmin, (req, res) => {
    let products = readJSON(FILES.products, []);

    products = products.filter(
        p => p.id !== req.params.id
    );

    writeJSON(FILES.products, products);

    addLog(
        "product_delete",
        "Produkt gelöscht",
        currentUser(req).id
    );

    res.redirect("/admin/products");
});

/* =========================
   ADMIN ORDERS
========================= */

app.get("/admin/orders", requireAdmin, (req, res) => {
    const orders = readJSON(FILES.orders, []);

    res.send(page(
        "Bestellungen",
        `
        <div class="card">

            <h1>Bestellungen</h1>

            ${
                orders.length
                    ? `
                    <table>
                        <tr>
                            <th>Bestellnummer</th>
                            <th>User</th>
                            <th>Produkt</th>
                            <th>Coins</th>
                            <th>Status</th>
                        </tr>

                        ${orders.map(o => `
                            <tr>
                                <td>
                                    ${escapeHTML(o.orderNumber)}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        findUser(o.userId)?.name ||
                                        "Unbekannt"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(o.productName)}
                                </td>

                                <td>${o.price}</td>

                                <td>
                                    ${escapeHTML(o.status)}
                                </td>
                            </tr>
                        `).join("")}
                    </table>
                    `
                    : "<p>Keine Bestellungen.</p>"
            }

        </div>
        `,
        req
    ));
});

/* =========================
   ADMIN TICKETS
========================= */

app.get("/admin/tickets", requireAdmin, (req, res) => {
    const tickets = readJSON(FILES.tickets, []);

    res.send(page(
        "Tickets",
        `
        <div class="card">

            <h1>Ticketverwaltung</h1>

            ${
                tickets.length
                    ? `
                    <table>
                        <tr>
                            <th>Betreff</th>
                            <th>User</th>
                            <th>Status</th>
                            <th></th>
                        </tr>

                        ${tickets.map(t => `
                            <tr>
                                <td>
                                    ${escapeHTML(t.subject)}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        findUser(t.userId)?.name ||
                                        "Unbekannt"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(t.status)}
                                </td>

                                <td>
                                    <a
                                        class="button"
                                        href="/tickets/${t.id}"
                                    >
                                        Öffnen
                                    </a>
                                </td>
                            </tr>
                        `).join("")}
                    </table>
                    `
                    : "<p>Keine Tickets.</p>"
            }

        </div>
        `,
        req
    ));
});

/* =========================
   ADMIN LOGS
========================= */

app.get("/admin/logs", requireAdmin, (req, res) => {
    const logs = readJSON(FILES.logs, []);

    res.send(page(
        "Logs",
        `
        <div class="card">

            <h1>Logs</h1>

            <table>
                <tr>
                    <th>Zeit</th>
                    <th>Typ</th>
                    <th>Nachricht</th>
                </tr>

                ${logs.slice(0, 300).map(log => `
                    <tr>
                        <td>
                            ${new Date(log.date).toLocaleString("de-DE")}
                        </td>

                        <td>
                            <span class="badge">
                                ${escapeHTML(log.type)}
                            </span>
                        </td>

                        <td>
                            ${escapeHTML(log.message)}
                        </td>
                    </tr>
                `).join("")}
            </table>

        </div>
        `,
        req
    ));
});

/* =========================
   ADMIN SETTINGS
========================= */

app.get("/admin/settings", requireAdmin, (req, res) => {
    const s = settings();

    res.send(page(
        "Webseiten-Einstellungen",
        `
        <div class="card form">

            <h1>Webseite</h1>

            <form method="POST" action="/admin/settings">

                <h3>Wartung</h3>

                <label>
                    <input
                        type="checkbox"
                        name="maintenance"
                        ${s.maintenance ? "checked" : ""}
                        style="width:auto"
                    >
                    Wartung aktiv
                </label>

                <textarea
                    name="maintenanceText"
                >${escapeHTML(s.maintenanceText)}</textarea>

                <h3>Störung</h3>

                <label>
                    <input
                        type="checkbox"
                        name="incident"
                        ${s.incident ? "checked" : ""}
                        style="width:auto"
                    >
                    Störung aktiv
                </label>

                <textarea
                    name="incidentText"
                >${escapeHTML(s.incidentText)}</textarea>

                <h3>Ankündigung</h3>

                <input
                    name="announcementTitle"
                    value="${escapeHTML(s.announcementTitle)}"
                    placeholder="Titel"
                >

                <textarea
                    name="announcement"
                    placeholder="Text der Ankündigung"
                >${escapeHTML(s.announcement)}</textarea>

                <button class="button">
                    Speichern
                </button>

            </form>

        </div>
        `,
        req
    ));
});

app.post("/admin/settings", requireAdmin, (req, res) => {
    const s = settings();

    s.maintenance = req.body.maintenance === "on";
    s.maintenanceText =
        String(req.body.maintenanceText || "");

    s.incident = req.body.incident === "on";
    s.incidentText =
        String(req.body.incidentText || "");

    s.announcementTitle =
        String(req.body.announcementTitle || "");

    s.announcement =
        String(req.body.announcement || "");

    saveSettings(s);

    addLog(
        "settings",
        "Webseiten-Einstellungen geändert",
        currentUser(req).id
    );

    res.redirect("/admin/settings");
});

/* =========================
   GIVEAWAYS
========================= */

app.get("/giveaways", requireLogin, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    res.send(page(
        "Gewinnspiele",
        `
        <div class="hero">
            <h1>Gewinnspiele</h1>
            <p>Nimm an Community-Gewinnspielen teil.</p>
        </div>

        <div class="grid">

        ${
            giveaways.length
                ? giveaways.map(g => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(g.title)}
                        </h3>

                        <p>
                            ${escapeHTML(g.description)}
                        </p>

                        <p>
                            Gewinn:
                            <strong>${g.coins} Coins</strong>
                        </p>

                        <p>
                            Teilnehmer:
                            ${(g.participants || []).length}
                        </p>

                        ${
                            (g.participants || []).includes(
                                currentUser(req).id
                            )
                                ? `
                                <span class="badge">
                                    Du nimmst bereits teil
                                </span>
                                `
                                : `
                                <form method="POST"
                                    action="/giveaways/${g.id}/join">

                                    <button class="button">
                                        Teilnehmen
                                    </button>

                                </form>
                                `
                        }

                    </div>
                `).join("")
                : `
                <div class="card">
                    <h3>Keine Gewinnspiele</h3>
                    <p>Momentan ist kein Gewinnspiel aktiv.</p>
                </div>
                `
        }

        </div>
        `,
        req
    ));
});

app.post("/giveaways/:id/join", requireLogin, (req, res) => {
    const user = currentUser(req);
    const giveaways = readJSON(FILES.giveaways, []);

    const giveaway = giveaways.find(
        g => g.id === req.params.id
    );

    if (!giveaway) {
        return res.redirect("/giveaways");
    }

    if (!giveaway.participants) {
        giveaway.participants = [];
    }

    if (!giveaway.participants.includes(user.id)) {
        giveaway.participants.push(user.id);
    }

    writeJSON(FILES.giveaways, giveaways);

    addLog(
        "giveaway_join",
        `${user.name} nimmt an ${giveaway.title} teil`,
        user.id
    );

    res.redirect("/giveaways");
});

app.get("/admin/giveaways", requireAdmin, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    res.send(page(
        "Gewinnspiele verwalten",
        `
        <div class="card form">

            <h1>Gewinnspiel erstellen</h1>

            <form method="POST"
                action="/admin/giveaways/create">

                <label>Titel</label>
                <input name="title" required>

                <label>Beschreibung</label>
                <textarea name="description"></textarea>

                <label>Coins</label>
                <input
                    type="number"
                    name="coins"
                    min="1"
                    required
                >

                <button class="button">
                    Erstellen
                </button>

            </form>

        </div>

        <br>

        <div class="card">

            <h2>Gewinnspiele</h2>

            ${
                giveaways.length
                    ? giveaways.map(g => `
                        <div class="message">
                            <strong>
                                ${escapeHTML(g.title)}
                            </strong>

                            <span>
                                ${g.coins} Coins ·
                                ${(g.participants || []).length}
                                Teilnehmer
                            </span>

                            <form method="POST"
                                action="/admin/giveaways/${g.id}/draw">

                                <button class="button green">
                                    Gewinner ziehen
                                </button>

                            </form>
                        </div>
                    `).join("")
                    : "<p>Noch keine Gewinnspiele.</p>"
            }

        </div>
        `,
        req
    ));
});

app.post("/admin/giveaways/create", requireAdmin, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    giveaways.unshift({
        id: generateId("giveaway_"),
        title: String(req.body.title || "").trim(),
        description: String(req.body.description || "").trim(),
        coins: Math.max(1, Number(req.body.coins || 1)),
        participants: [],
        winner: null,
        active: true,
        createdAt: new Date().toISOString()
    });

    writeJSON(FILES.giveaways, giveaways);

    res.redirect("/admin/giveaways");
});

app.post("/admin/giveaways/:id/draw", requireAdmin, (req, res) => {
    const giveaways = readJSON(FILES.giveaways, []);

    const giveaway = giveaways.find(
        g => g.id === req.params.id
    );

    if (!giveaway) {
        return res.redirect("/admin/giveaways");
    }

    if (!giveaway.participants.length) {
        return res.redirect("/admin/giveaways");
    }

    const winnerId =
        giveaway.participants[
            crypto.randomInt(
                0,
                giveaway.participants.length
            )
        ];

    giveaway.winner = winnerId;
    giveaway.active = false;

    const allUsers = users();
    const index = allUsers.findIndex(
        u => u.id === winnerId
    );

    if (index !== -1) {
        allUsers[index].coins += giveaway.coins;
        saveUsers(allUsers);

        addLog(
            "giveaway_winner",
            `${allUsers[index].name} hat ${giveaway.coins} Coins gewonnen`,
            winnerId
        );
    }

    writeJSON(FILES.giveaways, giveaways);

    res.redirect("/admin/giveaways");
});

/* =========================
   TEAM CHAT
========================= */

app.get("/admin/team-chat", requireStaff, (req, res) => {
    const messages = readJSON(
        path.join(DATA_DIR, "teamchat.json"),
        []
    );

    res.send(page(
        "Team Chat",
        `
        <div class="card">

            <h1>Team Chat</h1>

            ${
                messages.map(m => `
                    <div class="message">
                        <strong>
                            ${escapeHTML(m.name)}
                        </strong>

                        <span>
                            ${escapeHTML(m.message)}
                        </span>

                        <div class="muted">
                            ${new Date(m.date).toLocaleString("de-DE")}
                        </div>
                    </div>
                `).join("")
            }

            <form method="POST"
                action="/admin/team-chat">

                <textarea
                    name="message"
                    maxlength="3000"
                    required
                ></textarea>

                <button class="button">
                    Nachricht senden
                </button>

            </form>

        </div>
        `,
        req
    ));
});

app.post("/admin/team-chat", requireStaff, (req, res) => {
    const user = currentUser(req);

    const file = path.join(DATA_DIR, "teamchat.json");

    const messages = readJSON(file, []);

    messages.unshift({
        id: generateId("team_"),
        userId: user.id,
        name: user.name,
        message: String(req.body.message || "").trim(),
        date: new Date().toISOString()
    });

    writeJSON(file, messages.slice(0, 1000));

    res.redirect("/admin/team-chat");
});

/* =========================
   BETA-NUMMERN
========================= */

app.get("/admin/beta", requireAdmin, (req, res) => {
    const beta = readJSON(FILES.beta, []);

    res.send(page(
        "Beta-Nummern",
        `
        <div class="card">

            <h1>Beta-Nummer erstellen</h1>

            <form method="POST"
                action="/admin/beta/create">

                <button class="button">
                    Neue Beta-Nummer erstellen
                </button>

            </form>

        </div>

        <br>

        <div class="card">

            <h2>Beta-Nummern</h2>

            ${
                beta.map(b => `
                    <div class="message">
                        <strong>
                            ${escapeHTML(b.number)}
                        </strong>

                        <span>
                            ${
                                b.used
                                    ? "Verwendet"
                                    : "Frei"
                            }
                        </span>
                    </div>
                `).join("")
            }

        </div>
        `,
        req
    ));
});

app.post("/admin/beta/create", requireAdmin, (req, res) => {
    const beta = readJSON(FILES.beta, []);

    beta.unshift({
        id: generateId("beta_"),
        number: generateBetaNumber(),
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: currentUser(req).id
    });

    writeJSON(FILES.beta, beta);

    addLog(
        "beta_create",
        "Beta-Nummer erstellt",
        currentUser(req).id
    );

    res.redirect("/admin/beta");
});

/* =========================
   404
========================= */

app.use((req, res) => {
    res.status(404).send(page(
        "Nicht gefunden",
        `
        <div class="card">
            <h1>404</h1>
            <p>Diese Seite wurde nicht gefunden.</p>
            <a class="button" href="/">
                Zur Startseite
            </a>
        </div>
        `,
        req
    ));
});

/* =========================
   SERVER
========================= */

app.listen(PORT, HOST, () => {
    console.log("======================================");
    console.log("North-Bot-2 Webseite");
    console.log("======================================");
    console.log(`Webseite läuft auf Port ${PORT}`);
    console.log(`Start: http://localhost:${PORT}`);
    console.log("======================================");
});
