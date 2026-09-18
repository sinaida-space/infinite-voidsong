// Global beat hook: the lofi source reports every scheduled kick here so
// levels.ts can fold it into LevelFrame.beat without holding a source reference.
// `time` is the audio-clock time of the hit, up to ~300 ms ahead of "now".
type BeatListener = (time: number) => void;
const listeners = new Set<BeatListener>();

export function onBeat(fn: BeatListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitBeat(time: number): void {
  for (const fn of listeners) fn(time);
}
