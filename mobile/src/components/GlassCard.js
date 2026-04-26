import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../theme';

export default function GlassCard({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow,
  },
});
