import { Platform } from 'react-native';
import { api } from './api';

/**
 * Web Push subscription helper.
 * Gracefully no-ops on native or unsupported browsers.
 */

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export const isPushSupported = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const subscribeToPush = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!isPushSupported()) return { ok: false, error: 'Push not supported on this device' };

  try {
    // Wait for SW to be ready
    const reg = await navigator.serviceWorker.ready;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Notifications denied' };
    }

    // Get VAPID public key
    let vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      try {
        const res: any = await api.request?.('/api/push/vapid-public-key') ??
                          await fetch('/api/push/vapid-public-key').then(r => r.json());
        vapidKey = res.public_key;
      } catch {}
    }
    if (!vapidKey) return { ok: false, error: 'No VAPID key' };

    // Subscribe
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Send subscription to backend
    const json = sub.toJSON();
    await api.subscribePush({
      endpoint: json.endpoint || '',
      keys: json.keys || {},
    });

    api.trackEvent('push_subscribed');
    return { ok: true };
  } catch (e: any) {
    console.error('Push subscription failed:', e);
    return { ok: false, error: e.message || 'Unknown error' };
  }
};

export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      await sub.unsubscribe();
      await api.unsubscribePush({
        endpoint: json.endpoint || '',
        keys: json.keys || {},
      });
    }
    return true;
  } catch {
    return false;
  }
};
