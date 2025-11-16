import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

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
    const [filterDaysOpen, setFilterDaysOpen] = useState(false);
    const [filterFrequency, setFilterFrequency] = useState<'all' | Schedule['frequency']>('all');
    const [filterFrequencyOpen, setFilterFrequencyOpen] = useState(false);

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
    }, []);

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

    const renderItem = ({ item }: { item: Schedule }) => {
        const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === item.frequency)?.label ?? item.frequency;
        const freqColors: Record<string, { bg: string; text: string }> = {
            daily: { bg: '#FEF9C3', text: '#92400E' },
            weekly: { bg: '#DBEAFE', text: '#1E40AF' },
            month_twice: { bg: '#E6FFFA', text: '#065F46' },
            monthly: { bg: '#EFF6FF', text: '#3730A3' },
            quarter: { bg: '#FEF2F2', text: '#7F1D1D' },
            yearly: { bg: '#F0FDF4', text: '#065F46' },
        };
        const colors = freqColors[item.frequency] ?? { bg: '#F3F4F6', text: '#374151' };
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ position: 'relative', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2, paddingRight: 120 }}>
                    {/* Badge + actions absolute at top-right */}
                    <View style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, alignItems: 'flex-end' }}>
                        <View style={{ backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 8 }}>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 10 }}>{freqLabel}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 6 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmRemove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: '#111827' }}>{item.activityName}</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>{item.location}</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 }}>
                                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 12 }}>{item.time}</Text>
                            </View>

                            {/* show selected days summary */}
                            {item.days && item.days.length > 0 ? (
                                <View style={{ marginLeft: 8, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                                    <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>{item.days.join(', ')}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text numberOfLines={2} style={{ color: '#374151', marginTop: 8 }}>{item.description || '—'}</Text>
                    </View>
                </View>
            </View>
        );
    };

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
            <View className="px-6 mb-3">
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 14, padding: 14, elevation: 3 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Schedules</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: '#6B7280' }}>
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
            <View className="px-6 mb-3">
                {/* Row 1: Days and Frequency */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    {/* Days filter (multi-select) */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Days</Text>
                        <TouchableOpacity
                            onPress={() => setFilterDaysOpen(v => !v)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Text style={{ color: filterDays.length ? '#111827' : '#9CA3AF' }}>{filterDays.length ? filterDays.join(', ') : 'All days'}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                        {filterDaysOpen && (
                            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 30, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled={true}>
                                    {WEEK_DAYS.map((d) => {
                                        const active = filterDays.includes(d);
                                        return (
                                            <TouchableOpacity key={d} onPress={() => setFilterDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                                <Text style={{ color: active ? '#6366f1' : '#111827', fontWeight: active ? '600' : '400' }}>{d}</Text>
                                                {active ? <Text style={{ color: '#6366f1', fontWeight: '700' }}>✓</Text> : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12 }}>
                                        <TouchableOpacity onPress={() => { setFilterDays([]); setFilterDaysOpen(false); }} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                                            <Text style={{ color: '#DC2626', fontWeight: '600' }}>Clear</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setFilterDaysOpen(false)} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                                            <Text style={{ color: '#6366f1', fontWeight: '700' }}>OK</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Frequency filter */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Frequency</Text>
                        <TouchableOpacity
                            onPress={() => setFilterFrequencyOpen(v => !v)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Text>{filterFrequency === 'all' ? 'All' : FREQUENCY_OPTIONS.find(f => f.value === filterFrequency)?.label}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                        {filterFrequencyOpen && (
                            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 30, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <ScrollView style={{ maxHeight: 200 }}>
                                    <TouchableOpacity onPress={() => { setFilterFrequency('all'); setFilterFrequencyOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                        <Text style={{ color: filterFrequency === 'all' ? '#6366f1' : '#111827', fontWeight: filterFrequency === 'all' ? '600' : '400' }}>All</Text>
                                    </TouchableOpacity>
                                    {FREQUENCY_OPTIONS.map(opt => (
                                        <TouchableOpacity key={opt.value} onPress={() => { setFilterFrequency(opt.value as any); setFilterFrequencyOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                            <Text style={{ color: filterFrequency === opt.value ? '#6366f1' : '#111827', fontWeight: filterFrequency === opt.value ? '600' : '400' }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
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
                <FlatList data={displayedItems} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
            )}

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        {/* disable parent scrolling while a dropdown list is open so child ScrollView can handle touch */}
                        <ScrollView scrollEnabled={!selectedDaysOpen && !frequencyOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Schedule' : 'Add Schedule'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Activity Name</Text>
                            <TextInput value={activityName} onChangeText={setActivityName} placeholder="e.g. Morning Exercise" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 12 }}>Time</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ marginTop: 6 }}>
                                    <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10 }} />
                                </View>
                            ) : (
                                <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />
                            )}

                            {/* Days (dropdown multi-select, placed under Time) */}
                            <Text style={{ color: '#374151', marginTop: 12 }}>Days</Text>
                            <View style={{ position: 'relative' }}>
                                <TouchableOpacity
                                    onPress={() => setSelectedDaysOpen(v => !v)}
                                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}
                                >
                                    <Text style={{ color: selectedDays.length ? '#111827' : '#9CA3AF' }}>
                                        {selectedDays.length ? selectedDays.join(', ') : 'All days'}
                                    </Text>
                                    <Text style={{ color: '#6B7280' }}>▾</Text>
                                </TouchableOpacity>

                                {selectedDaysOpen && (
                                    <View style={{ position: 'absolute', top: 56, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 1000, borderWidth: 1, borderColor: '#E5E7EB' }}>
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
                                )}
                            </View>

                            <Text style={{ color: '#374151', marginTop: 12 }}>Frequency</Text>
                            <TouchableOpacity onPress={() => setFrequencyOpen((v) => !v)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text>{FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label ?? frequency}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {frequencyOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
                                    {FREQUENCY_OPTIONS.map((opt) => (
                                        <TouchableOpacity key={opt.value} onPress={() => { setFrequency(opt.value as Schedule['frequency']); setFrequencyOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#111827' }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={{ color: '#374151', marginTop: 12 }}>Location</Text>
                            <TextInput value={location} onChangeText={setLocation} placeholder="Location (optional)" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 12 }}>Description</Text>
                            <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" multiline numberOfLines={4} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6, textAlignVertical: 'top', minHeight: 100 }} />

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
