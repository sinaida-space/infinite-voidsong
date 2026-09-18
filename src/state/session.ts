import type { AppState, Phase, TimerPreset } from './types';
import { store } from './store';
import { bus } from './events';

/** Engine surface the session machine drives. Task 9 injects the real AudioEngine adapter. */
export interface TimerEngine {
  end(fadeSec: number): Promise<void>;
  start(): Promise<void>;
  pause(fadeSec?: number): Promise<void>;
}

interface TimerDeps {
  engine: TimerEngine;
}

let deps: TimerDeps | null = null;

/** Injected by task 9 once the real audio engine exists. */
export function setTimerDeps(d: TimerDeps): void {
  deps = d;
}

function isFastMode(): boolean {
  try {
    return typeof location !== 'undefined' && /(?:^|[?&])fast=1(?:&|$)/.test(location.search);
  } catch {
    return false;
  }
}

const FAST_DIVISOR = 60;

/** Scales a real-world duration (ms) by 1/60 under `?fast=1`, floored so timers stay usable. */
function scaleMs(ms: number): number {
  return isFastMode() ? Math.max(50, Math.round(ms / FAST_DIVISOR)) : ms;
}

const SEC = 1000;
const MIN = 60 * SEC;

const WORK_MS: Record<TimerPreset, number> = {
  '25/5': 25 * MIN,
  '50/10': 50 * MIN,
  '90/15': 90 * MIN,
};
const BREAK_MS: Record<TimerPreset, number> = {
  '25/5': 5 * MIN,
  '50/10': 10 * MIN,
  '90/15': 15 * MIN,
};
const WARMUP_MS = 10 * MIN;
const ENDING_MS = 20 * SEC;
const RESUME_CUE_MS = 10 * SEC;
const SLEEP_FADE_MS = 3 * MIN;

/** Formats milliseconds as mm:ss, floored, never negative. */
export function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.round(ms / SEC));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// The user's own mix, kept aside in module memory (never persisted) while the break's
// temporary mix is in the store, so resume can restore exactly what they had.
let savedLayers: AppState['layers'] | null = null;
let savedMasterVolume: number | null = null;

function applyBreakMix(): void {
  const s = store.get();
  savedLayers = s.layers;
  savedMasterVolume = s.master.volume;
  store.set((st) => ({
    ...st,
    layers: [
      { source: 'stream', volume: 0.4, muted: false, params: {} },
      { source: 'wind', volume: 0.2, muted: false, params: {} },
      { source: 'none', volume: 0.5, muted: false, params: {} },
      { source: 'none', volume: 0.5, muted: false, params: {} },
    ],
    master: { volume: 0.2 },
  }));
}

function restoreMix(): void {
  if (!savedLayers || savedMasterVolume === null) return;
  const layers = savedLayers;
  const masterVolume = savedMasterVolume;
  savedLayers = null;
  savedMasterVolume = null;
  store.set((st) => ({ ...st, layers, master: { volume: masterVolume } }));
}

function setPhase(to: Phase, phaseEndsAt: number | null): void {
  const from = store.get().session.phase;
  store.set((st) => ({ ...st, session: { ...st.session, phase: to, phaseEndsAt } }));
  if (from !== to) bus.emit('session:phase', { from, to });
}

/** Begins a timed session for the given timer preset: warm-up (if set) then work. */
export function startTimer(preset: TimerPreset): void {
  const warmup = store.get().session.warmup;
  store.set((st) => ({ ...st, session: { ...st.session, timer: preset } }));
  if (warmup) {
    setPhase('warmup', Date.now() + scaleMs(WARMUP_MS));
  } else {
    setPhase('work', Date.now() + scaleMs(WORK_MS[preset]));
  }
}

/** Cancels any running timer, restores a break mix if one is active, returns to untimed/free. */
export function stopTimer(): void {
  restoreMix();
  store.set((st) => ({
    ...st,
    session: { ...st.session, timer: null, phase: 'free', phaseEndsAt: null, sleepEndsAt: null },
  }));
}

/** Sets the warm-up flag for the next timed session (creative-flow only, toggled from the UI). */
export function setWarmup(on: boolean): void {
  store.set((st) => ({ ...st, session: { ...st.session, warmup: on } }));
}

/** Sets or clears the sleep timer. `minutes` null/0 turns it off. */
export function setSleepTimer(minutes: number | null): void {
  const sleepEndsAt = minutes ? Date.now() + scaleMs(minutes * MIN) : null;
  store.set((st) => ({ ...st, session: { ...st.session, sleepEndsAt } }));
}

let sleepFadeStartVolume: number | null = null;

function tickSleep(now: number): void {
  const s = store.get();
  const endsAt = s.session.sleepEndsAt;
  if (endsAt === null) {
    sleepFadeStartVolume = null;
    return;
  }
  const remaining = endsAt - now;
  const fadeMs = scaleMs(SLEEP_FADE_MS);
  if (remaining <= 0) {
    sleepFadeStartVolume = null;
    store.set((st) => ({
      ...st,
      playback: 'idle',
      master: { volume: 0 },
      session: { ...st.session, sleepEndsAt: null },
    }));
    bus.emit('visual:motion', 'still');
    return;
  }
  if (remaining <= fadeMs) {
    if (sleepFadeStartVolume === null) sleepFadeStartVolume = s.master.volume;
    const t = 1 - remaining / fadeMs;
    const volume = Math.max(0, sleepFadeStartVolume * (1 - t));
    store.set((st) => ({ ...st, master: { volume } }));
  }
}

function advancePhase(now: number): void {
  const s = store.get();
  const { phase, phaseEndsAt, timer } = s.session;
  if (phaseEndsAt === null || now < phaseEndsAt || !timer) return;

  switch (phase) {
    case 'warmup':
      setPhase('work', now + scaleMs(WORK_MS[timer]));
      break;
    case 'work':
      deps?.engine.end(20).catch(() => {});
      bus.emit('visual:motion', 'decelerating');
      setPhase('ending', now + scaleMs(ENDING_MS));
      break;
    case 'ending':
      applyBreakMix();
      bus.emit('visual:motion', 'still');
      setPhase('break', now + scaleMs(BREAK_MS[timer]));
      break;
    case 'break':
      bus.emit('ui:toast', { text: 'Ready when you are', ms: 4000 });
      bus.emit('visual:motion', 'running');
      setPhase('resume-cue', now + scaleMs(RESUME_CUE_MS));
      break;
    case 'resume-cue':
      restoreMix();
      deps?.engine.start().catch(() => {});
      setPhase('work', now + scaleMs(WORK_MS[timer]));
      break;
    default:
      break;
  }
}

/** One tick of the session machine: sleep fade, then phase advancement. Runs every second. */
export function tick(): void {
  const now = Date.now();
  tickSleep(now);
  advancePhase(now);
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Catches up on phases missed while the tab was hidden/throttled, resyncing from phaseEndsAt. */
function resync(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  for (let i = 0; i < 12; i += 1) {
    const before = store.get().session.phaseEndsAt;
    tick();
    const after = store.get().session.phaseEndsAt;
    if (after === before) break;
  }
}

function init(): void {
  if (intervalHandle !== null) return;
  if (typeof setInterval === 'undefined') return;
  intervalHandle = setInterval(tick, 1000);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', resync);
  }
}

init();
