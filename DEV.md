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

## Farm camera pan bounds vs debug overlays

### What you can drag (pan limits)

Camera drag/zoom clamp uses **`getFarmCameraScrollBounds()`** in `FarmScene` (passed to `computeFarmCameraScrollLimits` / `clampMainCameraScroll`):

| Source | World rect | When |
|--------|------------|------|
| **Pan bounds** | `computeFarmIslandScreenBounds(soil rhombus, island.png size, scale boost)` | After `farm_island` image is laid out (normal play) |
| **Pan bounds (fallback)** | `GridSystem.getFarmFootprintScreenBounds()` | Before island layout / no image |
| **Not used for pan** | `getMapScreenBounds()` | Full 20×20 logical map — larger than pan bounds; includes outer grass/water |
| **Not used for pan** | `getFarmFootprintScreenBounds()` alone | Soil + path **tile** ring — smaller than island art; only matches pan bounds when island is absent |

Scroll math (`farmCameraScroll.ts`): keep the pan-bounds AABB inside the HUD **playable band** (`computePlayableFarmViewportLayout`). When island×zoom is wider/taller than the band, `oversize` is true and scroll is clamped between `minScroll` / `maxScroll` on that axis.

Optional camera HUD text: `?debugCamera=1` (scroll/zoom lines, screen-fixed).

### Farm debug grid (`?debugGrid=1` or `?debug=1`)

All **world-space** layers use `scrollFactor(1)` and move with the camera. **Screen-fixed** HUD guides do not.

| Overlay | Color | Space | Meaning |
|---------|-------|-------|---------|
| **map 20×20** | Blue grid + thick border + dashed edge + corner ticks | World | `GridSystem.getMapScreenBounds()` — every logical cell; label `WORLD ENDS` on outer edge |
| **pan bounds** | Orange grid + thick border | World | `getFarmCameraScrollBounds()` — **camera scroll clamp** (island.png AABB when loaded) |
| **footprint** | Cyan outline only | World | `getFarmFootprintScreenBounds()` — tile soil + path ring inside the island |
| **background-only (4th zone)** | Screen-fixed hint (bottom-right) | Screen | Viewport shows world outside map and/or outside pan — `ui_background` only (`scrollFactor` 0); **no tile grid** |
| **viewport / playable HUD** | Blue / yellow outlines | Screen-fixed | Device viewport and HUD clamp band — **not** pan bounds; no tile grid |
| **Iso diamonds** | Green / faint blue | World | Per-cell iso outlines on the full map |

Redrawn on resize (`handleResize`) and whenever the world is repositioned (`repositionWorld` → `syncFarmDebugOverlays`). The background-only HUD hint updates every frame while `?debugGrid=1`.

Example: `http://localhost:5173/?debugGrid=1`

**Seeing the pan grid:** drag until the island reaches the HUD playable edge; orange **pan bounds** lines extend with the island AABB (wider than the cyan footprint).

### Vùng thứ 4 (không có lưới) — `?debugGrid=1`

Khi **đảo đã load**, pan bounds (cam đảo, ~2229×2229) **bao trọn** map logic 20×20 (~1280×640). Kéo tới mép pan → góc viewport có thể thấy **mây/trời** ngoài viền cam/vàng: đó là **vùng ngoài pan bounds**, đồng thời **ngoài map** — không phải ô cỏ/nước, không có lưới xanh. Chỉ còn `ui_background` (cố định màn hình).

| Vùng | Có lưới? | Ý nghĩa |
|------|----------|---------|
| **4a** — trong map, ngoài pan | Lưới xanh (nếu nhìn thấy map) | Chỉ khi pan bounds **nhỏ hơn** map (fallback footprint trước khi có đảo) |
| **4b** — ngoài map | Không | **Background-only** — thế giới game kết thúc ở viền xanh `WORLD ENDS` |

Pan tới mép → nhãn HUD góc dưới phải: `background-only zone visible (outside map + outside pan bounds)`.

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
