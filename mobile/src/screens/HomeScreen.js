import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  SafeAreaView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, radius, shadow } from '../theme';

const OCT_DISEASES = [
  { code: 'ARMD', label: 'Age-Related Macular Degeneration', color: '#f43f5e' },
  { code: 'CNV',  label: 'Choroidal Neovascularization',     color: '#e11d48' },
  { code: 'CSR',  label: 'Central Serous Retinopathy',       color: '#0ea5e9' },
  { code: 'DME',  label: 'Diabetic Macular Edema',           color: '#3b82f6' },
  { code: 'DR',   label: 'Diabetic Retinopathy',             color: '#f97316' },
  { code: 'MH',   label: 'Macular Hole',                     color: '#a78bfa' },
];

const FUNDUS_DISEASES = [
  { code: 'ARMD', label: 'Age-Related Macular Degeneration', color: '#f43f5e' },
  { code: 'Cat',  label: 'Cataract',                         color: '#94a3b8' },
  { code: 'DR',   label: 'Diabetic Retinopathy',             color: '#f97316' },
  { code: 'Glc',  label: 'Glaucoma',                         color: '#22c55e' },
  { code: 'HT',   label: 'Hypertensive Retinopathy',         color: '#ec4899' },
];

function DiseaseCard({ icon, title, subtitle, diseases }) {
  return (
    <View style={st.diseaseCard}>
      <View style={st.diseaseCardHeader}>
        <View style={st.diseaseCardIconWrap}>
          <Text style={st.diseaseCardIcon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.diseaseCardTitle}>{title}</Text>
          <Text style={st.diseaseCardSub}>{subtitle}</Text>
        </View>
      </View>
      {diseases.map(({ code, label, color }) => (
        <View key={code} style={st.diseaseRow}>
          <View style={[st.dot, { backgroundColor: color }]} />
          <Text style={st.diseaseLabel}>{label}</Text>
          <Text style={[st.diseaseCode, { color }]}>{code}</Text>
        </View>
      ))}
      <View style={st.normalNote}>
        <Text style={st.normalNoteText}>✓  Normal retina also identified</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  return (
    <LinearGradient colors={['#030712', '#0f172a', '#030712']} style={st.bg}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge */}
          <View style={st.badge}>
            <Text style={st.badgeText}>AI RETINAL DIAGNOSTICS</Text>
          </View>

          {/* Logo mark */}
          <View style={st.logoRing}>
            <View style={st.logoInner}>
              <Text style={st.logoIcon}>👁</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={st.title}>
            RetinaX <Text style={st.titleAccent}>Pro</Text>
          </Text>
          <Text style={st.subtitle}>
            Precision-engineered hybrid neural networks{'\n'}for dual-modality OCT & Fundus detection
          </Text>

          {/* ── Detectable Conditions ── */}
          <View style={st.sectionHeader}>
            <View style={st.sectionBadge}>
              <Text style={st.sectionBadgeText}>DETECTABLE CONDITIONS</Text>
            </View>
            <Text style={st.sectionTitle}>
              What RetinaX <Text style={{ color: colors.sky }}>Identifies</Text>
            </Text>
            <Text style={st.sectionSub}>
              The system classifies findings across two clinical imaging modalities.
            </Text>
          </View>

          <DiseaseCard
            icon="〰"
            title="OCT Analysis"
            subtitle="Optical Coherence Tomography — Macula B-Scan"
            diseases={OCT_DISEASES}
          />

          <DiseaseCard
            icon="👁"
            title="Fundus Analysis"
            subtitle="Colour Fundus Photography — Posterior Pole"
            diseases={FUNDUS_DISEASES}
          />

          <Text style={st.sharedNote}>
            ARMD and CNV share OCT features due to their angiogenic relationship — a dedicated pairwise discriminator resolves classification between them.
          </Text>

          {/* Feature pills */}
          <View style={st.pills}>
            {['OCT Analysis', 'Fundus Analysis', 'Severity Grading', 'Clinical Reports'].map(f => (
              <View key={f} style={st.pill}>
                <Text style={st.pillText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={st.cta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Diagnostics')}
          >
            <LinearGradient
              colors={['#0ea5e9', '#0284c7']}
              style={st.ctaGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={st.ctaText}>Begin Diagnostic Assessment  →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={st.footer}>
            © 2026 RetinaX Pro AI Systems{'\n'}ACOMS v5.0 · Validated Logic
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  bg:     { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 40 },

  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 32 },
  badgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1.2 },

  logoRing:  { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'rgba(14,165,233,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, ...shadow },
  logoInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center' },
  logoIcon:  { fontSize: 32 },

  title:       { color: colors.white, fontSize: typography.xxl, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  titleAccent: { color: colors.sky },
  subtitle:    { color: colors.dim, fontSize: typography.sm, textAlign: 'center', marginTop: 10, marginBottom: 28, lineHeight: 20 },

  pills:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 32 },
  pill:     { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  pillText: { color: colors.dim, fontSize: typography.xs, fontWeight: '600' },

  cta:     { width: '100%', borderRadius: radius.xl, overflow: 'hidden', marginBottom: 48, ...shadow },
  ctaGrad: { paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: typography.md, fontWeight: '800', letterSpacing: 0.3 },

  sectionHeader: { alignItems: 'center', marginBottom: 20, width: '100%' },
  sectionBadge:  { backgroundColor: 'rgba(14,165,233,0.10)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 10 },
  sectionBadgeText: { color: colors.sky, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  sectionTitle:  { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  sectionSub:    { color: colors.dim, fontSize: typography.xs, textAlign: 'center', lineHeight: 18, opacity: 0.8 },

  diseaseCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.2)',
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
  },
  diseaseCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  diseaseCardIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', alignItems: 'center', justifyContent: 'center' },
  diseaseCardIcon:  { fontSize: 18 },
  diseaseCardTitle: { color: colors.white, fontSize: typography.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  diseaseCardSub:   { color: colors.dim, fontSize: 9, lineHeight: 13, opacity: 0.75 },

  diseaseRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dot:         { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  diseaseLabel:{ flex: 1, color: colors.white, fontSize: 11, fontWeight: '500' },
  diseaseCode: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  normalNote:     { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  normalNoteText: { color: '#22c55e', fontSize: 9, fontWeight: '600', opacity: 0.8 },

  sharedNote: { color: colors.dim, fontSize: 9.5, textAlign: 'center', lineHeight: 15, opacity: 0.6, marginTop: 4, marginBottom: 28, paddingHorizontal: 8 },

  footer: { color: colors.dim, fontSize: typography.xs, textAlign: 'center', opacity: 0.5, lineHeight: 18 },
});
