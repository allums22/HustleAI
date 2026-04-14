import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, Modal, TextInput, ScrollView, KeyboardAvoidingView,
} from 'react-native';
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
  const [customLinks, setCustomLinks] = useState<any>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [saving, setSaving] = useState(false);

  // Customization form state
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formFacebook, setFormFacebook] = useState('');

  useEffect(() => {
    if (id) loadKit();
  }, [id]);

  const loadKit = async () => {
    try {
      const res = await api.getKit(id!);
      if (res.kit?.landing_page_html) {
        setHtml(res.kit.landing_page_html);
        if (res.kit.custom_links) {
          setCustomLinks(res.kit.custom_links);
          setFormEmail(res.kit.custom_links.email || '');
          setFormPhone(res.kit.custom_links.phone || '');
          setFormName(res.kit.custom_links.name || '');
          setFormWebsite(res.kit.custom_links.website || '');
          setFormInstagram(res.kit.custom_links.instagram || '');
          setFormFacebook(res.kit.custom_links.facebook || '');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomization = async () => {
    setSaving(true);
    try {
      const res = await api.customizeLandingPage(id!, {
        email: formEmail,
        phone: formPhone,
        name: formName,
        website: formWebsite,
        instagram: formInstagram,
        facebook: formFacebook,
      });
      if (res.html) {
        setHtml(res.html);
      }
      setShowCustomize(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save changes');
    } finally {
      setSaving(false);
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity testID="lp-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Landing Page</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="lp-customize-btn"
            style={styles.actionBtn}
            onPress={() => setShowCustomize(true)}
          >
            <Ionicons name="pencil-outline" size={20} color={Colors.gold} />
          </TouchableOpacity>
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

      {/* Action bar below header */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.editLinksBtn} onPress={() => setShowCustomize(true)} activeOpacity={0.7}>
          <Ionicons name="link-outline" size={16} color={Colors.gold} />
          <Text style={styles.editLinksBtnText}>Edit Contact Info & Links</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.downloadMainBtn}
          onPress={() => {
            if (Platform.OS === 'web') {
              const blob = new Blob([html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'landing-page.html'; a.click();
              URL.revokeObjectURL(url);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={16} color="#0F172A" />
          <Text style={styles.downloadMainBtnText}>Download HTML</Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.iframeContainer}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
            title="Landing Page Preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Preview available in web browser</Text>
        </View>
      )}

      {/* ═══════════ CUSTOMIZE MODAL ═══════════ */}
      <Modal visible={showCustomize} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="brush-outline" size={22} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Customize Your Page</Text>
                  <Text style={styles.modalSub}>Update your contact info and links</Text>
                </View>
                <TouchableOpacity testID="customize-close" onPress={() => setShowCustomize(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formSection}>
                  <Text style={styles.formSectionLabel}>Contact Information</Text>
                  
                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="mail-outline" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-email"
                      style={styles.formInput}
                      placeholder="Your email address"
                      placeholderTextColor={Colors.textTertiary}
                      value={formEmail}
                      onChangeText={setFormEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="call-outline" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-phone"
                      style={styles.formInput}
                      placeholder="Phone number"
                      placeholderTextColor={Colors.textTertiary}
                      value={formPhone}
                      onChangeText={setFormPhone}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="person-outline" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-name"
                      style={styles.formInput}
                      placeholder="Your name / Business name"
                      placeholderTextColor={Colors.textTertiary}
                      value={formName}
                      onChangeText={setFormName}
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionLabel}>Links & Social Media</Text>

                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="globe-outline" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-website"
                      style={styles.formInput}
                      placeholder="https://yourwebsite.com"
                      placeholderTextColor={Colors.textTertiary}
                      value={formWebsite}
                      onChangeText={setFormWebsite}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="logo-instagram" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-instagram"
                      style={styles.formInput}
                      placeholder="@yourusername"
                      placeholderTextColor={Colors.textTertiary}
                      value={formInstagram}
                      onChangeText={setFormInstagram}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formField}>
                    <View style={styles.formFieldIcon}>
                      <Ionicons name="logo-facebook" size={16} color={Colors.gold} />
                    </View>
                    <TextInput
                      testID="custom-facebook"
                      style={styles.formInput}
                      placeholder="Facebook page URL"
                      placeholderTextColor={Colors.textTertiary}
                      value={formFacebook}
                      onChangeText={setFormFacebook}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>

              <TouchableOpacity
                testID="customize-save-btn"
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveCustomization}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#0F172A" />
                    <Text style={styles.saveBtnText}>Save & Update Landing Page</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  // Action bar
  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editLinksBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.gold + '50', backgroundColor: Colors.orangeLight },
  editLinksBtnText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  downloadMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.gold },
  downloadMainBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  iframeContainer: { flex: 1, margin: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.background },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalIconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  modalScroll: { paddingHorizontal: 20 },
  formSection: { marginTop: 20, gap: 10 },
  formSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  formField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12 },
  formFieldIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  formInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, marginHorizontal: 20, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});
