/** CSS env(safe-area-inset-*) in logical px (notch / gesture areas when bars are hidden). */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

let hudInsets: SafeAreaInsets = { ...ZERO };

/** HUD layout reads these after immersive mode is applied on native. */
export function getHudSafeAreaInsets(): SafeAreaInsets {
  return hudInsets;
}

export function setHudSafeAreaInsets(insets: SafeAreaInsets): void {
  hudInsets = { ...insets };
}

/** Measure env(safe-area-inset-*) from the layout engine (requires viewport-fit=cover). */
export function measureSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === 'undefined' || !document.body) return { ...ZERO };

  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top)',
    'padding-right:env(safe-area-inset-right)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:env(safe-area-inset-left)',
  ].join(';');
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  document.body.removeChild(probe);
  return insets;
}
