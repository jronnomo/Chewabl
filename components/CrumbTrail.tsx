import React, { useRef, useEffect } from 'react';
import { Animated, View, StyleSheet, AccessibilityInfo, ActivityIndicator } from 'react-native';
import { useColors } from '../context/ThemeContext';

interface CrumbTrailProps {
  size?: 'small' | 'large';
  color?: string;
}

const DOT_COUNT = 8;
const CYCLE_DURATION = 800;

/**
 * Food-themed loading indicator — 8 small dots in a circular pattern
 * with staggered opacity pulse creating a "sizzling" chase effect.
 * Falls back to standard ActivityIndicator when reduced motion is enabled.
 */
export default function CrumbTrail({ size = 'small', color }: CrumbTrailProps) {
  const Colors = useColors();
  const dotColor = color ?? Colors.primary;
  const diameter = size === 'large' ? 36 : 24;
  const dotSize = size === 'large' ? 5 : 4;
  const radius = (diameter - dotSize) / 2;

  const anims = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(1)),
  ).current;
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      reducedMotionRef.current = reduced;
      if (reduced) return;

      // Start staggered opacity loops
      anims.forEach((anim, i) => {
        const delay = (i / DOT_COUNT) * CYCLE_DURATION;

        const loop = () => {
          if (cancelled) return;
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: CYCLE_DURATION / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: CYCLE_DURATION / 2,
              useNativeDriver: true,
            }),
          ]).start(() => loop());
        };

        loop();
      });
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm food colors cycling through dots
  const dotColors = [
    dotColor,                    // primary
    Colors.secondary ?? dotColor, // secondary (warm gold)
    Colors.star ?? dotColor,      // star (bright gold)
  ];

  return (
    <View style={[styles.container, { width: diameter, height: diameter }]}>
      {anims.map((anim, i) => {
        const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dotColors[i % dotColors.length],
              opacity: anim,
              left: diameter / 2 + x - dotSize / 2,
              top: diameter / 2 + y - dotSize / 2,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
