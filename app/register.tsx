import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { signUp } from '../src/services/authService';

export default function RegisterScreen() {
    const router = useRouter();
    const [nama, setNama] = useState('suryadi');
    const [email, setEmail] = useState('suryadi.hhb@gmail.com');
    const [phone, setPhone] = useState('089678468651');
    const [password, setPassword] = useState('11111111');
    const [confirmPassword, setConfirmPassword] = useState('11111111');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleRejection = (err: any) => {
            const msg = err?.reason?.message || err?.message || (typeof err === 'string' ? err : '');
            if (typeof msg === 'string' && msg.includes('Unable to activate keep awake')) {
                console.warn('Ignored keep-awake error:', msg);
                return;
            }
            console.error('Unhandled rejection:', err);
        };

        try {
            if ((global as any).process && typeof (global as any).process.on === 'function') {
                (global as any).process.on('unhandledRejection', handleRejection);
            }
        } catch { }

        try {
            (globalThis as any).addEventListener?.('unhandledrejection', (ev: any) => handleRejection(ev));
        } catch { }

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

    const handleRegister = async () => {
        if (!nama.trim() || !email.trim() || !password) {
            Alert.alert('Error', 'Nama, email, dan password wajib diisi');
            return;
        }
        if (password.length < 8) {
            Alert.alert('Error', 'Password minimal 8 karakter');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Password dan konfirmasi tidak cocok');
            return;
        }

        setLoading(true);
        const res = await signUp(email.trim(), password, nama.trim(), phone.trim());
        setLoading(false);

        if (res.success) {
            Alert.alert('Sukses', 'Registrasi berhasil', [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
        } else {
            // Jika email sudah dipakai, tawarkan untuk pergi ke login
            if (res.code === 'auth/email-already-in-use') {
                Alert.alert('Error', res.error || 'Email sudah terdaftar', [
                    { text: 'Login', onPress: () => router.push('/login') },
                    { text: 'OK' }
                ]);
            } else {
                const msg = res.error || 'Registrasi gagal';
                Alert.alert('Error', msg);
            }
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
                    <Text className="text-[#4fc3f7] text-3xl font-bold mb-8 text-center">REGISTER</Text>

                    <View className="mb-4">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Nama</Text>
                        <TextInput
                            className="border-b-2 border-[#4fc3f7] py-3 text-gray-800 text-base"
                            placeholder="Nama lengkap"
                            placeholderTextColor="#999"
                            value={nama}
                            onChangeText={setNama}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Email</Text>
                        <TextInput
                            className="border-b-2 border-[#4fc3f7] py-3 text-gray-800 text-base"
                            placeholder="email@contoh.com"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-[#4fc3f7] text-sm mb-2">No HP</Text>
                        <TextInput
                            className="border-b-2 border-[#4fc3f7] py-3 text-gray-800 text-base"
                            placeholder="08xxxxxxxxxx"
                            placeholderTextColor="#999"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Password</Text>

                        {/* changed: row layout for aligned icon */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#4fc3f7', paddingVertical: 6 }}>
                            <TextInput
                                style={{ flex: 1, color: '#111827', fontSize: 16, paddingVertical: 6 }}
                                placeholder="Minimal 8 karakter"
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

                    <View className="mb-6">
                        <Text className="text-[#4fc3f7] text-sm mb-2">Konfirmasi Password</Text>

                        {/* changed: row layout for aligned icon */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#4fc3f7', paddingVertical: 6 }}>
                            <TextInput
                                style={{ flex: 1, color: '#111827', fontSize: 16, paddingVertical: 6 }}
                                placeholder="Ulangi password"
                                placeholderTextColor="#999"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 8 }}>
                                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#4fc3f7" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleRegister}
                        className="bg-[#4fc3f7] rounded-full py-4 items-center mb-4 shadow-lg"
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">DAFTAR</Text>}
                    </TouchableOpacity>

                    <View className="flex-row justify-center">
                        <Text className="text-gray-600 text-sm">Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/login')}>
                            <Text className="text-[#4fc3f7] text-sm font-semibold">Login</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </>
    );
}
