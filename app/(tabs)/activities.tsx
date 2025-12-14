import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import ListLoadingState from '../../src/components/ListLoadingState';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import PrimaryButton from '../../src/components/ui/PrimaryButton';
import { useToast } from '../../src/contexts/ToastContext';
import { db, storage } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';
import { deleteImageFromStorageByUrl } from '../../src/utils/storage';

type Activity = {
    id: string;
    title: string;
    location: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    description: string;
    images?: string[];
};

export default function ActivitiesScreen() {
    const { showToast } = useToast();
    const { t } = useTranslation();
    // data comes from Firestore
    const [items, setItems] = useState<Activity[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [imagesLoading, setImagesLoading] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [imageList, setImageList] = useState<string[]>([]);
    const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
    const imageFlatListRef = React.useRef<FlatList>(null);

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

    useEffect(() => {
        setLoadingActivities(true);
        const q = query(collection(db, 'activities'), orderBy('date', 'desc'));

        // Add artificial delay for better UX
        const minLoadTime = 1000;
        const start = Date.now();
        let isFirstLoad = true;

        const unsub = onSnapshot(q, (snap) => {
            const rows: Activity[] = snap.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    title: data.title || '',
                    location: data.location || '',
                    date: data.date || '',
                    time: data.time || '',
                    description: data.description || '',
                    images: Array.isArray(data?.images) ? data.images : [],
                };
            });

            if (isFirstLoad) {
                const elapsed = Date.now() - start;
                const remaining = Math.max(0, minLoadTime - elapsed);
                setTimeout(() => {
                    setItems(rows);
                    setLoadingActivities(false);
                }, remaining);
                isFirstLoad = false;
            } else {
                setItems(rows);
                setLoadingActivities(false);
            }
        }, (err) => {
            console.error('activities snapshot error', err);
            setLoadingActivities(false);
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

    // Pull to refresh
    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    function openAdd() {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_add', { defaultValue: 'Permission Denied: Only admin can add activities' }), 'error');
            return;
        }
        setEditingId(null);
        setTitle('');
        setLocation('');
        // Set date/time empty for new activity
        setDate('');
        setTime('');
        setDescription('');
        setImages([]);
        setModalVisible(true);
    }

    async function openEdit(a: Activity) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_edit', { defaultValue: 'Permission Denied: Only admin can edit activities' }), 'error');
            return;
        }
        setEditingId(a.id);
        setTitle(a.title);
        setLocation(a.location);
        setDate(a.date);
        // keep existing time or empty if not present (don't force default on edit)
        setTime(a.time || '');
        setDescription(a.description);
        const urls = await ensureDownloadUrls(a.images || []);
        setImages(urls);
        setModalVisible(true);
    }

    async function save() {
        if (!title.trim()) {
            showToast(t('activity_title_required', { defaultValue: 'Title is required' }), 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'activities', editingId);
                let uploadedUrls: string[] = [];
                if (images?.length) {
                    uploadedUrls = await uploadAllImagesAndReturnUrls(images, editingId);
                }
                await updateDoc(ref, { title, location, date, time, description, updatedAt: serverTimestamp(), images: uploadedUrls });
                showToast(t('activity_updated', { defaultValue: 'Activity updated successfully' }), 'success');
            } else {
                const docRef = await addDoc(collection(db, 'activities'), { title, location, date, time, description, createdAt: serverTimestamp() });
                if (images?.length) {
                    const urls = await uploadAllImagesAndReturnUrls(images, docRef.id);
                    await updateDoc(doc(db, 'activities', docRef.id), { images: urls });
                }
                showToast(t('activity_added', { defaultValue: 'Activity added successfully' }), 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('activity save error', e);
            showToast(t('failed_to_save_activity', { defaultValue: 'Failed to save activity' }), 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_delete', { defaultValue: 'Permission Denied: Only admin can delete activities' }), 'error');
            return;
        }
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function remove() {
        if (!itemToDelete) return;

        setDeleteConfirmVisible(false);
        setOperationLoading(true);

        try {
            // attempt to delete associated images first
            try {
                const refDoc = doc(db, 'activities', itemToDelete);
                const snap = await getDoc(refDoc);
                const data: any = snap.data();
                const imgs: string[] = Array.isArray(data?.images) ? data.images : [];
                if (imgs.length) {
                    const settled = await Promise.allSettled(imgs.map((u) => deleteImageFromStorageByUrl(u)));
                    const anyFailed = settled.some(s => s.status === 'rejected' || (s.status === 'fulfilled' && s.value === false));
                    if (anyFailed) showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                }
            } catch (errImgs) {
                console.warn('Failed deleting activity images', errImgs);
            }
            await deleteDoc(doc(db, 'activities', itemToDelete));
            showToast(t('activity_deleted', { defaultValue: 'Activity deleted successfully' }), 'success');
        } catch (e) {
            console.error('delete activity error', e);
            showToast(t('failed_to_delete_activity', { defaultValue: 'Failed to delete activity' }), 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    // Image helpers
    async function uploadImageToStorage(uri: string, activityId: string): Promise<string> {
        if (!uri) return '';
        if (uri.startsWith('http')) return uri;
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `activities/${activityId}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (err) {
            console.warn('Upload error', err);
            throw err;
        }
    }

    async function uploadAllImagesAndReturnUrls(uris: string[], activityId: string) {
        const urls: string[] = [];
        for (let i = 0; i < uris.length; i++) {
            const u = uris[i];
            if (!u) continue;
            if (u.startsWith('http')) { urls.push(u); continue; }
            const url = await uploadImageToStorage(u, activityId);
            urls.push(url);
        }
        return urls;
    }

    // Use shared deleteImageFromStorageByUrl helper imported above

    // Convert storage paths (gs:// or bucket path) to download URLs when necessary
    async function ensureDownloadUrls(uris: string[]) {
        if (!uris?.length) return [] as string[];
        const converted = await Promise.all(uris.map(async (u) => {
            try {
                if (!u) return u;
                if (u.startsWith('http')) return u;
                let path = u;
                if (u.startsWith('gs://')) {
                    path = u.replace(/^[^/]+:\/\/[\w.-]+\//, '');
                }
                const m = (u || '').match(/\/o\/([^?]+)/);
                if (m && m[1]) {
                    path = decodeURIComponent(m[1]);
                }
                const storageRef = ref(storage, path);
                return await getDownloadURL(storageRef);
            } catch (err) {
                console.warn('Failed to convert storage uri to download url', u, err);
                return u; // fallback
            }
        }));
        return converted;
    }

    async function showImagePreview(list: string[], startIndex = 0) {
        setImageModalVisible(true);
        setImageList([]);
        setActiveImageIndex(startIndex);
        if (!list || !list.length) return;
        const urls = await ensureDownloadUrls(list);
        setImageList(urls);
    }

    async function pickImages() {
        setImagesLoading(true);
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error');
                return;
            }
            const MEDIA_IMAGES = (ImagePicker as any)?.MediaType?.Images;
            const res = await ImagePicker.launchImageLibraryAsync({
                ...(MEDIA_IMAGES ? { mediaTypes: MEDIA_IMAGES } : {}),
                allowsMultipleSelection: true,
                quality: 0.8,
            });
            if (!res.canceled && res.assets) {
                const uris = res.assets.map((a: any) => a.uri);
                await new Promise(resolve => setTimeout(resolve, 250));
                setImages(prev => [...prev, ...uris]);
            }
        } catch (err) {
            console.warn('Image picker error', err);
        } finally {
            setImagesLoading(false);
        }
    }

    useEffect(() => {
        if (imageModalVisible && imageFlatListRef.current) {
            const idx = Math.max(0, Math.min(activeImageIndex, (imageList.length || 1) - 1));
            try { imageFlatListRef.current?.scrollToIndex({ index: idx, animated: true }); } catch { }
        }
    }, [activeImageIndex, imageModalVisible]);

    async function handleReplaceImageInEdit(index: number) {
        try {
            if (!editingId) {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) { showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error'); return; }
                const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
                if (!res.canceled && res.assets?.[0]?.uri) {
                    const newUri = res.assets[0].uri;
                    setImages(prev => prev.map((u, i) => i === index ? newUri : u));
                }
                return;
            }
            setOperationLoading(true);
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error'); setOperationLoading(false); return; }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
            if (res.canceled || !res.assets?.[0]?.uri) { setOperationLoading(false); return; }
            const newLocalUri = res.assets[0].uri;
            const uploadedUrl = await uploadImageToStorage(newLocalUri, editingId);
            const prevImages = images.slice();
            const oldUrl = prevImages[index];
            prevImages[index] = uploadedUrl;
            setImages(prevImages);
            await updateDoc(doc(db, 'activities', editingId), { images: prevImages });
            if (oldUrl && (oldUrl.startsWith('http://') || oldUrl.startsWith('https://') || oldUrl.startsWith('gs://'))) {
                const deleted = await deleteImageFromStorageByUrl(oldUrl);
                if (!deleted) {
                    console.warn('Failed to delete old activity image', oldUrl);
                    showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                }
            }
        } catch (err) {
            console.error('Replace image error', err);
            showToast(t('failed_to_replace_image', { defaultValue: 'Failed to replace image' }), 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    async function handleRemoveImageInEdit(index: number) {
        try {
            const current = images.slice();
            const removed = current.splice(index, 1)[0];
            setImages(current);
            if (editingId) {
                setOperationLoading(true);
                await updateDoc(doc(db, 'activities', editingId), { images: current });
                if (removed && (removed.startsWith('http://') || removed.startsWith('https://') || removed.startsWith('gs://'))) {
                    const deleted = await deleteImageFromStorageByUrl(removed);
                    if (!deleted) {
                        console.warn('Failed to delete removed activity image', removed);
                        showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                    }
                }
            }
        } catch (err) {
            console.error('Remove image error', err);
            showToast(t('failed_to_remove_image', { defaultValue: 'Failed to remove image' }), 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    // helper: determine activity status based on date (YYYY-MM-DD)
    function getActivityStatus(a: Activity): 'upcoming' | 'active' | 'expired' | null {
        if (!a.date) return null;
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);
        const start = a.date ? new Date(a.date) : new Date('1970-01-01');
        // treat a single-day activity: active if today == date
        // if you want multi-day activities, adapt with endDate field
        if (today < start) return 'upcoming';
        if (today > start) return 'expired';
        return 'active';
    }

    // ADDED: filtering by status and date-range
    const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'expired'>('all');
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);

    // NEW: search query state
    const [searchQuery, setSearchQuery] = useState<string>('');

    // single activity date filter (YYYY-MM-DD). Empty = show all dates
    const [filterDate, setFilterDate] = useState<string>('');
    const [filterDatePickerVisible, setFilterDatePickerVisible] = useState(false);

    // compute displayed items: apply status + activity date (single date) filter + search, then sort by status priority
    const displayedItems = items
        .filter(i => {
            // search filter (by title or location)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchTitle = (i.title || '').toLowerCase().includes(query);
                const matchLocation = (i.location || '').toLowerCase().includes(query);
                if (!matchTitle && !matchLocation) return false;
            }
            // status filter
            if (filterStatus !== 'all') {
                const s = getActivityStatus(i);
                if (s !== filterStatus) return false;
            }
            // activity date filter (single date)
            if (filterDate) {
                if (!i.date) return false;
                if (i.date !== filterDate) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const rank: Record<string, number> = { active: 0, upcoming: 1, expired: 2, null: 3 };
            const sa = getActivityStatus(a) ?? 'null';
            const sb = getActivityStatus(b) ?? 'null';
            const ra = rank[sa] ?? 3;
            const rb = rank[sb] ?? 3;
            if (ra !== rb) return ra - rb;
            // same status, most recent date first
            return b.date.localeCompare(a.date);
        });

    // counts for summary card
    const totalActivities = items.length;
    const counts = items.reduce((acc: Record<string, number>, it) => {
        const s = getActivityStatus(it) ?? 'none';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const activeCount = counts['active'] || 0;
    const upcomingCount = counts['upcoming'] || 0;
    const expiredCount = counts['expired'] || 0;

    // PAGINATION state
    const ACTIVITIES_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(ACTIVITIES_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Reset displayed count when items or filters change
    useEffect(() => {
        setDisplayedCount(ACTIVITIES_PER_PAGE);
    }, [items, filterStatus, filterDate, searchQuery]);

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= displayedItems.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + ACTIVITIES_PER_PAGE, displayedItems.length));
            setLoadingMore(false);
        }, 400);
    };

    const renderItem = ({ item }: { item: Activity }) => {
        const status = getActivityStatus(item);
        const statusStyles: Record<string, { bg: string; text: string; label: string; border: string }> = {
            upcoming: { bg: '#FEF3C7', text: '#92400E', label: 'UPCOMING', border: '#F59E0B' },
            active: { bg: '#ECFDF5', text: '#065F46', label: 'ON GOING', border: '#10B981' },
            expired: { bg: '#FEF2F2', text: '#7F1D1D', label: 'EXPIRED', border: '#EF4444' },
        };
        const colors = status ? statusStyles[status] : { bg: '#F3F4F6', text: '#6B7280', label: 'NONE', border: '#9CA3AF' };

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
                    borderLeftColor: colors.border,
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

                    {/* Status badge & Title */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <Text style={{ fontSize: 20 }}>🎯</Text>
                        <View style={{
                            backgroundColor: colors.bg,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 999,
                            borderWidth: 2,
                            borderColor: colors.border
                        }}>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 10 }}>
                                {colors.label}
                            </Text>
                        </View>
                    </View>

                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                        {item.title}
                    </Text>

                    <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>
                        📍 {item.location}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>📅 {formatDateOnly(item.date)}</Text>
                        </View>
                        <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '600' }}>🕐 {item.time}</Text>
                        </View>
                    </View>

                    {!!item.description && (
                        <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13 }}>
                            {item.description}
                        </Text>
                    )}
                    {item.images && item.images.length > 0 && (
                        <TouchableOpacity onPress={() => showImagePreview(item.images || [], 0)} style={{ marginTop: 6 }}>
                            <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{t('image_count_label', { count: item.images.length, defaultValue: `Image : ${item.images.length} (total)` })}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

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
                        <Text style={{ fontSize: 32 }}>🗓️</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('activities_title', { defaultValue: 'Activities' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('activities_subtitle', { defaultValue: 'Manage community activities and events' })}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Status Summary - Compact Tab Style */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 12,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)'
                }}>
                    <TouchableOpacity
                        onPress={() => setFilterStatus('all')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterStatus === 'all' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterStatus === 'all' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterStatus === 'all' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterStatus === 'all' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>{t('activities_tab_all', { defaultValue: '📢 All' })}</Text>
                        <Text style={{
                            color: filterStatus === 'all' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{totalActivities}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterStatus('active')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterStatus === 'active' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterStatus === 'active' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterStatus === 'active' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterStatus === 'active' ? '#059669' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>{t('activities_tab_active', { defaultValue: '🟢 Active' })}</Text>
                        <Text style={{
                            color: filterStatus === 'active' ? '#059669' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{activeCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterStatus('upcoming')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterStatus === 'upcoming' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterStatus === 'upcoming' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterStatus === 'upcoming' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterStatus === 'upcoming' ? '#D97706' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>{t('activities_tab_upcoming', { defaultValue: '🟡 Upcoming' })}</Text>
                        <Text style={{
                            color: filterStatus === 'upcoming' ? '#D97706' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{upcomingCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterStatus('expired')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: filterStatus === 'expired' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: filterStatus === 'expired' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: filterStatus === 'expired' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: filterStatus === 'expired' ? '#DC2626' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            fontSize: 11
                        }}>{t('activities_tab_expired', { defaultValue: '🔴 Expired' })}</Text>
                        <Text style={{
                            color: filterStatus === 'expired' ? '#DC2626' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{expiredCount}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search & Add Button - On Purple Gradient */}
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
                    {/* Left: Search Input */}
                    <View style={{ flex: 1.5 }}>
                        <FloatingLabelInput
                            label={t('search', { defaultValue: 'Search' })}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t('search_placeholder', { defaultValue: 'Search...' })}
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('add_activity_button', { defaultValue: '+ Activity' })}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* FILTERS: Compact Card */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    padding: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    overflow: 'hidden',
                }}>
                    <TouchableOpacity
                        onPress={() => setFilterStatusOpen(prev => !prev)}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{t('filters', { defaultValue: '🔍 Filters' })}</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filterStatusOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filterStatusOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Status & Date - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('status_label', { defaultValue: 'Status' })}
                                        value={filterStatus}
                                        options={[
                                            { label: t('activities_tab_all', { defaultValue: '📢 All' }), value: 'all' },
                                            { label: t('activities_tab_upcoming', { defaultValue: '🟡 Upcoming' }), value: 'upcoming' },
                                            { label: t('activities_tab_active', { defaultValue: '🟢 Active' }), value: 'active' },
                                            { label: t('activities_tab_expired', { defaultValue: '🔴 Expired' }), value: 'expired' }
                                        ]}
                                        onValueChange={(v: string) => setFilterStatus(v as 'all' | 'upcoming' | 'active' | 'expired')}
                                        placeholder={t('select_status', { defaultValue: 'Select status' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('activity_date_label', { defaultValue: 'Activity Date' })}
                                        value={filterDate ? formatDateOnly(filterDate) : ''}
                                        onChangeText={() => { }}
                                        placeholder={t('all_dates', { defaultValue: 'All dates' })}
                                        editable={false}
                                        onPress={() => setFilterDatePickerVisible(true)}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* Date picker for Filter (was missing) */}
            <DateTimePickerModal
                isVisible={filterDatePickerVisible}
                mode="date"
                onConfirm={(d: Date) => {
                    setFilterDatePickerVisible(false);
                    setFilterDate(dateToYMD(d));
                }}
                onCancel={() => setFilterDatePickerVisible(false)}
            />

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
                    {loadingActivities ? (
                        <ListLoadingState message={t('loading_activities', { defaultValue: 'Loading activities...' })} />
                    ) : (
                        <FlatList
                            data={displayedItems.slice(0, displayedCount)}
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
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_activities_found', { defaultValue: 'No activities found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_activities_match_filters', { defaultValue: 'No activities match your filters' })}
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const status = getActivityStatus(item);
                                const statusStyles: Record<string, { bg: string; text: string; label: string; border: string }> = {
                                    upcoming: { bg: '#FEF3C7', text: '#92400E', label: 'UPCOMING', border: '#F59E0B' },
                                    active: { bg: '#ECFDF5', text: '#065F46', label: 'ON GOING', border: '#10B981' },
                                    expired: { bg: '#FEF2F2', text: '#7F1D1D', label: 'EXPIRED', border: '#EF4444' },
                                };
                                const colors = status ? statusStyles[status] : { bg: '#F3F4F6', text: '#6B7280', label: 'NONE', border: '#9CA3AF' };

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
                                            borderLeftColor: colors.border,
                                            paddingRight: 110,
                                        }}>
                                            {/* Actions - positioned absolute center right (Admin only) */}
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

                                            {/* Status badge & Title */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                <View style={{
                                                    backgroundColor: colors.bg,
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 5,
                                                    borderRadius: 999,
                                                    borderWidth: 2,
                                                    borderColor: colors.border
                                                }}>
                                                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 10 }}>
                                                        {colors.label}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                                                {item.title}
                                            </Text>

                                            <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>
                                                📍 {item.location}
                                            </Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                    <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>📅 {formatDateOnly(item.date)}</Text>
                                                </View>
                                                <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                    <Text style={{ color: '#1E40AF', fontSize: 11, fontWeight: '600' }}>🕐 {item.time}</Text>
                                                </View>
                                            </View>

                                            {!!item.description && (
                                                <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13 }}>
                                                    {item.description}
                                                </Text>
                                            )}
                                            {item.images && item.images.length > 0 && (
                                                <TouchableOpacity onPress={() => showImagePreview(item.images || [], 0)} style={{ marginTop: 6 }}>
                                                    <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{t('image_count_label', { count: item.images.length, defaultValue: `image : ${item.images.length} (total)` })}</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            }}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => (
                                <LoadMore
                                    loading={loadingMore}
                                    hasMore={displayedCount < displayedItems.length}
                                />
                            )}
                        />
                    )}
                </View>
            </View>

            <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 160, flexGrow: 1 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700' }}>{editingId ? t('edit_activity', { defaultValue: 'Edit Activity' }) : t('add_activity', { defaultValue: 'Add Activity' })}</Text>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 8 }}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <FloatingLabelInput
                                label={t('activity_name_label', { defaultValue: 'Activity Name' })}
                                value={title}
                                onChangeText={setTitle}
                                placeholder={t('activity_name_placeholder', { defaultValue: 'Enter activity title' })}
                            />

                            <FloatingLabelInput
                                label={t('location_label', { defaultValue: 'Location' })}
                                value={location}
                                onChangeText={setLocation}
                                placeholder={t('location_placeholder', { defaultValue: 'Enter location' })}
                            />

                            <FloatingLabelInput
                                label={t('date_label', { defaultValue: 'Date' })}
                                value={date ? formatDateOnly(date) : ''}
                                onChangeText={() => { }}
                                placeholder={t('select_date', { defaultValue: 'Select date' })}
                                editable={Platform.OS === 'web'}
                                onPress={Platform.OS === 'web' ? undefined : () => setShowDatePicker(true)}
                            />

                            {/* Date picker for mobile */}
                            <DateTimePickerModal
                                isVisible={showDatePicker}
                                mode="date"
                                onConfirm={(d: Date) => {
                                    setShowDatePicker(false);
                                    setDate(dateToYMD(d));
                                }}
                                onCancel={() => setShowDatePicker(false)}
                            />

                            <FloatingLabelInput
                                label={t('time_label', { defaultValue: 'Time' })}
                                value={time}
                                onChangeText={() => { }}
                                placeholder={t('select_time', { defaultValue: 'Select time' })}
                                editable={Platform.OS === 'web'}
                                onPress={Platform.OS === 'web' ? undefined : () => setShowTimePicker(true)}
                            />

                            {/* Time picker for mobile */}
                            <DateTimePickerModal
                                isVisible={showTimePicker}
                                mode="time"
                                onConfirm={(d: Date) => {
                                    setShowTimePicker(false);
                                    setTime(dateToHM(d));
                                }}
                                onCancel={() => setShowTimePicker(false)}
                            />

                            <FloatingLabelInput
                                label={t('description_label', { defaultValue: 'Description' })}
                                value={description}
                                onChangeText={setDescription}
                                placeholder={t('description_optional_placeholder', { defaultValue: 'Enter description (optional)' })}
                                multiline
                                inputStyle={{ minHeight: 120, paddingTop: 18 }}
                            />

                            {/* Image picker */}
                            <View style={{ marginTop: 4 }}>
                                <FloatingLabelInput
                                    label={t('images_label', { defaultValue: 'Images' })}
                                    value={images.length ? t('image_count_label', { count: images.length, defaultValue: `image : ${images.length} (total)` }) : ''}
                                    onChangeText={() => { }}
                                    editable={false}
                                    onPress={pickImages}
                                    placeholder={t('pick_images', { defaultValue: '📷 Pick Images' })}
                                    inputStyle={{ paddingRight: 48 }}
                                />
                                {imagesLoading && (
                                    <View style={{ position: 'absolute', right: 12, top: 14 }}>
                                        <ActivityIndicator size="small" color="#3B82F6" />
                                    </View>
                                )}
                                {imagesLoading ? (
                                    <View style={{ marginTop: 8, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#3B82F6" />
                                    </View>
                                ) : images.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                        {images.map((uri, idx) => (
                                            <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                                                <TouchableOpacity onPress={() => showImagePreview(images, idx)}>
                                                    <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: 8 }} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleReplaceImageInEdit(idx)} style={{ position: 'absolute', top: -6, right: 18, backgroundColor: '#F3F4F6', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: '#111827', fontWeight: '700' }}>✎</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleRemoveImageInEdit(idx)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </ScrollView>
                                ) : null}
                            </View>

                            {/* Primary action inline and scrollable */}
                            <View style={{ marginTop: 16 }}>
                                <PrimaryButton
                                    label={editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}
                                    onPress={save}
                                    loading={operationLoading}
                                    style={{ width: '100%' }}
                                />
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            <Modal visible={imageModalVisible} transparent animationType="fade" onRequestClose={() => setImageModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity activeOpacity={1} onPress={() => setImageModalVisible(false)} style={{ position: 'absolute', top: 40, right: 20 }}>
                        <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => {
                        if (activeImageIndex > 0) {
                            setActiveImageIndex(prev => Math.max(0, prev - 1));
                            imageFlatListRef.current?.scrollToIndex({ index: Math.max(0, activeImageIndex - 1), animated: true });
                        }
                    }} style={{ position: 'absolute', left: 12, top: '50%', zIndex: 30 }}>
                        <Text style={{ color: '#fff', fontSize: 28 }}>‹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        if (activeImageIndex < (imageList.length - 1)) {
                            setActiveImageIndex(prev => Math.min(imageList.length - 1, prev + 1));
                            imageFlatListRef.current?.scrollToIndex({ index: Math.min(imageList.length - 1, activeImageIndex + 1), animated: true });
                        }
                    }} style={{ position: 'absolute', right: 12, top: '50%', zIndex: 30 }}>
                        <Text style={{ color: '#fff', fontSize: 28 }}>›</Text>
                    </TouchableOpacity>

                    <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 12, marginTop: 18 }}>{imageList.length > 0 ? `${activeImageIndex + 1} / ${imageList.length}` : ''}</Text>

                    <FlatList
                        ref={imageFlatListRef}
                        data={imageList}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(it, i) => `${it}-${i}`}
                        initialScrollIndex={activeImageIndex < imageList.length ? activeImageIndex : 0}
                        getItemLayout={(_, index) => ({ length: Dimensions.get('window').width * 0.9, offset: (Dimensions.get('window').width * 0.9) * index, index })}
                        onMomentumScrollEnd={(e) => {
                            const offsetX = e.nativeEvent.contentOffset.x;
                            const width = Dimensions.get('window').width * 0.9;
                            const idx = Math.round(offsetX / width);
                            setActiveImageIndex(idx);
                        }}
                        renderItem={({ item }) => (
                            <View style={{ width: Dimensions.get('window').width * 0.9, alignItems: 'center', justifyContent: 'center' }}>
                                <Image source={{ uri: item }} style={{ width: '100%', height: '70%', borderRadius: 12 }} resizeMode="contain" />
                            </View>
                        )}
                    />
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title={t('delete_activity_title', { defaultValue: 'Delete Activity' })}
                message={t('delete_activity_message', { defaultValue: 'Are you sure you want to delete this activity? This action cannot be undone.' })}
                onConfirm={remove}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setItemToDelete(null);
                }}
            />
        </SafeAreaView>
    );
}
