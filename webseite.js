const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const WEBSITE_NAME = "North Bot";
const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

// ============================================================
// ADMIN
// ============================================================

const ADMIN_EMAILS = [
    "florianzustolberg@gmail.com"
];

// ============================================================
// DATEIEN
// ============================================================

const FILES = {
    users: path.join(__dirname, "users.json"),
    tickets: path.join(__dirname, "tickets.json"),
    codes: path.join(__dirname, "codes.json"),
    chat: path.join(__dirname, "chat.json"),
    shop: path.join(__dirname, "shop.json"),
    roles: path.join(__dirname, "roles.json"),
    purchases: path.join(__dirname, "purchases.json")
};

// ============================================================
// DATEIEN AUTOMATISCH ERSTELLEN
// ============================================================

function ensureFile(file, value = []) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(value, null, 2),
            "utf8"
        );
    }
}

Object.values(FILES).forEach(file => {
    ensureFile(file);
});

// ============================================================
// JSON
// ============================================================

function readJSON(file) {
    try {
        const data = fs.readFileSync(file, "utf8");

        if (!data.trim()) {
            return [];
        }

        const parsed = JSON.parse(data);

        return Array.isArray(parsed)
            ? parsed
            : parsed;
    } catch (error) {
        console.error("JSON Fehler:", file, error.message);
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// ============================================================
// DATENBANK
// ============================================================

function users() {
    return readJSON(FILES.users);
}

function saveUsers(data) {
    writeJSON(FILES.users, data);
}

function tickets() {
    return readJSON(FILES.tickets);
}

function saveTickets(data) {
    writeJSON(FILES.tickets, data);
}

function codes() {
    return readJSON(FILES.codes);
}

function saveCodes(data) {
    writeJSON(FILES.codes, data);
}

function chat() {
    return readJSON(FILES.chat);
}

function saveChat(data) {
    writeJSON(FILES.chat, data);
}

function shop() {
    return readJSON(FILES.shop);
}

function saveShop(data) {
    writeJSON(FILES.shop, data);
}

function roles() {
    return readJSON(FILES.roles);
}

function saveRoles(data) {
    writeJSON(FILES.roles, data);
}

function purchases() {
    return readJSON(FILES.purchases);
}

function savePurchases(data) {
    writeJSON(FILES.purchases, data);
}

// ============================================================
// PASSWORT
// ============================================================

function hashPassword(password) {
    const salt = crypto
        .randomBytes(16)
        .toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    try {
        const parts = stored.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const originalHash = parts[1];

        const hash = crypto
            .scryptSync(password, salt, 64)
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(originalHash, "hex")
        );
    } catch {
        return false;
    }
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function id(prefix = "") {
    return (
        prefix +
        crypto
            .randomBytes(6)
            .toString("hex")
            .toUpperCase()
    );
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return users().find(
        user =>
            user.id ===
            req.session.userId
    ) || null;
}

function isAdmin(user) {
    if (!user) {
        return false;
    }

    return ADMIN_EMAILS.includes(
        String(user.email).toLowerCase()
    );
}

function isBanned(user) {
    return Boolean(
        user &&
        user.banned === true
    );
}

// ============================================================
// MIDDLEWARE
// ============================================================

function requireLogin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (isBanned(user)) {
        return res.redirect("/banned");
    }

    next();
}

function requireAdmin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    if (!isAdmin(user)) {
        return res.status(403).send(
            render(
                req,
                "Kein Zugriff",
                `
                <section class="container">
                    <div class="card center">
                        <div class="big">403</div>
                        <h1>Kein Zugriff</h1>
                        <p>Du bist kein Administrator.</p>
                        <a class="btn" href="/dashboard">
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

app.use(express.json());

app.use(
    session({
        secret:
            "north-bot-session-secret-change-this",

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
// CSS
// ============================================================

const CSS = `

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    color: #fff;
    background:
        radial-gradient(
            circle at top,
            #222 0%,
            #090909 48%,
            #020202 100%
        );
    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 70px;
    padding: 0 5%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 999;
    background: rgba(3,3,3,.92);
    border-bottom: 1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(15px);
}

.logo {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 4px;
}

.navlinks {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
}

.navlinks a {
    color: #aaa;
    text-decoration: none;
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 13px;
}

.navlinks a:hover {
    color: #fff;
    background: rgba(255,255,255,.08);
}

main {
    padding-top: 70px;
    min-height: calc(100vh - 120px);
}

.container {
    width: 92%;
    max-width: 1150px;
    margin: auto;
    padding: 45px 0;
}

.hero {
    min-height: calc(100vh - 70px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 30px;
}

.hero h1 {
    font-size: clamp(55px, 10vw, 110px);
    margin: 0;
    letter-spacing: 5px;
    font-weight: 900;
}

.hero p {
    max-width: 650px;
    color: #777;
    line-height: 1.8;
}

.card {
    background: rgba(255,255,255,.035);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 18px;
    padding: 28px;
    box-shadow: 0 20px 70px rgba(0,0,0,.25);
}

.center {
    max-width: 700px;
    margin: 60px auto;
    text-align: center;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit,minmax(210px,1fr));
    gap: 15px;
    margin-top: 20px;
}

.stat {
    padding: 20px;
    border-radius: 13px;
    background: rgba(255,255,255,.025);
    border: 1px solid rgba(255,255,255,.07);
}

.stat small {
    display: block;
    color: #666;
    margin-bottom: 8px;
}

.stat strong {
    font-size: 20px;
}

.form {
    display: grid;
    gap: 13px;
    margin-top: 20px;
}

input,
textarea,
select {
    width: 100%;
    padding: 14px;
    color: #fff;
    background: rgba(0,0,0,.5);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    outline: none;
    font: inherit;
}

textarea {
    min-height: 140px;
    resize: vertical;
}

input:focus,
textarea:focus,
select:focus {
    border-color: rgba(255,255,255,.4);
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 43px;
    padding: 0 17px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.06);
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    cursor: pointer;
}

.btn:hover {
    background: rgba(255,255,255,.13);
}

.btn.primary {
    background: #fff;
    color: #000;
    border-color: #fff;
}

.btn.danger {
    border-color: rgba(255,60,60,.3);
    background: rgba(255,60,60,.08);
}

.btn.success {
    border-color: rgba(70,255,120,.3);
    background: rgba(70,255,120,.08);
}

.buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 20px;
}

.ticket,
.shopitem,
.useritem,
.chatmessage,
.codeitem,
.roleitem {
    margin-top: 13px;
    padding: 18px;
    border-radius: 13px;
    background: rgba(255,255,255,.025);
    border: 1px solid rgba(255,255,255,.07);
}

.row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.muted {
    color: #666;
}

.badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 20px;
    background: rgba(255,255,255,.08);
    font-size: 11px;
    font-weight: 700;
}

.badge.open {
    color: #baffc7;
    background: rgba(50,255,100,.08);
}

.badge.closed {
    color: #ffb0b0;
    background: rgba(255,50,50,.08);
}

.big {
    font-size: 70px;
    font-weight: 900;
}

.coin {
    font-size: 22px;
    font-weight: 900;
}

.chatbox {
    max-height: 550px;
    overflow-y: auto;
}

.chatmessage strong {
    display: block;
}

.chatmessage p {
    white-space: pre-wrap;
    color: #bbb;
    line-height: 1.6;
}

.admin-message {
    border-left: 3px solid #fff;
}

footer {
    text-align: center;
    padding: 25px;
    color: #444;
    font-size: 11px;
}

@media(max-width:700px) {

    nav {
        padding: 0 10px;
    }

    .logo {
        font-size: 12px;
        letter-spacing: 2px;
    }

    .navlinks a {
        font-size: 10px;
        padding: 7px;
    }

    .hero h1 {
        font-size: 48px;
    }

}

`;

// ============================================================
// PAGE
// ============================================================

function render(req, title, content) {
    const user = getUser(req);
    const admin = isAdmin(user);

    return `<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${escapeHTML(title)} | North Bot
</title>

<style>
${CSS}
</style>

</head>

<body>

<nav>

    <div class="logo">
        NORTH BOT
    </div>

    <div class="navlinks">

        <a href="/">
            Start
        </a>

        ${
            user
                ? `
                <a href="/dashboard">
                    Dashboard
                </a>

                <a href="/support">
                    🎫 Support
                </a>

                <a href="/chat">
                    💬 Chat
                </a>

                <a href="/shop">
                    🛒 Shop
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
                    Registrierung
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

// ============================================================
// STARTSEITE
// ============================================================

app.get("/", (req, res) => {

    res.send(
        render(
            req,
            "Startseite",
            `
            <section class="hero">

                <h1>
                    NORTH BOT
                </h1>

                <p>
                    Die offizielle North-Bot-Webseite
                    mit Support, Community, Coins,
                    Shop und mehr.
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
                        href="/shop"
                    >
                        🛒 Coin-Shop
                    </a>

                </div>

            </section>
            `
        )
    );

});

// ============================================================
// REGISTER
// ============================================================

app.get("/register", (req, res) => {

    res.send(
        render(
            req,
            "Registrierung",
            `
            <section class="container">

                <div class="card center">

                    <h1>
                        📝 Registrierung
                    </h1>

                    <p class="muted">
                        Erstelle dein North-Bot-Konto.
                    </p>

                    <form
                        method="POST"
                        action="/register"
                        class="form"
                    >

                        <input
                            name="username"
                            placeholder="Benutzername"
                            minlength="3"
                            maxlength="30"
                            required
                        >

                        <input
                            name="email"
                            type="email"
                            placeholder="E-Mail"
                            required
                        >

                        <input
                            name="password"
                            type="password"
                            placeholder="Passwort"
                            minlength="8"
                            required
                        >

                        <input
                            name="password2"
                            type="password"
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

});

app.post("/register", (req, res) => {

    const username =
        String(req.body.username || "").trim();

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const password2 =
        String(req.body.password2 || "");

    if (
        username.length < 3 ||
        username.length > 30
    ) {
        return res.status(400).send(
            render(
                req,
                "Fehler",
                `
                <section class="container">
                    <div class="card center">
                        <h1>❌ Fehler</h1>
                        <p>
                            Der Benutzername muss
                            3 bis 30 Zeichen lang sein.
                        </p>
                        <a class="btn" href="/register">
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
            render(
                req,
                "Fehler",
                `
                <section class="container">
                    <div class="card center">
                        <h1>❌ Passwort zu kurz</h1>
                        <p>
                            Das Passwort muss mindestens
                            8 Zeichen lang sein.
                        </p>
                        <a class="btn" href="/register">
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
            render(
                req,
                "Fehler",
                `
                <section class="container">
                    <div class="card center">
                        <h1>❌ Passwörter falsch</h1>
                        <p>
                            Die Passwörter stimmen nicht überein.
                        </p>
                        <a class="btn" href="/register">
                            Zurück
                        </a>
                    </div>
                </section>
                `
            )
        );
    }

    const data = users();

    if (
        data.some(
            user =>
                user.email === email
        )
    ) {
        return res.status(409).send(
            render(
                req,
                "Konto vorhanden",
                `
                <section class="container">
                    <div class="card center">
                        <h1>❌ Konto vorhanden</h1>
                        <p>
                            Diese E-Mail-Adresse
                            ist bereits registriert.
                        </p>
                        <a class="btn" href="/login">
                            Zum Login
                        </a>
                    </div>
                </section>
                `
            )
        );
    }

    const newUser = {

        id: id("USER-"),

        username,

        email,

        password:
            hashPassword(password),

        coins: 0,

        roles: [],

        banned: false,

        banReason: "",

        createdAt:
            new Date().toISOString()

    };

    data.push(newUser);

    saveUsers(data);

    req.session.userId =
        newUser.id;

    res.redirect("/dashboard");

});

// ============================================================
// LOGIN
// ============================================================

app.get("/login", (req, res) => {

    res.send(
        render(
            req,
            "Login",
            `
            <section class="container">

                <div class="card center">

                    <h1>
                        🔐 Login
                    </h1>

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

});

app.post("/login", (req, res) => {

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const user =
        users().find(
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
            render(
                req,
                "Login Fehler",
                `
                <section class="container">
                    <div class="card center">
                        <h1>❌ Login fehlgeschlagen</h1>
                        <p>
                            E-Mail oder Passwort ist falsch.
                        </p>
                        <a class="btn" href="/login">
                            Erneut versuchen
                        </a>
                    </div>
                </section>
                `
            )
        );
    }

    if (isBanned(user)) {
        req.session.userId =
            user.id;

        return res.redirect(
            "/banned"
        );
    }

    req.session.userId =
        user.id;

    res.redirect(
        "/dashboard"
    );

});

// ============================================================
// LOGOUT
// ============================================================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/");
    });

});

// ============================================================
// BAN SEITE
// ============================================================

app.get("/banned", (req, res) => {

    const user = getUser(req);

    if (!user || !user.banned) {
        return res.redirect("/");
    }

    res.send(
        render(
            req,
            "Gebannt",
            `
            <section class="container">

                <div class="card center">

                    <div class="big">
                        🔨
                    </div>

                    <h1>
                        Du wurdest gebannt
                    </h1>

                    <p>
                        Du hast keinen Zugriff
                        mehr auf die Webseite.
                    </p>

                    <p>
                        <strong>Grund:</strong>
                        ${escapeHTML(
                            user.banReason ||
                            "Kein Grund angegeben"
                        )}
                    </p>

                    <div class="buttons">

                        <a
                            class="btn primary"
                            href="${DISCORD_INVITE}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            💬 Auf Discord
                        </a>

                    </div>

                    <p class="muted">
                        Gehe auf unseren Discord,
                        um eine Entbannung zu beantragen.
                    </p>

                </div>

            </section>
            `
        )
    );

});

// ============================================================
// DASHBOARD
// ============================================================

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const myTickets =
            tickets().filter(
                ticket =>
                    ticket.userId ===
                    user.id
            );

        const myPurchases =
            purchases().filter(
                purchase =>
                    purchase.userId ===
                    user.id
            );

        res.send(
            render(
                req,
                "Dashboard",
                `
                <section class="container">

                    <div class="card">

                        <h1>
                            👋 Hallo
                            ${escapeHTML(
                                user.username
                            )}
                        </h1>

                        <div class="grid">

                            <div class="stat">
                                <small>
                                    COINS
                                </small>
                                <strong class="coin">
                                    🪙
                                    ${Number(
                                        user.coins || 0
                                    ).toLocaleString("de-DE")}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    TICKETS
                                </small>
                                <strong>
                                    ${myTickets.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    KÄUFE
                                </small>
                                <strong>
                                    ${myPurchases.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    ROLLE
                                </small>
                                <strong>
                                    ${
                                        isAdmin(user)
                                            ? "👑 Admin"
                                            : "👤 User"
                                    }
                                </strong>
                            </div>

                        </div>

                        <div class="buttons">

                            <a
                                class="btn primary"
                                href="/support"
                            >
                                🎫 Ticket erstellen
                            </a>

                            <a
                                class="btn"
                                href="/redeem"
                            >
                                🎟️ Code einlösen
                            </a>

                            <a
                                class="btn"
                                href="/shop"
                            >
                                🛒 Coin-Shop
                            </a>

                            <a
                                class="btn"
                                href="/chat"
                            >
                                💬 Chat
                            </a>

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
                                <p class="muted">
                                    Du hast noch keine Tickets.
                                </p>
                                `
                                : myTickets
                                    .map(
                                        ticket => `
                                        <div class="ticket">

                                            <div class="row">

                                                <strong>
                                                    ${escapeHTML(
                                                        ticket.subject
                                                    )}
                                                </strong>

                                                <span class="badge ${
                                                    ticket.status ===
                                                    "open"
                                                        ? "open"
                                                        : "closed"
                                                }">
                                                    ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "OFFEN"
                                                            : "GESCHLOSSEN"
                                                    }
                                                </span>

                                            </div>

                                            <p class="muted">
                                                ${escapeHTML(
                                                    ticket.id
                                                )}
                                            </p>

                                            <a
                                                class="btn"
                                                href="/ticket/${encodeURIComponent(
                                                    ticket.id
                                                )}"
                                            >
                                                Ticket öffnen
                                            </a>

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
// SUPPORT
// ============================================================

app.get(
    "/support",
    requireLogin,
    (req, res) => {

        res.send(
            render(
                req,
                "Support",
                `
                <section class="container">

                    <div class="card center">

                        <h1>
                            🎫 Support
                        </h1>

                        <p class="muted">
                            Erstelle ein Ticket.
                        </p>

                        <form
                            method="POST"
                            action="/support"
                            class="form"
                        >

                            <input
                                name="subject"
                                placeholder="Betreff"
                                maxlength="100"
                                required
                            >

                            <textarea
                                name="message"
                                placeholder="Deine Nachricht..."
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

app.post(
    "/support",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const subject =
            String(
                req.body.subject || ""
            )
            .trim()
            .slice(0, 100);

        const message =
            String(
                req.body.message || ""
            )
            .trim()
            .slice(0, 5000);

        if (!subject || !message) {
            return res.redirect("/support");
        }

        const data =
            tickets();

        const ticket = {

            id:
                id("TICKET-"),

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
                        id("MSG-"),

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

        data.push(ticket);

        saveTickets(data);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// TICKET
// ============================================================

app.get(
    "/ticket/:id",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const ticket =
            tickets().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!ticket) {
            return res.status(404).send(
                "Ticket nicht gefunden."
            );
        }

        // NUR ERSTELLER ODER ADMIN
        if (
            ticket.userId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).send(
                render(
                    req,
                    "Kein Zugriff",
                    `
                    <section class="container">

                        <div class="card center">

                            <div class="big">
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

        res.send(
            render(
                req,
                ticket.subject,
                `
                <section class="container">

                    <div class="card">

                        <div class="row">

                            <div>

                                <small class="muted">
                                    ${escapeHTML(
                                        ticket.id
                                    )}
                                </small>

                                <h1>
                                    ${escapeHTML(
                                        ticket.subject
                                    )}
                                </h1>

                                <p class="muted">
                                    Erstellt von
                                    ${escapeHTML(
                                        ticket.username
                                    )}
                                </p>

                            </div>

                            <span class="badge ${
                                ticket.status ===
                                "open"
                                    ? "open"
                                    : "closed"
                            }">
                                ${
                                    ticket.status ===
                                    "open"
                                        ? "OFFEN"
                                        : "GESCHLOSSEN"
                                }
                            </span>

                        </div>

                    </div>

                    <br>

                    <div class="card">

                        <h2>
                            💬 Nachrichten
                        </h2>

                        ${
                            (ticket.messages || [])
                                .map(
                                    message => `
                                    <div class="chatmessage ${
                                        message.authorType ===
                                        "admin"
                                            ? "admin-message"
                                            : ""
                                    }">

                                        <strong>
                                            ${
                                                message.authorType ===
                                                "admin"
                                                    ? "👑 "
                                                    : "👤 "
                                            }

                                            ${escapeHTML(
                                                message.username
                                            )}
                                        </strong>

                                        <small class="muted">
                                            ${new Date(
                                                message.createdAt
                                            ).toLocaleString(
                                                "de-DE"
                                            )}
                                        </small>

                                        <p>
                                            ${escapeHTML(
                                                message.message
                                            )}
                                        </p>

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
                                    class="form"
                                    method="POST"
                                    action="/ticket/${encodeURIComponent(
                                        ticket.id
                                    )}/reply"
                                >

                                    <textarea
                                        name="message"
                                        placeholder="Nachricht..."
                                        maxlength="5000"
                                        required
                                    ></textarea>

                                    <button
                                        class="btn primary"
                                        type="submit"
                                    >
                                        💬 Senden
                                    </button>

                                </form>
                                `
                                : `
                                <div class="ticket">
                                    🔒 Dieses Ticket ist geschlossen.
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
                                            🔒 Schließen
                                        </button>

                                    </form>
                                    `
                                    : ""
                            }

                            ${
                                isAdmin(user) &&
                                ticket.status ===
                                    "closed"
                                    ? `
                                    <form
                                        method="POST"
                                        action="/admin/ticket/${encodeURIComponent(
                                            ticket.id
                                        )}/open"
                                    >

                                        <button
                                            class="btn success"
                                            type="submit"
                                        >
                                            🔓 Wieder öffnen
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
            getUser(req);

        const data =
            tickets();

        const ticket =
            data.find(
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
                "Ticket geschlossen."
            );
        }

        const message =
            String(
                req.body.message || ""
            )
            .trim()
            .slice(0, 5000);

        if (!message) {
            return res.redirect(
                `/ticket/${encodeURIComponent(
                    ticket.id
                )}`
            );
        }

        ticket.messages.push({

            id:
                id("MSG-"),

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

        saveTickets(data);

        res.redirect(
            `/ticket/${encodeURIComponent(
                ticket.id
            )}`
        );

    }
);

// ============================================================
// CHAT
// ============================================================

app.get(
    "/chat",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const messages =
            chat().slice(-100);

        res.send(
            render(
                req,
                "Chat",
                `
                <section class="container">

                    <div class="card">

                        <h1>
                            💬 Community Chat
                        </h1>

                        <p class="muted">
                            Schreibe mit anderen
                            registrierten Benutzern.
                        </p>

                        <div class="chatbox">

                            ${
                                messages.length === 0
                                    ? `
                                    <p class="muted">
                                        Noch keine Nachrichten.
                                    </p>
                                    `
                                    : messages
                                        .map(
                                            message => `
                                            <div class="chatmessage ${
                                                message.authorType ===
                                                "admin"
                                                    ? "admin-message"
                                                    : ""
                                            }">

                                                <strong>
                                                    ${
                                                        message.authorType ===
                                                        "admin"
                                                            ? "👑 "
                                                            : "👤 "
                                                    }

                                                    ${escapeHTML(
                                                        message.username
                                                    )}
                                                </strong>

                                                <small class="muted">
                                                    ${new Date(
                                                        message.createdAt
                                                    ).toLocaleString(
                                                        "de-DE"
                                                    )}
                                                </small>

                                                <p>
                                                    ${escapeHTML(
                                                        message.message
                                                    )}
                                                </p>

                                            </div>
                                            `
                                        )
                                        .join("")
                            }

                        </div>

                        <form
                            method="POST"
                            action="/chat"
                            class="form"
                        >

                            <textarea
                                name="message"
                                maxlength="1000"
                                placeholder="Nachricht schreiben..."
                                required
                            ></textarea>

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                💬 Senden
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
    "/chat",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const message =
            String(
                req.body.message || ""
            )
            .trim()
            .slice(0, 1000);

        if (!message) {
            return res.redirect("/chat");
        }

        const data =
            chat();

        data.push({

            id:
                id("CHAT-"),

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

        while (data.length > 500) {
            data.shift();
        }

        saveChat(data);

        res.redirect("/chat");

    }
);

// ============================================================
// CODE EINLÖSEN
// ============================================================

app.get(
    "/redeem",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        res.send(
            render(
                req,
                "Code einlösen",
                `
                <section class="container">

                    <div class="card center">

                        <h1>
                            🎟️ Coin-Code
                        </h1>

                        <p>
                            Dein Guthaben:
                            <strong>
                                🪙
                                ${Number(
                                    user.coins || 0
                                ).toLocaleString("de-DE")}
                            </strong>
                        </p>

                        <form
                            method="POST"
                            action="/redeem"
                            class="form"
                        >

                            <input
                                name="code"
                                placeholder="NORTH-XXXX"
                                required
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                🎁 Einlösen
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
    "/redeem",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const entered =
            String(
                req.body.code || ""
            )
            .trim()
            .toUpperCase();

        const data =
            codes();

        const code =
            data.find(
                item =>
                    item.code.toUpperCase() ===
                    entered
            );

        if (!code) {
            return res.status(404).send(
                render(
                    req,
                    "Code Fehler",
                    `
                    <section class="container">
                        <div class="card center">
                            <h1>❌ Code ungültig</h1>
                            <p>
                                Dieser Code existiert nicht.
                            </p>
                            <a class="btn" href="/redeem">
                                Zurück
                            </a>
                        </div>
                    </section>
                    `
                )
            );
        }

        if (code.active === false) {
            return res.status(400).send(
                render(
                    req,
                    "Code deaktiviert",
                    `
                    <section class="container">
                        <div class="card center">
                            <h1>❌ Code deaktiviert</h1>
                            <a class="btn" href="/redeem">
                                Zurück
                            </a>
                        </div>
                    </section>
                    `
                )
            );
        }

        if (
            code.expiresAt &&
            new Date(code.expiresAt) <
                new Date()
        ) {
            return res.status(400).send(
                render(
                    req,
                    "Code abgelaufen",
                    `
                    <section class="container">
                        <div class="card center">
                            <h1>❌ Code abgelaufen</h1>
                            <a class="btn" href="/redeem">
                                Zurück
                            </a>
                        </div>
                    </section>
                    `
                )
            );
        }

        if (
            Array.isArray(code.usedBy) &&
            code.usedBy.includes(user.id)
        ) {
            return res.status(400).send(
                render(
                    req,
                    "Bereits eingelöst",
                    `
                    <section class="container">
                        <div class="card center">
                            <h1>
                                ❌ Bereits eingelöst
                            </h1>
                            <p>
                                Du hast diesen Code bereits
                                verwendet.
                            </p>
                            <a class="btn" href="/dashboard">
                                Dashboard
                            </a>
                        </div>
                    </section>
                    `
                )
            );
        }

        if (!Array.isArray(code.usedBy)) {
            code.usedBy = [];
        }

        const userData =
            users();

        const index =
            userData.findIndex(
                item =>
                    item.id ===
                    user.id
            );

        if (index === -1) {
            return res.status(404).send(
                "Benutzer nicht gefunden."
            );
        }

        const amount =
            Math.max(
                0,
                Number(code.coins || 0)
            );

        userData[index].coins =
            Number(
                userData[index].coins || 0
            ) + amount;

        code.usedBy.push(
            user.id
        );

        saveUsers(userData);

        saveCodes(data);

        res.send(
            render(
                req,
                "Code eingelöst",
                `
                <section class="container">

                    <div class="card center">

                        <div class="big">
                            🪙
                        </div>

                        <h1>
                            Code eingelöst!
                        </h1>

                        <p>
                            Du hast
                            <strong>
                                ${amount.toLocaleString(
                                    "de-DE"
                                )}
                                Coins
                            </strong>
                            erhalten.
                        </p>

                        <a
                            class="btn primary"
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
);

// ============================================================
// SHOP
// ============================================================

app.get(
    "/shop",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const items =
            shop().filter(
                item =>
                    item.active !== false
            );

        res.send(
            render(
                req,
                "Coin-Shop",
                `
                <section class="container">

                    <div class="card">

                        <div class="row">

                            <div>
                                <h1>
                                    🛒 Coin-Shop
                                </h1>

                                <p class="muted">
                                    Kaufe Belohnungen
                                    mit deinen Coins.
                                </p>
                            </div>

                            <div class="coin">
                                🪙
                                ${Number(
                                    user.coins || 0
                                ).toLocaleString("de-DE")}
                            </div>

                        </div>

                    </div>

                    <div class="grid">

                        ${
                            items.length === 0
                                ? `
                                <div class="card">
                                    <p class="muted">
                                        Der Shop ist noch leer.
                                    </p>
                                </div>
                                `
                                : items
                                    .map(
                                        item => `
                                        <div class="shopitem">

                                            <h2>
                                                ${escapeHTML(
                                                    item.name
                                                )}
                                            </h2>

                                            <p class="muted">
                                                ${escapeHTML(
                                                    item.description
                                                )}
                                            </p>

                                            <p>
                                                Preis:
                                                <strong>
                                                    🪙
                                                    ${Number(
                                                        item.price || 0
                                                    ).toLocaleString(
                                                        "de-DE"
                                                    )}
                                                </strong>
                                            </p>

                                            ${
                                                item.stock ===
                                                    null ||
                                                item.stock ===
                                                    undefined
                                                    ? ""
                                                    : `
                                                    <p class="muted">
                                                        Bestand:
                                                        ${item.stock}
                                                    </p>
                                                    `
                                            }

                                            <form
                                                method="POST"
                                                action="/shop/${encodeURIComponent(
                                                    item.id
                                                )}/buy"
                                            >

                                                <button
                                                    class="btn primary"
                                                    type="submit"
                                                >
                                                    🛒 Kaufen
                                                </button>

                                            </form>

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
// SHOP KAUFEN
// ============================================================

app.post(
    "/shop/:id/buy",
    requireLogin,
    (req, res) => {

        const user =
            getUser(req);

        const items =
            shop();

        const item =
            items.find(
                product =>
                    product.id ===
                    req.params.id
            );

        if (!item) {
            return res.status(404).send(
                "Artikel nicht gefunden."
            );
        }

        if (
            item.active === false
        ) {
            return res.status(400).send(
                "Artikel ist nicht verfügbar."
            );
        }

        if (
            item.stock !== null &&
            item.stock !== undefined &&
            Number(item.stock) <= 0
        ) {
            return res.status(400).send(
                "Artikel ausverkauft."
            );
        }

        const price =
            Math.max(
                0,
                Number(item.price || 0)
            );

        const userData =
            users();

        const index =
            userData.findIndex(
                item =>
                    item.id ===
                    user.id
            );

        if (
            Number(
                userData[index].coins || 0
            ) < price
        ) {
            return res.status(400).send(
                render(
                    req,
                    "Nicht genug Coins",
                    `
                    <section class="container">
                        <div class="card center">
                            <h1>❌ Nicht genug Coins</h1>
                            <p>
                                Du brauchst
                                ${price.toLocaleString("de-DE")}
                                Coins.
                            </p>
                            <a class="btn" href="/shop">
                                Zurück zum Shop
                            </a>
                        </div>
                    </section>
                    `
                )
            );
        }

        userData[index].coins -=
            price;

        if (
            item.stock !== null &&
            item.stock !== undefined
        ) {
            item.stock =
                Number(item.stock) - 1;
        }

        const purchaseData =
            purchases();

        purchaseData.push({

            id:
                id("PURCHASE-"),

            userId:
                user.id,

            username:
                user.username,

            itemId:
                item.id,

            itemName:
                item.name,

            price,

            createdAt:
                new Date().toISOString()

        });

        saveUsers(userData);

        saveShop(items);

        savePurchases(
            purchaseData
        );

        res.redirect(
            "/dashboard"
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

        const allUsers =
            users();

        const allTickets =
            tickets();

        const allCodes =
            codes();

        const allShop =
            shop();

        const allRoles =
            roles();

        res.send(
            render(
                req,
                "Admin Panel",
                `
                <section class="container">

                    <div class="card">

                        <h1>
                            👑 Admin Panel
                        </h1>

                        <p class="muted">
                            North Bot Verwaltung
                        </p>

                        <div class="grid">

                            <div class="stat">
                                <small>
                                    BENUTZER
                                </small>
                                <strong>
                                    ${allUsers.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    TICKETS
                                </small>
                                <strong>
                                    ${allTickets.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    CODES
                                </small>
                                <strong>
                                    ${allCodes.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    SHOP
                                </small>
                                <strong>
                                    ${allShop.length}
                                </strong>
                            </div>

                            <div class="stat">
                                <small>
                                    ROLLEN
                                </small>
                                <strong>
                                    ${allRoles.length}
                                </strong>
                            </div>

                        </div>

                    </div>

                    <br>

                    <!-- COIN CODE -->

                    <div class="card">

                        <h2>
                            🎟️ Coin-Code erstellen
                        </h2>

                        <form
                            method="POST"
                            action="/admin/code/create"
                            class="form"
                        >

                            <input
                                name="code"
                                placeholder="Code z.B. NORTH-1000"
                                maxlength="50"
                                required
                            >

                            <input
                                name="coins"
                                type="number"
                                min="1"
                                placeholder="Coins"
                                required
                            >

                            <input
                                name="expiresAt"
                                type="datetime-local"
                                placeholder="Ablaufdatum"
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                🎟️ Code erstellen
                            </button>

                        </form>

                    </div>

                    <br>

                    <!-- SHOP -->

                    <div class="card">

                        <h2>
                            🛒 Shop-Artikel erstellen
                        </h2>

                        <form
                            method="POST"
                            action="/admin/shop/create"
                            class="form"
                        >

                            <input
                                name="name"
                                placeholder="Artikelname"
                                maxlength="100"
                                required
                            >

                            <textarea
                                name="description"
                                placeholder="Beschreibung"
                                maxlength="1000"
                                required
                            ></textarea>

                            <input
                                name="price"
                                type="number"
                                min="0"
                                placeholder="Preis in Coins"
                                required
                            >

                            <input
                                name="stock"
                                type="number"
                                min="-1"
                                placeholder="Bestand (-1 = unbegrenzt)"
                                value="-1"
                                required
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                🛒 Artikel erstellen
                            </button>

                        </form>

                    </div>

                    <br>

                    <!-- ROLLE -->

                    <div class="card">

                        <h2>
                            🏷️ Rolle erstellen
                        </h2>

                        <form
                            method="POST"
                            action="/admin/role/create"
                            class="form"
                        >

                            <input
                                name="name"
                                placeholder="Rollenname"
                                maxlength="50"
                                required
                            >

                            <button
                                class="btn primary"
                                type="submit"
                            >
                                🏷️ Rolle erstellen
                            </button>

                        </form>

                    </div>

                    <br>

                    <!-- BENUTZER -->

                    <div class="card">

                        <h2>
                            👥 Registrierte Benutzer
                        </h2>

                        ${
                            allUsers.length === 0
                                ? `
                                <p class="muted">
                                    Keine Benutzer.
                                </p>
                                `
                                : allUsers
                                    .map(
                                        user => `
                                        <div class="useritem">

                                            <div class="row">

                                                <div>

                                                    <strong>
                                                        ${escapeHTML(
                                                            user.username
                                                        )}
                                                    </strong>

                                                    <br>

                                                    <small class="muted">
                                                        ${escapeHTML(
                                                            user.email
                                                        )}
                                                    </small>

                                                    <br>

                                                    <small class="muted">
                                                        🪙
                                                        ${Number(
                                                            user.coins || 0
                                                        ).toLocaleString(
                                                            "de-DE"
                                                        )}
                                                    </small>

                                                </div>

                                                <span class="badge ${
                                                    user.banned
                                                        ? "closed"
                                                        : "open"
                                                }">
                                                    ${
                                                        user.banned
                                                            ? "GEBANNT"
                                                            : "AKTIV"
                                                    }
                                                </span>

                                            </div>

                                            <form
                                                method="POST"
                                                action="/admin/user/${encodeURIComponent(
                                                    user.id
                                                )}/coins"
                                                class="form"
                                            >

                                                <input
                                                    type="number"
                                                    name="amount"
                                                    placeholder="Coins + / -"
                                                    required
                                                >

                                                <button
                                                    class="btn"
                                                    type="submit"
                                                >
                                                    🪙 Coins ändern
                                                </button>

                                            </form>

                                            ${
                                                user.banned
                                                    ? `
                                                    <form
                                                        method="POST"
                                                        action="/admin/user/${encodeURIComponent(
                                                            user.id
                                                        )}/unban"
                                                        class="buttons"
                                                    >

                                                        <button
                                                            class="btn success"
                                                            type="submit"
                                                        >
                                                            🔓 Entbannen
                                                        </button>

                                                    </form>
                                                    `
                                                    : `
                                                    <form
                                                        method="POST"
                                                        action="/admin/user/${encodeURIComponent(
                                                            user.id
                                                        )}/ban"
                                                        class="form"
                                                    >

                                                        <input
                                                            name="reason"
                                                            placeholder="Ban-Grund"
                                                            maxlength="500"
                                                            required
                                                        >

                                                        <button
                                                            class="btn danger"
                                                            type="submit"
                                                        >
                                                            🔨 Benutzer bannen
                                                        </button>

                                                    </form>
                                                    `
                                            }

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                    </div>

                    <br>

                    <!-- CODES -->

                    <div class="card">

                        <h2>
                            🎟️ Vorhandene Codes
                        </h2>

                        ${
                            allCodes.length === 0
                                ? `
                                <p class="muted">
                                    Keine Codes.
                                </p>
                                `
                                : allCodes
                                    .map(
                                        code => `
                                        <div class="codeitem">

                                            <div class="row">

                                                <strong>
                                                    ${escapeHTML(
                                                        code.code
                                                    )}
                                                </strong>

                                                <span>
                                                    🪙
                                                    ${Number(
                                                        code.coins || 0
                                                    ).toLocaleString(
                                                        "de-DE"
                                                    )}
                                                </span>

                                            </div>

                                            <p class="muted">
                                                Eingelöst:
                                                ${
                                                    Array.isArray(
                                                        code.usedBy
                                                    )
                                                        ? code.usedBy.length
                                                        : 0
                                                }
                                            </p>

                                            <form
                                                method="POST"
                                                action="/admin/code/${encodeURIComponent(
                                                    code.id
                                                )}/toggle"
                                            >

                                                <button
                                                    class="btn"
                                                    type="submit"
                                                >
                                                    ${
                                                        code.active ===
                                                        false
                                                            ? "▶ Aktivieren"
                                                            : "⏸ Deaktivieren"
                                                    }
                                                </button>

                                            </form>

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                    </div>

                    <br>

                    <!-- SHOP -->

                    <div class="card">

                        <h2>
                            🛒 Shop verwalten
                        </h2>

                        ${
                            allShop.length === 0
                                ? `
                                <p class="muted">
                                    Keine Artikel.
                                </p>
                                `
                                : allShop
                                    .map(
                                        item => `
                                        <div class="shopitem">

                                            <div class="row">

                                                <strong>
                                                    ${escapeHTML(
                                                        item.name
                                                    )}
                                                </strong>

                                                <span>
                                                    🪙
                                                    ${Number(
                                                        item.price || 0
                                                    ).toLocaleString(
                                                        "de-DE"
                                                    )}
                                                </span>

                                            </div>

                                            <p class="muted">
                                                ${escapeHTML(
                                                    item.description
                                                )}
                                            </p>

                                            <form
                                                method="POST"
                                                action="/admin/shop/${encodeURIComponent(
                                                    item.id
                                                )}/toggle"
                                            >

                                                <button
                                                    class="btn"
                                                    type="submit"
                                                >
                                                    ${
                                                        item.active ===
                                                        false
                                                            ? "▶ Aktivieren"
                                                            : "⏸ Deaktivieren"
                                                    }
                                                </button>

                                            </form>

                                        </div>
                                        `
                                    )
                                    .join("")
                        }

                    </div>

                    <br>

                    <!-- TICKETS -->

                    <div class="card">

                        <h2>
                            🎫 Alle Tickets
                        </h2>

                        ${
                            allTickets.length === 0
                                ? `
                                <p class="muted">
                                    Keine Tickets.
                                </p>
                                `
                                : allTickets
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

                                            <div class="row">

                                                <strong>
                                                    ${escapeHTML(
                                                        ticket.subject
                                                    )}
                                                </strong>

                                                <span class="badge ${
                                                    ticket.status ===
                                                    "open"
                                                        ? "open"
                                                        : "closed"
                                                }">
                                                    ${
                                                        ticket.status ===
                                                        "open"
                                                            ? "OFFEN"
                                                            : "GESCHLOSSEN"
                                                    }
                                                </span>

                                            </div>

                                            <p class="muted">
                                                ${escapeHTML(
                                                    ticket.username
                                                )}
                                                ·
                                                ${escapeHTML(
                                                    ticket.email
                                                )}
                                            </p>

                                            <a
                                                class="btn"
                                                href="/ticket/${encodeURIComponent(
                                                    ticket.id
                                                )}"
                                            >
                                                Ticket öffnen
                                            </a>

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
// ADMIN COINS
// ============================================================

app.post(
    "/admin/user/:id/coins",
    requireAdmin,
    (req, res) => {

        const amount =
            Number(
                req.body.amount
            );

        if (!Number.isFinite(amount)) {
            return res.redirect("/admin");
        }

        const data =
            users();

        const user =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {
            return res.redirect("/admin");
        }

        user.coins =
            Math.max(
                0,
                Number(user.coins || 0) +
                    Math.trunc(amount)
            );

        saveUsers(data);

        res.redirect("/admin");

    }
);

// ============================================================
// ADMIN BAN
// ============================================================

app.post(
    "/admin/user/:id/ban",
    requireAdmin,
    (req, res) => {

        const admin =
            getUser(req);

        const data =
            users();

        const user =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {
            return res.redirect("/admin");
        }

        // Admin kann sich nicht selbst bannen
        if (user.id === admin.id) {
            return res.redirect("/admin");
        }

        user.banned = true;

        user.banReason =
            String(
                req.body.reason ||
                "Kein Grund angegeben"
            )
            .trim()
            .slice(0, 500);

        user.bannedAt =
            new Date().toISOString();

        saveUsers(data);

        res.redirect("/admin");

    }
);

// ============================================================
// ADMIN UNBAN
// ============================================================

app.post(
    "/admin/user/:id/unban",
    requireAdmin,
    (req, res) => {

        const data =
            users();

        const user =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {
            return res.redirect("/admin");
        }

        user.banned = false;

        user.banReason = "";

        user.bannedAt = null;

        saveUsers(data);

        res.redirect("/admin");

    }
);

// ============================================================
// ADMIN CODE ERSTELLEN
// ============================================================

app.post(
    "/admin/code/create",
    requireAdmin,
    (req, res) => {

        const codeText =
            String(
                req.body.code || ""
            )
            .trim()
            .toUpperCase();

        const coins =
            Math.max(
                1,
                Math.trunc(
                    Number(
                        req.body.coins
                    )
                )
            );

        if (
            !codeText ||
            !Number.isFinite(coins)
        ) {
            return res.redirect("/admin");
        }

        const data =
            codes();

        if (
            data.some(
                code =>
                    code.code.toUpperCase() ===
                    codeText
            )
        ) {
            return res.redirect("/admin");
        }

        let expiresAt =
            null;

        if (req.body.expiresAt) {

            const date =
                new Date(
                    req.body.expiresAt
                );

            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {
                expiresAt =
                    date.toISOString();
            }

        }

        data.push({

            id:
                id("CODE-"),

            code:
                codeText,

            coins,

            active:
                true,

            expiresAt,

            usedBy: [],

            createdAt:
                new Date().toISOString()

        });

        saveCodes(data);

        res.redirect("/admin");

    }
);

// ============================================================
// CODE AKTIVIEREN / DEAKTIVIEREN
// ============================================================

app.post(
    "/admin/code/:id/toggle",
    requireAdmin,
    (req, res) => {

        const data =
            codes();

        const code =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (code) {
            code.active =
                code.active === false;
        }

        saveCodes(data);

        res.redirect("/admin");

    }
);

// ============================================================
// SHOP ARTIKEL ERSTELLEN
// ============================================================

app.post(
    "/admin/shop/create",
    requireAdmin,
    (req, res) => {

        const name =
            String(
                req.body.name || ""
            )
            .trim()
            .slice(0, 100);

        const description =
            String(
                req.body.description || ""
            )
            .trim()
            .slice(0, 1000);

        const price =
            Math.max(
                0,
                Math.trunc(
                    Number(
                        req.body.price
                    )
                )
            );

        let stock =
            Math.trunc(
                Number(
                    req.body.stock
                )
            );

        if (
            !Number.isFinite(
                stock
            )
        ) {
            stock = -1;
        }

        if (!name) {
            return res.redirect("/admin");
        }

        const data =
            shop();

        data.push({

            id:
                id("SHOP-"),

            name,

            description,

            price,

            stock:
                stock < 0
                    ? null
                    : stock,

            active:
                true,

            createdAt:
                new Date().toISOString()

        });

        saveShop(data);

        res.redirect("/admin");

    }
);

// ============================================================
// SHOP AKTIVIEREN / DEAKTIVIEREN
// ============================================================

app.post(
    "/admin/shop/:id/toggle",
    requireAdmin,
    (req, res) => {

        const data =
            shop();

        const item =
            data.find(
                product =>
                    product.id ===
                    req.params.id
            );

        if (item) {
            item.active =
                item.active === false;
        }

        saveShop(data);

        res.redirect("/admin");

    }
);

// ============================================================
// ROLLE ERSTELLEN
// ============================================================

app.post(
    "/admin/role/create",
    requireAdmin,
    (req, res) => {

        const name =
            String(
                req.body.name || ""
            )
            .trim()
            .slice(0, 50);

        if (!name) {
            return res.redirect("/admin");
        }

        const data =
            roles();

        if (
            data.some(
                role =>
                    role.name.toLowerCase() ===
                    name.toLowerCase()
            )
        ) {
            return res.redirect("/admin");
        }

        data.push({

            id:
                id("ROLE-"),

            name,

            createdAt:
                new Date().toISOString()

        });

        saveRoles(data);

        res.redirect("/admin");

    }
);

// ============================================================
// TICKET CLOSE
// ============================================================

app.post(
    "/admin/ticket/:id/close",
    requireAdmin,
    (req, res) => {

        const data =
            tickets();

        const ticket =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (ticket) {

            ticket.status =
                "closed";

            ticket.updatedAt =
                new Date().toISOString();

        }

        saveTickets(data);

        res.redirect(
            `/ticket/${encodeURIComponent(
                req.params.id
            )}`
        );

    }
);

// ============================================================
// TICKET OPEN
// ============================================================

app.post(
    "/admin/ticket/:id/open",
    requireAdmin,
    (req, res) => {

        const data =
            tickets();

        const ticket =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (ticket) {

            ticket.status =
                "open";

            ticket.updatedAt =
                new Date().toISOString();

        }

        saveTickets(data);

        res.redirect(
            `/ticket/${encodeURIComponent(
                req.params.id
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

            website:
                "North Bot",

            login:
                true,

            registration:
                true,

            tickets:
                true,

            chat:
                true,

            coins:
                true,

            redeemCodes:
                true,

            shop:
                true,

            users:
                true,

            bans:
                true,

            roles:
                true,

            adminPanel:
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
            render(
                req,
                "404",
                `
                <section class="container">

                    <div class="card center">

                        <div class="big">
                            404
                        </div>

                        <h1>
                            Seite nicht gefunden
                        </h1>

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
// SERVER START
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "             NORTH BOT"
        );

        console.log(
            "========================================"
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
            "💬 Chat: AKTIV"
        );

        console.log(
            "🪙 Coins: AKTIV"
        );

        console.log(
            "🎟️ Coin-Codes: AKTIV"
        );

        console.log(
            "🛒 Coin-Shop: AKTIV"
        );

        console.log(
            "👥 Benutzerverwaltung: AKTIV"
        );

        console.log(
            "🔨 Ban-System: AKTIV"
        );

        console.log(
            "🏷️ Rollen: AKTIV"
        );

        console.log(
            "👑 Admin Panel: AKTIV"
        );

        console.log(
            `👑 Admin: ${ADMIN_EMAILS.join(", ")}`
        );

        console.log(
            "========================================"
        );

    }
);
