import { store } from '../state/store';
import { bus } from '../state/events';
import { applyPreset } from '../state/presets';
import type { AppState, TaskPreset } from '../state/types';

export const PRESET_ORDER: TaskPreset[] = [
  'deep-focus',
  'reading-writing',
  'creative-flow',
  'routine',
  'break-restore',
  'sleep',
];

const PRESET_LABEL: Record<TaskPreset, string> = {
  'deep-focus': 'Deep Focus',
  'reading-writing': 'Reading / Writing',
  'creative-flow': 'Creative Flow',
  routine: 'Routine',
  'break-restore': 'Break / Restore',
  sleep: 'Sleep',
};

export function togglePlayback(): void {
  const s = store.get();
  if (s.playback === 'idle' || s.playback === 'paused') {
    store.set({ playback: 'starting' });
  } else {
    store.set({ playback: 'paused' });
  }
}

interface Refs {
  playBtn: HTMLButtonElement;
  presetBtns: Map<TaskPreset, HTMLButtonElement>;
}

let refs: Refs | null = null;
let lastKey = '';

function render(state: AppState): void {
  if (!refs) return;
  const key = `${state.playback}|${state.preset}`;
  if (key === lastKey) return;
  lastKey = key;

  const isPlaying = state.playback === 'starting' || state.playback === 'playing';
  refs.playBtn.textContent = isPlaying ? 'Pause' : 'Play';
  refs.playBtn.setAttribute('aria-pressed', String(isPlaying));
  refs.playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

  refs.presetBtns.forEach((btn, id) => {
    btn.setAttribute('aria-pressed', String(state.preset === id));
  });
}

export function mountTransport(root: HTMLElement): void {
  root.className = 'transport';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'play-btn';
  playBtn.textContent = 'Play';
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.setAttribute('aria-label', 'Play');
  playBtn.addEventListener('click', togglePlayback);
  root.appendChild(playBtn);

  const presetSection = document.createElement('div');
  presetSection.className = 'panel';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Presets';
  presetSection.appendChild(eyebrow);

  const presetRow = document.createElement('div');
  presetRow.className = 'preset-row';
  presetRow.setAttribute('role', 'group');
  presetRow.setAttribute('aria-label', 'Task presets');

  const presetBtns = new Map<TaskPreset, HTMLButtonElement>();
  for (const id of PRESET_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.textContent = PRESET_LABEL[id];
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => applyPreset(id));
    presetRow.appendChild(btn);
    presetBtns.set(id, btn);
  }
  presetSection.appendChild(presetRow);
  root.appendChild(presetSection);

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'share-btn';
  shareBtn.textContent = 'Share';
  shareBtn.setAttribute('aria-label', 'Copy link to this session');
  shareBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      bus.emit('ui:toast', { text: 'Link copied.', ms: 2500 });
    } catch {
      bus.emit('ui:toast', { text: 'Could not copy link.', ms: 2500 });
    }
  });
  root.appendChild(shareBtn);

  refs = { playBtn, presetBtns };

  store.subscribe(render);
  render(store.get());
}
