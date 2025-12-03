import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

export default function FeedbackScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [message, setMessage] = useState('');
    const [type, setType] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!type) {
            showToast?.(t('please_select_feedback_type', { defaultValue: 'Please select a feedback type' }), 'error');
            return;
        }
        if (!message.trim()) {
            showToast?.(t('please_enter_feedback_message', { defaultValue: 'Please enter a message' }), 'error');
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, 'feedbacks'), {
                type,
                message: message.trim(),
                created_date: serverTimestamp(),
            });
            showToast?.(t('feedback_sent_success', { defaultValue: 'Feedback sent successfully!' }), 'success');
            setMessage('');
            setType('');
            router.back();
        } catch (error) {
            console.error('Error sending feedback:', error);
            showToast?.(t('failed_send_feedback', { defaultValue: 'Failed to send feedback. Please try again.' }), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Purple Gradient Background for Header - Reduced height */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            />

            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.headerContent}>
                    {/* Icon on the left */}
                    <View style={styles.headerIcon}>
                        <Text style={{ fontSize: 24 }}>💬</Text>
                    </View>

                    {/* Title on the right */}
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{t('feedback_title', { defaultValue: 'Feedback' })}</Text>
                        <Text style={styles.headerSubtitle}>
                            {t('feedback_subtitle', { defaultValue: 'Send feedback or report an issue. Your input helps us improve our service and fix problems faster.' })}
                        </Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.card}>
                        <SelectInput
                            label={t('feedback_type_label', { defaultValue: 'Feedback Type' })}
                            value={type}
                            options={[
                                { label: t('criticism', { defaultValue: 'Criticism' }), value: 'criticism' },
                                { label: t('suggestion', { defaultValue: 'Suggestion' }), value: 'suggestion' },
                            ]}
                            onValueChange={setType}
                            placeholder={t('select_feedback_type', { defaultValue: 'Select Type' })}
                        />

                        <FloatingLabelInput
                            label={t('your_message_label', { defaultValue: 'Your Message' })}
                            value={message}
                            onChangeText={setMessage}
                            placeholder={t('feedback_placeholder', { defaultValue: 'Type your feedback here...' })}
                            multiline
                            inputStyle={{ minHeight: 150 }}
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#7c3aed', '#6366f1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.buttonText}>{t('send_feedback', { defaultValue: 'Send Feedback' })}</Text>
                                        <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160, // Reduced height to sit behind header only
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 20, // Adjust for status bar
        paddingBottom: 20,
        marginBottom: 30,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    // Back button style removed
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    content: {
        padding: 20,
        paddingTop: 10, // Add some space between header and card
    },
    card: {
        backgroundColor: '#FFFFFF', // Solid white background
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, // Slightly reduced shadow
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB', // Standard border color
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    inputContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 24,
    },
    input: {
        padding: 16,
        fontSize: 16,
        color: '#111827',
        minHeight: 150,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 4,
    },
    buttonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
