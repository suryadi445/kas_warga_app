import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert('Error', 'Username dan password harus diisi');
            return;
        }

        // Simulasi login - ganti dengan logika autentikasi sebenarnya
        if (username === 'admin' && password === 'admin') {
            onLoginSuccess();
        } else {
            Alert.alert('Error', 'Username atau password salah');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-blue-50"
        >
            <View className="flex-1 justify-center px-8">
                {/* Header */}
                <View className="items-center mb-12">
                    <Text className="text-4xl font-bold text-blue-600 mb-2">Kas Warga</Text>
                    <Text className="text-gray-600 text-base">Sistem Manajemen Keuangan RT</Text>
                </View>

                {/* Form */}
                <View className="bg-white rounded-2xl shadow-lg p-6">
                    <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">Login</Text>

                    {/* Username Input */}
                    <View className="mb-4">
                        <Text className="text-gray-700 mb-2 font-medium">Username</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
                            placeholder="Masukkan username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password Input */}
                    <View className="mb-6">
                        <Text className="text-gray-700 mb-2 font-medium">Password</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
                            placeholder="Masukkan password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        className="bg-blue-600 rounded-lg py-4 items-center shadow-md active:bg-blue-700"
                        onPress={handleLogin}
                    >
                        <Text className="text-white font-bold text-lg">Masuk</Text>
                    </TouchableOpacity>

                    {/* Info */}
                    <View className="mt-6 p-3 bg-blue-50 rounded-lg">
                        <Text className="text-xs text-gray-600 text-center">
                            Demo: username: admin, password: admin
                        </Text>
                    </View>
                </View>

                {/* Footer */}
                <Text className="text-center text-gray-500 text-sm mt-8">
                    © 2024 Kas Warga. All rights reserved.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}
