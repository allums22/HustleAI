import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Linking, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api';
import { Colors } from '../src/colors';

type Billing = 'monthly' | 'annual';

const PLANS = [
  {
    key: 'free', name: 'Free', monthly: 0, annual: 0, period: 'forever',
    headline: 'Discover Your Hustles', icon: 'flash',
    features: ['Up to 12 side hustle recommendations', '1 free trial business plan', 'Community access', 'Skills assessment'],
    locked: ['Premium business plans', 'Launch kits & landing pages', 'AI Mentor chat', 'AI Agents'],
    popular: false,
  },
  {
    key: 'starter', name: 'Starter', monthly: 9.99, annual: 71.88,
    headline: '10 Plans + Launch Kit + AI Mentor', icon: 'star',
    features: [
      'All starter + premium hustles', '10 business plans/month',
      '2 Launch Kits with landing pages', 'AI Mentor — your personal business coach',
      '30-day execution calendar', '30-day money-back guarantee',
    ],
    locked: [], popular: true,
  },
  {
    key: 'pro', name: 'Pro', monthly: 29.99, annual: 215.88,
    headline: 'Unlimited + AI Agents', icon: 'diamond',
    features: [
      'Everything in Starter', 'Unlimited business plans', '5 Launch Kits/month',
      'AI Mentor + Marketing Agent', 'Landing page customization', 'Advanced AI strategies',
      '30-day money-back guarantee',
    ],
    locked: [], popular: false,
  },
  {
    key: 'empire', name: 'Empire', monthly: 79.99, annual: 575.88,
    headline: 'Full AI Team + White-Label', icon: 'trophy',
    features: [
      'Everything in Pro', 'Unlimited Launch Kits',
      'All AI Agents (Marketing, Content, Finance)', 'AI Mentor with page editing',
      'White-label landing pages', 'Dedicated priority support', '30-day money-back guarantee',
    ],
    locked: [], popular: false,
  },
];

export default function PricingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<{ valid: boolean; msg: string; pct?: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [seats, setSeats] = useState<{ sold: number; limit: number; remaining: number; price: number; instant_kit_price: number; available: boolean } | null>(null);
  const [launchLoading, setLaunchLoading] = useState<'lifetime' | 'instant_kit' | null>(null);

  useEffect(() => {
    api.getFoundersSeats().then(setSeats).catch(() => {});
  }, []);

  const currentTier = user?.subscription_tier || 'free';
  const tierOrder = ['free', 'starter', 'pro', 'empire'];

  const validatePromo = async () => {
    const code = promoCode.trim();
    if (!code) { setPromoStatus(null); return; }
    setValidating(true);
    try {
      const res = await api.validateCheckoutPromo(code);
      if (res.valid) {
        setPromoStatus({ valid: true, msg: `✓ ${res.description || `${res.discount_pct}% off`} applied`, pct: res.discount_pct });
      } else {
        setPromoStatus({ valid: false, msg: res.reason || 'Invalid code' });
      }
    } catch (e: any) {
      setPromoStatus({ valid: false, msg: 'Could not validate code' });
    } finally { setValidating(false); }
  };

  const handleLifetimeBuy = async () => {
    if (!user) { router.push('/register'); return; }
    setLaunchLoading('lifetime');
    try {
      const originUrl = Platform.OS === 'web' ? window.location.origin : '';
      const res = await api.createCheckout({ plan: 'lifetime', origin_url: originUrl });
      if (res.url) {
        Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url);
      }
    } catch (e: any) {
      alert(e.message || 'Checkout failed');
    } finally { setLaunchLoading(null); }
  };

  const handleInstantKit = () => {
    if (!user) { router.push('/register'); return; }
    // Instant Kit needs a hustle context — send user to dashboard
    router.push('/(tabs)/dashboard');
  };

  const handleUpgrade = async (planKey: string) => {
    if (planKey === 'free' || planKey === currentTier) return;
    if (!user) { router.push('/register'); return; }
    setLoadingPlan(planKey);
    try {
      const originUrl = Platform.OS === 'web' ? window.location.origin : '';
      const payload: any = { plan: planKey, origin_url: originUrl, billing };
      // Only apply promo on monthly plans (backend ignores for annual)
      if (billing === 'monthly' && promoStatus?.valid && promoCode.trim()) {
        payload.promo_code = promoCode.trim().toUpperCase();
      }
      const res = await api.createCheckout(payload);
      if (res.url) {
        Platform.OS === 'web' ? (window.location.href = res.url) : Linking.openURL(res.url);
      }
    } catch (e: any) { alert(e.message || 'Checkout failed'); }
    finally { setLoadingPlan(null); }
  };

  // Pay Per Item handlers — all need a hustle context, so route to dashboard
  const handlePayPerItem = (itemType: string) => {
    if (!user) { router.push('/register'); return; }
    // All a-la-carte items require selecting a hustle first
    router.push('/(tabs)/dashboard');
  };

  const formatPrice = (plan: any) => {
    if (plan.key === 'free') return { main: '$0', sub: 'forever' };
    if (billing === 'annual') {
      const monthlyEq = (plan.annual / 12).toFixed(2);
      return { main: `$${monthlyEq}`, sub: '/mo billed annually', crossed: `$${plan.monthly}` };
    }
    return { main: `$${plan.monthly}`, sub: '/month' };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity testID="pricing-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Unlock AI business plans & launch kits to turn hustles into revenue</Text>

        {/* 🛡️ Money-Back Guarantee Banner */}
        <View style={styles.guaranteeBanner}>
          <View style={styles.guaranteeIcon}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.growthGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>30-Day Money-Back Guarantee</Text>
            <Text style={styles.guaranteeSub}>Don't earn your first dollar in 30 days? Full refund. No questions asked.</Text>
          </View>
        </View>

        {/* 🔥 LAUNCH STACK — Founders Lifetime + Instant Kit */}
        <View style={styles.launchStackHeader}>
          <View style={styles.launchStackBadge}>
            <Ionicons name="flame" size={12} color="#fff" />
            <Text style={styles.launchStackBadgeText}>FOUNDERS LAUNCH · LIMITED</Text>
          </View>
          <Text style={styles.launchStackTitle}>Skip the subscription. Pay once.</Text>
          <Text style={styles.launchStackSub}>
            Two no-brainer offers built to get you to your first paying customer this week.
          </Text>
        </View>

        {/* Lifetime Card */}
        <View style={[styles.launchCard, styles.launchCardLifetime]}>
          <View style={styles.launchCardTopRow}>
            <View style={styles.launchIconWrap}>
              <Ionicons name="infinite" size={22} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.launchCardTitle}>Founders Lifetime Access</Text>
              <Text style={styles.launchCardKicker}>Empire tier · forever · no monthly bill</Text>
            </View>
          </View>
          <View style={styles.launchPriceRow}>
            <Text style={styles.launchPrice}>$149</Text>
            <Text style={styles.launchPriceCrossed}>$960/yr value</Text>
            <Text style={styles.launchOnce}>one-time</Text>
          </View>
          {seats && (
            <View style={styles.seatsRow}>
              <View style={styles.seatsBar}>
                <View style={[styles.seatsBarFill, { width: `${Math.min(100, (seats.sold / seats.limit) * 100)}%` }]} />
              </View>
              <Text style={styles.seatsText}>
                {seats.remaining > 0
                  ? `Only ${seats.remaining} of ${seats.limit} Founders seats left`
                  : 'Sold out'}
              </Text>
            </View>
          )}
          <View style={styles.launchFeatures}>
            {[
              'Unlimited business plans · forever',
              'Unlimited launch kits + landing pages',
              'All 4 AI Agents (Mentor, Marketing, Content, Finance)',
              'White-label landing pages',
              'Every future feature, free, forever',
              'Founder badge on the leaderboard',
            ].map((f, i) => (
              <View key={i} style={styles.launchFeatureRow}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.gold} />
                <Text style={styles.launchFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            testID="lifetime-buy-btn"
            style={[styles.launchBtn, styles.launchBtnLifetime, (seats && !seats.available) && styles.btnDisabled]}
            onPress={handleLifetimeBuy}
            disabled={launchLoading === 'lifetime' || !!(seats && !seats.available)}
            activeOpacity={0.85}
          >
            {launchLoading === 'lifetime' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.launchBtnTextLifetime}>
                {seats && !seats.available ? 'Sold Out' : 'Claim Lifetime Access — $149'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Instant Kit Card */}
        <View style={[styles.launchCard, styles.launchCardKit]}>
          <View style={styles.launchCardTopRow}>
            <View style={[styles.launchIconWrap, { backgroundColor: Colors.trustBlueLight }]}>
              <Ionicons name="rocket" size={22} color={Colors.trustBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.launchCardTitle}>Instant Hustle Kit</Text>
              <Text style={styles.launchCardKicker}>One complete launch package · ready in minutes</Text>
            </View>
          </View>
          <View style={styles.launchPriceRow}>
            <Text style={styles.launchPrice}>$29</Text>
            <Text style={styles.launchOnce}>one-time</Text>
          </View>
          <View style={styles.launchFeatures}>
            {[
              'AI-generated business plan tailored to one hustle',
              '30-day execution calendar',
              'Branded landing page with your contact info',
              'Marketing strategy + first 5 customers playbook',
              'Yours to keep — no subscription',
            ].map((f, i) => (
              <View key={i} style={styles.launchFeatureRow}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.trustBlue} />
                <Text style={styles.launchFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            testID="instant-kit-buy-btn"
            style={[styles.launchBtn, styles.launchBtnKit]}
            onPress={handleInstantKit}
            activeOpacity={0.85}
          >
            <Text style={styles.launchBtnTextKit}>Pick a Hustle & Get the Kit — $29</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.launchDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.launchDividerText}>OR SUBSCRIBE</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            testID="billing-monthly"
            style={[styles.billingBtn, billing === 'monthly' && styles.billingBtnActive]}
            onPress={() => setBilling('monthly')}
          >
            <Text style={[styles.billingText, billing === 'monthly' && styles.billingTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="billing-annual"
            style={[styles.billingBtn, billing === 'annual' && styles.billingBtnActive]}
            onPress={() => setBilling('annual')}
          >
            <Text style={[styles.billingText, billing === 'annual' && styles.billingTextActive]}>Annual</Text>
            <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>SAVE 40%</Text></View>
          </TouchableOpacity>
        </View>

        {/* Promo Code Input — only visible on monthly */}
        {billing === 'monthly' && (
          <View style={styles.promoRow}>
            <View style={[styles.promoInputWrap, promoStatus?.valid && styles.promoInputWrapValid, promoStatus && !promoStatus.valid && styles.promoInputWrapInvalid]}>
              <Ionicons name="pricetag" size={16} color={promoStatus?.valid ? Colors.growthGreen : Colors.textTertiary} />
              <TextInput
                testID="promo-input"
                style={styles.promoInput}
                placeholder="Promo code (optional)"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
                value={promoCode}
                onChangeText={(t) => { setPromoCode(t); setPromoStatus(null); }}
              />
            </View>
            <TouchableOpacity testID="promo-apply-btn" style={styles.promoApplyBtn} onPress={validatePromo} disabled={validating || !promoCode.trim()}>
              {validating ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.promoApplyText}>Apply</Text>}
            </TouchableOpacity>
          </View>
        )}
        {promoStatus && billing === 'monthly' && (
          <Text style={[styles.promoFeedback, promoStatus.valid ? styles.promoFeedbackValid : styles.promoFeedbackInvalid]}>
            {promoStatus.msg}
          </Text>
        )}

        {/* Plan Cards */}
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentTier;
          const isUpgrade = tierOrder.indexOf(plan.key) > tierOrder.indexOf(currentTier);
          const isEmpire = plan.key === 'empire';
          const price = formatPrice(plan);
          const showDiscount = billing === 'monthly' && promoStatus?.valid && plan.key !== 'free';
          const discountedPrice = showDiscount ? (plan.monthly * (1 - (promoStatus!.pct || 0) / 100)).toFixed(2) : null;
          return (
            <View key={plan.key} style={[styles.planCard, plan.popular && styles.planCardPopular, isCurrent && styles.planCardCurrent, isEmpire && styles.planCardEmpire]}>
              {plan.popular && (<View style={styles.popularBadge}><Ionicons name="star" size={12} color={Colors.textOnColor} /><Text style={styles.popularText}>Most Popular</Text></View>)}
              {isEmpire && !isCurrent && (<View style={styles.empireBadge}><Ionicons name="trophy" size={12} color={Colors.textOnColor} /><Text style={styles.empireText}>Best for Serious Hustlers</Text></View>)}
              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <Ionicons name={plan.icon as any} size={18} color={isEmpire ? Colors.orangeCTA : Colors.trustBlue} />
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                <View style={styles.priceRow}>
                  {price.crossed && <Text style={styles.priceCrossed}>{price.crossed}</Text>}
                  <Text style={styles.planPrice}>{price.main}</Text>
                  <Text style={styles.planPeriod}>{price.sub}</Text>
                </View>
                {showDiscount && plan.key !== 'free' && (
                  <View style={styles.discountPill}>
                    <Text style={styles.discountPillText}>
                      First month: ${discountedPrice} ({promoStatus!.pct}% off)
                    </Text>
                  </View>
                )}
                {billing === 'annual' && plan.key !== 'free' && (
                  <Text style={styles.annualTotal}>
                    ${plan.annual.toFixed(2)} billed yearly · save ${(plan.monthly * 12 - plan.annual).toFixed(0)}/yr
                  </Text>
                )}
              </View>
              <View style={styles.headlineBadge}><Text style={styles.headlineText}>{plan.headline}</Text></View>
              <View style={styles.featuresList}>
                {plan.features.map((f, i) => {
                  const isAI = f.toLowerCase().includes('ai ') || f.toLowerCase().includes('agent');
                  const isGuarantee = f.toLowerCase().includes('guarantee');
                  return (
                    <View key={i} style={[styles.featureRow, isAI && styles.featureRowAI]}>
                      <Ionicons
                        name={isGuarantee ? 'shield-checkmark' : isAI ? 'sparkles' : 'checkmark-circle'}
                        size={16}
                        color={isGuarantee ? Colors.growthGreen : isAI ? Colors.gold : Colors.growthGreen}
                      />
                      <Text style={[styles.featureText, isAI && styles.featureTextAI, isGuarantee && styles.featureTextGuarantee]}>{f}</Text>
                    </View>
                  );
                })}
                {plan.locked.map((f, i) => (<View key={`l-${i}`} style={styles.featureRow}><Ionicons name="lock-closed" size={16} color={Colors.textTertiary} /><Text style={styles.lockedText}>{f}</Text></View>))}
              </View>
              {isCurrent ? (
                <View style={styles.currentBadge}><Ionicons name="checkmark" size={16} color={Colors.growthGreen} /><Text style={styles.currentText}>Current Plan</Text></View>
              ) : isUpgrade ? (
                <TouchableOpacity
                  testID={`upgrade-${plan.key}-btn`}
                  style={[styles.upgradeBtn, plan.popular && styles.upgradeBtnPopular, isEmpire && styles.upgradeBtnEmpire]}
                  onPress={() => handleUpgrade(plan.key)}
                  disabled={loadingPlan === plan.key}
                >
                  {loadingPlan === plan.key ? <ActivityIndicator color={Colors.textOnColor} /> : (
                    <Text style={styles.upgradeBtnText}>
                      {isEmpire ? 'Go Empire' : plan.popular ? 'Get Started' : `Upgrade to ${plan.name}`}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {/* À la carte (Launch Kit removed — now bundled in Starter) */}
        <View style={styles.alacarteSection}>
          <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>pay per item</Text><View style={styles.dividerLine} /></View>
          <Text style={styles.alacarteNote}>Agents are chat only — no plans or kits included</Text>
          <View style={styles.alacarteRow}>
            <TouchableOpacity
              testID="alacarte-business-plan"
              style={styles.alacarteCard}
              onPress={() => handlePayPerItem('business_plan')}
              activeOpacity={0.75}
            >
              <Ionicons name="document-text" size={22} color={Colors.trustBlue} />
              <Text style={styles.alacarteTitle}>Business Plan</Text>
              <Text style={styles.alacartePrice}>$4.99</Text>
              <Text style={styles.alacartePer}>each</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="alacarte-single-agent"
              style={styles.alacarteCard}
              onPress={() => handlePayPerItem('single_agent')}
              activeOpacity={0.75}
            >
              <Ionicons name="sparkles" size={22} color={Colors.orangeCTA} />
              <Text style={styles.alacarteTitle}>Single Agent</Text>
              <Text style={styles.alacartePrice}>$9.99</Text>
              <Text style={styles.alacartePer}>/mo each</Text>
            </TouchableOpacity>
          </View>
          {/* Agent Pack */}
          <TouchableOpacity
            testID="alacarte-agent-pack"
            style={styles.agentPack}
            onPress={() => handlePayPerItem('agent_pack')}
            activeOpacity={0.75}
          >
            <View style={styles.agentPackBadge}><Text style={styles.agentPackBadgeText}>SAVE 33%</Text></View>
            <View style={styles.agentPackRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.agentPackIcons}>
                  <Ionicons name="megaphone" size={16} color="#EC4899" />
                  <Ionicons name="create" size={16} color="#8B5CF6" />
                  <Ionicons name="calculator" size={16} color="#22C55E" />
                </View>
                <Text style={styles.agentPackTitle}>AI Agent Pack</Text>
                <Text style={styles.agentPackSub}>All 3 premium agents</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.agentPackOld}>$29.97</Text>
                <Text style={styles.agentPackPrice}>$19.99<Text style={styles.agentPackMo}>/mo</Text></Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.valueNudge}>
            <Ionicons name="bulb-outline" size={14} color={Colors.gold} />
            <Text style={styles.valueNudgeText}>
              💡 Starter ($9.99/mo) includes 2 Launch Kits — no need to buy separately. Pro ($29.99) bundles Marketing Agent + unlimited plans + 5 kits.
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Common Questions</Text>
          {[
            { q: 'What if HustleAI doesn\'t work for me?', a: 'You\'re covered by our 30-day money-back guarantee. If you don\'t earn your first dollar of side income within 30 days, email support@hustleai.live for a full refund — no questions asked.' },
            { q: 'Is the $149 Lifetime really lifetime?', a: 'Yes. One payment, unlimited access to every feature we ever ship — including all 4 AI agents, unlimited business plans, unlimited launch kits, and white-label landing pages. No recurring charge, ever. Limited to the first 100 Founders.' },
            { q: 'How is the $29 Instant Hustle Kit different from a subscription?', a: 'It\'s a one-time purchase that unlocks ONE complete launch kit (business plan + 30-day calendar + branded landing page + marketing playbook). Perfect if you just want to test the waters before committing. Yours to keep forever.' },
            { q: 'Are the AI-generated business plans actually good?', a: 'Each plan is generated by GPT-5.2 personalized to your specific skills, schedule, and income goal. They include day-by-day actions, tools, marketing tactics, and revenue milestones. They\'re a starting point — not a magic guarantee — but they\'re vastly better than a generic template.' },
            { q: 'Can I cancel a subscription anytime?', a: 'Yes. Cancel in your profile or by emailing support. You keep access until the end of the billing period. We don\'t pro-rate but we don\'t play games either.' },
            { q: 'Do you take credit cards from outside the US?', a: 'Yes. Stripe processes Visa, Mastercard, Amex, and Discover from 40+ countries. All prices in USD.' },
            { q: 'Is my payment info secure?', a: 'Absolutely. All payments are processed directly by Stripe — we never see, touch, or store your card number. Stripe is PCI-DSS Level 1 certified.' },
          ].map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </View>

        <View style={styles.footerRow}>
          <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
          <Text style={styles.guaranteeText}>Secure checkout via Stripe · Cancel anytime</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// FAQ Item component (collapsible)
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setOpen(!open)}
      activeOpacity={0.7}
      testID={`faq-${q.slice(0, 20).replace(/\s/g, '-').toLowerCase()}`}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, maxWidth: 800, alignSelf: 'center', width: '100%' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  // Guarantee banner
  guaranteeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.growthGreenLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.growthGreen + '50' },
  guaranteeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  guaranteeTitle: { fontSize: 14, fontWeight: '800', color: Colors.growthGreenText },
  guaranteeSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  // Billing toggle
  billingToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  billingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  billingBtnActive: { backgroundColor: Colors.gold },
  billingText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  billingTextActive: { color: Colors.background },
  saveBadge: { backgroundColor: Colors.growthGreen, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.textOnColor, letterSpacing: 0.3 },
  // Promo
  promoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  promoInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.border },
  promoInputWrapValid: { borderColor: Colors.growthGreen, backgroundColor: Colors.growthGreenLight },
  promoInputWrapInvalid: { borderColor: '#ef4444' },
  promoInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  promoApplyBtn: { backgroundColor: Colors.gold, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 10, minWidth: 80, alignItems: 'center' },
  promoApplyText: { fontSize: 13, fontWeight: '800', color: Colors.background },
  promoFeedback: { fontSize: 12, marginBottom: 10, marginLeft: 4, fontWeight: '600' },
  promoFeedbackValid: { color: Colors.growthGreenText },
  promoFeedbackInvalid: { color: '#ef4444' },
  // Plan card
  planCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  planCardPopular: { borderColor: Colors.trustBlue, borderWidth: 2 },
  planCardCurrent: { borderColor: Colors.growthGreen, borderWidth: 1.5 },
  planCardEmpire: { borderColor: Colors.orangeCTA, borderWidth: 2 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.trustBlue, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  popularText: { fontSize: 11, fontWeight: '700', color: Colors.textOnColor },
  empireBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orangeCTA, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  empireText: { fontSize: 11, fontWeight: '700', color: Colors.textOnColor },
  planHeader: { marginBottom: 10 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  priceCrossed: { fontSize: 16, color: Colors.textTertiary, textDecorationLine: 'line-through', fontWeight: '600' },
  planPrice: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary },
  planPeriod: { fontSize: 13, color: Colors.textSecondary },
  discountPill: { alignSelf: 'flex-start', backgroundColor: Colors.orangeLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  discountPillText: { fontSize: 11, fontWeight: '800', color: Colors.gold },
  annualTotal: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600', marginTop: 4 },
  headlineBadge: { backgroundColor: Colors.trustBlueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  headlineText: { fontSize: 13, fontWeight: '700', color: Colors.trustBlue },
  featuresList: { gap: 7, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  featureRowAI: { backgroundColor: Colors.orangeLight, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, marginVertical: 2 },
  featureText: { fontSize: 13, color: Colors.textPrimary, flex: 1 },
  featureTextAI: { color: Colors.gold, fontWeight: '700' },
  featureTextGuarantee: { color: Colors.growthGreenText, fontWeight: '700' },
  lockedText: { fontSize: 13, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  currentBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.growthGreenLight },
  currentText: { fontSize: 14, fontWeight: '700', color: Colors.growthGreen },
  upgradeBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.trustBlue },
  upgradeBtnPopular: { backgroundColor: Colors.orangeCTA },
  upgradeBtnEmpire: { backgroundColor: Colors.orangeCTA },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textOnColor },
  // À la carte
  alacarteSection: { marginTop: 4, marginBottom: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase' },
  alacarteRow: { flexDirection: 'row', gap: 10 },
  alacarteCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' as any },
  alacarteNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginBottom: 12 },
  alacarteTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  alacartePrice: { fontSize: 22, fontWeight: '800', color: Colors.orangeCTA },
  alacartePer: { fontSize: 11, color: Colors.textTertiary },
  agentPack: { backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.gold + '40', borderRadius: 14, padding: 18, marginTop: 14, position: 'relative' as any },
  agentPackBadge: { position: 'absolute' as any, top: -10, right: 14, backgroundColor: Colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  agentPackBadgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  agentPackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentPackIcons: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  agentPackTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  agentPackSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  agentPackOld: { fontSize: 14, color: Colors.textTertiary, textDecorationLine: 'line-through' as any },
  agentPackPrice: { fontSize: 24, fontWeight: '900', color: Colors.gold },
  agentPackMo: { fontSize: 14, fontWeight: '600' },
  valueNudge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, backgroundColor: Colors.orangeLight, padding: 12, borderRadius: 10 },
  valueNudgeText: { fontSize: 12, color: Colors.gold, flex: 1, lineHeight: 17 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  guaranteeText: { fontSize: 12, color: Colors.textSecondary },
  // 🔥 Launch Stack
  launchStackHeader: { alignItems: 'center', marginTop: 6, marginBottom: 14 },
  launchStackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  launchStackBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  launchStackTitle: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
  launchStackSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },
  launchCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1.5 },
  launchCardLifetime: { borderColor: Colors.gold, backgroundColor: Colors.surfaceElevated },
  launchCardKit: { borderColor: Colors.trustBlue + '70' },
  launchCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  launchIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  launchCardTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  launchCardKicker: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  launchPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  launchPrice: { fontSize: 36, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  launchPriceCrossed: { fontSize: 14, color: Colors.textTertiary, textDecorationLine: 'line-through', fontWeight: '600' },
  launchOnce: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  seatsRow: { marginBottom: 14, gap: 6 },
  seatsBar: { height: 6, backgroundColor: Colors.border, borderRadius: 999, overflow: 'hidden' },
  seatsBarFill: { height: 6, backgroundColor: Colors.gold, borderRadius: 999 },
  seatsText: { fontSize: 11, fontWeight: '700', color: Colors.gold, letterSpacing: 0.3, textTransform: 'uppercase' },
  launchFeatures: { gap: 7, marginBottom: 14 },
  launchFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  launchFeatureText: { fontSize: 13, color: Colors.textPrimary, flex: 1, lineHeight: 18 },
  launchBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  launchBtnLifetime: { backgroundColor: Colors.gold },
  launchBtnTextLifetime: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.3 },
  launchBtnKit: { backgroundColor: Colors.trustBlue },
  launchBtnTextKit: { fontSize: 15, fontWeight: '800', color: Colors.textOnColor, letterSpacing: 0.3 },
  launchDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 14 },
  launchDividerText: { fontSize: 11, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1.5 },
  // FAQ
  faqSection: { marginTop: 24, marginBottom: 16 },
  faqTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.4, marginBottom: 14 },
  faqItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary, lineHeight: 19 },
  faqA: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 10 },
});
