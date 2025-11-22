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
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import ListCardWrapper from '../../src/components/ListCardWrapper';
import LoadMore from '../../src/components/LoadMore';
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

    // PAGINATION state
    const MEMBERS_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(MEMBERS_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

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

    // Reset displayed count when items or search changes
    useEffect(() => {
        setDisplayedCount(MEMBERS_PER_PAGE);
    }, [items, searchQuery]);

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
            const payload: any = {
                title,
                name,
                phone,
                leader,
            };
            // Only add image field if it has a value
            if (image) {
                payload.image = image;
            }

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

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= filteredItems.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + MEMBERS_PER_PAGE, filteredItems.length));
            setLoadingMore(false);
        }, 400);
    };

    const renderItem = ({ item }: { item: Org }) => {
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
                    borderLeftColor: item.leader ? '#EC4899' : '#818CF8',
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

                    {/* Leader/Member badge */}
                    <View style={{
                        backgroundColor: item.leader ? '#FCE7F3' : '#EDE9FE',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: item.leader ? '#EC4899' : '#818CF8',
                        alignSelf: 'flex-start',
                        marginBottom: 8
                    }}>
                        <Text style={{ color: item.leader ? '#9F1239' : '#4338CA', fontWeight: '700', fontSize: 10 }}>
                            {item.leader ? '★ LEADER' : '● MEMBER'}
                        </Text>
                    </View>

                    {/* Avatar + Info */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', overflow: 'hidden', marginRight: 12, borderWidth: 2, borderColor: item.leader ? '#EC4899' : '#818CF8' }}>
                            {item.image ? (
                                <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 32 }}>👤</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 4 }}>
                                {item.name}
                            </Text>
                            {!!item.title && (
                                <View style={{
                                    backgroundColor: '#F3F4F6',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                    marginBottom: 4
                                }}>
                                    <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600' }}>📋 {item.title}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Phone */}
                    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                        <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '600' }}>📞 {item.phone}</Text>
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
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                    {/* Left: Search using FloatingLabelInput */}
                    <View style={{ flex: 1 }}>
                        <FloatingLabelInput
                            label="Search"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search..."
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: Add Member */}
                    <View style={{ width: 140 }}>
                        <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center', elevation: 3 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ Member</Text>
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
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                    <ListCardWrapper style={{ marginHorizontal: 0 }}>
                        <FlatList
                            data={filteredItems.slice(0, displayedCount)}
                            keyExtractor={(i) => i.id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No members found</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {searchQuery ? 'No members match your search' : 'No organization members yet'}
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => (
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
                                        borderLeftColor: item.leader ? '#EC4899' : '#818CF8',
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

                                        {/* Leader/Member badge */}
                                        <View style={{
                                            backgroundColor: item.leader ? '#FCE7F3' : '#EDE9FE',
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 999,
                                            borderWidth: 2,
                                            borderColor: item.leader ? '#EC4899' : '#818CF8',
                                            alignSelf: 'flex-start',
                                            marginBottom: 8
                                        }}>
                                            <Text style={{ color: item.leader ? '#9F1239' : '#4338CA', fontWeight: '700', fontSize: 10 }}>
                                                {item.leader ? '★ LEADER' : '● MEMBER'}
                                            </Text>
                                        </View>

                                        {/* Avatar + Info */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', overflow: 'hidden', marginRight: 12, borderWidth: 2, borderColor: item.leader ? '#EC4899' : '#818CF8' }}>
                                                {item.image ? (
                                                    <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />
                                                ) : (
                                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontSize: 32 }}>👤</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 4 }}>
                                                    {item.name}
                                                </Text>
                                                {!!item.title && (
                                                    <View style={{
                                                        backgroundColor: '#F3F4F6',
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 3,
                                                        borderRadius: 6,
                                                        alignSelf: 'flex-start',
                                                        marginBottom: 4
                                                    }}>
                                                        <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600' }}>📋 {item.title}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Phone */}
                                        <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                                            <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '600' }}>📞 {item.phone}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => (
                                <LoadMore
                                    loading={loadingMore}
                                    hasMore={displayedCount < filteredItems.length}
                                />
                            )}
                        />
                    </ListCardWrapper>
                </View>
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? 'Edit Member' : 'Add Member'}</Text>

                            <FloatingLabelInput
                                label="Title / Position"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Enter position or title"
                            />

                            <FloatingLabelInput
                                label="Name"
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter full name"
                            />

                            <FloatingLabelInput
                                label="Phone"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="08xxxxxxxx"
                                keyboardType="phone-pad"
                            />

                            <View style={{ marginTop: 4, marginBottom: 8 }}>
                                <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>Profile Image</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TouchableOpacity onPress={pickImageNative} style={{ flex: 1, borderWidth: 2, borderColor: '#7c3aed', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' }}>
                                    <Text style={{ color: '#7c3aed', fontWeight: '600' }}>📷 Pick Image</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { revokePreviousImage(); setImage(undefined); }} style={{ flex: 1, borderWidth: 2, borderColor: '#EF4444', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' }}>
                                    <Text style={{ color: '#EF4444', fontWeight: '600' }}>✕ Clear</Text>
                                </TouchableOpacity>
                            </View>

                            {image ? <Image source={{ uri: image }} style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 12 }} resizeMode="cover" /> : null}

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                                <TouchableOpacity onPress={() => setLeader((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: leader ? '#EC4899' : '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: leader ? '#EC4899' : '#fff' }}>
                                        {leader ? <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
                                    </View>
                                    <Text style={{ marginLeft: 10, color: '#374151', fontWeight: '600', fontSize: 15 }}>Leader / Ketua</Text>
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
