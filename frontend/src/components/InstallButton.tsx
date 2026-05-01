import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../colors';
import { api } from '../api';

// Detect iOS — needs manual "Add to Home Screen"
const isIos = () => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

// Detect if already running as installed PWA
const isStandalone = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

// Detect Android Chrome (most likely to fire beforeinstallprompt)
const isAndroidChrome = () => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && /Chrome/.test(ua);
};

interface Props {
  variant?: 'primary' | 'secondary' | 'inline';
  label?: string;
  fullWidth?: boolean;
}

/**
 * One-click "Install HustleAI" button.
 * — Android/Chrome: fires native install prompt immediately
 * — iOS: opens modal with Share → Add to Home Screen instructions
 * — Desktop Chrome/Edge: fires native install
 * — Already installed (standalone): hides itself
 */
export function InstallButton({ variant = 'primary', label, fullWidth = false }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const beforeHandler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', beforeHandler);

    const installedHandler = () => {
      setInstalled(true);
      api.trackEvent('pwa_installed', { source: 'install_button' });
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // Hide on native (this is a web-only feature) or if already installed
  if (Platform.OS !== 'web' || installed) return null;

  const handleClick = async () => {
    api.trackEvent('install_button_click', {
      ios: isIos(),
      android: isAndroidChrome(),
      has_native_prompt: !!deferredPrompt,
    });

    if (isIos()) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        api.trackEvent(outcome === 'accepted' ? 'pwa_install_accepted' : 'pwa_install_dismissed', {
          source: 'install_button',
        });
        setDeferredPrompt(null);
      } catch (e) {
        // Fallback to iOS-style instructions if native fails
        setShowIosModal(true);
      }
      return;
    }

    // No native event fired yet (e.g. first-time desktop or unsupported browser)
    // Show generic "How to install" instructions modal
    setShowIosModal(true);
  };

  const buttonStyle =
    variant === 'primary' ? s.primary : variant === 'secondary' ? s.secondary : s.inline;
  const textStyle =
    variant === 'primary' ? s.primaryText : variant === 'secondary' ? s.secondaryText : s.inlineText;
  const iconColor = variant === 'primary' ? '#000' : Colors.gold;

  return (
    <>
      <TouchableOpacity
        testID="install-button"
        style={[buttonStyle, fullWidth && { alignSelf: 'stretch' }]}
        onPress={handleClick}
        activeOpacity={0.85}
      >
        <Ionicons name="phone-portrait" size={16} color={iconColor} />
        <Text style={textStyle}>{label || 'Install HustleAI'}</Text>
      </TouchableOpacity>

      {/* iOS / fallback instructions modal */}
      <Modal visible={showIosModal} transparent animationType="fade" onRequestClose={() => setShowIosModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Ionicons name="phone-portrait" size={32} color={Colors.gold} />
              <Text style={s.modalTitle}>Install HustleAI on your phone</Text>
              <TouchableOpacity onPress={() => setShowIosModal(false)} style={s.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {isIos() ? (
              <View style={s.steps}>
                <Step n={1} icon="share-outline" iconColor="#0A84FF" text="Tap the Share button at the bottom of Safari" />
                <Step n={2} icon="add-outline" iconColor={Colors.gold} text="Scroll down and tap 'Add to Home Screen'" />
                <Step n={3} icon="checkmark-circle" iconColor={Colors.growthGreen} text="Tap 'Add' — the HustleAI icon will appear on your home screen" />
              </View>
            ) : (
              <View style={s.steps}>
                <Step n={1} icon="ellipsis-vertical" iconColor={Colors.textPrimary} text="Tap the three-dot menu in your browser" />
                <Step n={2} icon="add-outline" iconColor={Colors.gold} text="Tap 'Install app' or 'Add to Home Screen'" />
                <Step n={3} icon="checkmark-circle" iconColor={Colors.growthGreen} text="Confirm — HustleAI installs as an app icon" />
              </View>
            )}

            <View style={s.benefits}>
              <Text style={s.benefitsTitle}>Why install?</Text>
              <Text style={s.benefit}>📱 One tap to open — no browser needed</Text>
              <Text style={s.benefit}>🔔 Get push notifications for daily tasks</Text>
              <Text style={s.benefit}>⚡ Faster, fullscreen experience</Text>
              <Text style={s.benefit}>📴 Works offline once loaded</Text>
            </View>

            <TouchableOpacity style={s.modalBtn} onPress={() => setShowIosModal(false)}>
              <Text style={s.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Step({ n, icon, iconColor, text }: { n: number; icon: any; iconColor: string; text: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 6 }} />
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gold, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 },
  primaryText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.3 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.gold + '60', backgroundColor: '#1A1209' },
  secondaryText: { fontSize: 15, fontWeight: '800', color: Colors.gold, letterSpacing: 0.3 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#111113', borderWidth: 1, borderColor: Colors.gold + '40' },
  inlineText: { fontSize: 12, fontWeight: '800', color: Colors.gold, letterSpacing: 0.3 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 22, maxWidth: 420, width: '100%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { alignItems: 'center', gap: 10, marginBottom: 18, position: 'relative' as const },
  modalTitle: { fontSize: 19, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.3, paddingHorizontal: 30 },
  closeBtn: { position: 'absolute' as const, right: -6, top: -6, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  steps: { gap: 12, marginBottom: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold + '25', justifyContent: 'center', alignItems: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '900', color: Colors.gold },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600', lineHeight: 19 },
  benefits: { backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  benefitsTitle: { fontSize: 12, fontWeight: '900', color: Colors.gold, letterSpacing: 1, marginBottom: 8 },
  benefit: { fontSize: 13, color: Colors.textSecondary, lineHeight: 22 },
  modalBtn: { backgroundColor: Colors.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '900', color: '#000' },
});
