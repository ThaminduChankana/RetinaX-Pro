import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import Background from '../components/Background';
import GlassCard from '../components/GlassCard';
import { colors, typography, radius } from '../theme';

const DISEASES = [
  {
    name: 'CNV — Choroidal Neovascularization',
    tag: 'Critical Path', tagColor: colors.danger,
    modality: 'OCT',
    body: 'CNV involves the proliferation of abnormal blood vessels from the choroid into the sub-retinal space, often triggered by inflammation or ischemia. These vessels are fragile and prone to leakage, causing rapid structural disruption. RetinaX Pro identifies these as hyper-reflective signals within the outer retinal layers, providing a pixel-level density assessment for pathological validation.',
  },
  {
    name: 'DME — Diabetic Macular Edema',
    tag: 'Active Fluid', tagColor: colors.sky,
    modality: 'OCT',
    body: 'DME is characterized by macular thickening due to blood-retinal barrier breakdown. Fluid accumulates within intraretinal cystic spaces, leading to significant visual distortion. Our system segmentation allows for the precise calculation of fluid volume and total retinal burden.',
  },
  {
    name: 'DR — Diabetic Retinopathy',
    tag: 'Vascular Risk', tagColor: colors.danger,
    modality: 'OCT / Fundus',
    body: 'DR is the clinical result of chronic hyperglycemia damaging retinal microvasculature. Early detection of microaneurysms and hemorrhages is crucial to prevent proliferative progression. RetinaX Pro\'s neural layers focus on identifying these subtle vascular lesions within the inner retinal stack.',
  },
  {
    name: 'ARMD — Age-Related Macular Degeneration',
    tag: 'Monitoring Baseline', tagColor: colors.warning,
    modality: 'OCT / Fundus',
    body: 'ARMD is primarily identified by the presence of drusen—nodular deposits of sub-RPE debris. Over time, these lead to RPE atrophy and potential geographic progression. Our AI system segments these focal elevations to calculate total drusen volume and early-stage risk scores.',
  },
  {
    name: 'MH — Macular Hole',
    tag: 'Structural', tagColor: colors.warning,
    modality: 'OCT',
    body: 'A macular hole is a full-thickness defect in the foveal region of the retina. It can cause significant central vision loss and distortion. OCT is the gold standard for macular hole detection, enabling precise staging and measurement of hole diameter for surgical planning.',
  },
  {
    name: 'CSR — Central Serous Retinopathy',
    tag: 'Fluid Accumulation', tagColor: colors.sky,
    modality: 'OCT',
    body: 'CSR is characterized by serous detachment of the neurosensory retina due to leakage through the retinal pigment epithelium. It predominantly affects young to middle-aged adults. RetinaX detects the subretinal fluid pocket and its extent using OCT layer segmentation.',
  },
  {
    name: 'Glaucoma',
    tag: 'Optic Nerve', tagColor: colors.danger,
    modality: 'Fundus',
    body: 'Glaucoma is a progressive optic neuropathy characterized by cup-to-disc ratio enlargement and RNFL thinning. Often associated with elevated intraocular pressure. Fundus imaging detects morphological changes in the optic nerve head, enabling early risk stratification before irreversible loss occurs.',
  },
  {
    name: 'Cataract',
    tag: 'Lens Opacity', tagColor: colors.dim,
    modality: 'Fundus',
    body: 'Cataract presents as progressive clouding of the crystalline lens, reducing optical clarity and image quality. In fundus images, cataract manifests as reduced contrast, haziness, or imaging artifacts. RetinaX accounts for these confounds in its pre-processing pipeline.',
  },
  {
    name: 'Hypertensive Retinopathy',
    tag: 'Systemic', tagColor: colors.warning,
    modality: 'Fundus',
    body: 'Hypertensive retinopathy reflects systemic vascular damage in the retinal vasculature due to chronic hypertension. Signs include AV nicking, flame haemorrhages, cotton-wool spots, and papilloedema in severe cases. RetinaX grades severity by integrating vascular pattern analysis.',
  },
];

function DiseaseCard({ disease }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <GlassCard style={st.card}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={st.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={st.diseaseName}>{disease.name}</Text>
            <View style={st.tagRow}>
              <View style={[st.tag, { borderColor: disease.tagColor + '55', backgroundColor: disease.tagColor + '18' }]}>
                <Text style={[st.tagText, { color: disease.tagColor }]}>{disease.tag}</Text>
              </View>
              <View style={st.modalityBadge}>
                <Text style={st.modalityText}>{disease.modality}</Text>
              </View>
            </View>
          </View>
          <Text style={st.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && <Text style={st.body}>{disease.body}</Text>}
    </GlassCard>
  );
}

export default function WikiScreen() {
  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          <View style={st.header}>
            <View style={st.badge}><Text style={st.badgeText}>RETINAL PATHOLOGY KNOWLEDGE BASE</Text></View>
            <Text style={st.title}>Diagnostic <Text style={{ color: colors.sky }}>Encyclopedia</Text></Text>
            <Text style={st.subtitle}>
              Explore retinal pathologies through the lens of hybrid neural analytics. Tap any card to expand.
            </Text>
          </View>

          {DISEASES.map(d => <DiseaseCard key={d.name} disease={d} />)}

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

  card:        { marginBottom: 10 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center' },
  diseaseName: { color: colors.white, fontSize: typography.sm, fontWeight: '700', marginBottom: 8, lineHeight: 20 },
  tagRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tag:         { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText:     { fontSize: typography.xs, fontWeight: '700' },
  modalityBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  modalityText:  { color: colors.dim, fontSize: typography.xs, fontWeight: '600' },
  chevron:    { color: colors.sky, fontSize: 12, marginLeft: 10 },
  body:       { color: colors.dim, fontSize: typography.sm, lineHeight: 22, marginTop: 12, opacity: 0.9 },
});
