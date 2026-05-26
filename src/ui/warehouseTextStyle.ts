import Phaser from 'phaser';

/** Dark brown outline on light/white fills (baked WAREHOUSE title on `ui/warehouse.png`). */
export const WAREHOUSE_TITLE_STROKE_DARK = '#3d2817';
/** White outline on dark brown fills (slot qty, cream footer labels). */
export const WAREHOUSE_TITLE_STROKE_LIGHT = '#ffffff';
/** @deprecated Use WAREHOUSE_TITLE_STROKE_DARK — kept for DOM qty input stroke */
export const WAREHOUSE_TITLE_STROKE = WAREHOUSE_TITLE_STROKE_DARK;

/** No webfont preload — Arial Black / Impact approximate the baked title weight. */
export const WAREHOUSE_TITLE_FONT = '"Arial Black", "Arial Rounded MT Bold", Arial, Impact, sans-serif';

export type WarehouseTextVariant = 'light' | 'dark' | 'small';

const WAREHOUSE_FILL_LIGHT = '#fff8e1';
const WAREHOUSE_FILL_DARK = '#3e2723';
const WAREHOUSE_FILL_SMALL = '#5d4037';
const WAREHOUSE_SHADOW = '#2a1a0e';

export interface WarehouseTextStyleOpts {
  /** Text fill color — stroke is chosen from luminance (light fill → dark stroke). */
  color?: string;
  fontSize?: string | number;
  bold?: boolean;
  align?: string;
  wordWrap?: Phaser.Types.GameObjects.Text.TextWordWrap;
  shadow?: boolean;
}

function parseFontSizePx(fontSize: string | number | undefined): number {
  if (fontSize === undefined) return 14;
  if (typeof fontSize === 'number') return fontSize;
  const parsed = Number.parseInt(fontSize, 10);
  return Number.isFinite(parsed) ? parsed : 14;
}

function parseHexRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim().toLowerCase().replace(/^#/, '');
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

/** Light fills (white/cream/gold) → dark stroke; dark browns → white stroke. */
export function warehouseStrokeForColor(color: string): string {
  const rgb = parseHexRgb(color);
  if (!rgb) return WAREHOUSE_TITLE_STROKE_DARK;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance >= 0.55 ? WAREHOUSE_TITLE_STROKE_DARK : WAREHOUSE_TITLE_STROKE_LIGHT;
}

function variantForColor(color: string): WarehouseTextVariant {
  const normalized = color.trim().toLowerCase();
  if (normalized === WAREHOUSE_FILL_SMALL) return 'small';
  const rgb = parseHexRgb(color);
  if (!rgb) return 'dark';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance >= 0.55 ? 'light' : 'dark';
}

/** Scale stroke to font size — thicker on large labels, tighter on small slot names. */
export function warehouseStrokeThickness(fontSizePx: number, variant: WarehouseTextVariant): number {
  const tier = variant === 'small' || fontSizePx <= 11 ? 'small' : fontSizePx <= 16 ? 'medium' : 'large';
  if (tier === 'small') return Math.max(2, Math.round(fontSizePx * 0.22));
  if (tier === 'medium') return Math.max(3, Math.round(fontSizePx * 0.28));
  return Math.max(4, Math.min(6, Math.round(fontSizePx * 0.32)));
}

/**
 * Warehouse UI text: bold rounded sans, contrasting stroke, optional shadow on light fills.
 *
 * Stroke rules:
 * - Light/white fills (`#fff`, `#fff8e1`, …) → `#3d2817` stroke (thickness 3–4+ by size)
 * - Dark fills (`#3e2723`, `#5d4037`, …) → `#ffffff` stroke
 */
export function warehouseTextStyle(
  opts: WarehouseTextStyleOpts = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  const color = opts.color ?? WAREHOUSE_FILL_DARK;
  const fontSize = opts.fontSize ?? '14px';
  const fontSizePx = parseFontSizePx(fontSize);
  const variant = variantForColor(color);
  const stroke = warehouseStrokeForColor(color);
  const shadowOffset = fontSizePx <= 11 ? 1 : 2;
  const useShadow = opts.shadow !== false && variant === 'light';

  return {
    fontFamily: WAREHOUSE_TITLE_FONT,
    fontStyle: opts.bold === false ? 'normal' : 'bold',
    fontSize,
    color,
    stroke,
    strokeThickness: warehouseStrokeThickness(fontSizePx, variant),
    align: opts.align,
    wordWrap: opts.wordWrap,
    shadow: useShadow
      ? {
          offsetX: shadowOffset,
          offsetY: shadowOffset,
          color: WAREHOUSE_SHADOW,
          blur: 0,
          stroke: false,
          fill: true,
        }
      : undefined,
  };
}

/** Re-apply stroke after dynamic font-size changes (e.g. sell qty field). */
export function applyWarehouseTitleLikeSizing(
  text: Phaser.GameObjects.Text,
  variant: WarehouseTextVariant,
  fontSizePx: number
): void {
  const fill =
    variant === 'light'
      ? WAREHOUSE_FILL_LIGHT
      : variant === 'small'
        ? WAREHOUSE_FILL_SMALL
        : WAREHOUSE_FILL_DARK;
  text.setFontSize(`${fontSizePx}px`);
  text.setStroke(
    warehouseStrokeForColor(fill),
    warehouseStrokeThickness(fontSizePx, variant)
  );
}

/**
 * Preset variants for InventoryPanel (map to fill + stroke pairs above).
 *
 * - `light` — cream/white on dark pills/buttons
 * - `dark` — dark brown on cream footer/slots
 * - `small` — `#5d4037` slot names with white stroke
 */
export function warehouseTitleLikeTextStyle(
  variant: WarehouseTextVariant,
  overrides: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  const fill =
    variant === 'light'
      ? WAREHOUSE_FILL_LIGHT
      : variant === 'small'
        ? WAREHOUSE_FILL_SMALL
        : WAREHOUSE_FILL_DARK;
  const {
    fontSize,
    color: overrideColor,
    stroke: _stroke,
    strokeThickness: _strokeThickness,
    shadow: overrideShadow,
    fontFamily: _fontFamily,
    fontStyle: _fontStyle,
    ...rest
  } = overrides;

  const colorStr = typeof overrideColor === 'string' ? overrideColor : fill;

  const base = warehouseTextStyle({
    color: colorStr,
    fontSize: fontSize ?? (variant === 'small' ? '10px' : '14px'),
    bold: _fontStyle !== 'normal',
    align: rest.align,
    wordWrap: rest.wordWrap,
    shadow: overrideShadow === undefined ? variant === 'light' : Boolean(overrideShadow),
  });

  return { ...base, ...rest, color: colorStr, fontSize: fontSize ?? base.fontSize };
}
