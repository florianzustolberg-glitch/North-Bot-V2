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
const OWNER_EMAIL = (
    process.env.OWNER_EMAIL ||
    'florianzustolberg@gmail.com'
).toLowerCase();

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    'CHANGE_ME_TO_A_LONG_RANDOM_SECRET';

const DATA_DIR = path.join(__dirname, 'data');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const ORDERS_FILE = path.join(DATA_DIR, 'server-orders.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(defaultValue, null, 2),
            'utf8'
        );
    }
}

createFile(USERS_FILE, []);
createFile(SERVERS_FILE, []);
createFile(ORDERS_FILE, []);

function readJSON(file) {
    try {
        const content = fs.readFileSync(file, 'utf8');

        if (!content.trim()) {
            return [];
        }

        return JSON.parse(content);
    } catch (error) {
        console.error('JSON-Fehler:', file, error.message);
        return [];
    }
}

function writeJSON(file, data) {
    const temp = file + '.tmp';

    fs.writeFileSync(
        temp,
        JSON.stringify(data, null, 2),
        'utf8'
    );

    fs.renameSync(temp, file);
}

function makeId(prefix) {
    return (
        prefix +
        '_' +
        Date.now().toString(36) +
        '_' +
        crypto.randomBytes(6).toString('hex')
    );
}

function makeToken() {
    return crypto.randomBytes(32).toString('hex');
}

function email(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function escape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getUsers() {
    return readJSON(USERS_FILE);
}

function saveUsers(users) {
    writeJSON(USERS_FILE, users);
}

function getServers() {
    return readJSON(SERVERS_FILE);
}

function saveServers(servers) {
    writeJSON(SERVERS_FILE, servers);
}

function getOrders() {
    return readJSON(ORDERS_FILE);
}

function saveOrders(orders) {
    writeJSON(ORDERS_FILE, orders);
}

function findUserByEmail(userEmail) {
    return getUsers().find(
        user => email(user.email) === email(userEmail)
    );
}

function findUserById(userId) {
    return getUsers().find(
        user => user.id === userId
    );
}

function getCurrentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return findUserById(req.session.userId);
}

function isOwner(user) {
    return (
        user &&
        email(user.email) === OWNER_EMAIL
    );
}

function isAdmin(user) {
    return (
        user &&
        (
            isOwner(user) ||
            user.role === 'admin'
        )
    );
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
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

/* =========================================================
   MAIL
========================================================= */

let transporter = null;

if (
    process.env.GMAIL_USER &&
    process.env.GMAIL_APP_PASSWORD
) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

async function sendMail(to, subject, html) {
    if (!transporter) {
        console.log(
            'Gmail ist nicht konfiguriert.'
        );

        return false;
    }

    try {
        await transporter.sendMail({
            from:
                `"Minecraft Hosting" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html
        });

        return true;
    } catch (error) {
        console.error(
            'E-Mail Fehler:',
            error.message
        );

        return false;
    }
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (user.banned) {
        req.session.destroy(() => {});

        return res.status(403).send(
            page(
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

function requireAdmin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            page(
                'Kein Zugriff',
                `
                <div class="error">
                    🚫 Du hast keinen Zugriff auf diesen Bereich.
                </div>
                `
            )
        );
    }

    next();
}

/* =========================================================
   HTML
========================================================= */

function page(title, body, user = null) {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>${escape(title)} - Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #090d12;
    color: #fff;
}

nav {
    background: #111821;
    border-bottom: 1px solid #293441;
    padding: 15px 25px;

    display: flex;
    justify-content: space-between;
    align-items: center;

    gap: 15px;
    flex-wrap: wrap;
}

.logo {
    font-size: 20px;
    font-weight: bold;
}

.navlinks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.navlinks a {
    color: white;
    text-decoration: none;
    padding: 9px 12px;
    background: #1a2430;
    border-radius: 8px;
}

.navlinks a:hover {
    background: #293746;
}

main {
    width: min(1200px, 94%);
    margin: 35px auto;
}

.hero {
    background: #111a24;
    border: 1px solid #293746;
    border-radius: 18px;
    padding: 40px;
    margin-bottom: 20px;
}

.hero h1 {
    font-size: 40px;
    margin-top: 0;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
}

.card,
.box {
    background: #111821;
    border: 1px solid #293441;
    border-radius: 14px;
    padding: 20px;
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
    background: #080d12;
    color: white;
    border: 1px solid #344251;
    border-radius: 8px;
    padding: 12px;
    margin-top: 6px;
    margin-bottom: 15px;
}

textarea {
    min-height: 130px;
}

button,
.btn {
    display: inline-block;
    background: #287cff;
    color: white;
    border: 0;
    border-radius: 8px;
    padding: 11px 15px;
    cursor: pointer;
    font-weight: bold;
    text-decoration: none;
}

button:hover,
.btn:hover {
    filter: brightness(1.15);
}

.green {
    background: #20834d;
}

.red {
    background: #c73d3d;
}

.gray {
    background: #3a4653;
}

.status {
    display: inline-block;
    border-radius: 999px;
    padding: 6px 10px;
    background: #354251;
}

.status.waiting {
    background: #765f22;
}

.status.accepted {
    background: #217546;
}

.status.rejected {
    background: #783333;
}

.status.online {
    background: #217546;
}

.status.offline {
    background: #673232;
}

.error {
    background: #481f23;
    border: 1px solid #853b43;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 15px;
}

.success {
    background: #173e2a;
    border: 1px solid #2a7950;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 15px;
}

.warning {
    background: #4a3918;
    border: 1px solid #80682a;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 15px;
}

.coins {
    color: #ffd65a;
    font-weight: bold;
}

.small {
    color: #aeb8c2;
    font-size: 14px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 10px;
    border-bottom: 1px solid #2a3541;
    text-align: left;
}

footer {
    color: #78838f;
    text-align: center;
    padding: 40px;
}

</style>
</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Hosting
</div>

<div class="navlinks">

<a href="/">Home</a>

${
    user
    ? `
        <a href="/dashboard">Dashboard</a>
        <a href="/servers">Server</a>
        <a href="/orders">Bestellungen</a>
        <a href="/applications">Bewerbung</a>

        ${
            isAdmin(user)
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

    const user = getCurrentUser(req);

    res.send(
        page(
            'Home',
            `
            <div class="hero">

                <h1>⛏️ Minecraft Hosting</h1>

                <p>
                    Kostenlosen Minecraft-Server beantragen
                    und nach Freigabe verwalten.
                </p>

                ${
                    user
                    ? `
                    <a
                        class="btn"
                        href="/dashboard"
                    >
                        Dashboard öffnen
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
                        Server-Bestellungen kosten keine Coins.
                    </p>
                </div>

                <div class="card">
                    <h2>👑 Freigabe</h2>
                    <p>
                        Jeder Server muss zuerst von
                        einem Admin angenommen werden.
                    </p>
                </div>

                <div class="card">
                    <h2>📧 Passwort Reset</h2>
                    <p>
                        Passwort vergessen?
                        Einfach per E-Mail zurücksetzen.
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

    if (getCurrentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(
        page(
            'Registrieren',
            `
            <div class="box">

                <h1>📝 Registrierung</h1>

                <form
                    method="POST"
                    action="/register"
                >

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

                    <button type="submit">
                        Konto erstellen
                    </button>

                </form>

                <p>
                    Bereits registriert?
                    <a href="/login">
                        Jetzt anmelden
                    </a>
                </p>

            </div>
            `
        )
    );
});

app.post('/register', async (req, res) => {

    const name =
        String(req.body.name || '')
            .trim();

    const userEmail =
        email(req.body.email);

    const password =
        String(req.body.password || '');

    if (
        !name ||
        !userEmail ||
        password.length < 8
    ) {
        return res.status(400).send(
            page(
                'Fehler',
                `
                <div class="error">
                    Bitte alle Felder korrekt ausfüllen.
                    Das Passwort muss mindestens
                    8 Zeichen haben.
                </div>

                <a
                    class="btn"
                    href="/register"
                >
                    Zurück
                </a>
                `
            )
        );
    }

    if (findUserByEmail(userEmail)) {
        return res.status(409).send(
            page(
                'Fehler',
                `
                <div class="error">
                    Diese E-Mail ist bereits registriert.
                </div>

                <a
                    class="btn"
                    href="/login"
                >
                    Zum Login
                </a>
                `
            )
        );
    }

    const users = getUsers();

    const passwordHash =
        await bcrypt.hash(
            password,
            12
        );

    const newUser = {
        id: makeId('user'),
        name,
        email: userEmail,
        passwordHash,
        coins: 0,
        role:
            userEmail === OWNER_EMAIL
            ? 'owner'
            : 'user',
        banned: false,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    saveUsers(users);

    req.session.userId =
        newUser.id;

    res.redirect('/dashboard');
});

/* =========================================================
   LOGIN
========================================================= */

app.get('/login', (req, res) => {

    if (getCurrentUser(req)) {
        return res.redirect('/dashboard');
    }

    res.send(
        page(
            'Login',
            `
            <div class="box">

                <h1>🔐 Anmeldung</h1>

                <form
                    method="POST"
                    action="/login"
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
                    >

                    <button type="submit">
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
        email(req.body.email);

    const password =
        String(req.body.password || '');

    const user =
        findUserByEmail(userEmail);

    if (!user) {
        return res.status(401).send(
            page(
                'Login',
                `
                <div class="error">
                    E-Mail oder Passwort falsch.
                </div>

                <a
                    class="btn"
                    href="/login"
                >
                    Zurück
                </a>
                `
            )
        );
    }

    if (user.banned) {
        return res.status(403).send(
            page(
                'Gesperrt',
                `
                <div class="error">
                    🚫 Dein Konto ist gesperrt.
                </div>
                `
            )
        );
    }

    const valid =
        await bcrypt.compare(
            password,
            user.passwordHash
        );

    if (!valid) {
        return res.status(401).send(
            page(
                'Login',
                `
                <div class="error">
                    E-Mail oder Passwort falsch.
                </div>

                <a
                    class="btn"
                    href="/login"
                >
                    Zurück
                </a>
                `
            )
        );
    }

    req.session.userId =
        user.id;

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
   PASSWORD RESET
========================================================= */

app.get('/forgot-password', (req, res) => {

    res.send(
        page(
            'Passwort vergessen',
            `
            <div class="box">

                <h1>🔄 Passwort zurücksetzen</h1>

                <p>
                    Gib deine E-Mail-Adresse ein.
                    Wenn ein Konto existiert,
                    senden wir einen Reset-Link.
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

                    <button type="submit">
                        Reset-Link senden
                    </button>

                </form>

            </div>
            `
        )
    );
});

app.post('/forgot-password', async (req, res) => {

    const userEmail =
        email(req.body.email);

    const users =
        getUsers();

    const index =
        users.findIndex(
            user =>
                email(user.email) ===
                userEmail
        );

    if (index !== -1) {

        const token =
            makeToken();

        users[index].resetToken =
            token;

        users[index].resetExpires =
            Date.now() +
            30 * 60 * 1000;

        saveUsers(users);

        const baseURL =
            process.env.BASE_URL ||
            `http://localhost:${PORT}`;

        const resetURL =
            `${baseURL}/reset-password/${token}`;

        await sendMail(
            users[index].email,
            'Minecraft Hosting – Passwort zurücksetzen',
            `
            <h2>Passwort zurücksetzen</h2>

            <p>
                Hallo ${escape(users[index].name)}!
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
                Dieser Link ist 30 Minuten gültig.
            </p>
            `
        );
    }

    res.send(
        page(
            'Reset',
            `
            <div class="success">
                Falls die E-Mail registriert ist,
                wurde ein Reset-Link verschickt.
            </div>

            <a
                class="btn"
                href="/login"
            >
                Zum Login
            </a>
            `
        )
    );
});

app.get(
    '/reset-password/:token',
    (req, res) => {

        const token =
            String(req.params.token || '');

        const user =
            getUsers().find(
                u =>
                    u.resetToken === token &&
                    Number(u.resetExpires || 0) >
                    Date.now()
            );

        if (!user) {
            return res.status(400).send(
                page(
                    'Reset ungültig',
                    `
                    <div class="error">
                        Dieser Reset-Link ist ungültig
                        oder abgelaufen.
                    </div>

                    <a
                        class="btn"
                        href="/forgot-password"
                    >
                        Neuen Link anfordern
                    </a>
                    `
                )
            );
        }

        res.send(
            page(
                'Neues Passwort',
                `
                <div class="box">

                    <h1>🔑 Neues Passwort</h1>

                    <form
                        method="POST"
                        action="/reset-password/${escape(token)}"
                    >

                        <label>
                            Neues Passwort
                        </label>

                        <input
                            type="password"
                            name="password"
                            minlength="8"
                            required
                        >

                        <label>
                            Passwort wiederholen
                        </label>

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
            )
        );
    }
);

app.post(
    '/reset-password/:token',
    async (req, res) => {

        const token =
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
                page(
                    'Fehler',
                    `
                    <div class="error">
                        Die Passwörter müssen identisch
                        sein und mindestens 8 Zeichen haben.
                    </div>

                    <a
                        class="btn"
                        href="javascript:history.back()"
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
                    u.resetToken === token &&
                    Number(u.resetExpires || 0) >
                    Date.now()
            );

        if (index === -1) {
            return res.status(400).send(
                page(
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
            await bcrypt.hash(
                password,
                12
            );

        delete users[index].resetToken;
        delete users[index].resetExpires;

        saveUsers(users);

        res.send(
            page(
                'Erfolgreich',
                `
                <div class="success">
                    ✅ Dein Passwort wurde geändert.
                </div>

                <a
                    class="btn"
                    href="/login"
                >
                    Jetzt anmelden
                </a>
                `
            )
        );
    }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    '/dashboard',
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const orders =
            getOrders().filter(
                order =>
                    order.userId === user.id
            );

        const servers =
            getServers().filter(
                server =>
                    server.ownerId === user.id
            );

        res.send(
            page(
                'Dashboard',
                `
                <div class="hero">

                    <h1>
                        👋 Hallo
                        ${escape(user.name)}
                    </h1>

                    <p>
                        Willkommen im Minecraft Hosting.
                    </p>

                </div>

                <div class="grid">

                    <div class="card">

                        <h2>🆓 Server beantragen</h2>

                        <p>
                            Beantrage kostenlos einen
                            Minecraft-Server.
                        </p>

                        <a
                            class="btn"
                            href="/orders"
                        >
                            Server bestellen
                        </a>

                    </div>

                    <div class="card">

                        <h2>🖥️ Meine Server</h2>

                        <p>
                            ${servers.length} Server
                        </p>

                        <a
                            class="btn"
                            href="/servers"
                        >
                            Server anzeigen
                        </a>

                    </div>

                    <div class="card">

                        <h2>📋 Bestellungen</h2>

                        <p>
                            ${orders.length} Bestellungen
                        </p>

                        <a
                            class="btn"
                            href="/orders"
                        >
                            Status anzeigen
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
   SERVER ORDER
========================================================= */

app.get(
    '/orders',
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const orders =
            getOrders().filter(
                order =>
                    order.userId === user.id
            );

        res.send(
            page(
                'Server-Bestellungen',
                `
                <div class="box">

                    <h1>
                        🆓 Minecraft-Server bestellen
                    </h1>

                    <div class="success">
                        Die Server-Bestellung ist
                        kostenlos.
                        Der Server wird erst nach
                        einer Freigabe durch einen
                        Admin/Owner erstellt.
                    </div>

                    <form
                        method="POST"
                        action="/orders/server"
                    >

                        <label>
                            Servername
                        </label>

                        <input
                            name="serverName"
                            maxlength="40"
                            placeholder="Mein Server"
                            required
                        >

                        <label>
                            Minecraft-Version
                        </label>

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

                        <label>
                            Grund / Beschreibung
                        </label>

                        <textarea
                            name="reason"
                            maxlength="3000"
                            placeholder="Was möchtest du mit dem Server machen?"
                        ></textarea>

                        <button type="submit">
                            🆓 Server kostenlos bestellen
                        </button>

                    </form>

                </div>

                <div class="box">

                    <h2>
                        📋 Meine Bestellungen
                    </h2>

                    ${
                        orders.length
                        ? orders.map(order => `

                            <div class="card">

                                <h3>
                                    ⛏️
                                    ${escape(order.serverName)}
                                </h3>

                                <p>
                                    Version:
                                    ${escape(order.version)}
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
                                        ${escape(order.status)}
                                    </span>
                                </p>

                                <p class="small">
                                    Bestellung:
                                    ${escape(order.createdAt)}
                                </p>

                                ${
                                    order.status === 'abgelehnt'
                                    ? `
                                    <div class="error">
                                        ❌ Deine Bestellung wurde abgelehnt.
                                    </div>
                                    `
                                    : ''
                                }

                                ${
                                    order.status === 'angenommen'
                                    ? `
                                    <div class="success">
                                        ✅ Deine Bestellung wurde angenommen.
                                        Dein Server wurde freigeschaltet.
                                    </div>
                                    `
                                    : ''
                                }

                            </div>

                        `).join('')
                        : `
                        <p>
                            Du hast noch keine Bestellung.
                        </p>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    '/orders/server',
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const serverName =
            String(
                req.body.serverName || ''
            )
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
            )
            .slice(0, 3000);

        if (!serverName) {
            return res.status(400).send(
                page(
                    'Fehler',
                    `
                    <div class="error">
                        Bitte einen Servernamen eingeben.
                    </div>
                    `,
                    user
                )
            );
        }

        /*
         * Keine Coins werden abgezogen.
         * Server wird erst nach Admin-Freigabe erstellt.
         */

        const orders =
            getOrders();

        orders.push({
            id: makeId('order'),
            userId: user.id,
            userName: user.name,
            userEmail: user.email,

            serverName,
            version,
            reason,

            status: 'wartend',

            createdAt:
                new Date().toISOString(),

            processedAt: null,
            processedBy: null
        });

        saveOrders(orders);

        res.redirect('/orders');
    }
);

/* =========================================================
   SERVER LIST
========================================================= */

app.get(
    '/servers',
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const servers =
            getServers().filter(
                server =>
                    server.ownerId === user.id
            );

        res.send(
            page(
                'Meine Server',
                `
                <div class="box">

                    <h1>🖥️ Meine Server</h1>

                    <p>
                        Server können erst nach
                        einer angenommenen Bestellung
                        hier erscheinen.
                    </p>

                </div>

                ${
                    servers.length
                    ? servers.map(server => `

                        <div class="card">

                            <h2>
                                ⛏️
                                ${escape(server.name)}
                            </h2>

                            <p>
                                Version:
                                ${escape(server.version)}
                            </p>

                            <p>
                                Status:

                                <span class="status ${
                                    server.status === 'online'
                                    ? 'online'
                                    : 'offline'
                                }">
                                    ${escape(server.status)}
                                </span>
                            </p>

                            ${
                                server.locked
                                ? `
                                <div class="error">
                                    🔒 Dieser Server wurde gesperrt.
                                </div>
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
                        <p>
                            Noch keine freigeschalteten Server.
                        </p>
                    </div>
                    `
                }
                `,
                user
            )
        );
    }
);

/* =========================================================
   SERVER MANAGEMENT
========================================================= */

app.get(
    '/servers/:serverId',
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const server =
            getServers().find(
                s =>
                    s.id === req.params.serverId &&
                    s.ownerId === user.id
            );

        if (!server) {
            return res.status(404).send(
                page(
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
            page(
                server.name,
                `
                <div class="box">

                    <h1>
                        ⛏️
                        ${escape(server.name)}
                    </h1>

                    ${
                        server.locked
                        ? `
                        <div class="error">
                            🔒 Dieser Server wurde vom
                            Admin/Owner gesperrt.
                        </div>
                        `
                        : ''
                    }

                    <p>
                        Status:

                        <span class="status ${
                            server.status === 'online'
                            ? 'online'
                            : 'offline'
                        }">
                            ${escape(server.status)}
                        </span>
                    </p>

                    <form
                        method="POST"
                        action="/servers/${server.id}/start"
                        style="display:inline"
                    >
                        <button
                            class="green"
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
                            class="red"
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
                        <button type="submit">
                            🔄 Neustart
                        </button>
                    </form>

                </div>
                `,
                user
            )
        );
    }
);

function ownedServer(req) {

    const user =
        getCurrentUser(req);

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

        const server =
            ownedServer(req);

        if (!server) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        if (server.locked) {
            return res.status(403).send(
                'Server gesperrt'
            );
        }

        server.status = 'online';

        saveServers(getServers());

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

app.post(
    '/servers/:serverId/stop',
    requireLogin,
    (req, res) => {

        const server =
            ownedServer(req);

        if (!server) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        server.status = 'offline';

        saveServers(getServers());

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

app.post(
    '/servers/:serverId/restart',
    requireLogin,
    (req, res) => {

        const server =
            ownedServer(req);

        if (!server) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        if (server.locked) {
            return res.status(403).send(
                'Server gesperrt'
            );
        }

        server.status = 'restarting';

        saveServers(getServers());

        setTimeout(() => {

            const servers =
                getServers();

            const current =
                servers.find(
                    s =>
                        s.id === server.id
                );

            if (
                current &&
                !current.locked
            ) {
                current.status =
                    'online';

                saveServers(servers);
            }

        }, 1500);

        res.redirect(
            `/servers/${server.id}`
        );
    }
);

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get(
    '/admin',
    requireAdmin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const users =
            getUsers();

        const orders =
            getOrders();

        const servers =
            getServers();

        res.send(
            page(
                'Admin Panel',
                `
                <div class="hero">

                    <h1>
                        👑 Admin Panel
                    </h1>

                    <p>
                        Angemeldet als:
                        ${escape(user.email)}
                    </p>

                </div>

                <div class="grid">

                    <div class="card">
                        <h2>👥 Benutzer</h2>
                        <p>
                            ${users.length}
                        </p>
                    </div>

                    <div class="card">
                        <h2>🖥️ Server</h2>
                        <p>
                            ${servers.length}
                        </p>
                    </div>

                    <div class="card">
                        <h2>📋 Bestellungen</h2>
                        <p>
                            ${orders.length}
                        </p>
                    </div>

                </div>

                <div class="box">

                    <h2>
                        📋 Server-Bestellungen
                    </h2>

                    ${
                        orders.length
                        ? orders.map(order => `

                            <div class="card">

                                <h3>
                                    ⛏️
                                    ${escape(order.serverName)}
                                </h3>

                                <p>
                                    Benutzer:
                                    ${escape(order.userName)}
                                </p>

                                <p>
                                    E-Mail:
                                    ${escape(order.userEmail)}
                                </p>

                                <p>
                                    Version:
                                    ${escape(order.version)}
                                </p>

                                <p>
                                    Grund:
                                    <br>
                                    ${escape(order.reason)}
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
                                        ${escape(order.status)}
                                    </span>
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
                                            class="green"
                                            type="submit"
                                        >
                                            ✅ Annehmen
                                        </button>
                                    </form>

                                    <form
                                        method="POST"
                                        action="/admin/orders/${order.id}/reject"
                                        style="display:inline"
                                    >
                                        <button
                                            class="red"
                                            type="submit"
                                        >
                                            ❌ Ablehnen
                                        </button>
                                    </form>

                                    `
                                    : ''
                                }

                            </div>

                        `).join('')
                        : `
                        <p>
                            Keine Bestellungen.
                        </p>
                        `
                    }

                </div>

                <div class="box">

                    <h2>
                        👥 Benutzerverwaltung
                    </h2>

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
                                    ${escape(target.name)}
                                </td>

                                <td>
                                    ${escape(target.email)}
                                </td>

                                <td>
                                    ${escape(target.role)}
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
                                    >
                                        <button
                                            class="red"
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

                    <h2>
                        🖥️ Serververwaltung
                    </h2>

                    ${
                        servers.length
                        ? servers.map(server => `

                            <div class="card">

                                <h3>
                                    ${escape(server.name)}
                                </h3>

                                <p>
                                    Status:
                                    ${escape(server.status)}
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
                                    <button
                                        class="red"
                                        type="submit"
                                    >
                                        ⛔ Herunterfahren
                                    </button>
                                </form>

                                <form
                                    method="POST"
                                    action="/admin/servers/${server.id}/delete"
                                    style="display:inline"
                                    onsubmit="return confirm('Server wirklich löschen?')"
                                >
                                    <button
                                        class="red"
                                        type="submit"
                                    >
                                        🗑️ Löschen
                                    </button>
                                </form>

                            </div>

                        `).join('')
                        : `
                        <p>
                            Keine Server vorhanden.
                        </p>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   ADMIN ORDER ACCEPT
========================================================= */

app.post(
    '/admin/orders/:orderId/accept',
    requireAdmin,
    async (req, res) => {

        const admin =
            getCurrentUser(req);

        const orders =
            getOrders();

        const index =
            orders.findIndex(
                order =>
                    order.id ===
                    req.params.orderId
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
            id: makeId('server'),

            ownerId:
                order.userId,

            name:
                order.serverName,

            version:
                order.version,

            status:
                'offline',

            locked:
                false,

            createdAt:
                new Date().toISOString(),

            approvedAt:
                new Date().toISOString(),

            approvedBy:
                admin.email
        };

        servers.push(server);

        saveServers(servers);

        order.status =
            'angenommen';

        order.processedAt =
            new Date().toISOString();

        order.processedBy =
            admin.email;

        order.serverId =
            server.id;

        saveOrders(orders);

        await sendMail(
            order.userEmail,
            'Minecraft-Server angenommen',
            `
            <h2>✅ Server angenommen</h2>

            <p>
                Deine Server-Bestellung
                <strong>
                    ${escape(order.serverName)}
                </strong>
                wurde angenommen.
            </p>

            <p>
                Du kannst deinen Server jetzt
                im Dashboard verwalten.
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
    '/admin/orders/:orderId/reject',
    requireAdmin,
    async (req, res) => {

        const admin =
            getCurrentUser(req);

        const orders =
            getOrders();

        const index =
            orders.findIndex(
                order =>
                    order.id ===
                    req.params.orderId
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
         * Wichtig:
         * Server-Bestellungen sind kostenlos.
         * Deshalb gibt es beim Ablehnen
         * keinen Coin-Abzug und keine
         * Coin-Rückerstattung.
         */

        order.status =
            'abgelehnt';

        order.processedAt =
            new Date().toISOString();

        order.processedBy =
            admin.email;

        saveOrders(orders);

        await sendMail(
            order.userEmail,
            'Minecraft-Server abgelehnt',
            `
            <h2>❌ Server-Bestellung abgelehnt</h2>

            <p>
                Deine Bestellung für
                <strong>
                    ${escape(order.serverName)}
                </strong>
                wurde abgelehnt.
            </p>

            <p>
                Es wurden keine Coins abgezogen,
                da die Server-Bestellung kostenlos ist.
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
    '/admin/users/:userId/ban',
    requireAdmin,
    (req, res) => {

        const admin =
            getCurrentUser(req);

        const users =
            getUsers();

        const index =
            users.findIndex(
                user =>
                    user.id ===
                    req.params.userId
            );

        if (index === -1) {
            return res.status(404).send(
                'Benutzer nicht gefunden'
            );
        }

        if (isOwner(users[index])) {
            return res.status(403).send(
                'Owner kann nicht gesperrt werden.'
            );
        }

        /*
         * Normale Admins dürfen keine
         * anderen Admins sperren.
         */

        if (
            users[index].role === 'admin' &&
            !isOwner(admin)
        ) {
            return res.status(403).send(
                'Nur der Owner kann Admins verwalten.'
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
    requireAdmin,
    (req, res) => {

        const servers =
            getServers();

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                    req.params.serverId
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

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER SHUTDOWN
========================================================= */

app.post(
    '/admin/servers/:serverId/shutdown',
    requireAdmin,
    (req, res) => {

        const servers =
            getServers();

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                    req.params.serverId
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].status =
            'offline';

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   ADMIN SERVER DELETE
========================================================= */

app.post(
    '/admin/servers/:serverId/delete',
    requireAdmin,
    (req, res) => {

        let servers =
            getServers();

        const exists =
            servers.some(
                server =>
                    server.id ===
                    req.params.serverId
            );

        if (!exists) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers =
            servers.filter(
                server =>
                    server.id !==
                    req.params.serverId
            );

        saveServers(servers);

        res.redirect('/admin');
    }
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    res.status(404).send(
        page(
            'Nicht gefunden',
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
                Zur Startseite
            </a>
            `
        )
    );
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {

    console.error(
        'SERVER ERROR:',
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send(
        page(
            'Serverfehler',
            `
            <div class="error">
                <h1>❌ Serverfehler</h1>

                <p>
                    Bei der Verarbeitung ist ein
                    Fehler aufgetreten.
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

/* =========================================================
   START
========================================================= */

app.listen(PORT, () => {

    console.log('');
    console.log(
        '========================================'
    );

    console.log(
        '⛏️ Minecraft Hosting läuft'
    );

    console.log(
        '========================================'
    );

    console.log(
        `🌐 Port: ${PORT}`
    );

    console.log(
        `👑 Owner: ${OWNER_EMAIL}`
    );

    console.log(
        `📧 Gmail: ${
            transporter
            ? 'Eingerichtet'
            : 'Nicht eingerichtet'
        }`
    );

    console.log(
        '🆓 Server-Bestellungen: kostenlos'
    );

    console.log(
        '👑 Server-Freigabe: Admin / Owner'
    );

    console.log(
        '========================================'
    );

});
