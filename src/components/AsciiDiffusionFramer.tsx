import React, { useMemo } from 'react';
import type { ExtendedDiffusionConfig, RenderConfig, TransitionMode } from '../core/types.js';
import { DEFAULT_DIFFUSION_CONFIG, DEFAULT_RENDER_CONFIG } from '../core/types.js';
import { PRESETS, type PresetName } from '../presets/index.js';
import { AsciiTextEffect } from './AsciiTextEffect.js';

export interface AsciiDiffusionFramerProps {
  // Content
  text: string;
  width?: number;
  height?: number;

  // Physics
  preset?: PresetName;
  physicsMode?: ExtendedDiffusionConfig['physicsMode'];
  scatterRadius?: number;
  scatterForce?: number;
  damping?: number;
  flowSpeed?: number;

  // Rendering
  monoColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;

  // Behavior
  targetFps?: number;
  transitionMode?: TransitionMode;
  animateIn?: boolean;
  scattered?: boolean;

  // Framer
  style?: React.CSSProperties;
}

/**
 * Framer-optimized wrapper component.
 * Exposes a flat property panel interface for Framer's UI.
 */
export function AsciiDiffusionFramer(props: AsciiDiffusionFramerProps) {
  const {
    text = 'HELLO',
    width,
    height,
    preset,
    physicsMode,
    scatterRadius,
    scatterForce,
    damping,
    flowSpeed,
    monoColor,
    backgroundColor,
    fontSize,
    fontFamily,
    targetFps = 30,
    transitionMode = 'morph',
    animateIn = true,
    scattered = true,
    style,
  } = props;

  const config = useMemo<Partial<ExtendedDiffusionConfig>>(() => {
    const presetConfig = preset ? PRESETS[preset] : {};
    return {
      ...presetConfig,
      ...(physicsMode !== undefined ? { physicsMode } : {}),
      ...(scatterRadius !== undefined ? { scatterRadius } : {}),
      ...(scatterForce !== undefined ? { scatterForce } : {}),
      ...(damping !== undefined ? { damping } : {}),
      ...(flowSpeed !== undefined ? { flowSpeed } : {}),
    };
  }, [preset, physicsMode, scatterRadius, scatterForce, damping, flowSpeed]);

  const renderConfig = useMemo<Partial<RenderConfig>>(
    () => ({
      ...(monoColor !== undefined ? { monoColor } : {}),
      ...(backgroundColor !== undefined ? { backgroundColor } : {}),
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(fontFamily !== undefined ? { fontFamily } : {}),
    }),
    [monoColor, backgroundColor, fontSize, fontFamily],
  );

  return (
    <AsciiTextEffect
      text={text}
      width={width}
      height={height}
      config={config}
      renderConfig={renderConfig}
      targetFps={targetFps}
      transitionMode={transitionMode}
      animateIn={animateIn}
      scattered={scattered}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
