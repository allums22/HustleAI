import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.getProfile();
      setProfile(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/');
      }},
    ]);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;
  }

  const tier = profile?.subscription?.tier || 'free';
  const tierName = profile?.subscription?.name || 'Free';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Subscription Card */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subHeader}>
            <View>
              <Text style={styles.subLabel}>Current Plan</Text>
              <Text style={styles.subTier}>{tierName}</Text>
            </View>
            <View style={[styles.tierIcon, tier === 'pro' ? styles.tierIconPro : tier === 'starter' ? styles.tierIconStarter : styles.tierIconFree]}>
              <Ionicons
                name={tier === 'pro' ? 'diamond' : tier === 'starter' ? 'star' : 'flash'}
                size={20}
                color={Colors.textOnColor}
              />
            </View>
          </View>

          <View style={styles.subStats}>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatNum}>{profile?.stats?.total_hustles || 0}</Text>
              <Text style={styles.subStatLabel}>Generated</Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStatItem}>
              <Text style={styles.subStatNum}>{profile?.stats?.selected_hustles || 0}</Text>
              <Text style={styles.subStatLabel}>Active</Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStatItem}>
              <Text style={styles.subStatNum}>{profile?.stats?.remaining || 0}</Text>
              <Text style={styles.subStatLabel}>Remaining</Text>
            </View>
          </View>

          {tier !== 'pro' && (
            <TouchableOpacity
              testID="upgrade-plan-btn"
              style={styles.upgradeBtn}
              onPress={() => router.push('/pricing')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle" size={18} color={Colors.textOnColor} />
              <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity testID="retake-quiz-btn" style={styles.menuItem} onPress={() => router.push('/questionnaire')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.trustBlueLight }]}>
              <Ionicons name="create-outline" size={18} color={Colors.trustBlue} />
            </View>
            <Text style={styles.menuText}>Retake Assessment</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity testID="pricing-menu-btn" style={styles.menuItem} onPress={() => router.push('/pricing')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="pricetag-outline" size={18} color={Colors.orangeCTA} />
            </View>
            <Text style={styles.menuText}>Pricing Plans</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.urgentRed} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, paddingTop: 16, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.trustBlue, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.textOnColor },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  subscriptionCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, gap: 14 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  subTier: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  tierIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tierIconFree: { backgroundColor: Colors.trustBlue },
  tierIconStarter: { backgroundColor: Colors.growthGreen },
  tierIconPro: { backgroundColor: Colors.orangeCTA },
  subStats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  subStatItem: { flex: 1, alignItems: 'center' },
  subStatNum: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subStatLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  subStatDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.orangeCTA, paddingVertical: 14, borderRadius: 12 },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  menuSection: { gap: 4, marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.urgentRedLight },
  logoutText: { fontSize: 15, fontWeight: '600', color: Colors.urgentRed },
});
