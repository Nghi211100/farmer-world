import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.farmerworld.app',
  appName: 'Farmer World',
  webDir: 'dist',
  android: {
    versionCode: 1,
    versionName: '0.1.0',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
