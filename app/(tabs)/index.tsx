import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


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
        const isSelected = item.id === selected;

        return (
            <View className="mx-6 my-3">
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                        setSelected(item.id);
                        if (item.id === 'dashboard') {
                            router.push('/(tabs)/dashboard');
                        }
                        // navigasi ke layar users atau cash_reports bila dipilih
                        if (item.id === 'users') {
                            router.push('/(tabs)/users');
                        }
                        if (item.id === 'cash_reports') {
                            router.push('/(tabs)/cash_reports');
                        }
                        if (item.id === 'announcements') {
                            router.push('/(tabs)/announcements');
                        }
                        if (item.id === 'activities') {
                            router.push('/(tabs)/activities');
                        }
                        if (item.id === 'scheduler') {
                            router.push('/(tabs)/scheduler');
                        }
                        if (item.id === 'documentation') {
                            router.push('/(tabs)/documentation');
                        }
                        if (item.id === 'organization') {
                            router.push('/(tabs)/organization');
                        }
                        if (item.id === 'settings') {
                            router.push('/(tabs)/settings');
                        }
                        if (item.id === 'prayer') {
                            router.push('/(tabs)/prayer');
                        }
                        if (item.id === 'developer') {
                            router.push('/(tabs)/developer');
                        }
                        // router.push(`/(tabs)/${item.id}`); // contoh navigasi untuk item lain
                    }}
                    style={{ borderRadius: 999 }}
                >
                    {isSelected ? (
                        <LinearGradient
                            colors={['#6366f1', '#8b5cf6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="rounded-full px-6 py-4 flex-row items-center justify-between"
                            style={{ elevation: 6 }}
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-4">
                                    <Text className="text-xl"> {item.icon} </Text>
                                </View>
                                <Text className="text-white font-semibold text-base">{item.label}</Text>
                            </View>
                            <View className="bg-white/20 p-2 rounded-full">
                                <Text className="text-white">›</Text>
                            </View>
                        </LinearGradient>
                    ) : (
                        <View
                            className="rounded-full px-6 py-4 flex-row items-center justify-between"
                            style={{
                                backgroundColor: '#F3F4F6', // light grey pill
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOpacity: 0.05,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 3 },
                            }}
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-full bg-white items-center justify-center mr-4">
                                    <Text className="text-xl">{item.icon}</Text>
                                </View>
                                <Text className="text-gray-800 font-medium text-base">{item.label}</Text>
                            </View>
                            <View className="bg-white p-2 rounded-full">
                                <Text className="text-gray-500">›</Text>
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View
                className="px-6 pt-6 pb-4 items-center"
                style={{
                    position: 'relative',
                    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 24 : 24,
                }}
            >
                <View
                    className="w-20 h-20 bg-[#4fc3f7] rounded-full items-center justify-center mb-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <Text className="text-white text-3xl">🕌</Text>
                </View>
                <Text className="text-[#4fc3f7] text-2xl font-bold">Kas Masjid Ar Rahman</Text>
                <Text className="text-gray-500 text-sm" style={{ textAlign: 'center', marginTop: 4 }}>
                    Management application for cash, activities, and mosque or community information.
                    Use the menu below to access cash, schedule, announcements, documentation, and more.
                </Text>

                {/* profile icon top-right - navigate to profile page */}
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/profile')}
                    accessibilityLabel="Open profile"
                    style={{
                        position: 'absolute',
                        right: 16,
                        // use StatusBar height on Android to avoid overlapping the system bar
                        top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
                    }}
                >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
                        <Text style={{ fontSize: 18 }}>👤</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* profile page handled in /(tabs)/profile */}

            {/* List */}
            <FlatList
                data={MENU_ITEMS}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}
