import { store } from '../state/store';
import { setSleepTimer } from '../state/session';

const OPTIONS: Array<{ value: string; minutes: number | null; label: string }> = [
  { value: 'off', minutes: null, label: 'Off' },
  { value: '15', minutes: 15, label: '15 min' },
  { value: '30', minutes: 30, label: '30 min' },
  { value: '45', minutes: 45, label: '45 min' },
  { value: '60', minutes: 60, label: '60 min' },
];

/** Sleep-timer select: 15/30/45/60 minutes or off. */
export function createSleepSelect(): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'timer__warmup';

  const span = document.createElement('span');
  span.className = 'timer__label';
  span.textContent = 'Sleep timer';
  wrap.appendChild(span);

  const select = document.createElement('select');
  select.className = 'timer__select';
  select.setAttribute('aria-label', 'Sleep timer');
  for (const opt of OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  }
  select.value = store.get().session.sleepEndsAt ? select.value : 'off';

  select.addEventListener('change', () => {
    const chosen = OPTIONS.find((o) => o.value === select.value) ?? OPTIONS[0];
    setSleepTimer(chosen.minutes);
  });

  wrap.appendChild(select);
  return wrap;
}
