import { useState, useCallback, useRef } from 'react';
import type { AsciiScene, TransitionMode } from '../core/types.js';
import { transitionScenes, dissolveTransition } from '../scene/transitions.js';

export interface UseSceneTransitionOptions {
  /** Transition mode (default: 'morph') */
  mode?: TransitionMode;
}

/**
 * React hook for animated scene switching.
 *
 * Returns the current active scene and a function to transition to a new scene.
 * For morph/instant, the transition is immediate (particles animate via physics).
 * For dissolve, call stepDissolve() each frame to advance the blend.
 */
export function useSceneTransition(
  initialScene: AsciiScene | null,
  options: UseSceneTransitionOptions = {},
): {
  activeScene: AsciiScene | null;
  transitionTo: (newScene: AsciiScene) => void;
  /** For dissolve mode: advance blend progress. Returns true when complete. */
  stepDissolve: (progressDelta: number) => boolean;
  isTransitioning: boolean;
} {
  const { mode = 'morph' } = options;
  const [activeScene, setActiveScene] = useState<AsciiScene | null>(initialScene);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const dissolveFromRef = useRef<AsciiScene | null>(null);
  const dissolveToRef = useRef<AsciiScene | null>(null);
  const dissolveProgressRef = useRef(0);

  const transitionTo = useCallback(
    (newScene: AsciiScene) => {
      if (!activeScene) {
        setActiveScene(newScene);
        return;
      }

      if (mode === 'dissolve') {
        dissolveFromRef.current = activeScene;
        dissolveToRef.current = newScene;
        dissolveProgressRef.current = 0;
        setIsTransitioning(true);
      } else {
        const result = transitionScenes(activeScene, newScene, mode);
        setActiveScene(result);
      }
    },
    [activeScene, mode],
  );

  const stepDissolve = useCallback(
    (progressDelta: number): boolean => {
      if (!dissolveFromRef.current || !dissolveToRef.current) return true;

      dissolveProgressRef.current = Math.min(
        dissolveProgressRef.current + progressDelta,
        1,
      );

      const result = dissolveTransition(
        dissolveFromRef.current,
        dissolveToRef.current,
        dissolveProgressRef.current,
      );
      setActiveScene(result);

      if (dissolveProgressRef.current >= 1) {
        setActiveScene(dissolveToRef.current);
        dissolveFromRef.current = null;
        dissolveToRef.current = null;
        setIsTransitioning(false);
        return true;
      }

      return false;
    },
    [],
  );

  return { activeScene, transitionTo, stepDissolve, isTransitioning };
}
