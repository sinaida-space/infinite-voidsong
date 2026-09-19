import { bus } from '../state/events';
import { formatMMSS, seekTimeline, stopTimer } from '../state/session';

function buildWinBar(title: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'win__title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  return bar;
}

/**
 * Break window: "Break. Back in mm:ss", the timeline, and two ways out. It sits in
 * the page like the other windows, so the title and the footer stay on screen.
 */
export function createBreakScreen(): { el: HTMLElement; body: HTMLElement; actions: HTMLElement; update: (remainingMs: number) => void } {
  const el = document.createElement('div');
  el.className = 'ritual';
  el.hidden = true;

  const win = document.createElement('div');
  win.className = 'win';
  win.appendChild(buildWinBar('Break'));

  const body = document.createElement('div');
  body.className = 'win__body';
  win.appendChild(body);

  const message = document.createElement('p');
  message.className = 'ritual__message';
  message.setAttribute('aria-live', 'polite');
  body.appendChild(message);

  // Ways out of the break.
  const actions = document.createElement('div');
  actions.className = 'ritual__actions';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'ritual__back';
  back.textContent = 'Back to work';
  back.addEventListener('click', () => seekTimeline(0)); // a fresh work block, with the sound and the signal
  const end = document.createElement('button');
  end.type = 'button';
  end.className = 'ritual__end';
  end.textContent = 'End session';
  end.addEventListener('click', () => stopTimer());
  actions.append(back, end);
  body.appendChild(actions);

  el.appendChild(win);

  function update(remainingMs: number): void {
    message.textContent = `Break. Back in ${formatMMSS(remainingMs)}`;
  }

  update(0);
  return { el, body, actions, update };
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

/** Mounts a single toast listener; renders `ui:toast` messages near the bottom of the screen. */
export function mountToast(): void {
  bus.on('ui:toast', ({ text, ms }) => {
    let el = document.querySelector<HTMLElement>('.toast');
    let body: HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.className = 'win toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.appendChild(buildWinBar('Notice'));
      body = document.createElement('div');
      body.className = 'win__body toast__body';
      el.appendChild(body);
      document.body.appendChild(el);
    } else {
      body = el.querySelector('.toast__body');
    }
    if (body) body.textContent = text;
    el.hidden = false;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (el) el.hidden = true;
    }, ms);
  });
}
