import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../theme';

export default function CircularProgress({ value = 0, size = 120, color = colors.sky, label }) {
  const stroke    = 10;
  const r         = (size - stroke) / 2;
  const cx        = size / 2;
  const cy        = size / 2;
  const circ      = 2 * Math.PI * r;
  const filled    = (value / 100) * circ;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.val, { color }]}>{value.toFixed(1)}%</Text>
        {label ? <Text style={styles.lbl}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  center:  { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  val:     { fontSize: typography.lg, fontWeight: '800' },
  lbl:     { fontSize: typography.xs, color: colors.dim, marginTop: 2 },
});
