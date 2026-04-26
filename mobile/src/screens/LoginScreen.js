import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import Background from '../components/Background';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, typography, radius } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login }       = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Missing fields', 'Enter email and password.'); return; }
    setLoading(true);
    try {
      const userData = await loginUser(email.trim(), password);
      await login(userData);
    } catch (e) {
      Alert.alert('Login failed', e.response?.data?.error || 'Could not reach server.');
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
              <View style={st.badge}><Text style={st.badgeText}>SECURE USER PORTAL</Text></View>
              <View style={st.logoRing}>
                <View style={st.logoInner}><Text style={st.logoIcon}>👁</Text></View>
              </View>
              <Text style={st.title}>RetinaX <Text style={{ color: colors.sky }}>Pro</Text></Text>
              <Text style={st.subtitle}>Sign in to your diagnostic workspace.</Text>
            </View>

            <GlassCard style={st.card}>
              <Text style={st.fieldLabel}>REGISTRY EMAIL</Text>
              <TextInput
                style={st.input}
                placeholder="user@retinax.pro"
                placeholderTextColor={colors.dim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={st.fieldLabel}>SECURITY TOKEN</Text>
              <TextInput
                style={st.input}
                placeholder="••••••••"
                placeholderTextColor={colors.dim}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={[st.btnWrap, loading && { opacity: 0.6 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.btn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.btnText}>Authorize Access  🔒</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={st.footer}>
                <Text style={st.footerText}>First time using RetinaX?  </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={st.footerLink}>Create Access Hub</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  header:    { alignItems: 'center', marginBottom: 28 },
  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 20 },
  badgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1 },
  logoRing:  { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(14,165,233,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center' },
  logoIcon:  { fontSize: 26 },
  title:     { color: colors.white, fontSize: typography.xl, fontWeight: '800', textAlign: 'center' },
  subtitle:  { color: colors.dim, fontSize: typography.sm, marginTop: 6, textAlign: 'center' },

  card: { marginBottom: 0 },
  fieldLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    color: colors.white, fontSize: typography.base,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: 14, marginBottom: 14,
  },

  btnWrap: { borderRadius: radius.xl, overflow: 'hidden', marginTop: 6 },
  btn:     { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: typography.md, fontWeight: '800' },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' },
  footerText: { color: colors.dim, fontSize: typography.sm },
  footerLink: { color: colors.sky, fontSize: typography.sm, fontWeight: '700' },
});
