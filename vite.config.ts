import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

// Writes a build-time asset manifest that public/sw.js reads to precache
// every emitted file (task 8: SW precache / network-first HTML / cache-first
// fonts). Appended here rather than folded into the object above so task 1's
// config stays untouched.
function swManifestPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'voidsong-sw-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_, bundle) {
      const assets = Object.values(bundle)
        .map((chunk) => `/${chunk.fileName}`)
        .filter((file) => !file.endsWith('/sw.js'));
      const manifest = {
        version: pkg.version,
        generatedAt: new Date().toISOString(),
        assets,
      };
      writeFileSync(
        resolve(outDir, 'sw-manifest.json'),
        JSON.stringify(manifest, null, 2),
      );
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [swManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        privacy: 'privacy.html',
        shortcuts: 'shortcuts.html',
        notFound: '404.html',
      },
    },
  },
});
