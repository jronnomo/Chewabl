import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useThemeTransition } from '../context/ThemeTransitionContext';

// MODULE-LEVEL static constants (no screen dimensions used here):
const COLS = 5;
const ROWS = 10;
const COMMIT_DELAY = 150;       // ms — time before isDarkMode flips
const ANIMATION_DURATION = 600; // ms — total cascade duration after commit

// [DA-FIX-5] Haptic row thresholds: 0.5 so row-0 fires after circles are visibly growing
const HAPTIC_ROWS = [0.5, 4, 8] as const;

interface CircleSpec {
  /** Column index, may be -1 or COLS for edge overlap */
  col: number;
  /** Row index 0..ROWS-1 */
  row: number;
  /** Horizontal center of circle, accounting for brickwork stagger */
  cx: number;
  /** Vertical center — sits at TOP EDGE of row band, i.e. row * CELL_HEIGHT */
  cy: number;
}

// Pure function at module level — no hooks needed.
// getCircleRadius accepts maxRadius as a parameter so it stays pure and testable.
function getCircleRadius(progress: number, row: number, maxRadius: number): number {
  const r = (progress - row) * maxRadius;
  return r < 0 ? 0 : r > maxRadius ? maxRadius : r;
}

export default function ChompOverlay() {
  // [DA-FIX-4] Dimensions from hook — updates on rotation
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // [DA-FIX-4] All dimension-derived constants computed via useMemo — recalculates on rotation
  const { CIRCLE_RADIUS, circlesSpec } = useMemo(() => {
    const cellWidth = screenWidth / COLS;
    const cellHeight = screenHeight / ROWS;

    // [DA-FIX-2] Use Math.max(cellWidth, cellHeight) to handle tall cells.
    // On most phones cellHeight > cellWidth (e.g., 85.2px vs 78.6px on iPhone 15 Pro).
    // Without this, the last row leaves a ~34px uncovered strip at the bottom.
    // Factor 0.65 gives radius = 0.65 * max(cellWidth, cellHeight).
    const CIRCLE_RADIUS = Math.max(cellWidth, cellHeight) * 0.65;

    // Pre-compute all circle specs for this screen size
    // Col range is -1 to COLS (inclusive) to handle brickwork edge overlap:
    //   col -1: partially off left edge, covers left side of col 0 on odd rows
    //   col COLS: partially off right edge, covers right side of last col on odd rows
    const circlesSpec: CircleSpec[] = [];
    for (let row = 0; row < ROWS; row++) {
      const xOffset = row % 2 === 1 ? cellWidth / 2 : 0;
      const cy = row * cellHeight; // circle center at TOP EDGE → upward-facing semicircle
      for (let col = -1; col <= COLS; col++) {
        const cx = col * cellWidth + cellWidth / 2 + xOffset;
        circlesSpec.push({ col, row, cx, cy });
      }
    }
    // Result: 10 rows × 7 circles = 70 total CircleSpec entries

    return { CIRCLE_RADIUS, circlesSpec };
  }, [screenWidth, screenHeight]);

  // Whether overlay is rendered at all (null-return gate)
  const [visible, setVisible] = useState(false);

  // The captured old-theme background color string (e.g. '#F2F0ED')
  const [overlayColor, setOverlayColor] = useState('#F2F0ED');

  // Animated progress: 0.0 = no circles grown, ROWS+0.01 = all rows fully grown
  // Driven by Animated.timing, listened to via addListener → setProgress
  const progressAnim = useRef(new Animated.Value(0)).current;

  // React state copy of progressAnim — needed to re-render the SVG
  const [progress, setProgress] = useState(0);

  // Tracks which haptic row thresholds have already fired this animation run
  // Reset before each animation starts via .clear()
  const hapticFiredRef = useRef<Set<number>>(new Set());

  // [DA-FIX-6] Resource refs for cleanup on unmount
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  // Context
  const { registerOverlayTrigger } = useThemeTransition();

  // Defined INSIDE the component function so it closes over
  // setVisible, setOverlayColor, progressAnim, setProgress, hapticFiredRef,
  // CIRCLE_RADIUS (from useMemo), screenWidth, screenHeight
  const trigger = useCallback(
    async (fromBgColor: string, onCommit: () => void, onDone: () => void) => {
      // [DA-FIX-3] Check reduced motion BEFORE showing overlay.
      // In v1, setVisible(true) was called first, then the async check resolved —
      // causing reduced-motion users to see a flash of the old background color.
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reducedMotion) {
        // No overlay shown — instant commit and done
        onCommit();
        onDone();
        return;
      }

      // 1. Show overlay with old theme color (only reached if motion is allowed)
      setOverlayColor(fromBgColor);
      setProgress(0);
      setVisible(true);

      // 2. Commit the theme after COMMIT_DELAY so new theme renders underneath
      // [DA-FIX-6] Store timer ID for cleanup
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;

        // Wrap in try/finally to guarantee onDone() always fires even if onCommit throws
        let animationStarted = false;
        try {
          onCommit();

          // 3. Reset animation value and haptic tracker
          progressAnim.setValue(0);
          hapticFiredRef.current.clear();

          // 4. Attach listener to drive SVG re-renders
          // [DA-FIX-6] Store listener ID for cleanup
          const listenerId = progressAnim.addListener(({ value }) => {
            setProgress(value);

            // Fire haptics at row thresholds (each threshold fires at most once)
            for (const threshold of HAPTIC_ROWS) {
              if (value >= threshold && !hapticFiredRef.current.has(threshold)) {
                hapticFiredRef.current.add(threshold);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          });
          listenerIdRef.current = listenerId;

          // 5. Start the cascade animation
          // [DA-FIX-7] Animate to ROWS + 0.01 to guarantee the last row reaches
          // full radius despite floating-point imprecision at the final frame.
          animationStarted = true;
          Animated.timing(progressAnim, {
            toValue: ROWS + 0.01,
            duration: ANIMATION_DURATION,
            useNativeDriver: false, // SVG props cannot use native driver
          }).start(() => {
            // 6. Animation complete — remove listener, hide overlay, signal done
            progressAnim.removeListener(listenerId);
            listenerIdRef.current = null;
            setVisible(false);
            onDone();
          });
        } finally {
          // If animation never started (onCommit threw), clean up immediately
          if (!animationStarted) {
            setVisible(false);
            onDone();
          }
        }
      }, COMMIT_DELAY);
    },
    // [DA-FIX-4] CIRCLE_RADIUS is now from useMemo inside the component,
    // so it is in scope here and does not need to be a dep (it's in the closure).
    // progressAnim is stable (useRef(...).current); setters are stable.
    // The async nature of trigger means useCallback is effectively [].
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // [DA-FIX-1] Ref that always points to the latest trigger function
  const triggerRef = useRef(trigger);
  // Update on every render — no deps, runs after every render
  useEffect(() => {
    triggerRef.current = trigger;
  });

  // [DA-FIX-1] Register a STABLE WRAPPER once on mount — this wrapper never goes stale
  // because it always routes through triggerRef.current
  useEffect(() => {
    registerOverlayTrigger((...args: Parameters<typeof trigger>) => {
      triggerRef.current(...args);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Safe: the registered function is a stable wrapper that reads the ref at call time.
  // Even if trigger is recreated (new useCallback deps), the wrapper still calls the latest version.

  // [DA-FIX-6] Clean up timer and listener on component unmount
  // Currently ChompOverlay lives for app lifetime (returns null, not unmounted).
  // This cleanup prevents resource leaks if that invariant ever changes.
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
      style={[
        StyleSheet.absoluteFillObject,
        { zIndex: 9999 },
      ]}
      pointerEvents="none"
    >
      {/* [DA-FIX-4] screenWidth/screenHeight from useWindowDimensions() */}
      <Svg width={screenWidth} height={screenHeight}>
        <Defs>
          {/*
            Mask ID "chompMask_overlay" — deliberately namespaced to reduce
            collision risk if another SVG in the tree ever uses a Mask.
            CONSTRAINT: Only one ChompOverlay instance must exist in the tree
            at any time (enforced by placement in _layout.tsx root).
          */}
          <Mask id="chompMask_overlay">
            {/*
              SVG mask convention: white = opaque (overlay shows), black = transparent (overlay hidden).
              White rect makes the entire overlay Rect visible initially.
              Growing black Circles punch holes, revealing the new theme beneath.
            */}
            <Rect
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
              fill="white"
            />
            {circlesSpec.map((spec, i) => (
              <Circle
                key={i}
                cx={spec.cx}
                cy={spec.cy}
                r={getCircleRadius(progress, spec.row, CIRCLE_RADIUS)}
                fill="black"
              />
            ))}
          </Mask>
        </Defs>
        {/* The overlay rect — masked by chompMask_overlay, filled with old theme color */}
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
