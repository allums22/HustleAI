import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function ProgressScreen() {
  const [tab, setTab] = useState<'tasks' | 'earnings'>('tasks');
  const [hustles, setHustles] = useState<any[]>([]);
  const [selectedHustle, setSelectedHustle] = useState<string>('');
  const [plan, setPlan] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logAmount, setLogAmount] = useState('');
  const [logNote, setLogNote] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [hustlesRes, streakRes, earningsRes, summaryRes] = await Promise.all([
        api.getHustles(), api.getStreak(), api.getEarnings(), api.getEarningsSummary()
      ]);
      const selected = (hustlesRes.hustles || []).filter((h: any) => h.selected && h.business_plan_generated);
      setHustles(selected);
      setStreak(streakRes);
      setEarnings(earningsRes.earnings || []);
      setSummary(summaryRes);
      if (selected.length > 0 && !selectedHustle) {
        setSelectedHustle(selected[0].hustle_id);
        loadPlan(selected[0].hustle_id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedHustle]);

  useEffect(() => { loadData(); }, []);

  const loadPlan = async (hustleId: string) => {
    try {
      const [planRes, progRes] = await Promise.all([api.getPlan(hustleId), api.getTaskProgress(hustleId)]);
      setPlan(planRes.plan);
      setProgress(progRes);
    } catch { setPlan(null); setProgress(null); }
  };

  const handleSelectHustle = (id: string) => { setSelectedHustle(id); loadPlan(id); };

  const handleToggleTask = async (day: number, taskIndex: number) => {
    const key = `${selectedHustle}_${day}_${taskIndex}`;
    const isCompleted = (progress?.completed_keys || []).includes(key);
    try {
      await api.completeTask(selectedHustle, day, taskIndex, !isCompleted);
      const updatedKeys = isCompleted
        ? (progress?.completed_keys || []).filter((k: string) => k !== key)
        : [...(progress?.completed_keys || []), key];
      setProgress({ ...progress, completed_keys: updatedKeys, completed_count: updatedKeys.length });
      const streakRes = await api.getStreak();
      setStreak(streakRes);
    } catch (e) { console.error(e); }
  };

  const handleLogEarning = async () => {
    const amt = parseFloat(logAmount);
    if (!amt || amt <= 0) return;
    try {
      await api.logEarning({ amount: amt, hustle_id: selectedHustle || undefined, note: logNote });
      setShowLogModal(false); setLogAmount(''); setLogNote('');
      const [earningsRes, summaryRes] = await Promise.all([api.getEarnings(), api.getEarningsSummary()]);
      setEarnings(earningsRes.earnings || []); setSummary(summaryRes);
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={Colors.gold} /></View>;

  const pct = progress ? Math.round((progress.completed_count / Math.max(progress.total_tasks, 1)) * 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Progress</Text>
        {streak && <View style={s.streakBadge}><Ionicons name="flame" size={16} color={Colors.gold} /><Text style={s.streakText}>{streak.current_streak} day streak</Text></View>}
      </View>

      {/* Tab Toggle */}
      <View style={s.tabRow}>
        <TouchableOpacity testID="tab-tasks" style={[s.tabBtn, tab === 'tasks' && s.tabBtnActive]} onPress={() => setTab('tasks')}>
          <Text style={[s.tabText, tab === 'tasks' && s.tabTextActive]}>Daily Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-earnings" style={[s.tabBtn, tab === 'earnings' && s.tabBtnActive]} onPress={() => setTab('earnings')}>
          <Text style={[s.tabText, tab === 'earnings' && s.tabTextActive]}>Earnings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>

        {tab === 'tasks' ? (
          <>
            {hustles.length === 0 ? (
              <View style={s.empty}><Ionicons name="checkbox-outline" size={48} color={Colors.textTertiary} /><Text style={s.emptyText}>Complete a hustle's business plan to start tracking tasks</Text></View>
            ) : (
              <>
                {hustles.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hustleSelector}>
                    {hustles.map(h => (
                      <TouchableOpacity key={h.hustle_id} style={[s.hustlePill, selectedHustle === h.hustle_id && s.hustlePillActive]} onPress={() => handleSelectHustle(h.hustle_id)}>
                        <Text style={[s.hustlePillText, selectedHustle === h.hustle_id && s.hustlePillTextActive]}>{h.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {/* Progress Bar */}
                <View style={s.progressCard}>
                  <View style={s.progressHeader}>
                    <Text style={s.progressLabel}>Overall Progress</Text>
                    <Text style={s.progressPct}>{pct}%</Text>
                  </View>
                  <View style={s.progressBar}><View style={[s.progressFill, { width: `${pct}%` }]} /></View>
                  <Text style={s.progressSub}>{progress?.completed_count || 0} of {progress?.total_tasks || 0} tasks completed</Text>
                </View>
                {/* Daily Tasks */}
                {plan?.daily_tasks?.map((day: any) => {
                  const dayCompleted = (day.tasks || []).every((_: any, ti: number) =>
                    (progress?.completed_keys || []).includes(`${selectedHustle}_${day.day}_${ti}`));
                  return (
                    <View key={day.day} style={[s.dayCard, dayCompleted && s.dayCardDone]}>
                      <View style={s.dayHeader}>
                        <View style={[s.dayBadge, dayCompleted && s.dayBadgeDone]}>
                          <Text style={[s.dayNum, dayCompleted && s.dayNumDone]}>Day {day.day}</Text>
                        </View>
                        <Text style={s.dayTitle} numberOfLines={1}>{day.title}</Text>
                        {dayCompleted && <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreenText} />}
                      </View>
                      {(day.tasks || []).map((task: string, ti: number) => {
                        const key = `${selectedHustle}_${day.day}_${ti}`;
                        const done = (progress?.completed_keys || []).includes(key);
                        return (
                          <TouchableOpacity key={ti} testID={`task-${day.day}-${ti}`} style={s.taskRow} onPress={() => handleToggleTask(day.day, ti)}>
                            <View style={[s.checkbox, done && s.checkboxDone]}>
                              {done && <Ionicons name="checkmark" size={14} color={Colors.background} />}
                            </View>
                            <Text style={[s.taskText, done && s.taskTextDone]}>{task}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <>
            {/* Earnings Summary */}
            <View style={s.earningsGrid}>
              <View style={s.earnCard}><Text style={s.earnLabel}>Today</Text><Text style={s.earnVal}>${(summary?.today || 0).toFixed(2)}</Text></View>
              <View style={s.earnCard}><Text style={s.earnLabel}>This Week</Text><Text style={s.earnVal}>${(summary?.this_week || 0).toFixed(2)}</Text></View>
              <View style={s.earnCard}><Text style={s.earnLabel}>This Month</Text><Text style={s.earnVal}>${(summary?.this_month || 0).toFixed(2)}</Text></View>
              <View style={[s.earnCard, s.earnCardTotal]}><Text style={s.earnLabel}>All Time</Text><Text style={[s.earnVal, { color: Colors.gold }]}>${(summary?.total || 0).toFixed(2)}</Text></View>
            </View>

            <TouchableOpacity testID="log-earning-btn" style={s.logBtn} onPress={() => setShowLogModal(true)}>
              <Ionicons name="add-circle" size={20} color={Colors.background} />
              <Text style={s.logBtnText}>Log Earning</Text>
            </TouchableOpacity>

            {/* Earnings History */}
            <Text style={s.historyTitle}>Recent Earnings</Text>
            {earnings.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>No earnings logged yet. Start tracking your hustle income!</Text></View>
            ) : earnings.slice(0, 20).map((e, i) => (
              <View key={i} style={s.earnRow}>
                <View style={s.earnDot} />
                <View style={s.earnInfo}><Text style={s.earnDate}>{e.date}</Text>{e.note ? <Text style={s.earnNote}>{e.note}</Text> : null}</View>
                <Text style={s.earnAmount}>+${e.amount.toFixed(2)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Log Earning Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}><Text style={s.modalTitle}>Log Earning</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity></View>
            <View style={s.modalField}><Text style={s.modalLabel}>Amount ($)</Text>
              <TextInput testID="earning-amount" style={s.modalInput} placeholder="0.00" placeholderTextColor={Colors.textTertiary} value={logAmount} onChangeText={setLogAmount} keyboardType="decimal-pad" /></View>
            <View style={s.modalField}><Text style={s.modalLabel}>Note (optional)</Text>
              <TextInput testID="earning-note" style={s.modalInput} placeholder="e.g. First freelance gig" placeholderTextColor={Colors.textTertiary} value={logNote} onChangeText={setLogNote} /></View>
            <TouchableOpacity testID="submit-earning" style={s.modalSubmit} onPress={handleLogEarning}>
              <Text style={s.modalSubmitText}>Log Earning</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orangeLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  streakText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 16, marginBottom: 12, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },
  hustleSelector: { marginBottom: 12, maxHeight: 40 },
  hustlePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  hustlePillActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  hustlePillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  hustlePillTextActive: { color: Colors.background },
  progressCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  progressPct: { fontSize: 18, fontWeight: '800', color: Colors.gold },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 4 },
  progressSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 6 },
  dayCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  dayCardDone: { borderColor: Colors.growthGreenText + '40' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayBadge: { backgroundColor: Colors.trustBlueLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  dayBadgeDone: { backgroundColor: Colors.growthGreenLight },
  dayNum: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  dayNumDone: { color: Colors.growthGreenText },
  dayTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.growthGreenText, borderColor: Colors.growthGreenText },
  taskText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  taskTextDone: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  // Earnings
  earningsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  earnCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  earnCardTotal: { width: '100%' },
  earnLabel: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  earnVal: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 14, borderRadius: 12, marginBottom: 16 },
  logBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },
  historyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  earnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.growthGreenText },
  earnInfo: { flex: 1 },
  earnDate: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  earnNote: { fontSize: 12, color: Colors.textTertiary },
  earnAmount: { fontSize: 16, fontWeight: '700', color: Colors.growthGreenText },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalField: { marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  modalInput: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.textPrimary },
  modalSubmit: { backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalSubmitText: { fontSize: 16, fontWeight: '700', color: Colors.background },
});
