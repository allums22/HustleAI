import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

const difficultyColors: Record<string, string> = {
  Easy: Colors.growthGreen,
  Medium: Colors.trustBlue,
  Hard: Colors.orangeCTA,
};

export default function HustlesScreen() {
  const router = useRouter();
  const [hustles, setHustles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'selected' | 'available'>('all');

  const loadHustles = useCallback(async () => {
    try {
      const res = await api.getHustles();
      setHustles(res.hustles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadHustles(); }, [loadHustles]);

  const filtered = hustles.filter(h => {
    if (filter === 'selected') return h.selected;
    if (filter === 'available') return !h.selected;
    return true;
  });

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Side Hustles</Text>
        <Text style={styles.subtitle}>{hustles.length} total</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'selected', 'available'] as const).map(f => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}`}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'selected' ? 'Active' : 'Available'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHustles(); }} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No hustles found</Text>
          </View>
        ) : (
          filtered.map(h => (
            <TouchableOpacity
              key={h.hustle_id}
              testID={`hustle-item-${h.hustle_id}`}
              style={styles.card}
              onPress={() => router.push(`/hustle/${h.hustle_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={[styles.categoryBadge, { backgroundColor: h.selected ? Colors.growthGreenLight : Colors.trustBlueLight }]}>
                    <Text style={[styles.categoryText, { color: h.selected ? Colors.growthGreen : Colors.trustBlue }]}>{h.category}</Text>
                  </View>
                  <Text style={styles.cardName}>{h.name}</Text>
                </View>
                {h.selected && (
                  <View style={styles.activePill}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>{h.description}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="cash-outline" size={14} color={Colors.growthGreen} />
                  <Text style={styles.metaText}>{h.potential_income}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{h.time_required}</Text>
                </View>
                <View style={[styles.diffBadge, { backgroundColor: (difficultyColors[h.difficulty] || Colors.textSecondary) + '20' }]}>
                  <Text style={[styles.diffText, { color: difficultyColors[h.difficulty] || Colors.textSecondary }]}>{h.difficulty}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 16, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.trustBlue, borderColor: Colors.trustBlue },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.textOnColor },
  listContent: { paddingHorizontal: 24, paddingBottom: 24 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textTertiary },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1, gap: 6 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.growthGreenLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activePillText: { fontSize: 11, fontWeight: '600', color: Colors.growthGreen },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' },
  diffText: { fontSize: 11, fontWeight: '700' },
});
