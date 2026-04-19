import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={s.iconCircle}>
            <Ionicons name="rocket" size={36} color={Colors.gold} />
          </View>
          <Text style={s.greeting}>Welcome, {firstName}!</Text>
          <Text style={s.headline}>Your Side Hustle{'\n'}Journey Starts Now</Text>
          <Text style={s.sub}>
            In just 2 minutes, our AI will analyze your skills, goals, and schedule to find the perfect side hustles for you.
          </Text>
        </View>

        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>Here's what happens next:</Text>

          <View style={s.step}>
            <View style={[s.stepDot, { backgroundColor: '#E5A93E' }]}>
              <Text style={s.stepNum}>1</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Quick Assessment</Text>
              <Text style={s.stepDesc}>Answer a few questions about your skills, availability, and income goals</Text>
            </View>
          </View>

          <View style={s.stepLine} />

          <View style={s.step}>
            <View style={[s.stepDot, { backgroundColor: '#14B8A6' }]}>
              <Text style={s.stepNum}>2</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>AI Finds Your Hustles</Text>
              <Text style={s.stepDesc}>Get 12 personalized side hustle recommendations ranked by income potential</Text>
            </View>
          </View>

          <View style={s.stepLine} />

          <View style={s.step}>
            <View style={[s.stepDot, { backgroundColor: '#EC4899' }]}>
              <Text style={s.stepNum}>3</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Launch & Grow</Text>
              <Text style={s.stepDesc}>Get business plans, landing pages, and your personal AI agent team</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.ctaBtn} onPress={() => router.replace('/questionnaire')} activeOpacity={0.85}>
          <Text style={s.ctaBtnText}>Start My Assessment</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>

        <Text style={s.timeNote}>Takes about 2 minutes</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 16, fontWeight: '600', color: Colors.gold, marginBottom: 8 },
  headline: { fontSize: 30, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -1, lineHeight: 34, marginBottom: 14 },
  sub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  stepsCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: Colors.border, marginVertical: 20 },
  stepsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  step: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  stepDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 14, fontWeight: '800', color: '#000' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: Colors.textTertiary, lineHeight: 18 },
  stepLine: { width: 2, height: 20, backgroundColor: Colors.border, marginLeft: 15, marginVertical: 4 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.gold, paddingVertical: 18, borderRadius: 14, marginTop: 8 },
  ctaBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  timeNote: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', marginTop: 12 },
});
