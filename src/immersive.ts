import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { measureSafeAreaInsets, setHudSafeAreaInsets } from './safeArea';

/** Hide status bar and extend WebView edge-to-edge; navigation bar handled in MainActivity. */
export async function enableImmersiveFullscreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }
    await StatusBar.hide();
  } catch {
    // StatusBar plugin may be unavailable; MainActivity still applies immersive flags.
  }

  refreshHudSafeAreaInsets();
}

/** Re-measure notch / gesture insets after layout or orientation changes. */
export function refreshHudSafeAreaInsets(): void {
  if (!Capacitor.isNativePlatform()) {
    setHudSafeAreaInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    return;
  }
  setHudSafeAreaInsets(measureSafeAreaInsets());
}
