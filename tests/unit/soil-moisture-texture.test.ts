import { describe, expect, it } from 'vitest';
import {
  SOIL_MOISTURE,
  soilMoistureTextureKey,
} from '../../src/config/gameConfig';

describe('soilMoistureTextureKey', () => {
  it('uses empty_plot until the plot is tilled', () => {
    expect(soilMoistureTextureKey(0, false)).toBe('empty_plot');
    expect(soilMoistureTextureKey(100, false)).toBe('empty_plot');
  });

  it('maps low moisture to light soil, mid to mud, high to wet_soil', () => {
    expect(soilMoistureTextureKey(0, true)).toBe('soil');
    expect(soilMoistureTextureKey(SOIL_MOISTURE.dryMax, true)).toBe('soil');
    expect(soilMoistureTextureKey(SOIL_MOISTURE.mudMin, true)).toBe('mud');
    expect(soilMoistureTextureKey(SOIL_MOISTURE.mudMax, true)).toBe('mud');
    expect(soilMoistureTextureKey(SOIL_MOISTURE.wetMin, true)).toBe('wet_soil');
    expect(soilMoistureTextureKey(100, true)).toBe('wet_soil');
  });
});
