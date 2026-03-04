import { useRef, useCallback, useEffect } from 'react';

export interface GridMousePos {
  x: number;
  y: number;
}

export interface UseMouseTrackingOptions {
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
}

/**
 * React hook that tracks mouse/touch position relative to a container element
 * and converts pixel coordinates to grid cell coordinates.
 *
 * Uses a ref (not state) to avoid re-renders on every mouse move.
 * Returns a ref callback to attach to the container, and a ref holding the
 * current grid-space mouse position (null when not hovering).
 */
export function useMouseTracking(
  charWidth: number,
  charHeight: number,
  options: UseMouseTrackingOptions = {},
): {
  containerRef: React.RefCallback<HTMLElement>;
  mousePosRef: React.MutableRefObject<GridMousePos | null>;
} {
  const { enabled = true } = options;
  const mousePosRef = useRef<GridMousePos | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const charWidthRef = useRef(charWidth);
  const charHeightRef = useRef(charHeight);
  charWidthRef.current = charWidth;
  charHeightRef.current = charHeight;

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) {
      mousePosRef.current = null;
      return;
    }

    const toGrid = (clientX: number, clientY: number): GridMousePos | null => {
      const cw = charWidthRef.current;
      const ch = charHeightRef.current;
      if (cw <= 0 || ch <= 0) return null;
      const rect = el.getBoundingClientRect();
      return { x: (clientX - rect.left) / cw, y: (clientY - rect.top) / ch };
    };

    const onMove = (e: MouseEvent) => {
      mousePosRef.current = toGrid(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        mousePosRef.current = toGrid(t.clientX, t.clientY);
      }
    };

    const onLeave = () => { mousePosRef.current = null; };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchend', onLeave);

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchend', onLeave);
    };
  }, [enabled]);

  const containerRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  return { containerRef, mousePosRef };
}
