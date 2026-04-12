import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

export default function AuthCallback() {
  const { login } = useAuth();
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        let sessionId = '';
        if (Platform.OS === 'web') {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) sessionId = match[1];
        }
        if (!sessionId) {
          router.replace('/');
          return;
        }
        const res = await api.exchangeSession(sessionId);
        await login(res.session_token, res.user);
        if (res.user.questionnaire_completed) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/questionnaire');
        }
      } catch (e) {
        console.error('Auth callback error:', e);
        router.replace('/');
      }
    };
    processAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.trustBlue} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 16 },
  text: { fontSize: 16, color: Colors.textSecondary },
});
