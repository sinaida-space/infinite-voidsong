// Infinite Voidsong — in-app guide window (task 18)
//
// A hidden `.win` overlay ("GUIDE.TXT") that mounts once and toggles open on
// `openGuide()` — called by task 15's GUIDE button and `?` key, and directly
// from the dev console while task 15 has not landed yet. No dependency on
// `bus`: this window only ever reflects its own open/closed state, never the
// audio/session state the rest of the app shares over the event bus.
//
// Class contract shared with task 15 (which ships the real `.win` chrome):
// `.win`, `.win__bar`, `.win__title`, `.win__close`, `.win__body`. This file
// also renders the guide content inside `.win__body` using the shared
// renderer from `../content/guide` (`.guide`, `.guide__section`, …), styled
// by `../styles/guide.css` as a `.guide`-scoped fallback.
import '../styles/guide.css';
import { renderGuideSections } from '../content/guide';

let winEl: HTMLElement | null = null;
let closeBtn: HTMLButtonElement | null = null;
let lastFocused: HTMLElement | null = null;

function findRootOrCreate(id: string): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = id;
  document.body.appendChild(created);
  return created;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

function trapFocus(event: KeyboardEvent): void {
  if (!winEl || event.key !== 'Tab') return;
  const focusable = focusableElements(winEl);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !winEl.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !winEl.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (!winEl || winEl.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeGuide();
  } else if (event.key === 'Tab') {
    trapFocus(event);
  }
}

/** Opens the guide window, remembering the element to return focus to on close. */
export function openGuide(): void {
  if (!winEl) return;
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  winEl.hidden = false;
  winEl.setAttribute('aria-hidden', 'false');
  (closeBtn ?? winEl).focus({ preventScroll: true });
}

/** Closes the guide window and returns focus to whatever opened it. */
export function closeGuide(): void {
  if (!winEl) return;
  winEl.hidden = true;
  winEl.setAttribute('aria-hidden', 'true');
  lastFocused?.focus();
  lastFocused = null;
}

/** Mounts the (initially hidden) GUIDE.TXT window into `root`. Safe to call once per page. */
export function mountGuide(root?: HTMLElement): HTMLElement {
  const container = root ?? findRootOrCreate('guide');
  container.innerHTML = '';

  const win = document.createElement('div');
  win.className = 'win guide';
  win.hidden = true;
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-label', 'Guide');
  win.setAttribute('aria-hidden', 'true');

  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const title = document.createElement('span');
  title.className = 'win__title';
  title.textContent = 'GUIDE.TXT';
  bar.appendChild(title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'win__close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close guide');
  close.addEventListener('click', closeGuide);
  bar.appendChild(close);

  win.appendChild(bar);

  const body = document.createElement('div');
  body.className = 'win__body';
  renderGuideSections(body);
  win.appendChild(body);

  container.appendChild(win);

  winEl = win;
  closeBtn = close;

  document.addEventListener('keydown', handleKeydown);

  return win;
}
