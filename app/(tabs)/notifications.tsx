import * as LinearGradientModule from 'expo-linear-gradient';
import { collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ListCardWrapper from '../../src/components/ListCardWrapper';
import LoadMore from '../../src/components/LoadMore';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

// safe LinearGradient reference
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

type Notification = {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    date: string;
    read: boolean;
    category?: string;
    sourceCollection?: string;
};

export default function NotificationsScreen() {
    const { showToast } = useToast();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    // Pagination
    const [displayedCount, setDisplayedCount] = useState(10);
    const [loadingMore, setLoadingMore] = useState(false);
    const ITEMS_PER_PAGE = 10;
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Get current user ID on mount
    useEffect(() => {
        const user = getCurrentUser();
        if (user) {
            setCurrentUserId(user.uid);
        }
    }, []);

    // Load notifications from Firestore
    useEffect(() => {
        if (!currentUserId) return; // Wait for user ID

        const unsubs: (() => void)[] = [];

        (async () => {
            try {
                // Listen to notifications collection
                const qNotif = query(collection(db, 'notifications'), orderBy('date', 'desc'));
                const unsubNotif = onSnapshot(qNotif, snap => {
                    const rows: Notification[] = snap.docs.map(d => {
                        const data = d.data() as any;

                        // Check if current user has read this notification
                        // We look at the 'readBy' array field
                        const readBy = Array.isArray(data.readBy) ? data.readBy : [];
                        const isReadByCurrentUser = readBy.includes(currentUserId);

                        return {
                            id: d.id,
                            title: data.title ?? '',
                            message: data.message ?? '',
                            type: data.type ?? 'info',
                            date: data.date ?? '',
                            read: isReadByCurrentUser, // Determine read status based on user ID
                            category: data.category ?? '',
                            sourceCollection: data.sourceCollection ?? '',
                        };
                    });
                    // Sort by date descending
                    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setNotifications(rows);
                    setLoading(false);
                });
                unsubs.push(unsubNotif);

            } catch (e) {
                console.error('Failed to load notifications:', e);
                setLoading(false);
            }
        })();

        return () => unsubs.forEach(u => u());
    }, [currentUserId, refreshTrigger]); // Re-run when user ID changes

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // Handler: mark notification as read
    async function markAsRead(notifId: string) {
        if (!currentUserId) return;

        try {
            const ref = doc(db, 'notifications', notifId);

            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const readBy = Array.isArray(data.readBy) ? data.readBy : [];

                if (!readBy.includes(currentUserId)) {
                    await updateDoc(ref, {
                        readBy: [...readBy, currentUserId],
                        read: true // Legacy support
                    });
                }
            }
        } catch (e) {
            console.error('Failed to mark as read:', e);
        }
    }

    // Handler: mark all displayed notifications as read
    async function markAllRead() {
        if (!currentUserId) return;

        try {
            // Only process unread ones
            const toMark = notifications.filter(n => !n.read).map(n => n.id);
            if (toMark.length === 0) return;

            // Update each doc to include currentUserId in readBy
            const updatePromises = toMark.map(async (id) => {
                const ref = doc(db, 'notifications', id);
                const docSnap = await getDoc(ref);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
                    if (!readBy.includes(currentUserId)) {
                        await updateDoc(ref, {
                            readBy: [...readBy, currentUserId!],
                            read: true
                        });
                    }
                }
            });

            await Promise.all(updatePromises);
            showToast(`${toMark.length} notifications marked as read`, 'success');
        } catch (e) {
            console.error('Failed to mark all read:', e);
            showToast('Failed to mark all as read', 'error');
        }
    }

    // Filter notifications
    const filteredNotifications = notifications.filter(n =>
        filter === 'all' ? true : !n.read
    );

    // Paginated data
    const displayedNotifications = filteredNotifications.slice(0, displayedCount);

    // Counts
    const unreadCount = notifications.filter(n => !n.read).length;
    const totalCount = notifications.length;

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= filteredNotifications.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredNotifications.length));
            setLoadingMore(false);
        }, 300);
    };

    // Reset displayed count when filter changes
    useEffect(() => {
        setDisplayedCount(ITEMS_PER_PAGE);
    }, [filter]);

    // Helper: format date
    function formatDate(dateStr: string) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;

            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    // Helper: get icon
    function getIcon(type: string) {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }

    // Helper: get colors
    function getColors(type: string) {
        switch (type) {
            case 'success':
                return { bg: '#D1FAE5', border: '#10B981', text: '#065F46' };
            case 'warning':
                return { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' };
            case 'error':
                return { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' };
            default:
                return { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' };
        }
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Gradient Header Background */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingTop: 20, paddingBottom: 80, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
            >
                <View style={{ paddingHorizontal: 20, alignItems: 'center', paddingTop: 10 }}>
                    {/* Notification Icon with frame */}
                    <View style={{
                        width: 90,
                        height: 90,
                        borderRadius: 45,
                        backgroundColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                        elevation: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        padding: 3
                    }}>
                        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 40 }}>🔔</Text>
                        </View>
                    </View>

                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>
                        Notifications
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
                        {unreadCount} unread • {totalCount} total
                    </Text>
                </View>
            </LinearGradient>

            {/* Filter Buttons - Melayang di antara ungu dan putih */}
            <View style={{ marginTop: -25, paddingHorizontal: 10, marginBottom: 20, zIndex: 10 }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    padding: 6,
                    flexDirection: 'row',
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                }}>
                    <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={{
                            flex: 1,
                            backgroundColor: filter === 'all' ? '#6366f1' : 'transparent',
                            borderRadius: 12,
                            paddingVertical: 10,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filter === 'all' ? '#fff' : '#6B7280',
                            fontWeight: '700',
                            fontSize: 13
                        }}>
                            All ({totalCount})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('unread')}
                        style={{
                            flex: 1,
                            backgroundColor: filter === 'unread' ? '#6366f1' : 'transparent',
                            borderRadius: 12,
                            paddingVertical: 10,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filter === 'unread' ? '#fff' : '#6B7280',
                            fontWeight: '700',
                            fontSize: 13
                        }}>
                            Unread ({unreadCount})
                        </Text>
                    </TouchableOpacity>

                    {/* Mark all read button */}
                    <TouchableOpacity
                        onPress={markAllRead}
                        style={{
                            marginLeft: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            borderRadius: 12,
                            backgroundColor: '#F9FAFB',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                        }}
                    >
                        <Text style={{ color: '#374151', fontWeight: '700', fontSize: 12 }}>
                            ✓ Read All</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notifications List */}
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
                <ListCardWrapper style={{ marginHorizontal: 0 }}>
                    {loading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                            <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
                            <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>Loading...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={displayedNotifications}
                            keyExtractor={(i) => i.id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                            }
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No notifications</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {filter === 'unread' ? 'No unread notifications' : 'You have no notifications yet'}
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const colors = getColors(item.type);
                                const icon = getIcon(item.type);

                                return (
                                    <TouchableOpacity
                                        onPress={() => !item.read && markAsRead(item.id)}
                                        activeOpacity={0.7}
                                        style={{
                                            marginVertical: 6,
                                            backgroundColor: item.read ? '#fff' : '#F9FAFB',
                                            padding: 14,
                                            borderRadius: 12,
                                            elevation: 2,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.08,
                                            shadowRadius: 4,
                                            borderLeftWidth: 4,
                                            borderLeftColor: colors.border,
                                        }}>
                                        {/* Header: icon + badge + date */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <View style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 16,
                                                backgroundColor: colors.bg,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 10
                                            }}>
                                                <Text style={{ fontSize: 16 }}>{icon}</Text>
                                            </View>

                                            <View style={{ flex: 1 }}>
                                                {!!item.category && (
                                                    <View style={{
                                                        backgroundColor: '#F3F4F6',
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 3,
                                                        borderRadius: 6,
                                                        alignSelf: 'flex-start',
                                                        marginBottom: 4
                                                    }}>
                                                        <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '600' }}>
                                                            🏷️ {item.category}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '500' }}>
                                                    {formatDate(item.date)}
                                                </Text>
                                            </View>

                                            {!item.read && (
                                                <View style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: 5,
                                                    backgroundColor: '#EF4444',
                                                }} />
                                            )}
                                        </View>

                                        {/* Title */}
                                        <Text style={{
                                            fontWeight: '700',
                                            fontSize: 15,
                                            color: '#111827',
                                            marginBottom: 6
                                        }}>
                                            {item.title}
                                        </Text>

                                        {/* Message */}
                                        <Text style={{
                                            color: '#6B7280',
                                            fontSize: 13,
                                            lineHeight: 18
                                        }}>
                                            {item.message}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => (
                                <LoadMore
                                    loading={loadingMore}
                                    hasMore={displayedCount < filteredNotifications.length}
                                />
                            )}
                        />
                    )}
                </ListCardWrapper>
            </View>
        </SafeAreaView>
    );
}