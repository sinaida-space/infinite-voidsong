// Steering input for the tunnel: the mouse on a computer.
//
// Feeds `renderer.setLook(x, y)` with values in -1..1. Nothing is sent
// anywhere and nothing is stored. Touch drags do not steer (they scroll the
// page); only a mouse or pen does. Phones get a fixed view: the tilt sensor is
// deliberately not used, so there is no motion permission prompt on iOS.

interface LookTarget {
  setLook(x: number, y: number): void;
}

const clamp1 = (v: number): number => Math.min(1, Math.max(-1, v));

export function attachLook(target: LookTarget): () => void {
  const cleanups: Array<() => void> = [];

  // --- mouse ---------------------------------------------------------------
  const onPointer = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    target.setLook(clamp1((e.clientX / window.innerWidth) * 2 - 1), clamp1(1 - (e.clientY / window.innerHeight) * 2));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  cleanups.push(() => window.removeEventListener('pointermove', onPointer));

  return () => cleanups.forEach((fn) => fn());
}
