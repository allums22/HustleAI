import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/colors';

export default function RefundScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Refund Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.updated}>Last updated: April 2026</Text>

        <View style={s.banner}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.growthGreen} />
          <Text style={s.bannerText}>30-Day Money-Back Guarantee on every paid plan and one-time purchase.</Text>
        </View>

        <Text style={s.h2}>How it works</Text>
        <Text style={s.p}>If you don’t earn your first dollar of side income within 30 days of your purchase, we will issue a full refund — no questions asked.</Text>

        <Text style={s.h2}>What’s covered</Text>
        <Text style={s.p}>• Subscriptions: Starter, Pro, Empire (monthly &amp; annual)
{'\n'}• Founders Lifetime Access ($149)
{'\n'}• Instant Hustle Kit ($29)
{'\n'}• À la carte purchases (Business Plan $4.99, AI Agents)</Text>

        <Text style={s.h2}>How to request a refund</Text>
        <Text style={s.p}>Email <Text style={s.link} onPress={() => router.push('/legal/contact')}>support@hustleai.live</Text> within 30 days of your purchase with the email associated with your HustleAI account. You do not need to provide a reason. Refunds are processed via Stripe within 5–10 business days back to the original payment method.</Text>

        <Text style={s.h2}>After 30 days</Text>
        <Text style={s.p}>Refunds outside the 30-day window are reviewed case-by-case. Recurring subscriptions can be cancelled anytime in your profile to prevent future charges; we don’t pro-rate partial months but you keep access until the end of your billing period.</Text>

        <Text style={s.h2}>Chargebacks</Text>
        <Text style={s.p}>Please contact us first — we will refund quickly and without friction. Filing a chargeback before reaching out may result in account suspension.</Text>

        <Text style={s.h2}>Questions</Text>
        <Text style={s.p}>We’re a small team and we read every email. Reach out: <Text style={s.link} onPress={() => router.push('/legal/contact')}>support@hustleai.live</Text></Text>
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.growthGreenLight, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.growthGreen + '40', marginBottom: 6 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.growthGreenText, lineHeight: 18 },
  h2: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 22, marginBottom: 8, letterSpacing: -0.2 },
  p: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 8 },
  link: { color: Colors.gold, textDecorationLine: 'underline' as const, fontWeight: '600' },
});
