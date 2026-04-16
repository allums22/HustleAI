import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('session_token');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string, referralCode?: string) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, referral_code: referralCode || null }) }),
  login: (email: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  exchangeSession: (sessionId: string) => request(`/api/auth/session?session_id=${sessionId}`),
  getMe: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // Questionnaire
  getQuestions: () => request('/api/questionnaire/questions'),
  submitQuestionnaire: (data: any) => request('/api/questionnaire/submit', { method: 'POST', body: JSON.stringify(data) }),

  // Hustles
  generateHustles: () => request('/api/hustles/generate', { method: 'POST' }),
  getHustles: () => request('/api/hustles'),
  getHustleDetail: (id: string) => request(`/api/hustles/${id}`),
  selectHustle: (id: string) => request(`/api/hustles/${id}/select`, { method: 'POST' }),

  // Plans
  checkPlanAccess: (hustleId: string) => request(`/api/plans/access/${hustleId}`),
  generatePlan: (hustleId: string) => request(`/api/plans/generate/${hustleId}`, { method: 'POST' }),
  getPlan: (hustleId: string) => request(`/api/plans/${hustleId}`),
  getGenerationStatus: (jobId: string) => request(`/api/generation/status/${jobId}`),

  // Launch Kits
  checkKitAccess: (hustleId: string) => request(`/api/launch-kit/access/${hustleId}`),
  generateKit: (hustleId: string) => request(`/api/launch-kit/generate/${hustleId}`, { method: 'POST' }),
  getKit: (hustleId: string) => request(`/api/launch-kit/${hustleId}`),

  // Referral
  getReferralInfo: () => request('/api/referral/info'),

  // Tasks & Progress
  completeTask: (hustleId: string, day: number, taskIndex: number, completed: boolean) =>
    request(`/api/tasks/${hustleId}/complete`, { method: 'POST', body: JSON.stringify({ day, task_index: taskIndex, completed }) }),
  getTaskProgress: (hustleId: string) => request(`/api/tasks/${hustleId}/progress`),
  getStreak: () => request('/api/tasks/streak'),

  // Earnings
  logEarning: (data: { amount: number; hustle_id?: string; note?: string; date?: string }) =>
    request('/api/earnings/log', { method: 'POST', body: JSON.stringify(data) }),
  getEarnings: () => request('/api/earnings'),
  getEarningsSummary: () => request('/api/earnings/summary'),

  // Achievements
  getAchievements: () => request('/api/achievements'),

  // Community
  createPost: (data: { content: string; milestone?: string; amount?: number }) =>
    request('/api/community/posts', { method: 'POST', body: JSON.stringify(data) }),
  getCommunityPosts: () => request('/api/community/posts'),
  reactToPost: (postId: string) => request(`/api/community/posts/${postId}/react`, { method: 'POST' }),

  // Motivation
  getDailyMotivation: () => request('/api/motivation/daily'),

  // AI Mentor
  mentorChat: (hustleId: string, message: string) =>
    request(`/api/mentor/${hustleId}/chat`, { method: 'POST', body: JSON.stringify({ message }) }),

  // Landing Page Customization
  customizeLandingPage: (hustleId: string, data: { email?: string; phone?: string; name?: string; website?: string; instagram?: string; facebook?: string }) =>
    request(`/api/launch-kit/${hustleId}/customize`, { method: 'PUT', body: JSON.stringify(data) }),

  // Profile
  updatePhone: (phone: string) =>
    request('/api/profile/phone', { method: 'PUT', body: JSON.stringify({ phone }) }),

  // Public Stats
  getPublicStats: () => fetch(`${BACKEND_URL}/api/stats/public`).then(r => r.json()),

  // Payments
  createCheckout: (plan: string, originUrl: string, hustleId?: string) =>
    request('/api/payments/create-checkout', { method: 'POST', body: JSON.stringify({ plan, origin_url: originUrl, hustle_id: hustleId || null }) }),
  getPaymentStatus: (sessionId: string) => request(`/api/payments/status/${sessionId}`),

  // Profile
  getProfile: () => request('/api/profile'),
  getTiers: () => request('/api/subscription/tiers'),

  // Promo Code
  redeemPromo: (code: string) =>
    request('/api/promo/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
};
