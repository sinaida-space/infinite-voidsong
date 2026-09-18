// Loads the noise AudioWorklet once per context and remembers whether it
// is available, so sources can fall back to buffer-loop noise when the
// module fails (old Safari, blocked CSP, file:// previews).
//
// `?worker&url` makes Vite bundle the TS worklet as a standalone worker
// script and hand back its URL: in dev it is served transformed from
// /src/audio/worklets/, in production it is emitted as a hashed asset next to
// the app. Both are same-origin, which satisfies `worker-src 'self' blob:`.
import noiseWorkletUrl from './noise.worklet.ts?worker&url';

const ready = new WeakSet<BaseAudioContext>();
const inFlight = new WeakMap<BaseAudioContext, Promise<boolean>>();

export const NOISE_PROCESSOR = 'voidsong-noise';

export function loadNoiseWorklet(ctx: BaseAudioContext): Promise<boolean> {
  if (ready.has(ctx)) return Promise.resolve(true);
  const pending = inFlight.get(ctx);
  if (pending) return pending;
  const p = ctx.audioWorklet
    .addModule(noiseWorkletUrl)
    .then(() => { ready.add(ctx); return true; })
    .catch((err: unknown) => {
      console.warn('[voidsong] noise worklet unavailable, using buffer noise', err);
      return false;
    });
  inFlight.set(ctx, p);
  return p;
}

export const hasNoiseWorklet = (ctx: BaseAudioContext): boolean => ready.has(ctx);
