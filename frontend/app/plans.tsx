import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { Colors } from '../src/colors';

export default function PlansListScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const res = await api.getPlansList();
      setPlans(res.plans || []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.gold} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Business Plans</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {plans.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No Plans Yet</Text>
            <Text style={s.emptySub}>Generate a business plan from any hustle to see it here</Text>
          </View>
        ) : (
          <View style={s.list}>
            <Text style={s.countText}>{plans.length} plan{plans.length !== 1 ? 's' : ''} generated</Text>
            {plans.map((plan, i) => (
              <TouchableOpacity
                key={plan.plan_id || i}
                style={s.planCard}
                onPress={() => router.push(`/hustle/${plan.hustle_id}`)}
                activeOpacity={0.7}
              >
                <View style={s.planIcon}>
                  <Ionicons name="document-text" size={22} color={Colors.trustBlue} />
                </View>
                <View style={s.planContent}>
                  <Text style={s.planTitle} numberOfLines={2}>{plan.title}</Text>
                  <Text style={s.planHustle} numberOfLines={1}>{plan.hustle_name}</Text>
                  <View style={s.planMeta}>
                    <View style={s.planCatBadge}>
                      <Text style={s.planCatText}>{plan.hustle_category}</Text>
                    </View>
                    {plan.created_at && (
                      <Text style={s.planDate}>{new Date(plan.created_at).toLocaleDateString()}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },
  list: { gap: 12 },
  countText: { fontSize: 13, color: Colors.textTertiary, marginBottom: 4 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  planIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.trustBlueLight, justifyContent: 'center', alignItems: 'center' },
  planContent: { flex: 1, gap: 4 },
  planTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  planHustle: { fontSize: 13, color: Colors.gold },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  planCatBadge: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  planCatText: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase' },
  planDate: { fontSize: 11, color: Colors.textTertiary },
});
