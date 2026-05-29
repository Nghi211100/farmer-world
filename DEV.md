# Android live reload (dev)

Load the game from the Vite dev server on your PC instead of bundled `dist/` assets.

## One-time setup

```bash
npm install
```

## Every dev session

**Terminal 1** — Vite (must listen on LAN):

```bash
npm run dev -- --host
```

**Terminal 2** — live debug APK (only when Capacitor URL or native project changed):

```bash
npm run build:apk:live:install
```

Or step by step:

```bash
npm run build:apk:live
npm run install:apk:live
```

Phone and PC on the **same Wi‑Fi**. `npm run cap:live-url` writes `.capacitor-live-url` (default `http://<wi-fi-ip>:5173`), preferring the **Wi‑Fi** adapter and skipping VMware (`192.168.174.x`, `192.168.232.x`) and other virtual NICs.

### Override server URL

```bash
set CAP_SERVER_URL=http://10.255.152.130:5173
npm run build:apk:live:install
```

(PowerShell: `$env:CAP_SERVER_URL="http://10.255.152.130:5173"` — or edit `.capacitor-live-url` and run `npx cap sync android`)

### Wi‑Fi blocks device → PC

USB debugging + port reverse:

```bash
adb reverse tcp:5173 tcp:5173
```

Then set `CAP_SERVER_URL=http://127.0.0.1:5173` and rebuild/install the live APK.

### Specific device

```bash
set ADB_DEVICE=AXUG024C25000818
npm run install:apk:live
```

## Offline / store-style APK

Bundles `dist/` into the APK (no dev server):

```bash
npm run build:apk:standalone
npm run install:apk:live
```

Clears `.capacitor-live-url` automatically.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev -- --host` | Vite on `0.0.0.0:5173` |
| `npm run cap:live-url` | Write `.capacitor-live-url` only |
| `npm run cap:clear-live-url` | Remove live URL (standalone) |
| `npm run build:apk:live` | Live URL + `cap sync` + debug APK |
| `npm run build:apk:live:install` | Above + `adb install -r` |
| `npm run build:apk:standalone` | Bundle assets, no dev server |
| `npm run install:apk:live` | Install `app-debug.apk` |

## Shop modal debug grid

Use query flags to draw shop modal overlays on `shopModalContainer`:

- `?shopGrid=1` (full layout grid + zone grids + per-tab cell grid + per-product slot grid)
- `?shopTabGrid=1` (per-tab cell grid only)
- `?shopProductGrid=1` (per-product slot grid only, 4×2 visible viewport cells)
- `?shopMask=1` (product-list scroll geometry mask: row-2 clip band)
- `?shopZoneGrid=1` (zone grids only: tab + product)
- `?debugShopGrid=1` (legacy alias)

Example: `http://localhost:5173/?shopGrid=1`
Tab-only example: `http://localhost:5173/?shopTabGrid=1`
Product-only example: `http://localhost:5173/?shopProductGrid=1`
Mask-only example: `http://localhost:5173/?shopMask=1`
Zone-only example: `http://localhost:5173/?shopZoneGrid=1`

The overlay is non-interactive, uses `scrollFactor(0)`, and is hidden when the shop modal is closed. It redraws on resize/layout.
Tab-cell overlay also redraws while tab list scrolls.

Drawn elements:

- Full modal panel border (`panelW` × `panelH`)
- 12 vertical lines at column boundaries 0–11 across the full panel (stronger at cols 2|3 and 9|10 for tabs|grid|detail)
- Column numbers 1–11 at the top; zone labels `tabs` / `grid` / `detail` at the bottom
- Light horizontal guides at grid and detail top/bottom
- Tab zone grid (blue): label `TAB ZONE c1-2`
- Product zone grid (green): label `PRODUCT ZONE c3-9`
- Per-tab cell grid (cyan): one rectangle for each tab item (`1. All` .. `6. Resources`), clipped to viewport while scrolling
- Per-product slot grid (orange): one rectangle for each visible product slot (`r1c1` .. `r2c4`) in the 4×2 viewport
- Product scroll mask (cyan): semi-transparent fill + stroke for `scrollMaskGraphics` fillRect (full grid viewport; pad is content-only)

E2e can toggle at runtime via `window.__FARMER_WORLD_TEST__?.setShopDebugGrid(true)`.
