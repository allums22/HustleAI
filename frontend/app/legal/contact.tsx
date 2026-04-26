import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/colors';

export default function ContactScreen() {
  const router = useRouter();
  const email = 'support@hustleai.live';
  const onEmail = () => {
    if (Platform.OS === 'web') window.location.href = `mailto:${email}`;
    else Linking.openURL(`mailto:${email}`);
  };
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Contact</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Ionicons name="chatbubbles" size={36} color={Colors.gold} />
          <Text style={s.h1}>We’re a small team. We read every email.</Text>
          <Text style={s.sub}>Whether it’s a refund, a bug, or a feature idea — reach out and you’ll get a real human reply.</Text>
        </View>

        <TouchableOpacity onPress={onEmail} style={s.card}>
          <Ionicons name="mail" size={22} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>EMAIL</Text>
            <Text style={s.cardValue}>{email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={s.card}>
          <Ionicons name="business" size={22} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>BUSINESS</Text>
            <Text style={s.cardValue}>HustleAI · a nexus28 product</Text>
            <Text style={s.cardSub}>hustleai.live</Text>
          </View>
        </View>

        <View style={s.card}>
          <Ionicons name="time" size={22} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>RESPONSE TIME</Text>
            <Text style={s.cardValue}>Within 24 hours, Mon–Fri</Text>
            <Text style={s.cardSub}>Refunds processed within 5–10 business days via Stripe.</Text>
          </View>
        </View>

        <View style={s.linkRow}>
          <TouchableOpacity onPress={() => router.push('/legal/terms')}><Text style={s.fl}>Terms of Service</Text></TouchableOpacity>
          <Text style={s.dot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/legal/privacy')}><Text style={s.fl}>Privacy Policy</Text></TouchableOpacity>
          <Text style={s.dot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/legal/refund-policy')}><Text style={s.fl}>Refund Policy</Text></TouchableOpacity>
        </View>
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
  scroll: { padding: 24, maxWidth: 560, alignSelf: 'center', width: '100%' },
  hero: { alignItems: 'center', gap: 12, marginBottom: 22 },
  h1: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.4, lineHeight: 28 },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardLabel: { fontSize: 10, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1.2 },
  cardValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 6, marginTop: 18 },
  fl: { fontSize: 12, color: Colors.gold, fontWeight: '700' },
  dot: { color: Colors.textTertiary, fontSize: 12 },
});
