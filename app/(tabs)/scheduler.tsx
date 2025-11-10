import React, { useState } from 'react';
import {
    Alert,
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

const SAMPLE_SCHEDULES: Schedule[] = [
    { id: 's1', activityName: 'Senam Pagi', time: '06:30', frequency: 'weekly', location: 'Lapangan RW', description: 'Senam setiap Minggu pagi' },
];

export default function SchedulerScreen() {
    const [items, setItems] = useState<Schedule[]>(SAMPLE_SCHEDULES);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [activityName, setActivityName] = useState('');
    const [time, setTime] = useState('09:00');
    const [frequency, setFrequency] = useState<Schedule['frequency']>('monthly');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [frequencyOpen, setFrequencyOpen] = useState(false);

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

    function save() {
        if (!activityName.trim()) {
            Alert.alert('Error', 'Activity name is required');
            return;
        }
        const payload: Schedule = {
            id: editingId ?? Date.now().toString(),
            activityName,
            time,
            frequency,
            location,
            description,
        };
        if (editingId) {
            setItems((p) => p.map((i) => (i.id === editingId ? payload : i)));
        } else {
            setItems((p) => [payload, ...p]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Confirm', 'Delete this schedule?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
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
                        <TouchableOpacity onPress={() => remove(item.id)}>
                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📅</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Jadwal Kegiatan</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Kelola jadwal kegiatan rutin dan insidental warga.
                </Text>
                <TouchableOpacity onPress={openAdd} style={{ marginTop: 10 }}>
                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 16 }}>+ Tambah Schedule</Text>
                </TouchableOpacity>
            </View>

            <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

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
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={save} style={{ padding: 10 }}>
                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
