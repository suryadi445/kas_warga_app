import { Slot, usePathname, useRouter } from 'expo-router';
import { collection, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../src/firebaseConfig';
import { startNotificationListeners } from '../../src/services/NotificationService';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() ?? '';
    const insets = useSafeAreaInsets();

    // NEW: state for unread notifications count
    const [unreadCount, setUnreadCount] = React.useState(0);

    // NEW: start notification service on mount (background listener)
    useEffect(() => {
        const cleanup = startNotificationListeners();
        return cleanup;
    }, []);

    // NEW: listen to notifications collection for unread count
    useEffect(() => {
        let unsub: (() => void) | null = null;
        try {
            const q = query(collection(db, 'notifications'));
            unsub = onSnapshot(q, snap => {
                const unread = snap.docs.filter(d => {
                    const data = d.data() as any;
                    return !data.read;
                }).length;
                setUnreadCount(unread);
            }, err => {
                console.warn('notifications unread count err', err);
            });
        } catch (e) {
            console.error('Failed to listen notifications unread count:', e);
        }
        return () => { if (unsub) unsub(); };
    }, []);

    const tabs = [
        { id: 'home', label: 'Home', icon: '🏠', route: '/(tabs)/dashboard' },
        { id: 'menu', label: 'Menu', icon: '☰', route: '/(tabs)' },
        { id: 'notifications', label: 'Notifikasi', icon: '🔔', route: '/(tabs)/notifications', badge: unreadCount },
        { id: 'profile', label: 'Akun', icon: '👤', route: '/(tabs)/profile' },
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
                {tabs.map((t) => {
                    const active = isActive(t.route);
                    return (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => router.push(t.route as any)}
                            style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}
                            activeOpacity={0.8}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <Text style={{ fontSize: 20, lineHeight: 24 }}>{t.icon}</Text>
                                {/* Badge for unread count */}
                                {t.id === 'notifications' && unreadCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -8,
                                        backgroundColor: '#EF4444',
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
                                            {unreadCount > 99 ? '99+' : unreadCount}
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
                                    {t.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}
