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
import { useThemeTransition, ChompConfig } from '../context/ThemeTransitionContext';
import { ScallopCircle, generateScallops } from '../lib/scallopUtils';

interface BiteSpec {
  cx: number;
  cy: number;
  targetRadius: number;
  scallops: ScallopCircle[];
}

const HAPTIC_STYLE_MAP: Record<string, Haptics.ImpactFeedbackStyle> = {
  Light: Haptics.ImpactFeedbackStyle.Light,
  Medium: Haptics.ImpactFeedbackStyle.Medium,
  Heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export default function ChompOverlay() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // All 5 bite specs — we slice based on activeConfig.biteCount at render time
  const biteSpecs = useMemo((): BiteSpec[] => {
    const scallopBaseR = screenWidth * 0.1;

    return [
      // 1. Top-left bite (small — first tentative nibble)
      {
        cx: -screenWidth * 0.15,
        cy: screenHeight * 0.18,
        targetRadius: screenHeight * 0.30,
        scallops: generateScallops(0, screenHeight * 0.30, -1.0, 2.0, scallopBaseR),
      },
      // 2. Right bite (small-medium)
      {
        cx: screenWidth * 1.15,
        cy: screenHeight * 0.38,
        targetRadius: screenHeight * 0.34,
        scallops: generateScallops(1, screenHeight * 0.34, 1.5, 4.7, scallopBaseR),
      },
      // 3. Left bite (medium)
      {
        cx: -screenWidth * 0.1,
        cy: screenHeight * 0.65,
        targetRadius: screenHeight * 0.38,
        scallops: generateScallops(2, screenHeight * 0.38, -1.2, 1.8, scallopBaseR),
      },
      // 4. Bottom-right bite (clears the corner)
      {
        cx: screenWidth * 1.1,
        cy: screenHeight * 0.88,
        targetRadius: screenHeight * 0.45,
        scallops: generateScallops(3, screenHeight * 0.45, 1.5, 4.5, scallopBaseR),
      },
      // 5. Center bite (MASSIVE — grand finale, devours all remaining content)
      {
        cx: screenWidth * 0.45,
        cy: screenHeight * 0.45,
        targetRadius: screenHeight * 0.85,
        scallops: generateScallops(4, screenHeight * 0.85, -0.5, 6.8, scallopBaseR),
      },
    ];
  }, [screenWidth, screenHeight]);

  // ── Component state ────────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  const [overlayColor, setOverlayColor] = useState('#F2F0ED');
  const activeConfigRef = useRef<ChompConfig | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  const hapticFiredRef = useRef<Set<number>>(new Set());
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  const { registerOverlayTrigger } = useThemeTransition();

  const trigger = useCallback(
    async (config: ChompConfig, onCommit: () => void, onDone: () => void) => {
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reducedMotion) {
        onCommit();
        onDone();
        return;
      }

      // Store config for this animation run
      activeConfigRef.current = config;

      // 1. Show overlay with config color
      setOverlayColor(config.overlayColor);
      setProgress(0);
      setVisible(true);

      // 2. Commit after commitDelay so new content renders underneath
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;

        let animationStarted = false;
        try {
          onCommit();

          // 3. Reset animation value and haptic tracker
          progressAnim.setValue(0);
          hapticFiredRef.current.clear();

          // 4. Build haptic thresholds from config
          const thresholds = Array.from(
            { length: config.biteCount },
            (_, i) => i + 0.01,
          );

          // 5. Attach listener to drive SVG re-renders + haptics
          const listenerId = progressAnim.addListener(({ value }) => {
            setProgress(value);
            for (let i = 0; i < thresholds.length; i++) {
              const t = thresholds[i];
              if (value >= t && !hapticFiredRef.current.has(t)) {
                hapticFiredRef.current.add(t);
                const seq = config.hapticSequence[i];
                if (seq) {
                  Haptics.impactAsync(HAPTIC_STYLE_MAP[seq.style]);
                  if (seq.withSuccessNotification) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }
              }
            }
          });
          listenerIdRef.current = listenerId;

          // 6. Build stepped animation: *chomp* pause x biteCount
          const steps: Animated.CompositeAnimation[] = [];
          for (let i = 0; i < config.biteCount; i++) {
            steps.push(
              Animated.timing(progressAnim, {
                toValue: i + 1 + (i === config.biteCount - 1 ? 0.01 : 0),
                duration: config.biteDuration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
              })
            );
            if (i < config.biteCount - 1) {
              steps.push(Animated.delay(config.bitePause));
            }
          }

          animationStarted = true;
          Animated.sequence(steps).start(() => {
            progressAnim.removeListener(listenerId);
            listenerIdRef.current = null;
            setVisible(false);
            activeConfigRef.current = null;
            onDone();
          });
        } finally {
          if (!animationStarted) {
            setVisible(false);
            activeConfigRef.current = null;
            onDone();
          }
        }
      }, config.commitDelay);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Ref that always points to the latest trigger function
  const triggerRef = useRef(trigger);
  useEffect(() => {
    triggerRef.current = trigger;
  });

  // Register a STABLE WRAPPER once on mount
  useEffect(() => {
    registerOverlayTrigger((...args: Parameters<typeof trigger>) => {
      triggerRef.current(...args);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up timer and listener on component unmount
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

  if (!visible) return null;

  // Slice biteSpecs based on active config's biteCount
  const activeBiteCount = activeConfigRef.current?.biteCount ?? 5;
  const activeBites = biteSpecs.slice(0, activeBiteCount);

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
            {activeBites.map((spec, i) => {
              const t = Math.max(0, Math.min(1, progress - i));
              if (t <= 0) return null;

              const mainR = t * spec.targetRadius;
              const fillR = mainR * 0.95;

              return [
                <Circle
                  key={`fill-${i}`}
                  cx={spec.cx}
                  cy={spec.cy}
                  r={fillR}
                  fill="black"
                />,
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
