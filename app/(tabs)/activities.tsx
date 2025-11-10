import { LinearGradient } from 'expo-linear-gradient';
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const [items, setItems] = useState<Activity[]>(SAMPLE_ACTIVITIES);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

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

    function openAdd() {
        setEditingId(null);
        setTitle('');
        setLocation('');
        const t = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        setDate(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
        setTime('09:00');
        setDescription('');
        // removed map-related resets
        setModalVisible(true);
    }

    function openEdit(a: Activity) {
        setEditingId(a.id);
        setTitle(a.title);
        setLocation(a.location);
        setDate(a.date);
        setTime((a as any).time || '09:00');
        setDescription(a.description);
        // if stored as coords in time/location fields? assume saved in location/time + description; here we try to parse
        // removed map-related restores
        setModalVisible(true);
    }

    function save() {
        if (!title.trim()) {
            Alert.alert('Error', 'Title wajib diisi');
            return;
        }
        const payload: Activity = {
            id: editingId ?? Date.now().toString(),
            title,
            location,
            date,
            time,
            description,
        };
        if (editingId) {
            setItems((p) => p.map((it) => (it.id === editingId ? payload : it)));
        } else {
            setItems((p) => [payload, ...p]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Konfirmasi', 'Hapus activity ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
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
                        <TouchableOpacity onPress={() => openEdit(item)} style={{ marginBottom: 8 }}>
                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => remove(item.id)}>
                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Hapus</Text>
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
                    <Text style={{ color: '#fff', fontSize: 32 }}>🎯</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Kegiatan Warga</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Kelola dan dokumentasikan kegiatan warga.
                </Text>
                <TouchableOpacity onPress={openAdd} style={{ marginTop: 10 }}>
                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 16 }}>+ Tambah Activity</Text>
                </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Tambah Activity</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Activity' : 'Tambah Activity'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Title</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Judul kegiatan" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Location</Text>
                            <TextInput
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Label lokasi atau alamat (optional)"
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
                                    {/* Mobile: show time as tappable field that directly opens time picker */}
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
                                        placeholder="Deskripsi (opsional)"
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
                                    placeholder="Deskripsi (opsional)"
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
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}>
                                    <Text style={{ color: '#6B7280' }}>Batal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={save} style={{ padding: 10 }}>
                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Simpan' : 'Tambah'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
