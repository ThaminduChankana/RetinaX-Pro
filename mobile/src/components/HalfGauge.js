import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '../theme';

function polarToXY(cx, cy, r, angle) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToXY(cx, cy, r, startAngle);
  const e = polarToXY(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function HalfGauge({ value = 0, size = 160 }) {
  const cx     = size / 2;
  const cy     = size / 2 + 10;
  const r      = size / 2 - 14;
  const stroke = 12;
  const start  = 180;
  const end    = 180 + (value / 100) * 180;
  const valColor = value > 50 ? colors.danger : value > 20 ? colors.warning : colors.success;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size / 2 + 20}>
        <Path d={describeArc(cx, cy, r, 180, 360)} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {value > 0 && (
          <Path d={describeArc(cx, cy, r, start, Math.min(end, 359.9))} stroke={valColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <Text style={[styles.val, { color: valColor }]}>{value.toFixed(1)}%</Text>
      <Text style={styles.lbl}>Retinal Burden</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  val:     { fontSize: typography.xl, fontWeight: '800', marginTop: -8 },
  lbl:     { fontSize: typography.xs, color: colors.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
});
