import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function CalendarScreen() {
  const router = useRouter();
  const [hustles, setHustles] = useState<any[]>([]);
  const [selectedHustle, setSelectedHustle] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.getHustles();
      const selected = (res.hustles || []).filter((h: any) => h.selected && h.business_plan_generated);
      setHustles(selected);
      if (selected.length > 0) {
        setSelectedHustle(selected[0].hustle_id);
        loadPlan(selected[0].hustle_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPlan = async (hustleId: string) => {
    setLoadingPlan(true);
    try {
      const res = await api.getPlan(hustleId);
      setPlan(res.plan);
    } catch {
      setPlan(null);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSelectHustle = (hustleId: string) => {
    setSelectedHustle(hustleId);
    loadPlan(hustleId);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Execution Calendar</Text>
        <Text style={styles.subtitle}>Your 30-day business plan</Text>
      </View>

      {hustles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No active plans yet</Text>
          <Text style={styles.emptyDesc}>Select a side hustle and generate a business plan to see your calendar</Text>
          <TouchableOpacity testID="go-hustles-btn" style={styles.emptyBtn} onPress={() => router.push('/(tabs)/hustles')}>
            <Text style={styles.emptyBtnText}>Browse Hustles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Hustle Selector */}
          {hustles.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow} contentContainerStyle={styles.selectorContent}>
              {hustles.map(h => (
                <TouchableOpacity
                  key={h.hustle_id}
                  testID={`calendar-hustle-${h.hustle_id}`}
                  style={[styles.selectorPill, selectedHustle === h.hustle_id && styles.selectorPillActive]}
                  onPress={() => handleSelectHustle(h.hustle_id)}
                >
                  <Text style={[styles.selectorText, selectedHustle === h.hustle_id && styles.selectorTextActive]}>{h.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loadingPlan ? (
            <View style={styles.loadingPlan}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>
          ) : plan ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.calendarContent}>
              {/* Milestones */}
              <View style={styles.milestonesRow}>
                {(plan.milestones || []).map((m: any, i: number) => (
                  <View key={i} style={styles.milestoneChip}>
                    <Text style={styles.milestoneDay}>Day {m.day}</Text>
                    <Text style={styles.milestoneTitle} numberOfLines={1}>{m.title}</Text>
                  </View>
                ))}
              </View>

              {/* Daily Tasks */}
              {(plan.daily_tasks || []).map((day: any, i: number) => {
                const isMilestone = (plan.milestones || []).some((m: any) => m.day === day.day);
                return (
                  <View key={i} style={[styles.dayCard, isMilestone && styles.dayCardMilestone]}>
                    <View style={styles.dayHeader}>
                      <View style={[styles.dayBadge, isMilestone && styles.dayBadgeMilestone]}>
                        <Text style={[styles.dayNumber, isMilestone && styles.dayNumberMilestone]}>Day {day.day}</Text>
                      </View>
                      {isMilestone && (
                        <View style={styles.milestoneBadge}>
                          <Ionicons name="flag" size={12} color={Colors.orangeCTA} />
                          <Text style={styles.milestoneBadgeText}>Milestone</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.dayTitle}>{day.title}</Text>
                    {(day.tasks || []).map((task: string, ti: number) => (
                      <View key={ti} style={styles.taskRow}>
                        <View style={styles.taskDot} />
                        <Text style={styles.taskText}>{task}</Text>
                      </View>
                    ))}
                    {day.estimated_hours && (
                      <View style={styles.hoursRow}>
                        <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.hoursText}>{day.estimated_hours}h estimated</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Plan not found</Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingPlan: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.trustBlue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textOnColor },
  selectorRow: { marginTop: 12, maxHeight: 44 },
  selectorContent: { paddingHorizontal: 24, gap: 8 },
  selectorPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  selectorPillActive: { backgroundColor: Colors.trustBlue, borderColor: Colors.trustBlue },
  selectorText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  selectorTextActive: { color: Colors.textOnColor },
  calendarContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  milestonesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  milestoneChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orangeLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  milestoneDay: { fontSize: 11, fontWeight: '700', color: Colors.orangeCTA },
  milestoneTitle: { fontSize: 11, color: Colors.textSecondary, maxWidth: 100 },
  dayCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  dayCardMilestone: { borderColor: Colors.orangeCTA, borderWidth: 1.5 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayBadge: { backgroundColor: Colors.trustBlueLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  dayBadgeMilestone: { backgroundColor: Colors.orangeLight },
  dayNumber: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  dayNumberMilestone: { color: Colors.orangeCTA },
  milestoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  milestoneBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.orangeCTA },
  dayTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  taskRow: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingLeft: 4 },
  taskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.growthGreen, marginTop: 6 },
  taskText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, flex: 1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  hoursText: { fontSize: 11, color: Colors.textTertiary },
});
