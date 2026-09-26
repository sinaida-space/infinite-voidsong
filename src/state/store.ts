import type { AppState, LayerState } from './types';
import { isHarmonyMode } from './types';
import { bus } from './events';
import { loadPersisted, savePersisted } from './persist';
import { readHashState, writeHashState } from './url';

function defaultLayer(): LayerState {
  return { source: 'none', volume: 0.5, muted: false, params: {} };
}

function defaultState(): AppState {
  return {
    version: 1,
    playback: 'idle',
    layers: [defaultLayer(), defaultLayer(), defaultLayer(), defaultLayer()],
    master: { volume: 0.5 },
    focusBoost: { depth: 0, rateHz: 16 },
    preset: null,
    harmony: 'gentle',
    session: { timer: null, customWork: 40, customBreak: 8, phase: 'free', phaseEndsAt: null, warmup: false, sleepEndsAt: null },
    onboarded: false,
    noticeDismissed: false,
    reducedMotion: false,
  };
}

function readReducedMotion(): boolean {
  try {
    if (typeof matchMedia === 'function') {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    /* non-browser */
  }
  return false;
}

// The mixer used to offer one noise layer with a white ↔ brown tilt. Saved mixes
// and old links still carry it: it becomes the nearest fixed colour.
function migrateNoise(layers: AppState['layers']): AppState['layers'] {
  return layers.map((l) => {
    if (l.source !== 'noise') return l;
    const tilt = l.params['noise.tilt'] ?? 0.5;
    return { ...l, source: tilt < 0.33 ? 'white' : tilt < 0.66 ? 'pink' : 'brown', params: {} };
  }) as AppState['layers'];
}

function buildInitialState(): AppState {
  let state = defaultState();

  const persisted = loadPersisted();
  if (persisted) {
    state = {
      ...state,
      ...persisted,
      playback: 'idle',
      // Saved state from before Harmony existed keeps the music it always had.
      harmony: isHarmonyMode(persisted.harmony) ? persisted.harmony : 'off',
      session: { ...state.session, ...persisted.session, phaseEndsAt: null },
    };
  }

  // hash wins over storage
  const fromHash = readHashState();
  if (fromHash) {
    state = {
      ...state,
      layers: fromHash.layers,
      master: fromHash.master,
      focusBoost: fromHash.focusBoost,
      preset: fromHash.preset,
      // A link made before Harmony existed carries no field: it loads as 'off'.
      harmony: isHarmonyMode(fromHash.harmony) ? fromHash.harmony : 'off',
    };
  }

  state.layers = migrateNoise(state.layers);

  // reducedMotion always mirrors matchMedia on load, never persisted
  state.reducedMotion = readReducedMotion();

  return state;
}

type Listener = (s: AppState) => void;

function createStore() {
  let state = buildInitialState();
  const listeners = new Set<Listener>();

  function get(): AppState {
    return state;
  }

  function set(patch: Partial<AppState> | ((s: AppState) => AppState)): void {
    const prev = state;
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
    state = next;
    listeners.forEach((fn) => fn(state));
    bus.emit('state:changed', { prev, next });
    savePersisted(state);
    writeHashState({
      layers: state.layers,
      master: state.master,
      focusBoost: state.focusBoost,
      preset: state.preset,
      harmony: state.harmony,
    });
  }

  function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function reset(): void {
    set(() => defaultState());
  }

  return { get, set, subscribe, reset };
}

export const store = createStore();
