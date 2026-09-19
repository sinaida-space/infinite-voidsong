// Lock-screen and headset controls (Media Session API), so play and pause work
// from a phone's lock screen or a keyboard media key. Sends nothing anywhere.

import { store } from '../state/store';

export function mountMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;

  session.metadata = new MediaMetadata({
    title: 'Infinite Voidsong',
    artist: 'Sinaida Krivchenko',
    album: 'Endless generated soundscapes',
  });

  session.setActionHandler('play', () => {
    store.set((s) => (s.playback === 'playing' ? s : { ...s, playback: 'starting' }));
  });
  session.setActionHandler('pause', () => {
    store.set((s) => (s.playback === 'playing' ? { ...s, playback: 'paused' } : s));
  });

  store.subscribe((s) => {
    session.playbackState = s.playback === 'playing' ? 'playing' : s.playback === 'paused' ? 'paused' : 'none';
  });
}
