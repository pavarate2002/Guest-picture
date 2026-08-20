# 🖼️ Guess the Picture — Host & Player Edition

A real-time, multiplayer "guess the picture" game with a glowing LED/neon theme.
One person is the **Host** (controls the game), and everyone else joins as a
**Player** on their own device — no names required.

## 🎮 How it works

1. **Landing page** (`index.html`) — choose your role:
   - **🔐 I'm the Host** → prompts for the host password: **`pqc`**
   - **🙋 Join as Player** → goes straight into the game, no name needed
2. **Host Dashboard** (`host.html`):
   - Upload pictures for all **8 questions**, each with an optional question/text prompt
   - **▶ Start Game** — begins Question 1 for everyone
   - **⏸ Stop Timer / ▶ Resume Timer** — pause the tile countdown (e.g. while someone is answering)
   - **⏭ Next Question** — advances to the next question
   - **🔄 Reset Game** — restart progress (optionally clear all uploaded pictures)
3. **Player page** (`user.html`):
   - Shows a 4×4 tile board over the current picture, each tile marked "?"
   - One tile automatically opens **every 5 seconds** (a live countdown is shown)
   - Players also have their own **⏭ Next Question** button — either the Host
     or any Player can advance the game
   - Waits on a "waiting for host" screen until the Host presses Start

All Host and Player pages stay in sync automatically (polling the server once
per second), so this works great across multiple devices/phones in the same
room or remotely.

## 🚀 Run locally
```bash
node server.js
```
Then open `http://localhost:3000` in your browser. No `npm install` needed —
the server only uses Node's built-in modules (zero dependencies).

## 🌐 Deploy on Render.com (Web Service)
This app needs a **running server** (not just static files), so deploy it as
a **Web Service**, not a Static Site:

1. Push this project to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Web Service**.
3. Connect your GitHub repository.
4. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install` (there's nothing to install, but Render requires a value)
   - **Start Command**: `node server.js`
5. Click **Create Web Service** — Render will give you a public URL like
   `https://guess-picture-game.onrender.com`.
6. Share that URL with players — they click **Join as Player**. You (the
   host) go to the same URL and click **I'm the Host**, entering `pqc`.

> 💡 Render's free tier spins the service down after inactivity, so the first
> request after idling may take ~30 seconds to wake up.

## 🛠️ Customize
- **Host password**: change `HOST_PASSWORD` in `server.js`.
- **Number of questions**: change `TOTAL_QUESTIONS` in `server.js`.
- **Grid size / tiles**: change `TOTAL_TILES` in `server.js` (must be a perfect
  square, e.g. 9, 16, 25) and update `grid-template-columns` /
  `grid-template-rows` in `public/styles.css` to match (e.g. `repeat(5, 1fr)`
  for a 5×5 board).
- **Reveal speed**: change `SECONDS_PER_TILE` in `server.js`.
- **Colors/Theme**: adjust the neon glow colors in `public/styles.css`
  (`#00e5ff`, `#ff2e93`, `#39ff14`, `#ffb400`).

## 📁 Project structure
```
guess-picture-game/
├── server.js          # Node http server + game state + REST API (no deps)
├── package.json
├── public/
│   ├── index.html     # Landing page — role selection (Host / Player)
│   ├── host.html       # Host dashboard — upload & control the game
│   ├── user.html       # Player page — view & guess the picture
│   └── styles.css      # Shared LED/neon theme
└── README.md
```

## ⚠️ Notes
- Game state is stored **in memory** on the server — if the server restarts,
  the current game (uploaded pictures, progress) is lost. For a single quiz
  session this is fine; just don't restart the server mid-game.
- There's only **one shared game session** at a time (by design, for a single
  live event/room). It is not multi-room.
- Keep uploaded images reasonably sized (a few hundred KB to ~2MB each) for
  best performance, since they are sent as base64 data.
