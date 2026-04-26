import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput,
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
  const [filter, setFilter] = useState<'all' | 'researched' | 'starter' | 'premium'>('all');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [industryQuery, setIndustryQuery] = useState('');
  const [industryLoading, setIndustryLoading] = useState(false);

  const loadHustles = useCallback(async () => {
    try {
      const res = await api.getHustles();
      setHustles(res.hustles || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadHustles(); }, [loadHustles]);

  const filtered = hustles.filter(h => {
    if (filter === 'researched') return h.researched;
    if (filter === 'starter') return h.hustle_tier === 'starter';
    if (filter === 'premium') return h.hustle_tier === 'premium';
    return true;
  });

  const handleHustlePress = (h: any) => {
    if (h.locked) {
      setShowUpgradeModal(true);
    } else {
      router.push(`/hustle/${h.hustle_id}`);
    }
  };

  const handleIndustrySearch = async () => {
    if (!industryQuery.trim() || industryLoading) return;
    setIndustryLoading(true);
    try {
      const res = await api.generateIndustryHustles(industryQuery.trim());
      setIndustryQuery('');
      await loadHustles();
    } catch (e: any) {
      alert(e.message || 'Failed to generate');
    } finally {
      setIndustryLoading(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.trustBlue} /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Side Hustles</Text>
        <Text style={styles.subtitle}>{hustles.length} total · {hustles.filter(h => h.is_premium).length} premium · {hustles.filter(h => !h.is_premium).length} starter</Text>
      </View>

      {/* Industry Search */}
      <View style={styles.industryBar}>
        <TextInput
          style={styles.industryInput}
          placeholder="Request hustles in a specific industry..."
          placeholderTextColor={Colors.textTertiary}
          value={industryQuery}
          onChangeText={setIndustryQuery}
          onSubmitEditing={handleIndustrySearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.industryBtn, (!industryQuery.trim() || industryLoading) && { opacity: 0.5 }]}
          onPress={handleIndustrySearch}
          disabled={!industryQuery.trim() || industryLoading}
          activeOpacity={0.7}
        >
          {industryLoading ? <ActivityIndicator color="#000" size="small" /> : <Ionicons name="search" size={18} color="#000" />}
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'researched', 'starter', 'premium'] as const).map(f => (
          <TouchableOpacity key={f} testID={`filter-${f}`}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'researched' ? 'Explored' : f === 'starter' ? 'Starter' : 'Premium'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHustles(); }} />}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={filter === 'researched' ? 'rocket-outline' : 'search'} size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>
              {filter === 'researched'
                ? "You haven't explored any hustles yet."
                : 'No hustles found'}
            </Text>
            {filter === 'researched' && (
              <Text style={styles.emptyHint}>Tap "All" above, then tap any hustle card to dive in. Once you open a hustle, it'll appear here.</Text>
            )}
          </View>
        ) : (
          Object.entries(
            filtered.reduce((groups: Record<string, any[]>, h: any) => {
              const cat = h.category || 'General';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(h);
              return groups;
            }, {})
          ).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryHustles]) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categorySectionTitle}>{category}</Text>
              <Text style={styles.categorySectionCount}>{(categoryHustles as any[]).length} hustle{(categoryHustles as any[]).length !== 1 ? 's' : ''}</Text>
              {(categoryHustles as any[]).map((h: any) => (
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
            </View>
          ))
        )}
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
  header: { paddingHorizontal: 24, paddingTop: 16, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 8, marginBottom: 12, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  industryBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingVertical: 8, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  industryInput: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  industryBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  categorySection: { marginBottom: 20 },
  categorySectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: 24, marginBottom: 2 },
  categorySectionCount: { fontSize: 12, color: Colors.textTertiary, paddingHorizontal: 24, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.trustBlue, borderColor: Colors.trustBlue },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.textOnColor },
  listContent: { paddingHorizontal: 24, paddingBottom: 24, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textTertiary },
  emptyHint: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18, marginTop: 4 },
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
