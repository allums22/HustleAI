import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/colors';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.updated}>Last updated: April 2026</Text>

        <Text style={s.h2}>1. Acceptance of Terms</Text>
        <Text style={s.p}>By accessing or using HustleAI (the “Service”), operated by nexus28 (“we”, “us”, “our”) at hustleai.live, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</Text>

        <Text style={s.h2}>2. What HustleAI Provides</Text>
        <Text style={s.p}>HustleAI is a software platform that delivers AI-generated personalized side hustle recommendations, business plans, launch kits (including landing pages), AI agent chat (mentor, marketing, content, finance), and progress-tracking tools. Outputs are educational and informational; we do not guarantee any specific business or financial outcome.</Text>

        <Text style={s.h2}>3. Accounts</Text>
        <Text style={s.p}>You must be 18+ and provide accurate information. You are responsible for safeguarding your password and for all activity under your account.</Text>

        <Text style={s.h2}>4. Plans, Payments &amp; Billing</Text>
        <Text style={s.p}>HustleAI offers (a) recurring subscriptions (Starter, Pro, Empire) billed monthly or annually, (b) one-time purchases (Founders Lifetime $149, Instant Hustle Kit $29, à la carte business plans $4.99), and (c) AI agent add-ons. All payments are processed by Stripe. Recurring subscriptions auto-renew until cancelled. You can cancel anytime in your profile or by emailing support@hustleai.live.</Text>

        <Text style={s.h2}>5. Money-Back Guarantee &amp; Refunds</Text>
        <Text style={s.p}>See our <Text style={s.link} onPress={() => router.push('/legal/refund-policy')}>Refund Policy</Text> for details on the 30-day money-back guarantee.</Text>

        <Text style={s.h2}>6. Acceptable Use</Text>
        <Text style={s.p}>You agree not to: (a) reverse-engineer, scrape, or resell the Service; (b) use it for unlawful, fraudulent, or abusive activity; (c) generate content that is hateful, defamatory, or violates third-party rights; (d) attempt to bypass usage limits or security.</Text>

        <Text style={s.h2}>7. AI-Generated Content Disclaimer</Text>
        <Text style={s.p}>HustleAI uses large language models. Outputs may be inaccurate, incomplete, or unsuitable. You are solely responsible for verifying information before relying on it for legal, financial, tax, or business decisions. HustleAI does not provide legal, financial, tax, accounting, or investment advice.</Text>

        <Text style={s.h2}>8. Intellectual Property</Text>
        <Text style={s.p}>The Service, branding, and underlying software are owned by nexus28. Content you generate using HustleAI (business plans, landing-page HTML, kits) is licensed to you for your own commercial use. You retain ownership of your inputs.</Text>

        <Text style={s.h2}>9. Termination</Text>
        <Text style={s.p}>We may suspend or terminate accounts that violate these Terms. You can delete your account at any time by emailing support@hustleai.live.</Text>

        <Text style={s.h2}>10. Disclaimers &amp; Limitation of Liability</Text>
        <Text style={s.p}>The Service is provided “as is” without warranty of any kind. To the maximum extent permitted by law, our aggregate liability for any claim is limited to the greater of (a) $100 USD or (b) the amount you paid us in the prior 12 months.</Text>

        <Text style={s.h2}>11. Changes</Text>
        <Text style={s.p}>We may update these Terms. Continued use after changes constitutes acceptance.</Text>

        <Text style={s.h2}>12. Contact</Text>
        <Text style={s.p}>Questions: <Text style={s.link} onPress={() => router.push('/legal/contact')}>support@hustleai.live</Text></Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%' },
  updated: { fontSize: 12, color: Colors.textTertiary, marginBottom: 18, fontStyle: 'italic' as const },
  h2: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 22, marginBottom: 8, letterSpacing: -0.2 },
  p: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 8 },
  link: { color: Colors.gold, textDecorationLine: 'underline' as const, fontWeight: '600' },
});
