import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

type Schedule = {
    id: string;
    activityName: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM or display
    rawTime?: any; // legacy/raw stored value
    frequency: 'daily' | 'weekly' | 'twice_week' | 'month_twice' | 'monthly' | 'quarter' | 'yearly';
    location: string;
    description: string;
    days?: string[]; // NEW: selected days of week (e.g. ['Sun','Mon'])
};

const FREQUENCY_VALUES = ['daily', 'weekly', 'twice_week', 'month_twice', 'monthly', 'quarter', 'yearly'];

export default function SchedulerScreen() {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const FREQUENCY_OPTIONS = FREQUENCY_VALUES.map(v => ({ value: v as Schedule['frequency'], label: t(`frequency_${v}`) }));
    const [items, setItems] = useState<Schedule[]>([]); // now loaded from Firestore
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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
    const [date, setDate] = useState<string>('');
    const [time, setTime] = useState<string>('09:00');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
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

    // Helper: normalize and sort days so UI shows Monday..Sunday order
    const WEEK_ORDER_MONDAY_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    function normalizeDayName(d: string) {
        if (!d) return '';
        const s = String(d).trim().toLowerCase();
        const map: Record<string, string> = {
            mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
            monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
        };
        const key = s.slice(0, 3);
        return map[key] || '';
    }

    function sortDaysMondayFirst(days?: string[] | null) {
        if (!days || days.length === 0) return [] as string[];
        const normalized = days.map(d => normalizeDayName(d)).filter(Boolean);
        // remove duplicates while preserving order defined by WEEK_ORDER_MONDAY_FIRST
        const unique = Array.from(new Set(normalized));
        return unique.sort((a, b) => WEEK_ORDER_MONDAY_FIRST.indexOf(a) - WEEK_ORDER_MONDAY_FIRST.indexOf(b));
    }

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
                // normalize date/time
                const dateVal = data.date || '';
                let timeVal = '';
                if (data.time) {
                    // if ISO-like or contains T, parse then format HH:MM
                    const parsed = new Date(data.time);
                    if (!isNaN(parsed.getTime())) {
                        const hh = `${parsed.getHours()}`.padStart(2, '0');
                        const mm = `${parsed.getMinutes()}`.padStart(2, '0');
                        timeVal = `${hh}:${mm}`;
                    } else {
                        timeVal = String(data.time);
                    }
                }
                return {
                    id: d.id,
                    activityName: data.activityName || '',
                    date: dateVal,
                    time: timeVal,
                    rawTime: data.time || null,
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

    // load current user's role for client-side permission checks
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const user = getCurrentUser();
                if (!user) return;
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (!mounted) return;
                if (snap && snap.exists()) {
                    const data: any = snap.data();
                    setCurrentUserRole(data?.role || null);
                }
            } catch (err) {
                console.warn('Failed to load current user role', err);
            }
        })();
        return () => { mounted = false; };
    }, []);

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
        if (currentUserRole !== 'Admin') {
            showToast(
                t('permission_denied_admin_add', { defaultValue: 'Permission Denied: Only admin can add schedules' }),
                'error'
            );
            return;
        }
        setEditingId(null);
        setActivityName('');
        setDate('');
        setTime('09:00');
        setFrequency('monthly');
        setLocation('');
        setDescription('');
        setSelectedDays([]); // reset days
        setModalVisible(true);
    }

    function openEdit(s: Schedule) {
        if (currentUserRole !== 'Admin') {
            showToast(
                t('permission_denied_admin_edit', { defaultValue: 'Permission Denied: Only admin can edit schedules' }),
                'error'
            );
            return;
        }
        setEditingId(s.id);
        setActivityName(s.activityName);
        setDate((s as any).date || '');
        setTime(s.time || '09:00');
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
                const daysToSave = sortDaysMondayFirst(selectedDays);
                await updateDoc(ref, { activityName, date, time, frequency, location, description, days: daysToSave, updatedAt: serverTimestamp() });
                setSelectedDays(daysToSave);
                showToast(t('schedule_updated', { defaultValue: 'Schedule updated' }), 'success');
            } else {
                const daysToSave = sortDaysMondayFirst(selectedDays);
                await addDoc(collection(db, 'schedules'), { activityName, date, time, frequency, location, description, days: daysToSave, createdAt: serverTimestamp() });
                setSelectedDays(daysToSave);
                showToast(t('schedule_added', { defaultValue: 'Schedule added' }), 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('schedule save error', e);
            showToast(t('failed_to_save_schedule', { defaultValue: 'Failed to save schedule' }), 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        if (currentUserRole !== 'Admin') {
            showToast('Permission Denied: Only admin can delete schedules', 'error');
            return;
        }
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

    function formatDateOnly(dateStr: string) {
        if (!dateStr) return '';
        try {
            const iso = `${dateStr}T00:00:00`;
            const d = new Date(iso);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

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
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('scheduler_title', { defaultValue: 'Activity Schedule' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('scheduler_subtitle', { defaultValue: 'Manage routine and incidental community activities schedule.' })}
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
                        }}>{t('scheduler_tab_all', { defaultValue: '📢 All' })}</Text>
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
                        }}>{t('scheduler_tab_daily', { defaultValue: '☀️ Daily' })}</Text>
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
                        }}>{t('scheduler_tab_weekly', { defaultValue: '📅 Weekly' })}</Text>
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
                        }}>{t('scheduler_tab_monthly', { defaultValue: '🌙 Monthly' })}</Text>
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
                            label={t('search', { defaultValue: 'Search' })}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t('search_placeholder', { defaultValue: 'Search...' })}
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: Add Button */}
                    {currentUserRole === 'Admin' && (
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('add_schedule_button', { defaultValue: '+ Schedule' })}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
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
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{t('filters', { defaultValue: '🔍 Filters' })}</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filtersOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filtersOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Days & Frequency - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('days_label', { defaultValue: 'Days' })}
                                        value={filterDays.length ? filterDays.map(d => t(`weekday_${d.toLowerCase()}`, { defaultValue: d })).join(', ') : ''}
                                        onChangeText={() => { }}
                                        placeholder={t('all_days', { defaultValue: 'All days' })}
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
                                                        <Text style={{ color: '#DC2626', fontWeight: '600' }}>{t('clear', { defaultValue: 'Clear' })}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => { setFilterDaysOpen(false); }}
                                                        style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{t('choose', { defaultValue: 'Choose' })}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {WEEK_DAYS.map((d) => {
                                                    const active = filterDays.includes(d);
                                                    const label = t(`weekday_${d.toLowerCase()}`, { defaultValue: d });
                                                    return (
                                                        <TouchableOpacity
                                                            key={d}
                                                            onPress={() => toggleFilterDay(d)}
                                                            style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
                                                        >
                                                            <Text style={{ color: active ? '#6366f1' : '#111827', fontWeight: active ? '600' : '400' }}>{label}</Text>
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
                                        label={t('frequency_label', { defaultValue: 'Frequency' })}
                                        value={filterFrequency}
                                        options={[
                                            { label: t('all_frequency', { defaultValue: 'All Frequency' }), value: 'all' },
                                            ...FREQUENCY_OPTIONS.map(f => ({ label: t(`frequency_${f.value}`, { defaultValue: f.label }), value: f.value }))
                                        ]}
                                        onValueChange={(v: string) => setFilterFrequency(v as any)}
                                        placeholder={t('select_frequency', { defaultValue: 'Select frequency' })}
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
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_schedules_found', { defaultValue: 'No schedules found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_schedules_match_filters', { defaultValue: 'No schedules match your filters' })}
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const freqLabel = t(`frequency_${item.frequency}`, { defaultValue: FREQUENCY_OPTIONS.find((f) => f.value === item.frequency)?.label ?? item.frequency });
                                const freqColors: Record<string, { bg: string; text: string; border: string }> = {
                                    daily: { bg: '#FEF9C3', text: '#92400E', border: '#FDE047' },
                                    weekly: { bg: '#DBEAFE', text: '#1E40AF', border: '#60A5FA' },
                                    month_twice: { bg: '#E6FFFA', text: '#065F46', border: '#34D399' },
                                    twice_week: { bg: '#ECFDF5', text: '#065F46', border: '#34D399' },
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
                                            {/* Actions - positioned absolute center right (Admin only) */}
                                            {currentUserRole === 'Admin' && (
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
                                                        <Text style={{ color: '#0369A1', fontWeight: '600', fontSize: 12 }}>{t('edit', { defaultValue: 'Edit' })}</Text>
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
                                                        <Text style={{ color: '#991B1B', fontWeight: '600', fontSize: 12 }}>{t('delete', { defaultValue: 'Delete' })}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

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

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                {!!item.date && (
                                                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>📅 {formatDateOnly(item.date)}</Text>
                                                    </View>
                                                )}

                                                {!!item.time && (
                                                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#4338CA', fontSize: 11, fontWeight: '600' }}>🕐 {item.time}</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Days row (separate row under date/time) */}
                                            {!!item.days?.length && (
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                                    <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#4B5563', fontSize: 11, fontWeight: '600' }}>
                                                            📆 {item.days.map(d => t(`weekday_${d.toLowerCase()}`, { defaultValue: d })).join(', ')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

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
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? t('edit_schedule', { defaultValue: 'Edit Schedule' }) : t('add_schedule', { defaultValue: 'Add Schedule' })}</Text>

                            <FloatingLabelInput
                                label={t('activity_name_label', { defaultValue: 'Activity Name' })}
                                value={activityName}
                                onChangeText={setActivityName}
                                placeholder={t('activity_name_placeholder', { defaultValue: 'Enter activity name' })}
                            />

                            <FloatingLabelInput
                                label={t('date_label', { defaultValue: 'Date' })}
                                value={date ? (() => {
                                    try {
                                        const iso = `${date}T00:00:00`;
                                        const d = new Date(iso);
                                        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                                    } catch (e) { return date; }
                                })() : ''}
                                onChangeText={() => { }}
                                placeholder={t('select_date', { defaultValue: 'Select date' })}
                                editable={Platform.OS === 'web'}
                                onPress={Platform.OS === 'web' ? undefined : () => setShowDatePicker(true)}
                            />

                            <DateTimePickerModal
                                isVisible={showDatePicker}
                                mode="date"
                                date={date ? new Date(`${date}T00:00:00`) : new Date()}
                                onConfirm={(d: Date) => {
                                    setShowDatePicker(false);
                                    const y = d.getFullYear();
                                    const m = `${d.getMonth() + 1}`.padStart(2, '0');
                                    const day = `${d.getDate()}`.padStart(2, '0');
                                    setDate(`${y}-${m}-${day}`);
                                }}
                                onCancel={() => setShowDatePicker(false)}
                            />

                            <FloatingLabelInput
                                label={t('time_label', { defaultValue: 'Time' })}
                                value={time}
                                onChangeText={() => { }}
                                placeholder={t('select_time', { defaultValue: 'Select time' })}
                                editable={Platform.OS === 'web'}
                                onPress={Platform.OS === 'web' ? undefined : () => setShowTimePicker(true)}
                            />

                            <DateTimePickerModal
                                isVisible={showTimePicker}
                                mode="time"
                                date={(function () {
                                    if (!time) return new Date();
                                    const parts = time.split(':');
                                    const now = new Date();
                                    now.setHours(Number(parts[0] || 0), Number(parts[1] || 0), 0, 0);
                                    return now;
                                })()}
                                onConfirm={(d: Date) => {
                                    setShowTimePicker(false);
                                    const hh = `${d.getHours()}`.padStart(2, '0');
                                    const mm = `${d.getMinutes()}`.padStart(2, '0');
                                    setTime(`${hh}:${mm}`);
                                }}
                                onCancel={() => setShowTimePicker(false)}
                            />

                            {/* Days (dropdown multi-select, placed under Time) */}
                            <FloatingLabelInput
                                label={t('days_label', { defaultValue: 'Days' })}
                                value={selectedDays.length ? selectedDays.map(d => t(`weekday_${d.toLowerCase()}`)).join(', ') : ''}
                                onChangeText={() => { }}
                                placeholder={t('all_days', { defaultValue: 'All days' })}
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
                                                    <Text style={{ color: '#DC2626', fontWeight: '600' }}>{t('clear', { defaultValue: 'Clear' })}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedDaysOpen(false); }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{t('choose', { defaultValue: 'Choose' })}</Text>
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
                                                        <Text style={{ color: active ? '#6366f1' : '#111827', fontWeight: active ? '600' : '400' }}>{t(`weekday_${d.toLowerCase()}`)}</Text>
                                                        {active ? <Text style={{ color: '#6366f1', fontWeight: '700' }}>✓</Text> : null}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </View>
                            )}

                            <SelectInput
                                label={t('frequency_label', { defaultValue: 'Frequency' })}
                                value={frequency}
                                options={FREQUENCY_OPTIONS}
                                onValueChange={(v: string) => setFrequency(v as Schedule['frequency'])}
                                placeholder={t('select_frequency', { defaultValue: 'Select frequency' })}
                            />

                            <FloatingLabelInput
                                label={t('location_label', { defaultValue: 'Location' })}
                                value={location}
                                onChangeText={setLocation}
                                placeholder={t('location_placeholder', { defaultValue: 'Enter location' })}
                            />

                            <FloatingLabelInput
                                label={t('description_label', { defaultValue: 'Description' })}
                                value={description}
                                onChangeText={setDescription}
                                placeholder={t('description_optional_placeholder', { defaultValue: 'Enter description (optional)' })}
                                multiline
                                inputStyle={{ minHeight: 120, paddingTop: 18 }}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title={t('delete_schedule_title', { defaultValue: 'Delete Schedule' })}
                message={t('delete_schedule_message', { defaultValue: 'Are you sure you want to delete this schedule? This action cannot be undone.' })}
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
            />
        </SafeAreaView>
    );
}
