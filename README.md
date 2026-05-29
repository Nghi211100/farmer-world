# Farmer World

Isometric mobile farming game (Phaser 3 + Vite).

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Android live reload

See [DEV.md](./DEV.md) — `npm run dev -- --host` plus `npm run build:apk:live:install` for a debug APK that loads from your PC (`build:apk:standalone` for offline).

## Build

```bash
npm run build
```

## E2E tests (Bag / Shop modals)

Playwright drives the dev server and checks that Bag opens the **Warehouse** modal and Shop opens **Mua hạt giống**.

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Tests live in `tests/e2e/ui-modals.spec.ts`. In dev mode, `window.__FARMER_WORLD_TEST__` exposes helpers for modal state (used by Playwright because UI is canvas-based).

## Save data

See [SAVE.md](./SAVE.md).
