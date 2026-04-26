import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import Background from '../components/Background';
import { analyzeImage } from '../services/api';
import { colors, typography, radius, shadow } from '../theme';

const GENDERS = ['Male', 'Female', 'Other'];

export default function DiagnosticsScreen({ navigation }) {
  const [form, setForm]     = useState({ name: '', age: '', gender: '', contactNumber: '' });
  const [image, setImage]   = useState(null);
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function pickImage(fromCamera) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required'); return; }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, base64: true });

    if (!result.canceled) setImage(result.assets[0]);
  }

  async function submit() {
    if (!form.name || !form.age || !form.gender || !image) {
      Alert.alert('Missing fields', 'Please fill all fields and select a scan.'); return;
    }
    setLoading(true);
    try {
      const data = await analyzeImage(
        { uri: image.uri, name: 'scan.jpg', type: image.mimeType || 'image/jpeg' },
        form,
      );
      navigation.navigate('Results', { data });
    } catch (e) {
      Alert.alert('Analysis failed', e.message || 'Could not reach the server. Check your network and API_BASE_URL in config.js.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>DIAGNOSTIC ENGINE</Text>
            <Text style={styles.headerTitle}>
              RetinaX <Text style={{ color: colors.sky }}>Pro</Text> Input
            </Text>
            <Text style={styles.headerSub}>Enter patient data and upload the retinal scan.</Text>
          </View>

          {/* Patient form */}
          <GlassCard style={styles.card}>
            <Text style={styles.sectionLabel}>📋  Assessment Data</Text>

            <TextInput
              style={styles.input}
              placeholder="Patient Full Name"
              placeholderTextColor={colors.dim}
              value={form.name}
              onChangeText={v => set('name', v)}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Age (Years)"
                placeholderTextColor={colors.dim}
                keyboardType="numeric"
                value={form.age}
                onChangeText={v => set('age', v)}
              />
              <View style={styles.genderWrap}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, form.gender === g && styles.genderActive]}
                    onPress={() => set('gender', g)}
                  >
                    <Text style={[styles.genderText, form.gender === g && { color: colors.sky }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contact / Reference ID"
              placeholderTextColor={colors.dim}
              value={form.contactNumber}
              onChangeText={v => set('contactNumber', v)}
            />
          </GlassCard>

          {/* Image upload */}
          <GlassCard style={styles.card}>
            <Text style={styles.sectionLabel}>🔬  Scan Upload</Text>

            {image ? (
              <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderText}>No scan selected</Text>
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity style={[styles.pickBtn, { marginRight: 8 }]} onPress={() => pickImage(false)}>
                <Text style={styles.pickText}>📁  Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(true)}>
                <Text style={styles.pickText}>📷  Camera</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitWrap, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={styles.submitGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Initiate Neural Assessment  🔬</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {loading && (
            <Text style={styles.loadingHint}>
              AI diagnostic sequencing in progress… This may take 15–30 seconds.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },

  header:      { marginBottom: 20, alignItems: 'center' },
  headerLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  headerTitle: { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center' },
  headerSub:   { color: colors.dim, fontSize: typography.sm, textAlign: 'center', marginTop: 6 },

  card:         { marginBottom: 14 },
  sectionLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    color: colors.white,
    fontSize: typography.base,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  row:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  genderWrap: { flex: 1, flexDirection: 'row', gap: 6 },
  genderBtn:  {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  genderActive: { borderColor: colors.sky, backgroundColor: 'rgba(14,165,233,0.15)' },
  genderText:   { color: colors.dim, fontSize: typography.xs, fontWeight: '600' },

  preview:     { width: '100%', height: 200, borderRadius: radius.md, marginBottom: 12, backgroundColor: '#000' },
  placeholder: { height: 160, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  placeholderIcon: { fontSize: 36, marginBottom: 8 },
  placeholderText: { color: colors.dim, fontSize: typography.sm },

  pickBtn:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  pickText: { color: colors.white, fontSize: typography.sm, fontWeight: '600' },

  submitWrap: { borderRadius: radius.xl, overflow: 'hidden', ...shadow, marginTop: 6 },
  submitGrad: { paddingVertical: 17, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: typography.md, fontWeight: '800' },

  loadingHint: { color: colors.dim, fontSize: typography.xs, textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
