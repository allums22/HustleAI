import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

/**
 * /settings-password
 *
 * Lets any signed-in user SET a password (if they're Google-only) or
 * CHANGE their password (if they already have one). After this,
 * they can sign in with EITHER Google OR email+password — no lock-in.
 */
export default function SettingsPasswordScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const me: any = await api.getMe();
        setHasPassword(!!me?.has_password);
      } catch {
        setHasPassword(false);
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [user, router]);

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (hasPassword && !currentPassword) {
      setError('Enter your current password to change it.');
      return;
    }
    setSubmitting(true);
    try {
      await api.setPassword(newPassword, hasPassword ? currentPassword : undefined);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser?.();
      setHasPassword(true);
      if (Platform.OS === 'web') {
        window.setTimeout(() => router.back(), 1600);
      } else {
        Alert.alert('Saved', 'Your password has been saved.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not save password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const title = hasPassword ? 'Change Password' : 'Set a Password';
  const subtitle = hasPassword
    ? 'Update your current password. You can still sign in with Google anytime.'
    : 'You currently sign in with Google. Set a password to enable email + password login as well.';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={24} color={Colors.gold} />
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {hasPassword && (
            <>
              <Text style={styles.label}>Current password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  testID="current-password-input"
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrent((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          <Text style={styles.label}>{hasPassword ? 'New password' : 'Password'}</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="new-password-input"
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showNew}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showNew ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm {hasPassword ? 'new password' : 'password'}</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="confirm-password-input"
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showNew}
              autoCapitalize="none"
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.urgentRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreenText} />
              <Text style={styles.successText}>
                Password saved. You can now sign in with email + password or with Google.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            testID="save-password-btn"
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>{hasPassword ? 'Update Password' : 'Save Password'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Your password is encrypted with bcrypt. We never store it in plain text.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F1708',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  subtitle: { fontSize: 13.5, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  label: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary, marginTop: 8, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#2A1515',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.urgentRedLight,
  },
  errorText: { flex: 1, fontSize: 13, color: '#FFB3B3', lineHeight: 19 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#0F1F15',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.growthGreen,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.growthGreenText, lineHeight: 19 },
  submitBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  submitText: { fontSize: 15, fontWeight: '900', color: '#000' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
