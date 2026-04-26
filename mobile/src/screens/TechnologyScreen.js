import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import Background from '../components/Background';
import GlassCard from '../components/GlassCard';
import { colors, typography, radius } from '../theme';

const FEATURES = [
  { icon: '🧬', title: 'Biomarker Identification', desc: 'SOTA detection using ConvNeXt-L + EfficientNetV2-L + Swin V2 pairwise discriminators for pixel-level pathology mapping.' },
  { icon: '⚡', title: 'Real-time Processing', desc: 'Cascaded hybrid architecture — CoAtNet/DINOv2/ResNeSt consensus followed by ConvNeXt-L/EfficientNetV2-L/Swin V2 expert models.' },
  { icon: '🎯', title: 'Confidence Calibration', desc: 'Dual-threshold cross-validation ensures the consensus and pairwise discriminators remain within high-fidelity clinical intervals.' },
  { icon: '🔗', title: 'Fusion Consensus', desc: 'Primary consensus built from CoAtNet, DINOv2, and ResNeSt backbones; pairwise disambiguation via ConvNeXt-L + EfficientNetV2-L + Swin V2.' },
  { icon: '🧠', title: 'LLM Clinical Report', desc: 'Proprietary Neural Language Engine synthesises a professional clinical assessment from structured hybrid model output.' },
  { icon: '📊', title: 'Fused Grading', desc: 'High-granularity severity grading powered by ConvNeXt-L + EfficientNetV2-L + Swin V2 hybrid models, surfacing per-disease confidence intervals.' },
];

const PIPELINE = [
  { step: 'Input',      desc: 'Retinal image (OCT B-scan or Fundus photograph)' },
  { step: 'Modality',   desc: 'OCT / Fundus / Invalid classifier routes the image' },
  { step: 'Consensus',  desc: 'Dual-model ensemble → averaged class probabilities' },
  { step: 'Discriminate', desc: '5 pairwise Edge models resolve class confusion pairs' },
  { step: 'Severity',   desc: 'Per-disease severity model with confidence gating' },
  { step: 'Saliency',   desc: 'SmoothGrad (30 samples, σ=0.15) → heatmap + impact %' },
  { step: 'Report',     desc: 'LLM generates professional clinical assessment text' },
];

export default function TechnologyScreen() {
  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          <View style={st.header}>
            <View style={st.badge}><Text style={st.badgeText}>HYBRID SALIENCY EXTRACTION TECHNOLOGY</Text></View>
            <Text style={st.title}>AI Deep <Text style={{ color: colors.sky }}>Science</Text></Text>
            <Text style={st.subtitle}>
              Explore the pixel-level neural architecture powering automated clinical justifications and professional-grade saliency mapping.
            </Text>
          </View>

          {/* Architecture summary */}
          <GlassCard style={[st.card, { borderColor: 'rgba(14,165,233,0.25)' }]}>
            <Text style={st.sectionTitle}>Neural Architecture Context</Text>
            <Text style={st.body}>
              RetinaX Pro utilises a customised version of SmoothGrad saliency extraction, significantly enhanced with proprietary pixel-level logic. This hybrid approach ensures that every diagnostic probability is justified by anatomical evidence visible in the retinal image.
            </Text>
            <View style={st.progressWrap}>
              <View style={st.progressRow}>
                <Text style={st.progressLabel}>DETECTION ACCURACY</Text>
                <Text style={st.progressVal}>95%</Text>
              </View>
              <View style={st.track}><View style={[st.fill, { width: '95%' }]} /></View>
              <View style={st.progressRow}>
                <Text style={st.progressLabel}>SALIENCY COVERAGE</Text>
                <Text style={st.progressVal}>92%</Text>
              </View>
              <View style={st.track}><View style={[st.fill, { width: '92%' }]} /></View>
            </View>
          </GlassCard>

          {/* Pipeline flow */}
          <GlassCard style={st.card}>
            <Text style={st.sectionTitle}>⚡ Extraction Pipeline</Text>
            {PIPELINE.map(({ step, desc }, i) => (
              <View key={step} style={st.pipelineRow}>
                <View style={st.pipelineLine}>
                  <View style={st.pipelineDot} />
                  {i < PIPELINE.length - 1 && <View style={st.pipelineConnector} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.pipelineStep}>{step}</Text>
                  <Text style={st.pipelineDesc}>{desc}</Text>
                </View>
              </View>
            ))}
          </GlassCard>

          {/* Feature grid */}
          <Text style={st.gridLabel}>CORE CAPABILITIES</Text>
          <View style={st.grid}>
            {FEATURES.map(({ icon, title, desc }) => (
              <GlassCard key={title} style={st.featureCard}>
                <Text style={st.featureIcon}>{icon}</Text>
                <Text style={st.featureTitle}>{title}</Text>
                <Text style={st.featureDesc}>{desc}</Text>
              </GlassCard>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },

  header:    { alignItems: 'center', marginBottom: 20 },
  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 },
  badgeText: { color: colors.sky, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },
  title:     { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle:  { color: colors.dim, fontSize: typography.sm, textAlign: 'center', lineHeight: 20 },

  card:        { marginBottom: 12 },
  sectionTitle:{ color: colors.white, fontSize: typography.base, fontWeight: '700', marginBottom: 12 },
  body:        { color: colors.dim, fontSize: typography.sm, lineHeight: 22, marginBottom: 16, opacity: 0.9 },

  progressWrap: { gap: 6 },
  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel:{ color: colors.dim, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.6 },
  progressVal:  { color: colors.sky, fontSize: typography.xs, fontWeight: '700' },
  track:        { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  fill:         { height: '100%', backgroundColor: colors.sky, borderRadius: 3 },

  pipelineRow:      { flexDirection: 'row', marginBottom: 0 },
  pipelineLine:     { width: 24, alignItems: 'center', marginRight: 12 },
  pipelineDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sky, borderWidth: 2, borderColor: 'rgba(14,165,233,0.3)', marginTop: 4 },
  pipelineConnector:{ width: 2, flex: 1, backgroundColor: 'rgba(14,165,233,0.2)', marginVertical: 2 },
  pipelineStep:     { color: colors.sky, fontSize: typography.xs, fontWeight: '800', letterSpacing: 0.5 },
  pipelineDesc:     { color: colors.dim, fontSize: typography.xs, lineHeight: 18, marginBottom: 10 },

  gridLabel:   { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47%', alignItems: 'flex-start' },
  featureIcon: { fontSize: 22, marginBottom: 8 },
  featureTitle:{ color: colors.white, fontSize: typography.xs, fontWeight: '700', marginBottom: 6 },
  featureDesc: { color: colors.dim, fontSize: 10, lineHeight: 15, opacity: 0.85 },
});
