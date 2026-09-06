const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
====================================================
 MINECRAFT HOSTING WEBSITE
 - Registrierung
 - Anmeldung
 - Abmelden
 - Benutzerkonto
 - Passwort-Hashing
 - Chat
 - Minecraft Design
 - Mobile Design
====================================================
*/

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2)
            );
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error("JSON-LeseFehler:", error);
        return fallback;
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2)
        );
        return true;
    } catch (error) {
        console.error("JSON-Schreibfehler:", error);
        return false;
    }
}

let users = readJSON(USERS_FILE, []);
let chatMessages = readJSON(CHAT_FILE, []);

const sessions = new Map();

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
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

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

function getUserFromRequest(req) {
    const token = req.headers.authorization?.replace(
        "Bearer ",
        ""
    );

    if (!token) {
        return null;
    }

    const username = sessions.get(token);

    if (!username) {
        return null;
    }

    return users.find(
        user => user.username === username
    ) || null;
}

/*
====================================================
 REGISTRIERUNG
====================================================
*/

app.post("/api/register", (req, res) => {
    const username = String(
        req.body.username || ""
    ).trim();

    const email = String(
        req.body.email || ""
    ).trim()
    .toLowerCase();

    const password = String(
        req.body.password || ""
    );

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Bitte alle Felder ausfüllen."
        });
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        return res.status(400).json({
            success: false,
            message:
                "Der Benutzername muss 3–24 Zeichen haben."
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message:
                "Das Passwort muss mindestens 8 Zeichen haben."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            success: false,
            message:
                "Bitte eine gültige E-Mail-Adresse eingeben."
        });
    }

    const existingUsername = users.find(
        user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
    );

    if (existingUsername) {
        return res.status(409).json({
            success: false,
            message:
                "Dieser Benutzername ist bereits vergeben."
        });
    }

    const existingEmail = users.find(
        user =>
            user.email.toLowerCase() === email
    );

    if (existingEmail) {
        return res.status(409).json({
            success: false,
            message:
                "Diese E-Mail-Adresse ist bereits registriert."
        });
    }

    const newUser = {
        id: crypto.randomUUID(),
        username,
        email,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    if (!writeJSON(USERS_FILE, users)) {
        users = users.filter(
            user => user.id !== newUser.id
        );

        return res.status(500).json({
            success: false,
            message:
                "Benutzer konnte nicht gespeichert werden."
        });
    }

    console.log(
        `👤 Neuer Benutzer registriert: ${username}`
    );

    return res.json({
        success: true,
        message:
            "Registrierung erfolgreich. Du kannst dich jetzt anmelden."
    });
});

/*
====================================================
 ANMELDUNG
====================================================
*/

app.post("/api/login", (req, res) => {
    const login = String(
        req.body.login || ""
    ).trim();

    const password = String(
        req.body.password || ""
    );

    if (!login || !password) {
        return res.status(400).json({
            success: false,
            message:
                "Bitte Benutzername/E-Mail und Passwort eingeben."
        });
    }

    const user = users.find(
        item =>
            item.username.toLowerCase() ===
                login.toLowerCase() ||
            item.email.toLowerCase() ===
                login.toLowerCase()
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Benutzername/E-Mail oder Passwort ist falsch."
        });
    }

    if (!checkPassword(password, user.password)) {
        return res.status(401).json({
            success: false,
            message:
                "Benutzername/E-Mail oder Passwort ist falsch."
        });
    }

    const token = createToken();

    sessions.set(
        token,
        user.username
    );

    console.log(
        `🔐 Anmeldung: ${user.username}`
    );

    return res.json({
        success: true,
        message: "Erfolgreich angemeldet.",
        token,
        user: {
            username: user.username,
            email: user.email
        }
    });
});

/*
====================================================
 ABMELDEN
====================================================
*/

app.post("/api/logout", (req, res) => {
    const token =
        req.headers.authorization?.replace(
            "Bearer ",
            ""
        );

    if (token) {
        sessions.delete(token);
    }

    res.json({
        success: true,
        message: "Abgemeldet."
    });
});

/*
====================================================
 BENUTZER
====================================================
*/

app.get("/api/me", (req, res) => {
    const user =
        getUserFromRequest(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Nicht angemeldet."
        });
    }

    res.json({
        success: true,
        user: {
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        }
    });
});

/*
====================================================
 CHAT NACHRICHTEN LADEN
====================================================
*/

app.get("/api/chat", (req, res) => {
    res.json({
        success: true,
        messages: chatMessages.slice(-100)
    });
});

/*
====================================================
 CHAT NACHRICHT SENDEN

 Für den Chat muss man angemeldet sein.
====================================================
*/

app.post("/api/chat", (req, res) => {
    const user =
        getUserFromRequest(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Du musst angemeldet sein, um zu schreiben."
        });
    }

    const text = String(
        req.body.text || ""
    ).trim();

    if (!text) {
        return res.status(400).json({
            success: false,
            message:
                "Die Nachricht darf nicht leer sein."
        });
    }

    if (text.length > 300) {
        return res.status(400).json({
            success: false,
            message:
                "Die Nachricht darf maximal 300 Zeichen haben."
        });
    }

    const message = {
        id: crypto.randomUUID(),
        username: user.username,
        text,
        createdAt: new Date().toISOString()
    };

    chatMessages.push(message);

    if (chatMessages.length > 500) {
        chatMessages =
            chatMessages.slice(-500);
    }

    writeJSON(
        CHAT_FILE,
        chatMessages
    );

    console.log(
        `💬 ${user.username}: ${text}`
    );

    res.json({
        success: true,
        message
    });
});

/*
====================================================
 WEBSITE
====================================================
*/

app.get("/", (req, res) => {

res.send(`<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<meta
    name="theme-color"
    content="#07120a"
>

<title>Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html,
body {
    width: 100%;
    min-height: 100%;
}

body {
    min-height: 100vh;
    min-height: 100dvh;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at 50% 30%,
            rgba(44, 135, 52, .25),
            transparent 45%
        ),
        linear-gradient(
            180deg,
            #02050a,
            #071209 55%,
            #020602
        );

    overflow-x: hidden;
}

button,
input {
    font: inherit;
}

button {
    cursor: pointer;
}

/* =========================================
   STERNE
========================================= */

#stars {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
}

/* =========================================
   MOND
========================================= */

.moon {
    position: fixed;

    width: 85px;
    height: 85px;

    right: 9%;
    top: 8%;

    border-radius: 50%;

    background:
        radial-gradient(
            circle at 35% 30%,
            #fff,
            #ddd 55%,
            #888
        );

    box-shadow:
        0 0 30px
        rgba(255,255,255,.3);

    opacity: .85;

    z-index: 1;

    animation:
        moonFloat 6s ease-in-out infinite;
}

@keyframes moonFloat {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(10px);
    }
}

/* =========================================
   PARTIKEL
========================================= */

#particles {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
}

.particle {
    position: absolute;

    width: 4px;
    height: 4px;

    background: #55c64b;

    box-shadow:
        0 0 8px
        rgba(85,198,75,.8);

    animation:
        particleMove linear infinite;
}

@keyframes particleMove {

    from {
        transform:
            translateY(105vh);

        opacity: 0;
    }

    20% {
        opacity: .8;
    }

    80% {
        opacity: .8;
    }

    to {
        transform:
            translateY(-20vh)
            translateX(70px);

        opacity: 0;
    }
}

/* =========================================
   NAVIGATION
========================================= */

.navbar {

    position: relative;

    z-index: 20;

    width: 100%;

    min-height: 70px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding:
        12px 25px;

    border-bottom:
        1px solid
        rgba(85,190,80,.2);

    background:
        rgba(2,8,3,.78);

    backdrop-filter:
        blur(12px);
}

.logo {

    display: flex;

    align-items: center;

    gap: 10px;

    font-size: 20px;

    font-weight: 900;
}

.logoIcon {

    width: 38px;
    height: 38px;

    display: flex;

    align-items: center;
    justify-content: center;

    background:
        linear-gradient(
            135deg,
            #55b947,
            #26772c
        );

    border:
        3px solid
        #183b1b;

    font-size: 20px;
}

.navButtons {

    display: flex;

    gap: 8px;
}

.navButton {

    padding:
        10px 15px;

    border:
        1px solid
        rgba(90,190,80,.3);

    border-radius: 6px;

    background:
        rgba(40,100,42,.35);

    color: white;

    transition:
        .2s;
}

.navButton:hover {

    background:
        rgba(70,150,65,.5);

    transform:
        translateY(-2px);
}

/* =========================================
   HAUPTBEREICH
========================================= */

.container {

    position: relative;

    z-index: 5;

    width:
        min(
            calc(100% - 30px),
            850px
        );

    margin:
        8vh auto 40px;

    padding:
        50px 35px;

    text-align: center;

    border:
        3px solid
        rgba(82,180,74,.35);

    border-radius: 8px;

    background:
        linear-gradient(
            145deg,
            rgba(7,15,8,.94),
            rgba(10,22,12,.84)
        );

    box-shadow:
        0 30px 100px
        rgba(0,0,0,.7),

        0 0 60px
        rgba(50,180,70,.08);

    backdrop-filter:
        blur(12px);
}

.minecraftIcon {

    width: 100px;
    height: 100px;

    margin:
        0 auto 20px;

    display: flex;

    align-items: center;
    justify-content: center;

    background:
        linear-gradient(
            135deg,
            #55b947,
            #26772c
        );

    border:
        5px solid
        #163d18;

    box-shadow:
        inset 0 8px 0
        rgba(255,255,255,.12),

        inset 0 -8px 0
        rgba(0,0,0,.25),

        0 12px 25px
        rgba(0,0,0,.5);

    animation:
        iconFloat 3s ease-in-out infinite;
}

.minecraftIcon span {
    font-size: 48px;
}

@keyframes iconFloat {

    0%,
    100% {
        transform:
            translateY(0);
    }

    50% {
        transform:
            translateY(-10px);
    }
}

h1 {

    font-size:
        clamp(
            34px,
            7vw,
            68px
        );

    line-height: 1.05;

    font-weight: 900;

    text-shadow:
        4px 4px 0 #183b1b,
        0 0 30px
        rgba(76,220,82,.25);
}

.description {

    margin-top: 20px;

    color: #b8c5b8;

    font-size:
        clamp(
            15px,
            3vw,
            19px
        );

    line-height: 1.7;
}

/* =========================================
   LOGIN / REGISTER MODAL
========================================= */

.modal {

    position: fixed;

    inset: 0;

    z-index: 200;

    display: none;

    align-items: center;
    justify-content: center;

    padding: 15px;

    background:
        rgba(0,0,0,.72);

    backdrop-filter:
        blur(8px);
}

.modal.active {
    display: flex;
}

.modalBox {

    width:
        min(
            100%,
            430px
        );

    padding: 28px;

    border:
        2px solid
        rgba(85,185,71,.45);

    border-radius: 10px;

    background:
        #071008;

    box-shadow:
        0 25px 80px
        rgba(0,0,0,.8);

    animation:
        modalOpen .2s ease;
}

@keyframes modalOpen {

    from {
        opacity: 0;
        transform:
            scale(.94)
            translateY(15px);
    }

    to {
        opacity: 1;
        transform:
            scale(1)
            translateY(0);
    }
}

.modalHeader {

    display: flex;

    align-items: center;

    justify-content: space-between;

    margin-bottom: 20px;
}

.modalHeader h2 {
    font-size: 24px;
}

.close {

    width: 35px;
    height: 35px;

    border: 0;

    border-radius: 5px;

    background:
        rgba(255,255,255,.08);

    color: white;

    font-size: 22px;
}

.formGroup {
    margin-bottom: 14px;
}

.formGroup label {

    display: block;

    margin-bottom: 6px;

    color: #b8c5b8;

    font-size: 13px;
}

.formGroup input {

    width: 100%;

    height: 45px;

    padding:
        0 12px;

    border:
        1px solid
        rgba(255,255,255,.14);

    border-radius: 5px;

    outline: none;

    background:
        #111a12;

    color: white;
}

.formGroup input:focus {

    border-color:
        #55b947;

    box-shadow:
        0 0 10px
        rgba(85,185,71,.15);
}

.primaryButton {

    width: 100%;

    min-height: 46px;

    border: 0;

    border-radius: 5px;

    background:
        linear-gradient(
            135deg,
            #55b947,
            #2f8434
        );

    color: white;

    font-weight: 800;

    transition:
        .2s;
}

.primaryButton:hover {

    filter:
        brightness(1.12);

    transform:
        translateY(-1px);
}

.switchText {

    margin-top: 15px;

    text-align: center;

    color: #98a498;

    font-size: 13px;
}

.switchText button {

    border: 0;

    background: transparent;

    color: #66d45d;

    font-weight: bold;
}

.message {

    display: none;

    margin-bottom: 15px;

    padding: 10px;

    border-radius: 5px;

    background:
        rgba(255,255,255,.06);

    color: #d7e2d7;

    font-size: 13px;
}

.message.show {
    display: block;
}

/* =========================================
   USER PANEL
========================================= */

.userPanel {

    display: none;

    position: fixed;

    top: 80px;
    right: 20px;

    z-index: 150;

    width:
        min(
            calc(100% - 40px),
            300px
        );

    padding: 20px;

    border:
        2px solid
        rgba(85,185,71,.35);

    border-radius: 8px;

    background:
        rgba(5,14,7,.97);

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.7);
}

.userPanel.active {
    display: block;
}

.userPanel h3 {
    margin-bottom: 8px;
}

.userEmail {

    color: #8fa08f;

    font-size: 13px;

    margin-bottom: 15px;
}

.logoutButton {

    width: 100%;

    padding: 10px;

    border:
        1px solid
        rgba(255,80,80,.3);

    border-radius: 5px;

    background:
        rgba(120,20,20,.3);

    color: white;
}

/* =========================================
   CHAT BUTTON
========================================= */

.chatButton {

    position: fixed;

    right: 20px;
    bottom: 20px;

    z-index: 100;

    width: 62px;
    height: 62px;

    border:
        3px solid
        #183b1b;

    border-radius: 8px;

    background:
        linear-gradient(
            135deg,
            #55b947,
            #26772c
        );

    color: white;

    font-size: 27px;

    box-shadow:
        0 8px 25px
        rgba(0,0,0,.55);

    transition:
        .2s;
}

.chatButton:hover {

    transform:
        scale(1.08);
}

/* =========================================
   CHAT
========================================= */

.chat {

    position: fixed;

    right: 20px;
    bottom: 95px;

    z-index: 99;

    width:
        min(
            calc(100% - 30px),
            390px
        );

    height: 500px;

    display: none;

    flex-direction: column;

    overflow: hidden;

    border:
        3px solid
        rgba(82,180,74,.45);

    border-radius: 10px;

    background:
        rgba(5,12,7,.98);

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.75);
}

.chat.active {
    display: flex;
}

.chatHeader {

    min-height: 60px;

    display: flex;

    align-items: center;
    justify-content: space-between;

    padding:
        0 15px;

    background:
        linear-gradient(
            90deg,
            #1d5c25,
            #2f8735
        );
}

.chatTitle {
    font-weight: 800;
}

.chatStatus {

    color: #b9ffae;

    font-size: 11px;
}

.messages {

    flex: 1;

    overflow-y: auto;

    padding: 14px;

    display: flex;

    flex-direction: column;

    gap: 9px;
}

.chatMessage {

    padding:
        9px 11px;

    border-left:
        3px solid
        #4fae47;

    border-radius: 6px;

    background:
        rgba(255,255,255,.06);
}

.chatName {

    color: #73d96b;

    font-size: 12px;

    font-weight: bold;

    margin-bottom: 3px;
}

.chatText {

    color: #eee;

    font-size: 14px;

    word-break: break-word;
}

.chatDate {

    margin-top: 4px;

    color: #6f7d70;

    font-size: 9px;
}

.chatInputArea {

    display: flex;

    gap: 7px;

    padding: 10px;

    border-top:
        2px solid
        rgba(255,255,255,.08);
}

.chatInput {

    flex: 1;

    min-width: 0;

    height: 44px;

    padding:
        0 12px;

    border:
        1px solid
        rgba(255,255,255,.15);

    border-radius: 5px;

    outline: none;

    background:
        #111a12;

    color: white;
}

.sendButton {

    width: 48px;

    border: 0;

    border-radius: 5px;

    background:
        #3d8f38;

    color: white;

    font-size: 19px;
}

/* =========================================
   MOBILE
========================================= */

@media (max-width: 600px) {

    .navbar {

        padding:
            10px 12px;
    }

    .logo {

        font-size: 16px;
    }

    .logoIcon {

        width: 34px;
        height: 34px;
    }

    .navButton {

        padding:
            8px 10px;

        font-size: 12px;
    }

    .container {

        width:
            calc(100% - 20px);

        margin-top:
            7vh;

        padding:
            38px 18px;
    }

    .minecraftIcon {

        width: 78px;
        height: 78px;
    }

    .minecraftIcon span {
        font-size: 38px;
    }

    h1 {
        letter-spacing: -1px;
    }

    .moon {

        width: 55px;
        height: 55px;

        top: 9%;
        right: 5%;
    }

    .chat {

        right: 10px;
        bottom: 84px;

        width:
            calc(100% - 20px);

        height:
            min(
                70vh,
                500px
            );
    }

    .chatButton {

        right: 12px;
        bottom: 12px;
    }
}

</style>

</head>

<body>

<canvas id="stars"></canvas>

<div class="moon"></div>

<div id="particles"></div>


<!-- =========================================
     NAVIGATION
========================================= -->

<nav class="navbar">

    <div class="logo">

        <div class="logoIcon">
            ⛏️
        </div>

        Minecraft Hosting

    </div>

    <div
        class="navButtons"
        id="navButtons"
    >

        <button
            class="navButton"
            onclick="openLogin()"
        >
            🔑 Anmeldung
        </button>

        <button
            class="navButton"
            onclick="openRegister()"
        >
            📝 Registrierung
        </button>

    </div>

</nav>


<!-- =========================================
     HAUPTBOX
========================================= -->

<main class="container">

    <div class="minecraftIcon">
        <span>⛏️</span>
    </div>

    <h1>
        Die Webseite kommt bald!
    </h1>

    <p class="description">
        Unser Minecraft-Projekt wird gerade aufgebaut.
        <br>
        Schau bald wieder vorbei!
    </p>

</main>


<!-- =========================================
     USER PANEL
========================================= -->

<div
    class="userPanel"
    id="userPanel"
>

    <h3 id="userName">
        Benutzer
    </h3>

    <div
        class="userEmail"
        id="userEmail"
    ></div>

    <button
        class="logoutButton"
        onclick="logout()"
    >
        🚪 Abmelden
    </button>

</div>


<!-- =========================================
     LOGIN MODAL
========================================= -->

<div
    class="modal"
    id="loginModal"
>

    <div class="modalBox">

        <div class="modalHeader">

            <h2>
                🔑 Anmeldung
            </h2>

            <button
                class="close"
                onclick="closeModals()"
            >
                ×
            </button>

        </div>

        <div
            class="message"
            id="loginMessage"
        ></div>

        <form
            id="loginForm"
        >

            <div class="formGroup">

                <label>
                    Benutzername oder E-Mail
                </label>

                <input
                    id="loginUser"
                    type="text"
                    required
                    autocomplete="username"
                    placeholder="Benutzername oder E-Mail"
                >

            </div>

            <div class="formGroup">

                <label>
                    Passwort
                </label>

                <input
                    id="loginPassword"
                    type="password"
                    required
                    autocomplete="current-password"
                    placeholder="Passwort"
                >

            </div>

            <button
                class="primaryButton"
                type="submit"
            >
                🔐 Anmelden
            </button>

        </form>

        <div class="switchText">

            Noch kein Konto?

            <button
                onclick="switchToRegister()"
            >
                Jetzt registrieren
            </button>

        </div>

    </div>

</div>


<!-- =========================================
     REGISTER MODAL
========================================= -->

<div
    class="modal"
    id="registerModal"
>

    <div class="modalBox">

        <div class="modalHeader">

            <h2>
                📝 Registrierung
            </h2>

            <button
                class="close"
                onclick="closeModals()"
            >
                ×
            </button>

        </div>

        <div
            class="message"
            id="registerMessage"
        ></div>

        <form
            id="registerForm"
        >

            <div class="formGroup">

                <label>
                    Benutzername
                </label>

                <input
                    id="registerUser"
                    type="text"
                    required
                    maxlength="24"
                    autocomplete="username"
                    placeholder="z.B. Steve"
                >

            </div>

            <div class="formGroup">

                <label>
                    E-Mail
                </label>

                <input
                    id="registerEmail"
                    type="email"
                    required
                    autocomplete="email"
                    placeholder="name@example.com"
                >

            </div>

            <div class="formGroup">

                <label>
                    Passwort
                </label>

                <input
                    id="registerPassword"
                    type="password"
                    required
                    minlength="8"
                    autocomplete="new-password"
                    placeholder="Mindestens 8 Zeichen"
                >

            </div>

            <button
                class="primaryButton"
                type="submit"
            >
                🚀 Konto erstellen
            </button>

        </form>

        <div class="switchText">

            Bereits registriert?

            <button
                onclick="switchToLogin()"
            >
                Jetzt anmelden
            </button>

        </div>

    </div>

</div>


<!-- =========================================
     CHAT BUTTON
========================================= -->

<button
    class="chatButton"
    onclick="toggleChat()"
>
    💬
</button>


<!-- =========================================
     CHAT
========================================= -->

<section
    class="chat"
    id="chat"
>

    <header class="chatHeader">

        <div>

            <div class="chatTitle">
                💬 Community Chat
            </div>

            <div class="chatStatus">
                ● Online
            </div>

        </div>

        <button
            class="close"
            onclick="toggleChat()"
        >
            ×
        </button>

    </header>

    <div
        class="messages"
        id="messages"
    ></div>

    <form
        class="chatInputArea"
        id="chatForm"
    >

        <input
            id="chatInput"
            class="chatInput"
            maxlength="300"
            placeholder="Nachricht schreiben..."
            autocomplete="off"
        >

        <button
            class="sendButton"
            type="submit"
        >
            ➤
        </button>

    </form>

</section>


<script>

/* =========================================
   LOGIN TOKEN
========================================= */

let token =
    localStorage.getItem(
        "minecraftHostingToken"
    );


/* =========================================
   MODALS
========================================= */

function openLogin() {

    document
        .getElementById("registerModal")
        .classList.remove("active");

    document
        .getElementById("loginModal")
        .classList.add("active");

    clearMessages();
}

function openRegister() {

    document
        .getElementById("loginModal")
        .classList.remove("active");

    document
        .getElementById("registerModal")
        .classList.add("active");

    clearMessages();
}

function closeModals() {

    document
        .getElementById("loginModal")
        .classList.remove("active");

    document
        .getElementById("registerModal")
        .classList.remove("active");
}

function switchToRegister() {
    openRegister();
}

function switchToLogin() {
    openLogin();
}

function clearMessages() {

    document
        .getElementById("loginMessage")
        .classList.remove("show");

    document
        .getElementById("registerMessage")
        .classList.remove("show");
}

function showMessage(
    elementId,
    text
) {

    const element =
        document.getElementById(
            elementId
        );

    element.textContent = text;

    element.classList.add(
        "show"
    );
}


/* =========================================
   REGISTRIERUNG
========================================= */

document
    .getElementById("registerForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const username =
                document
                    .getElementById(
                        "registerUser"
                    )
                    .value
                    .trim();

            const email =
                document
                    .getElementById(
                        "registerEmail"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "registerPassword"
                    )
                    .value;

            try {

                const response =
                    await fetch(
                        "/api/register",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    username,
                                    email,
                                    password
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!data.success) {

                    showMessage(
                        "registerMessage",
                        data.message
                    );

                    return;
                }

                showMessage(
                    "registerMessage",
                    "✅ " + data.message
                );

                document
                    .getElementById(
                        "registerForm"
                    )
                    .reset();

                setTimeout(
                    openLogin,
                    1200
                );

            } catch (error) {

                showMessage(
                    "registerMessage",
                    "❌ Serverfehler. Bitte später erneut versuchen."
                );

                console.error(
                    error
                );
            }
        }
    );


/* =========================================
   ANMELDUNG
========================================= */

document
    .getElementById("loginForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const login =
                document
                    .getElementById(
                        "loginUser"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    .value;

            try {

                const response =
                    await fetch(
                        "/api/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    login,
                                    password
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!data.success) {

                    showMessage(
                        "loginMessage",
                        "❌ " + data.message
                    );

                    return;
                }

                token =
                    data.token;

                localStorage.setItem(
                    "minecraftHostingToken",
                    token
                );

                document
                    .getElementById(
                        "loginForm"
                    )
                    .reset();

                closeModals();

                updateUserInterface();

                loadChat();

            } catch (error) {

                showMessage(
                    "loginMessage",
                    "❌ Serverfehler."
                );

                console.error(
                    error
                );
            }
        }
    );


/* =========================================
   BENUTZER UI
========================================= */

async function updateUserInterface() {

    if (!token) {

        document
            .getElementById(
                "navButtons"
            )
            .style.display = "flex";

        document
            .getElementById(
                "userPanel"
            )
            .classList.remove(
                "active"
            );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    headers: {
                        Authorization:
                            "Bearer " +
                            token
                    }
                }
            );

        if (!response.ok) {

            token = null;

            localStorage.removeItem(
                "minecraftHostingToken"
            );

            updateUserInterface();

            return;
        }

        const data =
            await response.json();

        document
            .getElementById(
                "navButtons"
            )
            .innerHTML = \`
                <button
                    class="navButton"
                    onclick="toggleUserPanel()"
                >
                    👤 \${escapeHtml(data.user.username)}
                </button>
            \`;

        document
            .getElementById(
                "userName"
            )
            .textContent =
                "👤 " +
                data.user.username;

        document
            .getElementById(
                "userEmail"
            )
            .textContent =
                data.user.email;

    } catch {

        console.error(
            "Benutzer konnte nicht geladen werden."
        );
    }
}

function toggleUserPanel() {

    document
        .getElementById(
            "userPanel"
        )
        .classList.toggle(
            "active"
        );
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    try {

        await fetch(
            "/api/logout",
            {
                method: "POST",

                headers: {
                    Authorization:
                        "Bearer " +
                        token
                }
            }
        );

    } catch {}

    token = null;

    localStorage.removeItem(
        "minecraftHostingToken"
    );

    document
        .getElementById(
            "userPanel"
        )
        .classList.remove(
            "active"
        );

    document
        .getElementById(
            "navButtons"
        )
        .innerHTML = \`
            <button
                class="navButton"
                onclick="openLogin()"
            >
                🔑 Anmeldung
            </button>

            <button
                class="navButton"
                onclick="openRegister()"
            >
                📝 Registrierung
            </button>
        \`;

    loadChat();
}


/* =========================================
   CHAT
========================================= */

function toggleChat() {

    const chat =
        document.getElementById(
            "chat"
        );

    chat.classList.toggle(
        "active"
    );

    if (
        chat.classList.contains(
            "active"
        )
    ) {

        loadChat();

        document
            .getElementById(
                "chatInput"
            )
            .focus();
    }
}

async function loadChat() {

    try {

        const response =
            await fetch(
                "/api/chat"
            );

        const data =
            await response.json();

        const messages =
            document.getElementById(
                "messages"
            );

        messages.innerHTML = "";

        if (
            !data.messages.length
        ) {

            messages.innerHTML =
                \`
                <div class="chatMessage">
                    <div class="chatName">
                        System
                    </div>
                    <div class="chatText">
                        Noch keine Nachrichten. 👋
                    </div>
                </div>
                \`;

            return;
        }

        for (
            const message
            of data.messages
        ) {

            addChatMessage(
                message
            );
        }

    } catch (error) {

        console.error(
            "Chat konnte nicht geladen werden:",
            error
        );
    }
}

function addChatMessage(
    message
) {

    const container =
        document.getElementById(
            "messages"
        );

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "chatMessage";

    element.innerHTML = \`
        <div class="chatName">
            \${escapeHtml(message.username)}
        </div>

        <div class="chatText">
            \${escapeHtml(message.text)}
        </div>

        <div class="chatDate">
            \${formatDate(message.createdAt)}
        </div>
    \`;

    container.appendChild(
        element
    );

    container.scrollTop =
        container.scrollHeight;
}


/* =========================================
   CHAT SENDEN
========================================= */

document
    .getElementById("chatForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (!token) {

                openLogin();

                showMessage(
                    "loginMessage",
                    "🔐 Bitte melde dich an, um im Chat zu schreiben."
                );

                return;
            }

            const input =
                document.getElementById(
                    "chatInput"
                );

            const text =
                input.value.trim();

            if (!text) {
                return;
            }

            try {

                const response =
                    await fetch(
                        "/api/chat",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    "Bearer " +
                                    token
                            },

                            body:
                                JSON.stringify({
                                    text
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!data.success) {

                    if (
                        response.status === 401
                    ) {

                        token = null;

                        localStorage.removeItem(
                            "minecraftHostingToken"
                        );

                        openLogin();

                    } else {

                        alert(
                            data.message
                        );
                    }

                    return;
                }

                input.value = "";

                addChatMessage(
                    data.message
                );

            } catch (error) {

                console.error(
                    error
                );

                alert(
                    "❌ Nachricht konnte nicht gesendet werden."
                );
            }
        }
    );


/* =========================================
   HTML SICHER MACHEN
========================================= */

function escapeHtml(
    value
) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(
    date
) {

    try {

        return new Date(
            date
        ).toLocaleString(
            "de-DE",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );

    } catch {

        return "";
    }
}


/* =========================================
   STERNE
========================================= */

const canvas =
    document.getElementById(
        "stars"
    );

const ctx =
    canvas.getContext(
        "2d"
    );

let stars = [];

let width = 0;
let height = 0;

function resizeCanvas() {

    width =
        window.innerWidth;

    height =
        window.innerHeight;

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;

    canvas.style.width =
        width + "px";

    canvas.style.height =
        height + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    createStars();
}

function createStars() {

    stars = [];

    const amount =
        Math.min(
            180,
            Math.floor(
                width * height / 7500
            )
        );

    for (
        let i = 0;
        i < amount;
        i++
    ) {

        stars.push({

            x:
                Math.random() *
                width,

            y:
                Math.random() *
                height,

            size:
                Math.random() *
                1.8 + .3,

            speed:
                Math.random() *
                .35 + .05,

            opacity:
                Math.random() *
                .7 + .2,

            twinkle:
                Math.random() *
                Math.PI * 2
        });
    }
}

function animateStars() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    for (
        const star of stars
    ) {

        star.y +=
            star.speed;

        star.twinkle +=
            .015;

        if (
            star.y >
            height + 5
        ) {

            star.y = -5;

            star.x =
                Math.random() *
                width;
        }

        const alpha =
            Math.max(
                .1,
                Math.min(
                    1,
                    star.opacity +
                    Math.sin(
                        star.twinkle
                    ) * .15
                )
            );

        ctx.beginPath();

        ctx.fillStyle =
            "rgba(255,255,255," +
            alpha +
            ")";

        ctx.arc(
            star.x,
            star.y,
            star.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    requestAnimationFrame(
        animateStars
    );
}

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();

requestAnimationFrame(
    animateStars
);


/* =========================================
   PARTIKEL
========================================= */

const particleContainer =
    document.getElementById(
        "particles"
    );

for (
    let i = 0;
    i < 35;
    i++
) {

    const particle =
        document.createElement(
            "div"
        );

    particle.className =
        "particle";

    particle.style.left =
        Math.random() * 100 +
        "%";

    particle.style.animationDuration =
        (
            Math.random() * 12 + 8
        ) +
        "s";

    particle.style.animationDelay =
        -(
            Math.random() * 15
        ) +
        "s";

    particleContainer.appendChild(
        particle
    );
}


/* =========================================
   START
========================================= */

updateUserInterface();

loadChat();

</script>

</body>

</html>`);

});


/*
====================================================
 SERVER START
====================================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "⛏️ Minecraft Hosting Webseite"
        );

        console.log(
            "======================================"
        );

        console.log(
            "🌐 Port: " + PORT
        );

        console.log(
            "🔐 Anmeldung: AKTIV"
        );

        console.log(
            "📝 Registrierung: AKTIV"
        );

        console.log(
            "💬 Chat: AKTIV"
        );

        console.log(
            "⭐ Sterne: AKTIV"
        );

        console.log(
            "📱 Mobile: AKTIV"
        );

        console.log(
            "🎵 Musik: DEAKTIVIERT"
        );

        console.log(
            "======================================"
        );
    }
);
