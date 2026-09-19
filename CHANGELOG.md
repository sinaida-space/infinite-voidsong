# Changelog

Versions of Infinite Voidsong and the commits that made them. Newest first.
Commit links point to GitHub. Merge commits are left out.

## 1.2.0 (2026-09-20)

Real nature recordings, a Harmony switch and a sources section on the research page.

- Layers for stream, rain, rain with thunder, birds, crickets and wind can play field recordings (CC0, from BigSoundBank, about 3 MB in total). They load when a layer is first switched on and are cached in the browser. The generated versions stay as stand-ins if a recording cannot load.
- New layers: rain with thunder, birds, crickets.
- Harmony switch in the Master window: Off, Gentle, Drift. Longer patterns (32 and 64 steps) and chord progressions that move along the circle of fifths inside one key.
- The research page lists what is generated and what is recorded, with authors, links, licences and the processing done to each recording.
- Processing script and provenance manifest for the recordings: `scripts/process-sounds.sh`, `public/audio/manifest.json`.

Commits:

- [`cf75c72`](https://github.com/sinaida-space/infinite-voidsong/commit/cf75c72) Update README.md
- [`e00e9d5`](https://github.com/sinaida-space/infinite-voidsong/commit/e00e9d5) feat: Harmony switch with circle-of-fifths progressions and 32/64-step phrases (#21)
- [`23c304a`](https://github.com/sinaida-space/infinite-voidsong/commit/23c304a) feat(audio): CC0 nature loops, processing script and provenance manifest (#19)
- [`2257d2c`](https://github.com/sinaida-space/infinite-voidsong/commit/2257d2c) feat(audio): SampleSource with synth fallback, thunder/birds/crickets layers, audio runtime cache (#20)
- [`504591b`](https://github.com/sinaida-space/infinite-voidsong/commit/504591b) docs: research page lists generated and recorded sounds, sources, CC0 licences and processing
- [`3fc599f`](https://github.com/sinaida-space/infinite-voidsong/commit/3fc599f) fix: review findings (#22): accurate Harmony copy with nbsp, stall guard in sample loops, SW cache write awaits, LUFS range on the research page, npm run test:harmony

## 1.1.0

Released as tag `v1.1.0` on `dc5e161`. `package.json` stayed at 1.1.0 while development continued, so this section runs up to the start of 1.2.0.

- [`a802de2`](https://github.com/sinaida-space/infinite-voidsong/commit/a802de2) fix: load legal.css on the app page so banner and footer are styled
- [`dd7f87f`](https://github.com/sinaida-space/infinite-voidsong/commit/dd7f87f) feat(audio): add synthwave, berlin, house and chillhop music sources (#12)
- [`f0a50bf`](https://github.com/sinaida-space/infinite-voidsong/commit/f0a50bf) feat(visual): visible ordered dither in the tunnel shader (#16)
- [`b453065`](https://github.com/sinaida-space/infinite-voidsong/commit/b453065) feat: footer redesign, routing fixes, dithered 404, drop Libre Franklin (#13)
- [`127e339`](https://github.com/sinaida-space/infinite-voidsong/commit/127e339) fix(site): drop GitHub link, 404 dither in Void/red like sinaida.eu (#13)
- [`470bc0e`](https://github.com/sinaida-space/infinite-voidsong/commit/470bc0e) chore(404): regenerate dithered artwork in Void/red
- [`9767b80`](https://github.com/sinaida-space/infinite-voidsong/commit/9767b80) feat: terminal boot-sequence welcome screen, fix quiz progression bug (#14)
- [`dedceed`](https://github.com/sinaida-space/infinite-voidsong/commit/dedceed) feat(visual): living tunnel with organic warp, helix, camera sway and per-source hues (#18)
- [`457e10a`](https://github.com/sinaida-space/infinite-voidsong/commit/457e10a) feat: guide content and window, standalone page and in-app (#17)
- [`12d0a50`](https://github.com/sinaida-space/infinite-voidsong/commit/12d0a50) feat(visual): per-ring lobes, bent path and line texture in the tunnel (#18)
- [`3f6fee2`](https://github.com/sinaida-space/infinite-voidsong/commit/3f6fee2) feat(ui): flat sinaida.eu-style windows, Geist Pixel only, hide-UI mode, glitch headings, timer hint (#15)
- [`dc5e161`](https://github.com/sinaida-space/infinite-voidsong/commit/dc5e161) chore: tidy guide.css comment
- [`e199ea5`](https://github.com/sinaida-space/infinite-voidsong/commit/e199ea5) feat(welcome): boot log first with Continue, briefing with basis and sessions, red quick-tuning panel; align session window width
- [`578f19f`](https://github.com/sinaida-space/infinite-voidsong/commit/578f19f) style: soften CRT scanlines to a barely visible texture
- [`38c4ffe`](https://github.com/sinaida-space/infinite-voidsong/commit/38c4ffe) feat: host on Vercel (vercel.json headers, privacy, README, URLs), welcome screen link in footer
- [`9cfd952`](https://github.com/sinaida-space/infinite-voidsong/commit/9cfd952) feat: terms and research pages, footer in three columns, tunnel steered by mouse and phone tilt, welcome stars and neon, pulse rate, media session, rename Transport to Player
- [`f08b9e8`](https://github.com/sinaida-space/infinite-voidsong/commit/f08b9e8) fix(layout): stop page stylesheet overriding the app grid; split chrome.css from legal.css, drop duplicated tail
- [`841b8f6`](https://github.com/sinaida-space/infinite-voidsong/commit/841b8f6) feat: link-preview image (dithered monster + neon title), favicons for all devices, red browser tint (theme-color and Safari 26 edge strips), made-by line in descriptions
- [`ba7d1d6`](https://github.com/sinaida-space/infinite-voidsong/commit/ba7d1d6) fix: paint the Safari tint strips on Apple browsers so the toolbar turns red
- [`de09cda`](https://github.com/sinaida-space/infinite-voidsong/commit/de09cda) fix: red body ground and static edge strips so Safari 26 tints its toolbars; dark fallback without WebGL
- [`6b00d97`](https://github.com/sinaida-space/infinite-voidsong/commit/6b00d97) chore: keep both tint strips together at the top of each page
- [`006b9b7`](https://github.com/sinaida-space/infinite-voidsong/commit/006b9b7) feat: link preview with the horned slopter
- [`bc8c5d4`](https://github.com/sinaida-space/infinite-voidsong/commit/bc8c5d4) fix: open on the welcome screen every visit; do not remember hidden interface
- [`96d125b`](https://github.com/sinaida-space/infinite-voidsong/commit/96d125b) feat: start dialog with mode and session choice, custom session lengths, clickable session timeline
- [`811c446`](https://github.com/sinaida-space/infinite-voidsong/commit/811c446) fix: tint strips behind the page so they never cross content on scroll; link preview with slopter 81
- [`7e80d21`](https://github.com/sinaida-space/infinite-voidsong/commit/7e80d21) fix: every page opens at the top (no scroll restoration, no focus scrolling); solid red bands for phones in Safari
- [`6533c98`](https://github.com/sinaida-space/infinite-voidsong/commit/6533c98) feat: your space and listening device as visible choices; preview image at a new URL; harder scroll reset in the dialog
- [`48d6d26`](https://github.com/sinaida-space/infinite-voidsong/commit/48d6d26) feat: Session above Player, larger window headers, brand name red caps everywhere, footer brand link and welcome footer, hidden Pac-Man, metadata without author, llms.txt and JSON-LD
- [`e323e0d`](https://github.com/sinaida-space/infinite-voidsong/commit/e323e0d) docs: llms.txt wording
- [`9021d26`](https://github.com/sinaida-space/infinite-voidsong/commit/9021d26) feat: agent discovery: Link headers, Markdown for agents, Content Signals, WebMCP tools, agent skill and skills index, ARD catalog
- [`6b06877`](https://github.com/sinaida-space/infinite-voidsong/commit/6b06877) style: neon logo on the app title, header hierarchy with glow and space, one inner grid for all windows, full-width player, shorter welcome line
- [`3c67f64`](https://github.com/sinaida-space/infinite-voidsong/commit/3c67f64) feat: end-of-session arpeggio (three synth voices, Glass by default) and a listening page
- [`ee15725`](https://github.com/sinaida-space/infinite-voidsong/commit/ee15725) chore: publish the chime listening page (temporary)
- [`8dda844`](https://github.com/sinaida-space/infinite-voidsong/commit/8dda844) feat: retro pluck signals (down at the end of work, up at the end of the break); the break is silent
- [`da26577`](https://github.com/sinaida-space/infinite-voidsong/commit/da26577) style: play/pause button uses the same colours as the other player buttons
- [`e7b5976`](https://github.com/sinaida-space/infinite-voidsong/commit/e7b5976) feat: the break is a window in the page with Back to work and End session; title and footer stay
- [`63ebccf`](https://github.com/sinaida-space/infinite-voidsong/commit/63ebccf) feat: play/pause cues, no Share button, permanent Show interface button in hide mode, tunnel colours per preset
- [`a1813d7`](https://github.com/sinaida-space/infinite-voidsong/commit/a1813d7) feat: full screen button and F shortcut in hide mode; all shortcuts follow the physical key so they work on a Russian layout
- [`9d6911a`](https://github.com/sinaida-space/infinite-voidsong/commit/9d6911a) docs: keyboard shortcuts in the guide mention H, F and the Russian layout
- [`224dbd4`](https://github.com/sinaida-space/infinite-voidsong/commit/224dbd4) Update README.md
- [`b972272`](https://github.com/sinaida-space/infinite-voidsong/commit/b972272) Update README with image and project details
- [`b6ed514`](https://github.com/sinaida-space/infinite-voidsong/commit/b6ed514) fix: warm-up is opt-in for Creative flow and the phase label says what follows it
- [`893c1df`](https://github.com/sinaida-space/infinite-voidsong/commit/893c1df) docs: spell out where the warm-up applies (Creative flow, timed sessions, on top of the length, same sound, no signal); warm-up choice in the start dialog
- [`6d98302`](https://github.com/sinaida-space/infinite-voidsong/commit/6d98302) docs: README with the story behind the tool, features and author section

## 0.1

Tag `v0.1` on `e421efc`. The first working app: audio engine, sound sources, UI shell, visual tunnel, onboarding and timers.

- [`589c10d`](https://github.com/sinaida-space/infinite-voidsong/commit/589c10d) Initial commit
- [`72da478`](https://github.com/sinaida-space/infinite-voidsong/commit/72da478) docs: add research specs and creative-director plan
- [`980dbc8`](https://github.com/sinaida-space/infinite-voidsong/commit/980dbc8) chore: scaffold Vite 5 + vanilla-ts, config, static files (#1)
- [`e15469d`](https://github.com/sinaida-space/infinite-voidsong/commit/e15469d) feat: add state store, persistence, URL hash sync, and presets (#2)
- [`d5169ee`](https://github.com/sinaida-space/infinite-voidsong/commit/d5169ee) feat: legal pages, notice banner, footer, PWA, README (#8)
- [`81ddde6`](https://github.com/sinaida-space/infinite-voidsong/commit/81ddde6) feat: add onboarding, session timer, break ritual, sleep timer (#7)
- [`9cc1b68`](https://github.com/sinaida-space/infinite-voidsong/commit/9cc1b68) feat: UI shell, mixer, master, transport, keyboard (#6)
- [`2ea55cf`](https://github.com/sinaida-space/infinite-voidsong/commit/2ea55cf) feat(audio): generative music sources, tone layer, Focus Boost (#4)
- [`0d2b571`](https://github.com/sinaida-space/infinite-voidsong/commit/0d2b571) feat(visual): WebGL2 vector-CRT tunnel renderer, reactive mapping, families (#5)
- [`f32c185`](https://github.com/sinaida-space/infinite-voidsong/commit/f32c185) chore: ignore .claude worktrees
- [`eb6f55b`](https://github.com/sinaida-space/infinite-voidsong/commit/eb6f55b) feat(audio): engine core, master chain, layers, levels and 11 ambient sources (#3)
- [`d67e096`](https://github.com/sinaida-space/infinite-voidsong/commit/d67e096) refactor(audio): dedupe SoundSource/SourceFactory into music/types
- [`ef71cc2`](https://github.com/sinaida-space/infinite-voidsong/commit/ef71cc2) feat(audio): wire focus boost per layer and lofi beat into the level meter
- [`ab5eaf6`](https://github.com/sinaida-space/infinite-voidsong/commit/ab5eaf6) fix(visual): keep the last tunnel frame visible after pause/deceleration
- [`85d61a6`](https://github.com/sinaida-space/infinite-voidsong/commit/85d61a6) fix(ui): remove the duplicate toast renderer in app.ts
- [`7aa4358`](https://github.com/sinaida-space/infinite-voidsong/commit/7aa4358) chore(styles): reword a CSS comment off the banned-copy list
- [`ba4ee60`](https://github.com/sinaida-space/infinite-voidsong/commit/ba4ee60) test(smoke): extend smoke.mjs to the full issue #9 contract
- [`e421efc`](https://github.com/sinaida-space/infinite-voidsong/commit/e421efc) feat: wire the app together in main.ts (#9)
