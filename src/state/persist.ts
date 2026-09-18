import type { AppState } from './types';

const STORAGE_KEY = 'voidsong:v1';
const DEBOUNCE_MS = 300;

let debounceHandle: ReturnType<typeof setTimeout> | null = null;

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Reads persisted state from localStorage. Migration: version !== 1 -> null (reset). */
export function loadPersisted(): AppState | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeNow(state: AppState): void {
  if (!hasLocalStorage()) return;
  try {
    // playback and session.phaseEndsAt are never persisted; session restarts idle on load.
    const toSave: AppState = {
      ...state,
      playback: 'idle',
      session: { ...state.session, phaseEndsAt: null },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* storage unavailable, full, or blocked */
  }
}

/** Debounced (300 ms) write to localStorage. */
export function savePersisted(state: AppState): void {
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => writeNow(state), DEBOUNCE_MS);
}
