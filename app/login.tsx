import { Ionicons } from '@expo/vector-icons'; // added
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // added
    const router = useRouter();

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert('Error', 'Username dan password harus diisi');
            return;
        }

        if (username === 'admin' && password === 'admin') {
            router.replace('/(tabs)');
        } else {
            Alert.alert('Error', 'Username atau password salah');
        }
    };

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <View className="flex-1 bg-white">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center px-8"
                >
                    {/* Title */}
                    <Text className="text-[#4fc3f7] text-3xl font-bold mb-12 text-center">LOGIN</Text>

                    {/* Username Input */}
                    <View className="mb-6">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Username</Text>
                        <TextInput
                            className="border-b-2 border-[#4fc3f7] py-3 text-gray-800 text-base"
                            placeholder="example@email.com"
                            placeholderTextColor="#999"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Password Input */}
                    <View className="mb-2">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Password</Text>
                        <View className="relative">
                            <TextInput
                                className="border-b-2 border-[#4fc3f7] py-3 text-gray-800 text-base pr-10"
                                placeholder="••••••••••"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword} // changed
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((v) => !v)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 pr-2"
                                style={{ padding: 8 }}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye' : 'eye-off'}
                                    size={20}
                                    color="#4fc3f7"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Forgot Password Link */}
                    <TouchableOpacity className="self-end mb-8">
                        <Text className="text-[#4fc3f7] text-sm">Forgot your password</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleLogin}
                        className="bg-[#4fc3f7] rounded-full py-4 items-center mb-6 shadow-lg"
                    >
                        <Text className="text-white font-bold text-base">LOGIN</Text>
                    </TouchableOpacity>

                    {/* Sign Up Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gray-600 text-sm">Don't have an account? </Text>
                        <TouchableOpacity>
                            <Text className="text-[#4fc3f7] text-sm font-semibold">Sign up</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Demo Info - Optional */}
                    <View className="mt-12 bg-blue-50 p-3 rounded-lg">
                        <Text className="text-center text-blue-600 text-xs">
                            Demo: <Text className="font-bold">admin</Text> / <Text className="font-bold">admin</Text>
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </>
    );
}
