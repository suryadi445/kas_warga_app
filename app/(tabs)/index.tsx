import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { signOut } from '../../src/services/authService';


const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'cash_reports', label: 'Cash Reports', icon: '💰' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'activities', label: 'Activities', icon: '🗓️' },
    { id: 'scheduler', label: 'Scheduler', icon: '📅' },
    { id: 'documentation', label: 'Documentation', icon: '📸' },
    { id: 'organization', label: 'Organization', icon: '🏛️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'prayer', label: 'Prayer', icon: '🕋' },
    { id: 'developer', label: 'Developer', icon: '🧑‍💻' },
];

export default function TabsIndex() {
    const router = useRouter();
    const [selected, setSelected] = useState('cash_reports'); // default selected
    const { showToast } = useToast();
    const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
    const [appName, setAppName] = useState('Community App'); // default app name
    const [appImage, setAppImage] = useState<string | undefined>(undefined);
    const [appDescription, setAppDescription] = useState(
        'Management application for cash, activities, and mosque or community information. Use the menu below to access cash, schedule, announcements, documentation, and more.'
    );

    // number of columns for compact menu grid
    const NUM_COLUMNS = 4;

    // load app name from settings
    useEffect(() => {
        let unsub: (() => void) | null = null;
        (async () => {
            try {
                const ref = doc(db, 'settings', 'app');
                unsub = onSnapshot(ref, (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.appName) setAppName(data.appName);
                        if (data.appImage) setAppImage(data.appImage);
                        if (data.appDescription) setAppDescription(data.appDescription);
                    }
                }, (err) => {
                    console.warn('settings onSnapshot error', err);
                });
            } catch (e) {
                console.warn('Failed to load app name from settings', e);
            }
        })();
        return () => { if (unsub) unsub(); };
    }, []);

    // get device location once and store for other pages (e.g. Prayer)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!mounted || !pos?.coords) return;
                const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                await AsyncStorage.setItem('deviceLocation', JSON.stringify(loc));
            } catch {
                // ignore errors
            }
        })();
        return () => { mounted = false; };
    }, []);

    const renderItem = ({ item }: { item: { id: string; label: string; icon?: string } }) => {
        // Small square tile for compact grid menu
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                    setSelected(item.id);
                    // simple routing map
                    const map: Record<string, string> = {
                        dashboard: '/(tabs)/dashboard',
                        users: '/(tabs)/users',
                        cash_reports: '/(tabs)/cash_reports',
                        announcements: '/(tabs)/announcements',
                        activities: '/(tabs)/activities',
                        scheduler: '/(tabs)/scheduler',
                        documentation: '/(tabs)/documentation',
                        organization: '/(tabs)/organization',
                        settings: '/(tabs)/settings',
                        prayer: '/(tabs)/prayer',
                        developer: '/(tabs)/developer',
                    };
                    const route = map[item.id];
                    if (route) router.push(route as any);
                }}
                style={{
                    flexBasis: '25%', // 4 columns
                    alignItems: 'center',
                    marginVertical: 8,
                }}
            >
                <View style={{ alignItems: 'center' }}>
                    <View
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 6,
                            elevation: 2,
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#374151', textAlign: 'center' }} numberOfLines={1}>
                        {item.label}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View
                className="px-6 pb-4 items-center"
            >
                <View
                    className="w-20 h-20 bg-[#4fc3f7] rounded-full items-center justify-center mb-3 shadow-lg"
                    style={{ elevation: 4, overflow: 'hidden' }}
                >
                    {appImage ? (
                        <Image source={{ uri: appImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                        <Text className="text-white text-3xl">🕌</Text>
                    )}
                </View>
                <Text className="text-[#4fc3f7] text-2xl font-bold">{appName}</Text>
                <Text className="text-gray-500 text-sm" style={{ textAlign: 'center', marginTop: 4 }}>
                    {appDescription}
                </Text>

                {/* top-right: Logout button (replaces profile icon) */}
                <TouchableOpacity
                    onPress={() => setLogoutConfirmVisible(true)}
                    accessibilityLabel="Logout"
                    style={{
                        position: 'absolute',
                        right: 16,
                    }}
                >
                    <View style={{ width: 40, height: 20, alignItems: 'center', justifyContent: 'center', borderColor: '#EF4444' }}>
                        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* logout confirm dialog */}
            <ConfirmDialog
                visible={logoutConfirmVisible}
                title="Logout"
                message="Are you sure you want to logout?"
                onConfirm={async () => {
                    setLogoutConfirmVisible(false);
                    try {
                        await signOut();
                        await AsyncStorage.removeItem('user');
                        router.replace('/login');
                    } catch (err: any) {
                        console.error('Logout failed', err);
                        showToast?.('Failed to logout. Please try again.', 'error');
                    }
                }}
                onCancel={() => setLogoutConfirmVisible(false)}
                confirmText="Logout"
                cancelText="Cancel"
            />

            {/* profile page handled in /(tabs)/profile */}

            {/* List */}
            <FlatList
                data={MENU_ITEMS}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                numColumns={4}
                contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}
