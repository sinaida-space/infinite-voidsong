import '../styles/session.css';
import type { Phase, TimerPreset } from '../state/types';
import { store } from '../state/store';
import { bus } from '../state/events';
import {
  startTimer, stopTimer, setWarmup, formatMMSS, setCustomDurations, getTimeline, seekTimeline, getCycle,
  CUSTOM_WORK_RANGE, CUSTOM_BREAK_RANGE,
} from '../state/session';
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

const pct = (v: number): string => `${Math.min(100, Math.max(0, v * 100)).toFixed(2)}%`;

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
  let customOpen = false;

  function makePresetButton(preset: TimerPreset | 'untimed', label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timer__preset';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (preset === 'untimed') {
        customOpen = false;
        stopTimer();
      } else if (preset === 'custom') {
        // Opens the two number fields; the session starts from their Start button.
        customOpen = true;
        render();
        customWorkInput.focus({ preventScroll: true });
      } else {
        customOpen = false;
        startTimer(preset);
      }
    });
    presetsRow.appendChild(btn);
    presetButtons.set(preset, btn);
    return btn;
  }

  for (const p of TIMER_PRESETS) makePresetButton(p, p);
  makePresetButton('custom', 'Custom');
  makePresetButton('untimed', 'Untimed');

  // --- custom lengths -----------------------------------------------------------
  const customRow = document.createElement('div');
  customRow.className = 'timer__custom';
  customRow.hidden = true;

  function numberField(label: string, range: { min: number; max: number }): { wrap: HTMLLabelElement; input: HTMLInputElement } {
    const wrap = document.createElement('label');
    wrap.className = 'timer__field';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'timer__num';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = '1';
    input.inputMode = 'numeric';
    const unit = document.createElement('span');
    unit.textContent = 'min';
    wrap.append(text, input, unit);
    return { wrap, input };
  }
  const workField = numberField('Work', CUSTOM_WORK_RANGE);
  const breakField = numberField('Break', CUSTOM_BREAK_RANGE);
  const customWorkInput = workField.input;
  const customBreakInput = breakField.input;
  const customGo = document.createElement('button');
  customGo.type = 'button';
  customGo.className = 'timer__go';
  customGo.textContent = 'Start';
  const commitCustom = (): void => {
    setCustomDurations(Number(customWorkInput.value), Number(customBreakInput.value));
  };
  customWorkInput.addEventListener('change', commitCustom);
  customBreakInput.addEventListener('change', commitCustom);
  customGo.addEventListener('click', () => {
    commitCustom();
    startTimer('custom');
  });
  const customNote = document.createElement('p');
  customNote.className = 'timer__custom-note';
  customNote.textContent = `Work ${CUSTOM_WORK_RANGE.min} to ${CUSTOM_WORK_RANGE.max} min, break ${CUSTOM_BREAK_RANGE.min} to ${CUSTOM_BREAK_RANGE.max}. Changing them restarts a running session.`;
  customRow.append(workField.wrap, breakField.wrap, customGo, customNote);
  body.appendChild(customRow);

  const readout = document.createElement('p');
  readout.className = 'timer__readout';
  readout.textContent = '--:--';
  body.appendChild(readout);

  const phaseLabel = document.createElement('p');
  phaseLabel.className = 'timer__phase';
  phaseLabel.textContent = PHASE_LABEL.free;
  body.appendChild(phaseLabel);

  // --- timeline: one cycle, work then break; click or drag to jump ---------------
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  timeline.hidden = true;

  const bar = document.createElement('div');
  bar.className = 'timeline__bar';
  const workSeg = document.createElement('div');
  workSeg.className = 'timeline__seg timeline__seg--work';
  const workFill = document.createElement('div');
  workFill.className = 'timeline__fill';
  workSeg.appendChild(workFill);
  const breakSeg = document.createElement('div');
  breakSeg.className = 'timeline__seg timeline__seg--break';
  const breakFill = document.createElement('div');
  breakFill.className = 'timeline__fill';
  breakSeg.appendChild(breakFill);

  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'timeline__range';
  range.min = '0';
  range.step = '5';
  range.setAttribute('aria-label', 'Session timeline. Move to jump to another point.');
  bar.append(workSeg, breakSeg, range);

  const tlLabels = document.createElement('div');
  tlLabels.className = 'timeline__labels';
  const tlWorkLabel = document.createElement('span');
  const tlBreakLabel = document.createElement('span');
  tlLabels.append(tlWorkLabel, tlBreakLabel);

  const tlPos = document.createElement('p');
  tlPos.className = 'timeline__pos';

  timeline.append(bar, tlLabels, tlPos);
  body.appendChild(timeline);

  let dragging = false;
  range.addEventListener('input', () => {
    dragging = true;
    tlPos.textContent = `Jump to ${formatMMSS(Number(range.value) * 1000)}`;
  });
  range.addEventListener('change', () => {
    dragging = false;
    seekTimeline(Number(range.value) * 1000);
    render();
  });
  range.addEventListener('blur', () => { dragging = false; });

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
  warmupText.textContent = 'Warm-up first (10 min)';
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
      const active =
        key === 'untimed' ? session.timer === null && !customOpen
        : key === 'custom' ? customOpen || session.timer === 'custom'
        : session.timer === key && !customOpen;
      btn.setAttribute('aria-pressed', String(active));
    }

    // Custom lengths: shown while Custom is chosen, values follow the store unless being typed.
    const showCustom = customOpen || session.timer === 'custom';
    customRow.hidden = !showCustom;
    if (document.activeElement !== customWorkInput) customWorkInput.value = String(session.customWork);
    if (document.activeElement !== customBreakInput) customBreakInput.value = String(session.customBreak);
    customGo.textContent = session.timer === 'custom' && session.phase !== 'free' ? 'Restart' : 'Start';

    // Timeline.
    const tl = getTimeline();
    timeline.hidden = !tl;
    if (tl) {
      const total = tl.workMs + tl.breakMs;
      workSeg.style.flex = String(tl.workMs);
      breakSeg.style.flex = String(tl.breakMs);
      workFill.style.width = pct(tl.posMs / tl.workMs);
      breakFill.style.width = pct((tl.posMs - tl.workMs) / tl.breakMs);
      range.max = String(Math.round(total / 1000));
      range.disabled = !tl.seekable;
      tlWorkLabel.textContent = `Work ${formatMMSS(tl.workMs)}`;
      tlBreakLabel.textContent = `Break ${formatMMSS(tl.breakMs)}`;
      if (!dragging) {
        range.value = String(Math.round(tl.posMs / 1000));
        const inWork = tl.posMs < tl.workMs;
        tlPos.textContent = `${formatMMSS(tl.posMs)} of ${formatMMSS(total)} · cycle ${getCycle()}`;
        range.setAttribute('aria-valuetext', `${formatMMSS(inWork ? tl.posMs : tl.posMs - tl.workMs)} into ${inWork ? 'work' : 'break'}, cycle ${getCycle()}`);
      }
    }

    // The warm-up comes before the work block and is not on the timeline, so say what follows it.
    const wtl = getTimeline();
    phaseLabel.textContent = session.phase === 'warmup' && wtl
      ? `Warm-up, then ${Math.round(wtl.workMs / 60000)} min of work`
      : PHASE_LABEL[session.phase];
    warmupWrap.hidden = preset !== 'creative-flow';
    warmupInput.checked = session.warmup;

    const inRitual = session.phase === 'break' || session.phase === 'resume-cue';
    panel.hidden = inRitual;
    breakScreen.el.hidden = !inRitual;
    // During a break the page shows only the title, the break window and the footer (see session.css).
    document.documentElement.toggleAttribute('data-break', inRitual);

    // The timeline follows you onto the break screen so you can jump back to work from there.
    if (inRitual && timeline.parentElement !== breakScreen.body) breakScreen.body.insertBefore(timeline, breakScreen.actions);
    if (!inRitual && timeline.parentElement !== body) body.insertBefore(timeline, row);

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
