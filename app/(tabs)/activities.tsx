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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

type Activity = {
    id: string;
    title: string;
    location: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    description: string;
};

const SAMPLE_ACTIVITIES: Activity[] = [
    { id: 'act1', title: 'Senam Pagi', location: 'Lapangan RW', date: '2024-06-10', time: '07:00', description: 'Senam bersama warga setiap minggu.' },
];

export default function ActivitiesScreen() {
    const { showToast } = useToast();
    // data comes from Firestore
    const [items, setItems] = useState<Activity[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState(() => {
        const t = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    });
    const [time, setTime] = useState('09:00');
    const [description, setDescription] = useState('');

    // location stored as simple text (no map): use 'location' state above

    // mobile date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const dateToYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const dateToHM = (d: Date) => {
        const hh = `${d.getHours()}`.padStart(2, '0');
        const mm = `${d.getMinutes()}`.padStart(2, '0');
        return `${hh}:${mm}`;
    };
    function formatDateOnly(dateStr: string) {
        if (!dateStr) return '';
        const iso = `${dateStr}T00:00:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    useEffect(() => {
        setLoadingActivities(true);
        const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
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
            });
            setItems(rows);
            setLoadingActivities(false);
        }, (err) => {
            console.error('activities snapshot error', err);
            setLoadingActivities(false);
        });
        return () => unsub();
    }, []);

    function openAdd() {
        setEditingId(null);
        setTitle('');
        setLocation('');
        // Set date/time empty for new activity
        setDate('');
        setTime('');
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(a: Activity) {
        setEditingId(a.id);
        setTitle(a.title);
        setLocation(a.location);
        setDate(a.date);
        // keep existing time or empty if not present (don't force default on edit)
        setTime(a.time || '');
        setDescription(a.description);
        setModalVisible(true);
    }

    async function save() {
        if (!title.trim()) {
            showToast('Title is required', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'activities', editingId);
                await updateDoc(ref, { title, location, date, time, description, updatedAt: serverTimestamp() });
                showToast('Activity updated successfully', 'success');
            } else {
                await addDoc(collection(db, 'activities'), { title, location, date, time, description, createdAt: serverTimestamp() });
                showToast('Activity added successfully', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('activity save error', e);
            showToast('Failed to save activity', 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function remove() {
        if (!itemToDelete) return;

        setDeleteConfirmVisible(false);
        setOperationLoading(true);

        try {
            await deleteDoc(doc(db, 'activities', itemToDelete));
            showToast('Activity deleted successfully', 'success');
        } catch (e) {
            console.error('delete activity error', e);
            showToast('Failed to delete activity', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    // helper: determine activity status based on date (YYYY-MM-DD)
    function getActivityStatus(a: Activity): 'upcoming' | 'active' | 'expired' | null {
        if (!a.date) return null;
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);
        const start = a.date ? new Date(a.date) : new Date('1970-01-01');
        // treat a single-day activity: active if today == date
        // if you want multi-day activities, adapt with endDate field
        if (today < start) return 'upcoming';
        if (today > start) return 'expired';
        return 'active';
    }

    // ADDED: filtering by status and date-range
    const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'expired'>('all');
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);
    const STATUS_OPTIONS = ['all', 'upcoming', 'active', 'expired'] as const;
    const STATUS_LABEL: Record<string, string> = { all: 'All', upcoming: 'Upcoming', active: 'Active', expired: 'Expired' };

    // single activity date filter (YYYY-MM-DD). Empty = show all dates
    const [filterDate, setFilterDate] = useState<string>('');
    const [filterDatePickerVisible, setFilterDatePickerVisible] = useState(false);

    // compute displayed items: apply status + activity date (single date) filter, then sort by status priority
    const displayedItems = items
        .filter(i => {
            // status filter
            if (filterStatus !== 'all') {
                const s = getActivityStatus(i);
                if (s !== filterStatus) return false;
            }
            // activity date filter (single date)
            if (filterDate) {
                if (!i.date) return false;
                if (i.date !== filterDate) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const rank: Record<string, number> = { active: 0, upcoming: 1, expired: 2, null: 3 };
            const sa = getActivityStatus(a) ?? 'null';
            const sb = getActivityStatus(b) ?? 'null';
            const ra = rank[sa] ?? 3;
            const rb = rank[sb] ?? 3;
            if (ra !== rb) return ra - rb;
            // same status, most recent date first
            return b.date.localeCompare(a.date);
        });

    // counts for summary card
    const totalActivities = items.length;
    const counts = items.reduce((acc: Record<string, number>, it) => {
        const s = getActivityStatus(it) ?? 'none';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const activeCount = counts['active'] || 0;
    const upcomingCount = counts['upcoming'] || 0;
    const expiredCount = counts['expired'] || 0;

    const renderItem = ({ item }: { item: Activity }) => {
        const status = getActivityStatus(item);
        const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
            upcoming: { bg: '#FEF3C7', text: '#92400E', label: 'Upcoming' },
            active: { bg: '#ECFDF5', text: '#065F46', label: 'On Going' },
            expired: { bg: '#FEF2F2', text: '#7F1D1D', label: 'Expired' },
        };

        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ position: 'relative', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2, flexDirection: 'row', alignItems: 'center', paddingRight: 120 }}>
                    {/* Absolute container at top-right: badge on top, actions below */}
                    <View style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, alignItems: 'flex-end' }}>
                        {status ? (
                            <View style={{ backgroundColor: statusStyles[status].bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 8 }}>
                                <Text style={{ color: statusStyles[status].text, fontWeight: '700', fontSize: 10 }}>
                                    {statusStyles[status].label}
                                </Text>
                            </View>
                        ) : null}

                        <View style={{ alignItems: 'flex-end' }}>
                            <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 6 }} disabled={operationLoading}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmRemove(item.id)} disabled={operationLoading}>
                                <Text style={{ color: '#EF4444', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: '#111827' }}>{item.title}</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>{item.location}</Text>

                        {/* date + time row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>{formatDateOnly(item.date)}</Text>

                            {/* time pill */}
                            <View style={{ marginLeft: 8, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 12 }}>{item.time}</Text>
                            </View>
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

            {/* Header - replace HeaderCard with manual header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>🗓️</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Activities</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage community activities and events
                </Text>
            </View>

            {/* Summary card */}
            <View className="px-6 mb-3">
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 14,
                        padding: 14,
                        elevation: 3,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Activities</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: activeCount > 0 ? '#065F46' : '#6B7280' }}>
                                {activeCount} Active
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Upcoming: {upcomingCount} · Expired: {expiredCount}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{totalActivities} Total</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* FILTERS: Status + Date (two columns) */}
            <View className="px-6 mb-3">
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    {/* Status column (left) */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Status</Text>
                        <TouchableOpacity
                            onPress={() => setFilterStatusOpen(!filterStatusOpen)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Text>{STATUS_LABEL[filterStatus]}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                        {filterStatusOpen && (
                            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 30, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <ScrollView style={{ maxHeight: 200 }}>
                                    {STATUS_OPTIONS.map(s => (
                                        <TouchableOpacity key={s} onPress={() => { setFilterStatus(s); setFilterStatusOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                            <Text style={{ color: filterStatus === s ? '#6366f1' : '#111827', fontWeight: filterStatus === s ? '600' : '400' }}>
                                                {STATUS_LABEL[s]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Date column (right) */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Activity Date</Text>
                        <TouchableOpacity
                            onPress={() => setFilterDatePickerVisible(true)}
                            style={{
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                borderRadius: 8,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: '#fff',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: filterDate ? '#111827' : '#9CA3AF' }}>{filterDate || 'All dates'}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Filter Date Picker (single date) */}
            <DateTimePickerModal
                isVisible={filterDatePickerVisible}
                mode="date"
                onConfirm={(d: Date) => {
                    setFilterDate(dateToYMD(d));
                    setFilterDatePickerVisible(false);
                }}
                onCancel={() => setFilterDatePickerVisible(false)}
            />

            {/* Row: Create button (aligned right) */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View style={{ width: 160 }}>
                    <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
                        <LinearGradient
                            colors={['#10B981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                paddingVertical: 12,
                                borderRadius: 999,
                                alignItems: 'center',
                                elevation: 3,
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ Activity</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {loadingActivities ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <FlatList data={displayedItems} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Activity' : 'Add Activity'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Activity Name</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Activity title" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Location</Text>
                            <TextInput
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Location label or address (optional)"
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }}
                            />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Date</Text>
                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 6 }}>
                                    <input type="date" value={date} onChange={(e: any) => setDate(e.target.value)} style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10 }} />
                                </div>
                            ) : (
                                <>
                                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}>
                                        <Text style={{ color: date ? '#111827' : '#9CA3AF' }}>{date ? formatDateOnly(date) : 'Select date'}</Text>
                                    </TouchableOpacity>
                                    <DateTimePickerModal
                                        isVisible={showDatePicker}
                                        mode="date"
                                        onConfirm={(d: Date) => {
                                            setShowDatePicker(false);
                                            setDate(dateToYMD(d));
                                        }}
                                        onCancel={() => setShowDatePicker(false)}
                                    />
                                </>
                            )}

                            <Text style={{ color: '#374151', marginTop: 8 }}>Time</Text>
                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 6 }}>
                                    <input type="time" value={time} onChange={(e: any) => setTime(e.target.value)} style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10 }} />
                                </div>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        onPress={() => setShowTimePicker(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}
                                    >
                                        <Text style={{ color: time ? '#111827' : '#9CA3AF' }}>{time || 'HH:MM'}</Text>
                                    </TouchableOpacity>

                                    <DateTimePickerModal
                                        isVisible={showTimePicker}
                                        mode="time"
                                        onConfirm={(d: Date) => {
                                            setShowTimePicker(false);
                                            setTime(dateToHM(d));
                                        }}
                                        onCancel={() => setShowTimePicker(false)}
                                    />
                                </>
                            )}

                            <Text style={{ color: '#374151', marginTop: 8 }}>Description</Text>
                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 6 }}>
                                    <textarea
                                        value={description}
                                        onChange={(e: any) => setDescription(e.target.value)}
                                        placeholder="Description (optional)"
                                        rows={6}
                                        style={{
                                            width: '100%',
                                            borderRadius: 8,
                                            border: '1px solid #E5E7EB',
                                            padding: 10,
                                            resize: 'vertical',
                                        }}
                                    />
                                </div>
                            ) : (
                                <TextInput
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Description (optional)"
                                    multiline
                                    numberOfLines={6}
                                    style={{
                                        borderWidth: 1,
                                        borderColor: '#E5E7EB',
                                        borderRadius: 8,
                                        padding: 10,
                                        marginTop: 6,
                                        textAlignVertical: 'top',
                                        height: 140,
                                    }}
                                />
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={save} disabled={operationLoading} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Add'}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete Activity"
                message="Are you sure you want to delete this activity? This action cannot be undone."
                onConfirm={remove}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setItemToDelete(null);
                }}
            />
        </SafeAreaView>
    );
}
