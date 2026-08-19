# 🖼️ Guess the Picture

A simple, browser-based "guess the picture" game with a glowing LED/neon theme. Upload any image, and it gets hidden behind a 4×4 grid of tiles. Click tiles to reveal parts of the picture and try to guess it before it's fully uncovered!

## 🎮 Features
- Upload any image directly from your device (no backend required)
- 4×4 tile grid — click to reveal one tile at a time
- **Reset** button to hide all tiles again (same image)
- **Reveal All** button to instantly show the full picture
- Neon / LED-style visual theme with glowing text and buttons

## 🚀 Run Locally
Just open `index.html` in any modern browser (Chrome, Edge, Firefox). No build steps, no dependencies, no server needed.

## 🌐 Deploy on Render.com (Static Site)
1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Static Site**.
3. Connect your GitHub repository.
4. Leave **Build Command** empty.
5. Set **Publish Directory** to `.` (root).
6. Click **Deploy** — you'll get a public URL to share with friends/colleagues.

## 🛠️ Customize
- **Grid size**: Change `TOTAL_TILES` in the `<script>` section and the matching `grid-template-columns` / `grid-template-rows` values in the `<style>` section (they must always match, e.g. 5×5 → `TOTAL_TILES = 25` and `repeat(5, 1fr)`).
- **Colors/Theme**: Adjust the neon glow colors in the CSS (`#00e5ff`, `#ff2e93`, `#39ff14`) to match your own theme.
- **Fonts**: Uses Google Fonts `Orbitron` (headers/tiles) and `Kanit` (body/buttons).

## 📄 License
Free to use and modify for personal or internal team use.
