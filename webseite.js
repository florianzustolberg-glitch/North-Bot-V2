const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/*
====================================================
 MINECRAFT HOSTING – COMING SOON
 + ANIMIERTER HINTERGRUND
 + STERNE
 + MINECRAFT DESIGN
 + CHAT FÜR ALLE BESUCHER
====================================================
*/

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
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

/* =========================================
   GRUNDLAYOUT
========================================= */

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html,
body {
    width: 100%;
    min-height: 100%;
}

body {
    min-height: 100vh;
    min-height: 100dvh;

    overflow: hidden;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: white;

    background:
        radial-gradient(
            circle at 50% 35%,
            rgba(40, 130, 50, 0.22),
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

    top: 8%;
    right: 9%;

    border-radius: 50%;

    background:
        radial-gradient(
            circle at 35% 30%,
            #ffffff,
            #dddddd 55%,
            #888888 100%
        );

    box-shadow:
        0 0 30px rgba(255,255,255,.3),
        0 0 80px rgba(255,255,255,.08);

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
   GRÜNER GLOW
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
            rgba(50,200,60,.14),
            transparent 70%
        );

    filter: blur(35px);

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

    background: #55c64b;

    box-shadow:
        0 0 8px
        rgba(85,198,75,.8);

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

    margin:
        20px auto;

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
        containerAppear 1.2s ease;
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

    text-shadow:

        4px 4px 0
        #183b1b,

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
   TEXT
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
   CHAT BUTTON
========================================= */

.chatButton {

    position: fixed;

    right: 22px;
    bottom: 22px;

    z-index: 100;

    width: 62px;
    height: 62px;

    border: 3px solid #183b1b;

    border-radius: 8px;

    background:
        linear-gradient(
            135deg,
            #55b947,
            #26772c
        );

    color: white;

    font-size: 27px;

    cursor: pointer;

    box-shadow:
        0 8px 25px
        rgba(0,0,0,.55);

    transition:
        transform .2s ease,
        filter .2s ease;
}

.chatButton:hover {

    transform:
        scale(1.08);

    filter:
        brightness(1.15);
}

.chatButton:active {

    transform:
        scale(.95);
}

/* =========================================
   CHAT FENSTER
========================================= */

.chat {

    position: fixed;

    right: 22px;
    bottom: 96px;

    z-index: 99;

    width:
        min(
            calc(100% - 30px),
            380px
        );

    height: 500px;

    display: none;

    flex-direction: column;

    overflow: hidden;

    border:
        3px solid
        rgba(82,180,74,.45);

    border-radius: 10px;

    background:
        rgba(5,12,7,.97);

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.75);

    backdrop-filter:
        blur(15px);

    animation:
        chatOpen .25s ease;
}

.chat.active {

    display: flex;
}

@keyframes chatOpen {

    from {
        opacity: 0;

        transform:
            translateY(20px)
            scale(.95);
    }

    to {
        opacity: 1;

        transform:
            translateY(0)
            scale(1);
    }
}

/* =========================================
   CHAT HEADER
========================================= */

.chatHeader {

    min-height: 60px;

    display: flex;

    align-items: center;
    justify-content: space-between;

    padding:
        0 15px;

    background:
        linear-gradient(
            90deg,
            #1d5c25,
            #2f8735
        );

    border-bottom:
        2px solid
        rgba(255,255,255,.08);
}

.chatTitle {

    font-size: 18px;

    font-weight: 800;
}

.chatStatus {

    color: #b9ffae;

    font-size: 12px;
}

.closeChat {

    border: 0;

    background: transparent;

    color: white;

    font-size: 24px;

    cursor: pointer;
}

/* =========================================
   NACHRICHTEN
========================================= */

.messages {

    flex: 1;

    overflow-y: auto;

    padding: 14px;

    display: flex;

    flex-direction: column;

    gap: 9px;

    scrollbar-width: thin;

    scrollbar-color:
        #397f39
        transparent;
}

.message {

    max-width: 88%;

    padding:
        9px 11px;

    border-radius: 6px;

    background:
        rgba(255,255,255,.06);

    border-left:
        3px solid
        #4fae47;

    word-wrap: break-word;

    animation:
        messageIn .2s ease;
}

@keyframes messageIn {

    from {
        opacity: 0;
        transform: translateY(5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.messageName {

    color: #73d96b;

    font-size: 12px;

    font-weight: bold;

    margin-bottom: 3px;
}

.messageText {

    color: #eeeeee;

    font-size: 14px;

    line-height: 1.4;
}

.systemMessage {

    text-align: center;

    color: #788578;

    font-size: 12px;

    padding: 5px;
}

/* =========================================
   CHAT EINGABE
========================================= */

.chatInputArea {

    display: flex;

    gap: 7px;

    padding: 10px;

    border-top:
        2px solid
        rgba(255,255,255,.08);

    background:
        rgba(0,0,0,.25);
}

.chatInput {

    flex: 1;

    min-width: 0;

    height: 44px;

    padding:
        0 12px;

    border:
        1px solid
        rgba(255,255,255,.15);

    border-radius: 5px;

    outline: none;

    background:
        #111a12;

    color: white;

    font-size: 14px;
}

.chatInput:focus {

    border-color:
        #55b947;

    box-shadow:
        0 0 10px
        rgba(85,185,71,.15);
}

.sendButton {

    width: 48px;

    border: 0;

    border-radius: 5px;

    background:
        #3d8f38;

    color: white;

    font-size: 19px;

    cursor: pointer;
}

.sendButton:hover {

    background:
        #51aa4a;
}

/* =========================================
   MOBILE
========================================= */

@media (max-width: 600px) {

    body {
        padding: 10px;
    }

    .container {

        width: 100%;

        padding:
            38px 18px;

        margin: 10px auto;
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

    .chat {

        right: 10px;
        bottom: 85px;

        width:
            calc(100% - 20px);

        height:
            min(
                70vh,
                500px
            );
    }

    .chatButton {

        right: 12px;
        bottom: 12px;
    }
}

/* =========================================
   SEHR KLEINE HANDYS
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

    .chat {
        height: 65vh;
    }
}

</style>

</head>

<body>

<!-- STERNE -->

<canvas id="stars"></canvas>

<!-- MOND -->

<div class="moon"></div>

<!-- GLOW -->

<div class="greenGlow"></div>

<!-- PARTIKEL -->

<div id="particles"></div>


<!-- HAUPTBOX -->

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


<!-- CHAT BUTTON -->

<button
    class="chatButton"
    id="chatButton"
    onclick="toggleChat()"
    aria-label="Chat öffnen"
>
    💬
</button>


<!-- CHAT -->

<section
    class="chat"
    id="chat"
>

    <header class="chatHeader">

        <div>

            <div class="chatTitle">
                💬 Community Chat
            </div>

            <div class="chatStatus">
                ● Online
            </div>

        </div>

        <button
            class="closeChat"
            onclick="toggleChat()"
        >
            ×
        </button>

    </header>


    <div
        class="messages"
        id="messages"
    >

        <div class="systemMessage">
            Willkommen im Community-Chat! 👋
        </div>

    </div>


    <form
        class="chatInputArea"
        id="chatForm"
    >

        <input
            id="chatInput"
            class="chatInput"
            type="text"
            maxlength="300"
            placeholder="Nachricht schreiben..."
            autocomplete="off"
        >

        <button
            class="sendButton"
            type="submit"
        >
            ➤
        </button>

    </form>

</section>


<script src="/socket.io/socket.io.js"></script>

<script>

/* =========================================
   CHAT
========================================= */

const socket =
    io();

const chat =
    document.getElementById(
        "chat"
    );

const chatButton =
    document.getElementById(
        "chatButton"
    );

const messages =
    document.getElementById(
        "messages"
    );

const chatInput =
    document.getElementById(
        "chatInput"
    );

const chatForm =
    document.getElementById(
        "chatForm"
    );


/*
   Zufälliger Besuchername
*/

const names = [
    "Steve",
    "Alex",
    "Creeper",
    "Builder",
    "Miner",
    "Player",
    "Explorer"
];

let username =
    localStorage.getItem(
        "minecraftChatName"
    );

if (!username) {

    const randomName =
        names[
            Math.floor(
                Math.random() *
                names.length
            )
        ];

    username =
        randomName +
        "_" +
        Math.floor(
            Math.random() * 9999
        );

    localStorage.setItem(
        "minecraftChatName",
        username
    );
}


/*
   Chat öffnen
*/

function toggleChat() {

    chat.classList.toggle(
        "active"
    );

    if (
        chat.classList.contains(
            "active"
        )
    ) {

        setTimeout(
            () => {
                chatInput.focus();
            },
            100
        );
    }
}


/*
   Nachricht senden
*/

chatForm.addEventListener(
    "submit",
    function(event) {

        event.preventDefault();

        const text =
            chatInput.value.trim();

        if (!text) {
            return;
        }

        socket.emit(
            "chatMessage",
            {
                name: username,
                text: text
            }
        );

        chatInput.value = "";

        chatInput.focus();
    }
);


/*
   Nachricht empfangen
*/

socket.on(
    "chatMessage",
    function(message) {

        addMessage(
            message.name,
            message.text
        );
    }
);


/*
   Nachricht anzeigen
*/

function addMessage(
    name,
    text
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message";


    const nameElement =
        document.createElement(
            "div"
        );

    nameElement.className =
        "messageName";

    nameElement.textContent =
        name;


    const textElement =
        document.createElement(
            "div"
        );

    textElement.className =
        "messageText";

    textElement.textContent =
        text;


    wrapper.appendChild(
        nameElement
    );

    wrapper.appendChild(
        textElement
    );

    messages.appendChild(
        wrapper
    );


    messages.scrollTop =
        messages.scrollHeight;
}


/* =========================================
   STERNE
========================================= */

const canvas =
    document.getElementById(
        "stars"
    );

const ctx =
    canvas.getContext(
        "2d"
    );

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
                (width * height) /
                7500
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
   PARTIKEL
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

    particleContainer.appendChild(
        particle
    );
}

</script>

</body>

</html>
    `);
});


/* =========================================
   CHAT SERVER
========================================= */

io.on(
    "connection",
    (socket) => {

        console.log(
            "💬 Besucher verbunden:",
            socket.id
        );


        socket.on(
            "chatMessage",
            (data) => {

                if (!data) {
                    return;
                }

                let name =
                    String(
                        data.name || "Player"
                    )
                    .trim()
                    .slice(0, 24);

                let text =
                    String(
                        data.text || ""
                    )
                    .trim()
                    .slice(0, 300);

                if (!text) {
                    return;
                }

                if (!name) {
                    name = "Player";
                }

                /*
                 * Nachricht an alle
                 */

                io.emit(
                    "chatMessage",
                    {
                        name: name,
                        text: text
                    }
                );

                console.log(
                    "💬 " +
                    name +
                    ": " +
                    text
                );
            }
        );


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "👋 Besucher getrennt:",
                    socket.id
                );
            }
        );

    }
);


/* =========================================
   SERVER START
========================================= */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "⛏️ Minecraft Hosting Webseite"
        );
        console.log(
            "======================================"
        );
        console.log(
            "🌐 Port: " + PORT
        );
        console.log(
            "⭐ Sterne: AKTIV"
        );
        console.log(
            "✨ Partikel: AKTIV"
        );
        console.log(
            "🌙 Mond: AKTIV"
        );
        console.log(
            "💬 Community Chat: AKTIV"
        );
        console.log(
            "📱 Mobile: AKTIV"
        );
        console.log(
            "======================================"
        );
        console.log("");

    }
);
