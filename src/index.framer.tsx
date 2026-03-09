import { AsciiDiffusionFramer } from './components/AsciiDiffusionFramer.js';

export default AsciiDiffusionFramer;

/**
 * Framer property controls.
 *
 * When used inside Framer, register this component with:
 *   import Component, { propertyControls } from './index.framer'
 *   addPropertyControls(Component, propertyControls)
 */
export const propertyControls = {
  text: {
    type: 'string' as const,
    title: 'Text',
    defaultValue: 'HELLO',
  },
  width: {
    type: 'number' as const,
    title: 'Grid Width',
    min: 10,
    max: 300,
    step: 1,
  },
  height: {
    type: 'number' as const,
    title: 'Grid Height',
    min: 5,
    max: 200,
    step: 1,
  },
  preset: {
    type: 'enum' as const,
    title: 'Preset',
    options: ['gentle', 'responsive', 'aggressive', 'jelly', 'snappy', 'flow', 'cinema', 'shimmer', 'depth', 'magnetic', 'flock'],
    optionTitles: ['Gentle', 'Responsive', 'Aggressive', 'Jelly', 'Snappy', 'Flow', 'Cinema', 'Shimmer', 'Depth', 'Magnetic', 'Flock'],
  },
  physicsMode: {
    type: 'enum' as const,
    title: 'Physics Mode',
    options: ['flow-matching', 'diffusion', 'gravity', 'vortex', 'explosion', 'wave', 'magnetic'],
    optionTitles: ['Flow Matching', 'Diffusion', 'Gravity', 'Vortex', 'Explosion', 'Wave', 'Magnetic'],
    defaultValue: 'flow-matching',
  },
  scatterRadius: {
    type: 'number' as const,
    title: 'Scatter Radius',
    min: 1,
    max: 30,
    step: 0.5,
    defaultValue: 8,
  },
  scatterForce: {
    type: 'number' as const,
    title: 'Scatter Force',
    min: 0.1,
    max: 5,
    step: 0.1,
    defaultValue: 0.8,
  },
  damping: {
    type: 'number' as const,
    title: 'Damping',
    min: 0.5,
    max: 0.99,
    step: 0.01,
    defaultValue: 0.92,
  },
  flowSpeed: {
    type: 'number' as const,
    title: 'Flow Speed',
    min: 0.01,
    max: 0.2,
    step: 0.005,
    defaultValue: 0.04,
  },
  monoColor: {
    type: 'color' as const,
    title: 'Text Color',
    defaultValue: '#00d4ff',
  },
  backgroundColor: {
    type: 'color' as const,
    title: 'Background',
    defaultValue: 'transparent',
  },
  fontSize: {
    type: 'string' as const,
    title: 'Font Size',
    defaultValue: 'clamp(6px, 1.2vw, 14px)',
  },
  targetFps: {
    type: 'number' as const,
    title: 'Target FPS',
    min: 15,
    max: 60,
    step: 1,
    defaultValue: 30,
  },
  animateIn: {
    type: 'boolean' as const,
    title: 'Animate In',
    defaultValue: true,
  },
  scattered: {
    type: 'boolean' as const,
    title: 'Start Scattered',
    defaultValue: true,
  },
};
