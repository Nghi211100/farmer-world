import { describe, expect, it } from 'vitest';
import {
  SHOP_MODAL_ASPECT_H,
  SHOP_MODAL_ASPECT_W,
  shopModalBounds,
} from '../../src/ui/modalPanelSize';

describe('shopModalBounds', () => {
  it('returns centered panel at 1399/782 aspect', () => {
    const b = shopModalBounds(1920, 1080);
    expect(b.panelW / b.panelH).toBeCloseTo(SHOP_MODAL_ASPECT_W / SHOP_MODAL_ASPECT_H, 4);
    expect(b.cx).toBe(960);
    expect(b.cy).toBe(540);
    expect(b.panelLeft).toBeCloseTo(b.cx - b.panelW / 2, 5);
    expect(b.panelTop).toBeCloseTo(b.cy - b.panelH / 2, 5);
    expect(b.panelLeft + b.panelW).toBeCloseTo(b.cx + b.panelW / 2, 5);
    expect(b.panelTop + b.panelH).toBeCloseTo(b.cy + b.panelH / 2, 5);
  });

  it('matches computeShopModalPanelSize dimensions', () => {
    const b = shopModalBounds(844, 390);
    expect(b.panelW).toBeLessThanOrEqual(844);
    expect(b.panelH).toBeLessThanOrEqual(390);
    expect(b.panelTop).toBeGreaterThanOrEqual(0);
    expect(b.panelLeft).toBeGreaterThanOrEqual(0);
  });
});
