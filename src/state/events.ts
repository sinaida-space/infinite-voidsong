import type { AppState, Phase } from './types';

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

class BusImpl implements Bus {
  private listeners = new Map<keyof EventMap, Set<(p: any) => void>>();

  on<K extends keyof EventMap>(k: K, fn: (p: EventMap[K]) => void): () => void {
    if (!this.listeners.has(k)) {
      this.listeners.set(k, new Set());
    }
    this.listeners.get(k)!.add(fn);
    return () => {
      this.listeners.get(k)?.delete(fn);
    };
  }

  emit<K extends keyof EventMap>(k: K, p: EventMap[K]): void {
    this.listeners.get(k)?.forEach(fn => fn(p));
  }
}

export const bus: Bus = new BusImpl();
