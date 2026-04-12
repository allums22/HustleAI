import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    hustles: '2 Side Hustles',
    features: ['AI-powered assessment', '2 side hustle recommendations', 'Basic business plan outline'],
    popular: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$9.99',
    period: '/month',
    hustles: '10 Side Hustles',
    features: ['Everything in Free', '10 side hustle recommendations', 'Full 30-day business plans', 'Execution calendar', 'Priority AI generation'],
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$29.99',
    period: '/month',
    hustles: 'Unlimited',
    features: ['Everything in Starter', 'Unlimited side hustles', 'Advanced business plans', 'Calendar with milestones', 'Regenerate plans anytime', 'Premium support'],
    popular: false,
  },
];

export default function PricingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentTier = user?.subscription_tier || 'free';

  const handleUpgrade = async (planKey: string) => {
    if (planKey === 'free' || planKey === currentTier) return;
    setLoadingPlan(planKey);
    try {
      let originUrl = '';
      if (Platform.OS === 'web') {
        originUrl = window.location.origin;
      }
      const res = await api.createCheckout(planKey, originUrl);
      if (res.url) {
        if (Platform.OS === 'web') {
          window.location.href = res.url;
        } else {
          Linking.openURL(res.url);
        }
      }
    } catch (e: any) {
      alert(e.message || 'Failed to create checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity testID="pricing-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Unlock your full hustle potential</Text>

        {plans.map((plan) => {
          const isCurrent = plan.key === currentTier;
          const isUpgrade = !isCurrent && plan.key !== 'free';

          return (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                plan.popular && styles.planCardPopular,
                isCurrent && styles.planCardCurrent,
              ]}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Ionicons name="star" size={12} color={Colors.textOnColor} />
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>

              <View style={styles.hustleBadge}>
                <Ionicons name="rocket" size={14} color={Colors.trustBlue} />
                <Text style={styles.hustleBadgeText}>{plan.hustles}</Text>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={styles.currentBadge}>
                  <Ionicons name="checkmark" size={16} color={Colors.growthGreen} />
                  <Text style={styles.currentText}>Current Plan</Text>
                </View>
              ) : isUpgrade ? (
                <TouchableOpacity
                  testID={`upgrade-${plan.key}-btn`}
                  style={[styles.upgradeBtn, plan.popular && styles.upgradeBtnPopular]}
                  onPress={() => handleUpgrade(plan.key)}
                  disabled={loadingPlan === plan.key}
                  activeOpacity={0.8}
                >
                  {loadingPlan === plan.key ? (
                    <ActivityIndicator color={Colors.textOnColor} />
                  ) : (
                    <Text style={styles.upgradeBtnText}>
                      {plan.popular ? 'Get Started' : 'Upgrade to Pro'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.guaranteeRow}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.growthGreen} />
          <Text style={styles.guaranteeText}>Secure checkout powered by Stripe</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  planCardPopular: { borderColor: Colors.trustBlue, borderWidth: 2 },
  planCardCurrent: { borderColor: Colors.growthGreen, borderWidth: 1.5 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.trustBlue, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  popularText: { fontSize: 11, fontWeight: '700', color: Colors.textOnColor },
  planHeader: { marginBottom: 12 },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 },
  planPrice: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary },
  planPeriod: { fontSize: 14, color: Colors.textSecondary },
  hustleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.trustBlueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 14 },
  hustleBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.trustBlue },
  featuresList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: Colors.textPrimary },
  currentBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.growthGreenLight },
  currentText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreen },
  upgradeBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.trustBlue },
  upgradeBtnPopular: { backgroundColor: Colors.orangeCTA },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  guaranteeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  guaranteeText: { fontSize: 13, color: Colors.textSecondary },
});
