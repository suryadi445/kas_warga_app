import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';

type Schedule = {
    id: string;
    activityName: string;
    time: string; // HH:MM format
    frequency: 'daily' | 'weekly' | 'month_twice' | 'monthly' | 'quarter' | 'yearly';
    location: string;
    description: string;
    days?: string[]; // NEW: selected days of week (e.g. ['Sun','Mon'])
};

const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'month_twice', label: 'Month Twice' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarter', label: 'Quarter Month' },
    { value: 'yearly', label: 'Yearly' },
];

export default function SchedulerScreen() {
    const { showToast } = useToast();
    const [items, setItems] = useState<Schedule[]>([]); // now loaded from Firestore
    // filters -> days + frequency
    const [filterDays, setFilterDays] = useState<string[]>([]); // e.g. ['Sunday','Tuesday']
    const [filterFrequency, setFilterFrequency] = useState<'all' | Schedule['frequency']>('all');
    // toggle helper for filterDays (multi-select)
    const toggleFilterDay = (day: string) => {
        setFilterDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
    };
    // NEW: control dropdown open state for Filters' Days (behave like modal's select)
    const [filterDaysOpen, setFilterDaysOpen] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingSchedules, setLoadingSchedules] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [activityName, setActivityName] = useState('');
    const [time, setTime] = useState('09:00');
    const [frequency, setFrequency] = useState<Schedule['frequency']>('monthly');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [frequencyOpen, setFrequencyOpen] = useState(false);

    // NEW: search query state
    const [searchQuery, setSearchQuery] = useState<string>('');
    // NEW: control show / collapse filters card (default = closed)
    const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

    // NEW: days of week helper & selected days state for modal
    const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [selectedDaysOpen, setSelectedDaysOpen] = useState(false); // NEW: dropdown open state

    // PAGINATION state
    const SCHEDULES_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(SCHEDULES_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Reset displayed count when items or filters change
    useEffect(() => {
        setDisplayedCount(SCHEDULES_PER_PAGE);
    }, [items, filterFrequency, filterDays, searchQuery]);

    // realtime listener for schedules collection
    useEffect(() => {
        setLoadingSchedules(true);
        const q = query(collection(db, 'schedules'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const rows: Schedule[] = snap.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    activityName: data.activityName || '',
                    time: data.time || '',
                    frequency: data.frequency || 'monthly',
                    location: data.location || '',
                    description: data.description || '',
                    days: data.days || [],
                };
            });
            setItems(rows);
            setLoadingSchedules(false);
        }, (err) => {
            console.error('schedules snapshot error', err);
            setLoadingSchedules(false);
        });
        return () => unsub();
    }, [refreshTrigger]);

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // compute displayed items: apply frequency + days filters + search
    const displayedItems = items.filter(i => {
        // search filter (by activity name or location)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = (i.activityName || '').toLowerCase().includes(query);
            const matchLocation = (i.location || '').toLowerCase().includes(query);
            if (!matchName && !matchLocation) return false;
        }
        if (filterFrequency !== 'all' && i.frequency !== filterFrequency) return false;
        if (filterDays && filterDays.length > 0) {
            // require schedule to have days and at least one matching day
            if (!i.days || !Array.isArray(i.days) || i.days.length === 0) return false;
            const hasMatch = i.days.some(d => filterDays.includes(d));
            if (!hasMatch) return false;
        }
        return true;
    });

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= displayedItems.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + SCHEDULES_PER_PAGE, displayedItems.length));
            setLoadingMore(false);
        }, 400);
    };

    function openAdd() {
        setEditingId(null);
        setActivityName('');
        setTime('09:00');
        setFrequency('monthly');
        setLocation('');
        setDescription('');
        setSelectedDays([]); // reset days
        setModalVisible(true);
    }

    function openEdit(s: Schedule) {
        setEditingId(s.id);
        setActivityName(s.activityName);
        setTime(s.time);
        setFrequency(s.frequency);
        setLocation(s.location);
        setDescription(s.description);
        setSelectedDays(s.days ? [...s.days] : []); // load existing days
        setModalVisible(true);
    }

    async function save() {
        if (!activityName.trim()) {
            showToast('Activity name is required', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'schedules', editingId);
                await updateDoc(ref, { activityName, time, frequency, location, description, days: selectedDays, updatedAt: serverTimestamp() });
                showToast('Schedule updated', 'success');
            } else {
                await addDoc(collection(db, 'schedules'), { activityName, time, frequency, location, description, days: selectedDays, createdAt: serverTimestamp() });
                showToast('Schedule added', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('schedule save error', e);
            showToast('Failed to save schedule', 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function removeConfirmed() {
        if (!itemToDelete) return;
        setDeleteConfirmVisible(false);
        setOperationLoading(true);
        try {
            await deleteDoc(doc(db, 'schedules', itemToDelete));
            showToast('Schedule deleted', 'success');
        } catch (e) {
            console.error('delete schedule error', e);
            showToast('Failed to delete schedule', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    // Counts for summary tabs
    const totalSchedules = items.length;
    const dailyCount = items.filter(i => i.frequency === 'daily').length;
    const weeklyCount = items.filter(i => i.frequency === 'weekly').length;
    const monthlyCount = items.filter(i => i.frequency === 'monthly').length;

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Purple Gradient Background for Header */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                }}
            />

            {/* Header - Horizontal Layout */}
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {/* Icon on left */}
                    <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 6
                    }}>
                        <Text style={{ fontSize: 32 }}>📅</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>Activity Schedule</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            Manage routine and incidental community activities schedule.
                        </Text>
                    </View>
                </View>
            </View>

            {/* Status Summary - Compact Tab Style */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 12,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)'
                }}>
                    <TouchableOpacity
                        onPress={() => setFilterFrequency('all')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterFrequency === 'all' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterFrequency === 'all' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterFrequency === 'all' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterFrequency === 'all' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>📢 All</Text>
                        <Text style={{
                            color: filterFrequency === 'all' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{totalSchedules}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterFrequency('daily')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterFrequency === 'daily' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterFrequency === 'daily' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterFrequency === 'daily' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterFrequency === 'daily' ? '#D97706' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>☀️ Daily</Text>
                        <Text style={{
                            color: filterFrequency === 'daily' ? '#D97706' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{dailyCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterFrequency('weekly')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterFrequency === 'weekly' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterFrequency === 'weekly' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterFrequency === 'weekly' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterFrequency === 'weekly' ? '#2563EB' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>📅 Weekly</Text>
                        <Text style={{
                            color: filterFrequency === 'weekly' ? '#2563EB' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{weeklyCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterFrequency('monthly')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterFrequency === 'monthly' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterFrequency === 'monthly' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterFrequency === 'monthly' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterFrequency === 'monthly' ? '#4F46E5' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>🌙 Monthly</Text>
                        <Text style={{
                            color: filterFrequency === 'monthly' ? '#4F46E5' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{monthlyCount}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search & Add Button - On Purple Gradient */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    padding: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                }}>
                    {/* Left: Search Input */}
                    <View style={{ flex: 1.5 }}>
                        <FloatingLabelInput
                            label="Search"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search..."
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: Add Button */}
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity disabled={operationLoading} onPress={openAdd} activeOpacity={0.9}>
                            <LinearGradient
                                colors={['#7c3aed', '#6366f1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    shadowColor: '#7c3aed',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 2,
                                    height: 50,
                                    justifyContent: 'center'
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Schedule</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* FILTERS: Compact Card */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    padding: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    overflow: 'hidden',
                }}>
                    <TouchableOpacity
                        onPress={() => setFiltersOpen(prev => !prev)}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>🔍 Filters</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filtersOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filtersOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Days & Frequency - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label="Days"
                                        value={filterDays.length ? filterDays.join(', ') : ''}
                                        onChangeText={() => { }}
                                        placeholder="All days"
                                        editable={false}
                                        onPress={() => setFilterDaysOpen(v => !v)}
                                        containerStyle={{ marginBottom: 0 }}
                                    />

                                    {filterDaysOpen && (
                                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 8, zIndex: 1000, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled={true}>
                                                {/* Header buttons moved to top - geser Choose sedikit ke kiri */}
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                                    <TouchableOpacity
                                                        onPress={() => { setFilterDays([]); setFilterDaysOpen(false); }}
                                                        style={{ paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Text style={{ color: '#DC2626', fontWeight: '600' }}>Clear</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => { setFilterDaysOpen(false); }}
                                                        style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Choose</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {WEEK_DAYS.map((d) => {
                                                    const active = filterDays.includes(d);
                                                    return (
                                                        <TouchableOpacity
                                                            key={d}
                                                            onPress={() => toggleFilterDay(d)}
                                                            style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
                                                        >
                                                            <Text style={{ color: active ? '#6366f1' : '#111827', fontWeight: active ? '600' : '400' }}>{d}</Text>
                                                            {active ? <Text style={{ color: '#6366f1', fontWeight: '700' }}>✓</Text> : null}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label="Frequency"
                                        value={filterFrequency}
                                        options={[
                                            { label: 'All Frequency', value: 'all' },
                                            ...FREQUENCY_OPTIONS
                                        ]}
                                        onValueChange={(v: string) => setFilterFrequency(v as any)}
                                        placeholder="Select frequency"
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {loadingSchedules ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 18 }}>
                    <View style={{
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
                        flex: 1
                    }}>
                        <FlatList
                            data={displayedItems.slice(0, displayedCount)}
                            keyExtractor={(i) => i.id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} tintColor="#7c3aed" />
                            }
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No schedules found</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        No schedules match your filters
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === item.frequency)?.label ?? item.frequency;
                                const freqColors: Record<string, { bg: string; text: string; border: string }> = {
                                    daily: { bg: '#FEF9C3', text: '#92400E', border: '#FDE047' },
                                    weekly: { bg: '#DBEAFE', text: '#1E40AF', border: '#60A5FA' },
                                    month_twice: { bg: '#E6FFFA', text: '#065F46', border: '#34D399' },
                                    monthly: { bg: '#EFF6FF', text: '#3730A3', border: '#818CF8' },
                                    quarter: { bg: '#FEF2F2', text: '#7F1D1D', border: '#F87171' },
                                    yearly: { bg: '#F0FDF4', text: '#065F46', border: '#22C55E' },
                                };
                                const colors = freqColors[item.frequency] ?? { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };

                                return (
                                    <View style={{ marginVertical: 6 }}>
                                        <View style={{
                                            position: 'relative',
                                            backgroundColor: '#fff',
                                            padding: 16,
                                            borderRadius: 12,
                                            elevation: 2,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.08,
                                            shadowRadius: 4,
                                            borderLeftWidth: 4,
                                            borderLeftColor: colors.border,
                                            paddingRight: 110,
                                        }}>
                                            {/* Actions - positioned absolute center right */}
                                            <View style={{ position: 'absolute', top: '50%', right: 12, zIndex: 5, flexDirection: 'column', gap: 8, transform: [{ translateY: -30 }] }}>
                                                <TouchableOpacity
                                                    onPress={() => openEdit(item)}
                                                    disabled={operationLoading}
                                                    style={{
                                                        backgroundColor: '#E0F2FE',
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 6,
                                                        borderRadius: 8,
                                                        opacity: operationLoading ? 0.5 : 1
                                                    }}
                                                >
                                                    <Text style={{ color: '#0369A1', fontWeight: '600', fontSize: 12 }}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => confirmRemove(item.id)}
                                                    disabled={operationLoading}
                                                    style={{
                                                        backgroundColor: '#FEE2E2',
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 6,
                                                        borderRadius: 8,
                                                        opacity: operationLoading ? 0.5 : 1
                                                    }}
                                                >
                                                    <Text style={{ color: '#991B1B', fontWeight: '600', fontSize: 12 }}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Frequency badge */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                <View style={{
                                                    backgroundColor: colors.bg,
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 5,
                                                    borderRadius: 999,
                                                    borderWidth: 2,
                                                    borderColor: colors.border
                                                }}>
                                                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 10 }}>
                                                        {freqLabel}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                                                {item.activityName}
                                            </Text>

                                            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>
                                                📍 {item.location}
                                            </Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                {!!item.time && (
                                                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#4338CA', fontSize: 11, fontWeight: '600' }}>🕐 {item.time}</Text>
                                                    </View>
                                                )}
                                                {!!item.days?.length && (
                                                    <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#4B5563', fontSize: 11, fontWeight: '600' }}>📆 {item.days.join(', ')}</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {!!item.description && (
                                                <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13 }}>
                                                    {item.description}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            }}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => (
                                <LoadMore
                                    loading={loadingMore}
                                    hasMore={displayedCount < displayedItems.length}
                                />
                            )}
                        />
                    </View>
                </View>
            )}

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        {/* disable parent scrolling while a dropdown list is open so child ScrollView can handle touch */}
                        <ScrollView scrollEnabled={!selectedDaysOpen && !frequencyOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? 'Edit Schedule' : 'Add Schedule'}</Text>

                            <FloatingLabelInput
                                label="Activity Name"
                                value={activityName}
                                onChangeText={setActivityName}
                                placeholder="Enter activity name"
                            />

                            <FloatingLabelInput
                                label="Time"
                                value={time}
                                onChangeText={setTime}
                                placeholder="HH:MM"
                                keyboardType="numbers-and-punctuation"
                            />

                            {/* Days (dropdown multi-select, placed under Time) */}
                            <FloatingLabelInput
                                label="Days"
                                value={selectedDays.length ? selectedDays.join(', ') : ''}
                                onChangeText={() => { }}
                                placeholder="All days"
                                editable={false}
                                onPress={() => setSelectedDaysOpen(v => !v)}
                            />

                            {/* Days dropdown (when opened) */}
                            {selectedDaysOpen && (
                                <View style={{ position: 'relative' }}>
                                    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: -8, marginBottom: 12, zIndex: 1000, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                        {/* nestedScrollEnabled allows the inner ScrollView to scroll when inside another ScrollView (Android) */}
                                        <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled={true}>
                                            {/* Header with Clear + Choose (moved to top, geser Choose ke kiri) */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedDays([]); setSelectedDaysOpen(false); }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Text style={{ color: '#DC2626', fontWeight: '600' }}>Clear</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedDaysOpen(false); }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Choose</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {WEEK_DAYS.map((d) => {
                                                const active = selectedDays.includes(d);
                                                return (
                                                    <TouchableOpacity
                                                        key={d}
                                                        onPress={() => {
                                                            setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
                                                        }}
                                                        style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
                                                    >
                                                        <Text style={{ color: active ? '#6366f1' : '#111827', fontWeight: active ? '600' : '400' }}>{d}</Text>
                                                        {active ? <Text style={{ color: '#6366f1', fontWeight: '700' }}>✓</Text> : null}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </View>
                            )}

                            <SelectInput
                                label="Frequency"
                                value={frequency}
                                options={FREQUENCY_OPTIONS}
                                onValueChange={(v: string) => setFrequency(v as Schedule['frequency'])}
                                placeholder="Select frequency"
                            />

                            <FloatingLabelInput
                                label="Location"
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Enter location"
                            />

                            <FloatingLabelInput
                                label="Description"
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Enter description (optional)"
                                multiline
                                inputStyle={{ minHeight: 120, paddingTop: 18 }}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Create'}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete Schedule"
                message="Are you sure you want to delete this schedule? This action cannot be undone."
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
            />
        </SafeAreaView>
    );
}
