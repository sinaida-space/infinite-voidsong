import { store } from '../state/store';
import type { AppState, HarmonyMode } from '../state/types';
import { bandOf, HARMONY_MODES } from '../state/types';

const NBSP = '\u00a0';
const HARMONY_LABEL: Record<HarmonyMode, string> = { off: 'Off', gentle: 'Gentle', drift: 'Drift' };
const HARMONY_HINT: Record<HarmonyMode, string> = {
  off: `The music keeps its four-chord loop and one-bar patterns.`,
  gentle: `A new chord progression each cycle, patterns of two${NBSP}bars.`,
  drift: `As Gentle, with four-bar patterns and a key that${NBSP}wanders and returns.`,
};

const BAND_LABEL: Record<string, string> = {
  whisper: 'Whisper',
  library: 'Library',
  workspace: 'Workspace',
  cafe: 'Café',
  loud: 'Too loud for focus',
};

function buildWinBar(title: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'win__title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  return bar;
}

function setRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const v = Number(input.value);
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${pct}%`);
}

interface Refs {
  masterInput: HTMLInputElement;
  masterValue: HTMLSpanElement;
  bandLabel: HTMLParagraphElement;
  boostInput: HTMLInputElement;
  boostValue: HTMLSpanElement;
  rateInput: HTMLInputElement;
  rateValue: HTMLSpanElement;
  harmonyButtons: Map<HarmonyMode, HTMLButtonElement>;
  harmonyHint: HTMLParagraphElement;
}

let refs: Refs | null = null;
let lastKey = '';

function render(state: AppState): void {
  if (!refs) return;
  const key = `${state.master.volume}|${state.focusBoost.depth}|${state.focusBoost.rateHz}|${state.harmony}`;
  if (key === lastKey) return;
  lastKey = key;

  if (document.activeElement !== refs.masterInput) {
    refs.masterInput.value = String(state.master.volume);
  }
  setRangeFill(refs.masterInput);
  refs.masterValue.textContent = `${Math.round(state.master.volume * 100)}%`;

  const band = bandOf(state.master.volume);
  refs.bandLabel.textContent = BAND_LABEL[band];
  refs.bandLabel.classList.toggle('is-loud', band === 'loud');

  if (document.activeElement !== refs.boostInput) {
    refs.boostInput.value = String(Math.round(state.focusBoost.depth * 100));
  }
  setRangeFill(refs.boostInput);
  refs.boostValue.textContent = `${Math.round(state.focusBoost.depth * 100)}%`;

  if (document.activeElement !== refs.rateInput) {
    refs.rateInput.value = String(Math.round(state.focusBoost.rateHz));
  }
  setRangeFill(refs.rateInput);
  refs.rateValue.textContent = `${Math.round(state.focusBoost.rateHz)} Hz`;

  for (const [mode, btn] of refs.harmonyButtons) btn.setAttribute('aria-pressed', String(mode === state.harmony));
  refs.harmonyHint.textContent = HARMONY_HINT[state.harmony];
}

export function mountMaster(root: HTMLElement): void {
  root.className = 'win';
  root.appendChild(buildWinBar('Master'));

  const body = document.createElement('div');
  body.className = 'win__body master-panel';
  root.appendChild(body);

  const masterLabelRow = document.createElement('div');
  masterLabelRow.className = 'control-row__label';
  const masterLabel = document.createElement('label');
  masterLabel.htmlFor = 'master-volume';
  masterLabel.textContent = 'Master volume';
  const masterValue = document.createElement('span');
  masterValue.className = 'readout';
  masterLabelRow.appendChild(masterLabel);
  masterLabelRow.appendChild(masterValue);
  body.appendChild(masterLabelRow);

  const masterInput = document.createElement('input');
  masterInput.type = 'range';
  masterInput.id = 'master-volume';
  masterInput.min = '0';
  masterInput.max = '1';
  masterInput.step = '0.01';
  masterInput.setAttribute('aria-label', 'Master volume');
  body.appendChild(masterInput);

  const bandLabel = document.createElement('p');
  bandLabel.className = 'band-label';
  bandLabel.setAttribute('aria-live', 'polite');
  body.appendChild(bandLabel);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Estimate. Depends on your device.';
  body.appendChild(note);

  const boostLabelRow = document.createElement('div');
  boostLabelRow.className = 'control-row__label';
  boostLabelRow.style.marginTop = '8px';
  const boostLabel = document.createElement('label');
  boostLabel.htmlFor = 'focus-boost';
  boostLabel.className = 'is-cathode';
  boostLabel.textContent = 'Focus Boost (pulse on music)';
  const boostValue = document.createElement('span');
  boostValue.className = 'readout is-cathode';
  boostLabelRow.appendChild(boostLabel);
  boostLabelRow.appendChild(boostValue);
  body.appendChild(boostLabelRow);

  const boostInput = document.createElement('input');
  boostInput.type = 'range';
  boostInput.id = 'focus-boost';
  boostInput.min = '0';
  boostInput.max = '100';
  boostInput.step = '1';
  boostInput.setAttribute('aria-label', 'Focus Boost, pulse on music');
  body.appendChild(boostInput);

  const rateLabelRow = document.createElement('div');
  rateLabelRow.className = 'control-row__label';
  rateLabelRow.style.marginTop = '8px';
  const rateLabel = document.createElement('label');
  rateLabel.htmlFor = 'focus-rate';
  rateLabel.className = 'is-cathode';
  rateLabel.textContent = 'Pulse rate';
  const rateValue = document.createElement('span');
  rateValue.className = 'readout is-cathode';
  rateLabelRow.appendChild(rateLabel);
  rateLabelRow.appendChild(rateValue);
  body.appendChild(rateLabelRow);

  const rateInput = document.createElement('input');
  rateInput.type = 'range';
  rateInput.id = 'focus-rate';
  rateInput.min = '12';
  rateInput.max = '20';
  rateInput.step = '1';
  rateInput.setAttribute('aria-label', 'Pulse rate in hertz, 12 to 20');
  body.appendChild(rateInput);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'May help some people sustain attention. Early evidence: if it distracts you, set it to 0.';
  body.appendChild(hint);

  // Harmony: a three-position switch for the music layers.
  const harmonyLabelRow = document.createElement('div');
  harmonyLabelRow.className = 'control-row__label';
  harmonyLabelRow.style.marginTop = '8px';
  const harmonyLabel = document.createElement('span');
  harmonyLabel.id = 'harmony-label';
  harmonyLabel.textContent = 'Harmony';
  harmonyLabelRow.appendChild(harmonyLabel);
  body.appendChild(harmonyLabelRow);

  const harmonyGroup = document.createElement('div');
  harmonyGroup.className = 'seg';
  harmonyGroup.setAttribute('role', 'group');
  harmonyGroup.setAttribute('aria-labelledby', 'harmony-label');
  const harmonyButtons = new Map<HarmonyMode, HTMLButtonElement>();
  for (const mode of HARMONY_MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg__btn';
    btn.textContent = HARMONY_LABEL[mode];
    btn.addEventListener('click', () => store.set((s: AppState) => ({ ...s, harmony: mode })));
    harmonyButtons.set(mode, btn);
    harmonyGroup.appendChild(btn);
  }
  body.appendChild(harmonyGroup);

  const harmonyHint = document.createElement('p');
  harmonyHint.className = 'hint';
  harmonyHint.setAttribute('aria-live', 'polite');
  body.appendChild(harmonyHint);

  masterInput.addEventListener('input', () => {
    setRangeFill(masterInput);
    const v = Number(masterInput.value);
    masterValue.textContent = `${Math.round(v * 100)}%`;
    const band = bandOf(v);
    bandLabel.textContent = BAND_LABEL[band];
    bandLabel.classList.toggle('is-loud', band === 'loud');
    store.set((s: AppState) => ({ ...s, master: { volume: v } }));
  });

  boostInput.addEventListener('input', () => {
    setRangeFill(boostInput);
    const pct = Number(boostInput.value);
    boostValue.textContent = `${pct}%`;
    store.set((s: AppState) => ({ ...s, focusBoost: { ...s.focusBoost, depth: pct / 100 } }));
  });

  rateInput.addEventListener('input', () => {
    setRangeFill(rateInput);
    const hz = Number(rateInput.value);
    rateValue.textContent = `${hz} Hz`;
    store.set((s: AppState) => ({ ...s, focusBoost: { ...s.focusBoost, rateHz: hz } }));
  });

  refs = { masterInput, masterValue, bandLabel, boostInput, boostValue, rateInput, rateValue, harmonyButtons, harmonyHint };

  store.subscribe(render);
  render(store.get());
}
