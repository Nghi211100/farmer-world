/**
 * Installs app-debug.apk via adb (SDK platform-tools or PATH).
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function resolveAdb() {
  if (process.env.ADB) return process.env.ADB;
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const candidate = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (existsSync(candidate)) return candidate;
  }
  const local = process.env.LOCALAPPDATA;
  if (local && process.platform === 'win32') {
    const candidate = join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
    if (existsSync(candidate)) return candidate;
  }
  return 'adb';
}

if (!existsSync(apk)) {
  console.error(`APK not found: ${apk}\nRun: npm run build:apk:live`);
  process.exit(1);
}

const adb = resolveAdb();
const device = process.env.ADB_DEVICE;
const args = ['install', '-r', apk];
if (device) args.splice(0, 0, '-s', device);

const result = spawnSync(adb, args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) {
  console.error(result.error.message);
  console.error('Set ANDROID_HOME or add platform-tools to PATH, or set ADB=full\\path\\to\\adb.exe');
  process.exit(1);
}
process.exit(result.status ?? 1);
