import type { AppState, LayerState, SessionState, SourceId, TaskPreset, TimerPreset } from './types';
import { store } from './store';

export interface PresetContext {
  noise: 'quiet' | 'home' | 'office' | 'varies';
  output: 'headphones' | 'speakers';
}

interface PresetLayerDef {
  source: SourceId;
  volume: number;
  params?: Record<string, number>;
}

interface PresetDef {
  layers: [PresetLayerDef, PresetLayerDef, PresetLayerDef, PresetLayerDef];
  master: number;
  boost: number;
  timer: TimerPreset | null;
  warmup?: boolean;
  sleepMinutes?: number;
}

const none = (): PresetLayerDef => ({ source: 'none', volume: 0.5 });

export const PRESET_TABLE: Record<TaskPreset, PresetDef> = {
  'deep-focus': {
    layers: [
      { source: 'noise', volume: 0.55, params: { 'noise.tilt': 0.6 } },
      { source: 'rain', volume: 0.35 },
      { source: 'drone', volume: 0.3 },
      none(),
    ],
    master: 0.5,
    boost: 0.3,
    timer: '50/10',
  },
  'reading-writing': {
    layers: [
      { source: 'noise', volume: 0.4, params: { 'noise.tilt': 0.8 } },
      { source: 'stream', volume: 0.3 },
      none(),
      none(),
    ],
    master: 0.4,
    boost: 0,
    timer: '25/5',
  },
  'creative-flow': {
    layers: [
      { source: 'cafe', volume: 0.5 },
      { source: 'lofi', volume: 0.45, params: { 'lofi.bpm': 84 } },
      none(),
      none(),
    ],
    master: 0.65,
    boost: 0,
    timer: '90/15',
  },
  routine: {
    layers: [
      { source: 'house', volume: 0.5, params: { 'house.bpm': 100 } },
      { source: 'fan', volume: 0.3 },
      none(),
      none(),
    ],
    master: 0.55,
    boost: 0.2,
    timer: '50/10',
  },
  'break-restore': {
    layers: [
      { source: 'stream', volume: 0.45 },
      { source: 'wind', volume: 0.3 },
      { source: 'plucks', volume: 0.25 },
      none(),
    ],
    master: 0.3,
    boost: 0,
    timer: null,
  },
  sleep: {
    layers: [
      { source: 'rain', volume: 0.4 },
      { source: 'underwater', volume: 0.35 },
      { source: 'noise', volume: 0.25, params: { 'noise.tilt': 1 } },
      none(),
    ],
    master: 0.2,
    boost: 0,
    timer: null,
    sleepMinutes: 45,
  },
};

function toLayerState(def: PresetLayerDef): LayerState {
  return { source: def.source, volume: def.volume, muted: false, params: { ...(def.params ?? {}) } };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Fills the four layers, master, focusBoost, preset id and session/timer from the preset table, adjusted by context. */
export function applyPreset(id: TaskPreset, ctx?: PresetContext): void {
  const def = PRESET_TABLE[id];
  const layers = def.layers.map(toLayerState) as [LayerState, LayerState, LayerState, LayerState];
  let master = def.master;

  if (ctx?.noise === 'office') {
    layers[0] = { ...layers[0], volume: clamp01(layers[0].volume + 0.15) };
    if (!layers.some((l) => l.source === 'noise')) {
      const emptyIdx = layers.findIndex((l) => l.source === 'none');
      if (emptyIdx !== -1) {
        layers[emptyIdx] = { source: 'noise', volume: 0.3, muted: false, params: { 'noise.tilt': 0.5 } };
      }
    }
  } else if (ctx?.noise === 'quiet') {
    layers[0] = { ...layers[0], volume: clamp01(layers[0].volume - 0.1) };
  }

  if (ctx?.output === 'speakers') {
    master = clamp01(master - 0.05);
  }

  const session = {
    timer: def.timer,
    phase: 'free' as const,
    phaseEndsAt: null,
    warmup: def.warmup ?? false,
    sleepEndsAt: def.sleepMinutes ? Date.now() + def.sleepMinutes * 60000 : null,
  } satisfies Omit<SessionState, 'customWork' | 'customBreak'>;

  store.set(
    (s: AppState): AppState => ({
      ...s,
      layers,
      master: { volume: master },
      focusBoost: { depth: def.boost, rateHz: s.focusBoost.rateHz || 16 },
      preset: id,
      // A preset never overwrites the user's own custom session lengths.
      session: { ...session, customWork: s.session.customWork, customBreak: s.session.customBreak },
    }),
  );
}
