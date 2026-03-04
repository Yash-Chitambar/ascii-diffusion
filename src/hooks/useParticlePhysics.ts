import { useRef, useCallback, useMemo } from 'react';
import type { AsciiScene, ExtendedDiffusionConfig } from '../core/types.js';
import { getPhysicsApplicator } from '../core/physics.js';
import { renderToString, renderToColorGrid } from '../core/renderer.js';
import type { GridMousePos } from './useMouseTracking.js';

export interface UseParticlePhysicsOptions {
  scene: AsciiScene | null;
  mousePosRef: React.MutableRefObject<GridMousePos | null>;
  configOverrides?: Partial<ExtendedDiffusionConfig>;
}

export interface ParticlePhysicsState {
  /** Step physics forward by dt milliseconds */
  step: (dt: number) => void;
  /** Render current state to a monochrome string */
  renderString: () => string;
  /** Render current state to a color grid */
  renderColorGrid: () => import('../core/types.js').ColorCell[][];
  /** Direct access to the scene ref (for lifecycle calls) */
  sceneRef: React.MutableRefObject<AsciiScene | null>;
}

/**
 * React hook that manages particle physics state.
 * Holds the mutable scene reference and provides step/render functions.
 */
export function useParticlePhysics(
  options: UseParticlePhysicsOptions,
): ParticlePhysicsState {
  const { scene, mousePosRef, configOverrides } = options;
  const sceneRef = useRef<AsciiScene | null>(null);
  const configOverridesRef = useRef(configOverrides);
  configOverridesRef.current = configOverrides;

  // Update scene ref when scene prop changes
  if (scene !== null) {
    if (sceneRef.current !== scene) {
      sceneRef.current = scene;
    }
  }

  // Memoize merged config to avoid per-frame object spread
  const mergedConfig = useMemo(() => {
    if (!scene) return null;
    return configOverrides ? { ...scene.config, ...configOverrides } : scene.config;
  }, [scene, configOverrides]);
  const mergedConfigRef = useRef(mergedConfig);
  mergedConfigRef.current = mergedConfig;

  const step = useCallback(
    (dt: number) => {
      const s = sceneRef.current;
      const config = mergedConfigRef.current;
      if (!s || !config) return;

      const applicator = getPhysicsApplicator(config.physicsMode);
      applicator.apply(s.particles, mousePosRef.current, config, dt);
    },
    [mousePosRef],
  );

  const renderString = useCallback(() => {
    const s = sceneRef.current;
    const config = mergedConfigRef.current;
    if (!s) return '';
    return renderToString(s.particles, s.width, s.height, config ?? s.config);
  }, []);

  const renderColorGrid = useCallback(() => {
    const s = sceneRef.current;
    const config = mergedConfigRef.current;
    if (!s) return [];
    return renderToColorGrid(s.particles, s.width, s.height, config ?? s.config);
  }, []);

  return { step, renderString, renderColorGrid, sceneRef };
}
