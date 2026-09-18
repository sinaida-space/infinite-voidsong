# Infinite Voidsong — Creative Director plan

## 1. Creative synthesis

**Visual.** The tunnel is a vector-CRT object: concentric rings receding to a vanishing point, drawn as phosphor lines with ordered (Bayer) dither and a faint scanline, the way the *Autobahn*-era Kraftwerk stage graphics and the wireframe tunnels of 1979 *The Black Hole* / Atari vector cabinets looked. Starfield dust drifts between the rings so the eye has something to rest on at 0.5 px brightness. Nothing rotates fast; the whole thing breathes.

**Per family.** Water: blue, rings soften into ripples, slow forward drift. Air (wind): haze-gray, rings blur sideways. Fire: amber, sparse ember points rise. Noise: brand red, dense grain, rings almost dissolve into static. Place: warm fog, rings become room-like rectangles. Music: cathode teal, rings pulse on the beat. Tone: a single thin filament down the axis. Family colour is the only hue outside the brand system; everything else stays Chalk on Void.

**Audio signature.** Every session opens the same way: a 55 Hz sub-swell over 4 s, then the scene arrives on top. That swell is the brand sound; no logo sting.

**Session-end ritual ("the descent").** Over 20 s the sound fades, the tunnel decelerates to a still frame, one Chalk line appears: "Break. Come back in 5:00." Break plays a quiet stream at Whisper level. At resume, the still frame breathes once, then the tunnel starts moving again.

## 2. Architecture pattern

**Multi-agent with a chain gate.** Three concerns need different expertise and models (DSP → fable, GLSL → fable, UI/legal → sonnet) and touch disjoint directories; a single scaffold + contract task gates all of them. Reflection loop is not needed: the contract below is fixed here, so no design-shaped output remains open.

## 3. Task breakdown

| # | Task | Model | Effort | Est. Tokens | Agent? | Depends on | Parallel with | Files |
|---|------|-------|--------|-------------|--------|------------|---------------|-------|
| 1 | Scaffold, config, static compliance files, contract types verbatim | haiku | low | 25k | yes | nothing | nothing (gate) | package.json, vite.config.ts, tsconfig.json, index.html (skeleton), public/{_headers,robots.txt,sitemap.xml,llms.txt,manifest.webmanifest,fonts/*}, src/state/types.ts, src/state/events.ts, src/styles/tokens.css, .gitignore |
| 2 | State store, persistence, URL hash, preset tables | sonnet | medium | 40k | yes (own tier; store logic is not mechanical) | 1 | 3, 4, 5, 7 | src/state/{store,persist,url,presets}.ts |
| 3 | Audio engine core + noise/nature/place DSP recipes | fable | high | 120k | yes | 1 | 2, 4, 5, 7 | src/audio/{engine,graph,layer,crossfade,levels}.ts, src/audio/worklets/noise.worklet.ts, src/audio/sources/{noise,rain,ocean,stream,wind,campfire,underwater,cafe,library,cabin,fan}.ts |
| 4 | Generative music + tone layer + Focus Boost | fable | high | 90k | yes (separate from 3: 210k in one context degrades; files disjoint) | 1 | 2, 3, 5, 7 | src/audio/music/{scale,scheduler,drone,lofi,plucks,tape,sidechain}.ts, src/audio/sources/{tone,drone,lofi,plucks}.ts, src/audio/focusboost.ts |
| 5 | Tunnel shader, WebGL2 renderer, audio-reactive mapping | fable | high | 100k | yes | 1 | 2, 3, 4, 7 | src/visual/{renderer,reactive,families}.ts, src/visual/shaders/tunnel.{vert,frag}.glsl |
| 6 | UI shell: mixer, master + dB guide, transport, keyboard shortcuts, layout/CSS | sonnet | medium | 80k | yes | 2 | 7, 8 | src/ui/{app,mixer,master,transport,shortcuts}.ts, src/styles/{base,ui}.css, index.html (body) |
| 7 | Onboarding (welcome + quiz), session timer, break/resume ritual, sleep timer | sonnet | medium | 70k | yes (separate from 6: parallel worktree, disjoint files) | 2 | 3, 4, 5, 6 | src/ui/{onboarding,timer,ritual,sleep}.ts, src/state/session.ts |
| 8 | Legal + compliance: privacy page, notice banner, footer, 404, shortcuts page, OG meta, PWA service worker, README with Cloudflare Pages deploy steps | sonnet | medium | 60k | yes (separate from 6: prose goes through typography, different files) | 1 | 2, 3, 4, 5, 7 | privacy.html, shortcuts.html, 404.html, src/ui/{banner,footer}.ts, src/sw.ts, index.html (head meta), README.md |
| 9 | Integration: wire engine ↔ store ↔ renderer ↔ UI in main.ts, smoke script, fix cross-module type errors | sonnet | high | 60k | yes | 2–8 | nothing | src/main.ts, scripts/smoke.mjs, any file (glue only) |
| 10 | Verifier group A (audio + visual): run DoD commands, listen/inspect via smoke script | sonnet | low | 20k | yes (fresh context) | 3, 4, 5 | 11 | none (reads) |
| 11 | Verifier group B (UI + legal + integration): build, tsc, typocheck, a11y checklist | sonnet | low | 20k | yes (fresh context) | 6, 7, 8, 9 | 10 | none (reads) |
| 12 | Reviewer: full diff, correctness, leaks (AudioContext, GL), CSP conflicts, brand/claims compliance | opus | high | 60k | yes | 9–11 | nothing | none (reads) |

Inline in the orchestrator (no agent): git tags v0.1 (after task 9 passes) and v1.0 (after task 12), commits per task, the `.gitignore` tweak if missed.

**Parallel worktrees:** after task 1 lands on main, spawn four worktrees: A = tasks 3 + 4 (same agent tier, disjoint files, two agents), B = task 5, C = task 2 then 6 + 7 (7 starts as soon as 2 merges; 6 and 7 are disjoint), D = task 8. Task 9 runs on main after all merge.

## 4. Module layout and contract

```
infinite-voidsong/
  index.html  privacy.html  shortcuts.html  404.html  README.md
  public/  _headers  robots.txt  sitemap.xml  llms.txt  manifest.webmanifest  og.png  fonts/GeistPixel.woff2  fonts/LibreFranklin-Light.woff2
  scripts/smoke.mjs
  src/main.ts  src/sw.ts
  src/state/   types.ts  events.ts  store.ts  persist.ts  url.ts  presets.ts  session.ts
  src/audio/   engine.ts  graph.ts  layer.ts  crossfade.ts  levels.ts  focusboost.ts
               worklets/noise.worklet.ts  sources/*.ts  music/*.ts
  src/visual/  renderer.ts  reactive.ts  families.ts  shaders/tunnel.vert.glsl  shaders/tunnel.frag.glsl
  src/ui/      app.ts  mixer.ts  master.ts  transport.ts  shortcuts.ts  onboarding.ts  timer.ts  ritual.ts  sleep.ts  banner.ts  footer.ts
  src/styles/  tokens.css  base.css  ui.css
```

### src/state/types.ts (task 1 writes verbatim; everyone builds against it)

```ts
export type SourceId =
  | 'none'
  | 'noise'                                        // family noise
  | 'rain' | 'ocean' | 'stream' | 'underwater'     // family water
  | 'wind'                                         // family air
  | 'campfire'                                     // family fire
  | 'cafe' | 'library' | 'cabin' | 'fan'           // family place
  | 'drone' | 'lofi' | 'plucks'                    // family music
  | 'tone';                                        // family tone

export type Family = 'noise' | 'water' | 'air' | 'fire' | 'place' | 'music' | 'tone';
export const FAMILY_OF: Record<Exclude<SourceId,'none'>, Family> = { noise:'noise', rain:'water', ocean:'water', stream:'water', underwater:'water', wind:'air', campfire:'fire', cafe:'place', library:'place', cabin:'place', fan:'place', drone:'music', lofi:'music', plucks:'music', tone:'tone' };

export interface LayerState {
  source: SourceId;                 // 'none' = empty slot
  volume: number;                   // 0..1, e.g. 0.6
  muted: boolean;
  params: Record<string, number>;   // per-source knobs, keys below
}
// Param keys and ranges (all numbers, all optional; engine applies defaults):
//   noise.tilt   0..1   0 = white, 0.5 = pink, 1 = brown           default 0.5
//   lofi.bpm     60..100                                            default 78
//   lofi.tape    0..1   lo-fi filter amount                         default 0.5
//   lofi.pump    0..1   sidechain depth                             default 0.4
//   tone.freq    200..12000 Hz                                      default 4000
//   tone.width   0..1   0 = pure sine, 1 = wide band noise          default 0.3
//   ocean.period 8..24 s                                            default 14

export interface FocusBoost { depth: number /* 0..1, default 0 */; rateHz: number /* 12..20, default 16 */; }

export type Band = 'whisper' | 'library' | 'workspace' | 'cafe' | 'loud';
export interface MasterState { volume: number /* 0..1 */; }
export const bandOf = (v: number): Band => v < 0.2 ? 'whisper' : v < 0.4 ? 'library' : v < 0.6 ? 'workspace' : v < 0.8 ? 'cafe' : 'loud';

export type TaskPreset = 'deep-focus' | 'reading-writing' | 'creative-flow' | 'routine' | 'break-restore' | 'sleep';
export type TimerPreset = '25/5' | '50/10' | '90/15';
export type Phase = 'free' | 'warmup' | 'work' | 'ending' | 'break' | 'resume-cue' | 'sleep';

export interface SessionState {
  timer: TimerPreset | null;        // null = untimed
  phase: Phase;                     // 'free' when untimed
  phaseEndsAt: number | null;       // epoch ms
  warmup: boolean;                  // creative-flow 10 min upbeat warm-up
  sleepEndsAt: number | null;       // epoch ms, sleep timer
}

export type Playback = 'idle' | 'starting' | 'playing' | 'paused';

export interface AppState {
  version: 1;
  playback: Playback;
  layers: [LayerState, LayerState, LayerState, LayerState];
  master: MasterState;
  focusBoost: FocusBoost;
  preset: TaskPreset | null;
  session: SessionState;
  onboarded: boolean;
  noticeDismissed: boolean;
  reducedMotion: boolean;           // mirrors prefers-reduced-motion
}

// Example (Deep Focus, 50/10, mid-session):
// { version:1, playback:'playing',
//   layers:[ {source:'noise',volume:0.55,muted:false,params:{'noise.tilt':0.6}},
//            {source:'rain',volume:0.35,muted:false,params:{}},
//            {source:'drone',volume:0.3,muted:false,params:{}},
//            {source:'none',volume:0.5,muted:false,params:{}} ],
//   master:{volume:0.5}, focusBoost:{depth:0.3,rateHz:16}, preset:'deep-focus',
//   session:{timer:'50/10',phase:'work',phaseEndsAt:1789999999000,warmup:false,sleepEndsAt:null},
//   onboarded:true, noticeDismissed:true, reducedMotion:false }
```

### src/state/events.ts (task 1 writes verbatim)

```ts
export interface LevelFrame { rms: number; low: number; mid: number; high: number; beat: number; }  // all 0..1, beat decays from 1 on each lofi kick
export interface EventMap {
  'state:changed': { prev: AppState; next: AppState };
  'audio:levels': LevelFrame;                       // ~30 Hz while playing
  'audio:ready': void;                              // AudioContext running
  'session:phase': { from: Phase; to: Phase };
  'visual:motion': 'running' | 'decelerating' | 'still';
  'ui:toast': { text: string; ms: number };         // no sound ever
}
export interface Bus { on<K extends keyof EventMap>(k: K, fn: (p: EventMap[K]) => void): () => void; emit<K extends keyof EventMap>(k: K, p: EventMap[K]): void; }
export const bus: Bus;   // singleton, implemented in events.ts by task 1 (20 lines)
```

### Store API (task 2)

```ts
export const store: { get(): AppState; set(patch: Partial<AppState> | ((s: AppState) => AppState)): void; subscribe(fn: (s: AppState) => void): () => void; reset(): void };
export const applyPreset = (id: TaskPreset, ctx?: { noise: 'quiet'|'home'|'office'|'varies'; output: 'headphones'|'speakers' }) => void;
// persist.ts: debounce 300 ms → localStorage key 'voidsong:v1'; url.ts: encode layers+master+focusBoost+preset into location.hash as base64url JSON, read on load (hash wins over storage).
```

### Engine API (task 3 owns; task 4 adds sources through the same interface)

```ts
export interface SoundSource {
  readonly id: SourceId; readonly family: Family;
  connect(dest: AudioNode): void;
  start(at: number): void; stop(at: number): void;        // stop = internal fade ≥ 2 s, then teardown
  setParam(key: string, value: number, rampSec: number): void;
  dispose(): void;
}
export type SourceFactory = (ctx: AudioContext) => SoundSource;
export const SOURCES: Record<Exclude<SourceId,'none'>, SourceFactory>;   // task 3 creates the map with its 11; task 4 registers drone, lofi, plucks, tone
export class AudioEngine {
  constructor(bus: Bus);
  async start(): Promise<void>;                            // resume ctx, 4 s sub-swell signature, fade-in 6 s
  apply(state: AppState): void;                            // diff vs last; source change = crossfade 3 s; volume ramps 0.3 s
  pause(fadeSec?: number): Promise<void>;                  // default 1.5
  end(fadeSec: number): Promise<void>;                     // descent: 20 s
  get context(): AudioContext;
}
```

### Renderer API (task 5)

```ts
export class TunnelRenderer {
  constructor(canvas: HTMLCanvasElement, bus: Bus);         // subscribes to audio:levels, visual:motion, state:changed (derives family weights)
  setFamilies(weights: Partial<Record<Family, number>>): void;   // sums to 1, crossfaded internally over 3 s
  setMotion(m: 'running' | 'decelerating' | 'still'): void;      // decelerating = 8 s ease-out to still
  setReducedMotion(on: boolean): void;                           // static frame, no time uniform advance
  destroy(): void;
}
```

### UI mount API (tasks 6, 7, 8; task 9 calls them in main.ts)

```ts
mountApp(root: HTMLElement): void;          // task 6: shell, mixer, master, transport, shortcuts
mountTimer(root: HTMLElement): void;        // task 7
mountOnboarding(root: HTMLElement): void;   // task 7
mountBanner(root: HTMLElement): void;       // task 8
mountFooter(root: HTMLElement): void;       // task 8
```

## 5. Task specs

### Task 1: Scaffold, config, static compliance files, contract types
- Model: haiku · Effort: low · Depends on: nothing
- Goal: `npm run build` produces an empty Void page with the fonts loaded and every static compliance file in `dist/`.
- Context: Vite 5 + vanilla-ts template, zero runtime deps, `"type":"module"`. Copy the two woff2 from `/Users/air_sinaida/dev/thresherium/fonts/`. Multi-page build: `build.rollupOptions.input = { main:'index.html', privacy:'privacy.html', shortcuts:'shortcuts.html', notFound:'404.html' }` (placeholder pages for now).
- Contract: write `src/state/types.ts` and `src/state/events.ts` exactly as in §4 (bus implemented: Map of Sets). `tokens.css`: `--void:#050505; --chalk:#f6f6f6; --red:#cd0000; --red-text:#ff1a1a; --graphite:#262626; --gunmetal:#4d4d4d; --slate:#737373; --fog:#999999; --haze:#cccccc; --cathode:#a7bebe; --font-ui:'Geist Pixel'; --font-legal:'Libre Franklin'`, `@font-face` for both, `body{background:var(--void)}`.
- Steps: package.json scripts `dev`, `build`, `preview`, `check` (= `tsc --noEmit`), `smoke` (= `node scripts/smoke.mjs`), `typo` (= `python3 ~/.claude/skills/typography/scripts/typocheck.py privacy.html index.html shortcuts.html README.md`). `public/_headers`: for `/*`: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: microphone=(), camera=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security: max-age=31536000`. `robots.txt` allow all + sitemap line; `sitemap.xml` with `/`, `/privacy`, `/shortcuts`; `llms.txt` three-line description; `manifest.webmanifest` (name Infinite Voidsong, display standalone, theme #050505, icons placeholder 192/512 generated as solid Void PNG with a red square, via a 10-line node script at build or committed).
- Boundaries: no UI, no audio, no shader. Do not invent extra config.
- DoD: `npm ci && npm run build` exits 0; `ls dist/_headers dist/robots.txt dist/sitemap.xml dist/llms.txt dist/manifest.webmanifest dist/fonts` all present; `npm run check` exits 0.

### Task 2: Store, persistence, URL hash, presets
- Model: sonnet · Effort: medium · Depends on: 1
- Goal: state survives reload, a copied URL reproduces the mix, `applyPreset` fills the four layers.
- Context: files in §4. Migrations: if stored `version !== 1` → reset. `reducedMotion` is read from `matchMedia` on load, never persisted. `playback` and `session.phaseEndsAt` are not persisted (session restarts idle).
- Contract: preset table (layer order, volume, params, master, focusBoost, timer):
  - deep-focus: noise tilt 0.6 vol .55 / rain .35 / drone .3 / none; master .5; boost .3; timer 50/10
  - reading-writing: noise tilt 0.8 vol .4 / stream .3 / none / none; master .4; boost 0; timer 25/5
  - creative-flow: cafe .5 / lofi bpm 84 .45 / none / none; master .65; boost 0; timer 90/15; warmup true
  - routine: lofi bpm 90 .5 / fan .3 / none / none; master .55; boost .2; timer 50/10
  - break-restore: stream .45 / wind .3 / plucks .25 / none; master .3; boost 0; timer null
  - sleep: rain .4 / underwater .35 / noise tilt 1 .25 / none; master .2; boost 0; timer null; sleepEndsAt = now + 45 min
  - ctx adjustments: noise 'office' → layer 0 volume +0.15 and if no noise layer, put `noise` tilt 0.5 in the first empty slot; 'quiet' → −0.1 on layer 0; speakers → master −0.05. Never produce an all-'none' preset.
- Steps: store.ts (immutable set, subscribers, `state:changed` emit), persist.ts, url.ts (`#v1.<base64url>`), presets.ts.
- Boundaries: no DOM beyond `location.hash`/`localStorage`; no audio.
- DoD: `npm run check` 0; a 30-line `src/state/__selftest.ts` run with `npx tsx` (dev dep only) asserts round-trip encode/decode equality and every preset has ≥ 1 non-'none' layer; delete or keep as `npm run test:state`.

### Task 3: Audio engine core + noise/nature/place recipes
- Model: fable · Effort: high · Depends on: 1
- Goal: with a 5-line dev harness, each of the 11 sources plays indefinitely, seam-free, no clicks, CPU under 5 % on a laptop.
- Context: AudioWorklet for the noise generator (`noise.worklet.ts` bundled through Vite `?worker&url` or `new URL(..., import.meta.url)`; CSP allows `blob:` workers). Everything else on native nodes so the graph stays cheap on mobile. Master chain: layers → `GainNode` master → `DynamicsCompressorNode` (threshold −6, knee 0, ratio 20, attack 0.003, release 0.25) → `GainNode` ceiling 0.89 → `AnalyserNode` (fftSize 1024, smoothing 0.85) → destination. `levels.ts` samples the analyser at 30 Hz with rAF-throttled `setInterval`, emits `audio:levels` (low < 250 Hz, mid 250–2k, high > 2k, normalised by a slow running max). Layer = `GainNode` per slot; source swap = new source ramps in while old ramps out over 3 s (equal-power). Every random event is scheduled on the audio clock with a look-ahead scheduler (100 ms tick, 300 ms horizon); no `setTimeout` audio. Rule: no event may exceed +6 dB over its scene average; no onset faster than 30 ms except sub-10 ms grains that sit ≥ 12 dB below the bed. Recipes (starting points, tune by ear):
  - noise: worklet outputs three streams (white PRNG xorshift; pink = Paul Kellet 7-pole; brown = leaky integrator ×0.02, leak 0.998) and blends by `tilt` with equal-power curves; high-shelf −4 dB at 12 kHz; ±2 dB gain wander over 10–30 s.
  - rain: pink bed through LPF 6 kHz + Poisson droplet grains (2–6 ms bandpassed noise bursts 2–8 kHz, 40–120/s, panned), ±1.5 dB wander.
  - ocean: pink bed, LPF cutoff and gain driven by a raised-cosine LFO with `ocean.period` (default 14 s), a second detuned LFO at ×0.37 for irregularity; foam = HPF noise on the crest, 1.5 s decay.
  - stream: three bandpass noises around 900/1800/3200 Hz, Q 4, centres jittered by slow random walks; light amplitude flutter 6–9 Hz.
  - wind: brown bed through bandpass 200–800 Hz, Q 0.7, cutoff wanders over 5–15 s; gusts = gain swells 4–8 s; never Q > 1 (no whistle).
  - campfire: brown bed LPF 300 Hz + crackle grains (1–8 ms HPF 1 kHz bursts, Poisson 6–15/s, level −14 dB); crickets: pulse train 4.2–4.8 kHz sine, 30 Hz internal AM, chirp 0.4 s every 1–2 s, two panned “insects” with independent timing.
  - underwater: brown bed LPF 400 Hz + two detuned sines 58/61 Hz at −18 dB + sparse bubble chirps (sine 300→900 Hz over 80 ms, every 3–9 s, −20 dB).
  - cafe: 8 “voices” = pulse (male 110–140 Hz / female 190–240 Hz) through three bandpasses whose centres random-walk in formant space (F1 300–800, F2 900–2300, F3 2400–3000), AM at syllable rate 3–5 Hz with random pauses, all summed then LPF 1.8 kHz and mixed −6 dB under a pink room bed. Clinks: bandpass 3–5 kHz impulse, decay 0.4 s, every 6–20 s at −16 dB. Espresso: HPF noise swell 2 s every 60–180 s at −12 dB. Intelligibility must be zero: no vowel holds > 200 ms.
  - library: 3 voices from the same babble at −12 dB, LPF 1.2 kHz, page turns (100 ms noise burst, −18 dB, every 20–60 s), HVAC brown bed.
  - cabin: brown bed + 95 Hz and 190 Hz sines at −12 dB with ±3 % slow pitch wander + pink air at LPF 2 kHz, gain wander ±2 dB over 20 s.
  - fan: 50 Hz-harmonic hum (50/100/150/200 sines, −18 dB) + pink bed LPF 3 kHz + shallow 22 Hz AM depth 8 %.
  - `engine.start()`: resume context, 55 Hz sine swell 4 s at −12 dB (the signature), master fade-in 6 s.
- Contract: §4 Engine API and `SoundSource`. `SOURCES` map exported from `src/audio/sources/index.ts`; leave four keys (`drone`, `lofi`, `plucks`, `tone`) as imports from `../music/register` which task 4 provides (task 3 stubs that file with an empty export so the build passes).
- Boundaries: no UI, no visual, no music sources. Do not touch `src/state/*`.
- DoD: `npm run check` 0; `scripts/audio-harness.html` (dev only, plain page) plays each source for 20 s through the engine with no console errors; `node scripts/smoke.mjs` (from task 9) later imports `SOURCES` and asserts 15 keys. Fable listens via `npm run dev` in the Browser pane and reports subjective pass per source in the PR body.

### Task 4: Generative music, tone layer, Focus Boost
- Model: fable · Effort: high · Depends on: 1
- Goal: drone, lofi, plucks and tone play endlessly without measurable repetition; Focus Boost depth audibly modulates only the music layer.
- Context: scale.ts = Dorian and Lydian pitch sets, root chosen once per session from A-flat to C. Scheduler: look-ahead as in task 3. Reverb: `ConvolverNode` with a synthesised IR (exponentially decayed noise, 2.5 s, LPF over time). Tape: LPF 4–8 kHz by `lofi.tape`, wow = `DelayNode` 8 ms modulated 0.4 Hz ±0.3 ms, saturation `WaveShaperNode` tanh table. Sidechain: pad gain envelope dips by `lofi.pump` on each kick, 250 ms recovery.
  - drone: 6 voices (2 sine, 2 triangle, 2 saw at −10 dB), detune ±7 cents, LPF 900 Hz with 0.05 Hz LFO, chord voicing changes every 30–90 s by moving one voice a step with 8 s glide; no attack faster than 4 s.
  - lofi: kick (sine 60 Hz, pitch drop from 120 in 40 ms, 300 ms decay), snare (noise burst BPF 1.8 kHz 120 ms + sine 180 Hz), hat (HPF 8 kHz noise 40 ms), swing 56 %, pattern varies per bar from a 4-pattern pool, `lofi.bpm` 60–100; Rhodes-ish chords (2-op FM, ratio 1:2, index low) every 2 bars from ii–V–I–vi in the session scale; emit `beat` on kicks via a callback that levels.ts folds into `LevelFrame.beat`.
  - plucks: Karplus–Strong (delay + LPF feedback) pentatonic notes, Poisson every 4–12 s, velocity −20…−12 dB, wide reverb; occasional two-note dyads.
  - tone: sine at `tone.freq` crossfaded with a bandpassed pink noise whose Q maps from `tone.width` (width 0 → sine only; 1 → Q 0.5); output −18 dB max. UI copy for this layer is owned by task 6 and must never use medical words; task 4 only names the source “Tone”.
  - focusboost.ts: one `GainNode` in the music layer path whose gain = 1 − depth/2 + (depth/2)·sin(2π·rateHz·t) implemented as `OscillatorNode` → `GainNode(depth/2)` → gain.param with base 1 − depth/2; ramps on change 1 s; applied only to layers whose family is `music`.
- Contract: `src/audio/music/register.ts` exports `{ drone, lofi, plucks, tone }: Record<..., SourceFactory>` and `focusBoostNode(ctx): { input: AudioNode; output: AudioNode; set(fb: FocusBoost): void }`. Uses the `SoundSource` interface from §4 exactly; if task 3 has not merged yet, copy the interface into `music/types.ts` and task 9 dedupes.
- Boundaries: no edits to task 3 files except `register.ts` stub replacement.
- DoD: `npm run check` 0; harness plays each of the four for 60 s; a 3-minute recording of lofi shows no identical consecutive bars (assert via scheduler log in the harness console).

### Task 5: Tunnel shader, renderer, audio-reactive mapping
- Model: fable · Effort: high · Depends on: 1
- Goal: fullscreen tunnel at 60 fps on an integrated GPU, colour and geometry shift per family, breathes with the sound, freezes on pause and on reduced motion.
- Context: raw WebGL2, one fullscreen triangle, one fragment shader. Uniforms: `uTime`, `uRes`, `uSpeed` (0 when still), `uFamily[7]` weights, `uLevels` (vec4 rms/low/mid/high), `uBeat`, `uDither` (Bayer 8×8 constant array or 1 texture), `uDpr`. Render at `min(devicePixelRatio, 1.5)`, halve the resolution on mobile widths < 600 px. Pause the rAF loop entirely when motion is `still` (draw one frame, then stop) and when the tab is hidden. Shader sketch: polar transform `(r, θ)` from centre, depth `z = 1/r`, ring pattern `fract(z·k − uTime·uSpeed)`, thin lines with `smoothstep`, subtle θ-noise per family (water: sinusoidal wobble on θ; place: `abs(cos θ) + abs(sin θ)` rectangularisation; noise: hash grain added to line brightness; fire: rising point sprites from hash on (θ, z + time); music: line width pulses with `uBeat`; tone: a single axial line, rings fade). Starfield: 2 layers of hashed points drifting in z. Post: phosphor bloom by widening lines slightly with a dimmer copy, scanline `0.96 + 0.04·sin(y·π)`, Bayer dither before quantising to 24 levels. Family hues (only non-brand colours allowed): water `#3a7bd5`, air `#cccccc` (haze), fire `#e08a1e`, noise `#cd0000`, place `#b39a7a`, music `#a7bebe`, tone `#f6f6f6`. Blend hues by family weights; lines at hue, background stays Void; max line brightness 0.85 so text on top is always legible.
- Reactive mapping (subtle; user is meditating): `uSpeed = base(family) × (0.9 + 0.2·low)`; line brightness ×(0.92 + 0.12·rms); grain density ×(1 + 0.5·high) noise-family only; `uBeat` decays from 1 over 300 ms and adds +0.3 line width in music family only. Cap all modulations so nothing changes more than 15 % frame to frame. `decelerating`: ease `uSpeed` to 0 over 8 s with cubic ease-out, then emit nothing (renderer stops the loop). `families.ts` derives weights from `AppState.layers`: weight ∝ effective volume (0 if muted or 'none'), normalised; empty state → 'noise' 0 and a neutral gray tunnel.
- Contract: §4 Renderer API. Reads bus only; never reads store directly (task 9 forwards `state:changed`).
- Boundaries: no UI, no DOM other than the canvas; no three.js.
- DoD: `npm run check` 0; dev harness page renders; Fable screenshots in the Browser pane at 1440 px and 375 px, reports fps from a 5 s `requestAnimationFrame` counter ≥ 58 on the dev machine; reduced-motion emulated via `resize_window colorScheme`/`matchMedia` override shows a still frame.

### Task 6: UI shell, mixer, master, transport, keyboard
- Model: sonnet · Effort: medium · Depends on: 2
- Goal: one screen: play button, four layer cards, master slider with band label, preset row, Focus Boost slider, everything keyboard-reachable and screen-reader labelled.
- Context: Geist Pixel everywhere; Chalk on Void; red only for the primary border and one large heading; small red text uses `--red-text`. Layout: canvas fixed behind, UI in a single column ≤ 640 px centred on mobile, two columns ≥ 960 px (mixer left, presets/timer right). Native `<input type=range>` restyled; `<select>` for source pick grouped by family (`optgroup` labels: Noise, Water, Air, Fire, Places, Music, Tone). The “Tone” card copy: “A steady tone with adjustable pitch. Some people find it easier to work with one in the background.” Nothing else. Band labels: Whisper / Library / Workspace / Café / Too loud for focus, plus a one-line “estimate, depends on your device” note. When band is 'loud', label turns `--red-text`. Focus Boost slider label: “Focus Boost (pulse on music)” with a “may help some people sustain attention” hint (claims language from PDF §10).
- Contract: `mountApp(root)`; keyboard in shortcuts.ts: Space play/pause, ↑↓ master ±0.05, ←→ selected layer volume ±0.05, 1–6 presets in the order of `TaskPreset`, M mutes the selected layer, Escape closes any dialog; ignore when focus is in an input. Every write goes through `store.set`; UI re-renders from `store.subscribe` (diff by string key, no framework).
- Boundaries: no timer, onboarding, banner, footer (tasks 7, 8). Don't touch src/audio or src/visual.
- DoD: `npm run check` 0, `npm run build` 0; axe-like manual checklist in PR: every control has a label, focus ring visible, contrast ≥ 4.5:1 (Chalk/Void, Haze/Void, red-text/Void all pass; Slate on Void is decorative only).

### Task 7: Onboarding, session timer, break/resume ritual, sleep timer
- Model: sonnet · Effort: medium · Depends on: 2
- Goal: first visit shows welcome → 3-question quiz → tuned preset; timed sessions run the full work → descent → break → resume cycle; sleep timer fades out.
- Context: welcome text (≤ 120 words, typography skill): what it is, all sound generated in the browser, nothing leaves the device, results are personal and may vary by task. Quiz: task (6 presets minus sleep), space noise (quiet/home/office/varies), headphones/speakers. Skippable at every step; skip → 'deep-focus'. Never suggest silence. Session machine in `src/state/session.ts`: `startTimer(preset)`, `tick()` via `setInterval` 1 s + visibility-change resync from `phaseEndsAt`; phases: (warmup 10 min if `warmup`) → work → ending (20 s: call `engine.end(20)`, emit `visual:motion decelerating`) → break (apply a temporary break mix: stream .4 + wind .2, master 0.2, without overwriting the user's saved mix; `visual:motion still`) → resume-cue (10 s: `ui:toast` “Ready when you are”, canvas breathes once via `visual:motion running` at speed 0.3) → work again. Message during break: “Break. Back in mm:ss” in Chalk, large, centred, `aria-live=polite`. Sleep: `sleepEndsAt` → last 3 min fade master to 0, then `playback:'idle'`, `visual:motion still`.
- Contract: `mountTimer(root)`, `mountOnboarding(root)`; emits `session:phase`. Engine and renderer reached only via bus and a `deps` object injected by task 9: `setTimerDeps({ engine })`.
- Boundaries: no mixer edits; no audio code.
- DoD: `npm run check` 0; a dev flag `?fast=1` compresses all phases ×60 so one full 25/5 cycle runs in 30 s; prose files through typocheck.

### Task 8: Legal, compliance, footer, 404, PWA, README
- Model: sonnet · Effort: medium · Depends on: 1
- Goal: privacy page, notice banner, footer, styled 404, shortcuts page, OG meta, installable offline PWA, deploy instructions.
- Context: privacy.html in Libre Franklin Light, plain and true: no analytics, no cookies, localStorage only (list the key and what it holds), no third-party requests, fonts self-hosted, hosted on Cloudflare Pages (Cloudflare sees standard server logs), contact via sinaida.eu. Banner: one line “This site stores your settings in your browser and nothing else. Privacy” with a “Got it” button → `noticeDismissed`. Footer: Made by Sinaida Krivchenko (link sinaida.eu) · Privacy · GitHub (sinaida-space/infinite-voidsong) · Shortcuts · v{version from package.json via `import.meta.env`}. 404 in the brand system with a link home. OG: title “Infinite Voidsong”, description “Endless generated soundscapes for focused work.”, `og.png` 1200×630 Void with a red frame and Geist Pixel title rendered as SVG → PNG at build (or committed static). SW: precache build assets, network-first for HTML, cache-first for fonts; register only in production. README: what, stack, `npm ci && npm run build`, Cloudflare Pages steps (connect repo, build command `npm run build`, output `dist`, node 20), `_headers` note.
- Contract: `mountBanner(root)`, `mountFooter(root)`; `src/sw.ts` built via `vite-plugin`-free approach: plain `public/sw.js` with a build-time asset manifest written by a 20-line Vite plugin in `vite.config.ts` (coordinate with task 1's config: append, do not rewrite).
- Boundaries: no mixer, timer, audio, visual. Prose through typography skill; no medical language anywhere.
- DoD: `npm run build` 0; `npm run typo` clean; `dist/privacy.html`, `dist/404.html`, `dist/shortcuts.html`, `dist/sw.js`, `dist/og.png` present.

### Task 9: Integration, smoke script, glue
- Model: sonnet · Effort: high · Depends on: 2–8
- Goal: `npm run dev` gives the whole product; `npm run smoke` passes.
- Context: main.ts: create bus/store, renderer on `#tunnel`, engine lazily on first play (user gesture), forward `state:changed` to `engine.apply` and `renderer.setFamilies`, `session:phase` handling, reduced-motion listener, `?fast=1`. Resolve interface drift between tasks (types duplicated in task 4, `register.ts`).
- Contract: `scripts/smoke.mjs`: builds, then with Node only: asserts dist files exist, `_headers` contains `Content-Security-Policy`, index.html contains `og:title`, `<canvas id="tunnel">`, `<footer>`, and no banned font names; imports the built module graph is not required; parses `src/audio/sources/index.ts` for 15 source keys; exits non-zero on any miss.
- Boundaries: glue only; no new features.
- DoD: `npm run check && npm run build && npm run smoke` all 0; manual: play → hear swell → tunnel moves; pause → still.

### Tasks 10–11: Verifiers (sonnet, low)
Fresh context. Run exactly the DoD commands of their group, open the dev server in the Browser pane, report pass/fail per DoD line, nothing else.

### Task 12: Reviewer (opus, high)
Full diff: AudioContext/GL leaks on source swap, unbounded scheduler timers, CSP vs. worklet URLs, colour outside the brand in UI, any medical word (grep `tinnitus|therapy|clinical|treat`), any “proven/unlocks/fixes” claim, keyboard trap, `prefers-reduced-motion`, mobile layout at 375 px.

## 6. Token estimate

| Tier | Tasks | Work tokens | Spawn overhead (≈10k each) | Subtotal |
|------|-------|-------------|----------------------------|----------|
| haiku | 1 | 25k | 8k | 33k |
| sonnet | 2, 6, 7, 8, 9, 10, 11 | 350k | 70k | 420k |
| fable | 3, 4, 5 | 310k | 30k | 340k |
| opus | 12 | 60k | 10k | 70k |
| orchestrator (this plan, merges, tags, retries margin) | | 120k | | 120k |
| **Total** | | | ~118k (≈12 %) | **≈ 980k** |

Overhead stays well under the 1/3 ceiling. Retry reserve: one fable retry (100k) and one sonnet retry (60k) fit in a 1.2 M envelope.

## 7. Verification plan

```
npm ci
npm run check            # tsc --noEmit, expect exit 0, no output
npm run build            # vite build, expect dist/ with index, privacy, shortcuts, 404, sw.js, _headers
npm run smoke            # node scripts/smoke.mjs → "smoke: 12/12 ok"
npm run typo             # python3 ~/.claude/skills/typography/scripts/typocheck.py privacy.html index.html shortcuts.html README.md → no findings
npm run dev              # Browser pane: 1440 px and 375 px, play/pause, 25/5 with ?fast=1, prefers-reduced-motion
grep -rniE "tinnitus|therapy|clinical|proven|unlock" src index.html privacy.html   # expect no matches
git tag v0.1 after task 9 DoD; git tag v1.0 after task 12 sign-off
```
