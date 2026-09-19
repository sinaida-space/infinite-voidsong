import '../styles/session.css';
import type { Phase, TimerPreset } from '../state/types';
import { store } from '../state/store';
import { bus } from '../state/events';
import { startTimer, stopTimer, setWarmup, formatMMSS } from '../state/session';
import { createSleepSelect } from './sleep';
import { createBreakScreen, mountToast } from './ritual';
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

const TIMER_PRESETS: TimerPreset[] = ['25/5', '50/10', '90/15'];

const PHASE_LABEL: Record<Phase, string> = {
  free: 'Untimed',
  warmup: 'Warming up',
  work: 'Work',
  ending: 'Winding down',
  break: 'Break',
  'resume-cue': 'Resuming',
  sleep: 'Sleep',
};

function findRootOrCreate(id: string): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = id;
  document.body.appendChild(created);
  return created;
}

/** Mounts the session timer panel (presets, readout, sleep timer) and the break ritual screen. */
export function mountTimer(root?: HTMLElement): void {
  const container = root ?? findRootOrCreate('timer');
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'win';
  panel.appendChild(buildWinBar('Session'));

  const body = document.createElement('div');
  body.className = 'win__body timer';
  panel.appendChild(body);

  const presetsRow = document.createElement('div');
  presetsRow.className = 'timer__presets';
  body.appendChild(presetsRow);

  const presetButtons = new Map<TimerPreset | 'untimed', HTMLButtonElement>();

  function makePresetButton(preset: TimerPreset | 'untimed', label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timer__preset';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (preset === 'untimed') {
        stopTimer();
      } else {
        startTimer(preset);
      }
    });
    presetsRow.appendChild(btn);
    presetButtons.set(preset, btn);
    return btn;
  }

  for (const p of TIMER_PRESETS) makePresetButton(p, p);
  makePresetButton('untimed', 'Untimed');

  const readout = document.createElement('p');
  readout.className = 'timer__readout';
  readout.textContent = '--:--';
  body.appendChild(readout);

  const phaseLabel = document.createElement('p');
  phaseLabel.className = 'timer__phase';
  phaseLabel.textContent = PHASE_LABEL.free;
  body.appendChild(phaseLabel);

  const row = document.createElement('div');
  row.className = 'timer__row';
  row.appendChild(createSleepSelect());

  const warmupWrap = document.createElement('label');
  warmupWrap.className = 'timer__warmup';
  warmupWrap.hidden = true;
  const warmupInput = document.createElement('input');
  warmupInput.type = 'checkbox';
  warmupInput.addEventListener('change', () => setWarmup(warmupInput.checked));
  const warmupText = document.createElement('span');
  warmupText.textContent = 'Warm-up (10 min)';
  warmupWrap.appendChild(warmupInput);
  warmupWrap.appendChild(warmupText);
  row.appendChild(warmupWrap);

  body.appendChild(row);

  const hintLine = document.createElement('p');
  hintLine.className = 'timer__hint-line';
  hintLine.textContent = '25/5 short sprints · 50/10 longer blocks · 90/15 one deep cycle';
  const whyLink = document.createElement('button');
  whyLink.type = 'button';
  whyLink.className = 'timer__why';
  whyLink.textContent = 'Why?';
  whyLink.setAttribute('aria-label', 'Why these session lengths');
  whyLink.addEventListener('click', () => openGuide());
  hintLine.appendChild(document.createTextNode(' '));
  hintLine.appendChild(whyLink);
  body.appendChild(hintLine);

  container.appendChild(panel);

  const breakScreen = createBreakScreen();
  container.appendChild(breakScreen.el);

  mountToast();

  function render(): void {
    const s = store.get();
    const { session, preset } = s;

    for (const [key, btn] of presetButtons) {
      const active = key === 'untimed' ? session.timer === null : session.timer === key;
      btn.setAttribute('aria-pressed', String(active));
    }

    phaseLabel.textContent = PHASE_LABEL[session.phase];
    warmupWrap.hidden = preset !== 'creative-flow';
    warmupInput.checked = session.warmup;

    const inRitual = session.phase === 'break' || session.phase === 'resume-cue';
    panel.hidden = inRitual;
    breakScreen.el.hidden = !inRitual;

    const remaining = session.phaseEndsAt ? session.phaseEndsAt - Date.now() : null;
    if (inRitual && remaining !== null) {
      breakScreen.update(remaining);
    }
    readout.textContent = remaining !== null ? formatMMSS(remaining) : session.timer ? '--:--' : formatMMSS(0);
  }

  store.subscribe(render);
  bus.on('session:phase', render);
  setInterval(render, 1000);
  render();
}
