import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { Colors } from '../src/colors';

export default function NDAScreen() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!agreed) return;
    setLoading(true);
    try {
      await api.acceptNda();
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      alert('Failed to accept. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Ionicons name="shield-checkmark" size={32} color={Colors.gold} />
          <Text style={s.title}>Non-Disclosure Agreement</Text>
          <Text style={s.subtitle}>Beta Program Confidentiality</Text>
        </View>

        <View style={s.ndaBox}>
          <Text style={s.ndaText}>
            By accessing the HustleAI Beta Program, you agree to the following terms:
          </Text>

          <View style={s.clause}>
            <Text style={s.clauseNum}>1.</Text>
            <Text style={s.clauseText}><Text style={s.bold}>Confidentiality.</Text> You agree to keep all features, designs, functionality, and content of the HustleAI platform confidential. You shall not share screenshots, recordings, or detailed descriptions of the application with any third party without prior written consent from nexus28.</Text>
          </View>

          <View style={s.clause}>
            <Text style={s.clauseNum}>2.</Text>
            <Text style={s.clauseText}><Text style={s.bold}>Feedback.</Text> Any feedback, suggestions, or ideas you provide during the beta period may be used by nexus28 to improve the platform without any obligation of compensation or attribution.</Text>
          </View>

          <View style={s.clause}>
            <Text style={s.clauseNum}>3.</Text>
            <Text style={s.clauseText}><Text style={s.bold}>No Reproduction.</Text> You shall not copy, reverse engineer, or recreate any part of the HustleAI platform, its AI models, templates, or business logic.</Text>
          </View>

          <View style={s.clause}>
            <Text style={s.clauseNum}>4.</Text>
            <Text style={s.clauseText}><Text style={s.bold}>Beta Access.</Text> Your Empire-level access is granted solely for testing purposes during the beta period. Access may be revoked at any time at the discretion of nexus28.</Text>
          </View>

          <View style={s.clause}>
            <Text style={s.clauseNum}>5.</Text>
            <Text style={s.clauseText}><Text style={s.bold}>Duration.</Text> This agreement remains in effect for 2 years from the date of acceptance, regardless of whether you continue to use the platform.</Text>
          </View>
        </View>

        <TouchableOpacity style={s.checkRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
          <View style={[s.checkbox, agreed && s.checkboxChecked]}>
            {agreed && <Ionicons name="checkmark" size={16} color="#000" />}
          </View>
          <Text style={s.checkLabel}>I have read and agree to the terms of this Non-Disclosure Agreement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.acceptBtn, !agreed && s.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!agreed || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={18} color="#000" />
              <Text style={s.acceptBtnText}>Accept & Continue</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', gap: 8, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textTertiary },
  ndaBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, gap: 16 },
  ndaText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  clause: { flexDirection: 'row', gap: 10 },
  clauseNum: { fontSize: 14, fontWeight: '800', color: Colors.gold, minWidth: 20 },
  clauseText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  bold: { fontWeight: '700', color: Colors.textPrimary },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 24, paddingHorizontal: 4 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 18, borderRadius: 14, marginTop: 20 },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
