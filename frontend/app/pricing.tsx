import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

const plans = [
  { key: 'free', name: 'Free', price: '$0', period: 'forever', headline: 'Discover Your Hustles',
    features: ['Up to 12 side hustle recommendations', '1 free trial business plan', 'Community access', 'Skills assessment'],
    locked: ['Premium business plans', 'Launch kits & landing pages', 'AI Mentor chat', 'AI Agents'], popular: false, icon: 'flash' },
  { key: 'starter', name: 'Starter', price: '$9.99', period: '/month', headline: '10 Plans + AI Mentor',
    features: ['All starter + premium hustles', '10 business plans/month', '2 Launch Kits with landing pages', 'AI Mentor — your personal business coach', '30-day execution calendar'],
    locked: [], popular: true, icon: 'star' },
  { key: 'pro', name: 'Pro', price: '$29.99', period: '/month', headline: 'Unlimited + AI Agents',
    features: ['Everything in Starter', 'Unlimited business plans', '5 Launch Kits/month', 'AI Mentor + Marketing Agent', 'Landing page customization', 'Advanced AI strategies'],
    locked: [], popular: false, icon: 'diamond' },
  { key: 'empire', name: 'Empire', price: '$49.99', period: '/month', headline: 'Full AI Team',
    features: ['Everything in Pro', 'Unlimited Launch Kits', 'All AI Agents (Marketing, Content, Finance)', 'AI Mentor with page editing', 'White-label landing pages', 'Dedicated support'],
    locked: [], popular: false, icon: 'trophy' },
];

export default function PricingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const currentTier = user?.subscription_tier || 'free';
  const tierOrder = ['free', 'starter', 'pro', 'empire'];

  const handleUpgrade = async (planKey: string) => {
    if (planKey === 'free' || planKey === currentTier) return;
    setLoadingPlan(planKey);
    try {
      let originUrl = '';
      if (Platform.OS === 'web') originUrl = window.location.origin;
      const res = await api.createCheckout(planKey, originUrl);
      if (res.url) { Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url); }
    } catch (e: any) { alert(e.message || 'Failed'); }
    finally { setLoadingPlan(null); }
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
        <Text style={styles.subtitle}>Unlock AI business plans & launch kits to turn hustles into revenue</Text>
        {plans.map((plan) => {
          const isCurrent = plan.key === currentTier;
          const isUpgrade = tierOrder.indexOf(plan.key) > tierOrder.indexOf(currentTier);
          const isEmpire = plan.key === 'empire';
          return (
            <View key={plan.key} style={[styles.planCard, plan.popular && styles.planCardPopular, isCurrent && styles.planCardCurrent, isEmpire && styles.planCardEmpire]}>
              {plan.popular && (<View style={styles.popularBadge}><Ionicons name="star" size={12} color={Colors.textOnColor} /><Text style={styles.popularText}>Most Popular</Text></View>)}
              {isEmpire && !isCurrent && (<View style={styles.empireBadge}><Ionicons name="trophy" size={12} color={Colors.textOnColor} /><Text style={styles.empireText}>Best for Serious Hustlers</Text></View>)}
              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <Ionicons name={plan.icon as any} size={18} color={isEmpire ? Colors.orangeCTA : Colors.trustBlue} />
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                <View style={styles.priceRow}><Text style={styles.planPrice}>{plan.price}</Text><Text style={styles.planPeriod}>{plan.period}</Text></View>
              </View>
              <View style={styles.headlineBadge}><Text style={styles.headlineText}>{plan.headline}</Text></View>
              <View style={styles.featuresList}>
                {plan.features.map((f, i) => {
                  const isAI = f.toLowerCase().includes('ai ') || f.toLowerCase().includes('agent');
                  return (
                    <View key={i} style={[styles.featureRow, isAI && styles.featureRowAI]}>
                      <Ionicons name={isAI ? 'sparkles' : 'checkmark-circle'} size={16} color={isAI ? Colors.gold : Colors.growthGreen} />
                      <Text style={[styles.featureText, isAI && styles.featureTextAI]}>{f}</Text>
                    </View>
                  );
                })}
                {plan.locked.map((f, i) => (<View key={`l-${i}`} style={styles.featureRow}><Ionicons name="lock-closed" size={16} color={Colors.textTertiary} /><Text style={styles.lockedText}>{f}</Text></View>))}
              </View>
              {isCurrent ? (<View style={styles.currentBadge}><Ionicons name="checkmark" size={16} color={Colors.growthGreen} /><Text style={styles.currentText}>Current Plan</Text></View>)
              : isUpgrade ? (<TouchableOpacity testID={`upgrade-${plan.key}-btn`} style={[styles.upgradeBtn, plan.popular && styles.upgradeBtnPopular, isEmpire && styles.upgradeBtnEmpire]}
                onPress={() => handleUpgrade(plan.key)} disabled={loadingPlan === plan.key}>
                {loadingPlan === plan.key ? <ActivityIndicator color={Colors.textOnColor} /> : <Text style={styles.upgradeBtnText}>{isEmpire ? 'Go Empire' : plan.popular ? 'Get Started' : `Upgrade to ${plan.name}`}</Text>}
              </TouchableOpacity>) : null}
            </View>
          );
        })}
        {/* À la carte */}
        <View style={styles.alacarteSection}>
          <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>pay per item</Text><View style={styles.dividerLine} /></View>
          <Text style={styles.alacarteNote}>Agents are chat only — no plans or kits included</Text>
          <View style={styles.alacarteRow}>
            <View style={styles.alacarteCard}>
              <Ionicons name="document-text" size={22} color={Colors.trustBlue} />
              <Text style={styles.alacarteTitle}>Business Plan</Text>
              <Text style={styles.alacartePrice}>$4.99</Text>
              <Text style={styles.alacartePer}>each</Text>
            </View>
            <View style={styles.alacarteCard}>
              <Ionicons name="rocket" size={22} color={Colors.orangeCTA} />
              <Text style={styles.alacarteTitle}>Launch Kit</Text>
              <Text style={styles.alacartePrice}>$2.99</Text>
              <Text style={styles.alacartePer}>each</Text>
            </View>
            <View style={styles.alacarteCard}>
              <Ionicons name="sparkles" size={22} color={Colors.orangeCTA} />
              <Text style={styles.alacarteTitle}>Single Agent</Text>
              <Text style={styles.alacartePrice}>$9.99</Text>
              <Text style={styles.alacartePer}>/mo each</Text>
            </View>
          </View>
          {/* Agent Pack */}
          <View style={styles.agentPack}>
            <View style={styles.agentPackBadge}><Text style={styles.agentPackBadgeText}>SAVE 33%</Text></View>
            <View style={styles.agentPackRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.agentPackIcons}>
                  <Ionicons name="megaphone" size={16} color="#EC4899" />
                  <Ionicons name="create" size={16} color="#8B5CF6" />
                  <Ionicons name="calculator" size={16} color="#22C55E" />
                </View>
                <Text style={styles.agentPackTitle}>AI Agent Pack</Text>
                <Text style={styles.agentPackSub}>All 3 premium agents</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.agentPackOld}>$29.97</Text>
                <Text style={styles.agentPackPrice}>$19.99<Text style={styles.agentPackMo}>/mo</Text></Text>
              </View>
            </View>
          </View>
          {/* Value nudge */}
          <View style={styles.valueNudge}>
            <Ionicons name="bulb-outline" size={14} color={Colors.gold} />
            <Text style={styles.valueNudgeText}>Pro ($29.99/mo) includes Marketing Agent + unlimited plans + 5 kits — better value than buying separately</Text>
          </View>
        </View>
        <View style={styles.guaranteeRow}><Ionicons name="shield-checkmark" size={18} color={Colors.growthGreen} /><Text style={styles.guaranteeText}>Secure checkout via Stripe</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 800, alignSelf: 'center', width: '100%' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  planCardPopular: { borderColor: Colors.trustBlue, borderWidth: 2 },
  planCardCurrent: { borderColor: Colors.growthGreen, borderWidth: 1.5 },
  planCardEmpire: { borderColor: Colors.orangeCTA, borderWidth: 2 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.trustBlue, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  popularText: { fontSize: 11, fontWeight: '700', color: Colors.textOnColor },
  empireBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orangeCTA, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  empireText: { fontSize: 11, fontWeight: '700', color: Colors.textOnColor },
  planHeader: { marginBottom: 10 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 },
  planPrice: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary },
  planPeriod: { fontSize: 14, color: Colors.textSecondary },
  headlineBadge: { backgroundColor: Colors.trustBlueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  headlineText: { fontSize: 13, fontWeight: '700', color: Colors.trustBlue },
  featuresList: { gap: 7, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  featureRowAI: { backgroundColor: Colors.orangeLight, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, marginVertical: 2 },
  featureText: { fontSize: 13, color: Colors.textPrimary },
  featureTextAI: { color: Colors.gold, fontWeight: '700' },
  lockedText: { fontSize: 13, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  currentBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.growthGreenLight },
  currentText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreen },
  upgradeBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.trustBlue },
  upgradeBtnPopular: { backgroundColor: Colors.orangeCTA },
  upgradeBtnEmpire: { backgroundColor: Colors.orangeCTA },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  alacarteSection: { marginTop: 4, marginBottom: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase' },
  alacarteRow: { flexDirection: 'row', gap: 10 },
  alacarteCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' as any },
  alacarteNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginBottom: 12 },
  alacarteTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  alacartePrice: { fontSize: 22, fontWeight: '800', color: Colors.orangeCTA },
  alacartePer: { fontSize: 11, color: Colors.textTertiary },
  agentPack: { backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.gold + '40', borderRadius: 14, padding: 18, marginTop: 14, position: 'relative' as any },
  agentPackBadge: { position: 'absolute' as any, top: -10, right: 14, backgroundColor: Colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  agentPackBadgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  agentPackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentPackIcons: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  agentPackTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  agentPackSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  agentPackOld: { fontSize: 14, color: Colors.textTertiary, textDecorationLine: 'line-through' as any },
  agentPackPrice: { fontSize: 24, fontWeight: '900', color: Colors.gold },
  agentPackMo: { fontSize: 14, fontWeight: '600' },
  valueNudge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, backgroundColor: Colors.orangeLight, padding: 12, borderRadius: 10 },
  valueNudgeText: { fontSize: 12, color: Colors.gold, flex: 1, lineHeight: 17 },
  guaranteeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  guaranteeText: { fontSize: 13, color: Colors.textSecondary },
});
