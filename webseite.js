'use strict';

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const OWNER_EMAIL = String(
    process.env.OWNER_EMAIL || 'florianzustolberg@gmail.com'
).trim().toLowerCase();

const SESSION_SECRET = String(
    process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET'
);

const GMAIL_USER = String(
    process.env.GMAIL_USER || ''
).trim();

const GMAIL_APP_PASSWORD = String(
    process.env.GMAIL_APP_PASSWORD || ''
).replace(/\s/g, '');

const BASE_URL = String(
    process.env.BASE_URL || `http://localhost:${PORT}`
).replace(/\/$/, '');

const DATA_DIR = path.join(__dirname, 'data');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '[]', 'utf8');
    }
}

ensureFile(USERS_FILE);
ensureFile(ORDERS_FILE);
ensureFile(SERVERS_FILE);
ensureFile(APPLICATIONS_FILE);

function read(file) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`JSON Fehler ${file}:`, error.message);
        return [];
    }
}

function write(file, data) {
    const tmp = `${file}.tmp`;

    fs.writeFileSync(
        tmp,
        JSON.stringify(data, null, 2),
        'utf8'
    );

    fs.renameSync(tmp, file);
}

function id(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

function token() {
    return crypto.randomBytes(32).toString('hex');
}

function cleanEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getUsers() {
    return read(USERS_FILE);
}

function getOrders() {
    return read(ORDERS_FILE);
}

function getServers() {
    return read(SERVERS_FILE);
}

function getApplications() {
    return read(APPLICATIONS_FILE);
}

function currentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return getUsers().find(
        user => user.id === req.session.userId
    ) || null;
}

function owner(user) {
    return !!user &&
        cleanEmail(user.email) === OWNER_EMAIL;
}

function admin(user) {
    return !!user &&
        (owner(user) || user.role === 'admin');
}

function auth(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (user.banned) {
        req.session.destroy(() => {});

        return res.status(403).send(
            layout(
                'Konto gesperrt',
                `
                <div class="error">
                    🚫 Dein Konto wurde gesperrt.
                </div>
                `
            )
        );
    }

    next();
}

function adminAuth(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (!admin(user)) {
        return res.status(403).send(
            layout(
                'Kein Zugriff',
                `
                <div class="error">
                    🚫 Kein Zugriff auf das Admin-Panel.
                </div>
                `
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
    limit: '2mb'
}));

app.use(express.json({
    limit: '2mb'
}));

app.use(session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

/* =========================================================
   GMAIL
========================================================= */

let mailer = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    mailer = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD
        },
        logger: true,
        debug: true
    });
} else {
    console.error('================================');
    console.error('GMAIL NICHT KONFIGURIERT');
    console.error('GMAIL_USER vorhanden:', !!GMAIL_USER);
    console.error('GMAIL_APP_PASSWORD vorhanden:', !!GMAIL_APP_PASSWORD);
    console.error('================================');
}

async function verifyMail() {
    if (!mailer) {
        return false;
    }

    try {
        await mailer.verify();

        console.log('✅ Gmail SMTP funktioniert.');
        console.log(`📧 Absender: ${GMAIL_USER}`);

        return true;
    } catch (error) {
        console.error('================================');
        console.error('❌ GMAIL SMTP FEHLER');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('SMTP Code:', error.responseCode);
        console.error('Response:', error.response || 'keine');
        console.error('Command:', error.command || 'keiner');
        console.error('================================');

        return false;
    }
}

async function sendMail(to, subject, html) {
    console.log('--------------------------------');
    console.log('📧 E-Mail wird gesendet');
    console.log('An:', to);
    console.log('Betreff:', subject);

    if (!mailer) {
        console.error('❌ Gmail ist nicht eingerichtet.');
        return false;
    }

    try {
        const result = await mailer.sendMail({
            from: `"Minecraft Hosting" <${GMAIL_USER}>`,
            to,
            subject,
            html
        });

        console.log('✅ E-Mail gesendet');
        console.log('Message ID:', result.messageId);
        console.log('Response:', result.response);

        return true;
    } catch (error) {
        console.error('================================');
        console.error('❌ E-MAIL FEHLER');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('SMTP Code:', error.responseCode);
        console.error('Response:', error.response || 'keine');
        console.error('Command:', error.command || 'keiner');
        console.error('================================');

        return false;
    }
}

/* =========================================================
   HTML
========================================================= */

function layout(title, body, user = null) {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${esc(title)} - Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #090d12;
    color: #f5f7fa;
    font-family: Arial, sans-serif;
}

nav {
    background: #111821;
    border-bottom: 1px solid #293542;
    padding: 15px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}

.logo {
    font-size: 20px;
    font-weight: bold;
}

.nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.nav a {
    color: white;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 8px;
    background: #1b2632;
}

.nav a:hover {
    background: #2b3947;
}

main {
    width: min(1150px, 94%);
    margin: 35px auto;
}

.hero,
.card,
.box {
    background: #111821;
    border: 1px solid #293542;
    border-radius: 15px;
    padding: 22px;
    margin-bottom: 18px;
}

.hero {
    padding: 40px;
}

.hero h1 {
    margin-top: 0;
    font-size: 40px;
}

.grid {
    display: grid;
    grid-template-columns: repeat(
        auto-fit,
        minmax(240px, 1fr)
    );
    gap: 18px;
}

input,
select,
textarea {
    display: block;
    width: 100%;
    background: #080c11;
    border: 1px solid #354454;
    color: white;
    border-radius: 8px;
    padding: 12px;
    margin-top: 7px;
    margin-bottom: 15px;
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
    background: #287cff;
    color: white;
    padding: 11px 15px;
    text-decoration: none;
    cursor: pointer;
    font-weight: bold;
}

button:hover,
.btn:hover {
    filter: brightness(1.15);
}

.green {
    background: #23834e;
}

.red {
    background: #bd3d3d;
}

.gray {
    background: #3c4753;
}

.status {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    background: #374350;
}

.waiting {
    background: #756022;
}

.accepted {
    background: #23794b;
}

.rejected {
    background: #793838;
}

.online {
    background: #23794b;
}

.offline {
    background: #673535;
}

.error {
    padding: 15px;
    border-radius: 9px;
    background: #421e23;
    border: 1px solid #813840;
    margin-bottom: 15px;
}

.success {
    padding: 15px;
    border-radius: 9px;
    background: #173d29;
    border: 1px solid #2b7750;
    margin-bottom: 15px;
}

.warning {
    padding: 15px;
    border-radius: 9px;
    background: #4a3919;
    border: 1px solid #80692d;
    margin-bottom: 15px;
}

.small {
    color: #9da9b5;
    font-size: 14px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 10px;
    border-bottom: 1px solid #2b3743;
}

footer {
    text-align: center;
    padding: 40px;
    color: #78838e;
}

</style>
</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Hosting
</div>

<div class="nav">

<a href="/">Home</a>

${
    user
    ? `
        <a href="/dashboard">Dashboard</a>
        <a href="/orders">Bestellungen</a>
        <a href="/servers">Server</a>
        <a href="/applications">Bewerbungen</a>

        ${
            admin(user)
            ? '<a href="/admin">👑 Admin</a>'
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
Minecraft Hosting
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

    res.send(
        layout(
            'Home',
            `
            <div class="hero">

                <h1>⛏️ Minecraft Hosting</h1>

                <p>
                    Kostenlos Minecraft-Server beantragen.
                    Jeder Server wird vor der Freischaltung
                    von einem Admin oder Owner geprüft.
                </p>

                ${
                    user
                    ? `
                    <a
                        class="btn"
                        href="/dashboard"
                    >
                        Dashboard
                    </a>
                    `
                    : `
                    <a
                        class="btn"
                        href="/register"
                    >
                        Kostenlos registrieren
                    </a>
                    `
                }

            </div>

            <div class="grid">

                <div class="card">
                    <h2>🆓 Kostenlos</h2>
                    <p>
                        Die Server-Bestellung kostet keine Coins.
                    </p>
                </div>

                <div class="card">
                    <h2>👑 Freigabe</h2>
                    <p>
                        Ein Admin oder Owner muss die Bestellung
                        zuerst annehmen.
                    </p>
                </div>

                <div class="card">
                    <h2>🔐 Sicherer Login</h2>
                    <p>
                        Registrierung, Login und
                        Passwort-Reset per E-Mail.
                    </p>
                </div>

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   REGISTER
========================================================= */

app.get('/register', (req, res) => {

    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(
        layout(
            'Registrieren',
            `
            <div class="box">

                <h1>📝 Registrierung</h1>

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
                        required
                    >

                    <label>Passwort</label>

                    <input
                        type="password"
                        name="password"
                        minlength="8"
                        required
                    >

                    <button>
                        Konto erstellen
                    </button>

                </form>

                <p>
                    Bereits registriert?
                    <a href="/login">Login</a>
                </p>

            </div>
            `
        )
    );
});

app.post('/register', async (req, res) => {

    const name =
        String(req.body.name || '').trim();

    const userEmail =
        cleanEmail(req.body.email);

    const password =
        String(req.body.password || '');

    if (
        !name ||
        !userEmail ||
        password.length < 8
    ) {
        return res.status(400).send(
            layout(
                'Fehler',
                `
                <div class="error">
                    Name, E-Mail und ein Passwort
                    mit mindestens 8 Zeichen sind erforderlich.
                </div>
                `
            )
        );
    }

    const users = getUsers();

    if (
        users.some(
            user =>
                cleanEmail(user.email) === userEmail
        )
    ) {
        return res.status(409).send(
            layout(
                'Fehler',
                `
                <div class="error">
                    Diese E-Mail ist bereits registriert.
                </div>

                <a class="btn" href="/login">
                    Zum Login
                </a>
                `
            )
        );
    }

    const passwordHash =
        await bcrypt.hash(password, 12);

    const newUser = {
        id: id('user'),
        name,
        email: userEmail,
        passwordHash,
        role:
            userEmail === OWNER_EMAIL
            ? 'owner'
            : 'user',
        coins: 0,
        banned: false,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    write(USERS_FILE, users);

    req.session.userId =
        newUser.id;

    res.redirect('/dashboard');
});

/* =========================================================
   LOGIN
========================================================= */

app.get('/login', (req, res) => {

    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(
        layout(
            'Login',
            `
            <div class="box">

                <h1>🔐 Anmeldung</h1>

                <form method="POST" action="/login">

                    <label>E-Mail</label>

                    <input
                        type="email"
                        name="email"
                        autocomplete="email"
                        required
                    >

                    <label>Passwort</label>

                    <input
                        type="password"
                        name="password"
                        autocomplete="current-password"
                        required
                    >

                    <button>
                        Anmelden
                    </button>

                </form>

                <p>
                    <a href="/forgot-password">
                        🔄 Passwort vergessen?
                    </a>
                </p>

                <p>
                    Noch kein Konto?
                    <a href="/register">
                        Registrieren
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post('/login', async (req, res) => {

    const userEmail =
        cleanEmail(req.body.email);

    const password =
        String(req.body.password || '');

    const user =
        getUsers().find(
            u =>
                cleanEmail(u.email) === userEmail
        );

    if (!user) {
        return res.status(401).send(
            layout(
                'Login',
                `
                <div class="error">
                    E-Mail oder Passwort falsch.
                </div>

                <a class="btn" href="/login">
                    Zurück
                </a>
                `
            )
        );
    }

    if (user.banned) {
        return res.status(403).send(
            layout(
                'Gesperrt',
                `
                <div class="error">
                    🚫 Dieses Konto wurde gesperrt.
                </div>
                `
            )
        );
    }

    const correct =
        await bcrypt.compare(
            password,
            user.passwordHash
        );

    if (!correct) {
        return res.status(401).send(
            layout(
                'Login',
                `
                <div class="error">
                    E-Mail oder Passwort falsch.
                </div>

                <a class="btn" href="/login">
                    Zurück
                </a>
                `
            )
        );
    }

    /*
     * Session wird nach erfolgreichem Login
     * gespeichert und bleibt bis zu 30 Tage aktiv.
     */

    req.session.userId =
        user.id;

    req.session.save(error => {

        if (error) {
            console.error(
                'Session-Speicherfehler:',
                error
            );

            return res.status(500).send(
                layout(
                    'Fehler',
                    `
                    <div class="error">
                        Login konnte nicht gespeichert werden.
                    </div>
                    `
                )
            );
        }

        res.redirect('/dashboard');
    });
});

/* =========================================================
   LOGOUT
========================================================= */

app.get('/logout', (req, res) => {

    req.session.destroy(error => {

        if (error) {
            console.error(
                'Logout Fehler:',
                error
            );
        }

        res.clearCookie('connect.sid');

        res.redirect('/');
    });
});

/* =========================================================
   PASSWORD RESET
========================================================= */

app.get('/forgot-password', (req, res) => {

    res.send(
        layout(
            'Passwort zurücksetzen',
            `
            <div class="box">

                <h1>🔄 Passwort zurücksetzen</h1>

                <p>
                    Gib die E-Mail-Adresse deines Kontos ein.
                </p>

                <form
                    method="POST"
                    action="/forgot-password"
                >

                    <label>E-Mail</label>

                    <input
                        type="email"
                        name="email"
                        required
                    >

                    <button>
                        Reset-Mail senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post('/forgot-password', async (req, res) => {

    const userEmail =
        cleanEmail(req.body.email);

    const users =
        getUsers();

    const index =
        users.findIndex(
            user =>
                cleanEmail(user.email) ===
                userEmail
        );

    /*
     * Aus Sicherheitsgründen wird nach außen
     * immer dieselbe Meldung angezeigt.
     */

    if (index !== -1) {

        const resetToken =
            token();

        users[index].resetToken =
            resetToken;

        users[index].resetExpires =
            Date.now() + 30 * 60 * 1000;

        write(USERS_FILE, users);

        const resetURL =
            `${BASE_URL}/reset-password/${resetToken}`;

        await sendMail(
            users[index].email,
            'Passwort zurücksetzen – Minecraft Hosting',
            `
            <h2>🔐 Passwort zurücksetzen</h2>

            <p>
                Hallo ${esc(users[index].name)}!
            </p>

            <p>
                Du hast einen Passwort-Reset angefordert.
            </p>

            <p>
                <a
                    href="${esc(resetURL)}"
                    style="
                        display:inline-block;
                        padding:12px 18px;
                        background:#287cff;
                        color:white;
                        text-decoration:none;
                        border-radius:8px;
                    "
                >
                    Passwort zurücksetzen
                </a>
            </p>

            <p>
                Der Link ist 30 Minuten gültig.
            </p>

            <p>
                Wenn du den Reset nicht angefordert hast,
                kannst du diese E-Mail ignorieren.
            </p>
            `
        );
    }

    res.send(
        layout(
            'Reset angefordert',
            `
            <div class="success">
                Falls zu dieser E-Mail ein Konto existiert,
                wurde eine Reset-Mail versendet.
            </div>

            <a class="btn" href="/login">
                Zum Login
            </a>
            `
        )
    );
});

app.get('/reset-password/:token', (req, res) => {

    const resetToken =
        String(req.params.token || '');

    const user =
        getUsers().find(
            u =>
                u.resetToken === resetToken &&
                Number(u.resetExpires || 0) > Date.now()
        );

    if (!user) {
        return res.status(400).send(
            layout(
                'Ungültiger Link',
                `
                <div class="error">
                    ❌ Der Reset-Link ist ungültig
                    oder abgelaufen.
                </div>

                <a class="btn" href="/forgot-password">
                    Neuen Reset-Link anfordern
                </a>
                `
            )
        );
    }

    res.send(
        layout(
            'Neues Passwort',
            `
            <div class="box">

                <h1>🔑 Neues Passwort</h1>

                <form
                    method="POST"
                    action="/reset-password/${esc(resetToken)}"
                >

                    <label>Neues Passwort</label>

                    <input
                        type="password"
                        name="password"
                        minlength="8"
                        required
                    >

                    <label>
                        Neues Passwort wiederholen
                    </label>

                    <input
                        type="password"
                        name="password2"
                        minlength="8"
                        required
                    >

                    <button>
                        Passwort ändern
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post('/reset-password/:token', async (req, res) => {

    const resetToken =
        String(req.params.token || '');

    const password =
        String(req.body.password || '');

    const password2 =
        String(req.body.password2 || '');

    if (
        password.length < 8 ||
        password !== password2
    ) {
        return res.status(400).send(
            layout(
                'Fehler',
                `
                <div class="error">
                    Die Passwörter müssen identisch sein
                    und mindestens 8 Zeichen haben.
                </div>

                <a
                    class="btn"
                    href="/reset-password/${esc(resetToken)}"
                >
                    Zurück
                </a>
                `
            )
        );
    }

    const users =
        getUsers();

    const index =
        users.findIndex(
            u =>
                u.resetToken === resetToken &&
                Number(u.resetExpires || 0) > Date.now()
        );

    if (index === -1) {
        return res.status(400).send(
            layout(
                'Fehler',
                `
                <div class="error">
                    Der Reset-Link ist ungültig
                    oder abgelaufen.
                </div>
                `
            )
        );
    }

    users[index].passwordHash =
        await bcrypt.hash(password, 12);

    delete users[index].resetToken;
    delete users[index].resetExpires;

    write(USERS_FILE, users);

    res.send(
        layout(
            'Passwort geändert',
            `
            <div class="success">
                ✅ Dein Passwort wurde erfolgreich geändert.
            </div>

            <a class="btn" href="/login">
                Jetzt anmelden
            </a>
            `
        )
    );
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get('/dashboard', auth, (req, res) => {

    const user =
        currentUser(req);

    const orders =
        getOrders().filter(
            o => o.userId === user.id
        );

    const servers =
        getServers().filter(
            s => s.ownerId === user.id
        );

    res.send(
        layout(
            'Dashboard',
            `
            <div class="hero">

                <h1>
                    👋 Hallo ${esc(user.name)}
                </h1>

                <p>
                    Deine E-Mail:
                    ${esc(user.email)}
                </p>

            </div>

            <div class="grid">

                <div class="card">

                    <h2>🆓 Server bestellen</h2>

                    <p>
                        Kostenlosen Minecraft-Server
                        beantragen.
                    </p>

                    <a
                        class="btn"
                        href="/orders"
                    >
                        Bestellung
                    </a>

                </div>

                <div class="card">

                    <h2>📋 Bestellungen</h2>

                    <p>
                        ${orders.length}
                        Bestellung(en)
                    </p>

                    <a
                        class="btn"
                        href="/orders"
                    >
                        Anzeigen
                    </a>

                </div>

                <div class="card">

                    <h2>🖥️ Server</h2>

                    <p>
                        ${servers.length}
                        Server
                    </p>

                    <a
                        class="btn"
                        href="/servers"
                    >
                        Anzeigen
                    </a>

                </div>

                <div class="card">

                    <h2>📝 Bewerbungen</h2>

                    <p>
                        Moderator oder Developer
                    </p>

                    <a
                        class="btn"
                        href="/applications"
                    >
                        Bewerbung
                    </a>

                </div>

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   SERVER ORDER
========================================================= */

app.get('/orders', auth, (req, res) => {

    const user =
        currentUser(req);

    const orders =
        getOrders().filter(
            o => o.userId === user.id
        );

    res.send(
        layout(
            'Bestellungen',
            `
            <div class="box">

                <h1>🆓 Minecraft-Server bestellen</h1>

                <div class="success">
                    Die Bestellung ist kostenlos.
                    Ein Admin oder Owner muss sie
                    vor der Server-Erstellung annehmen.
                </div>

                <form
                    method="POST"
                    action="/orders"
                >

                    <label>Servername</label>

                    <input
                        name="serverName"
                        maxlength="40"
                        required
                    >

                    <label>Minecraft-Version</label>

                    <select name="version">

                        <option value="1.21.8">
                            1.21.8
                        </option>

                        <option value="1.21.7">
                            1.21.7
                        </option>

                        <option value="1.21.6">
                            1.21.6
                        </option>

                        <option value="1.20.6">
                            1.20.6
                        </option>

                    </select>

                    <label>Beschreibung</label>

                    <textarea
                        name="reason"
                        maxlength="3000"
                        placeholder="Beschreibe deinen Server..."
                    ></textarea>

                    <button>
                        🆓 Bestellung absenden
                    </button>

                </form>

            </div>

            <div class="box">

                <h2>📋 Meine Bestellungen</h2>

                ${
                    orders.length
                    ? orders.map(order => `
                        <div class="card">

                            <h3>
                                ⛏️
                                ${esc(order.serverName)}
                            </h3>

                            <p>
                                Version:
                                ${esc(order.version)}
                            </p>

                            <p>
                                Status:

                                <span class="status ${
                                    order.status === 'wartend'
                                    ? 'waiting'
                                    : order.status === 'angenommen'
                                    ? 'accepted'
                                    : 'rejected'
                                }">
                                    ${esc(order.status)}
                                </span>
                            </p>

                            <p class="small">
                                Erstellt:
                                ${esc(order.createdAt)}
                            </p>

                            ${
                                order.status === 'angenommen'
                                ? `
                                <div class="success">
                                    ✅ Angenommen.
                                    ${
                                        order.serverId
                                        ? `
                                        <a href="/servers/${esc(order.serverId)}">
                                            Server öffnen
                                        </a>
                                        `
                                        : ''
                                    }
                                </div>
                                `
                                : ''
                            }

                            ${
                                order.status === 'abgelehnt'
                                ? `
                                <div class="error">
                                    ❌ Diese Bestellung wurde abgelehnt.
                                    Es wurden keine Coins abgezogen.
                                </div>
                                `
                                : ''
                            }

                        </div>
                    `).join('')
                    : `
                    <p>
                        Keine Bestellungen vorhanden.
                    </p>
                    `
                }

            </div>
            `,
            user
        )
    );
});

app.post('/orders', auth, (req, res) => {

    const user =
        currentUser(req);

    const serverName =
        String(req.body.serverName || '')
            .trim()
            .replace(/[^\wäöüÄÖÜß ._-]/g, '')
            .slice(0, 40);

    const version =
        String(
            req.body.version || '1.21.8'
        );

    const reason =
        String(
            req.body.reason || ''
        ).slice(0, 3000);

    if (!serverName) {
        return res.status(400).send(
            layout(
                'Fehler',
                `
                <div class="error">
                    Servername fehlt.
                </div>
                `,
                user
            )
        );
    }

    const orders =
        getOrders();

    orders.push({
        id: id('order'),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        serverName,
        version,
        reason,
        status: 'wartend',
        serverId: null,
        createdAt: new Date().toISOString(),
        processedAt: null,
        processedBy: null
    });

    write(ORDERS_FILE, orders);

    res.redirect('/orders');
});

/* =========================================================
   SERVERS
========================================================= */

app.get('/servers', auth, (req, res) => {

    const user =
        currentUser(req);

    const servers =
        getServers().filter(
            server =>
                server.ownerId === user.id
        );

    res.send(
        layout(
            'Meine Server',
            `
            <div class="box">

                <h1>🖥️ Meine Server</h1>

                ${
                    servers.length
                    ? servers.map(server => `
                        <div class="card">

                            <h2>
                                ⛏️
                                ${esc(server.name)}
                            </h2>

                            <p>
                                Version:
                                ${esc(server.version)}
                            </p>

                            <p>
                                Status:

                                <span class="status ${
                                    server.status === 'online'
                                    ? 'online'
                                    : 'offline'
                                }">
                                    ${esc(server.status)}
                                </span>
                            </p>

                            ${
                                server.locked
                                ? `
                                <div class="error">
                                    🔒 Server wurde gesperrt.
                                </div>
                                `
                                : ''
                            }

                            <a
                                class="btn"
                                href="/servers/${esc(server.id)}"
                            >
                                Verwalten
                            </a>

                        </div>
                    `).join('')
                    : `
                    <p>
                        Du hast noch keinen freigeschalteten Server.
                    </p>

                    <a
                        class="btn"
                        href="/orders"
                    >
                        Server bestellen
                    </a>
                    `
                }

            </div>
            `,
            user
        )
    );
});

app.get('/servers/:id', auth, (req, res) => {

    const user =
        currentUser(req);

    const server =
        getServers().find(
            s =>
                s.id === req.params.id &&
                s.ownerId === user.id
        );

    if (!server) {
        return res.status(404).send(
            layout(
                'Nicht gefunden',
                `
                <div class="error">
                    Server nicht gefunden.
                </div>
                `,
                user
            )
        );
    }

    res.send(
        layout(
            server.name,
            `
            <div class="box">

                <h1>
                    ⛏️ ${esc(server.name)}
                </h1>

                <p>
                    Version:
                    ${esc(server.version)}
                </p>

                <p>
                    Status:
                    <span class="status ${
                        server.status === 'online'
                        ? 'online'
                        : 'offline'
                    }">
                        ${esc(server.status)}
                    </span>
                </p>

                ${
                    server.locked
                    ? `
                    <div class="error">
                        🔒 Dieser Server wurde gesperrt.
                    </div>
                    `
                    : `
                    <form
                        method="POST"
                        action="/servers/${server.id}/start"
                        style="display:inline"
                    >
                        <button class="green">
                            ▶ Start
                        </button>
                    </form>

                    <form
                        method="POST"
                        action="/servers/${server.id}/stop"
                        style="display:inline"
                    >
                        <button class="red">
                            ■ Stop
                        </button>
                    </form>

                    <form
                        method="POST"
                        action="/servers/${server.id}/restart"
                        style="display:inline"
                    >
                        <button>
                            🔄 Neustart
                        </button>
                    </form>
                    `
                }

            </div>
            `,
            user
        )
    );
});

function getOwnedServer(req) {

    const user =
        currentUser(req);

    return getServers().find(
        server =>
            server.id === req.params.id &&
            server.ownerId === user.id
    );
}

app.post('/servers/:id/start', auth, (req, res) => {

    const server =
        getOwnedServer(req);

    if (!server) {
        return res.status(404).send(
            'Server nicht gefunden'
        );
    }

    if (server.locked) {
        return res.status(403).send(
            'Server ist gesperrt'
        );
    }

    const servers =
        getServers();

    const index =
        servers.findIndex(
            s => s.id === server.id
        );

    servers[index].status =
        'online';

    write(SERVERS_FILE, servers);

    res.redirect(`/servers/${server.id}`);
});

app.post('/servers/:id/stop', auth, (req, res) => {

    const server =
        getOwnedServer(req);

    if (!server) {
        return res.status(404).send(
            'Server nicht gefunden'
        );
    }

    const servers =
        getServers();

    const index =
        servers.findIndex(
            s => s.id === server.id
        );

    servers[index].status =
        'offline';

    write(SERVERS_FILE, servers);

    res.redirect(`/servers/${server.id}`);
});

app.post('/servers/:id/restart', auth, (req, res) => {

    const server =
        getOwnedServer(req);

    if (!server) {
        return res.status(404).send(
            'Server nicht gefunden'
        );
    }

    if (server.locked) {
        return res.status(403).send(
            'Server ist gesperrt'
        );
    }

    const servers =
        getServers();

    const index =
        servers.findIndex(
            s => s.id === server.id
        );

    servers[index].status =
        'restarting';

    write(SERVERS_FILE, servers);

    setTimeout(() => {

        const updated =
            getServers();

        const current =
            updated.find(
                s => s.id === server.id
            );

        if (current && !current.locked) {
            current.status =
                'online';

            write(
                SERVERS_FILE,
                updated
            );
        }

    }, 1500);

    res.redirect(`/servers/${server.id}`);
});

/* =========================================================
   APPLICATIONS
========================================================= */

app.get('/applications', auth, (req, res) => {

    const user =
        currentUser(req);

    const applications =
        getApplications().filter(
            a => a.userId === user.id
        );

    res.send(
        layout(
            'Bewerbungen',
            `
            <div class="box">

                <h1>📝 Team-Bewerbung</h1>

                <form
                    method="POST"
                    action="/applications"
                >

                    <label>
                        Bewerbung für
                    </label>

                    <select name="type">

                        <option value="moderator">
                            Moderator
                        </option>

                        <option value="developer">
                            Developer
                        </option>

                    </select>

                    <label>
                        Warum möchtest du ins Team?
                    </label>

                    <textarea
                        name="text"
                        maxlength="5000"
                        required
                    ></textarea>

                    <button>
                        Bewerbung absenden
                    </button>

                </form>

            </div>

            <div class="box">

                <h2>Meine Bewerbungen</h2>

                ${
                    applications.length
                    ? applications.map(a => `
                        <div class="card">

                            <h3>
                                ${esc(a.type)}
                            </h3>

                            <p>
                                Status:
                                <span class="status">
                                    ${esc(a.status)}
                                </span>
                            </p>

                            <p>
                                ${esc(a.text)}
                            </p>

                        </div>
                    `).join('')
                    : '<p>Noch keine Bewerbung.</p>'
                }

            </div>
            `,
            user
        )
    );
});

app.post('/applications', auth, (req, res) => {

    const user =
        currentUser(req);

    const type =
        req.body.type === 'developer'
        ? 'developer'
        : 'moderator';

    const text =
        String(
            req.body.text || ''
        ).slice(0, 5000);

    if (!text.trim()) {
        return res.status(400).send(
            'Bewerbung darf nicht leer sein.'
        );
    }

    const applications =
        getApplications();

    applications.push({
        id: id('application'),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        type,
        text,
        status: 'offen',
        createdAt: new Date().toISOString(),
        processedBy: null,
        processedAt: null
    });

    write(
        APPLICATIONS_FILE,
        applications
    );

    res.redirect('/applications');
});

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get('/admin', adminAuth, (req, res) => {

    const user =
        currentUser(req);

    const users =
        getUsers();

    const orders =
        getOrders();

    const servers =
        getServers();

    const applications =
        getApplications();

    res.send(
        layout(
            'Admin Panel',
            `
            <div class="hero">

                <h1>👑 Admin Panel</h1>

                <p>
                    Angemeldet als:
                    ${esc(user.email)}
                </p>

            </div>

            <div class="grid">

                <div class="card">
                    <h2>👥 Benutzer</h2>
                    <h1>${users.length}</h1>
                </div>

                <div class="card">
                    <h2>📋 Bestellungen</h2>
                    <h1>${orders.length}</h1>
                </div>

                <div class="card">
                    <h2>🖥️ Server</h2>
                    <h1>${servers.length}</h1>
                </div>

                <div class="card">
                    <h2>📝 Bewerbungen</h2>
                    <h1>${applications.length}</h1>
                </div>

            </div>

            <div class="box">

                <h2>📋 Server-Bestellungen</h2>

                ${
                    orders.length
                    ? orders.map(order => `

                        <div class="card">

                            <h3>
                                ⛏️
                                ${esc(order.serverName)}
                            </h3>

                            <p>
                                Benutzer:
                                ${esc(order.userName)}
                            </p>

                            <p>
                                E-Mail:
                                ${esc(order.userEmail)}
                            </p>

                            <p>
                                Version:
                                ${esc(order.version)}
                            </p>

                            <p>
                                Status:
                                ${esc(order.status)}
                            </p>

                            ${
                                order.status === 'wartend'
                                ? `

                                <form
                                    method="POST"
                                    action="/admin/orders/${order.id}/accept"
                                    style="display:inline"
                                >
                                    <button class="green">
                                        ✅ Annehmen
                                    </button>
                                </form>

                                <form
                                    method="POST"
                                    action="/admin/orders/${order.id}/reject"
                                    style="display:inline"
                                >
                                    <button class="red">
                                        ❌ Ablehnen
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
                                ${esc(application.type)}
                            </h3>

                            <p>
                                ${esc(application.userName)}
                                –
                                ${esc(application.userEmail)}
                            </p>

                            <p>
                                ${esc(application.text)}
                            </p>

                            <p>
                                Status:
                                ${esc(application.status)}
                            </p>

                            ${
                                application.status === 'offen'
                                ? `

                                <form
                                    method="POST"
                                    action="/admin/applications/${application.id}/accept"
                                    style="display:inline"
                                >
                                    <button class="green">
                                        ✅ Annehmen
                                    </button>
                                </form>

                                <form
                                    method="POST"
                                    action="/admin/applications/${application.id}/reject"
                                    style="display:inline"
                                >
                                    <button class="red">
                                        ❌ Ablehnen
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

                <h2>👥 Benutzerverwaltung</h2>

                <table>

                    <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Status</th>
                        <th>Aktion</th>
                    </tr>

                    ${
                        users.map(target => `

                            <tr>

                                <td>
                                    ${esc(target.name)}
                                </td>

                                <td>
                                    ${esc(target.email)}
                                </td>

                                <td>
                                    ${esc(target.role)}
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
                                        owner(target)
                                        ? '<strong>OWNER</strong>'
                                        : `
                                        <form
                                            method="POST"
                                            action="/admin/users/${target.id}/ban"
                                        >
                                            <button class="red">
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

                <h2>🖥️ Serververwaltung</h2>

                ${
                    servers.length
                    ? servers.map(server => `

                        <div class="card">

                            <h3>
                                ${esc(server.name)}
                            </h3>

                            <p>
                                Besitzer:
                                ${esc(server.ownerEmail || '')}
                            </p>

                            <p>
                                Status:
                                ${esc(server.status)}
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
                                action="/admin/servers/${server.id}/lock"
                                style="display:inline"
                            >
                                <button>
                                    ${
                                        server.locked
                                        ? '🔓 Entsperren'
                                        : '🔒 Sperren'
                                    }
                                </button>
                            </form>

                            <form
                                method="POST"
                                action="/admin/servers/${server.id}/shutdown"
                                style="display:inline"
                            >
                                <button class="red">
                                    ⛔ Herunterfahren
                                </button>
                            </form>

                            <form
                                method="POST"
                                action="/admin/servers/${server.id}/delete"
                                style="display:inline"
                                onsubmit="return confirm('Server wirklich löschen?')"
                            >
                                <button class="red">
                                    🗑️ Löschen
                                </button>
                            </form>

                        </div>

                    `).join('')
                    : '<p>Keine Server vorhanden.</p>'
                }

            </div>
            `,
            user
        )
    );
});

/* =========================================================
   ADMIN ORDER ACCEPT
========================================================= */

app.post(
    '/admin/orders/:id/accept',
    adminAuth,
    async (req, res) => {

        const adminUser =
            currentUser(req);

        const orders =
            getOrders();

        const index =
            orders.findIndex(
                order =>
                    order.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        const order =
            orders[index];

        if (order.status !== 'wartend') {
            return res.redirect('/admin');
        }

        const servers =
            getServers();

        const server = {
            id: id('server'),
            ownerId: order.userId,
            ownerEmail: order.userEmail,
            name: order.serverName,
            version: order.version,
            status: 'offline',
            locked: false,
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            approvedBy: adminUser.email
        };

        servers.push(server);

        write(
            SERVERS_FILE,
            servers
        );

        order.status =
            'angenommen';

        order.serverId =
            server.id;

        order.processedBy =
            adminUser.email;

        order.processedAt =
            new Date().toISOString();

        write(
            ORDERS_FILE,
            orders
        );

        await sendMail(
            order.userEmail,
            'Deine Minecraft-Server-Bestellung wurde angenommen',
            `
            <h2>✅ Bestellung angenommen</h2>

            <p>
                Deine Bestellung
                <strong>${esc(order.serverName)}</strong>
                wurde angenommen.
            </p>

            <p>
                Dein Server ist jetzt im Dashboard verfügbar.
            </p>

            <p>
                <a href="${esc(BASE_URL)}/servers/${esc(server.id)}">
                    Server öffnen
                </a>
            </p>
            `
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN ORDER REJECT
========================================================= */

app.post(
    '/admin/orders/:id/reject',
    adminAuth,
    async (req, res) => {

        const adminUser =
            currentUser(req);

        const orders =
            getOrders();

        const index =
            orders.findIndex(
                order =>
                    order.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        const order =
            orders[index];

        if (order.status !== 'wartend') {
            return res.redirect('/admin');
        }

        /*
         * Server sind kostenlos.
         * Deshalb werden keine Coins abgezogen.
         */

        order.status =
            'abgelehnt';

        order.processedBy =
            adminUser.email;

        order.processedAt =
            new Date().toISOString();

        write(
            ORDERS_FILE,
            orders
        );

        await sendMail(
            order.userEmail,
            'Deine Minecraft-Server-Bestellung wurde abgelehnt',
            `
            <h2>❌ Bestellung abgelehnt</h2>

            <p>
                Deine Bestellung
                <strong>${esc(order.serverName)}</strong>
                wurde abgelehnt.
            </p>

            <p>
                Es wurden keine Coins abgezogen,
                da die Bestellung kostenlos war.
            </p>
            `
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN USER BAN
========================================================= */

app.post(
    '/admin/users/:id/ban',
    adminAuth,
    (req, res) => {

        const actingUser =
            currentUser(req);

        const users =
            getUsers();

        const index =
            users.findIndex(
                user =>
                    user.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Benutzer nicht gefunden'
            );
        }

        const target =
            users[index];

        if (owner(target)) {
            return res.status(403).send(
                'Der Owner kann nicht gesperrt werden.'
            );
        }

        if (
            target.role === 'admin' &&
            !owner(actingUser)
        ) {
            return res.status(403).send(
                'Nur der Owner kann Admins verwalten.'
            );
        }

        target.banned =
            !target.banned;

        write(
            USERS_FILE,
            users
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN APPLICATION ACCEPT
========================================================= */

app.post(
    '/admin/applications/:id/accept',
    adminAuth,
    async (req, res) => {

        const adminUser =
            currentUser(req);

        const applications =
            getApplications();

        const index =
            applications.findIndex(
                a =>
                    a.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'angenommen';

        applications[index].processedBy =
            adminUser.email;

        applications[index].processedAt =
            new Date().toISOString();

        write(
            APPLICATIONS_FILE,
            applications
        );

        await sendMail(
            applications[index].userEmail,
            'Deine Teambewerbung wurde angenommen',
            `
            <h2>✅ Bewerbung angenommen</h2>

            <p>
                Deine Bewerbung als
                <strong>
                    ${esc(applications[index].type)}
                </strong>
                wurde angenommen.
            </p>
            `
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN APPLICATION REJECT
========================================================= */

app.post(
    '/admin/applications/:id/reject',
    adminAuth,
    async (req, res) => {

        const adminUser =
            currentUser(req);

        const applications =
            getApplications();

        const index =
            applications.findIndex(
                a =>
                    a.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'abgelehnt';

        applications[index].processedBy =
            adminUser.email;

        applications[index].processedAt =
            new Date().toISOString();

        write(
            APPLICATIONS_FILE,
            applications
        );

        await sendMail(
            applications[index].userEmail,
            'Deine Teambewerbung wurde abgelehnt',
            `
            <h2>❌ Bewerbung abgelehnt</h2>

            <p>
                Deine Bewerbung als
                <strong>
                    ${esc(applications[index].type)}
                </strong>
                wurde leider abgelehnt.
            </p>
            `
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER LOCK
========================================================= */

app.post(
    '/admin/servers/:id/lock',
    adminAuth,
    (req, res) => {

        const servers =
            getServers();

        const index =
            servers.findIndex(
                server =>
                    server.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].locked =
            !servers[index].locked;

        if (servers[index].locked) {
            servers[index].status =
                'offline';
        }

        write(
            SERVERS_FILE,
            servers
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER SHUTDOWN
========================================================= */

app.post(
    '/admin/servers/:id/shutdown',
    adminAuth,
    (req, res) => {

        const servers =
            getServers();

        const index =
            servers.findIndex(
                server =>
                    server.id === req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].status =
            'offline';

        write(
            SERVERS_FILE,
            servers
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER DELETE
========================================================= */

app.post(
    '/admin/servers/:id/delete',
    adminAuth,
    (req, res) => {

        const servers =
            getServers();

        const exists =
            servers.some(
                server =>
                    server.id === req.params.id
            );

        if (!exists) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        const updated =
            servers.filter(
                server =>
                    server.id !== req.params.id
            );

        write(
            SERVERS_FILE,
            updated
        );

        res.redirect('/admin');
    }
);

/* =========================================================
   ERROR / 404
========================================================= */

app.use((req, res) => {

    res.status(404).send(
        layout(
            '404',
            `
            <div class="error">

                <h1>404</h1>

                <p>
                    Diese Seite wurde nicht gefunden.
                </p>

            </div>

            <a
                class="btn"
                href="/"
            >
                Startseite
            </a>
            `
        )
    );
});

app.use((error, req, res, next) => {

    console.error('================================');
    console.error('❌ SERVER FEHLER');
    console.error(error);
    console.error('================================');

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send(
        layout(
            'Serverfehler',
            `
            <div class="error">

                <h1>❌ Fehler</h1>

                <p>
                    Bei der Verarbeitung ist ein Fehler
                    aufgetreten.
                </p>

            </div>
            `
        )
    );
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, async () => {

    console.log('');
    console.log('========================================');
    console.log('⛏️ MINECRAFT HOSTING');
    console.log('========================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`👑 Owner: ${OWNER_EMAIL}`);
    console.log(
        `📧 Gmail: ${
            mailer
            ? 'konfiguriert'
            : 'NICHT konfiguriert'
        }`
    );
    console.log('🆓 Server: kostenlos');
    console.log('👑 Freigabe: Admin / Owner');
    console.log('🔐 Passwort-Reset: aktiviert');
    console.log('========================================');
    console.log('');

    if (mailer) {
        await verifyMail();
    }
});
