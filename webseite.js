```javascript
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

const PORT = Number(process.env.PORT || 3000);

/*
========================================================
 MINECRAFT HOSTING
========================================================

 Admin:
   florianzustolberg@gmail.com

 WICHTIG:
 Das Admin-Passwort NICHT hier eintragen.
 ADMIN_PASSWORD muss als Environment Variable gesetzt werden.

 Beispiel:
 ADMIN_PASSWORD=DEIN_SICHERES_PASSWORT

 Minecraft:
 Jeder Server bekommt einen eigenen Ordner.
 In diesem Ordner muss eine server.jar liegen.

========================================================
*/

const ADMIN_EMAIL = "florianzustolberg@gmail.com";

const DATA_DIR = path.join(__dirname, "data");
const SERVERS_DIR = path.join(__dirname, "minecraft-servers");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SERVERS_DIR, { recursive: true });

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/*
========================================================
 DATEIEN
========================================================
*/

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
        console.error(
            "JSON Fehler:",
            file,
            error.message
        );

        return fallback;
    }
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2)
        );

        return true;
    } catch (error) {
        console.error(
            "Speicherfehler:",
            file,
            error.message
        );

        return false;
    }
}

let users = readJSON(
    USERS_FILE,
    []
);

let servers = readJSON(
    SERVERS_FILE,
    []
);

let settings = readJSON(
    SETTINGS_FILE,
    {
        maintenance: false,
        outage: false,
        outageText:
            "Aktuell liegt eine Störung vor."
    }
);

/*
========================================================
 RUNTIME
========================================================
*/

const runningProcesses = new Map();

const sessions = new Map();

/*
========================================================
 PASSWORT
========================================================
*/

function hashPassword(password) {
    const salt =
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto.scryptSync(
            password,
            salt,
            64
        ).toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(
    password,
    stored
) {
    try {
        const [salt, original] =
            stored.split(":");

        const hash =
            crypto.scryptSync(
                password,
                salt,
                64
            ).toString("hex");

        const a =
            Buffer.from(hash, "hex");

        const b =
            Buffer.from(original, "hex");

        if (a.length !== b.length) {
            return false;
        }

        return crypto.timingSafeEqual(
            a,
            b
        );
    } catch {
        return false;
    }
}

/*
========================================================
 SESSION
========================================================
*/

function createSession(email) {
    const token =
        crypto.randomBytes(48)
            .toString("hex");

    sessions.set(
        token,
        {
            email,
            createdAt: Date.now()
        }
    );

    return token;
}

function getSession(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token =
        header.substring(7);

    return sessions.get(token) || null;
}

function requireLogin(req, res, next) {
    const session =
        getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message:
                "Du musst angemeldet sein."
        });
    }

    req.session = session;

    next();
}

function requireAdmin(req, res, next) {
    const session =
        getSession(req);

    if (!session) {
        return res.status(401).json({
            success: false,
            message:
                "Nicht angemeldet."
        });
    }

    if (
        session.email.toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Kein Zugriff auf das Admin-Panel."
        });
    }

    req.session = session;

    next();
}

/*
========================================================
 HILFSFUNKTIONEN
========================================================
*/

function cleanName(value) {
    return String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32);
}

function serverDirectory(id) {
    return path.join(
        SERVERS_DIR,
        id
    );
}

function serverLogDirectory(id) {
    return path.join(
        serverDirectory(id),
        "logs"
    );
}

function serverLogFile(id) {
    return path.join(
        serverLogDirectory(id),
        "console.log"
    );
}

function appendLog(
    server,
    text
) {
    try {
        const dir =
            serverLogDirectory(
                server.id
            );

        fs.mkdirSync(
            dir,
            { recursive: true }
        );

        const line =
            `[${new Date().toISOString()}] ${text}\n`;

        fs.appendFileSync(
            serverLogFile(
                server.id
            ),
            line
        );
    } catch (error) {
        console.error(
            "Log Fehler:",
            error.message
        );
    }
}

function publicServer(server) {
    return {
        id: server.id,
        name: server.name,
        port: server.port,
        status:
            runningProcesses.has(
                server.id
            )
                ? "online"
                : "offline",
        createdAt: server.createdAt
    };
}

function getServer(id) {
    return servers.find(
        server =>
            server.id === id
    );
}

/*
========================================================
 REGISTRIERUNG
========================================================
*/

app.post(
    "/api/register",
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

        if (
            !username ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Bitte alle Felder ausfüllen."
            });
        }

        if (
            !/^[a-zA-Z0-9_]{3,24}$/
                .test(username)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Benutzername: 3–24 Zeichen."
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
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(email)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Ungültige E-Mail-Adresse."
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
                    "Benutzername bereits vorhanden."
            });
        }

        if (
            users.some(
                user =>
                    user.email.toLowerCase() ===
                    email
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "E-Mail bereits registriert."
            });
        }

        const user = {
            id: crypto.randomUUID(),
            username,
            email,
            password: hashPassword(
                password
            ),
            createdAt:
                new Date().toISOString()
        };

        users.push(user);

        saveJSON(
            USERS_FILE,
            users
        );

        console.log(
            `👤 Registrierung: ${email}`
        );

        res.json({
            success: true,
            message:
                "Registrierung erfolgreich."
        });
    }
);

/*
========================================================
 LOGIN
========================================================
*/

app.post(
    "/api/login",
    (req, res) => {

        const login =
            String(
                req.body.login || ""
            ).trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        /*
        Admin kann sich nur anmelden,
        wenn ADMIN_PASSWORD gesetzt wurde.
        */

        const adminPassword =
            process.env.ADMIN_PASSWORD;

        if (
            login ===
                ADMIN_EMAIL.toLowerCase() &&
            adminPassword &&
            password === adminPassword
        ) {
            const token =
                createSession(
                    ADMIN_EMAIL
                );

            return res.json({
                success: true,
                token,
                user: {
                    email:
                        ADMIN_EMAIL,
                    username:
                        "Florian",
                    admin: true
                }
            });
        }

        const user =
            users.find(
                item =>
                    item.email.toLowerCase() ===
                        login ||
                    item.username.toLowerCase() ===
                        login
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "Login-Daten falsch."
            });
        }

        if (
            !verifyPassword(
                password,
                user.password
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Login-Daten falsch."
            });
        }

        const token =
            createSession(
                user.email
            );

        res.json({
            success: true,
            token,
            user: {
                email: user.email,
                username: user.username,
                admin:
                    user.email.toLowerCase() ===
                    ADMIN_EMAIL.toLowerCase()
            }
        });
    }
);

/*
========================================================
 LOGOUT
========================================================
*/

app.post(
    "/api/logout",
    requireLogin,
    (req, res) => {

        const token =
            req.headers.authorization
                .substring(7);

        sessions.delete(token);

        res.json({
            success: true
        });
    }
);

/*
========================================================
 USER
========================================================
*/

app.get(
    "/api/me",
    requireLogin,
    (req, res) => {

        if (
            req.session.email.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.json({
                success: true,
                user: {
                    email:
                        ADMIN_EMAIL,
                    username:
                        "Florian",
                    admin: true
                }
            });
        }

        const user =
            users.find(
                item =>
                    item.email.toLowerCase() ===
                    req.session.email.toLowerCase()
            );

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        res.json({
            success: true,
            user: {
                email: user.email,
                username: user.username,
                admin: false
            }
        });
    }
);

/*
========================================================
 STATUS
========================================================
*/

app.get(
    "/api/status",
    (req, res) => {

        res.json({
            success: true,
            maintenance:
                settings.maintenance,
            outage:
                settings.outage,
            outageText:
                settings.outageText
        });
    }
);

/*
========================================================
 SERVER LISTE
========================================================
*/

app.get(
    "/api/servers",
    requireLogin,
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

/*
========================================================
 SERVER ERSTELLEN
========================================================
*/

app.post(
    "/api/servers",
    requireLogin,
    (req, res) => {

        const name =
            cleanName(
                req.body.name
            );

        const port =
            Number(
                req.body.port
            );

        if (!name) {
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
                    server.name.toLowerCase() ===
                    name.toLowerCase()
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Servername bereits vorhanden."
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
                    "Dieser Port wird bereits verwendet."
            });
        }

        const id =
            crypto.randomUUID();

        const directory =
            serverDirectory(id);

        fs.mkdirSync(
            directory,
            { recursive: true }
        );

        fs.mkdirSync(
            serverLogDirectory(id),
            { recursive: true }
        );

        const server = {
            id,
            name,
            port,
            owner:
                req.session.email,
            createdAt:
                new Date().toISOString()
        };

        servers.push(server);

        saveJSON(
            SERVERS_FILE,
            servers
        );

        appendLog(
            server,
            `Server "${name}" wurde erstellt.`
        );

        res.json({
            success: true,
            server:
                publicServer(server),
            message:
                "Server erstellt."
        });
    }
);

/*
========================================================
 SERVER START
========================================================
*/

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

        if (
            runningProcesses.has(
                server.id
            )
        ) {
            return res.json({
                success: true,
                message:
                    "Server läuft bereits."
            });
        }

        const directory =
            serverDirectory(
                server.id
            );

        const jar =
            path.join(
                directory,
                "server.jar"
            );

        if (!fs.existsSync(jar)) {
            appendLog(
                server,
                "START ABGEBROCHEN: server.jar fehlt."
            );

            return res.status(400).json({
                success: false,
                message:
                    "server.jar fehlt im Serverordner."
            });
        }

        /*
        EULA automatisch akzeptieren,
        damit der Server nach dem Erstellen
        gestartet werden kann.
        */

        const eula =
            path.join(
                directory,
                "eula.txt"
            );

        if (!fs.existsSync(eula)) {
            fs.writeFileSync(
                eula,
                "eula=true\n"
            );
        }

        appendLog(
            server,
            "Minecraft-Server wird gestartet."
        );

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
                    cwd: directory,
                    env: {
                        ...process.env
                    }
                }
            );

        runningProcesses.set(
            server.id,
            child
        );

        child.stdout.on(
            "data",
            data => {

                const text =
                    data.toString();

                process.stdout.write(
                    `[${server.name}] ${text}`
                );

                appendLog(
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
                    `[${server.name}] ${text}`
                );

                appendLog(
                    server,
                    "ERROR: " +
                    text.trim()
                );
            }
        );

        child.on(
            "close",
            code => {

                runningProcesses.delete(
                    server.id
                );

                appendLog(
                    server,
                    `Minecraft-Prozess beendet. Exit-Code: ${code}`
                );

                console.log(
                    `⛏️ ${server.name} beendet.`
                );
            }
        );

        child.on(
            "error",
            error => {

                runningProcesses.delete(
                    server.id
                );

                appendLog(
                    server,
                    `Prozessfehler: ${error.message}`
                );
            }
        );

        res.json({
            success: true,
            message:
                "Server wird gestartet."
        });
    }
);

/*
========================================================
 SERVER STOP
========================================================
*/

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

        const child =
            runningProcesses.get(
                server.id
            );

        if (!child) {
            return res.json({
                success: true,
                message:
                    "Server ist bereits offline."
            });
        }

        appendLog(
            server,
            "Stop-Befehl gesendet."
        );

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {
            try {
                child.kill();
            } catch {}
        }

        setTimeout(
            () => {

                if (
                    runningProcesses.has(
                        server.id
                    )
                ) {
                    try {
                        child.kill();
                    } catch {}

                    runningProcesses.delete(
                        server.id
                    );
                }

            },
            15000
        );

        res.json({
            success: true,
            message:
                "Server wird gestoppt."
        });
    }
);

/*
========================================================
 SERVER RESTART
========================================================
*/

app.post(
    "/api/servers/:id/restart",
    requireLogin,
    async (req, res) => {

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

        const child =
            runningProcesses.get(
                server.id
            );

        if (!child) {
            return res.status(400).json({
                success: false,
                message:
                    "Server ist offline."
            });
        }

        appendLog(
            server,
            "Neustart angefordert."
        );

        try {
            child.stdin.write(
                "stop\n"
            );
        } catch {}

        setTimeout(
            () => {

                if (
                    !runningProcesses.has(
                        server.id
                    )
                ) {

                    /*
                    Start über interne
                    HTTP-Funktion wäre möglich.
                    Hier direkt erneut starten.
                    */

                    const directory =
                        serverDirectory(
                            server.id
                        );

                    const jar =
                        path.join(
                            directory,
                            "server.jar"
                        );

                    if (
                        fs.existsSync(jar)
                    ) {

                        const newChild =
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
                                    cwd:
                                        directory,
                                    env: {
                                        ...process.env
                                    }
                                }
                            );

                        runningProcesses.set(
                            server.id,
                            newChild
                        );

                        newChild.stdout.on(
                            "data",
                            data => {

                                appendLog(
                                    server,
                                    data
                                        .toString()
                                        .trim()
                                );
                            }
                        );

                        newChild.stderr.on(
                            "data",
                            data => {

                                appendLog(
                                    server,
                                    "ERROR: " +
                                    data
                                        .toString()
                                        .trim()
                                );
                            }
                        );

                        newChild.on(
                            "close",
                            () => {
                                runningProcesses.delete(
                                    server.id
                                );
                            }
                        );

                        appendLog(
                            server,
                            "Server wurde neu gestartet."
                        );
                    }
                }

            },
            8000
        );

        res.json({
            success: true,
            message:
                "Server wird neu gestartet."
        });
    }
);

/*
========================================================
 KONSOLE
========================================================
*/

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
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const command =
            String(
                req.body.command || ""
            ).trim();

        if (!command) {
            return res.status(400).json({
                success: false,
                message:
                    "Kein Befehl."
            });
        }

        if (
            command.length > 500
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Befehl zu lang."
            });
        }

        const child =
            runningProcesses.get(
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
                command + "\n"
            );

            appendLog(
                server,
                `COMMAND: ${command}`
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

/*
========================================================
 LOGS
========================================================
*/

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

        const file =
            serverLogFile(
                server.id
            );

        if (!fs.existsSync(file)) {
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

        /*
        Nur die letzten 100.000 Zeichen.
        */

        if (
            logs.length > 100000
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

/*
========================================================
 SERVER LÖSCHEN
========================================================
*/

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
                success: false,
                message:
                    "Server nicht gefunden."
            });
        }

        const child =
            runningProcesses.get(
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

            runningProcesses.delete(
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

        const directory =
            serverDirectory(
                server.id
            );

        try {
            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (error) {
            console.error(
                "Ordner konnte nicht gelöscht werden:",
                error.message
            );
        }

        res.json({
            success: true,
            message:
                "Server gelöscht."
        });
    }
);

/*
========================================================
 ADMIN: ALLE SERVER
========================================================
*/

app.get(
    "/api/admin/servers",
    requireAdmin,
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

/*
========================================================
 ADMIN: ALLE SERVER STOPPEN
========================================================
*/

app.post(
    "/api/admin/stop-all",
    requireAdmin,
    (req, res) => {

        let stopped = 0;

        for (
            const server
            of servers
        ) {

            const child =
                runningProcesses.get(
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

            appendLog(
                server,
                "ADMIN: Alle Server werden heruntergefahren."
            );

            stopped++;
        }

        res.json({
            success: true,
            stopped
        });
    }
);

/*
========================================================
 ADMIN: WARTUNG
========================================================
*/

app.post(
    "/api/admin/maintenance",
    requireAdmin,
    (req, res) => {

        settings.maintenance =
            Boolean(
                req.body.enabled
            );

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        console.log(
            "🛠️ Wartung:",
            settings.maintenance
        );

        res.json({
            success: true,
            maintenance:
                settings.maintenance
        });
    }
);

/*
========================================================
 ADMIN: STÖRUNG
========================================================
*/

app.post(
    "/api/admin/outage",
    requireAdmin,
    (req, res) => {

        settings.outage =
            Boolean(
                req.body.enabled
            );

        if (
            typeof req.body.text ===
            "string" &&
            req.body.text.trim()
        ) {
            settings.outageText =
                req.body.text
                    .trim()
                    .slice(0, 500);
        }

        saveJSON(
            SETTINGS_FILE,
            settings
        );

        console.log(
            "🚨 Störung:",
            settings.outage
        );

        res.json({
            success: true,
            outage:
                settings.outage,
            outageText:
                settings.outageText
        });
    }
);

/*
========================================================
 ADMIN: ALLE LOGS
========================================================
*/

app.get(
    "/api/admin/logs",
    requireAdmin,
    (req, res) => {

        const result = [];

        for (
            const server
            of servers
        ) {

            const file =
                serverLogFile(
                    server.id
                );

            let logs = "";

            if (
                fs.existsSync(file)
            ) {
                logs =
                    fs.readFileSync(
                        file,
                        "utf8"
                    );

                if (
                    logs.length >
                    20000
                ) {
                    logs =
                        logs.slice(
                            -20000
                        );
                }
            }

            result.push({
                id:
                    server.id,
                name:
                    server.name,
                logs
            });
        }

        res.json({
            success: true,
            logs: result
        });
    }
);

/*
========================================================
 WEBSITE
========================================================
*/

app.get(
    "*",
    (req, res) => {

        res.send(`<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
>

<title>Minecraft Hosting</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;

    min-height: 100vh;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at top,
            #17391c,
            #050805 55%,
            #020302
        );
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

.nav {
    position: sticky;
    top: 0;

    z-index: 20;

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 15px;

    padding: 15px 22px;

    background:
        rgba(3,8,4,.9);

    border-bottom:
        1px solid
        rgba(100,220,90,.2);

    backdrop-filter:
        blur(12px);
}

.logo {
    font-weight: 900;
    font-size: 20px;
}

.navButtons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

button {
    border: 0;
    border-radius: 7px;
    padding: 10px 14px;
}

.green {
    background: #48a83e;
    color: white;
}

.dark {
    background: #182019;
    color: white;
    border:
        1px solid
        #314235;
}

.red {
    background: #a93636;
    color: white;
}

.orange {
    background: #a66b2e;
    color: white;
}

.page {
    width:
        min(1200px, calc(100% - 24px));

    margin:
        35px auto 80px;
}

.hero {
    padding:
        55px 25px;

    text-align: center;

    border:
        1px solid
        rgba(100,220,90,.25);

    border-radius: 15px;

    background:
        rgba(8,18,9,.82);

    box-shadow:
        0 25px 80px
        rgba(0,0,0,.4);
}

.hero h1 {
    margin: 0;

    font-size:
        clamp(35px, 8vw, 75px);
}

.hero p {
    color: #aebaae;
    line-height: 1.7;
}

.status {
    margin-top: 20px;

    display: inline-block;

    padding: 8px 13px;

    border-radius: 20px;

    background:
        rgba(65,170,60,.15);

    color: #8de884;
}

.section {
    margin-top: 25px;

    padding: 22px;

    border:
        1px solid
        rgba(100,220,90,.2);

    border-radius: 12px;

    background:
        rgba(7,14,8,.88);
}

.section h2 {
    margin-top: 0;
}

.form {
    display: grid;

    gap: 10px;

    max-width: 500px;
}

input,
textarea {
    width: 100%;

    padding: 12px;

    border-radius: 7px;

    border:
        1px solid
        #314235;

    background:
        #0c120d;

    color: white;

    outline: none;
}

input:focus,
textarea:focus {
    border-color: #55bd4b;
}

.serverGrid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(260px, 1fr)
        );

    gap: 15px;
}

.server {
    padding: 18px;

    border-radius: 10px;

    background:
        #0c130d;

    border:
        1px solid
        #263829;
}

.server h3 {
    margin-top: 0;
}

.online {
    color: #72df67;
}

.offline {
    color: #df7777;
}

.actions {
    display: flex;

    gap: 7px;

    flex-wrap: wrap;

    margin-top: 12px;
}

.console {
    width: 100%;

    min-height: 280px;

    padding: 15px;

    overflow: auto;

    white-space: pre-wrap;

    word-break: break-word;

    border-radius: 8px;

    background:
        #020402;

    color:
        #9fe79a;

    font-family:
        Consolas,
        monospace;

    font-size: 12px;
}

.modal {
    position: fixed;

    inset: 0;

    z-index: 100;

    display: none;

    align-items: center;

    justify-content: center;

    padding: 15px;

    background:
        rgba(0,0,0,.75);

    backdrop-filter:
        blur(8px);
}

.modal.show {
    display: flex;
}

.modalBox {
    width:
        min(440px, 100%);

    padding: 25px;

    border-radius: 12px;

    background:
        #081009;

    border:
        1px solid
        #315534;

    box-shadow:
        0 30px 100px
        rgba(0,0,0,.7);
}

.modalTop {
    display: flex;

    justify-content:
        space-between;

    align-items: center;
}

.close {
    background: transparent;
    color: white;
    font-size: 25px;
}

.hidden {
    display: none !important;
}

.admin {
    border:
        1px solid
        rgba(220,170,60,.4);

    background:
        rgba(40,28,7,.5);
}

.warning {
    padding: 15px;

    margin-bottom: 15px;

    border-radius: 8px;

    background:
        rgba(170,50,40,.2);

    border:
        1px solid
        rgba(220,80,60,.35);
}

@media (max-width: 600px) {

    .nav {
        align-items: flex-start;
        flex-direction: column;
    }

    .page {
        width:
            calc(100% - 14px);

        margin-top: 15px;
    }

    .hero {
        padding:
            40px 15px;
    }

    .section {
        padding: 15px;
    }

    .actions button {
        flex: 1 1 auto;
    }

}

</style>

</head>

<body>

<nav class="nav">

    <div class="logo">
        ⛏️ Minecraft Hosting
    </div>

    <div
        class="navButtons"
        id="navButtons"
    >

        <button
            class="dark"
            onclick="openModal('login')"
        >
            🔑 Anmelden
        </button>

        <button
            class="green"
            onclick="openModal('register')"
        >
            📝 Registrieren
        </button>

    </div>

</nav>

<main class="page">

<section class="hero">

    <h1>
        Minecraft Hosting
    </h1>

    <p>
        Deine Minecraft-Server.
        Deine Kontrolle.
    </p>

    <div
        class="status"
        id="status"
    >
        🟢 System online
    </div>

</section>

<section
    class="section"
    id="welcome"
>

    <h2>
        ⛏️ Server Hosting
    </h2>

    <p>
        Erstelle deine eigenen Minecraft-Server
        und verwalte sie direkt über diese Webseite.
    </p>

</section>

<section
    class="section hidden"
    id="userArea"
>

    <h2>
        👤 Mein Bereich
    </h2>

    <p id="userInfo"></p>

    <div
        class="form"
    >

        <input
            id="serverName"
            placeholder="Servername"
            maxlength="32"
        >

        <input
            id="serverPort"
            type="number"
            min="1024"
            max="65535"
            placeholder="Port z.B. 25565"
        >

        <button
            class="green"
            onclick="createServer()"
        >
            ➕ Minecraft-Server erstellen
        </button>

    </div>

    <br>

    <div
        class="serverGrid"
        id="servers"
    ></div>

</section>

<section
    class="section admin hidden"
    id="adminArea"
>

    <h2>
        👑 Admin Panel
    </h2>

    <p>
        Nur für den Administrator.
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
            🟢 Wartung AUS
        </button>

        <button
            class="red"
            onclick="stopAll()"
        >
            ⛔ ALLE SERVER STOPPEN
        </button>

        <button
            class="orange"
            onclick="setOutage(true)"
        >
            🚨 Störung AN
        </button>

        <button
            class="dark"
            onclick="setOutage(false)"
        >
            🟢 Störung AUS
        </button>

    </div>

    <br>

    <textarea
        id="outageText"
        rows="3"
        placeholder="Text der Störungsmeldung"
    ></textarea>

    <br><br>

    <h3>
        📜 Alle Server
    </h3>

    <div
        id="adminServers"
        class="serverGrid"
    ></div>

    <h3>
        📟 System-Logs
    </h3>

    <div
        id="adminLogs"
    ></div>

</section>

</main>


<!-- LOGIN -->

<div
    class="modal"
    id="login"
>

<div class="modalBox">

<div class="modalTop">

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

<div class="form">

<input
    id="loginName"
    placeholder="Benutzername oder E-Mail"
>

<input
    id="loginPassword"
    type="password"
    placeholder="Passwort"
>

<button
    class="green"
    onclick="login()"
>
Anmelden
</button>

</div>

<p id="loginMessage"></p>

</div>

</div>


<!-- REGISTER -->

<div
    class="modal"
    id="register"
>

<div class="modalBox">

<div class="modalTop">

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

<div class="form">

<input
    id="registerUsername"
    placeholder="Benutzername"
    maxlength="24"
>

<input
    id="registerEmail"
    type="email"
    placeholder="E-Mail"
>

<input
    id="registerPassword"
    type="password"
    placeholder="Passwort"
>

<button
    class="green"
    onclick="register()"
>
Konto erstellen
</button>

</div>

<p id="registerMessage"></p>

</div>

</div>


<script>

let token =
    localStorage.getItem(
        "minecraftHostingToken"
    );

let currentUser = null;

function openModal(id) {

    closeModals();

    document
        .getElementById(id)
        .classList.add("show");
}

function closeModals() {

    document
        .querySelectorAll(".modal")
        .forEach(
            modal =>
                modal.classList
                    .remove("show")
        );
}

async function api(
    url,
    options = {}
) {

    options.headers =
        options.headers || {};

    options.headers[
        "Content-Type"
    ] =
        "application/json";

    if (token) {
        options.headers[
            "Authorization"
        ] =
            "Bearer " + token;
    }

    const response =
        await fetch(
            url,
            options
        );

    const data =
        await response.json();

    if (
        response.status === 401
    ) {
        token = null;

        localStorage.removeItem(
            "minecraftHostingToken"
        );
    }

    return {
        response,
        data
    };
}

async function register() {

    const username =
        document
            .getElementById(
                "registerUsername"
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

    const result =
        await api(
            "/api/register",
            {
                method: "POST",
                body:
                    JSON.stringify({
                        username,
                        email,
                        password
                    })
            }
        );

    const message =
        document
            .getElementById(
                "registerMessage"
            );

    message.textContent =
        result.data.message;

    if (
        result.data.success
    ) {
        setTimeout(
            () => {
                closeModals();
                openModal("login");
            },
            1000
        );
    }
}

async function login() {

    const login =
        document
            .getElementById(
                "loginName"
            )
            .value
            .trim();

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
                method: "POST",
                body:
                    JSON.stringify({
                        login,
                        password
                    })
            }
        );

    const message =
        document
            .getElementById(
                "loginMessage"
            );

    if (
        !result.data.success
    ) {
        message.textContent =
            "❌ " +
            result.data.message;

        return;
    }

    token =
        result.data.token;

    localStorage.setItem(
        "minecraftHostingToken",
        token
    );

    currentUser =
        result.data.user;

    closeModals();

    await loadUser();

    await loadServers();

    if (
        currentUser.admin
    ) {
        await loadAdmin();
    }
}

async function loadUser() {

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
        return;
    }

    currentUser =
        result.data.user;

    document
        .getElementById(
            "welcome"
        )
        .classList
        .add("hidden");

    document
        .getElementById(
            "userArea"
        )
        .classList
        .remove("hidden");

    document
        .getElementById(
            "userInfo"
        )
        .textContent =
            "Angemeldet als: " +
            currentUser.username +
            " (" +
            currentUser.email +
            ")";

    document
        .getElementById(
            "navButtons"
        )
        .innerHTML = \`
            <button
                class="dark"
                onclick="logout()"
            >
                🚪 Abmelden
            </button>
        \`;

    if (
        currentUser.admin
    ) {

        document
            .getElementById(
                "adminArea"
            )
            .classList
            .remove("hidden");

        document
            .getElementById(
                "navButtons"
            )
            .innerHTML += \`
                <button
                    class="orange"
                    onclick="scrollAdmin()"
                >
                    👑 Admin
                </button>
            \`;
    }
}

async function logout() {

    await api(
        "/api/logout",
        {
            method: "POST"
        }
    );

    token = null;
    currentUser = null;

    localStorage.removeItem(
        "minecraftHostingToken"
    );

    location.reload();
}

async function createServer() {

    if (!token) {
        openModal("login");
        return;
    }

    const name =
        document
            .getElementById(
                "serverName"
            )
            .value;

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
            "/api/servers",
            {
                method: "POST",
                body:
                    JSON.stringify({
                        name,
                        port
                    })
            }
        );

    alert(
        result.data.message ||
        "Server erstellt."
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

        await loadServers();
    }
}

async function loadServers() {

    if (!token) {
        return;
    }

    const result =
        await api(
            "/api/servers"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const container =
        document.getElementById(
            "servers"
        );

    container.innerHTML = "";

    if (
        result.data.servers.length === 0
    ) {

        container.innerHTML =
            "<p>Noch keine Server.</p>";

        return;
    }

    result.data.servers.forEach(
        server => {

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "server";

            const online =
                server.status ===
                "online";

            element.innerHTML = \`
                <h3>
                    ⛏️ \${escapeHtml(server.name)}
                </h3>

                <p>
                    Status:
                    <strong
                        class="\${online ? "online" : "offline"}"
                    >
                        \${online ? "🟢 Online" : "🔴 Offline"}
                    </strong>
                </p>

                <p>
                    Port:
                    <strong>
                        \${server.port}
                    </strong>
                </p>

                <div class="actions">

                    <button
                        class="green"
                        onclick="serverAction(
                            '\${server.id}',
                            'start'
                        )"
                    >
                        ▶️ Start
                    </button>

                    <button
                        class="red"
                        onclick="serverAction(
                            '\${server.id}',
                            'stop'
                        )"
                    >
                        ⏹️ Stop
                    </button>

                    <button
                        class="orange"
                        onclick="serverAction(
                            '\${server.id}',
                            'restart'
                        )"
                    >
                        🔄 Restart
                    </button>

                    <button
                        class="dark"
                        onclick="showConsole(
                            '\${server.id}',
                            '\${escapeHtml(server.name)}'
                        )"
                    >
                        📟 Konsole
                    </button>

                    <button
                        class="red"
                        onclick="deleteServer(
                            '\${server.id}'
                        )"
                    >
                        🗑️ Löschen
                    </button>

                </div>

                <div
                    id="console-\${server.id}"
                    class="hidden"
                >

                    <br>

                    <div
                        class="console"
                        id="logs-\${server.id}"
                    >
                    </div>

                    <br>

                    <div
                        class="actions"
                    >

                        <input
                            id="command-\${server.id}"
                            placeholder="Minecraft-Befehl z.B. say Hallo"
                        >

                        <button
                            class="green"
                            onclick="sendCommand(
                                '\${server.id}'
                            )"
                        >
                            ➤ Senden
                        </button>

                    </div>

                </div>
            \`;

            container.appendChild(
                element
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
            id +
            "/" +
            action,
            {
                method: "POST"
            }
        );

    if (
        !result.data.success
    ) {
        alert(
            result.data.message
        );
    }

    setTimeout(
        loadServers,
        1000
    );
}

async function deleteServer(
    id
) {

    if (
        !confirm(
            "Diesen Server wirklich löschen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            id,
            {
                method: "DELETE"
            }
        );

    alert(
        result.data.message
    );

    await loadServers();
}

async function showConsole(
    id,
    name
) {

    document
        .getElementById(
            "console-" + id
        )
        .classList
        .toggle("hidden");

    await loadLogs(id);

    if (
        !window.consoleTimers
    ) {
        window.consoleTimers = {};
    }

    clearInterval(
        window.consoleTimers[id]
    );

    window.consoleTimers[id] =
        setInterval(
            () => loadLogs(id),
            3000
        );
}

async function loadLogs(id) {

    const result =
        await api(
            "/api/servers/" +
            id +
            "/logs"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const element =
        document.getElementById(
            "logs-" + id
        );

    if (!element) {
        return;
    }

    element.textContent =
        result.data.logs ||
        "Noch keine Logs.";

    element.scrollTop =
        element.scrollHeight;
}

async function sendCommand(id) {

    const input =
        document.getElementById(
            "command-" + id
        );

    const command =
        input.value.trim();

    if (!command) {
        return;
    }

    const result =
        await api(
            "/api/servers/" +
            id +
            "/command",
            {
                method: "POST",
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
            result.data.message
        );

        return;
    }

    input.value = "";

    setTimeout(
        () => loadLogs(id),
        500
    );
}

async function loadAdmin() {

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

    const container =
        document.getElementById(
            "adminServers"
        );

    container.innerHTML = "";

    result.data.servers.forEach(
        server => {

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "server";

            element.innerHTML = \`
                <h3>
                    ⛏️ \${escapeHtml(server.name)}
                </h3>

                <p>
                    Status:
                    \${server.status}
                </p>

                <p>
                    Port:
                    \${server.port}
                </p>

                <div class="actions">

                    <button
                        class="green"
                        onclick="serverAction(
                            '\${server.id}',
                            'start'
                        )"
                    >
                        ▶️ Start
                    </button>

                    <button
                        class="red"
                        onclick="serverAction(
                            '\${server.id}',
                            'stop'
                        )"
                    >
                        ⏹️ Stop
                    </button>

                    <button
                        class="orange"
                        onclick="serverAction(
                            '\${server.id}',
                            'restart'
                        )"
                    >
                        🔄 Restart
                    </button>

                </div>
            \`;

            container.appendChild(
                element
            );
        }
    );

    await loadAdminLogs();
}

async function stopAll() {

    if (
        !confirm(
            "ALLE laufenden Minecraft-Server stoppen?"
        )
    ) {
        return;
    }

    const result =
        await api(
            "/api/admin/stop-all",
            {
                method: "POST"
            }
        );

    alert(
        "Gestoppte Server: " +
        (result.data.stopped || 0)
    );

    setTimeout(
        loadAdmin,
        1000
    );
}

async function setMaintenance(
    enabled
) {

    const result =
        await api(
            "/api/admin/maintenance",
            {
                method: "POST",
                body:
                    JSON.stringify({
                        enabled
                    })
            }
        );

    if (
        result.data.success
    ) {
        alert(
            enabled
                ? "Wartung aktiviert."
                : "Wartung deaktiviert."
        );

        updateStatus();
    }
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

    const result =
        await api(
            "/api/admin/outage",
            {
                method: "POST",
                body:
                    JSON.stringify({
                        enabled,
                        text
                    })
            }
        );

    if (
        result.data.success
    ) {
        alert(
            enabled
                ? "Störungsmodus aktiviert."
                : "Störungsmodus deaktiviert."
        );

        updateStatus();
    }
}

async function loadAdminLogs() {

    const result =
        await api(
            "/api/admin/logs"
        );

    if (
        !result.data.success
    ) {
        return;
    }

    const container =
        document.getElementById(
            "adminLogs"
        );

    container.innerHTML = "";

    result.data.logs.forEach(
        item => {

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "section";

            wrapper.innerHTML = \`
                <h3>
                    📜 \${escapeHtml(item.name)}
                </h3>

                <div class="console">
                    \${escapeHtml(item.logs || "Keine Logs.")}
                </div>
            \`;

            container.appendChild(
                wrapper
            );
        }
    );
}

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
        document.getElementById(
            "status"
        );

    if (
        result.data.maintenance
    ) {

        status.textContent =
            "🛠️ Webseite befindet sich in Wartung.";

        status.style.color =
            "#f2bd68";

        return;
    }

    if (
        result.data.outage
    ) {

        status.textContent =
            "🚨 " +
            result.data.outageText;

        status.style.color =
            "#ff7777";

        return;
    }

    status.textContent =
        "🟢 System online";
}

function scrollAdmin() {

    document
        .getElementById(
            "adminArea"
        )
        .scrollIntoView({
            behavior: "smooth"
        });
}

function escapeHtml(
    value
) {

    return String(value)
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

/*
========================================================
 START
========================================================
*/

(async () => {

    console.log(
        "======================================"
    );

    console.log(
        "⛏️ Minecraft Hosting startet"
    );

    console.log(
        "🌐 Port:",
        PORT
    );

    console.log(
        "👑 Admin:",
        ADMIN_EMAIL
    );

    console.log(
        "🖥️ Server:",
        servers.length
    );

    console.log(
        "======================================"
    );

    await updateStatus();

    if (token) {
        await loadUser();
        await loadServers();

        if (
            currentUser &&
            currentUser.admin
        ) {
            await loadAdmin();
        }
    }

})();

setInterval(
    () => {

        /*
        Aufräumen alter Sessions
        */

        const maxAge =
            24 * 60 * 60 * 1000;

        for (
            const [
                token,
                session
            ]
            of sessions
        ) {

            if (
                Date.now() -
                session.createdAt >
                maxAge
            ) {
                sessions.delete(
                    token
                );
            }
        }

    },
    60 * 60 * 1000
);

process.on(
    "SIGTERM",
    () => {

        console.log(
            "🛑 SIGTERM – Server werden beendet."
        );

        for (
            const [
                id,
                child
            ]
            of runningProcesses
        ) {

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}
        }

        process.exit(0);
    }
);

process.on(
    "SIGINT",
    () => {

        for (
            const child
            of runningProcesses.values()
        ) {

            try {
                child.stdin.write(
                    "stop\n"
                );
            } catch {}

            try {
                child.kill();
            } catch {}
        }

        process.exit(0);
    }
);

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 Webseite läuft auf Port ${PORT}`
        );

    }
);
```
