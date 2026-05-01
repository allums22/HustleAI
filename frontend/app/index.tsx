import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/colors';
import { InstallButton } from '../src/components/InstallButton';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [seats, setSeats] = useState<{ remaining: number; limit: number; sold: number } | null>(null);

  // Track landing view + fetch real founders seat count for honest social proof
  useEffect(() => {
    api.trackEvent('landing_view', { path: '/' });
    api.getFoundersSeats().then((r: any) => setSeats(r)).catch(() => {});
  }, []);

  // If already logged in, go to dashboard
  if (user) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const handleBetaClick = () => {
    api.trackEvent('beta_invite_view', { source: 'landing_nav' });
    router.push('/beta-invite');
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
          <TouchableOpacity style={s.betaLink} onPress={handleBetaClick}>
            <Text style={s.betaLinkText}>Beta Tester?</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.badge}>
            <View style={s.badgeDotLive} />
            <Text style={s.badgeText}>LIVE · Founders Pricing</Text>
          </View>

          <Text style={s.heroTitle}>
            Your AI Team{'\n'}For Building{'\n'}<Text style={s.heroGold}>Side Hustles</Text>
          </Text>

          <Text style={s.heroSub}>
            HustleAI discovers personalized side hustles, generates 30-day business plans, builds launch-ready landing pages, and gives you a team of AI agents to grow your income.
          </Text>

          {/* Primary CTAs — drive to register + pricing + INSTALL */}
          <View style={s.ctaRow}>
            <TouchableOpacity
              testID="hero-get-started-btn"
              style={s.ctaPrimary}
              onPress={() => { api.trackEvent('hero_cta_get_started', {}); router.push('/register'); }}
              activeOpacity={0.85}
            >
              <Text style={s.ctaPrimaryText}>Get Started Free</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="hero-see-pricing-btn"
              style={s.ctaSecondary}
              onPress={() => { api.trackEvent('hero_cta_pricing', {}); router.push('/pricing'); }}
              activeOpacity={0.85}
            >
              <Text style={s.ctaSecondaryText}>See Founders Pricing</Text>
            </TouchableOpacity>
          </View>

          {/* 📲 Install App — one-click PWA install (web only, hides on standalone) */}
          <InstallButton variant="secondary" label="📲 Install HustleAI App" />

          {/* Trust badges */}
          <View style={s.trustRow}>
            <View style={s.trustBadge}>
              <Ionicons name="shield-checkmark" size={13} color={Colors.growthGreen} />
              <Text style={s.trustText}>30-day money-back</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="lock-closed" size={13} color={Colors.trustBlue} />
              <Text style={s.trustText}>Stripe-secured</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="flash" size={13} color={Colors.gold} />
              <Text style={s.trustText}>Instant access</Text>
            </View>
          </View>

          {/* Social proof — real Founders seats remaining (no inflation) */}
          {seats && seats.remaining > 0 && (
            <View style={s.socialProof}>
              <View style={s.liveDot} />
              <Text style={s.socialText}>
                <Text style={s.socialNumber}>{seats.remaining}</Text> of {seats.limit} Founders seats left
              </Text>
            </View>
          )}
          {seats && seats.remaining === 0 && (
            <View style={s.socialProof}>
              <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
              <Text style={s.socialText}>All Founders seats claimed — subscriptions still open</Text>
            </View>
          )}
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

        {/* Founders Pricing CTA Banner */}
        <View style={s.foundersBanner}>
          <View style={s.foundersBadgeRow}>
            <Ionicons name="flame" size={14} color="#fff" />
            <Text style={s.foundersBadgeText}>FOUNDERS · LIMITED TO 100 SEATS</Text>
          </View>
          <Text style={s.foundersTitle}>Skip the subscription.{'\n'}Pay once.</Text>
          <Text style={s.foundersSub}>
            $149 lifetime access to everything we ever ship — or $29 for one complete launch kit. No subscriptions. 30-day refund.
          </Text>
          <View style={s.foundersBtnRow}>
            <TouchableOpacity
              testID="landing-lifetime-cta"
              style={s.foundersPrimary}
              onPress={() => { api.trackEvent('landing_lifetime_cta', {}); router.push('/pricing'); }}
              activeOpacity={0.85}
            >
              <Text style={s.foundersPrimaryText}>Get Lifetime — $149</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="landing-kit-cta"
              style={s.foundersSecondary}
              onPress={() => { api.trackEvent('landing_kit_cta', {}); router.push('/pricing'); }}
              activeOpacity={0.85}
            >
              <Text style={s.foundersSecondaryText}>Try the $29 Kit</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.foundersMicro}>30-day money-back guarantee · Stripe-secured checkout</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerDomain}>hustleai.live</Text>
          <Text style={s.footerCompany}>A nexus28 product</Text>
          <View style={s.legalRow}>
            <TouchableOpacity onPress={() => router.push('/legal/terms')}><Text style={s.legalLink}>Terms</Text></TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => router.push('/legal/privacy')}><Text style={s.legalLink}>Privacy</Text></TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => router.push('/legal/refund-policy')}><Text style={s.legalLink}>Refund Policy</Text></TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => router.push('/legal/contact')}><Text style={s.legalLink}>Contact</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleBetaClick}>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#22C55E' + '15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: '#22C55E' + '40' },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#14B8A6' },
  badgeDotLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#22C55E', letterSpacing: 0.6 },
  heroTitle: { fontSize: 42, fontWeight: '900', color: '#FAFAFA', textAlign: 'center', letterSpacing: -2, lineHeight: 46, marginBottom: 20 },
  heroGold: { color: Colors.gold },
  heroSub: { fontSize: 16, color: '#71717A', textAlign: 'center', lineHeight: 24, maxWidth: 400, paddingHorizontal: 12, marginBottom: 28 },
  // Hero CTAs
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 12, marginBottom: 18 },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gold, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 },
  ctaPrimaryText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.3 },
  ctaSecondary: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#2E2E35', backgroundColor: '#111113' },
  ctaSecondaryText: { fontSize: 15, fontWeight: '800', color: '#FAFAFA' },
  // Trust badges
  trustRow: { flexDirection: 'row', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 14, marginBottom: 18 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 12, fontWeight: '600', color: '#A1A1AA' },
  // Social proof
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, backgroundColor: '#111113', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1F1F23' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  socialDots: { flexDirection: 'row' },
  avatarDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#050505' },
  socialText: { fontSize: 12, fontWeight: '600', color: '#A1A1AA' },
  socialNumber: { color: Colors.gold, fontWeight: '800' },
  // Error
  errorMsg: { fontSize: 13, color: '#F87171', marginTop: 8, fontWeight: '600' },
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
  // Founders Banner
  foundersBanner: { marginHorizontal: 24, marginVertical: 32, padding: 28, borderRadius: 18, backgroundColor: '#1A1209', borderWidth: 2, borderColor: Colors.gold + '50', alignItems: 'center' },
  foundersBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 14 },
  foundersBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  foundersTitle: { fontSize: 26, fontWeight: '900', color: '#FAFAFA', textAlign: 'center', letterSpacing: -0.6, lineHeight: 32, marginBottom: 10 },
  foundersSub: { fontSize: 14, color: '#A1A1AA', textAlign: 'center', lineHeight: 20, marginBottom: 22, paddingHorizontal: 6 },
  foundersBtnRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 10, justifyContent: 'center', marginBottom: 12, width: '100%' },
  foundersPrimary: { backgroundColor: Colors.gold, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, alignItems: 'center', minWidth: 160, flex: 1, maxWidth: 220 },
  foundersPrimaryText: { fontSize: 15, fontWeight: '900', color: '#000' },
  foundersSecondary: { backgroundColor: 'transparent', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#3F3F46', alignItems: 'center', minWidth: 130, flex: 1, maxWidth: 200 },
  foundersSecondaryText: { fontSize: 14, fontWeight: '800', color: '#FAFAFA' },
  foundersMicro: { fontSize: 11, color: '#71717A', textAlign: 'center', fontWeight: '600' },
  // Footer
  footer: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  footerDomain: { fontSize: 14, fontWeight: '800', color: '#FAFAFA', letterSpacing: 0.5 },
  footerCompany: { fontSize: 12, color: '#71717A' },
  footerBeta: { fontSize: 13, fontWeight: '600', color: Colors.gold, marginTop: 8 },
  legalRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 6, marginTop: 8 },
  legalLink: { fontSize: 12, color: '#A1A1AA', fontWeight: '600', textDecorationLine: 'underline' as const },
  legalDot: { fontSize: 12, color: '#52525B' },
});
