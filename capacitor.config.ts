import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function getLiveServerUrl(): string | undefined {
  const fromEnv = process.env.CAP_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const marker = join(__dirname, '.capacitor-live-url');
  if (existsSync(marker)) {
    return readFileSync(marker, 'utf8').trim().replace(/\/$/, '');
  }
  return undefined;
}

const liveUrl = getLiveServerUrl();

const config: CapacitorConfig = {
  appId: 'com.farmerworld.app',
  appName: 'Farmer World',
  webDir: 'dist',
  android: {
    versionCode: 1,
    versionName: '0.1.0',
  },
  server: liveUrl
    ? {
        url: liveUrl,
        cleartext: liveUrl.startsWith('http://'),
        androidScheme: 'https',
      }
    : {
        androidScheme: 'https',
      },
};

export default config;
