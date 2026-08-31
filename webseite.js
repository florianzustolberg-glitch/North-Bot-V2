const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

// ============================================================
// NORTH BOT KONFIGURATION
// ============================================================

const WEBSITE_NAME = "North Bot";

const DISCORD_INVITE =
    "https://discord.gg/NJEVq6Pk6x";

// Hier weitere Admin-E-Mails eintragen.
// Der Owner ist bereits automatisch Admin.
const ADMIN_EMAILS = [
    "florianzustolberg@gmail.com"
];

// ============================================================
// DATEIEN
// ============================================================

const USERS_FILE = path.join(
    __dirname,
    "users.json"
);

const TICKETS_FILE = path.join(
    __dirname,
    "tickets.json"
);

// ============================================================
// DATEIEN ERSTELLEN
// ============================================================

function ensureFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(
                defaultValue,
                null,
                2
            ),
            "utf8"
        );
    }
}

ensureFile(
    USERS_FILE,
    []
);

ensureFile(
    TICKETS_FILE,
    []
);

// ============================================================
// DATENBANK-FUNKTIONEN
// ============================================================

function getUsers() {
    try {
        const data =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        const users =
            JSON.parse(data);

        return Array.isArray(users)
            ? users
            : [];
    } catch (error) {
        console.error(
            "Fehler beim Lesen von users.json:",
            error
        );

        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        ),
        "utf8"
    );
}

function getTickets() {
    try {
        const data =
            fs.readFileSync(
                TICKETS_FILE,
                "utf8"
            );

        const tickets =
            JSON.parse(data);

        return Array.isArray(tickets)
            ? tickets
            : [];
    } catch (error) {
        console.error(
            "Fehler beim Lesen von tickets.json:",
            error
        );

        return [];
    }
}

function saveTickets(tickets) {
    fs.writeFileSync(
        TICKETS_FILE,
        JSON.stringify(
            tickets,
            null,
            2
        ),
        "utf8"
    );
}

// ============================================================
// PASSWORT
// ============================================================

function hashPassword(password) {
    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");

    const hash =
        crypto
            .scryptSync(
                password,
                salt,
                64
            )
            .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(
    password,
    stored
) {
    try {
        const parts =
            stored.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const originalHash = parts[1];

        const hash =
            crypto
                .scryptSync(
                    password,
                    salt,
                    64
                )
                .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(
                hash,
                "hex"
            ),
            Buffer.from(
                originalHash,
                "hex"
            )
        );
    } catch {
        return false;
    }
}

// ============================================================
// SICHERHEIT
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getCurrentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    const users =
        getUsers();

    return (
        users.find(
            user =>
                user.id ===
                req.session.userId
        ) || null
    );
}

function isAdmin(user) {
    if (!user) {
        return false;
    }

    return ADMIN_EMAILS.includes(
        user.email.toLowerCase()
    );
}

function requireLogin(
    req,
    res,
    next
) {
    const user =
        getCurrentUser(req);

    if (!user) {
        return res.redirect(
            "/login"
        );
    }

    next();
}

function requireAdmin(
    req,
    res,
    next
) {
    const user =
        getCurrentUser(req);

    if (!user) {
        return res.redirect(
            "/login"
        );
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            renderPage(
                req,
                "Kein Zugriff",
                `
                <section class="container">

                    <div class="card center">

                        <div class="error-icon">
                            403
                        </div>

                        <h1>
                            Kein Zugriff
                        </h1>

                        <p>
                            Du bist kein Administrator.
                        </p>

                        <a
                            class="btn"
                            href="/dashboard"
                        >
                            Zurück
                        </a>

                    </div>

                </section>
                `
            )
        );
    }

    next();
}

// ============================================================
// EXPRESS
// ============================================================

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.json()
);

app.use(
    session({
        secret:
            "north-bot-website-session-secret-2026",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            sameSite: "lax",

            secure: false,

            maxAge:
                7 *
                24 *
                60 *
                60 *
                1000
        }
    })
);

// ============================================================
// DESIGN
// ============================================================

function page(
    title,
    content,
    user
) {
    const admin =
        isAdmin(user);

    return `<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${escapeHTML(title)}
    | ${WEBSITE_NAME}
</title>

<style>

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;

    min-height: 100vh;

    color: #fff;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        radial-gradient(
            circle at top,
            #222 0%,
            #0b0b0b 45%,
            #030303 100%
        );
}

nav {
    position: fixed;

    top: 0;
    left: 0;

    width: 100%;

    height: 70px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding:
        0 5%;

    background:
        rgba(5, 5, 5, 0.90);

    border-bottom:
        1px solid
        rgba(255,255,255,.08);

    backdrop-filter:
        blur(15px);

    z-index: 1000;
}

.logo {
    color: #fff;

    font-weight: 900;

    font-size: 18px;

    letter-spacing: 4px;
}

.nav {
    display: flex;

    gap: 6px;

    align-items: center;
}

.nav a {
    color: #aaa;

    text-decoration: none;

    padding:
        9px 12px;

    border-radius: 8px;

    font-size: 13px;

    transition: .2s;
}

.nav a:hover {
    color: #fff;

    background:
        rgba(255,255,255,.08);
}

main {
    padding-top: 70px;

    min-height: 100vh;
}

.hero {
    min-height:
        calc(100vh - 70px);

    display: flex;

    flex-direction: column;

    justify-content: center;

    align-items: center;

    text-align: center;

    padding: 30px;
}

.small-title {
    color: #777;

    font-size: 12px;

    font-weight: bold;

    letter-spacing: 7px;

    margin-bottom: 20px;
}

.hero h1 {
    margin: 0;

    font-size:
        clamp(
            55px,
            10vw,
            115px
        );

    font-weight: 900;

    letter-spacing: 5px;
}

.hero p {
    max-width: 650px;

    color: #777;

    line-height: 1.8;

    margin:
        25px auto 0;
}

.buttons {
    display: flex;

    flex-wrap: wrap;

    justify-content: center;

    gap: 10px;

    margin-top: 30px;
}

.btn {
    display: inline-flex;

    justify-content: center;

    align-items: center;

    min-height: 44px;

    padding:
        0 18px;

    border-radius: 9px;

    color: #fff;

    background:
        rgba(255,255,255,.07);

    border:
        1px solid
        rgba(255,255,255,.12);

    text-decoration: none;

    font-size: 14px;

    font-weight: 700;

    cursor: pointer;

    transition: .2s;
}

.btn:hover {
    transform:
        translateY(-2px);

    background:
        rgba(255,255,255,.13);
}

.btn.primary {
    color: #000;

    background: #fff;

    border-color: #fff;
}

.btn.danger {
    background:
        rgba(255,50,50,.08);

    border-color:
        rgba(255,50,50,.2);
}

.container {
    width: 92%;

    max-width: 1100px;

    margin: auto;

    padding:
        50px 0;
}

.card {
    background:
        rgba(255,255,255,.035);

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius: 18px;

    padding: 30px;

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.25);

    backdrop-filter:
        blur(15px);
}

.center {
    max-width: 650px;

    margin:
        70px auto;

    text-align: center;
}

.card h1 {
    margin-top: 0;
}

.card p {
    color: #777;

    line-height: 1.7;
}

.form {
    display: grid;

    gap: 13px;

    margin-top: 25px;
}

input,
textarea,
select {
    width: 100%;

    padding: 14px;

    color: #fff;

    background:
        rgba(0,0,0,.45);

    border:
        1px solid
        rgba(255,255,255,.1);

    border-radius: 10px;

    outline: none;

    font-size: 14px;

    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

textarea {
    min-height: 150px;

    resize: vertical;
}

input:focus,
textarea:focus,
select:focus {
    border-color:
        rgba(255,255,255,.35);
}

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                210px,
                1fr
            )
        );

    gap: 15px;

    margin-top: 25px;
}

.stat {
    padding: 22px;

    border-radius: 13px;

    background:
        rgba(255,255,255,.025);

    border:
        1px solid
        rgba(255,255,255,.07);
}

.stat-title {
    display: block;

    color: #666;

    font-size: 10px;

    letter-spacing: 1px;

    margin-bottom: 8px;
}

.stat-value {
    font-weight: 800;

    font-size: 19px;
}

.ticket {
    margin-top: 15px;

    padding: 20px;

    border-radius: 13px;

    background:
        rgba(255,255,255,.025);

    border:
        1px solid
        rgba(255,255,255,.08);
}

.ticket-header {
    display: flex;

    justify-content: space-between;

    align-items: center;

    gap: 10px;

    flex-wrap: wrap;
}

.ticket-title {
    font-weight: 800;

    font-size: 17px;
}

.badge {
    display: inline-block;

    padding:
        6px 10px;

    border-radius: 20px;

    font-size: 11px;

    font-weight: bold;

    background:
        rgba(255,255,255,.08);
}

.badge.open {
    color: #baffc7;

    background:
        rgba(50,255,100,.08);
}

.badge.closed {
    color: #ffb0b0;

    background:
        rgba(255,50,50,.08);
}

.message {
    margin-top: 14px;

    padding: 15px;

    border-radius: 12px;

    background:
        rgba(0,0,0,.28);

    border:
        1px solid
        rgba(255,255,255,.06);
}

.message.admin {
    border-left:
        3px solid
        #fff;
}

.message-user {
    font-weight: 800;

    font-size: 13px;
}

.message-time {
    color: #555;

    font-size: 10px;

    margin-left: 8px;
}

.message-text {
    color: #bbb;

    white-space: pre-wrap;

    line-height: 1.6;

    margin-top: 8px;
}

.success {
    margin-top: 20px;

    padding: 14px;

    color: #baffc7;

    background:
        rgba(50,255,100,.08);

    border:
        1px solid
        rgba(50,255,100,.15);

    border-radius: 10px;
}

.error {
    margin-top: 20px;

    padding: 14px;

    color: #ffb0b0;

    background:
        rgba(255,50,50,.08);

    border:
        1px solid
        rgba(255,50,50,.15);

    border-radius: 10px;
}

.error-icon {
    font-size: 70px;

    font-weight: 900;

    margin-bottom: 15px;
}

.empty {
    padding: 45px 20px;

    text-align: center;

    color: #555;
}

footer {
    text-align: center;

    padding:
        30px;

    color: #444;

    font-size: 11px;
}

@media(max-width:700px) {

    nav {
        padding:
            0 12px;
    }

    .logo {
        font-size: 13px;

        letter-spacing: 2px;
    }

    .nav a {
        font-size: 10px;

        padding:
            7px 6px;
    }

    .hero h1 {
        font-size: 48px;
    }

    .card {
        padding: 22px;
    }

}

</style>

</head>

<body>

<nav>

    <div class="logo">
        NORTH BOT
    </div>

    <div class="nav">

        <a href="/">
            Start
        </a>

        <a href="/support">
            🎫 Support
        </a>

        ${
            user
                ? `
                    <a href="/dashboard">
                        Dashboard
                    </a>

                    ${
                        admin
                            ? `
                                <a href="/admin">
                                    👑 Admin
                                </a>
                            `
                            : ""
                    }

                    <a href="/logout">
                        Logout
                    </a>
                `
                : `
                    <a href="/login">
                        Login
                    </a>

                    <a href="/register">
                        Registrieren
                    </a>
                `
        }

    </div>

</nav>

<main>

${content}

</main>

<footer>

    © 2026 North Bot

</footer>

</body>

</html>`;
}

function renderPage(
    req,
    title,
    content
) {
    return page(
        title,
        content,
        getCurrentUser(req)
    );
}

// ============================================================
// STARTSEITE
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.send(
            renderPage(
                req,
                "Startseite",
                `
                <section class="hero">

                    <div class="small-title">
                        NORTH BOT
                    </div>

                    <h1>
                        NORTH BOT
                    </h1>

                    <p>
                        Willkommen auf der offiziellen
                        North-Bot-Webseite.
                    </p>

                    <div class="buttons">

                        <a
                            class="btn primary"
                            href="${DISCORD_INVITE}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            💬 Discord beitreten
                        </a>

                        <a
                            class="btn"
                            href="/support"
                        >
                            🎫 Support
                        </a>

                        <a
                            class="btn"
                            href="/register"
                        >
                            📝 Konto erstellen
                        </a>

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// REGISTRIERUNG
// ============================================================

app.get(
    "/register",
    (req, res) => {

        res.send(
            renderPage(
                req,
                "Registrieren",
                `
                <section class="container">

                    <div class="card center">

                        <h1>
                            📝 Registrieren
                        </h1>

                        <p>
                            Erstelle dein North-Bot-Konto.
                        </p>

                        <form
                            method="POST"
                            action="/register"
                            class="form"
                        >

                            <input
                                type="text"
                                name="username"
                                placeholder="Benutzername"
                                minlength="3"
                                maxlength="30"
                                required
                            >

                            <input
                                type="email"
                                name="email"
                                placeholder="E-Mail"
                                required
                            >

                            <input
                                type="password"
                                name="password"
                                placeholder="Passwort"
                                minlength="8"
                                required
                            >

                            <input
                                type="password"
                                name="password2"
                                placeholder="Passwort wiederholen"
                                minlength="8"
                                required
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                Konto erstellen
                            </button>

                        </form>

                    </div>

                </section>
                `
            )
        );

    }
);

app.post(
    "/register",
    (req, res) => {

        const username =
            String(
                req.body.username || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            )
            .trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const password2 =
            String(
                req.body.password2 || ""
            );

        if (
            username.length < 3 ||
            username.length > 30
        ) {

            return res.status(400).send(
                renderPage(
                    req,
                    "Fehler",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Ungültiger Benutzername
                            </h1>

                            <p>
                                Der Benutzername muss
                                3 bis 30 Zeichen lang sein.
                            </p>

                            <a
                                class="btn"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        if (password.length < 8) {

            return res.status(400).send(
                renderPage(
                    req,
                    "Fehler",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Passwort zu kurz
                            </h1>

                            <p>
                                Das Passwort muss mindestens
                                8 Zeichen lang sein.
                            </p>

                            <a
                                class="btn"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        if (password !== password2) {

            return res.status(400).send(
                renderPage(
                    req,
                    "Fehler",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Passwörter stimmen nicht überein
                            </h1>

                            <a
                                class="btn"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        const users =
            getUsers();

        if (
            users.some(
                user =>
                    user.email === email
            )
        ) {

            return res.status(409).send(
                renderPage(
                    req,
                    "Konto vorhanden",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ E-Mail bereits vorhanden
                            </h1>

                            <p>
                                Für diese E-Mail-Adresse
                                existiert bereits ein Konto.
                            </p>

                            <a
                                class="btn"
                                href="/login"
                            >
                                Zum Login
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        const user = {

            id:
                crypto.randomUUID(),

            username,

            email,

            password:
                hashPassword(
                    password
                ),

            createdAt:
                new Date().toISOString()

        };

        users.push(user);

        saveUsers(users);

        req.session.userId =
            user.id;

        res.redirect(
            "/dashboard"
        );

    }
);

// ============================================================
// LOGIN
// ============================================================

app.get(
    "/login",
    (req, res) => {

        res.send(
            renderPage(
                req,
                "Login",
                `
                <section class="container">

                    <div class="card center">

                        <h1>
                            🔐 Anmelden
                        </h1>

                        <p>
                            Melde dich bei North Bot an.
                        </p>

                        <form
                            method="POST"
                            action="/login"
                            class="form"
                        >

                            <input
                                type="email"
                                name="email"
                                placeholder="E-Mail"
                                required
                            >

                            <input
                                type="password"
                                name="password"
                                placeholder="Passwort"
                                required
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                Anmelden
                            </button>

                        </form>

                    </div>

                </section>
                `
            )
        );

    }
);

app.post(
    "/login",
    (req, res) => {

        const email =
            String(
                req.body.email || ""
            )
            .trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const users =
            getUsers();

        const user =
            users.find(
                item =>
                    item.email === email
            );

        if (
            !user ||
            !verifyPassword(
                password,
                user.password
            )
        ) {

            return res.status(401).send(
                renderPage(
                    req,
                    "Login Fehler",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Login fehlgeschlagen
                            </h1>

                            <p>
                                E-Mail oder Passwort ist falsch.
                            </p>

                            <a
                                class="btn"
                                href="/login"
                            >
                                Erneut versuchen
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        req.session.userId =
            user.id;

        res.redirect(
            "/dashboard"
        );

    }
);

// ============================================================
// LOGOUT
// ============================================================

app.get(
    "/logout",
    (req, res) => {

        req.session.destroy(
            () => {
                res.redirect(
                    "/"
                );
            }
        );

    }
);

// ============================================================
// DASHBOARD
// ============================================================

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const tickets =
            getTickets();

        const myTickets =
            tickets.filter(
                ticket =>
                    ticket.userId ===
                    user.id
            );

        res.send(
            renderPage(
                req,
                "Dashboard",
                `
                <section class="container">

                    <div class="card">

                        <h1>
                            👋 Willkommen,
                            ${escapeHTML(
                                user.username
                            )}
                        </h1>

                        <p>
                            Hier siehst du deine
                            persönlichen Tickets.
                        </p>

                        <div class="grid">

                            <div class="stat">

                                <span class="stat-title">
                                    BENUTZERNAME
                                </span>

                                <div class="stat-value">
                                    ${escapeHTML(
                                        user.username
                                    )}
                                </div>

                            </div>

                            <div class="stat">

                                <span class="stat-title">
                                    E-MAIL
                                </span>

                                <div class="stat-value">
                                    ${escapeHTML(
                                        user.email
                                    )}
                                </div>

                            </div>

                            <div class="stat">

                                <span class="stat-title">
                                    DEINE TICKETS
                                </span>

                                <div class="stat-value">
                                    ${myTickets.length}
                                </div>

                            </div>

                        </div>

                        <div class="buttons">

                            <a
                                class="btn primary"
                                href="/support"
                            >
                                🎫 Neues Ticket
                            </a>

                            ${
                                isAdmin(user)
                                    ? `
                                    <a
                                        class="btn"
                                        href="/admin"
                                    >
                                        👑 Admin Panel
                                    </a>
                                    `
                                    : ""
                            }

                        </div>

                    </div>

                    <br>

                    <div class="card">

                        <h2>
                            🎫 Meine Tickets
                        </h2>

                        ${
                            myTickets.length === 0
                                ? `
                                <div class="empty">
                                    Du hast noch keine Tickets.
                                </div>
                                `
                                : myTickets
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            new Date(
                                                b.createdAt
                                            ) -
                                            new Date(
                                                a.createdAt
                                            )
                                    )
                                    .map(
                                        ticket => `
                                        <div class="ticket">

                                            <div class="ticket-header">

                                                <div>

                                                    <div class="ticket-title">
                                                        ${escapeHTML(
                                                            ticket.subject
                                                        )}
                                                    </div>

                                                    <small>
                                                        ${escapeHTML(
                                                            ticket.id
                                                        )}
                                                    </small>

                                                </div>

                                                <span
                                                    class="badge ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "open"
                                                            : "closed"
                                                    }"
                                                >
                                                    ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "OFFEN"
                                                            : "GESCHLOSSEN"
                                                    }
                                                </span>

                                            </div>

                                            <div class="buttons">

                                                <a
                                                    class="btn"
                                                    href="/ticket/${encodeURIComponent(
                                                        ticket.id
                                                    )}"
                                                >
                                                    Ticket öffnen
                                                </a>

                                            </div>

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// SUPPORT START
// ============================================================

app.get(
    "/support",
    requireLogin,
    (req, res) => {

        res.send(
            renderPage(
                req,
                "Support",
                `
                <section class="container">

                    <div class="card center">

                        <h1>
                            🎫 Support
                        </h1>

                        <p>
                            Erstelle ein Ticket und
                            beschreibe dein Anliegen.
                        </p>

                        <form
                            method="POST"
                            action="/support"
                            class="form"
                        >

                            <input
                                type="text"
                                name="subject"
                                placeholder="Betreff"
                                maxlength="100"
                                required
                            >

                            <textarea
                                name="message"
                                placeholder="Beschreibe dein Anliegen..."
                                maxlength="5000"
                                required
                            ></textarea>

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                🎫 Ticket erstellen
                            </button>

                        </form>

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// TICKET ERSTELLEN
// ============================================================

app.post(
    "/support",
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const subject =
            String(
                req.body.subject || ""
            )
            .trim()
            .slice(
                0,
                100
            );

        const message =
            String(
                req.body.message || ""
            )
            .trim()
            .slice(
                0,
                5000
            );

        if (
            !subject ||
            !message
        ) {

            return res.status(400).send(
                renderPage(
                    req,
                    "Fehler",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Angaben fehlen
                            </h1>

                            <p>
                                Bitte Betreff und Nachricht
                                ausfüllen.
                            </p>

                            <a
                                class="btn"
                                href="/support"
                            >
                                Zurück
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        const tickets =
            getTickets();

        const ticket = {

            id:
                "TICKET-" +
                crypto
                    .randomBytes(4)
                    .toString("hex")
                    .toUpperCase(),

            userId:
                user.id,

            username:
                user.username,

            email:
                user.email,

            subject,

            status:
                "open",

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString(),

            messages: [

                {

                    id:
                        crypto.randomUUID(),

                    userId:
                        user.id,

                    username:
                        user.username,

                    authorType:
                        "user",

                    message,

                    createdAt:
                        new Date().toISOString()

                }

            ]

        };

        tickets.push(ticket);

        saveTickets(tickets);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// TICKET ANZEIGEN
// ============================================================

app.get(
    "/ticket/:id",
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const tickets =
            getTickets();

        const ticket =
            tickets.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!ticket) {

            return res.status(404).send(
                renderPage(
                    req,
                    "Ticket nicht gefunden",
                    `
                    <section class="container">

                        <div class="card center">

                            <h1>
                                ❌ Ticket nicht gefunden
                            </h1>

                            <a
                                class="btn"
                                href="/dashboard"
                            >
                                Dashboard
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        // ====================================================
        // WICHTIG:
        // NUR TICKET-ERSTELLER ODER ADMIN
        // ====================================================

        if (
            ticket.userId !== user.id &&
            !isAdmin(user)
        ) {

            return res.status(403).send(
                renderPage(
                    req,
                    "Kein Zugriff",
                    `
                    <section class="container">

                        <div class="card center">

                            <div class="error-icon">
                                🔒
                            </div>

                            <h1>
                                Kein Zugriff
                            </h1>

                            <p>
                                Dieses Ticket gehört
                                nicht dir.
                            </p>

                            <a
                                class="btn"
                                href="/dashboard"
                            >
                                Zurück
                            </a>

                        </div>

                    </section>
                    `
                )
            );

        }

        const messages =
            Array.isArray(
                ticket.messages
            )
                ? ticket.messages
                : [];

        res.send(
            renderPage(
                req,
                ticket.subject,
                `
                <section class="container">

                    <div class="card">

                        <div class="ticket-header">

                            <div>

                                <small>
                                    ${escapeHTML(
                                        ticket.id
                                    )}
                                </small>

                                <h1>
                                    ${escapeHTML(
                                        ticket.subject
                                    )}
                                </h1>

                            </div>

                            <span
                                class="badge ${
                                    ticket.status ===
                                    "open"
                                        ? "open"
                                        : "closed"
                                }"
                            >
                                ${
                                    ticket.status ===
                                    "open"
                                        ? "OFFEN"
                                        : "GESCHLOSSEN"
                                }
                            </span>

                        </div>

                        <p>
                            Erstellt von:
                            <strong>
                                ${escapeHTML(
                                    ticket.username
                                )}
                            </strong>
                        </p>

                    </div>

                    <br>

                    <div class="card">

                        <h2>
                            💬 Unterhaltung
                        </h2>

                        ${
                            messages.length === 0
                                ? `
                                <div class="empty">
                                    Noch keine Nachrichten.
                                </div>
                                `
                                : messages
                                    .map(
                                        msg => `
                                        <div class="message ${
                                            msg.authorType ===
                                            "admin"
                                                ? "admin"
                                                : ""
                                        }">

                                            <div class="message-user">

                                                ${
                                                    msg.authorType ===
                                                    "admin"
                                                        ? "👑 "
                                                        : "👤 "
                                                }

                                                ${escapeHTML(
                                                    msg.username
                                                )}

                                                ${
                                                    msg.authorType ===
                                                    "admin"
                                                        ? " – Team"
                                                        : ""
                                                }

                                                <span class="message-time">
                                                    ${new Date(
                                                        msg.createdAt
                                                    ).toLocaleString(
                                                        "de-DE"
                                                    )}
                                                </span>

                                            </div>

                                            <div class="message-text">
                                                ${escapeHTML(
                                                    msg.message
                                                )}
                                            </div>

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                        ${
                            ticket.status ===
                            "open"
                                ? `
                                <form
                                    method="POST"
                                    action="/ticket/${encodeURIComponent(
                                        ticket.id
                                    )}/reply"
                                    class="form"
                                >

                                    <textarea
                                        name="message"
                                        placeholder="Nachricht schreiben..."
                                        maxlength="5000"
                                        required
                                    ></textarea>

                                    <button
                                        class="btn primary"
                                        type="submit"
                                    >
                                        💬 Nachricht senden
                                    </button>

                                </form>
                                `
                                : `
                                <div class="error">
                                    🔒 Dieses Ticket wurde geschlossen.
                                </div>
                                `
                        }

                        <div class="buttons">

                            ${
                                isAdmin(user) &&
                                ticket.status ===
                                    "open"
                                    ? `
                                    <form
                                        method="POST"
                                        action="/admin/ticket/${encodeURIComponent(
                                            ticket.id
                                        )}/close"
                                    >

                                        <button
                                            class="btn danger"
                                            type="submit"
                                        >
                                            🔒 Ticket schließen
                                        </button>

                                    </form>
                                    `
                                    : ""
                            }

                            <a
                                class="btn"
                                href="${
                                    isAdmin(user)
                                        ? "/admin"
                                        : "/dashboard"
                                }"
                            >
                                Zurück
                            </a>

                        </div>

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// TICKET ANTWORT
// ============================================================

app.post(
    "/ticket/:id/reply",
    requireLogin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const tickets =
            getTickets();

        const ticket =
            tickets.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!ticket) {
            return res.status(404).send(
                "Ticket nicht gefunden."
            );
        }

        if (
            ticket.userId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        if (
            ticket.status !==
            "open"
        ) {
            return res.status(400).send(
                "Ticket ist geschlossen."
            );
        }

        const message =
            String(
                req.body.message || ""
            )
            .trim()
            .slice(
                0,
                5000
            );

        if (!message) {
            return res.redirect(
                `/ticket/${encodeURIComponent(
                    ticket.id
                )}`
            );
        }

        ticket.messages.push({

            id:
                crypto.randomUUID(),

            userId:
                user.id,

            username:
                user.username,

            authorType:
                isAdmin(user)
                    ? "admin"
                    : "user",

            message,

            createdAt:
                new Date().toISOString()

        });

        ticket.updatedAt =
            new Date().toISOString();

        saveTickets(tickets);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// ADMIN PANEL
// ============================================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        const user =
            getCurrentUser(req);

        const tickets =
            getTickets();

        const openTickets =
            tickets.filter(
                ticket =>
                    ticket.status ===
                    "open"
            );

        const closedTickets =
            tickets.filter(
                ticket =>
                    ticket.status ===
                    "closed"
            );

        res.send(
            renderPage(
                req,
                "Admin Panel",
                `
                <section class="container">

                    <div class="card">

                        <h1>
                            👑 Admin Panel
                        </h1>

                        <p>
                            Willkommen,
                            ${escapeHTML(
                                user.username
                            )}.
                        </p>

                        <div class="grid">

                            <div class="stat">

                                <span class="stat-title">
                                    ALLE TICKETS
                                </span>

                                <div class="stat-value">
                                    ${tickets.length}
                                </div>

                            </div>

                            <div class="stat">

                                <span class="stat-title">
                                    OFFENE TICKETS
                                </span>

                                <div class="stat-value">
                                    ${openTickets.length}
                                </div>

                            </div>

                            <div class="stat">

                                <span class="stat-title">
                                    GESCHLOSSEN
                                </span>

                                <div class="stat-value">
                                    ${closedTickets.length}
                                </div>

                            </div>

                            <div class="stat">

                                <span class="stat-title">
                                    ADMIN
                                </span>

                                <div class="stat-value">
                                    👑 ${escapeHTML(
                                        user.email
                                    )}
                                </div>

                            </div>

                        </div>

                    </div>

                    <br>

                    <div class="card">

                        <h2>
                            🎫 Alle Tickets
                        </h2>

                        ${
                            tickets.length === 0
                                ? `
                                <div class="empty">
                                    Es gibt noch keine Tickets.
                                </div>
                                `
                                : tickets
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            new Date(
                                                b.updatedAt
                                            ) -
                                            new Date(
                                                a.updatedAt
                                            )
                                    )
                                    .map(
                                        ticket => `
                                        <div class="ticket">

                                            <div class="ticket-header">

                                                <div>

                                                    <div class="ticket-title">
                                                        ${escapeHTML(
                                                            ticket.subject
                                                        )}
                                                    </div>

                                                    <small>
                                                        ${escapeHTML(
                                                            ticket.id
                                                        )}
                                                    </small>

                                                </div>

                                                <span
                                                    class="badge ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "open"
                                                            : "closed"
                                                    }"
                                                >
                                                    ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "OFFEN"
                                                            : "GESCHLOSSEN"
                                                    }
                                                </span>

                                            </div>

                                            <p>
                                                👤
                                                ${escapeHTML(
                                                    ticket.username
                                                )}
                                                ·
                                                ${escapeHTML(
                                                    ticket.email
                                                )}
                                            </p>

                                            <div class="buttons">

                                                <a
                                                    class="btn"
                                                    href="/ticket/${encodeURIComponent(
                                                        ticket.id
                                                    )}"
                                                >
                                                    🎫 Ticket öffnen
                                                </a>

                                                ${
                                                    ticket.status ===
                                                    "open"
                                                        ? `
                                                        <form
                                                            method="POST"
                                                            action="/admin/ticket/${encodeURIComponent(
                                                                ticket.id
                                                            )}/close"
                                                        >

                                                            <button
                                                                class="btn danger"
                                                                type="submit"
                                                            >
                                                                🔒 Schließen
                                                            </button>

                                                        </form>
                                                        `
                                                        : ""
                                                }

                                            </div>

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// ADMIN TICKET SCHLIESSEN
// ============================================================

app.post(
    "/admin/ticket/:id/close",
    requireAdmin,
    (req, res) => {

        const tickets =
            getTickets();

        const ticket =
            tickets.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!ticket) {
            return res.status(404).send(
                "Ticket nicht gefunden."
            );
        }

        ticket.status =
            "closed";

        ticket.updatedAt =
            new Date().toISOString();

        saveTickets(tickets);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// ADMIN TICKET WIEDER ÖFFNEN
// ============================================================

app.post(
    "/admin/ticket/:id/open",
    requireAdmin,
    (req, res) => {

        const tickets =
            getTickets();

        const ticket =
            tickets.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!ticket) {
            return res.status(404).send(
                "Ticket nicht gefunden."
            );
        }

        ticket.status =
            "open";

        ticket.updatedAt =
            new Date().toISOString();

        saveTickets(tickets);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status:
                "online",

            name:
                "North Bot",

            login:
                true,

            registration:
                true,

            tickets:
                true,

            admin:
                true

        });

    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).send(
            renderPage(
                req,
                "404",
                `
                <section class="container">

                    <div class="card center">

                        <div class="error-icon">
                            404
                        </div>

                        <h1>
                            Seite nicht gefunden
                        </h1>

                        <p>
                            Diese Seite existiert nicht.
                        </p>

                        <a
                            class="btn"
                            href="/"
                        >
                            🏠 Startseite
                        </a>

                    </div>

                </section>
                `
            )
        );

    }
);

// ============================================================
// SERVER
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "          NORTH BOT WEBSITE"
        );

        console.log(
            "======================================"
        );

        console.log(
            "🟢 Webseite online"
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            "🔐 Login: AKTIV"
        );

        console.log(
            "📝 Registrierung: AKTIV"
        );

        console.log(
            "🎫 Tickets: AKTIV"
        );

        console.log(
            "👑 Admin Panel: AKTIV"
        );

        console.log(
            `👑 Admin: ${ADMIN_EMAILS.join(", ")}`
        );

        console.log(
            "======================================"
        );

    }
);
