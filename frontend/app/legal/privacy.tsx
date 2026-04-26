import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/colors';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.updated}>Last updated: April 2026</Text>

        <Text style={s.h2}>1. Who We Are</Text>
        <Text style={s.p}>HustleAI is operated by nexus28 (“we”, “us”). We are the data controller for personal information collected through hustleai.live and the HustleAI mobile/web app.</Text>

        <Text style={s.h2}>2. What We Collect</Text>
        <Text style={s.p}>• <Text style={s.b}>Account info</Text>: name, email, password (hashed with bcrypt).
{'\n'}• <Text style={s.b}>Questionnaire answers</Text>: skills, goals, hours/week, financial targets you enter.
{'\n'}• <Text style={s.b}>Generated content</Text>: hustles, business plans, kits, agent chat history.
{'\n'}• <Text style={s.b}>Payment info</Text>: handled by Stripe — we never see or store full card numbers.
{'\n'}• <Text style={s.b}>Usage analytics</Text>: page views, button clicks, anonymized funnel events.
{'\n'}• <Text style={s.b}>Device info</Text>: IP, user-agent, push subscription endpoints (if you opt in).</Text>

        <Text style={s.h2}>3. How We Use It</Text>
        <Text style={s.p}>To deliver the Service, generate personalized recommendations via AI, process payments, send transactional and retention emails (welcome series, receipts), prevent abuse, and improve the product.</Text>

        <Text style={s.h2}>4. AI Processing</Text>
        <Text style={s.p}>We send your questionnaire answers and prompts to third-party AI providers (currently OpenAI GPT, via Emergent’s LLM gateway) to generate content. We do not allow these providers to train their models on your data per their enterprise agreements.</Text>

        <Text style={s.h2}>5. Sub-processors We Use</Text>
        <Text style={s.p}>Stripe (payments), Resend (transactional email), MongoDB Atlas (database hosting), OpenAI (AI generation, via Emergent), Google Cloud (push notifications via FCM if enabled).</Text>

        <Text style={s.h2}>6. Cookies &amp; Local Storage</Text>
        <Text style={s.p}>We store a session token in your browser/device storage to keep you signed in. We use minimal analytics cookies for funnel tracking. No third-party advertising trackers.</Text>

        <Text style={s.h2}>7. Your Rights</Text>
        <Text style={s.p}>You can: access, correct, export, or delete your data; opt out of email marketing (transactional emails for receipts will still be sent); revoke push notification permission. Email <Text style={s.link} onPress={() => router.push('/legal/contact')}>support@hustleai.live</Text> for any request.</Text>

        <Text style={s.h2}>8. Data Retention</Text>
        <Text style={s.p}>We keep account data while your account is active. After deletion, we remove personal data within 30 days, except where required by law (e.g. tax records for paid transactions).</Text>

        <Text style={s.h2}>9. Security</Text>
        <Text style={s.p}>HTTPS in transit, bcrypt-hashed passwords, environment-isolated secrets. No security is perfect; if we suffer a data breach affecting you, we will notify you per applicable law.</Text>

        <Text style={s.h2}>10. Children</Text>
        <Text style={s.p}>Service is not directed to anyone under 18. We do not knowingly collect data from minors.</Text>

        <Text style={s.h2}>11. International Users</Text>
        <Text style={s.p}>Data is processed in the United States. By using HustleAI you consent to this transfer.</Text>

        <Text style={s.h2}>12. Contact</Text>
        <Text style={s.p}>Privacy questions: <Text style={s.link} onPress={() => router.push('/legal/contact')}>support@hustleai.live</Text></Text>
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
  b: { fontWeight: '700', color: Colors.textPrimary },
  link: { color: Colors.gold, textDecorationLine: 'underline' as const, fontWeight: '600' },
});
