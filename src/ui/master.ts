import { store } from '../state/store';
import type { AppState } from '../state/types';
import { bandOf } from '../state/types';

const BAND_LABEL: Record<string, string> = {
  whisper: 'Whisper',
  library: 'Library',
  workspace: 'Workspace',
  cafe: 'Café',
  loud: 'Too loud for focus',
};

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
}

let refs: Refs | null = null;
let lastKey = '';

function render(state: AppState): void {
  if (!refs) return;
  const key = `${state.master.volume}|${state.focusBoost.depth}`;
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
}

export function mountMaster(root: HTMLElement): void {
  root.className = 'panel master-panel';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Master';
  root.appendChild(eyebrow);

  const masterLabelRow = document.createElement('div');
  masterLabelRow.className = 'control-row__label';
  const masterLabel = document.createElement('label');
  masterLabel.htmlFor = 'master-volume';
  masterLabel.textContent = 'Master volume';
  const masterValue = document.createElement('span');
  masterValue.className = 'readout';
  masterLabelRow.appendChild(masterLabel);
  masterLabelRow.appendChild(masterValue);
  root.appendChild(masterLabelRow);

  const masterInput = document.createElement('input');
  masterInput.type = 'range';
  masterInput.id = 'master-volume';
  masterInput.min = '0';
  masterInput.max = '1';
  masterInput.step = '0.01';
  masterInput.setAttribute('aria-label', 'Master volume');
  root.appendChild(masterInput);

  const bandLabel = document.createElement('p');
  bandLabel.className = 'band-label';
  bandLabel.setAttribute('aria-live', 'polite');
  root.appendChild(bandLabel);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Estimate. Depends on your device.';
  root.appendChild(note);

  const boostLabelRow = document.createElement('div');
  boostLabelRow.className = 'control-row__label';
  boostLabelRow.style.marginTop = '8px';
  const boostLabel = document.createElement('label');
  boostLabel.htmlFor = 'focus-boost';
  boostLabel.textContent = 'Focus Boost (pulse on music)';
  const boostValue = document.createElement('span');
  boostValue.className = 'readout';
  boostLabelRow.appendChild(boostLabel);
  boostLabelRow.appendChild(boostValue);
  root.appendChild(boostLabelRow);

  const boostInput = document.createElement('input');
  boostInput.type = 'range';
  boostInput.id = 'focus-boost';
  boostInput.min = '0';
  boostInput.max = '100';
  boostInput.step = '1';
  boostInput.setAttribute('aria-label', 'Focus Boost, pulse on music');
  root.appendChild(boostInput);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'May help some people sustain attention.';
  root.appendChild(hint);

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

  refs = { masterInput, masterValue, bandLabel, boostInput, boostValue };

  store.subscribe(render);
  render(store.get());
}
