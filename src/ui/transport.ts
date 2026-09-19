import { store } from '../state/store';
import { bus } from '../state/events';
import { applyPreset } from '../state/presets';
import type { AppState, TaskPreset } from '../state/types';
import { openGuide } from './guide';

function buildWinBar(title: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'win__title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  return bar;
}

// --- hide-UI mode --------------------------------------------------------------
// `H` (bound in shortcuts.ts) and the transport's HIDE UI button both call
// toggleHideUi(). State lives on `documentElement.dataset.ui` so base.css's
// `[data-ui='hidden']` rules can hide everything but the tunnel and the
// compact timer readout.

// Not remembered between visits: every visit opens with the interface shown.
// An older version saved this choice; that leftover key is removed on load.
const LEGACY_UI_HIDDEN_KEY = 'voidsong:ui-hidden';

function forgetLegacyHiddenChoice(): void {
  try {
    localStorage.removeItem(LEGACY_UI_HIDDEN_KEY);
  } catch {
    /* storage may be blocked */
  }
}

function announceUiState(hidden: boolean): void {
  const live = document.getElementById('ui-live');
  if (live) live.textContent = hidden ? 'Interface hidden. Use the Show interface button, or press H, to bring it back.' : 'Interface shown.';
}

function applyUiHidden(hidden: boolean): void {
  if (hidden) document.documentElement.dataset.ui = 'hidden';
  else delete document.documentElement.dataset.ui;
  announceUiState(hidden);
}

export function isUiHidden(): boolean {
  return document.documentElement.dataset.ui === 'hidden';
}

export function toggleHideUi(): void {
  applyUiHidden(!isUiHidden());
}

export function showUi(): void {
  if (isUiHidden()) applyUiHidden(false);
}

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
  status: HTMLElement;
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
  // Visual cues for the mode, on the page as well as on the button: the tunnel dims when
  // the sound is not playing (see base.css), and the Player window says so in words.
  document.documentElement.dataset.playback = state.playback;
  refs.status.textContent = state.playback === 'starting' ? 'Starting' : state.playback === 'playing' ? 'Playing' : state.playback === 'paused' ? 'Paused' : 'Ready';
  refs.status.dataset.state = state.playback;
  refs.playBtn.textContent = isPlaying ? 'Pause' : 'Play';
  refs.playBtn.setAttribute('aria-pressed', String(isPlaying));
  refs.playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

  refs.presetBtns.forEach((btn, id) => {
    btn.setAttribute('aria-pressed', String(state.preset === id));
  });
}

export function mountTransport(root: HTMLElement): void {
  root.className = 'transport-stack';

  forgetLegacyHiddenChoice();
  applyUiHidden(false);

  // --- Player window --------------------------------------------------
  const transportWin = document.createElement('div');
  transportWin.className = 'win';
  transportWin.appendChild(buildWinBar('Player'));

  const transportBody = document.createElement('div');
  transportBody.className = 'win__body transport';
  transportWin.appendChild(transportBody);
  root.appendChild(transportWin);

  const status = document.createElement('p');
  status.className = 'player-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Ready';
  transportBody.appendChild(status);

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'play-btn';
  playBtn.textContent = 'Play';
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.setAttribute('aria-label', 'Play');
  playBtn.addEventListener('click', togglePlayback);
  transportBody.appendChild(playBtn);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'transport__actions';

  const guideBtn = document.createElement('button');
  guideBtn.type = 'button';
  guideBtn.className = 'share-btn';
  guideBtn.textContent = 'Guide';
  guideBtn.setAttribute('aria-label', 'Open the guide');
  guideBtn.addEventListener('click', () => openGuide());
  actionsRow.appendChild(guideBtn);

  const hideBtn = document.createElement('button');
  hideBtn.type = 'button';
  hideBtn.className = 'share-btn';
  hideBtn.textContent = 'Hide UI';
  hideBtn.setAttribute('aria-label', 'Hide interface, H to restore');
  hideBtn.addEventListener('click', toggleHideUi);
  actionsRow.appendChild(hideBtn);

  transportBody.appendChild(actionsRow);

  // A permanent way back for hide-UI mode: a phone has no H key, and a hint that fades
  // after a few seconds leaves nothing to press.
  const showUi = document.createElement('button');
  showUi.type = 'button';
  showUi.className = 'show-ui';
  const touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
  showUi.textContent = touch ? 'Show interface' : 'Show interface (H)';
  showUi.setAttribute('aria-label', 'Show the interface');
  showUi.addEventListener('click', () => applyUiHidden(false));
  document.body.appendChild(showUi);

  // --- Presets window ------------------------------------------------------
  const presetsWin = document.createElement('div');
  presetsWin.className = 'win';
  presetsWin.appendChild(buildWinBar('Presets'));

  const presetsBody = document.createElement('div');
  presetsBody.className = 'win__body';
  presetsWin.appendChild(presetsBody);
  root.appendChild(presetsWin);

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
  presetsBody.appendChild(presetRow);

  refs = { playBtn, status, presetBtns };

  store.subscribe(render);
  render(store.get());
}
