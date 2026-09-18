import type { AppState, LayerState } from './types';
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
    session: { timer: null, phase: 'free', phaseEndsAt: null, warmup: false, sleepEndsAt: null },
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

function buildInitialState(): AppState {
  let state = defaultState();

  const persisted = loadPersisted();
  if (persisted) {
    state = {
      ...state,
      ...persisted,
      playback: 'idle',
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
    };
  }

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
