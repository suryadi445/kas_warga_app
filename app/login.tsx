import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../src/contexts/ToastContext';
import { signIn } from '../src/services/authService';

export default function LoginScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const [email, setEmail] = useState('suryadi.hhb@gmail.com');
    const [password, setPassword] = useState('11111111');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleLogin() {
        if (!email.trim() || !password.trim()) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            setLoading(true);
            await signIn(email, password);
            showToast('Login successful!', 'success');
            router.replace('/(tabs)/dashboard');
        } catch (error: any) {
            showToast(error.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#6366f1' }}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Full Screen Gradient Background */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo/Icon Section - Compact */}
                        <View style={{ alignItems: 'center', marginBottom: 24 }}>
                            <View style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12,
                                borderWidth: 3,
                                borderColor: 'rgba(255,255,255,0.3)',
                            }}>
                                <Text style={{ fontSize: 40 }}>💰</Text>
                            </View>
                            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
                                Kas Warga
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center' }}>
                                Manage your community finances
                            </Text>
                        </View>

                        {/* Login Card - Compact */}
                        <View style={{
                            backgroundColor: '#fff',
                            borderRadius: 24,
                            padding: 20,
                            elevation: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.2,
                            shadowRadius: 16,
                        }}>
                            <Text style={{ fontSize: 22, textAlign: 'center', fontWeight: '800', color: '#111827', marginBottom: 26 }}>
                                Welcome Back
                            </Text>

                            {/* Email Input - Compact */}
                            <View style={{ marginBottom: 14 }}>
                                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                                    Email Address
                                </Text>
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    backgroundColor: '#F9FAFB',
                                }}>
                                    <Text style={{ fontSize: 16, marginRight: 6 }}>📧</Text>
                                    <TextInput
                                        value={email}
                                        onChangeText={setEmail}
                                        placeholder="your.email@example.com"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            fontSize: 14,
                                            color: '#111827',
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Password Input - Compact */}
                            <View style={{ marginBottom: 18 }}>
                                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                                    Password
                                </Text>
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    backgroundColor: '#F9FAFB',
                                }}>
                                    <Text style={{ fontSize: 16, marginRight: 6 }}>🔒</Text>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Enter your password"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry={!showPassword}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            fontSize: 14,
                                            color: '#111827',
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={{ padding: 4 }}
                                    >
                                        <Text style={{ fontSize: 16 }}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Login Button - Compact */}
                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.8}
                                style={{ marginBottom: 14 }}
                            >
                                <LinearGradient
                                    colors={['#6366f1', '#8b5cf6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        elevation: 4,
                                        shadowColor: '#6366f1',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                    }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                            Sign In
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Divider - Compact */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                                <Text style={{ marginHorizontal: 10, color: '#9CA3AF', fontSize: 12 }}>OR</Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                            </View>

                            {/* Register Link - Compact */}
                            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                                <Text style={{ color: '#6B7280', fontSize: 13 }}>Don't have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/register')}>
                                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 13 }}>
                                        Sign Up
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Footer - Compact */}
                        <Text style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 11,
                            textAlign: 'center',
                            marginTop: 20
                        }}>
                            <Text>© {new Date().getFullYear()} Kas Warga. All rights reserved.</Text>
                        </Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
}
