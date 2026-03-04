import { useEffect, useRef } from 'react';
import { AnimationLoop } from '../core/animation-loop.js';

export interface UseAnimationLoopOptions {
  /** Target frames per second (default: 30) */
  targetFps?: number;
  /** Whether the loop is currently running (default: true) */
  enabled?: boolean;
}

/**
 * React hook wrapping the AnimationLoop class with delta clamping and FPS throttle.
 *
 * @param callback - Called each frame with (time, delta). Stored in a ref so it
 *                   can change without restarting the loop.
 * @param options - FPS target and enabled flag.
 */
export function useAnimationLoop(
  callback: (time: number, delta: number) => void,
  options: UseAnimationLoopOptions = {},
): void {
  const { targetFps = 30, enabled = true } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const loop = new AnimationLoop(
      (time, delta) => callbackRef.current(time, delta),
      targetFps,
    );
    loop.start();

    return () => loop.stop();
  }, [enabled, targetFps]);
}
