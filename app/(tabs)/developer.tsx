import React from 'react';
import { Image, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DeveloperScreen() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: StatusBar.currentHeight || 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
                <View style={{
                    alignItems: 'center',
                    marginBottom: 24,
                    backgroundColor: '#6366f1',
                    borderRadius: 24,
                    padding: 20,
                    shadowColor: '#6366f1',
                    shadowOpacity: 0.18,
                    shadowRadius: 12,
                    elevation: 8,
                    width: '100%',
                    maxWidth: 400,
                    alignSelf: 'center',
                }}>
                    <Image
                        source={{ uri: 'https://ui-avatars.com/api/?name=Suryadi&background=6366f1&color=fff&size=128' }}
                        style={{
                            width: 110,
                            height: 110,
                            borderRadius: 55,
                            marginBottom: 12,
                            borderWidth: 4,
                            borderColor: '#fff',
                        }}
                    />
                    <Text style={{
                        fontWeight: '700',
                        fontSize: 26,
                        color: '#fff',
                        marginBottom: 4,
                        letterSpacing: 1,
                        textShadowColor: '#312e81',
                        textShadowOffset: { width: 1, height: 2 },
                        textShadowRadius: 6,
                    }}>
                        Suryadi
                    </Text>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                        gap: 8,
                        flexWrap: 'wrap',
                        width: '100%',
                    }}>
                        <TouchableOpacity
                            onPress={() => Linking.openURL('https://wa.me/6289678468651')}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: '#fff',
                                borderRadius: 999,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                marginRight: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                elevation: 2,
                                flexShrink: 1,
                                maxWidth: '60%',
                            }}
                        >
                            {/* Logo WhatsApp PNG hijau */}
                            <View style={{ marginRight: 4 }}>
                                <Image
                                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }}
                                    style={{ width: 13, height: 13 }}
                                />
                            </View>
                            <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 15, flexShrink: 1 }}>
                                089678468651
                            </Text>
                        </TouchableOpacity>
                        <View style={{
                            backgroundColor: '#fff',
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            elevation: 2,
                            flexShrink: 1,
                            maxWidth: '60%',
                        }}>
                            <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 15 }}>💳</Text>
                            <Text style={{
                                color: '#6366f1', fontWeight: '700', fontSize: 15, marginLeft: 4, flexShrink: 1, textAlign: 'center',
                            }}>
                                BCA 0671808478
                            </Text>
                        </View>
                    </View>
                    <View style={{
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: 6,
                        elevation: 1,
                    }}>
                        <Text style={{
                            color: '#6366f1',
                            fontWeight: '600',
                            fontSize: 15,
                            textAlign: 'center',
                        }}>
                            🏠 Jl. H. Gadung no 20, Pondok Ranji, Ciputat Timur, Tangerang Selatan, Banten
                        </Text>
                    </View>
                </View>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 24,
                    shadowColor: '#6366f1',
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 2,
                }}>
                    <Text style={{
                        color: '#6366f1',
                        fontStyle: 'italic',
                        fontSize: 17,
                        textAlign: 'center',
                        lineHeight: 26,
                        fontWeight: '600',
                    }}>
                        “Jika anak Adam meninggal, terputuslah amalnya kecuali dari yang tiga; Sedekah jariyah, ilmu yang bermanfaat, atau anak saleh yang mendoakan.”
                        {'\n'}
                        <Text style={{ color: '#64748b', fontSize: 15, fontWeight: '400' }}>(HR. Muslim, no. 1631)</Text>
                    </Text>
                </View>
                <View style={{
                    marginTop: 8,
                    alignItems: 'center',
                    padding: 12,
                }}>
                    <Text style={{
                        color: '#6366f1',
                        fontWeight: '700',
                        fontSize: 18,
                        marginBottom: 4,
                        textAlign: 'center',
                    }}>
                        Terima kasih telah menggunakan aplikasi ini!
                    </Text>
                    <Text style={{
                        color: '#374151',
                        fontSize: 15,
                        textAlign: 'center',
                    }}>
                        Untuk support, kerjasama, atau donasi, silakan hubungi kontak di atas.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
