import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../src/firebaseConfig';
import { deleteImageFromStorageByUrl } from '../../src/utils/storage';
// Image is imported below in the big import list
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
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
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

type Announcement = {
    id: string;
    category: string;
    role: string;
    title: string;
    content: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    date: string;
    images?: string[];
};

const ROLES = ['All', 'Admin', 'Staff', 'User'];

export default function AnnouncementsScreen() {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [items, setItems] = useState<Announcement[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [category, setCategory] = useState('');
    const [role, setRole] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [roleOpen, setRoleOpen] = useState(false);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
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

    // Date/Time pickers
    const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
    const [startTimePickerVisible, setStartTimePickerVisible] = useState(false);
    const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);

    // PAGINATION state
    const ANNOUNCEMENTS_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(ANNOUNCEMENTS_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Helper functions for date/time formatting
    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatTime = (date: Date) => {
        const h = `${date.getHours()}`.padStart(2, '0');
        const m = `${date.getMinutes()}`.padStart(2, '0');
        return `${h}:${m}`;
    };

    // NEW: display date as "DD Mon YYYY" e.g. "14 Nov 2025"
    function displayDateYMonD(dateStr: string) {
        if (!dateStr) return '';
        const parts = String(dateStr).split('-');
        if (parts.length < 3) return dateStr;
        const [y, m, d] = parts;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mi = Number(m) - 1;
        const mon = months[mi] ?? (m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
        const day = String(Number(d)); // remove leading zero
        return `${day} ${mon} ${y}`;
    }

    // realtime listener
    useEffect(() => {
        setLoadingAnnouncements(true);
        const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const rows: Announcement[] = snap.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    category: data.category || '',
                    role: data.role || '',
                    title: data.title || '',
                    content: data.content || '',
                    startDate: data.startDate || '',
                    startTime: data.startTime || '',
                    endDate: data.endDate || '',
                    endTime: data.endTime || '',
                    date: data.date || (data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0] : ''),
                    images: Array.isArray(data.images) ? data.images : [],
                };
            });
            setItems(rows);
            setLoadingAnnouncements(false);
        }, (err) => {
            console.error('announcements snapshot error', err);
            setLoadingAnnouncements(false);
        });
        return () => unsub();
    }, [refreshTrigger]);

    // load current user's role for permissions (client-side guard)
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
            showToast(t('permission_denied_admin_add'), 'error');
            return;
        }
        setEditingId(null);
        setCategory('');
        setRole('');
        setTitle('');
        setContent('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setRoleOpen(false);
        setModalVisible(true);
        setImages([]);
    }

    async function openEdit(a: Announcement) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_edit'), 'error');
            return;
        }
        setEditingId(a.id);
        setCategory(a.category);
        setRole(a.role);
        setTitle(a.title);
        setContent(a.content);
        setStartDate(a.startDate);
        setStartTime(a.startTime);
        setEndDate(a.endDate);
        setEndTime(a.endTime);
        setModalVisible(true);
        // Convert any storage paths to download urls if needed
        const urls = await ensureDownloadUrls(a.images || []);
        setImages(urls);
    }

    async function save() {
        if (!category.trim() || !role.trim() || !title.trim() || !content.trim() || !startDate || !startTime || !endDate || !endTime) {
            showToast(t('please_fill_all_fields'), 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'announcements', editingId);
                // If any images are present (local URIs or remote URLs), upload new local ones and persist images array
                let uploadedUrls: string[] = [];
                if (images?.length) {
                    uploadedUrls = await uploadAllImagesAndReturnUrls(images, editingId);
                }
                await updateDoc(ref, { category, role, title, content, startDate, startTime, endDate, endTime, date: new Date().toISOString().split('T')[0], images: uploadedUrls });
                showToast(t('announcement_updated'), 'success');
            } else {
                const docRef = await addDoc(collection(db, 'announcements'), {
                    category,
                    role,
                    title,
                    content,
                    startDate,
                    startTime,
                    endDate,
                    endTime,
                    date: new Date().toISOString().split('T')[0],
                    createdAt: serverTimestamp(),
                });
                if (images?.length) {
                    const urls = await uploadAllImagesAndReturnUrls(images, docRef.id);
                    await updateDoc(doc(db, 'announcements', docRef.id), { images: urls });
                }
                showToast(t('announcement_added'), 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('announcement save error', e);
            showToast(t('failed_to_save_announcement'), 'error');
        } finally {
            setOperationLoading(false);
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

    async function remove() {
        if (!itemToDelete) return;

        setDeleteConfirmVisible(false);
        setOperationLoading(true);

        try {
            const ref = doc(db, 'announcements', itemToDelete);
            // attempt to delete stored images first
            try {
                const snap = await getDoc(ref);
                const data: any = snap.data();
                const imgs: string[] = Array.isArray(data?.images) ? data.images : [];
                if (imgs.length) {
                    const settled = await Promise.allSettled(imgs.map((u) => deleteImageFromStorageByUrl(u)));
                    const anyFailed = settled.some(s => s.status === 'rejected' || (s.status === 'fulfilled' && s.value === false));
                    if (anyFailed) showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                }
            } catch (errImgs) {
                console.warn('Failed deleting announcement images', errImgs);
            }
            await deleteDoc(ref);
            showToast(t('announcement_deleted'), 'success');
        } catch (e) {
            console.error('delete announcement error', e);
            showToast(t('failed_to_delete_announcement'), 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    // image modal markup has been moved to the JSX return near ConfirmDialog

    // Image helpers
    async function uploadImageToStorage(uri: string, announcementId: string): Promise<string> {
        if (!uri) return '';
        if (uri.startsWith('http')) return uri;
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `announcements/${announcementId}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (err) {
            console.warn('Upload error', err);
            throw err;
        }
    }

    async function uploadAllImagesAndReturnUrls(uris: string[], announcementId: string) {
        const urls: string[] = [];
        for (let i = 0; i < uris.length; i++) {
            const u = uris[i];
            if (!u) continue;
            if (u.startsWith('http')) { urls.push(u); continue; }
            const url = await uploadImageToStorage(u, announcementId);
            urls.push(url);
        }
        return urls;
    }

    // Using shared delete helper (imported above) instead of local implementation

    // Convert storage paths (gs:// or bucket path) to download URLs when necessary
    async function ensureDownloadUrls(uris: string[]) {
        if (!uris?.length) return [] as string[];
        const converted = await Promise.all(uris.map(async (u) => {
            try {
                if (!u) return u;
                if (u.startsWith('http')) return u;
                // gs://bucket/path or plain storage path 'announcements/...' or '/announcements/...'
                let path = u;
                if (u.startsWith('gs://')) {
                    // gs://bucket/path => path
                    path = u.replace(/^[^/]+:\/\/[\w.-]+\//, '');
                }
                // if someone accidentally saved a download url with /o/encoding
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
            await updateDoc(doc(db, 'announcements', editingId), { images: prevImages });
            if (oldUrl && (oldUrl.startsWith('http://') || oldUrl.startsWith('https://') || oldUrl.startsWith('gs://'))) {
                const deleted = await deleteImageFromStorageByUrl(oldUrl);
                if (!deleted) {
                    console.warn('Failed to delete old announcement image', oldUrl);
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
                await updateDoc(doc(db, 'announcements', editingId), { images: current });
                if (removed && (removed.startsWith('http://') || removed.startsWith('https://') || removed.startsWith('gs://'))) {
                    const deleted = await deleteImageFromStorageByUrl(removed);
                    if (!deleted) {
                        console.warn('Failed to delete removed announcement image', removed);
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

    // helper to show image preview from potentially non-http storage URIs
    async function showImagePreview(list: string[], startIndex = 0) {
        setImageModalVisible(true);
        setImageList([]);
        setActiveImageIndex(startIndex);
        if (!list || !list.length) return;
        const urls = await ensureDownloadUrls(list);
        setImageList(urls);
    }

    // helper: determine announcement status based on startDate/endDate (YYYY-MM-DD)
    function getAnnouncementStatus(a: Announcement): 'upcoming' | 'active' | 'expired' | null {
        if (!a.startDate && !a.endDate) return null;
        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);
        const start = a.startDate ? new Date(a.startDate) : new Date('1970-01-01');
        const end = a.endDate ? new Date(a.endDate) : new Date('9999-12-31');
        if (today < start) return 'upcoming';
        if (today > end) return 'expired';
        return 'active';
    }

    // ADDED: role filter state for list
    const [filterRole, setFilterRole] = useState<string>('All');

    // ADDED: status filter state for list (all / upcoming / active / expired)
    const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'expired'>('all');
    // NEW: control show / collapse filters card (default = closed)
    const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

    // NEW: search query state
    const [searchQuery, setSearchQuery] = useState<string>('');

    // ADDED: compute displayed items based on role, status filter, and search query
    const displayedItems = items
        .filter(i => {
            // search filter (by title or category)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchTitle = (i.title || '').toLowerCase().includes(query);
                const matchCategory = (i.category || '').toLowerCase().includes(query);
                if (!matchTitle && !matchCategory) return false;
            }
            // role filter
            if (filterRole !== 'All' && (i.role || '') !== filterRole) return false;
            // status filter
            if (filterStatus && filterStatus !== 'all') {
                const s = getAnnouncementStatus(i); // 'upcoming'|'active'|'expired'|null
                if (s !== filterStatus) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const rank: Record<string, number> = { active: 0, upcoming: 1, expired: 2, null: 3 };
            const sa = getAnnouncementStatus(a) ?? 'null';
            const sb = getAnnouncementStatus(b) ?? 'null';
            const ra = rank[sa] ?? 3;
            const rb = rank[sb] ?? 3;
            if (ra !== rb) return ra - rb;
            // same status: newest date first (fallback to created date stored in .date)
            const da = a.date || '';
            const db = b.date || '';
            return db.localeCompare(da);
        });

    // Paginated items for display
    const paginatedItems = displayedItems.slice(0, displayedCount);

    // Reset displayed count when items or filters change
    useEffect(() => {
        setDisplayedCount(ANNOUNCEMENTS_PER_PAGE);
    }, [items, filterRole, filterStatus, searchQuery]);

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= displayedItems.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + ANNOUNCEMENTS_PER_PAGE, displayedItems.length));
            setLoadingMore(false);
        }, 400);
    };

    // ADDED: counts for statuses
    const totalAnnouncements = items.length;
    const countByStatus = items.reduce((acc: Record<string, number>, it) => {
        const s = getAnnouncementStatus(it) ?? 'none';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const activeCount = countByStatus['active'] || 0;
    const upcomingCount = countByStatus['upcoming'] || 0;
    const expiredCount = countByStatus['expired'] || 0;

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
                        <Text style={{ fontSize: 32 }}>📢</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('announcements_title', { defaultValue: 'Announcements' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('announcements_subtitle', { defaultValue: 'Create and manage community announcements' })}
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
                        }}>{t('announcements_tab_all', { defaultValue: '📢 All' })}</Text>
                        <Text style={{
                            color: filterStatus === 'all' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{totalAnnouncements}</Text>
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
                        }}>{t('announcements_tab_active', { defaultValue: '🟢 Active' })}</Text>
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
                        }}>{t('announcements_tab_upcoming', { defaultValue: '🟡 Upcoming' })}</Text>
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
                        }}>{t('announcements_tab_expired', { defaultValue: '🔴 Expired' })}</Text>
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('add_announcement_button', { defaultValue: '+ Announcement' })}</Text>
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
                        onPress={() => setFiltersOpen(prev => !prev)}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{t('filters', { defaultValue: '🔍 Filters' })}</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filtersOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filtersOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Status & Role - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('status_label', { defaultValue: 'Status' })}
                                        value={filterStatus}
                                        options={[
                                            { label: t('announcements_tab_all', { defaultValue: '📢 All' }), value: 'all' },
                                            { label: t('announcements_tab_upcoming', { defaultValue: '🟡 Upcoming' }), value: 'upcoming' },
                                            { label: t('announcements_tab_active', { defaultValue: '🟢 Active' }), value: 'active' },
                                            { label: t('announcements_tab_expired', { defaultValue: '🔴 Expired' }), value: 'expired' }
                                        ]}
                                        onValueChange={(v: string) => setFilterStatus(v as 'all' | 'upcoming' | 'active' | 'expired')}
                                        placeholder={t('select_status', { defaultValue: 'Select status' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('role_label', { defaultValue: 'Role' })}
                                        value={filterRole}
                                        options={[
                                            { label: t('all_roles', { defaultValue: 'All Roles' }), value: 'All' },
                                            ...ROLES.filter(r => r !== 'All').map(r => ({ label: r, value: r }))
                                        ]}
                                        onValueChange={(v: string) => setFilterRole(v)}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {loadingAnnouncements ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
                            data={paginatedItems}
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
                            renderItem={({ item }) => {
                                const status = getAnnouncementStatus(item);
                                const statusColors = {
                                    active: { bg: '#ECFDF5', text: '#065F46', border: '#10B981', label: '● ACTIVE' },
                                    upcoming: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', label: '◐ UPCOMING' },
                                    expired: { bg: '#FEF2F2', text: '#7F1D1D', border: '#EF4444', label: '○ EXPIRED' },
                                };
                                const colors = status ? statusColors[status] : { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF', label: '- NONE' };

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
                                            paddingRight: 120,
                                        }}>
                                            {/* Actions - positioned absolute center right */}
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

                                            {/* Role Badge */}
                                            {!!item.role && (
                                                <View style={{
                                                    backgroundColor: '#F3F4F6',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 3,
                                                    borderRadius: 6,
                                                    alignSelf: 'flex-start',
                                                    marginBottom: 8
                                                }}>
                                                    <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600' }}>
                                                        {item.role == 'All' ? 'All Roles' : item.role}
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Icon, Status Badge, dan Category Badge */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
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
                                                {!!item.category && (
                                                    <View style={{
                                                        backgroundColor: '#F3F4F6',
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 5,
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: '#D1D5DB'
                                                    }}>
                                                        <Text style={{ color: '#374151', fontWeight: '600', fontSize: 10 }}>
                                                            🏷️ {item.category}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Title */}
                                            <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 8 }}>
                                                {item.title}
                                            </Text>

                                            {/* Content */}
                                            <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>
                                                {item.content}
                                            </Text>

                                            {/* Date/Time Info */}
                                            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                                                Start: {displayDateYMonD(item.startDate)} {item.startTime}
                                            </Text>
                                            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                                                End: {displayDateYMonD(item.endDate)} {item.endTime}
                                            </Text>
                                            {item.images && item.images.length > 0 && (
                                                <TouchableOpacity onPress={() => showImagePreview(item.images || [], 0)} style={{ marginTop: 6 }}>
                                                    <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{t('image_count_label', { count: item.images.length, defaultValue: `image : ${item.images.length} ()` })}</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_announcements_found', { defaultValue: 'No announcements found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_announcements_match_filters', { defaultValue: 'No announcements match your filters' })}
                                    </Text>
                                </View>
                            )}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => (
                                <LoadMore
                                    loading={loadingMore}
                                    hasMore={displayedCount < displayedItems.length}
                                />
                            )}
                        />
                    </View>
                </View>
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView scrollEnabled={!roleOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? t('edit_announcement', { defaultValue: 'Edit Announcement' }) : t('create_announcement', { defaultValue: 'Create Announcement' })}</Text>

                            {/* Role - SelectInput */}
                            <SelectInput
                                label={t('role_label', { defaultValue: 'Role' })}
                                value={role}
                                options={ROLES.filter(r => r !== 'All').map(r => ({ label: t(`role_${r.toLowerCase()}`, { defaultValue: r }), value: r }))}
                                onValueChange={(v: string) => setRole(v)}
                                placeholder={t('select_role', { defaultValue: 'Select role' })}
                            />

                            {/* Start Date & Time (moved here to appear under Role) */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('start_date_label', { defaultValue: 'Start Date' })}
                                        value={startDate ? displayDateYMonD(startDate) : ''}
                                        onChangeText={() => { }}
                                        placeholder={t('select_date', { defaultValue: 'Select date' })}
                                        editable={false}
                                        onPress={() => setStartDatePickerVisible(true)}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('start_time_label', { defaultValue: 'Start Time' })}
                                        value={startTime}
                                        onChangeText={() => { }}
                                        placeholder={t('select_time', { defaultValue: 'Select time' })}
                                        editable={false}
                                        onPress={() => setStartTimePickerVisible(true)}
                                    />
                                </View>
                            </View>

                            {/* End Date & Time (moved here to appear under Role) */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('end_date_label', { defaultValue: 'End Date' })}
                                        value={endDate ? displayDateYMonD(endDate) : ''}
                                        onChangeText={() => { }}
                                        placeholder={t('select_date', { defaultValue: 'Select date' })}
                                        editable={false}
                                        onPress={() => setEndDatePickerVisible(true)}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FloatingLabelInput
                                        label={t('end_time_label', { defaultValue: 'End Time' })}
                                        value={endTime}
                                        onChangeText={() => { }}
                                        placeholder={t('select_time', { defaultValue: 'Select time' })}
                                        editable={false}
                                        onPress={() => setEndTimePickerVisible(true)}
                                    />
                                </View>
                            </View>

                            {/* Category - FloatingLabelInput */}
                            <FloatingLabelInput
                                label={t('category', { defaultValue: 'Category' })}
                                value={category}
                                onChangeText={setCategory}
                                placeholder={t('category_placeholder', { defaultValue: 'Enter category' })}
                            />

                            {/* Title - FloatingLabelInput */}
                            <FloatingLabelInput
                                label={t('announcement_title_label', { defaultValue: 'Title' })}
                                value={title}
                                onChangeText={setTitle}
                                placeholder={t('announcement_title_placeholder', { defaultValue: 'Enter announcement title' })}
                            />

                            {/* Content - FloatingLabelInput multiline */}
                            <FloatingLabelInput
                                label={t('announcement_content_label', { defaultValue: 'Content' })}
                                value={content}
                                onChangeText={setContent}
                                placeholder={t('announcement_content_placeholder', { defaultValue: 'Enter announcement content' })}
                                multiline
                                inputStyle={{ minHeight: 100, paddingTop: 18 }}
                            />

                            {/* Image Upload & Thumbnails */}
                            <View style={{ marginBottom: 12 }}>
                                <View style={{ position: 'relative' }}>
                                    <FloatingLabelInput
                                        label={t('images_label', { defaultValue: '📸 Images' })}
                                        value={images.length ? t('image_count_label', { count: images.length, defaultValue: `image : ${images.length} (total)` }) : ''}
                                        onPress={pickImages}
                                        editable={false}
                                        placeholder={t('pick_images', { defaultValue: '📷 Pick Images' })}
                                        inputStyle={{ paddingRight: 48 }}
                                    />
                                    {imagesLoading && (
                                        <View style={{ position: 'absolute', right: 12, top: 14 }}>
                                            <ActivityIndicator size="small" color="#3B82F6" />
                                        </View>
                                    )}
                                </View>

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

                            {/* End Date & Time block has been moved above role in the modal */}

                            {/* Buttons */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280', fontWeight: '600' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Start Date Picker */}
            <DateTimePickerModal
                isVisible={startDatePickerVisible}
                mode="date"
                onConfirm={(date: Date) => {
                    setStartDate(formatDate(date));
                    setStartDatePickerVisible(false);
                }}
                onCancel={() => setStartDatePickerVisible(false)}
            />

            {/* Start Time Picker */}
            <DateTimePickerModal
                isVisible={startTimePickerVisible}
                mode="time"
                onConfirm={(date: Date) => {
                    setStartTime(formatTime(date));
                    setStartTimePickerVisible(false);
                }}
                onCancel={() => setStartTimePickerVisible(false)}
            />

            {/* End Date Picker */}
            <DateTimePickerModal
                isVisible={endDatePickerVisible}
                mode="date"
                onConfirm={(date: Date) => {
                    setEndDate(formatDate(date));
                    setEndDatePickerVisible(false);
                }}
                onCancel={() => setEndDatePickerVisible(false)}
            />

            {/* End Time Picker */}
            <DateTimePickerModal
                isVisible={endTimePickerVisible}
                mode="time"
                onConfirm={(date: Date) => {
                    setEndTime(formatTime(date));
                    setEndTimePickerVisible(false);
                }}
                onCancel={() => setEndTimePickerVisible(false)}
            />

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title={t('delete_announcement_title', { defaultValue: 'Delete Announcement' })}
                message={t('delete_announcement_message', { defaultValue: 'Are you sure you want to delete this announcement? This action cannot be undone.' })}
                onConfirm={remove}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setItemToDelete(null);
                }}
            />
            {/* Image preview modal */}
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
        </SafeAreaView>
    );
}
