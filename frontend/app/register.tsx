import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const { beta } = useLocalSearchParams<{ beta?: string }>();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.register(email.trim(), password, name.trim());
      await login(res.session_token, res.user);
      // Auto-redeem beta promo code if coming from beta invite
      if (beta) {
        try { await api.redeemPromo(beta); } catch {}
      }
      router.replace('/welcome');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start discovering your perfect side hustle</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.urgentRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  testID="register-name-input"
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  testID="register-email-input"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />
                <TextInput
                  testID="register-password-input"
                  style={styles.input}
                  placeholder="Min 6 characters"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              testID="register-submit-btn"
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textOnColor} />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {Platform.OS === 'web' && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.divLine} />
                  <Text style={styles.divText}>OR</Text>
                  <View style={styles.divLine} />
                </View>
                <TouchableOpacity
                  testID="google-signin-btn"
                  style={styles.googleBtn}
                  onPress={() => {
                    if (typeof window !== 'undefined') {
                      const redirectUrl = encodeURIComponent(window.location.origin + '/auth-callback');
                      window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 480, alignSelf: 'center', width: '100%' },
  backBtn: { marginTop: 8, marginBottom: 16, width: 44, height: 44, justifyContent: 'center' },
  headerSection: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.urgentRedLight, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: Colors.urgentRed, flex: 1 },
  form: { gap: 20 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  submitBtn: { backgroundColor: Colors.orangeCTA, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: Colors.trustBlue },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 1.2 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, borderRadius: 12, marginTop: 14 },
  googleBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
});
