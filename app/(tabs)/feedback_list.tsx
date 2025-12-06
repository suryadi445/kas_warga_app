import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ListLoadingState from '../../src/components/ListLoadingState';
import { db } from '../../src/firebaseConfig';

type Feedback = {
    id: string;
    message: string;
    type: string;
    created_date: any;
    read?: boolean;
};

export default function FeedbackListScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'criticism' | 'suggestion'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'read' | 'unread'>('all');

    useEffect(() => {
        const start = Date.now();
        const q = query(collection(db, 'feedbacks'), orderBy('created_date', 'desc'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const list: Feedback[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() } as Feedback);
            });
            setFeedbacks(list);
            const elapsed = Date.now() - start;
            if (elapsed < 1000) await new Promise(res => setTimeout(res, 1000 - elapsed));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching feedbacks: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredFeedbacks = feedbacks.filter(f => {
        const typeMatch = filterType === 'all' || f.type === filterType;
        const statusMatch = filterStatus === 'all'
            ? true
            : filterStatus === 'read'
                ? f.read === true
                : f.read !== true; // unread (undefined or false)
        return typeMatch && statusMatch;
    });

    const handleMarkAllRead = async () => {
        try {
            const batch = writeBatch(db);
            const unreadItems = feedbacks.filter(f => f.read !== true);

            if (unreadItems.length === 0) return;

            unreadItems.forEach(item => {
                const ref = doc(db, 'feedbacks', item.id);
                batch.update(ref, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read: ", error);
        }
    };

    const renderItem = ({ item }: { item: Feedback }) => {
        const isCriticism = item.type === 'criticism';
        const badgeColor = isCriticism ? '#FEE2E2' : '#DBEAFE';
        const badgeText = isCriticism ? '#991B1B' : '#1E40AF';
        const badgeBorder = isCriticism ? '#EF4444' : '#3B82F6';

        return (
            <View style={[styles.card, item.read !== true && styles.unreadCard]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: badgeColor, borderColor: badgeBorder }]}>
                        <Text style={[styles.badgeText, { color: badgeText }]}>
                            {item.type ? t(item.type, { defaultValue: item.type.toUpperCase() }) : t('unknown', { defaultValue: 'UNKNOWN' })}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.date}>{formatDate(item.created_date)}</Text>
                        {item.read !== true && (
                            <View style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: '#EF4444',
                            }} />
                        )}
                    </View>
                </View>
                <Text style={styles.message}>{item.message}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Purple Gradient Background for Header */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            />

            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.headerContent}>
                    <View style={styles.headerIcon}>
                        <Text style={{ fontSize: 32 }}>📋</Text>
                    </View>

                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{t('feedback_list_title', { defaultValue: 'Feedback List' })}</Text>
                        <Text style={styles.headerSubtitle}>
                            {t('feedback_list_subtitle', { defaultValue: 'View user feedback and suggestions to understand what people think about us and what improvements they hope to see.' })}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Filter Tabs (Type) */}
            <View style={{ paddingHorizontal: 20, marginTop: 22, marginBottom: 12 }}>
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        onPress={() => setFilterType('all')}
                        style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
                    >
                        <Text style={[styles.filterTabText, filterType === 'all' && styles.filterTabTextActive]}>{t('all_types', { defaultValue: 'All Types' })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilterType('criticism')}
                        style={[styles.filterTab, filterType === 'criticism' && styles.filterTabActive]}
                    >
                        <Text style={[styles.filterTabText, filterType === 'criticism' && styles.filterTabTextActive]}>{t('criticism', { defaultValue: 'Criticism' })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilterType('suggestion')}
                        style={[styles.filterTab, filterType === 'suggestion' && styles.filterTabActive]}
                    >
                        <Text style={[styles.filterTabText, filterType === 'suggestion' && styles.filterTabTextActive]}>{t('suggestion', { defaultValue: 'Suggestion' })}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter Tabs (Status) & Mark Read */}
            <View style={{ paddingHorizontal: 20, marginTop: 22, marginBottom: 16, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 4 }}>

                    {/* ALL */}
                    <TouchableOpacity
                        onPress={() => setFilterStatus('all')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: filterStatus === 'all' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: filterStatus === 'all' ? '#FFFFFF' : '#1F2937' // putih di ungu, gelap di putih
                            }}
                        >
                            🔵 {t('filter_status_all', { defaultValue: 'All' })}
                        </Text>
                    </TouchableOpacity>

                    {/* UNREAD */}
                    <TouchableOpacity
                        onPress={() => setFilterStatus('unread')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: filterStatus === 'unread' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: filterStatus === 'unread' ? '#FFFFFF' : '#1F2937'
                            }}
                        >
                            🔴 {t('filter_status_unread', { defaultValue: 'Unread' })}
                        </Text>
                    </TouchableOpacity>

                    {/* READ */}
                    <TouchableOpacity
                        onPress={() => setFilterStatus('read')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: filterStatus === 'read' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: filterStatus === 'read' ? '#FFFFFF' : '#1F2937'
                            }}
                        >
                            🟢 {t('filter_status_read', { defaultValue: 'Read' })}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Mark All Read Button */}
                <TouchableOpacity
                    style={{
                        backgroundColor: '#6D28D9',
                        padding: 10,
                        borderRadius: 10,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    onPress={handleMarkAllRead}
                >
                    <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                </TouchableOpacity>
            </View>


            {loading ? (
                <View style={{ flex: 1, paddingHorizontal: 18 }}>
                    <View style={styles.listContainer}>
                        <ListLoadingState message={t('loading_feedback', { defaultValue: 'Loading feedback...' })} />
                    </View>
                </View>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 18 }}>
                    <View style={styles.listContainer}>
                        <FlatList
                            data={filteredFeedbacks}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_feedback_found', { defaultValue: 'No feedback found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {filterStatus === 'unread'
                                            ? t('no_unread_feedback', { defaultValue: 'No unread feedback' })
                                            : filterStatus === 'read'
                                                ? t('no_read_feedback', { defaultValue: 'No read feedback yet' })
                                                : filterType === 'criticism'
                                                    ? t('no_criticism_feedback', { defaultValue: 'No criticism feedback' })
                                                    : filterType === 'suggestion'
                                                        ? t('no_suggestions_yet', { defaultValue: 'No suggestions yet' })
                                                        : t('no_feedback_submitted_yet', { defaultValue: 'No feedback has been submitted yet' })}
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            )}
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
        height: 260,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 2,
        fontSize: 12,
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)'
    },
    filterTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 9,
    },
    filterTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    filterTabText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '700',
        fontSize: 12,
    },
    filterTabTextActive: {
        color: '#7C3AED',
    },
    markReadButton: {
        width: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
        flex: 1,
        marginBottom: 20,
    },
    listContent: {
        padding: 16,
        paddingTop: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    unreadCard: {
        backgroundColor: '#F0F9FF',
        borderColor: '#60A5FA',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    date: {
        fontSize: 12,
        color: '#6B7280',
    },
    message: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
    },
});
