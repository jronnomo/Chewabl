import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Circle, Mask, G } from 'react-native-svg';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

interface ScallopDividerProps {
  color?: string; // defaults to Colors.border — for dark mode flexibility
}

const SVG_HEIGHT = 16;
const CIRCLE_RADIUS = 8;
const SCALLOP_SPACING = 24; // diameter ~16 + gap ~8

export default function ScallopDivider({ color }: ScallopDividerProps) {
  const Colors = useColors();
  const [width, setWidth] = useState(0);

  const fillColor = color ?? Colors.border;

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const scallopCount = width > 0 ? Math.floor(width / SCALLOP_SPACING) : 0;

  // Calculate even spacing so scallops are centered across the width
  const totalScallopWidth = scallopCount * SCALLOP_SPACING;
  const offsetX = (width - totalScallopWidth) / 2 + SCALLOP_SPACING / 2;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 && scallopCount > 0 && (
        <Svg width={width} height={SVG_HEIGHT}>
          <Mask id="scallopMask">
            {/* White rect = visible area */}
            <Rect x="0" y="0" width={width} height={SVG_HEIGHT} fill="white" />
            {/* Black circles = cutouts along the top edge */}
            {Array.from({ length: scallopCount }).map((_, i) => (
              <Circle
                key={i}
                cx={offsetX + i * SCALLOP_SPACING}
                cy={0}
                r={CIRCLE_RADIUS}
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
    height: SVG_HEIGHT,
  },
});
