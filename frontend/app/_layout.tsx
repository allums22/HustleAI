import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="beta-invite" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="nda" options={{ gestureEnabled: false }} />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="questionnaire" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hustle/[id]" />
        <Stack.Screen name="launch-page/[id]" />
        <Stack.Screen name="pricing" />
        <Stack.Screen name="payment-success" />
        <Stack.Screen name="feedback" />
      </Stack>
    </AuthProvider>
  );
}
