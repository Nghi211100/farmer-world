import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

/** Lock to landscape on native; no-op in browser dev. */
export async function lockLandscapeOrientation(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    // Plugin may be unavailable on some WebViews; manifest + MainActivity still apply.
  }
}
