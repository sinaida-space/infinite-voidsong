import { store } from '../state/store';
import { applyPreset } from '../state/presets';
import type { AppState } from '../state/types';
import { togglePlayback, PRESET_ORDER } from './transport';
import { getSelectedLayerIndex } from './mixer';

const STEP = 0.05;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function handleKeydown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return;

  switch (event.key) {
    case ' ':
    case 'Spacebar':
      event.preventDefault();
      togglePlayback();
      break;

    case 'ArrowUp':
      event.preventDefault();
      store.set((s: AppState) => ({ ...s, master: { volume: clamp01(s.master.volume + STEP) } }));
      break;

    case 'ArrowDown':
      event.preventDefault();
      store.set((s: AppState) => ({ ...s, master: { volume: clamp01(s.master.volume - STEP) } }));
      break;

    case 'ArrowRight':
    case 'ArrowLeft': {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? STEP : -STEP;
      const index = getSelectedLayerIndex();
      store.set((s: AppState) => {
        const layers = [...s.layers] as AppState['layers'];
        layers[index] = { ...layers[index], volume: clamp01(layers[index].volume + delta) };
        return { ...s, layers };
      });
      break;
    }

    case 'm':
    case 'M': {
      const index = getSelectedLayerIndex();
      store.set((s: AppState) => {
        const layers = [...s.layers] as AppState['layers'];
        layers[index] = { ...layers[index], muted: !layers[index].muted };
        return { ...s, layers };
      });
      break;
    }

    case 'Escape':
      // No dialog is owned by this module; other mount points (onboarding) listen for this.
      document.dispatchEvent(new CustomEvent('voidsong:escape'));
      break;

    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6': {
      const id = PRESET_ORDER[Number(event.key) - 1];
      if (id) applyPreset(id);
      break;
    }

    default:
      break;
  }
}

export function initShortcuts(): void {
  document.addEventListener('keydown', handleKeydown);
}
