import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Tabs, Redirect, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/colors';

const SIDEBAR_WIDTH = 240;
const BREAKPOINT = 768;

const tabs = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { name: 'hustles', title: 'My Hustles', icon: 'rocket-outline', iconActive: 'rocket' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View style={styles.logoIcon}><Ionicons name="rocket" size={20} color={Colors.background} /></View>
        <Text style={styles.logoText}>HustleAI</Text>
      </View>

      <View style={styles.sidebarNav}>
        {tabs.map(tab => {
          const isActive = pathname.includes(tab.name);
          return (
            <TouchableOpacity
              key={tab.name}
              testID={`sidebar-${tab.name}`}
              style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
              onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={(isActive ? tab.iconActive : tab.icon) as any} size={20} color={isActive ? Colors.gold : Colors.textSecondary} />
              <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>{tab.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sidebarFooter}>
        <TouchableOpacity style={styles.sidebarUpgrade} onPress={() => router.push('/pricing')}>
          <Ionicons name="diamond" size={16} color={Colors.background} />
          <Text style={styles.sidebarUpgradeText}>Upgrade Plan</Text>
        </TouchableOpacity>
        <View style={styles.sidebarUser}>
          <View style={styles.sidebarAvatar}>
            <Text style={styles.sidebarAvatarText}>{(user?.name || 'U')[0]}</Text>
          </View>
          <Text style={styles.sidebarUserName} numberOfLines={1}>{user?.name}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= BREAKPOINT;

  if (loading) {
    return <View style={styles.loading}><Text style={styles.loadingText}>Loading...</Text></View>;
  }
  if (!user) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      {isDesktop && <SidebarNav />}
      <View style={[styles.content, isDesktop && { marginLeft: SIDEBAR_WIDTH }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.gold,
            tabBarInactiveTintColor: Colors.textTertiary,
            tabBarStyle: isDesktop ? { display: 'none' } : {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 4,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          {tabs.map(tab => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.title,
                tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon as any} size={size} color={color} />,
              }}
            />
          ))}
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  content: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, fontSize: 16 },
  // Sidebar
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border, position: 'absolute' as any, left: 0, top: 0, bottom: 0, zIndex: 10, paddingVertical: 20, paddingHorizontal: 16, justifyContent: 'flex-start' },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32, paddingHorizontal: 4 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  sidebarNav: { flex: 1, gap: 4 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  sidebarItemActive: { backgroundColor: Colors.orangeLight },
  sidebarLabel: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  sidebarLabelActive: { fontWeight: '700', color: Colors.gold },
  sidebarFooter: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  sidebarUpgrade: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, paddingVertical: 12, borderRadius: 10 },
  sidebarUpgradeText: { fontSize: 13, fontWeight: '700', color: Colors.background },
  sidebarUser: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sidebarAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.trustBlue, justifyContent: 'center', alignItems: 'center' },
  sidebarAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.textOnColor },
  sidebarUserName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
});
