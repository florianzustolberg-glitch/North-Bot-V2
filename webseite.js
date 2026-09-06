const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Webseite kommt bald</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    overflow: hidden;

    display: flex;
    justify-content: center;
    align-items: center;

    font-family: Arial, Helvetica, sans-serif;

    background:
        radial-gradient(circle at 20% 20%, #1b2b52 0%, transparent 35%),
        radial-gradient(circle at 80% 80%, #26134d 0%, transparent 35%),
        #05070d;

    color: white;
}

/* Hintergrund */

.background {
    position: fixed;
    inset: 0;
    overflow: hidden;
    z-index: 0;
}

.circle {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    opacity: 0.35;
    animation: float 10s infinite ease-in-out;
}

.circle.one {
    width: 300px;
    height: 300px;
    background: #5865f2;
    top: -100px;
    left: -100px;
}

.circle.two {
    width: 350px;
    height: 350px;
    background: #8b5cf6;
    right: -120px;
    bottom: -120px;
    animation-delay: -3s;
}

.circle.three {
    width: 200px;
    height: 200px;
    background: #00bfff;
    left: 50%;
    top: 50%;
    animation-delay: -6s;
}

@keyframes float {
    0%, 100% {
        transform: translate(0, 0) scale(1);
    }

    50% {
        transform: translate(40px, -30px) scale(1.15);
    }
}

/* Hauptbox */

.container {
    position: relative;
    z-index: 2;

    width: min(90%, 800px);

    padding: 60px 30px;

    text-align: center;

    background: rgba(10, 13, 22, 0.65);

    border: 1px solid rgba(255,255,255,0.12);

    border-radius: 30px;

    backdrop-filter: blur(20px);

    box-shadow:
        0 30px 100px rgba(0,0,0,0.5);

    animation: appear 1.5s ease forwards;
}

@keyframes appear {
    from {
        opacity: 0;
        transform: translateY(40px) scale(0.95);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Icon */

.icon {
    font-size: 70px;

    animation:
        bounce 3s infinite ease-in-out,
        glow 2s infinite alternate;
}

@keyframes bounce {
    0%, 100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-12px);
    }
}

@keyframes glow {
    from {
        filter: drop-shadow(0 0 5px #5865f2);
    }

    to {
        filter: drop-shadow(0 0 25px #8b5cf6);
    }
}

/* Überschrift */

h1 {
    margin: 20px 0 10px;

    font-size: clamp(35px, 7vw, 70px);

    font-weight: 900;

    background: linear-gradient(
        90deg,
        #ffffff,
        #8b9cff,
        #c084fc,
        #ffffff
    );

    background-size: 300%;

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    animation: gradient 5s infinite linear;
}

@keyframes gradient {
    0% {
        background-position: 0%;
    }

    50% {
        background-position: 100%;
    }

    100% {
        background-position: 0%;
    }
}

p {
    color: #b7bdce;

    font-size: 18px;

    line-height: 1.7;
}

/* Ladebalken */

.loader {
    width: min(500px, 90%);

    height: 8px;

    margin: 35px auto 0;

    overflow: hidden;

    background: rgba(255,255,255,0.08);

    border-radius: 20px;
}

.loader-bar {
    width: 0%;
    height: 100%;

    border-radius: 20px;

    background: linear-gradient(
        90deg,
        #5865f2,
        #8b5cf6,
        #00bfff
    );

    animation: loading 5s infinite;
}

@keyframes loading {
    0% {
        width: 0%;
    }

    70% {
        width: 85%;
    }

    100% {
        width: 100%;
    }
}

/* Musik */

.music-button {
    position: fixed;

    right: 25px;
    bottom: 25px;

    z-index: 10;

    width: 52px;
    height: 52px;

    border: 1px solid rgba(255,255,255,0.15);

    border-radius: 50%;

    background: rgba(20,23,35,0.8);

    color: white;

    cursor: pointer;

    font-size: 20px;

    transition: 0.3s;
}

.music-button:hover {
    transform: scale(1.1);

    background: rgba(88,101,242,0.8);
}

.footer {
    margin-top: 25px;

    color: #70788b;

    font-size: 13px;
}
</style>
</head>

<body>

<div class="background">
    <div class="circle one"></div>
    <div class="circle two"></div>
    <div class="circle three"></div>
</div>

<div class="container">

    <div class="icon">🚀</div>

    <h1>Die Webseite kommt bald!</h1>

    <p>
        Wir arbeiten gerade an etwas Neuem.
        <br>
        Schau bald wieder vorbei!
    </p>

    <div class="loader">
        <div class="loader-bar"></div>
    </div>

    <div class="footer">
        © ${new Date().getFullYear()} Florian / WeisserHai
    </div>

</div>

<button
    class="music-button"
    id="musicButton"
    onclick="openMusic()"
    title="Musik öffnen">
    🎵
</button>

<script>

function openMusic() {

    /*
     * Spotify darf nicht einfach automatisch
     * im Hintergrund abgespielt werden.
     *
     * Hier kannst du deine Spotify-Playlist einsetzen.
     */

    const spotifyUrl =
        "https://open.spotify.com/";

    window.open(
        spotifyUrl,
        "_blank",
        "noopener,noreferrer"
    );

    document.getElementById("musicButton").textContent = "🎶";
}

</script>

</body>
</html>
    `);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("================================");
    console.log("🚀 Webseite gestartet");
    console.log("🌐 Port: " + PORT);
    console.log("================================");
});
