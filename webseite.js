"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const OWNER_EMAIL = "florianzustolberg@gmail.com";
const EXTRA_SERVER_PRICE = 5;

// ============================================================
// PFADE
// ============================================================

const DATA_DIR = path.join(__dirname, "data");
const MC_DIR = path.join(__dirname, "minecraft-servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MC_DIR, { recursive: true });


// ============================================================
// JSON
// ============================================================

function createFile(file, fallback) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(fallback, null, 2),
            "utf8"
        );
    }
}

function readJSON(file, fallback) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error("JSON Fehler:", error.message);
        return fallback;
    }
}

function saveJSON(file, data) {
    try {
        const tmp =
            file +
            "." +
            crypto.randomBytes(6).toString("hex") +
            ".tmp";

        fs.writeFileSync(
            tmp,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tmp, file);
    } catch (error) {
        console.error("Speicherfehler:", error.message);
    }
}

createFile(USERS_FILE, []);
createFile(ORDERS_FILE, []);
createFile(SERVERS_FILE, []);

createFile(
    SETTINGS_FILE,
    {
        maintenance: false,
        outage: false,
        outageText: ""
    }
);

let users = readJSON(USERS_FILE, []);
let orders = readJSON(ORDERS_FILE, []);
let servers = readJSON(SERVERS_FILE, []);

let settings = readJSON(
    SETTINGS_FILE,
    {
        maintenance: false,
        outage: false,
        outageText: ""
    }
);


// ============================================================
// RUNTIME
// ============================================================

const sessions = new Map();
const processes = new Map();


// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function makeId(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(8).toString("hex")
    );
}

function cleanText(value, max = 100) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function cleanServerName(value) {
    return cleanText(value, 32)
        .replace(/[^a-zA-Z0-9_-]/g, "");
}

function isOwner(email) {
    return (
        String(email || "").toLowerCase() ===
        OWNER_EMAIL.toLowerCase()
    );
}

function getUser(email) {
    return users.find(
        user =>
            user.email.toLowerCase() ===
            String(email).toLowerCase()
    );
}

function getOrder(orderId) {
    return orders.find(
        order => order.id === orderId
    );
}

function getServer(serverId) {
    return servers.find(
        server => server.id === serverId
    );
}

function getUserServers(email) {
    return servers.filter(
        server =>
            server.owner.toLowerCase() ===
            String(email).toLowerCase()
    );
}

function getSession(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token = header.slice(7);

    const session = sessions.get(token);

    if (!session) {
        return null;
    }

    if (
        Date.now() - session.createdAt >
        1000 * 60 * 60 * 24 * 7
    ) {
        sessions.delete(token);
        return null;
    }

    return session;
}

function requireLogin(req, res, next) {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Bitte anmelden."
        });
    }

    req.email = session.email;

    next();
}

function requireOwner(req, res, next) {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Bitte anmelden."
        });
    }

    if (!isOwner(session.email)) {
        return res.status(403).json({
            success: false,
            message:
                "Nur der Owner darf diese Aktion ausführen."
        });
    }

    req.email = session.email;

    next();
}

function serverPath(serverId) {
    return path.join(
        MC_DIR,
        serverId
    );
}

function logPath(serverId) {
    return path.join(
        serverPath(serverId),
        "logs"
    );
}

function logFile(serverId) {
    return path.join(
        logPath(serverId),
        "console.log"
    );
}

function writeServerLog(server, message) {
    try {
        fs.mkdirSync(
            logPath(server.id),
            {
                recursive: true
            }
        );

        const line =
            "[" +
            new Date().toISOString() +
            "] " +
            String(message) +
            "\n";

        fs.appendFileSync(
            logFile(server.id),
            line,
            "utf8"
        );
    } catch (error) {
        console.error(
            "Log Fehler:",
            error.message
        );
    }
}

function running(serverId) {
    return processes.has(serverId);
}

function publicServer(server) {
    return {
        id: server.id,
        name: server.name,
        orderNumber: server.orderNumber,
        owner: server.owner,
        port: server.port,
        status: running(server.id)
            ? "online"
            : "offline",
        locked: Boolean(server.locked),
        maintenance: Boolean(server.maintenance),
        createdAt: server.createdAt
    };
}


// ============================================================
// LOGIN
// ============================================================

app.post("/api/register", (req, res) => {
    const username =
        cleanText(req.body.username, 24);

    const email =
        cleanText(req.body.email, 120)
            .toLowerCase();

    const password =
        String(req.body.password || "");

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message:
                "Bitte Benutzername, E-Mail und Passwort eingeben."
        });
    }

    if (
        !/^[a-zA-Z0-9_]{3,24}$/.test(username)
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Benutzername muss 3-24 Zeichen haben."
        });
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return res.status(400).json({
            success: false,
            message: "Ungültige E-Mail."
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message:
                "Passwort muss mindestens 8 Zeichen haben."
        });
    }

    if (
        users.some(
            user =>
                user.username.toLowerCase() ===
                username.toLowerCase()
        )
    ) {
        return res.status(409).json({
            success: false,
            message:
                "Benutzername bereits vergeben."
        });
    }

    if (
        users.some(
            user =>
                user.email.toLowerCase() === email
        )
    ) {
        return res.status(409).json({
            success: false,
            message:
                "E-Mail bereits registriert."
        });
    }

    const salt =
        crypto.randomBytes(16).toString("hex");

    const passwordHash =
        crypto
            .scryptSync(
                password,
                salt,
                64
            )
            .toString("hex");

    users.push({
        id: makeId("user"),
        username,
        email,
        salt,
        passwordHash,
        createdAt: new Date().toISOString()
    });

    saveJSON(
        USERS_FILE,
        users
    );

    res.json({
        success: true,
        message:
            "Registrierung erfolgreich."
    });
});


app.post("/api/login", (req, res) => {
    const login =
        cleanText(req.body.login, 120)
            .toLowerCase();

    const password =
        String(req.body.password || "");

    const user = users.find(
        entry =>
            entry.email.toLowerCase() === login ||
            entry.username.toLowerCase() === login
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Login-Daten falsch."
        });
    }

    const hash =
        crypto
            .scryptSync(
                password,
                user.salt,
                64
            )
            .toString("hex");

    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(
        user.passwordHash,
        "hex"
    );

    if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
    ) {
        return res.status(401).json({
            success: false,
            message:
                "Login-Daten falsch."
        });
    }

    const token =
        crypto
            .randomBytes(48)
            .toString("hex");

    sessions.set(
        token,
        {
            email: user.email,
            createdAt: Date.now()
        }
    );

    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            admin: isOwner(user.email)
        }
    });
});


app.post(
    "/api/logout",
    requireLogin,
    (req, res) => {
        const token =
            String(
                req.headers.authorization || ""
            ).slice(7);

        sessions.delete(token);

        res.json({
            success: true
        });
    }
);


app.get(
    "/api/me",
    requireLogin,
    (req, res) => {
        const user =
            getUser(req.email);

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                admin: isOwner(user.email)
            }
        });
    }
);


// ============================================================
// BESTELLUNGEN
// ============================================================

app.post(
    "/api/orders",
    requireLogin,
    (req, res) => {

        const serverName =
            cleanServerName(
                req.body.serverName
            );

        const port =
            Number(req.body.port);

        if (!serverName) {
            return res.status(400).json({
                success: false,
                message:
                    "Ungültiger Servername."
            });
        }

        if (
            !Number.isInteger(port) ||
            port < 1024 ||
            port > 65535
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Port muss zwischen 1024 und 65535 liegen."
            });
        }

        if (
            servers.some(
                server =>
                    server.port === port
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Port wird bereits verwendet."
            });
        }

        if (
            orders.some(
                order =>
                    order.userEmail.toLowerCase() ===
                    req.email.toLowerCase() &&
                    order.status === "pending"
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Du hast bereits eine offene Bestellung."
            });
        }

        const existingServers =
            getUserServers(
                req.email
            ).length;

        const price =
            existingServers === 0
                ? 0
                : EXTRA_SERVER_PRICE;

        const orderNumber =
            "NH-" +
            new Date()
                .toISOString()
                .slice(0, 10)
                .replaceAll("-", "") +
            "-" +
            String(
                Math.floor(
                    100000 +
                    Math.random() *
                    900000
                )
            );

        const order = {
            id: makeId("order"),
            orderNumber,
            userEmail: req.email,
            serverName,
            port,
            price,
            status: "pending",
            reason: "",
            createdAt: new Date().toISOString(),
            decidedAt: null,
            decidedBy: null
        };

        orders.push(order);

        saveJSON(
            ORDERS_FILE,
            orders
        );

        console.log(
            "📦 Bestellung " +
            orderNumber +
            " erstellt von " +
            req.email
        );

        res.json({
            success: true,
            message:
                "Bestellung wurde erstellt und wartet auf Admin-Freigabe.",
            order
        });
    }
);


// ============================================================
// EIGENE BESTELLUNGEN
// ============================================================

app.get(
    "/api/orders",
    requireLogin,
    (req, res) => {

        res.json({
            success: true,
            orders:
                orders
                    .filter(
                        order =>
                            order.userEmail.toLowerCase() ===
                            req.email.toLowerCase()
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt) -
                            new Date(a.createdAt)
                    )
        });
    }
);


// ============================================================
// ADMIN BESTELLUNGEN
// ============================================================

app.get(
    "/api/admin/orders",
    requireOwner,
    (req, res) => {

        res.json({
            success: true,
            orders:
                orders
                    .slice()
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt) -
                            new Date(a.createdAt)
                    )
        });
    }
);


// ============================================================
// BESTELLUNG ANNEHMEN
// ============================================================

app.post(
    "/api/admin/orders/:id/accept",
    requireOwner,
    (req, res) => {

        const order =
            getOrder(
                req.params.id
            );

        if (!order) {
            return res.status(404).json({
                success: false,
                message:
                    "Bestellung nicht gefunden."
            });
        }

        if (
            order.status !== "pending"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Diese Bestellung wurde bereits bearbeitet."
            });
        }

        if (
            servers.some(
                server =>
                    server.port === order.port
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Der Port ist bereits vergeben."
            });
        }

        const server = {
            id: makeId("server"),
            name: order.serverName,
            orderNumber: order.orderNumber,
            owner: order.userEmail,
            port: order.port,
            locked: false,
            maintenance: false,
            createdAt: new Date().toISOString()
        };

        servers.push(server);

        order.status =
            "accepted";

        order.decidedAt =
            new Date().toISOString();

        order.decidedBy =
            req.email;

        saveJSON(
            SERVERS_FILE,
            servers
        );

        saveJSON(
            ORDERS_FILE,
            orders
        );

        fs.mkdirSync(
            serverPath(server.id),
            {
                recursive: true
            }
        );

        fs.mkdirSync(
            logPath(server.id),
            {
                recursive: true
            }
        );

        writeServerLog(
            server,
            "Bestellung " +
            order.orderNumber +
            " wurde angenommen."
        );

        res.json({
            success: true,
            message:
                "Bestellung " +
                order.orderNumber +
                " angenommen.",
            server:
                publicServer(server)
        });
    }
);


// ============================================================
// BESTELLUNG ABLEHNEN
// ============================================================

app.post(
    "/api/admin/orders/:id/reject",
    requireOwner,
    (req, res) => {

        const order =
            getOrder(
                req.params.id
            );

        if (!order) {
            return res.status(404).json({
                success: false,
                message:
                    "Bestellung nicht gefunden."
            });
        }

        if (
            order.status !== "pending"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Diese Bestellung wurde bereits bearbeitet."
            });
        }

        const reason =
            cleanText(
                req.body.reason ||
                "Vom Admin abgelehnt.",
                500
            );

        order.status =
            "rejected";

        order.reason =
            reason;

        order.decidedAt =
            new Date().toISOString();

        order.decidedBy =
            req.email;

        saveJSON(
            ORDERS_FILE,
            orders
        );

        res.json({
            success: true,
            message:
                "Bestellung " +
                order.orderNumber +
                " abgelehnt."
        });
    }
);


// ============================================================
// SERVER LISTE
// ============================================================

app.get(
    "/api/servers",
    requireLogin,
    (req, res) => {

        res.json({
            success: true,
            servers:
                getUserServers(
                    req.email
                ).map(
                    publicServer
                )
        });
    }
);


// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft(
    server
) {

    if (
        processes.has(
            server.id
        )
    ) {
        return {
            success: true,
            message:
                "Server läuft bereits."
        };
    }

    if (server.locked) {
        return {
            success: false,
            message:
                "Server ist gesperrt."
        };
    }

    if (
        server.maintenance
    ) {
        return {
            success: false,
            message:
                "Server befindet sich in Wartung."
        };
    }

    const folder =
        serverPath(
            server.id
        );

    const jar =
        path.join(
            folder,
            "server.jar"
        );

    if (
        !fs.existsSync(jar)
    ) {
        writeServerLog(
            server,
            "START FEHLER: server.jar fehlt."
        );

        return {
            success: false,
            message:
                "server.jar fehlt."
        };
    }

    const eula =
        path.join(
            folder,
            "eula.txt"
        );

    if (
        !fs.existsSync(eula)
    ) {
        fs.writeFileSync(
            eula,
            "eula=true\n",
            "utf8"
        );
    }

    const child =
        spawn(
            "java",
            [
                "-Xms1G",
                "-Xmx2G",
                "-jar",
                "server.jar",
                "nogui"
            ],
            {
                cwd: folder,
                env: process.env
            }
        );

    processes.set(
        server.id,
        child
    );

    writeServerLog(
        server,
        "Minecraft wird gestartet."
    );

    child.stdout.on(
        "data",
        data => {

            const text =
                data.toString();

            process.stdout.write(
                "[" +
                server.name +
                "] " +
                text
            );

            writeServerLog(
                server,
                text.trim()
            );
        }
    );

    child.stderr.on(
        "data",
        data => {

            const text =
                data.toString();

            process.stderr.write(
                "[" +
                server.name +
                "] " +
                text
            );

            writeServerLog(
                server,
                "ERROR: " +
                text.trim()
            );
        }
    );

    child.on(
        "error",
        error => {

            processes.delete(
                server.id
            );

            writeServerLog(
                server,
                "PROZESS FEHLER: " +
                error.message
            );
        }
    );

    child.on(
        "close",
        code => {

            processes.delete(
                server.id
            );

            writeServerLog(
                server,
                "Minecraft beendet. Exit-Code: " +
                code
            );
        }
    );

    return {
        success: true,
        message:
            "Server wird gestartet."
    };
}


// ============================================================
// START
// ============================================================

app.post(
    "/api/servers/:id/start",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        res.json(
            startMinecraft(server)
        );
    }
);


// ============================================================
// STOP
// ============================================================

app.post(
    "/api/servers/:id/stop",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Keine Berechtigung."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.json({
                success: true,
                message:
                    "Server ist bereits offline."
            });
        }

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {
            try {
                child.kill();
            } catch {}
        }

        writeServerLog(
            server,
            "Stop angefordert."
        );

        res.json({
            success: true,
            message:
                "Server wird gestoppt."
        });
    }
);


// ============================================================
// RESTART
// ============================================================

app.post(
    "/api/servers/:id/restart",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.status(400).json({
                success: false,
                message:
                    "Server ist offline."
            });
        }

        writeServerLog(
            server,
            "Restart angefordert."
        );

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        setTimeout(
            () => {

                if (
                    !processes.has(
                        server.id
                    )
                ) {
                    startMinecraft(
                        server
                    );
                }

            },
            5000
        );

        res.json({
            success: true,
            message:
                "Server wird neugestartet."
        });
    }
);


// ============================================================
// CONSOLE COMMAND
// ============================================================

app.post(
    "/api/servers/:id/command",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false
            });
        }

        const command =
            cleanText(
                req.body.command,
                500
            );

        if (!command) {
            return res.status(400).json({
                success: false,
                message:
                    "Befehl fehlt."
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            return res.status(400).json({
                success: false,
                message:
                    "Server ist offline."
            });
        }

        try {

            child.stdin.write(
                command +
                "\n"
            );

            writeServerLog(
                server,
                "COMMAND: " +
                command
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);


// ============================================================
// LOGS
// ============================================================

app.get(
    "/api/servers/:id/logs",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false
            });
        }

        const file =
            logFile(
                server.id
            );

        if (
            !fs.existsSync(file)
        ) {
            return res.json({
                success: true,
                logs: ""
            });
        }

        let logs =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (
            logs.length >
            100000
        ) {
            logs =
                logs.slice(
                    -100000
                );
        }

        res.json({
            success: true,
            logs
        });
    }
);


// ============================================================
// SERVER LÖSCHEN
// ============================================================

app.delete(
    "/api/servers/:id",
    requireLogin,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        const allowed =
            server.owner.toLowerCase() ===
            req.email.toLowerCase();

        if (
            !allowed &&
            !isOwner(req.email)
        ) {
            return res.status(403).json({
                success: false
            });
        }

        const child =
            processes.get(
                server.id
            );

        if (child) {

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}

            processes.delete(
                server.id
            );
        }

        servers =
            servers.filter(
                item =>
                    item.id !==
                    server.id
            );

        saveJSON(
            SERVERS_FILE,
            servers
        );

        try {
            fs.rmSync(
                serverPath(
                    server.id
                ),
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}

        res.json({
            success: true,
            message:
                "Server gelöscht."
        });
    }
);


// ============================================================
// ADMIN: SERVER
// ============================================================

app.get(
    "/api/admin/servers",
    requireOwner,
    (req, res) => {

        res.json({
            success: true,
            servers:
                servers.map(
                    publicServer
                )
        });
    }
);


// ============================================================
// ADMIN: ALLE SERVER STOPPEN
// ============================================================

app.post(
    "/api/admin/stop-all",
    requireOwner,
    (req, res) => {

        let count = 0;

        for (
            const server of servers
        ) {

            const child =
                processes.get(
                    server.id
                );

            if (!child) {
                continue;
            }

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {
                try {
                    child.kill();
                } catch {}
            }

            writeServerLog(
                server,
                "OWNER: Server heruntergefahren."
            );

            count++;
        }

        res.json({
            success: true,
            stopped: count
        });
    }
);


// ============================================================
// ADMIN: SERVER SPERREN
// ============================================================

app.post(
    "/api/admin/servers/:id/lock",
    requireOwner,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        server.locked = true;

        const child =
            processes.get(
                server.id
            );

        if (child) {

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}

            processes.delete(
                server.id
            );
        }

        saveJSON(
            SERVERS_FILE,
            servers
        );

        writeServerLog(
            server,
            "OWNER: Server gesperrt."
        );

        res.json({
            success: true,
            message:
                "Server gesperrt."
        });
    }
);


// ============================================================
// ADMIN: SERVER ENTSPERREN
// ============================================================

app.post(
    "/api/admin/servers/:id/unlock",
    requireOwner,
    (req, res) => {

        const server =
            getServer(
                req.params.id
            );

        if (!server) {
            return res.status(404).json({
                success: false
            });
        }

        server.locked = false;

        saveJSON(
            SERVERS_FILE,
            servers
        );

        writeServerLog(
            server,
            "OWNER: Server entsperrt."
        );

        res.json({
            success: true,
            message:
                "Server entsperrt."
        });
    }
);


// ============================================================
// ADMIN: WEBSITE WARTUNG
// ============================================================

app.post(
    "/api/admin/maintenance",
    requireOwner,
    (req, res) => {

        settings.maintenance =
            Boolean(
                req.body.enabled
            );

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        res.json({
            success: true
        });
    }
);


// ============================================================
// ADMIN: STÖRUNG
// ============================================================

app.post(
    "/api/admin/outage",
    requireOwner,
    (req, res) => {

        settings.outage =
            Boolean(
                req.body.enabled
            );

        settings.outageText =
            cleanText(
                req.body.text,
                500
            );

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        res.json({
            success: true
        });
    }
);


// ============================================================
// HTML
// ============================================================

function page() {

    return `<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
>

<title>
Minecraft Hosting
</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    color: white;
    font-family: Arial, sans-serif;

    min-height: 100vh;

    background:
        radial-gradient(
            circle at top,
            #1b4520,
            #071007 50%,
            #020302
        );
}

nav {
    position: sticky;
    top: 0;
    z-index: 100;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 14px 18px;

    background:
        rgba(2,8,3,.96);

    border-bottom:
        1px solid
        rgba(90,190,80,.2);
}

.logo {
    font-weight: 900;
    font-size: 20px;
}

.nav-actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
}

button {
    border: 0;
    border-radius: 7px;

    padding: 10px 13px;

    color: white;

    background: #3f9239;

    cursor: pointer;
}

button:hover {
    filter: brightness(1.12);
}

.red {
    background: #a33737;
}

.orange {
    background: #a76d2d;
}

.dark {
    background: #182118;
}

.green {
    background: #3e9d3a;
}

.main {
    width:
        min(
            1120px,
            calc(100% - 20px)
        );

    margin:
        25px auto 80px;
}

.hero {
    padding:
        55px 20px;

    text-align:
        center;

    border-radius:
        16px;

    background:
        rgba(7,16,8,.88);

    border:
        1px solid
        rgba(90,200,80,.2);
}

.hero h1 {
    margin: 0;

    font-size:
        clamp(
            35px,
            8vw,
            70px
        );
}

.hero p {
    color:
        #aebaed;
}

.status {
    display: inline-block;

    margin-top: 14px;

    padding: 7px 12px;

    border-radius: 20px;

    background:
        rgba(70,170,60,.14);

    color:
        #7ee976;
}

.box {
    margin-top: 18px;

    padding: 20px;

    border-radius: 12px;

    background:
        rgba(7,15,8,.93);

    border:
        1px solid
        rgba(90,200,80,.17);
}

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                250px,
                1fr
            )
        );

    gap: 13px;
}

.card {
    padding: 17px;

    border-radius: 9px;

    background:
        #0b130c;

    border:
        1px solid
        #2a3b2c;
}

.card h3 {
    margin-top: 0;
}

input,
textarea {
    width: 100%;

    padding: 11px;

    margin: 5px 0;

    border-radius: 7px;

    border:
        1px solid
        #304332;

    outline: none;

    background:
        #0a100b;

    color: white;
}

textarea {
    min-height: 130px;

    resize:
        vertical;
}

input:focus,
textarea:focus {
    border-color:
        #58b950;
}

.actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-top: 10px;
}

.status-badge {
    display: inline-block;

    padding:
        4px 8px;

    border-radius:
        20px;

    background:
        #242c26;

    font-size:
        12px;
}

.pending {
    color:
        #f1bd67;
}

.accepted {
    color:
        #78df6e;
}

.rejected {
    color:
        #e97878;
}

.console {
    margin-top: 10px;

    min-height:
        200px;

    max-height:
        400px;

    overflow:
        auto;

    padding:
        12px;

    white-space:
        pre-wrap;

    background:
        #020402;

    color:
        #9ce996;

    font:
        12px
        Consolas,
        monospace;

    border-radius:
        7px;
}

.hidden {
    display: none !important;
}

.modal {
    position: fixed;

    inset: 0;

    z-index: 200;

    display: none;

    align-items: center;

    justify-content: center;

    padding: 15px;

    background:
        rgba(0,0,0,.75);

    backdrop-filter:
        blur(7px);
}

.modal.show {
    display: flex;
}

.modal-box {
    width:
        min(
            420px,
            100%
        );

    padding: 24px;

    border-radius:
        12px;

    background:
        #081009;

    border:
        1px solid
        #365938;
}

.close {
    float: right;

    background:
        transparent;

    font-size:
        23px;
}

.order-number {
    font-family:
        Consolas,
        monospace;

    font-weight:
        bold;

    color:
        #72df69;
}

.admin-order {
    border-left:
        4px solid
        #a66b2d;
}

@media(max-width:600px) {

    nav {
        flex-direction:
            column;

        align-items:
            flex-start;
    }

    .main {
        width:
            calc(100% - 10px);

        margin-top:
            12px;
    }

    .hero {
        padding:
            42px 13px;
    }

    .box {
        padding:
            14px;
    }

    .actions button {
        flex:
            1 1 auto;
    }

}

</style>

</head>

<body>

<nav>

<div class="logo">
⛏️ Minecraft Hosting
</div>

<div
    class="nav-actions"
    id="navigation"
>

<button onclick="openLogin()">
🔑 Anmelden
</button>

<button
    class="green"
    onclick="openRegister()"
>
📝 Registrieren
</button>

</div>

</nav>


<main class="main">


<section class="hero">

<h1>
Minecraft Hosting
</h1>

<p>
1 Server kostenlos · jeder weitere Server 5 €
</p>

<div
    id="status"
    class="status"
>
🟢 System online
</div>

</section>


<section
    id="accountBox"
    class="box hidden"
>

<h2>
👤 Konto
</h2>

<p id="accountText"></p>

</section>


<section
    id="hostingBox"
    class="box hidden"
>

<h2>
📦 Server bestellen
</h2>

<p>
Jede Bestellung muss zuerst vom Owner angenommen oder abgelehnt werden.
</p>

<input
    id="serverName"
    maxlength="32"
    placeholder="Servername"
/>

<input
    id="serverPort"
    type="number"
    min="1024"
    max="65535"
    placeholder="Port"
/>

<button
    onclick="createOrder()"
>
📦 Bestellung erstellen
</button>


<h2>
Meine Bestellungen
</h2>

<div
    id="myOrders"
    class="grid"
></div>


<h2>
Meine Server
</h2>

<div
    id="myServers"
    class="grid"
></div>

</section>


<section
    id="adminBox"
    class="box admin hidden"
>

<h2>
👑 Owner Panel
</h2>

<p>
Owner:
<strong>
${OWNER_EMAIL}
</strong>
</p>


<div class="actions">

<button
    class="orange"
    onclick="setMaintenance(true)"
>
🛠️ Wartung AN
</button>

<button
    class="dark"
    onclick="setMaintenance(false)"
>
✅ Wartung AUS
</button>

<button
    class="red"
    onclick="stopAll()"
>
⛔ Alle Server stoppen
</button>

</div>


<h3>
🚨 Störung
</h3>

<input
    id="outageText"
    placeholder="Störungstext"
/>

<div class="actions">

<button
    class="red"
    onclick="setOutage(true)"
>
🚨 Störung AN
</button>

<button
    class="dark"
    onclick="setOutage(false)"
>
✅ Störung AUS
</button>

</div>


<h2>
📦 Offene und vergangene Bestellungen
</h2>

<div
    id="adminOrders"
    class="grid"
></div>


<h2>
🖥️ Alle Server
</h2>

<div
    id="adminServers"
    class="grid"
></div>

</section>

</main>


<!-- LOGIN -->

<div
    id="loginModal"
    class="modal"
>

<div class="modal-box">

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

<h2>
🔑 Anmeldung
</h2>

<input
    id="loginInput"
    placeholder="Benutzername oder E-Mail"
/>

<input
    id="loginPassword"
    type="password"
    placeholder="Passwort"
/>

<button
    onclick="login()"
>
Anmelden
</button>

<p id="loginMessage"></p>

</div>

</div>


<!-- REGISTER -->

<div
    id="registerModal"
    class="modal"
>

<div class="modal-box">

<button
    class="close"
    onclick="closeModals()"
>
×
</button>

<h2>
📝 Registrierung
</h2>

<input
    id="registerUsername"
    maxlength="24"
    placeholder="Benutzername"
/>

<input
    id="registerEmail"
    type="email"
    placeholder="E-Mail"
/>

<input
    id="registerPassword"
    type="password"
    placeholder="Passwort"
/>

<button
    onclick="registerUser()"
>
Registrieren
</button>

<p id="registerMessage"></p>

</div>

</div>


<script>

let token =
    localStorage.getItem(
        "minecraft_host_token"
    ) || "";

let currentUser = null;

const pollers = {};


/* ======================================================
   API
====================================================== */

async function api(
    url,
    options = {}
) {

    const headers =
        options.headers || {};

    headers[
        "Content-Type"
    ] =
        "application/json";

    if (token) {
        headers[
            "Authorization"
        ] =
            "Bearer " +
            token;
    }

    options.headers =
        headers;

    const response =
        await fetch(
            url,
            options
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch {}

    return {
        response,
        data
    };
}


/* ======================================================
   MODAL
====================================================== */

function openLogin() {

    closeModals();

    document
        .getElementById(
            "loginModal"
        )
        .classList
        .add("show");
}

function openRegister() {

    closeModals();

    document
        .getElementById(
            "registerModal"
        )
        .classList
        .add("show");
}

function closeModals() {

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(
            modal =>
                modal
                    .classList
                    .remove("show")
        );
}


/* ======================================================
   REGISTRIEREN
====================================================== */

async function registerUser() {

    const username =
        document
            .getElementById(
                "registerUsername"
            )
            .value;

    const email =
        document
            .getElementById(
                "registerEmail"
            )
            .value;

    const password =
        document
            .getElementById(
                "registerPassword"
            )
            .value;

    const result =
        await api(
            "/api/register",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        username,
                        email,
                        password
                    })
            }
        );

    document
        .getElementById(
            "registerMessage"
        )
        .textContent =
            result.data.message ||
            "Fehler.";

    if (
        result.data.success
    ) {

        document
            .getElementById(
                "registerUsername"
            )
            .value = "";

        document
            .getElementById(
                "registerEmail"
            )
            .value = "";

        document
            .getElementById(
                "registerPassword"
            )
            .value = "";

        setTimeout(
            () => {
                closeModals();
                openLogin();
            },
            900
        );
    }
}


/* ======================================================
   LOGIN
====================================================== */

async function login() {

    const loginValue =
        document
            .getElementById(
                "loginInput"
            )
            .value;

    const password =
        document
            .getElementById(
                "loginPassword"
            )
            .value;

    const result =
        await api(
            "/api/login",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        login:
                            loginValue,
                        password
                    })
            }
        );

    if (
        !result.data.success
    ) {

        document
            .getElementById(
                "loginMessage"
            )
            .textContent =
                "❌ " +
                (
                    result.data.message ||
                    "Login fehlgeschlagen."
                );

        return;
    }

    token =
        result.data.token;

    currentUser =
        result.data.user;

    localStorage.setItem(
        "minecraft_host_token",
        token
    );

    closeModals();

    updateUI();

    loadAll();
}


/* ======================================================
   LOGOUT
====================================================== */

async function logout() {

    try {

        await api(
            "/api/logout",
            {
                method:
                    "POST"
            }
        );

    } catch {}

    token = "";
    currentUser = null;

    localStorage.removeItem(
        "minecraft_host_token"
    );

    location.reload();
}


/* ======================================================
   UI
====================================================== */

function updateUI() {

    if (!currentUser) {
        return;
    }

    document
        .getElementById(
            "accountBox"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "hostingBox"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "accountText"
        )
        .textContent =
            currentUser.username +
            " · " +
            currentUser.email;

    document
        .getElementById(
            "navigation"
        )
        .innerHTML =
            "<button class='dark' onclick='logout()'>🚪 Logout</button>";

    if (
        currentUser.admin
    ) {

        document
            .getElementById(
                "adminBox"
            )
            .classList
            .remove("hidden");
    }
}


/* ======================================================
   RESTORE LOGIN
====================================================== */

async function restoreLogin() {

    if (!token) {
        return;
    }

    const result =
        await api(
            "/api/me"
        );

    if (
        !result.data.success
    ) {

        token = "";

        localStorage.removeItem(
            "minecraft_host_token"
        );

        return;
    }

    currentUser =
        result.data.user;

    updateUI();

    loadAll();
}


/* ======================================================
   BESTELLUNG
====================================================== */

async function createOrder() {

    const serverName =
        document
            .getElementById(
                "serverName"
            )
            .value
            .trim();

    const port =
        Number(
            document
                .getElementById(
                    "serverPort"
                )
                .value
        );

    const result =
        await api(
            "/api/orders",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        serverName,
                        port
                    })
            }
        );

    alert(
        result.data.message ||
        "Bestellung erstellt."
    );

    if (
        result.data.success
    ) {

        document
            .getElementById(
                "serverName"
            )
            .value = "";

        document
            .getElementById(
                "serverPort"
            )
            .value = "";

        loadOrders();
    }
}


/* ======================================================
   MEINE BESTELLUNGEN
====================================================== */

async function loadOrders() {

    const result =
        await api(
            "/api/orders"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "myOrders"
            );

    box.innerHTML = "";

    result.data.orders
        .forEach(
            order => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "card";

                card.innerHTML =
                    "<h3>📦 " +
                    escapeHTML(
                        order.serverName
                    ) +
                    "</h3>" +

                    "<p>Bestellnummer:</p>" +

                    "<div class='order-number'>" +
                    escapeHTML(
                        order.orderNumber
                    ) +
                    "</div>" +

                    "<p>Preis: " +
                    (
                        order.price === 0
                            ? "Kostenlos"
                            : "5 €"
                    ) +
                    "</p>" +

                    "<p>Status: " +
                    "<span class='status-badge " +
                    escapeHTML(
                        order.status
                    ) +
                    "'>" +
                    escapeHTML(
                        order.status
                    ) +
                    "</span></p>" +

                    (
                        order.reason
                            ? "<p>Grund: " +
                              escapeHTML(
                                  order.reason
                              ) +
                              "</p>"
                            : ""
                    );

                box.appendChild(
                    card
                );
            }
        );
}


/* ======================================================
   SERVER
====================================================== */

async function loadServers() {

    const result =
        await api(
            "/api/servers"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "myServers"
            );

    box.innerHTML = "";

    if (
        result.data.servers.length === 0
    ) {

        box.innerHTML =
            "<div class='card'>Noch kein Server vorhanden.</div>";

        return;
    }

    result.data.servers
        .forEach(
            server => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "card";

                card.innerHTML =
                    "<h3>🖥️ " +
                    escapeHTML(
                        server.name
                    ) +
                    "</h3>" +

                    "<p>Bestellung: " +
                    escapeHTML(
                        server.orderNumber
                    ) +
                    "</p>" +

                    "<p>IP/Host: " +
                    escapeHTML(
                        location.hostname
                    ) +
                    "</p>" +

                    "<p>Port: " +
                    server.port +
                    "</p>" +

                    "<p>Status: " +
                    "<strong class='" +
                    (
                        server.status ===
                        "online"
                            ? "online"
                            : ""
                    ) +
                    "'>" +
                    escapeHTML(
                        server.status
                    ) +
                    "</strong></p>" +

                    (
                        server.locked
                            ? "<p>🔒 Gesperrt</p>"
                            : ""
                    ) +

                    "<div class='actions'>" +

                    "<button onclick=\"serverAction('" +
                    server.id +
                    "','start')\">" +
                    "▶ Start</button>" +

                    "<button class='red' onclick=\"serverAction('" +
                    server.id +
                    "','stop')\">" +
                    "⏹ Stop</button>" +

                    "<button class='orange' onclick=\"serverAction('" +
                    server.id +
                    "','restart')\">" +
                    "🔄 Restart</button>" +

                    "<button class='dark' onclick=\"toggleConsole('" +
                    server.id +
                    "')\">" +
                    "📟 Console</button>" +

                    "<button class='red' onclick=\"deleteServer('" +
                    server.id +
                    "')\">" +
                    "🗑 Löschen</button>" +

                    "</div>" +

                    "<div id='console-" +
                    server.id +
                    "' class='hidden'>" +

                    "<div id='logs-" +
                    server.id +
                    "' class='console'></div>" +

                    "<input id='command-" +
                    server.id +
                    "' placeholder='Minecraft-Befehl'>" +

                    "<button onclick=\"sendCommand('" +
                    server.id +
                    "')\">" +
                    "➤ Senden</button>" +

                    "</div>";

                box.appendChild(
                    card
                );
            }
        );
}


async function serverAction(
    id,
    action
) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/" +
            action,
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        (
            result.data.success
                ? "Erfolgreich."
                : "Fehler."
        )
    );

    setTimeout(
        loadServers,
        700
    );

    if (
        currentUser &&
        currentUser.admin
    ) {
        setTimeout(
            loadAdmin,
            700
        );
    }
}


async function deleteServer(id) {

    if (
        !confirm(
            "Server wirklich löschen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ),
            {
                method:
                    "DELETE"
            }
        );

    alert(
        result.data.message ||
        "Server gelöscht."
    );

    loadServers();
    loadAdmin();
}


function toggleConsole(id) {

    const box =
        document
            .getElementById(
                "console-" +
                id
            );

    if (!box) {
        return;
    }

    box.classList.toggle(
        "hidden"
    );

    loadLogs(id);

    if (
        !pollers[id]
    ) {

        pollers[id] =
            setInterval(
                () => loadLogs(id),
                3000
            );
    }
}


async function loadLogs(id) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/logs"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "logs-" +
                id
            );

    if (!box) {
        return;
    }

    box.textContent =
        result.data.logs ||
        "Noch keine Logs.";

    box.scrollTop =
        box.scrollHeight;
}


async function sendCommand(id) {

    const input =
        document
            .getElementById(
                "command-" +
                id
            );

    const command =
        input.value.trim();

    if (!command) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/command",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        command
                    })
            }
        );

    if (
        !result.data.success
    ) {

        alert(
            result.data.message ||
            "Fehler."
        );

        return;
    }

    input.value = "";

    setTimeout(
        () => loadLogs(id),
        500
    );
}


/* ======================================================
   ADMIN BESTELLUNGEN
====================================================== */

async function loadAdminOrders() {

    if (
        !currentUser ||
        !currentUser.admin
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/orders"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "adminOrders"
            );

    box.innerHTML = "";

    result.data.orders
        .forEach(
            order => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "card admin-order";

                card.innerHTML =
                    "<h3>📦 " +
                    escapeHTML(
                        order.serverName
                    ) +
                    "</h3>" +

                    "<p>Bestellnummer:</p>" +

                    "<div class='order-number'>" +
                    escapeHTML(
                        order.orderNumber
                    ) +
                    "</div>" +

                    "<p>Benutzer: " +
                    escapeHTML(
                        order.userEmail
                    ) +
                    "</p>" +

                    "<p>Port: " +
                    order.port +
                    "</p>" +

                    "<p>Preis: " +
                    (
                        order.price === 0
                            ? "Kostenlos"
                            : "5 €"
                    ) +
                    "</p>" +

                    "<p>Status: " +
                    "<span class='status-badge " +
                    escapeHTML(
                        order.status
                    ) +
                    "'>" +
                    escapeHTML(
                        order.status
                    ) +
                    "</span></p>";

                if (
                    order.status ===
                    "pending"
                ) {

                    const actions =
                        document
                            .createElement(
                                "div"
                            );

                    actions.className =
                        "actions";

                    const accept =
                        document
                            .createElement(
                                "button"
                            );

                    accept.className =
                        "green";

                    accept.textContent =
                        "✅ Annehmen";

                    accept.onclick =
                        () =>
                            acceptOrder(
                                order.id
                            );

                    const reject =
                        document
                            .createElement(
                                "button"
                            );

                    reject.className =
                        "red";

                    reject.textContent =
                        "❌ Ablehnen";

                    reject.onclick =
                        () =>
                            rejectOrder(
                                order.id
                            );

                    actions.appendChild(
                        accept
                    );

                    actions.appendChild(
                        reject
                    );

                    card.appendChild(
                        actions
                    );
                }

                box.appendChild(
                    card
                );
            }
        );
}


async function acceptOrder(id) {

    const result =
        await api(
            "/api/admin/orders/" +
            encodeURIComponent(
                id
            ) +
            "/accept",
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Bestellung angenommen."
    );

    await loadAdminOrders();
    await loadAdminServers();
    await loadOrders();
    await loadServers();
}


async function rejectOrder(id) {

    const reason =
        prompt(
            "Grund für die Ablehnung:"
        );

    if (reason === null) {
        return;
    }

    const result =
        await api(
            "/api/admin/orders/" +
            encodeURIComponent(
                id
            ) +
            "/reject",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        reason:
                            reason ||
                            "Vom Owner abgelehnt."
                    })
            }
        );

    alert(
        result.data.message ||
        "Bestellung abgelehnt."
    );

    await loadAdminOrders();
    await loadOrders();
}


/* ======================================================
   ADMIN SERVER
====================================================== */

async function loadAdminServers() {

    if (
        !currentUser ||
        !currentUser.admin
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/servers"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const box =
        document
            .getElementById(
                "adminServers"
            );

    box.innerHTML = "";

    result.data.servers
        .forEach(
            server => {

                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "card";

                card.innerHTML =
                    "<h3>🖥️ " +
                    escapeHTML(
                        server.name
                    ) +
                    "</h3>" +

                    "<p>Owner: " +
                    escapeHTML(
                        server.owner
                    ) +
                    "</p>" +

                    "<p>Bestellung: " +
                    escapeHTML(
                        server.orderNumber
                    ) +
                    "</p>" +

                    "<p>Port: " +
                    server.port +
                    "</p>" +

                    "<p>Status: " +
                    escapeHTML(
                        server.status
                    ) +
                    "</p>" +

                    "<div class='actions'>" +

                    "<button onclick=\"adminServerAction('" +
                    server.id +
                    "','start')\">" +
                    "▶</button>" +

                    "<button class='red' onclick=\"adminServerAction('" +
                    server.id +
                    "','stop')\">" +
                    "⏹</button>" +

                    "<button onclick=\"lockServer('" +
                    server.id +
                    "')\">" +
                    "🔒</button>" +

                    "<button class='dark' onclick=\"unlockServer('" +
                    server.id +
                    "')\">" +
                    "🔓</button>" +

                    "<button class='red' onclick=\"deleteAdminServer('" +
                    server.id +
                    "')\">" +
                    "🗑</button>" +

                    "</div>";

                box.appendChild(
                    card
                );
            }
        );
}


async function adminServerAction(
    id,
    action
) {

    const result =
        await api(
            "/api/servers/" +
            encodeURIComponent(
                id
            ) +
            "/" +
            action,
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Fertig."
    );

    loadAdminServers();
    loadServers();
}


async function lockServer(id) {

    const result =
        await api(
            "/api/admin/servers/" +
            encodeURIComponent(
                id
            ) +
            "/lock",
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Server gesperrt."
    );

    loadAdminServers();
    loadServers();
}


async function unlockServer(id) {

    const result =
        await api(
            "/api/admin/servers/" +
            encodeURIComponent(
                id
            ) +
            "/unlock",
            {
                method:
                    "POST"
            }
        );

    alert(
        result.data.message ||
        "Server entsperrt."
    );

    loadAdminServers();
    loadServers();
}


async function deleteAdminServer(
    id
) {

    if (
        !confirm(
            "Diesen Server endgültig löschen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/servers/" +
            encodeURIComponent(
                id
            ),
            {
                method:
                    "DELETE"
            }
        );

    alert(
        result.data.message ||
        "Server gelöscht."
    );

    loadAdminServers();
    loadServers();
}


/* ======================================================
   ADMIN SYSTEM
====================================================== */

async function stopAll() {

    if (
        !confirm(
            "ALLE Minecraft-Server stoppen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/stop-all",
            {
                method:
                    "POST"
            }
        );

    alert(
        "Gestoppte Server: " +
        (
            result.data.stopped ||
            0
        )
    );

    loadAdminServers();
    loadServers();
}


async function setMaintenance(
    enabled
) {

    await api(
        "/api/admin/maintenance",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    enabled
                })
        }
    );

    updateStatus();
}


async function setOutage(
    enabled
) {

    const text =
        document
            .getElementById(
                "outageText"
            )
            .value;

    await api(
        "/api/admin/outage",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    enabled,
                    text
                })
        }
    );

    updateStatus();
}


/* ======================================================
   STATUS
====================================================== */

async function updateStatus() {

    const result =
        await api(
            "/api/status"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const status =
        document
            .getElementById(
                "status"
            );

    if (
        result.data.maintenance
    ) {

        status.textContent =
            "🛠️ Website in Wartung";

        status.style.color =
            "#f0bc68";

        return;
    }

    if (
        result.data.outage
    ) {

        status.textContent =
            "🚨 " +
            (
                result.data.outageText ||
                "Störung"
            );

        status.style.color =
            "#ef7777";

        return;
    }

    status.textContent =
        "🟢 System online";

    status.style.color =
        "#7ee976";
}


/* ======================================================
   ALLES
====================================================== */

async function loadAll() {

    await updateStatus();

    if (!currentUser) {
        return;
    }

    await loadOrders();
    await loadServers();

    if (
        currentUser.admin
    ) {
        await loadAdminOrders();
        await loadAdminServers();
    }
}


/* ======================================================
   HTML SICHER
====================================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* ======================================================
   START
====================================================== */

restoreLogin();

setInterval(
    updateStatus,
    5000
);

setInterval(
    () => {

        if (!currentUser) {
            return;
        }

        loadOrders();
        loadServers();

        if (
            currentUser.admin
        ) {
            loadAdminOrders();
            loadAdminServers();
        }

    },
    5000
);

</script>

</body>

</html>`;
}


// ============================================================
// WEBSITE
// ============================================================

app.get(
    "/",
    (req, res) => {
        res.send(
            page()
        );
    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith("/api/")
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "API-Endpunkt nicht gefunden."
            });
        }

        res.status(404).send(
            page()
        );
    }
);


// ============================================================
// FEHLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ SERVER FEHLER:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            message:
                "Interner Serverfehler."
        });
    }
);


// ============================================================
// SHUTDOWN
// ============================================================

function shutdown() {

    console.log(
        "🛑 Hosting wird beendet..."
    );

    for (
        const server of servers
    ) {

        const child =
            processes.get(
                server.id
            );

        if (!child) {
            continue;
        }

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        setTimeout(
            () => {
                try {
                    child.kill();
                } catch {}
            },
            3000
        );
    }

    setTimeout(
        () => process.exit(0),
        4000
    );
}

process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);


// ============================================================
// START
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "=========================================="
        );

        console.log(
            "⛏️ Minecraft Hosting"
        );

        console.log(
            "=========================================="
        );

        console.log(
            "🌐 Port: " +
            PORT
        );

        console.log(
            "👑 Owner: " +
            OWNER_EMAIL
        );

        console.log(
            "🆓 Erster Server: kostenlos"
        );

        console.log(
            "💶 Weitere Server: " +
            EXTRA_SERVER_PRICE +
            " €"
        );

        console.log(
            "📦 Jede Bestellung benötigt Freigabe"
        );

        console.log(
            "📟 Konsole + Logs: aktiv"
        );

        console.log(
            "=========================================="
        );
    }
);
