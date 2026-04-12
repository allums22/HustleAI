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
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail || text;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  exchangeSession: (sessionId: string) =>
    request(`/api/auth/session?session_id=${sessionId}`),
  getMe: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // Questionnaire
  getQuestions: () => request('/api/questionnaire/questions'),
  submitQuestionnaire: (data: any) =>
    request('/api/questionnaire/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Hustles
  generateHustles: () =>
    request('/api/hustles/generate', { method: 'POST' }),
  getHustles: () => request('/api/hustles'),
  getHustleDetail: (id: string) => request(`/api/hustles/${id}`),
  selectHustle: (id: string) =>
    request(`/api/hustles/${id}/select`, { method: 'POST' }),

  // Plans
  generatePlan: (hustleId: string) =>
    request(`/api/plans/generate/${hustleId}`, { method: 'POST' }),
  getPlan: (hustleId: string) => request(`/api/plans/${hustleId}`),

  // Payments
  createCheckout: (plan: string, originUrl: string) =>
    request('/api/payments/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, origin_url: originUrl }),
    }),
  getPaymentStatus: (sessionId: string) =>
    request(`/api/payments/status/${sessionId}`),

  // Profile
  getProfile: () => request('/api/profile'),
  getTiers: () => request('/api/subscription/tiers'),
};
