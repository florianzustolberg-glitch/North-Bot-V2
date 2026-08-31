'use strict';

/*
===========================================================
                    NORTH-BOT-2 WEBSEITE
===========================================================

Start:
    node webseite.js

Benötigte Pakete:
    npm install express express-session

Dateien werden automatisch erstellt:
    users.json
    tickets.json
    codes.json
    products.json
    giveaways.json
    logs.json
    announcements.json
    settings.json
    messages.json
    orders.json
    requests.json

===========================================================
*/

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 10000;

/*
===========================================================
                    KONFIGURATION
===========================================================
*/

const CONFIG = {
    NAME: 'North-Bot-2',

    OWNER_EMAIL: 'florianzustolberg@gmail.com',

    DISCORD_INVITE: 'https://discord.gg/NJEVq6Pk6x',

    /*
     * Discord-Ticket-System
     *
     * Kein Webhook.
     *
     * Wenn du möchtest, dass die Webseite wirklich
     * Discord-Kanäle erstellt, trage hier deinen
     * Discord Bot Token und die Server-ID ein.
     *
     * Der Token wird NICHT in .env geladen.
     */
    DISCORD_BOT_TOKEN: '',
    DISCORD_GUILD_ID: '',

    TICKET_CATEGORY_ID: '1493423287118729328',

    SESSION_SECRET:
        'north-bot-2-session-secret-change-this-2026',

    DAILY_COINS: 100,

    DAILY_COOLDOWN_MS:
        14 * 60 * 60 * 1000
};

/*
===========================================================
                    DATEIEN
===========================================================
*/

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    tickets: path.join(DATA_DIR, 'tickets.json'),
    codes: path.join(DATA_DIR, 'codes.json'),
    products: path.join(DATA_DIR, 'products.json'),
    giveaways: path.join(DATA_DIR, 'giveaways.json'),
    logs: path.join(DATA_DIR, 'logs.json'),
    announcements: path.join(DATA_DIR, 'announcements.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
    messages: path.join(DATA_DIR, 'messages.json'),
    orders: path.join(DATA_DIR, 'orders.json'),
    requests: path.join(DATA_DIR, 'requests.json')
};

/*
===========================================================
                    JSON SYSTEM
===========================================================
*/

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(defaultValue, null, 2),
            'utf8'
        );
    }
}

ensureFile(FILES.users, []);
ensureFile(FILES.tickets, []);
ensureFile(FILES.codes, []);
ensureFile(FILES.products, []);
ensureFile(FILES.giveaways, []);
ensureFile(FILES.logs, []);
ensureFile(FILES.announcements, []);
ensureFile(FILES.settings, {
    maintenance: false,
    maintenanceText: 'Die Webseite befindet sich aktuell in Wartung.',
    incident: false,
    incidentText: '',
    incidentLevel: 'warning'
});
ensureFile(FILES.messages, []);
ensureFile(FILES.orders, []);
ensureFile(FILES.requests, []);

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        const data = fs.readFileSync(file, 'utf8');

        if (!data.trim()) {
            return fallback;
        }

        return JSON.parse(data);
    } catch (error) {
        console.error(
            'JSON-Lesefehler:',
            file,
            error.message
        );

        return fallback;
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2),
            'utf8'
        );

        return true;
    } catch (error) {
        console.error(
            'JSON-Schreibfehler:',
            file,
            error.message
        );

        return false;
    }
}

/*
===========================================================
                    DATENFUNKTIONEN
===========================================================
*/

function getUsers() {
    return readJSON(FILES.users, []);
}

function saveUsers(users) {
    return writeJSON(FILES.users, users);
}

function getTickets() {
    return readJSON(FILES.tickets, []);
}

function saveTickets(data) {
    return writeJSON(FILES.tickets, data);
}

function getCodes() {
    return readJSON(FILES.codes, []);
}

function saveCodes(data) {
    return writeJSON(FILES.codes, data);
}

function getProducts() {
    return readJSON(FILES.products, []);
}

function saveProducts(data) {
    return writeJSON(FILES.products, data);
}

function getGiveaways() {
    return readJSON(FILES.giveaways, []);
}

function saveGiveaways(data) {
    return writeJSON(FILES.giveaways, data);
}

function getLogs() {
    return readJSON(FILES.logs, []);
}

function saveLogs(data) {
    return writeJSON(FILES.logs, data);
}

function getAnnouncements() {
    return readJSON(FILES.announcements, []);
}

function saveAnnouncements(data) {
    return writeJSON(FILES.announcements, data);
}

function getSettings() {
    return readJSON(FILES.settings, {
        maintenance: false,
        maintenanceText:
            'Die Webseite befindet sich aktuell in Wartung.',
        incident: false,
        incidentText: '',
        incidentLevel: 'warning'
    });
}

function saveSettings(data) {
    return writeJSON(FILES.settings, data);
}

function getMessages() {
    return readJSON(FILES.messages, []);
}

function saveMessages(data) {
    return writeJSON(FILES.messages, data);
}

function getOrders() {
    return readJSON(FILES.orders, []);
}

function saveOrders(data) {
    return writeJSON(FILES.orders, data);
}

function getRequests() {
    return readJSON(FILES.requests, []);
}

function saveRequests(data) {
    return writeJSON(FILES.requests, data);
}

/*
===========================================================
                    ID / CODE SYSTEM
===========================================================
*/

function randomString(length) {
    const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let result = '';

    for (let i = 0; i < length; i++) {
        result += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return result;
}

function createCode() {
    return (
        'NORTH-' +
        randomString(4) +
        '-' +
        randomString(4) +
        '-' +
        randomString(4)
    );
}

function createTicketNumber() {
    return (
        'TKT-' +
        Date.now().toString().slice(-8) +
        '-' +
        randomString(4)
    );
}

function createOrderNumber() {
    return (
        'ORD-' +
        Date.now().toString().slice(-8) +
        '-' +
        randomString(4)
    );
}

function createRequestNumber() {
    return (
        'REQ-' +
        Date.now().toString().slice(-8) +
        '-' +
        randomString(4)
    );
}

/*
===========================================================
                    PASSWORD SYSTEM
===========================================================
*/

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return salt + ':' + hash;
}

function verifyPassword(password, storedPassword) {
    try {
        const parts = String(storedPassword).split(':');

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const storedHash = parts[1];

        const hash = crypto
            .scryptSync(password, salt, 64)
            .toString('hex');

        return crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    } catch (error) {
        return false;
    }
}

/*
===========================================================
                    BENUTZER
===========================================================
*/

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function findUserById(id) {
    const users = getUsers();

    return users.find(
        user => user.id === id
    );
}

function findUserByEmail(email) {
    const users = getUsers();
    const normalized = normalizeEmail(email);

    return users.find(
        user =>
            normalizeEmail(user.email) === normalized
    );
}

function isAdminRole(role) {
    return [
        'owner',
        'admin',
        'manager',
        'developer',
        'moderator'
    ].includes(role);
}

function isStaff(user) {
    return !!user && isAdminRole(user.role);
}

function isOwner(user) {
    if (!user) {
        return false;
    }

    return (
        normalizeEmail(user.email) ===
        normalizeEmail(CONFIG.OWNER_EMAIL)
    );
}

function userRoleName(role) {
    const roles = {
        owner: 'Owner',
        admin: 'Admin',
        manager: 'Manager',
        developer: 'Developer',
        moderator: 'Moderator',
        user: 'User'
    };

    return roles[role] || 'User';
}

function ensureOwner() {
    const users = getUsers();

    let owner = users.find(
        user =>
            normalizeEmail(user.email) ===
            normalizeEmail(CONFIG.OWNER_EMAIL)
    );

    if (!owner) {
        owner = {
            id: crypto.randomUUID(),
            username: 'Florian',
            email: CONFIG.OWNER_EMAIL,
            password:
                hashPassword(
                    randomString(32)
                ),
            role: 'owner',
            coins: 999999,
            createdAt: Date.now(),
            lastDaily: 0,
            bannedUntil: 0,
            banReason: '',
            kicked: false,
            discordId: '',
            avatar: ''
        };

        users.push(owner);
        saveUsers(users);

        console.log(
            'Owner-Account automatisch erstellt:',
            CONFIG.OWNER_EMAIL
        );
    } else {
        let changed = false;

        if (owner.role !== 'owner') {
            owner.role = 'owner';
            changed = true;
        }

        if (typeof owner.coins !== 'number') {
            owner.coins = 999999;
            changed = true;
        }

        if (changed) {
            saveUsers(users);
        }
    }
}

ensureOwner();

/*
===========================================================
                    BAN SYSTEM
===========================================================
*/

function isUserBanned(user) {
    if (!user) {
        return false;
    }

    if (!user.bannedUntil) {
        return false;
    }

    if (user.bannedUntil === -1) {
        return true;
    }

    if (Date.now() < user.bannedUntil) {
        return true;
    }

    user.bannedUntil = 0;
    user.banReason = '';

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    return false;
}

function banText(user) {
    if (!user) {
        return 'Benutzer ist nicht gebannt.';
    }

    if (user.bannedUntil === -1) {
        return 'Dauerhaft';
    }

    if (!user.bannedUntil) {
        return 'Nicht gebannt';
    }

    const remaining =
        Math.max(
            0,
            user.bannedUntil - Date.now()
        );

    const minutes =
        Math.floor(
            remaining / 60000
        );

    return minutes + ' Minuten';
}

/*
===========================================================
                    LOG SYSTEM
===========================================================
*/

function addLog(action, user, details) {
    const logs = getLogs();

    logs.unshift({
        id: crypto.randomUUID(),
        action: action,
        userId: user ? user.id : null,
        username: user ? user.username : 'System',
        details: details || '',
        timestamp: Date.now()
    });

    if (logs.length > 2000) {
        logs.length = 2000;
    }

    saveLogs(logs);
}

/*
===========================================================
                    EXPRESS
===========================================================
*/

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json({
    limit: '2mb'
}));

app.use(session({
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
    );

    res.setHeader(
        'X-Frame-Options',
        'SAMEORIGIN'
    );

    next();
});

/*
===========================================================
                    AUTH MIDDLEWARE
===========================================================
*/

function currentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return findUserById(
        req.session.userId
    );
}

function requireLogin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.redirect('/login');
    }

    if (isUserBanned(user)) {
        req.session.destroy(() => {
            res.redirect('/banned');
        });

        return;
    }

    next();
}

function requireStaff(req, res, next) {
    const user = currentUser(req);

    if (!user || !isStaff(user)) {
        return res.status(403).send(
            page(
                'Kein Zugriff',
                '<div class="card">' +
                '<h1>Kein Zugriff</h1>' +
                '<p>Du hast keine Berechtigung für diesen Bereich.</p>' +
                '<a class="button" href="/">Zur Startseite</a>' +
                '</div>',
                req
            )
        );
    }

    next();
}

function requireOwner(req, res, next) {
    const user = currentUser(req);

    if (!user || !isOwner(user)) {
        return res.status(403).send(
            page(
                'Kein Zugriff',
                '<div class="card">' +
                '<h1>Owner-Bereich</h1>' +
                '<p>Nur der Owner kann diese Aktion ausführen.</p>' +
                '</div>',
                req
            )
        );
    }

    next();
}

/*
===========================================================
                    HTML DESIGN
===========================================================
*/

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(timestamp) {
    if (!timestamp) {
        return '-';
    }

    return new Date(timestamp)
        .toLocaleString(
            'de-DE',
            {
                dateStyle: 'short',
                timeStyle: 'short'
            }
        );
}

function roleBadge(role) {
    return (
        '<span class="badge role-' +
        escapeHTML(role) +
        '">' +
        escapeHTML(userRoleName(role)) +
        '</span>'
    );
}

function nav(req) {
    const user = currentUser(req);

    let html =
        '<nav>' +
        '<a class="logo" href="/">North-Bot-2</a>' +
        '<div class="navlinks">' +
        '<a href="/">Start</a>';

    if (user) {
        html +=
            '<a href="/dashboard">Dashboard</a>' +
            '<a href="/tickets">Tickets</a>' +
            '<a href="/shop">Shop</a>' +
            '<a href="/giveaways">Gewinnspiele</a>' +
            '<a href="/chat">Chat</a>' +
            '<a href="/profile">Profil</a>';

        if (isStaff(user)) {
            html +=
                '<a href="/admin">Admin Panel</a>';
        }

        html +=
            '<a href="/logout">Logout</a>';
    } else {
        html +=
            '<a href="/login">Login</a>' +
            '<a href="/register">Registrieren</a>';
    }

    html +=
        '</div>' +
        '</nav>';

    return html;
}

function page(title, content, req) {
    const settings = getSettings();

    let banners = '';

    if (settings.maintenance) {
        banners +=
            '<div class="maintenance">' +
            '<strong>WARTUNG</strong><br>' +
            escapeHTML(
                settings.maintenanceText
            ) +
            '</div>';
    }

    if (settings.incident) {
        banners +=
            '<div class="incident">' +
            '<strong>STÖRUNG</strong><br>' +
            escapeHTML(
                settings.incidentText
            ) +
            '</div>';
    }

    return (
        '<!DOCTYPE html>' +
        '<html lang="de">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' +
        escapeHTML(title) +
        ' | North-Bot-2</title>' +

        '<style>' +

        '*{box-sizing:border-box}' +

        'body{' +
        'margin:0;' +
        'font-family:Arial,Helvetica,sans-serif;' +
        'background:#0b0d10;' +
        'color:#e8eaed;' +
        '}' +

        'a{' +
        'color:inherit;' +
        'text-decoration:none;' +
        '}' +

        'nav{' +
        'height:70px;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'padding:0 5%;' +
        'border-bottom:1px solid #20242a;' +
        'background:#101317;' +
        'position:sticky;' +
        'top:0;' +
        'z-index:20;' +
        '}' +

        '.logo{' +
        'font-size:22px;' +
        'font-weight:800;' +
        'letter-spacing:.3px;' +
        '}' +

        '.navlinks{' +
        'display:flex;' +
        'gap:18px;' +
        'align-items:center;' +
        'flex-wrap:wrap;' +
        '}' +

        '.navlinks a{' +
        'font-size:14px;' +
        'color:#b7bcc4;' +
        '}' +

        '.navlinks a:hover{' +
        'color:#fff;' +
        '}' +

        '.container{' +
        'width:min(1180px,92%);' +
        'margin:0 auto;' +
        'padding:35px 0 70px;' +
        '}' +

        '.hero{' +
        'padding:80px 0 50px;' +
        '}' +

        'h1{' +
        'font-size:42px;' +
        'margin:0 0 14px;' +
        '}' +

        'h2{' +
        'margin-top:0;' +
        '}' +

        'p{' +
        'line-height:1.65;' +
        'color:#aeb4bd;' +
        '}' +

        '.muted{' +
        'color:#8c939c;' +
        '}' +

        '.grid{' +
        'display:grid;' +
        'grid-template-columns:repeat(auto-fit,minmax(240px,1fr));' +
        'gap:18px;' +
        '}' +

        '.card{' +
        'background:#11151a;' +
        'border:1px solid #222831;' +
        'border-radius:12px;' +
        'padding:22px;' +
        'margin-bottom:18px;' +
        '}' +

        '.stat{' +
        'font-size:30px;' +
        'font-weight:800;' +
        'margin:8px 0;' +
        '}' +

        '.button{' +
        'display:inline-block;' +
        'background:#f2f2f2;' +
        'color:#101010;' +
        'border:0;' +
        'padding:11px 17px;' +
        'border-radius:7px;' +
        'font-weight:700;' +
        'cursor:pointer;' +
        'margin:4px 3px 4px 0;' +
        '}' +

        '.button.dark{' +
        'background:#252b33;' +
        'color:#fff;' +
        '}' +

        '.button.danger{' +
        'background:#a83232;' +
        'color:#fff;' +
        '}' +

        '.button.success{' +
        'background:#347a4a;' +
        'color:#fff;' +
        '}' +

        'input,select,textarea{' +
        'width:100%;' +
        'background:#0b0e12;' +
        'color:#fff;' +
        'border:1px solid #2a3038;' +
        'border-radius:7px;' +
        'padding:12px;' +
        'margin:7px 0 14px;' +
        'outline:none;' +
        '}' +

        'textarea{' +
        'min-height:120px;' +
        'resize:vertical;' +
        '}' +

        'label{' +
        'font-size:13px;' +
        'color:#bfc4cb;' +
        '}' +

        '.badge{' +
        'display:inline-block;' +
        'padding:4px 8px;' +
        'border-radius:5px;' +
        'font-size:11px;' +
        'font-weight:700;' +
        'background:#252a31;' +
        'margin:2px;' +
        '}' +

        '.role-owner{background:#66521b}' +
        '.role-admin{background:#553333}' +
        '.role-manager{background:#3d4e65}' +
        '.role-developer{background:#374c43}' +
        '.role-moderator{background:#4b3d55}' +

        'table{' +
        'width:100%;' +
        'border-collapse:collapse;' +
        '}' +

        'th,td{' +
        'padding:12px 9px;' +
        'border-bottom:1px solid #252a31;' +
        'text-align:left;' +
        'vertical-align:top;' +
        '}' +

        'th{' +
        'color:#fff;' +
        'font-size:13px;' +
        '}' +

        'td{' +
        'color:#b6bcc5;' +
        'font-size:13px;' +
        '}' +

        '.maintenance{' +
        'padding:12px;' +
        'text-align:center;' +
        'background:#66521b;' +
        'color:#fff;' +
        '}' +

        '.incident{' +
        'padding:12px;' +
        'text-align:center;' +
        'background:#673333;' +
        'color:#fff;' +
        '}' +

        '.message{' +
        'padding:13px;' +
        'border-radius:7px;' +
        'background:#171c22;' +
        'border:1px solid #262c34;' +
        'margin-bottom:10px;' +
        '}' +

        '.ticket-open{' +
        'border-left:3px solid #4e8b61;' +
        '}' +

        '.ticket-closed{' +
        'border-left:3px solid #555;' +
        '}' +

        '.price{' +
        'font-size:25px;' +
        'font-weight:800;' +
        '}' +

        '.coin{' +
        'font-weight:800;' +
        '}' +

        '.footer{' +
        'padding:30px 5%;' +
        'border-top:1px solid #20242a;' +
        'color:#737a83;' +
        'text-align:center;' +
        '}' +

        '@media(max-width:700px){' +
        'nav{height:auto;padding:15px;align-items:flex-start;gap:12px;flex-direction:column}' +
        '.navlinks{gap:10px}' +
        'h1{font-size:32px}' +
        'table{display:block;overflow-x:auto}' +
        '}' +

        '</style>' +
        '</head>' +
        '<body>' +

        nav(req) +

        banners +

        '<main class="container">' +
        content +
        '</main>' +

        '<footer class="footer">' +
        'North-Bot-2 · ' +
        '<a href="' +
        CONFIG.DISCORD_INVITE +
        '">Discord</a>' +
        '</footer>' +

        '</body>' +
        '</html>'
    );
}

/*
===========================================================
                    STARTSEITE
===========================================================
*/

app.get('/', (req, res) => {
    const user = currentUser(req);

    const content =
        '<section class="hero">' +
        '<h1>North-Bot-2</h1>' +
        '<p>' +
        'Die zentrale Webseite für Community, Support, ' +
        'Tickets, Coins, Gewinnspiele und Team-Verwaltung.' +
        '</p>' +

        '<a class="button" href="' +
        CONFIG.DISCORD_INVITE +
        '" target="_blank">Discord beitreten</a>' +

        (
            user
                ? '<a class="button dark" href="/dashboard">Dashboard</a>'
                : '<a class="button dark" href="/register">Account erstellen</a>'
        ) +

        '</section>' +

        '<div class="grid">' +

        '<div class="card">' +
        '<h2>Support</h2>' +
        '<p>Erstelle ein Ticket direkt über die Webseite.</p>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Coins</h2>' +
        '<p>Sammle Coins und nutze sie im Shop.</p>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Community</h2>' +
        '<p>Chat, Gewinnspiele und weitere Community-Funktionen.</p>' +
        '</div>' +

        '</div>';

    res.send(
        page(
            'Startseite',
            content,
            req
        )
    );
});

/*
===========================================================
                    REGISTER
===========================================================
*/

app.get('/register', (req, res) => {
    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    const content =
        '<div class="card">' +
        '<h1>Registrieren</h1>' +

        '<form method="POST" action="/register">' +

        '<label>Benutzername</label>' +
        '<input name="username" required minlength="3" maxlength="32">' +

        '<label>E-Mail</label>' +
        '<input type="email" name="email" required maxlength="120">' +

        '<label>Passwort</label>' +
        '<input type="password" name="password" required minlength="6">' +

        '<button class="button" type="submit">Account erstellen</button>' +

        '</form>' +

        '<p>Du hast bereits einen Account?</p>' +
        '<a class="button dark" href="/login">Login</a>' +

        '</div>';

    res.send(
        page(
            'Registrieren',
            content,
            req
        )
    );
});

app.post('/register', (req, res) => {
    const username =
        String(req.body.username || '').trim();

    const email =
        normalizeEmail(req.body.email);

    const password =
        String(req.body.password || '');

    if (
        username.length < 3 ||
        username.length > 32
    ) {
        return res.send(
            page(
                'Fehler',
                '<div class="card">' +
                '<h1>Fehler</h1>' +
                '<p>Der Benutzername muss zwischen 3 und 32 Zeichen lang sein.</p>' +
                '<a class="button" href="/register">Zurück</a>' +
                '</div>',
                req
            )
        );
    }

    if (password.length < 6) {
        return res.send(
            page(
                'Fehler',
                '<div class="card">' +
                '<h1>Fehler</h1>' +
                '<p>Das Passwort muss mindestens 6 Zeichen haben.</p>' +
                '<a class="button" href="/register">Zurück</a>' +
                '</div>',
                req
            )
        );
    }

    if (!email.includes('@')) {
        return res.send(
            page(
                'Fehler',
                '<div class="card">' +
                '<h1>Fehler</h1>' +
                '<p>Bitte gib eine gültige E-Mail-Adresse ein.</p>' +
                '<a class="button" href="/register">Zurück</a>' +
                '</div>',
                req
            )
        );
    }

    if (findUserByEmail(email)) {
        return res.send(
            page(
                'Fehler',
                '<div class="card">' +
                '<h1>Account existiert</h1>' +
                '<p>Diese E-Mail-Adresse ist bereits registriert.</p>' +
                '<a class="button" href="/login">Zum Login</a>' +
                '</div>',
                req
            )
        );
    }

    const users = getUsers();

    const user = {
        id: crypto.randomUUID(),
        username: username,
        email: email,
        password: hashPassword(password),
        role: 'user',
        coins: 0,
        createdAt: Date.now(),
        lastDaily: 0,
        bannedUntil: 0,
        banReason: '',
        kicked: false,
        discordId: '',
        avatar: ''
    };

    users.push(user);
    saveUsers(users);

    addLog(
        'REGISTER',
        user,
        'Neuer Benutzer registriert'
    );

    req.session.userId = user.id;

    res.redirect('/dashboard');
});

/*
===========================================================
                    LOGIN
===========================================================
*/

app.get('/login', (req, res) => {
    if (currentUser(req)) {
        return res.redirect('/dashboard');
    }

    const content =
        '<div class="card">' +
        '<h1>Login</h1>' +

        '<form method="POST" action="/login">' +

        '<label>E-Mail</label>' +
        '<input type="email" name="email" required>' +

        '<label>Passwort</label>' +
        '<input type="password" name="password" required>' +

        '<button class="button" type="submit">Einloggen</button>' +

        '</form>' +

        '<p>Noch kein Account?</p>' +
        '<a class="button dark" href="/register">Registrieren</a>' +

        '</div>';

    res.send(
        page(
            'Login',
            content,
            req
        )
    );
});

app.post('/login', (req, res) => {
    const email =
        normalizeEmail(req.body.email);

    const password =
        String(req.body.password || '');

    const user =
        findUserByEmail(email);

    if (!user || !verifyPassword(
        password,
        user.password
    )) {
        return res.send(
            page(
                'Login fehlgeschlagen',
                '<div class="card">' +
                '<h1>Login fehlgeschlagen</h1>' +
                '<p>E-Mail oder Passwort ist falsch.</p>' +
                '<a class="button" href="/login">Erneut versuchen</a>' +
                '</div>',
                req
            )
        );
    }

    if (isUserBanned(user)) {
        return res.redirect('/banned');
    }

    user.kicked = false;

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    req.session.userId = user.id;

    addLog(
        'LOGIN',
        user,
        'Benutzer eingeloggt'
    );

    res.redirect('/dashboard');
});

/*
===========================================================
                    LOGOUT
===========================================================
*/

app.get('/logout', (req, res) => {
    const user = currentUser(req);

    if (user) {
        addLog(
            'LOGOUT',
            user,
            'Benutzer ausgeloggt'
        );
    }

    req.session.destroy(() => {
        res.redirect('/');
    });
});

/*
===========================================================
                    BANNED PAGE
===========================================================
*/

app.get('/banned', (req, res) => {
    res.send(
        page(
            'Gebannt',
            '<div class="card">' +
            '<h1>Du bist gebannt</h1>' +
            '<p>' +
            'Dein Zugriff auf die North-Bot-2 Webseite wurde gesperrt.' +
            '</p>' +
            '<a class="button" href="' +
            CONFIG.DISCORD_INVITE +
            '" target="_blank">Auf Discord Entbannung beantragen</a>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    DASHBOARD
===========================================================
*/

app.get('/dashboard', requireLogin, (req, res) => {
    const user = currentUser(req);

    const nextDaily =
        user.lastDaily
            ? user.lastDaily +
              CONFIG.DAILY_COOLDOWN_MS
            : 0;

    const dailyReady =
        !user.lastDaily ||
        Date.now() >= nextDaily;

    const tickets =
        getTickets().filter(
            ticket =>
                ticket.userId === user.id ||
                (
                    isStaff(user) &&
                    ticket.status !== 'closed'
                )
        );

    const content =
        '<div class="hero">' +
        '<h1>Willkommen, ' +
        escapeHTML(user.username) +
        '</h1>' +
        '<p>' +
        roleBadge(user.role) +
        '</p>' +
        '</div>' +

        '<div class="grid">' +

        '<div class="card">' +
        '<div class="muted">Coins</div>' +
        '<div class="stat">' +
        Number(user.coins || 0) +
        '</div>' +
        '<a class="button dark" href="/shop">Zum Shop</a>' +
        '</div>' +

        '<div class="card">' +
        '<div class="muted">Rolle</div>' +
        '<div class="stat">' +
        escapeHTML(
            userRoleName(user.role)
        ) +
        '</div>' +
        '</div>' +

        '<div class="card">' +
        '<div class="muted">Tickets</div>' +
        '<div class="stat">' +
        tickets.length +
        '</div>' +
        '<a class="button dark" href="/tickets">Tickets</a>' +
        '</div>' +

        '</div>' +

        '<div class="card">' +
        '<h2>Daily Coins</h2>' +
        '<p>Alle 14 Stunden kannst du 100 Coins abholen.</p>' +

        (
            dailyReady
                ? '<form method="POST" action="/daily">' +
                  '<button class="button success" type="submit">' +
                  '100 Coins abholen' +
                  '</button>' +
                  '</form>'
                : '<p>Der nächste Daily-Bonus ist verfügbar am: ' +
                  formatDate(nextDaily) +
                  '</p>'
        ) +

        '</div>' +

        '<div class="grid">' +

        '<div class="card">' +
        '<h2>Support</h2>' +
        '<p>Du brauchst Hilfe?</p>' +
        '<a class="button" href="/tickets/new">Ticket erstellen</a>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Gewinnspiele</h2>' +
        '<p>Nimm an aktuellen Gewinnspielen teil.</p>' +
        '<a class="button dark" href="/giveaways">Ansehen</a>' +
        '</div>' +

        '</div>';

    res.send(
        page(
            'Dashboard',
            content,
            req
        )
    );
});

/*
===========================================================
                    DAILY COINS
===========================================================
*/

app.post('/daily', requireLogin, (req, res) => {
    const user = currentUser(req);

    if (
        user.lastDaily &&
        Date.now() <
        user.lastDaily +
        CONFIG.DAILY_COOLDOWN_MS
    ) {
        return res.redirect('/dashboard');
    }

    user.coins =
        Number(user.coins || 0) +
        CONFIG.DAILY_COINS;

    user.lastDaily = Date.now();

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    addLog(
        'DAILY_COINS',
        user,
        '+' +
        CONFIG.DAILY_COINS +
        ' Coins'
    );

    res.redirect('/dashboard');
});

/*
===========================================================
                    PROFILE
===========================================================
*/

app.get('/profile', requireLogin, (req, res) => {
    const user = currentUser(req);

    const content =
        '<div class="card">' +
        '<h1>Profil bearbeiten</h1>' +

        '<form method="POST" action="/profile">' +

        '<label>Name</label>' +
        '<input name="username" maxlength="32" required value="' +
        escapeHTML(user.username) +
        '">' +

        '<label>Discord ID</label>' +
        '<input name="discordId" value="' +
        escapeHTML(user.discordId || '') +
        '">' +

        '<label>Avatar URL</label>' +
        '<input name="avatar" value="' +
        escapeHTML(user.avatar || '') +
        '">' +

        '<button class="button" type="submit">Speichern</button>' +

        '</form>' +

        '</div>' +

        '<div class="card">' +
        '<h2>Account</h2>' +
        '<p>E-Mail: ' +
        escapeHTML(user.email) +
        '</p>' +
        '<p>Rolle: ' +
        roleBadge(user.role) +
        '</p>' +
        '<p>Coins: <span class="coin">' +
        Number(user.coins || 0) +
        '</span></p>' +
        '<p>Registriert: ' +
        formatDate(user.createdAt) +
        '</p>' +
        '</div>';

    res.send(
        page(
            'Profil',
            content,
            req
        )
    );
});

app.post('/profile', requireLogin, (req, res) => {
    const user = currentUser(req);

    const username =
        String(req.body.username || '').trim();

    if (
        username.length < 3 ||
        username.length > 32
    ) {
        return res.redirect('/profile');
    }

    user.username = username;
    user.discordId =
        String(req.body.discordId || '').trim();
    user.avatar =
        String(req.body.avatar || '').trim();

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    addLog(
        'PROFILE_UPDATE',
        user,
        'Profil geändert'
    );

    res.redirect('/profile');
});

/*
===========================================================
                    TICKETS
===========================================================
*/

app.get('/tickets', requireLogin, (req, res) => {
    const user = currentUser(req);

    let tickets = getTickets();

    if (!isStaff(user)) {
        tickets = tickets.filter(
            ticket =>
                ticket.userId === user.id
        );
    }

    tickets.sort(
        (a, b) =>
            b.createdAt - a.createdAt
    );

    let rows = '';

    for (const ticket of tickets) {
        rows +=
            '<div class="card ' +
            (
                ticket.status === 'closed'
                    ? 'ticket-closed'
                    : 'ticket-open'
            ) +
            '">' +

            '<h2>' +
            escapeHTML(ticket.number) +
            '</h2>' +

            '<p>' +
            escapeHTML(ticket.subject) +
            '</p>' +

            '<p>Status: ' +
            escapeHTML(ticket.status) +
            '</p>' +

            '<p>Erstellt: ' +
            formatDate(ticket.createdAt) +
            '</p>' +

            '<a class="button" href="/tickets/' +
            encodeURIComponent(ticket.id) +
            '">Öffnen</a>' +

            '</div>';
    }

    if (!rows) {
        rows =
            '<div class="card">' +
            '<p>Keine Tickets vorhanden.</p>' +
            '</div>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Support-Tickets</h1>' +
        '<a class="button" href="/tickets/new">Neues Ticket</a>' +
        '</div>' +
        rows;

    res.send(
        page(
            'Tickets',
            content,
            req
        )
    );
});

app.get('/tickets/new', requireLogin, (req, res) => {
    const content =
        '<div class="card">' +
        '<h1>Ticket erstellen</h1>' +

        '<form method="POST" action="/tickets/new">' +

        '<label>Betreff</label>' +
        '<input name="subject" required maxlength="100">' +

        '<label>Nachricht</label>' +
        '<textarea name="message" required maxlength="5000"></textarea>' +

        '<button class="button" type="submit">Ticket erstellen</button>' +

        '</form>' +

        '</div>';

    res.send(
        page(
            'Ticket erstellen',
            content,
            req
        )
    );
});

app.post('/tickets/new', requireLogin, async (req, res) => {
    const user = currentUser(req);

    const subject =
        String(req.body.subject || '').trim();

    const message =
        String(req.body.message || '').trim();

    if (!subject || !message) {
        return res.redirect('/tickets/new');
    }

    const tickets = getTickets();

    const ticket = {
        id: crypto.randomUUID(),
        number: createTicketNumber(),
        userId: user.id,
        username: user.username,
        subject: subject,
        message: message,
        status: 'open',
        claimedBy: null,
        claimedByName: null,
        discordChannelId: null,
        createdAt: Date.now(),
        closedAt: null,
        replies: []
    };

    tickets.push(ticket);
    saveTickets(tickets);

    addLog(
        'TICKET_CREATE',
        user,
        ticket.number
    );

    /*
     * Discord-Kanal versuchen zu erstellen.
     *
     * Funktioniert nur wenn:
     * DISCORD_BOT_TOKEN
     * DISCORD_GUILD_ID
     *
     * gesetzt sind.
     */

    try {
        const channel =
            await createDiscordTicketChannel(
                ticket,
                user
            );

        if (channel && channel.id) {
            ticket.discordChannelId =
                channel.id;

            saveTickets(tickets);
        }
    } catch (error) {
        console.error(
            'Discord Ticket konnte nicht erstellt werden:',
            error.message
        );
    }

    res.redirect(
        '/tickets/' +
        encodeURIComponent(ticket.id)
    );
});

app.get('/tickets/:id', requireLogin, (req, res) => {
    const user = currentUser(req);

    const tickets = getTickets();

    const ticket =
        tickets.find(
            item =>
                item.id === req.params.id
        );

    if (!ticket) {
        return res.status(404).send(
            page(
                'Ticket nicht gefunden',
                '<div class="card">' +
                '<h1>Ticket nicht gefunden</h1>' +
                '</div>',
                req
            )
        );
    }

    if (
        ticket.userId !== user.id &&
        !isStaff(user)
    ) {
        return res.status(403).send(
            page(
                'Kein Zugriff',
                '<div class="card">' +
                '<h1>Kein Zugriff</h1>' +
                '<p>Dieses Ticket gehört einem anderen Benutzer.</p>' +
                '</div>',
                req
            )
        );
    }

    let replies = '';

    for (const reply of ticket.replies || []) {
        replies +=
            '<div class="message">' +
            '<strong>' +
            escapeHTML(reply.username) +
            '</strong>' +
            ' <span class="muted">' +
            formatDate(reply.createdAt) +
            '</span>' +
            '<p>' +
            escapeHTML(reply.message) +
            '</p>' +
            '</div>';
    }

    const content =
        '<div class="card">' +

        '<h1>' +
        escapeHTML(ticket.number) +
        '</h1>' +

        '<p>Betreff: ' +
        escapeHTML(ticket.subject) +
        '</p>' +

        '<p>Status: ' +
        escapeHTML(ticket.status) +
        '</p>' +

        (
            ticket.claimedBy
                ? '<p>Übernommen von: ' +
                  escapeHTML(
                      ticket.claimedByName
                  ) +
                  '</p>'
                : '<p>Noch nicht übernommen.</p>'
        ) +

        '</div>' +

        '<div class="card">' +

        '<h2>Ticket</h2>' +

        '<div class="message">' +
        '<strong>' +
        escapeHTML(ticket.username) +
        '</strong>' +
        '<span class="muted"> ' +
        formatDate(ticket.createdAt) +
        '</span>' +
        '<p>' +
        escapeHTML(ticket.message) +
        '</p>' +
        '</div>' +

        replies +

        (
            ticket.status === 'open'
                ? '<form method="POST" action="/tickets/' +
                  encodeURIComponent(ticket.id) +
                  '/reply">' +
                  '<label>Antwort</label>' +
                  '<textarea name="message" required maxlength="5000"></textarea>' +
                  '<button class="button" type="submit">Antwort senden</button>' +
                  '</form>'
                : '<p>Dieses Ticket ist geschlossen.</p>'
        ) +

        '</div>' +

        (
            isStaff(user)
                ? '<div class="card">' +
                  '<h2>Team</h2>' +

                  (
                      ticket.claimedBy
                          ? '<form method="POST" action="/tickets/' +
                            encodeURIComponent(ticket.id) +
                            '/unclaim">' +
                            '<button class="button dark" type="submit">Nicht mehr übernehmen</button>' +
                            '</form>'
                          : '<form method="POST" action="/tickets/' +
                            encodeURIComponent(ticket.id) +
                            '/claim">' +
                            '<button class="button success" type="submit">Übernehmen</button>' +
                            '</form>'
                  ) +

                  (
                      ticket.status === 'open'
                          ? '<form method="POST" action="/tickets/' +
                            encodeURIComponent(ticket.id) +
                            '/close">' +
                            '<button class="button danger" type="submit">Schließen</button>' +
                            '</form>'
                          : ''
                  ) +

                  '</div>'
                : ''
        );

    res.send(
        page(
            ticket.number,
            content,
            req
        )
    );
});

app.post('/tickets/:id/reply', requireLogin, (req, res) => {
    const user = currentUser(req);

    const tickets = getTickets();

    const ticket =
        tickets.find(
            item =>
                item.id === req.params.id
        );

    if (!ticket) {
        return res.redirect('/tickets');
    }

    if (
        ticket.userId !== user.id &&
        !isStaff(user)
    ) {
        return res.status(403).send('Kein Zugriff');
    }

    if (ticket.status === 'closed') {
        return res.redirect(
            '/tickets/' +
            encodeURIComponent(ticket.id)
        );
    }

    const message =
        String(req.body.message || '').trim();

    if (!message) {
        return res.redirect(
            '/tickets/' +
            encodeURIComponent(ticket.id)
        );
    }

    if (!ticket.replies) {
        ticket.replies = [];
    }

    ticket.replies.push({
        id: crypto.randomUUID(),
        userId: user.id,
        username: user.username,
        message: message,
        createdAt: Date.now()
    });

    saveTickets(tickets);

    addLog(
        'TICKET_REPLY',
        user,
        ticket.number
    );

    res.redirect(
        '/tickets/' +
        encodeURIComponent(ticket.id)
    );
});

app.post('/tickets/:id/claim', requireStaff, (req, res) => {
    const user = currentUser(req);

    const tickets = getTickets();

    const ticket =
        tickets.find(
            item =>
                item.id === req.params.id
        );

    if (!ticket) {
        return res.redirect('/tickets');
    }

    ticket.claimedBy = user.id;
    ticket.claimedByName = user.username;

    saveTickets(tickets);

    addLog(
        'TICKET_CLAIM',
        user,
        ticket.number
    );

    res.redirect(
        '/tickets/' +
        encodeURIComponent(ticket.id)
    );
});

app.post('/tickets/:id/unclaim', requireStaff, (req, res) => {
    const user = currentUser(req);

    const tickets = getTickets();

    const ticket =
        tickets.find(
            item =>
                item.id === req.params.id
        );

    if (!ticket) {
        return res.redirect('/tickets');
    }

    ticket.claimedBy = null;
    ticket.claimedByName = null;

    saveTickets(tickets);

    addLog(
        'TICKET_UNCLAIM',
        user,
        ticket.number
    );

    res.redirect(
        '/tickets/' +
        encodeURIComponent(ticket.id)
    );
});

app.post('/tickets/:id/close', requireStaff, (req, res) => {
    const user = currentUser(req);

    const tickets = getTickets();

    const ticket =
        tickets.find(
            item =>
                item.id === req.params.id
        );

    if (!ticket) {
        return res.redirect('/tickets');
    }

    ticket.status = 'closed';
    ticket.closedAt = Date.now();

    saveTickets(tickets);

    addLog(
        'TICKET_CLOSE',
        user,
        ticket.number
    );

    res.redirect(
        '/tickets/' +
        encodeURIComponent(ticket.id)
    );
});

/*
===========================================================
                    DISCORD TICKET API
===========================================================
*/

async function createDiscordTicketChannel(ticket, user) {
    if (
        !CONFIG.DISCORD_BOT_TOKEN ||
        !CONFIG.DISCORD_GUILD_ID
    ) {
        console.log(
            'Discord Ticket übersprungen: Bot Token oder Guild ID fehlt.'
        );

        return null;
    }

    const channelName =
        'ticket-' +
        randomString(5).toLowerCase();

    const body = {
        name: channelName,
        type: 0,
        parent_id:
            CONFIG.TICKET_CATEGORY_ID,
        topic:
            ticket.number +
            ' | ' +
            user.username
    };

    const response =
        await fetch(
            'https://discord.com/api/v10/guilds/' +
            encodeURIComponent(
                CONFIG.DISCORD_GUILD_ID
            ) +
            '/channels',
            {
                method: 'POST',
                headers: {
                    'Authorization':
                        'Bot ' +
                        CONFIG.DISCORD_BOT_TOKEN,
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify(body)
            }
        );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            'Discord API ' +
            response.status +
            ': ' +
            text
        );
    }

    const channel =
        await response.json();

    /*
     * Nur eine Nachricht im Discord-Kanal.
     *
     * Kein Webhook.
     */

    try {
        await fetch(
            'https://discord.com/api/v10/channels/' +
            encodeURIComponent(channel.id) +
            '/messages',
            {
                method: 'POST',
                headers: {
                    'Authorization':
                        'Bot ' +
                        CONFIG.DISCORD_BOT_TOKEN,
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    content:
                        '🎫 Neues Ticket ' +
                        ticket.number +
                        '\n' +
                        'Erstellt von: ' +
                        user.username +
                        '\n' +
                        'Betreff: ' +
                        ticket.subject +
                        '\n\n' +
                        'Webseite: ' +
                        'https://north-bot-2.onrender.com/tickets/' +
                        ticket.id
                })
            }
        );
    } catch (error) {
        console.error(
            'Discord Ticket Nachricht Fehler:',
            error.message
        );
    }

    return channel;
}

/*
===========================================================
                    COIN CODES
===========================================================
*/

app.get('/redeem', requireLogin, (req, res) => {
    const content =
        '<div class="card">' +
        '<h1>Coin-Code einlösen</h1>' +

        '<form method="POST" action="/redeem">' +

        '<label>Code</label>' +
        '<input name="code" placeholder="NORTH-XXXX-XXXX-XXXX" required>' +

        '<button class="button" type="submit">Einlösen</button>' +

        '</form>' +

        '</div>';

    res.send(
        page(
            'Code einlösen',
            content,
            req
        )
    );
});

app.post('/redeem', requireLogin, (req, res) => {
    const user = currentUser(req);

    const code =
        String(req.body.code || '')
            .trim()
            .toUpperCase();

    const codes = getCodes();

    const found =
        codes.find(
            item =>
                item.code === code &&
                item.active !== false
        );

    if (!found) {
        return res.send(
            page(
                'Code ungültig',
                '<div class="card">' +
                '<h1>Code ungültig</h1>' +
                '<p>Der Code existiert nicht oder wurde deaktiviert.</p>' +
                '<a class="button" href="/redeem">Zurück</a>' +
                '</div>',
                req
            )
        );
    }

    if (!Array.isArray(found.usedBy)) {
        found.usedBy = [];
    }

    if (
        found.usedBy.includes(user.id)
    ) {
        return res.send(
            page(
                'Code bereits benutzt',
                '<div class="card">' +
                '<h1>Bereits eingelöst</h1>' +
                '<p>Du hast diesen Code bereits verwendet.</p>' +
                '</div>',
                req
            )
        );
    }

    if (
        found.maxUses &&
        found.usedBy.length >=
        found.maxUses
    ) {
        return res.send(
            page(
                'Code aufgebraucht',
                '<div class="card">' +
                '<h1>Code aufgebraucht</h1>' +
                '</div>',
                req
            )
        );
    }

    const amount =
        Number(found.coins || 0);

    user.coins =
        Number(user.coins || 0) +
        amount;

    found.usedBy.push(user.id);

    if (
        found.maxUses &&
        found.usedBy.length >=
        found.maxUses
    ) {
        found.active = false;
    }

    saveCodes(codes);

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    addLog(
        'CODE_REDEEM',
        user,
        code +
        ' +' +
        amount +
        ' Coins'
    );

    res.send(
        page(
            'Code eingelöst',
            '<div class="card">' +
            '<h1>Code eingelöst</h1>' +
            '<p>Du hast <strong>' +
            amount +
            ' Coins</strong> erhalten.</p>' +
            '<p>Dein Guthaben: <strong>' +
            user.coins +
            '</strong></p>' +
            '<a class="button" href="/dashboard">Dashboard</a>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    SHOP
===========================================================
*/

app.get('/shop', requireLogin, (req, res) => {
    const user = currentUser(req);

    const products =
        getProducts().filter(
            product =>
                product.active !== false
        );

    let cards = '';

    for (const product of products) {
        cards +=
            '<div class="card">' +
            '<h2>' +
            escapeHTML(product.name) +
            '</h2>' +
            '<p>' +
            escapeHTML(product.description) +
            '</p>' +
            '<div class="price">' +
            Number(product.price || 0) +
            ' Coins</div>' +
            '<p>Bestand: ' +
            (
                product.stock === -1
                    ? 'Unbegrenzt'
                    : Number(product.stock || 0)
            ) +
            '</p>' +

            '<form method="POST" action="/shop/buy">' +
            '<input type="hidden" name="productId" value="' +
            escapeHTML(product.id) +
            '">' +
            '<button class="button" type="submit">Kaufen</button>' +
            '</form>' +

            '</div>';
    }

    if (!cards) {
        cards =
            '<div class="card">' +
            '<p>Aktuell sind keine Produkte verfügbar.</p>' +
            '</div>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Coins Shop</h1>' +
        '<p>Deine Coins: <strong>' +
        Number(user.coins || 0) +
        '</strong></p>' +
        '<a class="button dark" href="/redeem">Code einlösen</a>' +
        '</div>' +

        '<div class="grid">' +
        cards +
        '</div>';

    res.send(
        page(
            'Shop',
            content,
            req
        )
    );
});

app.post('/shop/buy', requireLogin, (req, res) => {
    const user = currentUser(req);

    const productId =
        String(req.body.productId || '');

    const products = getProducts();

    const product =
        products.find(
            item =>
                item.id === productId &&
                item.active !== false
        );

    if (!product) {
        return res.redirect('/shop');
    }

    const price =
        Number(product.price || 0);

    if (
        Number(user.coins || 0) <
        price
    ) {
        return res.send(
            page(
                'Nicht genug Coins',
                '<div class="card">' +
                '<h1>Nicht genug Coins</h1>' +
                '<p>Du benötigst ' +
                price +
                ' Coins.</p>' +
                '<a class="button" href="/shop">Zurück zum Shop</a>' +
                '</div>',
                req
            )
        );
    }

    if (
        product.stock !== -1 &&
        Number(product.stock || 0) <= 0
    ) {
        return res.send(
            page(
                'Ausverkauft',
                '<div class="card">' +
                '<h1>Ausverkauft</h1>' +
                '</div>',
                req
            )
        );
    }

    user.coins -= price;

    if (product.stock !== -1) {
        product.stock =
            Number(product.stock || 0) - 1;
    }

    const order = {
        id: crypto.randomUUID(),
        number: createOrderNumber(),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.name,
        price: price,
        status: 'open',
        createdAt: Date.now()
    };

    const orders = getOrders();
    orders.push(order);

    saveOrders(orders);
    saveProducts(products);

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === user.id
    );

    if (index !== -1) {
        users[index] = user;
        saveUsers(users);
    }

    addLog(
        'SHOP_ORDER',
        user,
        order.number +
        ' | ' +
        product.name
    );

    res.send(
        page(
            'Bestellung',
            '<div class="card">' +
            '<h1>Bestellung erstellt</h1>' +
            '<p>Produkt: <strong>' +
            escapeHTML(product.name) +
            '</strong></p>' +
            '<p>Bestellnummer: <strong>' +
            escapeHTML(order.number) +
            '</strong></p>' +
            '<p>Preis: ' +
            price +
            ' Coins</p>' +
            '<p>Deine Bestellung wird vom Team bearbeitet.</p>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    GEWINNSPIELE
===========================================================
*/

app.get('/giveaways', requireLogin, (req, res) => {
    const user = currentUser(req);

    const giveaways =
        getGiveaways().filter(
            giveaway =>
                giveaway.active !== false
        );

    let cards = '';

    for (const giveaway of giveaways) {
        const entries =
            Array.isArray(giveaway.entries)
                ? giveaway.entries
                : [];

        const joined =
            entries.includes(user.id);

        cards +=
            '<div class="card">' +
            '<h2>' +
            escapeHTML(giveaway.title) +
            '</h2>' +
            '<p>' +
            escapeHTML(giveaway.description) +
            '</p>' +
            '<p>Ende: ' +
            formatDate(giveaway.endsAt) +
            '</p>' +
            '<p>Teilnehmer: ' +
            entries.length +
            '</p>' +

            (
                joined
                    ? '<span class="badge">Teilgenommen</span>'
                    : '<form method="POST" action="/giveaways/join">' +
                      '<input type="hidden" name="id" value="' +
                      escapeHTML(giveaway.id) +
                      '">' +
                      '<button class="button" type="submit">Teilnehmen</button>' +
                      '</form>'
            ) +

            '</div>';
    }

    if (!cards) {
        cards =
            '<div class="card">' +
            '<p>Keine aktiven Gewinnspiele.</p>' +
            '</div>';
    }

    res.send(
        page(
            'Gewinnspiele',
            '<div class="hero">' +
            '<h1>Gewinnspiele</h1>' +
            '<p>Hier kannst du an Web-Gewinnspielen teilnehmen.</p>' +
            '</div>' +
            '<div class="grid">' +
            cards +
            '</div>',
            req
        )
    );
});

app.post('/giveaways/join', requireLogin, (req, res) => {
    const user = currentUser(req);

    const id =
        String(req.body.id || '');

    const giveaways = getGiveaways();

    const giveaway =
        giveaways.find(
            item =>
                item.id === id &&
                item.active !== false
        );

    if (!giveaway) {
        return res.redirect('/giveaways');
    }

    if (!Array.isArray(giveaway.entries)) {
        giveaway.entries = [];
    }

    if (!giveaway.entries.includes(user.id)) {
        giveaway.entries.push(user.id);

        saveGiveaways(giveaways);

        addLog(
            'GIVEAWAY_JOIN',
            user,
            giveaway.title
        );
    }

    res.redirect('/giveaways');
});

/*
===========================================================
                    USER CHAT
===========================================================
*/

app.get('/chat', requireLogin, (req, res) => {
    const user = currentUser(req);

    const messages =
        getMessages()
            .filter(
                message =>
                    message.channel === 'community'
            )
            .slice(0, 100);

    let list = '';

    for (const message of messages.reverse()) {
        list +=
            '<div class="message">' +
            '<strong>' +
            escapeHTML(message.username) +
            '</strong> ' +
            roleBadge(message.role) +
            '<span class="muted"> ' +
            formatDate(message.createdAt) +
            '</span>' +
            '<p>' +
            escapeHTML(message.text) +
            '</p>' +
            '</div>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Community Chat</h1>' +
        '</div>' +

        '<div class="card">' +
        list +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/chat">' +
        '<label>Nachricht</label>' +
        '<textarea name="text" required maxlength="1000"></textarea>' +
        '<button class="button" type="submit">Senden</button>' +
        '</form>' +
        '</div>';

    res.send(
        page(
            'Chat',
            content,
            req
        )
    );
});

app.post('/chat', requireLogin, (req, res) => {
    const user = currentUser(req);

    const text =
        String(req.body.text || '').trim();

    if (!text) {
        return res.redirect('/chat');
    }

    const messages = getMessages();

    messages.push({
        id: crypto.randomUUID(),
        channel: 'community',
        userId: user.id,
        username: user.username,
        role: user.role,
        text: text,
        createdAt: Date.now()
    });

    if (messages.length > 5000) {
        messages.splice(
            0,
            messages.length - 5000
        );
    }

    saveMessages(messages);

    addLog(
        'CHAT_MESSAGE',
        user,
        'Community Chat'
    );

    res.redirect('/chat');
});

/*
===========================================================
                    ADMIN PANEL
===========================================================
*/

app.get('/admin', requireStaff, (req, res) => {
    const user = currentUser(req);

    const users = getUsers();
    const tickets = getTickets();
    const codes = getCodes();
    const products = getProducts();
    const giveaways = getGiveaways();
    const orders = getOrders();
    const logs = getLogs();

    const settings = getSettings();

    const totalCoins =
        users.reduce(
            (sum, item) =>
                sum +
                Number(item.coins || 0),
            0
        );

    const content =
        '<div class="hero">' +
        '<h1>Admin Panel</h1>' +
        '<p>' +
        escapeHTML(user.username) +
        ' · ' +
        roleBadge(user.role) +
        '</p>' +
        '</div>' +

        '<div class="grid">' +

        '<div class="card">' +
        '<div class="muted">Registrierte User</div>' +
        '<div class="stat">' +
        users.length +
        '</div>' +
        '</div>' +

        '<div class="card">' +
        '<div class="muted">Tickets</div>' +
        '<div class="stat">' +
        tickets.length +
        '</div>' +
        '</div>' +

        '<div class="card">' +
        '<div class="muted">Coins im System</div>' +
        '<div class="stat">' +
        totalCoins +
        '</div>' +
        '</div>' +

        '<div class="card">' +
        '<div class="muted">Logs</div>' +
        '<div class="stat">' +
        logs.length +
        '</div>' +
        '</div>' +

        '</div>' +

        '<div class="grid">' +

        '<div class="card">' +
        '<h2>Verwaltung</h2>' +
        '<a class="button" href="/admin/users">Benutzer</a>' +
        '<a class="button" href="/admin/codes">Codes</a>' +
        '<a class="button" href="/admin/products">Shop</a>' +
        '<a class="button" href="/admin/giveaways">Gewinnspiele</a>' +
        '<a class="button" href="/admin/orders">Bestellungen</a>' +
        '<a class="button" href="/admin/tickets">Tickets</a>' +
        '<a class="button" href="/admin/logs">Logs</a>' +
        '<a class="button" href="/admin/team-chat">Team Chat</a>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Status</h2>' +
        '<p>Wartung: ' +
        (
            settings.maintenance
                ? '<span class="badge">AKTIV</span>'
                : '<span class="badge">AUS</span>'
        ) +
        '</p>' +
        '<p>Störung: ' +
        (
            settings.incident
                ? '<span class="badge">AKTIV</span>'
                : '<span class="badge">AUS</span>'
        ) +
        '</p>' +
        '<a class="button dark" href="/admin/status">Status verwalten</a>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Ankündigungen</h2>' +
        '<a class="button" href="/admin/announcements">Verwalten</a>' +
        '</div>' +

        '</div>';

    res.send(
        page(
            'Admin Panel',
            content,
            req
        )
    );
});

/*
===========================================================
                    ADMIN USER
===========================================================
*/

app.get('/admin/users', requireStaff, (req, res) => {
    const users = getUsers();

    let rows = '';

    for (const user of users) {
        rows +=
            '<tr>' +

            '<td>' +
            escapeHTML(user.username) +
            '</td>' +

            '<td>' +
            escapeHTML(user.email) +
            '</td>' +

            '<td>' +
            roleBadge(user.role) +
            '</td>' +

            '<td>' +
            Number(user.coins || 0) +
            '</td>' +

            '<td>' +
            (
                isUserBanned(user)
                    ? '<span class="badge">GEBANNT</span><br>' +
                      escapeHTML(
                          banText(user)
                      )
                    : '<span class="badge">OK</span>'
            ) +
            '</td>' +

            '<td>' +

            '<a class="button dark" href="/admin/users/' +
            encodeURIComponent(user.id) +
            '">Bearbeiten</a>' +

            '</td>' +

            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Benutzer</h1>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Name</th>' +
        '<th>E-Mail</th>' +
        '<th>Rolle</th>' +
        '<th>Coins</th>' +
        '<th>Status</th>' +
        '<th>Aktion</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Benutzer',
            content,
            req
        )
    );
});

app.get('/admin/users/:id', requireStaff, (req, res) => {
    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    const user = currentUser(req);

    const content =
        '<div class="card">' +
        '<h1>' +
        escapeHTML(target.username) +
        '</h1>' +

        '<p>E-Mail: ' +
        escapeHTML(target.email) +
        '</p>' +

        '<p>Coins: ' +
        Number(target.coins || 0) +
        '</p>' +

        '<p>Rolle: ' +
        roleBadge(target.role) +
        '</p>' +

        '<p>Ban: ' +
        (
            isUserBanned(target)
                ? escapeHTML(
                    banText(target)
                  )
                : 'Nein'
        ) +
        '</p>' +

        '</div>' +

        '<div class="card">' +
        '<h2>Coins ändern</h2>' +
        '<form method="POST" action="/admin/users/' +
        encodeURIComponent(target.id) +
        '/coins">' +
        '<input type="number" name="amount" required placeholder="z.B. 100">' +
        '<button class="button" type="submit">Coins hinzufügen / abziehen</button>' +
        '</form>' +
        '</div>' +

        (
            isOwner(user)
                ? '<div class="card">' +
                  '<h2>Rolle ändern</h2>' +
                  '<form method="POST" action="/admin/users/' +
                  encodeURIComponent(target.id) +
                  '/role">' +
                  '<select name="role">' +
                  '<option value="user">User</option>' +
                  '<option value="moderator">Moderator</option>' +
                  '<option value="developer">Developer</option>' +
                  '<option value="manager">Manager</option>' +
                  '<option value="admin">Admin</option>' +
                  '<option value="owner">Owner</option>' +
                  '</select>' +
                  '<button class="button" type="submit">Rolle speichern</button>' +
                  '</form>' +
                  '</div>'
                : ''
        ) +

        '<div class="card">' +
        '<h2>Webseiten-Ban</h2>' +

        '<form method="POST" action="/admin/users/' +
        encodeURIComponent(target.id) +
        '/ban">' +

        '<label>Dauer</label>' +
        '<select name="duration">' +
        '<option value="1">1 Minute</option>' +
        '<option value="5">5 Minuten</option>' +
        '<option value="30">30 Minuten</option>' +
        '<option value="60">1 Stunde</option>' +
        '<option value="1440">1 Tag</option>' +
        '<option value="10080">7 Tage</option>' +
        '<option value="permanent">Permanent</option>' +
        '</select>' +

        '<label>Grund</label>' +
        '<input name="reason" maxlength="300" required>' +

        '<button class="button danger" type="submit">User bannen</button>' +

        '</form>' +

        '<form method="POST" action="/admin/users/' +
        encodeURIComponent(target.id) +
        '/unban">' +
        '<button class="button success" type="submit">Entbannen</button>' +
        '</form>' +

        '</div>' +

        '<div class="card">' +
        '<h2>Kick</h2>' +

        '<form method="POST" action="/admin/users/' +
        encodeURIComponent(target.id) +
        '/kick">' +
        '<button class="button danger" type="submit">Webseiten-Kick</button>' +
        '</form>' +

        '</div>';

    res.send(
        page(
            'Benutzer bearbeiten',
            content,
            req
        )
    );
});

app.post('/admin/users/:id/coins', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    const amount =
        Number(req.body.amount || 0);

    target.coins =
        Math.max(
            0,
            Number(target.coins || 0) +
            amount
        );

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === target.id
    );

    if (index !== -1) {
        users[index] = target;
        saveUsers(users);
    }

    addLog(
        'ADMIN_COINS',
        admin,
        target.username +
        ' ' +
        (amount >= 0 ? '+' : '') +
        amount
    );

    res.redirect(
        '/admin/users/' +
        encodeURIComponent(target.id)
    );
});

app.post('/admin/users/:id/role', requireOwner, (req, res) => {
    const admin = currentUser(req);

    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    const allowed = [
        'user',
        'moderator',
        'developer',
        'manager',
        'admin',
        'owner'
    ];

    const role =
        String(req.body.role || '');

    if (!allowed.includes(role)) {
        return res.redirect('/admin/users');
    }

    target.role = role;

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === target.id
    );

    if (index !== -1) {
        users[index] = target;
        saveUsers(users);
    }

    addLog(
        'ROLE_CHANGE',
        admin,
        target.username +
        ' -> ' +
        role
    );

    res.redirect(
        '/admin/users/' +
        encodeURIComponent(target.id)
    );
});

app.post('/admin/users/:id/ban', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    if (
        isOwner(target) &&
        !isOwner(admin)
    ) {
        return res.status(403).send(
            'Owner kann nur vom Owner verwaltet werden.'
        );
    }

    const duration =
        String(req.body.duration || '');

    const reason =
        String(req.body.reason || '')
            .trim()
            .slice(0, 300);

    if (duration === 'permanent') {
        target.bannedUntil = -1;
    } else {
        const minutes =
            Math.max(
                1,
                Number(duration || 1)
            );

        target.bannedUntil =
            Date.now() +
            minutes * 60 * 1000;
    }

    target.banReason = reason;

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === target.id
    );

    if (index !== -1) {
        users[index] = target;
        saveUsers(users);
    }

    addLog(
        'WEB_BAN',
        admin,
        target.username +
        ' | ' +
        reason +
        ' | ' +
        banText(target)
    );

    res.redirect('/admin/users');
});

app.post('/admin/users/:id/unban', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    target.bannedUntil = 0;
    target.banReason = '';

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === target.id
    );

    if (index !== -1) {
        users[index] = target;
        saveUsers(users);
    }

    addLog(
        'WEB_UNBAN',
        admin,
        target.username
    );

    res.redirect('/admin/users');
});

app.post('/admin/users/:id/kick', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const target =
        findUserById(req.params.id);

    if (!target) {
        return res.redirect('/admin/users');
    }

    if (
        isOwner(target) &&
        !isOwner(admin)
    ) {
        return res.status(403).send(
            'Owner kann nur vom Owner verwaltet werden.'
        );
    }

    target.kicked = true;

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === target.id
    );

    if (index !== -1) {
        users[index] = target;
        saveUsers(users);
    }

    addLog(
        'WEB_KICK',
        admin,
        target.username
    );

    res.redirect('/admin/users');
});

/*
===========================================================
                    ADMIN CODES
===========================================================
*/

app.get('/admin/codes', requireStaff, (req, res) => {
    const codes = getCodes();

    let rows = '';

    for (const code of codes) {
        rows +=
            '<tr>' +
            '<td><strong>' +
            escapeHTML(code.code) +
            '</strong></td>' +
            '<td>' +
            Number(code.coins || 0) +
            '</td>' +
            '<td>' +
            (
                Array.isArray(code.usedBy)
                    ? code.usedBy.length
                    : 0
            ) +
            '</td>' +
            '<td>' +
            (
                code.active !== false
                    ? 'Aktiv'
                    : 'Deaktiviert'
            ) +
            '</td>' +
            '<td>' +
            '<form method="POST" action="/admin/codes/toggle">' +
            '<input type="hidden" name="id" value="' +
            escapeHTML(code.id) +
            '">' +
            '<button class="button dark" type="submit">' +
            (
                code.active !== false
                    ? 'Deaktivieren'
                    : 'Aktivieren'
            ) +
            '</button>' +
            '</form>' +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Coin-Codes</h1>' +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/admin/codes">' +

        '<label>Coins</label>' +
        '<input type="number" name="coins" min="1" required>' +

        '<label>Maximale Einlösungen</label>' +
        '<input type="number" name="maxUses" min="1" value="1" required>' +

        '<button class="button" type="submit">Code erstellen</button>' +

        '</form>' +
        '</div>' +

        '<div class="card">' +
        '<h2>Vorhandene Codes</h2>' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Code</th>' +
        '<th>Coins</th>' +
        '<th>Benutzt</th>' +
        '<th>Status</th>' +
        '<th></th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Codes',
            content,
            req
        )
    );
});

app.post('/admin/codes', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const coins =
        Math.max(
            1,
            Number(req.body.coins || 0)
        );

    const maxUses =
        Math.max(
            1,
            Number(req.body.maxUses || 1)
        );

    const codes = getCodes();

    let code;

    do {
        code = createCode();
    } while (
        codes.some(
            item => item.code === code
        )
    );

    codes.unshift({
        id: crypto.randomUUID(),
        code: code,
        coins: coins,
        maxUses: maxUses,
        usedBy: [],
        active: true,
        createdBy: admin.id,
        createdAt: Date.now()
    });

    saveCodes(codes);

    addLog(
        'CODE_CREATE',
        admin,
        code +
        ' | ' +
        coins +
        ' Coins | ' +
        maxUses +
        ' Nutzungen'
    );

    res.send(
        page(
            'Code erstellt',
            '<div class="card">' +
            '<h1>Code erstellt</h1>' +
            '<p>Der neue Code lautet:</p>' +
            '<div class="stat">' +
            escapeHTML(code) +
            '</div>' +
            '<p>Coins: ' +
            coins +
            '</p>' +
            '<p>Max. Einlösungen: ' +
            maxUses +
            '</p>' +
            '<a class="button" href="/admin/codes">Zurück</a>' +
            '</div>',
            req
        )
    );
});

app.post('/admin/codes/toggle', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const codes = getCodes();

    const code =
        codes.find(
            item =>
                item.id === req.body.id
        );

    if (code) {
        code.active =
            code.active === false;

        saveCodes(codes);

        addLog(
            'CODE_TOGGLE',
            admin,
            code.code
        );
    }

    res.redirect('/admin/codes');
});

/*
===========================================================
                    ADMIN SHOP
===========================================================
*/

app.get('/admin/products', requireStaff, (req, res) => {
    const products = getProducts();

    let rows = '';

    for (const product of products) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(product.name) +
            '</td>' +
            '<td>' +
            Number(product.price || 0) +
            '</td>' +
            '<td>' +
            (
                product.stock === -1
                    ? '∞'
                    : Number(product.stock || 0)
            ) +
            '</td>' +
            '<td>' +
            (
                product.active !== false
                    ? 'Aktiv'
                    : 'Aus'
            ) +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Shop-Produkte</h1>' +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/admin/products">' +

        '<label>Name</label>' +
        '<input name="name" maxlength="100" required>' +

        '<label>Beschreibung</label>' +
        '<textarea name="description" maxlength="1000"></textarea>' +

        '<label>Preis in Coins</label>' +
        '<input type="number" name="price" min="0" required>' +

        '<label>Bestand (-1 = unbegrenzt)</label>' +
        '<input type="number" name="stock" value="-1" required>' +

        '<button class="button" type="submit">Produkt erstellen</button>' +

        '</form>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Name</th>' +
        '<th>Preis</th>' +
        '<th>Bestand</th>' +
        '<th>Status</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Produkte',
            content,
            req
        )
    );
});

app.post('/admin/products', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const products = getProducts();

    products.unshift({
        id: crypto.randomUUID(),
        name:
            String(req.body.name || '')
                .trim()
                .slice(0, 100),
        description:
            String(req.body.description || '')
                .trim()
                .slice(0, 1000),
        price:
            Math.max(
                0,
                Number(req.body.price || 0)
            ),
        stock:
            Number(req.body.stock || -1),
        active: true,
        createdBy: admin.id,
        createdAt: Date.now()
    });

    saveProducts(products);

    addLog(
        'PRODUCT_CREATE',
        admin,
        products[0].name
    );

    res.redirect('/admin/products');
});

/*
===========================================================
                    ADMIN GEWINNSPIELE
===========================================================
*/

app.get('/admin/giveaways', requireStaff, (req, res) => {
    const giveaways =
        getGiveaways();

    let rows = '';

    for (const giveaway of giveaways) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(giveaway.title) +
            '</td>' +
            '<td>' +
            (
                Array.isArray(giveaway.entries)
                    ? giveaway.entries.length
                    : 0
            ) +
            '</td>' +
            '<td>' +
            formatDate(giveaway.endsAt) +
            '</td>' +
            '<td>' +
            (
                giveaway.active !== false
                    ? 'Aktiv'
                    : 'Beendet'
            ) +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Gewinnspiele</h1>' +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/admin/giveaways">' +

        '<label>Titel</label>' +
        '<input name="title" required maxlength="100">' +

        '<label>Beschreibung</label>' +
        '<textarea name="description" required maxlength="1000"></textarea>' +

        '<label>Ende</label>' +
        '<input type="datetime-local" name="endsAt" required>' +

        '<button class="button" type="submit">Gewinnspiel erstellen</button>' +

        '</form>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Titel</th>' +
        '<th>Teilnehmer</th>' +
        '<th>Ende</th>' +
        '<th>Status</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Gewinnspiele',
            content,
            req
        )
    );
});

app.post('/admin/giveaways', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const endsAt =
        new Date(
            req.body.endsAt
        ).getTime();

    const giveaways =
        getGiveaways();

    giveaways.unshift({
        id: crypto.randomUUID(),
        title:
            String(req.body.title || '')
                .trim(),
        description:
            String(req.body.description || '')
                .trim(),
        endsAt:
            Number.isFinite(endsAt)
                ? endsAt
                : Date.now() + 86400000,
        entries: [],
        active: true,
        createdBy: admin.id,
        createdAt: Date.now(),
        winnerId: null
    });

    saveGiveaways(giveaways);

    addLog(
        'GIVEAWAY_CREATE',
        admin,
        giveaways[0].title
    );

    res.redirect('/admin/giveaways');
});

/*
===========================================================
                    ADMIN BESTELLUNGEN
===========================================================
*/

app.get('/admin/orders', requireStaff, (req, res) => {
    const orders = getOrders();

    let rows = '';

    for (const order of orders) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(order.number) +
            '</td>' +
            '<td>' +
            escapeHTML(order.username) +
            '</td>' +
            '<td>' +
            escapeHTML(order.productName) +
            '</td>' +
            '<td>' +
            Number(order.price || 0) +
            '</td>' +
            '<td>' +
            escapeHTML(order.status) +
            '</td>' +
            '<td>' +
            formatDate(order.createdAt) +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Bestellungen</h1>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Bestellnummer</th>' +
        '<th>User</th>' +
        '<th>Produkt</th>' +
        '<th>Coins</th>' +
        '<th>Status</th>' +
        '<th>Datum</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Bestellungen',
            content,
            req
        )
    );
});

/*
===========================================================
                    ADMIN TICKETS
===========================================================
*/

app.get('/admin/tickets', requireStaff, (req, res) => {
    const tickets = getTickets();

    let rows = '';

    for (const ticket of tickets) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(ticket.number) +
            '</td>' +
            '<td>' +
            escapeHTML(ticket.username) +
            '</td>' +
            '<td>' +
            escapeHTML(ticket.subject) +
            '</td>' +
            '<td>' +
            escapeHTML(ticket.status) +
            '</td>' +
            '<td>' +
            (
                ticket.claimedByName
                    ? escapeHTML(ticket.claimedByName)
                    : 'Niemand'
            ) +
            '</td>' +
            '<td>' +
            '<a class="button dark" href="/tickets/' +
            encodeURIComponent(ticket.id) +
            '">Öffnen</a>' +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Ticket-Verwaltung</h1>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Ticket</th>' +
        '<th>User</th>' +
        '<th>Betreff</th>' +
        '<th>Status</th>' +
        '<th>Übernommen</th>' +
        '<th></th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Tickets',
            content,
            req
        )
    );
});

/*
===========================================================
                    ADMIN LOGS
===========================================================
*/

app.get('/admin/logs', requireStaff, (req, res) => {
    const logs =
        getLogs().slice(0, 500);

    let rows = '';

    for (const log of logs) {
        rows +=
            '<tr>' +
            '<td>' +
            formatDate(log.timestamp) +
            '</td>' +
            '<td>' +
            escapeHTML(log.action) +
            '</td>' +
            '<td>' +
            escapeHTML(log.username) +
            '</td>' +
            '<td>' +
            escapeHTML(log.details) +
            '</td>' +
            '</tr>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Logs</h1>' +
        '</div>' +

        '<div class="card">' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Zeit</th>' +
        '<th>Aktion</th>' +
        '<th>User</th>' +
        '<th>Details</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';

    res.send(
        page(
            'Logs',
            content,
            req
        )
    );
});

/*
===========================================================
                    STATUS
===========================================================
*/

app.get('/admin/status', requireStaff, (req, res) => {
    const settings =
        getSettings();

    const content =
        '<div class="hero">' +
        '<h1>Status</h1>' +
        '</div>' +

        '<div class="card">' +

        '<h2>Wartung</h2>' +

        '<form method="POST" action="/admin/status">' +

        '<input type="hidden" name="type" value="maintenance">' +

        '<label>Aktiv</label>' +
        '<select name="enabled">' +
        '<option value="false">Aus</option>' +
        '<option value="true" ' +
        (
            settings.maintenance
                ? 'selected'
                : ''
        ) +
        '>An</option>' +
        '</select>' +

        '<label>Text</label>' +
        '<textarea name="text">' +
        escapeHTML(
            settings.maintenanceText
        ) +
        '</textarea>' +

        '<button class="button" type="submit">Wartung speichern</button>' +

        '</form>' +

        '</div>' +

        '<div class="card">' +

        '<h2>Störung</h2>' +

        '<form method="POST" action="/admin/status">' +

        '<input type="hidden" name="type" value="incident">' +

        '<label>Aktiv</label>' +
        '<select name="enabled">' +
        '<option value="false">Aus</option>' +
        '<option value="true" ' +
        (
            settings.incident
                ? 'selected'
                : ''
        ) +
        '>An</option>' +
        '</select>' +

        '<label>Text</label>' +
        '<textarea name="text">' +
        escapeHTML(
            settings.incidentText
        ) +
        '</textarea>' +

        '<button class="button" type="submit">Störung speichern</button>' +

        '</form>' +

        '</div>';

    res.send(
        page(
            'Status',
            content,
            req
        )
    );
});

app.post('/admin/status', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const settings =
        getSettings();

    const enabled =
        req.body.enabled === 'true';

    const type =
        String(req.body.type || '');

    const text =
        String(req.body.text || '').trim();

    if (type === 'maintenance') {
        settings.maintenance = enabled;
        settings.maintenanceText =
            text ||
            'Die Webseite befindet sich aktuell in Wartung.';
    }

    if (type === 'incident') {
        settings.incident = enabled;
        settings.incidentText =
            text ||
            'Aktuell liegt eine Störung vor.';
    }

    saveSettings(settings);

    addLog(
        'STATUS_CHANGE',
        admin,
        type +
        ' = ' +
        enabled
    );

    res.redirect('/admin/status');
});

/*
===========================================================
                    ANKÜNDIGUNGEN
===========================================================
*/

app.get('/admin/announcements', requireStaff, (req, res) => {
    const announcements =
        getAnnouncements();

    let list = '';

    for (const announcement of announcements) {
        list +=
            '<div class="card">' +
            '<h2>' +
            escapeHTML(announcement.title) +
            '</h2>' +
            '<p>' +
            escapeHTML(announcement.text) +
            '</p>' +
            '<span class="muted">' +
            formatDate(
                announcement.createdAt
            ) +
            '</span>' +
            '</div>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Ankündigungen</h1>' +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/admin/announcements">' +

        '<label>Titel</label>' +
        '<input name="title" required maxlength="150">' +

        '<label>Text</label>' +
        '<textarea name="text" required maxlength="5000"></textarea>' +

        '<button class="button" type="submit">Ankündigung veröffentlichen</button>' +

        '</form>' +
        '</div>' +

        list;

    res.send(
        page(
            'Ankündigungen',
            content,
            req
        )
    );
});

app.post('/admin/announcements', requireStaff, (req, res) => {
    const admin = currentUser(req);

    const announcements =
        getAnnouncements();

    announcements.unshift({
        id: crypto.randomUUID(),
        title:
            String(req.body.title || '').trim(),
        text:
            String(req.body.text || '').trim(),
        createdBy: admin.id,
        createdAt: Date.now()
    });

    saveAnnouncements(announcements);

    addLog(
        'ANNOUNCEMENT_CREATE',
        admin,
        announcements[0].title
    );

    res.redirect('/admin/announcements');
});

/*
===========================================================
                    TEAM CHAT
===========================================================
*/

app.get('/admin/team-chat', requireStaff, (req, res) => {
    const user = currentUser(req);

    const messages =
        getMessages()
            .filter(
                message =>
                    message.channel === 'team'
            )
            .slice(-100);

    let list = '';

    for (const message of messages) {
        list +=
            '<div class="message">' +
            '<strong>' +
            escapeHTML(message.username) +
            '</strong> ' +
            roleBadge(message.role) +
            '<span class="muted"> ' +
            formatDate(message.createdAt) +
            '</span>' +
            '<p>' +
            escapeHTML(message.text) +
            '</p>' +
            '</div>';
    }

    const content =
        '<div class="hero">' +
        '<h1>Team Chat</h1>' +
        '<p>Nur Teammitglieder können diesen Chat sehen.</p>' +
        '</div>' +

        '<div class="card">' +
        list +
        '</div>' +

        '<div class="card">' +
        '<form method="POST" action="/admin/team-chat">' +
        '<textarea name="text" required maxlength="2000"></textarea>' +
        '<button class="button" type="submit">Senden</button>' +
        '</form>' +
        '</div>';

    res.send(
        page(
            'Team Chat',
            content,
            req
        )
    );
});

app.post('/admin/team-chat', requireStaff, (req, res) => {
    const user = currentUser(req);

    const text =
        String(req.body.text || '').trim();

    if (!text) {
        return res.redirect('/admin/team-chat');
    }

    const messages =
        getMessages();

    messages.push({
        id: crypto.randomUUID(),
        channel: 'team',
        userId: user.id,
        username: user.username,
        role: user.role,
        text: text,
        createdAt: Date.now()
    });

    saveMessages(messages);

    addLog(
        'TEAM_CHAT',
        user,
        'Team Nachricht'
    );

    res.redirect('/admin/team-chat');
});

/*
===========================================================
                    DEVELOPER / MANAGER REQUESTS
===========================================================
*/

app.get('/requests/new', requireLogin, (req, res) => {
    const content =
        '<div class="card">' +
        '<h1>Auftrag erstellen</h1>' +

        '<p>' +
        'Developer, Manager, Owner und berechtigte Teammitglieder können die Anfrage anschließend bearbeiten.' +
        '</p>' +

        '<form method="POST" action="/requests/new">' +

        '<label>Projekt / Auftrag</label>' +
        '<input name="title" required maxlength="150">' +

        '<label>Beschreibung</label>' +
        '<textarea name="description" required maxlength="5000"></textarea>' +

        '<label>Typ</label>' +
        '<select name="type">' +
        '<option value="developer">Developer</option>' +
        '<option value="manager">Manager</option>' +
        '<option value="owner">Owner</option>' +
        '</select>' +

        '<button class="button" type="submit">Anfrage erstellen</button>' +

        '</form>' +
        '</div>';

    res.send(
        page(
            'Auftrag erstellen',
            content,
            req
        )
    );
});

app.post('/requests/new', requireLogin, (req, res) => {
    const user = currentUser(req);

    const requests =
        getRequests();

    const request = {
        id: crypto.randomUUID(),
        number: createRequestNumber(),
        userId: user.id,
        username: user.username,
        title:
            String(req.body.title || '').trim(),
        description:
            String(req.body.description || '').trim(),
        type:
            String(req.body.type || 'developer'),
        status: 'open',
        assignedTo: null,
        createdAt: Date.now()
    };

    requests.unshift(request);

    saveRequests(requests);

    addLog(
        'REQUEST_CREATE',
        user,
        request.number
    );

    res.send(
        page(
            'Anfrage erstellt',
            '<div class="card">' +
            '<h1>Anfrage erstellt</h1>' +
            '<p>Deine Bestell-/Anfragenummer:</p>' +
            '<div class="stat">' +
            escapeHTML(request.number) +
            '</div>' +
            '<p>Gib diese Nummer bei Bedarf dem Team auf Discord.</p>' +
            '<a class="button" href="/dashboard">Dashboard</a>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    ADMIN REQUESTS
===========================================================
*/

app.get('/admin/requests', requireStaff, (req, res) => {
    const requests =
        getRequests();

    let rows = '';

    for (const item of requests) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(item.number) +
            '</td>' +
            '<td>' +
            escapeHTML(item.username) +
            '</td>' +
            '<td>' +
            escapeHTML(item.title) +
            '</td>' +
            '<td>' +
            escapeHTML(item.type) +
            '</td>' +
            '<td>' +
            escapeHTML(item.status) +
            '</td>' +
            '</tr>';
    }

    res.send(
        page(
            'Anfragen',
            '<div class="hero">' +
            '<h1>Developer / Manager Anfragen</h1>' +
            '</div>' +

            '<div class="card">' +
            '<table>' +
            '<thead>' +
            '<tr>' +
            '<th>Nummer</th>' +
            '<th>User</th>' +
            '<th>Titel</th>' +
            '<th>Typ</th>' +
            '<th>Status</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' +
            rows +
            '</tbody>' +
            '</table>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    USER ORDERS
===========================================================
*/

app.get('/orders', requireLogin, (req, res) => {
    const user = currentUser(req);

    const orders =
        getOrders().filter(
            order =>
                order.userId === user.id
        );

    let rows = '';

    for (const order of orders) {
        rows +=
            '<tr>' +
            '<td>' +
            escapeHTML(order.number) +
            '</td>' +
            '<td>' +
            escapeHTML(order.productName) +
            '</td>' +
            '<td>' +
            Number(order.price || 0) +
            '</td>' +
            '<td>' +
            escapeHTML(order.status) +
            '</td>' +
            '<td>' +
            formatDate(order.createdAt) +
            '</td>' +
            '</tr>';
    }

    res.send(
        page(
            'Meine Bestellungen',
            '<div class="hero">' +
            '<h1>Meine Bestellungen</h1>' +
            '</div>' +

            '<div class="card">' +
            '<table>' +
            '<thead>' +
            '<tr>' +
            '<th>Nummer</th>' +
            '<th>Produkt</th>' +
            '<th>Coins</th>' +
            '<th>Status</th>' +
            '<th>Datum</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' +
            rows +
            '</tbody>' +
            '</table>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    PUBLIC ANNOUNCEMENTS
===========================================================
*/

app.get('/announcements', (req, res) => {
    const announcements =
        getAnnouncements();

    let content = '';

    for (const announcement of announcements) {
        content +=
            '<div class="card">' +
            '<h2>' +
            escapeHTML(announcement.title) +
            '</h2>' +
            '<p>' +
            escapeHTML(announcement.text) +
            '</p>' +
            '<span class="muted">' +
            formatDate(announcement.createdAt) +
            '</span>' +
            '</div>';
    }

    res.send(
        page(
            'Ankündigungen',
            '<div class="hero">' +
            '<h1>Ankündigungen</h1>' +
            '</div>' +
            content,
            req
        )
    );
});

/*
===========================================================
                    404
===========================================================
*/

app.use((req, res) => {
    res.status(404).send(
        page(
            '404',
            '<div class="card">' +
            '<h1>404</h1>' +
            '<p>Diese Seite wurde nicht gefunden.</p>' +
            '<a class="button" href="/">Zur Startseite</a>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    ERROR HANDLER
===========================================================
*/

app.use((error, req, res, next) => {
    console.error(
        'Webseiten-Fehler:',
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send(
        page(
            'Fehler',
            '<div class="card">' +
            '<h1>Interner Fehler</h1>' +
            '<p>Die Anfrage konnte nicht verarbeitet werden.</p>' +
            '<a class="button" href="/">Startseite</a>' +
            '</div>',
            req
        )
    );
});

/*
===========================================================
                    SERVER START
===========================================================
*/

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('======================================');
    console.log(' North-Bot-2 Webseite');
    console.log('======================================');
    console.log(
        'Server läuft auf Port: ' +
        PORT
    );
    console.log(
        'Discord: ' +
        CONFIG.DISCORD_INVITE
    );
    console.log(
        'Owner: ' +
        CONFIG.OWNER_EMAIL
    );
    console.log('======================================');
});
