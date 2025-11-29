import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';

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
    // filter by activity (null = all)
    const [filterActivity, setFilterActivity] = useState<string | null>(null);
    const [filterActivityOpen, setFilterActivityOpen] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [activityOpen, setActivityOpen] = useState(false);

    // delete confirm state
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // PAGINATION state
    const DOCS_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(DOCS_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    }, [refreshTrigger]);

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // Reset displayed count when items or filters change
    useEffect(() => {
        setDisplayedCount(DOCS_PER_PAGE);
    }, [items, filterActivity]);

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

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= filteredItems.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + DOCS_PER_PAGE, filteredItems.length));
            setLoadingMore(false);
        }, 400);
    };

    // compute displayed items filtered by selected activity
    const filteredItems = items.filter((it) => {
        if (filterActivity && filterActivity !== 'all') {
            return it.activityId === filterActivity;
        }
        return true;
    });

    // Compute summary statistics
    const totalImages = items.reduce((sum, item) => sum + item.images.length, 0);
    const totalDocs = items.length;

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Purple Gradient Background for Header */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                }}
            />

            {/* Header - Horizontal Layout */}
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {/* Icon on left */}
                    <View style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 6
                    }}>
                        <Text style={{ fontSize: 32 }}>📸</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>Documentation</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            Upload photos of community activities
                        </Text>
                    </View>
                </View>
            </View>

            {/* Summary card - Compact Style */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 12,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)'
                }}>
                    <View style={{
                        flex: 1,
                        paddingVertical: 8,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 9,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2
                    }}>
                        <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 11 }}>📸 Images</Text>
                        <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 16, marginTop: 1 }}>{totalImages}</Text>
                    </View>
                    <View style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                    }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', fontSize: 11 }}>📄 Docs</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '800', fontSize: 16, marginTop: 1 }}>{totalDocs}</Text>
                    </View>
                    <View style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                    }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', fontSize: 11 }}>👁️ Shown</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '800', fontSize: 16, marginTop: 1 }}>{filteredItems.length}</Text>
                    </View>
                </View>
            </View>

            {/* Filters & Add Button - On Purple Gradient */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    padding: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                }}>
                    {/* Left: Activity filter */}
                    <View style={{ flex: 1.5 }}>
                        <SelectInput
                            label="Activity"
                            value={filterActivity || ''}
                            options={[
                                { label: 'All Activities', value: '' },
                                ...activities.map(act => ({ label: act.name, value: act.id }))
                            ]}
                            onValueChange={(v: string) => setFilterActivity(v || null)}
                            placeholder="Select activity"
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: Add Button */}
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity disabled={operationLoading} onPress={openAdd} activeOpacity={0.9}>
                            <LinearGradient
                                colors={['#7c3aed', '#6366f1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    shadowColor: '#7c3aed',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 2,
                                    height: 50,
                                    justifyContent: 'center'
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Add</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {loadingDocs ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 18 }}>
                    <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.12,
                        shadowRadius: 16,
                        elevation: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        overflow: 'hidden',
                        flex: 1
                    }}>
                        <FlatList
                            data={filteredItems.slice(0, displayedCount)}
                            keyExtractor={(i) => i.id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} tintColor="#7c3aed" />
                            }
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No documentation found</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        No documentation available
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
                                        borderLeftColor: '#8B5CF6',
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

                                        {/* Title and Date */}
                                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                                            📸 {item.activityName}
                                        </Text>

                                        <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 }}>
                                            <Text style={{ color: '#6D28D9', fontSize: 11, fontWeight: '600' }}>📅 {item.date}</Text>
                                        </View>

                                        {!!item.description && (
                                            <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>
                                                {item.description}
                                            </Text>
                                        )}

                                        {/* Image thumbnails */}
                                        {item.images.length > 0 && (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                                {item.images.map((uri, idx) => (
                                                    <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                                                ))}
                                            </ScrollView>
                                        )}
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
                    </View>
                </View>
            )}

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView scrollEnabled={!activityOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? 'Edit Documentation' : 'Add Documentation'}</Text>

                            <SelectInput
                                label="Activity"
                                value={activityId}
                                options={activities.map(act => ({ label: act.name, value: act.id }))}
                                onValueChange={(v: string) => {
                                    setActivityId(v);
                                    const selected = activities.find(a => a.id === v);
                                    setActivityName(selected?.name || '');
                                }}
                                placeholder="Select activity"
                            />

                            <View style={{ marginTop: 4, marginBottom: 8 }}>
                                <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>Images ({images.length})</Text>
                            </View>
                            <TouchableOpacity onPress={pickImages} style={{ borderWidth: 2, borderColor: '#7c3aed', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff', marginBottom: 12 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>📷 Pick Images</Text>
                            </TouchableOpacity>

                            {images.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 12 }}>
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

                            <FloatingLabelInput
                                label="Description"
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Enter description (optional)"
                                multiline
                                inputStyle={{ minHeight: 120, paddingTop: 18 }}
                            />

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
