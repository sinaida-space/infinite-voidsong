// Look-ahead scheduler on the audio clock (task 3 rule: 100 ms tick, 300 ms horizon).
// A JS interval wakes up every `tickMs`; each lane's step() is called for every
// event that falls inside the horizon and schedules it on the audio clock with
// a precise `time`. Timing precision therefore comes from the AudioContext,
// never from the interval; the interval only has to be more frequent than the
// horizon so a late tick does not miss an event.

export type Step = (time: number) => number | null;   // returns the next event time, or null to end the lane

interface Lane { next: number; step: Step; }

export class Scheduler {
  private lanes = new Map<number, Lane>();
  private timer: number | null = null;
  private nextId = 0;

  constructor(private ctx: AudioContext, private tickMs = 100, private horizonSec = 0.3) {}

  // Start a lane whose first event is at `first` (audio time). Returns a canceller.
  add(first: number, step: Step): () => void {
    const id = this.nextId++;
    this.lanes.set(id, { next: first, step });
    if (this.timer === null) {
      this.timer = window.setInterval(this.tick, this.tickMs);
      this.tick();   // do not wait a full tick for the first event
    }
    return () => { this.lanes.delete(id); };
  }

  cancel(): void {
    this.lanes.clear();
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private tick = (): void => {
    const limit = this.ctx.currentTime + this.horizonSec;
    for (const [id, lane] of this.lanes) {
      while (lane.next < limit) {
        const next = lane.step(lane.next);
        // A lane that does not move forward would spin forever; treat it as finished.
        if (next === null || !(next > lane.next)) { this.lanes.delete(id); break; }
        lane.next = next;
      }
    }
  };
}
