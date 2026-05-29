const pngModules = import.meta.glob('../assets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const pathToUrl = new Map<string, string>();
for (const [fullPath, url] of Object.entries(pngModules)) {
  const match = fullPath.match(/assets\/(.+\.png)$/);
  if (match) pathToUrl.set(match[1].replace(/\\/g, '/'), url);
}

/** Resolved Vite URL for a manifest path under `src/assets/`. */
export function getAssetUrl(path: string): string | undefined {
  return pathToUrl.get(path);
}

/** All `relative/path.png` keys bundled at build time. */
export function getAssetPathToUrlMap(): ReadonlyMap<string, string> {
  return pathToUrl;
}
