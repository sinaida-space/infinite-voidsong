// Infinite Voidsong — main entry point
//
// Wires the modules built in tasks 1–8 together: creates the renderer and
// the store-driven UI, then creates the audio engine lazily on the first
// user gesture (Play, or onboarding's Begin/Skip) so autoplay policies
// never block it. Everything else — family weights, levels, motion inside
// a timed session — is already pushed over `bus` by the modules themselves;
// this file only bridges the two things nothing else owns: engine.apply on
// every state change, and playback ↔ visual motion.
import { bus } from './state/events';
import { store } from './state/store';
import { setTimerDeps } from './state/session';
import type { AppState } from './state/types';
import { AudioEngine } from './audio/engine';
import { TunnelRenderer } from './visual/renderer';
import { mountApp } from './ui/app';
import { attachLook } from './visual/look';
import { mountOnboarding, showWelcome } from './ui/onboarding';
import { mountTimer } from './ui/timer';
import { mountToast } from './ui/ritual';
import { mountBanner } from './ui/banner';
import { mountMediaSession } from './ui/mediasession';
import { mountFooter } from './ui/footer';
import { mountGuide, openGuide } from './ui/guide';

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} missing from index.html`);
  return found;
}

// --- renderer ----------------------------------------------------------------

const renderer = new TunnelRenderer(el('tunnel') as HTMLCanvasElement, bus);
attachLook(renderer); // mouse on desktop, tilt on phones
if (!renderer.available) document.documentElement.dataset.gl = 'off'; // dark ground when there is no tunnel to paint over the red one

// --- UI mounts -----------------------------------------------------------------

mountApp(el('app'));
mountOnboarding();
mountTimer();
mountToast(); // the one toast renderer (ritual.ts) — see the note in ui/app.ts
mountBanner(el('banner'), {
  initiallyDismissed: store.get().noticeDismissed,
  onDismiss: () => store.set({ noticeDismissed: true }),
});
mountFooter(el('footer'), { onWelcome: showWelcome });
mountGuide(el('guide'));
mountMediaSession();

// `/?welcome=1` (footer link on the other pages) reopens the welcome screen.
if (new URLSearchParams(location.search).get('welcome') === '1') {
  history.replaceState(null, '', location.pathname + location.hash);
  showWelcome();
}

// Exposed for task 15's GUIDE button / `?` key, and reachable from the dev
// console in the meantime: `openGuide()`.
if (import.meta.env.DEV) {
  (window as unknown as { openGuide: typeof openGuide }).openGuide = openGuide;
}

// --- audio engine: created lazily on the first play (a real user gesture) ------

let engine: AudioEngine | null = null;
let startingPromise: Promise<void> | null = null;

function getOrCreateEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine(bus);
  return engine;
}

/** Resolves once the engine is running and `playback` has flipped to 'playing'. Idempotent while in flight. */
function beginPlayback(): Promise<void> {
  if (!startingPromise) {
    const e = getOrCreateEngine();
    startingPromise = e
      .start()
      .then(() => {
        store.set({ playback: 'playing' });
      })
      .finally(() => {
        startingPromise = null;
      });
  }
  return startingPromise;
}

// The session machine (state/session.ts) drives the engine directly on phase
// changes (end of work, resume-cue); it only knows the small TimerEngine
// shape, not the real class, and is constructed before the engine exists —
// so this proxy defers to whichever engine instance is current.
setTimerDeps({
  engine: {
    start: () => beginPlayback(),
    pause: (fadeSec?: number) => (engine ? engine.pause(fadeSec) : Promise.resolve()),
    end: (fadeSec: number) => (engine ? engine.end(fadeSec) : Promise.resolve()),
  },
});

// --- state → engine / motion ----------------------------------------------------

let prevPlayback: AppState['playback'] | null = null;

store.subscribe((state) => {
  if (engine) engine.apply(state);

  if (state.playback !== prevPlayback) {
    prevPlayback = state.playback;
    if (state.playback === 'starting') {
      beginPlayback().catch(() => {
        // start() threw (e.g. AudioContext refused to resume): don't strand the UI on "Pause".
        store.set({ playback: 'idle' });
      });
    } else if (state.playback === 'paused') {
      getOrCreateEngine().pause().catch(() => {});
      bus.emit('visual:motion', 'still');
    } else if (state.playback === 'idle') {
      bus.emit('visual:motion', 'still');
    } else if (state.playback === 'playing') {
      bus.emit('visual:motion', 'running');
    }
    // Note: playback stays 'playing' through a timed session's warmup/work/ending/break/
    // resume-cue arc, so this block never fires mid-session — state/session.ts owns
    // 'visual:motion' (decelerating/still/running) for that whole stretch undisturbed.
  }
});

// --- reduced motion --------------------------------------------------------------

function applyReducedMotion(matches: boolean): void {
  renderer.setReducedMotion(matches);
  store.set({ reducedMotion: matches });
}

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
reducedMotionQuery.addEventListener('change', (e) => applyReducedMotion(e.matches));

// --- service worker: production only --------------------------------------------

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is a nicety, not a requirement */
    });
  });
}
