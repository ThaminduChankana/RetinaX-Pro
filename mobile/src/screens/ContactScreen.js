import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import Background from '../components/Background';
import { sendContact } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, typography, radius } from '../theme';

export default function ContactScreen() {
  const { user } = useAuth();
  const [form, setForm]     = useState({ name: user?.full_name || '', email: user?.email || '', message: '' });
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSend() {
    if (!form.name || !form.email || !form.message) {
      Alert.alert('Missing fields', 'Please fill in all fields.'); return;
    }
    setLoading(true);
    try {
      await sendContact(form.name, form.email, form.message);
      Alert.alert('Message sent', 'We\'ll get back to you soon.');
      setForm(f => ({ ...f, message: '' }));
    } catch {
      Alert.alert('Error', 'Could not send message. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

            <View style={st.header}>
              <View style={st.badge}><Text style={st.badgeText}>CLINICAL SUPPORT</Text></View>
              <Text style={st.title}>Contact <Text style={{ color: colors.sky }}>Our Team</Text></Text>
              <Text style={st.subtitle}>Send us a message and we'll respond within 24 hours.</Text>
            </View>

            <GlassCard style={st.card}>
              <Text style={st.fieldLabel}>YOUR NAME</Text>
              <TextInput style={st.input} placeholder="Full Name" placeholderTextColor={colors.dim}
                value={form.name} onChangeText={v => set('name', v)} />

              <Text style={st.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput style={st.input} placeholder="user@retinax.pro" placeholderTextColor={colors.dim}
                keyboardType="email-address" autoCapitalize="none"
                value={form.email} onChangeText={v => set('email', v)} />

              <Text style={st.fieldLabel}>MESSAGE</Text>
              <TextInput
                style={[st.input, st.textarea]}
                placeholder="Describe your query, feedback, or clinical question..."
                placeholderTextColor={colors.dim}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={form.message}
                onChangeText={v => set('message', v)}
              />

              <TouchableOpacity
                style={[st.btnWrap, loading && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.btnText}>Send Message  ✉️</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>

            {/* Info cards */}
            <View style={st.infoRow}>
              {[
                { icon: '📧', label: 'Email', value: 'support@retinax.pro' },
                { icon: '🌐', label: 'Platform', value: 'ACOMS v5.0' },
              ].map(({ icon, label, value }) => (
                <GlassCard key={label} style={st.infoCard}>
                  <Text style={st.infoIcon}>{icon}</Text>
                  <Text style={st.infoLabel}>{label}</Text>
                  <Text style={st.infoValue}>{value}</Text>
                </GlassCard>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },

  header:    { alignItems: 'center', marginBottom: 24 },
  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 },
  badgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1 },
  title:     { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center' },
  subtitle:  { color: colors.dim, fontSize: typography.sm, marginTop: 6, textAlign: 'center' },

  card:       { marginBottom: 16 },
  fieldLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    color: colors.white, fontSize: typography.base,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    paddingHorizontal: 14, marginBottom: 14,
  },
  textarea: { height: 120, paddingTop: 12 },

  btnWrap: { borderRadius: radius.xl, overflow: 'hidden', marginTop: 4 },
  btn:     { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: typography.md, fontWeight: '800' },

  infoRow:  { flexDirection: 'row', gap: 10 },
  infoCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  infoIcon: { fontSize: 22, marginBottom: 6 },
  infoLabel:{ color: colors.dim, fontSize: typography.xs, marginBottom: 4 },
  infoValue:{ color: colors.white, fontSize: typography.xs, fontWeight: '700', textAlign: 'center' },
});
