// lib/scallopUtils.ts
// Extracted from components/ChompOverlay.tsx
// Shared by ChompOverlay and bite-mark card edges in profile

/** A single scallop circle on a bite arc edge */
export interface ScallopCircle {
  /** Angular position on the bite arc (radians from bite center) */
  angle: number;
  /** Radius of this individual scallop circle */
  radius: number;
}

/**
 * Mulberry32 seeded pseudo-random — consistent across renders, good distribution.
 * Extracted verbatim from ChompOverlay.tsx.
 */
export function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Map a seeded random to [min, max].
 */
export function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

/**
 * Generate scallop circles arranged along an arc of a bite.
 *
 * IMPORTANT: `scallopBaseR` was previously a closure variable inside ChompOverlay's
 * useMemo. It must now be passed as an explicit parameter at every call site.
 *
 * @param biteIdx   — index of the bite (0-based), used as seed offset
 * @param targetR   — maximum reach of the bite from its center
 * @param arcStart  — start angle of the arc (radians)
 * @param arcEnd    — end angle of the arc (radians)
 * @param scallopBaseR — base radius for scallop circles (caller passes screenWidth * 0.1)
 */
export function generateScallops(
  biteIdx: number,
  targetR: number,
  arcStart: number,
  arcEnd: number,
  scallopBaseR: number,
): ScallopCircle[] {
  // Spacing: 0.7 * diameter = 30% overlap for continuous scalloping
  const linearSpacing = scallopBaseR * 2 * 0.7;
  const angularSpacing = linearSpacing / targetR;

  const arcRange = arcEnd - arcStart;
  const count = Math.ceil(Math.abs(arcRange) / angularSpacing) + 1;
  const scallops: ScallopCircle[] = [];

  // Main scallop circles along the arc
  for (let j = 0; j < count; j++) {
    const frac = count > 1 ? j / (count - 1) : 0.5;
    const baseAngle = arcStart + frac * arcRange;
    const seed = biteIdx * 1000 + j;
    const radiusMult = seededRange(seed * 7 + 1, 0.85, 1.25);
    const jitter = seededRange(seed * 7 + 2, -0.5, 0.5) * angularSpacing * 0.12;

    scallops.push({
      angle: baseAngle + jitter,
      radius: scallopBaseR * radiusMult,
    });
  }

  // Micro-bites between every 3rd pair for cookie crumb texture
  const mainCount = scallops.length;
  for (let j = 0; j < mainCount - 1; j += 3) {
    const seed = biteIdx * 2000 + j;
    const midAngle = (scallops[j].angle + scallops[j + 1].angle) / 2;
    scallops.push({
      angle: midAngle + seededRange(seed, -0.03, 0.03),
      radius: scallopBaseR * seededRange(seed + 1, 0.35, 0.55),
    });
  }

  return scallops;
}
