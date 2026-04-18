import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, Platform, Linking, TextInput,
  KeyboardAvoidingView, FlatList, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Colors } from '../../src/colors';

export default function HustleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hustle, setHustle] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [kit, setKit] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [kitAccess, setKitAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingKit, setGeneratingKit] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState('');
  const [mentorMsg, setMentorMsg] = useState('');
  const [mentorHistory, setMentorHistory] = useState<{role: string; text: string}[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [showMentor, setShowMentor] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeAgent, setActiveAgent] = useState('mentor');
  const [agentHistories, setAgentHistories] = useState<Record<string, any[]>>({});

  useEffect(() => { if (id) loadDetail(); }, [id]);
  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    try { const res = await api.getAgents(); setAgents(res.agents || []); } catch {}
  };

  const loadAgentHistory = async (agentId: string) => {
    if (!id) return;
    try {
      const res = await api.getAgentHistory(id, agentId);
      const msgs = (res.messages || []).map((m: any) => ({
        role: m.role, text: m.text,
        time: m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }));
      setAgentHistories(prev => ({ ...prev, [agentId]: msgs }));
    } catch {}
  };

  const switchAgent = async (agentId: string) => {
    setActiveAgent(agentId);
    if (!agentHistories[agentId]) {
      await loadAgentHistory(agentId);
    }
  };

  // Auto-poll for landing page when kit exists but page is still generating
  useEffect(() => {
    if (!kit || kit.landing_page_status !== 'generating') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.getKit(id!);
        if (res.kit?.landing_page_html || res.kit?.landing_page_status !== 'generating') {
          setKit(res.kit);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [kit?.landing_page_status, id]);

  const loadDetail = async () => {
    try {
      const [detailRes, accessRes, kitAccessRes] = await Promise.all([
        api.getHustleDetail(id!),
        api.checkPlanAccess(id!),
        api.checkKitAccess(id!),
      ]);
      setHustle(detailRes.hustle);
      setPlan(detailRes.business_plan);
      setAccess(accessRes);
      setKitAccess(kitAccessRes);
      // Load existing kit if exists
      if (kitAccessRes?.kit_exists) {
        try { const kr = await api.getKit(id!); setKit(kr.kit); } catch {}
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const pollForResult = async (jobId: string, type: 'plan' | 'kit') => {
    const maxPolls = 40; // 40 * 3s = 2 minutes max
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await api.getGenerationStatus(jobId);
        if (res.status === 'complete') {
          if (type === 'plan' && res.plan) { setPlan(res.plan); setGeneratingPlan(false); setAccess((p: any) => p ? { ...p, plan_exists: true } : p); }
          if (type === 'kit' && res.kit) { setKit(res.kit); setGeneratingKit(false); setKitAccess((p: any) => p ? { ...p, kit_exists: true } : p); }
          return;
        }
        if (res.status === 'failed') {
          if (type === 'plan') { setGeneratingPlan(false); }
          if (type === 'kit') { setGeneratingKit(false); }
          return 'failed';
        }
      } catch { /* keep polling */ }
    }
    alert('Generation is taking longer than expected. Please refresh the page.');
    if (type === 'plan') setGeneratingPlan(false);
    if (type === 'kit') setGeneratingKit(false);
  };

  const handleGeneratePlan = async () => {
    if (!access?.has_access && !access?.plan_exists) { setShowPaywall(true); return; }
    setGeneratingPlan(true);
    try {
      await api.selectHustle(id!);
      const res = await api.generatePlan(id!);
      if (res.status === 'complete' && res.plan) { setPlan(res.plan); setGeneratingPlan(false); setAccess((p: any) => p ? { ...p, plan_exists: true } : p); return; }
      if (res.status === 'generating' && res.job_id) { pollForResult(res.job_id, 'plan'); return; }
      // Fallback - plan returned directly
      if (res.plan) { setPlan(res.plan); setGeneratingPlan(false); }
    } catch (e: any) {
      setGeneratingPlan(false);
      if (e.message?.includes('trial') || e.message?.includes('Upgrade') || e.message?.includes('limit')) { setShowPaywall(true); }
      else { alert(e.message || 'Failed'); }
    }
  };

  const handleGenerateKit = async () => {
    if (!kitAccess?.has_access && !kitAccess?.kit_exists) {
      try {
        let originUrl = Platform.OS === 'web' ? window.location.origin : '';
        const res = await api.createCheckout('alacarte_kit', originUrl, id);
        if (res.url) { Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url); }
      } catch (e: any) { alert(e.message || 'Failed'); }
      return;
    }
    setGeneratingKit(true);
    try {
      const res = await api.generateKit(id!);
      if (res.status === 'complete' && res.kit) { setKit(res.kit); setGeneratingKit(false); setKitAccess((p: any) => p ? { ...p, kit_exists: true } : p); return; }
      if (res.status === 'generating' && res.job_id) { pollForResult(res.job_id, 'kit'); return; }
      if (res.kit) { setKit(res.kit); setGeneratingKit(false); }
    } catch (e: any) {
      setGeneratingKit(false);
      if (e.message?.includes('Purchase') || e.message?.includes('upgrade')) {
        try {
          let originUrl = Platform.OS === 'web' ? window.location.origin : '';
          const res = await api.createCheckout('alacarte_kit', originUrl, id);
          if (res.url) { Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url); }
        } catch {}
      } else { alert(e.message || 'Failed'); }
    }
  };

  const handlePurchase = async (type: 'alacarte' | 'starter' | 'pro' | 'empire') => {
    setPurchaseLoading(type);
    try {
      let originUrl = Platform.OS === 'web' ? window.location.origin : '';
      const res = await api.createCheckout(type, originUrl, type === 'alacarte' ? id : undefined);
      if (res.url) { Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url); }
    } catch (e: any) { alert(e.message || 'Failed'); }
    finally { setPurchaseLoading(''); }
  };

  const mentorScrollRef = useRef<FlatList>(null);
  const mentorInputRef = useRef<TextInput>(null);

  const MENTOR_SUGGESTIONS = [
    "How do I find my first client?",
    "What should I charge?",
    "How do I stand out from competitors?",
    "What's the best marketing strategy?",
    "How do I scale this hustle?",
  ];

  const handleSendMentor = async (overrideMsg?: string) => {
    const msg = (overrideMsg || mentorMsg).trim();
    if (!msg || mentorLoading) return;
    const userMessage = { role: 'user', text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setAgentHistories(prev => ({ ...prev, [activeAgent]: [...(prev[activeAgent] || []), userMessage] }));
    setMentorMsg('');
    setMentorLoading(true);
    try {
      const res = await api.agentChat(id!, msg, activeAgent);
      const aiMessage = { role: 'ai', text: res.response, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setAgentHistories(prev => ({ ...prev, [activeAgent]: [...(prev[activeAgent] || []), aiMessage] }));
    } catch (e: any) {
      if (e.message?.includes('Upgrade') || e.message?.includes('requires')) {
        setAgentHistories(prev => ({ ...prev, [activeAgent]: [...(prev[activeAgent] || []), { role: 'system', text: e.message, time: '' }] }));
      } else {
        setAgentHistories(prev => ({ ...prev, [activeAgent]: [...(prev[activeAgent] || []), { role: 'ai', text: 'Sorry, I had trouble responding. Please try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }] }));
      }
    } finally {
      setMentorLoading(false);
    }
  };

  const handleCopyMessage = (text: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(text);
    }
  };

  const handleSharePlan = async () => {
    if (!plan) return;
    const text = `${plan.title}\n\n${plan.overview}\n\nMilestones:\n${(plan.milestones || []).map((m: any) => `Day ${m.day}: ${m.title} - ${m.description}`).join('\n')}\n\nGenerated by HustleAI`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(text); alert('Business plan copied to clipboard!'); } catch { }
    } else {
      try { await Share.share({ message: text }); } catch { }
    }
  };

  const handleDownloadPlan = () => {
    if (!plan || Platform.OS !== 'web') return;
    const text = `${plan.title}\n\n${plan.overview}\n\n${'='.repeat(50)}\nMILESTONES\n${'='.repeat(50)}\n${(plan.milestones || []).map((m: any) => `\nDay ${m.day}: ${m.title}\n${m.description}\nExpected: ${m.expected_outcome}`).join('\n')}\n\n${'='.repeat(50)}\n30-DAY PLAN\n${'='.repeat(50)}\n${(plan.daily_tasks || []).map((d: any) => `\nDay ${d.day}: ${d.title}\n${(d.tasks || []).map((t: string) => `  • ${t}`).join('\n')}`).join('\n')}\n\nGenerated by HustleAI`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${plan.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <View style={s.loadingC}><ActivityIndicator size="large" color={Colors.gold} /></View>;
  if (!hustle) return (
    <SafeAreaView style={s.safe}><View style={s.notFound}><Text style={s.notFoundText}>Hustle not found</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.backLink}>Go back</Text></TouchableOpacity></View></SafeAreaView>
  );

  const isTrial = access?.is_trial && !access?.plan_exists;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity testID="detail-back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Hustle Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Hustle Info */}
        <View style={s.infoCard}>
          <View style={s.badgeRow}>
            <View style={[s.catBadge, { backgroundColor: Colors.trustBlueLight }]}>
              <Text style={[s.catText, { color: Colors.trustBlue }]}>{hustle.category}</Text>
            </View>
            <View style={[s.catBadge, { backgroundColor: hustle.difficulty === 'Easy' ? Colors.growthGreenLight : hustle.difficulty === 'Hard' ? Colors.urgentRedLight : Colors.trustBlueLight }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: hustle.difficulty === 'Easy' ? Colors.growthGreenText : hustle.difficulty === 'Hard' ? Colors.urgentRed : Colors.trustBlue }}>{hustle.difficulty}</Text>
            </View>
          </View>
          <Text style={s.hustleName}>{hustle.name}</Text>
          <Text style={s.hustleDesc}>{hustle.description}</Text>
          <View style={s.statsGrid}>
            <View style={s.statBox}><Ionicons name="cash-outline" size={20} color={Colors.growthGreenText} /><Text style={s.statVal}>{hustle.potential_income}</Text><Text style={s.statLbl}>Potential Income</Text></View>
            <View style={s.statBox}><Ionicons name="time-outline" size={20} color={Colors.trustBlue} /><Text style={s.statVal}>{hustle.time_required}</Text><Text style={s.statLbl}>Time Required</Text></View>
          </View>
          {hustle.why_good_fit ? <View style={s.fitBox}><Ionicons name="heart" size={16} color={Colors.gold} /><Text style={s.fitText}>{hustle.why_good_fit}</Text></View> : null}
        </View>

        {/* ═══════════ LAUNCH KIT SECTION ═══════════ */}
        <View style={s.kitSection}>
          <View style={s.kitHeader}>
            <View style={s.kitIconCircle}><Ionicons name="rocket" size={22} color={Colors.background} /></View>
            <View style={s.kitHeaderText}>
              <Text style={s.kitTitle}>Hustle Launch Kit</Text>
              <Text style={s.kitSubtitle}>Everything you need to launch this hustle</Text>
            </View>
          </View>

          {/* What's included */}
          <View style={s.kitIncludes}>
            {[
              { icon: 'globe-outline', label: 'Custom Landing Page', desc: 'Responsive website you can deploy' },
              { icon: 'megaphone-outline', label: '5 Social Media Posts', desc: 'Ready-to-post captions' },
              { icon: 'mic-outline', label: 'Elevator Pitch', desc: '30-second pitch script' },
              { icon: 'color-palette-outline', label: 'Brand Identity', desc: 'Colors & tagline' },
              { icon: 'trending-up', label: 'Marketing Strategy', desc: '3 key growth strategies' },
              { icon: 'checkbox-outline', label: 'Launch Checklist', desc: '8-step action plan' },
            ].map((item, i) => (
              <View key={i} style={s.kitIncItem}>
                <View style={s.kitIncIcon}><Ionicons name={item.icon as any} size={16} color={Colors.gold} /></View>
                <View style={s.kitIncText}>
                  <Text style={s.kitIncLabel}>{item.label}</Text>
                  <Text style={s.kitIncDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreenText} />
              </View>
            ))}
          </View>

          {/* Kit CTA or Kit Content */}
          {kit ? (
            <View style={s.kitContent}>
              <View style={s.kitContentHeader}><Ionicons name="checkmark-circle" size={18} color={Colors.growthGreenText} /><Text style={s.kitGenerated}>Launch Kit Generated!</Text></View>
              {kit.tagline ? <View style={s.kitTagline}><Text style={s.kitTaglineLabel}>Tagline</Text><Text style={s.kitTaglineText}>"{kit.tagline}"</Text></View> : null}
              {kit.elevator_pitch ? <View style={s.kitPitch}><Text style={s.kitPitchLabel}>Elevator Pitch</Text><Text style={s.kitPitchText}>{kit.elevator_pitch}</Text></View> : null}
              {kit.social_posts?.length > 0 ? (
                <View style={s.kitPosts}>
                  <Text style={s.kitPostsLabel}>Social Media Posts</Text>
                  {kit.social_posts.slice(0, 3).map((post: string, i: number) => (
                    <View key={i} style={s.kitPostCard}><Text style={s.kitPostText}>{post}</Text></View>
                  ))}
                  {kit.social_posts.length > 3 && <Text style={s.kitMorePosts}>+{kit.social_posts.length - 3} more posts</Text>}
                </View>
              ) : null}
              {kit.target_audience ? <View style={s.kitAudience}><Text style={s.kitAudienceLabel}>Target Audience</Text><Text style={s.kitAudienceText}>{kit.target_audience}</Text></View> : null}
              {kit.marketing_strategy?.length > 0 ? (
                <View style={s.kitPosts}>
                  <Text style={s.kitPostsLabel}>Marketing Strategy</Text>
                  {kit.marketing_strategy.map((strat: string, i: number) => (
                    <View key={i} style={s.kitPostCard}><Text style={s.kitPostText}>{strat}</Text></View>
                  ))}
                </View>
              ) : null}
              {kit.launch_checklist?.length > 0 ? (
                <View style={s.kitPosts}>
                  <Text style={s.kitPostsLabel}>Launch Checklist</Text>
                  {kit.launch_checklist.map((step: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: Colors.gold, fontWeight: '700' }}>{i + 1}.</Text>
                      <Text style={s.kitPostText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Landing Page Section */}
              <View style={s.landingSection}>
                <View style={s.landingSectionHeader}>
                  <Ionicons name="globe-outline" size={18} color={Colors.gold} />
                  <Text style={s.landingSectionTitle}>Landing Page</Text>
                </View>
                {kit.landing_page_html && kit.landing_page_status !== 'generating' ? (
                  <TouchableOpacity
                    testID="view-landing-page-btn"
                    style={s.viewLandingBtn}
                    onPress={() => router.push(`/launch-page/${id}`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="open-outline" size={18} color={Colors.background} />
                    <Text style={s.viewLandingBtnText}>Preview Your Landing Page</Text>
                  </TouchableOpacity>
                ) : kit.landing_page_status === 'failed' ? (
                  <View style={s.landingFailed}>
                    <Ionicons name="alert-circle" size={16} color={Colors.urgentRed} />
                    <Text style={s.landingFailedText}>Landing page generation failed. Tap Launch Kit to retry.</Text>
                  </View>
                ) : (
                  <View style={s.landingLoading}>
                    <ActivityIndicator size="small" color={Colors.gold} />
                    <Text style={s.landingLoadingText}>Building your custom landing page...</Text>
                  </View>
                )}
              </View>
            </View>
          ) : generatingKit ? (
            <View style={s.kitLoading}><ActivityIndicator size="large" color={Colors.gold} /><Text style={s.kitLoadingText}>Building your launch kit...</Text></View>
          ) : (
            <TouchableOpacity testID="generate-kit-btn" style={s.kitCTA} onPress={handleGenerateKit} activeOpacity={0.8}>
              <Ionicons name="rocket" size={20} color={Colors.background} />
              <Text style={s.kitCTAText}>
                {kitAccess?.has_access ? 'Generate Launch Kit' : `Get Launch Kit — $2.99`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ═══════════ BUSINESS PLAN SECTION ═══════════ */}
        {!plan && !generatingPlan && (
          <View>
            {isTrial && <View style={s.trialBanner}><Ionicons name="gift" size={18} color={Colors.growthGreenText} /><Text style={s.trialText}>Your first business plan is free!</Text></View>}
            <TouchableOpacity testID="generate-plan-btn" style={[s.planCTA, !access?.has_access && !isTrial && s.lockedCTA]} onPress={handleGeneratePlan} activeOpacity={0.8}>
              <Ionicons name={access?.has_access ? 'sparkles' : 'lock-closed'} size={20} color={Colors.background} />
              <Text style={s.planCTAText}>{access?.has_access ? (isTrial ? 'Generate Free Trial Plan' : 'Generate 30-Day Business Plan') : 'Unlock Business Plan — $4.99'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {generatingPlan && <View style={s.genCard}><ActivityIndicator size="large" color={Colors.trustBlue} /><Text style={s.genText}>Creating your 30-day business plan...</Text></View>}

        {plan && (
          <View style={s.planSection}>
            <View style={s.planHeader}>
              <Text style={s.planTitle}>{plan.title}</Text>
              <View style={s.planActions}>
                <TouchableOpacity testID="share-plan-btn" style={s.planActionBtn} onPress={handleSharePlan}>
                  <Ionicons name="share-outline" size={18} color={Colors.gold} />
                  <Text style={s.planActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="download-plan-btn" style={s.planActionBtn} onPress={handleDownloadPlan}>
                  <Ionicons name="download-outline" size={18} color={Colors.gold} />
                  <Text style={s.planActionText}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.planOverview}>{plan.overview}</Text>
            {plan.milestones?.length > 0 && <Text style={s.secLabel}>Key Milestones</Text>}
            {(plan.milestones || []).map((m: any, i: number) => (
              <View key={i} style={s.milestone}><View style={s.msHeader}><View style={s.msDayBadge}><Text style={s.msDayText}>Day {m.day}</Text></View><Text style={s.msTitle}>{m.title}</Text></View>
                <Text style={s.msDesc}>{m.description}</Text><Text style={s.msOutcome}>Expected: {m.expected_outcome}</Text></View>
            ))}
            <Text style={s.secLabel}>30-Day Plan Preview</Text>
            {(plan.daily_tasks || []).slice(0, 5).map((day: any, i: number) => (
              <View key={i} style={s.dayCard}><View style={s.dayHeader}><Text style={s.dayNum}>Day {day.day}</Text><Text style={s.dayTitle}>{day.title}</Text></View>
                {(day.tasks || []).map((t: string, ti: number) => <Text key={ti} style={s.dayTask}>• {t}</Text>)}</View>
            ))}
            {(plan.daily_tasks || []).length > 5 && <TouchableOpacity testID="view-calendar-btn" style={s.calBtn} onPress={() => router.push('/(tabs)/progress')}>
              <Ionicons name="calendar-outline" size={18} color={Colors.gold} /><Text style={s.calBtnText}>View Full 30-Day Calendar</Text>
            </TouchableOpacity>}
          </View>
        )}
      </ScrollView>

      {/* ═══════════ FLOATING AI MENTOR BUTTON ═══════════ */}
      <TouchableOpacity
        testID="ai-mentor-fab"
        style={s.mentorFab}
        onPress={() => setShowMentor(true)}
        activeOpacity={0.85}
      >
        <View style={s.mentorFabInner}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#0F172A" />
        </View>
        <View style={s.mentorFabPulse} />
      </TouchableOpacity>

      {/* ═══════════ AI AGENT HUB MODAL ═══════════ */}
      <Modal visible={showMentor} animationType="slide" transparent={false}>
        <SafeAreaView style={s.mentorSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            {/* Chat Header */}
            <View style={s.mentorHeader}>
              <TouchableOpacity testID="mentor-close" onPress={() => setShowMentor(false)} style={s.mentorCloseBtn}>
                <Ionicons name="chevron-down" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={s.mentorHeaderCenter}>
                <View style={[s.mentorAvatar, { backgroundColor: agents.find(a => a.id === activeAgent)?.color || Colors.gold }]}>
                  <Ionicons name={(agents.find(a => a.id === activeAgent)?.icon || 'sparkles') as any} size={20} color="#000" />
                </View>
                <View>
                  <Text style={s.mentorHeaderTitle}>{agents.find(a => a.id === activeAgent)?.name || 'AI Mentor'}</Text>
                  <Text style={s.mentorHeaderSub}>{hustle?.name || 'Your Hustle'}</Text>
                </View>
              </View>
              <View style={{ width: 44 }} />
            </View>

            {/* Agent Selector Tabs */}
            {agents.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.agentTabs} contentContainerStyle={s.agentTabsContent}>
                {agents.map(agent => (
                  <TouchableOpacity
                    key={agent.id}
                    style={[s.agentTab, activeAgent === agent.id && { borderColor: agent.color, backgroundColor: agent.color + '15' }, agent.locked && s.agentTabLocked]}
                    onPress={() => { if (!agent.locked) { switchAgent(agent.id); } }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={agent.locked ? 'lock-closed' : agent.icon} size={14} color={agent.locked ? Colors.textTertiary : (activeAgent === agent.id ? agent.color : Colors.textSecondary)} />
                    <Text style={[s.agentTabText, activeAgent === agent.id && { color: agent.color }, agent.locked && { color: Colors.textTertiary }]}>{agent.name}</Text>
                    {agent.locked && <Text style={s.agentTabTier}>{agent.min_tier}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Chat Messages */}
            <FlatList
              ref={mentorScrollRef}
              data={agentHistories[activeAgent] || []}
              keyExtractor={(_, i) => `msg-${activeAgent}-${i}`}
              contentContainerStyle={s.mentorMessages}
              onContentSizeChange={() => mentorScrollRef.current?.scrollToEnd({ animated: true })}
              ListHeaderComponent={
                !(agentHistories[activeAgent]?.length) ? (
                  <View style={s.mentorWelcome}>
                    <View style={[s.mentorWelcomeIcon, { backgroundColor: (agents.find(a => a.id === activeAgent)?.color || Colors.gold) + '20' }]}>
                      <Ionicons name={(agents.find(a => a.id === activeAgent)?.icon || 'sparkles') as any} size={32} color={agents.find(a => a.id === activeAgent)?.color || Colors.gold} />
                    </View>
                    <Text style={s.mentorWelcomeTitle}>{agents.find(a => a.id === activeAgent)?.name || 'AI Agent'}</Text>
                    <Text style={s.mentorWelcomeSub}>
                      {agents.find(a => a.id === activeAgent)?.description || 'Ask me anything about your hustle.'}
                    </Text>
                    <View style={s.mentorSuggestions}>
                      {(agents.find(a => a.id === activeAgent)?.prompts || MENTOR_SUGGESTIONS).map((suggestion: string, i: number) => (
                        <TouchableOpacity
                          key={i}
                          style={s.mentorSuggestionChip}
                          onPress={() => handleSendMentor(suggestion)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.mentorSuggestionText}>{suggestion}</Text>
                          <Ionicons name="arrow-forward" size={14} color={Colors.gold} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                if (item.role === 'system') {
                  return (
                    <View style={s.mentorSystemMsg}>
                      <Ionicons name="lock-closed" size={14} color={Colors.gold} />
                      <Text style={s.mentorSystemText}>{item.text}</Text>
                      <TouchableOpacity style={s.mentorUpgradeBtn} onPress={() => { setShowMentor(false); router.push('/pricing'); }}>
                        <Text style={s.mentorUpgradeText}>Upgrade Now</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const isUser = item.role === 'user';
                return (
                  <View style={[s.mentorBubbleRow, isUser && s.mentorBubbleRowUser]}>
                    {!isUser && (
                      <View style={s.mentorBubbleAvatar}>
                        <Ionicons name="sparkles" size={14} color="#0F172A" />
                      </View>
                    )}
                    <View style={[s.mentorBubble, isUser ? s.mentorBubbleUser : s.mentorBubbleAI]}>
                      <Text style={[s.mentorBubbleText, isUser && s.mentorBubbleTextUser]}>{item.text}</Text>
                      <View style={s.mentorBubbleMeta}>
                        {item.time ? <Text style={s.mentorBubbleTime}>{item.time}</Text> : null}
                        {!isUser && (
                          <TouchableOpacity onPress={() => handleCopyMessage(item.text)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="copy-outline" size={13} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                mentorLoading ? (
                  <View style={s.mentorTyping}>
                    <View style={s.mentorBubbleAvatar}>
                      <Ionicons name="sparkles" size={14} color="#0F172A" />
                    </View>
                    <View style={s.mentorTypingBubble}>
                      <View style={s.typingDots}>
                        <View style={[s.typingDot, { opacity: 0.4 }]} />
                        <View style={[s.typingDot, { opacity: 0.7 }]} />
                        <View style={[s.typingDot, { opacity: 1 }]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* Chat Input */}
            <View style={s.mentorInputBar}>
              <TextInput
                ref={mentorInputRef}
                testID="mentor-input"
                style={s.mentorInput}
                placeholder="Ask your mentor anything..."
                placeholderTextColor={Colors.textTertiary}
                value={mentorMsg}
                onChangeText={setMentorMsg}
                onSubmitEditing={() => handleSendMentor()}
                returnKeyType="send"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                testID="mentor-send"
                style={[s.mentorSendBtn, (!mentorMsg.trim() || mentorLoading) && s.mentorSendBtnDisabled]}
                onPress={() => handleSendMentor()}
                disabled={!mentorMsg.trim() || mentorLoading}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={20} color={mentorMsg.trim() && !mentorLoading ? '#0F172A' : Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Paywall Modal */}
      <Modal visible={showPaywall} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <TouchableOpacity testID="close-paywall" style={s.modalClose} onPress={() => setShowPaywall(false)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            <View style={s.modalIcon}><Ionicons name="lock-open" size={32} color={Colors.gold} /></View>
            <Text style={s.modalTitle}>Unlock Business Plan</Text>
            <Text style={s.modalSub}>Get a detailed 30-day execution plan with daily tasks, milestones, and resources</Text>
            <TouchableOpacity testID="buy-alacarte-btn" style={s.alacarteBtn} onPress={() => handlePurchase('alacarte')} disabled={!!purchaseLoading}>
              {purchaseLoading === 'alacarte' ? <ActivityIndicator color={Colors.background} /> : <><Text style={s.alacarteBtnText}>Buy This Plan — $4.99</Text><Text style={s.alacarteSub}>One-time purchase</Text></>}
            </TouchableOpacity>
            <View style={s.modalDiv}><View style={s.modalDivLine} /><Text style={s.modalDivText}>or subscribe</Text><View style={s.modalDivLine} /></View>
            <TouchableOpacity testID="buy-starter-btn" style={s.starterBtn} onPress={() => handlePurchase('starter')} disabled={!!purchaseLoading}>
              {purchaseLoading === 'starter' ? <ActivityIndicator color={Colors.textOnColor} /> : <View style={s.subRow}><View><Text style={s.subTitle}>Starter — $9.99/mo</Text><Text style={s.subDesc}>10 plans + 2 launch kits</Text></View><View style={s.bestVal}><Text style={s.bestValText}>Best Value</Text></View></View>}
            </TouchableOpacity>
            <TouchableOpacity testID="buy-empire-btn" style={s.empireBtn} onPress={() => handlePurchase('empire')} disabled={!!purchaseLoading}>
              {purchaseLoading === 'empire' ? <ActivityIndicator color={Colors.gold} /> : <View><Text style={s.empireBtnTitle}>Empire — $49.99/mo</Text><Text style={s.empireBtnDesc}>Unlimited everything</Text></View>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingC: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 18, color: Colors.textSecondary },
  backLink: { fontSize: 14, fontWeight: '600', color: Colors.gold },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 800, alignSelf: 'center', width: '100%' },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  catText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  hustleName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  hustleDesc: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statBox: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  statLbl: { fontSize: 11, color: Colors.textTertiary },
  fitBox: { flexDirection: 'row', gap: 8, marginTop: 14, padding: 12, backgroundColor: Colors.orangeLight, borderRadius: 10 },
  fitText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  // ── Launch Kit Section ──
  kitSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, borderWidth: 1.5, borderColor: Colors.gold + '40', marginBottom: 16 },
  kitHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  kitIconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  kitHeaderText: { flex: 1 },
  kitTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  kitSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  kitIncludes: { gap: 8, marginBottom: 16 },
  kitIncItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  kitIncIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  kitIncText: { flex: 1 },
  kitIncLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  kitIncDesc: { fontSize: 11, color: Colors.textTertiary },
  kitCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12 },
  kitCTAText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  kitLoading: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  kitLoadingText: { fontSize: 14, color: Colors.textSecondary },
  kitContent: { gap: 12 },
  kitContentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kitGenerated: { fontSize: 15, fontWeight: '700', color: Colors.growthGreenText },
  kitTagline: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 14 },
  kitTaglineLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  kitTaglineText: { fontSize: 18, fontWeight: '700', color: Colors.gold, fontStyle: 'italic' },
  kitPitch: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 14 },
  kitPitchLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  kitPitchText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  kitPosts: { gap: 6 },
  kitPostsLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase' },
  kitPostCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.gold },
  kitPostText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  kitMorePosts: { fontSize: 12, color: Colors.gold, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  kitAudience: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 14 },
  kitAudienceLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  kitAudienceText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  landingSection: { backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.gold + '30' },
  landingSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  landingSectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  viewLandingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 14, borderRadius: 10 },
  viewLandingBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },
  landingLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  landingLoadingText: { fontSize: 13, color: Colors.textSecondary },
  landingFailed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  landingFailedText: { fontSize: 12, color: Colors.urgentRed },
  // ── Business Plan ──
  trialBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.growthGreenLight, padding: 12, borderRadius: 10, marginBottom: 10 },
  trialText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreenText },
  planCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.trustBlue, paddingVertical: 18, borderRadius: 14, marginBottom: 16 },
  lockedCTA: { backgroundColor: Colors.textTertiary },
  planCTAText: { fontSize: 16, fontWeight: '700', color: Colors.textOnColor },
  genCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 32, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  genText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  planSection: { gap: 12 },
  planTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planActions: { flexDirection: 'row', gap: 8 },
  planActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.gold + '50', backgroundColor: Colors.orangeLight },
  planActionText: { fontSize: 12, fontWeight: '700', color: Colors.gold },
  planOverview: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  secLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  milestone: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.gold },
  msHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  msDayBadge: { backgroundColor: Colors.orangeLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  msDayText: { fontSize: 11, fontWeight: '700', color: Colors.gold },
  msTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  msDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  msOutcome: { fontSize: 12, color: Colors.growthGreenText, fontWeight: '600', marginTop: 4 },
  dayCard: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dayNum: { fontSize: 12, fontWeight: '700', color: Colors.trustBlue },
  dayTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  dayTask: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, paddingLeft: 8 },
  calBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.gold },
  calBtnText: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  // ── Paywall Modal ──
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  modalSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 20 },
  alacarteBtn: { backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  alacarteBtnText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  alacarteSub: { fontSize: 12, color: Colors.background + '99', marginTop: 2 },
  modalDiv: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  modalDivLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  modalDivText: { fontSize: 12, color: Colors.textTertiary },
  starterBtn: { backgroundColor: Colors.trustBlue, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subTitle: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  subDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  bestVal: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bestValText: { fontSize: 10, fontWeight: '700', color: Colors.textOnColor },
  empireBtn: { borderWidth: 1.5, borderColor: Colors.gold, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  empireBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.gold },
  empireBtnDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  // ── AI Mentor FAB ──
  mentorFab: { position: 'absolute', bottom: 24, right: 24, zIndex: 100 },
  mentorFabInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  mentorFabPulse: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: Colors.gold, opacity: 0.3 },
  // ── AI Mentor Modal ──
  mentorSafe: { flex: 1, backgroundColor: Colors.background },
  mentorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  mentorCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  mentorHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mentorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  mentorHeaderTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  mentorHeaderSub: { fontSize: 11, color: Colors.textSecondary, maxWidth: 200 },
  // Agent Tabs
  agentTabs: { borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 52 },
  agentTabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  agentTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  agentTabLocked: { opacity: 0.5 },
  agentTabText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  agentTabTier: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase' as any },
  mentorMessages: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 },
  // ── Welcome ──
  mentorWelcome: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  mentorWelcomeIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  mentorWelcomeTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  mentorWelcomeSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, maxWidth: 400 },
  mentorSuggestions: { gap: 8, marginTop: 12, width: '100%', maxWidth: 400 },
  mentorSuggestionChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  mentorSuggestionText: { fontSize: 14, color: Colors.textPrimary, flex: 1, fontWeight: '500' },
  // ── Bubbles ──
  mentorBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12, maxWidth: '85%' },
  mentorBubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  mentorBubbleAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  mentorBubble: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, maxWidth: '100%' },
  mentorBubbleUser: { backgroundColor: Colors.trustBlue, borderBottomRightRadius: 4 },
  mentorBubbleAI: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  mentorBubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  mentorBubbleTextUser: { color: '#FFFFFF' },
  mentorBubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6, opacity: 0.7 },
  mentorBubbleTime: { fontSize: 10, color: Colors.textTertiary },
  // ── System / Upgrade ──
  mentorSystemMsg: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 24, backgroundColor: Colors.orangeLight, borderRadius: 16, marginVertical: 12 },
  mentorSystemText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  mentorUpgradeBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  mentorUpgradeText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  // ── Typing Indicator ──
  mentorTyping: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  mentorTypingBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 14, paddingHorizontal: 20 },
  typingDots: { flexDirection: 'row', gap: 5 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textTertiary },
  // ── Input Bar ──
  mentorInputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  mentorInput: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  mentorSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  mentorSendBtnDisabled: { backgroundColor: Colors.surfaceElevated },
});
