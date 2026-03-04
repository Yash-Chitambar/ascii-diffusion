import React, { useMemo, forwardRef } from 'react';
import type {
  ExtendedDiffusionConfig,
  RenderConfig,
  TransitionMode,
} from '../core/types.js';
import { DEFAULT_DIFFUSION_CONFIG } from '../core/types.js';
import { textToParticles } from '../scene/text-to-particles.js';
import {
  AsciiDiffusionRenderer,
  type AsciiDiffusionRendererRef,
} from './AsciiDiffusionRenderer.js';

export interface AsciiTextEffectProps {
  /** The text to render as ASCII particles */
  text: string;
  /** Grid width in characters (default: auto from text) */
  width?: number;
  /** Grid height in characters (default: auto from text) */
  height?: number;
  /** Color for all particles */
  color?: string;
  /** Physics config */
  config?: Partial<ExtendedDiffusionConfig>;
  /** Render config for styling */
  renderConfig?: Partial<RenderConfig>;
  /** Target FPS */
  targetFps?: number;
  /** Transition mode when text changes */
  transitionMode?: TransitionMode;
  /** Whether to scatter particles on mount */
  scattered?: boolean;
  /** Play intro animation on mount */
  animateIn?: boolean;
  /** Called when show animation completes */
  onShowComplete?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Simplified text-only convenience component.
 * Wraps AsciiDiffusionRenderer with automatic text → scene conversion.
 */
export const AsciiTextEffect = forwardRef<
  AsciiDiffusionRendererRef,
  AsciiTextEffectProps
>(function AsciiTextEffect(props, ref) {
  const {
    text,
    width,
    height,
    color,
    config: configOverrides,
    renderConfig,
    targetFps,
    transitionMode,
    scattered = false,
    animateIn,
    onShowComplete,
    className,
    style,
  } = props;

  const scene = useMemo(() => {
    const lines = text.split('\n');
    const autoWidth = width ?? Math.max(...lines.map((l) => l.length), 1);
    const autoHeight = height ?? lines.length;

    const particles = textToParticles(text, { color, scattered });
    const mergedConfig: ExtendedDiffusionConfig = {
      ...DEFAULT_DIFFUSION_CONFIG,
      ...configOverrides,
    };

    return {
      particles,
      width: autoWidth,
      height: autoHeight,
      config: mergedConfig,
    };
  }, [text, width, height, color, configOverrides, scattered]);

  return (
    <AsciiDiffusionRenderer
      ref={ref}
      scene={scene}
      renderConfig={renderConfig}
      targetFps={targetFps}
      transitionMode={transitionMode}
      animateIn={animateIn}
      onShowComplete={onShowComplete}
      className={className}
      style={style}
    />
  );
});
