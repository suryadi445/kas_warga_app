import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../src/firebaseConfig';

/**
 * Dashboard with tabs:
 * - Cash
 * - Announcements
 * - Schedules
 * - Activities
 *
 * Data is loaded in real-time from Firestore collections:
 * - cash_reports  -> Cash tab
 * - announcements -> Announcements tab
 * - schedules     -> Schedules tab
 * - activities    -> Activities tab
 */

type CashItem = { id: string; type: 'in' | 'out'; date: string; amount: number; category?: string; description?: string; deleted?: boolean };
type Announcement = { id: string; title: string; content: string; startDate?: string; endDate?: string; date?: string; role?: string; category?: string };
type Schedule = { id: string; activityName: string; time?: string; frequency?: string; days?: string[]; location?: string; description?: string };
type Activity = { id: string; title: string; location?: string; date?: string; time?: string; description?: string };

const TAB_KEYS = ['cash', 'announcements', 'schedules', 'activities'] as const;
type TabKey = typeof TAB_KEYS[number];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40; // 20px padding each side

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('cash');
    // NEW: filter for cash list: 'all' | 'in' | 'out'
    const [cashFilter, setCashFilter] = useState<'all' | 'in' | 'out'>('all');

    // NEW: state for card scroll indicator (dots)
    const [activeCardIndex, setActiveCardIndex] = useState(0);

    // NEW: ref untuk FlatList Quick Access
    const quickAccessRef = useRef<FlatList>(null);

    // Realtime states
    const [cash, setCash] = useState<CashItem[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);

    // NEW: get today's date string (YYYY-MM-DD)
    const getTodayString = () => new Date().toISOString().split('T')[0];

    // Listen to Firestore collections
    useEffect(() => {
        const subs: (() => void)[] = [];

        try {
            const qCash = query(collection(db, 'cash_reports'), orderBy('createdAt', 'desc'));
            const unsubCash = onSnapshot(qCash, snap => {
                const todayStr = getTodayString();
                const rows: CashItem[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        type: data.type || 'in',
                        date: data.date || '',
                        amount: Number(data.amount) || 0,
                        category: data.category || '',
                        description: data.description || '',
                        deleted: !!data.deleted,
                    };
                }).filter(item => !item.deleted && item.date === todayStr); // Filter hari ini saja
                setCash(rows);
            }, err => { console.warn('cash_reports snapshot err', err); });
            subs.push(unsubCash);
        } catch (e) { /* ignore */ }

        try {
            const qAnn = query(collection(db, 'announcements'), orderBy('date', 'desc'));
            const unsubAnn = onSnapshot(qAnn, snap => {
                const todayStr = getTodayString();
                const rows: Announcement[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        title: data.title || '',
                        content: data.content || '',
                        startDate: data.startDate || '',
                        endDate: data.endDate || '',
                        date: data.date || '',
                        role: data.role || '',
                        category: data.category || '',
                    };
                }).filter(item => {
                    // Filter announcements yang aktif hari ini (startDate <= today <= endDate)
                    if (!item.startDate || !item.endDate) return false;
                    const today = new Date(todayStr);
                    const start = new Date(item.startDate);
                    const end = new Date(item.endDate);
                    return today >= start && today <= end;
                });
                setAnnouncements(rows);
            }, err => { console.warn('announcements snapshot err', err); });
            subs.push(unsubAnn);
        } catch (e) { /* ignore */ }

        try {
            const qSched = query(collection(db, 'schedules'), orderBy('createdAt', 'desc'));
            const unsubSched = onSnapshot(qSched, snap => {
                const todayStr = getTodayString();
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
                const rows: Schedule[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        activityName: data.activityName || '',
                        time: data.time || '',
                        frequency: data.frequency || '',
                        days: Array.isArray(data.days) ? data.days : [],
                        location: data.location || '',
                        description: data.description || '',
                    };
                }).filter(item => {
                    // Filter schedules yang applicable hari ini (cek days of week)
                    if (!item.days || item.days.length === 0) return true; // no days = show all
                    return item.days.includes(dayOfWeek);
                });
                setSchedules(rows);
            }, err => { console.warn('schedules snapshot err', err); });
            subs.push(unsubSched);
        } catch (e) { /* ignore */ }

        try {
            const qAct = query(collection(db, 'activities'), orderBy('date', 'desc'));
            const unsubAct = onSnapshot(qAct, snap => {
                const todayStr = getTodayString();
                const rows: Activity[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        title: data.title || '',
                        location: data.location || '',
                        date: data.date || '',
                        time: data.time || '',
                        description: data.description || '',
                    };
                }).filter(item => item.date === todayStr); // Filter hari ini saja
                setActivities(rows);
            }, err => { console.warn('activities snapshot err', err); });
            subs.push(unsubAct);
        } catch (e) { /* ignore */ }

        return () => subs.forEach(u => u());
    }, []);

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
                <View style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    // borders: top + sides only
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 0,
                    borderColor: '#E5E7EB',
                    // shadow mengarah ke atas / samping
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    elevation: 4,
                    overflow: 'hidden',
                }}>
                    <FlatList
                        data={(cashTotalsFiltered.visible || []).slice(0, 50)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No data available</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    No cash transactions for today
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 8,
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
                                                    {item.type === 'in' ? '↑ IN' : '↓ OUT'}
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
                    />
                </View>
            </View>
        );
    }

    function renderAnnouncements() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 0,
                    borderColor: '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    elevation: 4,
                    overflow: 'hidden',
                }}>
                    <FlatList
                        data={announcements.slice(0, 50)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No data available</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    No active announcements today
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
                                    marginVertical: 8,
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
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                                {status === 'active' ? '● ACTIVE' : status === 'upcoming' ? '◐ UPCOMING' : '○ EXPIRED'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text numberOfLines={2} style={{ color: '#6B7280', marginTop: 8, fontSize: 13, lineHeight: 18 }}>
                                        📢 {item.content}
                                    </Text>
                                </View>
                            );
                        }}
                    />
                </View>
            </View>
        );
    }

    function renderSchedules() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 0,
                    borderColor: '#E5E7EB',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    overflow: 'hidden',
                }}>
                    <FlatList
                        data={schedules.slice(0, 50)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No data available</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    No schedules for today
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 8,
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
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', flex: 1 }}>
                                        📅 {item.activityName}
                                    </Text>
                                    {!!item.time && (
                                        <View style={{
                                            backgroundColor: '#EEF2FF',
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: '#C7D2FE'
                                        }}>
                                            <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 11 }}>🕐 {item.time}</Text>
                                        </View>
                                    )}
                                </View>
                                {!!item.days?.length && (
                                    <View style={{
                                        backgroundColor: '#F3F4F6',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 6,
                                        alignSelf: 'flex-start',
                                        marginTop: 8
                                    }}>
                                        <Text style={{ color: '#4B5563', fontSize: 12, fontWeight: '600' }}>
                                            📆 {item.days.join(', ')}
                                        </Text>
                                    </View>
                                )}
                                {!!item.location && (
                                    <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                                        📍 {item.location}
                                    </Text>
                                )}
                            </View>
                        )}
                    />
                </View>
            </View>
        );
    }

    function renderActivities() {
        return (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 0,
                    borderColor: '#E5E7EB',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.09,
                    shadowRadius: 8,
                    overflow: 'hidden',
                }}>
                    <FlatList
                        data={activities.slice(0, 50)}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No data available</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    No activities scheduled for today
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <View style={{
                                marginVertical: 8,
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
                            </View>
                        )}
                    />
                </View>
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
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 20 }}>👤</Text>
                    </View>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 13 }}>Dashboard</Text>
                        <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '700' }}>Kas Warga</Text>
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
                        Total Balance
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
                            {cashFilter === 'in' ? '✓ ' : ''}In
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
                            {cashFilter === 'out' ? '✓ ' : ''}Out
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
                        { id: 'announcements', icon: '📢', count: announcementCounts.active, label: 'Announcements', onPress: () => setActiveTab('announcements'), active: activeTab === 'announcements' },
                        { id: 'schedules', icon: '📅', count: scheduleCounts.total, label: 'Schedule', onPress: () => setActiveTab('schedules'), active: activeTab === 'schedules' },
                        { id: 'activities', icon: '🎯', count: activityCounts.active, label: 'Activity', onPress: () => setActiveTab('activities'), active: activeTab === 'activities' },
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
