'use strict';

/*
===========================================================
 FLORIAN / WEISSERHAI
 MINECRAFT HOSTING WEBSEITE
===========================================================

Node.js:
  empfohlen: Node.js 20+

Installation:
  npm install express express-session bcryptjs nodemailer

Start:
  node webseite.js

ENV:
  PORT=3000

  SESSION_SECRET=BITTE_EIN_LANGES_ZUFAELLIGES_PASSWORT

  GMAIL_USER=deine@gmail.com
  GMAIL_APP_PASSWORD=DEIN_GOOGLE_APP_PASSWORT

  OWNER_EMAIL=florianzustolberg@gmail.com

===========================================================
*/

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

const OWNER_EMAIL = String(
    process.env.OWNER_EMAIL || 'florianzustolberg@gmail.com'
).toLowerCase();

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    'CHANGE_THIS_SESSION_SECRET_123456789';

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, fallback) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(fallback, null, 2),
            'utf8'
        );
    }
}

ensureFile(USERS_FILE, []);
ensureFile(SERVERS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(CODES_FILE, []);
ensureFile(APPLICATIONS_FILE, []);

function readJSON(file, fallback = []) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        const raw = fs.readFileSync(file, 'utf8');

        if (!raw.trim()) {
            return fallback;
        }

        const data = JSON.parse(raw);

        return data;
    } catch (error) {
        console.error('JSON Fehler:', file, error.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    const tempFile = file + '.tmp';

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        'utf8'
    );

    fs.renameSync(tempFile, file);
}

function id(prefix = 'id') {
    return (
        prefix +
        '_' +
        Date.now().toString(36) +
        '_' +
        crypto.randomBytes(5).toString('hex')
    );
}

function randomToken() {
    return crypto.randomBytes(32).toString('hex');
}

function now() {
    return new Date().toISOString();
}

function cleanEmail(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function safeServerName(name) {
    return String(name || '')
        .trim()
        .replace(/[^\wäöüÄÖÜß ._-]/g, '')
        .slice(0, 40);
}

function getUsers() {
    return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
    writeJSON(USERS_FILE, users);
}

function getServers() {
    return readJSON(SERVERS_FILE, []);
}

function saveServers(servers) {
    writeJSON(SERVERS_FILE, servers);
}

function getOrders() {
    return readJSON(ORDERS_FILE, []);
}

function saveOrders(orders) {
    writeJSON(ORDERS_FILE, orders);
}

function getCodes() {
    return readJSON(CODES_FILE, []);
}

function saveCodes(codes) {
    writeJSON(CODES_FILE, codes);
}

function getApplications() {
    return readJSON(APPLICATIONS_FILE, []);
}

function saveApplications(applications) {
    writeJSON(APPLICATIONS_FILE, applications);
}

function findUserByEmail(email) {
    email = cleanEmail(email);

    return getUsers().find(
        user => cleanEmail(user.email) === email
    );
}

function findUserById(userId) {
    return getUsers().find(
        user => user.id === userId
    );
}

function isOwner(user) {
    return !!user &&
        cleanEmail(user.email) === OWNER_EMAIL;
}

function currentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return findUserById(req.session.userId) || null;
}

function requireLogin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (user.banned) {
        req.session.destroy(() => {});
        return res.status(403).send(page(
            'Gesperrt',
            `
            <div class="box">
                <h1>🚫 Konto gesperrt</h1>
                <p>Dieses Konto wurde gesperrt.</p>
            </div>
            `
        ));
    }

    next();
}

function requireOwner(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (!isOwner(user)) {
        return res.status(403).send(page(
            'Kein Zugriff',
            `
            <div class="box">
                <h1>🚫 Kein Zugriff</h1>
                <p>Dieser Bereich ist nur für den Owner verfügbar.</p>
            </div>
            `
        ));
    }

    next();
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.urlencoded({
    extended: true,
    limit: '2mb'
}));

app.use(express.json({
    limit: '2mb'
}));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

/* =========================================================
   GMAIL
========================================================= */

let mailer = null;

if (
    process.env.GMAIL_USER &&
    process.env.GMAIL_APP_PASSWORD
) {
    mailer = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

async function sendMail(to, subject, html) {
    if (!mailer) {
        console.warn(
            'Gmail ist nicht eingerichtet. E-Mail wurde nicht verschickt.'
        );

        return false;
    }

    try {
        await mailer.sendMail({
            from: `"Minecraft Hosting" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html
        });

        return true;
    } catch (error) {
        console.error(
            'Gmail Fehler:',
            error.message
        );

        return false;
    }
}

/* =========================================================
   HTML
========================================================= */

function page(title, body, user = null) {
    const owner = isOwner(user);

    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} - Minecraft Hosting</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0b0f14;
    color: #f5f5f5;
}

a {
    color: inherit;
    text-decoration: none;
}

nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #111821;
    border-bottom: 1px solid #26303c;
    padding: 15px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}

.logo {
    font-size: 21px;
    font-weight: 800;
}

.navlinks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.navlinks a {
    padding: 9px 12px;
    border-radius: 8px;
    background: #19222d;
}

.navlinks a:hover {
    background: #243142;
}

main {
    width: min(1200px, 94%);
    margin: 35px auto;
}

.hero {
    padding: 45px;
    border-radius: 18px;
    background:
        linear-gradient(135deg,#162331,#0e141c);
    border: 1px solid #273444;
    margin-bottom: 25px;
}

.hero h1 {
    font-size: 42px;
    margin-top: 0;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit,minmax(250px,1fr));
    gap: 18px;
}

.card,
.box {
    background: #111821;
    border: 1px solid #26303c;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 18px;
}

.card h2,
.box h2 {
    margin-top: 0;
}

input,
select,
textarea {
    width: 100%;
    padding: 12px;
    margin: 7px 0 14px;
    border-radius: 8px;
    border: 1px solid #344252;
    background: #0b1118;
    color: white;
}

textarea {
    min-height: 130px;
    resize: vertical;
}

button,
.btn {
    display: inline-block;
    border: 0;
    border-radius: 8px;
    padding: 11px 15px;
    background: #2d7cff;
    color: white;
    cursor: pointer;
    font-weight: 700;
}

button:hover,
.btn:hover {
    filter: brightness(1.12);
}

.btn-red {
    background: #d94343;
}

.btn-green {
    background: #24a15c;
}

.btn-gray {
    background: #384554;
}

.status {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 13px;
    background: #273444;
}

.online {
    background: #1f7044;
}

.offline {
    background: #613334;
}

.warning {
    padding: 14px;
    border-radius: 10px;
    background: #4c3b18;
    border: 1px solid #8d702d;
    margin-bottom: 15px;
}

.success {
    padding: 14px;
    border-radius: 10px;
    background: #153e29;
    border: 1px solid #28784d;
    margin-bottom: 15px;
}

.error {
    padding: 14px;
    border-radius: 10px;
    background: #4c2020;
    border: 1px solid #8d3939;
    margin-bottom: 15px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 11px;
    border-bottom: 1px solid #29333f;
    text-align: left;
    vertical-align: top;
}

.small {
    color: #aeb8c4;
    font-size: 14px;
}

.coins {
    font-weight: 800;
    color: #ffd45c;
}

footer {
    text-align: center;
    padding: 35px;
    color: #7e8996;
}
</style>
</head>

<body>

<nav>
    <div class="logo">⛏️ Minecraft Hosting</div>

    <div class="navlinks">
        <a href="/">Home</a>

        ${
            user
            ? `
                <a href="/dashboard">Dashboard</a>
                <a href="/servers">Server</a>
                <a href="/orders">Bestellungen</a>
                <a href="/applications">Bewerbungen</a>
                ${
                    owner
                    ? `<a href="/admin">Admin</a>`
                    : ''
                }
                <a href="/logout">Logout</a>
            `
            : `
                <a href="/login">Login</a>
                <a href="/register">Registrieren</a>
            `
        }
    </div>
</nav>

<main>
${body}
</main>

<footer>
Minecraft Hosting • Florian / WeisserHai
</footer>

</body>
</html>
`;
}

/* =========================================================
   HOME
========================================================= */

app.get('/', (req, res) => {
    const user = currentUser(req);

    res.send(page(
        'Minecraft Hosting',
        `
        <section class="hero">
            <h1>⛏️ Minecraft Hosting</h1>
            <p>
                Verwalte deine Minecraft-Server einfach über
                ein modernes Webinterface.
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
                    Jetzt registrieren
                </a>
                `
            }
        </section>

        <div class="grid">
            <div class="card">
                <h2>🖥️ Server</h2>
                <p>Erstelle und verwalte deine Minecraft-Server.</p>
            </div>

            <div class="card">
                <h2>🔐 Sicherer Login</h2>
                <p>Passwörter werden gehasht gespeichert.</p>
            </div>

            <div class="card">
                <h2>📧 Passwort vergessen</h2>
                <p>Passwort per Gmail zurücksetzen.</p>
            </div>

            <div class="card">
                <h2>💰 Coins</h2>
                <p>Coins verwalten und Codes einlösen.</p>
            </div>
        </div>
        `,
        user
    ));
});

/* =========================================================
   REGISTER
========================================================= */

app.get('/register', (req, res) => {
    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(page(
        'Registrieren',
        `
        <div class="box">
            <h1>📝 Registrieren</h1>

            <form method="POST" action="/register">
                <label>Name</label>
                <input
                    name="name"
                    required
                    maxlength="40"
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
                    minlength="8"
                >

                <button type="submit">
                    Konto erstellen
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

app.post('/register', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 8) {
        return res.status(400).send(page(
            'Fehler',
            `
            <div class="error">
                Bitte Name, gültige E-Mail und ein Passwort
                mit mindestens 8 Zeichen eingeben.
            </div>
            <a class="btn" href="/register">Zurück</a>
            `
        ));
    }

    if (findUserByEmail(email)) {
        return res.status(409).send(page(
            'Fehler',
            `
            <div class="error">
                Diese E-Mail ist bereits registriert.
            </div>
            <a class="btn" href="/login">Zum Login</a>
            `
        ));
    }

    const users = getUsers();

    const passwordHash = await bcrypt.hash(
        password,
        12
    );

    const user = {
        id: id('user'),
        name,
        email,
        passwordHash,
        coins: 0,
        banned: false,
        createdAt: now()
    };

    users.push(user);

    saveUsers(users);

    req.session.userId = user.id;

    res.redirect('/dashboard');
});

/* =========================================================
   LOGIN
========================================================= */

app.get('/login', (req, res) => {
    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(page(
        'Login',
        `
        <div class="box">
            <h1>🔐 Login</h1>

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
                    Einloggen
                </button>
            </form>

            <p>
                <a href="/forgot-password">
                    Passwort vergessen?
                </a>
            </p>

            <p>
                Noch kein Konto?
                <a href="/register">Registrieren</a>
            </p>
        </div>
        `
    ));
});

app.post('/login', async (req, res) => {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');

    const user = findUserByEmail(email);

    if (!user) {
        return res.status(401).send(page(
            'Login fehlgeschlagen',
            `
            <div class="error">
                E-Mail oder Passwort ist falsch.
            </div>
            <a class="btn" href="/login">Zurück</a>
            `
        ));
    }

    if (user.banned) {
        return res.status(403).send(page(
            'Gesperrt',
            `
            <div class="error">
                Dieses Konto wurde gesperrt.
            </div>
            `
        ));
    }

    const valid = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!valid) {
        return res.status(401).send(page(
            'Login fehlgeschlagen',
            `
            <div class="error">
                E-Mail oder Passwort ist falsch.
            </div>
            <a class="btn" href="/login">Zurück</a>
            `
        ));
    }

    req.session.userId = user.id;

    res.redirect('/dashboard');
});

/* =========================================================
   LOGOUT
========================================================= */

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

/* =========================================================
   FORGOT PASSWORD
========================================================= */

app.get('/forgot-password', (req, res) => {
    res.send(page(
        'Passwort vergessen',
        `
        <div class="box">
            <h1>📧 Passwort vergessen</h1>

            <p>
                Gib deine registrierte E-Mail-Adresse ein.
                Wenn sie existiert, bekommst du einen Reset-Link.
            </p>

            <form method="POST" action="/forgot-password">
                <label>E-Mail</label>

                <input
                    type="email"
                    name="email"
                    required
                >

                <button type="submit">
                    Reset-Link senden
                </button>
            </form>
        </div>
        `
    ));
});

app.post('/forgot-password', async (req, res) => {
    const email = cleanEmail(req.body.email);
    const user = findUserByEmail(email);

    /*
       Absichtlich gleiche Antwort,
       damit niemand herausfinden kann,
       welche E-Mails registriert sind.
    */

    if (user) {
        const token = randomToken();

        const users = getUsers();

        const index = users.findIndex(
            u => u.id === user.id
        );

        users[index].resetToken = token;

        users[index].resetExpires =
            Date.now() + 1000 * 60 * 30;

        saveUsers(users);

        const baseURL =
            process.env.BASE_URL ||
            `http://localhost:${PORT}`;

        const resetURL =
            `${baseURL}/reset-password/${token}`;

        await sendMail(
            user.email,
            'Passwort zurücksetzen',
            `
            <h2>Passwort zurücksetzen</h2>

            <p>
                Hallo ${escapeHTML(user.name)},
            </p>

            <p>
                Du hast einen Passwort-Reset angefordert.
            </p>

            <p>
                <a href="${resetURL}">
                    Passwort zurücksetzen
                </a>
            </p>

            <p>
                Der Link ist 30 Minuten gültig.
            </p>
            `
        );
    }

    res.send(page(
        'E-Mail gesendet',
        `
        <div class="success">
            Wenn ein Konto mit dieser E-Mail existiert,
            wurde ein Reset-Link verschickt.
        </div>

        <a class="btn" href="/login">
            Zum Login
        </a>
        `
    ));
});

/* =========================================================
   RESET PASSWORD
========================================================= */

app.get('/reset-password/:token', (req, res) => {
    const token = String(req.params.token || '');

    const users = getUsers();

    const user = users.find(
        u =>
            u.resetToken === token &&
            Number(u.resetExpires || 0) > Date.now()
    );

    if (!user) {
        return res.status(400).send(page(
            'Ungültiger Link',
            `
            <div class="error">
                Dieser Reset-Link ist ungültig oder abgelaufen.
            </div>
            <a class="btn" href="/forgot-password">
                Neuen Link anfordern
            </a>
            `
        ));
    }

    res.send(page(
        'Neues Passwort',
        `
        <div class="box">
            <h1>🔑 Neues Passwort</h1>

            <form method="POST"
                  action="/reset-password/${escapeHTML(token)}">

                <label>Neues Passwort</label>

                <input
                    type="password"
                    name="password"
                    minlength="8"
                    required
                >

                <label>Passwort wiederholen</label>

                <input
                    type="password"
                    name="password2"
                    minlength="8"
                    required
                >

                <button type="submit">
                    Passwort ändern
                </button>
            </form>
        </div>
        `
    ));
});

app.post('/reset-password/:token', async (req, res) => {
    const token = String(req.params.token || '');

    const password = String(
        req.body.password || ''
    );

    const password2 = String(
        req.body.password2 || ''
    );

    if (
        password.length < 8 ||
        password !== password2
    ) {
        return res.status(400).send(page(
            'Fehler',
            `
            <div class="error">
                Die Passwörter müssen identisch sein
                und mindestens 8 Zeichen haben.
            </div>

            <a class="btn" href="javascript:history.back()">
                Zurück
            </a>
            `
        ));
    }

    const users = getUsers();

    const index = users.findIndex(
        u =>
            u.resetToken === token &&
            Number(u.resetExpires || 0) > Date.now()
    );

    if (index === -1) {
        return res.status(400).send(page(
            'Ungültiger Link',
            `
            <div class="error">
                Der Reset-Link ist ungültig oder abgelaufen.
            </div>
            `
        ));
    }

    users[index].passwordHash =
        await bcrypt.hash(password, 12);

    delete users[index].resetToken;
    delete users[index].resetExpires;

    saveUsers(users);

    res.send(page(
        'Passwort geändert',
        `
        <div class="success">
            Dein Passwort wurde erfolgreich geändert.
        </div>

        <a class="btn" href="/login">
            Zum Login
        </a>
        `
    ));
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get('/dashboard', requireLogin, (req, res) => {
    const user = currentUser(req);

    const servers = getServers().filter(
        server => server.ownerId === user.id
    );

    const orders = getOrders().filter(
        order => order.userId === user.id
    );

    res.send(page(
        'Dashboard',
        `
        <div class="hero">
            <h1>👋 Hallo ${escapeHTML(user.name)}</h1>

            <p>
                Willkommen in deinem Minecraft-Hosting.
            </p>

            <p class="coins">
                💰 ${Number(user.coins || 0)} Coins
            </p>
        </div>

        <div class="grid">

            <div class="card">
                <h2>🖥️ Server</h2>
                <p>
                    ${servers.length} Server
                </p>

                <a class="btn" href="/servers">
                    Server verwalten
                </a>
            </div>

            <div class="card">
                <h2>🛒 Bestellungen</h2>
                <p>
                    ${orders.length} Bestellungen
                </p>

                <a class="btn" href="/orders">
                    Bestellungen
                </a>
            </div>

            <div class="card">
                <h2>📝 Bewerbung</h2>

                <a class="btn" href="/applications">
                    Bewerbung erstellen
                </a>
            </div>

        </div>
        `,
        user
    ));
});

/* =========================================================
   SERVERS
========================================================= */

app.get('/servers', requireLogin, (req, res) => {
    const user = currentUser(req);

    const servers = getServers().filter(
        server => server.ownerId === user.id
    );

    res.send(page(
        'Meine Server',
        `
        <div class="box">
            <h1>🖥️ Meine Minecraft-Server</h1>

            <form method="POST" action="/servers/create">
                <label>Servername</label>

                <input
                    name="name"
                    maxlength="40"
                    placeholder="Mein Minecraft Server"
                    required
                >

                <label>Version</label>

                <select name="version">
                    <option value="1.21.8">1.21.8</option>
                    <option value="1.21.7">1.21.7</option>
                    <option value="1.21.6">1.21.6</option>
                    <option value="1.20.6">1.20.6</option>
                </select>

                <button type="submit">
                    Server erstellen
                </button>
            </form>
        </div>

        ${
            servers.length
            ? servers.map(server => `
                <div class="card">

                    <h2>
                        ⛏️ ${escapeHTML(server.name)}
                    </h2>

                    <p class="small">
                        Version:
                        ${escapeHTML(server.version)}
                    </p>

                    <p>
                        Status:
                        <span class="status ${
                            server.status === 'online'
                            ? 'online'
                            : 'offline'
                        }">
                            ${escapeHTML(server.status)}
                        </span>
                    </p>

                    ${
                        server.locked
                        ? `
                        <p class="warning">
                            🔒 Dieser Server wurde gesperrt.
                        </p>
                        `
                        : ''
                    }

                    <a
                        class="btn"
                        href="/servers/${server.id}"
                    >
                        Verwalten
                    </a>
                </div>
            `).join('')
            : `
                <div class="box">
                    <p>Noch keine Server vorhanden.</p>
                </div>
            `
        }
        `,
        user
    ));
});

app.post('/servers/create', requireLogin, (req, res) => {
    const user = currentUser(req);

    const name = safeServerName(req.body.name);
    const version = String(
        req.body.version || '1.21.8'
    );

    if (!name) {
        return res.status(400).send(page(
            'Fehler',
            `
            <div class="error">
                Ungültiger Servername.
            </div>
            `,
            user
        ));
    }

    const servers = getServers();

    const server = {
        id: id('server'),
        ownerId: user.id,
        name,
        version,
        status: 'offline',
        locked: false,
        createdAt: now(),
        files: {
            'server.properties':
                `motd=${name}\n` +
                `online-mode=true\n` +
                `max-players=20\n`,
            'README.txt':
                'Minecraft Server Dateien\n'
        }
    };

    servers.push(server);

    saveServers(servers);

    res.redirect('/servers');
});

/* =========================================================
   SERVER MANAGEMENT
========================================================= */

app.get('/servers/:serverId', requireLogin, (req, res) => {
    const user = currentUser(req);

    const server = getServers().find(
        s =>
            s.id === req.params.serverId &&
            s.ownerId === user.id
    );

    if (!server) {
        return res.status(404).send(page(
            'Nicht gefunden',
            `
            <div class="error">
                Server nicht gefunden.
            </div>
            `,
            user
        ));
    }

    const files = server.files || {};

    res.send(page(
        server.name,
        `
        <div class="box">

            <h1>
                ⛏️ ${escapeHTML(server.name)}
            </h1>

            <p>
                Status:
                <span class="status ${
                    server.status === 'online'
                    ? 'online'
                    : 'offline'
                }">
                    ${escapeHTML(server.status)}
                </span>
            </p>

            ${
                server.locked
                ? `
                <div class="error">
                    🔒 Der Server ist gesperrt.
                </div>
                `
                : ''
            }

            <form
                method="POST"
                action="/servers/${server.id}/start"
                style="display:inline"
            >
                <button
                    class="btn-green"
                    type="submit"
                >
                    ▶ Start
                </button>
            </form>

            <form
                method="POST"
                action="/servers/${server.id}/stop"
                style="display:inline"
            >
                <button
                    class="btn-red"
                    type="submit"
                >
                    ■ Stop
                </button>
            </form>

            <form
                method="POST"
                action="/servers/${server.id}/restart"
                style="display:inline"
            >
                <button
                    type="submit"
                >
                    🔄 Neustart
                </button>
            </form>

        </div>

        <div class="box">

            <h2>✏️ Server umbenennen</h2>

            <form
                method="POST"
                action="/servers/${server.id}/rename"
            >
                <input
                    name="name"
                    value="${escapeHTML(server.name)}"
                    maxlength="40"
                    required
                >

                <button type="submit">
                    Speichern
                </button>
            </form>

        </div>

        <div class="box">

            <h2>📁 Server-Dateien</h2>

            <form
                method="POST"
                action="/servers/${server.id}/file"
            >

                <label>Dateiname</label>

                <input
                    name="filename"
                    placeholder="plugins/mein-plugin.yml"
                    required
                >

                <label>Inhalt</label>

                <textarea
                    name="content"
                    placeholder="Hier deinen Inhalt einfügen..."
                ></textarea>

                <button type="submit">
                    Datei speichern
                </button>

            </form>

            <hr>

            ${
                Object.keys(files).length
                ? Object.entries(files).map(
                    ([filename, content]) => `
                    <div class="card">
                        <h3>
                            📄 ${escapeHTML(filename)}
                        </h3>

                        <form
                            method="POST"
                            action="/servers/${server.id}/file"
                        >

                            <input
                                type="hidden"
                                name="filename"
                                value="${escapeHTML(filename)}"
                            >

                            <textarea
                                name="content"
                            >${escapeHTML(content)}</textarea>

                            <button type="submit">
                                Datei aktualisieren
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/servers/${server.id}/file/delete"
                        >

                            <input
                                type="hidden"
                                name="filename"
                                value="${escapeHTML(filename)}"
                            >

                            <button
                                class="btn-red"
                                type="submit"
                            >
                                Datei löschen
                            </button>

                        </form>
                    </div>
                    `
                ).join('')
                : '<p>Keine Dateien.</p>'
            }

        </div>
        `,
        user
    ));
});

function getOwnedServer(req) {
    const user = currentUser(req);

    return getServers().find(
        server =>
            server.id === req.params.serverId &&
            server.ownerId === user.id
    );
}

app.post(
    '/servers/:serverId/start',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        if (server.locked) {
            return res.status(403).send('Server gesperrt');
        }

        server.status = 'online';

        saveServers(getServers());

        res.redirect(`/servers/${server.id}`);
    }
);

app.post(
    '/servers/:serverId/stop',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        server.status = 'offline';

        saveServers(getServers());

        res.redirect(`/servers/${server.id}`);
    }
);

app.post(
    '/servers/:serverId/restart',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        if (server.locked) {
            return res.status(403).send('Server gesperrt');
        }

        server.status = 'restarting';

        saveServers(getServers());

        setTimeout(() => {
            const servers = getServers();

            const current = servers.find(
                s => s.id === server.id
            );

            if (current && !current.locked) {
                current.status = 'online';
                saveServers(servers);
            }
        }, 1500);

        res.redirect(`/servers/${server.id}`);
    }
);

app.post(
    '/servers/:serverId/rename',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        const name = safeServerName(req.body.name);

        if (!name) {
            return res.status(400).send('Ungültiger Name');
        }

        server.name = name;

        saveServers(getServers());

        res.redirect(`/servers/${server.id}`);
    }
);

app.post(
    '/servers/:serverId/file',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        const filename = String(
            req.body.filename || ''
        )
        .trim()
        .replace(/\.\./g, '')
        .replace(/^\/+/, '')
        .slice(0, 150);

        const content = String(
            req.body.content || ''
        ).slice(0, 1000000);

        if (!filename) {
            return res.status(400).send(
                'Dateiname fehlt'
            );
        }

        if (!server.files) {
            server.files = {};
        }

        server.files[filename] = content;

        saveServers(getServers());

        res.redirect(`/servers/${server.id}`);
    }
);

app.post(
    '/servers/:serverId/file/delete',
    requireLogin,
    (req, res) => {

        const server = getOwnedServer(req);

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        const filename = String(
            req.body.filename || ''
        );

        if (server.files) {
            delete server.files[filename];
        }

        saveServers(getServers());

        res.redirect(`/servers/${server.id}`);
    }
);

/* =========================================================
   ORDERS
========================================================= */

app.get('/orders', requireLogin, (req, res) => {
    const user = currentUser(req);

    const orders = getOrders().filter(
        order => order.userId === user.id
    );

    res.send(page(
        'Bestellungen',
        `
        <div class="box">
            <h1>🛒 Meine Bestellungen</h1>

            <p class="coins">
                💰 ${Number(user.coins || 0)} Coins
            </p>

            <form method="POST" action="/orders/create">

                <label>Produkt</label>

                <select name="product">
                    <option value="server-upgrade">
                        Server Upgrade - 100 Coins
                    </option>

                    <option value="premium-server">
                        Premium Server - 250 Coins
                    </option>

                    <option value="plugin-install">
                        Plugin Installation - 50 Coins
                    </option>
                </select>

                <button type="submit">
                    Bestellung erstellen
                </button>

            </form>
        </div>

        <div class="box">
            <h2>Bestellverlauf</h2>

            ${
                orders.length
                ? `
                <table>
                    <tr>
                        <th>Produkt</th>
                        <th>Preis</th>
                        <th>Status</th>
                        <th>Datum</th>
                    </tr>

                    ${
                        orders.map(order => `
                        <tr>
                            <td>
                                ${escapeHTML(order.product)}
                            </td>

                            <td>
                                ${order.price} Coins
                            </td>

                            <td>
                                ${escapeHTML(order.status)}
                            </td>

                            <td>
                                ${escapeHTML(order.createdAt)}
                            </td>
                        </tr>
                        `).join('')
                    }

                </table>
                `
                : '<p>Keine Bestellungen.</p>'
            }
        </div>
        `,
        user
    ));
});

function productPrice(product) {
    const prices = {
        'server-upgrade': 100,
        'premium-server': 250,
        'plugin-install': 50
    };

    return prices[product] || 0;
}

app.post('/orders/create', requireLogin, (req, res) => {
    const user = currentUser(req);

    const product = String(
        req.body.product || ''
    );

    const price = productPrice(product);

    if (!price) {
        return res.status(400).send('Ungültiges Produkt');
    }

    const users = getUsers();

    const userIndex = users.findIndex(
        u => u.id === user.id
    );

    if (users[userIndex].coins < price) {
        return res.status(400).send(page(
            'Nicht genug Coins',
            `
            <div class="error">
                Du hast nicht genug Coins.
            </div>

            <a class="btn" href="/orders">
                Zurück
            </a>
            `,
            user
        ));
    }

    users[userIndex].coins -= price;

    saveUsers(users);

    const orders = getOrders();

    orders.push({
        id: id('order'),
        userId: user.id,
        product,
        price,
        status: 'wartend',
        createdAt: now()
    });

    saveOrders(orders);

    res.redirect('/orders');
});

/* =========================================================
   COIN CODES
========================================================= */

app.get('/redeem', requireLogin, (req, res) => {
    const user = currentUser(req);

    res.send(page(
        'Coins einlösen',
        `
        <div class="box">

            <h1>🎁 Code einlösen</h1>

            <p class="coins">
                Deine Coins:
                ${Number(user.coins || 0)}
            </p>

            <form method="POST" action="/redeem">

                <label>Code</label>

                <input
                    name="code"
                    placeholder="NORTH-XXXX"
                    required
                >

                <button type="submit">
                    Einlösen
                </button>

            </form>

        </div>
        `,
        user
    ));
});

app.post('/redeem', requireLogin, (req, res) => {
    const user = currentUser(req);

    const input = String(
        req.body.code || ''
    )
    .trim()
    .toUpperCase();

    const codes = getCodes();

    const code = codes.find(
        c =>
            String(c.code).toUpperCase() === input &&
            !c.used
    );

    if (!code) {
        return res.status(400).send(page(
            'Ungültiger Code',
            `
            <div class="error">
                Der Code ist ungültig oder wurde bereits benutzt.
            </div>

            <a class="btn" href="/redeem">
                Zurück
            </a>
            `,
            user
        ));
    }

    const users = getUsers();

    const index = users.findIndex(
        u => u.id === user.id
    );

    users[index].coins =
        Number(users[index].coins || 0) +
        Number(code.coins || 0);

    code.used = true;
    code.usedBy = user.id;
    code.usedAt = now();

    saveUsers(users);
    saveCodes(codes);

    res.send(page(
        'Code eingelöst',
        `
        <div class="success">
            🎉 ${Number(code.coins || 0)} Coins wurden gutgeschrieben.
        </div>

        <a class="btn" href="/dashboard">
            Dashboard
        </a>
        `,
        users[index]
    ));
});

/* =========================================================
   APPLICATIONS
========================================================= */

app.get('/applications', requireLogin, (req, res) => {
    const user = currentUser(req);

    const applications =
        getApplications().filter(
            a => a.userId === user.id
        );

    res.send(page(
        'Bewerbungen',
        `
        <div class="box">

            <h1>📝 Team-Bewerbung</h1>

            <form
                method="POST"
                action="/applications"
            >

                <label>Bereich</label>

                <select name="type">
                    <option value="Moderator">
                        Moderator
                    </option>

                    <option value="Developer">
                        Developer
                    </option>
                </select>

                <label>Warum möchtest du ins Team?</label>

                <textarea
                    name="reason"
                    required
                ></textarea>

                <label>Erfahrung</label>

                <textarea
                    name="experience"
                    required
                ></textarea>

                <button type="submit">
                    Bewerbung absenden
                </button>

            </form>

        </div>

        <div class="box">

            <h2>Meine Bewerbungen</h2>

            ${
                applications.length
                ? applications.map(
                    application => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(application.type)}
                        </h3>

                        <p>
                            Status:
                            <span class="status">
                                ${escapeHTML(application.status)}
                            </span>
                        </p>

                        <p>
                            ${escapeHTML(application.createdAt)}
                        </p>

                    </div>
                    `
                ).join('')
                : '<p>Noch keine Bewerbungen.</p>'
            }

        </div>
        `,
        user
    ));
});

app.post('/applications', requireLogin, (req, res) => {
    const user = currentUser(req);

    const type = String(
        req.body.type || ''
    );

    if (
        type !== 'Moderator' &&
        type !== 'Developer'
    ) {
        return res.status(400).send(
            'Ungültiger Bereich'
        );
    }

    const applications = getApplications();

    applications.push({
        id: id('application'),
        userId: user.id,
        name: user.name,
        email: user.email,
        type,
        reason: String(
            req.body.reason || ''
        ).slice(0, 5000),
        experience: String(
            req.body.experience || ''
        ).slice(0, 5000),
        status: 'offen',
        createdAt: now()
    });

    saveApplications(applications);

    res.redirect('/applications');
});

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get('/admin', requireOwner, (req, res) => {
    const user = currentUser(req);

    const users = getUsers();
    const servers = getServers();
    const orders = getOrders();
    const applications = getApplications();
    const codes = getCodes();

    res.send(page(
        'Owner Admin',
        `
        <div class="hero">
            <h1>👑 Owner Admin Panel</h1>

            <p>
                Eingeloggt als
                <strong>
                    ${escapeHTML(user.email)}
                </strong>
            </p>

            <p>
                Benutzer: ${users.length}
                • Server: ${servers.length}
                • Bestellungen: ${orders.length}
                • Bewerbungen: ${applications.length}
            </p>
        </div>

        <div class="box">

            <h2>💰 Coins vergeben</h2>

            <form method="POST" action="/admin/coins">

                <label>Benutzer-ID</label>

                <input
                    name="userId"
                    required
                >

                <label>Coins</label>

                <input
                    type="number"
                    name="amount"
                    min="1"
                    required
                >

                <button type="submit">
                    Coins geben
                </button>

            </form>

        </div>

        <div class="box">

            <h2>🎁 Coin-Code erstellen</h2>

            <form method="POST" action="/admin/codes">

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

                <button type="submit">
                    Code erstellen
                </button>

            </form>

        </div>

        <div class="box">

            <h2>👥 Benutzer</h2>

            <table>

                <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Coins</th>
                    <th>Status</th>
                    <th>Aktion</th>
                </tr>

                ${
                    users.map(target => `
                    <tr>

                        <td>
                            ${escapeHTML(target.name)}
                        </td>

                        <td>
                            ${escapeHTML(target.email)}
                        </td>

                        <td>
                            ${Number(target.coins || 0)}
                        </td>

                        <td>
                            ${
                                target.banned
                                ? '🚫 Gesperrt'
                                : '✅ Aktiv'
                            }
                        </td>

                        <td>

                            ${
                                isOwner(target)
                                ? '<strong>OWNER</strong>'
                                : `
                                <form
                                    method="POST"
                                    action="/admin/users/${target.id}/ban"
                                    style="display:inline"
                                >
                                    <button
                                        class="btn-red"
                                        type="submit"
                                    >
                                        ${
                                            target.banned
                                            ? 'Entsperren'
                                            : 'Sperren'
                                        }
                                    </button>
                                </form>
                                `
                            }

                        </td>

                    </tr>
                    `).join('')
                }

            </table>

        </div>

        <div class="box">

            <h2>🖥️ Alle Server</h2>

            ${
                servers.length
                ? servers.map(server => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(server.name)}
                        </h3>

                        <p>
                            Besitzer:
                            ${escapeHTML(
                                server.ownerId
                            )}
                        </p>

                        <p>
                            Status:
                            ${escapeHTML(
                                server.status
                            )}
                        </p>

                        <p>
                            ${
                                server.locked
                                ? '🔒 Gesperrt'
                                : '🔓 Freigegeben'
                            }
                        </p>

                        <form
                            method="POST"
                            action="/admin/servers/${server.id}/toggle-lock"
                            style="display:inline"
                        >
                            <button type="submit">
                                ${
                                    server.locked
                                    ? 'Entsperren'
                                    : 'Sperren'
                                }
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/admin/servers/${server.id}/shutdown"
                            style="display:inline"
                        >
                            <button
                                class="btn-red"
                                type="submit"
                            >
                                Herunterfahren
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/admin/servers/${server.id}/delete"
                            style="display:inline"
                            onsubmit="return confirm('Server wirklich löschen?')"
                        >
                            <button
                                class="btn-red"
                                type="submit"
                            >
                                Löschen
                            </button>
                        </form>

                    </div>
                `).join('')
                : '<p>Keine Server.</p>'
            }

        </div>

        <div class="box">

            <h2>🛒 Bestellungen</h2>

            ${
                orders.length
                ? orders.map(order => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(order.product)}
                        </h3>

                        <p>
                            Preis:
                            ${order.price} Coins
                        </p>

                        <p>
                            Status:
                            ${escapeHTML(order.status)}
                        </p>

                        ${
                            order.status === 'wartend'
                            ? `
                            <form
                                method="POST"
                                action="/admin/orders/${order.id}/accept"
                                style="display:inline"
                            >
                                <button
                                    class="btn-green"
                                    type="submit"
                                >
                                    Annehmen
                                </button>
                            </form>

                            <form
                                method="POST"
                                action="/admin/orders/${order.id}/reject"
                                style="display:inline"
                            >
                                <button
                                    class="btn-red"
                                    type="submit"
                                >
                                    Ablehnen + Coins zurück
                                </button>
                            </form>
                            `
                            : ''
                        }

                    </div>
                `).join('')
                : '<p>Keine Bestellungen.</p>'
            }

        </div>

        <div class="box">

            <h2>📝 Bewerbungen</h2>

            ${
                applications.length
                ? applications.map(application => `
                    <div class="card">

                        <h3>
                            ${escapeHTML(
                                application.type
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                application.name
                            )}
                            —
                            ${escapeHTML(
                                application.email
                            )}
                        </p>

                        <p>
                            <strong>Grund:</strong><br>
                            ${escapeHTML(
                                application.reason
                            )}
                        </p>

                        <p>
                            <strong>Erfahrung:</strong><br>
                            ${escapeHTML(
                                application.experience
                            )}
                        </p>

                        <p>
                            Status:
                            ${escapeHTML(
                                application.status
                            )}
                        </p>

                        ${
                            application.status === 'offen'
                            ? `
                            <form
                                method="POST"
                                action="/admin/applications/${application.id}/accept"
                                style="display:inline"
                            >
                                <button
                                    class="btn-green"
                                    type="submit"
                                >
                                    Annehmen
                                </button>
                            </form>

                            <form
                                method="POST"
                                action="/admin/applications/${application.id}/reject"
                                style="display:inline"
                            >
                                <button
                                    class="btn-red"
                                    type="submit"
                                >
                                    Ablehnen
                                </button>
                            </form>
                            `
                            : ''
                        }

                    </div>
                `).join('')
                : '<p>Keine Bewerbungen.</p>'
            }

        </div>

        <div class="box">

            <h2>🎁 Codes</h2>

            ${
                codes.length
                ? `
                <table>
                    <tr>
                        <th>Code</th>
                        <th>Coins</th>
                        <th>Status</th>
                    </tr>

                    ${
                        codes.map(code => `
                        <tr>
                            <td>
                                ${escapeHTML(code.code)}
                            </td>

                            <td>
                                ${Number(code.coins)}
                            </td>

                            <td>
                                ${
                                    code.used
                                    ? '❌ Verwendet'
                                    : '✅ Aktiv'
                                }
                            </td>
                        </tr>
                        `).join('')
                    }

                </table>
                `
                : '<p>Keine Codes.</p>'
            }

        </div>
        `,
        user
    ));
});

/* =========================================================
   ADMIN COINS
========================================================= */

app.post('/admin/coins', requireOwner, (req, res) => {
    const userId = String(
        req.body.userId || ''
    );

    const amount = Number(
        req.body.amount
    );

    if (
        !userId ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return res.status(400).send(
            'Ungültige Daten'
        );
    }

    const users = getUsers();

    const index = users.findIndex(
        u => u.id === userId
    );

    if (index === -1) {
        return res.status(404).send(
            'Benutzer nicht gefunden'
        );
    }

    users[index].coins =
        Number(users[index].coins || 0) +
        Math.floor(amount);

    saveUsers(users);

    res.redirect('/admin');
});

/* =========================================================
   ADMIN CODES
========================================================= */

app.post('/admin/codes', requireOwner, (req, res) => {
    const codeValue = String(
        req.body.code || ''
    )
    .trim()
    .toUpperCase();

    const coins = Number(
        req.body.coins
    );

    if (
        !codeValue ||
        !Number.isFinite(coins) ||
        coins <= 0
    ) {
        return res.status(400).send(
            'Ungültige Daten'
        );
    }

    const codes = getCodes();

    if (
        codes.some(
            c =>
                String(c.code).toUpperCase() ===
                codeValue
        )
    ) {
        return res.status(409).send(
            'Code existiert bereits'
        );
    }

    codes.push({
        id: id('code'),
        code: codeValue,
        coins: Math.floor(coins),
        used: false,
        createdAt: now()
    });

    saveCodes(codes);

    res.redirect('/admin');
});

/* =========================================================
   ADMIN USER BAN
========================================================= */

app.post(
    '/admin/users/:userId/ban',
    requireOwner,
    (req, res) => {

        const users = getUsers();

        const index = users.findIndex(
            u => u.id === req.params.userId
        );

        if (index === -1) {
            return res.status(404).send(
                'Benutzer nicht gefunden'
            );
        }

        if (isOwner(users[index])) {
            return res.status(403).send(
                'Der Owner kann nicht gesperrt werden.'
            );
        }

        users[index].banned =
            !users[index].banned;

        saveUsers(users);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER LOCK
========================================================= */

app.post(
    '/admin/servers/:serverId/toggle-lock',
    requireOwner,
    (req, res) => {

        const servers = getServers();

        const index = servers.findIndex(
            s => s.id === req.params.serverId
        );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].locked =
            !servers[index].locked;

        if (servers[index].locked) {
            servers[index].status = 'offline';
        }

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER SHUTDOWN
========================================================= */

app.post(
    '/admin/servers/:serverId/shutdown',
    requireOwner,
    (req, res) => {

        const servers = getServers();

        const index = servers.findIndex(
            s => s.id === req.params.serverId
        );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].status = 'offline';

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER DELETE
========================================================= */

app.post(
    '/admin/servers/:serverId/delete',
    requireOwner,
    (req, res) => {

        let servers = getServers();

        const exists = servers.some(
            s => s.id === req.params.serverId
        );

        if (!exists) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers = servers.filter(
            s => s.id !== req.params.serverId
        );

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN ORDERS ACCEPT
========================================================= */

app.post(
    '/admin/orders/:orderId/accept',
    requireOwner,
    (req, res) => {

        const orders = getOrders();

        const index = orders.findIndex(
            o => o.id === req.params.orderId
        );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        if (orders[index].status !== 'wartend') {
            return res.redirect('/admin');
        }

        orders[index].status = 'angenommen';
        orders[index].processedAt = now();

        saveOrders(orders);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN ORDERS REJECT + REFUND
========================================================= */

app.post(
    '/admin/orders/:orderId/reject',
    requireOwner,
    (req, res) => {

        const orders = getOrders();

        const index = orders.findIndex(
            o => o.id === req.params.orderId
        );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        const order = orders[index];

        if (order.status !== 'wartend') {
            return res.redirect('/admin');
        }

        order.status = 'abgelehnt';
        order.refunded = true;
        order.refundedAt = now();

        const users = getUsers();

        const userIndex = users.findIndex(
            u => u.id === order.userId
        );

        if (userIndex !== -1) {
            users[userIndex].coins =
                Number(users[userIndex].coins || 0) +
                Number(order.price || 0);

            saveUsers(users);
        }

        saveOrders(orders);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN APPLICATION ACCEPT
========================================================= */

app.post(
    '/admin/applications/:applicationId/accept',
    requireOwner,
    (req, res) => {

        const applications =
            getApplications();

        const index =
            applications.findIndex(
                a =>
                    a.id ===
                    req.params.applicationId
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'angenommen';

        applications[index].processedAt =
            now();

        saveApplications(applications);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN APPLICATION REJECT
========================================================= */

app.post(
    '/admin/applications/:applicationId/reject',
    requireOwner,
    (req, res) => {

        const applications =
            getApplications();

        const index =
            applications.findIndex(
                a =>
                    a.id ===
                    req.params.applicationId
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'abgelehnt';

        applications[index].processedAt =
            now();

        saveApplications(applications);

        res.redirect('/admin');
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
    console.error(
        'SERVER FEHLER:',
        err
    );

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send(page(
        'Serverfehler',
        `
        <div class="error">
            <h1>❌ Serverfehler</h1>
            <p>
                Bei der Verarbeitung ist ein Fehler aufgetreten.
            </p>
        </div>

        <a class="btn" href="/">
            Startseite
        </a>
        `
    ));
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, () => {
    console.log('');
    console.log('==========================================');
    console.log('⛏️ Minecraft Hosting gestartet');
    console.log('==========================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`👑 Owner: ${OWNER_EMAIL}`);

    if (mailer) {
        console.log('📧 Gmail: eingerichtet');
    } else {
        console.log(
            '⚠️ Gmail: NICHT eingerichtet'
        );
    }

    console.log('==========================================');
});
