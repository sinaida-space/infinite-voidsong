# Infinite Voidsong

**Try it live: [infinite-voidsong.vercel.app](https://infinite-voidsong.vercel.app/)**



<img width="3072" height="384" alt="image" src="https://github.com/user-attachments/assets/41f61e04-e350-43bd-91c7-79927264cf92" />




Endless generated soundscapes for focused work. Layer noise, water, fire,
place, and music sources into a mix, save it as a preset, and let it run.
Nothing renders server-side, and nothing is tracked: the whole application
is static, and every setting lives in your own browser.

## Why it exists

Sinaida made Infinite Voidsong for her own working day. She wanted one place
to hold her focus and to keep track of her rest and recharge time.

Ballet taught her the second part the hard way: rest is where growth happens.
A body that never recovers stops improving, and a mind at a screen is no different. So the tool has two sides. The soundscape and the timed sessions
carry the work. The breaks are tracked with the same care, because they are
part of the work.

## Features

- Layered soundscapes from noise, water, fire, place, and music sources.
- Presets: save a mix and return later.
- Timed work-and-break sessions, with rest counted as part of the session.
- An audio-reactive tunnel visual.
- Offline install as a web app.
- No accounts, no tracking. Settings stay in your browser.

## Stack

- [Vite](https://vitejs.dev) plus TypeScript, no framework.
- Web Audio API for sound, WebGL for the reactive visual.
- A plain-JS service worker (`public/sw.js`) for offline installs, precaching
  a build-time asset manifest written by a small Vite plugin.
- Self-hosted font: Geist Pixel, everywhere.

## Development

```bash
npm ci
npm run dev
```

## Scripts

- `npm run dev`, dev server at http://localhost:5173.
- `npm run build`, production build to `dist/`.
- `npm run preview`, preview the production build.
- `npm run check`, type check with TypeScript.
- `npm run smoke`, verify build artifacts.
- `npm run typo`, check typography (requires the typography skill).
- `npm run dither`, regenerate the dithered 404 artwork from `404_images/`.

## Vercel deployment

1. Import this GitHub repository in the Vercel dashboard.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (both come from `vercel.json`).
3. Node version: **20**.
4. Security headers (CSP and others) are set by `vercel.json`, so no extra configuration is needed.
5. `404.html` in the build output is served for unknown routes automatically.

## Support & handoff

- Status: active (maintained by Sinaida Krivchenko)
- Run locally: `npm ci`, then `npm run dev` (http://localhost:5173); the Vercel setup uses Node 20
- Offline / fallback: installable as an offline web app; the service worker in public/sw.js caches the production build
- Requirements: a browser with the Web Audio API and WebGL
- Handing over: CHANGELOG.md documents releases and audio-reqs.md holds the sound specification; licence terms are in LICENSE (Apache 2.0)
- Contact: https://sinaida.eu/collaborate

## How this was made

Sinaida comes up with the idea, the concept and the way to make it into a system. The making uses whatever the piece needs, from drawing by hand to AI-native production. She cares about integrity and a smooth experience, so every work adjusts to its environment, and each project ships with a rider, a contingency plan and her support.

## License

Apache License 2.0, see [LICENSE](./LICENSE).

## About the author

Sinaida Krivchenko is a new media artist based in Prague. She works with
interactive projections, TouchDesigner, GLSL shaders, web applications, and generative art. Portfolio and contact: [sinaida.eu](https://sinaida.eu).

#NewMedia #NewMediaArt #GenerativeArt #CreativeCoding #WebAudio #FocusTool #FLINTA #flintaartist

This repo is a production mirror.

Development and issue tracking run in a private development environment; releases are published here.
