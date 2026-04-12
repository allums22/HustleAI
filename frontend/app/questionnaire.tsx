import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

interface Question {
  id: string;
  question: string;
  type: string;
  options: string[];
}

export default function QuestionnaireScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [additionalSkills, setAdditionalSkills] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  // Total steps = questions + skills/resume step
  const totalSteps = questions.length + 1;
  const isLastQuestion = currentStep === questions.length - 1;
  const isSkillsStep = currentStep === questions.length;

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const res = await api.getQuestions();
      setQuestions(res.questions);
    } catch (e: any) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (questionId: string, value: string, type: string) => {
    if (type === 'multi_select') {
      const current = answers[questionId] || [];
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [questionId]: updated });
    } else {
      setAnswers({ ...answers, [questionId]: value });
    }
  };

  const canProceed = () => {
    if (isSkillsStep) return true;
    const q = questions[currentStep];
    if (!q) return false;
    const answer = answers[q.id];
    if (q.type === 'multi_select') return answer && answer.length > 0;
    return !!answer;
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.submitQuestionnaire({
        answers,
        additional_skills: additionalSkills || null,
        resume_text: resumeText || null,
      });
      setGenerating(true);
      await api.generateHustles();
      await refreshUser();
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setGenerating(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.trustBlue} />
      </View>
    );
  }

  if (generating) {
    return (
      <View style={styles.generatingContainer}>
        <View style={styles.generatingContent}>
          <ActivityIndicator size="large" color={Colors.trustBlue} />
          <Text style={styles.generatingTitle}>Analyzing Your Profile</Text>
          <Text style={styles.generatingSubtitle}>
            Our AI is crafting personalized side hustle recommendations just for you...
          </Text>
          <View style={styles.generatingSteps}>
            {['Analyzing skills & interests', 'Matching with opportunities', 'Generating recommendations'].map((s, i) => (
              <View key={i} style={styles.genStepRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.growthGreen} />
                <Text style={styles.genStepText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentStep + 1} / {totalSteps}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!isSkillsStep && questions[currentStep] ? (
            <View style={styles.questionContainer}>
              <Text style={styles.questionLabel}>
                {questions[currentStep].type === 'multi_select' ? 'Select all that apply' : 'Choose one'}
              </Text>
              <Text style={styles.questionText}>{questions[currentStep].question}</Text>

              <View style={styles.optionsGrid}>
                {questions[currentStep].options.map((opt, i) => {
                  const qId = questions[currentStep].id;
                  const isSelected = questions[currentStep].type === 'multi_select'
                    ? (answers[qId] || []).includes(opt)
                    : answers[qId] === opt;

                  return (
                    <TouchableOpacity
                      key={i}
                      testID={`option-${qId}-${i}`}
                      style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
                      onPress={() => handleSelect(qId, opt, questions[currentStep].type)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionCheck, isSelected && styles.optionCheckSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={Colors.textOnColor} />}
                      </View>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.questionContainer}>
              <Text style={styles.questionLabel}>Optional</Text>
              <Text style={styles.questionText}>Add more about yourself</Text>
              <Text style={styles.helperText}>
                These details help our AI give you better recommendations, but they're completely optional.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Additional Skills</Text>
                <TextInput
                  testID="additional-skills-input"
                  style={styles.textArea}
                  placeholder="e.g., SEO, Canva, copywriting, video editing..."
                  placeholderTextColor={Colors.textTertiary}
                  value={additionalSkills}
                  onChangeText={setAdditionalSkills}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Resume / Experience Summary</Text>
                <TextInput
                  testID="resume-text-input"
                  style={[styles.textArea, { minHeight: 120 }]}
                  placeholder="Paste your resume text or describe your work experience..."
                  placeholderTextColor={Colors.textTertiary}
                  value={resumeText}
                  onChangeText={setResumeText}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navBar}>
          {currentStep > 0 ? (
            <TouchableOpacity testID="questionnaire-back-btn" style={styles.navBackBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
              <Text style={styles.navBackText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {isSkillsStep ? (
            <TouchableOpacity
              testID="questionnaire-submit-btn"
              style={[styles.navNextBtn, styles.submitBtnStyle, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textOnColor} size="small" />
              ) : (
                <>
                  <Text style={styles.navNextText}>Generate My Hustles</Text>
                  <Ionicons name="sparkles" size={18} color={Colors.textOnColor} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="questionnaire-next-btn"
              style={[styles.navNextBtn, !canProceed() && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text style={styles.navNextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnColor} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  generatingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 32 },
  generatingContent: { alignItems: 'center', gap: 16 },
  generatingTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  generatingSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  generatingSteps: { gap: 10, marginTop: 16 },
  genStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  genStepText: { fontSize: 14, color: Colors.textPrimary },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3 },
  progressFill: { height: '100%', backgroundColor: Colors.growthGreen, borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  errorBox: { backgroundColor: Colors.urgentRedLight, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: Colors.urgentRed },
  questionContainer: { gap: 12 },
  questionLabel: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue, textTransform: 'uppercase', letterSpacing: 1 },
  questionText: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, lineHeight: 32 },
  helperText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  optionsGrid: { gap: 10, marginTop: 8 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 16 },
  optionBtnSelected: { borderColor: Colors.trustBlue, backgroundColor: Colors.trustBlueLight },
  optionCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  optionCheckSelected: { backgroundColor: Colors.trustBlue, borderColor: Colors.trustBlue },
  optionText: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { fontWeight: '600', color: Colors.trustBlue },
  inputSection: { gap: 6, marginTop: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  textArea: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, minHeight: 80 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  navBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
  navBackText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  navNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.trustBlue, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  navNextText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  submitBtnStyle: { backgroundColor: Colors.orangeCTA },
  btnDisabled: { opacity: 0.5 },
});
