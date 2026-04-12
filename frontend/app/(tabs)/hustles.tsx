import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function HustlesScreen() {
  const router = useRouter();
  const [hustles, setHustles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'starter' | 'premium'>('all');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const loadHustles = useCallback(async () => {
    try {
      const res = await api.getHustles();
      setHustles(res.hustles || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadHustles(); }, [loadHustles]);

  const filtered = hustles.filter(h => {
    if (filter === 'starter') return h.hustle_tier === 'starter' || !h.locked;
    if (filter === 'premium') return h.hustle_tier === 'premium' || h.locked;
    return true;
  });

  const handleHustlePress = (h: any) => {
    if (h.locked) {
      setShowUpgradeModal(true);
    } else {
      router.push(`/hustle/${h.hustle_id}`);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Side Hustles</Text>
        <Text style={styles.subtitle}>{hustles.filter(h => !h.locked).length} unlocked · {hustles.filter(h => h.locked).length} premium</Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'starter', 'premium'] as const).map(f => (
          <TouchableOpacity key={f} testID={`filter-${f}`}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'starter' ? 'Starter' : 'Premium'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHustles(); }} />}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}><Ionicons name="search" size={40} color={Colors.textTertiary} /><Text style={styles.emptyText}>No hustles found</Text></View>
        ) : filtered.map(h => (
          <TouchableOpacity key={h.hustle_id} testID={`hustle-item-${h.hustle_id}`}
            style={[styles.card, h.locked && styles.cardLocked]}
            onPress={() => handleHustlePress(h)} activeOpacity={0.7}>
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <View style={styles.badgeRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: h.locked ? Colors.surfaceHover : h.hustle_tier === 'premium' ? Colors.orangeLight : Colors.trustBlueLight }]}>
                    <Text style={[styles.categoryText, { color: h.locked ? Colors.textTertiary : h.hustle_tier === 'premium' ? Colors.orangeCTA : Colors.trustBlue }]}>
                      {h.hustle_tier === 'premium' ? 'HIGH REVENUE' : h.category}
                    </Text>
                  </View>
                  {h.locked && <Ionicons name="lock-closed" size={14} color={Colors.textTertiary} />}
                </View>
                <Text style={[styles.cardName, h.locked && styles.cardNameLocked]} numberOfLines={1}>
                  {h.locked ? '██████ ████████' : h.name}
                </Text>
              </View>
            </View>

            {/* Always show income potential - the hook */}
            <View style={styles.incomeRow}>
              <Ionicons name="trending-up" size={16} color={h.locked ? Colors.orangeCTA : Colors.growthGreen} />
              <Text style={[styles.incomeText, h.locked && styles.incomeTextPremium]}>{h.potential_income}</Text>
              {h.locked && <View style={styles.lockPill}><Text style={styles.lockPillText}>Unlock</Text></View>}
            </View>

            <Text style={[styles.cardDesc, h.locked && styles.cardDescLocked]} numberOfLines={2}>
              {h.locked ? 'This high-revenue opportunity matches your skills. Upgrade to see full details and get a business plan.' : h.description}
            </Text>

            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{h.time_required}</Text>
              </View>
              <View style={[styles.diffBadge, { backgroundColor: (h.difficulty === 'Easy' ? Colors.growthGreen : h.difficulty === 'Hard' ? Colors.orangeCTA : Colors.trustBlue) + '20' }]}>
                <Text style={[styles.diffText, { color: h.difficulty === 'Easy' ? Colors.growthGreen : h.difficulty === 'Hard' ? Colors.orangeCTA : Colors.trustBlue }]}>{h.difficulty}</Text>
              </View>
            </View>

            {/* Launch Kit Preview */}
            <View style={styles.kitPreview}>
              <View style={styles.kitPreviewHeader}>
                <Ionicons name="rocket" size={14} color={Colors.gold} />
                <Text style={styles.kitPreviewTitle}>Launch Kit Available</Text>
              </View>
              <View style={styles.kitPreviewItems}>
                {['Website', 'Social Posts', 'Pitch', 'Branding'].map((item, ki) => (
                  <View key={ki} style={styles.kitPreviewItem}>
                    <Ionicons name={ki === 0 ? 'globe-outline' : ki === 1 ? 'megaphone-outline' : ki === 2 ? 'mic-outline' : 'color-palette-outline'} size={10} color={Colors.textTertiary} />
                    <Text style={styles.kitPreviewItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Upgrade Modal */}
      <Modal visible={showUpgradeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity testID="close-upgrade-modal" style={styles.modalClose} onPress={() => setShowUpgradeModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.modalIconCircle}>
              <Ionicons name="diamond" size={28} color={Colors.orangeCTA} />
            </View>
            <Text style={styles.modalTitle}>Unlock Premium Hustles</Text>
            <Text style={styles.modalSubtitle}>
              Get access to high-revenue side hustles earning $1,000-$5,000+/week with detailed business plans and launch kits
            </Text>
            <TouchableOpacity testID="modal-upgrade-btn" style={styles.modalCTA}
              onPress={() => { setShowUpgradeModal(false); router.push('/pricing'); }}>
              <Text style={styles.modalCTAText}>View Plans & Pricing</Text>
            </TouchableOpacity>
            <Text style={styles.modalNote}>Starting at just $9.99/month</Text>
          </View>
        </View>
      </Modal>
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
  cardLocked: { borderColor: Colors.orangeCTA + '40', backgroundColor: Colors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardLeft: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardNameLocked: { color: Colors.textTertiary, letterSpacing: 2 },
  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  incomeText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreen },
  incomeTextPremium: { color: Colors.orangeCTA },
  lockPill: { backgroundColor: Colors.orangeCTA, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  lockPillText: { fontSize: 10, fontWeight: '700', color: Colors.textOnColor },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  cardDescLocked: { fontStyle: 'italic', color: Colors.textTertiary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' },
  diffText: { fontSize: 11, fontWeight: '700' },
  kitPreview: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  kitPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kitPreviewTitle: { fontSize: 12, fontWeight: '700', color: Colors.gold },
  kitPreviewItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kitPreviewItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kitPreviewItemText: { fontSize: 10, color: Colors.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center' },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 20 },
  modalCTA: { backgroundColor: Colors.orangeCTA, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  modalCTAText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  modalNote: { fontSize: 12, color: Colors.textTertiary, marginTop: 10 },
});
