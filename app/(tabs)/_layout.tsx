import { Slot, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() ?? '';
    const insets = useSafeAreaInsets();

    const tabs = [
        { id: 'home', label: 'Home', icon: '🏠', route: '/(tabs)/dashboard' },
        { id: 'menu', label: 'Menu', icon: '☰', route: '/(tabs)' },
        { id: 'notifications', label: 'Notifikasi', icon: '🔔', route: '/(tabs)/notifications' },
        { id: 'profile', label: 'Akun', icon: '👤', route: '/(tabs)/profile' },
    ];

    const isActive = (route: string) => {
        // treat root /(tabs) as menu
        if (route === '/(tabs)' && (pathname === '/' || pathname.startsWith('/(tabs)') && pathname === '/(tabs)')) return true;
        return pathname.startsWith(route);
    };

    const TAB_HEIGHT = Platform.OS === 'ios' ? 70 : 60;
    const bottomOffset = insets.bottom || (Platform.OS === 'ios' ? 16 : 4);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <View style={{ flex: 1, paddingBottom: TAB_HEIGHT + bottomOffset }}>
                    {/* render child screen via expo-router Slot */}
                    <Slot />
                </View>
            </SafeAreaView>

            {/* bottom tab bar - fixed */}
            <View
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: bottomOffset,
                    height: TAB_HEIGHT,
                    backgroundColor: '#fff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    paddingBottom: bottomOffset,
                    paddingTop: 6,
                    elevation: 0,
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
                            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                <Text style={{ fontSize: 20, lineHeight: 24 }}>{t.icon}</Text>
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
        </View>
    );
}
