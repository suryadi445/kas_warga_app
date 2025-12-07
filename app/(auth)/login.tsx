// app/(auth)/login.js

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert(t('login_title'), t('please_fill_all_fields'));
            return;
        }

        if (username === 'admin' && password === 'admin') {
            router.replace('/(tabs)');
        } else {
            Alert.alert(t('login_title'), 'Username atau password salah');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-blue-50"
        >
            <View className="flex-1 justify-center px-8">
                <View className="items-center mb-12">
                    <Text className="text-4xl font-bold text-blue-600 mb-2">Community App</Text>
                    <Text className="text-gray-600 text-base">Sistem Manajemen Keuangan RT</Text>
                </View>

                <View className="bg-white rounded-2xl shadow-lg p-6">
                    <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('login_title')}</Text>

                    <View className="mb-4">
                        <Text className="text-gray-700 mb-2 font-medium">{t('username')}</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
                            placeholder={t('username') === 'Username' ? 'Masukkan username' : t('username')}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    <View className="mb-6">
                        <Text className="text-gray-700 mb-2 font-medium">{t('password')}</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
                            placeholder={t('password') === 'Password' ? 'Masukkan password' : t('password')}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        className="bg-blue-600 rounded-lg py-4 items-center shadow-md active:bg-blue-700"
                        onPress={handleLogin}
                    >
                        <Text className="text-white font-bold text-lg">{t('login_button')}</Text>
                    </TouchableOpacity>

                    <View className="mt-6 p-3 bg-blue-50 rounded-lg">
                        <Text className="text-xs text-gray-600 text-center">
                            {t('demo_credentials')}
                        </Text>
                    </View>
                </View>

                <Text className="text-center text-gray-500 text-sm mt-8">
                    © 2024 Community App. All rights reserved.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}