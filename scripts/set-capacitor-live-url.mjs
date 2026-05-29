/**
 * Writes .capacitor-live-url so capacitor.config.ts points the WebView at Vite.
 * URL: CAP_SERVER_URL or http://<detected-lan-ip>:CAP_DEV_PORT (default 5173).
 */
import { writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const markerPath = join(root, '.capacitor-live-url');
const port = process.env.CAP_DEV_PORT ?? '5173';

/** VMware host-only ranges — not reachable from a phone on Wi‑Fi. */
const EXCLUDED_IP_PREFIXES = ['192.168.174.', '192.168.232.'];

const VIRTUAL_IFACE = /vmware|vmnet|virtual|wsl|hyper-v|vethernet|tap-|openvpn|vpn|loopback|bluetooth|direct/i;
const WIFI_IFACE = /wi-?fi|wlan|wireless/i;

function isPrivateLan(addr) {
  if (addr.startsWith('10.')) return true;
  if (addr.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(addr);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function detectLanIp() {
  const candidates = [];
  for (const [ifaceName, ifaces] of Object.entries(networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const addr = net.address;
      if (!isPrivateLan(addr)) continue;
      if (EXCLUDED_IP_PREFIXES.some((p) => addr.startsWith(p))) continue;

      let score = 0;
      if (WIFI_IFACE.test(ifaceName)) score += 100;
      if (VIRTUAL_IFACE.test(ifaceName)) score -= 80;

      candidates.push({ addr, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.addr ?? '127.0.0.1';
}

function normalizeUrl(raw) {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

const url = process.env.CAP_SERVER_URL
  ? normalizeUrl(process.env.CAP_SERVER_URL)
  : `http://${detectLanIp()}:${port}`;

writeFileSync(markerPath, `${url}\n`, 'utf8');
console.log(`Capacitor live reload URL: ${url}`);
console.log(`  (written to .capacitor-live-url; override with CAP_SERVER_URL)`);

if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.log('  Note: dist/ is empty — run "npm run build" once if "cap sync" fails.');
}
