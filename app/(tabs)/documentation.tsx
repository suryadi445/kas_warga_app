import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import ListLoadingState from '../../src/components/ListLoadingState';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db, storage } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

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
    const { t } = useTranslation();
    const [items, setItems] = useState<Documentation[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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
        const startTime = Date.now();
        setLoadingDocs(true);
        const q = query(collection(db, 'documentation'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, async (snap) => {
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

            const elapsed = Date.now() - startTime;
            if (elapsed < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
            }
            setLoadingDocs(false);
        }, (err) => {
            console.error('documentation snapshot error', err);
            setLoadingDocs(false);
        });
        return () => unsub();
    }, [refreshTrigger]);

    // load current user's role for client-side permission checks
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const user = getCurrentUser();
                if (!user) return;
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (!mounted) return;
                if (snap && snap.exists()) {
                    const data: any = snap.data();
                    setCurrentUserRole(data?.role || null);
                }
            } catch (err) {
                console.warn('Failed to load current user role', err);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // Reset displayed count when items or filters change
    useEffect(() => {
        setDisplayedCount(DOCS_PER_PAGE);
    }, [items, filterActivity]);

    function openAdd() {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_add'), 'error');
            return;
        }
        setEditingId(null);
        setActivityId('');
        setActivityName('');
        setImages([]);
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(doc: Documentation) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_edit'), 'error');
            return;
        }
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
            showToast(t('allow_photos_access_to_upload_documentation'), 'error');
            return;
        }

        // Use new MediaType constant if available; otherwise omit mediaTypes to avoid deprecation warnings
        const MEDIA_IMAGES = (ImagePicker as any)?.MediaType?.Images;
        const result = await ImagePicker.launchImageLibraryAsync({
            ...(MEDIA_IMAGES ? { mediaTypes: MEDIA_IMAGES } : {}),
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

    // State for upload progress
    const [uploadProgress, setUploadProgress] = useState<string>('');

    // Upload a single image to Firebase Storage and return the download URL
    async function uploadImageToStorage(uri: string): Promise<string> {
        // If already a remote URL (http/https), skip upload
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return uri;
        }

        try {
            // Fetch the local file and convert to blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Generate unique filename
            const filename = `documentation/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, filename);

            // Upload to Firebase Storage
            await uploadBytes(storageRef, blob);

            // Get download URL
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    // Upload multiple images and return array of download URLs
    async function uploadAllImages(imageUris: string[]): Promise<string[]> {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < imageUris.length; i++) {
            setUploadProgress(t('uploading_image', { defaultValue: `Uploading image ${i + 1} of ${imageUris.length}...`, current: i + 1, total: imageUris.length }));
            const url = await uploadImageToStorage(imageUris[i]);
            uploadedUrls.push(url);
        }
        setUploadProgress('');
        return uploadedUrls;
    }

    async function save() {
        if (!activityId) {
            showToast(t('please_select_activity'), 'error');
            return;
        }
        if (images.length === 0) {
            showToast(t('please_upload_at_least_one_image'), 'error');
            return;
        }
        setOperationLoading(true);
        try {
            // Upload all images to Firebase Storage first
            const uploadedImageUrls = await uploadAllImages(images);

            if (editingId) {
                const docRef = doc(db, 'documentation', editingId);
                await updateDoc(docRef, {
                    activityId,
                    activityName,
                    images: uploadedImageUrls,
                    description,
                    date: new Date().toISOString().split('T')[0],
                    updatedAt: serverTimestamp(),
                });
                showToast(t('documentation_updated'), 'success');
            } else {
                await addDoc(collection(db, 'documentation'), {
                    activityId,
                    activityName,
                    images: uploadedImageUrls,
                    description,
                    date: new Date().toISOString().split('T')[0],
                    createdAt: serverTimestamp(),
                });
                showToast(t('documentation_added'), 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('documentation save error', e);
            showToast(t('failed_to_save_documentation'), 'error');
        } finally {
            setOperationLoading(false);
            setUploadProgress('');
        }
    }

    function confirmRemove(id: string) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_delete'), 'error');
            return;
        }
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function removeConfirmed() {
        if (!itemToDelete) return;
        setDeleteConfirmVisible(false);
        setOperationLoading(true);
        try {
            await deleteDoc(doc(db, 'documentation', itemToDelete));
            showToast(t('documentation_deleted'), 'success');
        } catch (e) {
            console.error('delete documentation error', e);
            showToast(t('failed_to_delete_documentation'), 'error');
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
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('documentation_title', { defaultValue: 'Documentation' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('documentation_subtitle', { defaultValue: 'Upload photos of community activities' })}
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
                        <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 11 }}>{t('images_label', { defaultValue: '📸 Images' })}</Text>
                        <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 16, marginTop: 1 }}>{totalImages}</Text>
                    </View>
                    <View style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                    }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', fontSize: 11 }}>{t('docs_label', { defaultValue: '📄 Docs' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '800', fontSize: 16, marginTop: 1 }}>{totalDocs}</Text>
                    </View>
                    <View style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                    }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', fontSize: 11 }}>{t('shown_label', { defaultValue: '👁️ Shown' })}</Text>
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
                            label={t('activity_label', { defaultValue: 'Activity' })}
                            value={filterActivity || ''}
                            options={[
                                { label: t('all_activities', { defaultValue: 'All Activities' }), value: '' },
                                ...activities.map(act => ({ label: act.name, value: act.id }))
                            ]}
                            onValueChange={(v: string) => setFilterActivity(v || null)}
                            placeholder={t('select_activity', { defaultValue: 'Select activity' })}
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: Add Button (Admin only) */}
                    {currentUserRole === 'Admin' && (
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('add_documentation_button', { defaultValue: '+ Documentation' })}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

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
                    {loadingDocs ? (
                        <ListLoadingState message={t('loading_documentation', { defaultValue: 'Loading documentation...' })} />
                    ) : (
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
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_documentation_found', { defaultValue: 'No documentation found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_documentation_available', { defaultValue: 'No documentation available' })}
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
                                        {currentUserRole === 'Admin' && (
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
                                                    <Text style={{ color: '#0369A1', fontWeight: '600', fontSize: 12 }}>{t('edit', { defaultValue: 'Edit' })}</Text>
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
                                                    <Text style={{ color: '#991B1B', fontWeight: '600', fontSize: 12 }}>{t('delete', { defaultValue: 'Delete' })}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

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
                    )}
                </View>
            </View>

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView scrollEnabled={!activityOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? t('edit_documentation', { defaultValue: 'Edit Documentation' }) : t('add_documentation', { defaultValue: 'Add Documentation' })}</Text>

                            <SelectInput
                                label={t('activity_label', { defaultValue: 'Activity' })}
                                value={activityId}
                                options={activities.map(act => ({ label: act.name, value: act.id }))}
                                onValueChange={(v: string) => {
                                    setActivityId(v);
                                    const selected = activities.find(a => a.id === v);
                                    setActivityName(selected?.name || '');
                                }}
                                placeholder={t('select_activity', { defaultValue: 'Select activity' })}
                            />

                            <View style={{ marginTop: 4, marginBottom: 8 }}>
                                <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>{t('images_label', { defaultValue: 'Images' })} ({images.length})</Text>
                            </View>
                            <TouchableOpacity onPress={pickImages} style={{ borderWidth: 2, borderColor: '#7c3aed', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff', marginBottom: 12 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>{t('pick_images', { defaultValue: '📷 Pick Images' })}</Text>
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
                                label={t('description_label', { defaultValue: 'Description' })}
                                value={description}
                                onChangeText={setDescription}
                                placeholder={t('description_optional', { defaultValue: 'Enter description (optional)' })}
                                multiline
                                inputStyle={{ minHeight: 120, paddingTop: 18 }}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                                </TouchableOpacity>

                                {/* Upload progress indicator */}
                                {uploadProgress ? (
                                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}>
                                        <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '600' }}>{uploadProgress}</Text>
                                    </View>
                                ) : null}

                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#7c3aed" /> : <Text style={{ color: '#7c3aed', fontWeight: '700' }}>{editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}</Text>}
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title={t('delete_documentation_title', { defaultValue: 'Delete Documentation' })}
                message={t('delete_documentation_message', { defaultValue: 'Are you sure you want to delete this documentation? This action cannot be undone.' })}
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
            />
        </SafeAreaView>
    );
}
