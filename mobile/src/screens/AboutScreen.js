import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import Background from '../components/Background';
import GlassCard from '../components/GlassCard';
import { colors, typography, radius } from '../theme';

const STATS = [
  { value: '10+', label: 'Retinal Diseases' },
  { value: '95%', label: 'Detection Accuracy' },
  { value: '2', label: 'Imaging Modalities' },
  { value: 'v5.0', label: 'ACOMS Engine' },
];

export default function AboutScreen() {
  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          <View style={st.header}>
            <View style={st.badge}><Text style={st.badgeText}>SCIENTIFIC METHODOLOGY</Text></View>
            <Text style={st.title}>Our <Text style={{ color: colors.sky }}>Clinical</Text> Mission</Text>
            <Text style={st.subtitle}>
              Harnessing the power of hybrid neural networks to democratize advanced retinal diagnostics globally.
            </Text>
          </View>

          {/* Stats row */}
          <View style={st.statsRow}>
            {STATS.map(({ value, label }) => (
              <GlassCard key={label} style={st.statCard}>
                <Text style={st.statValue}>{value}</Text>
                <Text style={st.statLabel}>{label}</Text>
              </GlassCard>
            ))}
          </View>

          {/* Genesis */}
          <GlassCard style={st.card}>
            <Text style={st.sectionTitle}>💡 The Genesis</Text>
            <Text style={st.body}>
              Visionary Health is at the forefront of a technological revolution in eye care, harnessing the power of machine learning to detect and manage eye diseases with unprecedented accuracy and efficiency. Our mission is to democratize eye health, making advanced identification tools accessible to everyone, everywhere.
            </Text>
            <Text style={st.body}>
              The genesis of RetinaX was driven by a simple yet profound realization: early detection of eye diseases can dramatically alter the course of treatment, potentially saving millions from vision impairment.
            </Text>
          </GlassCard>

          {/* Team */}
          <GlassCard style={st.card}>
            <Text style={st.sectionTitle}>👥 Our Team</Text>
            <Text style={st.body}>
              At the heart of RetinaX is a diverse team comprising leading ophthalmologists, AI experts, and software developers. United by a shared vision, we bring together deep clinical knowledge and cutting-edge machine learning expertise.
            </Text>
            <Text style={st.body}>
              We believe that the intersection of healthcare and technology holds the key to transformative advances in eye care, and our team is committed to exploring the full potential of this exciting field.
            </Text>
          </GlassCard>

          {/* Pipeline overview */}
          <GlassCard style={st.card}>
            <Text style={st.sectionTitle}>⚙️ Diagnostic Pipeline</Text>
            {[
              { step: '1', label: 'Modality Detection', desc: 'OCT B-scan vs Fundus colour photo classification.' },
              { step: '2', label: 'Fusion Consensus', desc: 'Consensus classifier (CoAtNet + DINOv2 + ResNeSt) followed by pairwise discriminators (ConvNeXt-L + EfficientNetV2-L + Swin V2).' },
              { step: '3', label: 'Pairwise Discrimination', desc: '5 dedicated discriminator models resolve class confusion.' },
              { step: '4', label: 'Severity Grading', desc: 'Per-disease severity models with confidence scoring.' },
              { step: '5', label: 'Saliency Extraction', desc: 'SmoothGrad pixel-level heatmap generation.' },
              { step: '6', label: 'Clinical Report Generation', desc: 'Proprietary Neural Language Engine generated professional summary.' },
            ].map(({ step, label, desc }) => (
              <View key={step} style={st.stepRow}>
                <View style={st.stepBadge}><Text style={st.stepNum}>{step}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.stepLabel}>{label}</Text>
                  <Text style={st.stepDesc}>{desc}</Text>
                </View>
              </View>
            ))}
          </GlassCard>

        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },

  header:    { alignItems: 'center', marginBottom: 20 },
  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 },
  badgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1 },
  title:     { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle:  { color: colors.dim, fontSize: typography.sm, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 14 },
  statValue:{ color: colors.sky, fontSize: typography.xl, fontWeight: '800' },
  statLabel:{ color: colors.dim, fontSize: typography.xs, marginTop: 2, textAlign: 'center' },

  card:        { marginBottom: 12 },
  sectionTitle:{ color: colors.white, fontSize: typography.base, fontWeight: '700', marginBottom: 12 },
  body:        { color: colors.dim, fontSize: typography.sm, lineHeight: 22, marginBottom: 10, opacity: 0.9 },

  stepRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(14,165,233,0.18)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  stepNum:   { color: colors.sky, fontSize: typography.xs, fontWeight: '800' },
  stepLabel: { color: colors.white, fontSize: typography.sm, fontWeight: '700', marginBottom: 2 },
  stepDesc:  { color: colors.dim, fontSize: typography.xs, lineHeight: 18, opacity: 0.85 },
});
