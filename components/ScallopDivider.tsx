import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Circle, Mask, G } from 'react-native-svg';
import { seededRange } from '../lib/scallopUtils';
import { useColors } from '../context/ThemeContext';

interface ScallopDividerProps {
  color?: string;
}

const SVG_HEIGHT = 22;
const BASE_RADIUS = 12;
const SCALLOP_SPACING = 38;

interface FlatScallop {
  cx: number;
  cy: number;
  r: number;
}

function generateFlatScallops(width: number): FlatScallop[] {
  const count = Math.max(1, Math.round(width / SCALLOP_SPACING));
  const actualSpacing = width / (count + 1);
  const scallops: FlatScallop[] = [];

  // Main scallops
  for (let i = 0; i < count; i++) {
    const seed = i * 7 + 42;
    const radiusMult = seededRange(seed, 0.82, 1.20);
    const jitter = seededRange(seed + 1, -0.04, 0.04) * SCALLOP_SPACING;
    scallops.push({
      cx: actualSpacing * (i + 1) + jitter,
      cy: 0,
      r: BASE_RADIUS * radiusMult,
    });
  }

  // Micro-bites between every 3rd pair
  const mainCount = scallops.length;
  for (let i = 0; i < mainCount - 1; i += 3) {
    const seed = i * 13 + 200;
    const midCx = (scallops[i].cx + scallops[i + 1].cx) / 2;
    const microJitter = seededRange(seed + 2, -0.02, 0.02) * SCALLOP_SPACING;
    scallops.push({
      cx: midCx + microJitter,
      cy: 0,
      r: BASE_RADIUS * seededRange(seed, 0.35, 0.55),
    });
  }

  return scallops;
}

export default function ScallopDivider({ color }: ScallopDividerProps) {
  const Colors = useColors();
  const [width, setWidth] = useState(0);

  const fillColor = color ?? Colors.border;

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const scallops = width > 0 ? generateFlatScallops(width) : [];

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 && scallops.length > 0 && (
        <Svg width={width} height={SVG_HEIGHT}>
          <Mask id="scallopMask">
            <Rect x="0" y="0" width={width} height={SVG_HEIGHT} fill="white" />
            {scallops.map((s, i) => (
              <Circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill="black"
              />
            ))}
          </Mask>
          <G mask="url(#scallopMask)">
            <Rect x="0" y="0" width={width} height={SVG_HEIGHT} fill={fillColor} />
          </G>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
});
