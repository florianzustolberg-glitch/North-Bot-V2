"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const SERVERS_DIR = path.join(__dirname, "minecraft-servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const LOG_FILE = path.join(DATA_DIR, "logs.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVERS_DIR, { recursive: true });

function createFile(file, value) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(value, null, 2));
    }
}

createFile(USERS_FILE, []);
createFile(ORDERS_FILE, []);
createFile(SERVERS_FILE, []);
createFile(LOG_FILE, []);
createFile(SETTINGS_FILE, {
    maintenance: false,
    maintenanceText: "Die Webseite befindet sich momentan im Wartungsmodus."
});

function read(file, fallback = []) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function write(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function users() {
    return read(USERS_FILE, []);
}

function orders() {
    return read(ORDERS_FILE, []);
}

function servers() {
    return read(SERVERS_FILE, []);
}

function logs() {
    return read(LOG_FILE, []);
}

function settings() {
    return read(SETTINGS_FILE, {
        maintenance: false,
        maintenanceText: ""
    });
}

function log(type, message) {
    const data = logs();

    data.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        date: new Date().toISOString()
    });

    if (data.length > 1000) {
        data.length = 1000;
    }

    write(LOG_FILE, data);

    console.log(
        `[${type}] ${message}`
    );
}

function escape(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "CHANGE_THIS_SECRET",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

function currentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return users().find(
        user => user.id === req.session.userId
    ) || null;
}

function isAdmin(req) {
    const user = currentUser(req);

    return Boolean(
        user &&
        user.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
    );
}

function loginRequired(req, res, next) {
    if (!currentUser(req)) {
        return res.redirect("/login");
    }

    next();
}

function adminRequired(req, res, next) {
    if (!isAdmin(req)) {
        return res.status(403).send(
            page(
                "Kein Zugriff",
                `
                <div class="card center">
                    <h1>403</h1>
                    <p>Du hast keinen Zugriff auf diesen Bereich.</p>
                    <a class="button" href="/">Home</a>
                </div>
                `,
                req
            )
        );
    }

    next();
}

function page(title, content, req) {
    const user = currentUser(req);

    return `
<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>${escape(title)} | Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    background:
        radial-gradient(
            circle at top,
            #17351d,
            #080808 55%
        );
    color: #fff;
    font-family: Arial, sans-serif;
}

header {
    background: rgba(8,8,8,.95);
    border-bottom: 1px solid #252525;
    position: sticky;
    top: 0;
    z-index: 20;
}

.nav {
    max-width: 1150px;
    margin: auto;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
}

.logo {
    color: #62ff78;
    font-weight: 900;
    text-decoration: none;
    font-size: 20px;
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

nav a {
    color: #ccc;
    text-decoration: none;
    padding: 9px 11px;
    border-radius: 8px;
}

nav a:hover {
    background: #222;
    color: #fff;
}

.container {
    max-width: 1150px;
    width: calc(100% - 24px);
    margin: 30px auto;
}

.hero {
    text-align: center;
    padding: 65px 10px;
}

.hero h1 {
    font-size: clamp(38px, 8vw, 72px);
    margin: 0 0 15px;
}

.hero p {
    color: #aaa;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
}

.card {
    background: #151515;
    border: 1px solid #292929;
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 15px;
}

.center {
    text-align: center;
}

.form {
    max-width: 500px;
    margin: 40px auto;
}

input,
select,
textarea {
    width: 100%;
    background: #090909;
    color: #fff;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px;
    margin-top: 6px;
    margin-bottom: 15px;
}

button,
.button {
    display: inline-block;
    border: 0;
    border-radius: 8px;
    padding: 11px 15px;
    background: #4be263;
    color: #061008;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
}

button:hover,
.button:hover {
    filter: brightness(1.1);
}

.secondary {
    background: #292929 !important;
    color: #fff !important;
}

.danger {
    background: #d94141 !important;
    color: #fff !important;
}

.warning {
    background: #d5a52f !important;
    color: #111 !important;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.price {
    color: #66ff7b;
    font-size: 35px;
    font-weight: 900;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 800;
}

.running {
    background: #163b1d;
    color: #70ff85;
}

.stopped {
    background: #3e1919;
    color: #ff8b8b;
}

.pending {
    background: #453a16;
    color: #ffd85c;
}

.accepted {
    background: #163b1d;
    color: #70ff85;
}

.rejected {
    background: #3e1919;
    color: #ff8b8b;
}

.console {
    background: #030303;
    border: 1px solid #303030;
    border-radius: 10px;
    padding: 15px;
    height: 430px;
    overflow: auto;
    white-space: pre-wrap;
    font-family: Consolas, monospace;
    color: #b9ffbf;
}

.consolebar {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.consolebar input {
    margin: 0;
    flex: 1;
}

.notice {
    padding: 14px;
    border-radius: 9px;
    background: #17341c;
    border: 1px solid #2e7139;
}

.error {
    background: #3a1919;
    border-color: #713333;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 10px;
    border-bottom: 1px solid #2b2b2b;
}

pre {
    white-space: pre-wrap;
    word-break: break-word;
}

.muted {
    color: #888;
}

footer {
    color: #666;
    text-align: center;
    padding: 40px 15px;
}

@media(max-width:700px) {

    .nav {
        flex-direction: column;
    }

    nav {
        justify-content: center;
    }

    .hero {
        padding: 40px 5px;
    }

    .consolebar {
        flex-direction: column;
    }

}

</style>

</head>

<body>

<header>

<div class="nav">

<a class="logo" href="/">
⛏ Minecraft Hosting
</a>

<nav>

<a href="/">Home</a>

${
    user
        ? `
        <a href="/dashboard">Dashboard</a>
        <a href="/order">Server bestellen</a>
        ${
            isAdmin(req)
                ? `<a href="/admin">Admin</a>`
                : ""
        }
        <a href="/logout">Logout</a>
        `
        : `
        <a href="/login">Anmelden</a>
        <a href="/register">Registrieren</a>
        `
}

</nav>

</div>

</header>

<main class="container">

${content}

</main>

<footer>
Minecraft Hosting © ${new Date().getFullYear()}
</footer>

</body>

</html>
`;
}

/*
=========================================================
HOME
=========================================================
*/

app.get("/", (req, res) => {

    const config = settings();

    if (config.maintenance && !isAdmin(req)) {
        return res.send(
            page(
                "Wartung",
                `
                <div class="hero">

                    <h1>🔧 Wartung</h1>

                    <p>
                        ${escape(config.maintenanceText)}
                    </p>

                </div>
                `,
                req
            )
        );
    }

    res.send(
        page(
            "Home",
            `
            <section class="hero">

                <h1>⛏ Minecraft Hosting</h1>

                <p>
                    Deine Minecraft-Server.
                    Deine Konsole.
                    Deine Verwaltung.
                </p>

                <div class="actions"
                     style="justify-content:center">

                    ${
                        currentUser(req)
                            ? `
                            <a
                                class="button"
                                href="/dashboard"
                            >
                                Zum Dashboard
                            </a>
                            `
                            : `
                            <a
                                class="button"
                                href="/register"
                            >
                                Jetzt registrieren
                            </a>
                            `
                    }

                    <a
                        class="button secondary"
                        href="/order"
                    >
                        Server bestellen
                    </a>

                </div>

            </section>

            <div class="grid">

                <div class="card">
                    <h2>🆓 1 Server gratis</h2>
                    <p>
                        Jeder Account bekommt
                        einen kostenlosen Server.
                    </p>
                </div>

                <div class="card">
                    <h2>💶 Weitere Server</h2>
                    <p>
                        Jeder weitere Server:
                        <strong>5 €</strong>.
                    </p>
                </div>

                <div class="card">
                    <h2>🖥 Echte Konsole</h2>
                    <p>
                        Die Web-Konsole zeigt die
                        tatsächliche Minecraft-Ausgabe.
                    </p>
                </div>

                <div class="card">
                    <h2>🌐 Automatischer Port</h2>
                    <p>
                        Für jeden Server wird
                        ein eigener Port vergeben.
                    </p>
                </div>

            </div>
            `,
            req
        )
    );
});

/*
=========================================================
REGISTER
=========================================================
*/

app.get("/register", (req, res) => {

    res.send(
        page(
            "Registrieren",
            `
            <div class="card form">

                <h2>Account erstellen</h2>

                <form method="POST" action="/register">

                    <label>Benutzername</label>

                    <input
                        name="username"
                        minlength="3"
                        maxlength="30"
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
                        minlength="6"
                        required
                    >

                    <button type="submit">
                        Registrieren
                    </button>

                </form>

            </div>
            `,
            req
        )
    );
});

app.post("/register", async (req, res) => {

    const username =
        String(req.body.username || "").trim();

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    if (
        username.length < 3 ||
        password.length < 6 ||
        !email
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Ungültige Eingaben.
                </div>
                `,
                req
            )
        );
    }

    const data = users();

    if (
        data.some(
            user =>
                user.email.toLowerCase() ===
                email
        )
    ) {
        return res.status(400).send(
            page(
                "Fehler",
                `
                <div class="card error">
                    Diese E-Mail ist bereits registriert.
                </div>
                `,
                req
            )
        );
    }

    const passwordHash =
        await bcrypt.hash(password, 12);

    const user = {
        id: crypto.randomUUID(),
        username,
        email,
        passwordHash,
        createdAt: new Date().toISOString()
    };

    data.push(user);

    write(USERS_FILE, data);

    log(
        "REGISTER",
        `${username} hat einen Account erstellt.`
    );

    res.redirect("/login?registered=1");
});

/*
=========================================================
LOGIN
=========================================================
*/

app.get("/login", (req, res) => {

    const registered =
        req.query.registered === "1";

    res.send(
        page(
            "Anmelden",
            `
            <div class="card form">

                ${
                    registered
                        ? `
                        <div class="notice">
                            Registrierung erfolgreich.
                        </div>
                        `
                        : ""
                }

                <h2>Anmelden</h2>

                <form method="POST" action="/login">

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

            </div>
            `,
            req
        )
    );
});

app.post("/login", async (req, res) => {

    const email =
        String(req.body.email || "")
            .trim()
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const user =
        users().find(
            item =>
                item.email.toLowerCase() ===
                email
        );

    if (
        !user ||
        !(await bcrypt.compare(
            password,
            user.passwordHash
        ))
    ) {
        return res.status(401).send(
            page(
                "Login fehlgeschlagen",
                `
                <div class="card error center">

                    <h2>❌ Login fehlgeschlagen</h2>

                    <p>
                        E-Mail oder Passwort ist falsch.
                    </p>

                    <a
                        class="button"
                        href="/login"
                    >
                        Erneut versuchen
                    </a>

                </div>
                `,
                req
            )
        );
    }

    req.session.userId =
        user.id;

    log(
        "LOGIN",
        `${user.username} hat sich angemeldet.`
    );

    res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {

    req.session.destroy(
        () => res.redirect("/")
    );

});

/*
=========================================================
ORDER
=========================================================
*/

app.get(
    "/order",
    loginRequired,
    (req, res) => {

        const user =
            currentUser(req);

        const count =
            servers().filter(
                server =>
                    server.ownerId ===
                    user.id
            ).length;

        const price =
            count === 0
                ? 0
                : 5;

        res.send(
            page(
                "Server bestellen",
                `
                <div class="card form">

                    <h2>⛏ Server bestellen</h2>

                    <div class="notice">

                        ${
                            price === 0
                                ? "🆓 Dein erster Server ist kostenlos."
                                : "💶 Dieser weitere Server kostet 5 €."
                        }

                    </div>

                    <br>

                    <form
                        method="POST"
                        action="/order"
                    >

                        <label>
                            Servername
                        </label>

                        <input
                            name="serverName"
                            placeholder="Mein Minecraft Server"
                            maxlength="40"
                            required
                        >

                        <label>
                            Minecraft-Version
                        </label>

                        <select name="version">

                            <option>1.21.8</option>
                            <option>1.21.7</option>
                            <option>1.21.6</option>
                            <option>1.21.5</option>
                            <option>1.21.4</option>
                            <option>1.20.6</option>

                        </select>

                        <p>
                            Preis:
                            <strong>
                                ${price.toFixed(2)} €
                            </strong>
                        </p>

                        <button type="submit">
                            Bestellung erstellen
                        </button>

                    </form>

                </div>
                `,
                req
            )
        );
    }
);

app.post(
    "/order",
    loginRequired,
    (req, res) => {

        const user =
            currentUser(req);

        const serverName =
            String(
                req.body.serverName || ""
            ).trim();

        const version =
            String(
                req.body.version || "1.21.8"
            ).trim();

        if (!serverName) {
            return res.status(400).send(
                "Servername fehlt."
            );
        }

        const count =
            servers().filter(
                server =>
                    server.ownerId ===
                    user.id
            ).length;

        const price =
            count === 0
                ? 0
                : 5;

        const orderNumber =
            "MC-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase();

        const order = {
            id: crypto.randomUUID(),
            orderNumber,
            userId: user.id,
            username: user.username,
            email: user.email,
            serverName,
            version,
            price,
            status: "pending",
            createdAt: new Date().toISOString(),
            reviewedAt: null
        };

        const data = orders();

        data.push(order);

        write(
            ORDERS_FILE,
            data
        );

        log(
            "ORDER",
            `Neue Bestellung ${orderNumber} von ${user.username}.`
        );

        res.send(
            page(
                "Bestellung",
                `
                <div class="card center">

                    <h1>✅ Bestellung erstellt</h1>

                    <div class="notice">

                        <strong>
                            Bestellnummer
                        </strong>

                        <h2>
                            ${escape(orderNumber)}
                        </h2>

                    </div>

                    <p>
                        Die Bestellung wartet auf
                        die Prüfung durch einen Admin.
                    </p>

                    <a
                        class="button"
                        href="/dashboard"
                    >
                        Dashboard
                    </a>

                </div>
                `,
                req
            )
        );
    }
);

/*
=========================================================
DASHBOARD
=========================================================
*/

app.get(
    "/dashboard",
    loginRequired,
    (req, res) => {

        const user =
            currentUser(req);

        const myServers =
            servers().filter(
                server =>
                    server.ownerId ===
                    user.id
            );

        const myOrders =
            orders()
                .filter(
                    order =>
                        order.userId ===
                        user.id
                )
                .reverse();

        res.send(
            page(
                "Dashboard",
                `
                <h1>
                    👋 Willkommen,
                    ${escape(user.username)}
                </h1>

                <div class="grid">

                    <div class="card">

                        <h3>Server</h3>

                        <div class="price">
                            ${myServers.length}
                        </div>

                    </div>

                    <div class="card">

                        <h3>Bestellungen</h3>

                        <div class="price">
                            ${myOrders.length}
                        </div>

                    </div>

                </div>

                <div class="card">

                    <h2>🖥 Deine Server</h2>

                    ${
                        myServers.length === 0
                            ? `
                            <p class="muted">
                                Du hast noch keinen Server.
                            </p>
                            `
                            :
                            myServers
                                .map(
                                    server => `
                                    <div class="card">

                                        <h3>
                                            ${escape(
                                                server.name
                                            )}
                                        </h3>

                                        <p>
                                            IP:
                                            <strong>
                                                ${escape(
                                                    server.address
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Status:
                                            <span class="status ${
                                                server.status ===
                                                "running"
                                                    ? "running"
                                                    : "stopped"
                                            }">
                                                ${escape(
                                                    server.status
                                                )}
                                            </span>
                                        </p>

                                        <a
                                            class="button"
                                            href="/server/${
                                                encodeURIComponent(
                                                    server.id
                                                )
                                            }"
                                        >
                                            Verwalten
                                        </a>

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>

                <div class="card">

                    <h2>📦 Deine Bestellungen</h2>

                    ${
                        myOrders.length === 0
                            ? `
                            <p class="muted">
                                Keine Bestellungen.
                            </p>
                            `
                            :
                            `
                            <table>

                                <tr>
                                    <th>Nummer</th>
                                    <th>Server</th>
                                    <th>Preis</th>
                                    <th>Status</th>
                                </tr>

                                ${myOrders
                                    .map(
                                        order => `
                                        <tr>

                                            <td>
                                                ${escape(
                                                    order.orderNumber
                                                )}
                                            </td>

                                            <td>
                                                ${escape(
                                                    order.serverName
                                                )}
                                            </td>

                                            <td>
                                                ${order.price.toFixed(
                                                    2
                                                )} €
                                            </td>

                                            <td>
                                                <span class="status ${
                                                    order.status
                                                }">
                                                    ${escape(
                                                        order.status
                                                    )}
                                                </span>
                                            </td>

                                        </tr>
                                        `
                                    )
                                    .join("")}

                            </table>
                            `
                    }

                </div>
                `,
                req
            )
        );
    }
);

/*
=========================================================
PORT FINDER
=========================================================
*/

async function findFreePort() {

    const existing =
        new Set(
            servers()
                .map(
                    server =>
                        Number(server.port)
                )
                .filter(Boolean)
        );

    for (
        let port = 25565;
        port <= 25650;
        port++
    ) {

        if (existing.has(port)) {
            continue;
        }

        const free =
            await new Promise(resolve => {

                const test =
                    require("net")
                        .createServer();

                test.once(
                    "error",
                    () => resolve(false)
                );

                test.once(
                    "listening",
                    () => {

                        test.close(
                            () => resolve(true)
                        );

                    }
                );

                test.listen(
                    port,
                    "0.0.0.0"
                );

            });

        if (free) {
            return port;
        }
    }

    throw new Error(
        "Keine freien Minecraft-Ports."
    );
}

/*
=========================================================
MINECRAFT PROCESS MANAGEMENT
=========================================================
*/

const processes = new Map();

async function startServer(server) {

    if (
        processes.has(server.id)
    ) {
        return {
            ok: false,
            message: "Server läuft bereits."
        };
    }

    const folder =
        path.join(
            SERVERS_DIR,
            server.id
        );

    fs.mkdirSync(
        folder,
        { recursive: true }
    );

    const jar =
        path.join(
            folder,
            "server.jar"
        );

    if (!fs.existsSync(jar)) {

        return {
            ok: false,
            message:
                "server.jar fehlt. Bitte lege die Minecraft-Server-JAR in den Serverordner."
        };

    }

    fs.writeFileSync(
        path.join(
            folder,
            "eula.txt"
        ),
        "eula=true\n"
    );

    const properties = `
server-port=${server.port}
server-ip=
motd=${server.name}
online-mode=true
enable-command-block=true
spawn-protection=0
view-distance=10
simulation-distance=10
`;

    fs.writeFileSync(
        path.join(
            folder,
            "server.properties"
        ),
        properties.trim() + "\n"
    );

    const child =
        spawn(
            process.env.JAVA_COMMAND || "java",
            [
                `-Xms${server.memory || 1024}M`,
                `-Xmx${server.memory || 1024}M`,
                "-jar",
                "server.jar",
                "nogui"
            ],
            {
                cwd: folder,
                stdio: [
                    "pipe",
                    "pipe",
                    "pipe"
                ]
            }
        );

    processes.set(
        server.id,
        child
    );

    server.status = "running";
    server.pid = child.pid;
    server.startedAt =
        new Date().toISOString();

    saveServer(server);

    addServerLog(
        server,
        `Minecraft gestartet. PID ${child.pid}`
    );

    child.stdout.on(
        "data",
        data => {

            addServerLog(
                server,
                data.toString().trimEnd()
            );

        }
    );

    child.stderr.on(
        "data",
        data => {

            addServerLog(
                server,
                data.toString().trimEnd()
            );

        }
    );

    child.on(
        "error",
        error => {

            addServerLog(
                server,
                `Prozessfehler: ${error.message}`
            );

        }
    );

    child.on(
        "close",
        code => {

            processes.delete(
                server.id
            );

            server.status =
                "stopped";

            server.pid =
                null;

            saveServer(server);

            addServerLog(
                server,
                `Minecraft beendet. Exit-Code: ${code}`
            );

        }
    );

    return {
        ok: true
    };
}

function stopServer(server) {

    const child =
        processes.get(
            server.id
        );

    if (!child) {

        server.status =
            "stopped";

        server.pid =
            null;

        saveServer(server);

        return {
            ok: true
        };

    }

    try {
        child.stdin.write(
            "stop\n"
        );
    } catch {}

    setTimeout(
        () => {

            if (
                processes.has(
                    server.id
                )
            ) {

                try {
                    child.kill("SIGTERM");
                } catch {}

            }

        },
        15000
    );

    return {
        ok: true
    };
}

function sendCommand(server, command) {

    const child =
        processes.get(
            server.id
        );

    if (!child) {
        return {
            ok: false,
            message: "Server läuft nicht."
        };
    }

    const value =
        String(command || "").trim();

    if (!value) {
        return {
            ok: false,
            message: "Befehl fehlt."
        };
    }

    try {

        child.stdin.write(
            value + "\n"
        );

        addServerLog(
            server,
            `> ${value}`
        );

        return {
            ok: true
        };

    } catch (error) {

        return {
            ok: false,
            message: error.message
        };

    }
}

function addServerLog(server, text) {

    const line =
        `[${new Date().toISOString()}] ${text}`;

    server.console =
        (server.console || "") +
        line +
        "\n";

    if (
        server.console.length > 50000
    ) {
        server.console =
            server.console.slice(-50000);
    }

    saveServer(server);
}

function saveServer(server) {

    const data =
        servers();

    const index =
        data.findIndex(
            item =>
                item.id ===
                server.id
        );

    if (index === -1) {
        return;
    }

    data[index] =
        server;

    write(
        SERVERS_FILE,
        data
    );
}

/*
=========================================================
SERVER PAGE
=========================================================
*/

app.get(
    "/server/:id",
    loginRequired,
    (req, res) => {

        const server =
            servers().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const user =
            currentUser(req);

        const allowed =
            server.ownerId === user.id ||
            isAdmin(req);

        if (!allowed) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        res.send(
            page(
                server.name,
                `
                <div class="card">

                    <h1>
                        ⛏ ${escape(server.name)}
                    </h1>

                    <p>
                        IP:
                        <strong>
                            ${escape(server.address)}
                        </strong>
                    </p>

                    <p>
                        Version:
                        ${escape(server.version)}
                    </p>

                    <p>
                        Port:
                        ${server.port}
                    </p>

                    <p>
                        Status:

                        <span
                            class="status ${
                                server.status ===
                                "running"
                                    ? "running"
                                    : "stopped"
                            }"
                        >
                            ${escape(server.status)}
                        </span>

                    </p>

                    <div class="actions">

                        <form
                            method="POST"
                            action="/server/${
                                encodeURIComponent(
                                    server.id
                                )
                            }/start"
                        >

                            <button>
                                ▶ Start
                            </button>

                        </form>

                        <form
                            method="POST"
                            action="/server/${
                                encodeURIComponent(
                                    server.id
                                )
                            }/stop"
                        >

                            <button class="secondary">
                                ⏹ Stop
                            </button>

                        </form>

                    </div>

                </div>

                <div class="card">

                    <h2>🖥 Echte Minecraft-Konsole</h2>

                    <pre
                        id="console"
                        class="console"
                    >${escape(
                        server.console ||
                        "Noch keine Logs."
                    )}</pre>

                    <div class="consolebar">

                        <input
                            id="command"
                            placeholder="Minecraft-Befehl, z.B. say Hallo"
                        >

                        <button
                            onclick="sendCommand()"
                        >
                            Senden
                        </button>

                    </div>

                </div>

<script>

const output =
    document.getElementById("console");

const input =
    document.getElementById("command");

async function sendCommand() {

    const command =
        input.value.trim();

    if (!command) {
        return;
    }

    const response =
        await fetch(
            "/api/server/${encodeURIComponent(
                server.id
            )}/command",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        command
                    })
            }
        );

    const result =
        await response.json();

    if (!result.ok) {
        alert(
            result.message ||
            "Fehler"
        );
        return;
    }

    input.value = "";

}

input.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {
            sendCommand();
        }

    }
);

setInterval(
    async () => {

        try {

            const response =
                await fetch(
                    "/api/server/${encodeURIComponent(
                        server.id
                    )}/logs"
                );

            const data =
                await response.json();

            if (
                data.console !==
                output.textContent
            ) {

                output.textContent =
                    data.console;

                output.scrollTop =
                    output.scrollHeight;

            }

        } catch {}

    },
    1000
);

</script>
                `,
                req
            )
        );
    }
);

/*
=========================================================
SERVER LOG API
=========================================================
*/

app.get(
    "/api/server/:id/logs",
    loginRequired,
    (req, res) => {

        const server =
            servers().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).json({
                ok: false
            });
        }

        const user =
            currentUser(req);

        if (
            server.ownerId !== user.id &&
            !isAdmin(req)
        ) {
            return res.status(403).json({
                ok: false
            });
        }

        res.json({
            ok: true,
            console:
                server.console || ""
        });

    }
);

/*
=========================================================
SERVER START
=========================================================
*/

app.post(
    "/server/:id/start",
    loginRequired,
    async (req, res) => {

        const server =
            servers().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const user =
            currentUser(req);

        if (
            server.ownerId !== user.id &&
            !isAdmin(req)
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        const result =
            await startServer(server);

        if (!result.ok) {
            return res.status(400).send(
                page(
                    "Fehler",
                    `
                    <div class="card error">

                        <h2>
                            ❌ Server konnte nicht gestartet werden
                        </h2>

                        <p>
                            ${escape(
                                result.message
                            )}
                        </p>

                        <a
                            class="button"
                            href="/server/${encodeURIComponent(
                                server.id
                            )}"
                        >
                            Zurück
                        </a>

                    </div>
                    `,
                    req
                )
            );
        }

        log(
            "SERVER_START",
            `${server.name} wurde gestartet.`
        );

        res.redirect(
            `/server/${encodeURIComponent(
                server.id
            )}`
        );
    }
);

/*
=========================================================
SERVER STOP
=========================================================
*/

app.post(
    "/server/:id/stop",
    loginRequired,
    (req, res) => {

        const server =
            servers().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).send(
                "Server nicht gefunden."
            );
        }

        const user =
            currentUser(req);

        if (
            server.ownerId !== user.id &&
            !isAdmin(req)
        ) {
            return res.status(403).send(
                "Kein Zugriff."
            );
        }

        stopServer(server);

        log(
            "SERVER_STOP",
            `${server.name} wurde gestoppt.`
        );

        res.redirect(
            `/server/${encodeURIComponent(
                server.id
            )}`
        );
    }
);

/*
=========================================================
COMMAND API
=========================================================
*/

app.post(
    "/api/server/:id/command",
    loginRequired,
    (req, res) => {

        const server =
            servers().find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!server) {
            return res.status(404).json({
                ok: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const user =
            currentUser(req);

        if (
            server.ownerId !== user.id &&
            !isAdmin(req)
        ) {
            return res.status(403).json({
                ok: false,
                message:
                    "Kein Zugriff."
            });
        }

        const result =
            sendCommand(
                server,
                req.body.command
            );

        res.json(result);

    }
);

/*
=========================================================
ADMIN PANEL
=========================================================
*/

app.get(
    "/admin",
    adminRequired,
    (req, res) => {

        const allOrders =
            orders().reverse();

        const allServers =
            servers();

        const config =
            settings();

        res.send(
            page(
                "Admin Panel",
                `
                <h1>👑 Admin Panel</h1>

                <div class="grid">

                    <div class="card">

                        <h3>
                            Bestellungen
                        </h3>

                        <div class="price">
                            ${
                                allOrders.filter(
                                    o =>
                                        o.status ===
                                        "pending"
                                ).length
                            }
                        </div>

                    </div>

                    <div class="card">

                        <h3>
                            Server
                        </h3>

                        <div class="price">
                            ${allServers.length}
                        </div>

                    </div>

                </div>

                <div class="card">

                    <h2>📦 Bestellungen</h2>

                    ${
                        allOrders.length === 0
                            ? "<p>Keine Bestellungen.</p>"
                            :
                            allOrders
                                .map(
                                    order => `
                                    <div class="card">

                                        <h3>
                                            ${escape(
                                                order.serverName
                                            )}
                                        </h3>

                                        <p>
                                            Bestellnummer:
                                            <strong>
                                                ${escape(
                                                    order.orderNumber
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Kunde:
                                            ${escape(
                                                order.username
                                            )}
                                            <br>
                                            ${escape(
                                                order.email
                                            )}
                                        </p>

                                        <p>
                                            Version:
                                            ${escape(
                                                order.version
                                            )}
                                        </p>

                                        <p>
                                            Preis:
                                            ${order.price.toFixed(
                                                2
                                            )} €
                                        </p>

                                        <p>
                                            Status:

                                            <span
                                                class="status ${
                                                    order.status
                                                }"
                                            >
                                                ${escape(
                                                    order.status
                                                )}
                                            </span>

                                        </p>

                                        ${
                                            order.status ===
                                            "pending"
                                                ? `
                                                <div
                                                    class="actions"
                                                >

                                                    <form
                                                        method="POST"
                                                        action="/admin/order/${encodeURIComponent(
                                                            order.id
                                                        )}/accept"
                                                    >

                                                        <button>
                                                            ✅ Annehmen
                                                        </button>

                                                    </form>

                                                    <form
                                                        method="POST"
                                                        action="/admin/order/${encodeURIComponent(
                                                            order.id
                                                        )}/reject"
                                                    >

                                                        <button
                                                            class="danger"
                                                        >
                                                            ❌ Ablehnen
                                                        </button>

                                                    </form>

                                                </div>
                                                `
                                                : ""
                                        }

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>

                <div class="card">

                    <h2>🖥 Alle Server</h2>

                    ${
                        allServers.length === 0
                            ? "<p>Noch keine Server.</p>"
                            :
                            allServers
                                .map(
                                    server => `
                                    <div class="card">

                                        <h3>
                                            ${escape(
                                                server.name
                                            )}
                                        </h3>

                                        <p>
                                            Besitzer:
                                            ${escape(
                                                server.username
                                            )}
                                        </p>

                                        <p>
                                            IP:
                                            <strong>
                                                ${escape(
                                                    server.address
                                                )}
                                            </strong>
                                        </p>

                                        <p>
                                            Status:
                                            ${escape(
                                                server.status
                                            )}
                                        </p>

                                        <a
                                            class="button"
                                            href="/server/${encodeURIComponent(
                                                server.id
                                            )}"
                                        >
                                            Konsole
                                        </a>

                                    </div>
                                    `
                                )
                                .join("")
                    }

                </div>

                <div class="card">

                    <h2>🔧 Wartungsmodus</h2>

                    <form
                        method="POST"
                        action="/admin/maintenance"
                    >

                        <textarea
                            name="message"
                            rows="4"
                        >${escape(
                            config.maintenanceText
                        )}</textarea>

                        <div class="actions">

                            <button
                                name="action"
                                value="on"
                            >
                                Wartung AN
                            </button>

                            <button
                                class="secondary"
                                name="action"
                                value="off"
                            >
                                Wartung AUS
                            </button>

                        </div>

                    </form>

                </div>

                <div class="card">

                    <h2>📜 System-Logs</h2>

                    <pre class="console">${
                        logs()
                            .slice(0, 300)
                            .map(
                                item =>
                                    `[${item.date}] [${item.type}] ${item.message}`
                            )
                            .join("\n")
                    }</pre>

                </div>
                `,
                req
            )
        );
    }
);

/*
=========================================================
ADMIN ACCEPT
=========================================================
*/

app.post(
    "/admin/order/:id/accept",
    adminRequired,
    async (req, res) => {

        const data =
            orders();

        const order =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res.status(404).send(
                "Bestellung nicht gefunden."
            );
        }

        if (
            order.status !==
            "pending"
        ) {
            return res.redirect(
                "/admin"
            );
        }

        try {

            const port =
                await findFreePort();

            const id =
                "srv-" +
                crypto
                    .randomBytes(6)
                    .toString("hex");

            const server = {
                id,
                orderId: order.id,
                orderNumber:
                    order.orderNumber,
                ownerId:
                    order.userId,
                username:
                    order.username,
                email:
                    order.email,
                name:
                    order.serverName,
                version:
                    order.version,
                port,
                address:
                    `${
                        process.env.MINECRAFT_HOST ||
                        "localhost"
                    }:${port}`,
                memory:
                    Number(
                        process.env.SERVER_MEMORY_MB ||
                        1024
                    ),
                status:
                    "stopped",
                pid:
                    null,
                console:
                    "",
                createdAt:
                    new Date().toISOString()
            };

            const serverData =
                servers();

            serverData.push(server);

            write(
                SERVERS_FILE,
                serverData
            );

            order.status =
                "accepted";

            order.reviewedAt =
                new Date().toISOString();

            write(
                ORDERS_FILE,
                data
            );

            log(
                "ORDER_ACCEPTED",
                `Bestellung ${order.orderNumber} angenommen. Port ${port}.`
            );

            res.redirect(
                "/admin"
            );

        } catch (error) {

            res.status(500).send(
                escape(error.message)
            );

        }

    }
);

/*
=========================================================
ADMIN REJECT
=========================================================
*/

app.post(
    "/admin/order/:id/reject",
    adminRequired,
    (req, res) => {

        const data =
            orders();

        const order =
            data.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res.status(404).send(
                "Bestellung nicht gefunden."
            );
        }

        order.status =
            "rejected";

        order.reviewedAt =
            new Date().toISOString();

        write(
            ORDERS_FILE,
            data
        );

        log(
            "ORDER_REJECTED",
            `Bestellung ${order.orderNumber} abgelehnt.`
        );

        res.redirect("/admin");

    }
);

/*
=========================================================
MAINTENANCE
=========================================================
*/

app.post(
    "/admin/maintenance",
    adminRequired,
    (req, res) => {

        const config =
            settings();

        config.maintenance =
            req.body.action === "on";

        config.maintenanceText =
            String(
                req.body.message ||
                "Die Webseite befindet sich momentan im Wartungsmodus."
            );

        write(
            SETTINGS_FILE,
            config
        );

        log(
            "MAINTENANCE",
            config.maintenance
                ? "Wartungsmodus aktiviert."
                : "Wartungsmodus deaktiviert."
        );

        res.redirect("/admin");

    }
);

/*
=========================================================
404
=========================================================
*/

app.use(
    (req, res) => {

        res.status(404).send(
            page(
                "404",
                `
                <div class="card center">

                    <h1>404</h1>

                    <p>
                        Diese Seite existiert nicht.
                    </p>

                    <a
                        class="button"
                        href="/"
                    >
                        Home
                    </a>

                </div>
                `,
                req
            )
        );

    }
);

/*
=========================================================
SERVER START
=========================================================
*/

const httpServer =
    app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "================================"
            );
            console.log(
                " Minecraft Hosting"
            );
            console.log(
                "================================"
            );
            console.log(
                `Webseite läuft auf Port ${PORT}`
            );
            console.log(
                `Admin: ${ADMIN_EMAIL}`
            );
            console.log(
                "================================"
            );

            log(
                "SYSTEM",
                `Webseite gestartet auf Port ${PORT}.`
            );

        }
    );

/*
=========================================================
CLEAN SHUTDOWN
=========================================================
*/

function shutdown() {

    console.log(
        "Server wird beendet..."
    );

    for (
        const child of processes.values()
    ) {

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

    }

    setTimeout(
        () => {
            httpServer.close(
                () => process.exit(0)
            );
        },
        3000
    );

}

process.on(
    "SIGTERM",
    shutdown
);

process.on(
    "SIGINT",
    shutdown
);
