import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, Modal, TextInput, ScrollView, KeyboardAvoidingView, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function LaunchPagePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formInstagram, setFormInstagram] = useState('');
  const [formFacebook, setFormFacebook] = useState('');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#6366F1');
  const [formAccentColor, setFormAccentColor] = useState('#EC4899');
  const [formTagline, setFormTagline] = useState('');
  const [formBizName, setFormBizName] = useState('');
  const [activeColorField, setActiveColorField] = useState<'primary' | 'accent' | null>(null);
  const [logoUri, setLogoUri] = useState('');

  // Color picker helpers
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };

  const [primaryHue, setPrimaryHue] = useState(240);
  const [primarySat, setPrimarySat] = useState(80);
  const [primaryLight, setPrimaryLight] = useState(60);
  const [accentHue, setAccentHue] = useState(330);
  const [accentSat, setAccentSat] = useState(80);
  const [accentLight, setAccentLight] = useState(55);

  const handleHueSlider = (field: 'primary' | 'accent', locationX: number, width: number) => {
    const hue = Math.round(Math.max(0, Math.min(360, (locationX / width) * 360)));
    if (field === 'primary') {
      setPrimaryHue(hue);
      setFormPrimaryColor(hslToHex(hue, primarySat, primaryLight));
    } else {
      setAccentHue(hue);
      setFormAccentColor(hslToHex(hue, accentSat, accentLight));
    }
  };

  const handleLightSlider = (field: 'primary' | 'accent', locationX: number, width: number) => {
    const light = Math.round(Math.max(10, Math.min(90, (locationX / width) * 100)));
    if (field === 'primary') {
      setPrimaryLight(light);
      setFormPrimaryColor(hslToHex(primaryHue, primarySat, light));
    } else {
      setAccentLight(light);
      setFormAccentColor(hslToHex(accentHue, accentSat, light));
    }
  };

  useEffect(() => { if (id) loadKit(); }, [id]);

  const loadKit = async () => {
    try {
      const res = await api.getKit(id!);
      if (res.kit?.landing_page_html) {
        setHtml(res.kit.landing_page_html);
        if (res.kit.custom_links) {
          setFormEmail(res.kit.custom_links.email || '');
          setFormPhone(res.kit.custom_links.phone || '');
          setFormName(res.kit.custom_links.name || '');
          setFormWebsite(res.kit.custom_links.website || '');
          setFormInstagram(res.kit.custom_links.instagram || '');
          setFormFacebook(res.kit.custom_links.facebook || '');
        }
        if (res.kit.brand_colors) {
          setFormPrimaryColor(res.kit.brand_colors.primary || '#6366F1');
          setFormAccentColor(res.kit.brand_colors.accent || '#EC4899');
        }
        if (res.kit.tagline) setFormTagline(res.kit.tagline);
        if (res.kit.business_name) setFormBizName(res.kit.business_name);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePickLogo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.customizeLandingPage(id!, {
        email: formEmail, phone: formPhone, name: formName,
        website: formWebsite, instagram: formInstagram, facebook: formFacebook,
        primary_color: formPrimaryColor, accent_color: formAccentColor,
        tagline: formTagline, biz_name: formBizName,
      } as any);
      if (res.html) setHtml(res.html);
      setShowCustomize(false);
    } catch (e: any) { alert(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.gold} /></View></SafeAreaView>;
  }

  if (!html) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.hbar}><TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></TouchableOpacity><Text style={s.hTitle}>Landing Page</Text><View style={{width:44}} /></View>
        <View style={s.center}><Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} /><Text style={s.errText}>Landing page not available yet</Text><TouchableOpacity style={s.retryBtn} onPress={() => router.back()}><Text style={s.retryBtnText}>Go Back</Text></TouchableOpacity></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={s.hTitle}>Your Landing Page</Text>
        <View style={s.hActions}>
          <TouchableOpacity style={s.hBtn} onPress={() => setShowCustomize(true)}><Ionicons name="pencil-outline" size={20} color={Colors.gold} /></TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={() => {
            if (Platform.OS === 'web') { const b = new Blob([html], {type:'text/html'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='landing-page.html'; a.click(); URL.revokeObjectURL(u); }
          }}><Ionicons name="download-outline" size={20} color={Colors.gold} /></TouchableOpacity>
        </View>
      </View>

      {/* Action bar */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.editBtn} onPress={() => setShowCustomize(true)} activeOpacity={0.7}>
          <Ionicons name="brush-outline" size={16} color={Colors.gold} />
          <Text style={s.editBtnText}>Edit Landing Page</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dlBtn} onPress={() => {
          if (Platform.OS === 'web') { const b = new Blob([html], {type:'text/html'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='landing-page.html'; a.click(); URL.revokeObjectURL(u); }
        }} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={16} color="#0F172A" />
          <Text style={s.dlBtnText}>Download HTML</Text>
        </TouchableOpacity>
      </View>

      <View style={s.infoBar}>
        <Ionicons name="bulb-outline" size={14} color={Colors.gold} />
        <Text style={s.infoText}>Download the HTML file, then upload it to any hosting service (Netlify, Vercel, GoDaddy) to publish your landing page.</Text>
      </View>

      {Platform.OS === 'web' ? (
        <View style={s.iframeWrap}>
          <iframe srcDoc={html} style={{width:'100%',height:'100%',border:'none',borderRadius:8}} title="Landing Page" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        </View>
      ) : (
        <View style={s.center}><Text style={s.errText}>Preview available in web browser</Text></View>
      )}

      {/* ═══════════ EDIT LANDING PAGE MODAL ═══════════ */}
      <Modal visible={showCustomize} animationType="slide" transparent>
        <View style={s.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
            <View style={s.modal}>
              <View style={s.mHeader}>
                <View style={s.mIcon}><Ionicons name="brush-outline" size={22} color="#000" /></View>
                <View style={{flex:1}}><Text style={s.mTitle}>Edit Landing Page</Text><Text style={s.mSub}>Customize branding, colors, and contact info</Text></View>
                <TouchableOpacity onPress={() => { setActiveColorField(null); setShowCustomize(false); }} style={{padding:4}}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
              </View>

              <ScrollView style={s.mScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Branding */}
                <View style={s.section}>
                  <Text style={s.sLabel}>BRANDING</Text>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="business-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Business / Logo name" placeholderTextColor={Colors.textTertiary} value={formBizName} onChangeText={setFormBizName} /></View>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="text-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Tagline" placeholderTextColor={Colors.textTertiary} value={formTagline} onChangeText={setFormTagline} /></View>

                  {/* Logo Upload */}
                  <TouchableOpacity style={s.logoUpload} onPress={handlePickLogo} activeOpacity={0.7}>
                    {logoUri ? (
                      <Image source={{uri: logoUri}} style={s.logoPreview} resizeMode="contain" />
                    ) : (
                      <View style={s.logoPlaceholder}><Ionicons name="image-outline" size={24} color={Colors.textTertiary} /><Text style={s.logoPlaceholderText}>Upload Logo</Text></View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Colors */}
                <View style={s.section}>
                  <Text style={s.sLabel}>COLORS</Text>
                  
                  <Text style={s.colorLabel}>Primary Color</Text>
                  <View style={s.colorPreviewRow}>
                    <View style={[s.colorSwatch, {backgroundColor: formPrimaryColor}]} />
                    <Text style={s.colorHex}>{formPrimaryColor}</Text>
                  </View>
                  <Text style={s.sliderLabel}>Hue</Text>
                  <View style={s.hueBar} onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => handleHueSlider('primary', e.nativeEvent.locationX, 280)}
                    onResponderMove={(e) => handleHueSlider('primary', e.nativeEvent.locationX, 280)}>
                    <View style={[s.hueThumb, {left: `${(primaryHue / 360) * 100}%`}]} />
                  </View>
                  <Text style={s.sliderLabel}>Brightness</Text>
                  <View style={[s.lightBar, {background: `linear-gradient(to right, #000, hsl(${primaryHue}, ${primarySat}%, 50%), #fff)`} as any]}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => handleLightSlider('primary', e.nativeEvent.locationX, 280)}
                    onResponderMove={(e) => handleLightSlider('primary', e.nativeEvent.locationX, 280)}>
                    <View style={[s.hueThumb, {left: `${primaryLight}%`}]} />
                  </View>

                  <Text style={[s.colorLabel, {marginTop: 20}]}>Accent Color</Text>
                  <View style={s.colorPreviewRow}>
                    <View style={[s.colorSwatch, {backgroundColor: formAccentColor}]} />
                    <Text style={s.colorHex}>{formAccentColor}</Text>
                  </View>
                  <Text style={s.sliderLabel}>Hue</Text>
                  <View style={s.hueBar} onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => handleHueSlider('accent', e.nativeEvent.locationX, 280)}
                    onResponderMove={(e) => handleHueSlider('accent', e.nativeEvent.locationX, 280)}>
                    <View style={[s.hueThumb, {left: `${(accentHue / 360) * 100}%`}]} />
                  </View>
                  <Text style={s.sliderLabel}>Brightness</Text>
                  <View style={[s.lightBar, {background: `linear-gradient(to right, #000, hsl(${accentHue}, ${accentSat}%, 50%), #fff)`} as any]}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => handleLightSlider('accent', e.nativeEvent.locationX, 280)}
                    onResponderMove={(e) => handleLightSlider('accent', e.nativeEvent.locationX, 280)}>
                    <View style={[s.hueThumb, {left: `${accentLight}%`}]} />
                  </View>
                </View>

                {/* Contact */}
                <View style={s.section}>
                  <Text style={s.sLabel}>CONTACT INFO</Text>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="mail-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Email" placeholderTextColor={Colors.textTertiary} value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" /></View>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="call-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Phone" placeholderTextColor={Colors.textTertiary} value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" /></View>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="person-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Your name" placeholderTextColor={Colors.textTertiary} value={formName} onChangeText={setFormName} /></View>
                </View>

                {/* Links */}
                <View style={s.section}>
                  <Text style={s.sLabel}>LINKS & SOCIAL</Text>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="globe-outline" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="https://yourwebsite.com" placeholderTextColor={Colors.textTertiary} value={formWebsite} onChangeText={setFormWebsite} autoCapitalize="none" /></View>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="logo-instagram" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="@username" placeholderTextColor={Colors.textTertiary} value={formInstagram} onChangeText={setFormInstagram} autoCapitalize="none" /></View>
                  <View style={s.field}><View style={s.fIcon}><Ionicons name="logo-facebook" size={16} color={Colors.gold} /></View><TextInput style={s.fInput} placeholder="Facebook page URL" placeholderTextColor={Colors.textTertiary} value={formFacebook} onChangeText={setFormFacebook} autoCapitalize="none" /></View>
                </View>
                <View style={{height: 20}} />
              </ScrollView>

              <TouchableOpacity style={[s.saveBtn, saving && {opacity:0.6}]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#000" /> : <><Ionicons name="checkmark-circle" size={20} color="#000" /><Text style={s.saveBtnText}>Save & Update Landing Page</Text></>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  hbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  hTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  hActions: { flexDirection: 'row', gap: 4 },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.gold + '50', backgroundColor: Colors.orangeLight },
  editBtnText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  dlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.gold },
  dlBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.orangeLight, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoText: { fontSize: 12, color: Colors.gold, flex: 1, lineHeight: 16 },
  iframeWrap: { flex: 1, margin: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  errText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.background },
  // Modal
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 24 },
  mHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  mTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  mSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  mScroll: { paddingHorizontal: 20 },
  section: { marginTop: 20, gap: 10 },
  sLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 1.5, marginBottom: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12 },
  fIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  fInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  // Logo Upload
  logoUpload: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', borderStyle: 'dashed' as any },
  logoPreview: { width: '100%', height: 80 },
  logoPlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  logoPlaceholderText: { fontSize: 14, color: Colors.textTertiary, fontWeight: '600' },
  // Color Picker
  colorLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: '#333' },
  colorHex: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  sliderLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, marginBottom: 4, marginTop: 8 },
  hueBar: { height: 36, borderRadius: 10, overflow: 'hidden', position: 'relative' as any, background: 'linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))' as any },
  lightBar: { height: 36, borderRadius: 10, overflow: 'hidden', position: 'relative' as any },
  hueThumb: { position: 'absolute' as any, top: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 3, borderColor: '#000', marginLeft: -16 },
  // Save
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, marginHorizontal: 20, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
