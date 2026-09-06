const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const MUSIC_DIR = path.join(__dirname, "music");

if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

app.use("/music", express.static(MUSIC_DIR));

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1.0,
               maximum-scale=1.0, user-scalable=no">

<title>Webseite kommt bald</title>

<style>
* {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
}

html,
body {
    width: 100%;
    min-height: 100%;
    margin: 0;
}

body {
    min-height: 100vh;
    min-height: 100dvh;

    display: flex;
    align-items: center;
    justify-content: center;

    overflow: hidden;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at 15% 20%,
            rgba(88, 101, 242, .35),
            transparent 35%
        ),
        radial-gradient(
            circle at 85% 80%,
            rgba(139, 92, 246, .35),
            transparent 35%
        ),
        #05070d;
}

/* Hintergrund */

.background {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
}

.glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    opacity: .35;
    animation: floating 9s ease-in-out infinite;
}

.glow1 {
    width: 280px;
    height: 280px;
    left: -100px;
    top: -80px;
    background: #5865f2;
}

.glow2 {
    width: 320px;
    height: 320px;
    right: -120px;
    bottom: -100px;
    background: #8b5cf6;
    animation-delay: -3s;
}

.glow3 {
    width: 180px;
    height: 180px;
    left: 50%;
    top: 50%;
    background: #00bfff;
    animation-delay: -6s;
}

@keyframes floating {
    0%,
    100% {
        transform: translate(0, 0) scale(1);
    }

    50% {
        transform: translate(35px, -25px) scale(1.15);
    }
}

/* Hauptbox */

.container {
    position: relative;
    z-index: 2;

    width: calc(100% - 32px);
    max-width: 850px;

    padding: 55px 30px;

    text-align: center;

    border: 1px solid rgba(255,255,255,.13);
    border-radius: 28px;

    background: rgba(10,13,22,.70);

    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);

    box-shadow:
        0 30px 100px rgba(0,0,0,.55);

    animation: appear 1.2s ease;
}

@keyframes appear {
    from {
        opacity: 0;
        transform:
            translateY(35px)
            scale(.94);
    }

    to {
        opacity: 1;
        transform:
            translateY(0)
            scale(1);
    }
}

/* Icon */

.icon {
    font-size: clamp(48px, 12vw, 82px);

    animation:
        rocket 3s ease-in-out infinite,
        glowIcon 2s ease-in-out infinite alternate;
}

@keyframes rocket {
    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-12px);
    }
}

@keyframes glowIcon {
    from {
        filter:
            drop-shadow(
                0 0 5px
                rgba(88,101,242,.5)
            );
    }

    to {
        filter:
            drop-shadow(
                0 0 25px
                rgba(139,92,246,.9)
            );
    }
}

/* Überschrift */

h1 {
    margin: 20px 0 12px;

    font-size:
        clamp(32px, 7vw, 70px);

    line-height: 1.05;

    font-weight: 900;

    background:
        linear-gradient(
            90deg,
            #fff,
            #8b9cff,
            #c084fc,
            #fff
        );

    background-size: 300%;

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    animation:
        gradientMove 5s linear infinite;
}

@keyframes gradientMove {
    0% {
        background-position: 0%;
    }

    100% {
        background-position: 300%;
    }
}

.description {
    margin: 0 auto;

    max-width: 650px;

    color: #aeb6c9;

    font-size:
        clamp(15px, 3vw, 19px);

    line-height: 1.7;
}

/* Ladebalken */

.loader {
    width: 100%;
    max-width: 520px;

    height: 8px;

    margin: 35px auto 0;

    overflow: hidden;

    border-radius: 50px;

    background: rgba(255,255,255,.08);
}

.loaderBar {
    width: 0%;
    height: 100%;

    border-radius: 50px;

    background:
        linear-gradient(
            90deg,
            #5865f2,
            #8b5cf6,
            #00bfff
        );

    animation:
        loading 5s ease-in-out infinite;
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

.musicPanel {
    position: fixed;

    right: 18px;
    bottom: 18px;

    z-index: 10;

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 10px 12px;

    border:
        1px solid
        rgba(255,255,255,.13);

    border-radius: 16px;

    background:
        rgba(15,18,28,.85);

    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
}

.musicButton {
    width: 48px;
    height: 48px;

    border: 0;
    border-radius: 50%;

    background: #5865f2;

    color: white;

    font-size: 20px;

    cursor: pointer;

    transition:
        transform .2s ease,
        background .2s ease;
}

.musicButton:hover {
    transform: scale(1.08);
    background: #6975ff;
}

.musicButton:active {
    transform: scale(.94);
}

.volume {
    width: 80px;
    accent-color: #5865f2;
}

.musicText {
    display: none;

    color: #aeb6c9;

    font-size: 12px;
}

/* Handy */

@media (max-width: 600px) {

    .container {
        width: calc(100% - 24px);
        padding: 42px 18px;
        border-radius: 22px;
    }

    h1 {
        margin-top: 16px;
    }

    .description {
        font-size: 15px;
    }

    .loader {
        margin-top: 28px;
    }

    .musicPanel {
        right: 12px;
        bottom: 12px;
    }

    .volume {
        width: 65px;
    }
}

/* Sehr kleine Handys */

@media (max-height: 650px) {

    .container {
        padding: 28px 18px;
    }

    .icon {
        font-size: 48px;
    }

    h1 {
        font-size: 34px;
        margin: 12px 0 8px;
    }

    .loader {
        margin-top: 20px;
    }
}
</style>
</head>

<body>

<div class="background">
    <div class="glow glow1"></div>
    <div class="glow glow2"></div>
    <div class="glow glow3"></div>
</div>

<div class="container">

    <div class="icon">
        🚀
    </div>

    <h1>
        Die Webseite kommt bald!
    </h1>

    <p class="description">
        Wir arbeiten gerade an etwas Neuem.
        <br>
        Schau bald wieder vorbei!
    </p>

    <div class="loader">
        <div class="loaderBar"></div>
    </div>

</div>

<div class="musicPanel">

    <button
        id="musicButton"
        class="musicButton"
        onclick="toggleMusic()"
        aria-label="Musik starten">
        ▶️
    </button>

    <input
        id="volume"
        class="volume"
        type="range"
        min="0"
        max="0.25"
        step="0.01"
        value="0.08"
        aria-label="Lautstärke">

</div>

<audio id="audio" preload="auto"></audio>

<script>

const audio =
    document.getElementById("audio");

const button =
    document.getElementById("musicButton");

const volume =
    document.getElementById("volume");

/*
 * Die Musikdateien kommen aus:
 *
 * /music/
 *
 * Beispiel:
 *
 * music/lied1.mp3
 * music/lied2.mp3
 * music/lied3.mp3
 *
 * Neue MP3-Dateien werden automatisch
 * in die zufällige Auswahl aufgenommen.
 */

const musicFiles = [
    ${JSON.stringify(
        fs.readdirSync(MUSIC_DIR)
            .filter(file =>
                /\\.(mp3|wav|ogg|m4a)$/i.test(file)
            )
            .map(file =>
                "/music/" +
                encodeURIComponent(file)
            )
    ).slice(1, -1)}
];

let currentSong = -1;
let playing = false;

audio.volume =
    Number(volume.value);

/* Zufälliges Lied */

function randomSong() {

    if (musicFiles.length === 0) {
        return null;
    }

    if (musicFiles.length === 1) {
        currentSong = 0;
        return musicFiles[0];
    }

    let next;

    do {
        next =
            Math.floor(
                Math.random() *
                musicFiles.length
            );
    }
    while (
        next === currentSong
    );

    currentSong = next;

    return musicFiles[next];
}

/* Musik starten */

async function startMusic() {

    if (musicFiles.length === 0) {

        alert(
            "Lege MP3-Dateien in den Ordner 'music'."
        );

        return;
    }

    const song =
        randomSong();

    if (!song) {
        return;
    }

    audio.src = song;

    audio.volume =
        Number(volume.value);

    try {

        await audio.play();

        playing = true;

        button.textContent = "⏸️";

    } catch (error) {

        console.log(
            "Musik konnte nicht gestartet werden:",
            error
        );

        playing = false;

        button.textContent = "▶️";
    }
}

/* Pause / Start */

async function toggleMusic() {

    if (!playing) {

        await startMusic();

        return;
    }

    audio.pause();

    playing = false;

    button.textContent = "▶️";
}

/* Wenn Lied fertig ist:
   automatisch anderes zufälliges Lied */

audio.addEventListener(
    "ended",
    () => {

        playing = false;

        button.textContent = "▶️";

        startMusic();
    }
);

/* Lautstärke */

volume.addEventListener(
    "input",
    () => {

        audio.volume =
            Number(volume.value);
    }
);

/*
 * Auf Handys verhindert der Browser
 * automatische Audio-Wiedergabe.
 *
 * Deshalb starten wir Musik erst,
 * wenn der Benutzer auf den Button tippt.
 */

</script>

</body>
</html>
    `);
});

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("======================================");
    console.log("🚀 Florian / WeisserHai Webseite");
    console.log("======================================");
    console.log("🌐 Port: " + PORT);
    console.log("🎵 Musikordner: " + MUSIC_DIR);
    console.log("📱 Mobile optimiert");
    console.log("======================================");
    console.log("");

});
