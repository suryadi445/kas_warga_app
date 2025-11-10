import * as ImagePicker from 'expo-image-picker';
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

type Org = {
    id: string;
    title: string;
    name: string;
    phone: string;
    image?: string;
    leader: boolean;
};

const SAMPLE: Org[] = [
    { id: 'o1', title: 'Ketua RT', name: 'Budi', phone: '08123456789', image: undefined, leader: true },
    { id: 'o2', title: 'Bendahara', name: 'Siti', phone: '0822334455', image: undefined, leader: false },
];

export default function OrganizationScreen() {
    const [items, setItems] = useState<Org[]>(SAMPLE);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState<string | undefined>(undefined);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [leader, setLeader] = useState(false);

    function openAdd() {
        setEditingId(null);
        setTitle('');
        setName('');
        setPhone('');
        setImage(undefined);
        setImageUrlInput('');
        setLeader(false);
        setModalVisible(true);
    }

    function openEdit(o: Org) {
        setEditingId(o.id);
        setTitle(o.title);
        setName(o.name);
        setPhone(o.phone);
        setImage(o.image);
        setImageUrlInput(o.image ?? '');
        setLeader(o.leader);
        setModalVisible(true);
    }

    function save() {
        if (!name.trim() || !phone.trim()) {
            Alert.alert('Error', 'Name dan phone wajib diisi');
            return;
        }
        const payload: Org = {
            id: editingId ?? Date.now().toString(),
            title,
            name,
            phone,
            image: imageUrlInput || image,
            leader,
        };
        if (editingId) {
            setItems((p) => p.map((it) => (it.id === editingId ? payload : it)));
        } else {
            setItems((p) => [payload, ...p]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Konfirmasi', 'Hapus anggota ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    // image helpers
    function revokePreviousImage() {
        try {
            if (image && typeof image === 'string' && image.startsWith('blob:')) {
                URL.revokeObjectURL(image);
            }
        } catch { }
    }

    async function pickImageNative() {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission', 'Izin akses galeri diperlukan');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
            const uri = (res as any)?.assets?.[0]?.uri || (res as any)?.uri;
            if (uri) {
                revokePreviousImage();
                setImage(uri);
                setImageUrlInput(uri);
            }
        } catch {
            // ignore
        }
    }

    function handleWebFileChange(e: any) {
        const maybeFiles =
            e?.target?.files || e?.nativeEvent?.target?.files || e?.currentTarget?.files ||
            (e?.nativeEvent && e.nativeEvent?.dataTransfer && e.nativeEvent.dataTransfer.files);
        const file = maybeFiles && maybeFiles[0];
        if (!file) return;
        if (!file.type?.startsWith?.('image/')) {
            Alert.alert('File tidak valid', 'Pilih file gambar');
            return;
        }
        revokePreviousImage();
        try {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string | null;
                if (result) {
                    setImage(result);
                    setImageUrlInput('');
                }
            };
            reader.readAsDataURL(file);
        } catch {
            try {
                const url = URL.createObjectURL(file);
                setImage(url);
                setImageUrlInput('');
            } catch {
                Alert.alert('Error', 'Gagal memproses file gambar.');
            }
        }
    }

    // sort so leaders appear first
    const sortedItems = items.slice().sort((a, b) => {
        if (a.leader === b.leader) return 0;
        return a.leader ? -1 : 1; // leader true => come first
    });

    const renderItem = ({ item }: { item: Org }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', marginRight: 12 }}>
                        {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>👤</Text></View>}
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ fontWeight: '700', color: '#111827' }}>{item.name}</Text>
                                <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.title}</Text>
                            </View>
                            {item.leader && <View style={{ backgroundColor: '#FCE7F3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}><Text style={{ color: '#9F1239', fontWeight: '700' }}>Leader</Text></View>}
                        </View>
                        <Text style={{ color: '#374151', marginTop: 6 }}>{item.phone}</Text>
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
                    <Text style={{ color: '#fff', fontSize: 32 }}>👥</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Struktur Organisasi</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Kelola anggota dan jabatan dalam organisasi lingkungan Anda.
                </Text>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Tambah Anggota</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <FlatList data={sortedItems} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Anggota' : 'Tambah Anggota'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Title</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Jabatan / Title" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Name</Text>
                            <TextInput value={name} onChangeText={setName} placeholder="Nama lengkap" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Phone</Text>
                            <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxxxxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Image (URL or file)</Text>
                            <TextInput value={imageUrlInput} onChangeText={(v) => { setImageUrlInput(v); setImage(v); }} placeholder="https://..." style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 8 }}>
                                    <input type="file" accept="image/*" onChange={(e) => handleWebFileChange(e)} />
                                </div>
                            ) : null}

                            <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                <TouchableOpacity onPress={pickImageNative} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 }}>
                                    <Text style={{ color: '#374151' }}>Pick from gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { revokePreviousImage(); setImage(undefined); setImageUrlInput(''); }} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 }}>
                                    <Text style={{ color: '#EF4444' }}>Clear</Text>
                                </TouchableOpacity>
                            </View>

                            {image ? <Image source={{ uri: image }} style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 12 }} resizeMode="cover" /> : null}

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                                <TouchableOpacity onPress={() => setLeader((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: leader ? '#6366f1' : '#fff' }}>
                                        {leader ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}
                                    </View>
                                    <Text style={{ marginLeft: 8, color: '#374151' }}>Leader</Text>
                                </TouchableOpacity>
                            </View>

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
