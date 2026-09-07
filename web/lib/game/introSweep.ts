interface IntroCamera {
  smoothTime: number;
  setLookAt: (x: number, y: number, z: number, targetX: number, targetY: number, targetZ: number, transition: boolean) => unknown;
}

export function startIntroSweep(camera: IntroCamera, onActive: (active: boolean) => void, onViewed: () => void, events: EventTarget = window) {
  const previousSmooth = camera.smoothTime;
  let done = false;
  let skipped = false;
  let viewed = false;
  let skipTimer: ReturnType<typeof setTimeout> | undefined;
  const markViewed = () => { if (!viewed) { viewed = true; onViewed(); } };
  const finish = (completed: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(endTimer); clearTimeout(skipTimer);
    events.removeEventListener("keydown", skip, true);
    events.removeEventListener("pointerdown", skip, true);
    camera.smoothTime = previousSmooth;
    onActive(false);
    if (completed) markViewed();
  };
  const skip = () => {
    if (done || skipped) return;
    skipped = true;
    markViewed();
    camera.smoothTime = 0.4;
    void camera.setLookAt(0, 19.5, -35, 0, 1.5, -15, true);
    skipTimer = setTimeout(() => finish(false), 450);
  };
  onActive(true);
  void camera.setLookAt(-14, 23, -43, 0, -2, -10, false);
  camera.smoothTime = 2.6;
  void camera.setLookAt(0, 19.5, -35, 0, 1.5, -15, true);
  const endTimer = setTimeout(() => finish(true), 6500);
  events.addEventListener("keydown", skip, true);
  events.addEventListener("pointerdown", skip, true);
  return () => finish(false);
}
