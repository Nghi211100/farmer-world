import { describe, expect, it } from 'vitest';
import {
  ASSET_MANIFEST,
  UI_COMING_TEXTURE_KEY,
  UI_TEXT_BACKGROUND_TEXTURE_KEY,
} from '../../src/config/assets';
import { getAssetPathToUrlMap } from '../../src/utils/assetUrls';

describe('asset manifest bundling', () => {
  it('includes ui/text-background.png in the Vite asset map', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/text-background.png')).toBeTruthy();
  });

  it('uses stable key for text background texture', () => {
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_TEXT_BACKGROUND_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/text-background.png');
  });

  it('includes ui/coming.png walk destination marker', () => {
    const map = getAssetPathToUrlMap();
    expect(map.get('ui/coming.png')).toBeTruthy();
    const entry = ASSET_MANIFEST.find((e) => e.key === UI_COMING_TEXTURE_KEY);
    expect(entry?.path).toBe('ui/coming.png');
  });
});
