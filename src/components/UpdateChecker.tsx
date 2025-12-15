import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Platform,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    checkForUpdate,
    dismissUpdateForVersion,
    getLastDismissedVersion,
    UpdateCheckResult
} from '../services/VersionService';

export default function UpdateChecker() {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkVersion();
    }, []);

    async function checkVersion() {
        try {
            setChecking(true);
            const result = await checkForUpdate();

            if (result.hasUpdate) {
                // Check if user dismissed this version before (for non-mandatory updates)
                if (!result.mandatory) {
                    const dismissed = await getLastDismissedVersion();
                    if (dismissed === result.latestVersion) {
                        // User already dismissed this version
                        setChecking(false);
                        return;
                    }
                }

                setUpdateInfo(result);
                setVisible(true);
            }
        } catch (error) {
            console.warn('[UpdateChecker] Error checking for update:', error);
        } finally {
            setChecking(false);
        }
    }

    const handleUpdate = async () => {
        if (updateInfo?.updateUrl) {
            try {
                await Linking.openURL(updateInfo.updateUrl);
            } catch (error) {
                console.error('Failed to open update URL:', error);
                // Fallback to app store
                const storeUrl = Platform.select({
                    ios: 'https://apps.apple.com', // Replace with your App Store URL
                    android: 'https://play.google.com/store', // Replace with your Play Store URL
                });
                if (storeUrl) {
                    Linking.openURL(storeUrl);
                }
            }
        }
        setVisible(false);
    };

    const handleDismiss = async () => {
        if (updateInfo && !updateInfo.mandatory) {
            await dismissUpdateForVersion(updateInfo.latestVersion);
        }
        setVisible(false);
    };

    if (!visible || !updateInfo) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={updateInfo.mandatory ? undefined : handleDismiss}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20
            }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 24,
                    width: '100%',
                    maxWidth: 340,
                    overflow: 'hidden',
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 10,
                }}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            padding: 24,
                            alignItems: 'center'
                        }}
                    >
                        <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12
                        }}>
                            <Ionicons name="arrow-up-circle" size={40} color="#fff" />
                        </View>
                        <Text style={{
                            color: '#fff',
                            fontSize: 20,
                            fontWeight: '800',
                            textAlign: 'center'
                        }}>
                            {t('update_available', { defaultValue: 'Update Available!' })}
                        </Text>
                        <Text style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 14,
                            marginTop: 4
                        }}>
                            v{updateInfo.latestVersion}
                        </Text>
                    </LinearGradient>

                    {/* Content */}
                    <View style={{ padding: 20 }}>
                        {/* Version Info */}
                        <View style={{
                            backgroundColor: '#F3F4F6',
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 16,
                            flexDirection: 'row',
                            justifyContent: 'space-between'
                        }}>
                            <View>
                                <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600' }}>
                                    {t('current_version_label', { defaultValue: 'Current' })}
                                </Text>
                                <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700' }}>
                                    v{updateInfo.currentVersion}
                                </Text>
                            </View>
                            <Ionicons name="arrow-forward" size={24} color="#9CA3AF" style={{ alignSelf: 'center' }} />
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600' }}>
                                    {t('latest_version_label', { defaultValue: 'Latest' })}
                                </Text>
                                <Text style={{ color: '#6366f1', fontSize: 16, fontWeight: '700' }}>
                                    v{updateInfo.latestVersion}
                                </Text>
                            </View>
                        </View>

                        {/* Release Notes */}
                        {updateInfo.releaseNotes ? (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{
                                    color: '#374151',
                                    fontSize: 13,
                                    fontWeight: '600',
                                    marginBottom: 8
                                }}>
                                    {t('whats_new', { defaultValue: "What's New:" })}
                                </Text>
                                <Text style={{
                                    color: '#6B7280',
                                    fontSize: 13,
                                    lineHeight: 20
                                }}>
                                    {updateInfo.releaseNotes}
                                </Text>
                            </View>
                        ) : null}

                        {/* Mandatory Notice */}
                        {updateInfo.mandatory && (
                            <View style={{
                                backgroundColor: '#FEF3C7',
                                borderRadius: 8,
                                padding: 10,
                                marginBottom: 16,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <Ionicons name="warning" size={18} color="#D97706" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#92400E', fontSize: 12, flex: 1 }}>
                                    {t('mandatory_update_notice', { defaultValue: 'This update is required to continue using the app.' })}
                                </Text>
                            </View>
                        )}

                        {/* Buttons */}
                        <TouchableOpacity
                            onPress={handleUpdate}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#8b5cf6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center'
                                }}
                            >
                                <Ionicons name="download" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                    {t('update_now', { defaultValue: 'Update Now' })}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Skip button (only for non-mandatory) */}
                        {!updateInfo.mandatory && (
                            <TouchableOpacity
                                onPress={handleDismiss}
                                style={{
                                    marginTop: 12,
                                    paddingVertical: 12,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>
                                    {t('remind_me_later', { defaultValue: 'Remind Me Later' })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
