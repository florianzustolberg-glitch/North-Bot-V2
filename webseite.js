```js
const express = require("express");
const session = require("express-session");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

// ============================================================
// NORTH BOT KONFIGURATION
// ============================================================

const DISCORD_INVITE = "https://discord.gg/NJEVq6Pk6x";

const DISCORD_WEBHOOK_URL =
    "https://discord.com/api/webhooks/1543921362794717194/hhfOv1sAQJz2vuq1VCuZGvxdCOApGxSwyfG7__xKAIlRbvo11kfygoI28fOVUSWT-RXa";

const TICKET_CATEGORY_ID =
    "1493423287118729328";

const OWNER_EMAIL =
    "florianzustolberg@gmail.com";

const USERS_FILE =
    path.join(__dirname, "users.json");

// ============================================================
// DATEI ERSTELLEN
// ============================================================

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
        USERS_FILE,
        "[]",
        "utf8"
    );
}

// ============================================================
// USERS
// ============================================================

function loadUsers() {
    try {
        return JSON.parse(
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            )
        );
    } catch {
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

// ============================================================
// PASSWORD
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

    return salt + ":" + hash;
}

function checkPassword(
    password,
    stored
) {

    try {

        const [
            salt,
            oldHash
        ] = stored.split(":");

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
            Buffer.from(oldHash, "hex")
        );

    } catch {

        return false;

    }
}

// ============================================================
// HTML ESCAPE
// ============================================================

function esc(value) {

    return String(
        value || ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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
            "north-bot-session-secret-2026",

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
// USER
// ============================================================

function getCurrentUser(req) {

    if (!req.session.userId) {
        return null;
    }

    const users =
        loadUsers();

    return users.find(
        user =>
            user.id ===
            req.session.userId
    ) || null;
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

    if (
        user.email.toLowerCase() !==
        OWNER_EMAIL.toLowerCase()
    ) {

        return res.status(403).send(
            layout(
                "Kein Zugriff",
                `
                <div class="box center">

                    <div class="errorIcon">
                        403
                    </div>

                    <h1>
                        Kein Zugriff
                    </h1>

                    <p>
                        Du hast keine Berechtigung
                        für das Admin Panel.
                    </p>

                    <a
                        class="btn"
                        href="/dashboard"
                    >
                        Zurück
                    </a>

                </div>
                `,
                user
            )
        );

    }

    next();

}

// ============================================================
// DESIGN
// ============================================================

function layout(
    title,
    content,
    user = null
) {

    return `
<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${esc(title)} | North Bot
</title>

<style>

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {

    min-height: 100vh;

    background:
        radial-gradient(
            circle at top,
            #171717,
            #050505 55%
        );

    color: white;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

nav {

    position: fixed;

    top: 0;
    left: 0;

    width: 100%;

    height: 72px;

    display: flex;

    justify-content: space-between;

    align-items: center;

    padding:
        0 5%;

    background:
        rgba(
            5,
            5,
            5,
            .85
        );

    backdrop-filter:
        blur(20px);

    border-bottom:
        1px solid
        rgba(
            255,
            255,
            255,
            .08
        );

    z-index: 100;

}

.logo {

    font-size: 18px;

    font-weight: 900;

    letter-spacing: 4px;

}

nav .links {

    display: flex;

    gap: 8px;

    align-items: center;

}

nav a {

    color: #aaa;

    text-decoration: none;

    padding:
        10px 14px;

    border-radius: 9px;

    font-size: 13px;

    transition: .2s;

}

nav a:hover {

    color: white;

    background:
        rgba(
            255,
            255,
            255,
            .08
        );

}

main {

    padding-top: 72px;

    min-height: calc(
        100vh - 120px
    );

}

.hero {

    min-height:
        calc(
            100vh - 72px
        );

    display: flex;

    flex-direction: column;

    justify-content: center;

    align-items: center;

    text-align: center;

    padding: 30px;

}

.hero .small {

    color: #777;

    letter-spacing: 8px;

    font-size: 13px;

    margin-bottom: 25px;

}

.hero h1 {

    font-size:
        clamp(
            50px,
            9vw,
            110px
        );

    letter-spacing: 5px;

    font-weight: 900;

}

.hero p {

    max-width: 650px;

    color: #777;

    line-height: 1.8;

    margin-top: 25px;

}

.buttons {

    display: flex;

    flex-wrap: wrap;

    justify-content: center;

    gap: 12px;

    margin-top: 30px;

}

.btn {

    display: inline-flex;

    align-items: center;

    justify-content: center;

    padding:
        13px 22px;

    border-radius: 10px;

    background:
        rgba(
            255,
            255,
            255,
            .07
        );

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .12
        );

    color: white;

    text-decoration: none;

    cursor: pointer;

    font-weight: 700;

    font-size: 14px;

    transition: .2s;

}

.btn:hover {

    transform:
        translateY(-2px);

    background:
        rgba(
            255,
            255,
            255,
            .13
        );

}

.btn.primary {

    background: white;

    color: black;

}

.container {

    width: 92%;

    max-width: 1100px;

    margin:
        0 auto;

    padding:
        55px 0;

}

.box {

    background:
        rgba(
            255,
            255,
            255,
            .04
        );

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .10
        );

    border-radius: 20px;

    padding: 35px;

    backdrop-filter:
        blur(20px);

}

.center {

    max-width: 600px;

    margin:
        60px auto;

    text-align: center;

}

.box h1 {

    margin-bottom: 12px;

}

.box p {

    color: #777;

    line-height: 1.7;

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

    background:
        rgba(
            0,
            0,
            0,
            .4
        );

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .10
        );

    color: white;

    border-radius: 10px;

    outline: none;

    font-family: inherit;

}

textarea {

    min-height: 150px;

    resize: vertical;

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

.grid {

    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                200px,
                1fr
            )
        );

    gap: 15px;

    margin-top: 30px;

}

.stat {

    padding: 23px;

    border-radius: 15px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .08
        );

    background:
        rgba(
            255,
            255,
            255,
            .025
        );

}

.stat span {

    display: block;

    color: #666;

    font-size: 11px;

    margin-bottom: 10px;

    letter-spacing: 1px;

}

.stat strong {

    font-size: 21px;

}

.errorIcon {

    font-size: 75px;

    font-weight: 900;

    margin-bottom: 20px;

}

.error {

    padding: 13px;

    margin-top: 20px;

    border-radius: 10px;

    background:
        rgba(
            255,
            50,
            50,
            .08
        );

    color: #ff9999;

}

.success {

    padding: 13px;

    margin-top: 20px;

    border-radius: 10px;

    background:
        rgba(
            50,
            255,
            120,
            .08
        );

    color: #9fffb5;

}

footer {

    text-align: center;

    color: #444;

    padding: 30px;

    font-size: 12px;

}

@media(max-width:650px) {

    nav {

        padding:
            0 15px;

    }

    nav .links {

        gap: 2px;

    }

    nav a {

        padding:
            8px;

        font-size: 11px;

    }

    .logo {

        font-size: 13px;

        letter-spacing: 2px;

    }

    .hero h1 {

        font-size: 45px;

    }

    .hero .small {

        font-size: 10px;

    }

    .box {

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

    <div class="links">

        <a href="/">
            Startseite
        </a>

        <a href="/support">
            🎫 Support
        </a>

        ${
            user
                ? `
                    <a href="/dashboard">
                        👤 Konto
                    </a>

                    <a href="/logout">
                        Logout
                    </a>
                `
                : `
                    <a href="/login">
                        Anmelden
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

</html>
    `;

}

// ============================================================
// STARTSEITE
// ============================================================

app.get(
    "/",
    (req, res) => {

        const user =
            getCurrentUser(req);

        res.send(
            layout(
                "North Bot",
                `

<section class="hero">

    <div class="small">
        NORTH BOT
    </div>

    <h1>
        NORTH BOT
    </h1>

    <p>
        Eine moderne Plattform für
        Community, Support und Discord.
    </p>

    <div class="buttons">

        <a
            class="btn primary"
            href="${DISCORD_INVITE}"
            target="_blank"
        >
            💬 Discord beitreten
        </a>

        <a
            class="btn"
            href="/support"
        >
            🎫 Support
        </a>

        ${
            user
                ? `
                    <a
                        class="btn"
                        href="/dashboard"
                    >
                        👤 Mein Konto
                    </a>
                `
                : `
                    <a
                        class="btn"
                        href="/register"
                    >
                        📝 Konto erstellen
                    </a>
                `
        }

    </div>

</section>

                `,
                user
            )
        );

    }
);

// ============================================================
// REGISTER
// ============================================================

app.get(
    "/register",
    (req, res) => {

        res.send(
            layout(
                "Registrierung",
                `

<div class="container">

    <div class="box center">

        <h1>
            📝 Registrierung
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
                📝 Registrieren
            </button>

        </form>

    </div>

</div>

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
                layout(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="box center">

                            <h1>
                                ❌ Fehler
                            </h1>

                            <p>
                                Der Benutzername muss
                                3 bis 30 Zeichen lang sein.
                            </p>

                            <br>

                            <a
                                class="btn"
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
                layout(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="box center">

                            <h1>
                                ❌ Passwort zu kurz
                            </h1>

                            <p>
                                Das Passwort muss mindestens
                                8 Zeichen haben.
                            </p>

                            <br>

                            <a
                                class="btn"
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
                layout(
                    "Fehler",
                    `
                    <div class="container">
                        <div class="box center">

                            <h1>
                                ❌ Passwörter unterschiedlich
                            </h1>

                            <p>
                                Beide Passwörter müssen
                                identisch sein.
                            </p>

                            <br>

                            <a
                                class="btn"
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
            loadUsers();

        if (
            users.some(
                user =>
                    user.email === email
            )
        ) {

            return res.status(409).send(
                layout(
                    "Konto vorhanden",
                    `
                    <div class="container">
                        <div class="box center">

                            <h1>
                                ❌ Konto existiert bereits
                            </h1>

                            <p>
                                Diese E-Mail-Adresse
                                ist bereits registriert.
                            </p>

                            <br>

                            <a
                                class="btn"
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

        users.push(
            user
        );

        saveUsers(
            users
        );

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
            layout(
                "Anmelden",
                `

<div class="container">

    <div class="box center">

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
                class="btn primary"
                type="submit"
            >
                🔐 Anmelden
            </button>

        </form>

        <div class="buttons">

            <a
                class="btn"
                href="/register"
            >
                📝 Registrieren
            </a>

        </div>

    </div>

</div>

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
            loadUsers();

        const user =
            users.find(
                u =>
                    u.email === email
            );

        if (
            !user ||
            !checkPassword(
                password,
                user.password
            )
        ) {

            return res.status(401).send(
                layout(
                    "Login Fehler",
                    `
                    <div class="container">

                        <div class="box center">

                            <h1>
                                ❌ Login fehlgeschlagen
                            </h1>

                            <p>
                                E-Mail oder Passwort
                                ist falsch.
                            </p>

                            <br>

                            <a
                                class="btn"
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

        const user =
            getCurrentUser(req);

        const isOwner =
            user.email.toLowerCase() ===
            OWNER_EMAIL.toLowerCase();

        res.send(
            layout(
                "Dashboard",
                `

<div class="container">

    <div class="box">

        <h1>
            👋 Willkommen,
            ${esc(user.username)}
        </h1>

        <p>
            Dein persönlicher
            North-Bot-Bereich.
        </p>

        <div class="grid">

            <div class="stat">

                <span>
                    BENUTZERNAME
                </span>

                <strong>
                    ${esc(user.username)}
                </strong>

            </div>

            <div class="stat">

                <span>
                    E-MAIL
                </span>

                <strong>
                    ${esc(user.email)}
                </strong>

            </div>

            <div class="stat">

                <span>
                    ROLLE
                </span>

                <strong>
                    ${
                        isOwner
                            ? "👑 OWNER"
                            : "👤 USER"
                    }
                </strong>

            </div>

        </div>

        <div class="buttons">

            <a
                class="btn"
                href="/support"
            >
                🎫 Support
            </a>

            ${
                isOwner
                    ? `
                        <a
                            class="btn primary"
                            href="/admin"
                        >
                            👑 Admin Panel
                        </a>
                    `
                    : ""
            }

            <a
                class="btn"
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

        const user =
            getCurrentUser(req);

        res.send(
            layout(
                "Support",
                `

<div class="container">

    <div class="box">

        <h1>
            🎫 Support
        </h1>

        <p>
            Erstelle ein Support-Ticket.
            Die Nachricht wird an Discord
            weitergeleitet.
        </p>

        <form
            class="form"
            method="POST"
            action="/support"
        >

            <input
                name="subject"
                placeholder="Betreff"
                maxlength="100"
                required
            >

            <textarea
                name="message"
                placeholder="Beschreibe dein Problem..."
                maxlength="2000"
                required
            ></textarea>

            <button
                class="btn primary"
                type="submit"
            >
                🎫 Ticket senden
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
// SUPPORT POST
// ============================================================

app.post(
    "/support",
    requireLogin,
    async (req, res) => {

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
                2000
            );

        if (
            !subject ||
            !message
        ) {

            return res.status(400).send(
                layout(
                    "Fehler",
                    `
                    <div class="container">

                        <div class="box center">

                            <h1>
                                ❌ Ticket Fehler
                            </h1>

                            <p>
                                Bitte fülle alle Felder aus.
                            </p>

                            <br>

                            <a
                                class="btn"
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
            DISCORD_WEBHOOK_URL.includes(
                "DEIN_NEUER"
            )
        ) {

            return res.status(500).send(
                layout(
                    "Webhook fehlt",
                    `
                    <div class="container">

                        <div class="box center">

                            <h1>
                                ❌ Discord Webhook fehlt
                            </h1>

                            <p>
                                Trage deinen neuen Discord
                                Webhook oben in der
                                webseite.js ein.
                            </p>

                            <br>

                            <a
                                class="btn"
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

        try {

            const response =
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
                                            "Ein neues Support-Ticket wurde auf der North-Bot-Webseite erstellt.",

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
                                                    esc(
                                                        user.username
                                                    ),

                                                inline:
                                                    true
                                            },

                                            {
                                                name:
                                                    "📧 E-Mail",

                                                value:
                                                    esc(
                                                        user.email
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📌 Betreff",

                                                value:
                                                    esc(
                                                        subject
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📝 Nachricht",

                                                value:
                                                    esc(
                                                        message
                                                    ),

                                                inline:
                                                    false
                                            },

                                            {
                                                name:
                                                    "📁 Kategorie",

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

            if (!response.ok) {

                throw new Error(
                    "Discord HTTP " +
                    response.status
                );

            }

            res.send(
                layout(
                    "Ticket erstellt",
                    `
                    <div class="container">

                        <div class="box center">

                            <h1>
                                ✅ Ticket erstellt
                            </h1>

                            <p>
                                Dein Ticket wurde erfolgreich
                                an den North-Bot-Support
                                gesendet.
                            </p>

                            <br>

                            <p>
                                Ticket-ID:
                                <strong>
                                    ${esc(ticketId)}
                                </strong>
                            </p>

                            <div class="buttons">

                                <a
                                    class="btn primary"
                                    href="/dashboard"
                                >
                                    👤 Dashboard
                                </a>

                                <a
                                    class="btn"
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
                "Ticket Fehler:",
                error
            );

            res.status(500).send(
                layout(
                    "Ticket Fehler",
                    `
                    <div class="container">

                        <div class="box center">

                            <h1>
                                ❌ Ticket konnte nicht gesendet werden
                            </h1>

                            <p>
                                Discord konnte nicht
                                erreicht werden.
                            </p>

                            <br>

                            <a
                                class="btn"
                                href="/support"
                            >
                                Erneut versuchen
                            </a>

                        </div>

                    </div>
                    `,
                    user
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

        const user =
            getCurrentUser(req);

        const users =
            loadUsers();

        res.send(
            layout(
                "Admin Panel",
                `

<div class="container">

    <div class="box">

        <h1>
            👑 Admin Panel
        </h1>

        <p>
            North-Bot-Verwaltung
        </p>

        <div class="grid">

            <div class="stat">

                <span>
                    STATUS
                </span>

                <strong>
                    🟢 ONLINE
                </strong>

            </div>

            <div class="stat">

                <span>
                    BENUTZER
                </span>

                <strong>
                    ${users.length}
                </strong>

            </div>

            <div class="stat">

                <span>
                    SUPPORT
                </span>

                <strong>
                    🟢 AKTIV
                </strong>

            </div>

            <div class="stat">

                <span>
                    OWNER
                </span>

                <strong>
                    Florian
                </strong>

            </div>

        </div>

        <div
            class="box"
            style="margin-top:20px;"
        >

            <h2>
                ⚙️ System
            </h2>

            <br>

            <p>
                Kategorie-ID:
                ${TICKET_CATEGORY_ID}
            </p>

            <p>
                Owner:
                ${OWNER_EMAIL}
            </p>

            <p>
                Discord:
                aktiv
            </p>

        </div>

        <div class="buttons">

            <a
                class="btn"
                href="/dashboard"
            >
                👤 Dashboard
            </a>

            <a
                class="btn"
                href="/"
            >
                🏠 Startseite
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
// HEALTH
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "online",

            name:
                "North Bot",

            support:
                "online",

            authentication:
                "online",

            admin:
                "online"

        });

    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).send(
            layout(
                "404",
                `
                <div class="container">

                    <div class="box center">

                        <div class="errorIcon">
                            404
                        </div>

                        <h1>
                            Seite nicht gefunden
                        </h1>

                        <p>
                            Diese Seite existiert
                            nicht.
                        </p>

                        <br>

                        <a
                            class="btn"
                            href="/"
                        >
                            🏠 Startseite
                        </a>

                    </div>

                </div>
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
            "           NORTH BOT WEBSITE"
        );

        console.log(
            "======================================"
        );

        console.log(
            "🟢 Server gestartet"
        );

        console.log(
            "🌐 North Bot"
        );

        console.log(
            "🔐 Login aktiv"
        );

        console.log(
            "📝 Registrierung aktiv"
        );

        console.log(
            "🎫 Support aktiv"
        );

        console.log(
            "👑 Admin Panel aktiv"
        );

        console.log(
            `📁 Kategorie: ${TICKET_CATEGORY_ID}`
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            "======================================"
        );

    }
);
```
