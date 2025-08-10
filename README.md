# Super Dino Run

An enhanced, colorful version of the classic Google Dino game with multiple difficulties, day/night cycle, avatar selection, mouse/touch controls, and mobile responsiveness.

## Live (GitHub Pages)
Project site: `https://meghashyam12.github.io/dino/`

If assets 404 on GitHub Pages, ensure asset paths in `index.html` are relative (no leading slash) and deploy to the `gh-pages` branch or via Project Pages settings.

## Features
- Multiple avatars and difficulty levels (Easy, Medium, Hard)
- Day/night cycle with sun, moon, and clouds
- Parallax ground for a sense of motion
- Expanded obstacle set (cacti, pterodactyls including low flyers, tumbleweed, boulder, firepit, spikes, overhead bar)
- Double jump, duck, and smooth controls (jump buffering, coyote time)
- Per-difficulty high scores (saved in localStorage)
- Mobile support with touch gestures and on-screen Jump/Duck buttons

## Controls
- Keyboard: Space/Up/W = Jump, Down/S = Duck, Double Space = Double Jump, P = Pause, R = Restart
- Mouse: Left Click = Jump, Right Click (hold) = Duck, Double Click = Double Jump
- Touch: Tap = Jump, Double Tap = Double Jump, Hold/Swipe Down = Duck, Swipe Up = Jump

## Local Development
No build step required.

1. Serve the static files (choose one):
   - Python 3: `python3 -m http.server 8080`
   - Node (http-server): `npx http-server -p 8080`
   - VS Code Live Server or any static server
2. Open `http://localhost:8080` in your browser.

Note: For local testing under a subpath, open `index.html` via a server (not file://) and keep asset paths relative.

## Structure
- `index.html` – Start screen, canvas, overlays, and mobile controls
- `style.css` – Styling, layout, and responsive rules
- `script.js` – Game logic, rendering, controls, and mobile detection

## High Score Storage
High scores are stored per difficulty under keys `sdr_high_score_easy`, `sdr_high_score_medium`, and `sdr_high_score_hard` in localStorage.

## License
MIT
