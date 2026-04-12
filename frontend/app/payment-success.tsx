import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

export default function PaymentSuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'polling' | 'success' | 'failed'>('polling');
  const [planName, setPlanName] = useState('');
  const pollCount = useRef(0);

  useEffect(() => {
    if (session_id) {
      pollStatus();
    } else {
      setStatus('failed');
    }
  }, [session_id]);

  const pollStatus = async () => {
    if (pollCount.current >= 10) {
      setStatus('failed');
      return;
    }
    pollCount.current += 1;
    try {
      const res = await api.getPaymentStatus(session_id!);
      setPlanName(res.plan || '');
      if (res.payment_status === 'paid') {
        setStatus('success');
        await refreshUser();
        return;
      }
      if (res.status === 'expired') {
        setStatus('failed');
        return;
      }
      setTimeout(pollStatus, 2000);
    } catch {
      setTimeout(pollStatus, 2000);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {status === 'polling' && (
          <>
            <ActivityIndicator size="large" color={Colors.trustBlue} />
            <Text style={styles.title}>Processing Payment...</Text>
            <Text style={styles.subtitle}>Please wait while we confirm your payment</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.growthGreen} />
            </View>
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.subtitle}>
              You've been upgraded to the {planName.charAt(0).toUpperCase() + planName.slice(1)} plan
            </Text>
            <TouchableOpacity
              testID="go-dashboard-btn"
              style={styles.ctaBtn}
              onPress={() => router.replace('/(tabs)/dashboard')}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaBtnText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'failed' && (
          <>
            <View style={styles.failIcon}>
              <Ionicons name="close-circle" size={64} color={Colors.urgentRed} />
            </View>
            <Text style={styles.title}>Payment Issue</Text>
            <Text style={styles.subtitle}>
              We couldn't confirm your payment. Please try again or contact support.
            </Text>
            <TouchableOpacity
              testID="retry-payment-btn"
              style={styles.ctaBtn}
              onPress={() => router.replace('/pricing')}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaBtnText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  successIcon: { marginBottom: 8 },
  failIcon: { marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  ctaBtn: { backgroundColor: Colors.trustBlue, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, marginTop: 16 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
});
