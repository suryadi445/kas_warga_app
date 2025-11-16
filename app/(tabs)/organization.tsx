import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

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
    const { showToast } = useToast();
    const [items, setItems] = useState<Org[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);

    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState<string | undefined>(undefined);
    const [leader, setLeader] = useState(false);

    // delete confirm state
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    // NEW: search by name or phone
    const [searchQuery, setSearchQuery] = useState<string>('');

    // realtime listener for organization collection
    useEffect(() => {
        setLoadingOrg(true);
        const q = query(collection(db, 'organization'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const rows: Org[] = snap.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    title: data.title || '',
                    name: data.name || '',
                    phone: data.phone || '',
                    image: data.image || undefined,
                    leader: !!data.leader,
                };
            });
            setItems(rows);
            setLoadingOrg(false);
        }, (err) => {
            console.warn('organization snapshot error', err);
            setLoadingOrg(false);
        });
        return () => unsub();
    }, []);

    function openAdd() {
        setEditingId(null);
        setTitle('');
        setName('');
        setPhone('');
        setImage(undefined);
        setLeader(false);
        setModalVisible(true);
    }

    function openEdit(o: Org) {
        setEditingId(o.id);
        setTitle(o.title);
        setName(o.name);
        setPhone(o.phone);
        setImage(o.image);
        setLeader(o.leader);
        setModalVisible(true);
    }

    async function save() {
        if (!name.trim() || !phone.trim()) {
            showToast('Name and phone are required', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            const payload = {
                title,
                name,
                phone,
                image: image,
                leader,
            };
            if (editingId) {
                const ref = doc(db, 'organization', editingId);
                await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
                showToast('Member updated', 'success');
            } else {
                await addDoc(collection(db, 'organization'), { ...payload, createdAt: serverTimestamp() });
                showToast('Member added', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('organization save error', e);
            showToast('Failed to save member', 'error');
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
            await deleteDoc(doc(db, 'organization', itemToDelete));
            showToast('Member deleted', 'success');
        } catch (e) {
            console.error('delete org member error', e);
            showToast('Failed to delete member', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
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
                showToast('Gallery access permission required', 'error');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
            const uri = (res as any)?.assets?.[0]?.uri || (res as any)?.uri;
            if (uri) {
                revokePreviousImage();
                setImage(uri);
            }
        } catch {
            // ignore
        }
    }

    // sort so leaders appear first
    const sortedItems = items.slice().sort((a, b) => {
        if (a.leader === b.leader) return 0;
        return a.leader ? -1 : 1; // leader true => come first
    });

    // NEW: filter sortedItems by searchQuery (name or phone)
    const filteredItems = sortedItems.filter((u) => {
        const q = (searchQuery || '').trim().toLowerCase();
        if (!q) return true;
        return (u.name || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
    });

    const renderItem = ({ item }: { item: Org }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                {/* make container relative so we can position badge+actions absolutely */}
                <View style={{ position: 'relative', flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', marginRight: 12 }}>
                        {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>👤</Text></View>}
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ fontWeight: '700', color: '#111827' }}>{item.name}</Text>
                                <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.title}</Text>
                            </View>
                            {/* removed inline leader badge (moved to absolute container) */}
                        </View>
                        <Text style={{ color: '#374151', marginTop: 6 }}>{item.phone}</Text>
                    </View>

                    {/* absolute container at top-right: badge (Leader/Member) above actions */}
                    <View style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, alignItems: 'flex-end' }}>
                        {/* show Leader badge or Member badge */}
                        <View style={{
                            backgroundColor: item.leader ? '#FCE7F3' : '#E0E7FF',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            marginBottom: 8
                        }}>
                            <Text style={{ color: item.leader ? '#9F1239' : '#3730A3', fontWeight: '700' }}>
                                {item.leader ? 'Leader' : 'Member'}
                            </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                            <TouchableOpacity disabled={operationLoading} onPress={() => openEdit(item)} style={{ marginBottom: 6 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={operationLoading} onPress={() => confirmRemove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
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
                    <Text style={{ color: '#fff', fontSize: 32 }}>👥</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Organization Structure</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage members and positions in your community organization.
                </Text>
            </View>

            {/* Summary card (total members + leaders) */}
            <View className="px-6 mb-3">
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 14, padding: 14, elevation: 3 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Organization</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: '#6B7280' }}>
                                {items.length} Members
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Leaders: {items.filter(i => i.leader).length}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            {/* show total non-leader members */}
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{items.filter(i => !i.leader).length} Non-leaders</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Search + Add Member (single row, 2 columns) */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {/* Left: Search (50%) */}
                    <View style={{ flex: 1 }}>
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search..."
                            style={{ height: 48, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fff' }}
                            returnKeyType="search"
                        />
                    </View>

                    {/* Right: Add Member (50%) */}
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
                        <TouchableOpacity disabled={operationLoading} onPress={openAdd} style={{ width: '100%' }}>
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 3 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Member</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {loadingOrg ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <FlatList data={filteredItems} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Member' : 'Add Member'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Title</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Position / Title" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Name</Text>
                            <TextInput value={name} onChangeText={setName} placeholder="Full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Phone</Text>
                            <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxxxxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Image (pick from gallery)</Text>
                            <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                <TouchableOpacity onPress={pickImageNative} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 }}>
                                    <Text style={{ color: '#374151' }}>Pick from gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { revokePreviousImage(); setImage(undefined); }} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 }}>
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
                title="Delete Member"
                message="Are you sure you want to delete this member? This action cannot be undone."
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
            />
        </SafeAreaView>
    );
}
