import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

// Placeholder production origin: the owner will point this at the real
// domain once it exists. Kept in one place so canonical/OG URLs and
// sitemap.xml agree; sitemap.xml is a static file so it repeats the same
// string rather than reading this constant.
const SITE_URL = 'https://infinite-voidsong.vercel.app/';

// Not computed from the clock on purpose — the footer shows the month this
// build shipped, not the month it happens to render.
const BUILD_MONTH = 'September 2026';

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

// Replaces the literal token `__SITE_URL__` in canonical/OG meta tags with
// the real origin, in both dev and build. `define` only reaches JS, and
// these tags live in static HTML, so the HTML transform does the same job
// for markup that `define` does for __APP_VERSION__ in footer.ts.
function siteUrlPlugin(): Plugin {
  return {
    name: 'voidsong-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', SITE_URL);
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_MONTH__: JSON.stringify(BUILD_MONTH),
  },
  plugins: [swManifestPlugin(), siteUrlPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        privacy: 'privacy.html',
        shortcuts: 'shortcuts.html',
        guide: 'guide.html',
        notFound: '404.html',
      },
    },
  },
});
