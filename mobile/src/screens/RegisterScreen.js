import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import Background from '../components/Background';
import { registerUser } from '../services/api';
import { colors, typography, radius } from '../theme';

const GENDERS = ['Male', 'Female', 'Other'];

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: '', nic: '', age: '', gender: '',
    contactNumber: '', email: '', address: '', password: '',
  });
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleRegister() {
    const required = ['fullName', 'nic', 'age', 'gender', 'contactNumber', 'email', 'address', 'password'];
    if (required.some(k => !form[k])) {
      Alert.alert('Missing fields', 'Please fill in all fields.'); return;
    }
    setLoading(true);
    try {
      await registerUser(form);
      Alert.alert('Success', 'Account created! Please login.', [
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Registration failed', e.response?.data?.error || 'Could not reach server.');
    } finally {
      setLoading(false);
    }
  }

  const Field = ({ label, field, ...props }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput
        style={st.input}
        placeholderTextColor={colors.dim}
        value={form[field]}
        onChangeText={v => set(field, v)}
        {...props}
      />
    </View>
  );

  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          <View style={st.header}>
            <View style={st.badge}><Text style={st.badgeText}>USER IDENTIFICATION</Text></View>
            <Text style={st.title}>Create Your <Text style={{ color: colors.sky }}>Workspace</Text></Text>
            <Text style={st.subtitle}>Register to begin secure assessments.</Text>
          </View>

          <GlassCard style={st.card}>
            <Field label="FULL NAME"  field="fullName"      placeholder="John Doe" />
            <Field label="NIC / ID"   field="nic"           placeholder="123456789V" />

            <View style={st.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="AGE" field="age" placeholder="45" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>GENDER</Text>
                <View style={st.genderRow}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[st.genderBtn, form.gender === g && st.genderActive]}
                      onPress={() => set('gender', g)}
                    >
                      <Text style={[st.genderText, form.gender === g && { color: colors.sky }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Field label="CONTACT" field="contactNumber" placeholder="+94 7..." keyboardType="phone-pad" />
            <Field label="ACCESS EMAIL" field="email" placeholder="user@retinax.pro" keyboardType="email-address" autoCapitalize="none" />
            <Field label="PRIMARY ADDRESS" field="address" placeholder="Home / Office Address" />
            <Field label="SECURITY TOKEN" field="password" placeholder="••••••••" secureTextEntry />

            <TouchableOpacity
              style={[st.btnWrap, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={st.btnText}>Create My Account  →</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={st.footer}>
              <Text style={st.footerText}>Already registered?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={st.footerLink}>Login to RetinaX Pro</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

        </ScrollView>
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

  card: { marginBottom: 0 },
  fieldLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    color: colors.white, fontSize: typography.base,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    paddingHorizontal: 14,
  },

  row:       { flexDirection: 'row', alignItems: 'flex-start' },
  genderRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  genderBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  genderActive: { borderColor: colors.sky, backgroundColor: 'rgba(14,165,233,0.15)' },
  genderText:   { color: colors.dim, fontSize: 10, fontWeight: '600' },

  btnWrap: { borderRadius: radius.xl, overflow: 'hidden', marginTop: 8 },
  btn:     { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: typography.md, fontWeight: '800' },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' },
  footerText: { color: colors.dim, fontSize: typography.sm },
  footerLink: { color: colors.sky, fontSize: typography.sm, fontWeight: '700' },
});
