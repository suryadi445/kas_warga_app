import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Image, RefreshControl, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ListCardWrapper from '../../src/components/ListCardWrapper';
// ADDED: LoadMore footer component
import LoadMore from '../../src/components/LoadMore';
import { db } from '../../src/firebaseConfig';
import { Announcement, useDashboardData } from '../../src/hooks/useDashboardData';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

/**
 * Dashboard with tabs:
 * - Cash
 * - Announcements
 * - Schedules
 * - Activities
 *
 * Data is loaded in real-time from Firestore collections via useDashboardData hook
 */

const TAB_KEYS = ['cash', 'announcements', 'schedules', 'activities'] as const;
type TabKey = typeof TAB_KEYS[number];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40; // 20px padding each side

export default function DashboardPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabKey>('cash');
    // NEW: filter for cash list: 'all' | 'in' | 'out'
    const [cashFilter, setCashFilter] = useState<'all' | 'in' | 'out'>('all');

    // NEW: state for card scroll indicator (dots)
    const [activeCardIndex, setActiveCardIndex] = useState(0);

    // NEW: ref untuk FlatList Quick Access
    const quickAccessRef = useRef<FlatList>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Use the shared hook for data
    const { cash, announcements, schedules, activities } = useDashboardData(refreshTrigger);

    // SCHEDULES pagination (used by renderSchedules)
    const SCHEDULES_PER_PAGE = 5;
    const [scheduleDisplayedCount, setScheduleDisplayedCount] = useState<number>(SCHEDULES_PER_PAGE);
    const [scheduleLoadingMore, setScheduleLoadingMore] = useState<boolean>(false);

    // CASH pagination
    const CASH_PER_PAGE = 5;
    const [cashDisplayedCount, setCashDisplayedCount] = useState<number>(CASH_PER_PAGE);
    const [cashLoadingMore, setCashLoadingMore] = useState<boolean>(false);

    // ANNOUNCEMENTS pagination
    const ANNOUNCEMENTS_PER_PAGE = 5;
    const [announcementsDisplayedCount, setAnnouncementsDisplayedCount] = useState<number>(ANNOUNCEMENTS_PER_PAGE);
    const [announcementsLoadingMore, setAnnouncementsLoadingMore] = useState<boolean>(false);

    // ACTIVITIES pagination
    const ACTIVITIES_PER_PAGE = 5;
    const [activitiesDisplayedCount, setActivitiesDisplayedCount] = useState<number>(ACTIVITIES_PER_PAGE);
    const [activitiesLoadingMore, setActivitiesLoadingMore] = useState<boolean>(false);

    // load user's avatar for the header
    const [userPhoto, setUserPhoto] = useState<string | undefined>(undefined);

    // reset displayed count when schedules update
    useEffect(() => {
        setScheduleDisplayedCount(SCHEDULES_PER_PAGE);
    }, [schedules]);

    // reset displayed count when cash updates
    useEffect(() => {
        setCashDisplayedCount(CASH_PER_PAGE);
    }, [cash, cashFilter]);

    // reset displayed count when announcements update
    useEffect(() => {
        setAnnouncementsDisplayedCount(ANNOUNCEMENTS_PER_PAGE);
    }, [announcements]);

    // reset displayed count when activities update
    useEffect(() => {
        setActivitiesDisplayedCount(ACTIVITIES_PER_PAGE);
    }, [activities]);

    const handleScheduleLoadMore = () => {
        if (scheduleLoadingMore) return;
        if (scheduleDisplayedCount >= schedules.length) return;
        setScheduleLoadingMore(true);
        // small debounce / simulated load delay
        setTimeout(() => {
            setScheduleDisplayedCount(prev => Math.min(prev + SCHEDULES_PER_PAGE, schedules.length));
            setScheduleLoadingMore(false);
        }, 300);
    };

    const handleCashLoadMore = () => {
        if (cashLoadingMore) return;
        const visibleLength = cashTotalsFiltered.visible.length;
        if (cashDisplayedCount >= visibleLength) return;
        setCashLoadingMore(true);
        setTimeout(() => {
            setCashDisplayedCount(prev => Math.min(prev + CASH_PER_PAGE, visibleLength));
            setCashLoadingMore(false);
        }, 300);
    };

    const handleAnnouncementsLoadMore = () => {
        if (announcementsLoadingMore) return;
        if (announcementsDisplayedCount >= announcements.length) return;
        setAnnouncementsLoadingMore(true);
        setTimeout(() => {
            setAnnouncementsDisplayedCount(prev => Math.min(prev + ANNOUNCEMENTS_PER_PAGE, announcements.length));
            setAnnouncementsLoadingMore(false);
        }, 300);
    };

    const handleActivitiesLoadMore = () => {
        if (activitiesLoadingMore) return;
        if (activitiesDisplayedCount >= activities.length) return;
        setActivitiesLoadingMore(true);
        setTimeout(() => {
            setActivitiesDisplayedCount(prev => Math.min(prev + ACTIVITIES_PER_PAGE, activities.length));
            setActivitiesLoadingMore(false);
        }, 300);
    };

    // User profile image (listen to users/{uid})
    useEffect(() => {
        const subs: (() => void)[] = [];
        try {
            const currentUser = getCurrentUser();
            if (currentUser) {
                const uref = doc(db, 'users', currentUser.uid);
                const unsubUser = onSnapshot(uref, (snap) => {
                    if (snap.exists()) {
                        const data = snap.data() as any;
                        setUserPhoto(data.profileImage || currentUser.photoURL || undefined);
                    } else {
                        setUserPhoto(currentUser.photoURL || undefined);
                    }
                }, (err) => {
                    console.warn('dashboard user snapshot error', err);
                    setUserPhoto(currentUser.photoURL || undefined);
                });
                subs.push(unsubUser);
            }
        } catch (err) {
            console.warn('dashboard user listener setup error', err);
        }

        return () => subs.forEach(u => u());
    }, []);

    // Pull to refresh
    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // Aggregations
    const cashTotals = useMemo(() => {
        const visible = cash.filter(c => !c.deleted);
        const inSum = visible.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
        const outSum = visible.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
        return { inSum, outSum, balance: inSum - outSum, totalCount: visible.length };
    }, [cash]);

    // NEW: totals according to current cashFilter
    const cashTotalsFiltered = useMemo(() => {
        const visible = cash.filter(c => !c.deleted && (cashFilter === 'all' ? true : c.type === cashFilter));
        const inSum = visible.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
        const outSum = visible.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
        return { inSum, outSum, balance: inSum - outSum, totalCount: visible.length, visible };
    }, [cash, cashFilter]);

    function getAnnouncementStatus(a: Announcement) {
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);
        const start = a.startDate ? new Date(a.startDate) : new Date('1970-01-01');
        const end = a.endDate ? new Date(a.endDate) : new Date('9999-12-31');
        if (today < start) return 'upcoming';
        if (today > end) return 'expired';
        return 'active';
    }
    const announcementCounts = useMemo(() => {
        const active = announcements.filter(a => getAnnouncementStatus(a) === 'active').length;
        const upcoming = announcements.filter(a => getAnnouncementStatus(a) === 'upcoming').length;
        const expired = announcements.filter(a => getAnnouncementStatus(a) === 'expired').length;
        return { active, upcoming, expired, total: announcements.length };
    }, [announcements]);

    const activityCounts = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const active = activities.filter(a => a.date === todayStr).length;
        const upcoming = activities.filter(a => a.date && a.date > todayStr).length;
        const past = activities.filter(a => a.date && a.date < todayStr).length;
        return { active, upcoming, past, total: activities.length };
    }, [activities]);

    const scheduleCounts = useMemo(() => {
        const total = schedules.length;
        const withDays = schedules.filter(s => Array.isArray(s.days) && s.days.length > 0).length;
        return { total, withDays };
    }, [schedules]);

    // Simple renderers per tab
    function renderCash() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                {/* Replaced local wrapper View with reusable ListCardWrapper */}
                <ListCardWrapper style={{ marginHorizontal: 0 }}>
                    <FlatList
                        // paginated cash: show initial 5, load more on scroll
                        data={(cashTotalsFiltered.visible || []).slice(0, cashDisplayedCount)}
                        keyExtractor={(i) => i.id}
                        // ensure card content has horizontal gap from wrapper edges
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
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_data_available')}</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    {t('no_cash_transactions_today')}
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 6, // reduced gap between cards
                                backgroundColor: '#fff',
                                padding: 16,
                                borderRadius: 12,
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.08,
                                shadowRadius: 4,
                                borderLeftWidth: 4,
                                borderLeftColor: item.type === 'in' ? '#10B981' : '#EF4444',
                            }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <View style={{
                                                backgroundColor: item.type === 'in' ? '#D1FAE5' : '#FEE2E2',
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 999,
                                                marginRight: 8
                                            }}>
                                                <Text style={{
                                                    color: item.type === 'in' ? '#047857' : '#DC2626',
                                                    fontWeight: '700',
                                                    fontSize: 11
                                                }}>
                                                    {item.type === 'in' ? t('in_label') : t('out_label')}
                                                </Text>
                                            </View>
                                            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '500' }}>📅 {item.date}</Text>
                                        </View>
                                        <Text style={{
                                            fontWeight: '800',
                                            color: item.type === 'in' ? '#047857' : '#DC2626',
                                            fontSize: 20,
                                            letterSpacing: -0.5,
                                            marginBottom: 4
                                        }}>
                                            Rp {Math.abs(item.amount).toLocaleString()}
                                        </Text>
                                        {!!item.category && (
                                            <View style={{
                                                backgroundColor: '#F3F4F6',
                                                paddingHorizontal: 8,
                                                paddingVertical: 3,
                                                borderRadius: 6,
                                                alignSelf: 'flex-start',
                                                marginBottom: 4
                                            }}>
                                                <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>🏷️ {item.category}</Text>
                                            </View>
                                        )}
                                        {!!item.description && (
                                            <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                                                {item.description}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                        // load more for cash
                        onEndReached={handleCashLoadMore}
                        onEndReachedThreshold={0.2}
                        ListFooterComponent={() => (
                            <LoadMore
                                loading={cashLoadingMore}
                                hasMore={cashDisplayedCount < (cashTotalsFiltered.visible?.length || 0)}
                            />
                        )}
                    />
                </ListCardWrapper>
            </View>
        );
    }

    function renderAnnouncements() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                <ListCardWrapper style={{
                    marginHorizontal: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    elevation: 4,
                    overflow: 'hidden',
                    flex: 1,
                    backgroundColor: '#fff',
                }}>
                    <FlatList
                        // paginated announcements: show initial 5, load more on scroll
                        data={announcements.slice(0, announcementsDisplayedCount)}
                        keyExtractor={(i) => i.id}
                        // give horizontal gap so announcement cards don't touch edges
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                        }
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_data_available')}</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    {t('no_active_announcements_today')}
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const status = getAnnouncementStatus(item);
                            const color = status === 'active' ? '#ECFDF5' : status === 'upcoming' ? '#FEF3C7' : '#FEF2F2';
                            const textColor = status === 'active' ? '#065F46' : status === 'upcoming' ? '#92400E' : '#7F1D1D';
                            const borderColor = status === 'active' ? '#10B981' : status === 'upcoming' ? '#F59E0B' : '#EF4444';
                            return (
                                <View style={{
                                    marginVertical: 6,
                                    backgroundColor: '#fff',
                                    padding: 16,
                                    borderRadius: 12,
                                    elevation: 2,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 4,
                                    borderLeftWidth: 4,
                                    borderLeftColor: borderColor,
                                }}>
                                    {!!item.category && (
                                        <View style={{
                                            backgroundColor: '#F3F4F6',
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 999,
                                            alignSelf: 'flex-start',
                                            marginBottom: 8
                                        }}>
                                            <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600' }}>🏷️ {item.category}</Text>
                                        </View>
                                    )}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        {/* Title */}
                                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', flex: 1 }}>{item.title}</Text>
                                        <View style={{
                                            backgroundColor: color,
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: borderColor
                                        }}>
                                            <Text style={{ color: textColor, fontWeight: '700', fontSize: 10 }}>
                                                {status === 'active' ? t('announcement_status_active', { defaultValue: '● ACTIVE' }) : status === 'upcoming' ? t('announcement_status_upcoming', { defaultValue: '◐ UPCOMING' }) : t('announcement_status_expired', { defaultValue: '○ EXPIRED' })}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Content */}
                                    <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 13, lineHeight: 18 }}>
                                        📢 {item.content}
                                    </Text>

                                    {/* Meta: start/end/date/category (exclude role) */}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                        {!!item.startDate && (
                                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6 }}>
                                                <Text style={{ color: '#1E3A8A', fontSize: 11 }}>{t('start_date_label', { defaultValue: 'Start Date' })}: {item.startDate}</Text>
                                            </View>
                                        )}
                                        {!!item.endDate && (
                                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6 }}>
                                                <Text style={{ color: '#92400E', fontSize: 11 }}>{t('end_date_label', { defaultValue: 'End Date' })}: {item.endDate}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        }}
                        // load more for announcements
                        onEndReached={handleAnnouncementsLoadMore}
                        onEndReachedThreshold={0.2}
                        ListFooterComponent={() => (
                            <LoadMore
                                loading={announcementsLoadingMore}
                                hasMore={announcementsDisplayedCount < announcements.length}
                            />
                        )}
                    />
                </ListCardWrapper>
            </View>
        );
    }

    function renderSchedules() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                {/* Replaced local wrapper View with reusable ListCardWrapper */}
                <ListCardWrapper style={{
                    marginHorizontal: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    elevation: 4,
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    overflow: 'hidden',
                    flex: 1,
                    backgroundColor: '#fff',
                }}>
                    <FlatList
                        // paginated schedules: show initial 5, load more on scroll
                        data={schedules.slice(0, scheduleDisplayedCount)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                        }
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_data_available')}</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    {t('no_schedules_found')}
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 6,
                                backgroundColor: '#fff',
                                padding: 16,
                                borderRadius: 12,
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.08,
                                shadowRadius: 4,
                                borderLeftWidth: 4,
                                borderLeftColor: '#6366F1',
                            }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', flex: 1 }}>
                                        {item.activityName}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        {!!item.frequency && (
                                            <View style={{
                                                backgroundColor: '#FAF7FF',
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: '#C4B5FD',
                                                marginLeft: 4
                                            }}>
                                                <Text style={{ color: '#6D28D9', fontWeight: '700', fontSize: 11 }}>{item.frequency}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Time and Days: show side-by-side */}
                                {(item.time || (item.days && item.days.length > 0)) && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8, gap: 8 }}>
                                        {!!item.time && (
                                            <View style={{
                                                backgroundColor: '#EEF2FF',
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: '#C7D2FE',
                                                marginRight: 8
                                            }}>
                                                <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 11 }}>🕐 {item.time}</Text>
                                            </View>
                                        )}
                                        {!!item.days?.length && (
                                            <View style={{
                                                backgroundColor: '#F3F4F6',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 6,
                                                alignSelf: 'flex-start',
                                            }}>
                                                <Text style={{ color: '#4B5563', fontSize: 12, fontWeight: '600' }}>
                                                    📆 {item.days.join(', ')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Location */}
                                {!!item.location && (
                                    <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                                        📍 {item.location}
                                    </Text>
                                )}

                                {/* Description (if any) */}
                                {!!item.description && (
                                    <Text numberOfLines={3} style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                        )}
                        // load more for schedules
                        onEndReached={handleScheduleLoadMore}
                        onEndReachedThreshold={0.2}
                        ListFooterComponent={() => (
                            <LoadMore loading={scheduleLoadingMore} hasMore={scheduleDisplayedCount < schedules.length} />
                        )}
                    />
                </ListCardWrapper>
            </View>
        );
    }

    function renderActivities() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                <ListCardWrapper style={{
                    marginHorizontal: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    elevation: 4,
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    overflow: 'hidden',
                    flex: 1,
                    backgroundColor: '#fff',
                }}>
                    <FlatList
                        // paginated activities: show initial 5, load more on scroll
                        data={activities.slice(0, activitiesDisplayedCount)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                        }
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_data_available')}</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    {t('no_activities_found')}
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 6,
                                backgroundColor: '#fff',
                                padding: 16,
                                borderRadius: 12,
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.08,
                                shadowRadius: 4,
                                borderLeftWidth: 4,
                                borderLeftColor: '#F59E0B',
                            }}>
                                <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                                    🎯 {item.title}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    {!!item.date && (
                                        <View style={{
                                            backgroundColor: '#FEF3C7',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: '#FDE047'
                                        }}>
                                            <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>📅 {item.date}</Text>
                                        </View>
                                    )}
                                    {!!item.time && (
                                        <View style={{
                                            backgroundColor: '#DBEAFE',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: '#93C5FD'
                                        }}>
                                            <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '600' }}>🕐 {item.time}</Text>
                                        </View>
                                    )}
                                </View>
                                {!!item.location && (
                                    <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                                        📍 {item.location}
                                    </Text>
                                )}

                                {/* Add description for activity */}
                                {!!item.description && (
                                    <Text numberOfLines={3} style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                        )}
                        // load more for activities
                        onEndReached={handleActivitiesLoadMore}
                        onEndReachedThreshold={0.2}
                        ListFooterComponent={() => (
                            <LoadMore
                                loading={activitiesLoadingMore}
                                hasMore={activitiesDisplayedCount < activities.length}
                            />
                        )}
                    />
                </ListCardWrapper>
            </View>
        );
    }

    // Handler for scroll event to update dot indicator
    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / CARD_WIDTH);
        setActiveCardIndex(index);
    };

    // NEW: auto-scroll to first item on mount
    useEffect(() => {
        // delay sedikit agar layout selesai, lalu scroll ke index 1 (Schedule) dengan centered positioning
        const timer = setTimeout(() => {
            quickAccessRef.current?.scrollToIndex({
                index: 1, // Schedule card di tengah
                animated: false,
                viewPosition: 0.5 // center the first item (0.5 = middle of viewport)
            });
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#FFF' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Header with avatar and date */}
            <View style={{ paddingHorizontal: 10, paddingTop: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 }}>
                        {userPhoto ? (
                            <Image source={{ uri: userPhoto }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                        ) : (
                            <Text style={{ color: '#fff', fontSize: 20 }}>👤</Text>
                        )}
                    </View>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 13 }}>{t('menu_dashboard')}</Text>
                        <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '700' }}>{t('app_name')}</Text>
                    </View>
                </View>
                <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>
                        {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Background Ungu Full Width - tanpa card border */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1', '#3b82f6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 24,
                    paddingBottom: 80, // Space untuk Quick Access yang overlap
                }}
            >
                <TouchableOpacity
                    onPress={() => { setActiveTab('cash'); setCashFilter('all'); }}
                    style={{ alignItems: 'center', marginBottom: 24 }}
                >
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                        {t('total_balance', { defaultValue: 'Total Balance' })}
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
                        Rp. {cashTotals.balance.toLocaleString()}
                    </Text>
                </TouchableOpacity>

                {/* In/Out Filter Buttons */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => {
                            setActiveTab('cash');
                            setCashFilter(prev => prev === 'in' ? 'all' : 'in');
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: cashFilter === 'in' ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.2)',
                            borderRadius: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            borderWidth: cashFilter === 'in' ? 0 : 1,
                            borderColor: 'rgba(255,255,255,0.3)',
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                            {cashFilter === 'in' ? '✓ ' : ''}{t('in', { defaultValue: 'In' })}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            setActiveTab('cash');
                            setCashFilter(prev => prev === 'out' ? 'all' : 'out');
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: cashFilter === 'out' ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.2)',
                            borderRadius: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            borderWidth: cashFilter === 'out' ? 0 : 1,
                            borderColor: 'rgba(255,255,255,0.3)',
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                            {cashFilter === 'out' ? '✓ ' : ''}{t('out', { defaultValue: 'Out' })}
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Quick Access - Melayang di atas card ungu */}
            <View style={{ marginTop: -65, marginBottom: 1, paddingBottom: 1, }}>
                <FlatList
                    ref={quickAccessRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[
                        { id: 'announcements', icon: '📢', count: announcementCounts.active, label: t('menu_announcements'), onPress: () => setActiveTab('announcements'), active: activeTab === 'announcements' },
                        { id: 'schedules', icon: '📅', count: scheduleCounts.total, label: t('menu_scheduler'), onPress: () => setActiveTab('schedules'), active: activeTab === 'schedules' },
                        { id: 'activities', icon: '🎯', count: activityCounts.active, label: t('menu_activities'), onPress: () => setActiveTab('activities'), active: activeTab === 'activities' },
                    ]}
                    keyExtractor={(item) => item.id}
                    onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 100));
                        wait.then(() => {
                            quickAccessRef.current?.scrollToIndex({ index: info.index, animated: false });
                        });
                    }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={item.onPress}
                            style={{
                                width: (SCREEN_WIDTH - 10) / 2.2,
                                marginRight: 12,
                                backgroundColor: '#fff',
                                borderRadius: 20,
                                padding: 10,
                                alignItems: 'center',
                                elevation: 8, // Shadow lebih kuat untuk efek melayang
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 12,
                                borderWidth: item.active ? 2 : 0,
                                borderColor: '#0ea5e9',
                            }}
                        >
                            <View style={{
                                width: 54,
                                height: 54,
                                borderRadius: 32,
                                backgroundColor: item.active ? '#dbeafe' : '#f1f5f9',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12
                            }}>
                                <Text style={{ fontSize: 25 }}>{item.icon}</Text>
                            </View>
                            <Text style={{
                                color: item.active ? '#0ea5e9' : '#64748b',
                                fontWeight: '700',
                                fontSize: 22,
                                marginBottom: 6
                            }}>{item.count}</Text>
                            <Text style={{
                                color: item.active ? '#0ea5e9' : '#94a3b8',
                                fontSize: 12,
                                fontWeight: '600',
                                textAlign: 'center'
                            }}>{item.label}</Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 10 }}
                />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'cash' && renderCash()}
                {activeTab === 'announcements' && renderAnnouncements()}
                {activeTab === 'schedules' && renderSchedules()}
                {activeTab === 'activities' && renderActivities()}
            </View>
        </SafeAreaView>
    );
}
