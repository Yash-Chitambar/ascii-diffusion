export type AnimationCallback = (time: number, delta: number) => void;

/**
 * Standalone animation loop (non-React).
 * Runs at target FPS with delta clamping.
 */
export class AnimationLoop {
  private callback: AnimationCallback;
  private rafId: number | null = null;
  private lastTime = 0;
  private minInterval: number;

  constructor(callback: AnimationCallback, targetFps = 30) {
    this.callback = callback;
    this.minInterval = 1000 / targetFps;
  }

  start(): void {
    this.lastTime = 0;
    const tick = (time: number) => {
      if (this.lastTime === 0) {
        this.lastTime = time;
        this.rafId = requestAnimationFrame(tick);
        return;
      }

      const rawDelta = time - this.lastTime;

      // Throttle to target FPS
      if (rawDelta < this.minInterval) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }

      // Clamp delta to prevent physics explosion after tab switch
      const delta = Math.min(rawDelta, 50);
      this.lastTime = time;

      this.callback(time, delta);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setTargetFps(fps: number): void {
    this.minInterval = 1000 / fps;
  }
}
