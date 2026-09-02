"use strict";

/*
===========================================================
 FLORIAN / WEISSERHAI MINECRAFT HOSTING
===========================================================

 Node.js 20+ / 24
 Express Webserver
 Minecraft Server Management
 Login / Registrierung
 Owner Panel
 Server Prozesse
 Dateien / Code Editor
 Wartungsmodus
 Bannsystem

 START:
   node webseite.js

 EMPFOHLENE .env:
   PORT=10000
   SESSION_SECRET=DEIN_LANGER_GEHEIMER_SESSION_KEY
   OWNER_EMAIL=florianzustolberg@gmail.com

 MINECRAFT:
   Lege Minecraft-JAR-Dateien unter ./minecraft-jars/
   ab.

 Beispiel:
   minecraft-jars/server.jar

 Hinweis:
   Für Java/Minecraft muss Java auf dem Hosting-System installiert
   sein und "java" über PATH erreichbar sein.
===========================================================
*/

const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const http = require("http");

try {
  require("dotenv").config();
} catch (_) {
  // dotenv ist optional.
}

/* =========================================================
   KONFIGURATION
========================================================= */

const app = express();

const PORT = Number(process.env.PORT || 10000);

const OWNER_EMAIL = String(
  process.env.OWNER_EMAIL || "florianzustolberg@gmail.com"
).toLowerCase();

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_123456789";

const HOSTING_NAME = "Florian / WeisserHai Minecraft Hosting";

const ROOT = __dirname;

const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const BANS_FILE = path.join(DATA_DIR, "bans.json");
const MINECRAFT_DIR = path.join(ROOT, "minecraft-jars");
const SERVERS_DIR = path.join(ROOT, "minecraft-servers");

/* =========================================================
   VERZEICHNISSE
========================================================= */

for (const directory of [
  DATA_DIR,
  MINECRAFT_DIR,
  SERVERS_DIR
]) {
  fs.mkdirSync(directory, {
    recursive: true
  });
}

/* =========================================================
   JSON HILFSFUNKTIONEN
========================================================= */

function ensureJsonFile(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(fallback, null, 2),
      "utf8"
    );
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        JSON.stringify(fallback, null, 2),
        "utf8"
      );

      return fallback;
    }

    const raw = fs.readFileSync(file, "utf8").trim();

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("JSON-Lesefehler:", file, error.message);

    return fallback;
  }
}

function writeJson(file, data) {
  const temporary = `${file}.tmp`;

  fs.writeFileSync(
    temporary,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(temporary, file);
}

/* =========================================================
   STANDARD-DATEN
========================================================= */

ensureJsonFile(USERS_FILE, []);
ensureJsonFile(SERVERS_FILE, []);
ensureJsonFile(SETTINGS_FILE, {
  maintenance: false,
  maintenanceMessage:
    "Die Webseite befindet sich momentan im Wartungsmodus."
});
ensureJsonFile(BANS_FILE, []);

/* =========================================================
   DATEN
========================================================= */

let users = readJson(USERS_FILE, []);
let servers = readJson(SERVERS_FILE, []);
let settings = readJson(SETTINGS_FILE, {
  maintenance: false,
  maintenanceMessage:
    "Die Webseite befindet sich momentan im Wartungsmodus."
});
let bans = readJson(BANS_FILE, []);

/* =========================================================
   SPEICHERN
========================================================= */

function saveUsers() {
  writeJson(USERS_FILE, users);
}

function saveServers() {
  writeJson(SERVERS_FILE, servers);
}

function saveSettings() {
  writeJson(SETTINGS_FILE, settings);
}

function saveBans() {
  writeJson(BANS_FILE, bans);
}

/* =========================================================
   OWNER
========================================================= */

function isOwner(user) {
  if (!user) {
    return false;
  }

  return (
    String(user.email || "").toLowerCase() === OWNER_EMAIL
  );
}

/* =========================================================
   PASSWORT
========================================================= */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .pbkdf2Sync(
      String(password),
      salt,
      120000,
      64,
      "sha512"
    )
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    if (!stored || !stored.includes(":")) {
      return false;
    }

    const parts = stored.split(":");

    const salt = parts[0];
    const originalHash = parts[1];

    const hash = crypto
      .pbkdf2Sync(
        String(password),
        salt,
        120000,
        64,
        "sha512"
      )
      .toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(originalHash, "hex")
    );
  } catch (_) {
    return false;
  }
}

/* =========================================================
   ID
========================================================= */

function id(prefix) {
  return (
    prefix +
    "_" +
    crypto.randomBytes(10).toString("hex")
  );
}

/* =========================================================
   NAME SICHER MACHEN
========================================================= */

function safeName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

/* =========================================================
   SERVERPFAD
========================================================= */

function getServerDirectory(server) {
  const directory = path.join(
    SERVERS_DIR,
    server.id
  );

  fs.mkdirSync(directory, {
    recursive: true
  });

  return directory;
}

/* =========================================================
   PFAD-SCHUTZ
========================================================= */

function safeServerPath(server, requestedPath) {
  const base = path.resolve(
    getServerDirectory(server)
  );

  const requested = String(
    requestedPath || ""
  );

  const target = path.resolve(
    base,
    requested
  );

  if (
    target !== base &&
    !target.startsWith(base + path.sep)
  ) {
    throw new Error("Ungültiger Dateipfad.");
  }

  return target;
}

/* =========================================================
   USER SUCHEN
========================================================= */

function findUserById(userId) {
  return users.find(
    user => user.id === userId
  );
}

function findUserByEmail(email) {
  return users.find(
    user =>
      String(user.email).toLowerCase() ===
      String(email).toLowerCase()
  );
}

function findServer(serverId) {
  return servers.find(
    server => server.id === serverId
  );
}

/* =========================================================
   BAN
========================================================= */

function isBanned(user) {
  if (!user) {
    return false;
  }

  return bans.some(
    ban =>
      ban.email &&
      ban.email.toLowerCase() ===
        user.email.toLowerCase()
  );
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "Nicht eingeloggt."
    });
  }

  const user = findUserById(
    req.session.userId
  );

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({
      error: "Sitzung ungültig."
    });
  }

  if (isBanned(user)) {
    req.session.destroy(() => {});
    return res.status(403).json({
      error: "Dein Konto wurde gesperrt."
    });
  }

  req.user = user;

  next();
}

function requireOwner(req, res, next) {
  if (!req.user || !isOwner(req.user)) {
    return res.status(403).json({
      error: "Nur der Owner darf diese Funktion benutzen."
    });
  }

  next();
}

/* =========================================================
   SERVER-BERECHTIGUNG
========================================================= */

function userCanAccessServer(user, server) {
  if (!user || !server) {
    return false;
  }

  if (isOwner(user)) {
    return true;
  }

  return server.ownerId === user.id;
}

function requireServerAccess(req, res, next) {
  const server = findServer(
    req.params.serverId
  );

  if (!server) {
    return res.status(404).json({
      error: "Server nicht gefunden."
    });
  }

  if (
    !userCanAccessServer(
      req.user,
      server
    )
  ) {
    return res.status(403).json({
      error: "Keine Berechtigung für diesen Server."
    });
  }

  req.server = server;

  next();
}

/* =========================================================
   MINECRAFT PROZESSE
========================================================= */

const processes = new Map();

function getProcess(serverId) {
  return processes.get(serverId);
}

function isServerRunning(serverId) {
  const processInfo = processes.get(serverId);

  return Boolean(
    processInfo &&
    processInfo.process &&
    !processInfo.process.killed
  );
}

function appendConsole(server, text) {
  const clean = String(text || "");

  server.console = server.console || [];

  server.console.push({
    time: new Date().toISOString(),
    text: clean
  });

  if (server.console.length > 500) {
    server.console = server.console.slice(-500);
  }

  saveServers();
}

/* =========================================================
   EULA
========================================================= */

function ensureEula(serverDirectory) {
  const eula = path.join(
    serverDirectory,
    "eula.txt"
  );

  if (!fs.existsSync(eula)) {
    fs.writeFileSync(
      eula,
      "eula=true\n",
      "utf8"
    );
  }
}

/* =========================================================
   SERVER STARTEN
========================================================= */

function startMinecraftServer(server) {
  if (isServerRunning(server.id)) {
    return {
      success: false,
      message: "Server läuft bereits."
    };
  }

  const directory =
    getServerDirectory(server);

  ensureEula(directory);

  const jarName =
    server.jar || "server.jar";

  const jarPath = path.join(
    MINECRAFT_DIR,
    jarName
  );

  const localJarPath = path.join(
    directory,
    jarName
  );

  if (
    fs.existsSync(jarPath) &&
    !fs.existsSync(localJarPath)
  ) {
    fs.copyFileSync(
      jarPath,
      localJarPath
    );
  }

  if (!fs.existsSync(localJarPath)) {
    appendConsole(
      server,
      `Minecraft-JAR nicht gefunden: ${jarName}`
    );

    return {
      success: false,
      message:
        `Minecraft-JAR "${jarName}" wurde nicht gefunden.`
    };
  }

  const ram = Math.max(
    512,
    Number(server.ram || 1024)
  );

  const args = [
    `-Xms${ram}M`,
    `-Xmx${ram}M`,
    "-jar",
    jarName,
    "nogui"
  ];

  const child = spawn(
    "java",
    args,
    {
      cwd: directory,
      stdio: [
        "pipe",
        "pipe",
        "pipe"
      ],
      windowsHide: true
    }
  );

  processes.set(server.id, {
    process: child,
    startedAt: Date.now()
  });

  server.status = "starting";
  server.startedAt = new Date().toISOString();

  saveServers();

  child.stdout.on(
    "data",
    data => {
      const text =
        data.toString();

      appendConsole(
        server,
        text
      );
    }
  );

  child.stderr.on(
    "data",
    data => {
      const text =
        data.toString();

      appendConsole(
        server,
        text
      );
    }
  );

  child.on(
    "error",
    error => {
      appendConsole(
        server,
        `Prozessfehler: ${error.message}`
      );

      server.status = "stopped";

      processes.delete(server.id);

      saveServers();
    }
  );

  child.on(
    "exit",
    (code, signal) => {
      appendConsole(
        server,
        `Server beendet. Code=${code} Signal=${signal || "none"}`
      );

      server.status = "stopped";
      server.startedAt = null;

      processes.delete(server.id);

      saveServers();
    }
  );

  setTimeout(() => {
    if (isServerRunning(server.id)) {
      server.status = "online";
      saveServers();
    }
  }, 3000);

  return {
    success: true,
    message: "Server wird gestartet."
  };
}

/* =========================================================
   SERVER STOPPEN
========================================================= */

function stopMinecraftServer(server) {
  const info =
    processes.get(server.id);

  if (!info || !info.process) {
    server.status = "stopped";
    saveServers();

    return {
      success: true,
      message: "Server läuft nicht."
    };
  }

  try {
    info.process.stdin.write(
      "stop\n"
    );
  } catch (_) {}

  setTimeout(() => {
    const current =
      processes.get(server.id);

    if (
      current &&
      current.process &&
      !current.process.killed
    ) {
      try {
        current.process.kill(
          "SIGTERM"
        );
      } catch (_) {}
    }
  }, 10000);

  server.status = "stopping";

  saveServers();

  return {
    success: true,
    message: "Server wird gestoppt."
  };
}

/* =========================================================
   SERVER RESTART
========================================================= */

async function restartMinecraftServer(server) {
  stopMinecraftServer(server);

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        3000
      )
  );

  return startMinecraftServer(
    server
  );
}

/* =========================================================
   EXPRESS
========================================================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        30
    }
  })
);

/* =========================================================
   WARTUNG
========================================================= */

app.use(
  (req, res, next) => {
    if (
      settings.maintenance &&
      req.path !== "/api/status" &&
      !req.path.startsWith("/api/auth") &&
      req.path !== "/"
    ) {
      const user =
        req.session &&
        req.session.userId
          ? findUserById(
              req.session.userId
            )
          : null;

      if (!user || !isOwner(user)) {
        return res.status(503).json({
          error:
            settings.maintenanceMessage
        });
      }
    }

    next();
  }
);

/* =========================================================
   STARTSEITE
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.send(
      renderPage(
        "Florian / WeisserHai Minecraft Hosting"
      )
    );
  }
);

/* =========================================================
   API STATUS
========================================================= */

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      success: true,
      name: HOSTING_NAME,
      maintenance:
        Boolean(settings.maintenance),
      loggedIn:
        Boolean(req.session.userId),
      version: "2.0.0"
    });
  }
);

/* =========================================================
   REGISTRIERUNG
========================================================= */

app.post(
  "/api/auth/register",
  (req, res) => {
    const email = String(
      req.body.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body.password || ""
    );

    if (
      !email ||
      !email.includes("@")
    ) {
      return res.status(400).json({
        error:
          "Bitte eine gültige E-Mail-Adresse eingeben."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Das Passwort muss mindestens 6 Zeichen haben."
      });
    }

    if (findUserByEmail(email)) {
      return res.status(409).json({
        error:
          "Diese E-Mail ist bereits registriert."
      });
    }

    const user = {
      id: id("user"),
      email,
      passwordHash:
        hashPassword(password),
      createdAt:
        new Date().toISOString(),
      banned: false
    };

    users.push(user);

    saveUsers();

    req.session.userId = user.id;

    req.session.save(() => {
      res.json({
        success: true,
        message:
          "Registrierung erfolgreich.",
        user: {
          id: user.id,
          email: user.email,
          owner: isOwner(user)
        }
      });
    });
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/auth/login",
  (req, res) => {
    const email = String(
      req.body.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body.password || ""
    );

    const user =
      findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error:
          "E-Mail oder Passwort ist falsch."
      });
    }

    if (isBanned(user)) {
      return res.status(403).json({
        error:
          "Dieses Konto wurde gesperrt."
      });
    }

    if (
      !verifyPassword(
        password,
        user.passwordHash
      )
    ) {
      return res.status(401).json({
        error:
          "E-Mail oder Passwort ist falsch."
      });
    }

    req.session.regenerate(
      error => {
        if (error) {
          console.error(
            "Session-Fehler:",
            error
          );

          return res.status(500).json({
            error:
              "Login konnte nicht erstellt werden."
          });
        }

        req.session.userId =
          user.id;

        req.session.save(
          saveError => {
            if (saveError) {
              return res.status(500).json({
                error:
                  "Session konnte nicht gespeichert werden."
              });
            }

            res.json({
              success: true,
              message:
                "Login erfolgreich.",
              user: {
                id: user.id,
                email: user.email,
                owner: isOwner(user)
              }
            });
          }
        );
      }
    );
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  (req, res) => {
    req.session.destroy(
      error => {
        if (error) {
          return res.status(500).json({
            error:
              "Logout fehlgeschlagen."
          });
        }

        res.clearCookie(
          "connect.sid"
        );

        res.json({
          success: true
        });
      }
    );
  }
);

/* =========================================================
   AKTUELLER USER
========================================================= */

app.get(
  "/api/auth/me",
  (req, res) => {
    if (!req.session.userId) {
      return res.json({
        loggedIn: false
      });
    }

    const user =
      findUserById(
        req.session.userId
      );

    if (!user) {
      return res.json({
        loggedIn: false
      });
    }

    res.json({
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        owner: isOwner(user),
        createdAt:
          user.createdAt
      }
    });
  }
);

/* =========================================================
   USER DATEN
========================================================= */

app.get(
  "/api/account",
  requireLogin,
  (req, res) => {
    const ownServers =
      servers.filter(
        server =>
          server.ownerId ===
          req.user.id
      );

    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        owner: isOwner(req.user),
        createdAt:
          req.user.createdAt
      },
      serverCount:
        ownServers.length,
      serverLimit:
        isOwner(req.user)
          ? null
          : 1
    });
  }
);

/* =========================================================
   SERVER LISTE
========================================================= */

app.get(
  "/api/servers",
  requireLogin,
  (req, res) => {
    const visible =
      isOwner(req.user)
        ? servers
        : servers.filter(
            server =>
              server.ownerId ===
              req.user.id
          );

    res.json({
      success: true,
      servers: visible.map(
        server => ({
          id: server.id,
          name: server.name,
          ownerId:
            server.ownerId,
          status:
            server.status,
          ram: server.ram,
          jar: server.jar,
          locked:
            Boolean(server.locked),
          createdAt:
            server.createdAt,
          startedAt:
            server.startedAt
        })
      )
    });
  }
);

/* =========================================================
   SERVER ERSTELLEN
========================================================= */

app.post(
  "/api/servers",
  requireLogin,
  (req, res) => {
    const name = safeName(
      req.body.name
    );

    const ram = Number(
      req.body.ram || 1024
    );

    const jar = safeName(
      req.body.jar ||
        "server.jar"
    );

    if (!name) {
      return res.status(400).json({
        error:
          "Bitte einen Servernamen eingeben."
      });
    }

    if (
      !Number.isFinite(ram) ||
      ram < 512 ||
      ram > 32768
    ) {
      return res.status(400).json({
        error:
          "RAM muss zwischen 512 MB und 32768 MB liegen."
      });
    }

    const ownedServers =
      servers.filter(
        server =>
          server.ownerId ===
          req.user.id
      );

    if (
      !isOwner(req.user) &&
      ownedServers.length >= 1
    ) {
      return res.status(403).json({
        error:
          "Normale Benutzer dürfen einen kostenlosen Server besitzen."
      });
    }

    const server = {
      id: id("server"),
      ownerId:
        req.user.id,
      name,
      ram,
      jar,
      status: "stopped",
      locked: false,
      createdAt:
        new Date().toISOString(),
      startedAt: null,
      console: []
    };

    servers.push(server);

    const directory =
      getServerDirectory(
        server
      );

    ensureEula(directory);

    const properties =
      path.join(
        directory,
        "server.properties"
      );

    if (
      !fs.existsSync(properties)
    ) {
      fs.writeFileSync(
        properties,
        [
          "motd=Florian Minecraft Server",
          "online-mode=true",
          "enable-command-block=false",
          "max-players=20",
          "difficulty=normal",
          "gamemode=survival",
          "pvp=true",
          "server-port=25565"
        ].join("\n") +
          "\n",
        "utf8"
      );
    }

    saveServers();

    res.json({
      success: true,
      message:
        "Minecraft-Server erstellt.",
      server
    });
  }
);

/* =========================================================
   SERVER DETAILS
========================================================= */

app.get(
  "/api/servers/:serverId",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const server =
      req.server;

    res.json({
      success: true,
      server: {
        ...server,
        running:
          isServerRunning(
            server.id
          ),
        process: Boolean(
          getProcess(server.id)
        )
      }
    });
  }
);

/* =========================================================
   SERVER START
========================================================= */

app.post(
  "/api/servers/:serverId/start",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const server =
      req.server;

    if (server.locked) {
      return res.status(423).json({
        error:
          "Dieser Server wurde gesperrt."
      });
    }

    const result =
      startMinecraftServer(
        server
      );

    res.json(result);
  }
);

/* =========================================================
   SERVER STOP
========================================================= */

app.post(
  "/api/servers/:serverId/stop",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const result =
      stopMinecraftServer(
        req.server
      );

    res.json(result);
  }
);

/* =========================================================
   SERVER RESTART
========================================================= */

app.post(
  "/api/servers/:serverId/restart",
  requireLogin,
  requireServerAccess,
  async (req, res) => {
    if (req.server.locked) {
      return res.status(423).json({
        error:
          "Dieser Server wurde gesperrt."
      });
    }

    const result =
      await restartMinecraftServer(
        req.server
      );

    res.json(result);
  }
);

/* =========================================================
   SERVER BEFEHL
========================================================= */

app.post(
  "/api/servers/:serverId/command",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const command = String(
      req.body.command || ""
    ).trim();

    if (!command) {
      return res.status(400).json({
        error:
          "Kein Befehl angegeben."
      });
    }

    if (
      !isServerRunning(
        req.server.id
      )
    ) {
      return res.status(400).json({
        error:
          "Der Server läuft nicht."
      });
    }

    const info =
      getProcess(
        req.server.id
      );

    try {
      info.process.stdin.write(
        command.replace(
          /\r?\n/g,
          ""
        ) + "\n"
      );

      appendConsole(
        req.server,
        `> ${command}`
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Befehl konnte nicht gesendet werden."
      });
    }
  }
);

/* =========================================================
   SERVER SPERREN
========================================================= */

app.post(
  "/api/servers/:serverId/lock",
  requireLogin,
  requireOwner,
  (req, res) => {
    const server =
      findServer(
        req.params.serverId
      );

    if (!server) {
      return res.status(404).json({
        error:
          "Server nicht gefunden."
      });
    }

    server.locked = true;

    stopMinecraftServer(
      server
    );

    saveServers();

    res.json({
      success: true,
      message:
        "Server wurde gesperrt."
    });
  }
);

/* =========================================================
   SERVER ENTSPERREN
========================================================= */

app.post(
  "/api/servers/:serverId/unlock",
  requireLogin,
  requireOwner,
  (req, res) => {
    const server =
      findServer(
        req.params.serverId
      );

    if (!server) {
      return res.status(404).json({
        error:
          "Server nicht gefunden."
      });
    }

    server.locked = false;

    saveServers();

    res.json({
      success: true,
      message:
        "Server wurde entsperrt."
    });
  }
);

/* =========================================================
   SERVER LÖSCHEN
========================================================= */

app.delete(
  "/api/servers/:serverId",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const server =
      req.server;

    if (
      !isOwner(req.user) &&
      server.ownerId !==
        req.user.id
    ) {
      return res.status(403).json({
        error:
          "Keine Berechtigung."
      });
    }

    stopMinecraftServer(
      server
    );

    const directory =
      getServerDirectory(
        server
      );

    try {
      if (fs.existsSync(directory)) {
        fs.rmSync(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
    } catch (error) {
      return res.status(500).json({
        error:
          "Serverdateien konnten nicht gelöscht werden."
      });
    }

    servers =
      servers.filter(
        item =>
          item.id !==
          server.id
      );

    saveServers();

    res.json({
      success: true,
      message:
        "Server wurde gelöscht."
    });
  }
);

/* =========================================================
   DATEIEN LISTEN
========================================================= */

app.get(
  "/api/servers/:serverId/files",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.query.path || ""
      );

    let directory;

    try {
      directory =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (!fs.existsSync(directory)) {
      return res.status(404).json({
        error:
          "Ordner nicht gefunden."
      });
    }

    if (
      !fs.statSync(directory).isDirectory()
    ) {
      return res.status(400).json({
        error:
          "Pfad ist kein Ordner."
      });
    }

    const entries =
      fs.readdirSync(
        directory,
        {
          withFileTypes: true
        }
      );

    res.json({
      success: true,
      path: relative,
      files: entries.map(
        entry => ({
          name:
            entry.name,
          type:
            entry.isDirectory()
              ? "directory"
              : "file"
        })
      )
    });
  }
);

/* =========================================================
   DATEI LESEN
========================================================= */

app.get(
  "/api/servers/:serverId/file",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.query.path || ""
      );

    let file;

    try {
      file =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (!fs.existsSync(file)) {
      return res.status(404).json({
        error:
          "Datei nicht gefunden."
      });
    }

    if (
      !fs.statSync(file).isFile()
    ) {
      return res.status(400).json({
        error:
          "Das ist keine Datei."
      });
    }

    const content =
      fs.readFileSync(
        file,
        "utf8"
      );

    res.json({
      success: true,
      path: relative,
      content
    });
  }
);

/* =========================================================
   DATEI SPEICHERN
========================================================= */

app.put(
  "/api/servers/:serverId/file",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.body.path || ""
      );

    const content =
      String(
        req.body.content || ""
      );

    let file;

    try {
      file =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    fs.mkdirSync(
      path.dirname(file),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      file,
      content,
      "utf8"
    );

    res.json({
      success: true,
      message:
        "Datei gespeichert."
    });
  }
);

/* =========================================================
   DATEI ERSTELLEN
========================================================= */

app.post(
  "/api/servers/:serverId/file",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.body.path || ""
      );

    const content =
      String(
        req.body.content || ""
      );

    let file;

    try {
      file =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (fs.existsSync(file)) {
      return res.status(409).json({
        error:
          "Datei existiert bereits."
      });
    }

    fs.mkdirSync(
      path.dirname(file),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      file,
      content,
      "utf8"
    );

    res.json({
      success: true,
      message:
        "Datei erstellt."
    });
  }
);

/* =========================================================
   ORDNER ERSTELLEN
========================================================= */

app.post(
  "/api/servers/:serverId/folder",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.body.path || ""
      );

    let directory;

    try {
      directory =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (fs.existsSync(directory)) {
      return res.status(409).json({
        error:
          "Ordner existiert bereits."
      });
    }

    fs.mkdirSync(
      directory,
      {
        recursive: true
      }
    );

    res.json({
      success: true,
      message:
        "Ordner erstellt."
    });
  }
);

/* =========================================================
   DATEI / ORDNER LÖSCHEN
========================================================= */

app.delete(
  "/api/servers/:serverId/file",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    const relative =
      String(
        req.query.path || ""
      );

    let target;

    try {
      target =
        safeServerPath(
          req.server,
          relative
        );
    } catch (error) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (!fs.existsSync(target)) {
      return res.status(404).json({
        error:
          "Datei oder Ordner nicht gefunden."
      });
    }

    fs.rmSync(
      target,
      {
        recursive: true,
        force: true
      }
    );

    res.json({
      success: true,
      message:
        "Gelöscht."
    });
  }
);

/* =========================================================
   KONSOLE
========================================================= */

app.get(
  "/api/servers/:serverId/console",
  requireLogin,
  requireServerAccess,
  (req, res) => {
    res.json({
      success: true,
      console:
        req.server.console ||
        []
    });
  }
);

/* =========================================================
   OWNER: ALLE SERVER
========================================================= */

app.get(
  "/api/admin/servers",
  requireLogin,
  requireOwner,
  (req, res) => {
    res.json({
      success: true,
      servers:
        servers.map(
          server => {
            const owner =
              findUserById(
                server.ownerId
              );

            return {
              id:
                server.id,
              name:
                server.name,
              ownerId:
                server.ownerId,
              ownerEmail:
                owner
                  ? owner.email
                  : "unbekannt",
              status:
                server.status,
              locked:
                Boolean(
                  server.locked
                ),
              running:
                isServerRunning(
                  server.id
                ),
              createdAt:
                server.createdAt
            };
          }
        )
    });
  }
);

/* =========================================================
   OWNER: ALLE SERVER STOPPEN
========================================================= */

app.post(
  "/api/admin/servers/shutdown-all",
  requireLogin,
  requireOwner,
  (req, res) => {
    let stopped = 0;

    for (const server of servers) {
      if (
        isServerRunning(
          server.id
        )
      ) {
        stopMinecraftServer(
          server
        );

        stopped++;
      }
    }

    res.json({
      success: true,
      message:
        `${stopped} Server werden heruntergefahren.`
    });
  }
);

/* =========================================================
   OWNER: ALLE SERVER SPERREN
========================================================= */

app.post(
  "/api/admin/servers/lock-all",
  requireLogin,
  requireOwner,
  (req, res) => {
    for (const server of servers) {
      server.locked = true;

      if (
        isServerRunning(
          server.id
        )
      ) {
        stopMinecraftServer(
          server
        );
      }
    }

    saveServers();

    res.json({
      success: true,
      message:
        "Alle Server wurden gesperrt."
    });
  }
);

/* =========================================================
   OWNER: ALLE SERVER ENTSPERREN
========================================================= */

app.post(
  "/api/admin/servers/unlock-all",
  requireLogin,
  requireOwner,
  (req, res) => {
    for (const server of servers) {
      server.locked = false;
    }

    saveServers();

    res.json({
      success: true,
      message:
        "Alle Server wurden entsperrt."
    });
  }
);

/* =========================================================
   OWNER: WARTUNG EIN
========================================================= */

app.post(
  "/api/admin/maintenance",
  requireLogin,
  requireOwner,
  (req, res) => {
    settings.maintenance =
      Boolean(
        req.body.enabled
      );

    if (
      req.body.message !==
      undefined
    ) {
      settings.maintenanceMessage =
        String(
          req.body.message
        ).slice(0, 500);
    }

    saveSettings();

    res.json({
      success: true,
      maintenance:
        settings.maintenance
    });
  }
);

/* =========================================================
   OWNER: USER LISTE
========================================================= */

app.get(
  "/api/admin/users",
  requireLogin,
  requireOwner,
  (req, res) => {
    res.json({
      success: true,
      users:
        users.map(
          user => ({
            id:
              user.id,
            email:
              user.email,
            owner:
              isOwner(user),
            banned:
              isBanned(user),
            createdAt:
              user.createdAt,
            serverCount:
              servers.filter(
                server =>
                  server.ownerId ===
                  user.id
              ).length
          })
        )
    });
  }
);

/* =========================================================
   OWNER: USER BANNEN
========================================================= */

app.post(
  "/api/admin/users/:userId/ban",
  requireLogin,
  requireOwner,
  (req, res) => {
    const user =
      findUserById(
        req.params.userId
      );

    if (!user) {
      return res.status(404).json({
        error:
          "Benutzer nicht gefunden."
      });
    }

    if (isOwner(user)) {
      return res.status(403).json({
        error:
          "Der Owner kann nicht gebannt werden."
      });
    }

    const exists =
      bans.some(
        ban =>
          ban.email ===
          user.email
      );

    if (!exists) {
      bans.push({
        id:
          id("ban"),
        userId:
          user.id,
        email:
          user.email,
        reason:
          String(
            req.body.reason ||
              "Keine Angabe"
          ),
        createdAt:
          new Date().toISOString()
      });

      saveBans();
    }

    user.banned = true;

    saveUsers();

    for (const server of servers) {
      if (
        server.ownerId ===
        user.id
      ) {
        server.locked = true;

        stopMinecraftServer(
          server
        );
      }
    }

    saveServers();

    res.json({
      success: true,
      message:
        "Benutzer wurde gebannt."
    });
  }
);

/* =========================================================
   OWNER: USER ENTBANNEN
========================================================= */

app.post(
  "/api/admin/users/:userId/unban",
  requireLogin,
  requireOwner,
  (req, res) => {
    const user =
      findUserById(
        req.params.userId
      );

    if (!user) {
      return res.status(404).json({
        error:
          "Benutzer nicht gefunden."
      });
    }

    bans =
      bans.filter(
        ban =>
          ban.userId !==
          user.id
      );

    user.banned = false;

    saveBans();
    saveUsers();

    res.json({
      success: true,
      message:
        "Benutzer wurde entbannt."
    });
  }
);

/* =========================================================
   OWNER: USER LÖSCHEN
========================================================= */

app.delete(
  "/api/admin/users/:userId",
  requireLogin,
  requireOwner,
  (req, res) => {
    const user =
      findUserById(
        req.params.userId
      );

    if (!user) {
      return res.status(404).json({
        error:
          "Benutzer nicht gefunden."
      });
    }

    if (isOwner(user)) {
      return res.status(403).json({
        error:
          "Der Owner kann nicht gelöscht werden."
      });
    }

    const ownedServers =
      servers.filter(
        server =>
          server.ownerId ===
          user.id
      );

    for (const server of ownedServers) {
      stopMinecraftServer(
        server
      );

      const directory =
        getServerDirectory(
          server
        );

      if (
        fs.existsSync(directory)
      ) {
        fs.rmSync(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
    }

    servers =
      servers.filter(
        server =>
          server.ownerId !==
          user.id
      );

    users =
      users.filter(
        item =>
          item.id !==
          user.id
      );

    bans =
      bans.filter(
        ban =>
          ban.userId !==
          user.id
      );

    saveUsers();
    saveServers();
    saveBans();

    res.json({
      success: true,
      message:
        "Benutzer und dessen Server wurden gelöscht."
    });
  }
);

/* =========================================================
   OWNER: SERVER GLOBAL LÖSCHEN
========================================================= */

app.delete(
  "/api/admin/servers/:serverId",
  requireLogin,
  requireOwner,
  (req, res) => {
    const server =
      findServer(
        req.params.serverId
      );

    if (!server) {
      return res.status(404).json({
        error:
          "Server nicht gefunden."
      });
    }

    stopMinecraftServer(
      server
    );

    const directory =
      getServerDirectory(
        server
      );

    if (
      fs.existsSync(directory)
    ) {
      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }

    servers =
      servers.filter(
        item =>
          item.id !==
          server.id
      );

    saveServers();

    res.json({
      success: true,
      message:
        "Server wurde gelöscht."
    });
  }
);

/* =========================================================
   OWNER: SERVER SPERREN GLOBAL
========================================================= */

app.post(
  "/api/admin/servers/:serverId/lock",
  requireLogin,
  requireOwner,
  (req, res) => {
    const server =
      findServer(
        req.params.serverId
      );

    if (!server) {
      return res.status(404).json({
        error:
          "Server nicht gefunden."
      });
    }

    server.locked = true;

    stopMinecraftServer(
      server
    );

    saveServers();

    res.json({
      success: true,
      message:
        "Server gesperrt."
    });
  }
);

/* =========================================================
   OWNER: SERVER ENTPERREN GLOBAL
========================================================= */

app.post(
  "/api/admin/servers/:serverId/unlock",
  requireLogin,
  requireOwner,
  (req, res) => {
    const server =
      findServer(
        req.params.serverId
      );

    if (!server) {
      return res.status(404).json({
        error:
          "Server nicht gefunden."
      });
    }

    server.locked = false;

    saveServers();

    res.json({
      success: true,
      message:
        "Server entsperrt."
    });
  }
);

/* =========================================================
   OWNER: JAR LISTE
========================================================= */

app.get(
  "/api/admin/jars",
  requireLogin,
  requireOwner,
  (req, res) => {
    const jars =
      fs.readdirSync(
        MINECRAFT_DIR
      ).filter(
        file =>
          file
            .toLowerCase()
            .endsWith(".jar")
      );

    res.json({
      success: true,
      jars
    });
  }
);

/* =========================================================
   404 API
========================================================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      error:
        "API-Endpunkt nicht gefunden."
    });
  }
);

/* =========================================================
   FEHLERHANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER FEHLER:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Interner Serverfehler."
    });
  }
);

/* =========================================================
   WEBSEITE
========================================================= */

function renderPage(title) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${escapeHtml(title)}</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #080b12;
  color: #ffffff;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.container {
  width: min(1200px, calc(100% - 30px));
  margin: auto;
}

header {
  border-bottom: 1px solid #202638;
  background: #0c1019;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.logo {
  font-weight: 900;
  font-size: 20px;
}

.logo span {
  color: #6ea8ff;
}

.nav-actions {
  display: flex;
  gap: 10px;
}

.hero {
  padding: 70px 0 35px;
}

.hero h1 {
  font-size: clamp(34px, 6vw, 70px);
  margin: 0 0 15px;
}

.hero p {
  color: #9da8bc;
  font-size: 18px;
  line-height: 1.6;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.card {
  background: #101522;
  border: 1px solid #20283a;
  border-radius: 16px;
  padding: 22px;
}

.card h2,
.card h3 {
  margin-top: 0;
}

.muted {
  color: #9da8bc;
}

.form {
  display: grid;
  gap: 12px;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #293247;
  border-radius: 10px;
  background: #090d15;
  color: white;
  padding: 13px;
  outline: none;
}

textarea {
  min-height: 220px;
  resize: vertical;
  font-family: Consolas, monospace;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #6ea8ff;
}

.btn {
  border: 0;
  border-radius: 10px;
  padding: 12px 16px;
  background: #326ee8;
  color: white;
  font-weight: 700;
}

.btn:hover {
  filter: brightness(1.1);
}

.btn-danger {
  background: #c63838;
}

.btn-green {
  background: #218b55;
}

.btn-gray {
  background: #293247;
}

.hidden {
  display: none !important;
}

.section {
  padding: 30px 0;
}

.server {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
}

.server-name {
  font-size: 21px;
  font-weight: 800;
}

.status {
  display: inline-block;
  border-radius: 999px;
  padding: 5px 9px;
  background: #293247;
  color: #b9c4d9;
  font-size: 12px;
}

.status.online {
  background: #175f3c;
  color: #9dffc9;
}

.status.stopped {
  background: #46202a;
  color: #ffb6c2;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 15px;
}

pre {
  background: #060911;
  border: 1px solid #20283a;
  padding: 15px;
  border-radius: 10px;
  overflow: auto;
  min-height: 160px;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-box {
  width: min(500px, 100%);
  background: #101522;
  border: 1px solid #293247;
  border-radius: 16px;
  padding: 25px;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  padding: 14px 18px;
  background: #101522;
  border: 1px solid #293247;
  border-radius: 10px;
  display: none;
  z-index: 200;
}

.admin {
  border-color: #694dff;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td,
th {
  text-align: left;
  padding: 10px;
  border-bottom: 1px solid #20283a;
}

@media (max-width: 700px) {
  .nav {
    align-items: flex-start;
    padding: 15px 0;
    flex-direction: column;
  }
}
</style>
</head>

<body>

<header>
  <div class="container nav">
    <div class="logo">
      Florian <span>/</span> WeisserHai Minecraft Hosting
    </div>

    <div class="nav-actions">
      <button class="btn btn-gray" onclick="showLogin()">
        Login
      </button>

      <button class="btn" onclick="showRegister()">
        Registrieren
      </button>

      <button
        id="logoutButton"
        class="btn btn-danger hidden"
        onclick="logout()"
      >
        Logout
      </button>
    </div>
  </div>
</header>

<main class="container">

<section class="hero">
  <h1>Minecraft Hosting</h1>

  <p>
    Erstelle und verwalte deine Minecraft-Server
    direkt über eine einfache Weboberfläche.
  </p>

  <div class="actions">
    <button class="btn" onclick="showRegister()">
      Kostenlos starten
    </button>

    <button class="btn btn-gray" onclick="showLogin()">
      Einloggen
    </button>
  </div>
</section>

<section id="dashboard" class="section hidden">

  <div class="card">
    <h2>Dashboard</h2>

    <p id="accountInfo" class="muted">
      Lade Account...
    </p>

    <div class="actions">
      <button
        class="btn"
        onclick="openCreateServer()"
      >
        + Minecraft-Server erstellen
      </button>

      <button
        id="adminButton"
        class="btn hidden"
        onclick="loadAdmin()"
      >
        Admin Panel
      </button>
    </div>
  </div>

  <div class="section">
    <h2>Meine Server</h2>

    <div
      id="servers"
      class="grid"
    ></div>
  </div>

  <div
    id="adminPanel"
    class="section hidden"
  ></div>

</section>

<section
  id="loggedOut"
  class="section"
>
  <div class="grid">

    <div class="card">
      <h2>1 kostenloser Server</h2>
      <p class="muted">
        Jeder normale Benutzer kann einen kostenlosen
        Minecraft-Server verwalten.
      </p>
    </div>

    <div class="card">
      <h2>Serververwaltung</h2>
      <p class="muted">
        Starten, stoppen, neustarten und Serverdateien
        verwalten.
      </p>
    </div>

    <div class="card">
      <h2>Code-Editor</h2>
      <p class="muted">
        Serverdateien können direkt über die Website
        bearbeitet werden.
      </p>
    </div>

  </div>
</section>

</main>

<div
  id="modal"
  class="modal hidden"
>
  <div
    id="modalContent"
    class="modal-box"
  ></div>
</div>

<div
  id="toast"
  class="toast"
></div>

<script>
"use strict";

let currentUser = null;
let selectedServer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const element =
    document.getElementById("toast");

  element.textContent =
    message;

  element.style.display =
    "block";

  setTimeout(() => {
    element.style.display =
      "none";
  }, 3000);
}

async function api(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json",
          ...(options.headers || {})
        },
        ...options
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Anfrage fehlgeschlagen."
    );
  }

  return data;
}

function openModal(html) {
  document
    .getElementById(
      "modalContent"
    )
    .innerHTML = html;

  document
    .getElementById(
      "modal"
    )
    .classList.remove(
      "hidden"
    );
}

function closeModal() {
  document
    .getElementById(
      "modal"
    )
    .classList.add(
      "hidden"
    );
}

function showLogin() {
  openModal(\`
    <h2>Login</h2>

    <form
      class="form"
      onsubmit="login(event)"
    >
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

      <button class="btn">
        Einloggen
      </button>
    </form>

    <div class="actions">
      <button
        class="btn btn-gray"
        onclick="showRegister()"
      >
        Noch kein Konto?
      </button>

      <button
        class="btn btn-gray"
        onclick="closeModal()"
      >
        Schließen
      </button>
    </div>
  \`);
}

function showRegister() {
  openModal(\`
    <h2>Registrierung</h2>

    <form
      class="form"
      onsubmit="register(event)"
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
        minlength="6"
        required
      >

      <button class="btn">
        Konto erstellen
      </button>
    </form>

    <div class="actions">
      <button
        class="btn btn-gray"
        onclick="showLogin()"
      >
        Ich habe bereits ein Konto
      </button>

      <button
        class="btn btn-gray"
        onclick="closeModal()"
      >
        Schließen
      </button>
    </div>
  \`);
}

async function login(event) {
  event.preventDefault();

  try {
    const data =
      await api(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email:
              document
                .getElementById(
                  "loginEmail"
                )
                .value,

            password:
              document
                .getElementById(
                  "loginPassword"
                )
                .value
          })
        }
      );

    currentUser =
      data.user;

    closeModal();

    await loadDashboard();

    toast(
      "Login erfolgreich."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function register(event) {
  event.preventDefault();

  try {
    const data =
      await api(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email:
              document
                .getElementById(
                  "registerEmail"
                )
                .value,

            password:
              document
                .getElementById(
                  "registerPassword"
                )
                .value
          })
        }
      );

    currentUser =
      data.user;

    closeModal();

    await loadDashboard();

    toast(
      "Konto erstellt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function logout() {
  try {
    await api(
      "/api/auth/logout",
      {
        method: "POST"
      }
    );
  } catch (_) {}

  currentUser = null;

  document
    .getElementById(
      "dashboard"
    )
    .classList.add(
      "hidden"
    );

  document
    .getElementById(
      "loggedOut"
    )
    .classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "logoutButton"
    )
    .classList.add(
      "hidden"
    );

  toast(
    "Du wurdest ausgeloggt."
  );
}

async function loadDashboard() {
  document
    .getElementById(
      "loggedOut"
    )
    .classList.add(
      "hidden"
    );

  document
    .getElementById(
      "dashboard"
    )
    .classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "logoutButton"
    )
    .classList.remove(
      "hidden"
    );

  if (
    currentUser &&
    currentUser.owner
  ) {
    document
      .getElementById(
        "adminButton"
      )
      .classList.remove(
        "hidden"
      );
  }

  await loadAccount();

  await loadServers();
}

async function loadAccount() {
  try {
    const data =
      await api(
        "/api/account"
      );

    document
      .getElementById(
        "accountInfo"
      )
      .textContent =
        currentUser.owner
          ? currentUser.email +
            " · OWNER · unbegrenzte Server"
          : currentUser.email +
            " · 1 kostenloser Server";
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function loadServers() {
  try {
    const data =
      await api(
        "/api/servers"
      );

    const container =
      document.getElementById(
        "servers"
      );

    if (!data.servers.length) {
      container.innerHTML = \`
        <div class="card">
          <h3>Noch kein Server</h3>
          <p class="muted">
            Erstelle deinen ersten Minecraft-Server.
          </p>
        </div>
      \`;

      return;
    }

    container.innerHTML =
      data.servers
        .map(
          server => \`
            <div class="card">
              <div class="server">
                <div>
                  <div class="server-name">
                    \${escapeHtml(server.name)}
                  </div>

                  <p class="muted">
                    RAM:
                    \${server.ram} MB
                    ·
                    JAR:
                    \${escapeHtml(server.jar)}
                  </p>

                  <span
                    class="status \${server.status === "online" ? "online" : "stopped"}"
                  >
                    \${escapeHtml(server.status)}
                  </span>

                  \${server.locked ? \`
                    <span class="status">
                      GESPERRT
                    </span>
                  \` : ""}
                </div>
              </div>

              <div class="actions">

                <button
                  class="btn btn-green"
                  onclick="serverAction('\${server.id}', 'start')"
                >
                  Start
                </button>

                <button
                  class="btn btn-gray"
                  onclick="serverAction('\${server.id}', 'stop')"
                >
                  Stop
                </button>

                <button
                  class="btn btn-gray"
                  onclick="serverAction('\${server.id}', 'restart')"
                >
                  Restart
                </button>

                <button
                  class="btn"
                  onclick="openServer('\${server.id}')"
                >
                  Verwalten
                </button>

                <button
                  class="btn btn-danger"
                  onclick="deleteServer('\${server.id}')"
                >
                  Löschen
                </button>

              </div>
            </div>
          \`
        )
        .join("");
  } catch (error) {
    toast(
      error.message
    );
  }
}

function openCreateServer() {
  openModal(\`
    <h2>Server erstellen</h2>

    <form
      class="form"
      onsubmit="createServer(event)"
    >

      <input
        id="serverName"
        placeholder="Servername"
        maxlength="40"
        required
      >

      <input
        id="serverRam"
        type="number"
        min="512"
        max="32768"
        value="1024"
        placeholder="RAM in MB"
        required
      >

      <input
        id="serverJar"
        value="server.jar"
        placeholder="Minecraft JAR"
        required
      >

      <button class="btn">
        Server erstellen
      </button>

    </form>

    <div class="actions">
      <button
        class="btn btn-gray"
        onclick="closeModal()"
      >
        Abbrechen
      </button>
    </div>
  \`);
}

async function createServer(event) {
  event.preventDefault();

  try {
    await api(
      "/api/servers",
      {
        method: "POST",
        body: JSON.stringify({
          name:
            document
              .getElementById(
                "serverName"
              )
              .value,

          ram:
            Number(
              document
                .getElementById(
                  "serverRam"
                )
                .value
            ),

          jar:
            document
              .getElementById(
                "serverJar"
              )
              .value
        })
      }
    );

    closeModal();

    await loadServers();

    toast(
      "Server erstellt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function serverAction(
  serverId,
  action
) {
  try {
    await api(
      \`/api/servers/\${serverId}/\${action}\`,
      {
        method: "POST"
      }
    );

    await loadServers();

    toast(
      "Aktion ausgeführt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function deleteServer(
  serverId
) {
  if (
    !confirm(
      "Diesen Server wirklich löschen?"
    )
  ) {
    return;
  }

  try {
    await api(
      \`/api/servers/\${serverId}\`,
      {
        method: "DELETE"
      }
    );

    await loadServers();

    toast(
      "Server gelöscht."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function openServer(
  serverId
) {
  selectedServer =
    serverId;

  try {
    const data =
      await api(
        \`/api/servers/\${serverId}\`
      );

    const server =
      data.server;

    openModal(\`
      <h2>
        \${escapeHtml(server.name)}
      </h2>

      <p class="muted">
        Status:
        \${escapeHtml(server.status)}
      </p>

      <div class="actions">
        <button
          class="btn btn-green"
          onclick="serverAction('\${server.id}', 'start'); closeModal()"
        >
          Start
        </button>

        <button
          class="btn btn-gray"
          onclick="serverAction('\${server.id}', 'stop'); closeModal()"
        >
          Stop
        </button>

        <button
          class="btn"
          onclick="openConsole('\${server.id}')"
        >
          Konsole
        </button>

        <button
          class="btn"
          onclick="openFiles('\${server.id}')"
        >
          Dateien / Code
        </button>
      </div>

      <div class="actions">
        <button
          class="btn btn-gray"
          onclick="closeModal()"
        >
          Schließen
        </button>
      </div>
    \`);
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function openConsole(
  serverId
) {
  try {
    const data =
      await api(
        \`/api/servers/\${serverId}/console\`
      );

    const text =
      data.console
        .map(
          line =>
            "[" +
            new Date(
              line.time
            ).toLocaleTimeString() +
            "] " +
            line.text
        )
        .join("");

    openModal(\`
      <h2>Konsole</h2>

      <pre>\${escapeHtml(text)}</pre>

      <form
        class="form"
        onsubmit="sendCommand(event, '\${serverId}')"
      >
        <input
          id="consoleCommand"
          placeholder="z.B. say Hallo"
          autocomplete="off"
        >

        <button class="btn">
          Befehl senden
        </button>
      </form>

      <div class="actions">
        <button
          class="btn btn-gray"
          onclick="openServer('\${serverId}')"
        >
          Zurück
        </button>
      </div>
    \`);
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function sendCommand(
  event,
  serverId
) {
  event.preventDefault();

  const command =
    document
      .getElementById(
        "consoleCommand"
      )
      .value;

  try {
    await api(
      \`/api/servers/\${serverId}/command\`,
      {
        method: "POST",
        body: JSON.stringify({
          command
        })
      }
    );

    await openConsole(
      serverId
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function openFiles(
  serverId,
  currentPath = ""
) {
  try {
    const data =
      await api(
        \`/api/servers/\${serverId}/files?path=\${encodeURIComponent(currentPath)}\`
      );

    const rows =
      data.files
        .map(
          item => \`
            <div class="card">
              <strong>
                \${escapeHtml(item.name)}
              </strong>

              <span class="muted">
                \${item.type}
              </span>

              <div class="actions">
                \${item.type === "file"
                  ? \`
                    <button
                      class="btn"
                      onclick="editFile(
                        '\${serverId}',
                        '\${escapeHtml(
                          currentPath
                            ? currentPath + "/" + item.name
                            : item.name
                        )}'
                      )"
                    >
                      Bearbeiten
                    </button>
                  \`
                  : \`
                    <button
                      class="btn"
                      onclick="openFiles(
                        '\${serverId}',
                        '\${escapeHtml(
                          currentPath
                            ? currentPath + "/" + item.name
                            : item.name
                        )}'
                      )"
                    >
                      Öffnen
                    </button>
                  \`
                }

                <button
                  class="btn btn-danger"
                  onclick="deleteFile(
                    '\${serverId}',
                    '\${escapeHtml(
                      currentPath
                        ? currentPath + "/" + item.name
                        : item.name
                    )}'
                  )"
                >
                  Löschen
                </button>
              </div>
            </div>
          \`
        )
        .join("");

    openModal(\`
      <h2>Dateien</h2>

      <p class="muted">
        /\${escapeHtml(currentPath)}
      </p>

      <div class="actions">
        <button
          class="btn"
          onclick="newFile('\${serverId}', '\${escapeHtml(currentPath)}')"
        >
          + Datei
        </button>

        <button
          class="btn"
          onclick="newFolder('\${serverId}', '\${escapeHtml(currentPath)}')"
        >
          + Ordner
        </button>
      </div>

      <div class="section">
        \${rows || '<p class="muted">Leer</p>'}
      </div>

      <div class="actions">
        <button
          class="btn btn-gray"
          onclick="openServer('\${serverId}')"
        >
          Zurück
        </button>
      </div>
    \`);
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function editFile(
  serverId,
  filePath
) {
  try {
    const data =
      await api(
        \`/api/servers/\${serverId}/file?path=\${encodeURIComponent(filePath)}\`
      );

    openModal(\`
      <h2>
        \${escapeHtml(filePath)}
      </h2>

      <textarea
        id="editor"
      >\${escapeHtml(data.content)}</textarea>

      <div class="actions">
        <button
          class="btn"
          onclick="saveFile(
            '\${serverId}',
            '\${escapeHtml(filePath)}'
          )"
        >
          Speichern
        </button>

        <button
          class="btn btn-gray"
          onclick="openFiles(
            '\${serverId}'
          )"
        >
          Zurück
        </button>
      </div>
    \`);
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function saveFile(
  serverId,
  filePath
) {
  try {
    const content =
      document
        .getElementById(
          "editor"
        )
        .value;

    await api(
      \`/api/servers/\${serverId}/file\`,
      {
        method: "PUT",
        body: JSON.stringify({
          path: filePath,
          content
        })
      }
    );

    toast(
      "Datei gespeichert."
    );

    await editFile(
      serverId,
      filePath
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

function newFile(
  serverId,
  currentPath
) {
  openModal(\`
    <h2>Neue Datei</h2>

    <form
      class="form"
      onsubmit="createFile(event, '\${serverId}', '\${escapeHtml(currentPath)}')"
    >
      <input
        id="newFileName"
        placeholder="z.B. config.txt"
        required
      >

      <textarea
        id="newFileContent"
        placeholder="Dateiinhalt"
      ></textarea>

      <button class="btn">
        Erstellen
      </button>
    </form>
  \`);
}

async function createFile(
  event,
  serverId,
  currentPath
) {
  event.preventDefault();

  const name =
    document
      .getElementById(
        "newFileName"
      )
      .value;

  const content =
    document
      .getElementById(
        "newFileContent"
      )
      .value;

  const fullPath =
    currentPath
      ? currentPath + "/" + name
      : name;

  try {
    await api(
      \`/api/servers/\${serverId}/file\`,
      {
        method: "POST",
        body: JSON.stringify({
          path: fullPath,
          content
        })
      }
    );

    await openFiles(
      serverId,
      currentPath
    );

    toast(
      "Datei erstellt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

function newFolder(
  serverId,
  currentPath
) {
  openModal(\`
    <h2>Neuer Ordner</h2>

    <form
      class="form"
      onsubmit="createFolder(event, '\${serverId}', '\${escapeHtml(currentPath)}')"
    >
      <input
        id="newFolderName"
        placeholder="Ordnername"
        required
      >

      <button class="btn">
        Erstellen
      </button>
    </form>
  \`);
}

async function createFolder(
  event,
  serverId,
  currentPath
) {
  event.preventDefault();

  const name =
    document
      .getElementById(
        "newFolderName"
      )
      .value;

  const fullPath =
    currentPath
      ? currentPath + "/" + name
      : name;

  try {
    await api(
      \`/api/servers/\${serverId}/folder\`,
      {
        method: "POST",
        body: JSON.stringify({
          path: fullPath
        })
      }
    );

    await openFiles(
      serverId,
      currentPath
    );

    toast(
      "Ordner erstellt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function deleteFile(
  serverId,
  filePath
) {
  if (
    !confirm(
      "Wirklich löschen?"
    )
  ) {
    return;
  }

  try {
    await api(
      \`/api/servers/\${serverId}/file?path=\${encodeURIComponent(filePath)}\`,
      {
        method: "DELETE"
      }
    );

    await openFiles(
      serverId
    );

    toast(
      "Gelöscht."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function loadAdmin() {
  if (
    !currentUser ||
    !currentUser.owner
  ) {
    toast(
      "Keine Berechtigung."
    );

    return;
  }

  try {
    const [
      usersData,
      serversData
    ] = await Promise.all([
      api(
        "/api/admin/users"
      ),
      api(
        "/api/admin/servers"
      )
    ]);

    const panel =
      document.getElementById(
        "adminPanel"
      );

    panel.classList.remove(
      "hidden"
    );

    panel.innerHTML = \`
      <div class="card admin">
        <h2>Owner Admin Panel</h2>

        <p class="muted">
          Angemeldet als:
          \${escapeHtml(currentUser.email)}
        </p>

        <div class="actions">

          <button
            class="btn btn-danger"
            onclick="adminShutdownAll()"
          >
            Alle Server herunterfahren
          </button>

          <button
            class="btn btn-danger"
            onclick="adminLockAll()"
          >
            Alle Server sperren
          </button>

          <button
            class="btn btn-green"
            onclick="adminUnlockAll()"
          >
            Alle Server entsperren
          </button>

          <button
            class="btn btn-gray"
            onclick="adminMaintenance(true)"
          >
            Wartung EIN
          </button>

          <button
            class="btn btn-green"
            onclick="adminMaintenance(false)"
          >
            Wartung AUS
          </button>

        </div>

        <h3>Benutzer</h3>

        <div>
          \${usersData.users.map(
            user => \`
              <div class="card">
                <strong>
                  \${escapeHtml(user.email)}
                </strong>

                <p class="muted">
                  Server:
                  \${user.serverCount}
                  ·
                  \${user.banned ? "GEBANNT" : "Aktiv"}
                </p>

                \${user.owner
                  ? "<strong>OWNER</strong>"
                  : \`
                    <div class="actions">

                      \${user.banned
                        ? \`
                          <button
                            class="btn btn-green"
                            onclick="unbanUser('\${user.id}')"
                          >
                            Entbannen
                          </button>
                        \`
                        : \`
                          <button
                            class="btn btn-danger"
                            onclick="banUser('\${user.id}')"
                          >
                            Bannen
                          </button>
                        \`
                      }

                      <button
                        class="btn btn-danger"
                        onclick="deleteUser('\${user.id}')"
                      >
                        Konto löschen
                      </button>

                    </div>
                  \`
                }
              </div>
            \`
          ).join("")}
        </div>

        <h3>Alle Server</h3>

        <div>
          \${serversData.servers.map(
            server => \`
              <div class="card">
                <strong>
                  \${escapeHtml(server.name)}
                </strong>

                <p class="muted">
                  Besitzer:
                  \${escapeHtml(server.ownerEmail)}
                </p>

                <p>
                  Status:
                  \${escapeHtml(server.status)}
                </p>

                <div class="actions">

                  <button
                    class="btn btn-danger"
                    onclick="adminDeleteServer('\${server.id}')"
                  >
                    Löschen
                  </button>

                  \${server.locked
                    ? \`
                      <button
                        class="btn btn-green"
                        onclick="adminUnlockServer('\${server.id}')"
                      >
                        Entsperren
                      </button>
                    \`
                    : \`
                      <button
                        class="btn btn-danger"
                        onclick="adminLockServer('\${server.id}')"
                      >
                        Sperren
                      </button>
                    \`
                  }

                </div>
              </div>
            \`
          ).join("")}
        </div>

      </div>
    \`;
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminShutdownAll() {
  try {
    await api(
      "/api/admin/servers/shutdown-all",
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Alle Server werden heruntergefahren."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminLockAll() {
  try {
    await api(
      "/api/admin/servers/lock-all",
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Alle Server gesperrt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminUnlockAll() {
  try {
    await api(
      "/api/admin/servers/unlock-all",
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Alle Server entsperrt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminMaintenance(
  enabled
) {
  try {
    await api(
      "/api/admin/maintenance",
      {
        method: "POST",
        body: JSON.stringify({
          enabled,
          message:
            "Florian / WeisserHai Minecraft Hosting befindet sich momentan im Wartungsmodus."
        })
      }
    );

    toast(
      enabled
        ? "Wartungsmodus aktiviert."
        : "Wartungsmodus deaktiviert."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function banUser(
  userId
) {
  const reason =
    prompt(
      "Grund für den Bann:"
    ) ||
    "Keine Angabe";

  try {
    await api(
      \`/api/admin/users/\${userId}/ban\`,
      {
        method: "POST",
        body: JSON.stringify({
          reason
        })
      }
    );

    await loadAdmin();

    toast(
      "Benutzer gebannt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function unbanUser(
  userId
) {
  try {
    await api(
      \`/api/admin/users/\${userId}/unban\`,
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Benutzer entbannt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function deleteUser(
  userId
) {
  if (
    !confirm(
      "Konto und alle zugehörigen Server wirklich löschen?"
    )
  ) {
    return;
  }

  try {
    await api(
      \`/api/admin/users/\${userId}\`,
      {
        method: "DELETE"
      }
    );

    await loadAdmin();

    toast(
      "Konto gelöscht."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminDeleteServer(
  serverId
) {
  if (
    !confirm(
      "Server wirklich endgültig löschen?"
    )
  ) {
    return;
  }

  try {
    await api(
      \`/api/admin/servers/\${serverId}\`,
      {
        method: "DELETE"
      }
    );

    await loadAdmin();
    await loadServers();

    toast(
      "Server gelöscht."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminLockServer(
  serverId
) {
  try {
    await api(
      \`/api/admin/servers/\${serverId}/lock\`,
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Server gesperrt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

async function adminUnlockServer(
  serverId
) {
  try {
    await api(
      \`/api/admin/servers/\${serverId}/unlock\`,
      {
        method: "POST"
      }
    );

    await loadAdmin();

    toast(
      "Server entsperrt."
    );
  } catch (error) {
    toast(
      error.message
    );
  }
}

/* =========================================================
   AUTOMATISCH EINLOGGEN
========================================================= */

async function checkSession() {
  try {
    const data =
      await api(
        "/api/auth/me"
      );

    if (
      data.loggedIn &&
      data.user
    ) {
      currentUser =
        data.user;

      await loadDashboard();
    }
  } catch (_) {}
}

checkSession();

setInterval(
  async () => {
    if (currentUser) {
      await loadServers();
    }
  },
  10000
);

</script>

</body>
</html>`;
}

/* =========================================================
   HTML ESCAPE SERVER
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   HTTP SERVER
========================================================= */

const server = http.createServer(
  app
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "======================================"
    );

    console.log(
      " Florian / WeisserHai Minecraft Hosting"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server läuft auf Port: ${PORT}`
    );

    console.log(
      `Owner: ${OWNER_EMAIL}`
    );

    console.log(
      `Node.js: ${process.version}`
    );

    console.log(
      "======================================"
    );
  }
);

/* =========================================================
   SAUBER HERUNTERFAHREN
========================================================= */

function shutdown() {
  console.log(
    "Server wird heruntergefahren..."
  );

  for (const serverData of servers) {
    if (
      isServerRunning(
        serverData.id
      )
    ) {
      stopMinecraftServer(
        serverData
      );
    }
  }

  server.close(
    () => {
      process.exit(0);
    }
  );

  setTimeout(
    () => process.exit(0),
    15000
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

process.on(
  "uncaughtException",
  error => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "UNHANDLED REJECTION:",
      error
    );
  }
);
