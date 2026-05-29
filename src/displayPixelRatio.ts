/** Cap DPR for mobile GPU/memory; 2× is enough for crisp pixel art. */
export const MAX_DISPLAY_PIXEL_RATIO = 2;

export function getDisplayPixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_DISPLAY_PIXEL_RATIO);
}

/** @deprecated Hi-DPI uses Scale.RESIZE; kept for tests/tools that still reference it. */
export function getPhysicalGameSize(): {
  width: number;
  height: number;
  logicalWidth: number;
  logicalHeight: number;
  pixelRatio: number;
} {
  const pixelRatio = getDisplayPixelRatio();
  const { width: logicalWidth, height: logicalHeight } = getLogicalViewportSize();
  return {
    logicalWidth,
    logicalHeight,
    pixelRatio,
    width: Math.round(logicalWidth * pixelRatio),
    height: Math.round(logicalHeight * pixelRatio),
  };
}

/** @deprecated Use Scale.RESIZE instead of manual zoom. */
export function getScaleZoomForPixelRatio(pixelRatio: number): number {
  return pixelRatio > 0 ? 1 / pixelRatio : 1;
}

/** CSS layout viewport — prefer #game-container so canvas matches the visible play area. */
export function getLogicalViewportSize(): { width: number; height: number } {
  if (typeof document !== 'undefined') {
    const container = document.getElementById('game-container');
    const rect = container?.getBoundingClientRect();
    if (rect && rect.width >= 1 && rect.height >= 1) {
      return {
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(240, Math.floor(rect.height)),
      };
    }
  }
  const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
  const width = Math.max(320, Math.floor(vv?.width ?? window.innerWidth));
  const height = Math.max(240, Math.floor(vv?.height ?? window.innerHeight));
  return { width, height };
}
