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
        const t = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        setDate(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
        setTime('09:00');
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(a: Activity) {
        setEditingId(a.id);
        setTitle(a.title);
        setLocation(a.location);
        setDate(a.date);
        setTime((a as any).time || '09:00');
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

    const renderItem = ({ item }: { item: Activity }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2, flexDirection: 'row', alignItems: 'center' }}>
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

                    <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 8 }} disabled={operationLoading}>
                            <Text style={{ color: '#06B6D4', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmRemove(item.id)} disabled={operationLoading}>
                            <Text style={{ color: '#EF4444', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
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

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Activity</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {loadingActivities ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
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
                                        <Text style={{ color: '#111827' }}>{formatDateOnly(date)}</Text>
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
                                        <Text style={{ color: '#111827' }}>{time}</Text>
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
