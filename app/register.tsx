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
import { signUp } from '../src/services/authService';

export default function RegisterScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    async function handleRegister() {
        if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            setLoading(true);
            await signUp(email, password, name);
            showToast('Registration successful!', 'success');
            router.replace('/(tabs)/dashboard');
        } catch (error: any) {
            showToast(error.message || 'Registration failed', 'error');
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
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo/Icon Section - Compact */}
                        <View style={{ alignItems: 'center', marginBottom: 15 }}>
                            <View style={{
                                width: 70,
                                height: 70,
                                borderRadius: 35,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 8,
                                borderWidth: 3,
                                borderColor: 'rgba(255,255,255,0.3)',
                            }}>
                                <Text style={{ fontSize: 35 }}>✨</Text>
                            </View>
                            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
                                Join Kas Warga
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center' }}>
                                Create your account to get started
                            </Text>
                        </View>

                        {/* Register Card - Compact */}
                        <View style={{
                            backgroundColor: '#fff',
                            borderRadius: 24,
                            paddingHorizontal: 20,
                            paddingVertical: 15,
                            elevation: 12,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.2,
                            shadowRadius: 16,
                        }}>
                            <Text style={{ fontSize: 20, textAlign: 'center', fontWeight: '800', color: '#111827', marginBottom: 16 }}>
                                Create Account
                            </Text>

                            {/* Name Input - Compact */}
                            <View style={{ marginBottom: 12 }}>
                                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                                    Full Name
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
                                    <Text style={{ fontSize: 16, marginRight: 6 }}>👤</Text>
                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="Your full name"
                                        placeholderTextColor="#9CA3AF"
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            fontSize: 14,
                                            color: '#111827',
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Email Input - Compact */}
                            <View style={{ marginBottom: 12 }}>
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
                            <View style={{ marginBottom: 12 }}>
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
                                        placeholder="Min. 6 characters"
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

                            {/* Confirm Password Input - Compact */}
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                                    Confirm Password
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
                                    <Text style={{ fontSize: 16, marginRight: 6 }}>🔐</Text>
                                    <TextInput
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="Re-enter your password"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry={!showConfirmPassword}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            fontSize: 14,
                                            color: '#111827',
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ padding: 4 }}
                                    >
                                        <Text style={{ fontSize: 16 }}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Register Button - Compact */}
                            <TouchableOpacity
                                onPress={handleRegister}
                                disabled={loading}
                                activeOpacity={0.8}
                                style={{ marginBottom: 12 }}
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
                                            Create Account
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Divider - Compact */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                                <Text style={{ marginHorizontal: 10, color: '#9CA3AF', fontSize: 12 }}>OR</Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                            </View>

                            {/* Login Link - Compact */}
                            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                                <Text style={{ color: '#6B7280', fontSize: 13 }}>Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/login')}>
                                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 13 }}>
                                        Sign In
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Footer: moved outside white card so white text is visible on gradient */}
                        <Text style={{
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: 11,
                            textAlign: 'center',
                            marginTop: 16
                        }}>
                            © {new Date().getFullYear()} Kas Warga. All rights reserved.
                        </Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
}
