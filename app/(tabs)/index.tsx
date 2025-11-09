import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'cash_reports', label: 'Cash Reports', icon: '💰' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'activities', label: 'Activities', icon: '🗓️' },
    { id: 'scheduler', label: 'Scheduler', icon: '📅' },
    { id: 'organization', label: 'Organization', icon: '🏛️' }, // struktur organisasi
    { id: 'settings', label: 'Settings', icon: '⚙️' }, // settings
];

export default function TabsIndex() {
    const router = useRouter();
    const [selected, setSelected] = useState('cash_reports'); // default selected

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
                        if (item.id === 'organization') {
                            router.push('/(tabs)/organization');
                        }
                        if (item.id === 'settings') {
                            router.push('/(tabs)/settings');
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
            {/* Header - selaras dengan form login */}
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
                    <Text className="text-white text-2xl">💰</Text>
                </View>
                <Text className="text-[#4fc3f7] text-2xl font-bold">Kas Warga</Text>
                <Text className="text-gray-500 text-sm">Pilih modul untuk mulai</Text>

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
