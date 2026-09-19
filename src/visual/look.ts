// Steering input for the tunnel: mouse on a computer, tilt on a phone.
//
// Both feed `renderer.setLook(x, y)` with values in -1..1. Nothing is sent
// anywhere and nothing is stored. Touch drags do not steer (they scroll the
// page); only a mouse or pen does. Phone tilt needs a permission prompt on
// iOS, which can only be requested from a tap, so it is asked for on the first
// tap anywhere on the page.

interface LookTarget {
  setLook(x: number, y: number): void;
}

const TILT_RANGE_DEG = 25;      // tilt that counts as full deflection
const BASELINE_FOLLOW = 0.0015; // per event: the neutral pose slowly follows how you hold the phone

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

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

  // --- phone tilt ----------------------------------------------------------
  let baseGamma: number | null = null;
  let baseBeta: number | null = null;

  const onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.gamma === null || e.beta === null) return; // desktops fire one empty event
    if (baseGamma === null || baseBeta === null) {
      baseGamma = e.gamma;
      baseBeta = e.beta;
    }
    baseGamma += (e.gamma - baseGamma) * BASELINE_FOLLOW;
    baseBeta += (e.beta - baseBeta) * BASELINE_FOLLOW;
    target.setLook(
      clamp1((e.gamma - baseGamma) / TILT_RANGE_DEG),
      clamp1((baseBeta - e.beta) / TILT_RANGE_DEG),
    );
  };

  let listening = false;
  const listen = (): void => {
    if (listening) return;
    listening = true;
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    cleanups.push(() => window.removeEventListener('deviceorientation', onOrientation));
  };

  if (typeof DeviceOrientationEvent !== 'undefined') {
    const ctor = DeviceOrientationEvent as OrientationCtor;
    if (typeof ctor.requestPermission === 'function') {
      // iOS: ask once, from the first tap.
      const onTap = (): void => {
        window.removeEventListener('click', onTap);
        ctor.requestPermission!().then((r) => { if (r === 'granted') listen(); }).catch(() => {});
      };
      window.addEventListener('click', onTap);
      cleanups.push(() => window.removeEventListener('click', onTap));
    } else {
      listen();
    }
  }

  return () => cleanups.forEach((fn) => fn());
}
