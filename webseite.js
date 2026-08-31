const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

app.disable("x-powered-by");

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
        content="North Bot – Coming Soon"
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
            background: #050505;
            color: #ffffff;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            display: flex;
            align-items: center;
            justify-content: center;

            overflow: hidden;
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

            filter: blur(25px);

            animation: backgroundMove 8s ease-in-out infinite;

            pointer-events: none;
        }

        .dots {
            position: fixed;

            top: 25px;
            right: 30px;

            display: flex;
            gap: 7px;
        }

        .dot {
            width: 6px;
            height: 6px;

            border-radius: 50%;

            background: #ffffff;

            opacity: 0.2;

            animation: dotAnimation 1.5s infinite;
        }

        .dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        .container {
            position: relative;
            z-index: 2;

            width: 90%;
            max-width: 1100px;

            text-align: center;

            animation: fadeIn 1.5s ease;
        }

        .brand {
            margin-bottom: 45px;

            font-size: 18px;
            font-weight: 700;

            letter-spacing: 8px;

            text-transform: uppercase;

            color: #eeeeee;

            opacity: 0.85;
        }

        h1 {
            font-size: clamp(
                48px,
                10vw,
                125px
            );

            line-height: 1;

            font-weight: 900;

            letter-spacing: 7px;

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

        .line {
            width: 80px;
            height: 3px;

            margin: 35px auto;

            border-radius: 50px;

            background: #ffffff;

            animation: lineAnimation 2s ease-in-out infinite;
        }

        .description {
            color: #888888;

            font-size: 17px;

            line-height: 1.8;

            letter-spacing: 2px;
        }

        .domain {
            display: inline-block;

            margin-top: 35px;

            padding: 12px 22px;

            border: 1px solid rgba(
                255,
                255,
                255,
                0.12
            );

            border-radius: 12px;

            background: rgba(
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

        .footer {
            position: fixed;

            left: 0;
            bottom: 25px;

            width: 100%;

            text-align: center;

            color: #444444;

            font-size: 12px;

            letter-spacing: 1px;
        }

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
                transform: translate(-100px, -50px);
            }

            50% {
                transform: translate(100px, 50px);
            }

            100% {
                transform: translate(-100px, -50px);
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

        @media (max-width: 600px) {
            .brand {
                font-size: 12px;
                letter-spacing: 5px;
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
        }
    </style>
</head>

<body>

    <div class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </div>

    <main class="container">

        <div class="brand">
            NORTH BOT
        </div>

        <h1>
            COMING SOON!
        </h1>

        <div class="line"></div>

        <div class="description">
            Unsere Webseite befindet sich aktuell im Aufbau.
            <br>
            Hier entsteht bald etwas Neues.
        </div>

        <div class="domain">
            North-Bot-2.de
        </div>

    </main>

    <footer class="footer">
        © 2026 North Bot · Alle Rechte vorbehalten
    </footer>

</body>
</html>
    `);
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        website: "North Bot",
        domain: "North-Bot-2.de"
    });
});

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>404 | North Bot</title>

            <style>
                body {
                    margin: 0;
                    min-height: 100vh;
                    background: #050505;
                    color: white;
                    font-family: Arial, sans-serif;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    text-align: center;
                }

                h1 {
                    font-size: 90px;
                    margin: 0;
                }

                p {
                    color: #777;
                }

                a {
                    color: white;
                    text-decoration: none;

                    display: inline-block;

                    margin-top: 15px;

                    padding: 12px 20px;

                    border: 1px solid #333;
                    border-radius: 10px;
                }

                a:hover {
                    background: white;
                    color: black;
                }
            </style>
        </head>

        <body>
            <div>
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

app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("       🌐 NORTH BOT WEBSEITE");
    console.log("=================================");
    console.log(`🚀 Port: ${PORT}`);
    console.log("📄 Status: COMING SOON");
    console.log("🌐 Domain: North-Bot-2.de");
    console.log("=================================");
});
