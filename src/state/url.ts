import type { FocusBoost, HarmonyMode, LayerState, MasterState, TaskPreset } from './types';

export interface HashPayload {
  layers: [LayerState, LayerState, LayerState, LayerState];
  master: MasterState;
  focusBoost: FocusBoost;
  preset: TaskPreset | null;
  harmony?: HarmonyMode;   // absent in links made before Harmony existed
}

function toBase64Url(json: string): string {
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  return decodeURIComponent(escape(atob(b64)));
}

/** Encodes layers+master+focusBoost+preset as `#v1.<base64url json>`. */
export function encodeHash(payload: HashPayload): string {
  return `#v1.${toBase64Url(JSON.stringify(payload))}`;
}

/** Decodes a `#v1.<base64url json>` hash back into a HashPayload, or null if malformed. */
export function decodeHash(hash: string): HashPayload | null {
  const match = /^#?v1\.(.+)$/.exec(hash);
  if (!match) return null;
  try {
    return JSON.parse(fromBase64Url(match[1])) as HashPayload;
  } catch {
    return null;
  }
}

function hasLocation(): boolean {
  try {
    return typeof location !== 'undefined';
  } catch {
    return false;
  }
}

/** Reads and decodes the current location.hash, guarded for non-browser environments. */
export function readHashState(): HashPayload | null {
  if (!hasLocation()) return null;
  const hash = location.hash;
  if (!hash) return null;
  return decodeHash(hash);
}

/** Writes the encoded hash to location without adding a history entry. */
export function writeHashState(payload: HashPayload): void {
  if (!hasLocation() || typeof history === 'undefined') return;
  try {
    history.replaceState(null, '', encodeHash(payload));
  } catch {
    /* non-browser or restricted environment */
  }
}
