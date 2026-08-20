# Walnut & Brass — Offline Chess

A self-contained, two-player chess game for the browser. Full rules
(castling, en passant, promotion, check/checkmate/stalemate detection),
no build step, no server-side code, no external dependencies — and once
you've loaded it once, it keeps working with **no internet connection**.

## How the offline part works

- `service-worker.js` pre-caches every file the app needs (`index.html`,
  `style.css`, `app.js`, `chess-engine.js`, `manifest.json`, `icon.svg`)
  the first time you visit.
- On every later visit — even fully offline, even in airplane mode — the
  browser serves those files straight from its cache.
- `manifest.json` makes the page installable as an app icon on your phone
  or desktop (Chrome/Edge: the install icon in the address bar; Safari on
  iOS: Share → Add to Home Screen).

## Important: service workers need a real server, not `file://`

Opening `index.html` by double-clicking it won't register the service
worker (browsers block that on the `file://` protocol). Serve the folder
over `http://` or `https://` — locally or on the web.

### Run it locally (easiest)

With Python 3 installed, from inside this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Load it once while
online, then you can turn off Wi-Fi and reload the page — it'll still work.

Or with Node:

```bash
npx serve .
```

### Host it for free on the web

Any static host works — no backend needed:

- **GitHub Pages**: push this folder to a repo, enable Pages on the
  `main` branch.
- **Netlify / Vercel / Cloudflare Pages**: drag-and-drop the folder in
  their dashboard, or connect the repo.

Once deployed, visit the URL once with a connection so the service worker
installs, and it'll be available offline from then on for that device.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Walnut & felt tournament-table styling |
| `chess-engine.js` | Rules engine — move generation, legality, check/checkmate/stalemate, castling, en passant, promotion |
| `app.js` | Board rendering, click-to-move interaction, move list, captures, service worker registration |
| `service-worker.js` | Offline caching |
| `manifest.json` | PWA install metadata |
| `icon.svg` | App icon |

## Playing

Click a piece to see its legal moves highlighted, then click a destination
square. Promotions prompt you to choose a piece. Use **Undo**, **New
game**, and **Flip board** from the side panel. This is local two-player
(pass-and-play) — there's no AI opponent built in.
