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

// Which work/break cycle of the running session this is (1 for the first).
let cycle = 1;
export function getCycle(): number {
  return cycle;
}

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

const PRESET_WORK_MIN = { '25/5': 25, '50/10': 50, '90/15': 90 } as const;
const PRESET_BREAK_MIN = { '25/5': 5, '50/10': 10, '90/15': 15 } as const;

/** Limits for the user's own session, in minutes. */
export const CUSTOM_WORK_RANGE = { min: 1, max: 240 } as const;
export const CUSTOM_BREAK_RANGE = { min: 1, max: 60 } as const;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Nominal (unscaled) work and break lengths in ms for a timer choice. */
function lengthsMs(timer: TimerPreset): { work: number; brk: number } {
  if (timer === 'custom') {
    const s = store.get().session;
    return {
      work: clampInt(s.customWork, CUSTOM_WORK_RANGE.min, CUSTOM_WORK_RANGE.max, 40) * MIN,
      brk: clampInt(s.customBreak, CUSTOM_BREAK_RANGE.min, CUSTOM_BREAK_RANGE.max, 8) * MIN,
    };
  }
  return { work: PRESET_WORK_MIN[timer] * MIN, brk: PRESET_BREAK_MIN[timer] * MIN };
}
const workMs = (t: TimerPreset): number => lengthsMs(t).work;
const breakMs = (t: TimerPreset): number => lengthsMs(t).brk;
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
  restoreMix(); // a restart from the break must not leave the break mix behind
  cycle = 1;
  const warmup = store.get().session.warmup;
  store.set((st) => ({ ...st, session: { ...st.session, timer: preset } }));
  if (warmup) {
    setPhase('warmup', Date.now() + scaleMs(WARMUP_MS));
  } else {
    setPhase('work', Date.now() + scaleMs(workMs(preset)));
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

/**
 * Sets the work and break minutes of the 'custom' session. If a custom session
 * is running it restarts with the new lengths, because the timeline's two
 * segments change size.
 */
export function setCustomDurations(workMin: number, breakMin: number): void {
  const customWork = clampInt(workMin, CUSTOM_WORK_RANGE.min, CUSTOM_WORK_RANGE.max, 40);
  const customBreak = clampInt(breakMin, CUSTOM_BREAK_RANGE.min, CUSTOM_BREAK_RANGE.max, 8);
  store.set((st) => ({ ...st, session: { ...st.session, customWork, customBreak } }));
  const s = store.get().session;
  if (s.timer === 'custom' && s.phase !== 'free') startTimer('custom');
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
      setPhase('work', now + scaleMs(workMs(timer)));
      break;
    case 'work':
      deps?.engine.end(20).catch(() => {});
      bus.emit('visual:motion', 'decelerating');
      setPhase('ending', now + scaleMs(ENDING_MS));
      break;
    case 'ending':
      applyBreakMix();
      bus.emit('visual:motion', 'still');
      setPhase('break', now + scaleMs(breakMs(timer)));
      break;
    case 'break':
      bus.emit('ui:toast', { text: 'Ready when you are', ms: 4000 });
      bus.emit('visual:motion', 'running');
      setPhase('resume-cue', now + scaleMs(RESUME_CUE_MS));
      break;
    case 'resume-cue':
      restoreMix();
      deps?.engine.start().catch(() => {});
      cycle += 1;
      setPhase('work', now + scaleMs(workMs(timer)));
      break;
    default:
      break;
  }
}

// --- timeline ----------------------------------------------------------------
// One cycle drawn as two segments, work then break. Positions are in nominal
// milliseconds (what the labels show), even under ?fast=1 where real time runs 60x quicker.

export interface TimelineInfo {
  workMs: number;      // nominal length of the work segment
  breakMs: number;     // nominal length of the break segment
  posMs: number;       // playhead, 0..workMs+breakMs
  phase: Phase;
  seekable: boolean;   // false during the warm-up
}

/** The running session as a timeline, or null when untimed (or sleeping). */
export function getTimeline(now = Date.now()): TimelineInfo | null {
  const s = store.get().session;
  if (!s.timer || s.phase === 'free' || s.phase === 'sleep') return null;
  const { work, brk } = lengthsMs(s.timer);
  const workReal = scaleMs(work);
  const breakReal = scaleMs(brk);
  const remaining = s.phaseEndsAt === null ? 0 : Math.max(0, s.phaseEndsAt - now);
  let pos = 0;
  switch (s.phase) {
    case 'work':
      pos = Math.min(work, ((workReal - remaining) / workReal) * work);
      break;
    case 'ending':
      pos = work;
      break;
    case 'break':
      pos = work + Math.min(brk, ((breakReal - remaining) / breakReal) * brk);
      break;
    case 'resume-cue':
      pos = work + brk;
      break;
    default: // warmup
      pos = 0;
  }
  return { workMs: work, breakMs: brk, posMs: Math.max(0, pos), phase: s.phase, seekable: s.phase !== 'warmup' };
}

/**
 * Jumps the running session to a point on the timeline. Into the work segment
 * it restores the user's mix and brings the sound back; into the break segment
 * it swaps to the quiet break mix, exactly as the normal transitions do.
 */
export function seekTimeline(nominalPosMs: number): void {
  const info = getTimeline();
  const timer = store.get().session.timer;
  if (!info || !info.seekable || !timer) return;
  const { workMs: work, breakMs: brk } = info;
  const pos = Math.min(work + brk - 1000, Math.max(0, nominalPosMs));
  const now = Date.now();
  const phase = info.phase;

  if (pos < work) {
    if (phase !== 'work') {
      restoreMix();
      deps?.engine.start().catch(() => {});
      bus.emit('visual:motion', 'running');
    }
    setPhase('work', now + scaleMs(work - pos));
  } else {
    if (phase !== 'break') {
      if (savedLayers === null) applyBreakMix();
      bus.emit('visual:motion', 'still');
    }
    setPhase('break', now + scaleMs(brk - (pos - work)));
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
