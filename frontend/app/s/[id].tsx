import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function PublicScorecardPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sc, setSc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getPublicScorecard(id as string)
      .then(setSc)
      .catch(() => setSc(null))
      .finally(() => setLoading(false));
  }, [id]);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/s/${id}` : `https://hustleai.live/s/${id}`;

  const handleShare = async () => {
    const text = `I'm a ${sc.archetype} ${sc.archetype_emoji} on HustleAI! Take the 2-min quiz and find your side hustle archetype 👇\n${shareUrl}`;
    try {
      if (Platform.OS === 'web') {
        if ((navigator as any).share) {
          await (navigator as any).share({ title: 'My HustleAI Scorecard', text, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      } else {
        await Share.share({ message: text, url: shareUrl });
      }
    } catch {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.gold} /></View>;
  if (!sc) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color={Colors.textTertiary} />
        <Text style={styles.errorTitle}>Scorecard Not Found</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.replace('/')}>
          <Text style={styles.ctaText}>Take the Quiz</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoIcon}><Ionicons name="rocket" size={18} color={Colors.background} /></View>
          <Text style={styles.brandName}>HustleAI</Text>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{sc.user_name_first}'s Hustle Archetype</Text>
          <Text style={styles.heroEmoji}>{sc.archetype_emoji}</Text>
          <Text style={styles.heroTitle}>{sc.archetype}</Text>
          <Text style={styles.heroDesc}>{sc.archetype_desc}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}><Ionicons name="time-outline" size={12} color={Colors.gold} /><Text style={styles.metaText}>{sc.hours_per_week} hrs/wk</Text></View>
            <View style={styles.metaPill}><Ionicons name="cash-outline" size={12} color={Colors.gold} /><Text style={styles.metaText}>{sc.income_goal}</Text></View>
            <View style={styles.metaPill}><Ionicons name="trending-up" size={12} color={Colors.gold} /><Text style={styles.metaText}>{sc.total_hustles} matches</Text></View>
          </View>
        </View>

        {/* Top 3 Matches */}
        <Text style={styles.sectionTitle}>Top 3 Hustle Matches</Text>
        {sc.top_hustles?.map((h: any, i: number) => (
          <View key={i} style={styles.hustleCard}>
            <View style={styles.rankBadge}><Text style={styles.rankText}>#{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hustleName}>{h.name}</Text>
              <View style={styles.hustleMeta}>
                <Text style={styles.hustleCat}>{h.category}</Text>
                <Text style={styles.hustleIncome}>{h.potential_income}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Share CTA */}
        <TouchableOpacity testID="share-scorecard-btn" style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name={copied ? 'checkmark' : 'share-social'} size={20} color={Colors.background} />
          <Text style={styles.shareText}>{copied ? 'Copied!' : 'Share My Scorecard'}</Text>
        </TouchableOpacity>

        {/* Signup CTA for viewers */}
        <View style={styles.signupCard}>
          <Text style={styles.signupTitle}>Discover Your Own Archetype</Text>
          <Text style={styles.signupDesc}>Take the 2-minute quiz. Get personalized side hustles, a 30-day plan, and your AI team.</Text>
          <TouchableOpacity testID="quiz-cta-btn" style={styles.ctaBtn} onPress={() => router.push('/register')}>
            <Text style={styles.ctaText}>Take the Quiz (Free) →</Text>
          </TouchableOpacity>
          <Text style={styles.viewsText}>👁 {sc.views || 1} {sc.views === 1 ? 'view' : 'views'}</Text>
        </View>

        <Text style={styles.footer}>hustleai.live · A nexus28 product</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: Colors.background },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, marginBottom: 24 },
  logoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  heroCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 2, borderColor: Colors.gold + '40', marginBottom: 24 },
  heroEyebrow: { fontSize: 12, fontWeight: '700', color: Colors.gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  heroEmoji: { fontSize: 72, marginBottom: 8 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -1, marginBottom: 8 },
  heroDesc: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orangeLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  metaText: { fontSize: 11, fontWeight: '700', color: Colors.gold },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  hustleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  rankBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: '900', color: Colors.background },
  hustleName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  hustleMeta: { flexDirection: 'row', gap: 8 },
  hustleCat: { fontSize: 11, fontWeight: '600', color: Colors.trustBlue, textTransform: 'uppercase' },
  hustleIncome: { fontSize: 11, fontWeight: '600', color: Colors.growthGreenText },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 14, marginTop: 20, marginBottom: 20 },
  shareText: { fontSize: 16, fontWeight: '800', color: Colors.background },
  signupCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 12 },
  signupTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  signupDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  ctaBtn: { backgroundColor: Colors.gold, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  ctaText: { fontSize: 15, fontWeight: '800', color: Colors.background },
  viewsText: { fontSize: 12, color: Colors.textTertiary, marginTop: 8 },
  footer: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 24 },
});
