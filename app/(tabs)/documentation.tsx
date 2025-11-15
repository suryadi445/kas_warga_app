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

type Documentation = {
    id: string;
    activityId: string;
    activityName: string;
    images: string[]; // array of image URIs
    description: string;
    date: string;
};

export default function DocumentationScreen() {
    const { showToast } = useToast();
    const [items, setItems] = useState<Documentation[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);

    const [activityId, setActivityId] = useState('');
    const [activityName, setActivityName] = useState('');
    const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [activityOpen, setActivityOpen] = useState(false);

    // delete confirm state
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // realtime listener for activities collection (so picker uses actual activities module)
    useEffect(() => {
        const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const rows = snap.docs.map(d => {
                const data = d.data() as any;
                // try common name fields used in different schemas
                const name = data.title ?? data.name ?? data.activityName ?? '';
                return { id: d.id, name };
            });
            setActivities(rows);
        }, (err) => {
            console.warn('activities snapshot error', err);
        });
        return () => unsub();
    }, []);

    // realtime listener for documentation collection
    useEffect(() => {
        setLoadingDocs(true);
        const q = query(collection(db, 'documentation'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const rows: Documentation[] = snap.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    activityId: data.activityId || '',
                    activityName: data.activityName || '',
                    images: Array.isArray(data.images) ? data.images : [],
                    description: data.description || '',
                    date: data.date || (data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0] : ''),
                };
            });
            setItems(rows);
            setLoadingDocs(false);
        }, (err) => {
            console.error('documentation snapshot error', err);
            setLoadingDocs(false);
        });
        return () => unsub();
    }, []);

    function openAdd() {
        setEditingId(null);
        setActivityId('');
        setActivityName('');
        setImages([]);
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(doc: Documentation) {
        setEditingId(doc.id);
        setActivityId(doc.activityId);
        setActivityName(doc.activityName);
        setImages(doc.images);
        setDescription(doc.description);
        setModalVisible(true);
    }

    async function pickImages() {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            showToast('Allow access to photos to upload documentation', 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets) {
            const uris = result.assets.map((a: any) => a.uri);
            setImages((prev) => [...prev, ...uris]);
        }
    }

    function removeImage(uri: string) {
        setImages((prev) => prev.filter((i) => i !== uri));
    }

    async function save() {
        if (!activityId) {
            showToast('Please select an activity', 'error');
            return;
        }
        if (images.length === 0) {
            showToast('Please upload at least one image', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'documentation', editingId);
                await updateDoc(ref, {
                    activityId,
                    activityName,
                    images,
                    description,
                    date: new Date().toISOString().split('T')[0],
                    updatedAt: serverTimestamp(),
                });
                showToast('Documentation updated', 'success');
            } else {
                await addDoc(collection(db, 'documentation'), {
                    activityId,
                    activityName,
                    images,
                    description,
                    date: new Date().toISOString().split('T')[0],
                    createdAt: serverTimestamp(),
                });
                showToast('Documentation added', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('documentation save error', e);
            showToast('Failed to save documentation', 'error');
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
            await deleteDoc(doc(db, 'documentation', itemToDelete));
            showToast('Documentation deleted', 'success');
        } catch (e) {
            console.error('delete documentation error', e);
            showToast('Failed to delete documentation', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    const renderItem = ({ item }: { item: Documentation }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: '#111827' }}>{item.activityName}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{item.date}</Text>
                            <Text numberOfLines={2} style={{ color: '#374151', marginTop: 6 }}>{item.description || '—'}</Text>
                        </View>

                        <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                            <TouchableOpacity disabled={operationLoading} onPress={() => openEdit(item)} style={{ marginBottom: 8 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={operationLoading} onPress={() => confirmRemove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Image thumbnails */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {item.images.map((uri, idx) => (
                            <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                        ))}
                    </ScrollView>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* REPLACE HeaderCard with standard header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📸</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Documentation</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Upload photos of community activities
                </Text>
            </View>

            {/* Add button */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Documentation</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {loadingDocs ? (
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
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit Documentation' : 'Add Documentation'}</Text>

                            <Text style={{ color: '#374151', marginTop: 8 }}>Activity</Text>
                            <TouchableOpacity onPress={() => setActivityOpen((v) => !v)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: activityName ? '#111827' : '#9CA3AF' }}>{activityName || 'Select activity'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {activityOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
                                    {activities.length === 0 ? (
                                        <View style={{ padding: 12 }}>
                                            <Text style={{ color: '#6B7280' }}>No activities</Text>
                                        </View>
                                    ) : activities.map((act) => (
                                        <TouchableOpacity key={act.id} onPress={() => { setActivityId(act.id); setActivityName(act.name); setActivityOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#111827' }}>{act.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={{ color: '#374151', marginTop: 12 }}>Images ({images.length})</Text>
                            <TouchableOpacity onPress={pickImages} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 6, alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>📷 Pick Images</Text>
                            </TouchableOpacity>

                            {images.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                    {images.map((uri, idx) => (
                                        <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                                            <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                                            <TouchableOpacity onPress={() => removeImage(uri)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}

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
                title="Delete Documentation"
                message="Are you sure you want to delete this documentation? This action cannot be undone."
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
            />
        </SafeAreaView>
    );
}
