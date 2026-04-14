import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function LaunchPagePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (id) loadKit();
  }, [id]);

  const loadKit = async () => {
    try {
      const res = await api.getKit(id!);
      if (res.kit?.landing_page_html) {
        setHtml(res.kit.landing_page_html);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!html) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Landing Page</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorText}>Landing page not available yet</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show the HTML landing page in an iframe
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity testID="lp-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Landing Page</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="lp-download-btn"
            style={styles.actionBtn}
            onPress={() => {
              if (Platform.OS === 'web') {
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'landing-page.html'; a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            <Ionicons name="download-outline" size={20} color={Colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="lp-fullscreen-btn"
            style={styles.actionBtn}
            onPress={() => {
              if (Platform.OS === 'web') {
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }
            }}
          >
            <Ionicons name="expand-outline" size={20} color={Colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.iframeContainer}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
            title="Landing Page Preview"
            sandbox="allow-scripts"
          />
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Preview available in web browser</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  fullscreenBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  iframeContainer: { flex: 1, margin: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.background },
});
