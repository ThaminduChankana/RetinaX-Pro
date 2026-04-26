import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

const ABBREV = {
  'Age-Related Macular Degeneration': 'ARMD',
  'Choroidal Neovascularization':     'CNV',
  'Central Serous Retinopathy':       'CSR',
  'Diabetic Macular Edema':           'DME',
  'Diabetic Retinopathy':             'DR',
  'Macular Hole':                     'MH',
  'Hypertensive Retinopathy':         'HTN-R',
  'Normal':                           'Normal',
  'Cataract':                         'Cat.',
  'Glaucoma':                         'Glau.',
};

export default function ProbabilityBars({ scores = {}, primaryDisease }) {
  const sorted = Object.entries(scores)
    .map(([k, v]) => [k, typeof v === 'number' ? v : v * 100])
    .sort((a, b) => b[1] - a[1]);

  return (
    <View>
      {sorted.map(([disease, pct]) => {
        const isPrimary = disease === primaryDisease;
        const barColor  = isPrimary ? colors.danger : colors.sky;
        return (
          <View key={disease} style={styles.row}>
            <Text style={styles.label}>{ABBREV[disease] || disease}</Text>
            <View style={styles.trackWrap}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
              </View>
            </View>
            <Text style={[styles.pct, { color: barColor }]}>{pct.toFixed(1)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: colors.dim,
    fontSize: typography.xs,
    fontWeight: '700',
    width: 52,
  },
  trackWrap: { flex: 1, marginHorizontal: 8 },
  track: {
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  pct: {
    fontSize: typography.xs,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
});
