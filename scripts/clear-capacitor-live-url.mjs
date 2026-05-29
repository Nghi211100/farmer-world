/**
 * Removes live-reload marker so the next cap sync builds a standalone WebView app.
 */
import { unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const markerPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.capacitor-live-url');

if (existsSync(markerPath)) {
  unlinkSync(markerPath);
  console.log('Removed .capacitor-live-url (standalone / bundled WebView).');
} else {
  console.log('No .capacitor-live-url — already standalone mode.');
}
