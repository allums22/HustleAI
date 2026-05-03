import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/colors';

/**
 * /auth-callback — Handles the redirect from Emergent Google Auth.
 *
 * Emergent redirects to: https://hustleai.live/auth-callback#session_id=xxxx
 * We read the fragment, exchange it via GET /api/auth/session, store the
 * session_token, and redirect the user into the app.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export default function AuthCallback() {
  const { login } = useAuth();
  const router = useRouter();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        if (Platform.OS !== 'web') {
          setStatus('error');
          setErrorMsg('Google sign-in is available only in the web app.');
          return;
        }

        // Extract session_id from URL fragment (Emergent sends it there)
        let sessionId = '';
        const hash = window.location.hash || '';
        const m = hash.match(/session_id=([^&]+)/);
        if (m) sessionId = decodeURIComponent(m[1]);

        // Defensive: also check ?session_id= in query string
        if (!sessionId) {
          const q = new URLSearchParams(window.location.search || '');
          sessionId = q.get('session_id') || '';
        }

        if (!sessionId) {
          setStatus('error');
          setErrorMsg('No session ID returned from Google. Please try signing in again.');
          return;
        }

        // Use RELATIVE URL so Vercel's /api/* rewrite handles the proxy reliably on production
        // (avoids CORS issues when calling the preview URL directly from the browser)
        console.log('[auth-callback] exchanging session_id for session_token');
        const res = await fetch(
          `/api/auth/session?session_id=${encodeURIComponent(sessionId)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!res.ok) {
          const text = await res.text();
          let detail = `Sign-in failed (HTTP ${res.status}).`;
          try { detail = JSON.parse(text).detail || detail; } catch {}
          console.error('[auth-callback] exchange failed:', detail, text);
          setStatus('error');
          setErrorMsg(detail);
          return;
        }

        const data = await res.json();
        if (!data?.session_token || !data?.user) {
          setStatus('error');
          setErrorMsg('Sign-in response was incomplete. Please try again.');
          return;
        }

        // Store the session + user via AuthContext
        await login(data.session_token, data.user);

        // Strip the session_id out of the URL for privacy / back-button hygiene
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Route to the right place in the app
        if (data.user.questionnaire_completed) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/questionnaire');
        }
      } catch (e: any) {
        console.error('[auth-callback] unexpected error:', e);
        setStatus('error');
        setErrorMsg(e?.message || 'Unexpected error during sign-in.');
      }
    };

    processAuth();
  }, [login, router]);

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.text}>Signing you in…</Text>
          <Text style={styles.sub}>Setting up your HustleAI account.</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorTitle}>Sign-in didn't complete</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/login')}>
            <Text style={styles.btnText}>Back to Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/')}>
            <Text style={styles.btnSecondaryText}>Home</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    gap: 14,
  },
  text: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 18 },
  sub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' as const, maxWidth: 300 },
  errorTitle: { fontSize: 20, fontWeight: '900', color: Colors.urgentRed },
  errorText: {
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center' as const,
    maxWidth: 340,
    lineHeight: 21,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  btnSecondary: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});
