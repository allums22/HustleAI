import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/colors';
import { useAuth } from '../src/context/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // If already logged in, go to dashboard
  if (user) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const handleNotify = () => {
    if (email.includes('@')) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={s.nav}>
          <View style={s.logoRow}>
            <View style={s.logoDot} />
            <Text style={s.logoText}>HustleAI</Text>
          </View>
          <TouchableOpacity style={s.betaLink} onPress={() => router.push('/beta-invite')}>
            <Text style={s.betaLinkText}>Beta Tester?</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>Coming Soon</Text>
          </View>

          <Text style={s.heroTitle}>
            Your AI Team{'\n'}For Building{'\n'}<Text style={s.heroGold}>Side Hustles</Text>
          </Text>

          <Text style={s.heroSub}>
            HustleAI discovers personalized side hustles, generates 30-day business plans, builds launch-ready landing pages, and gives you a team of AI agents to grow your income.
          </Text>
        </View>

        {/* Feature Preview Cards */}
        <View style={s.previewSection}>
          <Text style={s.sectionTag}>SNEAK PEEK</Text>
          <Text style={s.sectionTitle}>What's Inside</Text>

          <View style={s.featureGrid}>
            {[
              { icon: 'sparkles', color: '#E5A93E', title: 'AI-Powered Discovery', desc: 'Take a 2-min assessment. Get 12 personalized side hustles matched to your skills, schedule, and income goals.' },
              { icon: 'document-text', color: '#14B8A6', title: '30-Day Business Plans', desc: 'Detailed day-by-day action plans with milestones. Go from idea to income in 30 days.' },
              { icon: 'rocket', color: '#EC4899', title: 'Launch Kits & Landing Pages', desc: 'Complete branded landing pages, social media posts, pricing tiers, and marketing strategies.' },
              { icon: 'people', color: '#8B5CF6', title: 'AI Agent Team', desc: 'Chat with specialized agents — Business Mentor, Marketing Expert, Content Writer, and Finance Advisor.' },
            ].map((f, i) => (
              <View key={i} style={s.featureCard}>
                <View style={[s.featureIcon, { backgroundColor: f.color + '15' }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.color} />
                </View>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <View style={s.howSection}>
          <Text style={s.sectionTag}>HOW IT WORKS</Text>
          <Text style={s.sectionTitle}>Three Steps to Income</Text>

          {[
            { num: '01', title: 'Discover', desc: 'AI analyzes your unique skills and finds the perfect side hustle opportunities' },
            { num: '02', title: 'Plan', desc: 'Get a complete 30-day business plan with daily tasks and revenue milestones' },
            { num: '03', title: 'Launch', desc: 'Use your AI team to build landing pages, marketing content, and grow your business' },
          ].map((step, i) => (
            <View key={i} style={s.stepRow}>
              <Text style={s.stepNum}>{step.num}</Text>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Email Capture */}
        <View style={s.emailSection}>
          <Ionicons name="mail-outline" size={28} color={Colors.gold} />
          <Text style={s.emailTitle}>Be First to Launch</Text>
          <Text style={s.emailSub}>Get notified when HustleAI opens to the public</Text>

          {subscribed ? (
            <View style={s.subscribedBox}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreenText} />
              <Text style={s.subscribedText}>You're on the list! We'll notify you at launch.</Text>
            </View>
          ) : (
            <View style={s.emailInputRow}>
              <TextInput
                style={s.emailInput}
                placeholder="you@email.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                onSubmitEditing={handleNotify}
              />
              <TouchableOpacity style={s.emailBtn} onPress={handleNotify} activeOpacity={0.85}>
                <Text style={s.emailBtnText}>Notify Me</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats Teaser */}
        <View style={s.statsRow}>
          {[
            { label: 'Side Hustles', value: '100+' },
            { label: 'AI Agents', value: '4' },
            { label: 'Days to Launch', value: '30' },
          ].map((stat, i) => (
            <View key={i} style={s.statBox}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerDomain}>hustleai.live</Text>
          <Text style={s.footerCompany}>A nexus28 product</Text>
          <TouchableOpacity onPress={() => router.push('/beta-invite')}>
            <Text style={s.footerBeta}>Beta Tester Access →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingBottom: 40 },
  // Nav
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gold },
  logoText: { fontSize: 20, fontWeight: '900', color: '#FAFAFA', letterSpacing: -0.5 },
  betaLink: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2E2E35' },
  betaLinkText: { fontSize: 12, fontWeight: '600', color: Colors.gold },
  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 48, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#14B8A6' + '15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#14B8A6' },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#14B8A6', letterSpacing: 0.5 },
  heroTitle: { fontSize: 42, fontWeight: '900', color: '#FAFAFA', textAlign: 'center', letterSpacing: -2, lineHeight: 46, marginBottom: 20 },
  heroGold: { color: Colors.gold },
  heroSub: { fontSize: 16, color: '#71717A', textAlign: 'center', lineHeight: 24, maxWidth: 400, paddingHorizontal: 12 },
  // Sneak Peek
  previewSection: { paddingHorizontal: 24, paddingVertical: 40 },
  sectionTag: { fontSize: 11, fontWeight: '700', color: Colors.gold, letterSpacing: 2, marginBottom: 8 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: '#FAFAFA', letterSpacing: -1, marginBottom: 24 },
  featureGrid: { gap: 14 },
  featureCard: { backgroundColor: '#111113', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#1F1F23' },
  featureIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: '#FAFAFA', marginBottom: 6 },
  featureDesc: { fontSize: 13, color: '#71717A', lineHeight: 19 },
  // How It Works
  howSection: { paddingHorizontal: 24, paddingVertical: 40, backgroundColor: '#0A0A0C', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1F1F23' },
  stepRow: { flexDirection: 'row', gap: 18, alignItems: 'flex-start', marginBottom: 24 },
  stepNum: { fontSize: 36, fontWeight: '900', color: Colors.gold + '25', minWidth: 48 },
  stepContent: { flex: 1, paddingTop: 6 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: '#FAFAFA', marginBottom: 4 },
  stepDesc: { fontSize: 14, color: '#71717A', lineHeight: 20 },
  // Email
  emailSection: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 8 },
  emailTitle: { fontSize: 24, fontWeight: '900', color: '#FAFAFA', letterSpacing: -0.5 },
  emailSub: { fontSize: 14, color: '#71717A', marginBottom: 16 },
  emailInputRow: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 400 },
  emailInput: { flex: 1, backgroundColor: '#111113', borderWidth: 1, borderColor: '#2E2E35', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FAFAFA' },
  emailBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emailBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  subscribedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#052E16', padding: 14, borderRadius: 12, marginTop: 8 },
  subscribedText: { fontSize: 14, fontWeight: '600', color: '#4ADE80' },
  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 32, borderTopWidth: 1, borderColor: '#1F1F23' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '900', color: Colors.gold },
  statLabel: { fontSize: 11, color: '#71717A', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  // Footer
  footer: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  footerDomain: { fontSize: 14, fontWeight: '800', color: '#FAFAFA', letterSpacing: 0.5 },
  footerCompany: { fontSize: 12, color: '#71717A' },
  footerBeta: { fontSize: 13, fontWeight: '600', color: Colors.gold, marginTop: 8 },
});
