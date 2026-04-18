import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/colors';

export default function BetaInviteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.letterCard}>
          {/* Header */}
          <View style={s.letterHeader}>
            <View style={s.logoRow}>
              <View style={s.logoDot} />
              <Text style={s.logoText}>HustleAI</Text>
            </View>
            <View style={s.betaBadge}>
              <Text style={s.betaBadgeText}>BETA</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Letter Body */}
          <Text style={s.greeting}>Dear Valued Beta Tester,</Text>

          <Text style={s.paragraph}>
            Thank you for accepting our invitation to be among the first to experience HustleAI. Your time, insight, and honest feedback are invaluable to us as we shape the future of side hustle discovery and growth.
          </Text>

          <Text style={s.paragraph}>
            HustleAI is an AI-powered platform designed to help you discover, launch, and scale personalized side hustles. Here's what you can expect during this beta:
          </Text>

          <View style={s.expectList}>
            <View style={s.expectItem}>
              <Ionicons name="sparkles" size={18} color={Colors.gold} />
              <View style={s.expectContent}>
                <Text style={s.expectTitle}>AI-Powered Discovery</Text>
                <Text style={s.expectDesc}>Take a quick questionnaire and receive 12 personalized side hustle recommendations tailored to your skills, schedule, and goals.</Text>
              </View>
            </View>
            <View style={s.expectItem}>
              <Ionicons name="document-text" size={18} color={Colors.trustBlue} />
              <View style={s.expectContent}>
                <Text style={s.expectTitle}>30-Day Business Plans</Text>
                <Text style={s.expectDesc}>Get a detailed, day-by-day action plan with milestones to take your hustle from idea to income.</Text>
              </View>
            </View>
            <View style={s.expectItem}>
              <Ionicons name="rocket" size={18} color="#EC4899" />
              <View style={s.expectContent}>
                <Text style={s.expectTitle}>Launch Kits & Landing Pages</Text>
                <Text style={s.expectDesc}>Receive a complete launch kit with a branded landing page, social media posts, pricing tiers, and marketing strategy.</Text>
              </View>
            </View>
            <View style={s.expectItem}>
              <Ionicons name="people" size={18} color="#8B5CF6" />
              <View style={s.expectContent}>
                <Text style={s.expectTitle}>AI Agent Team</Text>
                <Text style={s.expectDesc}>Chat with specialized AI agents — a Business Mentor, Marketing Expert, Content Writer, and Finance Advisor — all focused on your hustle.</Text>
              </View>
            </View>
          </View>

          <Text style={s.paragraph}>
            As a beta tester, you have been granted full Empire access to every feature in the platform. We ask that you explore freely, push boundaries, and share your honest feedback through the in-app Feedback section.
          </Text>

          <Text style={s.paragraph}>
            Your insights will directly shape the product that thousands of aspiring entrepreneurs will use to build their financial freedom.
          </Text>

          <View style={s.signOff}>
            <Text style={s.thanks}>With gratitude,</Text>
            <Text style={s.signature}>James Adrian Allums</Text>
            <Text style={s.founderTitle}>Founder, nexus28</Text>
          </View>

          <View style={s.divider} />

          <Text style={s.domainText}>hustleai.live</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/register')} activeOpacity={0.85}>
          <Text style={s.ctaBtnText}>Accept Invitation & Create Account</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')} style={s.loginLink}>
          <Text style={s.loginLinkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  letterCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.border },
  letterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gold },
  logoText: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  betaBadge: { backgroundColor: Colors.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  betaBadgeText: { fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  greeting: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  paragraph: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  expectList: { gap: 16, marginVertical: 12, paddingLeft: 4 },
  expectItem: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  expectContent: { flex: 1 },
  expectTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  expectDesc: { fontSize: 13, color: Colors.textTertiary, lineHeight: 19 },
  signOff: { marginTop: 24 },
  thanks: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  signature: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, fontStyle: 'italic' },
  founderTitle: { fontSize: 13, color: Colors.textTertiary, marginTop: 4 },
  domainText: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', letterSpacing: 1 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.gold, paddingVertical: 18, borderRadius: 14, marginTop: 24 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { fontSize: 14, color: Colors.textTertiary },
});
