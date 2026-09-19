// Full screen for the whole page (the tunnel and the timer with the interface hidden).
//
// Uses the Fullscreen API, with the WebKit prefix for older Safari. An iPhone
// has no full screen for web pages, so there the button is left out.

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = (): FsDoc => document as FsDoc;

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  return !!(doc().fullscreenElement || doc().webkitFullscreenElement);
}

export function toggleFullscreen(): void {
  if (!fullscreenSupported()) return;
  const el = document.documentElement as FsEl;
  if (isFullscreen()) {
    void (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
  } else {
    void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  }
}

/** Calls `fn` whenever the page enters or leaves full screen (including by the Esc key). */
export function onFullscreenChange(fn: () => void): void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
