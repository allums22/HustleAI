import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

const tierColors: Record<string, string> = { free: Colors.textTertiary, starter: Colors.trustBlue, pro: Colors.growthGreenText, empire: Colors.gold };

export default function CommunityScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [content, setContent] = useState('');
  const [milestone, setMilestone] = useState('');
  const [amount, setAmount] = useState('');

  const loadPosts = useCallback(async () => {
    try { const res = await api.getCommunityPosts(); setPosts(res.posts || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadPosts(); }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      await api.createPost({ content: content.trim(), milestone, amount: amount ? parseFloat(amount) : undefined });
      setShowPostModal(false); setContent(''); setMilestone(''); setAmount('');
      loadPosts();
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const handleReact = async (postId: string) => {
    try {
      await api.reactToPost(postId);
      setPosts(prev => prev.map(p => {
        if (p.post_id !== postId) return p;
        const reacted = (p.reacted_by || []).includes(user?.user_id);
        return { ...p, reactions: p.reactions + (reacted ? -1 : 1),
          reacted_by: reacted ? p.reacted_by.filter((id: string) => id !== user?.user_id) : [...(p.reacted_by || []), user?.user_id] };
      }));
    } catch {}
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={Colors.gold} /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View><Text style={s.title}>Community</Text><Text style={s.subtitle}>Share wins, inspire others</Text></View>
        <TouchableOpacity testID="new-post-btn" style={s.newPostBtn} onPress={() => setShowPostModal(true)}>
          <Ionicons name="add" size={20} color={Colors.background} />
          <Text style={s.newPostBtnText}>Share Win</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} />}>
        {posts.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>Be the first to share!</Text>
            <Text style={s.emptyText}>Post your side hustle wins, milestones, and tips</Text>
            <TouchableOpacity style={s.emptyCTA} onPress={() => setShowPostModal(true)}>
              <Text style={s.emptyCTAText}>Share Your First Win</Text>
            </TouchableOpacity>
          </View>
        ) : posts.map(p => {
          const isReacted = (p.reacted_by || []).includes(user?.user_id);
          return (
            <View key={p.post_id} style={s.postCard}>
              <View style={s.postHeader}>
                <View style={[s.postAvatar, { backgroundColor: tierColors[p.author_tier] || Colors.textTertiary }]}>
                  <Text style={s.postAvatarText}>{(p.author_name || '?')[0]}</Text>
                </View>
                <View style={s.postAuthorInfo}>
                  <Text style={s.postAuthorName}>{p.author_name}</Text>
                  <View style={s.postMeta}>
                    <View style={[s.tierPill, { backgroundColor: (tierColors[p.author_tier] || Colors.textTertiary) + '20' }]}>
                      <Text style={[s.tierPillText, { color: tierColors[p.author_tier] || Colors.textTertiary }]}>{p.author_tier}</Text>
                    </View>
                    <Text style={s.postTime}>{new Date(p.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
              </View>

              {p.amount && (
                <View style={s.amountBadge}>
                  <Ionicons name="cash" size={14} color={Colors.growthGreenText} />
                  <Text style={s.amountText}>${p.amount.toFixed(2)} earned</Text>
                </View>
              )}
              {p.milestone && <View style={s.milestoneBadge}><Ionicons name="trophy" size={12} color={Colors.gold} /><Text style={s.milestoneText}>{p.milestone}</Text></View>}

              <Text style={s.postContent}>{p.content}</Text>

              <TouchableOpacity testID={`react-${p.post_id}`} style={[s.reactBtn, isReacted && s.reactBtnActive]} onPress={() => handleReact(p.post_id)}>
                <Ionicons name={isReacted ? 'heart' : 'heart-outline'} size={18} color={isReacted ? Colors.urgentRed : Colors.textTertiary} />
                <Text style={[s.reactCount, isReacted && s.reactCountActive]}>{p.reactions || 0}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* New Post Modal */}
      <Modal visible={showPostModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}><Text style={s.modalTitle}>Share a Win</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity></View>

            <View style={s.milestoneRow}>
              {['First $100', 'First Client', 'First Sale', '7-Day Streak', 'Plan Complete'].map(m => (
                <TouchableOpacity key={m} style={[s.milestoneChip, milestone === m && s.milestoneChipActive]} onPress={() => setMilestone(milestone === m ? '' : m)}>
                  <Text style={[s.milestoneChipText, milestone === m && s.milestoneChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput testID="post-content" style={s.postInput} placeholder="What's your win? Share your hustle journey..." placeholderTextColor={Colors.textTertiary}
              value={content} onChangeText={setContent} multiline numberOfLines={4} textAlignVertical="top" />
            <TextInput testID="post-amount" style={s.amountInput} placeholder="Amount earned (optional)" placeholderTextColor={Colors.textTertiary}
              value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TouchableOpacity testID="submit-post" style={[s.submitBtn, !content.trim() && s.submitBtnDisabled]} onPress={handlePost} disabled={!content.trim()}>
              <Text style={s.submitBtnText}>Post to Community</Text>
            </TouchableOpacity>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  newPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.gold, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  newPostBtnText: { fontSize: 13, fontWeight: '700', color: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },
  emptyCTA: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  emptyCTAText: { fontSize: 14, fontWeight: '700', color: Colors.background },
  postCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  postHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  postAuthorInfo: { flex: 1 },
  postAuthorName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  tierPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tierPillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  postTime: { fontSize: 11, color: Colors.textTertiary },
  amountBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.growthGreenLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  amountText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreenText },
  milestoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orangeLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  milestoneText: { fontSize: 11, fontWeight: '700', color: Colors.gold },
  postContent: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  reactBtnActive: {},
  reactCount: { fontSize: 14, fontWeight: '600', color: Colors.textTertiary },
  reactCountActive: { color: Colors.urgentRed },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  milestoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  milestoneChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  milestoneChipActive: { backgroundColor: Colors.orangeLight, borderColor: Colors.gold },
  milestoneChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  milestoneChipTextActive: { color: Colors.gold },
  postInput: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, minHeight: 100, marginBottom: 12 },
  amountInput: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 16 },
  submitBtn: { backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.background },
});
