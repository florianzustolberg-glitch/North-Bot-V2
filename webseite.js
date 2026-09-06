const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

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
            height: 100%;
        }

        body {
            min-height: 100vh;
            min-height: 100dvh;

            overflow: hidden;

            display: flex;
            align-items: center;
            justify-content: center;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            color: #ffffff;

            background:
                radial-gradient(
                    circle at 50% 35%,
                    rgba(45, 120, 55, 0.22),
                    transparent 45%
                ),
                linear-gradient(
                    180deg,
                    #02050a 0%,
                    #071209 55%,
                    #020602 100%
                );
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

            top: 9%;
            right: 10%;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle at 35% 30%,
                    #ffffff,
                    #d8d8d8 55%,
                    #898989 100%
                );

            box-shadow:
                0 0 30px rgba(255,255,255,.25),
                0 0 90px rgba(255,255,255,.08);

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
           WOLKEN
        ========================================= */

        .cloud {
            position: fixed;

            height: 18px;

            background:
                rgba(255,255,255,.045);

            z-index: 1;

            pointer-events: none;

            animation:
                cloudMove linear infinite;
        }

        .cloud::before,
        .cloud::after {
            content: "";

            position: absolute;

            background:
                rgba(255,255,255,.045);
        }

        .cloud::before {
            width: 35px;
            height: 22px;

            left: 18px;
            bottom: 0;
        }

        .cloud::after {
            width: 50px;
            height: 28px;

            left: 55px;
            bottom: 0;
        }

        .cloud1 {
            width: 120px;

            top: 20%;
            left: -160px;

            animation-duration: 45s;
        }

        .cloud2 {
            width: 150px;

            top: 34%;
            left: -220px;

            animation-duration: 65s;
            animation-delay: -20s;
        }

        @keyframes cloudMove {
            from {
                transform: translateX(0);
            }

            to {
                transform:
                    translateX(
                        calc(100vw + 450px)
                    );
            }
        }

        /* =========================================
           GRÜNER HINTERGRUND-GLOW
        ========================================= */

        .greenGlow {
            position: fixed;

            width: 500px;
            height: 500px;

            left: 50%;
            top: 50%;

            transform:
                translate(-50%, -50%);

            background:
                radial-gradient(
                    circle,
                    rgba(46,204,64,.14),
                    transparent 70%
                );

            filter: blur(30px);

            z-index: 1;

            pointer-events: none;

            animation:
                glowPulse 5s ease-in-out infinite;
        }

        @keyframes glowPulse {
            0%,
            100% {
                opacity: .5;

                transform:
                    translate(-50%, -50%)
                    scale(1);
            }

            50% {
                opacity: 1;

                transform:
                    translate(-50%, -50%)
                    scale(1.2);
            }
        }

        /* =========================================
           PARTIKEL
        ========================================= */

        #particles {
            position: fixed;

            inset: 0;

            z-index: 2;

            pointer-events: none;
        }

        .particle {
            position: absolute;

            width: 4px;
            height: 4px;

            background: #58c957;

            box-shadow:
                0 0 8px
                rgba(88,201,87,.8);

            animation:
                particleMove linear infinite;
        }

        @keyframes particleMove {
            from {
                transform:
                    translateY(105vh)
                    translateX(0);

                opacity: 0;
            }

            15% {
                opacity: .8;
            }

            85% {
                opacity: .8;
            }

            to {
                transform:
                    translateY(-20vh)
                    translateX(80px);

                opacity: 0;
            }
        }

        /* =========================================
           HAUPTBOX
        ========================================= */

        .container {
            position: relative;

            z-index: 5;

            width:
                min(
                    calc(100% - 30px),
                    850px
                );

            padding:
                55px 35px;

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

            -webkit-backdrop-filter:
                blur(12px);

            animation:
                containerAppear 1.2s ease forwards;
        }

        @keyframes containerAppear {
            from {
                opacity: 0;

                transform:
                    translateY(35px)
                    scale(.92);
            }

            to {
                opacity: 1;

                transform:
                    translateY(0)
                    scale(1);
            }
        }

        /* =========================================
           MINECRAFT BLOCK
        ========================================= */

        .minecraftIcon {
            display: inline-flex;

            align-items: center;
            justify-content: center;

            width: 100px;
            height: 100px;

            margin-bottom: 20px;

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

            image-rendering: pixelated;

            animation:
                iconFloat 3s ease-in-out infinite;
        }

        .minecraftIcon span {
            font-size: 48px;

            filter:
                drop-shadow(
                    3px 3px 0
                    rgba(0,0,0,.5)
                );
        }

        @keyframes iconFloat {
            0%,
            100% {
                transform:
                    translateY(0)
                    rotate(0deg);
            }

            50% {
                transform:
                    translateY(-10px)
                    rotate(2deg);
            }
        }

        /* =========================================
           TITEL
        ========================================= */

        h1 {
            font-size:
                clamp(
                    32px,
                    7vw,
                    68px
                );

            line-height: 1.05;

            font-weight: 900;

            letter-spacing: -2px;

            color: #ffffff;

            text-shadow:
                4px 4px 0 #183b1b,
                0 0 25px
                rgba(76,220,82,.25);

            animation:
                titleGlow 3s ease-in-out infinite;
        }

        @keyframes titleGlow {
            0%,
            100% {
                text-shadow:
                    4px 4px 0 #183b1b,
                    0 0 20px
                    rgba(76,220,82,.15);
            }

            50% {
                text-shadow:
                    4px 4px 0 #183b1b,
                    0 0 35px
                    rgba(76,220,82,.35);
            }
        }

        /* =========================================
           BESCHREIBUNG
        ========================================= */

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
           LOADER
        ========================================= */

        .loader {
            width: 100%;

            max-width: 550px;

            height: 22px;

            margin:
                35px auto 0;

            padding: 3px;

            background: #101510;

            border:
                2px solid
                #263a27;

            box-shadow:
                inset 0 3px 5px
                rgba(0,0,0,.6);
        }

        .loaderBar {
            width: 0%;
            height: 100%;

            background:
                repeating-linear-gradient(
                    90deg,
                    #55c64b 0px,
                    #55c64b 16px,
                    #42a83c 16px,
                    #42a83c 32px
                );

            box-shadow:
                0 0 12px
                rgba(70,200,70,.3);

            animation:
                loading 5s
                ease-in-out infinite;
        }

        @keyframes loading {
            0% {
                width: 0%;
            }

            70% {
                width: 82%;
            }

            100% {
                width: 100%;
            }
        }

        /* =========================================
           MOBILE
        ========================================= */

        @media (max-width: 600px) {

            body {
                padding: 12px;
            }

            .container {
                width: 100%;

                padding:
                    38px 18px;

                border-radius: 6px;
            }

            .minecraftIcon {
                width: 78px;
                height: 78px;

                border-width: 4px;
            }

            .minecraftIcon span {
                font-size: 38px;
            }

            h1 {
                letter-spacing: -1px;
            }

            .description {
                margin-top: 16px;

                font-size: 15px;
            }

            .loader {
                margin-top: 25px;

                height: 18px;
            }

            .moon {
                width: 55px;
                height: 55px;

                top: 5%;
                right: 7%;
            }
        }

        /* =========================================
           KLEINE HANDYS
        ========================================= */

        @media (max-height: 650px) {

            .container {
                padding:
                    25px 16px;
            }

            .minecraftIcon {
                width: 65px;
                height: 65px;

                margin-bottom: 10px;
            }

            .minecraftIcon span {
                font-size: 30px;
            }

            h1 {
                font-size: 32px;
            }

            .description {
                margin-top: 10px;
            }

            .loader {
                margin-top: 18px;
            }
        }
    </style>
</head>

<body>

    <canvas id="stars"></canvas>

    <div class="moon"></div>

    <div class="cloud cloud1"></div>
    <div class="cloud cloud2"></div>

    <div class="greenGlow"></div>

    <div id="particles"></div>

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

        <div class="loader">
            <div class="loaderBar"></div>
        </div>

    </main>

    <script>

        /* =========================================
           ANIMIERTE STERNE
        ========================================= */

        const canvas =
            document.getElementById("stars");

        const ctx =
            canvas.getContext("2d");

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
                        (width * height) / 7500
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
           GRÜNE PARTIKEL
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
                Math.random() * 100 + "%";

            particle.style.animationDuration =
                (
                    Math.random() * 12 + 8
                ) + "s";

            particle.style.animationDelay =
                -(
                    Math.random() * 15
                ) + "s";

            particle.style.opacity =
                Math.random() * .7;

            particleContainer.appendChild(
                particle
            );
        }

    </script>

</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log("⛏️ Minecraft Webseite gestartet");
    console.log("🌐 Port: " + PORT);
    console.log("⭐ Animierte Sterne: AKTIV");
    console.log("✨ Partikel: AKTIV");
    console.log("🌙 Mond: AKTIV");
    console.log("☁️ Wolken: AKTIV");
    console.log("🎵 Musik: DEAKTIVIERT");
    console.log("📱 Mobile: AKTIV");
    console.log("======================================");
});
