import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LinearGradientModule from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../../src/contexts/ToastContext';

// safe LinearGradient reference (some environments export default, some named)
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

export default function DeveloperScreen() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const copyToClipboard = async (value: string) => {
        try {
            await Clipboard.setStringAsync(value);
            showToast(t('copied_to_clipboard', { defaultValue: 'Copied to clipboard' }), 'success');
        } catch (err) {
            showToast(t('failed_to_copy', { defaultValue: 'Failed to copy' }), 'error');
        }
    };
    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#6366f1' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Full Screen Gradient Background */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 20 }}
                >
                    {/* Avatar Section - Outside Card */}
                    <View style={{ alignItems: 'center', marginBottom: 10 }}>
                        <View style={{
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            backgroundColor: 'black',
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.12,
                            shadowRadius: 4,
                            padding: 2,
                            overflow: 'hidden'
                        }}>
                            <Image
                                source={require('../../assets/images/suryadi.png')}
                                style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden' }}
                                resizeMode="center"
                            />
                        </View>

                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
                            Suryadi
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', textAlign: 'center' }}>
                            Developer
                        </Text>
                    </View>

                    {/* White Card - Main Content */}
                    <View style={{
                        backgroundColor: '#fff',
                        borderRadius: 24,
                        padding: 20,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                    }}>
                        {/* Contact Information Section */}
                        <View style={{ marginBottom: 14 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>
                                {t('contact_information', { defaultValue: 'CONTACT INFORMATION' })}
                            </Text>

                            {/* WhatsApp */}
                            <TouchableOpacity
                                onPress={() => Linking.openURL('https://wa.me/6289678468651')}
                                style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 8 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Image
                                            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }}
                                            style={{ width: 14, height: 14 }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600' }}>WhatsApp</Text>
                                        <Text style={{ color: '#111827', fontSize: 12, fontWeight: '600' }}>089678468651</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Donation / Bank Info (compact) */}
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>Buy Me A Coffee</Text>
                                <View style={{ height: 6 }} />
                                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 }} />

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>Bank Account</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <TouchableOpacity onPress={() => copyToClipboard('0671808478')} activeOpacity={0.75}>
                                                <Text style={{ color: '#548affff', fontSize: 11, fontWeight: '600' }}>0671808478 (BCA)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => copyToClipboard('0671808478')} activeOpacity={0.75} style={{ marginLeft: 8 }}>
                                                <Ionicons name="copy-outline" size={14} color="#548affff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>Ovo/Gopay/Dana</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
                                            <TouchableOpacity onPress={() => copyToClipboard('089678468651')} activeOpacity={0.75}>
                                                <Text style={{ color: '#548affff', fontSize: 11, fontWeight: '600' }}>089678468651</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => copyToClipboard('089678468651')} activeOpacity={0.75} style={{ marginLeft: 8 }}>
                                                <Ionicons name="copy-outline" size={14} color="#548affff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Address */}
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Text style={{ fontSize: 13 }}>🏠</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Address</Text>
                                        <Text style={{ color: '#111827', fontSize: 12, lineHeight: 15 }}>
                                            Jl. H. Gadung no 20, Pondok Ranji, Ciputat Timur, Tangerang Selatan, Banten
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Quote Section */}
                        <View style={{ marginBottom: 12 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>
                                {t('inspiration', { defaultValue: 'INSPIRATION' })}
                            </Text>

                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 }}>
                                <Text style={{
                                    color: '#374151',
                                    fontStyle: 'italic',
                                    fontSize: 12,
                                    lineHeight: 16,
                                    textAlign: 'center',
                                    marginBottom: 6
                                }}>
                                    "Jika anak Adam meninggal, terputuslah amalnya kecuali dari yang tiga; Sedekah jariyah, ilmu yang bermanfaat, atau anak saleh yang mendoakan."
                                </Text>
                                <Text style={{ color: '#6B7280', fontSize: 10, textAlign: 'center', fontWeight: '600' }}>
                                    (HR. Muslim, no. 1631)
                                </Text>
                            </View>
                        </View>

                        {/* Thank You Section */}
                        <View style={{ backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#C7D2FE' }}>
                            <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>
                                {t('developer_thank_you', { defaultValue: 'Thank you for using this application!' })}
                            </Text>
                            <Text style={{ color: '#6366F1', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                                {t('developer_support_contact', { defaultValue: 'For support, collaboration, or donations, please contact the above contact information.' })}
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
