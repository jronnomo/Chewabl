import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useThemeTransition } from '../context/ThemeTransitionContext';

// ─── ANIMATION TIMING ───────────────────────────────────────────────────────
// 4 discrete *chomp* bites with pauses between them
const BITE_COUNT = 5;
const BITE_DURATION = 200;    // ms per bite's grow animation
const BITE_PAUSE = 120;       // ms pause between bites
const COMMIT_DELAY = 150;     // ms before isDarkMode flips

// [DA-FIX-5] Haptic thresholds: fire at the start of each bite
const HAPTIC_THRESHOLDS = [0.01, 1.01, 2.01, 3.01, 4.01] as const;

// ─── DETERMINISTIC PSEUDO-RANDOM ────────────────────────────────────────────
// Mulberry32 — consistent across renders, good distribution
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface ScallopCircle {
  /** Angular position on the bite arc (radians from bite center) */
  angle: number;
  /** Radius of this individual scallop circle */
  radius: number;
}

interface BiteSpec {
  /** Bite center X (positioned off one screen edge) */
  cx: number;
  /** Bite center Y */
  cy: number;
  /** Maximum reach of the bite from center */
  targetRadius: number;
  /** Scallop circles along the bite arc — define the organic irregular edge */
  scallops: ScallopCircle[];
}

export default function ChompOverlay() {
  // [DA-FIX-4] Dimensions from hook — updates on rotation
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // [DA-FIX-4] Bite specs with scalloped perimeters — recalculates on rotation
  const biteSpecs = useMemo((): BiteSpec[] => {
    const scallopBaseR = screenWidth * 0.1; // base scallop circle radius

    // Generate scallop circles arranged along an arc of a bite
    function generateScallops(
      biteIdx: number,
      targetR: number,
      arcStart: number,  // start angle (radians)
      arcEnd: number,    // end angle (radians)
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

    return [
      // 1. Top-left bite (small — first tentative nibble)
      {
        cx: -screenWidth * 0.15,
        cy: screenHeight * 0.18,
        targetRadius: screenHeight * 0.30,
        scallops: generateScallops(0, screenHeight * 0.30, -1.0, 2.0),
      },
      // 2. Right bite (small-medium)
      {
        cx: screenWidth * 1.15,
        cy: screenHeight * 0.38,
        targetRadius: screenHeight * 0.34,
        scallops: generateScallops(1, screenHeight * 0.34, 1.5, 4.7),
      },
      // 3. Left bite (medium)
      {
        cx: -screenWidth * 0.1,
        cy: screenHeight * 0.65,
        targetRadius: screenHeight * 0.38,
        scallops: generateScallops(2, screenHeight * 0.38, -1.2, 1.8),
      },
      // 4. Bottom-right bite (clears the corner)
      {
        cx: screenWidth * 1.1,
        cy: screenHeight * 0.88,
        targetRadius: screenHeight * 0.45,
        scallops: generateScallops(3, screenHeight * 0.45, 1.5, 4.5),
      },
      // 5. Center bite (MASSIVE — grand finale, devours all remaining content)
      {
        cx: screenWidth * 0.45,
        cy: screenHeight * 0.45,
        targetRadius: screenHeight * 0.85,
        scallops: generateScallops(4, screenHeight * 0.85, -0.5, 6.8),
      },
    ];
  }, [screenWidth, screenHeight]);

  // ── Component state ────────────────────────────────────────────────────────

  // Whether overlay is rendered at all (null-return gate)
  const [visible, setVisible] = useState(false);

  // The captured old-theme background color string (e.g. '#F2F0ED')
  const [overlayColor, setOverlayColor] = useState('#F2F0ED');

  // Animated progress: 0 → BITE_COUNT. Each integer step = one bite fully grown.
  // Driven by Animated.sequence, listened to via addListener → setProgress
  const progressAnim = useRef(new Animated.Value(0)).current;

  // React state copy of progressAnim — needed to re-render the SVG
  const [progress, setProgress] = useState(0);

  // Tracks which haptic thresholds have already fired this animation run
  const hapticFiredRef = useRef<Set<number>>(new Set());

  // [DA-FIX-6] Resource refs for cleanup on unmount
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  // Context
  const { registerOverlayTrigger } = useThemeTransition();

  const trigger = useCallback(
    async (fromBgColor: string, onCommit: () => void, onDone: () => void) => {
      // [DA-FIX-3] Check reduced motion BEFORE showing overlay
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reducedMotion) {
        onCommit();
        onDone();
        return;
      }

      // 1. Show overlay with old theme color
      setOverlayColor(fromBgColor);
      setProgress(0);
      setVisible(true);

      // 2. Commit the theme after COMMIT_DELAY so new theme renders underneath
      // [DA-FIX-6] Store timer ID for cleanup
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;

        let animationStarted = false;
        try {
          onCommit();

          // 3. Reset animation value and haptic tracker
          progressAnim.setValue(0);
          hapticFiredRef.current.clear();

          // 4. Attach listener to drive SVG re-renders + haptics
          // [DA-FIX-6] Store listener ID for cleanup
          const listenerId = progressAnim.addListener(({ value }) => {
            setProgress(value);
            for (const threshold of HAPTIC_THRESHOLDS) {
              if (value >= threshold && !hapticFiredRef.current.has(threshold)) {
                hapticFiredRef.current.add(threshold);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }
          });
          listenerIdRef.current = listenerId;

          // 5. Build stepped animation: *chomp* pause ×5
          // Total: 5×200 + 4×120 = 1480ms, plus 150ms commit delay = 1630ms
          const steps: Animated.CompositeAnimation[] = [];
          for (let i = 0; i < BITE_COUNT; i++) {
            steps.push(
              Animated.timing(progressAnim, {
                toValue: i + 1 + (i === BITE_COUNT - 1 ? 0.01 : 0),
                duration: BITE_DURATION,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
              })
            );
            if (i < BITE_COUNT - 1) {
              steps.push(Animated.delay(BITE_PAUSE));
            }
          }

          animationStarted = true;
          Animated.sequence(steps).start(() => {
            // 6. Animation complete — cleanup
            progressAnim.removeListener(listenerId);
            listenerIdRef.current = null;
            setVisible(false);
            onDone();
          });
        } finally {
          if (!animationStarted) {
            setVisible(false);
            onDone();
          }
        }
      }, COMMIT_DELAY);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // [DA-FIX-1] Ref that always points to the latest trigger function
  const triggerRef = useRef(trigger);
  useEffect(() => {
    triggerRef.current = trigger;
  });

  // [DA-FIX-1] Register a STABLE WRAPPER once on mount
  useEffect(() => {
    registerOverlayTrigger((...args: Parameters<typeof trigger>) => {
      triggerRef.current(...args);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // [DA-FIX-6] Clean up timer and listener on component unmount
  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
      if (listenerIdRef.current !== null) {
        progressAnim.removeListener(listenerIdRef.current);
      }
    };
  }, [progressAnim]);

  // Critical: return null when not animating → zero rendering cost at rest
  if (!visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }]}
      pointerEvents="none"
    >
      <Svg width={screenWidth} height={screenHeight}>
        <Defs>
          <Mask id="chompMask_overlay">
            <Rect
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
              fill="white"
            />
            {biteSpecs.map((spec, i) => {
              // Each bite grows when progress passes its index
              const t = Math.max(0, Math.min(1, progress - i));
              if (t <= 0) return null;

              const mainR = t * spec.targetRadius;
              // Fill circle: slightly smaller than scallop arc, fills the body behind the edge
              const fillR = mainR * 0.95;

              return [
                // Interior fill — solid body of the bite
                <Circle
                  key={`fill-${i}`}
                  cx={spec.cx}
                  cy={spec.cy}
                  r={fillR}
                  fill="black"
                />,
                // Scallop circles along the arc — creates the organic cookie-bite edge
                // Each scallop's center sits on the mainR arc, radius scales with t
                ...spec.scallops.map((sc, j) => (
                  <Circle
                    key={`sc-${i}-${j}`}
                    cx={spec.cx + mainR * Math.cos(sc.angle)}
                    cy={spec.cy + mainR * Math.sin(sc.angle)}
                    r={t * sc.radius}
                    fill="black"
                  />
                )),
              ];
            })}
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={screenWidth}
          height={screenHeight}
          fill={overlayColor}
          mask="url(#chompMask_overlay)"
        />
      </Svg>
    </View>
  );
}
