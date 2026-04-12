import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
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
      if (user.questionnaire_completed) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/questionnaire');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.trustBlue} />
      </View>
    );
  }

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
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="rocket" size={24} color={Colors.textOnColor} />
            </View>
            <Text style={styles.logoText}>HustleAI</Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color={Colors.trustBlue} />
            <Text style={styles.badgeText}>AI-Powered Side Hustle Engine</Text>
          </View>
          <Text style={styles.heroTitle}>
            Discover Your{'\n'}Perfect Side Hustle
          </Text>
          <Text style={styles.heroSubtitle}>
            Take a quick skills assessment and let AI generate personalized side hustle
            recommendations with day-by-day execution plans.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          {[
            { icon: 'bulb-outline', title: 'Smart Assessment', desc: 'AI analyzes your skills & interests' },
            { icon: 'trending-up', title: 'Tailored Hustles', desc: 'Personalized recommendations' },
            { icon: 'calendar-outline', title: '30-Day Plans', desc: 'Day-by-day execution calendar' },
            { icon: 'wallet-outline', title: 'Income Goals', desc: 'Plans aligned to your targets' },
          ].map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: i % 2 === 0 ? Colors.trustBlueLight : Colors.growthGreenLight }]}>
                <Ionicons name={f.icon as any} size={20} color={i % 2 === 0 ? Colors.trustBlue : Colors.growthGreen} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity
            testID="google-login-btn"
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color={Colors.textOnColor} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="email-login-btn"
            style={styles.emailBtn}
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={20} color={Colors.trustBlue} />
            <Text style={styles.emailBtnText}>Sign in with Email</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>New here?</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            testID="register-btn"
            style={styles.registerBtn}
            onPress={() => router.push('/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerBtnText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trustSection}>
          <View style={styles.trustRow}>
            <Ionicons name="gift" size={16} color={Colors.growthGreen} />
            <Text style={styles.trustText}>First business plan is free</Text>
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="infinite" size={16} color={Colors.growthGreen} />
            <Text style={styles.trustText}>Unlimited side hustle discovery</Text>
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed" size={16} color={Colors.growthGreen} />
            <Text style={styles.trustText}>No credit card required to start</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  header: { paddingVertical: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.trustBlue, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  heroSection: { marginTop: 32, marginBottom: 32 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.trustBlueLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.trustBlue },
  heroTitle: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary, lineHeight: 42, letterSpacing: -1 },
  heroSubtitle: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginTop: 12 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  featureCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: Colors.textSecondary },
  ctaSection: { gap: 12, marginBottom: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.trustBlue, paddingVertical: 16, borderRadius: 12 },
  googleBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.surface, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.trustBlue },
  emailBtnText: { fontSize: 16, fontWeight: '700', color: Colors.trustBlue },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textTertiary },
  registerBtn: { backgroundColor: Colors.orangeCTA, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  trustSection: { gap: 8, alignItems: 'center' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustText: { fontSize: 13, color: Colors.textSecondary },
});
