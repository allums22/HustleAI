import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
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
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const res = await api.getHustleDetail(id!);
      setHustle(res.hustle);
      setPlan(res.business_plan);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAndGenerate = async () => {
    if (!id) return;
    setGeneratingPlan(true);
    try {
      await api.selectHustle(id);
      const res = await api.generatePlan(id);
      setPlan(res.plan);
      setHustle((prev: any) => prev ? { ...prev, selected: true, business_plan_generated: true } : prev);
    } catch (e: any) {
      alert(e.message || 'Failed to generate plan');
    } finally {
      setGeneratingPlan(false);
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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity testID="detail-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Hustle Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hustle Info */}
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

        {/* Generate Plan CTA or Plan Content */}
        {!plan && !generatingPlan && (
          <TouchableOpacity
            testID="generate-plan-btn"
            style={styles.generateBtn}
            onPress={handleSelectAndGenerate}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={20} color={Colors.textOnColor} />
            <Text style={styles.generateBtnText}>Generate 30-Day Business Plan</Text>
          </TouchableOpacity>
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

            {/* Resources */}
            {plan.resources_needed && plan.resources_needed.length > 0 && (
              <View style={styles.resourcesCard}>
                <Text style={styles.resourcesTitle}>Resources Needed</Text>
                {plan.resources_needed.map((r: string, i: number) => (
                  <View key={i} style={styles.resourceRow}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
                    <Text style={styles.resourceText}>{r}</Text>
                  </View>
                ))}
                {plan.total_estimated_cost && (
                  <Text style={styles.costText}>Estimated cost: {plan.total_estimated_cost}</Text>
                )}
              </View>
            )}

            {/* Milestones */}
            <Text style={styles.sectionLabel}>Key Milestones</Text>
            {(plan.milestones || []).map((m: any, i: number) => (
              <View key={i} style={styles.milestoneCard}>
                <View style={styles.milestoneHeader}>
                  <View style={styles.milestoneDayBadge}>
                    <Text style={styles.milestoneDayText}>Day {m.day}</Text>
                  </View>
                  <Text style={styles.milestoneTitle}>{m.title}</Text>
                </View>
                <Text style={styles.milestoneDesc}>{m.description}</Text>
                <Text style={styles.milestoneOutcome}>Expected: {m.expected_outcome}</Text>
              </View>
            ))}

            {/* Day-by-day Preview */}
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
              <TouchableOpacity
                testID="view-full-calendar-btn"
                style={styles.viewCalendarBtn}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <Ionicons name="calendar-outline" size={18} color={Colors.trustBlue} />
                <Text style={styles.viewCalendarText}>View Full 30-Day Calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.orangeCTA, paddingVertical: 18, borderRadius: 14, marginBottom: 16 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
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
});
