import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  useState,
} from 'react';
import type {
  AsciiScene,
  ExtendedDiffusionConfig,
  RenderConfig,
  TransitionMode,
} from '../core/types.js';
import { DEFAULT_RENDER_CONFIG } from '../core/types.js';
import { renderToString, colorGridToHtml } from '../core/renderer.js';
import { useAnimationLoop } from '../hooks/useAnimationLoop.js';
import { useMouseTracking } from '../hooks/useMouseTracking.js';
import { useParticlePhysics } from '../hooks/useParticlePhysics.js';
import { triggerShow, triggerHide, allParticlesHome } from '../core/lifecycle.js';
import { transitionScenes } from '../scene/transitions.js';

// ── Types ──

export interface AsciiDiffusionRendererProps {
  /** The scene to render */
  scene: AsciiScene;
  /** Config overrides applied on top of scene.config */
  configOverrides?: Partial<ExtendedDiffusionConfig>;
  /** Render config for styling */
  renderConfig?: Partial<RenderConfig>;
  /** Target FPS (default: 30) */
  targetFps?: number;
  /** Transition mode when scene changes (default: 'morph') */
  transitionMode?: TransitionMode;
  /** Whether to play intro animation on mount (default: false) */
  animateIn?: boolean;
  /** Called when all particles have arrived home after show animation */
  onShowComplete?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export interface AsciiDiffusionRendererRef {
  /** Trigger show (intro) animation */
  show: () => void;
  /** Trigger hide (outro) animation */
  hide: () => void;
  /** Get the current scene ref */
  getScene: () => AsciiScene | null;
}

/**
 * Main React component for rendering ASCII particle simulations.
 * Uses direct DOM mutation (innerHTML) for 60fps performance.
 */
export const AsciiDiffusionRenderer = forwardRef<
  AsciiDiffusionRendererRef,
  AsciiDiffusionRendererProps
>(function AsciiDiffusionRenderer(props, ref) {
  const {
    scene,
    configOverrides,
    renderConfig: renderConfigOverrides,
    targetFps = 30,
    transitionMode = 'morph',
    animateIn = false,
    onShowComplete,
    className,
    style,
  } = props;

  const preRef = useRef<HTMLPreElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [charSize, setCharSize] = useState({ w: 0, h: 0 });
  const onShowCompleteRef = useRef(onShowComplete);
  onShowCompleteRef.current = onShowComplete;
  const checkingShowRef = useRef(false);

  // Track previous scene for transitions (via useEffect, not useMemo)
  const [activeScene, setActiveScene] = useState<AsciiScene>(scene);
  const prevSceneRef = useRef<AsciiScene>(scene);

  useEffect(() => {
    if (prevSceneRef.current === scene) {
      return;
    }
    const result = transitionScenes(prevSceneRef.current, scene, transitionMode);
    prevSceneRef.current = result;
    setActiveScene(result);
  }, [scene, transitionMode]);

  const renderConfig = useMemo(
    () => ({ ...DEFAULT_RENDER_CONFIG, ...renderConfigOverrides }),
    [renderConfigOverrides],
  );

  // Measure character size from a hidden span
  useEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const rect = measure.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setCharSize({ w: rect.width, h: rect.height });
    }
  }, [renderConfig.fontSize, renderConfig.fontFamily]);

  // Physics state — uses refs, no re-renders per mouse move
  const { containerRef, mousePosRef } = useMouseTracking(charSize.w, charSize.h);
  const { step, renderColorGrid, sceneRef } = useParticlePhysics({
    scene: activeScene,
    mousePosRef,
    configOverrides,
  });

  // animateIn on mount
  useEffect(() => {
    if (animateIn && sceneRef.current) {
      triggerShow(sceneRef.current.particles, sceneRef.current);
      checkingShowRef.current = true;
    }
  }, [animateIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Imperative handle
  useImperativeHandle(ref, () => ({
    show() {
      const s = sceneRef.current;
      if (s) {
        triggerShow(s.particles, s);
        checkingShowRef.current = true;
      }
    },
    hide() {
      const s = sceneRef.current;
      if (s) {
        triggerHide(s.particles, s);
      }
    },
    getScene() {
      return sceneRef.current;
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop — tick is stable (no mousePos/configOverrides in deps)
  const tick = useCallback(
    (_time: number, delta: number) => {
      step(delta);

      // Check show completion
      if (checkingShowRef.current && sceneRef.current) {
        if (allParticlesHome(sceneRef.current.particles)) {
          checkingShowRef.current = false;
          onShowCompleteRef.current?.();
        }
      }

      // Render to DOM
      const el = preRef.current;
      if (!el) return;

      const useColor =
        renderConfig.colorMode === 'per-particle' ||
        renderConfig.colorMode === 'brightness-mapped';

      if (useColor) {
        const grid = renderColorGrid();
        el.innerHTML = colorGridToHtml(grid, renderConfig.monoColor);
      } else {
        const s = sceneRef.current;
        if (!s) return;
        el.textContent = renderToString(s.particles, s.width, s.height, s.config);
      }
    },
    [step, renderColorGrid, renderConfig.colorMode, renderConfig.monoColor],
  );

  useAnimationLoop(tick, { targetFps });

  // Container ref merging (mouse tracking + our pre ref)
  const mergedRef = useCallback(
    (node: HTMLPreElement | null) => {
      preRef.current = node;
      containerRef(node);
    },
    [containerRef],
  );

  const preStyle: React.CSSProperties = {
    margin: 0,
    padding: 0,
    fontFamily: renderConfig.fontFamily,
    fontSize: renderConfig.fontSize,
    lineHeight: renderConfig.lineHeight,
    letterSpacing: renderConfig.letterSpacing,
    color: renderConfig.monoColor,
    backgroundColor: renderConfig.backgroundColor,
    overflow: 'hidden',
    cursor: 'crosshair',
    userSelect: 'none',
    whiteSpace: 'pre',
    ...(renderConfig.disableLigatures
      ? { fontFeatureSettings: '"liga" 0, "calt" 0' }
      : {}),
    ...style,
  };

  return (
    <>
      <span
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          fontFamily: renderConfig.fontFamily,
          fontSize: renderConfig.fontSize,
          lineHeight: renderConfig.lineHeight,
          letterSpacing: renderConfig.letterSpacing,
          whiteSpace: 'pre',
          ...(renderConfig.disableLigatures
            ? { fontFeatureSettings: '"liga" 0, "calt" 0' }
            : {}),
        }}
        aria-hidden
      >
        M
      </span>
      <pre ref={mergedRef} className={className} style={preStyle} />
    </>
  );
});
