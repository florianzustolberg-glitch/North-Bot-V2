const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const LOG_FILE = path.join(DATA_DIR, "logs.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(SETTINGS_FILE, {
    maintenance: false,
    maintenanceMessage: "Die Webseite befindet sich momentan im Wartungsmodus."
});
ensureFile(LOG_FILE, []);

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
    return readJSON(USERS_FILE, []);
}

function servers() {
    return readJSON(SERVERS_FILE, []);
}

function orders() {
    return readJSON(ORDERS_FILE, []);
}

function settings() {
    return readJSON(SETTINGS_FILE, {
        maintenance: false,
        maintenanceMessage: ""
    });
}

function logs() {
    return readJSON(LOG_FILE, []);
}

function saveUsers(data) {
    writeJSON(USERS_FILE, data);
}

function saveServers(data) {
    writeJSON(SERVERS_FILE, data);
}

function saveOrders(data) {
    writeJSON(ORDERS_FILE, data);
}

function saveSettings(data) {
    writeJSON(SETTINGS_FILE, data);
}

function saveLogs(data) {
    writeJSON(LOG_FILE, data);
}

function addLog(type, message, user = "System") {
    const data = logs();

    data.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        user,
        timestamp: new Date().toISOString()
    });

    if (data.length > 1000) {
        data.length = 1000;
    }

    saveLogs(data);
}

function orderNumber() {
    const date = new Date();

    const d =
        date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0");

    const random = Math.floor(100000 + Math.random() * 900000);

    return `MC-${d}-${random}`;
}

function serverId() {
    return "srv-" + crypto.randomBytes(5).toString("hex");
}

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const user = users().find(u => u.id === req.session.userId);

    if (!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).send(page(
            "Kein Zugriff",
            `
            <div class="card center">
                <h1>403</h1>
                <p>Du hast keine Berechtigung für das Admin-Panel.</p>
                <a class="button" href="/">Zur Startseite</a>
            </div>
            `
        ));
    }

    next();
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function page(title, content, req = null) {
    const loggedIn = req && req.session && req.session.userId;

    let username = "";

    if (loggedIn) {
        const user = users().find(u => u.id === req.session.userId);
        username = user ? user.username : "";
    }

    const admin =
        loggedIn &&
        users().find(u => u.id === req.session.userId)?.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase();

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHTML(title)} - Minecraft Hosting</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    font-family: Arial, Helvetica, sans-serif;
    background:
        radial-gradient(circle at top, #243b2a 0%, #111 45%, #080808 100%);
    color: #fff;
}

header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10,10,10,.94);
    border-bottom: 1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(15px);
}

.nav {
    max-width: 1200px;
    margin: auto;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
}

.logo {
    color: #7cff8b;
    font-size: 21px;
    font-weight: 800;
    text-decoration: none;
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

nav a {
    color: #ddd;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 9px;
}

nav a:hover {
    background: rgba(255,255,255,.08);
    color: white;
}

.container {
    width: min(1100px, calc(100% - 30px));
    margin: 40px auto;
}

.hero {
    text-align: center;
    padding: 70px 15px;
}

.hero h1 {
    font-size: clamp(35px, 7vw, 70px);
    margin: 0 0 15px;
}

.hero p {
    color: #bbb;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.card {
    background: rgba(20,20,20,.92);
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 15px 50px rgba(0,0,0,.25);
}

.card h2,
.card h3 {
    margin-top: 0;
}

.center {
    text-align: center;
}

.button,
button {
    display: inline-block;
    border: 0;
    background: #42d85b;
    color: #061007;
    padding: 11px 17px;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: .2s;
}

.button:hover,
button:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
}

.button.secondary,
button.secondary {
    background: #292929;
    color: white;
}

.button.danger,
button.danger {
    background: #d94343;
    color: white;
}

.button.warning,
button.warning {
    background: #e2a83b;
    color: #111;
}

input,
select,
textarea {
    width: 100%;
    margin-top: 7px;
    margin-bottom: 15px;
    padding: 13px;
    background: #101010;
    border: 1px solid #333;
    color: white;
    border-radius: 10px;
    outline: none;
}

input:focus,
select:focus,
textarea:focus {
    border-color: #42d85b;
}

label {
    color: #ccc;
    font-size: 14px;
}

.form {
    max-width: 480px;
    margin: 50px auto;
}

.notice {
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    background: #172c1b;
    border: 1px solid #2c6935;
}

.error {
    background: #351818;
    border-color: #813434;
}

.warning-box {
    background: #352c18;
    border-color: #80652d;
}

.success {
    background: #17351c;
    border-color: #3b8246;
}

.price {
    font-size: 35px;
    font-weight: 800;
    color: #7cff8b;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: bold;
}

.status.pending {
    background: #554517;
    color: #ffd85e;
}

.status.accepted,
.status.running {
    background: #173c1c;
    color: #7cff8b;
}

.status.rejected,
.status.stopped {
    background: #401919;
    color: #ff8c8c;
}

.status.maintenance {
    background: #353535;
    color: #ddd;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 15px;
}

pre.console {
    background: #050505;
    border: 1px solid #252525;
    padding: 15px;
    border-radius: 12px;
    color: #b8ffbf;
    overflow: auto;
    max-height: 350px;
    white-space: pre-wrap;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid #292929;
}

small,
.muted {
    color: #999;
}

footer {
    text-align: center;
    color: #777;
    padding: 40px 20px;
}

@media(max-width:700px) {
    .nav {
        flex-direction: column;
        align-items: stretch;
    }

    nav {
        justify-content: center;
    }

    .container {
        width: min(100% - 20px, 1100px);
        margin-top: 20px;
    }

    .hero {
        padding: 45px 10px;
    }

    th,
    td {
        font-size: 13px;
        padding: 8px;
    }
}
</style>
</head>

<body>

<header>
<div class="nav">

<a class="logo" href="/">⛏ Minecraft Hosting</a>

<nav>
<a href="/">Home</a>

${
    loggedIn
        ? `
        <a href="/dashboard">Dashboard</a>
        <a href="/order">Server bestellen</a>
        ${admin ? `<a href="/admin">Admin</a>` : ""}
        <a href="/logout">Logout</a>
        `
        : `
        <a href="/login">Anmelden</a>
        <a href="/register">Registrieren</a>
        `
}

</nav>

</div>
</header>

<main class="container">

${content}

</main>

<footer>
Minecraft Hosting © ${new Date().getFullYear()}
</footer>

</body>
</html>
`;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET || "change-this-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
    const s = settings();

    if (s.maintenance) {
        return res.send(
            page(
                "Wartung",
                `
                <div class="hero">
                    <h1>🔧 Wartung</h1>
                    <p>${escapeHTML(s.maintenanceMessage)}</p>
                </div>
                `,
                req
            )
        );
    }

    res.send(
        page(
            "Minecraft Hosting",
            `
            <section class="hero">
                <h1>⛏ Minecraft Hosting</h1>
                <p>Dein Minecraft-Server. Einfach verwalten.</p>

                <div class="actions" style="justify-content:center">
                    ${
                        req.session.userId
                            ? `<a class="button" href="/dashboard">Zum Dashboard</a>`
                            : `<a class="button" href="/register">Jetzt registrieren</a>`
                    }

                    <a class="button secondary" href="/order">
                        Server bestellen
                    </a>
                </div>
            </section>

            <div class="grid">

                <div class="card">
                    <h2>🟢 1 Server kostenlos</h2>
                    <p>Jeder Benutzer kann einen kostenlosen Minecraft-Server erhalten.</p>
                </div>

                <div class="card">
                    <h2>💶 Weitere Server</h2>
                    <p>Jeder weitere Server kostet 5 €.</p>
                </div>

                <div class="card">
                    <h2>🛠 Einfache Verwaltung</h2>
                    <p>Server starten, stoppen und Logs ansehen.</p>
                </div>

                <div class="card">
                    <h2>🔐 Admin-Prüfung</h2>
                    <p>Jede Bestellung muss vom Admin bestätigt werden.</p>
                </div>

            </div>
            `,
            req
        )
    );
});

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

app.get("/register", (req, res) => {
    res.send(
        page(
            "Registrieren",
            `
            <div class="card form">

                <h2>Registrieren</h2>

                <form method="POST" action="/register">

                    <label>Benutzername</label>
                    <input
                        name="username"
                        required
                        minlength="3"
                        maxlength="30"
                    >

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
                        minlength="6"
                    >

                    <button type="submit">
                        Account erstellen
                    </button>

                </form>

                <p>
                    Bereits registriert?
                    <a href="/login">Anmelden</a>
                </p>

            </div>
            `
        )
    );
});

app.post("/register", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Bitte alle Felder ausfüllen.
                </div>
                `
            )
        );
    }

    if (password.length < 6) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Das Passwort muss mindestens 6 Zeichen haben.
                </div>
                `
            )
        );
    }

    const data = users();

    if (data.some(u => u.email.toLowerCase() === email)) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Diese E-Mail-Adresse ist bereits registriert.
                </div>
                `
            )
        );
    }

    if (data.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Dieser Benutzername ist bereits vergeben.
                </div>
                `
            )
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash,
        createdAt: new Date().toISOString()
    };

    data.push(user);
    saveUsers(data);

    addLog(
        "REGISTER",
        `Neuer Benutzer registriert: ${username}`,
        username
    );

    res.redirect("/login?registered=1");
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.get("/login", (req, res) => {
    const registered =
        req.query.registered === "1"
            ? `
            <div class="notice success">
                Registrierung erfolgreich. Du kannst dich jetzt anmelden.
            </div>
            `
            : "";

    res.send(
        page(
            "Anmelden",
            `
            <div class="card form">

                ${registered}

                <h2>Anmelden</h2>

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

                    <button type="submit">
                        Anmelden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = users().find(
        u => u.email.toLowerCase() === email
    );

    if (!user) {
        return res.status(401).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    E-Mail oder Passwort ist falsch.
                    <br><br>
                    <a class="button" href="/login">Zurück</a>
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
            page(
                "Fehler",
                `
                <div class="card error">
                    E-Mail oder Passwort ist falsch.
                    <br><br>
                    <a class="button" href="/login">Zurück</a>
                </div>
                `
            )
        );
    }

    req.session.userId = user.id;

    addLog(
        "LOGIN",
        `Benutzer angemeldet: ${user.username}`,
        user.username
    );

    res.redirect("/dashboard");
});

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

app.get("/dashboard", requireLogin, (req, res) => {
    const user = users().find(u => u.id === req.session.userId);

    const myServers = servers().filter(
        s => s.ownerId === user.id
    );

    const myOrders = orders()
        .filter(o => o.userId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.send(
        page(
            "Dashboard",
            `
            <h1>👋 Willkommen, ${escapeHTML(user.username)}</h1>

            <div class="grid">

                <div class="card">
                    <h3>Deine Server</h3>
                    <div class="price">${myServers.length}</div>
                </div>

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="price">${myOrders.length}</div>
                </div>

            </div>

            <br>

            <div class="card">

                <h2>🖥 Deine Minecraft-Server</h2>

                ${
                    myServers.length === 0
                        ? `
                        <p class="muted">
                            Du hast noch keinen Server.
                        </p>

                        <a class="button" href="/order">
                            Server bestellen
                        </a>
                        `
                        : myServers
                              .map(
                                  s => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(s.name)}
                                </h3>

                                <p>
                                    IP:
                                    <strong>
                                        ${escapeHTML(s.ip || "Noch nicht festgelegt")}
                                    </strong>
                                </p>

                                <p>
                                    Status:
                                    <span class="status ${escapeHTML(s.status)}">
                                        ${escapeHTML(s.status)}
                                    </span>
                                </p>

                                <div class="actions">

                                    <a
                                        class="button"
                                        href="/server/${encodeURIComponent(s.id)}"
                                    >
                                        Verwalten
                                    </a>

                                </div>

                            </div>
                            `
                              )
                              .join("")
                }

            </div>

            <br>

            <div class="card">

                <h2>📦 Deine Bestellungen</h2>

                ${
                    myOrders.length === 0
                        ? `<p class="muted">Keine Bestellungen.</p>`
                        : `
                        <table>
                            <tr>
                                <th>Bestellnummer</th>
                                <th>Server</th>
                                <th>Preis</th>
                                <th>Status</th>
                            </tr>

                            ${myOrders
                                .map(
                                    o => `
                                <tr>
                                    <td>${escapeHTML(o.orderNumber)}</td>
                                    <td>${escapeHTML(o.serverName)}</td>
                                    <td>${o.price.toFixed(2)} €</td>
                                    <td>
                                        <span class="status ${escapeHTML(o.status)}">
                                            ${escapeHTML(o.status)}
                                        </span>
                                    </td>
                                </tr>
                                `
                                )
                                .join("")}

                        </table>
                        `
                }

            </div>
            `,
            req
        )
    );
});

// --------------------------------------------------
// ORDER
// --------------------------------------------------

app.get("/order", requireLogin, (req, res) => {
    const user = users().find(u => u.id === req.session.userId);

    const myServers = servers().filter(
        s => s.ownerId === user.id
    );

    const price = myServers.length === 0 ? 0 : 5;

    res.send(
        page(
            "Server bestellen",
            `
            <div class="card form">

                <h2>⛏ Minecraft-Server bestellen</h2>

                <div class="notice">
                    ${
                        price === 0
                            ? "🎉 Dein erster Server ist kostenlos."
                            : "💶 Dieser zusätzliche Server kostet 5 €."
                    }
                </div>

                <form method="POST" action="/order">

                    <label>Servername</label>

                    <input
                        name="serverName"
                        required
                        maxlength="40"
                        placeholder="Mein Minecraft Server"
                    >

                    <label>Minecraft-Version</label>

                    <select name="version">

                        <option value="1.21.8">
                            1.21.8
                        </option>

                        <option value="1.21.5">
                            1.21.5
                        </option>

                        <option value="1.21.4">
                            1.21.4
                        </option>

                        <option value="1.20.6">
                            1.20.6
                        </option>

                    </select>

                    <label>Gewünschte Server-IP</label>

                    <input
                        name="ip"
                        maxlength="50"
                        placeholder="z.B. meinserver.example.de"
                    >

                    <p>
                        Preis:
                        <strong>${price.toFixed(2)} €</strong>
                    </p>

                    <button type="submit">
                        Bestellung absenden
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/order", requireLogin, (req, res) => {
    const user = users().find(u => u.id === req.session.userId);

    const serverName = String(
        req.body.serverName || ""
    ).trim();

    const version = String(
        req.body.version || "1.21.8"
    ).trim();

    const ip = String(
        req.body.ip || ""
    ).trim();

    if (!serverName) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Bitte einen Servernamen angeben.
                </div>
                `,
                req
            )
        );
    }

    const userServers = servers().filter(
        s => s.ownerId === user.id
    );

    const price = userServers.length === 0 ? 0 : 5;

    const order = {
        id: crypto.randomUUID(),
        orderNumber: orderNumber(),
        userId: user.id,
        username: user.username,
        email: user.email,
        serverName,
        version,
        ip,
        price,
        status: "pending",
        createdAt: new Date().toISOString(),
        reviewedAt: null
    };

    const data = orders();

    data.push(order);

    saveOrders(data);

    addLog(
        "ORDER",
        `Neue Bestellung ${order.orderNumber}: ${serverName}`,
        user.username
    );

    res.send(
        page(
            "Bestellung",
            `
            <div class="card center">

                <h1>✅ Bestellung erstellt</h1>

                <p>
                    Deine Bestellung wurde erfolgreich erstellt.
                </p>

                <div class="notice">
                    <strong>Bestellnummer:</strong><br>
                    ${escapeHTML(order.orderNumber)}
                </div>

                <p>
                    Deine Bestellung muss zuerst vom Admin
                    angenommen werden.
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

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.get("/server/:id", requireLogin, (req, res) => {
    const server = servers().find(
        s => s.id === req.params.id
    );

    const user = users().find(
        u => u.id === req.session.userId
    );

    if (!server || server.ownerId !== user.id) {
        return res.status(404).send(
            page(
                "Nicht gefunden",
                `
                <div class="card center">
                    Server nicht gefunden.
                </div>
                `,
                req
            )
        );
    }

    res.send(
        page(
            server.name,
            `
            <div class="card">

                <h1>⛏ ${escapeHTML(server.name)}</h1>

                <p>
                    <strong>IP:</strong>
                    ${escapeHTML(server.ip || "Noch keine IP")}
                </p>

                <p>
                    <strong>Version:</strong>
                    ${escapeHTML(server.version)}
                </p>

                <p>
                    <strong>Status:</strong>
                    <span class="status ${escapeHTML(server.status)}">
                        ${escapeHTML(server.status)}
                    </span>
                </p>

                <div class="actions">

                    <form
                        method="POST"
                        action="/server/${encodeURIComponent(server.id)}/start"
                    >
                        <button type="submit">
                            ▶ Starten
                        </button>
                    </form>

                    <form
                        method="POST"
                        action="/server/${encodeURIComponent(server.id)}/stop"
                    >
                        <button
                            class="secondary"
                            type="submit"
                        >
                            ⏹ Stoppen
                        </button>
                    </form>

                </div>

            </div>

            <br>

            <div class="card">

                <h2>📜 Server-Konsole</h2>

                <pre class="console">${escapeHTML(
                    server.console || "Noch keine Logs."
                )}</pre>

            </div>

            <br>

            <div class="card">

                <h2>⚙ Einstellungen</h2>

                <form
                    method="POST"
                    action="/server/${encodeURIComponent(server.id)}/ip"
                >

                    <label>Server-IP</label>

                    <input
                        name="ip"
                        value="${escapeHTML(server.ip || "")}"
                        maxlength="80"
                    >

                    <button type="submit">
                        IP speichern
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

function appendServerConsole(server, text) {
    const line =
        `[${new Date().toISOString()}] ${text}`;

    server.console =
        (server.console || "") +
        line +
        "\n";

    if (server.console.length > 30000) {
        server.console =
            server.console.slice(-30000);
    }
}

app.post(
    "/server/:id/start",
    requireLogin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        if (server.ownerId !== req.session.userId) {
            return res.status(403).send("Kein Zugriff");
        }

        server.status = "running";

        appendServerConsole(
            server,
            "Server wurde gestartet."
        );

        saveServers(data);

        addLog(
            "SERVER_START",
            `Server gestartet: ${server.name}`
        );

        res.redirect(
            `/server/${encodeURIComponent(server.id)}`
        );
    }
);

app.post(
    "/server/:id/stop",
    requireLogin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        if (server.ownerId !== req.session.userId) {
            return res.status(403).send("Kein Zugriff");
        }

        server.status = "stopped";

        appendServerConsole(
            server,
            "Server wurde gestoppt."
        );

        saveServers(data);

        addLog(
            "SERVER_STOP",
            `Server gestoppt: ${server.name}`
        );

        res.redirect(
            `/server/${encodeURIComponent(server.id)}`
        );
    }
);

app.post(
    "/server/:id/ip",
    requireLogin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        if (server.ownerId !== req.session.userId) {
            return res.status(403).send("Kein Zugriff");
        }

        server.ip = String(
            req.body.ip || ""
        ).trim();

        appendServerConsole(
            server,
            `IP geändert auf ${server.ip || "keine IP"}`
        );

        saveServers(data);

        res.redirect(
            `/server/${encodeURIComponent(server.id)}`
        );
    }
);

// --------------------------------------------------
// ADMIN
// --------------------------------------------------

app.get("/admin", requireAdmin, (req, res) => {
    const allOrders = orders().sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );

    const allServers = servers();

    const pending = allOrders.filter(
        o => o.status === "pending"
    );

    const s = settings();

    res.send(
        page(
            "Admin Panel",
            `
            <h1>🛠 Admin Panel</h1>

            <div class="grid">

                <div class="card">
                    <h3>Bestellungen</h3>
                    <div class="price">
                        ${allOrders.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Offene Bestellungen</h3>
                    <div class="price">
                        ${pending.length}
                    </div>
                </div>

                <div class="card">
                    <h3>Server</h3>
                    <div class="price">
                        ${allServers.length}
                    </div>
                </div>

            </div>

            <br>

            <div class="card">

                <h2>📦 Bestellungen</h2>

                ${
                    allOrders.length === 0
                        ? `<p>Keine Bestellungen.</p>`
                        : allOrders
                              .map(
                                  o => `
                        <div class="card">

                            <h3>
                                ${escapeHTML(o.serverName)}
                            </h3>

                            <p>
                                Bestellung:
                                <strong>
                                    ${escapeHTML(o.orderNumber)}
                                </strong>
                            </p>

                            <p>
                                Kunde:
                                ${escapeHTML(o.username)}
                                (${escapeHTML(o.email)})
                            </p>

                            <p>
                                Version:
                                ${escapeHTML(o.version)}
                            </p>

                            <p>
                                Preis:
                                ${o.price.toFixed(2)} €
                            </p>

                            <p>
                                Status:
                                <span class="status ${escapeHTML(o.status)}">
                                    ${escapeHTML(o.status)}
                                </span>
                            </p>

                            ${
                                o.status === "pending"
                                    ? `
                                    <div class="actions">

                                        <form
                                            method="POST"
                                            action="/admin/order/${encodeURIComponent(o.id)}/accept"
                                        >
                                            <button type="submit">
                                                ✅ Bestellung annehmen
                                            </button>
                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/order/${encodeURIComponent(o.id)}/reject"
                                        >
                                            <button
                                                class="danger"
                                                type="submit"
                                            >
                                                ❌ Bestellung ablehnen
                                            </button>
                                        </form>

                                    </div>
                                    `
                                    : ""
                            }

                        </div>
                        `
                              )
                              .join("")
                }

            </div>

            <br>

            <div class="card">

                <h2>🖥 Alle Server</h2>

                ${
                    allServers.length === 0
                        ? `<p>Keine Server vorhanden.</p>`
                        : `
                        <table>

                            <tr>
                                <th>Server</th>
                                <th>Besitzer</th>
                                <th>IP</th>
                                <th>Status</th>
                                <th>Aktionen</th>
                            </tr>

                            ${allServers
                                .map(
                                    s => `
                                <tr>

                                    <td>
                                        ${escapeHTML(s.name)}
                                    </td>

                                    <td>
                                        ${escapeHTML(s.username)}
                                    </td>

                                    <td>
                                        ${escapeHTML(s.ip || "-")}
                                    </td>

                                    <td>
                                        ${escapeHTML(s.status)}
                                    </td>

                                    <td>

                                        <div class="actions">

                                            <form
                                                method="POST"
                                                action="/admin/server/${encodeURIComponent(s.id)}/start"
                                            >
                                                <button>
                                                    Start
                                                </button>
                                            </form>

                                            <form
                                                method="POST"
                                                action="/admin/server/${encodeURIComponent(s.id)}/stop"
                                            >
                                                <button class="secondary">
                                                    Stop
                                                </button>
                                            </form>

                                            <form
                                                method="POST"
                                                action="/admin/server/${encodeURIComponent(s.id)}/delete"
                                                onsubmit="return confirm('Server wirklich löschen?')"
                                            >
                                                <button class="danger">
                                                    Löschen
                                                </button>
                                            </form>

                                        </div>

                                    </td>

                                </tr>
                                `
                                )
                                .join("")}

                        </table>
                        `
                }

            </div>

            <br>

            <div class="card">

                <h2>🔧 Wartungsmodus</h2>

                <p>
                    Aktueller Status:
                    ${
                        s.maintenance
                            ? `<span class="status maintenance">AKTIV</span>`
                            : `<span class="status running">AUS</span>`
                    }
                </p>

                <form method="POST" action="/admin/maintenance">

                    <label>Nachricht</label>

                    <textarea
                        name="message"
                        rows="4"
                    >${escapeHTML(s.maintenanceMessage)}</textarea>

                    <div class="actions">

                        <button
                            name="action"
                            value="on"
                            type="submit"
                        >
                            Wartung aktivieren
                        </button>

                        <button
                            name="action"
                            value="off"
                            class="secondary"
                            type="submit"
                        >
                            Wartung deaktivieren
                        </button>

                    </div>

                </form>

            </div>

            <br>

            <div class="card">

                <h2>📜 Logs</h2>

                <pre class="console">${escapeHTML(
                    logs()
                        .slice(0, 200)
                        .map(
                            l =>
                                `[${l.timestamp}] [${l.type}] ${l.user}: ${l.message}`
                        )
                        .join("\n")
                )}</pre>

            </div>
            `,
            req
        )
    );
});

// --------------------------------------------------
// ADMIN ORDER ACCEPT
// --------------------------------------------------

app.post(
    "/admin/order/:id/accept",
    requireAdmin,
    (req, res) => {
        const orderData = orders();

        const order = orderData.find(
            o => o.id === req.params.id
        );

        if (!order) {
            return res.status(404).send("Bestellung nicht gefunden");
        }

        if (order.status !== "pending") {
            return res.redirect("/admin");
        }

        order.status = "accepted";
        order.reviewedAt = new Date().toISOString();

        saveOrders(orderData);

        const serverData = servers();

        const server = {
            id: serverId(),
            ownerId: order.userId,
            username: order.username,
            email: order.email,
            name: order.serverName,
            version: order.version,
            ip: order.ip || `${order.serverName.toLowerCase().replace(/[^a-z0-9]/g, "")}.minecraft.local`,
            status: "stopped",
            console: "",
            createdAt: new Date().toISOString(),
            orderNumber: order.orderNumber
        };

        appendServerConsole(
            server,
            `Server wurde durch Admin freigegeben. Bestellung: ${order.orderNumber}`
        );

        serverData.push(server);

        saveServers(serverData);

        addLog(
            "ORDER_ACCEPTED",
            `Bestellung ${order.orderNumber} angenommen.`
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// ADMIN ORDER REJECT
// --------------------------------------------------

app.post(
    "/admin/order/:id/reject",
    requireAdmin,
    (req, res) => {
        const data = orders();

        const order = data.find(
            o => o.id === req.params.id
        );

        if (!order) {
            return res.status(404).send("Bestellung nicht gefunden");
        }

        order.status = "rejected";
        order.reviewedAt = new Date().toISOString();

        saveOrders(data);

        addLog(
            "ORDER_REJECTED",
            `Bestellung ${order.orderNumber} abgelehnt.`
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// ADMIN SERVER START
// --------------------------------------------------

app.post(
    "/admin/server/:id/start",
    requireAdmin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        server.status = "running";

        appendServerConsole(
            server,
            "Server durch Admin gestartet."
        );

        saveServers(data);

        addLog(
            "ADMIN_SERVER_START",
            `Admin startete ${server.name}`
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// ADMIN SERVER STOP
// --------------------------------------------------

app.post(
    "/admin/server/:id/stop",
    requireAdmin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        server.status = "stopped";

        appendServerConsole(
            server,
            "Server durch Admin gestoppt."
        );

        saveServers(data);

        addLog(
            "ADMIN_SERVER_STOP",
            `Admin stoppte ${server.name}`
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// ADMIN SERVER DELETE
// --------------------------------------------------

app.post(
    "/admin/server/:id/delete",
    requireAdmin,
    (req, res) => {
        const data = servers();

        const server = data.find(
            s => s.id === req.params.id
        );

        if (!server) {
            return res.status(404).send("Server nicht gefunden");
        }

        const remaining = data.filter(
            s => s.id !== server.id
        );

        saveServers(remaining);

        addLog(
            "SERVER_DELETE",
            `Admin löschte ${server.name}`
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// MAINTENANCE
// --------------------------------------------------

app.post(
    "/admin/maintenance",
    requireAdmin,
    (req, res) => {
        const s = settings();

        s.maintenance =
            req.body.action === "on";

        s.maintenanceMessage =
            String(
                req.body.message ||
                "Die Webseite befindet sich momentan im Wartungsmodus."
            ).trim();

        saveSettings(s);

        addLog(
            "MAINTENANCE",
            s.maintenance
                ? "Wartungsmodus aktiviert."
                : "Wartungsmodus deaktiviert."
        );

        res.redirect("/admin");
    }
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
    res.status(404).send(
        page(
            "404",
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
            `,
            req
        )
    );
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).send(
        page(
            "Fehler",
            `
            <div class="card error">

                <h2>❌ Serverfehler</h2>

                <p>
                    Es ist ein interner Fehler aufgetreten.
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

// --------------------------------------------------
// START
// --------------------------------------------------

app.listen(PORT, () => {
    console.log("====================================");
    console.log(" Minecraft Hosting Webseite");
    console.log("====================================");
    console.log(`Webseite läuft auf Port ${PORT}`);
    console.log(`Admin: ${ADMIN_EMAIL}`);
    console.log("====================================");

    addLog(
        "SYSTEM",
        `Webseite gestartet auf Port ${PORT}`
    );
});
