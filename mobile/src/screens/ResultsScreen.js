import React, { useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-chart-kit';
import Background from '../components/Background';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import HalfGauge from '../components/HalfGauge';
import ProbabilityBars from '../components/ProbabilityBars';
import { colors, typography, radius } from '../theme';
import { saveAssessmentPDF } from '../utils/generatePDF';

const W = Dimensions.get('window').width;

const CHART_CFG = {
  backgroundColor:            colors.navy,
  backgroundGradientFrom:     colors.navy,
  backgroundGradientTo:       colors.navy,
  decimalPlaces:              1,
  color:         (op = 1) => `rgba(14,165,233,${op})`,
  labelColor:    (op = 1) => `rgba(148,163,184,${op})`,
  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.05)' },
  barPercentage: 0.6,
};

function SectionTitle({ icon, title }) {
  return (
    <View style={st.sectionRow}>
      <Text style={st.sectionIcon}>{icon}</Text>
      <Text style={st.sectionTitle}>{title}</Text>
    </View>
  );
}

function PathologySummary({ isUncertain, disease, severity, severity_confidence, impact_percentage }) {
  const [open, setOpen] = useState(false);
  const primaryLabel = isUncertain ? '⚠ Multiple Conditions' : disease;
  const primaryColor = isUncertain ? colors.warning : colors.danger;

  return (
    <GlassCard style={st.card}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <View style={st.summaryHeader}>
          <View style={st.sectionRow}>
            <Text style={st.sectionIcon}>🧬</Text>
            <Text style={st.sectionTitle}>Hybrid Pathology Summary</Text>
          </View>
          <Text style={st.chevron}>{open ? '▲' : '▼'}</Text>
        </View>

        {/* Collapsed preview pill */}
        {!open && (
          <View style={st.previewRow}>
            <View style={[st.previewPill, { borderColor: primaryColor + '55', backgroundColor: primaryColor + '15' }]}>
              <Text style={[st.previewDisease, { color: primaryColor }]} numberOfLines={1}>{primaryLabel}</Text>
            </View>
            {!isUncertain && severity && (
              <View style={st.previewSev}>
                <Text style={st.previewSevText}>{severity}</Text>
              </View>
            )}
            <View style={st.previewBurden}>
              <Text style={st.previewBurdenText}>{impact_percentage}%</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded rows */}
      {open && (
        <View style={st.dropdownBody}>
          <View style={st.metricRow}>
            <Text style={st.metricLabel}>Primary Detection</Text>
            <Text style={[st.metricValue, { color: primaryColor }]} numberOfLines={2}>{primaryLabel}</Text>
          </View>
          <View style={st.divider} />
          <View style={st.metricRow}>
            <Text style={st.metricLabel}>Severity Grade</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[st.metricValue, { color: colors.warning }]}>
                {isUncertain ? 'See below' : (severity || 'N/A')}
              </Text>
              {!isUncertain && severity_confidence > 0 && (
                <Text style={st.metricSub}>{severity_confidence}% conf.</Text>
              )}
            </View>
          </View>
          <View style={st.divider} />
          <View style={st.metricRow}>
            <Text style={st.metricLabel}>Retinal Burden</Text>
            <Text style={[st.metricValue, { color: colors.sky }]}>{impact_percentage}%</Text>
          </View>
        </View>
      )}
    </GlassCard>
  );
}

export default function ResultsScreen({ route, navigation }) {
  const { data } = route.params;
  const {
    name, age, gender, contact_number,
    disease, probability, disease_scores,
    severity, severity_confidence, impact_percentage,
    clinical_report, modality,
    image_b64, heatmap_b64,
    severity_map, report_id,
    discriminator_info,
  } = data;

  const [pdfLoading, setPdfLoading] = useState(false);

  const isUncertain  = disease === 'Uncertain';
  const imageUri     = image_b64   ? `data:image/jpeg;base64,${image_b64}`   : null;
  const heatmapUri   = heatmap_b64 ? `data:image/jpeg;base64,${heatmap_b64}` : null;

  async function handleSavePDF() {
    setPdfLoading(true);
    try {
      await saveAssessmentPDF(data);
    } catch (e) {
      Alert.alert('PDF Error', e.message || 'Could not generate the report PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  // Bar chart data (top-6 by probability)
  const scoreEntries = Object.entries(disease_scores).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const ABBREV = {
    'Age-Related Macular Degeneration': 'ARMD', 'Choroidal Neovascularization': 'CNV',
    'Central Serous Retinopathy': 'CSR',        'Diabetic Macular Edema': 'DME',
    'Diabetic Retinopathy': 'DR',               'Macular Hole': 'MH',
    'Hypertensive Retinopathy': 'HTN-R',        'Normal': 'Norm',
    'Cataract': 'Cat.',                          'Glaucoma': 'Glau.',
  };
  const barData = {
    labels:   scoreEntries.map(([k]) => ABBREV[k] || k.substring(0, 5)),
    datasets: [{ data: scoreEntries.map(([, v]) => v) }],
  };

  const hasSeverityMap = severity_map && Object.keys(severity_map).length > 0;

  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={st.header}>
            <View style={st.headerBadge}>
              <Text style={st.headerBadgeText}>DIAGNOSTIC ASSESSMENT V2</Text>
            </View>
            <Text style={st.headerTitle}>RetinaX <Text style={{ color: colors.sky }}>Pro</Text> Dashboard</Text>
            <Text style={st.reportId} numberOfLines={1}>{report_id?.substring(0, 16)}…  {name}</Text>
          </View>

          {/* ── Subject Profile + Hybrid Summary ── */}
          <GlassCard style={st.card}>
            <SectionTitle icon="🪪" title="Subject Profile" />
            <Text style={st.profileMain}>{age}Y / {gender}</Text>
            <Text style={st.profileSub}>Ref: {contact_number}</Text>
            <Text style={st.profileSub}>Modality: {modality}</Text>
          </GlassCard>

          <PathologySummary
            isUncertain={isUncertain}
            disease={disease}
            severity={severity}
            severity_confidence={severity_confidence}
            impact_percentage={impact_percentage}
          />

          {/* ── Discriminator Model Comparison Card ── */}
          {!!(discriminator_info && discriminator_info.name) && (
            <GlassCard style={[st.card, { borderColor: 'rgba(14,165,233,0.35)' }]}>
              {/* Detection alert */}
              {(discriminator_info.name.includes('ARMD') || discriminator_info.name.includes('DME')) && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14, padding: 10, borderRadius: 8, backgroundColor: 'rgba(14,165,233,0.07)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' }}>
                  <Text style={{ fontSize: 14, marginTop: 1 }}>👁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.sky, fontSize: typography.xs, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {discriminator_info.name.includes('ARMD') ? 'ARMD / CNV Detected' : 'DME / DR Detected'}
                    </Text>
                    <Text style={{ color: colors.dim, fontSize: 10, marginTop: 4, lineHeight: 14 }}>
                      {discriminator_info.name.includes('ARMD')
                        ? 'Both Age-Related Macular Degeneration and Choroidal Neovascularization were identified in the initial classification. CNV is the angiogenic complication of neovascular AMD — both share subretinal fluid, pigment epithelial detachment, and disrupted outer retinal layers on OCT, making automated discrimination challenging. A dedicated pairwise discriminator was applied to resolve the ambiguity.'
                        : 'Both Diabetic Macular Edema and Diabetic Retinopathy were identified in the initial classification. DME is a direct vascular complication of DR — both share overlapping retinal features including macular thickening and vascular leakage. A dedicated pairwise discriminator was applied to resolve the ambiguity.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Before / After comparison */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Initial column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Initial Probability</Text>
                  {Object.entries(discriminator_info.initial || {}).map(([cls, prob]) => (
                    <View key={cls} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text style={{ color: colors.white, fontSize: 10 }}>{cls}</Text>
                        <Text style={{ color: colors.dim, fontSize: 10 }}>{typeof prob === 'number' ? prob.toFixed(1) : prob}%</Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ height: 4, borderRadius: 2, width: `${Math.min(prob, 100)}%`, backgroundColor: 'rgba(148,163,184,0.45)' }} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Divider */}
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />

                {/* Discriminator output column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Discriminator Output</Text>
                  {Object.entries(discriminator_info.discriminator || {}).map(([cls, prob]) => {
                    const isFinal = cls === discriminator_info.final;
                    return (
                      <View key={cls} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={{ color: isFinal ? colors.sky : colors.white, fontSize: 10, fontWeight: isFinal ? '800' : '400' }}>
                            {cls}{isFinal ? ' ✓' : ''}
                          </Text>
                          <Text style={{ color: isFinal ? colors.sky : colors.dim, fontSize: 10 }}>{typeof prob === 'number' ? prob.toFixed(1) : prob}%</Text>
                        </View>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }}>
                          <View style={{ height: 4, borderRadius: 2, width: `${Math.min(prob, 100)}%`, backgroundColor: isFinal ? colors.sky : 'rgba(148,163,184,0.25)' }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Therefore conclusion */}
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
                <Text style={{ color: colors.dim, fontSize: 10, marginBottom: 8 }}>
                  Therefore, final verdict via{' '}
                  <Text style={{ color: colors.sky, fontWeight: '700' }}>{discriminator_info.name}</Text>
                </Text>
                <View style={{ backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 16 }}>
                  <Text style={{ color: colors.sky, fontSize: typography.xs, fontWeight: '800' }}>
                    ✓ {discriminator_info.final} · {typeof discriminator_info.final_confidence === 'number' ? discriminator_info.final_confidence.toFixed(1) : discriminator_info.final_confidence}% confidence
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}

          {/* ── Multi-disease breakdown ── */}
          {hasSeverityMap && (
            <GlassCard style={[st.card, { borderColor: 'rgba(251,191,36,0.3)' }]}>
              <View style={st.warningBanner}>
                <Text style={st.warningText}>⚠  Overlapping Disease Probabilities Detected</Text>
                <Text style={st.warningSubText}>Multiple possible conditions identified. Please refer to a specialist.</Text>
              </View>
              <SectionTitle icon="📊" title="Disease Probability & Severity" />
              {Object.entries(severity_map).map(([dName, { label, confidence }]) => {
                const prob = (disease_scores[dName] || 0);
                return (
                  <View key={dName} style={st.candidateCard}>
                    <View style={st.candidateHeader}>
                      <Text style={st.candidateName}>{dName}</Text>
                      <Text style={st.candidateProb}>{prob.toFixed(1)}%</Text>
                    </View>
                    <Text style={st.candidateLabel}>Detection Probability</Text>
                    <View style={st.barTrack}>
                      <View style={[st.barFill, { width: `${Math.min(prob, 100)}%`, backgroundColor: colors.sky }]} />
                    </View>
                    <Text style={st.candidateLabel}>Severity Grade</Text>
                    <View style={st.candidateFooter}>
                      <Text style={st.candidateSev}>{label || '—'}</Text>
                      {confidence > 0 && <Text style={st.candidateConf}>{confidence.toFixed(1)}% conf.</Text>}
                    </View>
                    {confidence > 0 && (
                      <View style={st.barTrack}>
                        <View style={[st.barFill, {
                          width: `${Math.min(confidence, 100)}%`,
                          backgroundColor: confidence > 65 ? colors.success : confidence > 40 ? colors.warning : colors.danger,
                        }]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </GlassCard>
          )}

          {/* ── Retinal Scans ── */}
          <GlassCard style={st.card}>
            <SectionTitle icon="🖼" title="Original Retinal Scan" />
            {imageUri
              ? <Image source={{ uri: imageUri }} style={st.scanImg} resizeMode="contain" />
              : <Text style={st.noImg}>Image unavailable</Text>}
          </GlassCard>

          <GlassCard style={[st.card, { borderColor: 'rgba(14,165,233,0.25)' }]}>
            <SectionTitle icon="🔬" title="Hybrid Saliency Extraction" />
            {heatmapUri
              ? <Image source={{ uri: heatmapUri }} style={st.scanImg} resizeMode="contain" />
              : <View style={st.noHeatmap}><Text style={st.noHeatmapText}>Saliency visualization unavailable</Text></View>}
          </GlassCard>

          {/* ── Probability Distribution Bar Chart ── */}
          <GlassCard style={st.card}>
            <SectionTitle icon="📈" title="Probability Distribution" />
            <BarChart
              data={barData}
              width={W - 64}
              height={200}
              chartConfig={CHART_CFG}
              style={st.chart}
              fromZero
              showValuesOnTopOfBars
              withInnerLines
            />
          </GlassCard>

          {/* ── Probability Bars (replaces radar) ── */}
          <GlassCard style={st.card}>
            <SectionTitle icon="🎯" title="Diagnostic Confidence" />
            <ProbabilityBars scores={disease_scores} primaryDisease={disease} />
          </GlassCard>

          {/* ── Severity Reliability + Burden ── */}
          <View style={st.rowCards}>
            <GlassCard style={[st.card, { flex: 1, marginRight: 8, alignItems: 'center' }]}>
              <SectionTitle icon="✅" title="Severity Reliability" />
              <CircularProgress value={severity_confidence} color={colors.sky} />
            </GlassCard>
            <GlassCard style={[st.card, { flex: 1, marginLeft: 8, alignItems: 'center' }]}>
              <SectionTitle icon="📡" title="Retinal Burden" />
              <HalfGauge value={impact_percentage} size={140} />
            </GlassCard>
          </View>

          {/* ── Clinical Report ── */}
          <GlassCard style={[st.card, { borderColor: 'rgba(14,165,233,0.2)' }]}>
            <SectionTitle icon="🤖" title="RetinaX Pro v2 AI Assessment Report" />
            <View style={st.reportBorder}>
              <Text style={st.reportText}>{clinical_report}</Text>
            </View>
            <View style={st.reportFooter}>
              <Text style={st.reportFooterText}>ACOMS v5.0</Text>
              <View style={st.validatedBadge}>
                <Text style={st.validatedText}>Validated Logic</Text>
              </View>
            </View>
          </GlassCard>

          {/* ── Save PDF button ── */}
          <TouchableOpacity
            style={[st.newScanBtn, { marginBottom: 10 }, pdfLoading && { opacity: 0.6 }]}
            onPress={handleSavePDF}
            disabled={pdfLoading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0f766e', '#0d9488']} style={st.newScanGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {pdfLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.newScanText}>Save Assessment PDF  📄</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {/* ── New Scan button ── */}
          <TouchableOpacity
            style={st.newScanBtn}
            onPress={() => navigation.navigate('Diagnostics')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.newScanGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={st.newScanText}>New Assessment  +</Text>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll:  { padding: 16, paddingBottom: 48 },

  // Header
  header:          { alignItems: 'center', marginBottom: 16 },
  headerBadge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 8 },
  headerBadgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1 },
  headerTitle:     { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center' },
  reportId:        { color: colors.sky, fontSize: typography.xs, marginTop: 4, opacity: 0.8 },

  card:    { marginBottom: 12 },
  rowCards:{ flexDirection: 'row', marginBottom: 12 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon: { fontSize: 15, marginRight: 6 },
  sectionTitle:{ color: colors.sky, fontSize: typography.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Profile
  profileMain: { color: colors.white, fontSize: typography.xl, fontWeight: '800', marginBottom: 4 },
  profileSub:  { color: colors.dim, fontSize: typography.sm, marginBottom: 2 },

  // Pathology Summary dropdown
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chevron:       { color: colors.sky, fontSize: 11, marginTop: 1, opacity: 0.8 },

  previewRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  previewPill:       { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, maxWidth: '65%' },
  previewDisease:    { fontSize: typography.xs, fontWeight: '700' },
  previewSev:        { backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  previewSevText:    { color: colors.warning, fontSize: typography.xs, fontWeight: '700' },
  previewBurden:     { backgroundColor: 'rgba(14,165,233,0.1)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  previewBurdenText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700' },

  dropdownBody: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 14 },
  metricRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  metricLabel:  { color: colors.dim, fontSize: typography.xs, fontWeight: '600', flex: 1 },
  metricValue:  { fontSize: typography.base, fontWeight: '800', textAlign: 'right', flex: 1 },
  metricSub:    { color: colors.dim, fontSize: typography.xs, marginTop: 2 },
  divider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Multi-disease
  warningBanner:   { backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', borderRadius: radius.md, padding: 12, marginBottom: 16 },
  warningText:     { color: colors.warning, fontSize: typography.sm, fontWeight: '700', marginBottom: 4 },
  warningSubText:  { color: colors.dim, fontSize: typography.xs },
  candidateCard:   { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: 12, marginBottom: 10 },
  candidateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  candidateName:   { color: colors.white, fontSize: typography.sm, fontWeight: '700' },
  candidateProb:   { color: colors.sky, fontSize: typography.xs, fontWeight: '700', backgroundColor: 'rgba(14,165,233,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  candidateLabel:  { color: colors.dim, fontSize: typography.xs, marginBottom: 4 },
  candidateFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  candidateSev:    { color: colors.warning, fontSize: typography.sm, fontWeight: '800' },
  candidateConf:   { color: colors.sky, fontSize: typography.xs, fontWeight: '600' },
  barTrack:        { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill:         { height: '100%', borderRadius: 3 },

  // Scans
  scanImg:       { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: '#000' },
  noImg:         { color: colors.dim, textAlign: 'center', paddingVertical: 40 },
  noHeatmap:     { height: 140, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  noHeatmapText: { color: colors.dim, fontSize: typography.sm, opacity: 0.6 },

  // Chart
  chart: { borderRadius: radius.md, marginTop: 8 },

  // Report
  reportBorder: { borderLeftWidth: 2, borderLeftColor: 'rgba(14,165,233,0.4)', paddingLeft: 14, marginBottom: 16 },
  reportText:   { color: colors.white, fontSize: typography.sm, lineHeight: 22, opacity: 0.9 },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12 },
  reportFooterText: { color: colors.dim, fontSize: typography.xs, fontStyle: 'italic' },
  validatedBadge: { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  validatedText:  { color: colors.success, fontSize: typography.xs, fontWeight: '700' },

  // New scan
  newScanBtn:  { borderRadius: radius.xl, overflow: 'hidden', marginTop: 8 },
  newScanGrad: { paddingVertical: 16, alignItems: 'center' },
  newScanText: { color: '#fff', fontSize: typography.md, fontWeight: '800' },
});
