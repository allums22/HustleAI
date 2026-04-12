import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
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

  const loadData = useCallback(async () => {
    try {
      const [profileRes, hustlesRes] = await Promise.all([
        api.getProfile(),
        api.getHustles(),
      ]);
      setProfile(profileRes);
      setHustles(hustlesRes.hustles || []);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
            style={[styles.tierBadge, tier === 'pro' && styles.proBadge]}
            onPress={() => router.push('/pricing')}
          >
            <Ionicons name={tier === 'pro' ? 'diamond' : tier === 'starter' ? 'star' : 'flash'} size={14} color={tier === 'free' ? Colors.trustBlue : Colors.textOnColor} />
            <Text style={[styles.tierText, tier !== 'free' && styles.tierTextPro]}>{tierName}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.trustBlueLight }]}>
            <Text style={[styles.statNumber, { color: Colors.trustBlue }]}>{hustles.length}</Text>
            <Text style={styles.statLabel}>Total Hustles</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.growthGreenLight }]}>
            <Text style={[styles.statNumber, { color: Colors.growthGreen }]}>{profile?.stats?.plans_generated || 0}</Text>
            <Text style={styles.statLabel}>Plans</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.orangeLight }]}>
            <Text style={[styles.statNumber, { color: Colors.orangeCTA }]}>
              {tier === 'pro' ? '∞' : remainingPlans}
            </Text>
            <Text style={styles.statLabel}>{tier === 'free' && !trialUsed ? 'Free Trial' : 'Remaining'}</Text>
          </View>
        </View>

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
            hustles.slice(0, 3).map((h) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subGreeting: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.trustBlueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  proBadge: { backgroundColor: Colors.trustBlue },
  tierText: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  tierTextPro: { color: Colors.textOnColor },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: 24, marginTop: 24 },
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
  hustleName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  hustleDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  hustleFooter: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  hustleStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hustleStatText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  upgradeBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 24, backgroundColor: Colors.orangeCTA, borderRadius: 14, padding: 18, gap: 12 },
  upgradeContent: { flex: 1 },
  upgradeTitle: { fontSize: 17, fontWeight: '700', color: Colors.textOnColor },
  upgradeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 16 },
  btnDisabled: { opacity: 0.5 },
  nicheBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: Colors.gold + '40', marginTop: 12 },
  nicheIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  nicheContent: { flex: 1 },
  nicheTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  nicheDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
