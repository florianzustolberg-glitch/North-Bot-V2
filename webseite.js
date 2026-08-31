/*
========================================================
                 NORTH-BOT-2 WEBSEITE
========================================================

Node.js / Express
Keine .env erforderlich.

Automatisch erstellte Dateien:
- users.json
- tickets.json
- codes.json
- products.json
- giveaways.json
- logs.json
- messages.json
- settings.json
- orders.json
- sessions.json

Start:
    node webseite.js

Standard-Port:
    process.env.PORT || 10000

Owner:
    florianzustolberg@gmail.com

Discord:
    https://discord.gg/NJEVq6Pk6x

========================================================
*/

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";

const SITE_NAME = "North-Bot-2";
const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";
const OWNER_EMAIL = "florianzustolberg@gmail.com";

const TICKET_CATEGORY_ID = "1493423287118729328";

const DATA_DIR = __dirname;

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    tickets: path.join(DATA_DIR, "tickets.json"),
    codes: path.join(DATA_DIR, "codes.json"),
    products: path.join(DATA_DIR, "products.json"),
    giveaways: path.join(DATA_DIR, "giveaways.json"),
    logs: path.join(DATA_DIR, "logs.json"),
    messages: path.join(DATA_DIR, "messages.json"),
    settings: path.join(DATA_DIR, "settings.json"),
    orders: path.join(DATA_DIR, "orders.json"),
    sessions: path.join(DATA_DIR, "sessions.json")
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

/* ======================================================
   JSON DATABASE
====================================================== */

const DEFAULTS = {
    users: [],
    tickets: [],
    codes: [],
    products: [],
    giveaways: [],
    logs: [],
    messages: [],
    orders: [],
    sessions: [],
    settings: {
        status: "normal",
        statusText: "",
        announcement: "",
        maintenance: false,
        incident: false
    }
};

function ensureFile(file, value) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    }
}

function ensureDatabase() {
    ensureFile(FILES.users, DEFAULTS.users);
    ensureFile(FILES.tickets, DEFAULTS.tickets);
    ensureFile(FILES.codes, DEFAULTS.codes);
    ensureFile(FILES.products, DEFAULTS.products);
    ensureFile(FILES.giveaways, DEFAULTS.giveaways);
    ensureFile(FILES.logs, DEFAULTS.logs);
    ensureFile(FILES.messages, DEFAULTS.messages);
    ensureFile(FILES.settings, DEFAULTS.settings);
    ensureFile(FILES.orders, DEFAULTS.orders);
    ensureFile(FILES.sessions, DEFAULTS.sessions);
}

ensureDatabase();

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.error("JSON Fehler:", file, error.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    const temp = file + ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(temp, file);
}

function db(name) {
    return readJSON(FILES[name], DEFAULTS[name]);
}

/* ======================================================
   HELPERS
====================================================== */

function now() {
    return new Date().toISOString();
}

function id(prefix) {
    return prefix + "_" + crypto.randomBytes(10).toString("hex");
}

function randomCodePart() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function createRedeemCode() {
    return "NORTH-" + randomCodePart() + "-" + randomCodePart();
}

function createOrderNumber() {
    return "NORTH-" +
        Date.now().toString().slice(-8) +
        "-" +
        crypto.randomBytes(2).toString("hex").toUpperCase();
}

function createTicketNumber() {
    return "TICKET-" +
        Date.now().toString().slice(-8);
}

function createGiveawayNumber() {
    return "GW-" +
        Date.now().toString().slice(-8);
}

function clean(value, max = 1000) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max);
}

function escapeHTML(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(String(password), salt, 64)
        .toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(password, stored) {
    try {
        const parts = String(stored).split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const original = Buffer.from(parts[1], "hex");

        const current = crypto.scryptSync(
            String(password),
            salt,
            64
        );

        return crypto.timingSafeEqual(
            original,
            current
        );
    } catch {
        return false;
    }
}

function getSettings() {
    return Object.assign(
        {},
        DEFAULTS.settings,
        db("settings")
    );
}

function saveSettings(settings) {
    writeJSON(FILES.settings, settings);
}

function addLog(type, actor, details) {
    const logs = db("logs");

    logs.unshift({
        id: id("log"),
        type: clean(type, 100),
        actor: clean(actor, 200),
        details: clean(details, 1000),
        createdAt: now()
    });

    writeJSON(
        FILES.logs,
        logs.slice(0, 5000)
    );
}

function findUserByEmail(email) {
    const users = db("users");

    return users.find(function(user) {
        return user.email.toLowerCase() ===
            String(email).toLowerCase();
    });
}

function findUserById(userId) {
    return db("users").find(function(user) {
        return user.id === userId;
    });
}

function isBanned(user) {
    if (!user || !user.banned) {
        return false;
    }

    if (!user.banUntil) {
        return true;
    }

    const until = new Date(user.banUntil).getTime();

    if (Date.now() >= until) {
        user.banned = false;
        user.banUntil = null;
        user.banReason = "";

        const users = db("users");
        const index = users.findIndex(function(x) {
            return x.id === user.id;
        });

        if (index !== -1) {
            users[index] = user;
            writeJSON(FILES.users, users);
        }

        return false;
    }

    return true;
}

function roleLevel(role) {
    const levels = {
        user: 0,
        supporter: 1,
        moderator: 2,
        developer: 3,
        manager: 4,
        admin: 5,
        owner: 6
    };

    return levels[role] || 0;
}

function canAdmin(user) {
    return !!user &&
        roleLevel(user.role) >= roleLevel("admin");
}

function canManage(user) {
    return !!user &&
        roleLevel(user.role) >= roleLevel("manager");
}

function canTeam(user) {
    return !!user &&
        roleLevel(user.role) >= roleLevel("supporter");
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    try {
        return new Date(value).toLocaleString("de-DE");
    } catch {
        return "-";
    }
}

function formatBan(user) {
    if (!user || !user.banned) {
        return "Nicht gebannt";
    }

    if (!user.banUntil) {
        return "Dauerhaft";
    }

    return "Bis " + formatDate(user.banUntil);
}

function generateSession(userId) {
    const sessions = db("sessions");

    const token = crypto.randomBytes(32).toString("hex");

    sessions.push({
        token: token,
        userId: userId,
        createdAt: now(),
        expiresAt: new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 7
        ).toISOString()
    });

    writeJSON(
        FILES.sessions,
        sessions.slice(-1000)
    );

    return token;
}

function getUserFromRequest(req) {
    const token = req.headers.cookie
        ? parseCookie(req.headers.cookie).north_session
        : null;

    if (!token) {
        return null;
    }

    const sessions = db("sessions");

    const session = sessions.find(function(item) {
        return item.token === token;
    });

    if (!session) {
        return null;
    }

    if (Date.now() >
        new Date(session.expiresAt).getTime()) {

        return null;
    }

    return findUserById(session.userId) || null;
}

function parseCookie(header) {
    const result = {};

    String(header || "")
        .split(";")
        .forEach(function(part) {
            const index = part.indexOf("=");

            if (index === -1) {
                return;
            }

            const key = part.slice(0, index).trim();
            const value = part.slice(index + 1).trim();

            result[key] = decodeURIComponent(value);
        });

    return result;
}

function setSession(res, token) {
    res.setHeader(
        "Set-Cookie",
        "north_session=" +
        encodeURIComponent(token) +
        "; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"
    );
}

function clearSession(res, req) {
    const cookies = parseCookie(req.headers.cookie || "");
    const token = cookies.north_session;

    if (token) {
        const sessions = db("sessions")
            .filter(function(item) {
                return item.token !== token;
            });

        writeJSON(FILES.sessions, sessions);
    }

    res.setHeader(
        "Set-Cookie",
        "north_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );
}

/* ======================================================
   HTML
====================================================== */

function layout(title, content, user) {
    const settings = getSettings();

    let statusHTML = "";

    if (settings.maintenance) {
        statusHTML =
            '<div class="status maintenance">' +
            "🔧 Wartung: " +
            escapeHTML(settings.statusText ||
                "Die Webseite befindet sich momentan in Wartung.") +
            "</div>";
    } else if (settings.incident) {
        statusHTML =
            '<div class="status incident">' +
            "⚠️ Störung: " +
            escapeHTML(settings.statusText ||
                "Aktuell kann es zu Einschränkungen kommen.") +
            "</div>";
    }

    let nav = "";

    if (user) {
        nav += '<a href="/dashboard">Dashboard</a>';
        nav += '<a href="/tickets">Tickets</a>';
        nav += '<a href="/shop">Shop</a>';
        nav += '<a href="/codes">Codes</a>';
        nav += '<a href="/giveaways">Gewinnspiele</a>';
        nav += '<a href="/chat">Chat</a>';

        if (canAdmin(user)) {
            nav += '<a href="/admin">Adminpanel</a>';
        }

        nav += '<a href="/logout">Logout</a>';
    } else {
        nav += '<a href="/login">Login</a>';
        nav += '<a href="/register">Registrieren</a>';
    }

    return [
        "<!DOCTYPE html>",
        "<html lang=\"de\">",
        "<head>",
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<title>" +
            escapeHTML(title) +
            " | North-Bot-2</title>",
        "<style>",
        css(),
        "</style>",
        "</head>",
        "<body>",
        '<header class="header">',
        '<div class="brand">',
        '<div class="logo">N</div>',
        '<div>',
        "<strong>North-Bot-2</strong>",
        "<small>Websystem</small>",
        "</div>",
        "</div>",
        '<nav>' + nav + "</nav>",
        "</header>",
        statusHTML,
        '<main class="container">',
        content,
        "</main>",
        '<footer>',
        "<span>North-Bot-2</span>",
        '<a href="' + DISCORD_INVITE + '" target="_blank">Discord</a>',
        "</footer>",
        "</body>",
        "</html>"
    ].join("");
}

function css() {
    return [
        "*{box-sizing:border-box}",
        "body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#0b0e13;color:#eef2f7}",
        "a{color:#8db7ff;text-decoration:none}",
        "a:hover{text-decoration:underline}",
        ".header{height:72px;background:#10141c;border-bottom:1px solid #252b36;display:flex;align-items:center;justify-content:space-between;padding:0 5%;position:sticky;top:0;z-index:10}",
        ".brand{display:flex;gap:12px;align-items:center}",
        ".logo{width:42px;height:42px;border-radius:10px;background:#fff;color:#111;display:grid;place-items:center;font-weight:900;font-size:22px}",
        ".brand strong{display:block;font-size:16px}",
        ".brand small{display:block;color:#7f8997;margin-top:2px}",
        "nav{display:flex;gap:18px;align-items:center;flex-wrap:wrap}",
        "nav a{font-size:14px;color:#aeb8c8}",
        ".container{width:min(1180px,92%);margin:40px auto}",
        ".hero{padding:65px 0}",
        ".hero h1{font-size:52px;line-height:1;margin:0 0 16px}",
        ".hero p{color:#9da7b5;max-width:680px;font-size:18px;line-height:1.6}",
        ".buttons{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}",
        ".button{display:inline-block;background:#fff;color:#101319;padding:12px 18px;border-radius:9px;font-weight:700;border:0;cursor:pointer}",
        ".button.secondary{background:#1b222d;color:#fff}",
        ".button.danger{background:#d84848;color:#fff}",
        ".button.green{background:#319b65;color:#fff}",
        ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}",
        ".box{background:#11161e;border:1px solid #252c38;border-radius:14px;padding:20px}",
        ".box h2,.box h3{margin-top:0}",
        ".muted{color:#8993a2}",
        ".big{font-size:30px;font-weight:800}",
        ".form{max-width:520px;margin:auto}",
        "label{display:block;margin:14px 0 7px;color:#adb6c3;font-size:14px}",
        "input,textarea,select{width:100%;background:#0c1016;border:1px solid #303744;color:#fff;padding:12px;border-radius:8px;outline:none}",
        "input:focus,textarea:focus,select:focus{border-color:#7899d6}",
        "textarea{min-height:120px;resize:vertical}",
        "form button{margin-top:18px}",
        ".alert{padding:13px 15px;border-radius:9px;background:#2a1717;border:1px solid #653333;margin-bottom:20px;color:#ffb2b2}",
        ".success{padding:13px 15px;border-radius:9px;background:#12251c;border:1px solid #285c3e;margin-bottom:20px;color:#a8edc5}",
        ".status{padding:13px;text-align:center;font-weight:700}",
        ".maintenance{background:#403319;color:#ffd982}",
        ".incident{background:#3c1c1c;color:#ffaaaa}",
        ".table-wrap{overflow:auto}",
        "table{width:100%;border-collapse:collapse}",
        "th,td{text-align:left;padding:12px;border-bottom:1px solid #252c38;vertical-align:top}",
        "th{color:#8993a2;font-size:12px;text-transform:uppercase}",
        ".tag{display:inline-block;padding:4px 8px;border-radius:5px;background:#202735;color:#c7d2e4;font-size:12px}",
        ".tag.admin{background:#493527;color:#ffd6a1}",
        ".tag.owner{background:#3f315d;color:#e6d2ff}",
        ".tag.banned{background:#552525;color:#ffb1b1}",
        ".message{padding:13px;border-bottom:1px solid #242a34}",
        ".message strong{margin-right:8px}",
        ".ticket{display:flex;justify-content:space-between;gap:20px;align-items:center}",
        ".ticket-title{font-weight:700}",
        "footer{border-top:1px solid #252b36;margin-top:80px;padding:30px 5%;display:flex;justify-content:space-between;color:#7f8997}",
        ".center{text-align:center}",
        "@media(max-width:800px){.header{height:auto;padding:15px 4%;align-items:flex-start;gap:15px;flex-direction:column}.hero h1{font-size:38px}nav{gap:10px}.container{margin-top:25px}}"
    ].join("");
}

/* ======================================================
   MIDDLEWARE
====================================================== */

function requireLogin(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    if (!canAdmin(user)) {
        return res.status(403).send(
            layout(
                "Kein Zugriff",
                '<div class="box center">' +
                "<h1>403</h1>" +
                "<p>Du hast keine Berechtigung für diesen Bereich.</p>" +
                "</div>",
                user
            )
        );
    }

    req.user = user;
    next();
}

function requireManager(req, res, next) {
    const user = getUserFromRequest(req);

    if (!user || !canManage(user)) {
        return res.status(403).send(
            layout(
                "Kein Zugriff",
                '<div class="box center"><h1>Kein Zugriff</h1></div>',
                user
            )
        );
    }

    req.user = user;
    next();
}

/* ======================================================
   HOME
====================================================== */

app.get("/", function(req, res) {
    const user = getUserFromRequest(req);
    const settings = getSettings();

    const content = [
        '<section class="hero">',
        "<span class=\"tag\">NORTH-BOT-2</span>",
        "<h1>Dein modernes Websystem.</h1>",
        "<p>",
        "Accounts, Coins, Shop, Tickets, Gewinnspiele, ",
        "Community-Chat und ein umfangreiches Adminpanel ",
        "in einer Webseite.",
        "</p>",
        '<div class="buttons">',
        user
            ? '<a class="button" href="/dashboard">Zum Dashboard</a>'
            : '<a class="button" href="/register">Konto erstellen</a>',
        '<a class="button secondary" href="' +
            DISCORD_INVITE +
            '" target="_blank">Discord beitreten</a>',
        "</div>",
        "</section>",
        '<div class="grid">',
        '<div class="box"><h3>💰 Coins</h3><p class="muted">Daily-Bonus und Coin-Shop.</p></div>',
        '<div class="box"><h3>🎫 Tickets</h3><p class="muted">Support direkt über die Webseite.</p></div>',
        '<div class="box"><h3>🎉 Gewinnspiele</h3><p class="muted">Nimm an laufenden Gewinnspielen teil.</p></div>',
        '<div class="box"><h3>🛡️ Sicherheit</h3><p class="muted">Rollen, Bans und Protokollierung.</p></div>',
        "</div>"
    ].join("");

    res.send(layout(SITE_NAME, content, user));
});

/* ======================================================
   REGISTER
====================================================== */

app.get("/register", function(req, res) {
    const user = getUserFromRequest(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    const content = [
        '<div class="box form">',
        "<h1>Registrieren</h1>",
        '<form method="POST" action="/register">',
        "<label>Name</label>",
        '<input name="name" required minlength="2" maxlength="32">',
        "<label>E-Mail</label>",
        '<input name="email" type="email" required>',
        "<label>Passwort</label>",
        '<input name="password" type="password" required minlength="6">',
        "<button class=\"button\" type=\"submit\">Konto erstellen</button>",
        "</form>",
        '<p class="muted">Bereits registriert? <a href="/login">Login</a></p>',
        "</div>"
    ].join("");

    res.send(layout("Registrieren", content, null));
});

app.post("/register", function(req, res) {
    const name = clean(req.body.name, 32);
    const email = clean(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 ||
        !email.includes("@") ||
        password.length < 6) {

        return res.send(
            layout(
                "Fehler",
                '<div class="box form">' +
                '<div class="alert">Bitte überprüfe deine Angaben.</div>' +
                '<a href="/register">Zurück</a>' +
                "</div>",
                null
            )
        );
    }

    const users = db("users");

    if (users.some(function(user) {
        return user.email.toLowerCase() === email;
    })) {
        return res.send(
            layout(
                "Fehler",
                '<div class="box form">' +
                '<div class="alert">Diese E-Mail-Adresse ist bereits registriert.</div>' +
                '<a href="/login">Zum Login</a>' +
                "</div>",
                null
            )
        );
    }

    const user = {
        id: id("user"),
        name: name,
        email: email,
        password: hashPassword(password),
        role: email === OWNER_EMAIL
            ? "owner"
            : "user",
        coins: 0,
        dailyClaimAt: null,
        banned: false,
        banUntil: null,
        banReason: "",
        createdAt: now(),
        lastLoginAt: null
    };

    users.push(user);

    writeJSON(FILES.users, users);

    addLog(
        "registration",
        email,
        "Neuer Account: " + email
    );

    const token = generateSession(user.id);

    setSession(res, token);

    res.redirect("/dashboard");
});

/* ======================================================
   LOGIN
====================================================== */

app.get("/login", function(req, res) {
    const user = getUserFromRequest(req);

    if (user) {
        return res.redirect("/dashboard");
    }

    const content = [
        '<div class="box form">',
        "<h1>Login</h1>",
        '<form method="POST" action="/login">',
        "<label>E-Mail</label>",
        '<input name="email" type="email" required>',
        "<label>Passwort</label>",
        '<input name="password" type="password" required>',
        "<button class=\"button\" type=\"submit\">Einloggen</button>",
        "</form>",
        '<p class="muted">Noch kein Konto? <a href="/register">Registrieren</a></p>',
        "</div>"
    ].join("");

    res.send(layout("Login", content, null));
});

app.post("/login", function(req, res) {
    const email = clean(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || "");

    const user = findUserByEmail(email);

    if (!user ||
        !verifyPassword(password, user.password)) {

        addLog(
            "login_failed",
            email || "unknown",
            "Fehlgeschlagener Login"
        );

        return res.send(
            layout(
                "Login",
                '<div class="box form">' +
                '<div class="alert">E-Mail oder Passwort ist falsch.</div>' +
                '<a href="/login">Erneut versuchen</a>' +
                "</div>",
                null
            )
        );
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    user.lastLoginAt = now();

    const users = db("users");

    const index = users.findIndex(function(item) {
        return item.id === user.id;
    });

    if (index !== -1) {
        users[index] = user;
    }

    writeJSON(FILES.users, users);

    const token = generateSession(user.id);

    setSession(res, token);

    addLog(
        "login",
        user.email,
        "Login erfolgreich"
    );

    res.redirect("/dashboard");
});

/* ======================================================
   LOGOUT
====================================================== */

app.get("/logout", function(req, res) {
    const user = getUserFromRequest(req);

    if (user) {
        addLog(
            "logout",
            user.email,
            "Logout"
        );
    }

    clearSession(res, req);

    res.redirect("/");
});

/* ======================================================
   BANNED
====================================================== */

app.get("/banned", function(req, res) {
    const user = getUserFromRequest(req);

    let reason = "Kein Grund angegeben.";
    let until = "Dauerhaft";

    if (user) {
        reason = user.banReason || reason;
        until = user.banUntil
            ? formatDate(user.banUntil)
            : "Dauerhaft";
    }

    const content = [
        '<div class="box center">',
        "<h1>🚫 Konto gesperrt</h1>",
        "<p>Dein North-Bot-2 Konto ist momentan gesperrt.</p>",
        "<p><strong>Grund:</strong> " +
            escapeHTML(reason) +
            "</p>",
        "<p><strong>Ende:</strong> " +
            escapeHTML(until) +
            "</p>",
        '<div class="buttons" style="justify-content:center">',
        '<a class="button" href="' +
            DISCORD_INVITE +
            '" target="_blank">Auf Discord Entbannung anfragen</a>',
        "</div>",
        "</div>"
    ].join("");

    res.send(layout("Gebannt", content, user));
});

/* ======================================================
   DASHBOARD
====================================================== */

app.get("/dashboard", requireLogin, function(req, res) {
    const user = req.user;

    let daily = "Verfügbar";

    if (user.dailyClaimAt) {
        const next = new Date(
            new Date(user.dailyClaimAt).getTime() +
            14 * 60 * 60 * 1000
        );

        if (Date.now() < next.getTime()) {
            daily = "Ab " + formatDate(next);
        }
    }

    const content = [
        "<h1>Willkommen, " +
            escapeHTML(user.name) +
            ".</h1>",
        '<div class="grid">',
        '<div class="box">',
        "<h3>💰 Coins</h3>",
        '<div class="big">' +
            Number(user.coins || 0) +
            "</div>",
        "</div>",
        '<div class="box">',
        "<h3>👑 Rolle</h3>",
        '<div class="big" style="font-size:22px">' +
            escapeHTML(user.role) +
            "</div>",
        "</div>",
        '<div class="box">',
        "<h3>🎁 Daily</h3>",
        "<p>" + escapeHTML(daily) + "</p>",
        '<form method="POST" action="/daily">',
        '<button class="button green">100 Coins abholen</button>',
        "</form>",
        "</div>",
        "</div>",
        '<div class="box" style="margin-top:20px">',
        "<h2>Profil</h2>",
        "<p>E-Mail: " +
            escapeHTML(user.email) +
            "</p>",
        "<p>Registriert: " +
            escapeHTML(formatDate(user.createdAt)) +
            "</p>",
        '<a class="button secondary" href="/profile">Profil bearbeiten</a>',
        "</div>"
    ].join("");

    res.send(layout("Dashboard", content, user));
});

/* ======================================================
   DAILY
====================================================== */

app.post("/daily", requireLogin, function(req, res) {
    const user = req.user;

    if (user.dailyClaimAt) {
        const next =
            new Date(user.dailyClaimAt).getTime() +
            14 * 60 * 60 * 1000;

        if (Date.now() < next) {
            return res.redirect("/dashboard");
        }
    }

    user.coins = Number(user.coins || 0) + 100;
    user.dailyClaimAt = now();

    const users = db("users");

    const index = users.findIndex(function(item) {
        return item.id === user.id;
    });

    users[index] = user;

    writeJSON(FILES.users, users);

    addLog(
        "daily",
        user.email,
        "100 Coins erhalten"
    );

    res.redirect("/dashboard");
});

/* ======================================================
   PROFILE
====================================================== */

app.get("/profile", requireLogin, function(req, res) {
    const user = req.user;

    const content = [
        '<div class="box form">',
        "<h1>Profil bearbeiten</h1>",
        '<form method="POST" action="/profile">',
        "<label>Name</label>",
        '<input name="name" value="' +
            escapeHTML(user.name) +
            '" required maxlength="32">',
        "<label>Neue E-Mail</label>",
        '<input name="email" type="email" value="' +
            escapeHTML(user.email) +
            '" required>',
        "<label>Neues Passwort</label>",
        '<input name="password" type="password" minlength="6">',
        "<button class=\"button\" type=\"submit\">Speichern</button>",
        "</form>",
        "</div>"
    ].join("");

    res.send(layout("Profil", content, user));
});

app.post("/profile", requireLogin, function(req, res) {
    const user = req.user;

    const newName = clean(req.body.name, 32);
    const newEmail = clean(req.body.email, 160).toLowerCase();
    const newPassword = String(req.body.password || "");

    if (newName.length < 2 ||
        !newEmail.includes("@")) {

        return res.redirect("/profile");
    }

    const existing = findUserByEmail(newEmail);

    if (existing && existing.id !== user.id) {
        return res.send(
            layout(
                "Fehler",
                '<div class="box form">' +
                '<div class="alert">Die E-Mail wird bereits verwendet.</div>' +
                '<a href="/profile">Zurück</a>' +
                "</div>",
                user
            )
        );
    }

    user.name = newName;
    user.email = newEmail;

    if (newPassword) {
        user.password = hashPassword(newPassword);
    }

    if (newEmail === OWNER_EMAIL) {
        user.role = "owner";
    }

    const users = db("users");
    const index = users.findIndex(function(item) {
        return item.id === user.id;
    });

    users[index] = user;

    writeJSON(FILES.users, users);

    addLog(
        "profile_update",
        user.email,
        "Profil aktualisiert"
    );

    res.redirect("/dashboard");
});

/* ======================================================
   TICKETS
====================================================== */

app.get("/tickets", requireLogin, function(req, res) {
    const tickets = db("tickets");

    const visible = tickets.filter(function(ticket) {
        return ticket.userId === req.user.id ||
            canTeam(req.user);
    });

    let rows = "";

    if (!visible.length) {
        rows =
            '<div class="box">' +
            '<p class="muted">Noch keine Tickets vorhanden.</p>' +
            "</div>";
    } else {
        rows = visible.map(function(ticket) {
            return [
                '<div class="box">',
                '<div class="ticket">',
                "<div>",
                '<div class="ticket-title">' +
                    escapeHTML(ticket.number) +
                    "</div>",
                "<p>" +
                    escapeHTML(ticket.subject) +
                    "</p>",
                '<span class="tag">' +
                    escapeHTML(ticket.status) +
                    "</span>",
                "</div>",
                '<a class="button secondary" href="/tickets/' +
                    encodeURIComponent(ticket.id) +
                    '">Öffnen</a>',
                "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    const content = [
        "<h1>Tickets</h1>",
        '<div class="box">',
        "<h2>Neues Ticket</h2>",
        '<form method="POST" action="/tickets/create">',
        "<label>Betreff</label>",
        '<input name="subject" required maxlength="100">',
        "<label>Nachricht</label>",
        '<textarea name="message" required maxlength="3000"></textarea>',
        '<button class="button" type="submit">Ticket erstellen</button>',
        "</form>",
        "</div>",
        '<div style="margin-top:20px">',
        rows,
        "</div>"
    ].join("");

    res.send(layout("Tickets", content, req.user));
});

app.post("/tickets/create", requireLogin, function(req, res) {
    const subject = clean(req.body.subject, 100);
    const message = clean(req.body.message, 3000);

    if (!subject || !message) {
        return res.redirect("/tickets");
    }

    const tickets = db("tickets");

    const ticket = {
        id: id("ticket"),
        number: createTicketNumber(),
        userId: req.user.id,
        userEmail: req.user.email,
        subject: subject,
        message: message,
        status: "offen",
        claimedBy: null,
        categoryId: TICKET_CATEGORY_ID,
        createdAt: now(),
        closedAt: null,
        discordChannelId: null
    };

    tickets.push(ticket);

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_create",
        req.user.email,
        ticket.number
    );

    /*
      Hier wird bewusst KEIN Bot-Token gespeichert.
      Dein Discord-Bot kann die tickets.json bzw. eine API
      überwachen und das Discord-Ticket in Kategorie
      1493423287118729328 erstellen.
    */

    res.redirect("/tickets/" + encodeURIComponent(ticket.id));
});

app.get("/tickets/:id", requireLogin, function(req, res) {
    const ticket = db("tickets").find(function(item) {
        return item.id === req.params.id;
    });

    if (!ticket) {
        return res.status(404).send(
            layout(
                "Ticket",
                '<div class="box"><h1>Ticket nicht gefunden.</h1></div>',
                req.user
            )
        );
    }

    if (ticket.userId !== req.user.id &&
        !canTeam(req.user)) {

        return res.status(403).send(
            layout(
                "Kein Zugriff",
                '<div class="box"><h1>Kein Zugriff.</h1></div>',
                req.user
            )
        );
    }

    const content = [
        '<div class="box">',
        "<h1>" + escapeHTML(ticket.number) + "</h1>",
        "<p><strong>" +
            escapeHTML(ticket.subject) +
            "</strong></p>",
        "<p>" +
            escapeHTML(ticket.message) +
            "</p>",
        '<span class="tag">' +
            escapeHTML(ticket.status) +
            "</span>",
        "<p class=\"muted\">Erstellt: " +
            escapeHTML(formatDate(ticket.createdAt)) +
            "</p>",
        ticket.claimedBy
            ? "<p>Übernommen von: " +
              escapeHTML(ticket.claimedBy) +
              "</p>"
            : "",
        '<div class="buttons">',
        canTeam(req.user) &&
        ticket.status !== "geschlossen"
            ? '<form method="POST" action="/tickets/' +
              ticket.id +
              '/claim"><button class="button green">Übernehmen</button></form>'
            : "",
        canTeam(req.user) &&
        ticket.claimedBy
            ? '<form method="POST" action="/tickets/' +
              ticket.id +
              '/unclaim"><button class="button secondary">Nicht übernehmen</button></form>'
            : "",
        ticket.status !== "geschlossen"
            ? '<form method="POST" action="/tickets/' +
              ticket.id +
              '/close"><button class="button danger">Schließen</button></form>'
            : "",
        "</div>",
        "</div>"
    ].join("");

    res.send(layout(ticket.number, content, req.user));
});

app.post("/tickets/:id/claim", requireManager, function(req, res) {
    const tickets = db("tickets");

    const ticket = tickets.find(function(item) {
        return item.id === req.params.id;
    });

    if (!ticket) {
        return res.redirect("/tickets");
    }

    ticket.claimedBy = req.user.email;
    ticket.status = "in_bearbeitung";

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_claim",
        req.user.email,
        ticket.number
    );

    res.redirect("/tickets/" + ticket.id);
});

app.post("/tickets/:id/unclaim", requireManager, function(req, res) {
    const tickets = db("tickets");

    const ticket = tickets.find(function(item) {
        return item.id === req.params.id;
    });

    if (!ticket) {
        return res.redirect("/tickets");
    }

    ticket.claimedBy = null;
    ticket.status = "offen";

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_unclaim",
        req.user.email,
        ticket.number
    );

    res.redirect("/tickets/" + ticket.id);
});

app.post("/tickets/:id/close", requireLogin, function(req, res) {
    const tickets = db("tickets");

    const ticket = tickets.find(function(item) {
        return item.id === req.params.id;
    });

    if (!ticket) {
        return res.redirect("/tickets");
    }

    if (ticket.userId !== req.user.id &&
        !canTeam(req.user)) {

        return res.status(403).send("Kein Zugriff.");
    }

    ticket.status = "geschlossen";
    ticket.closedAt = now();

    writeJSON(FILES.tickets, tickets);

    addLog(
        "ticket_close",
        req.user.email,
        ticket.number
    );

    res.redirect("/tickets");
});

/* ======================================================
   CODES
====================================================== */

app.get("/codes", requireLogin, function(req, res) {
    const content = [
        '<div class="box form">',
        "<h1>Coin-Code einlösen</h1>",
        '<form method="POST" action="/codes/redeem">',
        "<label>Code</label>",
        '<input name="code" placeholder="NORTH-XXXXXX-XXXXXX" required>',
        '<button class="button green">Code einlösen</button>',
        "</form>",
        "</div>"
    ].join("");

    res.send(layout("Codes", content, req.user));
});

app.post("/codes/redeem", requireLogin, function(req, res) {
    const input = clean(req.body.code, 100)
        .toUpperCase();

    const codes = db("codes");

    const code = codes.find(function(item) {
        return item.code.toUpperCase() === input &&
            item.active !== false;
    });

    if (!code) {
        return res.send(
            layout(
                "Code",
                '<div class="box form">' +
                '<div class="alert">Der Code existiert nicht oder ist deaktiviert.</div>' +
                '<a href="/codes">Zurück</a>' +
                "</div>",
                req.user
            )
        );
    }

    code.usedBy = Array.isArray(code.usedBy)
        ? code.usedBy
        : [];

    if (code.usedBy.includes(req.user.id)) {
        return res.send(
            layout(
                "Code",
                '<div class="box form">' +
                '<div class="alert">Du hast diesen Code bereits eingelöst.</div>' +
                '<a href="/codes">Zurück</a>' +
                "</div>",
                req.user
            )
        );
    }

    if (code.maxUses &&
        code.usedBy.length >= Number(code.maxUses)) {

        return res.send(
            layout(
                "Code",
                '<div class="box form">' +
                '<div class="alert">Dieser Code wurde bereits vollständig verwendet.</div>' +
                "</div>",
                req.user
            )
        );
    }

    const users = db("users");

    const userIndex = users.findIndex(function(user) {
        return user.id === req.user.id;
    });

    if (userIndex === -1) {
        return res.redirect("/login");
    }

    users[userIndex].coins =
        Number(users[userIndex].coins || 0) +
        Number(code.coins || 0);

    code.usedBy.push(req.user.id);

    writeJSON(FILES.users, users);
    writeJSON(FILES.codes, codes);

    addLog(
        "code_redeem",
        req.user.email,
        code.code + " / +" + code.coins + " Coins"
    );

    res.send(
        layout(
            "Code eingelöst",
            '<div class="box form">' +
            '<div class="success">Code erfolgreich eingelöst. +' +
            Number(code.coins || 0) +
            " Coins.</div>" +
            '<a href="/dashboard">Zum Dashboard</a>' +
            "</div>",
            req.user
        )
    );
});

/* ======================================================
   SHOP
====================================================== */

app.get("/shop", requireLogin, function(req, res) {
    const products = db("products")
        .filter(function(product) {
            return product.active !== false;
        });

    let cards = "";

    if (!products.length) {
        cards =
            '<div class="box">' +
            '<p class="muted">Noch keine Produkte vorhanden.</p>' +
            "</div>";
    } else {
        cards = products.map(function(product) {
            return [
                '<div class="box">',
                "<h2>" +
                    escapeHTML(product.name) +
                    "</h2>",
                "<p class=\"muted\">" +
                    escapeHTML(product.description) +
                    "</p>",
                '<div class="big">' +
                    Number(product.price || 0) +
                    " Coins</div>",
                "<p>Bestand: " +
                    (product.stock == null
                        ? "∞"
                        : Number(product.stock)) +
                    "</p>",
                '<form method="POST" action="/shop/buy/' +
                    product.id +
                    '">',
                '<button class="button green">Kaufen</button>',
                "</form>",
                "</div>"
            ].join("");
        }).join("");
    }

    const content = [
        "<h1>Coin-Shop</h1>",
        "<p class=\"muted\">Deine Coins: " +
            Number(req.user.coins || 0) +
            "</p>",
        '<div class="grid">',
        cards,
        "</div>"
    ].join("");

    res.send(layout("Shop", content, req.user));
});

app.post("/shop/buy/:id", requireLogin, function(req, res) {
    const products = db("products");

    const product = products.find(function(item) {
        return item.id === req.params.id &&
            item.active !== false;
    });

    if (!product) {
        return res.redirect("/shop");
    }

    const users = db("users");

    const index = users.findIndex(function(item) {
        return item.id === req.user.id;
    });

    if (index === -1) {
        return res.redirect("/login");
    }

    const price = Number(product.price || 0);

    if (Number(users[index].coins || 0) < price) {
        return res.send(
            layout(
                "Shop",
                '<div class="box form">' +
                '<div class="alert">Du hast nicht genug Coins.</div>' +
                '<a href="/shop">Zurück zum Shop</a>' +
                "</div>",
                req.user
            )
        );
    }

    if (product.stock != null &&
        Number(product.stock) <= 0) {

        return res.redirect("/shop");
    }

    users[index].coins -= price;

    if (product.stock != null) {
        product.stock =
            Number(product.stock) - 1;
    }

    const orders = db("orders");

    const order = {
        id: id("order"),
        orderNumber: createOrderNumber(),
        userId: req.user.id,
        userEmail: req.user.email,
        productId: product.id,
        productName: product.name,
        price: price,
        status: "offen",
        createdAt: now()
    };

    orders.push(order);

    writeJSON(FILES.users, users);
    writeJSON(FILES.products, products);
    writeJSON(FILES.orders, orders);

    addLog(
        "shop_purchase",
        req.user.email,
        order.orderNumber + " / " + product.name
    );

    res.send(
        layout(
            "Bestellung",
            '<div class="box form">' +
            '<div class="success">' +
            "<h2>Bestellung erstellt</h2>" +
            "<p>Bestellnummer:</p>" +
            '<div class="big">' +
            escapeHTML(order.orderNumber) +
            "</div>" +
            "<p>Produkt: " +
            escapeHTML(product.name) +
            "</p>" +
            "</div>" +
            '<a href="/shop">Zum Shop</a>' +
            "</div>",
            req.user
        )
    );
});

/* ======================================================
   GIVEAWAYS
====================================================== */

app.get("/giveaways", requireLogin, function(req, res) {
    const giveaways = db("giveaways");

    const cards = giveaways.map(function(giveaway) {
        const participants =
            Array.isArray(giveaway.participants)
                ? giveaway.participants
                : [];

        const ended =
            Date.now() >=
            new Date(giveaway.endsAt).getTime();

        return [
            '<div class="box">',
            "<h2>" +
                escapeHTML(giveaway.title) +
                "</h2>",
            "<p>" +
                escapeHTML(giveaway.description) +
                "</p>",
            "<p><strong>Gewinn:</strong> " +
                Number(giveaway.coins) +
                " Coins</p>",
            "<p><strong>Ende:</strong> " +
                escapeHTML(formatDate(giveaway.endsAt)) +
                "</p>",
            "<p>Teilnehmer: " +
                participants.length +
                "</p>",
            ended
                ? '<span class="tag">Beendet</span>'
                : '<form method="POST" action="/giveaways/' +
                  giveaway.id +
                  '/join">' +
                  '<button class="button green">Teilnehmen</button>' +
                  "</form>",
            "</div>"
        ].join("");
    }).join("");

    const content = [
        "<h1>🎉 Gewinnspiele</h1>",
        cards ||
            '<div class="box"><p class="muted">Keine Gewinnspiele.</p></div>'
    ].join("");

    res.send(layout("Gewinnspiele", content, req.user));
});

app.post("/giveaways/:id/join", requireLogin, function(req, res) {
    const giveaways = db("giveaways");

    const giveaway = giveaways.find(function(item) {
        return item.id === req.params.id;
    });

    if (!giveaway) {
        return res.redirect("/giveaways");
    }

    if (Date.now() >=
        new Date(giveaway.endsAt).getTime()) {

        return res.redirect("/giveaways");
    }

    giveaway.participants =
        Array.isArray(giveaway.participants)
            ? giveaway.participants
            : [];

    if (!giveaway.participants.includes(req.user.id)) {
        giveaway.participants.push(req.user.id);

        writeJSON(FILES.giveaways, giveaways);

        addLog(
            "giveaway_join",
            req.user.email,
            giveaway.title
        );
    }

    res.redirect("/giveaways");
});

/* ======================================================
   CHAT
====================================================== */

app.get("/chat", requireLogin, function(req, res) {
    const messages = db("messages")
        .filter(function(message) {
            return message.type === "public";
        })
        .slice(-100);

    let html = "";

    messages.forEach(function(message) {
        html += [
            '<div class="message">',
            "<strong>" +
                escapeHTML(message.name) +
                "</strong>",
            '<span class="muted">' +
                escapeHTML(formatDate(message.createdAt)) +
                "</span>",
            "<div>" +
                escapeHTML(message.text) +
                "</div>",
            "</div>"
        ].join("");
    });

    const content = [
        '<div class="box">',
        "<h1>💬 Community Chat</h1>",
        '<div class="box" style="padding:0;overflow:hidden">',
        html ||
            '<p class="muted" style="padding:15px">Noch keine Nachrichten.</p>',
        "</div>",
        '<form method="POST" action="/chat/send">',
        "<label>Nachricht</label>",
        '<textarea name="text" maxlength="1000" required></textarea>',
        '<button class="button">Senden</button>',
        "</form>",
        "</div>"
    ].join("");

    res.send(layout("Chat", content, req.user));
});

app.post("/chat/send", requireLogin, function(req, res) {
    const text = clean(req.body.text, 1000);

    if (!text) {
        return res.redirect("/chat");
    }

    const messages = db("messages");

    messages.push({
        id: id("msg"),
        type: "public",
        userId: req.user.id,
        name: req.user.name,
        text: text,
        createdAt: now()
    });

    writeJSON(
        FILES.messages,
        messages.slice(-5000)
    );

    addLog(
        "chat_message",
        req.user.email,
        "Community Chat"
    );

    res.redirect("/chat");
});

/* ======================================================
   TEAM CHAT
====================================================== */

app.get("/team-chat", requireManager, function(req, res) {
    const messages = db("messages")
        .filter(function(message) {
            return message.type === "team";
        })
        .slice(-200);

    let html = "";

    messages.forEach(function(message) {
        html += [
            '<div class="message">',
            "<strong>" +
                escapeHTML(message.name) +
                "</strong>",
            '<span class="muted">' +
                escapeHTML(formatDate(message.createdAt)) +
                "</span>",
            "<div>" +
                escapeHTML(message.text) +
                "</div>",
            "</div>"
        ].join("");
    });

    const content = [
        '<div class="box">',
        "<h1>🔒 Team-Chat</h1>",
        '<div class="box" style="padding:0;overflow:hidden">',
        html ||
            '<p class="muted" style="padding:15px">Noch keine Nachrichten.</p>',
        "</div>",
        '<form method="POST" action="/team-chat/send">',
        "<label>Nachricht</label>",
        '<textarea name="text" maxlength="2000" required></textarea>',
        '<button class="button">Senden</button>',
        "</form>",
        "</div>"
    ].join("");

    res.send(layout("Team-Chat", content, req.user));
});

app.post("/team-chat/send", requireManager, function(req, res) {
    const text = clean(req.body.text, 2000);

    if (!text) {
        return res.redirect("/team-chat");
    }

    const messages = db("messages");

    messages.push({
        id: id("msg"),
        type: "team",
        userId: req.user.id,
        name: req.user.name,
        text: text,
        createdAt: now()
    });

    writeJSON(
        FILES.messages,
        messages.slice(-5000)
    );

    addLog(
        "team_chat",
        req.user.email,
        "Team Chat Nachricht"
    );

    res.redirect("/team-chat");
});

/* ======================================================
   ADMIN PANEL
====================================================== */

app.get("/admin", requireAdmin, function(req, res) {
    const users = db("users");
    const tickets = db("tickets");
    const orders = db("orders");
    const giveaways = db("giveaways");
    const codes = db("codes");
    const products = db("products");
    const logs = db("logs");

    const settings = getSettings();

    const content = [
        "<h1>Adminpanel</h1>",
        '<div class="grid">',
        '<div class="box"><h3>👥 User</h3><div class="big">' +
            users.length +
            "</div></div>",
        '<div class="box"><h3>💰 Coins</h3><div class="big">' +
            users.reduce(function(sum, user) {
                return sum + Number(user.coins || 0);
            }, 0) +
            "</div></div>",
        '<div class="box"><h3>🎫 Tickets</h3><div class="big">' +
            tickets.filter(function(ticket) {
                return ticket.status !== "geschlossen";
            }).length +
            "</div></div>",
        '<div class="box"><h3>🛒 Bestellungen</h3><div class="big">' +
            orders.length +
            "</div></div>",
        '<div class="box"><h3>🎟️ Codes</h3><div class="big">' +
            codes.length +
            "</div></div>",
        '<div class="box"><h3>🛍️ Produkte</h3><div class="big">' +
            products.length +
            "</div></div>",
        '<div class="box"><h3>🎉 Gewinnspiele</h3><div class="big">' +
            giveaways.length +
            "</div></div>",
        '<div class="box"><h3>📋 Logs</h3><div class="big">' +
            logs.length +
            "</div></div>",
        "</div>",
        '<div class="grid" style="margin-top:20px">',
        '<div class="box"><h2>Verwaltung</h2>',
        '<div class="buttons">',
        '<a class="button secondary" href="/admin/users">User</a>',
        '<a class="button secondary" href="/admin/codes">Codes</a>',
        '<a class="button secondary" href="/admin/products">Shop</a>',
        '<a class="button secondary" href="/admin/giveaways">Gewinnspiele</a>',
        '<a class="button secondary" href="/admin/orders">Bestellungen</a>',
        '<a class="button secondary" href="/admin/tickets">Tickets</a>',
        '<a class="button secondary" href="/admin/logs">Logs</a>',
        '<a class="button secondary" href="/team-chat">Team-Chat</a>',
        "</div>",
        "</div>",
        '<div class="box"><h2>Status</h2>',
        "<p>Aktuell: <strong>" +
            escapeHTML(
                settings.maintenance
                    ? "Wartung"
                    : settings.incident
                        ? "Störung"
                        : "Normal"
            ) +
            "</strong></p>",
        '<a class="button secondary" href="/admin/settings">Status verwalten</a>',
        "</div>",
        "</div>"
    ].join("");

    res.send(layout("Adminpanel", content, req.user));
});

/* ======================================================
   ADMIN USERS
====================================================== */

app.get("/admin/users", requireAdmin, function(req, res) {
    const users = db("users");

    let rows = "";

    users.forEach(function(user) {
        rows += [
            "<tr>",
            "<td>" + escapeHTML(user.name) + "</td>",
            "<td>" + escapeHTML(user.email) + "</td>",
            "<td>" + escapeHTML(user.role) + "</td>",
            "<td>" + Number(user.coins || 0) + "</td>",
            "<td>" +
                (isBanned(user)
                    ? '<span class="tag banned">Gebannt</span>'
                    : '<span class="tag">Aktiv</span>') +
                "</td>",
            "<td>",
            '<a class="button secondary" href="/admin/users/' +
                user.id +
                '">Verwalten</a>',
            "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Userverwaltung</h1>",
        '<div class="box table-wrap">',
        "<table>",
        "<thead><tr>",
        "<th>Name</th>",
        "<th>E-Mail</th>",
        "<th>Rolle</th>",
        "<th>Coins</th>",
        "<th>Status</th>",
        "<th></th>",
        "</tr></thead>",
        "<tbody>",
        rows,
        "</tbody>",
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Userverwaltung", content, req.user));
});

app.get("/admin/users/:id", requireAdmin, function(req, res) {
    const user = findUserById(req.params.id);

    if (!user) {
        return res.redirect("/admin/users");
    }

    const content = [
        '<div class="box form">',
        "<h1>User verwalten</h1>",
        "<p><strong>" +
            escapeHTML(user.name) +
            "</strong></p>",
        "<p>" +
            escapeHTML(user.email) +
            "</p>",
        "<p>Coins: " +
            Number(user.coins || 0) +
            "</p>",
        "<p>Status: " +
            escapeHTML(formatBan(user)) +
            "</p>",

        "<h2>Coins</h2>",
        '<form method="POST" action="/admin/users/' +
            user.id +
            '/coins">',
        "<label>Betrag</label>",
        '<input type="number" name="amount" required>',
        "<label>Aktion</label>",
        "<select name=\"action\">",
        '<option value="add">Coins hinzufügen</option>',
        '<option value="remove">Coins abziehen</option>',
        "</select>",
        '<button class="button green">Speichern</button>',
        "</form>",

        "<h2>Rolle</h2>",
        '<form method="POST" action="/admin/users/' +
            user.id +
            '/role">',
        "<select name=\"role\">",
        '<option value="user">User</option>',
        '<option value="supporter">Supporter</option>',
        '<option value="moderator">Moderator</option>',
        '<option value="developer">Developer</option>',
        '<option value="manager">Manager</option>',
        '<option value="admin">Admin</option>',
        '<option value="owner">Owner</option>',
        "</select>",
        '<button class="button">Rolle setzen</button>',
        "</form>",

        "<h2>Ban</h2>",
        '<form method="POST" action="/admin/users/' +
            user.id +
            '/ban">',
        "<label>Dauer</label>",
        "<select name=\"duration\">",
        '<option value="1m">1 Minute</option>',
        '<option value="5m">5 Minuten</option>',
        '<option value="1h">1 Stunde</option>',
        '<option value="1d">1 Tag</option>',
        '<option value="7d">7 Tage</option>',
        '<option value="permanent">Dauerhaft</option>',
        "</select>",
        "<label>Grund</label>",
        '<input name="reason" maxlength="500" required>',
        '<button class="button danger">User bannnen</button>',
        "</form>",

        '<form method="POST" action="/admin/users/' +
            user.id +
            '/unban">',
        '<button class="button green">Entbannen</button>',
        "</form>",

        "</div>"
    ].join("");

    res.send(layout("User verwalten", content, req.user));
});

app.post("/admin/users/:id/coins", requireAdmin, function(req, res) {
    const amount = Number(req.body.amount || 0);
    const action = req.body.action;

    if (!Number.isFinite(amount) ||
        amount < 0 ||
        amount > 100000000) {

        return res.redirect("/admin/users/" + req.params.id);
    }

    const users = db("users");

    const index = users.findIndex(function(user) {
        return user.id === req.params.id;
    });

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    if (action === "add") {
        users[index].coins =
            Number(users[index].coins || 0) +
            amount;
    } else {
        users[index].coins =
            Math.max(
                0,
                Number(users[index].coins || 0) -
                amount
            );
    }

    writeJSON(FILES.users, users);

    addLog(
        "admin_coins",
        req.user.email,
        users[index].email +
        " / " +
        action +
        " / " +
        amount
    );

    res.redirect("/admin/users/" + req.params.id);
});

app.post("/admin/users/:id/role", requireAdmin, function(req, res) {
    const newRole = clean(req.body.role, 30);

    const allowed = [
        "user",
        "supporter",
        "moderator",
        "developer",
        "manager",
        "admin",
        "owner"
    ];

    if (!allowed.includes(newRole)) {
        return res.redirect("/admin/users/" + req.params.id);
    }

    const users = db("users");

    const index = users.findIndex(function(user) {
        return user.id === req.params.id;
    });

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    if (users[index].email === OWNER_EMAIL) {
        users[index].role = "owner";
    } else {
        users[index].role = newRole;
    }

    writeJSON(FILES.users, users);

    addLog(
        "role_change",
        req.user.email,
        users[index].email +
        " -> " +
        users[index].role
    );

    res.redirect("/admin/users/" + req.params.id);
});

function durationMilliseconds(duration) {
    const values = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000
    };

    return values[duration] || 0;
}

app.post("/admin/users/:id/ban", requireAdmin, function(req, res) {
    const users = db("users");

    const index = users.findIndex(function(user) {
        return user.id === req.params.id;
    });

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    if (users[index].email === OWNER_EMAIL) {
        return res.redirect("/admin/users/" + req.params.id);
    }

    const duration = clean(req.body.duration, 20);
    const reason = clean(req.body.reason, 500);

    users[index].banned = true;
    users[index].banReason = reason;

    if (duration === "permanent") {
        users[index].banUntil = null;
    } else {
        const ms = durationMilliseconds(duration);

        if (!ms) {
            return res.redirect("/admin/users/" + req.params.id);
        }

        users[index].banUntil =
            new Date(Date.now() + ms).toISOString();
    }

    writeJSON(FILES.users, users);

    addLog(
        "ban",
        req.user.email,
        users[index].email +
        " / " +
        reason +
        " / " +
        (users[index].banUntil || "permanent")
    );

    res.redirect("/admin/users/" + req.params.id);
});

app.post("/admin/users/:id/unban", requireAdmin, function(req, res) {
    const users = db("users");

    const index = users.findIndex(function(user) {
        return user.id === req.params.id;
    });

    if (index === -1) {
        return res.redirect("/admin/users");
    }

    users[index].banned = false;
    users[index].banUntil = null;
    users[index].banReason = "";

    writeJSON(FILES.users, users);

    addLog(
        "unban",
        req.user.email,
        users[index].email
    );

    res.redirect("/admin/users/" + req.params.id);
});

/* ======================================================
   ADMIN CODES
====================================================== */

app.get("/admin/codes", requireAdmin, function(req, res) {
    const codes = db("codes");

    let rows = "";

    codes.forEach(function(code) {
        const used =
            Array.isArray(code.usedBy)
                ? code.usedBy.length
                : 0;

        rows += [
            "<tr>",
            "<td><strong>" +
                escapeHTML(code.code) +
                "</strong></td>",
            "<td>" + Number(code.coins) + "</td>",
            "<td>" + used + "</td>",
            "<td>" +
                (code.active === false
                    ? "Deaktiviert"
                    : "Aktiv") +
                "</td>",
            "<td>",
            '<form method="POST" action="/admin/codes/' +
                code.id +
                '/delete">',
            '<button class="button danger">Löschen</button>',
            "</form>",
            "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Codes</h1>",
        '<div class="box form">',
        "<h2>Code erstellen</h2>",
        '<form method="POST" action="/admin/codes/create">',
        "<label>Coins</label>",
        '<input type="number" name="coins" min="1" max="100000000" required>',
        "<label>Maximale Nutzungen</label>",
        '<input type="number" name="maxUses" min="1" value="1" required>',
        '<button class="button green">Code erstellen</button>',
        "</form>",
        "</div>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Code</th><th>Coins</th><th>Benutzt</th><th>Status</th><th></th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Codes verwalten", content, req.user));
});

app.post("/admin/codes/create", requireAdmin, function(req, res) {
    const coins = Number(req.body.coins || 0);
    const maxUses = Number(req.body.maxUses || 1);

    if (coins <= 0 ||
        coins > 100000000 ||
        maxUses <= 0 ||
        maxUses > 100000) {

        return res.redirect("/admin/codes");
    }

    const codes = db("codes");

    const code = {
        id: id("code"),
        code: createRedeemCode(),
        coins: coins,
        maxUses: maxUses,
        usedBy: [],
        active: true,
        createdBy: req.user.email,
        createdAt: now()
    };

    codes.push(code);

    writeJSON(FILES.codes, codes);

    addLog(
        "code_create",
        req.user.email,
        code.code + " / " + coins + " Coins"
    );

    res.redirect("/admin/codes");
});

app.post("/admin/codes/:id/delete", requireAdmin, function(req, res) {
    const codes = db("codes");

    const filtered = codes.filter(function(code) {
        return code.id !== req.params.id;
    });

    writeJSON(FILES.codes, filtered);

    addLog(
        "code_delete",
        req.user.email,
        req.params.id
    );

    res.redirect("/admin/codes");
});

/* ======================================================
   ADMIN PRODUCTS
====================================================== */

app.get("/admin/products", requireAdmin, function(req, res) {
    const products = db("products");

    let rows = "";

    products.forEach(function(product) {
        rows += [
            "<tr>",
            "<td>" + escapeHTML(product.name) + "</td>",
            "<td>" + Number(product.price) + "</td>",
            "<td>" +
                (product.stock == null
                    ? "∞"
                    : Number(product.stock)) +
                "</td>",
            "<td>" +
                (product.active === false
                    ? "Aus"
                    : "Aktiv") +
                "</td>",
            "<td>",
            '<form method="POST" action="/admin/products/' +
                product.id +
                '/delete">',
            '<button class="button danger">Löschen</button>',
            "</form>",
            "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Shop verwalten</h1>",
        '<div class="box form">',
        "<h2>Produkt erstellen</h2>",
        '<form method="POST" action="/admin/products/create">',
        "<label>Name</label>",
        '<input name="name" required maxlength="100">',
        "<label>Beschreibung</label>",
        '<textarea name="description" maxlength="1000"></textarea>',
        "<label>Preis in Coins</label>",
        '<input type="number" name="price" min="0" required>',
        "<label>Bestand</label>",
        '<input type="number" name="stock" min="-1" value="-1">',
        "<small class=\"muted\">-1 = unbegrenzt</small>",
        '<button class="button green">Produkt erstellen</button>',
        "</form>",
        "</div>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Name</th><th>Preis</th><th>Bestand</th><th>Status</th><th></th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Shop verwalten", content, req.user));
});

app.post("/admin/products/create", requireAdmin, function(req, res) {
    const name = clean(req.body.name, 100);
    const description = clean(req.body.description, 1000);
    const price = Number(req.body.price || 0);
    const stockInput = Number(req.body.stock);

    if (!name ||
        price < 0 ||
        !Number.isFinite(price)) {

        return res.redirect("/admin/products");
    }

    const products = db("products");

    products.push({
        id: id("product"),
        name: name,
        description: description,
        price: price,
        stock: stockInput < 0
            ? null
            : stockInput,
        active: true,
        createdBy: req.user.email,
        createdAt: now()
    });

    writeJSON(FILES.products, products);

    addLog(
        "product_create",
        req.user.email,
        name
    );

    res.redirect("/admin/products");
});

app.post("/admin/products/:id/delete", requireAdmin, function(req, res) {
    const products = db("products");

    const filtered = products.filter(function(product) {
        return product.id !== req.params.id;
    });

    writeJSON(FILES.products, filtered);

    addLog(
        "product_delete",
        req.user.email,
        req.params.id
    );

    res.redirect("/admin/products");
});

/* ======================================================
   ADMIN GIVEAWAYS
====================================================== */

app.get("/admin/giveaways", requireAdmin, function(req, res) {
    const giveaways = db("giveaways");

    let rows = "";

    giveaways.forEach(function(giveaway) {
        rows += [
            "<tr>",
            "<td>" + escapeHTML(giveaway.title) + "</td>",
            "<td>" + Number(giveaway.coins) + "</td>",
            "<td>" +
                escapeHTML(formatDate(giveaway.endsAt)) +
                "</td>",
            "<td>" +
                (giveaway.winnerIds &&
                 giveaway.winnerIds.length
                    ? giveaway.winnerIds.length
                    : 0) +
                "</td>",
            "<td>",
            '<form method="POST" action="/admin/giveaways/' +
                giveaway.id +
                '/draw">',
            '<button class="button green">Gewinner ziehen</button>',
            "</form>",
            "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Gewinnspiele verwalten</h1>",
        '<div class="box form">',
        "<h2>Gewinnspiel erstellen</h2>",
        '<form method="POST" action="/admin/giveaways/create">',
        "<label>Titel</label>",
        '<input name="title" required maxlength="100">',
        "<label>Beschreibung</label>",
        '<textarea name="description" maxlength="1000"></textarea>',
        "<label>Coins pro Gewinner</label>",
        '<input type="number" name="coins" min="1" required>',
        "<label>Dauer in Minuten</label>",
        '<input type="number" name="minutes" min="1" value="60" required>',
        "<label>Anzahl Gewinner</label>",
        '<input type="number" name="winnerCount" min="1" value="1" required>',
        '<button class="button green">Gewinnspiel erstellen</button>',
        "</form>",
        "</div>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Titel</th><th>Gewinn</th><th>Ende</th><th>Gewinner</th><th></th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Gewinnspiele verwalten", content, req.user));
});

app.post("/admin/giveaways/create", requireAdmin, function(req, res) {
    const title = clean(req.body.title, 100);
    const description = clean(req.body.description, 1000);
    const coins = Number(req.body.coins || 0);
    const minutes = Number(req.body.minutes || 0);
    const winnerCount = Number(req.body.winnerCount || 1);

    if (!title ||
        coins <= 0 ||
        minutes <= 0 ||
        winnerCount <= 0) {

        return res.redirect("/admin/giveaways");
    }

    const giveaways = db("giveaways");

    const giveaway = {
        id: id("giveaway"),
        number: createGiveawayNumber(),
        title: title,
        description: description,
        coins: coins,
        winnerCount: winnerCount,
        participants: [],
        winnerIds: [],
        endsAt: new Date(
            Date.now() + minutes * 60 * 1000
        ).toISOString(),
        createdBy: req.user.email,
        createdAt: now()
    };

    giveaways.push(giveaway);

    writeJSON(FILES.giveaways, giveaways);

    addLog(
        "giveaway_create",
        req.user.email,
        giveaway.number
    );

    res.redirect("/admin/giveaways");
});

app.post("/admin/giveaways/:id/draw", requireAdmin, function(req, res) {
    const giveaways = db("giveaways");

    const giveaway = giveaways.find(function(item) {
        return item.id === req.params.id;
    });

    if (!giveaway) {
        return res.redirect("/admin/giveaways");
    }

    if (giveaway.winnerIds &&
        giveaway.winnerIds.length) {

        return res.redirect("/admin/giveaways");
    }

    const participants =
        Array.isArray(giveaway.participants)
            ? giveaway.participants.slice()
            : [];

    if (!participants.length) {
        giveaway.winnerIds = [];

        writeJSON(FILES.giveaways, giveaways);

        return res.redirect("/admin/giveaways");
    }

    const shuffled = participants.sort(function() {
        return Math.random() - 0.5;
    });

    const winnerIds = shuffled.slice(
        0,
        Math.min(
            Number(giveaway.winnerCount || 1),
            shuffled.length
        )
    );

    const users = db("users");

    winnerIds.forEach(function(winnerId) {
        const index = users.findIndex(function(user) {
            return user.id === winnerId;
        });

        if (index !== -1) {
            users[index].coins =
                Number(users[index].coins || 0) +
                Number(giveaway.coins || 0);
        }
    });

    giveaway.winnerIds = winnerIds;

    writeJSON(FILES.users, users);
    writeJSON(FILES.giveaways, giveaways);

    addLog(
        "giveaway_draw",
        req.user.email,
        giveaway.number
    );

    res.redirect("/admin/giveaways");
});

/* ======================================================
   ADMIN ORDERS
====================================================== */

app.get("/admin/orders", requireAdmin, function(req, res) {
    const orders = db("orders");

    let rows = "";

    orders.slice().reverse().forEach(function(order) {
        rows += [
            "<tr>",
            "<td>" +
                escapeHTML(order.orderNumber) +
                "</td>",
            "<td>" +
                escapeHTML(order.userEmail) +
                "</td>",
            "<td>" +
                escapeHTML(order.productName) +
                "</td>",
            "<td>" +
                Number(order.price) +
                "</td>",
            "<td>" +
                escapeHTML(order.status) +
                "</td>",
            "<td>" +
                escapeHTML(formatDate(order.createdAt)) +
                "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Bestellungen</h1>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Nummer</th><th>User</th><th>Produkt</th><th>Preis</th><th>Status</th><th>Datum</th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Bestellungen", content, req.user));
});

/* ======================================================
   ADMIN TICKETS
====================================================== */

app.get("/admin/tickets", requireAdmin, function(req, res) {
    const tickets = db("tickets");

    let rows = "";

    tickets.slice().reverse().forEach(function(ticket) {
        rows += [
            "<tr>",
            "<td>" +
                escapeHTML(ticket.number) +
                "</td>",
            "<td>" +
                escapeHTML(ticket.userEmail) +
                "</td>",
            "<td>" +
                escapeHTML(ticket.subject) +
                "</td>",
            "<td>" +
                escapeHTML(ticket.status) +
                "</td>",
            "<td>",
            '<a class="button secondary" href="/tickets/' +
                ticket.id +
                '">Öffnen</a>',
            "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>Ticketverwaltung</h1>",
        "<p class=\"muted\">Discord-Kategorie: " +
            TICKET_CATEGORY_ID +
            "</p>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Ticket</th><th>User</th><th>Betreff</th><th>Status</th><th></th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Tickets", content, req.user));
});

/* ======================================================
   ADMIN LOGS
====================================================== */

app.get("/admin/logs", requireAdmin, function(req, res) {
    const logs = db("logs");

    let rows = "";

    logs.slice(0, 500).forEach(function(log) {
        rows += [
            "<tr>",
            "<td>" +
                escapeHTML(formatDate(log.createdAt)) +
                "</td>",
            "<td><span class=\"tag\">" +
                escapeHTML(log.type) +
                "</span></td>",
            "<td>" +
                escapeHTML(log.actor) +
                "</td>",
            "<td>" +
                escapeHTML(log.details) +
                "</td>",
            "</tr>"
        ].join("");
    });

    const content = [
        "<h1>📋 Logs</h1>",
        '<div class="box table-wrap">',
        "<table>",
        "<tr><th>Zeit</th><th>Typ</th><th>Auslöser</th><th>Details</th></tr>",
        rows,
        "</table>",
        "</div>"
    ].join("");

    res.send(layout("Logs", content, req.user));
});

/* ======================================================
   ADMIN SETTINGS
====================================================== */

app.get("/admin/settings", requireAdmin, function(req, res) {
    const settings = getSettings();

    const content = [
        '<div class="box form">',
        "<h1>Webseiten-Status</h1>",
        '<form method="POST" action="/admin/settings">',
        "<label>Status</label>",
        "<select name=\"status\">",
        '<option value="normal"' +
            (!settings.maintenance &&
             !settings.incident
                ? " selected"
                : "") +
            ">Normal</option>",
        '<option value="maintenance"' +
            (settings.maintenance
                ? " selected"
                : "") +
            ">Wartung</option>",
        '<option value="incident"' +
            (settings.incident
                ? " selected"
                : "") +
            ">Störung</option>",
        "</select>",
        "<label>Status-Text</label>",
        '<textarea name="statusText" maxlength="500">' +
            escapeHTML(settings.statusText) +
            "</textarea>",
        "<label>Ankündigung</label>",
        '<textarea name="announcement" maxlength="3000">' +
            escapeHTML(settings.announcement) +
            "</textarea>",
        '<button class="button green">Speichern</button>',
        "</form>",
        "</div>",
        settings.announcement
            ? '<div class="box" style="margin-top:20px"><h2>Aktuelle Ankündigung</h2><p>' +
              escapeHTML(settings.announcement) +
              "</p></div>"
            : ""
    ].join("");

    res.send(layout("Webseiten-Status", content, req.user));
});

app.post("/admin/settings", requireAdmin, function(req, res) {
    const status = clean(req.body.status, 30);
    const statusText = clean(req.body.statusText, 500);
    const announcement = clean(req.body.announcement, 3000);

    const settings = getSettings();

    settings.maintenance =
        status === "maintenance";

    settings.incident =
        status === "incident";

    settings.status =
        status === "maintenance"
            ? "maintenance"
            : status === "incident"
                ? "incident"
                : "normal";

    settings.statusText = statusText;
    settings.announcement = announcement;

    saveSettings(settings);

    addLog(
        "settings_update",
        req.user.email,
        status
    );

    res.redirect("/admin/settings");
});

/* ======================================================
   ADMIN API / JSON
====================================================== */

app.get("/api/me", requireLogin, function(req, res) {
    res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        coins: Number(req.user.coins || 0),
        banned: isBanned(req.user)
    });
});

app.get("/api/settings", function(req, res) {
    const settings = getSettings();

    res.json({
        status: settings.status,
        maintenance: settings.maintenance,
        incident: settings.incident,
        statusText: settings.statusText,
        announcement: settings.announcement
    });
});

app.get("/api/tickets", requireLogin, function(req, res) {
    const tickets = db("tickets");

    const visible = tickets.filter(function(ticket) {
        return ticket.userId === req.user.id ||
            canTeam(req.user);
    });

    res.json(visible);
});

app.get("/api/logs", requireAdmin, function(req, res) {
    res.json(db("logs").slice(0, 500));
});

/* ======================================================
   404
====================================================== */

app.use(function(req, res) {
    const user = getUserFromRequest(req);

    res.status(404).send(
        layout(
            "404",
            [
                '<div class="box center">',
                "<h1>404</h1>",
                "<p>Diese Seite wurde nicht gefunden.</p>",
                '<a class="button" href="/">Zur Startseite</a>',
                "</div>"
            ].join(""),
            user
        )
    );
});

/* ======================================================
   ERROR HANDLER
====================================================== */

app.use(function(error, req, res, next) {
    console.error("Webseitenfehler:", error);

    const user = getUserFromRequest(req);

    res.status(500).send(
        layout(
            "Fehler",
            [
                '<div class="box center">',
                "<h1>Fehler</h1>",
                "<p>Bei der Verarbeitung ist ein Fehler aufgetreten.</p>",
                '<a class="button" href="/">Zur Startseite</a>',
                "</div>"
            ].join(""),
            user
        )
    );
});

/* ======================================================
   START
====================================================== */

ensureDatabase();

app.listen(PORT, HOST, function() {
    console.log("");
    console.log("======================================");
    console.log("       " + SITE_NAME + " Webseite");
    console.log("======================================");
    console.log("Server läuft auf Port: " + PORT);
    console.log("Discord: " + DISCORD_INVITE);
    console.log("Owner: " + OWNER_EMAIL);
    console.log("Ticket-Kategorie: " + TICKET_CATEGORY_ID);
    console.log("======================================");
});
