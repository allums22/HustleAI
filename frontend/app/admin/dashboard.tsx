import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

type Funnel = any;

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await api.getAdminFunnel();
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={Colors.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={32} color={Colors.urgentRed} />
          <Text style={s.errText}>Sign in required</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.push('/login')}>
            <Text style={s.backBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={Colors.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={32} color={Colors.urgentRed} />
          <Text style={s.errText}>{error}</Text>
          <Text style={s.errSub}>Empire tier required to view this dashboard.</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { users, funnel, revenue, founders_seats, recent_transactions, email_queue, waitlist_count } = data;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.gold} />}
      >
        {/* REVENUE — biggest, top */}
        <Text style={s.section}>💰 Revenue</Text>
        <View style={s.row}>
          <Stat label="Total" value={`$${revenue.total.toFixed(2)}`} highlight />
          <Stat label="Today" value={`$${revenue.today.toFixed(2)}`} accent="green" />
        </View>
        <View style={s.row}>
          <Stat label="Last 7 days" value={`$${revenue.last_7d.toFixed(2)}`} />
          <Stat label="Last 30 days" value={`$${revenue.last_30d.toFixed(2)}`} />
        </View>
        <Text style={s.subLabel}>Transactions: {revenue.txn_total}</Text>

        {/* FOUNDERS SEATS */}
        <Text style={s.section}>🏆 Founders Lifetime</Text>
        <View style={s.bigCard}>
          <View style={s.foundersRow}>
            <Text style={s.foundersBig}>{founders_seats.sold}</Text>
            <Text style={s.foundersOf}>/ {founders_seats.limit} sold</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${(founders_seats.sold / founders_seats.limit) * 100}%` }]} />
          </View>
          <Text style={s.foundersHint}>
            {founders_seats.remaining} seats remaining · ${founders_seats.sold * 149} from Lifetime
          </Text>
        </View>

        {/* USERS */}
        <Text style={s.section}>👥 Users</Text>
        <View style={s.row}>
          <Stat label="All-time" value={users.total} />
          <Stat label="Today" value={users.today} accent="green" />
        </View>
        <View style={s.row}>
          <Stat label="Last 7d" value={users.last_7d} />
          <Stat label="Last 30d" value={users.last_30d} />
        </View>
        <View style={s.tierGrid}>
          {Object.entries(users.by_tier).map(([tier, count]) => (
            <View key={tier} style={s.tierChip}>
              <Text style={s.tierChipLabel}>{tier.toUpperCase()}</Text>
              <Text style={s.tierChipValue}>{count as number}</Text>
            </View>
          ))}
          {users.lifetime > 0 && (
            <View style={[s.tierChip, { backgroundColor: Colors.gold + '20', borderColor: Colors.gold + '60' }]}>
              <Text style={[s.tierChipLabel, { color: Colors.gold }]}>LIFETIME</Text>
              <Text style={[s.tierChipValue, { color: Colors.gold }]}>{users.lifetime}</Text>
            </View>
          )}
        </View>

        {/* FUNNEL */}
        <Text style={s.section}>🎯 Conversion Funnel</Text>
        <View style={s.funnelCard}>
          <FunnelStep label="Visitors" value={funnel.visitors} max={funnel.visitors} />
          <FunnelStep label="Signed up" value={funnel.signups} max={funnel.visitors} sub={`${funnel.signup_rate}% conv.`} />
          <FunnelStep label="Took questionnaire" value={funnel.questionnaire} max={funnel.signups} />
          <FunnelStep label="Got hustles" value={funnel.first_hustle} max={funnel.signups} />
          <FunnelStep label="Generated 1st plan" value={funnel.first_plan} max={funnel.signups} />
          <FunnelStep label="🟢 Paid" value={funnel.paid} max={funnel.signups} sub={`${funnel.paid_rate}% paid rate`} highlight />
        </View>

        {/* REVENUE BY PLAN */}
        {Object.keys(revenue.by_plan).length > 0 && (
          <>
            <Text style={s.section}>📊 Revenue by Plan</Text>
            <View style={s.bigCard}>
              {Object.entries(revenue.by_plan).map(([plan, amt]) => (
                <View key={plan} style={s.planRow}>
                  <Text style={s.planName}>{plan}</Text>
                  <Text style={s.planCount}>×{revenue.txn_count_by_plan[plan] || 0}</Text>
                  <Text style={s.planAmt}>${(amt as number).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* RECENT TRANSACTIONS */}
        <Text style={s.section}>🧾 Recent Transactions</Text>
        {recent_transactions.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No transactions yet. Send some traffic!</Text>
          </View>
        ) : (
          <View style={s.bigCard}>
            {recent_transactions.map((t: any, i: number) => (
              <View key={i} style={s.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txnUser}>{t.user_name} · {t.user_email}</Text>
                  <Text style={s.txnPlan}>{t.plan} {t.billing ? `(${t.billing})` : ''}</Text>
                  <Text style={s.txnAt}>{t.at?.slice(0, 16).replace('T', ' ')}</Text>
                </View>
                <Text style={s.txnAmt}>${Number(t.amount).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* EMAIL + WAITLIST */}
        <Text style={s.section}>📧 Email & Waitlist</Text>
        <View style={s.row}>
          <Stat label="Sent" value={email_queue.sent} accent="green" />
          <Stat label="Pending" value={email_queue.pending} />
          <Stat label="Failed" value={email_queue.failed} accent={email_queue.failed > 0 ? 'red' : undefined} />
        </View>
        <Stat label="Waitlist" value={waitlist_count} />

        <Text style={s.asOf}>Last updated: {new Date(data.as_of).toLocaleString()}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight, accent }: { label: string; value: any; highlight?: boolean; accent?: 'green' | 'red' }) {
  let valColor: string = Colors.textPrimary;
  if (accent === 'green') valColor = Colors.growthGreen;
  if (accent === 'red') valColor = Colors.urgentRed;
  if (highlight) valColor = Colors.gold;
  return (
    <View style={[s.stat, highlight && s.statHighlight]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: valColor }]}>{value}</Text>
    </View>
  );
}

function FunnelStep({ label, value, max, sub, highlight }: { label: string; value: number; max: number; sub?: string; highlight?: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={s.funnelStep}>
      <View style={s.funnelHead}>
        <Text style={[s.funnelLabel, highlight && { color: Colors.gold, fontWeight: '900' as const }]}>{label}</Text>
        <Text style={[s.funnelValue, highlight && { color: Colors.gold }]}>{value}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%` }, highlight && { backgroundColor: Colors.gold }]} />
      </View>
      {sub ? <Text style={s.funnelSub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  errSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { backgroundColor: Colors.surface, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 10 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },

  scroll: { padding: 16, maxWidth: 720, alignSelf: 'center', width: '100%' },
  section: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary, marginTop: 22, marginBottom: 10, letterSpacing: -0.3 },
  subLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600', marginTop: -4, marginBottom: 4 },

  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  statHighlight: { backgroundColor: Colors.surfaceElevated, borderColor: Colors.gold + '50' },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },

  bigCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },

  foundersRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  foundersBig: { fontSize: 36, fontWeight: '900', color: Colors.gold, letterSpacing: -1 },
  foundersOf: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  foundersHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontWeight: '600' },

  tierGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8, marginTop: 4 },
  tierChip: { backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierChipLabel: { fontSize: 10, fontWeight: '900', color: Colors.textTertiary, letterSpacing: 1 },
  tierChipValue: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary },

  funnelCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  funnelStep: { gap: 4 },
  funnelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  funnelLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  funnelValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '800' },
  funnelSub: { fontSize: 11, color: Colors.textTertiary, fontWeight: '700' },

  barTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 999, overflow: 'hidden' as const, marginTop: 6 },
  barFill: { height: 6, backgroundColor: Colors.trustBlue, borderRadius: 999 },

  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  planName: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' as const },
  planCount: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, marginRight: 12 },
  planAmt: { fontSize: 15, fontWeight: '900', color: Colors.growthGreen },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' as const },
  emptyText: { fontSize: 13, color: Colors.textTertiary },

  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  txnUser: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700' },
  txnPlan: { fontSize: 11, color: Colors.gold, fontWeight: '700', textTransform: 'capitalize' as const },
  txnAt: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  txnAmt: { fontSize: 16, fontWeight: '900', color: Colors.growthGreen },

  asOf: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', marginTop: 24, fontStyle: 'italic' as const },
});
