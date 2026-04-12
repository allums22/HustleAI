import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, Platform, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function HustleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hustle, setHustle] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState('');

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const [detailRes, accessRes] = await Promise.all([
        api.getHustleDetail(id!),
        api.checkPlanAccess(id!),
      ]);
      setHustle(detailRes.hustle);
      setPlan(detailRes.business_plan);
      setAccess(accessRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!access?.has_access && !access?.plan_exists) {
      setShowPaywall(true);
      return;
    }
    setGeneratingPlan(true);
    try {
      await api.selectHustle(id!);
      const res = await api.generatePlan(id!);
      setPlan(res.plan);
      setHustle((prev: any) => prev ? { ...prev, selected: true, business_plan_generated: true } : prev);
      setAccess((prev: any) => prev ? { ...prev, plan_exists: true } : prev);
    } catch (e: any) {
      if (e.message?.includes('trial') || e.message?.includes('Upgrade') || e.message?.includes('limit')) {
        setShowPaywall(true);
      } else {
        alert(e.message || 'Failed to generate plan');
      }
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handlePurchase = async (type: 'alacarte' | 'starter' | 'pro') => {
    setPurchaseLoading(type);
    try {
      let originUrl = '';
      if (Platform.OS === 'web') originUrl = window.location.origin;
      const res = await api.createCheckout(type, originUrl, type === 'alacarte' ? id : undefined);
      if (res.url) {
        if (Platform.OS === 'web') {
          window.location.href = res.url;
        } else {
          Linking.openURL(res.url);
        }
      }
    } catch (e: any) {
      alert(e.message || 'Failed to start checkout');
    } finally {
      setPurchaseLoading('');
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;
  }

  if (!hustle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Hustle not found</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isTrial = access?.is_trial && !access?.plan_exists;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity testID="detail-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Hustle Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.infoCard}>
          <View style={styles.infoBadgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: Colors.trustBlueLight }]}>
              <Text style={[styles.categoryText, { color: Colors.trustBlue }]}>{hustle.category}</Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: hustle.difficulty === 'Easy' ? Colors.growthGreenLight : hustle.difficulty === 'Hard' ? Colors.urgentRedLight : Colors.trustBlueLight }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: hustle.difficulty === 'Easy' ? Colors.growthGreen : hustle.difficulty === 'Hard' ? Colors.urgentRed : Colors.trustBlue }}>{hustle.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.hustleName}>{hustle.name}</Text>
          <Text style={styles.hustleDesc}>{hustle.description}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="cash-outline" size={20} color={Colors.growthGreen} />
              <Text style={styles.statValue}>{hustle.potential_income}</Text>
              <Text style={styles.statLabel}>Potential Income</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="time-outline" size={20} color={Colors.trustBlue} />
              <Text style={styles.statValue}>{hustle.time_required}</Text>
              <Text style={styles.statLabel}>Time Required</Text>
            </View>
          </View>
          {hustle.why_good_fit && (
            <View style={styles.fitSection}>
              <Ionicons name="heart" size={16} color={Colors.orangeCTA} />
              <Text style={styles.fitText}>{hustle.why_good_fit}</Text>
            </View>
          )}
        </View>

        {/* CTA Area */}
        {!plan && !generatingPlan && (
          <View>
            {isTrial && (
              <View style={styles.trialBanner}>
                <Ionicons name="gift" size={18} color={Colors.growthGreen} />
                <Text style={styles.trialText}>Your first business plan is free!</Text>
              </View>
            )}
            <TouchableOpacity
              testID="generate-plan-btn"
              style={[styles.generateBtn, !access?.has_access && !isTrial && styles.lockedBtn]}
              onPress={handleGeneratePlan}
              activeOpacity={0.8}
            >
              <Ionicons name={access?.has_access ? 'sparkles' : 'lock-closed'} size={20} color={Colors.textOnColor} />
              <Text style={styles.generateBtnText}>
                {access?.has_access
                  ? (isTrial ? 'Generate Free Trial Plan' : 'Generate 30-Day Business Plan')
                  : 'Unlock Business Plan'}
              </Text>
            </TouchableOpacity>
            {!access?.has_access && (
              <Text style={styles.lockedHint}>Subscribe or buy à la carte ($4.99) to unlock</Text>
            )}
          </View>
        )}

        {generatingPlan && (
          <View style={styles.generatingCard}>
            <ActivityIndicator size="large" color={Colors.trustBlue} />
            <Text style={styles.generatingText}>Creating your personalized business plan...</Text>
          </View>
        )}

        {plan && (
          <View style={styles.planSection}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planOverview}>{plan.overview}</Text>
            {plan.resources_needed?.length > 0 && (
              <View style={styles.resourcesCard}>
                <Text style={styles.resourcesTitle}>Resources Needed</Text>
                {plan.resources_needed.map((r: string, i: number) => (
                  <View key={i} style={styles.resourceRow}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
                    <Text style={styles.resourceText}>{r}</Text>
                  </View>
                ))}
                {plan.total_estimated_cost && <Text style={styles.costText}>Estimated cost: {plan.total_estimated_cost}</Text>}
              </View>
            )}
            <Text style={styles.sectionLabel}>Key Milestones</Text>
            {(plan.milestones || []).map((m: any, i: number) => (
              <View key={i} style={styles.milestoneCard}>
                <View style={styles.milestoneHeader}>
                  <View style={styles.milestoneDayBadge}><Text style={styles.milestoneDayText}>Day {m.day}</Text></View>
                  <Text style={styles.milestoneTitle}>{m.title}</Text>
                </View>
                <Text style={styles.milestoneDesc}>{m.description}</Text>
                <Text style={styles.milestoneOutcome}>Expected: {m.expected_outcome}</Text>
              </View>
            ))}
            <Text style={styles.sectionLabel}>30-Day Plan Preview</Text>
            {(plan.daily_tasks || []).slice(0, 7).map((day: any, i: number) => (
              <View key={i} style={styles.dayPreview}>
                <View style={styles.dayPreviewHeader}>
                  <Text style={styles.dayPreviewNum}>Day {day.day}</Text>
                  <Text style={styles.dayPreviewTitle}>{day.title}</Text>
                </View>
                {(day.tasks || []).map((t: string, ti: number) => (
                  <Text key={ti} style={styles.dayPreviewTask}>• {t}</Text>
                ))}
              </View>
            ))}
            {(plan.daily_tasks || []).length > 7 && (
              <TouchableOpacity testID="view-full-calendar-btn" style={styles.viewCalendarBtn} onPress={() => router.push('/(tabs)/calendar')}>
                <Ionicons name="calendar-outline" size={18} color={Colors.trustBlue} />
                <Text style={styles.viewCalendarText}>View Full 30-Day Calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Paywall Modal */}
      <Modal visible={showPaywall} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity testID="close-paywall" style={styles.modalClose} onPress={() => setShowPaywall(false)}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.modalIcon}>
              <Ionicons name="lock-open" size={32} color={Colors.trustBlue} />
            </View>
            <Text style={styles.modalTitle}>Unlock This Business Plan</Text>
            <Text style={styles.modalSubtitle}>Get a detailed 30-day execution plan with daily tasks, milestones, and resources</Text>

            {/* À la carte option */}
            <TouchableOpacity
              testID="buy-alacarte-btn"
              style={styles.alacarteBtn}
              onPress={() => handlePurchase('alacarte')}
              disabled={!!purchaseLoading}
              activeOpacity={0.8}
            >
              {purchaseLoading === 'alacarte' ? <ActivityIndicator color={Colors.textOnColor} /> : (
                <>
                  <Text style={styles.alacarteBtnText}>Buy This Plan — $4.99</Text>
                  <Text style={styles.alacarteSubtext}>One-time purchase</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.modalDivider}>
              <View style={styles.modalDividerLine} />
              <Text style={styles.modalDividerText}>or subscribe for more</Text>
              <View style={styles.modalDividerLine} />
            </View>

            {/* Subscription options */}
            <TouchableOpacity
              testID="buy-starter-btn"
              style={styles.starterBtn}
              onPress={() => handlePurchase('starter')}
              disabled={!!purchaseLoading}
            >
              {purchaseLoading === 'starter' ? <ActivityIndicator color={Colors.textOnColor} /> : (
                <View style={styles.subBtnContent}>
                  <View>
                    <Text style={styles.subBtnTitle}>Starter — $9.99/mo</Text>
                    <Text style={styles.subBtnDesc}>10 business plans per month</Text>
                  </View>
                  <View style={styles.popularTag}><Text style={styles.popularTagText}>Best Value</Text></View>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="buy-pro-btn"
              style={styles.proBtn}
              onPress={() => handlePurchase('pro')}
              disabled={!!purchaseLoading}
            >
              {purchaseLoading === 'pro' ? <ActivityIndicator color={Colors.trustBlue} /> : (
                <View>
                  <Text style={styles.proBtnTitle}>Pro — $29.99/mo</Text>
                  <Text style={styles.proBtnDesc}>Unlimited business plans</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 18, color: Colors.textSecondary },
  backLink: { fontSize: 14, fontWeight: '600', color: Colors.trustBlue },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  infoBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  hustleName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  hustleDesc: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statBox: { flex: 1, backgroundColor: Colors.background, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  statLabel: { fontSize: 11, color: Colors.textTertiary },
  fitSection: { flexDirection: 'row', gap: 8, marginTop: 14, padding: 12, backgroundColor: Colors.orangeLight, borderRadius: 10 },
  fitText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  trialBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.growthGreenLight, padding: 12, borderRadius: 10, marginBottom: 10 },
  trialText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreen },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.orangeCTA, paddingVertical: 18, borderRadius: 14, marginBottom: 8 },
  lockedBtn: { backgroundColor: Colors.textSecondary },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  lockedHint: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', marginBottom: 16 },
  generatingCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 32, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  generatingText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  planSection: { gap: 12 },
  planTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  planOverview: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  resourcesCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  resourcesTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resourceText: { fontSize: 13, color: Colors.textSecondary },
  costText: { fontSize: 13, fontWeight: '600', color: Colors.trustBlue, marginTop: 4 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  milestoneCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.orangeCTA },
  milestoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  milestoneDayBadge: { backgroundColor: Colors.orangeLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  milestoneDayText: { fontSize: 11, fontWeight: '700', color: Colors.orangeCTA },
  milestoneTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  milestoneDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  milestoneOutcome: { fontSize: 12, color: Colors.growthGreenText, fontWeight: '600', marginTop: 4 },
  dayPreview: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  dayPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dayPreviewNum: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  dayPreviewTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  dayPreviewTask: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, paddingLeft: 8 },
  viewCalendarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.trustBlue },
  viewCalendarText: { fontSize: 14, fontWeight: '700', color: Colors.trustBlue },
  // Paywall Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.trustBlueLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 20 },
  alacarteBtn: { backgroundColor: Colors.orangeCTA, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  alacarteBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  alacarteSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  modalDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  modalDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  modalDividerText: { fontSize: 12, color: Colors.textTertiary },
  starterBtn: { backgroundColor: Colors.trustBlue, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  subBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  subBtnDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  popularTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  popularTagText: { fontSize: 10, fontWeight: '700', color: Colors.textOnColor },
  proBtn: { borderWidth: 1.5, borderColor: Colors.trustBlue, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  proBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.trustBlue },
  proBtnDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
