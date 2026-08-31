const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.disable("x-powered-by");

// ============================================================
// STARTSEITE
// ============================================================

app.get("/", (req, res) => {
    res.status(200).send(`
<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <meta
        name="description"
        content="North Bot - Coming Soon"
    >

    <meta
        name="theme-color"
        content="#050505"
    >

    <title>North Bot | Coming Soon</title>

    <style>

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html,
        body {
            width: 100%;
            height: 100%;
        }

        body {

            min-height: 100vh;

            background:
                radial-gradient(
                    circle at 50% 40%,
                    rgba(255, 255, 255, 0.08),
                    transparent 35%
                ),
                #050505;

            color: #ffffff;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            display: flex;

            align-items: center;

            justify-content: center;

            overflow: hidden;

            position: relative;
        }

        body::before {

            content: "";

            position: fixed;

            width: 650px;
            height: 650px;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle,
                    rgba(255, 255, 255, 0.08),
                    transparent 68%
                );

            filter: blur(30px);

            animation:
                backgroundMove 8s ease-in-out infinite;

            pointer-events: none;
        }

        /* ====================================================
           PUNKTE
        ==================================================== */

        .dots {

            position: fixed;

            top: 25px;
            right: 30px;

            display: flex;

            gap: 7px;

            z-index: 10;
        }

        .dot {

            width: 6px;
            height: 6px;

            border-radius: 50%;

            background: #ffffff;

            opacity: 0.2;

            animation:
                dotAnimation 1.5s infinite;
        }

        .dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        /* ====================================================
           CONTAINER
        ==================================================== */

        .container {

            position: relative;

            z-index: 5;

            width: 90%;

            max-width: 1100px;

            text-align: center;

            padding: 30px;

            animation:
                fadeIn 1.5s ease forwards;
        }

        /* ====================================================
           NORTH BOT
        ==================================================== */

        .brand {

            margin-bottom: 45px;

            font-size: 18px;

            font-weight: 700;

            letter-spacing: 8px;

            text-transform: uppercase;

            color: #eeeeee;

            opacity: 0.85;
        }

        /* ====================================================
           COMING SOON
        ==================================================== */

        h1 {

            font-size:
                clamp(
                    48px,
                    10vw,
                    125px
                );

            line-height: 1;

            font-weight: 900;

            letter-spacing: 7px;

            text-transform: uppercase;

            background:
                linear-gradient(
                    90deg,
                    #ffffff,
                    #777777,
                    #ffffff,
                    #777777,
                    #ffffff
                );

            background-size: 300% auto;

            color: transparent;

            -webkit-background-clip: text;

            background-clip: text;

            animation:
                shine 5s linear infinite,
                floating 4s ease-in-out infinite;
        }

        /* ====================================================
           LINIE
        ==================================================== */

        .line {

            width: 80px;

            height: 3px;

            margin: 35px auto;

            border-radius: 50px;

            background: #ffffff;

            box-shadow:
                0 0 10px
                rgba(
                    255,
                    255,
                    255,
                    0.4
                );

            animation:
                lineAnimation 2s ease-in-out infinite;
        }

        /* ====================================================
           TEXT
        ==================================================== */

        .description {

            color: #888888;

            font-size: 17px;

            line-height: 1.8;

            letter-spacing: 2px;

            max-width: 700px;

            margin: 0 auto;
        }

        /* ====================================================
           DOMAIN
        ==================================================== */

        .domain {

            display: inline-block;

            margin-top: 25px;

            padding: 11px 20px;

            border: 1px solid
                rgba(
                    255,
                    255,
                    255,
                    0.12
                );

            border-radius: 12px;

            background:
                rgba(
                    255,
                    255,
                    255,
                    0.03
                );

            color: #999999;

            font-size: 13px;

            letter-spacing: 2px;

            backdrop-filter: blur(10px);
        }

        /* ====================================================
           DISCORD BUTTON
        ==================================================== */

        .discord-button {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            gap: 10px;

            margin-top: 35px;

            padding: 15px 30px;

            border-radius: 12px;

            border: 1px solid
                rgba(
                    255,
                    255,
                    255,
                    0.15
                );

            background:
                rgba(
                    255,
                    255,
                    255,
                    0.06
                );

            color: #ffffff;

            text-decoration: none;

            font-size: 15px;

            font-weight: 700;

            letter-spacing: 1px;

            transition:
                transform 0.25s ease,
                background 0.25s ease,
                box-shadow 0.25s ease;

            backdrop-filter: blur(10px);

            box-shadow:
                0 10px 30px
                rgba(
                    0,
                    0,
                    0,
                    0.3
                );
        }

        .discord-button:hover {

            transform:
                translateY(-4px)
                scale(1.02);

            background:
                rgba(
                    255,
                    255,
                    255,
                    0.12
                );

            box-shadow:
                0 15px 40px
                rgba(
                    0,
                    0,
                    0,
                    0.5
                );
        }

        .discord-button:active {

            transform:
                translateY(0)
                scale(0.98);
        }

        .discord-icon {

            font-size: 20px;

        }

        /* ====================================================
           FOOTER
        ==================================================== */

        .footer {

            position: fixed;

            left: 0;

            bottom: 25px;

            width: 100%;

            text-align: center;

            color: #444444;

            font-size: 12px;

            letter-spacing: 1px;

            z-index: 5;
        }

        /* ====================================================
           ANIMATIONEN
        ==================================================== */

        @keyframes fadeIn {

            from {
                opacity: 0;
                transform: translateY(30px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }

        }

        @keyframes shine {

            0% {
                background-position: 300% center;
            }

            100% {
                background-position: -300% center;
            }

        }

        @keyframes floating {

            0% {
                transform: translateY(0);
            }

            50% {
                transform: translateY(-8px);
            }

            100% {
                transform: translateY(0);
            }

        }

        @keyframes lineAnimation {

            0% {
                width: 70px;
                opacity: 0.4;
            }

            50% {
                width: 110px;
                opacity: 1;
            }

            100% {
                width: 70px;
                opacity: 0.4;
            }

        }

        @keyframes backgroundMove {

            0% {
                transform:
                    translate(
                        -100px,
                        -50px
                    );
            }

            50% {
                transform:
                    translate(
                        100px,
                        50px
                    );
            }

            100% {
                transform:
                    translate(
                        -100px,
                        -50px
                    );
            }

        }

        @keyframes dotAnimation {

            0% {
                opacity: 0.15;
            }

            50% {
                opacity: 0.9;
            }

            100% {
                opacity: 0.15;
            }

        }

        /* ====================================================
           MOBILE
        ==================================================== */

        @media (max-width: 600px) {

            .container {
                padding: 20px;
            }

            .brand {

                font-size: 12px;

                letter-spacing: 5px;

                margin-bottom: 35px;
            }

            h1 {

                font-size: 45px;

                letter-spacing: 3px;
            }

            .description {

                font-size: 14px;

                letter-spacing: 1px;
            }

            .domain {

                font-size: 11px;
            }

            .discord-button {

                padding:
                    14px 23px;

                font-size: 14px;
            }

            .footer {

                font-size: 10px;
            }

        }

        @media (max-width: 400px) {

            h1 {

                font-size: 38px;

            }

            .brand {

                font-size: 10px;

            }

        }

    </style>

</head>

<body>

    <!-- ======================================================
         ANIMIERTE PUNKTE
    ======================================================= -->

    <div class="dots">

        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>

    </div>


    <!-- ======================================================
         HAUPTINHALT
    ======================================================= -->

    <main class="container">

        <div class="brand">
            NORTH BOT
        </div>

        <h1>
            COMING SOON!
        </h1>

        <div class="line"></div>

        <p class="description">

            Unsere Webseite befindet sich aktuell im Aufbau.

            <br>

            Hier entsteht bald etwas Neues.

        </p>

        <div class="domain">
            North-Bot-2.de
        </div>

        <br>

        <!-- ==================================================
             DISCORD BUTTON
        =================================================== -->

        <a
            class="discord-button"
            href="https://discord.gg/NJEVq6Pk6x"
            target="_blank"
            rel="noopener noreferrer"
        >

            <span class="discord-icon">
                💬
            </span>

            Discord beitreten

        </a>

    </main>


    <!-- ======================================================
         FOOTER
    ======================================================= -->

    <footer class="footer">

        © 2026 North Bot · Alle Rechte vorbehalten

    </footer>


    <!-- ======================================================
         JAVASCRIPT
    ======================================================= -->

    <script>

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
            "🚀 Status: COMING SOON"
        );

        console.log(
            "🌐 Domain: North-Bot-2.de"
        );

        console.log(
            "💬 Discord: https://discord.gg/NJEVq6Pk6x"
        );

        console.log(
            "===================================="
        );

    </script>

</body>

</html>
    `);
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {

    res.status(200).json({
        status: "online",
        website: "North Bot",
        message: "Coming Soon"
    });

});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {

    res.status(404).send(`
<!DOCTYPE html>

<html lang="de">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>404 | North Bot</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {

            margin: 0;

            min-height: 100vh;

            background: #050505;

            color: #ffffff;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            display: flex;

            align-items: center;

            justify-content: center;

            text-align: center;
        }

        .error {

            padding: 30px;

        }

        h1 {

            font-size: 100px;

            margin: 0;

            font-weight: 900;

        }

        p {

            color: #777777;

            font-size: 18px;

        }

        a {

            display: inline-block;

            margin-top: 15px;

            padding: 12px 20px;

            color: #ffffff;

            text-decoration: none;

            border: 1px solid #333333;

            border-radius: 10px;

            transition: 0.2s;

        }

        a:hover {

            background: #ffffff;

            color: #000000;

        }

    </style>

</head>

<body>

    <div class="error">

        <h1>404</h1>

        <p>
            Diese Seite wurde nicht gefunden.
        </p>

        <a href="/">
            Zur Startseite
        </a>

    </div>

</body>

</html>
    `);

});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("====================================");
    console.log("             NORTH BOT");
    console.log("====================================");
    console.log(`🚀 Server läuft auf Port: ${PORT}`);
    console.log("📄 Status: COMING SOON");
    console.log("🌐 Domain: North-Bot-2.de");
    console.log("💬 Discord: https://discord.gg/NJEVq6Pk6x");
    console.log("====================================");
    console.log("");

});

// ============================================================
// FEHLERBEHANDLUNG
// ============================================================

process.on("uncaughtException", (error) => {

    console.error(
        "❌ Unerwarteter Fehler:",
        error
    );

});

process.on("unhandledRejection", (error) => {

    console.error(
        "❌ Unbehandelte Promise-Exception:",
        error
    );

});
