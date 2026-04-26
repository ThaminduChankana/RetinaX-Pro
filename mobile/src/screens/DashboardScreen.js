import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import Background from '../components/Background';
import { useAuth } from '../context/AuthContext';
import { colors, typography, radius, shadow } from '../theme';

function NavCard({ icon, title, subtitle, onPress, accent }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: 10 }}>
      <GlassCard style={[st.navCard, accent && { borderColor: 'rgba(14,165,233,0.35)' }]}>
        <View style={st.navRow}>
          <Text style={st.navIcon}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[st.navTitle, accent && { color: colors.sky }]}>{title}</Text>
            {subtitle && <Text style={st.navSub}>{subtitle}</Text>}
          </View>
          <Text style={st.navArrow}>›</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();

  return (
    <Background>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={st.header}>
            <View style={st.badge}><Text style={st.badgeText}>SECURE USER SESSION</Text></View>
            <Text style={st.welcome}>Welcome back,</Text>
            <Text style={st.name}>{user?.full_name || 'User'}</Text>
            <Text style={st.headerSub}>
              Your secure diagnostic workspace is active.
            </Text>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={st.ctaWrap}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Diagnostics')}
          >
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={st.cta}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={st.ctaText}>New Assessment  🔬</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info navigation */}
          <Text style={st.sectionLabel}>EXPLORE</Text>
          <NavCard icon="📖" title="Knowledge Base" subtitle="OCT & Fundus disease encyclopedia" onPress={() => navigation.navigate('Wiki')} />
          <NavCard icon="🔬" title="AI Technology" subtitle="Dual-modality saliency & architecture" onPress={() => navigation.navigate('Technology')} />
          <NavCard icon="🏥" title="About RetinaX" subtitle="Our clinical mission and team" onPress={() => navigation.navigate('About')} />
          <NavCard icon="✉️" title="Contact Us" subtitle="Send a message to our team" onPress={() => navigation.navigate('Contact')} />

          {/* Profile summary */}
          <Text style={st.sectionLabel}>YOUR PROFILE</Text>
          <GlassCard style={st.profileCard}>
            <View style={st.profileRow}><Text style={st.profileKey}>Email</Text><Text style={st.profileVal}>{user?.email}</Text></View>
            <View style={st.profileRow}><Text style={st.profileKey}>NIC</Text><Text style={st.profileVal}>{user?.nic || '—'}</Text></View>
            <View style={st.profileRow}><Text style={st.profileKey}>Age</Text><Text style={st.profileVal}>{user?.age ? `${user.age}Y` : '—'}</Text></View>
            <View style={st.profileRow}><Text style={st.profileKey}>Gender</Text><Text style={st.profileVal}>{user?.gender || '—'}</Text></View>
            <View style={[st.profileRow, { borderBottomWidth: 0 }]}><Text style={st.profileKey}>Contact</Text><Text style={st.profileVal}>{user?.contact_number || '—'}</Text></View>
          </GlassCard>

          {/* Logout */}
          <TouchableOpacity style={st.logoutBtn} onPress={logout} activeOpacity={0.8}>
            <Text style={st.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={st.footer}>© 2026 RetinaX Pro AI Systems{'\n'}ACOMS v5.0 · Validated Logic</Text>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 80, paddingBottom: 140 },

  header:    { alignItems: 'center', marginBottom: 24 },
  badge:     { backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 12 },
  badgeText: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1 },
  welcome:   { color: colors.dim, fontSize: typography.sm, marginBottom: 2 },
  name:      { color: colors.white, fontSize: typography.xxl, fontWeight: '800', textAlign: 'center' },
  headerSub: { color: colors.dim, fontSize: typography.xs, marginTop: 6, textAlign: 'center', opacity: 0.7, lineHeight: 18 },

  ctaWrap: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: 24, ...shadow },
  cta:     { paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: typography.md, fontWeight: '800', letterSpacing: 0.3 },

  sectionLabel: { color: colors.sky, fontSize: typography.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10, marginTop: 4 },

  navCard: { marginBottom: 0 },
  navRow:  { flexDirection: 'row', alignItems: 'center' },
  navIcon: { fontSize: 22, marginRight: 14 },
  navTitle:{ color: colors.white, fontSize: typography.sm, fontWeight: '700', marginBottom: 2 },
  navSub:  { color: colors.dim, fontSize: typography.xs, opacity: 0.8 },
  navArrow:{ color: colors.sky, fontSize: 22, fontWeight: '300', marginLeft: 8 },

  profileCard: { marginBottom: 16 },
  profileRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  profileKey:  { color: colors.dim, fontSize: typography.xs, fontWeight: '600' },
  profileVal:  { color: colors.white, fontSize: typography.xs, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 12 },

  logoutBtn:  { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: radius.xl, paddingVertical: 14, alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(239,68,68,0.06)' },
  logoutText: { color: '#ef4444', fontSize: typography.sm, fontWeight: '700' },

  footer: { color: colors.dim, fontSize: typography.xs, textAlign: 'center', opacity: 0.4, lineHeight: 18 },
});
