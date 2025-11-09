import React, { useMemo, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import HeaderCard from '../components/HeaderCard';

/**
 * Dashboard simple:
 * - Cash report (cash in / cash out / balance) for selected month/year
 * - Activity count per month (bar chart) for selected year, highlight selected month
 * - Announcement count per month (bar chart) for selected year
 *
 * No external chart libraries used: simple bars are rendered with Views
 */

// ...sample data (replace with real data source later)...
const SAMPLE_CASH = [
    { date: '2025-11-01', amount: 150000 }, // positive = in
    { date: '2025-11-03', amount: -50000 },
    { date: '2025-11-12', amount: 250000 },
    { date: '2025-10-21', amount: -75000 },
    { date: '2025-09-05', amount: 120000 },
    { date: '2025-09-10', amount: -20000 },
];
const SAMPLE_ACTIVITIES = [
    { date: '2025-01-05' }, { date: '2025-01-12' },
    { date: '2025-02-10' },
    { date: '2025-03-03' }, { date: '2025-03-21' }, { date: '2025-03-30' },
    { date: '2025-11-02' }, { date: '2025-11-15' },
];
const SAMPLE_ANNOUNCEMENTS = [
    { date: '2025-01-02' }, { date: '2025-01-20' },
    { date: '2025-04-10' },
    { date: '2025-11-01' }, { date: '2025-11-08' }, { date: '2025-11-20' },
];

// small sample users count (replace with real user datasource)
const SAMPLE_USERS_COUNT = 5;

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYMD(s: string) {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
}

export default function DashboardPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIndex, setMonthIndex] = useState(now.getMonth()); // 0-based
    // monthFilter: 'all' = show per-month charts; number (0..11) = show per-day chart for that month
    const [monthFilter, setMonthFilter] = useState<'all' | number>(now.getMonth());
    // list modal state (for showing clicked month details)
    const [listModalVisible, setListModalVisible] = useState(false);
    const [listKind, setListKind] = useState<'activities' | 'announcements' | 'cash' | null>(null);
    const [listMonth, setListMonth] = useState<number | null>(null);
    const [listYear, setListYear] = useState<number | null>(null);
    // day selected when monthFilter is a specific month and user clicks a day bar
    const [listDay, setListDay] = useState<number | null>(null);

    // helpers: prev/next month/year
    function prevMonth() {
        const m = monthIndex - 1;
        if (m < 0) { setMonthIndex(11); setYear(year - 1); }
        else setMonthIndex(m);
    }
    function nextMonth() {
        const m = monthIndex + 1;
        if (m > 11) { setMonthIndex(0); setYear(year + 1); }
        else setMonthIndex(m);
    }
    function prevYear() { setYear((y) => y - 1); }
    function nextYear() { setYear((y) => y + 1); }

    // compute cash aggregates for selected month/year
    const { cashIn, cashOut, balance } = useMemo(() => {
        // when monthFilter is numeric, compute for that month; otherwise use monthIndex
        const selMonth = typeof monthFilter === 'number' ? monthFilter : monthIndex;
        const ym = `${year}-${String(selMonth + 1).padStart(2, '0')}`;
        let inSum = 0, outSum = 0;
        SAMPLE_CASH.forEach((r) => {
            if (r.date.startsWith(ym)) {
                if (r.amount >= 0) inSum += r.amount;
                else outSum += Math.abs(r.amount);
            }
        });
        return { cashIn: inSum, cashOut: outSum, balance: inSum - outSum };
    }, [year, monthIndex, monthFilter]);

    // series for activities & announcements depending on monthFilter:
    // - if monthFilter === 'all' -> return array[12] per month
    // - if monthFilter is number -> return array[daysInMonth] per day
    const activitiesSeries = useMemo(() => {
        if (monthFilter === 'all') {
            const counts = new Array(12).fill(0);
            SAMPLE_ACTIVITIES.forEach(a => {
                const { y, m } = parseYMD(a.date);
                if (y === year) counts[m - 1] += 1;
            });
            return { labels: monthNames, data: counts };
        } else {
            const m = monthFilter + 1;
            const days = new Date(year, m, 0).getDate();
            const counts = new Array(days).fill(0);
            SAMPLE_ACTIVITIES.forEach(a => {
                const { y, m: mm, d } = parseYMD(a.date);
                if (y === year && mm === m) counts[d - 1] += 1;
            });
            const labels = Array.from({ length: days }, (_, i) => String(i + 1));
            return { labels, data: counts };
        }
    }, [year, monthFilter]);

    const announcementsSeries = useMemo(() => {
        if (monthFilter === 'all') {
            const counts = new Array(12).fill(0);
            SAMPLE_ANNOUNCEMENTS.forEach(a => {
                const { y, m } = parseYMD(a.date);
                if (y === year) counts[m - 1] += 1;
            });
            return { labels: monthNames, data: counts };
        } else {
            const m = monthFilter + 1;
            const days = new Date(year, m, 0).getDate();
            const counts = new Array(days).fill(0);
            SAMPLE_ANNOUNCEMENTS.forEach(a => {
                const { y, m: mm, d } = parseYMD(a.date);
                if (y === year && mm === m) counts[d - 1] += 1;
            });
            const labels = Array.from({ length: days }, (_, i) => String(i + 1));
            return { labels, data: counts };
        }
    }, [year, monthFilter]);

    const cashSeries = useMemo(() => {
        if (monthFilter === 'all') {
            const sums = new Array(12).fill(0);
            SAMPLE_CASH.forEach(c => {
                const { y, m } = parseYMD(c.date);
                if (y === year) sums[m - 1] += c.amount;
            });
            return { labels: monthNames, data: sums };
        } else {
            const m = monthFilter + 1;
            const days = new Date(year, m, 0).getDate();
            const sums = new Array(days).fill(0);
            SAMPLE_CASH.forEach(c => {
                const { y, m: mm, d } = parseYMD(c.date);
                if (y === year && mm === m) sums[d - 1] += c.amount;
            });
            const labels = Array.from({ length: days }, (_, i) => String(i + 1));
            return { labels, data: sums };
        }
    }, [year, monthFilter]);

    // utility to render bar chart with dynamic labels
    function Bars({ labels, data, highlightIndex, kind }: { labels: string[], data: number[], highlightIndex?: number, kind: 'activities' | 'announcements' | 'cash' }) {
        const max = Math.max(...data.map(Math.abs), 1);
        return (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 }}>
                {data.map((v, i) => {
                    const h = Math.round((Math.abs(v) / max) * 100); // percent of max
                    return (
                        <TouchableOpacity key={i} onPress={() => {
                            // set list context: if monthFilter === 'all' we pass month index; else pass day index
                            setListKind(kind);
                            setListYear(year);
                            setListMonth(monthFilter === 'all' ? i : (monthFilter as number));
                            setListDay(monthFilter === 'all' ? null : i + 1);
                            setListModalVisible(true);
                        }}>
                            <View style={{ alignItems: 'center', width: Math.max(22, 320 / labels.length) }}>
                                <View style={{
                                    height: `${h}%`,
                                    width: 18,
                                    backgroundColor: highlightIndex === i ? '#6366f1' : '#93C5FD',
                                    borderRadius: 4,
                                }} />
                                <Text style={{ fontSize: 10, marginTop: 6 }}>{labels[i]}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* header (example style) */}
                <HeaderCard icon="📊" title="Dashboard" subtitle="Ringkasan kegiatan & kas" />

                {/* filters */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700' }}>Overview</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Month filter: All or specific month */}
                        <TouchableOpacity onPress={() => setMonthFilter('all')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: monthFilter === 'all' ? '#E6EEF8' : '#F3F4F6' }}>
                            <Text style={{ fontWeight: monthFilter === 'all' ? '700' : '600' }}>All Month</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setMonthFilter(monthIndex); }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8, backgroundColor: typeof monthFilter === 'number' ? '#E6EEF8' : '#F3F4F6' }}>
                            <Text style={{ fontWeight: typeof monthFilter === 'number' ? '700' : '600' }}>{monthNames[monthIndex]}</Text>
                        </TouchableOpacity>

                        {/* month prev/next when viewing specific month */}
                        <TouchableOpacity onPress={() => { prevMonth(); setMonthFilter(monthIndex); }} style={{ padding: 8 }}>
                            <Text>◀</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { nextMonth(); setMonthFilter(monthIndex); }} style={{ padding: 8 }}>
                            <Text>▶</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={prevYear} style={{ padding: 8, marginLeft: 8 }}>
                            <Text>◀Y</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={nextYear} style={{ padding: 8 }}>
                            <Text>Y▶</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Top summary cards */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1, backgroundColor: '#E8F2FF', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#1E3A8A' }}>Users</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>{SAMPLE_USERS_COUNT}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#065F46' }}>Revenue</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>Rp {cashIn.toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#FEF9C3', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#92400E' }}>Activities</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>{activitiesSeries.data[monthIndex]}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#9F1239' }}>Pending Announcements</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>{announcementsSeries.data[monthIndex]}</Text>
                    </View>
                </View>

                {/* Cash summary */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#6B7280' }}>Cash In</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>Rp {cashIn.toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#FEF3F2', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#6B7280' }}>Cash Out</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>Rp {cashOut.toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: '#6B7280' }}>Balance</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8 }}>Rp {balance.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Charts row */}
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>{monthFilter === 'all' ? 'Activities (per month)' : `Activities (${monthNames[monthFilter as number]})`}</Text>
                    <Bars labels={activitiesSeries.labels} data={activitiesSeries.data} highlightIndex={monthFilter === 'all' ? monthIndex : undefined} kind="activities" />
                </View>

                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>{monthFilter === 'all' ? 'Announcements (per month)' : `Announcements (${monthNames[monthFilter as number]})`}</Text>
                    <Bars labels={announcementsSeries.labels} data={announcementsSeries.data} highlightIndex={monthFilter === 'all' ? monthIndex : undefined} kind="announcements" />
                </View>

                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 32 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>{monthFilter === 'all' ? 'Cash (per month) — net' : `Cash (${monthNames[monthFilter as number]}) — net`}</Text>
                    <Bars labels={cashSeries.labels} data={cashSeries.data} highlightIndex={monthFilter === 'all' ? monthIndex : undefined} kind="cash" />
                </View>

                {/* quick lists */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>Recent activities</Text>
                    {SAMPLE_ACTIVITIES.slice(-5).reverse().map((a, i) => (
                        <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontWeight: '600' }}>Activity</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>{a.date}</Text>
                        </View>
                    ))}
                </View>
                {/* List modal showing items for clicked chart/month */}
                <Modal visible={listModalVisible} transparent animationType="slide" onRequestClose={() => setListModalVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ width: '90%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                                {listKind ? `${listKind.charAt(0).toUpperCase() + listKind.slice(1)} - ${listMonth != null ? monthNames[listMonth] : '-'} ${listYear}` : 'Details'}
                            </Text>
                            <ScrollView>
                                {listKind ? (
                                    (() => {
                                        // if listDay is set => filter by exact day
                                        if (listMonth == null || listYear == null) return <Text>No data</Text>;
                                        const month = listMonth + 1;
                                        if (listDay != null) {
                                            // day-specific list
                                            if (listKind === 'activities') {
                                                const rows = SAMPLE_ACTIVITIES.filter(a => { const { y, m, d } = parseYMD(a.date); return y === listYear && m === month && d === listDay; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text>Activity</Text><Text style={{ color: '#6B7280' }}>{r.date}</Text></View>)) : <Text>No activities</Text>;
                                            }
                                            if (listKind === 'announcements') {
                                                const rows = SAMPLE_ANNOUNCEMENTS.filter(a => { const { y, m, d } = parseYMD(a.date); return y === listYear && m === month && d === listDay; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text>Announcement</Text><Text style={{ color: '#6B7280' }}>{r.date}</Text></View>)) : <Text>No announcements</Text>;
                                            }
                                            if (listKind === 'cash') {
                                                const rows = SAMPLE_CASH.filter(c => { const { y, m, d } = parseYMD(c.date); return y === listYear && m === month && d === listDay; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text style={{ fontWeight: '600' }}>{r.amount >= 0 ? 'Cash In' : 'Cash Out'}</Text><Text style={{ color: '#6B7280' }}>{r.date} — Rp {Math.abs(r.amount).toLocaleString()}</Text></View>)) : <Text>No cash entries</Text>;
                                            }
                                        } else {
                                            // month-level list (existing behavior)
                                            if (listKind === 'activities') {
                                                const rows = SAMPLE_ACTIVITIES.filter(a => { const { y, m } = parseYMD(a.date); return y === listYear && m === month; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text>Activity</Text><Text style={{ color: '#6B7280' }}>{r.date}</Text></View>)) : <Text>No activities</Text>;
                                            }
                                            if (listKind === 'announcements') {
                                                const rows = SAMPLE_ANNOUNCEMENTS.filter(a => { const { y, m } = parseYMD(a.date); return y === listYear && m === month; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text>Announcement</Text><Text style={{ color: '#6B7280' }}>{r.date}</Text></View>)) : <Text>No announcements</Text>;
                                            }
                                            if (listKind === 'cash') {
                                                const rows = SAMPLE_CASH.filter(c => { const { y, m } = parseYMD(c.date); return y === listYear && m === month; });
                                                return rows.length ? rows.map((r, i) => (<View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}><Text style={{ fontWeight: '600' }}>{r.amount >= 0 ? 'Cash In' : 'Cash Out'}</Text><Text style={{ color: '#6B7280' }}>{r.date} — Rp {Math.abs(r.amount).toLocaleString()}</Text></View>)) : <Text>No cash entries</Text>;
                                            }
                                        }
                                        return null;
                                    })()
                                ) : null}
                            </ScrollView>
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                                <TouchableOpacity onPress={() => setListModalVisible(false)} style={{ padding: 8 }}>
                                    <Text style={{ color: '#6366f1', fontWeight: '700' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
}
