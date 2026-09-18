// scheduler.ts — look-ahead scheduler on the audio clock.
//
// A 100 ms setInterval wakes up and lets every task book events up to
// 300 ms ahead of `ctx.currentTime`. Events themselves are placed with the
// AudioParam / start(at) timing API, so timer jitter never reaches the
// sound. setTimeout is never used to *make* sound, only to wake the booker.

export type Task = (from: number, to: number) => void;

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tasks: Task[] = [];
  private booked = 0;               // audio time up to which tasks have been asked

  constructor(private readonly ctx: BaseAudioContext, private readonly horizon = 0.3, private readonly tickMs = 100) {}

  /** Raw task: gets asked to fill [from, to) windows, contiguous and non-overlapping. */
  add(task: Task): void { this.tasks.push(task); }

  /**
   * Repeating event. `gap()` returns seconds until the next event (called
   * after each fire, so Poisson / jittered rhythms are one-liners). `fire(t)`
   * places the event at audio time `t`. After a long stall (tab hidden,
   * context suspended) events are dropped, not replayed in a burst.
   */
  repeat(gap: () => number, fire: (t: number) => void, firstDelay = gap()): void {
    let next = -1;
    this.add((from, to) => {
      if (next < 0) next = from + firstDelay;
      if (next < from) next = from + Math.min(gap(), 0.05);   // stalled: resume near "now"
      while (next < to) { fire(next); next += Math.max(gap(), 0.001); }
    });
  }

  /**
   * Slow random walk of an AudioParam: chained linear ramps from one random
   * target to the next, each lasting `minDur..maxDur` seconds, so the value
   * is continuous and never jumps. `exp` uses exponential ramps (pitch, cutoff).
   */
  wander(param: AudioParam, lo: number, hi: number, minDur: number, maxDur: number, exp = false): void {
    let dur = minDur + Math.random() * (maxDur - minDur);
    let primed = false;
    this.repeat(() => dur, (t) => {
      if (!primed) { param.setValueAtTime(param.value, t); primed = true; }
      dur = minDur + Math.random() * (maxDur - minDur);
      const target = lo + Math.random() * (hi - lo);
      if (exp) param.exponentialRampToValueAtTime(Math.max(target, 1e-4), t + dur);
      else param.linearRampToValueAtTime(target, t + dur);
    }, 0);
  }

  start(): void {
    if (this.timer) return;
    this.booked = this.ctx.currentTime;
    const tick = () => {
      const to = this.ctx.currentTime + this.horizon;
      if (to <= this.booked) return;
      const from = this.booked;
      this.booked = to;
      for (const task of this.tasks) task(from, to);
    };
    tick();
    this.timer = setInterval(tick, this.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose(): void { this.stop(); this.tasks.length = 0; }
}
