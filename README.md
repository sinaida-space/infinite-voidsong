# Infinite Voidsong

Endless generated soundscapes for focused work. Layer noise, water, fire,
place, and music sources into a mix, save it as a preset, and let it run.
Nothing renders server-side, and nothing is tracked: the whole application
is static, and every setting lives in your own browser.

## Stack

- [Vite](https://vitejs.dev) plus TypeScript, no framework.
- Web Audio API for sound, WebGL for the reactive visual.
- A plain-JS service worker (`public/sw.js`) for offline installs, precaching
  a build-time asset manifest written by a small Vite plugin.
- Self-hosted font: Geist Pixel, everywhere.

## Development

```bash
npm ci
npm run dev
```

## Scripts

- `npm run dev`, dev server at http://localhost:5173.
- `npm run build`, production build to `dist/`.
- `npm run preview`, preview the production build.
- `npm run check`, type check with TypeScript.
- `npm run smoke`, verify build artifacts.
- `npm run typo`, check typography (requires the typography skill).
- `npm run dither`, regenerate the dithered 404 artwork from `404_images/`.

## Cloudflare Pages deployment

1. Connect this GitHub repository in the Cloudflare Pages dashboard.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Build output directory: `dist`.
5. Node version: **20**.
6. `public/_headers` ships with the build and Pages picks it up automatically,
   so no extra configuration is needed for security headers.

## License

Apache License 2.0, see [LICENSE](./LICENSE).
