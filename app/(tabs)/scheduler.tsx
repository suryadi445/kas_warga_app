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
import ListCardWrapper from '../../src/components/ListCardWrapper';
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
    }, [items, filterFrequency, filterDays]);

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

    // compute displayed items: apply frequency + days filters
    const displayedItems = items.filter(i => {
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

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📅</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Activity Schedule</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage routine and incidental community activities schedule.
                </Text>
            </View>

            {/* Summary card */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 14, padding: 14, elevation: 3 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 1, color: '#6B7280' }}>
                                {items.length} Schedules
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Frequency filter: {filterFrequency === 'all' ? 'All' : FREQUENCY_OPTIONS.find(f => f.value === filterFrequency)?.label}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{displayedItems.length} Total</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Filters: Row 1 = Date + Frequency ; Row 2 = Add */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                {/* Row 1: Days and Frequency */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    {/* Days filter - using FloatingLabelInput (read-only, shows text summary) */}
                    <View style={{ flex: 1 }}>
                        <FloatingLabelInput
                            label="Days"
                            value={filterDays.length ? filterDays.join(', ') : ''}
                            onChangeText={() => { }}
                            placeholder="All days"
                            editable={false}
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Frequency filter - using SelectInput */}
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

                {/* Row 2: Add button (Search removed) */}
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        {/* Search removed as requested */}
                    </View>

                    <View style={{ width: 140 }}>
                        <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center', elevation: 3 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ Schedule</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {loadingSchedules ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                    <ListCardWrapper style={{ marginHorizontal: 0 }}>
                        <FlatList
                            data={displayedItems.slice(0, displayedCount)}
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
                    </ListCardWrapper>
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

                                            {/* Footer with Clear + OK */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12 }}>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedDays([]); setSelectedDaysOpen(false); }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 14, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Text style={{ color: '#DC2626', fontWeight: '600' }}>Clear</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedDaysOpen(false); }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Choose</Text>
                                                </TouchableOpacity>
                                            </View>
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
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Add'}</Text>}
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
