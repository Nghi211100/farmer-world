import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSET_MANIFEST,
  UI_COMING_TEXTURE_KEY,
  UI_BUILD_TURN_TEXTURE_KEY,
  UI_OBJECT_FEED_TEXTURE_KEY,
  UI_OBJECT_SELL_TEXTURE_KEY,
  UI_TEXT_BACKGROUND_TEXTURE_KEY,
} from '../../src/config/assets';
import { getAssetPathToUrlMap } from '../../src/utils/assetUrls';

function fileMd5(relativePath: string): string {
  const abs = join(__dirname, '../../src/assets', relativePath);
  return createHash('md5').update(readFileSync(abs)).digest('hex');
}

describe('asset manifest bundling', () => {
  it('includes ui/text-background.png in the Vite asset map', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/text-background.png')).toBeTruthy();
  });

  it('uses stable key for text background texture', () => {
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_TEXT_BACKGROUND_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/text-background.png');
  });

  it('includes ui/sell.png livestock sell icon', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/sell.png')).toBeTruthy();
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_OBJECT_SELL_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/sell.png');
  });

  it('registers sell texture with a key distinct from feed', () => {
    expect(UI_OBJECT_SELL_TEXTURE_KEY).not.toBe(UI_OBJECT_FEED_TEXTURE_KEY);
    const feed = ASSET_MANIFEST.find((e) => e.key === UI_OBJECT_FEED_TEXTURE_KEY);
    const sell = ASSET_MANIFEST.find((e) => e.key === UI_OBJECT_SELL_TEXTURE_KEY);
    expect(feed?.path).toBe('ui/feed.png');
    expect(sell?.path).toBe('ui/sell.png');
    expect(fileMd5('ui/sell.png')).not.toBe(fileMd5('ui/feed.png'));
  });

  it('includes ui/coming.png walk destination marker', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/coming.png')).toBeTruthy();
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_COMING_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/coming.png');
  });

  it('registers build decor path tiles for preload', () => {
    const map = getAssetPathToUrlMap();
    const expected = [
      ['path', 'tiles/path.png'],
      ['road_corner', 'tiles/road_corner.png'],
      ['bridge_tile', 'tiles/bridge_tile.png'],
      ['field_border', 'tiles/field_border.png'],
    ] as const;
    for (const [key, path] of expected) {
      const entry = ASSET_MANIFEST.find((e) => e.key === key);
      expect(entry?.path).toBe(path);
      expect(map.get(path)).toBeTruthy();
    }
  });

  it('registers build placement rotate icon', () => {
    const map = getAssetPathToUrlMap();
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_BUILD_TURN_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/turn.png');
    expect(map.get('ui/turn.png')).toBeTruthy();
  });

  it('registers water shore border tiles including bottom-right', () => {
    const map = getAssetPathToUrlMap();
    const expected = [
      ['water', 'tiles/water.png'],
      ['water_1_border_bottom-right', 'tiles/water_1_border_bottom-right.png'],
      ['water_1_border_bottom-left', 'tiles/water_1_border_bottom-left.png'],
      ['water_1_border_top-left', 'tiles/water_1_border_top-left.png'],
      ['water_1_border_top-right', 'tiles/water_1_border_top-right.png'],
    ] as const;
    for (const [key, path] of expected) {
      const entry = ASSET_MANIFEST.find((e) => e.key === key);
      expect(entry?.path).toBe(path);
      expect(map.get(path)).toBeTruthy();
    }
  });
});
