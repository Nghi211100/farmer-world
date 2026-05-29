/**
 * World-space background display size for FarmScene.
 *
 * Screen width in world units at min zoom: viewportW / minCameraZoom.
 * When that span exceeds camera-bounds width, a centered image must be wider than
 * the viewport alone: W >= 2 * screenWorldW - boundsWorldW (panning edge case).
 */
export function computeBackgroundDisplaySize(options: {
  viewportW: number;
  viewportH: number;
  minCameraZoom: number;
  boundsWorldW: number;
  boundsWorldH: number;
  texW: number;
  texH: number;
}): { displayW: number; displayH: number } {
  const {
    viewportW,
    viewportH,
    minCameraZoom,
    boundsWorldW,
    boundsWorldH,
    texW,
    texH,
  } = options;

  const screenWorldW = viewportW / minCameraZoom;
  const screenWorldH = viewportH / minCameraZoom;

  const targetW = Math.max(boundsWorldW, screenWorldW, 2 * screenWorldW - boundsWorldW);
  const targetH = Math.max(boundsWorldH, screenWorldH, 2 * screenWorldH - boundsWorldH);

  if (texW <= 0 || texH <= 0) {
    return { displayW: targetW, displayH: targetH };
  }

  const aspect = texW / texH;

  const fitScale = Math.min(targetW / texW, targetH / texH);
  let displayW = texW * fitScale;
  let displayH = texH * fitScale;

  displayW = Math.max(displayW, screenWorldW);
  displayH = displayW / aspect;

  if (displayH < targetH) {
    displayH = targetH;
    displayW = Math.max(displayW, displayH * aspect);
  }

  displayW = Math.max(displayW, targetW);
  displayH = Math.max(displayH, displayW / aspect);

  return {
    displayW: Math.ceil(displayW),
    displayH: Math.ceil(displayH),
  };
}

/** Extra logical px so pixel-art rounding / camera zoom never exposes letterbox color. */
export const VIEWPORT_COVER_BLEED_PX = 2;

/**
 * Display size that cover-fills targetW × targetH (max of width/height scale, may exceed on one axis).
 */
export function computeCoverDisplaySize(
  texW: number,
  texH: number,
  targetW: number,
  targetH: number,
  bleedPx = VIEWPORT_COVER_BLEED_PX
): { displayW: number; displayH: number } {
  const w = Math.max(1, targetW);
  const h = Math.max(1, targetH);
  const bleed = Math.max(0, bleedPx);
  if (texW <= 0 || texH <= 0) {
    return { displayW: Math.ceil(w + bleed * 2), displayH: Math.ceil(h + bleed * 2) };
  }
  const coverScale = Math.max((w + bleed * 2) / texW, (h + bleed * 2) / texH);
  return {
    displayW: Math.ceil(texW * coverScale),
    displayH: Math.ceil(texH * coverScale),
  };
}

/**
 * Cover-fit a screen-fixed Image to the viewport (no setCrop — avoids contain-style gaps).
 * Caller should use origin 0.5 and position at viewport center (scrollFactor 0).
 */
export function applyViewportCoverBackground(
  image: Phaser.GameObjects.Image,
  targetW: number,
  targetH: number,
  bleedPx = VIEWPORT_COVER_BLEED_PX
): void {
  if (typeof image.setCrop === 'function') {
    image.setCrop();
  }
  const texW = image.frame.cutWidth || image.frame.width;
  const texH = image.frame.cutHeight || image.frame.height;
  const { displayW, displayH } = computeCoverDisplaySize(texW, texH, targetW, targetH, bleedPx);
  image.setDisplaySize(displayW, displayH);
}

/** @deprecated Use {@link applyViewportCoverBackground} for scrollFactor-0 viewport fills. */
export function applyBackgroundWorldCover(
  image: Phaser.GameObjects.Image,
  displayW: number,
  displayH: number
): void {
  applyViewportCoverBackground(image, displayW, displayH);
}
