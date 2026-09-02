'use strict';
// webseite.js
// Minecraft Hosting Website – komplett neu von 0
// Benötigt: express, express-session, bcryptjs
//
// Installation:
// npm install express express-session bcryptjs
//
// Start:
// node webseite.js
//
// Optional .env:
// PORT=3000
// SESSION_SECRET=ein-langes-zufälliges-geheimes-passwort
// OWNER_EMAIL=florianzustolberg@gmail.com
//
// WICHTIG:
// Dieses Grundsystem verwaltet Benutzer, Bestellungen und Server.
// Für echte Minecraft-Prozesse (start/stop/console/files) muss später
// noch ein Minecraft-Backend bzw. Docker/Pterodactyl angebunden werden.

"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ----------------------------------------------------
// KONFIGURATION
// ----------------------------------------------------

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const OWNER_EMAIL =
    process.env.OWNER_EMAIL || "florianzustolberg@gmail.com";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "CHANGE-ME-TO-A-LONG-RANDOM-SECRET";

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const BANS_FILE = path.join(DATA_DIR, "bans.json");

// ----------------------------------------------------
// EXPRESS
// ----------------------------------------------------

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// ----------------------------------------------------
// DATENBANK-ERSATZ MIT JSON
// ----------------------------------------------------

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const files = [
        [USERS_FILE, []],
        [SERVERS_FILE, []],
        [ORDERS_FILE, []],
        [BANS_FILE, []]
    ];

    for (const [file, defaultValue] of files) {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(defaultValue, null, 2),
                "utf8"
            );
        }
    }
}

ensureDataDir();

function readJSON(file) {
    try {
        const content = fs.readFileSync(file, "utf8");

        if (!content.trim()) {
            return [];
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("❌ Fehler beim Lesen:", file);
        console.error(error);
        return [];
    }
}

function writeJSON(file, data) {
    try {
        const tempFile =
            file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tempFile, file);

        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern:", file);
        console.error(error);
        return false;
    }
}

function users() {
    return readJSON(USERS_FILE);
}

function servers() {
    return readJSON(SERVERS_FILE);
}

function orders() {
    return readJSON(ORDERS_FILE);
}

function bans() {
    return readJSON(BANS_FILE);
}

// ----------------------------------------------------
// HILFSFUNKTIONEN
// ----------------------------------------------------

function id(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(10).toString("hex")
    );
}

function now() {
    return new Date().toISOString();
}

function cleanText(value, max = 100) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, max);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validUsername(username) {
    return /^[a-zA-Z0-9_.-]{3,24}$/.test(username);
}

function isOwner(user) {
    return Boolean(
        user &&
        user.email &&
        user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
    );
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        banned: Boolean(user.banned)
    };
}

function getUserById(userId) {
    return users().find((user) => user.id === userId);
}

function getServerById(serverId) {
    return servers().find((server) => server.id === serverId);
}

function getOrderById(orderId) {
    return orders().find((order) => order.id === orderId);
}

function isAdmin(user) {
    return Boolean(
        user &&
        (
            user.role === "admin" ||
            user.role === "owner" ||
            isOwner(user)
        )
    );
}

function currentUser(req) {
    if (!req.session.userId) {
        return null;
    }

    const user = getUserById(req.session.userId);

    if (!user) {
        req.session.destroy(() => {});
        return null;
    }

    return user;
}

// ----------------------------------------------------
// AUTH MIDDLEWARE
// ----------------------------------------------------

function requireLogin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Du musst angemeldet sein."
        });
    }

    if (user.banned) {
        req.session.destroy(() => {});

        return res.status(403).json({
            success: false,
            error: "Dein Account wurde gesperrt."
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Nicht angemeldet."
        });
    }

    if (!isAdmin(user)) {
        return res.status(403).json({
            success: false,
            error: "Keine Berechtigung."
        });
    }

    next();
}

function requireOwner(req, res, next) {
    const user = currentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Nicht angemeldet."
        });
    }

    if (!isOwner(user)) {
        return res.status(403).json({
            success: false,
            error: "Nur der Owner darf diese Aktion ausführen."
        });
    }

    next();
}

// ----------------------------------------------------
// HOME
// ----------------------------------------------------

app.get("/", (req, res) => {
    res.send(HTML);
});

// ----------------------------------------------------
// AUTH
// ----------------------------------------------------

app.post("/api/register", async (req, res) => {
    try {
        const username = cleanText(req.body.username, 24);
        const email = cleanText(req.body.email, 120).toLowerCase();
        const password = String(req.body.password || "");

        if (!validUsername(username)) {
            return res.status(400).json({
                success: false,
                error:
                    "Benutzername muss 3-24 Zeichen haben und darf nur Buchstaben, Zahlen, _, . und - enthalten."
            });
        }

        if (!validEmail(email)) {
            return res.status(400).json({
                success: false,
                error: "Ungültige E-Mail-Adresse."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: "Das Passwort muss mindestens 8 Zeichen haben."
            });
        }

        const allUsers = users();

        const existingUsername = allUsers.find(
            (user) =>
                user.username.toLowerCase() === username.toLowerCase()
        );

        if (existingUsername) {
            return res.status(409).json({
                success: false,
                error: "Der Benutzername ist bereits vergeben."
            });
        }

        const existingEmail = allUsers.find(
            (user) => user.email.toLowerCase() === email
        );

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: "Diese E-Mail ist bereits registriert."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = {
            id: id("usr"),
            username,
            email,
            passwordHash,
            role:
                email === OWNER_EMAIL.toLowerCase()
                    ? "owner"
                    : "user",
            banned: false,
            createdAt: now()
        };

        allUsers.push(user);

        writeJSON(USERS_FILE, allUsers);

        req.session.userId = user.id;

        return res.json({
            success: true,
            message: "Registrierung erfolgreich.",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("❌ REGISTER ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Registrierung fehlgeschlagen."
        });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const email = cleanText(req.body.email, 120).toLowerCase();
        const password = String(req.body.password || "");

        const user = users().find(
            (entry) => entry.email.toLowerCase() === email
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "E-Mail oder Passwort ist falsch."
            });
        }

        if (user.banned) {
            return res.status(403).json({
                success: false,
                error: "Dein Account wurde gesperrt."
            });
        }

        const valid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!valid) {
            return res.status(401).json({
                success: false,
                error: "E-Mail oder Passwort ist falsch."
            });
        }

        if (
            email === OWNER_EMAIL.toLowerCase() &&
            user.role !== "owner"
        ) {
            const allUsers = users();
            const index = allUsers.findIndex(
                (entry) => entry.id === user.id
            );

            if (index !== -1) {
                allUsers[index].role = "owner";
                writeJSON(USERS_FILE, allUsers);
                user.role = "owner";
            }
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error("❌ Session Fehler:", err);

                return res.status(500).json({
                    success: false,
                    error: "Session konnte nicht erstellt werden."
                });
            }

            req.session.userId = user.id;

            return res.json({
                success: true,
                message: "Login erfolgreich.",
                user: publicUser(user)
            });
        });
    } catch (error) {
        console.error("❌ LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Login fehlgeschlagen."
        });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("❌ LOGOUT ERROR:", error);

            return res.status(500).json({
                success: false,
                error: "Logout fehlgeschlagen."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            success: true,
            message: "Du wurdest abgemeldet."
        });
    });
});

app.get("/api/me", (req, res) => {
    const user = currentUser(req);

    if (!user) {
        return res.json({
            success: true,
            loggedIn: false
        });
    }

    return res.json({
        success: true,
        loggedIn: true,
        user: publicUser(user),
        owner: isOwner(user),
        admin: isAdmin(user)
    });
});

// ----------------------------------------------------
// PASSWORT ÄNDERN
// ----------------------------------------------------

app.post(
    "/api/account/password",
    requireLogin,
    async (req, res) => {
        try {
            const user = currentUser(req);

            const oldPassword = String(
                req.body.oldPassword || ""
            );

            const newPassword = String(
                req.body.newPassword || ""
            );

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Das neue Passwort muss mindestens 8 Zeichen haben."
                });
            }

            const valid = await bcrypt.compare(
                oldPassword,
                user.passwordHash
            );

            if (!valid) {
                return res.status(401).json({
                    success: false,
                    error: "Das alte Passwort ist falsch."
                });
            }

            const allUsers = users();

            const index = allUsers.findIndex(
                (entry) => entry.id === user.id
            );

            allUsers[index].passwordHash =
                await bcrypt.hash(newPassword, 12);

            writeJSON(USERS_FILE, allUsers);

            return res.json({
                success: true,
                message: "Passwort wurde geändert."
            });
        } catch (error) {
            console.error("❌ PASSWORD ERROR:", error);

            return res.status(500).json({
                success: false,
                error: "Passwort konnte nicht geändert werden."
            });
        }
    }
);

// ----------------------------------------------------
// ADMIN PASSWORT RESET
// ----------------------------------------------------

app.post(
    "/api/admin/users/:id/reset-password",
    requireAdmin,
    async (req, res) => {
        try {
            const newPassword = String(
                req.body.newPassword || ""
            );

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: "Passwort muss mindestens 8 Zeichen haben."
                });
            }

            const allUsers = users();

            const index = allUsers.findIndex(
                (user) => user.id === req.params.id
            );

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Benutzer nicht gefunden."
                });
            }

            allUsers[index].passwordHash =
                await bcrypt.hash(newPassword, 12);

            writeJSON(USERS_FILE, allUsers);

            console.log(
                `🔐 Passwort zurückgesetzt: ${allUsers[index].username}`
            );

            return res.json({
                success: true,
                message: "Passwort wurde zurückgesetzt."
            });
        } catch (error) {
            console.error("❌ ADMIN PASSWORD RESET:", error);

            return res.status(500).json({
                success: false,
                error: "Passwort konnte nicht zurückgesetzt werden."
            });
        }
    }
);

// ----------------------------------------------------
// SERVER BESTELLEN
// ----------------------------------------------------

app.post(
    "/api/orders",
    requireLogin,
    (req, res) => {
        try {
            const user = currentUser(req);

            const serverName = cleanText(
                req.body.serverName,
                50
            );

            const version = cleanText(
                req.body.version || "1.21.8",
                30
            );

            const type = cleanText(
                req.body.type || "Paper",
                30
            );

            if (!serverName) {
                return res.status(400).json({
                    success: false,
                    error: "Bitte gib einen Servernamen an."
                });
            }

            const allOrders = orders();

            const order = {
                id: id("order"),
                userId: user.id,
                username: user.username,
                serverName,
                version,
                type,
                status: "pending",
                reason: "",
                createdAt: now(),
                updatedAt: now()
            };

            allOrders.push(order);

            writeJSON(ORDERS_FILE, allOrders);

            return res.json({
                success: true,
                message:
                    "Server-Bestellung wurde gesendet und wartet auf Freigabe.",
                order
            });
        } catch (error) {
            console.error("❌ ORDER ERROR:", error);

            return res.status(500).json({
                success: false,
                error: "Bestellung konnte nicht erstellt werden."
            });
        }
    }
);

// ----------------------------------------------------
// EIGENE BESTELLUNGEN
// ----------------------------------------------------

app.get(
    "/api/orders",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);

        const result = orders().filter(
            (order) => order.userId === user.id
        );

        res.json({
            success: true,
            orders: result
        });
    }
);

// ----------------------------------------------------
// ADMIN BESTELLUNGEN
// ----------------------------------------------------

app.get(
    "/api/admin/orders",
    requireAdmin,
    (req, res) => {
        res.json({
            success: true,
            orders: orders()
        });
    }
);

// ----------------------------------------------------
// BESTELLUNG ANNEHMEN
// ----------------------------------------------------

app.post(
    "/api/admin/orders/:id/accept",
    requireAdmin,
    (req, res) => {
        try {
            const allOrders = orders();

            const orderIndex = allOrders.findIndex(
                (order) => order.id === req.params.id
            );

            if (orderIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Bestellung nicht gefunden."
                });
            }

            const order = allOrders[orderIndex];

            if (order.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    error: "Diese Bestellung wurde bereits bearbeitet."
                });
            }

            const server = {
                id: id("srv"),
                ownerId: order.userId,
                ownerUsername: order.username,
                name: order.serverName,
                version: order.version,
                type: order.type,
                status: "stopped",
                locked: false,
                suspended: false,
                createdAt: now(),
                updatedAt: now()
            };

            const allServers = servers();

            allServers.push(server);

            order.status = "accepted";
            order.serverId = server.id;
            order.updatedAt = now();
            order.reason = "";

            writeJSON(SERVERS_FILE, allServers);
            writeJSON(ORDERS_FILE, allOrders);

            console.log(
                `✅ Bestellung angenommen: ${order.serverName}`
            );

            return res.json({
                success: true,
                message: "Bestellung angenommen.",
                server,
                order
            });
        } catch (error) {
            console.error("❌ ACCEPT ORDER:", error);

            return res.status(500).json({
                success: false,
                error: "Bestellung konnte nicht angenommen werden."
            });
        }
    }
);

// ----------------------------------------------------
// BESTELLUNG ABLEHNEN
// ----------------------------------------------------

app.post(
    "/api/admin/orders/:id/reject",
    requireAdmin,
    (req, res) => {
        try {
            const reason = cleanText(
                req.body.reason || "Keine Angabe",
                500
            );

            const allOrders = orders();

            const index = allOrders.findIndex(
                (order) => order.id === req.params.id
            );

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Bestellung nicht gefunden."
                });
            }

            if (allOrders[index].status !== "pending") {
                return res.status(400).json({
                    success: false,
                    error: "Bestellung wurde bereits bearbeitet."
                });
            }

            allOrders[index].status = "rejected";
            allOrders[index].reason = reason;
            allOrders[index].updatedAt = now();

            writeJSON(ORDERS_FILE, allOrders);

            console.log(
                `❌ Bestellung abgelehnt: ${allOrders[index].serverName}`
            );

            return res.json({
                success: true,
                message: "Bestellung wurde abgelehnt.",
                order: allOrders[index]
            });
        } catch (error) {
            console.error("❌ REJECT ORDER:", error);

            return res.status(500).json({
                success: false,
                error: "Bestellung konnte nicht abgelehnt werden."
            });
        }
    }
);

// ----------------------------------------------------
// SERVER DES USERS
// ----------------------------------------------------

app.get(
    "/api/servers",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);

        const result = servers().filter(
            (server) => server.ownerId === user.id
        );

        res.json({
            success: true,
            servers: result
        });
    }
);

// ----------------------------------------------------
// ADMIN ALLE SERVER
// ----------------------------------------------------

app.get(
    "/api/admin/servers",
    requireAdmin,
    (req, res) => {
        res.json({
            success: true,
            servers: servers()
        });
    }
);

// ----------------------------------------------------
// SERVER START
// ----------------------------------------------------

app.post(
    "/api/servers/:id/start",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);
        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const server = allServers[index];

        if (
            server.ownerId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        if (server.locked || server.suspended) {
            return res.status(403).json({
                success: false,
                error: "Dieser Server ist gesperrt."
            });
        }

        server.status = "running";
        server.updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: "Server wurde gestartet.",
            server
        });
    }
);

// ----------------------------------------------------
// SERVER STOP
// ----------------------------------------------------

app.post(
    "/api/servers/:id/stop",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);
        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const server = allServers[index];

        if (
            server.ownerId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        server.status = "stopped";
        server.updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: "Server wurde heruntergefahren.",
            server
        });
    }
);

// ----------------------------------------------------
// OWNER: SERVER SPERREN
// ----------------------------------------------------

app.post(
    "/api/owner/servers/:id/lock",
    requireOwner,
    (req, res) => {
        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        allServers[index].locked = true;
        allServers[index].status = "stopped";
        allServers[index].updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: "Server wurde gesperrt."
        });
    }
);

// ----------------------------------------------------
// OWNER: SERVER ENTSPERREN
// ----------------------------------------------------

app.post(
    "/api/owner/servers/:id/unlock",
    requireOwner,
    (req, res) => {
        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        allServers[index].locked = false;
        allServers[index].suspended = false;
        allServers[index].updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: "Server wurde entsperrt."
        });
    }
);

// ----------------------------------------------------
// OWNER: SERVER WARTUNG
// ----------------------------------------------------

app.post(
    "/api/owner/servers/:id/maintenance",
    requireOwner,
    (req, res) => {
        const enabled = Boolean(req.body.enabled);

        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        allServers[index].maintenance = enabled;

        if (enabled) {
            allServers[index].status = "stopped";
        }

        allServers[index].updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: enabled
                ? "Wartungsmodus aktiviert."
                : "Wartungsmodus deaktiviert."
        });
    }
);

// ----------------------------------------------------
// OWNER: SERVER LÖSCHEN
// ----------------------------------------------------

app.delete(
    "/api/owner/servers/:id",
    requireOwner,
    (req, res) => {
        const allServers = servers();

        const server = allServers.find(
            (entry) => entry.id === req.params.id
        );

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const filtered = allServers.filter(
            (entry) => entry.id !== req.params.id
        );

        writeJSON(SERVERS_FILE, filtered);

        console.log(
            `🗑️ Server gelöscht: ${server.name}`
        );

        return res.json({
            success: true,
            message: "Server wurde gelöscht."
        });
    }
);

// ----------------------------------------------------
// ADMIN BENUTZER
// ----------------------------------------------------

app.get(
    "/api/admin/users",
    requireAdmin,
    (req, res) => {
        res.json({
            success: true,
            users: users().map(publicUser)
        });
    }
);

// ----------------------------------------------------
// OWNER: ADMIN GEBEN
// ----------------------------------------------------

app.post(
    "/api/owner/users/:id/admin",
    requireOwner,
    (req, res) => {
        const allUsers = users();

        const index = allUsers.findIndex(
            (user) => user.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (isOwner(allUsers[index])) {
            return res.status(400).json({
                success: false,
                error: "Der Owner kann nicht verändert werden."
            });
        }

        allUsers[index].role = "admin";

        writeJSON(USERS_FILE, allUsers);

        return res.json({
            success: true,
            message: "Benutzer ist jetzt Admin."
        });
    }
);

// ----------------------------------------------------
// OWNER: ADMIN ENTFERNEN
// ----------------------------------------------------

app.delete(
    "/api/owner/users/:id/admin",
    requireOwner,
    (req, res) => {
        const allUsers = users();

        const index = allUsers.findIndex(
            (user) => user.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (isOwner(allUsers[index])) {
            return res.status(400).json({
                success: false,
                error: "Der Owner kann nicht entfernt werden."
            });
        }

        allUsers[index].role = "user";

        writeJSON(USERS_FILE, allUsers);

        return res.json({
            success: true,
            message: "Admin-Rechte wurden entfernt."
        });
    }
);

// ----------------------------------------------------
// OWNER: BENUTZER SPERREN
// ----------------------------------------------------

app.post(
    "/api/owner/users/:id/ban",
    requireOwner,
    (req, res) => {
        const allUsers = users();

        const index = allUsers.findIndex(
            (user) => user.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        if (isOwner(allUsers[index])) {
            return res.status(400).json({
                success: false,
                error: "Der Owner kann nicht gesperrt werden."
            });
        }

        allUsers[index].banned = true;

        writeJSON(USERS_FILE, allUsers);

        return res.json({
            success: true,
            message: "Benutzer wurde gesperrt."
        });
    }
);

// ----------------------------------------------------
// OWNER: BENUTZER ENTBANNEN
// ----------------------------------------------------

app.post(
    "/api/owner/users/:id/unban",
    requireOwner,
    (req, res) => {
        const allUsers = users();

        const index = allUsers.findIndex(
            (user) => user.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Benutzer nicht gefunden."
            });
        }

        allUsers[index].banned = false;

        writeJSON(USERS_FILE, allUsers);

        return res.json({
            success: true,
            message: "Benutzer wurde entsperrt."
        });
    }
);

// ----------------------------------------------------
// OWNER: SERVER NAMEN ÄNDERN
// ----------------------------------------------------

app.patch(
    "/api/owner/servers/:id",
    requireOwner,
    (req, res) => {
        const newName = cleanText(
            req.body.name,
            50
        );

        if (!newName) {
            return res.status(400).json({
                success: false,
                error: "Servername darf nicht leer sein."
            });
        }

        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        allServers[index].name = newName;
        allServers[index].updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message: "Servername geändert.",
            server: allServers[index]
        });
    }
);

// ----------------------------------------------------
// MINECRAFT CODE/DATEIEN
// ----------------------------------------------------
//
// Hier kann der Benutzer später seinen eigenen Code hochladen.
// Aktuell wird er sicher als Text gespeichert.
// Es wird NICHT automatisch JavaScript/Java auf dem Webserver
// ausgeführt.

app.post(
    "/api/servers/:id/code",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);
        const code = String(req.body.code || "");

        if (code.length > 500000) {
            return res.status(400).json({
                success: false,
                error: "Code ist zu groß."
            });
        }

        const allServers = servers();

        const index = allServers.findIndex(
            (server) => server.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        const server = allServers[index];

        if (
            server.ownerId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        server.customCode = code;
        server.updatedAt = now();

        writeJSON(SERVERS_FILE, allServers);

        return res.json({
            success: true,
            message:
                "Code wurde für den Server gespeichert."
        });
    }
);

app.get(
    "/api/servers/:id/code",
    requireLogin,
    (req, res) => {
        const user = currentUser(req);
        const server = getServerById(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                error: "Server nicht gefunden."
            });
        }

        if (
            server.ownerId !== user.id &&
            !isAdmin(user)
        ) {
            return res.status(403).json({
                success: false,
                error: "Keine Berechtigung."
            });
        }

        res.json({
            success: true,
            code: server.customCode || ""
        });
    }
);

// ----------------------------------------------------
// OWNER ALLE SERVER HERUNTERFAHREN
// ----------------------------------------------------

app.post(
    "/api/owner/shutdown-all",
    requireOwner,
    (req, res) => {
        const allServers = servers();

        for (const server of allServers) {
            server.status = "stopped";
            server.updatedAt = now();
        }

        writeJSON(SERVERS_FILE, allServers);

        console.log("🛑 OWNER: Alle Server heruntergefahren.");

        return res.json({
            success: true,
            message: "Alle Server wurden heruntergefahren."
        });
    }
);

// ----------------------------------------------------
// OWNER ALLE SERVER SPERREN
// ----------------------------------------------------

app.post(
    "/api/owner/lock-all",
    requireOwner,
    (req, res) => {
        const allServers = servers();

        for (const server of allServers) {
            server.locked = true;
            server.status = "stopped";
            server.updatedAt = now();
        }

        writeJSON(SERVERS_FILE, allServers);

        console.log("🔒 OWNER: Alle Server gesperrt.");

        return res.json({
            success: true,
            message: "Alle Server wurden gesperrt."
        });
    }
);

// ----------------------------------------------------
// STATISTIK
// ----------------------------------------------------

app.get(
    "/api/admin/stats",
    requireAdmin,
    (req, res) => {
        const allUsers = users();
        const allServers = servers();
        const allOrders = orders();

        res.json({
            success: true,
            stats: {
                users: allUsers.length,
                servers: allServers.length,
                runningServers: allServers.filter(
                    (server) =>
                        server.status === "running"
                ).length,
                pendingOrders: allOrders.filter(
                    (order) =>
                        order.status === "pending"
                ).length,
                acceptedOrders: allOrders.filter(
                    (order) =>
                        order.status === "accepted"
                ).length,
                rejectedOrders: allOrders.filter(
                    (order) =>
                        order.status === "rejected"
                ).length
            }
        });
    }
);

// ----------------------------------------------------
// 404 API
// ----------------------------------------------------

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        error: "API-Endpunkt nicht gefunden."
    });
});

// ----------------------------------------------------
// ERROR HANDLER
// ----------------------------------------------------

app.use((error, req, res, next) => {
    console.error("=================================");
    console.error("❌ SERVER ERROR");
    console.error(error);
    console.error("=================================");

    res.status(500).json({
        success: false,
        error: "Interner Serverfehler."
    });
});

// ----------------------------------------------------
// HTML
// ----------------------------------------------------

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Florian / WeisserHai Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #0b0d12;
    color: #fff;
}

header {
    padding: 20px;
    border-bottom: 1px solid #242936;
    background: #10131a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}

.logo {
    font-size: 22px;
    font-weight: 800;
}

nav {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

button {
    border: 0;
    border-radius: 10px;
    padding: 11px 15px;
    cursor: pointer;
    font-weight: 700;
    background: #5865f2;
    color: white;
}

button:hover {
    opacity: .9;
}

button.danger {
    background: #ed4245;
}

button.green {
    background: #2ecc71;
}

button.gray {
    background: #30343d;
}

main {
    max-width: 1200px;
    margin: auto;
    padding: 30px 18px;
}

.hero {
    padding: 50px 20px;
    text-align: center;
}

.hero h1 {
    font-size: clamp(32px, 6vw, 60px);
    margin: 0 0 15px;
}

.hero p {
    color: #aab1c2;
    font-size: 18px;
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(280px, 1fr));
    gap: 18px;
}

.card {
    background: #12161e;
    border: 1px solid #252b38;
    border-radius: 16px;
    padding: 20px;
}

.card h2,
.card h3 {
    margin-top: 0;
}

input,
select,
textarea {
    width: 100%;
    margin: 7px 0;
    padding: 12px;
    background: #090b10;
    color: white;
    border: 1px solid #303644;
    border-radius: 9px;
    outline: none;
}

textarea {
    min-height: 200px;
    resize: vertical;
    font-family: monospace;
}

input:focus,
select:focus,
textarea:focus {
    border-color: #5865f2;
}

.hidden {
    display: none !important;
}

.status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 999px;
    background: #30343d;
    font-size: 12px;
}

.status.running {
    background: #237a45;
}

.status.stopped {
    background: #4b505b;
}

.status.pending {
    background: #8a6d1d;
}

.status.accepted {
    background: #237a45;
}

.status.rejected {
    background: #8b3030;
}

.small {
    color: #aab1c2;
    font-size: 13px;
}

#message {
    position: fixed;
    right: 20px;
    bottom: 20px;
    background: #181d27;
    border: 1px solid #343b4a;
    padding: 15px;
    border-radius: 12px;
    display: none;
    z-index: 9999;
    max-width: 350px;
}

.server-actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-top: 12px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    text-align: left;
    padding: 10px;
    border-bottom: 1px solid #272d39;
}

.badge {
    display: inline-block;
    background: #242a36;
    border-radius: 8px;
    padding: 5px 8px;
    font-size: 12px;
}

.section-title {
    margin-top: 40px;
}

</style>
</head>

<body>

<header>

<div class="logo">
    ⛏️ Florian / WeisserHai Minecraft Hosting
</div>

<nav id="nav">
    <button onclick="showPage('home')">Start</button>
    <button onclick="showPage('login')">Login</button>
    <button onclick="showPage('register')">Registrieren</button>
    <button id="dashboardButton"
            class="hidden"
            onclick="showPage('dashboard')">
        Dashboard
    </button>
    <button id="adminButton"
            class="hidden"
            onclick="showPage('admin')">
        Admin
    </button>
    <button id="logoutButton"
            class="hidden gray"
            onclick="logout()">
        Logout
    </button>
</nav>

</header>

<div id="message"></div>

<main>

<section id="home">

<div class="hero">
    <h1>Minecraft Hosting</h1>
    <p>
        Erstelle deine kostenlose Minecraft-Server-Bestellung.
        Ein Admin oder Owner muss sie zuerst freigeben.
    </p>

    <button onclick="showPage('register')">
        Kostenlos registrieren
    </button>
</div>

<div class="grid">

<div class="card">
    <h2>🖥️ Server</h2>
    <p>
        Minecraft-Server können über das Dashboard bestellt
        und verwaltet werden.
    </p>
</div>

<div class="card">
    <h2>✅ Freigabe</h2>
    <p>
        Jede Bestellung wird zuerst von einem Admin oder
        Owner geprüft.
    </p>
</div>

<div class="card">
    <h2>👑 Owner</h2>
    <p>
        Der Owner kann Benutzer und Server verwalten,
        Server sperren und Wartungen durchführen.
    </p>
</div>

</div>

</section>

<section id="login" class="hidden">

<div class="card" style="max-width:500px;margin:auto">

<h2>🔐 Anmeldung</h2>

<form onsubmit="login(event)">

<input
    id="loginEmail"
    type="email"
    placeholder="E-Mail"
    required
>

<input
    id="loginPassword"
    type="password"
    placeholder="Passwort"
    required
>

<button type="submit">
    Anmelden
</button>

</form>

<p class="small">
    Keine Registrierung? 
    <a href="#" onclick="showPage('register')">
        Jetzt registrieren
    </a>
</p>

</div>

</section>

<section id="register" class="hidden">

<div class="card" style="max-width:500px;margin:auto">

<h2>👤 Registrierung</h2>

<form onsubmit="registerUser(event)">

<input
    id="registerUsername"
    placeholder="Benutzername"
    minlength="3"
    maxlength="24"
    required
>

<input
    id="registerEmail"
    type="email"
    placeholder="E-Mail"
    required
>

<input
    id="registerPassword"
    type="password"
    placeholder="Passwort"
    minlength="8"
    required
>

<button type="submit">
    Konto erstellen
</button>

</form>

</div>

</section>

<section id="dashboard" class="hidden">

<h1>Dashboard</h1>

<div class="grid">

<div class="card">

<h2>🖥️ Server bestellen</h2>

<form onsubmit="createOrder(event)">

<input
    id="serverName"
    placeholder="Servername"
    maxlength="50"
    required
>

<select id="serverVersion">
    <option>1.21.8</option>
    <option>1.21.7</option>
    <option>1.21.6</option>
    <option>1.21.5</option>
    <option>1.20.6</option>
</select>

<select id="serverType">
    <option>Paper</option>
    <option>Vanilla</option>
    <option>Fabric</option>
    <option>Forge</option>
</select>

<button type="submit">
    Bestellung senden
</button>

</form>

</div>

<div class="card">

<h2>🔐 Passwort</h2>

<form onsubmit="changePassword(event)">

<input
    id="oldPassword"
    type="password"
    placeholder="Altes Passwort"
    required
>

<input
    id="newPassword"
    type="password"
    placeholder="Neues Passwort"
    minlength="8"
    required
>

<button type="submit">
    Passwort ändern
</button>

</form>

</div>

</div>

<h2 class="section-title">
    Meine Server
</h2>

<div id="servers"></div>

<h2 class="section-title">
    Meine Bestellungen
</h2>

<div id="orders"></div>

</section>

<section id="admin" class="hidden">

<h1>👑 Admin Panel</h1>

<div class="grid">

<div class="card">

<h2>📊 Statistik</h2>

<div id="stats">
    Lade...
</div>

</div>

<div class="card">

<h2>🛑 Owner Aktionen</h2>

<button
    id="shutdownAll"
    onclick="shutdownAll()"
    class="danger">
    Alle Server herunterfahren
</button>

<button
    id="lockAll"
    onclick="lockAll()"
    class="danger">
    Alle Server sperren
</button>

</div>

</div>

<h2 class="section-title">
    📦 Bestellungen
</h2>

<div id="adminOrders"></div>

<h2 class="section-title">
    🖥️ Server
</h2>

<div id="adminServers"></div>

<h2 class="section-title">
    👥 Benutzer
</h2>

<div id="adminUsers"></div>

</section>

</main>

<script>

let me = null;

function message(text) {

    const box = document.getElementById("message");

    box.textContent = text;
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 4000);
}

function showPage(page) {

    const pages = [
        "home",
        "login",
        "register",
        "dashboard",
        "admin"
    ];

    pages.forEach((name) => {

        const element =
            document.getElementById(name);

        if (element) {
            element.classList.toggle(
                "hidden",
                name !== page
            );
        }

    });

    if (page === "dashboard") {
        loadDashboard();
    }

    if (page === "admin") {
        loadAdmin();
    }
}

async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            success: false,
            error: "Ungültige Serverantwort."
        };
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error || "Fehler."
        );
    }

    return data;
}

async function registerUser(event) {

    event.preventDefault();

    try {

        const data = await api(
            "/api/register",
            {
                method: "POST",
                body: JSON.stringify({
                    username:
                        document.getElementById(
                            "registerUsername"
                        ).value,

                    email:
                        document.getElementById(
                            "registerEmail"
                        ).value,

                    password:
                        document.getElementById(
                            "registerPassword"
                        ).value
                })
            }
        );

        me = data.user;

        message(
            "Registrierung erfolgreich."
        );

        updateNav();

        showPage("dashboard");

    } catch (error) {

        message(error.message);

    }
}

async function login(event) {

    event.preventDefault();

    try {

        const data = await api(
            "/api/login",
            {
                method: "POST",
                body: JSON.stringify({
                    email:
                        document.getElementById(
                            "loginEmail"
                        ).value,

                    password:
                        document.getElementById(
                            "loginPassword"
                        ).value
                })
            }
        );

        me = data.user;

        message("Login erfolgreich.");

        updateNav();

        showPage("dashboard");

    } catch (error) {

        message(error.message);

    }
}

async function logout() {

    try {

        await api(
            "/api/logout",
            {
                method: "POST"
            }
        );

        me = null;

        updateNav();

        showPage("home");

        message("Du wurdest abgemeldet.");

    } catch (error) {

        message(error.message);

    }
}

function updateNav() {

    const dashboardButton =
        document.getElementById(
            "dashboardButton"
        );

    const adminButton =
        document.getElementById(
            "adminButton"
        );

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    dashboardButton.classList.toggle(
        "hidden",
        !me
    );

    logoutButton.classList.toggle(
        "hidden",
        !me
    );

    adminButton.classList.toggle(
        "hidden",
        !me ||
        (
            me.role !== "admin" &&
            me.role !== "owner"
        )
    );
}

async function createOrder(event) {

    event.preventDefault();

    try {

        const data = await api(
            "/api/orders",
            {
                method: "POST",
                body: JSON.stringify({

                    serverName:
                        document.getElementById(
                            "serverName"
                        ).value,

                    version:
                        document.getElementById(
                            "serverVersion"
                        ).value,

                    type:
                        document.getElementById(
                            "serverType"
                        ).value
                })
            }
        );

        message(data.message);

        document.getElementById(
            "serverName"
        ).value = "";

        loadDashboard();

    } catch (error) {

        message(error.message);

    }
}

async function changePassword(event) {

    event.preventDefault();

    try {

        const data = await api(
            "/api/account/password",
            {
                method: "POST",
                body: JSON.stringify({

                    oldPassword:
                        document.getElementById(
                            "oldPassword"
                        ).value,

                    newPassword:
                        document.getElementById(
                            "newPassword"
                        ).value
                })
            }
        );

        message(data.message);

        document.getElementById(
            "oldPassword"
        ).value = "";

        document.getElementById(
            "newPassword"
        ).value = "";

    } catch (error) {

        message(error.message);

    }
}

async function loadDashboard() {

    if (!me) {
        return;
    }

    try {

        const serverData =
            await api("/api/servers");

        const serverContainer =
            document.getElementById(
                "servers"
            );

        if (!serverData.servers.length) {

            serverContainer.innerHTML =
                '<div class="card">Noch keine Server.</div>';

        } else {

            serverContainer.innerHTML =
                serverData.servers.map(
                    serverCard
                ).join("");

        }

        const orderData =
            await api("/api/orders");

        const orderContainer =
            document.getElementById(
                "orders"
            );

        if (!orderData.orders.length) {

            orderContainer.innerHTML =
                '<div class="card">Noch keine Bestellungen.</div>';

        } else {

            orderContainer.innerHTML =
                orderData.orders.map(
                    orderCard
                ).join("");

        }

    } catch (error) {

        message(error.message);

    }
}

function serverCard(server) {

    return \`
<div class="card">

<h3>🖥️ \${escapeHTML(server.name)}</h3>

<p>
Version:
<strong>
\${escapeHTML(server.version)}
</strong>
</p>

<p>
Typ:
<strong>
\${escapeHTML(server.type)}
</strong>
</p>

<p>
Status:
<span class="status \${server.status}">
\${escapeHTML(server.status)}
</span>
</p>

<p>
\${server.locked
    ? "🔒 Server gesperrt"
    : "🔓 Server nicht gesperrt"}
</p>

<div class="server-actions">

<button
    onclick="serverAction('\${server.id}','start')"
    class="green">
    Start
</button>

<button
    onclick="serverAction('\${server.id}','stop')"
    class="danger">
    Stop
</button>

<button
    onclick="editCode('\${server.id}')"
    class="gray">
    Code bearbeiten
</button>

</div>

</div>
\`;

}

function orderCard(order) {

    return \`
<div class="card">

<h3>
📦 \${escapeHTML(order.serverName)}
</h3>

<p>
Status:
<span class="status \${order.status}">
\${escapeHTML(order.status)}
</span>
</p>

<p>
Version:
\${escapeHTML(order.version)}
</p>

<p>
Typ:
\${escapeHTML(order.type)}
</p>

\${
    order.reason
        ? "<p>Grund: " +
          escapeHTML(order.reason) +
          "</p>"
        : ""
}

</div>
\`;

}

async function serverAction(id, action) {

    try {

        const data = await api(
            "/api/servers/" +
            encodeURIComponent(id) +
            "/" +
            action,
            {
                method: "POST"
            }
        );

        message(data.message);

        loadDashboard();

    } catch (error) {

        message(error.message);

    }
}

async function editCode(id) {

    try {

        const data = await api(
            "/api/servers/" +
            encodeURIComponent(id) +
            "/code"
        );

        const code =
            prompt(
                "Minecraft-Code eingeben:",
                data.code || ""
            );

        if (code === null) {
            return;
        }

        const result =
            await api(
                "/api/servers/" +
                encodeURIComponent(id) +
                "/code",
                {
                    method: "POST",
                    body: JSON.stringify({
                        code
                    })
                }
            );

        message(result.message);

    } catch (error) {

        message(error.message);

    }
}

async function loadAdmin() {

    if (!me) {
        return;
    }

    try {

        const stats =
            await api("/api/admin/stats");

        document.getElementById(
            "stats"
        ).innerHTML = \`
<p>👥 Benutzer: <strong>\${stats.stats.users}</strong></p>
<p>🖥️ Server: <strong>\${stats.stats.servers}</strong></p>
<p>🟢 Online: <strong>\${stats.stats.runningServers}</strong></p>
<p>📦 Offen: <strong>\${stats.stats.pendingOrders}</strong></p>
<p>✅ Angenommen: <strong>\${stats.stats.acceptedOrders}</strong></p>
<p>❌ Abgelehnt: <strong>\${stats.stats.rejectedOrders}</strong></p>
\`;

        const ordersData =
            await api("/api/admin/orders");

        document.getElementById(
            "adminOrders"
        ).innerHTML =
            ordersData.orders.length
                ? ordersData.orders
                    .map(adminOrderCard)
                    .join("")
                : '<div class="card">Keine Bestellungen.</div>';

        const serverData =
            await api("/api/admin/servers");

        document.getElementById(
            "adminServers"
        ).innerHTML =
            serverData.servers.length
                ? serverData.servers
                    .map(adminServerCard)
                    .join("")
                : '<div class="card">Keine Server.</div>';

        const usersData =
            await api("/api/admin/users");

        document.getElementById(
            "adminUsers"
        ).innerHTML =
            usersData.users.length
                ? usersData.users
                    .map(adminUserCard)
                    .join("")
                : '<div class="card">Keine Benutzer.</div>';

    } catch (error) {

        message(error.message);

    }
}

function adminOrderCard(order) {

    const buttons =
        order.status === "pending"
            ? \`
<button
    class="green"
    onclick="acceptOrder('\${order.id}')">
    Annehmen
</button>

<button
    class="danger"
    onclick="rejectOrder('\${order.id}')">
    Ablehnen
</button>
\`
            : "";

    return \`
<div class="card">

<h3>
📦 \${escapeHTML(order.serverName)}
</h3>

<p>
Benutzer:
<strong>
\${escapeHTML(order.username)}
</strong>
</p>

<p>
Version:
\${escapeHTML(order.version)}
</p>

<p>
Typ:
\${escapeHTML(order.type)}
</p>

<p>
Status:
<span class="status \${order.status}">
\${escapeHTML(order.status)}
</span>
</p>

<div class="server-actions">
\${buttons}
</div>

</div>
\`;

}

async function acceptOrder(id) {

    try {

        const data =
            await api(
                "/api/admin/orders/" +
                encodeURIComponent(id) +
                "/accept",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function rejectOrder(id) {

    const reason =
        prompt(
            "Warum wird die Bestellung abgelehnt?"
        );

    if (reason === null) {
        return;
    }

    try {

        const data =
            await api(
                "/api/admin/orders/" +
                encodeURIComponent(id) +
                "/reject",
                {
                    method: "POST",
                    body: JSON.stringify({
                        reason
                    })
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

function adminServerCard(server) {

    const ownerControls =
        me &&
        me.role === "owner"
            ? \`
<button
    class="gray"
    onclick="toggleMaintenance(
        '\${server.id}',
        \${!server.maintenance}
    )">
    \${server.maintenance
        ? "Wartung aus"
        : "Wartung an"}
</button>

<button
    class="gray"
    onclick="toggleLock(
        '\${server.id}',
        \${!server.locked}
    )">
    \${server.locked
        ? "Entsperren"
        : "Sperren"}
</button>

<button
    class="danger"
    onclick="deleteServer(
        '\${server.id}'
    )">
    Löschen
</button>
\`
            : "";

    return \`
<div class="card">

<h3>
🖥️ \${escapeHTML(server.name)}
</h3>

<p>
Owner:
\${escapeHTML(server.ownerUsername)}
</p>

<p>
Status:
<span class="status \${server.status}">
\${escapeHTML(server.status)}
</span>
</p>

<p>
Typ:
\${escapeHTML(server.type)}
</p>

<p>
Version:
\${escapeHTML(server.version)}
</p>

<p>
\${server.locked
    ? "🔒 Gesperrt"
    : "🔓 Frei"}
</p>

<p>
\${server.maintenance
    ? "🛠️ Wartung aktiv"
    : "✅ Keine Wartung"}
</p>

<div class="server-actions">

<button
    class="danger"
    onclick="adminStopServer(
        '\${server.id}'
    )">
    Herunterfahren
</button>

\${ownerControls}

</div>

</div>
\`;

}

async function adminStopServer(id) {

    try {

        const data =
            await api(
                "/api/servers/" +
                encodeURIComponent(id) +
                "/stop",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function toggleMaintenance(id, enabled) {

    try {

        const data =
            await api(
                "/api/owner/servers/" +
                encodeURIComponent(id) +
                "/maintenance",
                {
                    method: "POST",
                    body: JSON.stringify({
                        enabled
                    })
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function toggleLock(id, enabled) {

    try {

        const endpoint =
            enabled
                ? "/api/owner/servers/" +
                  encodeURIComponent(id) +
                  "/lock"
                : "/api/owner/servers/" +
                  encodeURIComponent(id) +
                  "/unlock";

        const data =
            await api(
                endpoint,
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

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

    try {

        const data =
            await api(
                "/api/owner/servers/" +
                encodeURIComponent(id),
                {
                    method: "DELETE"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

function adminUserCard(user) {

    const owner =
        me &&
        me.role === "owner";

    const controls =
        owner && user.role !== "owner"
            ? \`
<button
    onclick="setAdmin(
        '\${user.id}'
    )">
    Admin geben
</button>

<button
    class="gray"
    onclick="removeAdmin(
        '\${user.id}'
    )">
    Admin entfernen
</button>

<button
    class="danger"
    onclick="banUser(
        '\${user.id}'
    )">
    Sperren
</button>

<button
    class="green"
    onclick="unbanUser(
        '\${user.id}'
    )">
    Entsperren
</button>

<button
    class="gray"
    onclick="resetUserPassword(
        '\${user.id}'
    )">
    Passwort reset
</button>
\`
            : "";

    return \`
<div class="card">

<h3>
👤 \${escapeHTML(user.username)}
</h3>

<p>
E-Mail:
\${escapeHTML(user.email)}
</p>

<p>
Rolle:
<span class="badge">
\${escapeHTML(user.role)}
</span>
</p>

<p>
Status:
\${user.banned
    ? "🚫 Gesperrt"
    : "✅ Aktiv"}
</p>

<div class="server-actions">
\${controls}
</div>

</div>
\`;

}

async function setAdmin(id) {

    try {

        const data =
            await api(
                "/api/owner/users/" +
                encodeURIComponent(id) +
                "/admin",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function removeAdmin(id) {

    try {

        const data =
            await api(
                "/api/owner/users/" +
                encodeURIComponent(id) +
                "/admin",
                {
                    method: "DELETE"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function banUser(id) {

    try {

        const data =
            await api(
                "/api/owner/users/" +
                encodeURIComponent(id) +
                "/ban",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function unbanUser(id) {

    try {

        const data =
            await api(
                "/api/owner/users/" +
                encodeURIComponent(id) +
                "/unban",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function resetUserPassword(id) {

    const password =
        prompt(
            "Neues Passwort eingeben:"
        );

    if (!password) {
        return;
    }

    try {

        const data =
            await api(
                "/api/admin/users/" +
                encodeURIComponent(id) +
                "/reset-password",
                {
                    method: "POST",
                    body: JSON.stringify({
                        newPassword: password
                    })
                }
            );

        message(data.message);

    } catch (error) {

        message(error.message);

    }
}

async function shutdownAll() {

    if (
        !confirm(
            "Wirklich ALLE Server herunterfahren?"
        )
    ) {
        return;
    }

    try {

        const data =
            await api(
                "/api/owner/shutdown-all",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

async function lockAll() {

    if (
        !confirm(
            "Wirklich ALLE Server sperren?"
        )
    ) {
        return;
    }

    try {

        const data =
            await api(
                "/api/owner/lock-all",
                {
                    method: "POST"
                }
            );

        message(data.message);

        loadAdmin();

    } catch (error) {

        message(error.message);

    }
}

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function checkLogin() {

    try {

        const data =
            await api("/api/me");

        if (data.loggedIn) {

            me = data.user;

        } else {

            me = null;

        }

        updateNav();

    } catch {

        me = null;

        updateNav();

    }
}

checkLogin();

</script>

</body>
</html>`;

// ----------------------------------------------------
// SERVER START
// ----------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("========================================");
    console.log("⛏️ Minecraft Hosting Webseite");
    console.log("========================================");
    console.log("🌐 Port:", PORT);
    console.log("👑 Owner:", OWNER_EMAIL);
    console.log("📁 Daten:", DATA_DIR);
    console.log("========================================");
    console.log("✅ Webseite gestartet.");
    console.log("");

}); - Bestellung ablehnen
 - User sieht Bestellstatus
 - E-Mail Benachrichtigung optional
 - Bewerbungen Moderator / Developer
 - Admin Panel
 - Benutzer sperren / entsperren
 - Server sperren / entsperren
 - Server herunterfahren
 - Server löschen
 - Owner kann alles verwalten
 - JSON-Datenspeicherung
 - Keine doppelten "express"-Deklarationen
 - Kein alter Code notwendig
===========================================================
*/

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

/* =========================================================
   KONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const DISCORD_CLIENT_ID =
    String(process.env.DISCORD_CLIENT_ID || '').trim();

const DISCORD_CLIENT_SECRET =
    String(process.env.DISCORD_CLIENT_SECRET || '').trim();

const DISCORD_REDIRECT_URI =
    String(
        process.env.DISCORD_REDIRECT_URI ||
        `http://localhost:${PORT}/auth/discord/callback`
    ).trim();

const OWNER_DISCORD_ID =
    String(process.env.OWNER_DISCORD_ID || '').trim();

const SESSION_SECRET =
    String(
        process.env.SESSION_SECRET ||
        'BITTE_IN_RENDER_AENDERN_123456789'
    );

const BASE_URL =
    String(
        process.env.BASE_URL ||
        `http://localhost:${PORT}`
    ).replace(/\/$/, '');

const GMAIL_USER =
    String(process.env.GMAIL_USER || '').trim();

const GMAIL_APP_PASSWORD =
    String(
        process.env.GMAIL_APP_PASSWORD || ''
    ).replace(/\s/g, '');

/* =========================================================
   DATENORDNER
========================================================= */

const DATA_DIR =
    path.join(__dirname, 'data');

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

const USERS_FILE =
    path.join(DATA_DIR, 'users.json');

const ORDERS_FILE =
    path.join(DATA_DIR, 'orders.json');

const SERVERS_FILE =
    path.join(DATA_DIR, 'servers.json');

const APPLICATIONS_FILE =
    path.join(DATA_DIR, 'applications.json');

const SESSIONS_FILE =
    path.join(DATA_DIR, 'sessions.json');

function ensureFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            '[]',
            'utf8'
        );
    }
}

[
    USERS_FILE,
    ORDERS_FILE,
    SERVERS_FILE,
    APPLICATIONS_FILE,
    SESSIONS_FILE
].forEach(ensureFile);

/* =========================================================
   JSON
========================================================= */

function readJSON(file) {
    try {
        const content =
            fs.readFileSync(
                file,
                'utf8'
            );

        if (!content.trim()) {
            return [];
        }

        return JSON.parse(content);
    } catch (error) {
        console.error(
            `❌ JSON Fehler bei ${file}:`,
            error.message
        );

        return [];
    }
}

function writeJSON(file, data) {

    const temporary =
        `${file}.tmp`;

    fs.writeFileSync(
        temporary,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    );

    fs.renameSync(
        temporary,
        file
    );
}

/* =========================================================
   HELFER
========================================================= */

function createId(prefix) {
    return (
        `${prefix}_` +
        Date.now().toString(36) +
        '_' +
        crypto
            .randomBytes(6)
            .toString('hex')
    );
}

function randomToken() {
    return crypto
        .randomBytes(32)
        .toString('hex');
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/* =========================================================
   DISCORD
========================================================= */

const DISCORD_API =
    'https://discord.com/api/v10';

function discordConfigured() {
    return (
        DISCORD_CLIENT_ID &&
        DISCORD_CLIENT_SECRET &&
        DISCORD_REDIRECT_URI
    );
}

function discordLoginURL(state) {

    const params =
        new URLSearchParams({
            client_id:
                DISCORD_CLIENT_ID,

            redirect_uri:
                DISCORD_REDIRECT_URI,

            response_type:
                'code',

            scope:
                'identify email',

            state
        });

    return (
        `https://discord.com/oauth2/authorize?` +
        params.toString()
    );
}

async function discordToken(code) {

    const body =
        new URLSearchParams({
            client_id:
                DISCORD_CLIENT_ID,

            client_secret:
                DISCORD_CLIENT_SECRET,

            grant_type:
                'authorization_code',

            code,

            redirect_uri:
                DISCORD_REDIRECT_URI
        });

    const response =
        await fetch(
            `${DISCORD_API}/oauth2/token`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },

                body
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    } catch {
        throw new Error(
            `Discord Token Antwort ungültig: ${text}`
        );
    }

    if (!response.ok) {

        throw new Error(
            `Discord Token Fehler ${response.status}: ` +
            JSON.stringify(data)
        );
    }

    return data;
}

async function discordUser(accessToken) {

    const response =
        await fetch(
            `${DISCORD_API}/users/@me`,
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    } catch {
        throw new Error(
            `Discord User Antwort ungültig: ${text}`
        );
    }

    if (!response.ok) {

        throw new Error(
            `Discord User Fehler ${response.status}: ` +
            JSON.stringify(data)
        );
    }

    return data;
}

/* =========================================================
   SESSION-SYSTEM
========================================================= */

const SESSION_TIME =
    1000 * 60 * 60 * 24 * 30;

function getSessions() {
    return readJSON(
        SESSIONS_FILE
    );
}

function createSession(userId) {

    const sessions =
        getSessions();

    const sessionId =
        randomToken();

    sessions.push({
        id: sessionId,
        userId,
        createdAt:
            Date.now(),
        expiresAt:
            Date.now() + SESSION_TIME
    });

    writeJSON(
        SESSIONS_FILE,
        sessions
    );

    return sessionId;
}

function deleteSession(sessionId) {

    if (!sessionId) {
        return;
    }

    const sessions =
        getSessions();

    writeJSON(
        SESSIONS_FILE,
        sessions.filter(
            session =>
                session.id !== sessionId
        )
    );
}

function cleanupSessions() {

    const now =
        Date.now();

    const sessions =
        getSessions();

    const valid =
        sessions.filter(
            session =>
                Number(
                    session.expiresAt
                ) > now
        );

    if (valid.length !== sessions.length) {
        writeJSON(
            SESSIONS_FILE,
            valid
        );
    }
}

setInterval(
    cleanupSessions,
    1000 * 60 * 60
);

/* =========================================================
   USER
========================================================= */

function getUsers() {
    return readJSON(
        USERS_FILE
    );
}

function findUserByDiscordId(
    discordId
) {

    return getUsers().find(
        user =>
            String(
                user.discordId
            ) === String(discordId)
    ) || null;
}

function isOwner(user) {

    return !!user &&
        String(user.discordId) ===
        String(OWNER_DISCORD_ID);
}

function isAdmin(user) {

    return !!user &&
        (
            isOwner(user) ||
            user.role === 'admin'
        );
}

function getCurrentUser(req) {

    const sessionId =
        req.cookies
        ? req.cookies.hosting_session
        : null;

    if (!sessionId) {
        return null;
    }

    const sessions =
        getSessions();

    const currentSession =
        sessions.find(
            session =>
                session.id ===
                    sessionId &&
                Number(
                    session.expiresAt
                ) > Date.now()
        );

    if (!currentSession) {
        return null;
    }

    return getUsers().find(
        user =>
            user.id ===
            currentSession.userId
    ) || null;
}

/* =========================================================
   COOKIE
========================================================= */

function parseCookies(req) {

    const header =
        req.headers.cookie || '';

    const result = {};

    header
        .split(';')
        .forEach(part => {

            const index =
                part.indexOf('=');

            if (index === -1) {
                return;
            }

            const key =
                part
                    .slice(0, index)
                    .trim();

            const value =
                part
                    .slice(index + 1)
                    .trim();

            result[key] =
                decodeURIComponent(value);
        });

    return result;
}

function setSessionCookie(
    res,
    sessionId
) {

    const secure =
        process.env.NODE_ENV ===
        'production';

    let cookie =
        `hosting_session=${encodeURIComponent(sessionId)}`;

    cookie +=
        '; Path=/';

    cookie +=
        '; HttpOnly';

    cookie +=
        '; SameSite=Lax';

    cookie +=
        `; Max-Age=${60 * 60 * 24 * 30}`;

    if (secure) {
        cookie +=
            '; Secure';
    }

    res.setHeader(
        'Set-Cookie',
        cookie
    );
}

function clearSessionCookie(res) {

    res.setHeader(
        'Set-Cookie',
        'hosting_session=;' +
        ' Path=/;' +
        ' HttpOnly;' +
        ' SameSite=Lax;' +
        ' Max-Age=0'
    );
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.urlencoded({
        extended: true,
        limit: '2mb'
    })
);

app.use(
    express.json({
        limit: '2mb'
    })
);

app.use(
    (req, res, next) => {

        req.cookies =
            parseCookies(req);

        next();
    }
);

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(
    req,
    res,
    next
) {

    const user =
        getCurrentUser(req);

    if (!user) {
        return res.redirect(
            '/login'
        );
    }

    if (user.banned) {

        const sessionId =
            req.cookies
                .hosting_session;

        deleteSession(
            sessionId
        );

        clearSessionCookie(
            res
        );

        return res.status(403).send(
            layout(
                'Gesperrt',
                `
                <div class="error">
                    🚫 Dein Discord-Konto wurde
                    für diese Webseite gesperrt.
                </div>
                `
            )
        );
    }

    req.user =
        user;

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
            '/login'
        );
    }

    if (!isAdmin(user)) {

        return res.status(403).send(
            layout(
                'Kein Zugriff',
                `
                <div class="error">
                    🚫 Du hast keinen Zugriff
                    auf diesen Bereich.
                </div>
                `,
                user
            )
        );
    }

    req.user =
        user;

    next();
}

/* =========================================================
   SESSION EXPRESS
========================================================= */

/*
  Express-Session wird absichtlich NICHT
  für den Login benutzt.

  Stattdessen liegt die Session-ID in einem
  HttpOnly-Cookie und die Session wird in
  data/sessions.json gespeichert.

  Dadurch bleibt der Login auch nach einem
  normalen Node-Neustart erhalten.
*/

/* =========================================================
   MAIL
========================================================= */

let transporter = null;

if (
    GMAIL_USER &&
    GMAIL_APP_PASSWORD
) {

    transporter =
        nodemailer.createTransport({
            service: 'gmail',

            auth: {
                user:
                    GMAIL_USER,

                pass:
                    GMAIL_APP_PASSWORD
            },

            logger: true,
            debug: true
        });

} else {

    console.log(
        'ℹ️ Gmail ist nicht konfiguriert.'
    );
}

async function sendMail(
    to,
    subject,
    html
) {

    if (!transporter) {

        console.log(
            '📧 E-Mail übersprungen:',
            to,
            subject
        );

        return false;
    }

    console.log(
        '📧 E-Mail wird gesendet...'
    );

    console.log(
        'An:',
        to
    );

    console.log(
        'Betreff:',
        subject
    );

    try {

        const result =
            await transporter.sendMail({
                from:
                    `"Minecraft Hosting" <${GMAIL_USER}>`,

                to,

                subject,

                html
            });

        console.log(
            '✅ E-Mail erfolgreich:',
            result.messageId
        );

        console.log(
            'SMTP:',
            result.response
        );

        return true;

    } catch (error) {

        console.error(
            '================================'
        );

        console.error(
            '❌ GMAIL VERSAND FEHLER'
        );

        console.error(
            'Name:',
            error.name
        );

        console.error(
            'Message:',
            error.message
        );

        console.error(
            'Code:',
            error.code
        );

        console.error(
            'Response Code:',
            error.responseCode
        );

        console.error(
            'Response:',
            error.response
        );

        console.error(
            'Command:',
            error.command
        );

        console.error(
            '================================'
        );

        return false;
    }
}

/* =========================================================
   HTML LAYOUT
========================================================= */

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
    content="width=device-width,initial-scale=1"
/>

<title>
    ${escapeHTML(title)}
    - Florian / Weisserhai
</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #080c12;
    color: #f4f7fb;
    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

nav {
    min-height: 65px;
    background: #111923;
    border-bottom:
        1px solid #293646;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding:
        12px 25px;

    gap: 15px;
    flex-wrap: wrap;
}

.logo {
    font-size: 20px;
    font-weight: 800;
}

.navlinks {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.navlinks a {
    text-decoration: none;
    color: white;

    background: #1c2733;

    padding:
        9px 12px;

    border-radius: 8px;
}

.navlinks a:hover {
    background: #2b3948;
}

main {
    width:
        min(1150px, 94%);

    margin:
        35px auto;
}

.hero {
    background:
        linear-gradient(
            135deg,
            #111b27,
            #10151d
        );

    border:
        1px solid #2c3b4b;

    border-radius:
        18px;

    padding:
        45px;

    margin-bottom:
        20px;
}

.hero h1 {
    margin-top: 0;
    font-size: 42px;
}

.card {
    background: #111923;

    border:
        1px solid #293746;

    border-radius:
        14px;

    padding:
        20px;

    margin-bottom:
        16px;
}

.grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                240px,
                1fr
            )
        );

    gap: 18px;
}

button,
.btn {
    border: 0;

    display: inline-block;

    padding:
        11px 15px;

    border-radius:
        8px;

    background:
        #5865f2;

    color: white;

    text-decoration: none;

    cursor: pointer;

    font-weight: 700;
}

button:hover,
.btn:hover {
    filter:
        brightness(1.15);
}

.discord {
    background:
        #5865f2;

    font-size:
        17px;

    padding:
        14px 20px;
}

.green {
    background:
        #23874f;
}

.red {
    background:
        #bd3c42;
}

.gray {
    background:
        #3b4652;
}

.warning {
    background:
        #493a18;

    border:
        1px solid #79642c;

    padding:
        14px;

    border-radius:
        9px;

    margin-bottom:
        15px;
}

.error {
    background:
        #421d24;

    border:
        1px solid #7c3540;

    padding:
        14px;

    border-radius:
        9px;

    margin-bottom:
        15px;
}

.success {
    background:
        #173d2a;

    border:
        1px solid #2e7950;

    padding:
        14px;

    border-radius:
        9px;

    margin-bottom:
        15px;
}

.status {
    display:
        inline-block;

    padding:
        5px 10px;

    border-radius:
        999px;

    background:
        #3b4652;
}

.status.waiting {
    background:
        #715e22;
}

.status.accepted {
    background:
        #247d4e;
}

.status.rejected {
    background:
        #79353d;
}

.status.online {
    background:
        #247d4e;
}

.status.offline {
    background:
        #68343a;
}

input,
select,
textarea {
    width: 100%;

    background:
        #080d13;

    color: white;

    border:
        1px solid #354454;

    border-radius:
        8px;

    padding:
        12px;

    margin-top:
        7px;

    margin-bottom:
        15px;
}

textarea {
    min-height:
        140px;

    resize:
        vertical;
}

table {
    width: 100%;
    border-collapse:
        collapse;
}

th,
td {
    text-align:
        left;

    padding:
        10px;

    border-bottom:
        1px solid #2c3845;
}

.small {
    color:
        #8f9ba8;

    font-size:
        13px;
}

footer {
    text-align:
        center;

    color:
        #6f7c88;

    padding:
        40px;
}

form.inline {
    display:
        inline;
}

</style>

</head>

<body>

<nav>

<div class="logo">
    ⛏️ Florian / Weisserhai
</div>

<div class="navlinks">

<a href="/">
    Home
</a>

${
    user
    ? `
        <a href="/dashboard">
            Dashboard
        </a>

        <a href="/orders">
            Server bestellen
        </a>

        <a href="/servers">
            Meine Server
        </a>

        <a href="/applications">
            Bewerbung
        </a>

        ${
            isAdmin(user)
            ? `
            <a href="/admin">
                👑 Admin
            </a>
            `
            : ''
        }

        <a href="/logout">
            Logout
        </a>
    `
    : `
        <a href="/login">
            Discord Login
        </a>
    `
}

</div>

</nav>

<main>

${content}

</main>

<footer>
    Minecraft Hosting
</footer>

</body>

</html>
`;
}

/* =========================================================
   HOME
========================================================= */

app.get(
    '/',
    (req, res) => {

        const user =
            getCurrentUser(req);

        res.send(
            layout(
                'Home',
                `
                <section class="hero">

                    <h1>
                        ⛏️ Minecraft Hosting
                    </h1>

                    <p>
                        Erstelle kostenlos eine
                        Server-Bestellung.
                    </p>

                    <p>
                        Jede Bestellung wird von
                        einem Admin oder Owner geprüft.
                    </p>

                    ${
                        user
                        ? `
                        <a
                            class="btn"
                            href="/dashboard"
                        >
                            Zum Dashboard
                        </a>
                        `
                        : `
                        <a
                            class="btn discord"
                            href="/login"
                        >
                            🎮 Mit Discord anmelden
                        </a>
                        `
                    }

                </section>

                <div class="grid">

                    <div class="card">
                        <h2>
                            🆓 Kostenlos
                        </h2>

                        <p>
                            Minecraft-Server können
                            kostenlos beantragt werden.
                        </p>
                    </div>

                    <div class="card">
                        <h2>
                            👑 Freigabe
                        </h2>

                        <p>
                            Ein Admin oder Owner muss
                            die Bestellung freigeben.
                        </p>
                    </div>

                    <div class="card">
                        <h2>
                            🎮 Discord
                        </h2>

                        <p>
                            Anmeldung erfolgt
                            ausschließlich über Discord.
                        </p>
                    </div>

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   LOGIN
========================================================= */

app.get(
    '/login',
    (req, res) => {

        const user =
            getCurrentUser(req);

        if (user) {
            return res.redirect(
                '/dashboard'
            );
        }

        if (!discordConfigured()) {

            return res.status(500).send(
                layout(
                    'Discord nicht eingerichtet',
                    `
                    <div class="error">

                        <h2>
                            ❌ Discord OAuth2 nicht eingerichtet
                        </h2>

                        <p>
                            DISCORD_CLIENT_ID,
                            DISCORD_CLIENT_SECRET
                            oder
                            DISCORD_REDIRECT_URI
                            fehlt.
                        </p>

                    </div>
                    `
                )
            );
        }

        const state =
            randomToken();

        /*
         * State wird nur kurzzeitig in der Session-Datei
         * gespeichert.
         */

        const stateFile =
            path.join(
                DATA_DIR,
                'oauth_states.json'
            );

        const states =
            fs.existsSync(stateFile)
            ? readJSON(stateFile)
            : [];

        states.push({
            state,
            createdAt:
                Date.now()
        });

        writeJSON(
            stateFile,
            states
        );

        res.redirect(
            discordLoginURL(state)
        );
    }
);

/* =========================================================
   DISCORD CALLBACK
========================================================= */

app.get(
    '/auth/discord/callback',
    async (req, res) => {

        try {

            const {
                code,
                state,
                error
            } = req.query;

            if (error) {

                return res.status(400).send(
                    layout(
                        'Discord Login',
                        `
                        <div class="error">
                            ❌ Discord hat die Anmeldung abgebrochen.
                        </div>

                        <a
                            class="btn"
                            href="/login"
                        >
                            Erneut versuchen
                        </a>
                        `
                    )
                );
            }

            if (!code || !state) {

                return res.status(400).send(
                    layout(
                        'Discord Login',
                        `
                        <div class="error">
                            ❌ Ungültige Discord-Anmeldung.
                        </div>
                        `
                    )
                );
            }

            const stateFile =
                path.join(
                    DATA_DIR,
                    'oauth_states.json'
                );

            const states =
                fs.existsSync(stateFile)
                ? readJSON(stateFile)
                : [];

            const stateIndex =
                states.findIndex(
                    item =>
                        item.state ===
                        state
                );

            if (stateIndex === -1) {

                return res.status(400).send(
                    layout(
                        'Discord Login',
                        `
                        <div class="error">
                            ❌ OAuth2-State ist ungültig
                            oder abgelaufen.
                        </div>
                        `
                    )
                );
            }

            const stateEntry =
                states[stateIndex];

            states.splice(
                stateIndex,
                1
            );

            writeJSON(
                stateFile,
                states
            );

            if (
                Date.now() -
                Number(
                    stateEntry.createdAt
                ) >
                10 * 60 * 1000
            ) {

                return res.status(400).send(
                    layout(
                        'Discord Login',
                        `
                        <div class="error">
                            ❌ Discord Login ist abgelaufen.
                        </div>
                        `
                    )
                );
            }

            const tokens =
                await discordToken(
                    code
                );

            const discord =
                await discordUser(
                    tokens.access_token
                );

            if (!discord.id) {

                throw new Error(
                    'Discord hat keine Benutzer-ID zurückgegeben.'
                );
            }

            const users =
                getUsers();

            let user =
                users.find(
                    item =>
                        String(
                            item.discordId
                        ) ===
                        String(
                            discord.id
                        )
                );

            if (!user) {

                user = {

                    id:
                        createId(
                            'user'
                        ),

                    discordId:
                        String(
                            discord.id
                        ),

                    username:
                        discord.username ||
                        'Discord User',

                    globalName:
                        discord.global_name ||
                        discord.username ||
                        'Discord User',

                    email:
                        discord.email ||
                        null,

                    avatar:
                        discord.avatar ||
                        null,

                    role:
                        String(
                            discord.id
                        ) ===
                        String(
                            OWNER_DISCORD_ID
                        )
                        ? 'owner'
                        : 'user',

                    banned:
                        false,

                    coins:
                        0,

                    createdAt:
                        new Date().toISOString(),

                    lastLoginAt:
                        new Date().toISOString()
                };

                users.push(
                    user
                );

            } else {

                user.username =
                    discord.username ||
                    user.username;

                user.globalName =
                    discord.global_name ||
                    user.globalName;

                user.email =
                    discord.email ||
                    user.email;

                user.avatar =
                    discord.avatar ||
                    user.avatar;

                user.lastLoginAt =
                    new Date().toISOString();

                if (
                    String(
                        discord.id
                    ) ===
                    String(
                        OWNER_DISCORD_ID
                    )
                ) {
                    user.role =
                        'owner';
                }
            }

            writeJSON(
                USERS_FILE,
                users
            );

            if (user.banned) {

                return res.status(403).send(
                    layout(
                        'Gesperrt',
                        `
                        <div class="error">
                            🚫 Dein Konto wurde gesperrt.
                        </div>
                        `
                    )
                );
            }

            const sessionId =
                createSession(
                    user.id
                );

            setSessionCookie(
                res,
                sessionId
            );

            res.redirect(
                '/dashboard'
            );

        } catch (error) {

            console.error(
                '❌ DISCORD OAUTH2 FEHLER'
            );

            console.error(
                error
            );

            res.status(500).send(
                layout(
                    'Discord Fehler',
                    `
                    <div class="error">

                        <h2>
                            ❌ Discord-Anmeldung fehlgeschlagen
                        </h2>

                        <p>
                            ${escapeHTML(
                                error.message
                            )}
                        </p>

                    </div>

                    <a
                        class="btn"
                        href="/login"
                    >
                        Erneut versuchen
                    </a>
                    `
                )
            );
        }
    }
);

/* =========================================================
   LOGOUT
========================================================= */

app.get(
    '/logout',
    (req, res) => {

        const sessionId =
            req.cookies
                .hosting_session;

        deleteSession(
            sessionId
        );

        clearSessionCookie(
            res
        );

        res.redirect(
            '/'
        );
    }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    '/dashboard',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        const orders =
            readJSON(
                ORDERS_FILE
            ).filter(
                order =>
                    order.userId ===
                    user.id
            );

        const servers =
            readJSON(
                SERVERS_FILE
            ).filter(
                server =>
                    server.ownerId ===
                    user.id
            );

        res.send(
            layout(
                'Dashboard',
                `
                <section class="hero">

                    <h1>
                        👋 Willkommen
                        ${escapeHTML(
                            user.globalName ||
                            user.username
                        )}
                    </h1>

                    <p>
                        🎮 Discord:
                        ${escapeHTML(
                            user.username
                        )}
                    </p>

                    <p>
                        Rolle:
                        ${escapeHTML(
                            user.role
                        )}
                    </p>

                </section>

                <div class="grid">

                    <div class="card">

                        <h2>
                            🆓 Server bestellen
                        </h2>

                        <p>
                            Kostenlosen
                            Minecraft-Server beantragen.
                        </p>

                        <a
                            class="btn"
                            href="/orders"
                        >
                            Bestellung
                        </a>

                    </div>

                    <div class="card">

                        <h2>
                            📋 Bestellungen
                        </h2>

                        <h1>
                            ${orders.length}
                        </h1>

                    </div>

                    <div class="card">

                        <h2>
                            🖥️ Server
                        </h2>

                        <h1>
                            ${servers.length}
                        </h1>

                    </div>

                    <div class="card">

                        <h2>
                            🪙 Coins
                        </h2>

                        <h1>
                            ${Number(
                                user.coins || 0
                            )}
                        </h1>

                    </div>

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   SERVER BESTELLEN
========================================================= */

app.get(
    '/orders',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        const orders =
            readJSON(
                ORDERS_FILE
            ).filter(
                order =>
                    order.userId ===
                    user.id
            );

        res.send(
            layout(
                'Server bestellen',
                `
                <div class="card">

                    <h1>
                        🆓 Minecraft-Server bestellen
                    </h1>

                    <div class="success">
                        Die Bestellung ist kostenlos.
                        Ein Admin oder Owner muss
                        sie zuerst annehmen.
                    </div>

                    <form
                        method="POST"
                        action="/orders"
                    >

                        <label>
                            Servername
                        </label>

                        <input
                            name="serverName"
                            maxlength="40"
                            required
                        />

                        <label>
                            Minecraft-Version
                        </label>

                        <select
                            name="version"
                        >

                            <option>
                                1.21.8
                            </option>

                            <option>
                                1.21.7
                            </option>

                            <option>
                                1.21.6
                            </option>

                            <option>
                                1.20.6
                            </option>

                        </select>

                        <label>
                            Beschreibung
                        </label>

                        <textarea
                            name="reason"
                            maxlength="3000"
                            placeholder="Was möchtest du mit dem Server machen?"
                        ></textarea>

                        <button>
                            🆓 Bestellung absenden
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        📋 Meine Bestellungen
                    </h2>

                    ${
                        orders.length
                        ? orders
                            .slice()
                            .reverse()
                            .map(
                                order => `
                                <div class="card">

                                    <h3>
                                        ⛏️
                                        ${escapeHTML(
                                            order.serverName
                                        )}
                                    </h3>

                                    <p>
                                        Version:
                                        ${escapeHTML(
                                            order.version
                                        )}
                                    </p>

                                    <p>
                                        Status:
                                        <span
                                            class="
                                            status
                                            ${
                                                order.status ===
                                                'wartend'
                                                ? 'waiting'
                                                : order.status ===
                                                  'angenommen'
                                                ? 'accepted'
                                                : 'rejected'
                                            }
                                            "
                                        >
                                            ${escapeHTML(
                                                order.status
                                            )}
                                        </span>
                                    </p>

                                    ${
                                        order.status ===
                                        'abgelehnt'
                                        ? `
                                        <div class="error">
                                            ❌ Bestellung abgelehnt.
                                            Es wurden keine Coins
                                            abgezogen.
                                        </div>
                                        `
                                        : ''
                                    }

                                    ${
                                        order.status ===
                                        'angenommen'
                                        ? `
                                        <div class="success">
                                            ✅ Bestellung angenommen.
                                        </div>
                                        `
                                        : ''
                                    }

                                </div>
                                `
                            )
                            .join('')
                        : `
                            <p>
                                Noch keine Bestellung.
                            </p>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    '/orders',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        let serverName =
            String(
                req.body.serverName ||
                ''
            )
            .trim()
            .replace(
                /[^\wäöüÄÖÜß ._-]/g,
                ''
            )
            .slice(
                0,
                40
            );

        const version =
            String(
                req.body.version ||
                '1.21.8'
            );

        const reason =
            String(
                req.body.reason ||
                ''
            ).slice(
                0,
                3000
            );

        if (!serverName) {

            return res.status(400).send(
                layout(
                    'Fehler',
                    `
                    <div class="error">
                        ❌ Servername fehlt.
                    </div>
                    `,
                    user
                )
            );
        }

        const orders =
            readJSON(
                ORDERS_FILE
            );

        orders.push({

            id:
                createId(
                    'order'
                ),

            userId:
                user.id,

            discordId:
                user.discordId,

            userName:
                user.globalName ||
                user.username,

            userEmail:
                user.email,

            serverName,

            version,

            reason,

            status:
                'wartend',

            serverId:
                null,

            createdAt:
                new Date().toISOString(),

            processedAt:
                null,

            processedBy:
                null

        });

        writeJSON(
            ORDERS_FILE,
            orders
        );

        res.redirect(
            '/orders'
        );
    }
);

/* =========================================================
   SERVER
========================================================= */

app.get(
    '/servers',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        const servers =
            readJSON(
                SERVERS_FILE
            ).filter(
                server =>
                    server.ownerId ===
                    user.id
            );

        res.send(
            layout(
                'Meine Server',
                `
                <div class="card">

                    <h1>
                        🖥️ Meine Minecraft-Server
                    </h1>

                    ${
                        servers.length
                        ? servers.map(
                            server => `
                            <div class="card">

                                <h2>
                                    ⛏️
                                    ${escapeHTML(
                                        server.name
                                    )}
                                </h2>

                                <p>
                                    Version:
                                    ${escapeHTML(
                                        server.version
                                    )}
                                </p>

                                <p>
                                    Status:

                                    <span
                                        class="
                                        status
                                        ${
                                            server.status ===
                                            'online'
                                            ? 'online'
                                            : 'offline'
                                        }
                                        "
                                    >
                                        ${escapeHTML(
                                            server.status
                                        )}
                                    </span>
                                </p>

                                ${
                                    server.locked
                                    ? `
                                    <div class="error">
                                        🔒 Der Server wurde
                                        vom Admin gesperrt.
                                    </div>
                                    `
                                    : ''
                                }

                                <a
                                    class="btn"
                                    href="/servers/${escapeHTML(
                                        server.id
                                    )}"
                                >
                                    Verwalten
                                </a>

                            </div>
                            `
                        ).join('')
                        : `
                        <p>
                            Du hast noch keinen Server.
                        </p>

                        <a
                            class="btn"
                            href="/orders"
                        >
                            Server bestellen
                        </a>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   SERVER DETAIL
========================================================= */

app.get(
    '/servers/:id',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        const server =
            readJSON(
                SERVERS_FILE
            ).find(
                item =>
                    item.id ===
                        req.params.id &&
                    item.ownerId ===
                        user.id
            );

        if (!server) {

            return res.status(404).send(
                layout(
                    'Server nicht gefunden',
                    `
                    <div class="error">
                        ❌ Server nicht gefunden.
                    </div>
                    `,
                    user
                )
            );
        }

        res.send(
            layout(
                server.name,
                `
                <div class="card">

                    <h1>
                        ⛏️
                        ${escapeHTML(
                            server.name
                        )}
                    </h1>

                    <p>
                        Version:
                        ${escapeHTML(
                            server.version
                        )}
                    </p>

                    <p>
                        Status:
                        ${escapeHTML(
                            server.status
                        )}
                    </p>

                    ${
                        server.locked
                        ? `
                        <div class="error">
                            🔒 Dieser Server ist gesperrt.
                        </div>
                        `
                        : `
                        <form
                            method="POST"
                            action="/servers/${escapeHTML(
                                server.id
                            )}/start"
                            class="inline"
                        >
                            <button
                                class="green"
                            >
                                ▶ Start
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/servers/${escapeHTML(
                                server.id
                            )}/stop"
                            class="inline"
                        >
                            <button
                                class="red"
                            >
                                ■ Stop
                            </button>
                        </form>

                        <form
                            method="POST"
                            action="/servers/${escapeHTML(
                                server.id
                            )}/restart"
                            class="inline"
                        >
                            <button>
                                🔄 Neustart
                            </button>
                        </form>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   SERVER START
========================================================= */

app.post(
    '/servers/:id/start',
    requireLogin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                        req.params.id &&
                    server.ownerId ===
                        req.user.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        if (
            servers[index].locked
        ) {
            return res.status(403).send(
                'Server ist gesperrt'
            );
        }

        servers[index].status =
            'online';

        servers[index].updatedAt =
            new Date().toISOString();

        writeJSON(
            SERVERS_FILE,
            servers
        );

        res.redirect(
            `/servers/${req.params.id}`
        );
    }
);

/* =========================================================
   SERVER STOP
========================================================= */

app.post(
    '/servers/:id/stop',
    requireLogin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                        req.params.id &&
                    server.ownerId ===
                        req.user.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].status =
            'offline';

        servers[index].updatedAt =
            new Date().toISOString();

        writeJSON(
            SERVERS_FILE,
            servers
        );

        res.redirect(
            `/servers/${req.params.id}`
        );
    }
);

/* =========================================================
   SERVER RESTART
========================================================= */

app.post(
    '/servers/:id/restart',
    requireLogin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                        req.params.id &&
                    server.ownerId ===
                        req.user.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        if (
            servers[index].locked
        ) {
            return res.status(403).send(
                'Server ist gesperrt'
            );
        }

        servers[index].status =
            'restarting';

        writeJSON(
            SERVERS_FILE,
            servers
        );

        setTimeout(
            () => {

                const updated =
                    readJSON(
                        SERVERS_FILE
                    );

                const server =
                    updated.find(
                        item =>
                            item.id ===
                            req.params.id
                    );

                if (
                    server &&
                    !server.locked
                ) {

                    server.status =
                        'online';

                    server.updatedAt =
                        new Date().toISOString();

                    writeJSON(
                        SERVERS_FILE,
                        updated
                    );
                }

            },
            1500
        );

        res.redirect(
            `/servers/${req.params.id}`
        );
    }
);

/* =========================================================
   BEWERBUNG
========================================================= */

app.get(
    '/applications',
    requireLogin,
    (req, res) => {

        const user =
            req.user;

        const applications =
            readJSON(
                APPLICATIONS_FILE
            ).filter(
                application =>
                    application.userId ===
                    user.id
            );

        res.send(
            layout(
                'Bewerbung',
                `
                <div class="card">

                    <h1>
                        📝 Team-Bewerbung
                    </h1>

                    <form
                        method="POST"
                        action="/applications"
                    >

                        <label>
                            Bewerbung für
                        </label>

                        <select name="type">

                            <option value="moderator">
                                Moderator
                            </option>

                            <option value="developer">
                                Developer
                            </option>

                        </select>

                        <label>
                            Bewerbung
                        </label>

                        <textarea
                            name="text"
                            maxlength="5000"
                            required
                            placeholder="Erzähle uns etwas über dich..."
                        ></textarea>

                        <button>
                            Bewerbung absenden
                        </button>

                    </form>

                </div>

                <div class="card">

                    <h2>
                        📋 Meine Bewerbungen
                    </h2>

                    ${
                        applications.length
                        ? applications.map(
                            application => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(
                                        application.type
                                    )}
                                </h3>

                                <p>
                                    Status:
                                    <span class="status">
                                        ${escapeHTML(
                                            application.status
                                        )}
                                    </span>
                                </p>

                                <p>
                                    ${escapeHTML(
                                        application.text
                                    )}
                                </p>

                            </div>
                            `
                        ).join('')
                        : `
                        <p>
                            Noch keine Bewerbung.
                        </p>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

app.post(
    '/applications',
    requireLogin,
    (req, res) => {

        const text =
            String(
                req.body.text ||
                ''
            ).slice(
                0,
                5000
            );

        const type =
            req.body.type ===
            'developer'
            ? 'developer'
            : 'moderator';

        if (!text.trim()) {
            return res.status(400).send(
                'Bewerbung darf nicht leer sein.'
            );
        }

        const applications =
            readJSON(
                APPLICATIONS_FILE
            );

        applications.push({

            id:
                createId(
                    'application'
                ),

            userId:
                req.user.id,

            discordId:
                req.user.discordId,

            userName:
                req.user.globalName ||
                req.user.username,

            userEmail:
                req.user.email,

            type,

            text,

            status:
                'offen',

            createdAt:
                new Date().toISOString(),

            processedBy:
                null,

            processedAt:
                null

        });

        writeJSON(
            APPLICATIONS_FILE,
            applications
        );

        res.redirect(
            '/applications'
        );
    }
);

/* =========================================================
   ADMIN PANEL
========================================================= */

app.get(
    '/admin',
    requireAdmin,
    (req, res) => {

        const user =
            req.user;

        const users =
            readJSON(
                USERS_FILE
            );

        const orders =
            readJSON(
                ORDERS_FILE
            );

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const applications =
            readJSON(
                APPLICATIONS_FILE
            );

        res.send(
            layout(
                'Admin Panel',
                `
                <section class="hero">

                    <h1>
                        👑 Admin Panel
                    </h1>

                    <p>
                        Angemeldet als:
                        ${escapeHTML(
                            user.globalName ||
                            user.username
                        )}
                    </p>

                    ${
                        isOwner(user)
                        ? `
                        <div class="success">
                            👑 Du bist der Owner.
                            Du hast vollständigen Zugriff.
                        </div>
                        `
                        : ''
                    }

                </section>

                <div class="grid">

                    <div class="card">
                        <h2>
                            👥 Benutzer
                        </h2>
                        <h1>
                            ${users.length}
                        </h1>
                    </div>

                    <div class="card">
                        <h2>
                            📋 Bestellungen
                        </h2>
                        <h1>
                            ${orders.length}
                        </h1>
                    </div>

                    <div class="card">
                        <h2>
                            🖥️ Server
                        </h2>
                        <h1>
                            ${servers.length}
                        </h1>
                    </div>

                    <div class="card">
                        <h2>
                            📝 Bewerbungen
                        </h2>
                        <h1>
                            ${applications.length}
                        </h1>
                    </div>

                </div>

                <div class="card">

                    <h2>
                        📋 Server-Bestellungen
                    </h2>

                    ${
                        orders.length
                        ? orders
                            .slice()
                            .reverse()
                            .map(
                                order => `
                                <div class="card">

                                    <h3>
                                        ⛏️
                                        ${escapeHTML(
                                            order.serverName
                                        )}
                                    </h3>

                                    <p>
                                        User:
                                        ${escapeHTML(
                                            order.userName
                                        )}
                                    </p>

                                    <p>
                                        Discord ID:
                                        ${escapeHTML(
                                            order.discordId
                                        )}
                                    </p>

                                    <p>
                                        Status:
                                        ${escapeHTML(
                                            order.status
                                        )}
                                    </p>

                                    <p>
                                        Version:
                                        ${escapeHTML(
                                            order.version
                                        )}
                                    </p>

                                    <p>
                                        ${escapeHTML(
                                            order.reason
                                        )}
                                    </p>

                                    ${
                                        order.status ===
                                        'wartend'
                                        ? `
                                        <form
                                            method="POST"
                                            action="/admin/orders/${escapeHTML(
                                                order.id
                                            )}/accept"
                                            class="inline"
                                        >
                                            <button
                                                class="green"
                                            >
                                                ✅ Annehmen
                                            </button>
                                        </form>

                                        <form
                                            method="POST"
                                            action="/admin/orders/${escapeHTML(
                                                order.id
                                            )}/reject"
                                            class="inline"
                                        >
                                            <button
                                                class="red"
                                            >
                                                ❌ Ablehnen
                                            </button>
                                        </form>
                                        `
                                        : ''
                                    }

                                </div>
                                `
                            )
                            .join('')
                        : `
                        <p>
                            Keine Bestellungen.
                        </p>
                        `
                    }

                </div>

                <div class="card">

                    <h2>
                        📝 Bewerbungen
                    </h2>

                    ${
                        applications.length
                        ? applications.map(
                            application => `
                            <div class="card">

                                <h3>
                                    ${escapeHTML(
                                        application.type
                                    )}
                                </h3>

                                <p>
                                    User:
                                    ${escapeHTML(
                                        application.userName
                                    )}
                                </p>

                                <p>
                                    ${escapeHTML(
                                        application.text
                                    )}
                                </p>

                                <p>
                                    Status:
                                    ${escapeHTML(
                                        application.status
                                    )}
                                </p>

                                ${
                                    application.status ===
                                    'offen'
                                    ? `
                                    <form
                                        method="POST"
                                        action="/admin/applications/${escapeHTML(
                                            application.id
                                        )}/accept"
                                        class="inline"
                                    >
                                        <button
                                            class="green"
                                        >
                                            ✅ Annehmen
                                        </button>
                                    </form>

                                    <form
                                        method="POST"
                                        action="/admin/applications/${escapeHTML(
                                            application.id
                                        )}/reject"
                                        class="inline"
                                    >
                                        <button
                                            class="red"
                                        >
                                            ❌ Ablehnen
                                        </button>
                                    </form>
                                    `
                                    : ''
                                }

                            </div>
                            `
                        ).join('')
                        : `
                        <p>
                            Keine Bewerbungen.
                        </p>
                        `
                    }

                </div>

                <div class="card">

                    <h2>
                        👥 Benutzerverwaltung
                    </h2>

                    <table>

                        <thead>

                            <tr>
                                <th>
                                    Benutzer
                                </th>

                                <th>
                                    Discord ID
                                </th>

                                <th>
                                    Rolle
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Aktion
                                </th>
                            </tr>

                        </thead>

                        <tbody>

                        ${
                            users.map(
                                target => `
                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            target.globalName ||
                                            target.username
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            target.discordId
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            target.role
                                        )}
                                    </td>

                                    <td>
                                        ${
                                            target.banned
                                            ? '🚫 Gesperrt'
                                            : '✅ Aktiv'
                                        }
                                    </td>

                                    <td>

                                        ${
                                            isOwner(
                                                target
                                            )
                                            ? `
                                            👑 OWNER
                                            `
                                            : `
                                            <form
                                                method="POST"
                                                action="/admin/users/${escapeHTML(
                                                    target.id
                                                )}/toggle-ban"
                                            >
                                                <button
                                                    class="red"
                                                >
                                                    ${
                                                        target.banned
                                                        ? 'Entsperren'
                                                        : 'Sperren'
                                                    }
                                                </button>
                                            </form>
                                            `
                                        }

                                    </td>

                                </tr>
                                `
                            ).join('')
                        }

                        </tbody>

                    </table>

                </div>

                <div class="card">

                    <h2>
                        🖥️ Serververwaltung
                    </h2>

                    ${
                        servers.length
                        ? servers.map(
                            server => `
                            <div class="card">

                                <h3>
                                    ⛏️
                                    ${escapeHTML(
                                        server.name
                                    )}
                                </h3>

                                <p>
                                    Besitzer:
                                    ${escapeHTML(
                                        server.ownerName ||
                                        ''
                                    )}
                                </p>

                                <p>
                                    Status:
                                    ${escapeHTML(
                                        server.status
                                    )}
                                </p>

                                <p>
                                    ${
                                        server.locked
                                        ? '🔒 Gesperrt'
                                        : '🔓 Freigegeben'
                                    }
                                </p>

                                <form
                                    method="POST"
                                    action="/admin/servers/${escapeHTML(
                                        server.id
                                    )}/toggle-lock"
                                    class="inline"
                                >
                                    <button>
                                        ${
                                            server.locked
                                            ? '🔓 Entsperren'
                                            : '🔒 Sperren'
                                        }
                                    </button>
                                </form>

                                <form
                                    method="POST"
                                    action="/admin/servers/${escapeHTML(
                                        server.id
                                    )}/shutdown"
                                    class="inline"
                                >
                                    <button
                                        class="red"
                                    >
                                        ⛔ Herunterfahren
                                    </button>
                                </form>

                                <form
                                    method="POST"
                                    action="/admin/servers/${escapeHTML(
                                        server.id
                                    )}/delete"
                                    class="inline"
                                    onsubmit="return confirm('Server wirklich löschen?')"
                                >
                                    <button
                                        class="red"
                                    >
                                        🗑️ Löschen
                                    </button>
                                </form>

                            </div>
                            `
                        ).join('')
                        : `
                        <p>
                            Keine Server vorhanden.
                        </p>
                        `
                    }

                </div>
                `,
                user
            )
        );
    }
);

/* =========================================================
   ADMIN BESTELLUNG ANNEHMEN
========================================================= */

app.post(
    '/admin/orders/:id/accept',
    requireAdmin,
    async (req, res) => {

        const orders =
            readJSON(
                ORDERS_FILE
            );

        const index =
            orders.findIndex(
                order =>
                    order.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        const order =
            orders[index];

        if (
            order.status !==
            'wartend'
        ) {
            return res.redirect(
                '/admin'
            );
        }

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const server = {

            id:
                createId(
                    'server'
                ),

            ownerId:
                order.userId,

            ownerDiscordId:
                order.discordId,

            ownerName:
                order.userName,

            ownerEmail:
                order.userEmail,

            name:
                order.serverName,

            version:
                order.version,

            status:
                'offline',

            locked:
                false,

            createdAt:
                new Date().toISOString(),

            approvedAt:
                new Date().toISOString(),

            approvedBy:
                req.user.discordId

        };

        servers.push(
            server
        );

        writeJSON(
            SERVERS_FILE,
            servers
        );

        order.status =
            'angenommen';

        order.serverId =
            server.id;

        order.processedBy =
            req.user.discordId;

        order.processedAt =
            new Date().toISOString();

        writeJSON(
            ORDERS_FILE,
            orders
        );

        if (order.userEmail) {

            await sendMail(
                order.userEmail,
                'Minecraft Server angenommen',
                `
                <h2>
                    ✅ Bestellung angenommen
                </h2>

                <p>
                    Deine Minecraft-Server-Bestellung
                    <strong>
                        ${escapeHTML(
                            order.serverName
                        )}
                    </strong>
                    wurde angenommen.
                </p>

                <p>
                    Du kannst deinen Server
                    jetzt auf der Webseite sehen.
                </p>
                `
            );
        }

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN BESTELLUNG ABLEHNEN
========================================================= */

app.post(
    '/admin/orders/:id/reject',
    requireAdmin,
    async (req, res) => {

        const orders =
            readJSON(
                ORDERS_FILE
            );

        const index =
            orders.findIndex(
                order =>
                    order.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bestellung nicht gefunden'
            );
        }

        const order =
            orders[index];

        if (
            order.status !==
            'wartend'
        ) {
            return res.redirect(
                '/admin'
            );
        }

        /*
         * Die Server-Bestellung ist kostenlos.
         * Daher werden keine Coins abgezogen.
         *
         * Falls du später ein Coin-System
         * einbaust, kann hier automatisch
         * erstattet werden.
         */

        order.status =
            'abgelehnt';

        order.processedBy =
            req.user.discordId;

        order.processedAt =
            new Date().toISOString();

        writeJSON(
            ORDERS_FILE,
            orders
        );

        if (order.userEmail) {

            await sendMail(
                order.userEmail,
                'Minecraft Server Bestellung abgelehnt',
                `
                <h2>
                    ❌ Bestellung abgelehnt
                </h2>

                <p>
                    Deine Bestellung
                    <strong>
                        ${escapeHTML(
                            order.serverName
                        )}
                    </strong>
                    wurde abgelehnt.
                </p>

                <p>
                    Es wurden keine Coins abgezogen,
                    da diese Bestellung kostenlos war.
                </p>
                `
            );
        }

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN USER SPERREN
========================================================= */

app.post(
    '/admin/users/:id/toggle-ban',
    requireAdmin,
    (req, res) => {

        const users =
            readJSON(
                USERS_FILE
            );

        const index =
            users.findIndex(
                user =>
                    user.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Benutzer nicht gefunden'
            );
        }

        const target =
            users[index];

        /*
         * Owner darf niemals
         * durch Admins gesperrt werden.
         */

        if (
            isOwner(target)
        ) {
            return res.status(403).send(
                'Der Owner kann nicht gesperrt werden.'
            );
        }

        /*
         * Admins können nur vom Owner
         * verwaltet werden.
         */

        if (
            target.role ===
            'admin' &&
            !isOwner(req.user)
        ) {
            return res.status(403).send(
                'Nur der Owner kann Admins verwalten.'
            );
        }

        target.banned =
            !target.banned;

        writeJSON(
            USERS_FILE,
            users
        );

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN BEWERBUNG ANNEHMEN
========================================================= */

app.post(
    '/admin/applications/:id/accept',
    requireAdmin,
    async (req, res) => {

        const applications =
            readJSON(
                APPLICATIONS_FILE
            );

        const index =
            applications.findIndex(
                application =>
                    application.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'angenommen';

        applications[index].processedBy =
            req.user.discordId;

        applications[index].processedAt =
            new Date().toISOString();

        writeJSON(
            APPLICATIONS_FILE,
            applications
        );

        const email =
            applications[index]
                .userEmail;

        if (email) {

            await sendMail(
                email,
                'Deine Team-Bewerbung wurde angenommen',
                `
                <h2>
                    ✅ Bewerbung angenommen
                </h2>

                <p>
                    Deine Bewerbung als
                    <strong>
                        ${escapeHTML(
                            applications[index]
                                .type
                        )}
                    </strong>
                    wurde angenommen.
                </p>
                `
            );
        }

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN BEWERBUNG ABLEHNEN
========================================================= */

app.post(
    '/admin/applications/:id/reject',
    requireAdmin,
    async (req, res) => {

        const applications =
            readJSON(
                APPLICATIONS_FILE
            );

        const index =
            applications.findIndex(
                application =>
                    application.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Bewerbung nicht gefunden'
            );
        }

        applications[index].status =
            'abgelehnt';

        applications[index].processedBy =
            req.user.discordId;

        applications[index].processedAt =
            new Date().toISOString();

        writeJSON(
            APPLICATIONS_FILE,
            applications
        );

        const email =
            applications[index]
                .userEmail;

        if (email) {

            await sendMail(
                email,
                'Deine Team-Bewerbung wurde abgelehnt',
                `
                <h2>
                    ❌ Bewerbung abgelehnt
                </h2>

                <p>
                    Deine Bewerbung als
                    <strong>
                        ${escapeHTML(
                            applications[index]
                                .type
                        )}
                    </strong>
                    wurde leider abgelehnt.
                </p>
                `
            );
        }

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN SERVER SPERREN
========================================================= */

app.post(
    '/admin/servers/:id/toggle-lock',
    requireAdmin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].locked =
            !servers[index].locked;

        if (
            servers[index].locked
        ) {
            servers[index].status =
                'offline';
        }

        servers[index].updatedAt =
            new Date().toISOString();

        writeJSON(
            SERVERS_FILE,
            servers
        );

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN SERVER HERUNTERFAHREN
========================================================= */

app.post(
    '/admin/servers/:id/shutdown',
    requireAdmin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const index =
            servers.findIndex(
                server =>
                    server.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        servers[index].status =
            'offline';

        servers[index].updatedAt =
            new Date().toISOString();

        writeJSON(
            SERVERS_FILE,
            servers
        );

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   ADMIN SERVER LÖSCHEN
========================================================= */

app.post(
    '/admin/servers/:id/delete',
    requireAdmin,
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE
            );

        const exists =
            servers.some(
                server =>
                    server.id ===
                    req.params.id
            );

        if (!exists) {
            return res.status(404).send(
                'Server nicht gefunden'
            );
        }

        const updated =
            servers.filter(
                server =>
                    server.id !==
                    req.params.id
            );

        writeJSON(
            SERVERS_FILE,
            updated
        );

        /*
         * Zugehörige Bestellung bleibt
         * als Verlauf bestehen.
         */

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   OWNER: ADMIN ROLLE VERGEBEN
========================================================= */

app.post(
    '/admin/users/:id/toggle-admin',
    requireAdmin,
    (req, res) => {

        if (!isOwner(req.user)) {

            return res.status(403).send(
                'Nur der Owner kann Admins verwalten.'
            );
        }

        const users =
            readJSON(
                USERS_FILE
            );

        const index =
            users.findIndex(
                user =>
                    user.id ===
                    req.params.id
            );

        if (index === -1) {
            return res.status(404).send(
                'Benutzer nicht gefunden'
            );
        }

        if (
            isOwner(
                users[index]
            )
        ) {
            return res.status(400).send(
                'Der Owner benötigt keine Admin-Rolle.'
            );
        }

        users[index].role =
            users[index].role ===
            'admin'
            ? 'user'
            : 'admin';

        writeJSON(
            USERS_FILE,
            users
        );

        res.redirect(
            '/admin'
        );
    }
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).send(
            layout(
                '404',
                `
                <div class="error">

                    <h1>
                        404
                    </h1>

                    <p>
                        Diese Seite wurde nicht gefunden.
                    </p>

                </div>

                <a
                    class="btn"
                    href="/"
                >
                    Zur Startseite
                </a>
                `
            )
        );
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            '================================'
        );

        console.error(
            '❌ UNBEHANDELTER FEHLER'
        );

        console.error(
            error
        );

        console.error(
            '================================'
        );

        if (
            res.headersSent
        ) {
            return next(
                error
            );
        }

        res.status(500).send(
            layout(
                'Fehler',
                `
                <div class="error">

                    <h1>
                        ❌ Serverfehler
                    </h1>

                    <p>
                        Bei der Verarbeitung
                        ist ein Fehler aufgetreten.
                    </p>

                </div>
                `
            )
        );
    }
);

/* =========================================================
   START
========================================================= */

app.listen(
    PORT,
    async () => {

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            '⛏️ FLORIAN / WEISSERHAI'
        );

        console.log(
            'MINECRAFT HOSTING'
        );

        console.log(
            '========================================'
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            `🌐 Base URL: ${BASE_URL}`
        );

        console.log(
            `🎮 Discord OAuth2: ${
                discordConfigured()
                ? 'AKTIV'
                : 'NICHT KONFIGURIERT'
            }`
        );

        console.log(
            `👑 Owner Discord ID: ${
                OWNER_DISCORD_ID
                ? OWNER_DISCORD_ID
                : 'NICHT GESETZT'
            }`
        );

        console.log(
            `📧 Gmail: ${
                transporter
                ? 'KONFIGURIERT'
                : 'NICHT KONFIGURIERT'
            }`
        );

        console.log(
            '🔐 Discord Login: AKTIV'
        );

        console.log(
            '🆓 Server-Bestellungen: AKTIV'
        );

        console.log(
            '👑 Admin-Freigabe: AKTIV'
        );

        console.log(
            '🖥️ Serververwaltung: AKTIV'
        );

        console.log(
            '📝 Bewerbungen: AKTIV'
        );

        console.log(
            '========================================'
        );

        console.log('');

        if (transporter) {

            try {

                await transporter.verify();

                console.log(
                    '✅ Gmail SMTP Verbindung erfolgreich.'
                );

            } catch (error) {

                console.error(
                    '❌ Gmail SMTP Verbindung fehlgeschlagen.'
                );

                console.error(
                    'Name:',
                    error.name
                );

                console.error(
                    'Message:',
                    error.message
                );

                console.error(
                    'Code:',
                    error.code
                );

                console.error(
                    'Response:',
                    error.response
                );
            }
        }
    }
);
