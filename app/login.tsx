import { Ionicons } from '@expo/vector-icons'; // added
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { signIn } from '../src/services/authService'; // existing import

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // added
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            Alert.alert('Error', 'Email and password are required');
            return;
        }

        setLoading(true);
        const res = await signIn(username.trim(), password);
        setLoading(false);

        if (res.success) {
            if (res.offline) {
                Alert.alert(
                    'Login (offline)',
                    'Login successful, but profile data could not be retrieved because Firestore connection is offline. The app will function with limited features.',
                    [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
                );
            } else {
                Alert.alert('Success', 'Login successful', [
                    { text: 'OK', onPress: () => router.replace('/(tabs)') }
                ]);
            }
        } else {
            const message = res.error || 'Login failed';
            Alert.alert('Error', message);
        }
    };

    useEffect(() => {
        const handleRejection = (err: any) => {
            const msg = err?.reason?.message || err?.message || (typeof err === 'string' ? err : '');
            if (typeof msg === 'string' && msg.includes('Unable to activate keep awake')) {
                console.warn('Ignored keep-awake error:', msg);
                return;
            }
            // default logging for other errors
            console.error('Unhandled rejection:', err);
        };

        // Node/process style
        try {
            if ((global as any).process && typeof (global as any).process.on === 'function') {
                (global as any).process.on('unhandledRejection', handleRejection);
            }
        } catch { }

        // window/addEventListener style (if available)
        try {
            (globalThis as any).addEventListener?.('unhandledrejection', (ev: any) => handleRejection(ev));
        } catch { }

        // Try to patch expo-keep-awake activate to avoid throwing
        try {
            // @ts-ignore
            const keepAwake = require('expo-keep-awake');
            if (keepAwake && typeof keepAwake.activateKeepAwake === 'function') {
                const orig = keepAwake.activateKeepAwake.bind(keepAwake);
                keepAwake.activateKeepAwake = (...args: any[]) => {
                    try {
                        return orig(...args);
                    } catch (e: any) {
                        if (e?.message?.includes('Unable to activate keep awake')) {
                            console.warn('Ignored activateKeepAwake error');
                            return;
                        }
                        throw e;
                    }
                };
            }
        } catch { }

        return () => {
            try {
                (global as any).process?.off?.('unhandledRejection', handleRejection);
            } catch { }
        };
    }, []);

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <View className="flex-1 bg-white">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center px-8"
                >
                    <Text className="text-[#4fc3f7] text-3xl font-bold mb-12 text-center">LOGIN</Text>

                    <View className="mb-6">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Email</Text>
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

                    <View className="mb-2">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Password</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#4fc3f7', paddingVertical: 6 }}>
                            <TextInput
                                style={{ flex: 1, color: '#111827', fontSize: 16, paddingVertical: 6 }}
                                placeholder="••••••••••"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 8 }}>
                                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#4fc3f7" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity className="self-end mb-8">
                        <Text className="text-[#4fc3f7] text-sm">Forgot your password</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleLogin}
                        className="bg-[#4fc3f7] rounded-full py-4 items-center mb-6 shadow-lg"
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-bold text-base">LOGIN</Text>
                        )}
                    </TouchableOpacity>

                    <View className="flex-row justify-center">
                        <Text className="text-gray-600 text-sm">Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/register')}>
                            <Text className="text-[#4fc3f7] text-sm font-semibold">Sign up</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </>
    );
}
