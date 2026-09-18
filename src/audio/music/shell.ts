// Lifecycle shared by all four music sources: an output gain that fades in on
// start() and out on stop(), a scheduler, a node bag, and teardown. Sources add
// their DSP graph on top and feed `shell.out`.
import { NodeBag, ramp } from './util';
import { Scheduler } from './scheduler';

export interface Shell {
  readonly out: GainNode;
  readonly bag: NodeBag;
  readonly sched: Scheduler;
  readonly stopped: boolean;
  start(at: number): void;
  stop(at: number): void;
  dispose(): void;
}

export function makeShell(ctx: AudioContext, opts: { level: number; fadeIn: number; fadeOut: number }, onDispose?: () => void): Shell {
  const bag = new NodeBag();
  const sched = new Scheduler(ctx);
  const out = bag.add(ctx.createGain());
  out.gain.value = 0;
  let stopped = false;
  let disposeTimer: number | null = null;

  const shell: Shell = {
    out, bag, sched,
    get stopped() { return stopped; },
    start(at) {
      ramp(out.gain, opts.level, Math.max(at, ctx.currentTime), opts.fadeIn);
    },
    stop(at) {
      // Fade >= 2 s (the source picks its own, longer for the drone), then
      // tear down. The teardown timer is plain housekeeping, not audio timing.
      stopped = true;
      const t = Math.max(at, ctx.currentTime);
      ramp(out.gain, 0, t, opts.fadeOut);
      const ms = (t - ctx.currentTime + opts.fadeOut) * 1000 + 100;
      disposeTimer = window.setTimeout(() => shell.dispose(), ms);
    },
    dispose() {
      if (disposeTimer !== null) { clearTimeout(disposeTimer); disposeTimer = null; }
      stopped = true;
      sched.cancel();
      onDispose?.();
      bag.disposeAll();
    },
  };
  return shell;
}
