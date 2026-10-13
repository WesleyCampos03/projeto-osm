import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createHash } from "node:crypto";

// Precache only local build files so the application can reopen without internet.
function offlineCache() {
  return {
    name: "offline-cache",
    apply: "build",
    generateBundle(_, bundle) {
      const files = ["index.html", "favicon.svg", ...Object.keys(bundle)];
      const version = createHash("sha256")
        .update(JSON.stringify(files))
        .digest("hex")
        .slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const CACHE = 'gestao-tech-${version}';
const FILES = ${JSON.stringify([...new Set(files)])};
const base = self.registration.scope;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, base).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gestao-tech-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(base)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', base).href)));
    return;
  }
  // Vite's preview server varies responses by Origin. Module requests include
  // that header, while the install-time precache does not. Static files are
  // identical for every origin, so ignore Vary for these bundled assets.
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request)));
});
`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), offlineCache()],
});
