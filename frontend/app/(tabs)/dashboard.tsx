import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Share,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [hustles, setHustles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [motivation, setMotivation] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [earningsSummary, setEarningsSummary] = useState<any>(null);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [todayHustleId, setTodayHustleId] = useState<string>('');
  const [liveActivity, setLiveActivity] = useState<any[]>([]);
  const [first100, setFirst100] = useState<any>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinFeeling, setCheckinFeeling] = useState<string>('');
  const [checkinBlocker, setCheckinBlocker] = useState<string>('');
  const [checkinResponse, setCheckinResponse] = useState<string>('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [scorecardId, setScorecardId] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, hustlesRes] = await Promise.all([
        api.getProfile(),
        api.getHustles(),
      ]);
      setProfile(profileRes);
      setHustles(hustlesRes.hustles || []);
      // NDA gate removed for commercial launch — paying customers shouldn't see legal interstitial.
      // /nda route still exists for manual beta tester onboarding if needed.
      // If no hustles, user hasn't completed questionnaire — send to welcome
      if ((hustlesRes.hustles || []).length === 0) {
        router.replace('/welcome');
        return;
      }
      // Load motivation, streak, earnings
      try {
        const [motRes, streakRes, earnRes] = await Promise.all([
          api.getDailyMotivation(), api.getStreak(), api.getEarningsSummary(),
        ]);
        setMotivation(motRes);
        setStreak(streakRes);
        setEarningsSummary(earnRes);
      } catch {}
      // Load breakout features: live activity, first-100 challenge, check-in status, scorecard
      try {
        const [liveRes, f100Res, checkinRes, scRes] = await Promise.all([
          api.getLiveActivity().catch(() => ({ activities: [] })),
          api.getFirst100().catch(() => null),
          api.getTodayCheckin().catch(() => ({ checked_in: true })),
          api.getMyScorecard().catch(() => ({ scorecard: null })),
        ]);
        setLiveActivity(liveRes.activities || []);
        setFirst100(f100Res);
        // Auto-prompt check-in once per day — but ONLY for users with at least 1 day of activity.
        // First-time/empty-state users should see the dashboard, not a feelings modal.
        const userIsActive = (hustlesRes.hustles || []).some((h: any) => h.researched || h.selected);
        if (!checkinRes.checked_in && userIsActive) {
          setTimeout(() => setShowCheckin(true), 1500);
        }
        setScorecardId(scRes?.scorecard?.scorecard_id || '');
      } catch {}
      // Load today's top 3 incomplete tasks from first selected hustle with a plan
      try {
        const firstActive = (hustlesRes.hustles || []).find((h: any) => h.selected && h.business_plan_generated);
        if (firstActive) {
          setTodayHustleId(firstActive.hustle_id);
          const [planRes, progRes] = await Promise.all([
            api.getPlan(firstActive.hustle_id),
            api.getTaskProgress(firstActive.hustle_id),
          ]);
          const completedKeys: string[] = progRes?.completed_keys || [];
          const all: any[] = [];
          (planRes?.plan?.daily_tasks || []).forEach((d: any) => {
            (d.tasks || []).forEach((t: string, ti: number) => {
              const key = `${firstActive.hustle_id}_${d.day}_${ti}`;
              if (!completedKeys.includes(key)) {
                all.push({ day: d.day, taskIndex: ti, text: t, dayTitle: d.title, key });
              }
            });
          });
          setTodayTasks(all.slice(0, 3));
        } else {
          setTodayTasks([]);
        }
      } catch {}
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleQuickToggleTask = async (task: any) => {
    try {
      await api.completeTask(todayHustleId, task.day, task.taskIndex, true);
      setTodayTasks(prev => prev.filter(t => t.key !== task.key));
      // Refresh streak + motivation
      const [streakRes, motRes] = await Promise.all([api.getStreak(), api.getDailyMotivation()]);
      setStreak(streakRes); setMotivation(motRes);
    } catch (e) { console.error(e); }
  };

  const handleSubmitCheckin = async (feeling: string) => {
    setCheckinLoading(true);
    setCheckinFeeling(feeling);
    try {
      const res = await api.dailyCheckin({ feeling, blocker: checkinBlocker });
      setCheckinResponse(res.response || "Keep going! You've got this. 💪");
    } catch (e: any) {
      setCheckinResponse("You've got this! Even 15 minutes today moves you forward. 💪");
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleShareScorecard = async () => {
    try {
      let scId = scorecardId;
      if (!scId) {
        const res = await api.generateScorecard();
        scId = res.scorecard_id;
        setScorecardId(scId);
      }
      const origin = Platform.OS === 'web' ? window.location.origin : 'https://hustleai.live';
      const url = `${origin}/s/${scId}`;
      const msg = `Check out my HustleAI archetype! 🚀 Take the 2-min quiz and find yours:\n${url}`;
      if (Platform.OS === 'web') {
        if ((navigator as any).share) {
          await (navigator as any).share({ title: 'My HustleAI Scorecard', text: msg, url });
        } else {
          await navigator.clipboard.writeText(msg);
          alert('Share link copied to clipboard!');
        }
      } else {
        await Share.share({ message: msg, url });
      }
    } catch (e: any) {
      alert(e.message || 'Could not generate scorecard. Complete the questionnaire first.');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data when tab gets focused (e.g., after promo redemption)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      await api.generateHustles();
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.trustBlue} />
      </View>
    );
  }

  const selectedHustles = hustles.filter(h => h.selected);
  const tier = profile?.subscription?.tier || 'free';
  const tierName = profile?.subscription?.name || 'Free';
  const remainingPlans = profile?.stats?.remaining_plans ?? 0;
  const trialUsed = profile?.stats?.trial_used ?? false;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.trustBlue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.subGreeting}>Let's build your empire</Text>
          </View>
          <TouchableOpacity
            testID="upgrade-badge"
            style={[styles.tierBadge, (tier === 'pro' || tier === 'empire') && styles.proBadge]}
            onPress={() => router.push('/pricing')}
          >
            <Ionicons name={tier === 'empire' ? 'diamond' : tier === 'pro' ? 'diamond' : tier === 'starter' ? 'star' : 'flash'} size={14} color={tier === 'free' ? Colors.trustBlue : Colors.textOnColor} />
            <Text style={[styles.tierText, tier !== 'free' && styles.tierTextPro]}>{tierName}</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Motivation Banner */}
        {motivation && (
          <View style={styles.motivationBanner}>
            <View style={styles.motivationLeft}>
              <Ionicons name="flame" size={24} color={Colors.gold} />
              {streak && streak.current_streak > 0 && (
                <View style={styles.streakPill}><Text style={styles.streakNum}>{streak.current_streak}</Text><Text style={styles.streakLabel}>day streak</Text></View>
              )}
            </View>
            <View style={styles.motivationContent}>
              <Text style={styles.motivationText}>{motivation.message}</Text>
              <TouchableOpacity testID="motivation-action" style={styles.motivationBtn} onPress={() => router.push('/(tabs)/progress')}>
                <Text style={styles.motivationBtnText}>Start Today's Tasks</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.background} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 🎯 First $100 Challenge */}
        {first100 && !first100.completed && (
          <View style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeEmoji}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeTitle}>First $100 Challenge</Text>
                <Text style={styles.challengeSub}>{first100.message}</Text>
              </View>
              <View style={styles.challengeDaysPill}>
                <Text style={styles.challengeDays}>{first100.days_remaining}d</Text>
                <Text style={styles.challengeDaysLabel}>left</Text>
              </View>
            </View>
            <View style={styles.challengeBar}>
              <View style={[styles.challengeFill, { width: `${first100.percent}%` }]} />
            </View>
            <View style={styles.challengeFooter}>
              <Text style={styles.challengeAmount}>${first100.current.toFixed(0)} / $100</Text>
              <TouchableOpacity testID="log-win-btn" onPress={() => router.push('/(tabs)/progress')}>
                <Text style={styles.challengeLogLink}>Log a Win →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {first100?.completed && (
          <View style={styles.challengeDoneCard}>
            <Text style={styles.challengeEmoji}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeDoneTitle}>First $100 Unlocked!</Text>
              <Text style={styles.challengeDoneSub}>${first100.current.toFixed(0)} earned in {first100.days_in} days — you're officially a hustler.</Text>
            </View>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: Colors.trustBlueLight }]} onPress={() => router.push('/(tabs)/hustles')} activeOpacity={0.7}>
            <Text style={[styles.statNumber, { color: Colors.trustBlue }]}>{hustles.length}</Text>
            <Text style={styles.statLabel}>Total Hustles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: Colors.growthGreenLight }]} onPress={() => router.push('/plans')} activeOpacity={0.7}>
            <Text style={[styles.statNumber, { color: Colors.growthGreen }]}>{profile?.stats?.plans_generated || 0}</Text>
            <Text style={styles.statLabel}>Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: Colors.orangeLight }]} onPress={() => router.push('/pricing')} activeOpacity={0.7}>
            <Text style={[styles.statNumber, { color: Colors.orangeCTA }]}>
              {tier === 'pro' || tier === 'empire' ? '∞' : remainingPlans}
            </Text>
            <Text style={styles.statLabel}>{tier === 'empire' ? 'Unlimited' : tier === 'pro' ? 'Unlimited' : tier === 'free' && !trialUsed ? 'Free Trial' : 'Remaining'}</Text>
          </TouchableOpacity>
        </View>

        {/* Earnings Snapshot */}
        {earningsSummary && (earningsSummary.total > 0 || earningsSummary.count > 0) && (
          <TouchableOpacity
            testID="earnings-snapshot"
            style={styles.earningsCard}
            onPress={() => router.push('/(tabs)/progress')}
            activeOpacity={0.85}
          >
            <View style={styles.earningsHeader}>
              <View style={styles.earningsIconBox}>
                <Ionicons name="trending-up" size={20} color={Colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningsLabel}>Total Earned</Text>
                <Text style={styles.earningsTotal}>${(earningsSummary.total || 0).toFixed(2)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </View>
            <View style={styles.earningsRow}>
              <View style={styles.earningsCell}>
                <Text style={styles.earningsCellValue}>${(earningsSummary.today || 0).toFixed(0)}</Text>
                <Text style={styles.earningsCellLabel}>Today</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsCell}>
                <Text style={styles.earningsCellValue}>${(earningsSummary.this_week || 0).toFixed(0)}</Text>
                <Text style={styles.earningsCellLabel}>This Week</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsCell}>
                <Text style={styles.earningsCellValue}>${(earningsSummary.this_month || 0).toFixed(0)}</Text>
                <Text style={styles.earningsCellLabel}>This Month</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Tasks Preview */}
        {todayTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkbox" size={20} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Today's Tasks</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/progress')}>
                <Text style={styles.seeAll}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tasksCard}>
              {todayTasks.map((task, idx) => (
                <TouchableOpacity
                  key={task.key}
                  testID={`dash-task-${idx}`}
                  style={[styles.taskRow, idx > 0 && styles.taskRowBorder]}
                  onPress={() => handleQuickToggleTask(task)}
                  activeOpacity={0.6}
                >
                  <View style={styles.taskCheckbox} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskText} numberOfLines={2}>{task.text}</Text>
                    <Text style={styles.taskMeta}>Day {task.day} · {task.dayTitle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID="generate-more-btn"
              style={[styles.actionCard, generating && styles.btnDisabled]}
              onPress={handleGenerateMore}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={Colors.trustBlue} />
              ) : (
                <View style={[styles.actionIcon, { backgroundColor: Colors.trustBlueLight }]}>
                  <Ionicons name="sparkles" size={22} color={Colors.trustBlue} />
                </View>
              )}
              <Text style={styles.actionText}>Generate More</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="new-niche-btn"
              style={styles.actionCard}
              onPress={() => router.push('/questionnaire')}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.orangeLight }]}>
                <Ionicons name="refresh" size={22} color={Colors.gold} />
              </View>
              <Text style={styles.actionText}>New Niche</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="view-hustles-btn"
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/hustles')}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.growthGreenLight }]}>
                <Ionicons name="list" size={22} color={Colors.growthGreen} />
              </View>
              <Text style={styles.actionText}>View Hustles</Text>
            </TouchableOpacity>
          </View>

          {/* Explore New Niche Banner */}
          <TouchableOpacity
            testID="explore-niche-banner"
            style={styles.nicheBanner}
            onPress={() => router.push('/questionnaire')}
            activeOpacity={0.8}
          >
            <View style={styles.nicheIcon}>
              <Ionicons name="compass" size={22} color={Colors.gold} />
            </View>
            <View style={styles.nicheContent}>
              <Text style={styles.nicheTitle}>Explore a Different Niche</Text>
              <Text style={styles.nicheDesc}>Retake the assessment to discover hustles in a new area</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={Colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Recent Hustles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Side Hustles</Text>
            {hustles.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/hustles')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {hustles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="rocket-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No hustles yet</Text>
              <Text style={styles.emptyDesc}>Generate your first side hustle recommendations!</Text>
              <TouchableOpacity testID="empty-generate-btn" style={styles.emptyBtn} onPress={handleGenerateMore}>
                <Text style={styles.emptyBtnText}>Generate Hustles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            [...hustles]
              .sort((a, b) => {
                // Recently explored first, then most recently generated
                const aTime = a.researched_at || a.created_at || '';
                const bTime = b.researched_at || b.created_at || '';
                return bTime.localeCompare(aTime);
              })
              .slice(0, 3)
              .map((h) => (
              <TouchableOpacity
                key={h.hustle_id}
                testID={`hustle-card-${h.hustle_id}`}
                style={styles.hustleCard}
                onPress={() => router.push(`/hustle/${h.hustle_id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.hustleCardHeader}>
                  <View style={[styles.categoryBadge, { backgroundColor: h.selected ? Colors.growthGreenLight : Colors.trustBlueLight }]}>
                    <Text style={[styles.categoryText, { color: h.selected ? Colors.growthGreen : Colors.trustBlue }]}>{h.category}</Text>
                  </View>
                  {h.researched && (
                    <View style={styles.exploredPill}>
                      <Ionicons name="eye" size={11} color={Colors.gold} />
                      <Text style={styles.exploredPillText}>Explored</Text>
                    </View>
                  )}
                  {h.selected && <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreen} />}
                </View>
                <Text style={styles.hustleName}>{h.name}</Text>
                <Text style={styles.hustleDesc} numberOfLines={2}>{h.description}</Text>
                <View style={styles.hustleFooter}>
                  <View style={styles.hustleStat}>
                    <Ionicons name="cash-outline" size={14} color={Colors.growthGreen} />
                    <Text style={styles.hustleStatText}>{h.potential_income}</Text>
                  </View>
                  <View style={styles.hustleStat}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.hustleStatText}>{h.time_required}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* 🔴 Live Activity Feed — Social Proof */}
        {liveActivity.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.livePulse} />
                <Text style={styles.sectionTitle}>Live Activity</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/community')}>
                <Text style={styles.seeAll}>Community →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.liveCard}>
              {liveActivity.slice(0, 5).map((a, i) => (
                <View key={i} style={[styles.liveRow, i > 0 && styles.liveRowBorder]}>
                  <Text style={styles.liveEmoji}>{a.emoji}</Text>
                  <Text style={styles.liveText} numberOfLines={2}>{a.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 📲 Share Scorecard CTA */}
        <TouchableOpacity testID="share-scorecard-dashboard" style={styles.scorecardBanner} onPress={handleShareScorecard} activeOpacity={0.85}>
          <View style={styles.scorecardIconBox}>
            <Text style={{ fontSize: 28 }}>🎯</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scorecardTitle}>Share Your Hustle Archetype</Text>
            <Text style={styles.scorecardDesc}>Show friends what HustleAI discovered about you</Text>
          </View>
          <Ionicons name="share-social" size={22} color={Colors.gold} />
        </TouchableOpacity>

        {/* Upgrade CTA */}
        {tier === 'free' && (
          <TouchableOpacity
            testID="upgrade-cta"
            style={styles.upgradeBanner}
            onPress={() => router.push('/pricing')}
            activeOpacity={0.8}
          >
            <View style={styles.upgradeContent}>
              <Text style={styles.upgradeTitle}>Unlock More Hustles</Text>
              <Text style={styles.upgradeDesc}>Upgrade to access up to 10 or unlimited side hustles with full business plans</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color={Colors.textOnColor} />
          </TouchableOpacity>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 🤖 Daily AI Check-In Modal */}
      <Modal visible={showCheckin} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.checkinCard}>
            <TouchableOpacity testID="checkin-close" style={styles.checkinClose} onPress={() => setShowCheckin(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            {!checkinResponse ? (
              <>
                <Text style={styles.checkinEmoji}>☀️</Text>
                <Text style={styles.checkinTitle}>Quick Check-In</Text>
                <Text style={styles.checkinSub}>How are you feeling about today?</Text>
                <View style={styles.feelingGrid}>
                  {[
                    { key: 'great', emoji: '🔥', label: 'Fired up' },
                    { key: 'good', emoji: '😊', label: 'Ready' },
                    { key: 'stuck', emoji: '😤', label: 'Stuck' },
                    { key: 'overwhelmed', emoji: '😮‍💨', label: 'Overwhelmed' },
                  ].map(f => (
                    <TouchableOpacity
                      key={f.key}
                      testID={`feeling-${f.key}`}
                      style={[styles.feelingBtn, checkinFeeling === f.key && styles.feelingBtnActive]}
                      onPress={() => handleSubmitCheckin(f.key)}
                      disabled={checkinLoading}
                    >
                      <Text style={styles.feelingEmoji}>{f.emoji}</Text>
                      <Text style={styles.feelingLabel}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {checkinLoading && <ActivityIndicator color={Colors.gold} style={{ marginTop: 16 }} />}
              </>
            ) : (
              <>
                <Text style={styles.checkinEmoji}>🤖</Text>
                <Text style={styles.checkinTitle}>Your Coach Says</Text>
                <Text style={styles.checkinResponse}>{checkinResponse}</Text>
                <TouchableOpacity testID="checkin-done-btn" style={styles.checkinDoneBtn} onPress={() => { setShowCheckin(false); setCheckinResponse(''); setCheckinFeeling(''); }}>
                  <Text style={styles.checkinDoneText}>Let's go 🚀</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subGreeting: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.trustBlueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  proBadge: { backgroundColor: Colors.trustBlue },
  tierText: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  tierTextPro: { color: Colors.textOnColor },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: 24, marginTop: 24, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: '600', color: Colors.trustBlue },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.orangeCTA, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textOnColor },
  hustleCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  hustleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  exploredPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.orangeLight, marginLeft: 'auto' as const },
  exploredPillText: { fontSize: 10, fontWeight: '800', color: Colors.gold, letterSpacing: 0.4 },
  hustleName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  hustleDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  hustleFooter: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  hustleStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hustleStatText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  upgradeBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 24, backgroundColor: Colors.orangeCTA, borderRadius: 14, padding: 18, gap: 12, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  upgradeContent: { flex: 1 },
  upgradeTitle: { fontSize: 17, fontWeight: '700', color: Colors.textOnColor },
  upgradeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 16 },
  btnDisabled: { opacity: 0.5 },
  nicheBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: Colors.gold + '40', marginTop: 12 },
  motivationBanner: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 12, backgroundColor: Colors.orangeLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.gold + '30', maxWidth: 1000, alignSelf: 'center', width: '100%' },
  motivationLeft: { alignItems: 'center', gap: 4 },
  streakPill: { alignItems: 'center' },
  streakNum: { fontSize: 18, fontWeight: '800', color: Colors.gold },
  streakLabel: { fontSize: 9, color: Colors.gold, fontWeight: '600' },
  motivationContent: { flex: 1, gap: 8 },
  motivationText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  motivationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.gold, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  motivationBtnText: { fontSize: 13, fontWeight: '700', color: Colors.background },
  nicheIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  nicheContent: { flex: 1 },
  nicheTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  nicheDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  // Earnings snapshot
  earningsCard: { marginHorizontal: 24, marginTop: 16, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.gold + '40', maxWidth: 1000, alignSelf: 'center', width: '100%' },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  earningsIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  earningsLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  earningsTotal: { fontSize: 24, fontWeight: '800', color: Colors.gold, marginTop: 2 },
  earningsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 12 },
  earningsCell: { flex: 1, alignItems: 'center' },
  earningsCellValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  earningsCellLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  earningsDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  // Today's tasks preview
  tasksCard: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  taskRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  taskCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.gold, marginTop: 2 },
  taskText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  taskMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 3, fontWeight: '500' },
  // First $100 Challenge
  challengeCard: { marginHorizontal: 24, marginTop: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: Colors.gold + '60', maxWidth: 1000, alignSelf: 'center', width: '100%' },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  challengeEmoji: { fontSize: 28 },
  challengeTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  challengeSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  challengeDaysPill: { alignItems: 'center', backgroundColor: Colors.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  challengeDays: { fontSize: 16, fontWeight: '900', color: Colors.background },
  challengeDaysLabel: { fontSize: 8, fontWeight: '700', color: Colors.background, textTransform: 'uppercase' },
  challengeBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  challengeFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 4 },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeAmount: { fontSize: 13, fontWeight: '800', color: Colors.gold },
  challengeLogLink: { fontSize: 13, fontWeight: '700', color: Colors.trustBlue },
  challengeDoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, marginTop: 12, backgroundColor: Colors.growthGreenLight, borderRadius: 14, padding: 16, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  challengeDoneTitle: { fontSize: 15, fontWeight: '800', color: Colors.growthGreenText },
  challengeDoneSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  // Live Activity
  livePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  liveCard: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  liveRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  liveEmoji: { fontSize: 18 },
  liveText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '500', lineHeight: 18 },
  // Scorecard Share Banner
  scorecardBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, marginTop: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.gold + '50', maxWidth: 1000, alignSelf: 'center', width: '100%' },
  scorecardIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  scorecardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  scorecardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  // Check-in Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  checkinCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  checkinClose: { position: 'absolute', top: 12, right: 12, padding: 6, zIndex: 10 },
  checkinEmoji: { fontSize: 48, marginBottom: 8 },
  checkinTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  checkinSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  feelingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', justifyContent: 'center' },
  feelingBtn: { width: '46%', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, gap: 6 },
  feelingBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.orangeLight },
  feelingEmoji: { fontSize: 28 },
  feelingLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  checkinResponse: { fontSize: 15, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8, marginBottom: 20 },
  checkinDoneBtn: { backgroundColor: Colors.gold, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center' },
  checkinDoneText: { fontSize: 15, fontWeight: '800', color: Colors.background },
});
