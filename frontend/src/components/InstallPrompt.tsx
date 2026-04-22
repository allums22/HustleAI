import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../colors';
import { api } from '../api';

// Detects iOS devices (they need manual Add-to-Home-Screen instructions)
const isIos = () => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

// Detects if already installed (running in standalone mode)
const isStandalone = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

// Session storage key to throttle prompts
const DISMISSED_KEY = 'hustleai_install_dismissed_at';
const SHOW_AFTER_MS = 5000; // show after 5s of active engagement
const REPROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isStandalone()) return; // already installed, no prompt

    // Check cooldown
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < REPROMPT_COOLDOWN_MS) return;

    // Android/Chrome — capture native prompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), SHOW_AFTER_MS);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS — show manual instructions after delay
    if (isIos()) {
      setTimeout(() => setShowBanner(true), SHOW_AFTER_MS);
    }

    // When installed, hide banner
    const installedHandler = () => {
      setShowBanner(false);
      setShowIosModal(false);
      api.trackEvent('pwa_installed', { platform: isIos() ? 'ios' : 'android' });
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (isIos()) {
      setShowIosModal(true);
      api.trackEvent('pwa_install_prompt_ios_shown');
      return;
    }
    if (!deferredPrompt) return;
    api.trackEvent('pwa_install_prompt_shown');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    api.trackEvent(outcome === 'accepted' ? 'pwa_install_accepted' : 'pwa_install_dismissed');
    setDeferredPrompt(null);
    setShowBanner(false);
    if (outcome !== 'accepted') {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    api.trackEvent('pwa_install_banner_dismissed');
  };

  if (Platform.OS !== 'web' || !showBanner || isStandalone()) return null;

  return (
    <>
      {/* Bottom banner */}
      <View style={styles.banner} pointerEvents="box-none">
        <View style={styles.bannerCard}>
          <View style={styles.iconWrap}>
            <Image source={require('../../assets/images/icon.png')} style={styles.appIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Install HustleAI</Text>
            <Text style={styles.bannerSub}>Get instant access from your home screen</Text>
          </View>
          <TouchableOpacity testID="install-pwa-btn" style={styles.installBtn} onPress={handleInstall} activeOpacity={0.85}>
            <Text style={styles.installText}>Install</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="dismiss-pwa-btn" style={styles.dismissBtn} onPress={handleDismiss}>
            <Ionicons name="close" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* iOS instructions modal */}
      <Modal visible={showIosModal} transparent animationType="fade" onRequestClose={() => setShowIosModal(false)}>
        <View style={styles.iosOverlay}>
          <View style={styles.iosCard}>
            <TouchableOpacity testID="ios-close-btn" style={styles.iosClose} onPress={() => setShowIosModal(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.iosIconWrap}>
              <Image source={require('../../assets/images/icon.png')} style={styles.iosAppIcon} />
            </View>
            <Text style={styles.iosTitle}>Install HustleAI</Text>
            <Text style={styles.iosSub}>Add to your iPhone home screen in 2 taps:</Text>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.stepText}>Tap the</Text>
                <Ionicons name="share-outline" size={22} color={Colors.trustBlue} />
                <Text style={styles.stepText}>Share icon below</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.stepText}>Tap </Text>
                <Text style={styles.stepBold}>Add to Home Screen</Text>
              </View>
            </View>
            <TouchableOpacity testID="ios-got-it-btn" style={styles.gotItBtn} onPress={() => setShowIosModal(false)}>
              <Text style={styles.gotItText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute' as any, bottom: 16, left: 16, right: 16, zIndex: 9999 },
  bannerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: Colors.gold + '60', maxWidth: 500, alignSelf: 'center', width: '100%' },
  iconWrap: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.background },
  appIcon: { width: 44, height: 44 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  bannerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  installBtn: { backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  installText: { fontSize: 13, fontWeight: '800', color: Colors.background },
  dismissBtn: { padding: 6 },
  // iOS
  iosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  iosCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 24, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  iosClose: { position: 'absolute' as any, top: 10, right: 10, padding: 6, zIndex: 10 },
  iosIconWrap: { alignSelf: 'center', width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.background },
  iosAppIcon: { width: 64, height: 64 },
  iosTitle: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  iosSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background, padding: 12, borderRadius: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '800', color: Colors.background },
  stepText: { fontSize: 14, color: Colors.textPrimary },
  stepBold: { fontSize: 14, fontWeight: '800', color: Colors.gold },
  gotItBtn: { backgroundColor: Colors.gold, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  gotItText: { fontSize: 14, fontWeight: '800', color: Colors.background },
});
