import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Share, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const [p, a] = await Promise.all([api.getProfile(), api.getAchievements().catch(() => ({ achievements: [] }))]);
      setProfile(p);
      setAchievements(a.achievements || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        logout().then(() => router.replace('/'));
      }
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); }},
      ]);
    }
  };

  const handleShareReferral = async () => {
    const code = profile?.stats?.referral_code || '';
    const url = Platform.OS === 'web' ? `${window.location.origin}/register?ref=${code}` : `https://hustleai.com/register?ref=${code}`;
    const msg = `Join me on HustleAI! Get your first business plan FREE. Use my referral code: ${code}\n${url}`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  };

  const handleCopyCode = async () => {
    const code = profile?.stats?.referral_code || '';
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(code);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await api.redeemPromo(promoCode.trim());
      setPromoResult({ type: 'success', msg: res.message });
      setPromoCode('');
      await refreshUser();
      loadProfile();
    } catch (e: any) {
      setPromoResult({ type: 'error', msg: e.message || 'Invalid promo code' });
    } finally {
      setPromoLoading(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;

  const tier = profile?.subscription?.tier || 'free';
  const tierName = profile?.subscription?.name || 'Free';
  const tierColors: Record<string, string> = { free: Colors.trustBlue, starter: Colors.growthGreen, pro: Colors.trustBlue, empire: Colors.orangeCTA };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: tierColors[tier] || Colors.trustBlue }]}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.subCard}>
          <View style={styles.subHeader}>
            <View>
              <Text style={styles.subLabel}>Current Plan</Text>
              <Text style={styles.subTier}>{tierName}</Text>
            </View>
            <View style={[styles.tierIcon, { backgroundColor: tierColors[tier] || Colors.trustBlue }]}>
              <Ionicons name={tier === 'empire' ? 'trophy' : tier === 'pro' ? 'diamond' : tier === 'starter' ? 'star' : 'flash'} size={20} color={Colors.textOnColor} />
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{profile?.stats?.total_hustles || 0}</Text>
              <Text style={styles.statLbl}>Hustles</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{profile?.stats?.plans_generated || 0}</Text>
              <Text style={styles.statLbl}>Plans</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{profile?.stats?.kits_generated || 0}</Text>
              <Text style={styles.statLbl}>Kits</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{tier === 'empire' || tier === 'pro' ? '∞' : profile?.stats?.remaining_plans ?? 0}</Text>
              <Text style={styles.statLbl}>Plans Left</Text>
            </View>
          </View>
          {tier !== 'empire' && (
            <TouchableOpacity testID="upgrade-plan-btn" style={styles.upgradeBtn} onPress={() => router.push('/pricing')}>
              <Ionicons name="arrow-up-circle" size={18} color={Colors.textOnColor} />
              <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Referral Section */}
        <View style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Ionicons name="gift" size={22} color={Colors.orangeCTA} />
            <Text style={styles.referralTitle}>Refer & Earn</Text>
          </View>
          <Text style={styles.referralDesc}>
            Share your code. Friends get a free business plan. You get $5 credit per referral!
          </Text>
          <View style={styles.codeRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{profile?.stats?.referral_code || '...'}</Text>
            </View>
            <TouchableOpacity testID="copy-code-btn" style={styles.copyBtn} onPress={handleCopyCode}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={Colors.textOnColor} />
            </TouchableOpacity>
          </View>
          <View style={styles.referralStats}>
            <View style={styles.refStatItem}>
              <Text style={styles.refStatNum}>{profile?.stats?.referral_count || 0}</Text>
              <Text style={styles.refStatLbl}>Referrals</Text>
            </View>
            <View style={styles.refStatItem}>
              <Text style={styles.refStatNum}>${(profile?.stats?.referral_credits || 0).toFixed(2)}</Text>
              <Text style={styles.refStatLbl}>Credits</Text>
            </View>
          </View>
          <TouchableOpacity testID="share-referral-btn" style={styles.shareBtn} onPress={handleShareReferral}>
            <Ionicons name="share-social" size={18} color={Colors.trustBlue} />
            <Text style={styles.shareBtnText}>Share Referral Link</Text>
          </TouchableOpacity>
        </View>

        {/* Achievements */}
        {achievements.length > 0 && (
          <View style={styles.achCard}>
            <View style={styles.achHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trophy" size={20} color={Colors.gold} />
                <Text style={styles.achTitle}>Achievements</Text>
              </View>
              <Text style={styles.achCount}>
                {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </Text>
            </View>
            <View style={styles.achGrid}>
              {achievements.map((a) => (
                <View key={a.id} style={[styles.achBadge, a.unlocked ? styles.achBadgeUnlocked : styles.achBadgeLocked]}>
                  <View style={[styles.achIconWrap, a.unlocked ? styles.achIconWrapUnlocked : styles.achIconWrapLocked]}>
                    <Ionicons name={a.unlocked ? (a.icon as any) : 'lock-closed'} size={20} color={a.unlocked ? Colors.gold : Colors.textTertiary} />
                  </View>
                  <Text style={[styles.achName, !a.unlocked && { color: Colors.textTertiary }]} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.achDesc} numberOfLines={2}>{a.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          <TouchableOpacity testID="retake-quiz-btn" style={styles.menuItem} onPress={() => router.push('/questionnaire')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.trustBlueLight }]}><Ionicons name="create-outline" size={18} color={Colors.trustBlue} /></View>
            <Text style={styles.menuText}>Retake Assessment</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity testID="pricing-menu-btn" style={styles.menuItem} onPress={() => router.push('/pricing')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.orangeLight }]}><Ionicons name="pricetag-outline" size={18} color={Colors.orangeCTA} /></View>
            <Text style={styles.menuText}>Pricing Plans</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Beta Promo Code */}
        <View style={styles.promoCard}>
          <View style={styles.promoHeader}>
            <View style={styles.promoBetaBadge}>
              <Text style={styles.promoBetaText}>BETA</Text>
            </View>
            <Text style={styles.promoTitle}>Have a Promo Code?</Text>
          </View>
          <Text style={styles.promoDesc}>Enter your beta access code to unlock all premium features</Text>
          <View style={styles.promoInputRow}>
            <TextInput
              testID="promo-code-input"
              style={styles.promoInput}
              placeholder="Enter code..."
              placeholderTextColor={Colors.textTertiary}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleRedeemPromo}
            />
            <TouchableOpacity
              testID="promo-redeem-btn"
              style={[styles.promoRedeemBtn, (!promoCode.trim() || promoLoading) && { opacity: 0.5 }]}
              onPress={handleRedeemPromo}
              disabled={!promoCode.trim() || promoLoading}
              activeOpacity={0.7}
            >
              {promoLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.promoRedeemText}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>
          {promoResult && (
            <View style={[styles.promoResultBox, promoResult.type === 'success' ? styles.promoSuccess : styles.promoError]}>
              <Ionicons name={promoResult.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={16} color={promoResult.type === 'success' ? Colors.growthGreenText : Colors.urgentRed} />
              <Text style={[styles.promoResultText, promoResult.type === 'success' ? { color: Colors.growthGreenText } : { color: Colors.urgentRed }]}>{promoResult.msg}</Text>
            </View>
          )}
        </View>

        {/* Beta Feedback */}
        <TouchableOpacity style={styles.feedbackBtn} onPress={() => router.push('/feedback')} activeOpacity={0.7}>
          <View style={styles.feedbackIcon}>
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.feedbackTitle}>Beta Feedback</Text>
            <Text style={styles.feedbackSub}>Share your experience & suggestions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

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
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 800, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.textOnColor },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  subCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, gap: 14 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase' },
  subTier: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  tierIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLbl: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  statDiv: { width: 1, height: 28, backgroundColor: Colors.border },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.orangeCTA, paddingVertical: 14, borderRadius: 12 },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  referralCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.orangeCTA + '40', marginBottom: 16 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  referralTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  referralDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  codeBox: { flex: 1, backgroundColor: Colors.background, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  codeText: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 3 },
  copyBtn: { width: 48, borderRadius: 10, backgroundColor: Colors.trustBlue, justifyContent: 'center', alignItems: 'center' },
  referralStats: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  refStatItem: { flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 10, alignItems: 'center' },
  refStatNum: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  refStatLbl: { fontSize: 11, color: Colors.textSecondary },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.trustBlue },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: Colors.trustBlue },
  menuSection: { gap: 4, marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.urgentRedLight },
  logoutText: { fontSize: 15, fontWeight: '600', color: Colors.urgentRed },
  // Promo Code
  promoCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1.5, borderColor: Colors.gold + '30', marginBottom: 24, borderStyle: 'dashed' as any },
  promoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  promoBetaBadge: { backgroundColor: Colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  promoBetaText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 1 },
  promoTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  promoDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 14 },
  promoInputRow: { flexDirection: 'row', gap: 10 },
  promoInput: { flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 2, textTransform: 'uppercase' as any },
  promoRedeemBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  promoRedeemText: { fontSize: 15, fontWeight: '700', color: '#000' },
  promoResultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10 },
  promoSuccess: { backgroundColor: Colors.growthGreenLight },
  promoError: { backgroundColor: Colors.urgentRedLight },
  promoResultText: { fontSize: 13, fontWeight: '600', flex: 1 },
  // Feedback
  feedbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.gold + '30', marginBottom: 16 },
  feedbackIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  feedbackTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  feedbackSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  // Achievements
  achCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  achHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  achTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  achCount: { fontSize: 13, fontWeight: '700', color: Colors.gold, backgroundColor: Colors.orangeLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achBadge: { width: '31.5%', padding: 10, borderRadius: 10, alignItems: 'center', gap: 4 },
  achBadgeUnlocked: { backgroundColor: Colors.orangeLight, borderWidth: 1, borderColor: Colors.gold + '50' },
  achBadgeLocked: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, opacity: 0.6 },
  achIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  achIconWrapUnlocked: { backgroundColor: Colors.gold + '20' },
  achIconWrapLocked: { backgroundColor: Colors.surface },
  achName: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  achDesc: { fontSize: 9, color: Colors.textTertiary, textAlign: 'center', lineHeight: 12 },
});
