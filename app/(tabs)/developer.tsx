import * as LinearGradientModule from 'expo-linear-gradient';
import React from 'react';
import { Image, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// safe LinearGradient reference (some environments export default, some named)
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

export default function DeveloperScreen() {
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
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <View style={{
                            width: 90,
                            height: 90,
                            borderRadius: 45,
                            backgroundColor: 'black',
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 6,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            padding: 3,
                            overflow: 'hidden'
                        }}>
                            <Image
                                source={require('../../assets/images/suryadi.png')}
                                style={{ width: 90, height: 90, borderRadius: 40, overflow: 'hidden' }}
                                resizeMode="center"
                            />
                        </View>

                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 2 }}>
                            Suryadi
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
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
                                CONTACT INFORMATION
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

                            {/* Bank Account */}
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Text style={{ fontSize: 13 }}>💳</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600' }}>Bank Account</Text>
                                        <Text style={{ color: '#111827', fontSize: 12, fontWeight: '600' }}>BCA 0671808478</Text>
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
                                INSPIRATION
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
                                Thank you for using this application!
                            </Text>
                            <Text style={{ color: '#6366F1', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                                For support, collaboration, or donations, please contact the above contact information.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
