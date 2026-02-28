// lib/sparkleUtils.ts
// Extracted from components/SwipeCard.tsx
// Shared by SwipeCard (curveball gleam) and BiteCard (new-bite celebration)

/** Position and size of a single sparkle particle */
export interface SparkleConfig {
  /** Horizontal position as fraction of container width (0–1) */
  x: number;
  /** Vertical position as fraction of container height (0–1) */
  y: number;
  /** Radius in logical pixels */
  size: number;
  /** Shape variant */
  type: 'star' | 'dot';
}

/**
 * 4-point star SVG path centered at (cx, cy) with given radius.
 * Extracted verbatim from SwipeCard.tsx.
 */
export function starPath(cx: number, cy: number, r: number): string {
  const inner = r * 0.28;
  return `M ${cx} ${cy - r} L ${cx + inner} ${cy - inner} L ${cx + r} ${cy} L ${cx + inner} ${cy + inner} L ${cx} ${cy + r} L ${cx - inner} ${cy + inner} L ${cx - r} ${cy} L ${cx - inner} ${cy - inner} Z`;
}

/**
 * Deterministic sparkle positions — x/y as fraction of container dimensions.
 * Extracted verbatim from SwipeCard.tsx.
 * Full set: 21 sparkles. BiteCard slices [0..4] (standard) or [0..7] (golden).
 */
export const SPARKLES: SparkleConfig[] = [
  { x: 0.08, y: 0.30, size: 5, type: 'dot' },
  { x: 0.14, y: 0.52, size: 9, type: 'star' },
  { x: 0.11, y: 0.18, size: 3, type: 'dot' },
  { x: 0.22, y: 0.38, size: 7, type: 'star' },
  { x: 0.19, y: 0.62, size: 4, type: 'dot' },
  { x: 0.30, y: 0.25, size: 11, type: 'star' },
  { x: 0.35, y: 0.55, size: 5, type: 'dot' },
  { x: 0.40, y: 0.42, size: 13, type: 'star' },
  { x: 0.38, y: 0.15, size: 4, type: 'dot' },
  { x: 0.48, y: 0.60, size: 8, type: 'star' },
  { x: 0.52, y: 0.32, size: 15, type: 'star' },
  { x: 0.56, y: 0.50, size: 5, type: 'dot' },
  { x: 0.62, y: 0.22, size: 10, type: 'star' },
  { x: 0.60, y: 0.68, size: 4, type: 'dot' },
  { x: 0.70, y: 0.45, size: 12, type: 'star' },
  { x: 0.72, y: 0.28, size: 6, type: 'dot' },
  { x: 0.78, y: 0.58, size: 8, type: 'star' },
  { x: 0.82, y: 0.35, size: 4, type: 'dot' },
  { x: 0.88, y: 0.48, size: 10, type: 'star' },
  { x: 0.92, y: 0.20, size: 5, type: 'dot' },
  { x: 0.94, y: 0.55, size: 7, type: 'star' },
];
