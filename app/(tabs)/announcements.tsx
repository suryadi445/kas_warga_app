import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
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
// try import image picker (optional)
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

type Announcement = {
    id: string;
    category: string;
    title: string;
    content: string;
    image?: string; // uri or url
    startDate: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endDate: string; // YYYY-MM-DD
    endTime: string; // HH:MM
};

const SAMPLE: Announcement[] = [
    {
        id: 'a1',
        category: 'Informasi',
        title: 'Rapat RT',
        content: 'Rapat rutin RT di balai warga.',
        image: undefined,
        startDate: '2024-05-10',
        startTime: '19:00',
        endDate: '2024-05-10',
        endTime: '21:00',
    },
];

export default function AnnouncementsScreen() {
    const [items, setItems] = useState<Announcement[]>(SAMPLE);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // form state
    const [category, setCategory] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | undefined>(undefined);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const [startDate, setStartDate] = useState(defaultDate);
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState(defaultDate);
    const [endTime, setEndTime] = useState('10:00');

    // mobile picker visibility state
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    // helper to format Date -> "YYYY-MM-DD"
    const dateToYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    // helper to format Date -> "HH:MM"
    const dateToHM = (d: Date) => {
        const hh = `${d.getHours()}`.padStart(2, '0');
        const mm = `${d.getMinutes()}`.padStart(2, '0');
        return `${hh}:${mm}`;
    };

    function openAdd() {
        setEditingId(null);
        setCategory('');
        setTitle('');
        setContent('');
        setImage(undefined);
        setImageUrlInput('');
        setStartDate(defaultDate);
        setStartTime('09:00');
        setEndDate(defaultDate);
        setEndTime('10:00');
        setModalVisible(true);
    }

    function openEdit(a: Announcement) {
        setEditingId(a.id);
        setCategory(a.category);
        setTitle(a.title);
        setContent(a.content);
        setImage(a.image);
        setImageUrlInput(a.image ?? '');
        setStartDate(a.startDate);
        setStartTime(a.startTime);
        setEndDate(a.endDate);
        setEndTime(a.endTime);
        setModalVisible(true);
    }

    async function pickImage() {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission', 'Izin akses galeri diperlukan');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
            // support new and old return shapes
            const uri =
                // new API: assets array
                (res as any)?.assets?.[0]?.uri ||
                // old API
                (res as any)?.uri;
            if (uri) {
                revokePreviousImage();
                setImage(uri);
                setImageUrlInput(uri);
            }
        } catch (e) {
            // fallback: do nothing
        }
    }

    // improved: use FileReader on web to create data URL (more reliable for preview)
    function handleWebFileChange(e: any) {
        const maybeFiles =
            e?.target?.files ||
            e?.nativeEvent?.target?.files ||
            e?.currentTarget?.files ||
            (e?.nativeEvent && e.nativeEvent?.dataTransfer && e.nativeEvent.dataTransfer.files);

        const file = maybeFiles && maybeFiles[0];
        if (!file) return;

        // allow only images
        if (!file.type?.startsWith?.('image/')) {
            Alert.alert('File tidak valid', 'Pilih file gambar (png, jpg, jpeg).');
            return;
        }

        // revoke previous blob url if any
        revokePreviousImage();

        // use FileReader to produce data URL for reliable preview in web
        try {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string | null;
                if (result) {
                    setImage(result);
                    setImageUrlInput(''); // clear manual URL when using file picker
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            // fallback to object URL if FileReader not available
            try {
                const url = URL.createObjectURL(file);
                setImage(url);
                setImageUrlInput('');
            } catch (e) {
                Alert.alert('Error', 'Gagal memproses file gambar.');
            }
        }
    }

    function save() {
        if (!title.trim()) {
            Alert.alert('Error', 'Title wajib diisi');
            return;
        }
        const payload: Announcement = {
            id: editingId ?? Date.now().toString(),
            category,
            title,
            content,
            image: imageUrlInput || image,
            startDate,
            startTime,
            endDate,
            endTime,
        };
        if (editingId) {
            setItems((p) => p.map((it) => (it.id === editingId ? payload : it)));
        } else {
            setItems((p) => [payload, ...p]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Konfirmasi', 'Hapus announcement ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    // helper: parse YYYY-MM-DD and HH:MM into Date
    function parseDateTime(dateStr: string, timeStr: string) {
        // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
        const [y, m, d] = dateStr.split('-').map(Number);
        const [hh, mm] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, hh || 0, mm || 0);
    }

    // helper: determine status relative to now
    function getStatus(a: Announcement) {
        const now = new Date();
        const start = parseDateTime(a.startDate, a.startTime);
        const end = parseDateTime(a.endDate, a.endTime);
        if (now < start) return 'Upcoming';
        if (now >= start && now <= end) return 'Ongoing';
        return 'Expired';
    }

    // helper: format display of datetime
    function formatDateTime(dateStr: string, timeStr: string) {
        return `${dateStr} ${timeStr}`;
    }

    // new helper: format YYYY-MM-DD + HH:MM -> "9 Nov 2025 • 09:00"
    function formatDateDisplay(dateStr: string, timeStr: string) {
        if (!dateStr) return timeStr || '';
        // try construct ISO-ish datetime, fallback to raw if invalid
        const iso = `${dateStr}T${(timeStr || '00:00')}:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
            // fallback: join raw
            return `${dateStr}${timeStr ? ' • ' + timeStr : ''}`;
        }
        const datePart = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return `${datePart} • ${timePart}`;
    }

    // new helper: format YYYY-MM-DD -> "9 Nov 2025"
    function formatDateOnly(dateStr: string) {
        if (!dateStr) return '';
        const iso = `${dateStr}T00:00:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const renderItem = ({ item }: { item: Announcement }) => {
        const status = ((): 'Upcoming' | 'Ongoing' | 'Expired' => {
            const now = new Date();
            const start = new Date(`${item.startDate}T${item.startTime || '00:00'}:00`);
            const end = new Date(`${item.endDate}T${item.endTime || '23:59'}:00`);
            if (now < start) return 'Upcoming';
            if (now >= start && now <= end) return 'Ongoing';
            return 'Expired';
        })();

        const badgeColor = status === 'Upcoming' ? '#6366f1' : status === 'Ongoing' ? '#10B981' : '#9CA3AF';

        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ position: 'relative' }}>
                    <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
                        <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', marginRight: 12 }}>
                            {item.image ? (
                                <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 20 }}>📢</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Text style={{ fontWeight: '700', color: '#111827', flex: 1 }}>{item.title}</Text>
                                {/* badge */}
                                <View style={{ marginLeft: 8 }}>
                                    <View style={{ backgroundColor: badgeColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{status}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* improved date display: show date only, and show times separately */}
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                {item.category ? item.category : ''}
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Start date: {formatDateOnly(item.startDate)}
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                                Start time: {item.startTime}
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                                End date: {formatDateOnly(item.endDate)}
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                                End time: {item.endTime}
                            </Text>

                            <Text numberOfLines={2} style={{ color: '#374151', marginTop: 8 }}>{item.content || '—'}</Text>
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
            </View>
        );
    };

    // helper to revoke previous blob/object url
    function revokePreviousImage() {
        try {
            if (image && typeof image === 'string' && image.startsWith('blob:')) {
                URL.revokeObjectURL(image);
            }
        } catch (err) {
            // ignore
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📢</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Pengumuman Warga</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Kelola pengumuman dan informasi penting untuk warga.
                </Text>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Tambah Announcement</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Announcement' : 'Tambah Announcement'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Category</Text>
                            <TextInput value={category} onChangeText={setCategory} placeholder="Kategori" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Title</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Judul" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Content</Text>
                            <TextInput
                                value={content}
                                onChangeText={setContent}
                                placeholder="Isi pengumuman"
                                multiline
                                numberOfLines={6}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 8,
                                    padding: 10,
                                    marginTop: 6,
                                    textAlignVertical: 'top',
                                    height: 120,
                                }}
                            />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Image (URL or file)</Text>
                            {/* URL input */}
                            <TextInput
                                value={imageUrlInput}
                                onChangeText={(v) => {
                                    setImageUrlInput(v);
                                    setImage(v);
                                }}
                                placeholder="https://..."
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }}
                            />

                            {/* Web file input (only renders on web) */}
                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 8 }}>
                                    {/* styling native file input minimal — preview will update after selection */}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg"
                                        onChange={(e) => handleWebFileChange(e)}
                                        style={{ padding: 8 }}
                                    />
                                </div>
                            ) : null}

                            {/* Preview */}
                            {image ? (
                                <Image source={{ uri: image }} style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 12 }} resizeMode="cover" />
                            ) : null}

                            {/* Start / End date & time: HTML inputs on web, TextInput on native */}
                            {Platform.OS === 'web' ? (
                                <>
                                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ color: '#374151' }}>Start Date</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e: any) => setStartDate(e.target.value)}
                                                style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10, marginTop: 6 }}
                                            />
                                        </div>
                                        <div style={{ width: 140 }}>
                                            <label style={{ color: '#374151' }}>Start Time</label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e: any) => setStartTime(e.target.value)}
                                                style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10, marginTop: 6 }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ color: '#374151' }}>End Date</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e: any) => setEndDate(e.target.value)}
                                                style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10, marginTop: 6 }}
                                            />
                                        </div>
                                        <div style={{ width: 140 }}>
                                            <label style={{ color: '#374151' }}>End Time</label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e: any) => setEndTime(e.target.value)}
                                                style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10, marginTop: 6 }}
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Mobile: show tappable fields that open native datetime pickers */}
                                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#374151' }}>Start Date</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowStartDatePicker(true)}
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}
                                            >
                                                <Text style={{ color: '#111827' }}>{formatDateOnly(startDate)}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ width: 120 }}>
                                            <Text style={{ color: '#374151' }}>Start Time</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowStartTimePicker(true)}
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}
                                            >
                                                <Text style={{ color: '#111827' }}>{startTime}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#374151' }}>End Date</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowEndDatePicker(true)}
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}
                                            >
                                                <Text style={{ color: '#111827' }}>{formatDateOnly(endDate)}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ width: 120 }}>
                                            <Text style={{ color: '#374151' }}>End Time</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowEndTimePicker(true)}
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6 }}
                                            >
                                                <Text style={{ color: '#111827' }}>{endTime}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </>
                            )}
                            {/* DateTime pickers for mobile */}
                            <DateTimePickerModal
                                isVisible={showStartDatePicker}
                                mode="date"
                                onConfirm={(d: Date) => {
                                    setShowStartDatePicker(false);
                                    setStartDate(dateToYMD(d));
                                }}
                                onCancel={() => setShowStartDatePicker(false)}
                            />
                            <DateTimePickerModal
                                isVisible={showStartTimePicker}
                                mode="time"
                                onConfirm={(d: Date) => {
                                    setShowStartTimePicker(false);
                                    setStartTime(dateToHM(d));
                                }}
                                onCancel={() => setShowStartTimePicker(false)}
                            />
                            <DateTimePickerModal
                                isVisible={showEndDatePicker}
                                mode="date"
                                onConfirm={(d: Date) => {
                                    setShowEndDatePicker(false);
                                    setEndDate(dateToYMD(d));
                                }}
                                onCancel={() => setShowEndDatePicker(false)}
                            />
                            <DateTimePickerModal
                                isVisible={showEndTimePicker}
                                mode="time"
                                onConfirm={(d: Date) => {
                                    setShowEndTimePicker(false);
                                    setEndTime(dateToHM(d));
                                }}
                                onCancel={() => setShowEndTimePicker(false)}
                            />

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
