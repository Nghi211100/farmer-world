# Save persistence (Farmer World)

## localStorage keys

| Key | Contents |
|-----|----------|
| `your-farm-save-v4` | Main game state: coins, gems, energy, warehouse, seeds, crops, buildings, land purchases, selected tool/seed |
| `your-farm-save-v4-grid` | Full tile grid (`TileCell[][]`) |

Older installs may still have `your-farm-save-v1` … `v3` (+ `-grid` suffix). `SaveSystem.load()` migrates these to v4 on first read.

## When the game saves

- **Debounced (2s)** after farming actions, building changes, land purchase, tool/seed selection, energy recovery
- **Immediately** on `pagehide`, `beforeunload`, tab hidden (`visibilitychange`), and `FarmScene` shutdown
- **UIScene** shop buy, sell, and inventory/warehouse changes emit `request-save` to FarmScene

## Manual test: plant survives reload

1. Run `npm run dev` and open the game.
2. Dig soil, plant a crop (any seed).
3. Reload the page within 1 second (before the 2s debounce) — crop should still be there (flush on unload).
4. Open DevTools → Application → Local Storage and confirm `your-farm-save-v4` and `your-farm-save-v4-grid` are populated.
5. Reload again — coins, energy, warehouse, crops, and map layout should match the previous session.

## Clear save (new game)

```js
localStorage.removeItem('your-farm-save-v4');
localStorage.removeItem('your-farm-save-v4-grid');
```

Then reload the page.
