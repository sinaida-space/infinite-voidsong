import { store } from '../state/store';
import type { AppState, LayerState, SourceId } from '../state/types';

interface FamilyGroup {
  label: string;
  sources: SourceId[];
}

const FAMILY_GROUPS: FamilyGroup[] = [
  { label: 'Noise', sources: ['noise'] },
  { label: 'Water', sources: ['rain', 'thunder', 'ocean', 'stream', 'underwater'] },
  { label: 'Air', sources: ['wind', 'birds', 'crickets'] },
  { label: 'Fire', sources: ['campfire'] },
  { label: 'Places', sources: ['cafe', 'library', 'cabin', 'fan'] },
  { label: 'Music', sources: ['drone', 'lofi', 'plucks', 'synthwave', 'berlin', 'house', 'chillhop'] },
  { label: 'Tone', sources: ['tone'] },
];

const SOURCE_LABEL: Record<SourceId, string> = {
  none: 'None',
  noise: 'Noise',
  rain: 'Rain',
  thunder: 'Thunder',
  ocean: 'Ocean',
  stream: 'Stream',
  underwater: 'Underwater',
  wind: 'Wind',
  birds: 'Birds',
  crickets: 'Crickets',
  campfire: 'Campfire',
  cafe: 'Café',
  library: 'Library',
  cabin: 'Cabin',
  fan: 'Fan',
  drone: 'Drone',
  lofi: 'Lo-fi',
  plucks: 'Plucks',
  synthwave: 'Synthwave',
  berlin: 'Berlin',
  house: 'House',
  chillhop: 'Chillhop',
  tone: 'Tone',
};

const TONE_COPY =
  'A steady tone with adjustable pitch. Some people find it easier to work with one in the background.';

let selectedIndex = 0;

export function getSelectedLayerIndex(): number {
  return selectedIndex;
}

export function setSelectedLayerIndex(i: number): void {
  if (i < 0 || i > 3 || i === selectedIndex) return;
  selectedIndex = i;
  applySelectionClasses();
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function patchLayer(index: number, patch: Partial<LayerState>): void {
  store.set((s: AppState) => {
    const layers = [...s.layers] as AppState['layers'];
    layers[index] = { ...layers[index], ...patch };
    return { ...s, layers };
  });
}

function patchLayerParam(index: number, key: string, value: number): void {
  store.set((s: AppState) => {
    const layers = [...s.layers] as AppState['layers'];
    layers[index] = { ...layers[index], params: { ...layers[index].params, [key]: value } };
    return { ...s, layers };
  });
}

function buildWinBar(title: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'win__title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  return bar;
}

interface RangeRefs {
  input: HTMLInputElement;
  value: HTMLSpanElement;
}

function buildRange(
  id: string,
  labelText: string,
  min: number,
  max: number,
  step: number,
  format: (v: number) => string,
): { row: HTMLDivElement; refs: RangeRefs } {
  const row = document.createElement('div');
  row.className = 'control-row';

  const labelRow = document.createElement('div');
  labelRow.className = 'control-row__label';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  const value = document.createElement('span');
  value.className = 'readout';
  labelRow.appendChild(label);
  labelRow.appendChild(value);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);

  row.appendChild(labelRow);
  row.appendChild(input);

  return { row, refs: { input, value } };
}

function setRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const v = Number(input.value);
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${pct}%`);
}

interface CardRefs {
  card: HTMLDivElement;
  select: HTMLSelectElement;
  volume: RangeRefs;
  muteBtn: HTMLButtonElement;
  paramBox: HTMLDivElement;
  paramControls: Map<string, RangeRefs>;
}

function buildOptions(select: HTMLSelectElement): void {
  const none = document.createElement('option');
  none.value = 'none';
  none.textContent = SOURCE_LABEL.none;
  select.appendChild(none);

  for (const group of FAMILY_GROUPS) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const source of group.sources) {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = SOURCE_LABEL[source];
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
}

function buildCard(index: number): CardRefs {
  const card = document.createElement('div');
  card.className = 'win layer-card';
  card.dataset.layerIndex = String(index);
  card.appendChild(buildWinBar(`Layer ${index + 1}`));

  const body = document.createElement('div');
  body.className = 'win__body layer-card__body';
  card.appendChild(body);

  const select = document.createElement('select');
  select.className = 'source-select';
  select.id = `layer-${index}-source`;
  select.setAttribute('aria-label', `Layer ${index + 1} source`);
  buildOptions(select);
  body.appendChild(select);

  const row = document.createElement('div');
  row.className = 'layer-card__row';
  const { row: volRow, refs: volume } = buildRange(
    `layer-${index}-volume`,
    'Volume',
    0,
    1,
    0.01,
    (v) => `${Math.round(v * 100)}%`,
  );
  volume.input.setAttribute('aria-label', `Layer ${index + 1} volume`);

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'mute-btn';
  muteBtn.textContent = 'Mute';
  muteBtn.setAttribute('aria-pressed', 'false');
  muteBtn.setAttribute('aria-label', `Mute layer ${index + 1}`);

  row.appendChild(volRow);
  row.appendChild(muteBtn);
  body.appendChild(row);

  const paramBox = document.createElement('div');
  paramBox.className = 'param-controls';
  body.appendChild(paramBox);

  const focusSelect = () => setSelectedLayerIndex(index);
  card.addEventListener('focusin', focusSelect);
  card.addEventListener('pointerdown', focusSelect);

  select.addEventListener('change', () => {
    patchLayer(index, { source: select.value as SourceId });
  });

  volume.input.addEventListener('input', () => {
    setRangeFill(volume.input);
    volume.value.textContent = `${Math.round(Number(volume.input.value) * 100)}%`;
    patchLayer(index, { volume: Number(volume.input.value) });
  });

  muteBtn.addEventListener('click', () => {
    const s = store.get();
    patchLayer(index, { muted: !s.layers[index].muted });
  });

  return { card, select, volume, muteBtn, paramBox, paramControls: new Map() };
}

interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  log?: boolean;
  format: (v: number) => string;
}

const PARAM_SPECS: Record<string, ParamSpec[]> = {
  noise: [
    {
      key: 'noise.tilt',
      label: 'Tilt (white ↔ brown)',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      format: (v) => (v < 0.33 ? 'White' : v < 0.66 ? 'Pink' : 'Brown'),
    },
  ],
  lofi: [
    { key: 'lofi.bpm', label: 'BPM', min: 60, max: 100, step: 1, default: 78, format: (v) => `${Math.round(v)}` },
    { key: 'lofi.tape', label: 'Tape', min: 0, max: 1, step: 0.01, default: 0.5, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'lofi.pump', label: 'Pump', min: 0, max: 1, step: 0.01, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
  ],
  synthwave: [
    { key: 'synthwave.bpm', label: 'BPM', min: 84, max: 100, step: 1, default: 92, format: (v) => `${Math.round(v)}` },
    { key: 'synthwave.tape', label: 'Tape', min: 0, max: 1, step: 0.01, default: 0.3, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'synthwave.pump', label: 'Pump', min: 0, max: 1, step: 0.01, default: 0.35, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'synthwave.arp', label: 'Arp brightness', min: 0, max: 1, step: 0.01, default: 0.5, format: (v) => `${Math.round(v * 100)}%` },
  ],
  berlin: [
    { key: 'berlin.bpm', label: 'BPM', min: 70, max: 100, step: 1, default: 84, format: (v) => `${Math.round(v)}` },
    { key: 'berlin.tape', label: 'Tape', min: 0, max: 1, step: 0.01, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'berlin.pulse', label: 'Pulse', min: 0, max: 1, step: 0.01, default: 0.3, format: (v) => `${Math.round(v * 100)}%` },
  ],
  house: [
    { key: 'house.bpm', label: 'BPM', min: 90, max: 110, step: 1, default: 100, format: (v) => `${Math.round(v)}` },
    { key: 'house.tape', label: 'Tape', min: 0, max: 1, step: 0.01, default: 0.2, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'house.pump', label: 'Pump', min: 0, max: 1, step: 0.01, default: 0.5, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'house.filter', label: 'Filter sweep', min: 0, max: 1, step: 0.01, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
  ],
  chillhop: [
    { key: 'chillhop.bpm', label: 'BPM', min: 60, max: 90, step: 1, default: 72, format: (v) => `${Math.round(v)}` },
    { key: 'chillhop.tape', label: 'Tape', min: 0, max: 1, step: 0.01, default: 0.6, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'chillhop.pump', label: 'Pump', min: 0, max: 1, step: 0.01, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
    { key: 'chillhop.crackle', label: 'Crackle', min: 0, max: 1, step: 0.01, default: 0.5, format: (v) => `${Math.round(v * 100)}%` },
  ],
  tone: [
    {
      key: 'tone.freq',
      label: 'Pitch',
      min: 200,
      max: 12000,
      step: 1,
      default: 4000,
      log: true,
      format: (v) => `${Math.round(v)} Hz`,
    },
    { key: 'tone.width', label: 'Width', min: 0, max: 1, step: 0.01, default: 0.3, format: (v) => `${Math.round(v * 100)}%` },
  ],
  ocean: [
    { key: 'ocean.period', label: 'Wave period', min: 8, max: 24, step: 0.5, default: 14, format: (v) => `${v.toFixed(1)} s` },
  ],
};

function buildParamRow(index: number, spec: ParamSpec): { row: HTMLDivElement; refs: RangeRefs } {
  const id = `layer-${index}-${spec.key}`;
  const sliderMin = spec.log ? Math.log(spec.min) : spec.min;
  const sliderMax = spec.log ? Math.log(spec.max) : spec.max;
  const sliderStep = spec.log ? (sliderMax - sliderMin) / 400 : spec.step;
  const { row, refs } = buildRange(id, spec.label, sliderMin, sliderMax, sliderStep, spec.format);

  const toReal = (sliderValue: number) => (spec.log ? Math.exp(sliderValue) : sliderValue);
  const toSlider = (real: number) => (spec.log ? Math.log(real) : real);

  refs.input.addEventListener('input', () => {
    setRangeFill(refs.input);
    const real = toReal(Number(refs.input.value));
    refs.value.textContent = spec.format(real);
    patchLayerParam(index, spec.key, real);
  });

  refs.input.dataset.paramKey = spec.key;
  (refs.input as HTMLInputElement & { __toSlider?: (v: number) => number }).__toSlider = toSlider;

  return { row, refs };
}

function updateParamBox(refs: CardRefs, index: number, layer: LayerState): void {
  const family = layer.source === 'none' ? null : layer.source;
  const specs = family && PARAM_SPECS[family] ? PARAM_SPECS[family] : [];
  const specKeys = specs.map((s) => s.key).join(',');
  if (refs.paramBox.dataset.specs === specKeys) {
    // same set of controls, just sync values
    for (const spec of specs) {
      const paramRefs = refs.paramControls.get(spec.key);
      if (!paramRefs) continue;
      const real = layer.params[spec.key] ?? spec.default;
      const toSlider = (paramRefs.input as HTMLInputElement & { __toSlider?: (v: number) => number }).__toSlider;
      const sliderValue = toSlider ? toSlider(real) : real;
      if (document.activeElement !== paramRefs.input) {
        paramRefs.input.value = String(sliderValue);
      }
      setRangeFill(paramRefs.input);
      paramRefs.value.textContent = spec.format(real);
    }
    return;
  }

  refs.paramBox.innerHTML = '';
  refs.paramControls.clear();
  refs.paramBox.dataset.specs = specKeys;

  if (layer.source === 'tone') {
    const copy = document.createElement('p');
    copy.className = 'tone-copy';
    copy.textContent = TONE_COPY;
    refs.paramBox.appendChild(copy);
  }

  for (const spec of specs) {
    const { row, refs: paramRefs } = buildParamRow(index, spec);
    const real = layer.params[spec.key] ?? spec.default;
    const toSlider = (paramRefs.input as HTMLInputElement & { __toSlider?: (v: number) => number }).__toSlider;
    paramRefs.input.value = String(toSlider ? toSlider(real) : real);
    setRangeFill(paramRefs.input);
    paramRefs.value.textContent = spec.format(real);
    refs.paramControls.set(spec.key, paramRefs);
    refs.paramBox.appendChild(row);
  }
}

function applySelectionClasses(): void {
  if (!cards) return;
  cards.forEach((refs, i) => {
    const selected = i === selectedIndex;
    refs.card.classList.toggle('is-selected', selected);
    refs.card.classList.toggle('is-active', selected);
  });
}

let cards: CardRefs[] | null = null;
let lastKey = '';

function render(state: AppState): void {
  if (!cards) return;
  const key = JSON.stringify(state.layers);
  if (key === lastKey) return;
  lastKey = key;

  state.layers.forEach((layer, i) => {
    const refs = cards![i];
    if (document.activeElement !== refs.select) {
      refs.select.value = layer.source;
    }
    if (document.activeElement !== refs.volume.input) {
      refs.volume.input.value = String(layer.volume);
    }
    setRangeFill(refs.volume.input);
    refs.volume.value.textContent = `${Math.round(layer.volume * 100)}%`;
    refs.muteBtn.setAttribute('aria-pressed', String(layer.muted));
    updateParamBox(refs, i, layer);
  });
}

export function mountMixer(root: HTMLElement): void {
  root.className = 'win';
  root.appendChild(buildWinBar('Mixer'));

  const body = document.createElement('div');
  body.className = 'win__body mixer';
  body.setAttribute('role', 'group');
  body.setAttribute('aria-label', 'Layers');
  root.appendChild(body);

  cards = [];
  for (let i = 0; i < 4; i++) {
    const refs = buildCard(i);
    cards.push(refs);
    body.appendChild(refs.card);
  }

  applySelectionClasses();
  store.subscribe(render);
  render(store.get());
}
