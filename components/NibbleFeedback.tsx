import React, { useRef, useCallback, useState } from 'react';
import {
  Animated,
  Pressable,
  View,
  StyleSheet,
  GestureResponderEvent,
  AccessibilityInfo,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../context/ThemeContext';
import { seededRandom } from '../lib/scallopUtils';

interface NibbleFeedbackProps {
  onPress: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

const NIBBLE_SIZE = 24;
const NIBBLE_DURATION = 200;

/**
 * A Pressable wrapper that shows a small bite-mark SVG at the press location.
 * Use on primary CTA buttons for food-themed press feedback.
 */
export default function NibbleFeedback({
  onPress,
  disabled,
  style,
  children,
  testID,
  accessibilityLabel,
}: NibbleFeedbackProps) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [nibblePos, setNibblePos] = useState<{ x: number; y: number } | null>(null);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      // Extract coords synchronously before React recycles the synthetic event
      const locationX = e.nativeEvent?.locationX ?? 0;
      const locationY = e.nativeEvent?.locationY ?? 0;

      // Fire onPress immediately (before any async work)
      onPress(e);

      // Animate nibble (skip if reduced motion)
      AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
        if (reduced) return;

        setNibblePos({ x: locationX - NIBBLE_SIZE / 2, y: locationY - NIBBLE_SIZE / 2 });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        scaleAnim.setValue(0);
        opacityAnim.setValue(0.3);

        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 300,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(100),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setNibblePos(null);
        });
      });
    },
    [onPress, scaleAnim, opacityAnim],
  );

  // Generate small bite-mark circles using seeded random for consistency
  const biteCircles = useRef(
    Array.from({ length: 5 }, (_, i) => ({
      cx: NIBBLE_SIZE / 2 + (seededRandom(i * 7) - 0.5) * NIBBLE_SIZE * 0.6,
      cy: NIBBLE_SIZE / 2 + (seededRandom(i * 7 + 1) - 0.5) * NIBBLE_SIZE * 0.6,
      r: 2 + seededRandom(i * 7 + 2) * 3,
    })),
  ).current;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
      {nibblePos && (
        <Animated.View
          style={[
            styles.nibble,
            {
              left: nibblePos.x,
              top: nibblePos.y,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={NIBBLE_SIZE} height={NIBBLE_SIZE}>
            {biteCircles.map((c, i) => (
              <Circle
                key={i}
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill={Colors.primary}
              />
            ))}
          </Svg>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nibble: {
    position: 'absolute',
    width: NIBBLE_SIZE,
    height: NIBBLE_SIZE,
  },
});
