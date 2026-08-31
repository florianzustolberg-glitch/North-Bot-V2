```js
// ============================================================
// NORTH BOT - WEBSEITE
// Anmeldung + Registrierung + Support + Admin Panel
// ============================================================

const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = 10000;

// ============================================================
// KONFIGURATION
// ============================================================

// NEUEN DISCORD WEBHOOK HIER EINTRAGEN
const DISCORD_WEBHOOK_URL =
    "DEIN_NEUER_DISCORD_WEBHOOK_HIER";

// Discord Server
const DISCORD_INVITE =
    "https://discord.gg/NJEVq6Pk6x";

// Ticket-Kategorie
const TICKET_CATEGORY_ID =
    "1493423287118729328";

// Admin-E-Mail
const OWNER_EMAIL =
    "florianzustolberg@gmail.com";

// Webseite
const WEBSITE_NAME =
    "North Bot";

const WEBSITE_DOMAIN =
    "North-Bot-2.de";

// ============================================================
// DATEIEN
// ============================================================

const USERS_FILE =
    path.join(__dirname, "users.json");

// ============================================================
// USERS.JSON ERSTELLEN
// ============================================================

function ensureUsersFile() {

    if (!fs.existsSync(USERS_FILE)) {

        fs.writeFileSync(
            USERS_FILE,
            JSON.stringify([], null, 2),
            "utf8"
        );

    }

}

ensureUsersFile();

// ============================================================
// USERS LADEN
// ============================================================

function getUsers() {

    try {

        ensureUsersFile();

        const data =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "❌ users.json Fehler:",
            error
        );

        return [];

    }

}

// ============================================================
// USERS SPEICHERN
// ============================================================

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

// ============================================================
// HTML ESCAPEN
// ============================================================

function escapeHtml(value = "") {

    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}

// ============================================================
// PASSWORT HASH
// ============================================================

function hashPassword(password) {

    const salt =
        crypto.randomBytes(16).toString("hex");

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

// ============================================================
// PASSWORT PRÜFEN
// ============================================================

function verifyPassword(
    password,
    storedPassword
) {

    try {

        const parts =
            storedPassword.split(":");

        if (parts.length !== 2) {

            return false;

        }

        const salt = parts[0];

        const storedHash = parts[1];

        const hash =
            crypto
                .scryptSync(
                    password,
                    salt,
                    64
                )
                .toString("hex");

        return crypto.timingSafeEqual(

            Buffer.from(hash, "hex"),

            Buffer.from(
                storedHash,
                "hex"
            )

        );

    } catch {

        return false;

    }

}

// ============================================================
// EXPRESS
// ============================================================

app.disable(
    "x-powered-by"
);

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);

// ============================================================
// SESSION
// ============================================================

app.use(
    session({

        secret:
            "NORTH-BOT-SESSION-CHANGE-ME-2026",

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            sameSite: "lax",

            secure: false,

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7

        }

    })
);

// ============================================================
// LOGIN CHECK
// ============================================================

function requireLogin(
    req,
    res,
    next
) {

    if (!req.session.userId) {

        return res.redirect(
            "/login"
        );

    }

    next();

}

// ============================================================
// ADMIN CHECK
// ============================================================

function requireAdmin(
    req,
    res,
    next
) {

    if (!req.session.userId) {

        return res.redirect(
            "/login"
        );

    }

    const users =
        getUsers();

    const user =
        users.find(
            u =>
                u.id ===
                req.session.userId
        );

    if (!user) {

        return res.redirect(
            "/login"
        );

    }

    if (
        user.email.toLowerCase() !==
        OWNER_EMAIL.toLowerCase()
    ) {

        return res.status(403).send(
            page(
                "Zugriff verweigert",
                `
                    <div class="center">
                        <div class="big">
                            403
                        </div>

                        <h2>
                            Kein Zugriff
                        </h2>

                        <p>
                            Du bist nicht als
                            North-Bot-Administrator
                            eingetragen.
                        </p>

                        <a
                            class="button"
                            href="/"
                        >
                            Zur Startseite
                        </a>
                    </div>
                `
            )
        );

    }

    next();

}

// ============================================================
// SEITEN LAYOUT
// ============================================================

function page(
    title,
    content,
    user = null
) {

    const loggedIn =
        Boolean(user);

    return `
<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<meta
    name="theme-color"
    content="#050505"
>

<title>
    ${escapeHtml(title)}
    | North Bot
</title>

<style>

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {

    min-height: 100vh;

    background:
        radial-gradient(
            circle at 50% 20%,
            rgba(
                255,
                255,
                255,
                .08
            ),
            transparent 35%
        ),
        #050505;

    color: #fff;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

body::before {

    content: "";

    position: fixed;

    width: 600px;

    height: 600px;

    left: 50%;

    top: 35%;

    transform:
        translate(
            -50%,
            -50%
        );

    background:
        radial-gradient(
            circle,
            rgba(
                255,
                255,
                255,
                .06
            ),
            transparent 70%
        );

    filter: blur(40px);

    pointer-events: none;

}

nav {

    position: fixed;

    top: 0;

    left: 0;

    width: 100%;

    height: 70px;

    padding:
        0 5%;

    display: flex;

    align-items: center;

    justify-content:
        space-between;

    background:
        rgba(
            5,
            5,
            5,
            .75
        );

    backdrop-filter:
        blur(15px);

    border-bottom:
        1px solid
        rgba(
            255,
            255,
            255,
            .07
        );

    z-index: 100;

}

.logo {

    font-size: 16px;

    font-weight: 900;

    letter-spacing: 4px;

}

.nav-links {

    display: flex;

    align-items: center;

    gap: 10px;

}

.nav-link {

    color: #aaa;

    text-decoration: none;

    padding:
        9px 13px;

    border-radius: 9px;

    transition: .2s;

    font-size: 13px;

}

.nav-link:hover {

    color: #fff;

    background:
        rgba(
            255,
            255,
            255,
            .07
        );

}

.container {

    width: 92%;

    max-width: 1100px;

    margin:
        0 auto;

    padding:
        120px 0 80px;

    position: relative;

    z-index: 2;

}

.card {

    padding: 35px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .10
        );

    border-radius: 20px;

    background:
        rgba(
            255,
            255,
            255,
            .035
        );

    backdrop-filter:
        blur(15px);

    box-shadow:
        0 20px 60px
        rgba(
            0,
            0,
            0,
            .3
        );

}

.center {

    text-align: center;

    max-width: 550px;

    margin:
        0 auto;

}

.center h1 {

    margin-bottom: 15px;

}

.center p {

    color: #888;

    line-height: 1.7;

    margin-bottom: 25px;

}

.big {

    font-size: 90px;

    font-weight: 900;

}

h1 {

    font-size: 42px;

}

h2 {

    font-size: 28px;

}

p {

    color: #888;

    line-height: 1.7;

}

.button {

    display: inline-flex;

    align-items: center;

    justify-content: center;

    gap: 8px;

    padding:
        13px 22px;

    border-radius: 10px;

    border: 1px solid
        rgba(
            255,
            255,
            255,
            .15
        );

    background:
        rgba(
            255,
            255,
            255,
            .06
        );

    color: white;

    text-decoration: none;

    cursor: pointer;

    font-size: 14px;

    font-weight: 700;

    transition: .2s;

}

.button:hover {

    transform:
        translateY(-2px);

    background:
        rgba(
            255,
            255,
            255,
            .12
        );

}

.primary {

    background: white;

    color: black;

}

.form {

    display: grid;

    gap: 13px;

    margin-top: 25px;

}

input,
textarea {

    width: 100%;

    padding: 14px;

    border-radius: 10px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .10
        );

    background:
        rgba(
            0,
            0,
            0,
            .35
        );

    color: white;

    outline: none;

    font-family: inherit;

}

input:focus,
textarea:focus {

    border-color:
        rgba(
            255,
            255,
            255,
            .35
        );

}

textarea {

    min-height: 140px;

    resize: vertical;

}

.error {

    margin-top: 15px;

    padding: 12px;

    border-radius: 10px;

    background:
        rgba(
            255,
            60,
            60,
            .08
        );

    border:
        1px solid
        rgba(
            255,
            60,
            60,
            .15
        );

    color: #ff9999;

}

.success {

    margin-top: 15px;

    padding: 12px;

    border-radius: 10px;

    background:
        rgba(
            100,
            255,
            150,
            .07
        );

    border:
        1px solid
        rgba(
            100,
            255,
            150,
            .15
        );

    color: #aaffbb;

}

.hero {

    min-height: 100vh;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    text-align: center;

}

.brand {

    color: #aaa;

    font-size: 15px;

    font-weight: 700;

    letter-spacing: 8px;

    margin-bottom: 35px;

}

.hero h1 {

    font-size:
        clamp(
            48px,
            10vw,
            120px
        );

    line-height: 1;

    letter-spacing: 5px;

    font-weight: 900;

    background:
        linear-gradient(
            90deg,
            #fff,
            #777,
            #fff,
            #777,
            #fff
        );

    background-size: 300%;

    color: transparent;

    -webkit-background-clip: text;

    background-clip: text;

    animation:
        shine 5s linear infinite;

}

.line {

    width: 80px;

    height: 3px;

    background: white;

    border-radius: 50px;

    margin: 35px auto;

}

.hero p {

    max-width: 650px;

    font-size: 16px;

}

.buttons {

    display: flex;

    flex-wrap: wrap;

    justify-content: center;

    gap: 12px;

    margin-top: 35px;

}

.support {

    margin-top: 80px;

}

.grid {

    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                220px,
                1fr
            )
        );

    gap: 15px;

    margin-top: 25px;

}

.stat {

    padding: 25px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .08
        );

    border-radius: 15px;

    background:
        rgba(
            255,
            255,
            255,
            .03
        );

}

.stat-title {

    color: #666;

    font-size: 12px;

    margin-bottom: 10px;

}

.stat-value {

    font-size: 22px;

    font-weight: 800;

}

footer {

    text-align: center;

    color: #444;

    padding:
        35px;

    font-size: 12px;

}

@keyframes shine {

    0% {
        background-position: 300%;
    }

    100% {
        background-position: -300%;
    }

}

@media(max-width:600px) {

    nav {

        padding:
            0 18px;

    }

    .logo {

        font-size: 13px;

    }

    .nav-link {

        font-size: 11px;

        padding:
            8px 9px;

    }

    .container {

        width: 90%;

    }

    h1 {

        font-size: 34px;

    }

    .hero h1 {

        font-size: 43px;

        letter-spacing: 2px;

    }

    .brand {

        font-size: 11px;

        letter-spacing: 5px;

    }

    .card {

        padding: 25px;

    }

}

</style>

</head>

<body>

<nav>

    <div class="logo">
        NORTH BOT
    </div>

    <div class="nav-links">

        <a
            class="nav-link"
            href="/"
        >
            Startseite
        </a>

        <a
            class="nav-link"
            href="/support"
        >
            Support
        </a>

        ${
            loggedIn
                ? `
                    <a
                        class="nav-link"
                        href="/dashboard"
                    >
                        Konto
                    </a>

                    <a
                        class="nav-link"
                        href="/logout"
                    >
                        Logout
                    </a>
                `
                : `
                    <a
                        class="nav-link"
                        href="/login"
                    >
                        Anmelden
                    </a>

                    <a
                        class="nav-link"
                        href="/register"
                    >
                        Registrieren
                    </a>
                `
        }

    </div>

</nav>

${content}

<footer>

    © 2026 North Bot ·
    North-Bot-2.de

</footer>

</body>

</html>
    `;

}

// ============================================================
// STARTSEITE
// ============================================================

app.get(
    "/",
    (req, res) => {

        let user = null;

        if (req.session.userId) {

            const users =
                getUsers();

            user =
                users.find(
                    u =>
                        u.id ===
                        req.session.userId
                ) || null;

        }

        res.send(
            page(
                "Coming Soon",
                `

<div class="hero">

    <div class="brand">
        NORTH BOT
    </div>

    <h1>
        COMING SOON!
    </h1>

    <div class="line"></div>

    <p>
        Unsere Webseite befindet sich aktuell
        im Aufbau.
        <br>
        North Bot kommt bald.
    </p>

    <div class="buttons">

        <a
            class="button primary"
            href="${DISCORD_INVITE}"
            target="_blank"
            rel="noopener noreferrer"
        >
            💬 Discord beitreten
        </a>

        <a
            class="button"
            href="/support"
        >
            🎫 Support
        </a>

        ${
            user
                ? `
                    <a
                        class="button"
                        href="/dashboard"
                    >
                        👤 Mein Konto
                    </a>
                `
                : `
                    <a
                        class="button"
                        href="/login"
                    >
                        🔐 Anmelden
                    </a>
                `
        }

    </div>

</div>

                `,
                user
            )
        );

    }
);

// ============================================================
// REGISTRIEREN
// ============================================================

app.get(
    "/register",
    (req, res) => {

        res.send(
            page(
                "Registrieren",
                `

<div class="container">

    <div class="card center">

        <h1>
            📝 Registrieren
        </h1>

        <p>
            Erstelle dein North-Bot-Konto.
        </p>

        <form
            class="form"
            method="POST"
            action="/register"
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
                placeholder="E-Mail-Adresse"
                maxlength="150"
                required
            >

            <input
                type="password"
                name="password"
                placeholder="Passwort"
                minlength="8"
                maxlength="100"
                required
            >

            <input
                type="password"
                name="password2"
                placeholder="Passwort wiederholen"
                minlength="8"
                maxlength="100"
                required
            >

            <button
                class="button primary"
                type="submit"
            >
                📝 Konto erstellen
            </button>

        </form>

        <br>

        <p>
            Du hast bereits ein Konto?
        </p>

        <a
            class="button"
            href="/login"
        >
            🔐 Anmelden
        </a>

    </div>

</div>

                `
            )
        );

    }
);

// ============================================================
// REGISTRIEREN POST
// ============================================================

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
            ).trim()
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
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="card center">

                            <h2>
                                ❌ Ungültiger Benutzername
                            </h2>

                            <p>
                                Der Benutzername muss
                                zwischen 3 und 30 Zeichen
                                lang sein.
                            </p>

                            <a
                                class="button"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>
                    </div>
                    `
                )
            );

        }

        if (
            !email.includes("@") ||
            email.length > 150
        ) {

            return res.status(400).send(
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="card center">

                            <h2>
                                ❌ Ungültige E-Mail
                            </h2>

                            <p>
                                Bitte gib eine gültige
                                E-Mail-Adresse ein.
                            </p>

                            <a
                                class="button"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>
                    </div>
                    `
                )
            );

        }

        if (password.length < 8) {

            return res.status(400).send(
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="card center">

                            <h2>
                                ❌ Passwort zu kurz
                            </h2>

                            <p>
                                Das Passwort muss mindestens
                                8 Zeichen haben.
                            </p>

                            <a
                                class="button"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>
                    </div>
                    `
                )
            );

        }

        if (password !== password2) {

            return res.status(400).send(
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="card center">

                            <h2>
                                ❌ Passwörter stimmen nicht überein
                            </h2>

                            <a
                                class="button"
                                href="/register"
                            >
                                Zurück
                            </a>

                        </div>
                    </div>
                    `
                )
            );

        }

        const users =
            getUsers();

        const existing =
            users.find(
                user =>
                    user.email === email
            );

        if (existing) {

            return res.status(409).send(
                page(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="card center">

                            <h2>
                                ❌ Konto existiert bereits
                            </h2>

                            <p>
                                Für diese E-Mail-Adresse
                                existiert bereits ein Konto.
                            </p>

                            <a
                                class="button"
                                href="/login"
                            >
                                Anmelden
                            </a>

                        </div>
                    </div>
                    `
                )
            );

        }

        const newUser = {

            id:
                crypto.randomUUID(),

            username,

            email,

            password:
                hashPassword(password),

            createdAt:
                new Date().toISOString()

        };

        users.push(
            newUser
        );

        saveUsers(
            users
        );

        req.session.userId =
            newUser.id;

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
            page(
                "Anmelden",
                `

<div class="container">

    <div class="card center">

        <h1>
            🔐 Anmelden
        </h1>

        <p>
            Melde dich bei deinem
            North-Bot-Konto an.
        </p>

        <form
            class="form"
            method="POST"
            action="/login"
        >

            <input
                type="email"
                name="email"
                placeholder="E-Mail-Adresse"
                required
            >

            <input
                type="password"
                name="password"
                placeholder="Passwort"
                required
            >

            <button
                class="button primary"
                type="submit"
            >
                🔐 Anmelden
            </button>

        </form>

        <br>

        <p>
            Noch kein Konto?
        </p>

        <a
            class="button"
            href="/register"
        >
            📝 Registrieren
        </a>

    </div>

</div>

                `
            )
        );

    }
);

// ============================================================
// LOGIN POST
// ============================================================

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
                u =>
                    u.email === email
            );

        if (
            !user ||
            !verifyPassword(
                password,
                user.password
            )
        ) {

            return res.status(401).send(
                page(
                    "Login fehlgeschlagen",
                    `
                    <div class="container">

                        <div class="card center">

                            <h2>
                                ❌ Login fehlgeschlagen
                            </h2>

                            <p>
                                E-Mail oder Passwort
                                ist falsch.
                            </p>

                            <a
                                class="button"
                                href="/login"
                            >
                                Erneut versuchen
                            </a>

                        </div>

                    </div>
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
// DASHBOARD
// ============================================================

app.get(
    "/dashboard",
    requireLogin,
    (req, res) => {

        const users =
            getUsers();

        const user =
            users.find(
                u =>
                    u.id ===
                    req.session.userId
            );

        if (!user) {

            req.session.destroy(
                () => {}
            );

            return res.redirect(
                "/login"
            );

        }

        const isAdmin =
            user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase();

        res.send(
            page(
                "Mein Konto",
                `

<div class="container">

    <div class="card">

        <h1>
            👤 Mein Konto
        </h1>

        <p>
            Willkommen,
            <strong>
                ${escapeHtml(user.username)}
            </strong>!
        </p>

        <div class="grid">

            <div class="stat">

                <div class="stat-title">
                    BENUTZERNAME
                </div>

                <div class="stat-value">
                    ${escapeHtml(user.username)}
                </div>

            </div>

            <div class="stat">

                <div class="stat-title">
                    E-MAIL
                </div>

                <div class="stat-value">
                    ${escapeHtml(user.email)}
                </div>

            </div>

            <div class="stat">

                <div class="stat-title">
                    KONTO
                </div>

                <div class="stat-value">
                    ${
                        isAdmin
                            ? "👑 OWNER"
                            : "👤 USER"
                    }
                </div>

            </div>

        </div>

        <div class="buttons">

            <a
                class="button"
                href="/support"
            >
                🎫 Support
            </a>

            ${
                isAdmin
                    ? `
                        <a
                            class="button primary"
                            href="/admin"
                        >
                            👑 Admin Panel
                        </a>
                    `
                    : ""
            }

            <a
                class="button"
                href="/logout"
            >
                🚪 Abmelden
            </a>

        </div>

    </div>

</div>

                `,
                user
            )
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
// SUPPORT
// ============================================================

app.get(
    "/support",
    requireLogin,
    (req, res) => {

        const users =
            getUsers();

        const user =
            users.find(
                u =>
                    u.id ===
                    req.session.userId
            );

        res.send(
            page(
                "Support",
                `

<div class="container">

    <div class="card">

        <h1>
            🎫 Support
        </h1>

        <p>
            Erstelle ein Support-Ticket.
            Dein Anliegen wird anschließend
            an den North-Bot-Support gesendet.
        </p>

        <form
            class="form"
            method="POST"
            action="/api/ticket"
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
                maxlength="2000"
                required
            ></textarea>

            <button
                class="button primary"
                type="submit"
            >
                🎫 Ticket erstellen
            </button>

        </form>

    </div>

</div>

                `,
                user
            )
        );

    }
);

// ============================================================
// TICKET
// ============================================================

app.post(
    "/api/ticket",
    requireLogin,
    async (req, res) => {

        try {

            const users =
                getUsers();

            const user =
                users.find(
                    u =>
                        u.id ===
                        req.session.userId
                );

            if (!user) {

                return res.redirect(
                    "/login"
                );

            }

            const subject =
                String(
                    req.body.subject ||
                    ""
                )
                .trim()
                .slice(
                    0,
                    100
                );

            const message =
                String(
                    req.body.message ||
                    ""
                )
                .trim()
                .slice(
                    0,
                    2000
                );

            if (
                !subject ||
                !message
            ) {

                return res.status(400).send(
                    page(
                        "Ticket Fehler",
                        `
                        <div class="container">

                            <div class="card center">

                                <h2>
                                    ❌ Bitte alle Felder ausfüllen.
                                </h2>

                                <a
                                    class="button"
                                    href="/support"
                                >
                                    Zurück
                                </a>

                            </div>

                        </div>
                        `,
                        user
                    )
                );

            }

            if (
                !DISCORD_WEBHOOK_URL ||
                DISCORD_WEBHOOK_URL.includes(
                    "DEIN_NEUER"
                )
            ) {

                return res.status(500).send(
                    page(
                        "Webhook fehlt",
                        `
                        <div class="container">

                            <div class="card center">

                                <h2>
                                    ❌ Discord Webhook fehlt
                                </h2>

                                <p>
                                    Trage deinen neuen
                                    Discord-Webhook oben
                                    in der webseite.js ein.
                                </p>

                                <a
                                    class="button"
                                    href="/support"
                                >
                                    Zurück
                                </a>

                            </div>

                        </div>
                        `,
                        user
                    )
                );

            }

            const ticketId =
                "NORTH-" +
                crypto
                    .randomBytes(4)
                    .toString("hex")
                    .toUpperCase();

            const webhookResponse =
                await fetch(
                    DISCORD_WEBHOOK_URL,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                username:
                                    "North Bot Support",

                                embeds: [

                                    {

                                        title:
                                            "🎫 Neues Ticket",

                                        description:
                                            "Auf der North-Bot-Webseite wurde ein neues Support-Ticket erstellt.",

                                        fields: [

                                            {
                                                name:
                                                    "🎫 Ticket-ID",

                                                value:
                                                    ticketId,

                                                inline:
                                                    true
                                            },

                                            {
                                                name:
                                                    "👤 Benutzer",

                                                value:
                                                    escapeHtml(
                                                        user.username
                                                    ),

                                                inline:
                                                    true
                                            },

                                            {
                                                name:
                                                    "📧 E-Mail",

                                                value:
                                                    escapeHtml(
                                                        user.email
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📌 Betreff",

                                                value:
                                                    escapeHtml(
                                                        subject
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📝 Nachricht",

                                                value:
                                                    escapeHtml(
                                                        message
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📁 Kategorie-ID",

                                                value:
                                                    TICKET_CATEGORY_ID,

                                                inline:
                                                    false
                                            }

                                        ],

                                        footer: {

                                            text:
                                                "North Bot Support"

                                        },

                                        timestamp:
                                            new Date()
                                                .toISOString()

                                    }

                                ]

                            })

                    }
                );

            if (
                !webhookResponse.ok
            ) {

                throw new Error(
                    "Discord Webhook antwortete mit HTTP " +
                    webhookResponse.status
                );

            }

            res.send(
                page(
                    "Ticket erstellt",
                    `
                    <div class="container">

                        <div class="card center">

                            <h1>
                                ✅ Ticket erstellt
                            </h1>

                            <p>
                                Dein Support-Ticket
                                wurde erfolgreich
                                an Discord gesendet.
                            </p>

                            <p>
                                Ticket-ID:
                                <strong>
                                    ${escapeHtml(ticketId)}
                                </strong>
                            </p>

                            <div class="buttons">

                                <a
                                    class="button primary"
                                    href="/dashboard"
                                >
                                    👤 Konto
                                </a>

                                <a
                                    class="button"
                                    href="${DISCORD_INVITE}"
                                    target="_blank"
                                >
                                    💬 Discord
                                </a>

                            </div>

                        </div>

                    </div>
                    `,
                    user
                )
            );

        } catch (error) {

            console.error(
                "❌ Ticket Fehler:",
                error
            );

            res.status(500).send(
                page(
                    "Ticket Fehler",
                    `
                    <div class="container">

                        <div class="card center">

                            <h2>
                                ❌ Ticket konnte nicht erstellt werden
                            </h2>

                            <p>
                                Bitte versuche es später erneut.
                            </p>

                            <a
                                class="button"
                                href="/support"
                            >
                                Zurück
                            </a>

                        </div>

                    </div>
                    `
                )
            );

        }

    }
);

// ============================================================
// ADMIN PANEL
// ============================================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        const users =
            getUsers();

        const admin =
            users.find(
                u =>
                    u.id ===
                    req.session.userId
            );

        res.send(
            page(
                "Admin Panel",
                `

<div class="container">

    <div class="card">

        <h1>
            👑 North Bot Admin Panel
        </h1>

        <p>
            Willkommen im Verwaltungsbereich.
        </p>

        <div class="grid">

            <div class="stat">

                <div class="stat-title">
                    WEBSITE
                </div>

                <div class="stat-value">
                    🟢 ONLINE
                </div>

            </div>

            <div class="stat">

                <div class="stat-title">
                    BENUTZER
                </div>

                <div class="stat-value">
                    ${users.length}
                </div>

            </div>

            <div class="stat">

                <div class="stat-title">
                    SUPPORT
                </div>

                <div class="stat-value">
                    🟢 AKTIV
                </div>

            </div>

            <div class="stat">

                <div class="stat-title">
                    TICKET-KATEGORIE
                </div>

                <div class="stat-value">
                    ${TICKET_CATEGORY_ID}
                </div>

            </div>

        </div>

        <div class="card" style="margin-top:25px;">

            <h2>
                👤 Angemeldeter Owner
            </h2>

            <br>

            <p>
                Benutzer:
                ${escapeHtml(admin.username)}
            </p>

            <p>
                E-Mail:
                ${escapeHtml(admin.email)}
            </p>

            <p>
                Rolle:
                👑 OWNER
            </p>

        </div>

        <div class="buttons">

            <a
                class="button"
                href="/dashboard"
            >
                👤 Konto
            </a>

            <a
                class="button"
                href="/"
            >
                🏠 Startseite
            </a>

        </div>

    </div>

</div>

                `,
                admin
            )
        );

    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "online",

            website:
                WEBSITE_NAME,

            domain:
                WEBSITE_DOMAIN,

            support:
                "online",

            ticketCategory:
                TICKET_CATEGORY_ID

        });

    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).send(
            page(
                "404",
                `
                <div class="container">

                    <div class="card center">

                        <div class="big">
                            404
                        </div>

                        <h2>
                            Seite nicht gefunden
                        </h2>

                        <p>
                            Diese North-Bot-Seite
                            existiert nicht.
                        </p>

                        <a
                            class="button"
                            href="/"
                        >
                            Zur Startseite
                        </a>

                    </div>

                </div>
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
            "===================================="
        );

        console.log(
            "             NORTH BOT"
        );

        console.log(
            "===================================="
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            "🌐 Webseite: North-Bot-2.de"
        );

        console.log(
            "🎫 Support: AKTIV"
        );

        console.log(
            `📁 Kategorie: ${TICKET_CATEGORY_ID}`
        );

        console.log(
            `💬 Discord: ${DISCORD_INVITE}`
        );

        console.log(
            "===================================="
        );

    }
);

// ============================================================
// FEHLERBEHANDLUNG
// ============================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ Uncaught Exception:",
            error
        );

    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "❌ Unhandled Rejection:",
            error
        );

    }
);
```
