import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, StyleSheet, AccessibilityInfo, LayoutChangeEvent } from 'react-native';
import { useColors } from '../context/ThemeContext';

interface SizzleShimmerProps {
  children: React.ReactNode;
}

/**
 * Wraps a card component with a single warm gradient sweep on mount.
 * The shimmer plays once (1200ms) and disappears — not a loading skeleton.
 * Respects reduced motion. Works in both light and dark mode.
 */
export default function SizzleShimmer({ children }: SizzleShimmerProps) {
  const Colors = useColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const [cardWidth, setCardWidth] = useState(0);
  const hasAnimated = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && !hasAnimated.current) {
      setCardWidth(w);
    }
  };

  useEffect(() => {
    if (cardWidth === 0 || hasAnimated.current) return;
    hasAnimated.current = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;

      translateX.setValue(-cardWidth);
      Animated.timing(translateX, {
        toValue: cardWidth,
        duration: 1200,
        useNativeDriver: true,
      }).start();
    });
  }, [cardWidth, translateX]);

  // Shimmer color: warm primary at low opacity
  // Light mode: rgba(232,93,58,0.06) / Dark mode: rgba(255,122,92,0.08)
  const shimmerColor = Colors.background === '#1C1917'
    ? 'rgba(255,122,92,0.08)'
    : 'rgba(232,93,58,0.06)';

  return (
    <View onLayout={onLayout} style={styles.wrapper}>
      {children}
      {cardWidth > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.shimmerLayer,
            { transform: [{ translateX }] },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.shimmerGradient, { backgroundColor: shimmerColor }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  shimmerLayer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  shimmerGradient: {
    width: '60%',
    height: '100%',
    borderRadius: 16,
  },
});
