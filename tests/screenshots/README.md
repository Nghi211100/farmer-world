# Farm layout verification screenshots

## `farm-layout-verify.png`

Captured with:

```bash
node scripts/capture-farm-layout.mjs
```

Requires dev server at `http://127.0.0.1:5173`. Opens `/?debugGrid=1` at 390×844, waits until:

- `soilFootprintAlignError` ≤ 2
- `mapTopErrorY` ≤ 4 px

Metrics are also written to `farm-layout-metrics.json`.

**Note:** Headless Chromium may show a blank canvas while metrics are still valid; verify in a real browser with `/?debugGrid=1` if the PNG looks empty.

**2026-06-02 fix:** After final `syncFarmMapTopCameraScroll`, call `repositionWorld({ relayoutIsland: false })` so ground sprites follow `mapTopPanOffsetY` without shifting island pan bounds. `syncFarmMapTopCameraScroll` re-reads `mapMinY` each scroll iteration.
