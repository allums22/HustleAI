import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { Colors } from '../src/colors';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: 'chatbubble-ellipses' },
  { key: 'bug', label: 'Bug Report', icon: 'bug' },
  { key: 'feature', label: 'Feature Request', icon: 'bulb' },
  { key: 'design', label: 'Design/UX', icon: 'color-palette' },
  { key: 'agents', label: 'AI Agents', icon: 'sparkles' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await api.getFeedback();
      setHistory(res.feedbacks || []);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({ category, rating, message: message.trim() });
      setSubmitted(true);
      setMessage('');
      loadHistory();
      setTimeout(() => setSubmitted(false), 3000);
    } catch { alert('Failed to submit. Try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Beta Feedback</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {submitted && (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.growthGreenText} />
            <Text style={s.successText}>Thank you! Your feedback has been submitted.</Text>
          </View>
        )}

        {/* New Feedback */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Share Your Experience</Text>
          <Text style={s.cardSub}>Your feedback directly shapes HustleAI</Text>

          {/* Category */}
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c.key} style={[s.catChip, category === c.key && s.catChipActive]} onPress={() => setCategory(c.key)} activeOpacity={0.7}>
                <Ionicons name={c.icon as any} size={14} color={category === c.key ? '#000' : Colors.textSecondary} />
                <Text style={[s.catChipText, category === c.key && s.catChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Rating */}
          <Text style={s.label}>Rating</Text>
          <View style={s.ratingRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? Colors.gold : Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Message */}
          <Text style={s.label}>Your Feedback</Text>
          <TextInput
            style={s.textarea}
            placeholder="Tell us what you think — what worked, what didn't, and what you'd love to see..."
            placeholderTextColor={Colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity style={[s.submitBtn, (!message.trim() || submitting) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!message.trim() || submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#000" /> : (
              <><Ionicons name="send" size={16} color="#000" /><Text style={s.submitBtnText}>Submit Feedback</Text></>
            )}
          </TouchableOpacity>
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Your Previous Feedback</Text>
            {history.map((fb, i) => (
              <View key={i} style={s.historyCard}>
                <View style={s.historyHeader}>
                  <View style={s.historyCatBadge}><Text style={s.historyCatText}>{fb.category}</Text></View>
                  <View style={s.historyStars}>
                    {[1,2,3,4,5].map(n => <Ionicons key={n} name={n <= fb.rating ? 'star' : 'star-outline'} size={12} color={n <= fb.rating ? Colors.gold : Colors.textTertiary} />)}
                  </View>
                </View>
                <Text style={s.historyMsg}>{fb.message}</Text>
                <Text style={s.historyDate}>{new Date(fb.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.growthGreenLight, padding: 14, borderRadius: 12, marginBottom: 16 },
  successText: { fontSize: 14, fontWeight: '600', color: Colors.growthGreenText },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  cardSub: { fontSize: 13, color: Colors.textTertiary, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  catScroll: { marginBottom: 4 },
  catRow: { gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated },
  catChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  catChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catChipTextActive: { color: '#000' },
  ratingRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  textarea: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, fontSize: 15, color: Colors.textPrimary, minHeight: 120, lineHeight: 22 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12, marginTop: 20 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  historySection: { marginTop: 28, gap: 12 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  historyCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyCatBadge: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  historyCatText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase' },
  historyStars: { flexDirection: 'row', gap: 2 },
  historyMsg: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  historyDate: { fontSize: 11, color: Colors.textTertiary },
});
