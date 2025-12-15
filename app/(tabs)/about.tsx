import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';
import {
    checkForUpdate,
    getCurrentAppVersion,
    getCurrentBuildNumber,
    getLatestVersionFromFirebase,
    publishVersionToFirebase,
    VersionInfo
} from '../../src/services/VersionService';

export default function AboutUsScreen() {
    const { showToast } = useToast();
    const { t } = useTranslation();

    // App settings from Firestore
    const [appName, setAppName] = useState('Community App');
    const [appDescription, setAppDescription] = useState('');
    const [appImage, setAppImage] = useState<string | undefined>(undefined);
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [bankAccount, setBankAccount] = useState('');

    // Loading state
    const [loading, setLoading] = useState(true);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Version info
    const appVersion = getCurrentAppVersion();
    const buildNumber = getCurrentBuildNumber();
    const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
    const [hasUpdate, setHasUpdate] = useState(false);

    // Publisher state (only specific email can publish)
    const PUBLISHER_EMAIL = 'suryadi.hhb@gmail.com';
    const [canPublish, setCanPublish] = useState(false);
    const [publishModalVisible, setPublishModalVisible] = useState(false);
    const [releaseNotes, setReleaseNotes] = useState('');
    const [updateUrl, setUpdateUrl] = useState('');
    const [isMandatory, setIsMandatory] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Check if user can publish (only specific email)
    useEffect(() => {
        (async () => {
            try {
                const user = getCurrentUser();
                if (user && user.email === PUBLISHER_EMAIL) {
                    setCanPublish(true);
                } else {
                    setCanPublish(false);
                }
            } catch (e) {
                console.warn('Failed to check publisher status', e);
            }
        })();
    }, []);

    // Check for updates
    useEffect(() => {
        (async () => {
            try {
                const latest = await getLatestVersionFromFirebase();
                if (latest) {
                    setLatestVersion(latest);
                    const result = await checkForUpdate();
                    setHasUpdate(result.hasUpdate);
                }
            } catch (e) {
                console.warn('Failed to check version', e);
            }
        })();
    }, [refreshTrigger]);

    // Load settings from Firestore (real-time) with AsyncStorage fallback
    useEffect(() => {
        let unsub: (() => void) | null = null;
        setLoading(true);

        (async () => {
            try {
                const ref = doc(db, 'settings', 'app');
                unsub = onSnapshot(ref, (snap) => {
                    if (!snap.exists()) {
                        setLoading(false);
                        return;
                    }
                    const s = snap.data() as any;
                    if (s.appName) setAppName(s.appName);
                    if (s.appDescription) setAppDescription(s.appDescription);
                    if (s.appImage) setAppImage(s.appImage);
                    if (s.phone) setPhone(s.phone);
                    if (s.email) setEmail(s.email);
                    if (s.address) setAddress(s.address);
                    if (s.bankAccount) setBankAccount(s.bankAccount);
                    setLoading(false);
                }, (err) => {
                    console.warn('settings onSnapshot error', err);
                    setLoading(false);
                });
            } catch (e) {
                // fallback to AsyncStorage if Firestore unavailable
                try {
                    const raw = await AsyncStorage.getItem('settings');
                    if (raw) {
                        const s = JSON.parse(raw);
                        if (s.appName) setAppName(s.appName);
                        if (s.appDescription) setAppDescription(s.appDescription);
                        if (s.appImage) setAppImage(s.appImage);
                        if (s.phone) setPhone(s.phone);
                        if (s.email) setEmail(s.email);
                        if (s.address) setAddress(s.address);
                        if (s.bankAccount) setBankAccount(s.bankAccount);
                    }
                } catch { /* ignore */ }
                setLoading(false);
            }
        })();
        return () => { if (unsub) unsub(); };
    }, [refreshTrigger]);

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // Handler functions
    const handlePhonePress = () => {
        if (!phone) return;
        const phoneUrl = `tel:${phone.replace(/\s/g, '')}`;
        Linking.openURL(phoneUrl).catch(() => {
            showToast(t('failed_to_open_phone', { defaultValue: 'Failed to open phone app' }), 'error');
        });
    };

    const handleEmailPress = () => {
        if (!email) return;
        const emailUrl = `mailto:${email}`;
        Linking.openURL(emailUrl).catch(() => {
            showToast(t('failed_to_open_email', { defaultValue: 'Failed to open email app' }), 'error');
        });
    };

    const handleAddressPress = () => {
        if (!address) return;
        const mapUrl = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(address)}`,
            android: `geo:0,0?q=${encodeURIComponent(address)}`,
        });
        if (mapUrl) {
            Linking.openURL(mapUrl).catch(() => {
                // Fallback to Google Maps web
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
            });
        }
    };

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const result = await checkForUpdate();
            setHasUpdate(result.hasUpdate);

            if (result.hasUpdate) {
                Alert.alert(
                    t('update_available', { defaultValue: 'Update Available!' }),
                    t('new_version_available', {
                        defaultValue: `A new version (v${result.latestVersion}) is available. Current version: v${result.currentVersion}`
                    }),
                    [
                        { text: t('ok', { defaultValue: 'OK' }) },
                        result.updateUrl ? {
                            text: t('update_now', { defaultValue: 'Update Now' }),
                            onPress: () => {
                                if (result.updateUrl) {
                                    Linking.openURL(result.updateUrl);
                                }
                            }
                        } : { text: t('cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
                    ].filter(Boolean) as any
                );
            } else {
                Alert.alert(
                    t('check_update_title', { defaultValue: 'Check Update' }),
                    t('app_is_up_to_date', { defaultValue: 'Your app is up to date!' }),
                    [{ text: t('ok', { defaultValue: 'OK' }) }]
                );
            }
        } catch (error) {
            console.error('Check update error:', error);
            showToast(t('failed_to_check_update', { defaultValue: 'Failed to check for updates' }), 'error');
        } finally {
            setCheckingUpdate(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const user = getCurrentUser();
            const success = await publishVersionToFirebase(
                releaseNotes,
                isMandatory,
                updateUrl,
                user?.email || 'Unknown'
            );

            if (success) {
                showToast(t('version_published', { defaultValue: 'Version published successfully!' }), 'success');
                setPublishModalVisible(false);
                setReleaseNotes('');
                setUpdateUrl('');
                setIsMandatory(false);
                setRefreshTrigger(prev => prev + 1);
            } else {
                showToast(t('failed_to_publish_version', { defaultValue: 'Failed to publish version' }), 'error');
            }
        } catch (error) {
            console.error('Publish error:', error);
            showToast(t('failed_to_publish_version', { defaultValue: 'Failed to publish version' }), 'error');
        } finally {
            setPublishing(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={{ marginTop: 12, color: '#6B7280' }}>{t('loading', { defaultValue: 'Loading...' })}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Gradient Header Background */}
                <LinearGradient
                    colors={['#6366f1', '#8b5cf6', '#a855f7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: 30, paddingBottom: 100, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
                >
                    <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
                        {/* App Image with elegant frame */}
                        <View style={{
                            width: 120,
                            height: 120,
                            borderRadius: 60,
                            backgroundColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                            elevation: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            padding: 4
                        }}>
                            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#F3F4F6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                {appImage ? (
                                    <Image source={{ uri: appImage }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Image source={require('../../assets/images/logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                )}
                            </View>
                        </View>

                        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
                            {appName}
                        </Text>

                        {appDescription ? (
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 }}>
                                {appDescription}
                            </Text>
                        ) : null}
                    </View>
                </LinearGradient>

                {/* Main Content Card - Overlapping with gradient */}
                <View style={{ marginTop: -70, paddingHorizontal: 16 }}>
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
                        {/* Section Title */}
                        <Text style={{
                            color: '#374151',
                            fontSize: 16,
                            fontWeight: '700',
                            marginBottom: 16,
                            letterSpacing: 0.5
                        }}>
                            {t('contact_information', { defaultValue: 'Contact Information' })}
                        </Text>

                        {/* Phone */}
                        {phone ? (
                            <TouchableOpacity
                                onPress={handlePhonePress}
                                style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 }}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="call" size={18} color="#3B82F6" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{t('phone_label', { defaultValue: 'Phone' })}</Text>
                                        <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>{phone}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                                </View>
                            </TouchableOpacity>
                        ) : null}

                        {/* Email */}
                        {email ? (
                            <TouchableOpacity
                                onPress={handleEmailPress}
                                style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 }}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="mail" size={18} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{t('email_label', { defaultValue: 'Email' })}</Text>
                                        <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>{email}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                                </View>
                            </TouchableOpacity>
                        ) : null}

                        {/* Address */}
                        {address ? (
                            <TouchableOpacity
                                onPress={handleAddressPress}
                                style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 }}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="location" size={18} color="#10B981" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{t('address_label', { defaultValue: 'Address' })}</Text>
                                        <Text style={{ color: '#111827', fontSize: 13, lineHeight: 18 }}>{address}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginTop: 4 }} />
                                </View>
                            </TouchableOpacity>
                        ) : null}

                        {/* Bank Account */}
                        {bankAccount ? (
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="card" size={18} color="#EC4899" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{t('bank_account_label', { defaultValue: 'Bank Account' })}</Text>
                                        <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600' }}>{bankAccount}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 }} />

                        {/* App Info Section */}
                        <Text style={{
                            color: '#374151',
                            fontSize: 16,
                            fontWeight: '700',
                            marginBottom: 16,
                            letterSpacing: 0.5
                        }}>
                            {t('app_information', { defaultValue: 'App Information' })}
                        </Text>

                        {/* Version */}
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Ionicons name="information-circle" size={18} color="#6366f1" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{t('version_label', { defaultValue: 'Version' })}</Text>
                                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>
                                        {appVersion}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Update Button */}
                        <TouchableOpacity
                            onPress={handleCheckUpdate}
                            disabled={checkingUpdate}
                            style={{ marginTop: 8 }}
                        >
                            <LinearGradient
                                colors={checkingUpdate ? ['#9CA3AF', '#9CA3AF'] : hasUpdate ? ['#F59E0B', '#D97706'] : ['#6366f1', '#8b5cf6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    elevation: 4,
                                    shadowColor: hasUpdate ? '#F59E0B' : '#6366f1',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 6
                                }}
                            >
                                {checkingUpdate ? (
                                    <>
                                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                            {t('checking_update', { defaultValue: 'Checking Update...' })}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name={hasUpdate ? "download" : "refresh"} size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                            {hasUpdate
                                                ? t('update_available', { defaultValue: 'Update Available!' })
                                                : t('check_for_update', { defaultValue: 'Check for Update' })
                                            }
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Latest Version Info (if available) */}
                        {latestVersion && (
                            <View style={{
                                backgroundColor: hasUpdate ? '#FEF3C7' : '#D1FAE5',
                                borderRadius: 12,
                                padding: 12,
                                marginTop: 12,
                                borderWidth: 1,
                                borderColor: hasUpdate ? '#FCD34D' : '#86EFAC'
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons
                                        name={hasUpdate ? "alert-circle" : "checkmark-circle"}
                                        size={18}
                                        color={hasUpdate ? "#D97706" : "#10B981"}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={{ color: hasUpdate ? '#92400E' : '#065F46', fontSize: 12, fontWeight: '600' }}>
                                        {hasUpdate
                                            ? t('new_version_on_server', { defaultValue: `v${latestVersion.version} available on server` })
                                            : t('running_latest', { defaultValue: 'You are running the latest version' })
                                        }
                                    </Text>
                                </View>
                                {latestVersion.releaseNotes && hasUpdate ? (
                                    <Text style={{ color: '#78350F', fontSize: 11, marginTop: 6, lineHeight: 16 }}>
                                        {latestVersion.releaseNotes}
                                    </Text>
                                ) : null}
                            </View>
                        )}

                        {/* Publisher: Publish Version Button (only for suryadi.hhb@gmail.com) */}
                        {canPublish && (
                            <>
                                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 }} />
                                <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 10, textAlign: 'center' }}>
                                    {t('developer_section', { defaultValue: 'Developer Section' })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setPublishModalVisible(true)}
                                    style={{ marginTop: 4 }}
                                >
                                    <View style={{
                                        backgroundColor: '#EEF2FF',
                                        borderRadius: 12,
                                        padding: 14,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: '#C7D2FE'
                                    }}>
                                        <Ionicons name="cloud-upload" size={20} color="#6366f1" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 14 }}>
                                            {t('publish_version', { defaultValue: 'Publish Current Version' })}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6, textAlign: 'center' }}>
                                    {t('publish_hint', { defaultValue: 'This will notify users of a new version' })}
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={{ marginTop: 24, alignItems: 'center', paddingHorizontal: 20 }}>
                    <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>
                        © {new Date().getFullYear()} {appName}
                    </Text>
                    <Text style={{ color: '#D1D5DB', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                        {t('all_rights_reserved', { defaultValue: 'All rights reserved.' })}
                    </Text>
                </View>
            </ScrollView>

            {/* Publish Version Modal */}
            <Modal
                visible={publishModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setPublishModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{
                        backgroundColor: '#fff',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        padding: 20,
                        maxHeight: '80%'
                    }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                                {t('publish_version_title', { defaultValue: 'Publish Version' })}
                            </Text>
                            <TouchableOpacity onPress={() => setPublishModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Current Version Display */}
                            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                                    {t('version_to_publish', { defaultValue: 'Version to Publish' })}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={{ color: '#6366f1', fontSize: 28, fontWeight: '800' }}>
                                        v{appVersion}
                                    </Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 14, marginLeft: 8 }}>
                                        (Build {buildNumber})
                                    </Text>
                                </View>
                            </View>

                            {/* Release Notes */}
                            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                                {t('release_notes_label', { defaultValue: 'Release Notes (optional)' })}
                            </Text>
                            <TextInput
                                value={releaseNotes}
                                onChangeText={setReleaseNotes}
                                placeholder={t('release_notes_placeholder', { defaultValue: "What's new in this version?" })}
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={4}
                                style={{
                                    backgroundColor: '#F9FAFB',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    padding: 12,
                                    fontSize: 14,
                                    color: '#111827',
                                    marginBottom: 16,
                                    textAlignVertical: 'top',
                                    minHeight: 100
                                }}
                            />

                            {/* Update URL */}
                            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                                {t('update_url_label', { defaultValue: 'Update URL (optional)' })}
                            </Text>
                            <TextInput
                                value={updateUrl}
                                onChangeText={setUpdateUrl}
                                placeholder={t('update_url_placeholder', { defaultValue: 'https://play.google.com/store/apps/...' })}
                                placeholderTextColor="#9CA3AF"
                                keyboardType="url"
                                autoCapitalize="none"
                                style={{
                                    backgroundColor: '#F9FAFB',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    padding: 12,
                                    fontSize: 14,
                                    color: '#111827',
                                    marginBottom: 16
                                }}
                            />

                            {/* Mandatory Toggle */}
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#FEF3C7',
                                borderRadius: 12,
                                padding: 14,
                                marginBottom: 24
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#92400E', fontSize: 14, fontWeight: '600' }}>
                                        {t('mandatory_update_label', { defaultValue: 'Mandatory Update' })}
                                    </Text>
                                    <Text style={{ color: '#A16207', fontSize: 11, marginTop: 2 }}>
                                        {t('mandatory_update_desc', { defaultValue: 'Users must update to continue' })}
                                    </Text>
                                </View>
                                <Switch
                                    value={isMandatory}
                                    onValueChange={setIsMandatory}
                                    trackColor={{ false: '#D1D5DB', true: '#6366f1' }}
                                    thumbColor="#fff"
                                />
                            </View>

                            {/* Publish Button */}
                            <TouchableOpacity
                                onPress={handlePublish}
                                disabled={publishing}
                            >
                                <LinearGradient
                                    colors={publishing ? ['#9CA3AF', '#9CA3AF'] : ['#6366f1', '#8b5cf6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        paddingVertical: 16,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        flexDirection: 'row',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {publishing ? (
                                        <>
                                            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                                {t('publishing', { defaultValue: 'Publishing...' })}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons name="rocket" size={20} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                                                {t('publish_now', { defaultValue: 'Publish Now' })}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
