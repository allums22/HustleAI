import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/colors';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.questionnaire_completed ? '/(tabs)/dashboard' : '/questionnaire');
    }
  }, [user, loading]);

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.gold} /></View>;

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS === 'web') {
      const redirectUrl = window.location.origin + '/auth-callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}><Ionicons name="rocket" size={22} color={Colors.background} /></View>
            <Text style={styles.logoText}>HustleAI</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color={Colors.gold} />
            <Text style={styles.badgeText}>AI-Powered Side Hustle Engine</Text>
          </View>
          <Text style={styles.heroTitle}>Turn Your Skills{'\n'}Into <Text style={styles.heroGold}>Revenue</Text></Text>
          <Text style={styles.heroSub}>AI analyzes your skills, generates personalized side hustles, and builds you a complete business plan with execution calendar.</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresGrid}>
          {[
            { icon: 'bulb-outline', title: 'Smart Assessment', desc: 'AI maps your skills & interests', color: Colors.gold },
            { icon: 'trending-up', title: 'Revenue Matching', desc: '$100-$5,000+/week hustles', color: Colors.growthGreen },
            { icon: 'calendar-outline', title: '30-Day Blueprint', desc: 'Day-by-day execution plan', color: Colors.trustBlue },
            { icon: 'rocket-outline', title: 'Launch Kit', desc: 'Website + social + pitch', color: Colors.orangeCTA },
          ].map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                <Ionicons name={f.icon as any} size={22} color={f.color} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity testID="google-login-btn" style={styles.googleBtn} onPress={handleGoogleLogin} activeOpacity={0.8}>
            <Ionicons name="logo-google" size={20} color={Colors.background} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="email-login-btn" style={styles.emailBtn} onPress={() => router.push('/login')} activeOpacity={0.8}>
            <Ionicons name="mail-outline" size={20} color={Colors.gold} />
            <Text style={styles.emailBtnText}>Sign in with Email</Text>
          </TouchableOpacity>
          <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>New here?</Text><View style={styles.divider} /></View>
          <TouchableOpacity testID="register-btn" style={styles.registerBtn} onPress={() => router.push('/register')} activeOpacity={0.8}>
            <Text style={styles.registerBtnText}>Create Free Account</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>

        {/* Trust */}
        <View style={styles.trustSection}>
          {['First business plan is free', 'Unlimited side hustle discovery', 'No credit card required'].map((t, i) => (
            <View key={i} style={styles.trustRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.domainBranding}>hustleai.live</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 700, alignSelf: 'center', width: '100%' },
  header: { paddingVertical: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  hero: { marginTop: 24, marginBottom: 28 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orangeLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.gold },
  heroTitle: { fontSize: 38, fontWeight: '900', color: Colors.textPrimary, lineHeight: 44, letterSpacing: -1.5 },
  heroGold: { color: Colors.gold },
  heroSub: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginTop: 12 },
  proofRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  proofItem: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  proofNum: { fontSize: 18, fontWeight: '800', color: Colors.gold },
  proofLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 2, textAlign: 'center' },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  featureCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: Colors.textSecondary },
  ctaSection: { gap: 12, marginBottom: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12 },
  googleBtnText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.gold },
  emailBtnText: { fontSize: 16, fontWeight: '700', color: Colors.gold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textTertiary },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12 },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  trustSection: { gap: 8, alignItems: 'center', marginBottom: 20 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustText: { fontSize: 13, color: Colors.textSecondary },
  domainBranding: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
});
