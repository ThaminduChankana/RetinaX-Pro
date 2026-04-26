import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius } from '../theme';

export default function MetricTile({ label, value, valueColor, sub }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor && { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginHorizontal: 4,
  },
  label: {
    color: colors.dim,
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    textAlign: 'center',
  },
  value: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: colors.sky,
    fontSize: typography.xs,
    fontWeight: '600',
    marginTop: 3,
  },
});
