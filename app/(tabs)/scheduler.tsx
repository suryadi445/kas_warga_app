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

    function openAdd() {
        setEditingId(null);
        setActivityName('');
        setTime('09:00');
        setFrequency('monthly');
        setLocation('');
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(s: Schedule) {
        setEditingId(s.id);
        setActivityName(s.activityName);
        setTime(s.time);
        setFrequency(s.frequency);
        setLocation(s.location);
        setDescription(s.description);
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
                await updateDoc(ref, { activityName, time, frequency, location, description, updatedAt: serverTimestamp() });
                showToast('Schedule updated', 'success');
            } else {
                await addDoc(collection(db, 'schedules'), { activityName, time, frequency, location, description, createdAt: serverTimestamp() });
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
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: '#111827' }}>{item.activityName}</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>{item.location}</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 }}>
                                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 12 }}>{item.time}</Text>
                            </View>
                            <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                                <Text style={{ color: '#1E40AF', fontWeight: '600', fontSize: 12 }}>{freqLabel}</Text>
                            </View>
                        </View>

                        <Text numberOfLines={2} style={{ color: '#374151', marginTop: 8 }}>{item.description || '—'}</Text>
                    </View>

                    <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 8 }}>
                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmRemove(item.id)}>
                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📅</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Activity Schedule</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage routine and incidental community activities schedule.
                </Text>
                <TouchableOpacity disabled={operationLoading} onPress={openAdd} style={{ marginTop: 10 }}>
                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 16 }}>+ Add Schedule</Text>
                </TouchableOpacity>
            </View>

            {loadingSchedules ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
            )}

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
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
