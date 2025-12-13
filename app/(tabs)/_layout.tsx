import { Slot, usePathname, useRouter } from 'expo-router';
import { collection, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../src/firebaseConfig';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { startNotificationListeners } from '../../src/services/NotificationService';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() ?? '';
    const insets = useSafeAreaInsets();

    // NEW: state for unread notifications count
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const { t: translate } = useTranslation();

    // NEW: get dashboard data for badge count
    const { cash, announcements, schedules, activities } = useDashboardData(0, currentUserId);
    const dashboardBadgeCount = cash.length + announcements.length + schedules.length + activities.length;

    // Get current user and listen for auth changes; ensures listeners start only when user is available
    useEffect(() => {
        let mounted = true;
        const unsubscribe = auth.onAuthStateChanged((user: any) => {
            if (!mounted) return;
            setCurrentUserId(user ? user.uid : null);
        });
        return () => { mounted = false; unsubscribe(); };
    }, []);

    // NEW: start notification service on mount (background listener)
    useEffect(() => {
        // Start notification service only when user is available
        if (!currentUserId) return;
        const cleanup = startNotificationListeners();
        return cleanup;
    }, [currentUserId]);

    // NEW: listen to notifications collection for unread count
    useEffect(() => {
        if (!currentUserId) return; // Wait for user ID

        let unsub: (() => void) | null = null;
        try {
            const q = query(collection(db, 'notifications'));
            unsub = onSnapshot(q, snap => {
                const unread = snap.docs.filter(d => {
                    const data = d.data() as any;
                    // Check per-user read status (readBy array)
                    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
                    // Unread if user ID is NOT in readBy array
                    return !readBy.includes(currentUserId);
                }).length;
                setUnreadCount(unread);
            }, err => {
                console.warn('notifications unread count err', err);
            });
        } catch (e) {
            console.error('Failed to listen notifications unread count:', e);
        }
        return () => { if (unsub) unsub(); };
    }, [currentUserId]); // Re-run when user ID changes

    const tabs = [
        { id: 'dashboard', label: translate('menu_dashboard'), icon: '🗂️', route: '/(tabs)/dashboard', badge: dashboardBadgeCount },
        { id: 'home', label: translate('menu_home'), icon: '🏠', route: '/(tabs)' },
        { id: 'notifications', label: translate('menu_notifications'), icon: '🔔', route: '/(tabs)/notifications', badge: unreadCount },
        { id: 'profile', label: translate('menu_profile'), icon: '👤', route: '/(tabs)/profile' },
    ];

    const isActive = (route: string) => {
        // treat root /(tabs) as menu
        if (route === '/(tabs)' && (pathname === '/' || pathname.startsWith('/(tabs)') && pathname === '/(tabs)')) return true;
        return pathname.startsWith(route);
    };

    // CONTENT_HEIGHT: tinggi area yang digunakan untuk ikon + label (tidak termasuk safe-area inset)
    const CONTENT_HEIGHT = Platform.OS === 'ios' ? 64 : 56;
    // only use safe-area inset for container padding bottom so there's no extra gap
    const safeInsetBottom = insets.bottom || (Platform.OS === 'ios' ? 16 : 4);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {/* keep container full-height but only reserve safe inset at bottom (no extra gap) */}
            <View style={{ flex: 1, paddingBottom: safeInsetBottom }}>
                {/* render child screen via expo-router Slot */}
                <Slot />
            </View>

            {/* bottom tab bar - fixed (anchor to bottom:0, height includes safe inset) */}
            <View
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0, // fixed to screen bottom
                    height: CONTENT_HEIGHT + safeInsetBottom, // content height + safe inset
                    backgroundColor: '#fff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    // use safeInsetBottom for internal padding so icons are above system nav
                    paddingBottom: safeInsetBottom,
                    paddingTop: Math.max(4, (CONTENT_HEIGHT - 40) / 2), // small top spacing
                    elevation: 12,
                    zIndex: 999,
                }}
            >
                {tabs.map((tab) => {
                    const active = isActive(tab.route);
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => router.push(tab.route as any)}
                            style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}
                            activeOpacity={0.8}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {/* Icon: always render string icons inside Text to avoid raw text outside <Text> */}
                                {typeof tab.icon === 'string' ? (
                                    <Text style={{ fontSize: 20, lineHeight: 24 }}>{tab.icon}</Text>
                                ) : React.isValidElement(tab.icon) ? (
                                    tab.icon
                                ) : (
                                    // Fallback: render label first character as icon
                                    <Text style={{ fontSize: 20, lineHeight: 24 }}>{String(tab.label).charAt(0)}</Text>
                                )}

                                {/* Badge: show small number bubble when > 0 */}
                                {typeof tab.badge === 'number' && tab.badge > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -12,
                                        backgroundColor: tab.id === 'dashboard' ? '#6366f1' : '#EF4444',
                                        borderRadius: 10,
                                        minWidth: 20,
                                        height: 20,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: 5,
                                        borderWidth: 2,
                                        borderColor: '#fff',
                                    }}>
                                        <Text style={{
                                            color: '#fff',
                                            fontSize: 11,
                                            fontWeight: '700',
                                        }}>
                                            {tab.badge > 99 ? '99+' : String(tab.badge)}
                                        </Text>
                                    </View>
                                )}

                                <Text
                                    style={{
                                        fontSize: 12,
                                        marginTop: 4,
                                        color: active ? '#6366f1' : '#6B7280',
                                        fontWeight: active ? '700' : '500',
                                    }}
                                >
                                    {String(tab.label)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}
