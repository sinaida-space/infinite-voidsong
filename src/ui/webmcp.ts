// WebMCP: real site actions for an AI agent that lives in the browser.
//
// Uses the draft `navigator.modelContext` API (Chrome for now) the same way
// sinaida.eu does, and does nothing at all where it does not exist. Tools act
// on the same store the interface uses, so an agent does exactly what a visitor
// could do. Sound still needs one tap from a person (browsers block audio
// otherwise), and volume set by an agent is capped below the "too loud" band.

import { store } from '../state/store';
import { applyPreset, PRESET_TABLE } from '../state/presets';
import { startTimer, stopTimer, setCustomDurations, setWarmup, getTimeline } from '../state/session';
import type { TaskPreset, TimerPreset } from '../state/types';

const MODE_INFO: Record<TaskPreset, string> = {
  'deep-focus': 'Steady noise, soft rain and a low drone. For analysis and coding.',
  'reading-writing': 'Quiet noise and running water, no music. For reading and writing.',
  'creative-flow': 'Café murmur and easy lo-fi beats, a little louder. For ideas.',
  routine: 'Upbeat house and a fan hum. For admin and repetitive tasks.',
  'break-restore': 'Stream, wind and soft plucks at a low level. For a real pause.',
  sleep: 'Rain and deep muffled tones that fade out after 45 minutes.',
};

const SESSIONS: TimerPreset[] = ['25/5', '50/10', '90/15', 'custom'];
const MAX_AGENT_VOLUME = 0.7; // below the "too loud for focus" band (0.8)

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

type ModelContext = { registerTool: (tool: ToolDef, opts: { signal: AbortSignal }) => void };

function snapshot(): Record<string, unknown> {
  const s = store.get();
  const tl = getTimeline();
  return {
    playback: s.playback,
    mode: s.preset,
    layers: s.layers.filter((l) => l.source !== 'none').map((l) => ({ source: l.source, volume: l.volume, muted: l.muted })),
    masterVolume: s.master.volume,
    session: {
      timer: s.session.timer,
      phase: s.session.phase,
      customWorkMinutes: s.session.customWork,
      customBreakMinutes: s.session.customBreak,
      positionSeconds: tl ? Math.round(tl.posMs / 1000) : null,
      workSeconds: tl ? Math.round(tl.workMs / 1000) : null,
      breakSeconds: tl ? Math.round(tl.breakMs / 1000) : null,
    },
  };
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function registerWebMcp(): void {
  const modelContext = (navigator as { modelContext?: ModelContext }).modelContext;
  if (!modelContext?.registerTool) return;

  const controller = new AbortController();
  const add = (tool: ToolDef): void => modelContext.registerTool(tool, { signal: controller.signal });

  add({
    name: 'list_modes',
    description: 'List the sound modes (deep-focus, reading-writing, creative-flow, routine, break-restore, sleep) with what each plays and what it suits.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => (Object.keys(PRESET_TABLE) as TaskPreset[]).map((id) => ({ id, description: MODE_INFO[id], usualSession: PRESET_TABLE[id].timer })),
  });

  add({
    name: 'get_state',
    description: 'Report what is playing: the mode, the active layers, the master volume and the timed session (phase and position).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => snapshot(),
  });

  add({
    name: 'apply_mode',
    description: 'Load a sound mode into the four layers. Does not start sound by itself. Optionally say how noisy the room is and how the person listens, which adjusts the mix a little.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: Object.keys(PRESET_TABLE) },
        space: { type: 'string', enum: ['quiet', 'home', 'office', 'varies'], description: 'How noisy the room is.' },
        listening: { type: 'string', enum: ['headphones', 'speakers'] },
      },
      required: ['mode'],
    },
    execute: async (input) => {
      const mode = input.mode as TaskPreset;
      if (!(mode in PRESET_TABLE)) return { error: `Unknown mode: ${String(input.mode)}` };
      applyPreset(mode, {
        noise: (input.space as 'quiet' | 'home' | 'office' | 'varies') ?? 'home',
        output: (input.listening as 'headphones' | 'speakers') ?? 'headphones',
      });
      return snapshot();
    },
  });

  add({
    name: 'start_session',
    description: 'Start a timed work-and-break session: 25/5, 50/10, 90/15, or custom with your own minutes of work (1 to 240) and break (1 to 60).',
    inputSchema: {
      type: 'object',
      properties: {
        length: { type: 'string', enum: SESSIONS },
        workMinutes: { type: 'integer', minimum: 1, maximum: 240, description: 'Only for custom.' },
        breakMinutes: { type: 'integer', minimum: 1, maximum: 60, description: 'Only for custom.' },
        warmup: { type: 'boolean', description: 'Add a ten minute warm-up before the first work block, on top of the session length. Only in the creative-flow mode; ignored otherwise. The sound stays the same.' },
      },
      required: ['length'],
    },
    execute: async (input) => {
      const length = input.length as TimerPreset;
      if (!SESSIONS.includes(length)) return { error: `Unknown session length: ${String(input.length)}` };
      if (length === 'custom') {
        setCustomDurations(Number(input.workMinutes ?? store.get().session.customWork), Number(input.breakMinutes ?? store.get().session.customBreak));
      }
      setWarmup(input.warmup === true && store.get().preset === 'creative-flow');
      startTimer(length);
      return snapshot();
    },
  });

  add({
    name: 'stop_session',
    description: 'Stop the timed session and go back to untimed sound.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => { stopTimer(); return snapshot(); },
  });

  add({
    name: 'play',
    description: 'Start the sound. Browsers only allow sound after the person has tapped the page once, so this can fail until they do.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      if (store.get().playback !== 'playing') store.set({ playback: 'starting' });
      for (let i = 0; i < 10 && store.get().playback !== 'playing'; i++) await wait(200);
      const playing = store.get().playback === 'playing';
      return { playing, ...(playing ? {} : { note: 'The browser blocked sound. Ask the person to tap the page once, then try again.' }) };
    },
  });

  add({
    name: 'pause',
    description: 'Pause the sound.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      if (store.get().playback === 'playing') store.set({ playback: 'paused' });
      return snapshot();
    },
  });

  add({
    name: 'set_master_volume',
    description: `Set the master volume from 0 to 1. Values above ${MAX_AGENT_VOLUME} are lowered to ${MAX_AGENT_VOLUME} to protect hearing.`,
    inputSchema: { type: 'object', properties: { volume: { type: 'number', minimum: 0, maximum: 1 } }, required: ['volume'] },
    execute: async (input) => {
      const requested = Number(input.volume);
      if (!Number.isFinite(requested)) return { error: 'volume must be a number from 0 to 1' };
      const volume = Math.min(MAX_AGENT_VOLUME, Math.max(0, requested));
      store.set((s) => ({ ...s, master: { volume } }));
      return { masterVolume: volume, capped: volume < requested };
    },
  });
}
