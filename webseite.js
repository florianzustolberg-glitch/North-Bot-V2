'use strict';

/*
 * ============================================================
 * Florian / WeisserHai Minecraft Hosting
 * komplette webseite.js
 * ============================================================
 *
 * Benötigte Pakete:
 *
 * npm install express express-session connect-sqlite3 sqlite3 bcryptjs
 *
 * Start:
 *
 * node webseite.js
 *
 * Environment:
 *
 * PORT=10000
 * SESSION_SECRET=ein-langes-geheimes-passwort
 * OWNER_EMAIL=florianzustolberg@gmail.com
 *
 * ============================================================
 */

const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

/* ============================================================
   KONFIGURATION
   ============================================================ */

const app = express();

const PORT = Number(process.env.PORT || 10000);

const OWNER_EMAIL = String(
    process.env.OWNER_EMAIL || 'florianzustolberg@gmail.com'
).toLowerCase().trim();

const SESSION_SECRET = String(
    process.env.SESSION_SECRET || 'CHANGE-ME-IN-RENDER'
);

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'hosting.db');
const SESSION_DB = path.join(DATA_DIR, 'sessions.db');

/* ============================================================
   EXPRESS
   ============================================================ */

app.disable('x-powered-by');

app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
}));

app.use(express.json({
    limit: '1mb'
}));

app.use(session({
    store: new SQLiteStoreFactory({
        db: 'sessions.db',
        dir: DATA_DIR
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

/* ============================================================
   SQLITE
   ============================================================ */

const db = new sqlite3.Database(DB_FILE);

db.serialize(function () {

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            username TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            banned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            version TEXT NOT NULL DEFAULT '1.21.1',
            ram INTEGER NOT NULL DEFAULT 2048,
            status TEXT NOT NULL DEFAULT 'offline',
            locked INTEGER NOT NULL DEFAULT 0,
            maintenance INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    db.run(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('maintenance', '0')
    `);

    db.run(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('registration', '1')
    `);

});

/* ============================================================
   DB HELFER
   ============================================================ */

function dbGet(sql, params) {
    return new Promise(function (resolve, reject) {
        db.get(sql, params || [], function (err, row) {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, params) {
    return new Promise(function (resolve, reject) {
        db.all(sql, params || [], function (err, rows) {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows || []);
        });
    });
}

function dbRun(sql, params) {
    return new Promise(function (resolve, reject) {
        db.run(sql, params || [], function (err) {
            if (err) {
                reject(err);
                return;
            }

            resolve({
                id: this.lastID,
                changes: this.changes
            });
        });
    });
}

/* ============================================================
   ALLGEMEINE HELFER
   ============================================================ */

function now() {
    return new Date().toISOString();
}

function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeName(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9äöüÄÖÜß _.-]/g, '')
        .substring(0, 40);
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(value || '').toLowerCase()
    );
}

function validServerName(value) {
    const name = String(value || '').trim();

    if (name.length < 2) {
        return false;
    }

    if (name.length > 32) {
        return false;
    }

    return /^[a-zA-Z0-9äöüÄÖÜß _.-]+$/.test(name);
}

function validVersion(value) {
    const version = String(value || '').trim();

    if (version.length < 3 || version.length > 20) {
        return false;
    }

    return /^[0-9A-Za-z._-]+$/.test(version);
}

function validRam(value) {
    const ram = Number(value);

    if (!Number.isInteger(ram)) {
        return false;
    }

    return ram >= 512 && ram <= 16384;
}

async function logAction(userId, action, details) {
    try {
        await dbRun(
            `
            INSERT INTO logs
            (user_id, action, details, created_at)
            VALUES (?, ?, ?, ?)
            `,
            [
                userId || null,
                action,
                details || '',
                now()
            ]
        );
    } catch (error) {
        console.error('Log-Fehler:', error);
    }
}

/* ============================================================
   USER
   ============================================================ */

async function findUserById(id) {
    return dbGet(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [id]
    );
}

async function findUserByEmail(email) {
    return dbGet(
        `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER(?)
        `,
        [email]
    );
}

async function isOwner(user) {
    if (!user) {
        return false;
    }

    return String(user.email).toLowerCase() === OWNER_EMAIL;
}

async function isAdmin(user) {
    if (!user) {
        return false;
    }

    if (String(user.role) === 'admin') {
        return true;
    }

    return isOwner(user);
}

/* ============================================================
   SESSION USER
   ============================================================ */

async function getCurrentUser(req) {
    if (!req.session || !req.session.userId) {
        return null;
    }

    const user = await findUserById(req.session.userId);

    if (!user) {
        req.session.destroy(function () {});
        return null;
    }

    return user;
}

/* ============================================================
   AUTH MIDDLEWARE
   ============================================================ */

async function requireLogin(req, res, next) {
    try {
        const user = await getCurrentUser(req);

        if (!user) {
            return res.redirect('/login');
        }

        if (Number(user.banned) === 1) {
            req.session.destroy(function () {});
            return res.status(403).send(
                page(
                    'Konto gesperrt',
                    '<div class="card"><h1>Konto gesperrt</h1><p>Dein Konto wurde gesperrt.</p></div>'
                )
            );
        }

        req.user = user;

        next();
    } catch (error) {
        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card"><h1>Fehler</h1><p>Beim Laden ist ein Fehler aufgetreten.</p></div>'
            )
        );
    }
}

async function requireAdmin(req, res, next) {
    try {
        const user = await getCurrentUser(req);

        if (!user) {
            return res.redirect('/login');
        }

        if (!(await isAdmin(user))) {
            return res.status(403).send(
                page(
                    'Kein Zugriff',
                    '<div class="card"><h1>Kein Zugriff</h1><p>Dieser Bereich ist nur für den Owner/Admin verfügbar.</p></div>'
                )
            );
        }

        req.user = user;

        next();
    } catch (error) {
        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card"><h1>Fehler</h1><p>Interner Fehler.</p></div>'
            )
        );
    }
}

/* ============================================================
   HTML DESIGN
   ============================================================ */

function page(title, content, user) {

    const loggedIn = !!user;

    const navigation = loggedIn
        ? [
            '<a href="/">Dashboard</a>',
            '<a href="/servers">Meine Server</a>',
            '<a href="/server/create">Server erstellen</a>',
            '<a href="/account">Konto</a>',
            (user && (user.role === 'admin' || String(user.email).toLowerCase() === OWNER_EMAIL))
                ? '<a href="/admin">Admin</a>'
                : '',
            '<a href="/logout">Logout</a>'
        ].join('')
        : [
            '<a href="/login">Login</a>',
            '<a href="/register">Registrieren</a>'
        ].join('');

    return [
        '<!DOCTYPE html>',
        '<html lang="de">',
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        '<title>',
        escapeHtml(title),
        ' | Florian / WeisserHai Minecraft Hosting',
        '</title>',
        '<style>',
        '*{box-sizing:border-box}',
        'body{margin:0;background:#090d14;color:#eef2f7;font-family:Arial,Helvetica,sans-serif}',
        'a{color:inherit;text-decoration:none}',
        '.nav{background:#101722;border-bottom:1px solid #263244;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;position:sticky;top:0;z-index:10}',
        '.brand{font-size:20px;font-weight:800}',
        '.navlinks{display:flex;gap:8px;flex-wrap:wrap}',
        '.navlinks a{padding:9px 12px;border-radius:8px;color:#cbd5e1}',
        '.navlinks a:hover{background:#1b2534;color:white}',
        '.container{max-width:1200px;margin:0 auto;padding:30px 18px}',
        '.hero{padding:45px 30px;background:linear-gradient(135deg,#111827,#162236);border:1px solid #263244;border-radius:18px;margin-bottom:24px}',
        '.hero h1{font-size:42px;margin:0 0 12px}',
        '.hero p{color:#aeb9c9;font-size:17px;line-height:1.6}',
        '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}',
        '.card{background:#111722;border:1px solid #273346;border-radius:14px;padding:22px;margin-bottom:18px}',
        '.card h2,.card h3{margin-top:0}',
        '.muted{color:#9ca9bb}',
        '.stat{font-size:32px;font-weight:800}',
        '.btn{display:inline-block;border:0;border-radius:9px;padding:11px 16px;background:#2563eb;color:white;cursor:pointer;font-weight:700}',
        '.btn:hover{background:#1d4ed8}',
        '.btn.red{background:#dc2626}',
        '.btn.red:hover{background:#b91c1c}',
        '.btn.green{background:#16a34a}',
        '.btn.gray{background:#374151}',
        'button.btn{font-family:inherit}',
        'form{margin:0}',
        'label{display:block;margin:14px 0 7px;font-weight:700}',
        'input,select{width:100%;background:#0b111b;border:1px solid #344155;border-radius:8px;color:white;padding:12px;font-size:15px;outline:none}',
        'input:focus,select:focus{border-color:#3b82f6}',
        '.form{max-width:520px;margin:auto}',
        '.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}',
        '.notice{padding:13px 15px;border-radius:9px;background:#172033;border:1px solid #2d3d56;margin-bottom:18px}',
        '.error{background:#3a1518;border-color:#7f1d1d}',
        '.success{background:#102d1a;border-color:#166534}',
        '.warning{background:#33270d;border-color:#854d0e}',
        '.server{position:relative}',
        '.badge{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;background:#334155}',
        '.badge.green{background:#166534}',
        '.badge.red{background:#991b1b}',
        '.badge.yellow{background:#854d0e}',
        '.badge.blue{background:#1d4ed8}',
        '.table-wrap{overflow:auto}',
        'table{width:100%;border-collapse:collapse}',
        'th,td{text-align:left;padding:12px;border-bottom:1px solid #273346;white-space:nowrap}',
        'th{color:#aeb9c9}',
        'footer{text-align:center;padding:30px;color:#718096}',
        '.small{font-size:13px}',
        '@media(max-width:700px){.nav{align-items:flex-start;flex-direction:column}.hero h1{font-size:30px}.container{padding:18px 12px}}',
        '</style>',
        '</head>',
        '<body>',
        '<nav class="nav">',
        '<div class="brand">⛏️ Florian / WeisserHai Hosting</div>',
        '<div class="navlinks">',
        navigation,
        '</div>',
        '</nav>',
        '<main class="container">',
        content,
        '</main>',
        '<footer>',
        'Florian / WeisserHai Minecraft Hosting',
        '</footer>',
        '</body>',
        '</html>'
    ].join('');
}

/* ============================================================
   ROOT
   ============================================================ */

app.get('/', async function (req, res) {

    try {

        const user = await getCurrentUser(req);

        if (!user) {

            const content = [
                '<section class="hero">',
                '<h1>Dein Minecraft Hosting</h1>',
                '<p>',
                'Erstelle und verwalte deine Minecraft-Server über eine einfache Oberfläche.',
                '</p>',
                '<div class="actions">',
                '<a class="btn" href="/register">Jetzt registrieren</a>',
                '<a class="btn gray" href="/login">Einloggen</a>',
                '</div>',
                '</section>',

                '<div class="grid">',

                '<div class="card">',
                '<h3>🟢 Kostenlos starten</h3>',
                '<p class="muted">Normale Benutzer können einen kostenlosen Minecraft-Server erstellen.</p>',
                '</div>',

                '<div class="card">',
                '<h3>⚙️ Serververwaltung</h3>',
                '<p class="muted">Server erstellen, starten, stoppen und verwalten.</p>',
                '</div>',

                '<div class="card">',
                '<h3>🔐 Sichere Konten</h3>',
                '<p class="muted">Passwörter werden mit bcrypt sicher gespeichert.</p>',
                '</div>',

                '</div>'
            ].join('');

            return res.send(page('Startseite', content));
        }

        const servers = await dbAll(
            `
            SELECT *
            FROM servers
            WHERE owner_id = ?
            ORDER BY id DESC
            `,
            [user.id]
        );

        const content = [
            '<section class="hero">',
            '<h1>Willkommen, ',
            escapeHtml(user.username),
            '</h1>',
            '<p>Verwalte deine Minecraft-Server zentral über dein Dashboard.</p>',
            '<div class="actions">',
            '<a class="btn" href="/server/create">+ Server erstellen</a>',
            '<a class="btn gray" href="/servers">Meine Server</a>',
            '</div>',
            '</section>',

            '<div class="grid">',

            '<div class="card">',
            '<div class="muted">Deine Server</div>',
            '<div class="stat">',
            String(servers.length),
            '</div>',
            '</div>',

            '<div class="card">',
            '<div class="muted">Konto</div>',
            '<div class="stat">',
            user.role === 'admin' || String(user.email).toLowerCase() === OWNER_EMAIL
                ? 'ADMIN'
                : 'USER',
            '</div>',
            '</div>',

            '<div class="card">',
            '<div class="muted">Account seit</div>',
            '<div class="stat small">',
            escapeHtml(user.created_at),
            '</div>',
            '</div>',

            '</div>'
        ].join('');

        res.send(page('Dashboard', content, user));

    } catch (error) {

        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card"><h1>Fehler</h1><p>Dashboard konnte nicht geladen werden.</p></div>'
            )
        );
    }
});

/* ============================================================
   REGISTER
   ============================================================ */

app.get('/register', async function (req, res) {

    const user = await getCurrentUser(req);

    if (user) {
        return res.redirect('/');
    }

    const setting = await dbGet(
        `SELECT value FROM settings WHERE key = 'registration'`
    );

    if (setting && setting.value === '0') {
        return res.status(403).send(
            page(
                'Registrierung deaktiviert',
                '<div class="card"><h1>Registrierung deaktiviert</h1><p>Neue Registrierungen sind momentan deaktiviert.</p></div>'
            )
        );
    }

    const content = [
        '<div class="card form">',
        '<h1>Registrieren</h1>',
        '<p class="muted">Erstelle dein Hosting-Konto.</p>',
        '<form method="POST" action="/register">',

        '<label>Benutzername</label>',
        '<input name="username" maxlength="32" required autocomplete="username">',

        '<label>E-Mail</label>',
        '<input name="email" type="email" required autocomplete="email">',

        '<label>Passwort</label>',
        '<input name="password" type="password" minlength="6" required autocomplete="new-password">',

        '<label>Passwort wiederholen</label>',
        '<input name="password2" type="password" minlength="6" required autocomplete="new-password">',

        '<div class="actions">',
        '<button class="btn" type="submit">Konto erstellen</button>',
        '<a class="btn gray" href="/login">Ich habe bereits ein Konto</a>',
        '</div>',

        '</form>',
        '</div>'
    ].join('');

    res.send(page('Registrierung', content));
});

app.post('/register', async function (req, res) {

    try {

        const username = safeName(req.body.username);
        const email = String(req.body.email || '').toLowerCase().trim();
        const password = String(req.body.password || '');
        const password2 = String(req.body.password2 || '');

        if (username.length < 2) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Der Benutzername ist ungültig.</p><a class="btn" href="/register">Zurück</a></div>'
                )
            );
        }

        if (!validEmail(email)) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Die E-Mail-Adresse ist ungültig.</p><a class="btn" href="/register">Zurück</a></div>'
                )
            );
        }

        if (password.length < 6) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Das Passwort muss mindestens 6 Zeichen lang sein.</p><a class="btn" href="/register">Zurück</a></div>'
                )
            );
        }

        if (password !== password2) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Die Passwörter stimmen nicht überein.</p><a class="btn" href="/register">Zurück</a></div>'
                )
            );
        }

        const existing = await findUserByEmail(email);

        if (existing) {
            return res.status(409).send(
                page(
                    'Konto vorhanden',
                    '<div class="card error"><h1>Konto vorhanden</h1><p>Diese E-Mail ist bereits registriert.</p><a class="btn" href="/login">Zum Login</a></div>'
                )
            );
        }

        const hash = await bcrypt.hash(password, 12);

        const role = email === OWNER_EMAIL ? 'admin' : 'user';

        const result = await dbRun(
            `
            INSERT INTO users
            (email, password, username, role, banned, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
            `,
            [
                email,
                hash,
                username,
                role,
                now(),
                now()
            ]
        );

        await logAction(
            result.id,
            'REGISTER',
            'Neues Konto erstellt'
        );

        req.session.userId = result.id;

        res.redirect('/');

    } catch (error) {

        console.error('Register:', error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Registrierung fehlgeschlagen</h1><p>Bitte versuche es erneut.</p><a class="btn" href="/register">Zurück</a></div>'
            )
        );
    }
});

/* ============================================================
   LOGIN
   ============================================================ */

app.get('/login', async function (req, res) {

    const user = await getCurrentUser(req);

    if (user) {
        return res.redirect('/');
    }

    const content = [
        '<div class="card form">',
        '<h1>Login</h1>',
        '<p class="muted">Melde dich mit deinem Konto an.</p>',
        '<form method="POST" action="/login">',

        '<label>E-Mail</label>',
        '<input name="email" type="email" required autocomplete="email">',

        '<label>Passwort</label>',
        '<input name="password" type="password" required autocomplete="current-password">',

        '<div class="actions">',
        '<button class="btn" type="submit">Einloggen</button>',
        '<a class="btn gray" href="/register">Registrieren</a>',
        '</div>',

        '</form>',
        '</div>'
    ].join('');

    res.send(page('Login', content));
});

app.post('/login', async function (req, res) {

    try {

        const email = String(req.body.email || '').toLowerCase().trim();
        const password = String(req.body.password || '');

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).send(
                page(
                    'Login fehlgeschlagen',
                    '<div class="card error"><h1>Login fehlgeschlagen</h1><p>E-Mail oder Passwort ist falsch.</p><a class="btn" href="/login">Erneut versuchen</a></div>'
                )
            );
        }

        if (Number(user.banned) === 1) {
            return res.status(403).send(
                page(
                    'Konto gesperrt',
                    '<div class="card error"><h1>Konto gesperrt</h1><p>Dieses Konto wurde gesperrt.</p></div>'
                )
            );
        }

        const correct = await bcrypt.compare(
            password,
            user.password
        );

        if (!correct) {
            await logAction(
                user.id,
                'LOGIN_FAILED',
                'Falsches Passwort'
            );

            return res.status(401).send(
                page(
                    'Login fehlgeschlagen',
                    '<div class="card error"><h1>Login fehlgeschlagen</h1><p>E-Mail oder Passwort ist falsch.</p><a class="btn" href="/login">Erneut versuchen</a></div>'
                )
            );
        }

        req.session.regenerate(function (err) {

            if (err) {
                console.error(err);

                return res.status(500).send(
                    page(
                        'Fehler',
                        '<div class="card error"><h1>Login-Fehler</h1><p>Die Sitzung konnte nicht erstellt werden.</p></div>'
                    )
                );
            }

            req.session.userId = user.id;

            req.session.save(async function (saveError) {

                if (saveError) {
                    console.error(saveError);

                    return res.status(500).send(
                        page(
                            'Fehler',
                            '<div class="card error"><h1>Login-Fehler</h1><p>Die Sitzung konnte nicht gespeichert werden.</p></div>'
                        )
                    );
                }

                await logAction(
                    user.id,
                    'LOGIN',
                    'Erfolgreich eingeloggt'
                );

                res.redirect('/');
            });
        });

    } catch (error) {

        console.error('Login:', error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Fehler</h1><p>Beim Login ist ein Fehler aufgetreten.</p></div>'
            )
        );
    }
});

/* ============================================================
   LOGOUT
   ============================================================ */

app.get('/logout', async function (req, res) {

    const user = await getCurrentUser(req);

    if (user) {
        await logAction(
            user.id,
            'LOGOUT',
            'Ausgeloggt'
        );
    }

    req.session.destroy(function () {
        res.redirect('/login');
    });
});

/* ============================================================
   SERVER ÜBERSICHT
   ============================================================ */

app.get('/servers', requireLogin, async function (req, res) {

    try {

        const servers = await dbAll(
            `
            SELECT *
            FROM servers
            WHERE owner_id = ?
            ORDER BY id DESC
            `,
            [req.user.id]
        );

        let cards = '';

        if (servers.length === 0) {

            cards = [
                '<div class="card">',
                '<h2>Noch kein Server</h2>',
                '<p class="muted">Du hast noch keinen Minecraft-Server erstellt.</p>',
                '<a class="btn" href="/server/create">Server erstellen</a>',
                '</div>'
            ].join('');

        } else {

            cards = servers.map(function (server) {

                let statusClass = '';

                if (server.status === 'online') {
                    statusClass = 'green';
                } else if (server.status === 'offline') {
                    statusClass = 'red';
                } else {
                    statusClass = 'yellow';
                }

                const lockedText = Number(server.locked) === 1
                    ? '<span class="badge red">GESPERRT</span>'
                    : '<span class="badge green">FREI</span>';

                const maintenanceText = Number(server.maintenance) === 1
                    ? '<span class="badge yellow">WARTUNG</span>'
                    : '';

                return [
                    '<div class="card server">',
                    '<h2>',
                    escapeHtml(server.name),
                    '</h2>',
                    '<p>',
                    '<span class="badge ',
                    statusClass,
                    '">',
                    escapeHtml(server.status.toUpperCase()),
                    '</span> ',
                    lockedText,
                    ' ',
                    maintenanceText,
                    '</p>',
                    '<p class="muted">',
                    'Version: ',
                    escapeHtml(server.version),
                    '<br>',
                    'RAM: ',
                    String(server.ram),
                    ' MB',
                    '</p>',
                    '<div class="actions">',
                    '<a class="btn" href="/server/',
                    String(server.id),
                    '">Verwalten</a>',
                    '</div>',
                    '</div>'
                ].join('');

            }).join('');
        }

        const content = [
            '<div class="actions" style="margin-bottom:18px">',
            '<a class="btn" href="/server/create">+ Server erstellen</a>',
            '</div>',
            '<div class="grid">',
            cards,
            '</div>'
        ].join('');

        res.send(
            page(
                'Meine Server',
                content,
                req.user
            )
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Fehler</h1><p>Server konnten nicht geladen werden.</p></div>',
                req.user
            )
        );
    }
});

/* ============================================================
   SERVER ERSTELLEN
   ============================================================ */

app.get('/server/create', requireLogin, async function (req, res) {

    const owner = await isOwner(req.user);

    const countRow = await dbGet(
        `
        SELECT COUNT(*) AS count
        FROM servers
        WHERE owner_id = ?
        `,
        [req.user.id]
    );

    const count = Number(countRow ? countRow.count : 0);

    if (!owner && count >= 1) {

        const content = [
            '<div class="card warning">',
            '<h1>Server-Limit erreicht</h1>',
            '<p>',
            'Normale Benutzer können aktuell einen kostenlosen Server besitzen.',
            '</p>',
            '<p class="muted">',
            'Der Owner kann unbegrenzt Server erstellen.',
            '</p>',
            '<a class="btn" href="/servers">Zurück zu meinen Servern</a>',
            '</div>'
        ].join('');

        return res.send(
            page(
                'Server-Limit',
                content,
                req.user
            )
        );
    }

    const content = [
        '<div class="card form">',
        '<h1>Minecraft-Server erstellen</h1>',
        '<p class="muted">Erstelle einen neuen Server.</p>',

        '<form method="POST" action="/server/create">',

        '<label>Servername</label>',
        '<input name="name" maxlength="32" required placeholder="Mein Minecraft Server">',

        '<label>Minecraft-Version</label>',
        '<input name="version" maxlength="20" value="1.21.1" required>',

        '<label>RAM in MB</label>',
        '<select name="ram">',
        '<option value="1024">1024 MB</option>',
        '<option value="2048" selected>2048 MB</option>',
        '<option value="4096">4096 MB</option>',
        '<option value="6144">6144 MB</option>',
        '<option value="8192">8192 MB</option>',
        '<option value="16384">16384 MB</option>',
        '</select>',

        '<div class="actions">',
        '<button class="btn" type="submit">Server erstellen</button>',
        '<a class="btn gray" href="/servers">Abbrechen</a>',
        '</div>',

        '</form>',
        '</div>'
    ].join('');

    res.send(
        page(
            'Server erstellen',
            content,
            req.user
        )
    );
});

app.post('/server/create', requireLogin, async function (req, res) {

    try {

        const owner = await isOwner(req.user);

        const countRow = await dbGet(
            `
            SELECT COUNT(*) AS count
            FROM servers
            WHERE owner_id = ?
            `,
            [req.user.id]
        );

        const count = Number(countRow ? countRow.count : 0);

        if (!owner && count >= 1) {
            return res.status(403).send(
                page(
                    'Limit',
                    '<div class="card error"><h1>Server-Limit</h1><p>Du kannst maximal einen kostenlosen Server besitzen.</p><a class="btn" href="/servers">Zurück</a></div>',
                    req.user
                )
            );
        }

        const name = safeName(req.body.name);
        const version = String(req.body.version || '').trim();
        const ram = Number(req.body.ram);

        if (!validServerName(name)) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Ungültiger Servername</h1><p>Verwende 2 bis 32 Zeichen.</p><a class="btn" href="/server/create">Zurück</a></div>',
                    req.user
                )
            );
        }

        if (!validVersion(version)) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Ungültige Version</h1><p>Die Minecraft-Version ist ungültig.</p><a class="btn" href="/server/create">Zurück</a></div>',
                    req.user
                )
            );
        }

        if (!validRam(ram)) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Ungültiger RAM</h1><p>Der RAM muss zwischen 512 und 16384 MB liegen.</p><a class="btn" href="/server/create">Zurück</a></div>',
                    req.user
                )
            );
        }

        const result = await dbRun(
            `
            INSERT INTO servers
            (owner_id, name, version, ram, status, locked, maintenance, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'offline', 0, 0, ?, ?)
            `,
            [
                req.user.id,
                name,
                version,
                ram,
                now(),
                now()
            ]
        );

        await logAction(
            req.user.id,
            'SERVER_CREATE',
            'Server #' + result.id + ' erstellt: ' + name
        );

        res.redirect('/server/' + result.id);

    } catch (error) {

        console.error('Server erstellen:', error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Server konnte nicht erstellt werden</h1><p>Bitte versuche es erneut.</p><a class="btn" href="/servers">Zurück</a></div>',
                req.user
            )
        );
    }
});

/* ============================================================
   SERVER DETAILS
   ============================================================ */

app.get('/server/:id', requireLogin, async function (req, res) {

    try {

        const serverId = Number(req.params.id);

        if (!Number.isInteger(serverId)) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Ungültige Server-ID</h1></div>',
                    req.user
                )
            );
        }

        const server = await dbGet(
            `
            SELECT *
            FROM servers
            WHERE id = ?
            `,
            [serverId]
        );

        if (!server) {
            return res.status(404).send(
                page(
                    'Nicht gefunden',
                    '<div class="card error"><h1>Server nicht gefunden</h1><a class="btn" href="/servers">Zurück</a></div>',
                    req.user
                )
            );
        }

        const owner = await isOwner(req.user);

        if (Number(server.owner_id) !== Number(req.user.id) && !owner) {
            return res.status(403).send(
                page(
                    'Kein Zugriff',
                    '<div class="card error"><h1>Kein Zugriff</h1><p>Du besitzt diesen Server nicht.</p></div>',
                    req.user
                )
            );
        }

        const locked = Number(server.locked) === 1;
        const maintenance = Number(server.maintenance) === 1;

        const controls = locked
            ? [
                '<form method="POST" action="/server/',
                server.id,
                '/unlock"><button class="btn green" type="submit">Server entsperren</button></form>'
            ].join('')
            : [
                '<form method="POST" action="/server/',
                server.id,
                '/lock"><button class="btn red" type="submit">Server sperren</button></form>'
            ].join('');

        const maintenanceButton = maintenance
            ? [
                '<form method="POST" action="/server/',
                server.id,
                '/maintenance/off"><button class="btn green" type="submit">Wartung beenden</button></form>'
            ].join('')
            : [
                '<form method="POST" action="/server/',
                server.id,
                '/maintenance/on"><button class="btn gray" type="submit">Wartung aktivieren</button></form>'
            ].join('');

        const startButton = [
            '<form method="POST" action="/server/',
            server.id,
            '/start"><button class="btn green" type="submit">▶ Starten</button></form>'
        ].join('');

        const stopButton = [
            '<form method="POST" action="/server/',
            server.id,
            '/stop"><button class="btn red" type="submit">■ Stoppen</button></form>'
        ].join('');

        const restartButton = [
            '<form method="POST" action="/server/',
            server.id,
            '/restart"><button class="btn" type="submit">↻ Neustarten</button></form>'
        ].join('');

        const content = [
            '<div class="card">',
            '<h1>',
            escapeHtml(server.name),
            '</h1>',
            '<p>',
            '<span class="badge ',
            server.status === 'online' ? 'green' : 'red',
            '">',
            escapeHtml(server.status.toUpperCase()),
            '</span> ',
            locked
                ? '<span class="badge red">GESPERRT</span>'
                : '<span class="badge green">ENTSPERRT</span>',
            ' ',
            maintenance
                ? '<span class="badge yellow">WARTUNG</span>'
                : '',
            '</p>',
            '</div>',

            '<div class="grid">',

            '<div class="card">',
            '<h3>Serverdaten</h3>',
            '<p class="muted">Server-ID</p>',
            '<p>',
            String(server.id),
            '</p>',
            '<p class="muted">Version</p>',
            '<p>',
            escapeHtml(server.version),
            '</p>',
            '<p class="muted">RAM</p>',
            '<p>',
            String(server.ram),
            ' MB',
            '</p>',
            '</div>',

            '<div class="card">',
            '<h3>Steuerung</h3>',
            '<div class="actions">',
            startButton,
            stopButton,
            restartButton,
            '</div>',
            '<div class="actions">',
            controls,
            maintenanceButton,
            '</div>',
            '</div>',

            '</div>',

            '<div class="card">',
            '<h3>Server löschen</h3>',
            '<p class="muted">Das Löschen kann nicht rückgängig gemacht werden.</p>',
            '<form method="POST" action="/server/',
            server.id,
            '/delete" onsubmit="return confirm(\'Server wirklich löschen?\')">',
            '<button class="btn red" type="submit">Server löschen</button>',
            '</form>',
            '</div>',

            '<div class="actions">',
            '<a class="btn gray" href="/servers">← Zurück</a>',
            '</div>'
        ].join('');

        res.send(
            page(
                server.name,
                content,
                req.user
            )
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Fehler</h1><p>Server konnte nicht geladen werden.</p></div>',
                req.user
            )
        );
    }
});

/* ============================================================
   SERVER AKTIONEN
   ============================================================ */

async function getServerForUser(serverId, user) {

    const server = await dbGet(
        `
        SELECT *
        FROM servers
        WHERE id = ?
        `,
        [serverId]
    );

    if (!server) {
        return null;
    }

    const owner = await isOwner(user);

    if (
        Number(server.owner_id) !== Number(user.id) &&
        !owner
    ) {
        return null;
    }

    return server;
}

app.post('/server/:id/start', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        if (Number(server.locked) === 1) {
            return res.status(403).send('Server ist gesperrt');
        }

        if (Number(server.maintenance) === 1) {
            return res.status(403).send('Server befindet sich in Wartung');
        }

        await dbRun(
            `
            UPDATE servers
            SET status = 'online',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_START',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/stop', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            UPDATE servers
            SET status = 'offline',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_STOP',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/restart', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        if (Number(server.locked) === 1) {
            return res.status(403).send('Server ist gesperrt');
        }

        if (Number(server.maintenance) === 1) {
            return res.status(403).send('Server befindet sich in Wartung');
        }

        await dbRun(
            `
            UPDATE servers
            SET status = 'restarting',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_RESTART',
            'Server #' + server.id
        );

        setTimeout(async function () {

            try {

                await dbRun(
                    `
                    UPDATE servers
                    SET status = 'online',
                        updated_at = ?
                    WHERE id = ?
                    `,
                    [now(), server.id]
                );

            } catch (error) {
                console.error('Restart:', error);
            }

        }, 1500);

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/lock', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            UPDATE servers
            SET locked = 1,
                status = 'offline',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_LOCK',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/unlock', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            UPDATE servers
            SET locked = 0,
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_UNLOCK',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/maintenance/on', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            UPDATE servers
            SET maintenance = 1,
                status = 'offline',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_MAINTENANCE_ON',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/maintenance/off', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            UPDATE servers
            SET maintenance = 0,
                updated_at = ?
            WHERE id = ?
            `,
            [now(), server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_MAINTENANCE_OFF',
            'Server #' + server.id
        );

        res.redirect('/server/' + server.id);

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/server/:id/delete', requireLogin, async function (req, res) {

    try {

        const server = await getServerForUser(
            Number(req.params.id),
            req.user
        );

        if (!server) {
            return res.status(404).send('Server nicht gefunden');
        }

        await dbRun(
            `
            DELETE FROM servers
            WHERE id = ?
            `,
            [server.id]
        );

        await logAction(
            req.user.id,
            'SERVER_DELETE',
            'Server #' + server.id + ' gelöscht'
        );

        res.redirect('/servers');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ACCOUNT
   ============================================================ */

app.get('/account', requireLogin, async function (req, res) {

    const content = [
        '<div class="card">',
        '<h1>Mein Konto</h1>',
        '<p><strong>Benutzername:</strong> ',
        escapeHtml(req.user.username),
        '</p>',
        '<p><strong>E-Mail:</strong> ',
        escapeHtml(req.user.email),
        '</p>',
        '<p><strong>Rolle:</strong> ',
        escapeHtml(req.user.role),
        '</p>',
        '<p><strong>Registriert:</strong> ',
        escapeHtml(req.user.created_at),
        '</p>',
        '</div>',

        '<div class="card form">',
        '<h2>Passwort ändern</h2>',
        '<form method="POST" action="/account/password">',

        '<label>Aktuelles Passwort</label>',
        '<input type="password" name="oldPassword" required>',

        '<label>Neues Passwort</label>',
        '<input type="password" name="newPassword" minlength="6" required>',

        '<label>Neues Passwort wiederholen</label>',
        '<input type="password" name="newPassword2" minlength="6" required>',

        '<div class="actions">',
        '<button class="btn" type="submit">Passwort ändern</button>',
        '</div>',

        '</form>',
        '</div>'
    ].join('');

    res.send(
        page(
            'Konto',
            content,
            req.user
        )
    );
});

app.post('/account/password', requireLogin, async function (req, res) {

    try {

        const oldPassword = String(
            req.body.oldPassword || ''
        );

        const newPassword = String(
            req.body.newPassword || ''
        );

        const newPassword2 = String(
            req.body.newPassword2 || ''
        );

        const correct = await bcrypt.compare(
            oldPassword,
            req.user.password
        );

        if (!correct) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Falsches Passwort</h1><p>Das aktuelle Passwort ist falsch.</p><a class="btn" href="/account">Zurück</a></div>',
                    req.user
                )
            );
        }

        if (newPassword.length < 6) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Das neue Passwort muss mindestens 6 Zeichen lang sein.</p><a class="btn" href="/account">Zurück</a></div>',
                    req.user
                )
            );
        }

        if (newPassword !== newPassword2) {
            return res.status(400).send(
                page(
                    'Fehler',
                    '<div class="card error"><h1>Fehler</h1><p>Die neuen Passwörter stimmen nicht überein.</p><a class="btn" href="/account">Zurück</a></div>',
                    req.user
                )
            );
        }

        const hash = await bcrypt.hash(
            newPassword,
            12
        );

        await dbRun(
            `
            UPDATE users
            SET password = ?,
                updated_at = ?
            WHERE id = ?
            `,
            [
                hash,
                now(),
                req.user.id
            ]
        );

        await logAction(
            req.user.id,
            'PASSWORD_CHANGE',
            'Passwort geändert'
        );

        res.send(
            page(
                'Passwort geändert',
                '<div class="card success"><h1>Passwort geändert</h1><p>Dein Passwort wurde erfolgreich geändert.</p><a class="btn" href="/account">Zum Konto</a></div>',
                req.user
            )
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            page(
                'Fehler',
                '<div class="card error"><h1>Fehler</h1><p>Passwort konnte nicht geändert werden.</p></div>',
                req.user
            )
        );
    }
});

/* ============================================================
   ADMIN PANEL
   ============================================================ */

app.get('/admin', requireAdmin, async function (req, res) {

    try {

        const users = await dbAll(
            `
            SELECT id, email, username, role, banned, created_at
            FROM users
            ORDER BY id DESC
            `
        );

        const servers = await dbAll(
            `
            SELECT
                servers.*,
                users.email AS owner_email,
                users.username AS owner_username
            FROM servers
            LEFT JOIN users
                ON users.id = servers.owner_id
            ORDER BY servers.id DESC
            `
        );

        const logs = await dbAll(
            `
            SELECT
                logs.*,
                users.email AS user_email
            FROM logs
            LEFT JOIN users
                ON users.id = logs.user_id
            ORDER BY logs.id DESC
            LIMIT 100
            `
        );

        const userRows = users.map(function (user) {

            const banned = Number(user.banned) === 1;

            const banButton = banned
                ? [
                    '<form method="POST" action="/admin/user/',
                    user.id,
                    '/unban">',
                    '<button class="btn green" type="submit">Entsperren</button>',
                    '</form>'
                ].join('')
                : [
                    '<form method="POST" action="/admin/user/',
                    user.id,
                    '/ban">',
                    '<button class="btn red" type="submit">Sperren</button>',
                    '</form>'
                ].join('');

            return [
                '<tr>',
                '<td>',
                String(user.id),
                '</td>',
                '<td>',
                escapeHtml(user.username),
                '</td>',
                '<td>',
                escapeHtml(user.email),
                '</td>',
                '<td>',
                escapeHtml(user.role),
                '</td>',
                '<td>',
                banned
                    ? '<span class="badge red">GESPERRT</span>'
                    : '<span class="badge green">AKTIV</span>',
                '</td>',
                '<td>',
                '<div class="actions">',
                banButton,
                '</div>',
                '</td>',
                '</tr>'
            ].join('');

        }).join('');

        const serverRows = servers.map(function (server) {

            return [
                '<tr>',
                '<td>',
                String(server.id),
                '</td>',
                '<td>',
                escapeHtml(server.name),
                '</td>',
                '<td>',
                escapeHtml(server.owner_username || '-'),
                '</td>',
                '<td>',
                escapeHtml(server.owner_email || '-'),
                '</td>',
                '<td>',
                '<span class="badge ',
                server.status === 'online' ? 'green' : 'red',
                '">',
                escapeHtml(server.status),
                '</span>',
                '</td>',
                '<td>',
                '<div class="actions">',
                '<form method="POST" action="/admin/server/',
                server.id,
                '/stop">',
                '<button class="btn red" type="submit">Stoppen</button>',
                '</form>',
                '<form method="POST" action="/admin/server/',
                server.id,
                '/lock">',
                '<button class="btn gray" type="submit">Sperren</button>',
                '</form>',
                '<form method="POST" action="/admin/server/',
                server.id,
                '/delete" onsubmit="return confirm(\'Server wirklich löschen?\')">',
                '<button class="btn red" type="submit">Löschen</button>',
                '</form>',
                '</div>',
                '</td>',
                '</tr>'
            ].join('');

        }).join('');

        const logRows = logs.map(function (log) {

            return [
                '<tr>',
                '<td>',
                String(log.id),
                '</td>',
                '<td>',
                escapeHtml(log.user_email || 'System'),
                '</td>',
                '<td>',
                escapeHtml(log.action),
                '</td>',
                '<td>',
                escapeHtml(log.details || ''),
                '</td>',
                '<td>',
                escapeHtml(log.created_at),
                '</td>',
                '</tr>'
            ].join('');

        }).join('');

        const content = [
            '<section class="hero">',
            '<h1>Admin Panel</h1>',
            '<p>Owner-/Administratorverwaltung für das Hosting.</p>',
            '</section>',

            '<div class="grid">',

            '<div class="card">',
            '<div class="muted">Benutzer</div>',
            '<div class="stat">',
            String(users.length),
            '</div>',
            '</div>',

            '<div class="card">',
            '<div class="muted">Server</div>',
            '<div class="stat">',
            String(servers.length),
            '</div>',
            '</div>',

            '<div class="card">',
            '<div class="muted">Owner</div>',
            '<div class="small">',
            escapeHtml(OWNER_EMAIL),
            '</div>',
            '</div>',

            '</div>',

            '<div class="card">',
            '<h2>Globale Einstellungen</h2>',
            '<div class="actions">',
            '<form method="POST" action="/admin/maintenance/on">',
            '<button class="btn gray" type="submit">Alle Server Wartung</button>',
            '</form>',
            '<form method="POST" action="/admin/shutdown">',
            '<button class="btn red" type="submit">Alle Server stoppen</button>',
            '</form>',
            '<form method="POST" action="/admin/maintenance/off">',
            '<button class="btn green" type="submit">Wartung beenden</button>',
            '</form>',
            '</div>',
            '</div>',

            '<div class="card">',
            '<h2>Benutzer</h2>',
            '<div class="table-wrap">',
            '<table>',
            '<thead><tr>',
            '<th>ID</th>',
            '<th>Name</th>',
            '<th>E-Mail</th>',
            '<th>Rolle</th>',
            '<th>Status</th>',
            '<th>Aktion</th>',
            '</tr></thead>',
            '<tbody>',
            userRows,
            '</tbody>',
            '</table>',
            '</div>',
            '</div>',

            '<div class="card">',
            '<h2>Alle Server</h2>',
            '<div class="table-wrap">',
            '<table>',
            '<thead><tr>',
            '<th>ID</th>',
            '<th>Name</th>',
            '<th>Owner</th>',
            '<th>E-Mail</th>',
            '<th>Status</th>',
            '<th>Aktion</th>',
            '</tr></thead>',
            '<tbody>',
            serverRows,
            '</tbody>',
            '</table>',
            '</div>',
            '</div>',

            '<div class="card">',
            '<h2>Logs</h2>',
            '<div class="table-wrap">',
            '<table>',
            '<thead><tr>',
            '<th>ID</th>',
            '<th>User</th>',
            '<th>Aktion</th>',
            '<th>Details</th>',
            '<th>Zeit</th>',
            '</tr></thead>',
            '<tbody>',
            logRows,
            '</tbody>',
            '</table>',
            '</div>',
            '</div>'
        ].join('');

        res.send(
            page(
                'Admin Panel',
                content,
                req.user
            )
        );

    } catch (error) {

        console.error('Admin:', error);

        res.status(500).send(
            page(
                'Admin Fehler',
                '<div class="card error"><h1>Admin Panel Fehler</h1><p>Das Admin Panel konnte nicht geladen werden.</p></div>',
                req.user
            )
        );
    }
});

/* ============================================================
   ADMIN USER BAN
   ============================================================ */

app.post('/admin/user/:id/ban', requireAdmin, async function (req, res) {

    try {

        const id = Number(req.params.id);

        const target = await findUserById(id);

        if (!target) {
            return res.status(404).send('Benutzer nicht gefunden');
        }

        if (
            String(target.email).toLowerCase() === OWNER_EMAIL
        ) {
            return res.status(403).send('Owner kann nicht gesperrt werden');
        }

        await dbRun(
            `
            UPDATE users
            SET banned = 1,
                updated_at = ?
            WHERE id = ?
            `,
            [now(), id]
        );

        await logAction(
            req.user.id,
            'USER_BAN',
            'Benutzer #' + id + ' gesperrt'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/admin/user/:id/unban', requireAdmin, async function (req, res) {

    try {

        const id = Number(req.params.id);

        await dbRun(
            `
            UPDATE users
            SET banned = 0,
                updated_at = ?
            WHERE id = ?
            `,
            [now(), id]
        );

        await logAction(
            req.user.id,
            'USER_UNBAN',
            'Benutzer #' + id + ' entsperrt'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ADMIN SERVER STOP
   ============================================================ */

app.post('/admin/server/:id/stop', requireAdmin, async function (req, res) {

    try {

        const id = Number(req.params.id);

        await dbRun(
            `
            UPDATE servers
            SET status = 'offline',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), id]
        );

        await logAction(
            req.user.id,
            'ADMIN_SERVER_STOP',
            'Server #' + id + ' gestoppt'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ADMIN SERVER LOCK
   ============================================================ */

app.post('/admin/server/:id/lock', requireAdmin, async function (req, res) {

    try {

        const id = Number(req.params.id);

        await dbRun(
            `
            UPDATE servers
            SET locked = 1,
                status = 'offline',
                updated_at = ?
            WHERE id = ?
            `,
            [now(), id]
        );

        await logAction(
            req.user.id,
            'ADMIN_SERVER_LOCK',
            'Server #' + id + ' gesperrt'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ADMIN SERVER DELETE
   ============================================================ */

app.post('/admin/server/:id/delete', requireAdmin, async function (req, res) {

    try {

        const id = Number(req.params.id);

        await dbRun(
            `
            DELETE FROM servers
            WHERE id = ?
            `,
            [id]
        );

        await logAction(
            req.user.id,
            'ADMIN_SERVER_DELETE',
            'Server #' + id + ' gelöscht'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ADMIN WARTUNG
   ============================================================ */

app.post('/admin/maintenance/on', requireAdmin, async function (req, res) {

    try {

        await dbRun(
            `
            UPDATE settings
            SET value = '1'
            WHERE key = 'maintenance'
            `
        );

        await dbRun(
            `
            UPDATE servers
            SET maintenance = 1,
                status = 'offline',
                updated_at = ?
            `,
            [now()]
        );

        await logAction(
            req.user.id,
            'GLOBAL_MAINTENANCE_ON',
            'Globale Wartung aktiviert'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

app.post('/admin/maintenance/off', requireAdmin, async function (req, res) {

    try {

        await dbRun(
            `
            UPDATE settings
            SET value = '0'
            WHERE key = 'maintenance'
            `
        );

        await dbRun(
            `
            UPDATE servers
            SET maintenance = 0,
                updated_at = ?
            `,
            [now()]
        );

        await logAction(
            req.user.id,
            'GLOBAL_MAINTENANCE_OFF',
            'Globale Wartung deaktiviert'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   ALLE SERVER HERUNTERFAHREN
   ============================================================ */

app.post('/admin/shutdown', requireAdmin, async function (req, res) {

    try {

        await dbRun(
            `
            UPDATE servers
            SET status = 'offline',
                updated_at = ?
            `,
            [now()]
        );

        await logAction(
            req.user.id,
            'GLOBAL_SHUTDOWN',
            'Alle Server heruntergefahren'
        );

        res.redirect('/admin');

    } catch (error) {

        console.error(error);
        res.status(500).send('Fehler');
    }
});

/* ============================================================
   HEALTH CHECK
   ============================================================ */

app.get('/health', function (req, res) {

    res.status(200).json({
        ok: true,
        service: 'Florian / WeisserHai Minecraft Hosting',
        node: process.version,
        time: now()
    });
});

/* ============================================================
   404
   ============================================================ */

app.use(function (req, res) {

    res.status(404).send(
        page(
            '404',
            [
                '<div class="card">',
                '<h1>404</h1>',
                '<p>Diese Seite wurde nicht gefunden.</p>',
                '<a class="btn" href="/">Zur Startseite</a>',
                '</div>'
            ].join('')
        )
    );
});

/* ============================================================
   ERROR HANDLER
   ============================================================ */

app.use(function (error, req, res, next) {

    console.error('Express Error:', error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send(
        page(
            'Serverfehler',
            [
                '<div class="card error">',
                '<h1>Interner Serverfehler</h1>',
                '<p>Die Anfrage konnte nicht verarbeitet werden.</p>',
                '<a class="btn" href="/">Zur Startseite</a>',
                '</div>'
            ].join('')
        )
    );
});

/* ============================================================
   START
   ============================================================ */

const server = app.listen(
    PORT,
    '0.0.0.0',
    function () {

        console.log('');
        console.log('==============================================');
        console.log(' Florian / WeisserHai Minecraft Hosting');
        console.log('==============================================');
        console.log('Webseite läuft.');
        console.log('Port:', PORT);
        console.log('Node:', process.version);
        console.log('Owner:', OWNER_EMAIL);
        console.log('Datenbank:', DB_FILE);
        console.log('==============================================');
        console.log('');
    }
);

/* ============================================================
   SAUBERES HERUNTERFAHREN
   ============================================================ */

function shutdown(signal) {

    console.log(
        'Empfangenes Signal:',
        signal
    );

    server.close(function () {

        db.close(function () {

            console.log(
                'Server und Datenbank geschlossen.'
            );

            process.exit(0);
        });
    });
}

process.on('SIGTERM', function () {
    shutdown('SIGTERM');
});

process.on('SIGINT', function () {
    shutdown('SIGINT');
});

process.on('uncaughtException', function (error) {

    console.error(
        'UNCAUGHT EXCEPTION:',
        error
    );
});

process.on('unhandledRejection', function (error) {

    console.error(
        'UNHANDLED REJECTION:',
        error
    );
});
