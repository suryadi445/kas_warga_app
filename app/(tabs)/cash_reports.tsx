import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, PermissionsAndroid, Platform, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardItem from '../../src/components/CardItem';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import ListLoadingState from '../../src/components/ListLoadingState';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db, storage } from '../../src/firebaseConfig';
import { deleteImageFromStorageByUrl } from '../../src/utils/storage';
// ADDED: reusable wrapper component import
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

type Report = {
    id: string;
    type: 'in' | 'out';
    date: string; // YYYY-MM-DD
    amount: number;
    category: string;
    description: string;
    images?: string[];
};

const DEFAULT_CATEGORY = 'Umum';
const sampleData: Report[] = [
    { id: 'r1', type: 'in', date: '2024-01-05', amount: 250000, category: 'Iuran', description: 'Iuran bulan Januari' },
    { id: 'r2', type: 'out', date: '2024-01-10', amount: 50000, category: 'Operasional', description: 'Beli ATK' },
];

export default function CashReportsScreen() {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false); // for save/delete ops
    const [exporting, setExporting] = useState(false); // NEW: exporting state
    const [savingSAF, setSavingSAF] = useState(false); // NEW: saving via SAF state (separate spinner for "Share / Save to...")
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    // ADDED: modal & editing state (used by openAdd/openEdit/save)
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // ADDED: filter state and pickers
    const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
    // default to "All" category
    const [filterCategory, setFilterCategory] = useState<string>('All');
    // Use 'all' sentinel so selected label ("All Months"/"All Years") renders like other selects
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>('all');
    // control show / collapse filters card (default = closed)
    const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

    // Pagination state
    const [displayedCount, setDisplayedCount] = useState(5);
    const [loadingMore, setLoadingMore] = useState(false);
    const ITEMS_PER_PAGE = 5;

    // ADDED: months & years helpers
    const MONTHS = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const YEARS = Array.from({ length: 6 }).map((_, i) => currentYear - i); // last 6 years

    // Dynamic footer space so last list item always fully visible
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    const FOOTER_MIN = 120;
    const footerHeight = Math.max(FOOTER_MIN, Math.round(SCREEN_HEIGHT * 0.12));

    // reusable loader
    async function loadReports() {
        setLoadingReports(true);
        try {
            const q = query(collection(db, 'cash_reports'), orderBy('date', 'desc'));
            const snaps = await getDocs(q);
            const rows: Report[] = [];
            snaps.docs.forEach(d => {
                const data = d.data() as any;
                // skip soft-deleted documents
                if (data?.deleted) return;
                rows.push({
                    id: d.id,
                    type: data.type || 'in',
                    date: data.date || defaultDate,
                    amount: Number(data.amount) || 0,
                    category: data.category || '',
                    description: data.description || '',
                    images: Array.isArray(data.images) ? data.images : [],
                });
            });
            setReports(rows);
        } catch (err) {
            console.error('Failed to load reports:', err);
            showToast(t('failed_to_load_cash_reports', { defaultValue: 'Failed to load cash reports' }), 'error');
        } finally {
            setLoadingReports(false);
        }
    }

    // load on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (mounted) await loadReports();
        })();
        return () => { mounted = false; };
    }, []);

    // load current user's role for permission checks
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
        await loadReports();
    });

    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const [type, setType] = useState<'in' | 'out'>('in');
    const [date, setDate] = useState<string>(defaultDate);
    // date picker visibility for native date picker modal
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    // amount sebagai string terformat (mis. "Rp 1.000")
    const [amount, setAmount] = useState<string>('Rp 0');
    // kategori hanya placeholder (opsional)
    const [category, setCategory] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    // images selected for this report (local URIs during selection / remote URLs saved)
    const [images, setImages] = useState<string[]>([]);
    const [imagesLoading, setImagesLoading] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [imageList, setImageList] = useState<string[]>([]);
    const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
    const imageFlatListRef = React.useRef<FlatList>(null);

    useEffect(() => {
        if (imageModalVisible && imageFlatListRef.current) {
            // Guard index
            const idx = Math.max(0, Math.min(activeImageIndex, (imageList.length || 1) - 1));
            try {
                imageFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
            } catch (e) {
                // ignore if index isn't measured yet
            }
        }
    }, [activeImageIndex, imageModalVisible]);

    const CATEGORIES = ['Zakat', 'Infaq', 'Shadaqah', 'Waqf', 'Qurban', 'Fidyah', 'In-Kind Donation', 'Other'];

    // sanitize category string into a stable key used for translation lookup
    const sanitizeCategoryKey = (s: string) => {
        return s.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    };

    // helper: ubah digits menjadi format "Rp X.xxx"
    function formatCurrency(input: string) {
        const digits = input.replace(/\D/g, '');
        if (!digits) return 'Rp 0';
        // hilangkan leading zeros
        const normalized = digits.replace(/^0+/, '') || '0';
        return 'Rp ' + normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // helper: konversi formatted string ke number
    function parseCurrency(formatted: string) {
        const digits = (formatted || '').replace(/\D/g, '');
        return Number(digits) || 0;
    }

    // helper: format number ke "Rp 1.234.567"
    function formatAmount(n: number) {
        const sign = n < 0 ? '-' : '';
        const abs = Math.abs(n);
        return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
    }

    // helper: display date like "11-Nov-2025"
    function formatDateDisplay(dateStr: string) {
        if (!dateStr) return '';
        // handle YYYY-MM-DD
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (isoMatch) {
            const [, y, m, d] = isoMatch;
            const monthName = months[Number(m) - 1] || m;
            return `${Number(d)}-${monthName}-${y}`;
        }
        // try DD-MMM-YYYY (already formatted) or other parsable date
        const fm = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(dateStr);
        if (fm) {
            const [, dd, mAbbr, yyyy] = fm;
            return `${Number(dd)}-${mAbbr}-${yyyy}`;
        }
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) {
            return `${dt.getDate()}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
        }
        return dateStr;
    }

    // hitung total saldo sekarang (in +, out -)
    const totalSaldo = reports.reduce((acc, r) => acc + (r.type === 'in' ? r.amount : -r.amount), 0);

    // ADDED: compute filteredReports and totalFilteredSaldo used by UI
    const filteredReports = reports.filter((r) => {
        // guard if date missing or invalid
        if (!r.date) return false;
        const d = new Date(r.date);
        if (filterType !== 'all' && r.type !== filterType) return false;
        // treat 'All' as no-category filter
        if (filterCategory && filterCategory !== 'All' && r.category !== filterCategory) return false;
        if (filterMonth !== 'all' && (d.getMonth() + 1) !== Number(filterMonth)) return false;
        if (filterYear !== 'all' && d.getFullYear() !== Number(filterYear)) return false;
        return true;
    });

    // ADDED: total of filtered reports (in = +, out = -)
    const totalFilteredSaldo = filteredReports.reduce((acc, r) => acc + (r.type === 'in' ? r.amount : -r.amount), 0);

    // Paginated data for display
    const displayedReports = filteredReports.slice(0, displayedCount);

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= filteredReports.length) return;

        setLoadingMore(true);
        // Simulate loading delay
        setTimeout(() => {
            setDisplayedCount(prev => prev + ITEMS_PER_PAGE);
            setLoadingMore(false);
        }, 300);
    };

    // Reset displayed count when filters change
    useEffect(() => {
        setDisplayedCount(ITEMS_PER_PAGE);
    }, [filterType, filterCategory, filterMonth, filterYear]);

    function openAdd() {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_add', { defaultValue: 'Permission Denied: Only admin can add reports' }), 'error');
            return;
        }
        setEditingId(null);
        setType('in');
        setDate(defaultDate);
        setAmount('Rp 0');
        setCategory('');
        setDescription('');
        setImages([]);
        setModalVisible(true);
    }

    function openEdit(r: Report) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_edit', { defaultValue: 'Permission Denied: Only admin can edit reports' }), 'error');
            return;
        }
        setEditingId(r.id);
        setType(r.type);
        setDate(r.date);
        setAmount(formatCurrency(String(r.amount)));
        setCategory(r.category || '');
        setDescription(r.description);
        setImages(r.images || []);
        setModalVisible(true);
    }

    // --- Image helpers for cash reports ---
    async function pickImages() {
        setImagesLoading(true);
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showToast(t('allow_photos_access_to_upload_documentation'), 'error');
                return;
            }
            // Use new MediaType constant if available; otherwise omit mediaTypes to avoid deprecation warnings
            const MEDIA_IMAGES = (ImagePicker as any)?.MediaType?.Images;
            const res = await ImagePicker.launchImageLibraryAsync({
                ...(MEDIA_IMAGES ? { mediaTypes: MEDIA_IMAGES } : {}),
                allowsMultipleSelection: true,
                quality: 0.8,
            });
            if (!res.canceled && res.assets) {
                const uris = res.assets.map((a: any) => a.uri);
                // add short delay so user can notice spinner on quick selection
                await new Promise((resolve) => setTimeout(resolve, 250));
                setImages(prev => [...prev, ...uris]);
            }
        } catch (e) {
            console.warn('Image picker error', e);
        }
        finally {
            setImagesLoading(false);
        }
    }

    function removeSelectedImage(uri: string) {
        setImages(prev => prev.filter(i => i !== uri));
    }

    async function uploadImageToStorage(uri: string, reportId: string): Promise<string> {
        if (!uri) return '';
        if (uri.startsWith('http')) return uri;
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `cash_reports/${reportId}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (err) {
            console.warn('Upload error', err);
            throw err;
        }
    }

    async function uploadAllImagesAndReturnUrls(uris: string[], reportId: string) {
        const urls: string[] = [];
        for (let i = 0; i < uris.length; i++) {
            const u = uris[i];
            if (!u) continue;
            if (u.startsWith('http')) { urls.push(u); continue; }
            const url = await uploadImageToStorage(u, reportId);
            urls.push(url);
        }
        return urls;
    }

    // Delete image from Firebase Storage given a download URL if possible
    // Use shared helper deleteImageFromStorageByUrl to remove storage objects

    async function handleReplaceImageInEdit(index: number) {
        try {
            if (!editingId) {
                // not yet persisted - just replace in local list
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) { showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error'); return; }
                const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
                if (!res.canceled && res.assets?.[0]?.uri) {
                    const newUri = res.assets[0].uri;
                    setImages(prev => prev.map((u, i) => i === index ? newUri : u));
                }
                return;
            }
            // persisted report: do immediate upload and replace
            setOperationLoading(true);
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error'); setOperationLoading(false); return; }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
            if (res.canceled || !res.assets?.[0]?.uri) { setOperationLoading(false); return; }
            const newLocalUri = res.assets[0].uri;
            // upload the new image
            const uploadedUrl = await uploadImageToStorage(newLocalUri, editingId);
            // replace in state (and in DB): remove old url and set new one
            const prevImages = images.slice();
            const oldUrl = prevImages[index];
            prevImages[index] = uploadedUrl;
            setImages(prevImages);
            // update on firestore
            await updateDoc(doc(db, 'cash_reports', editingId), { images: prevImages });
            // attempt delete old image from storage if remote
            if (oldUrl && (oldUrl.startsWith('http://') || oldUrl.startsWith('https://') || oldUrl.startsWith('gs://'))) {
                const deleted = await deleteImageFromStorageByUrl(oldUrl);
                if (!deleted) {
                    console.warn('Failed to delete old cash report image', oldUrl);
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
                await updateDoc(doc(db, 'cash_reports', editingId), { images: current });
                // attempt to delete from storage
                if (removed && (removed.startsWith('http://') || removed.startsWith('https://') || removed.startsWith('gs://'))) {
                    const deleted = await deleteImageFromStorageByUrl(removed);
                    if (!deleted) console.warn('Failed to delete removed cash report image', removed);
                }
            }
        } catch (err) {
            console.error('Remove image error', err);
            showToast(t('failed_to_remove_image', { defaultValue: 'Failed to remove image' }), 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function save() {
        if (!date.trim() || !amount.trim()) {
            showToast(t('date_amount_required', { defaultValue: 'Date and amount are required' }), 'error');
            return;
        }
        const amt = parseCurrency(amount);
        (async () => {
            setOperationLoading(true);
            try {
                if (editingId) {
                    const ref = doc(db, 'cash_reports', editingId);
                    // upload images first if any
                    let uploadedUrls: string[] = [];
                    if (images?.length) {
                        uploadedUrls = await uploadAllImagesAndReturnUrls(images, editingId);
                    }
                    await updateDoc(ref, { type, date, amount: amt, category, description, images: uploadedUrls });
                    showToast(t('report_updated', { defaultValue: 'Report updated' }), 'success');
                } else {
                    // create a doc first (without images)
                    const docRef = await addDoc(collection(db, 'cash_reports'), { type, date, amount: amt, category, description, createdAt: new Date(), deleted: false });
                    // upload images with new doc id
                    if (images?.length) {
                        const uploadedUrls = await uploadAllImagesAndReturnUrls(images, docRef.id);
                        await updateDoc(doc(db, 'cash_reports', docRef.id), { images: uploadedUrls });
                    }
                    showToast(t('report_added', { defaultValue: 'Report added' }), 'success');
                }
                // reload via shared loader
                await loadReports();
                // make saved entry visible by setting filters to its date (optional)
                try {
                    // try ISO first (YYYY-MM-DD)
                    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
                    if (iso) {
                        // iso[1] = YYYY, iso[2] = MM (maybe "01")
                        setFilterYear(String(Number(iso[1])));
                        setFilterMonth(String(Number(iso[2])));
                    } else {
                        // try formatted "DD-MMM-YYYY" like "11-Nov-2025"
                        const fm = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(date);
                        if (fm) {
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const monthIndex = months.indexOf(fm[2]);
                            setFilterYear(String(Number(fm[3])));
                            setFilterMonth(monthIndex >= 0 ? String(monthIndex + 1) : 'all');
                        }
                    }
                } catch { /* ignore parse errors */ }
                setModalVisible(false);
            } catch (err) {
                console.error('Save error:', err);
                showToast(t('failed_to_save_report', { defaultValue: 'Failed to save report' }), 'error');
            } finally {
                setOperationLoading(false);
            }
        })();
    }

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [imageDeleteConfirmVisible, setImageDeleteConfirmVisible] = useState(false);
    const [imageIndexToDelete, setImageIndexToDelete] = useState<number | null>(null);

    function confirmRemove(id: string) {
        if (currentUserRole !== 'Admin') {
            showToast(t('permission_denied_admin_delete', { defaultValue: 'Permission Denied: Only admin can delete reports' }), 'error');
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
            const ref = doc(db, 'cash_reports', itemToDelete);
            // try to fetch images stored in the doc and delete them from storage (hard delete files)
            let imgs: string[] = [];
            try {
                const snap = await getDoc(ref);
                const data: any = snap.data();
                imgs = Array.isArray(data?.images) ? data.images : [];
                if (imgs.length) {
                    // delete all associated storage objects (best-effort)
                    const settled = await Promise.allSettled(imgs.map((u) => deleteImageFromStorageByUrl(u)));
                    const anyFailed = settled.some(s => s.status === 'rejected' || (s.status === 'fulfilled' && s.value === false));
                    if (anyFailed) showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                }
            } catch (errImgs) {
                console.warn('Failed when deleting images from storage for report:', itemToDelete, errImgs);
            }
            // soft-delete the doc but clear images array
            await updateDoc(ref, { deleted: true, deletedAt: new Date(), images: [] });
            await loadReports();
            if (imgs.length > 0) {
                showToast(t('report_deleted_images_removed', { defaultValue: 'Report deleted and images removed' }), 'success');
            } else {
                showToast(t('report_deleted', { defaultValue: 'Report deleted' }), 'success');
            }
        } catch (err) {
            console.error('Soft-delete error:', err);
            showToast(t('failed_to_delete_report', { defaultValue: 'Failed to delete report' }), 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
    }

    // NEW: CSV helper & export function
    function escapeCsvCell(v: any) {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    // ADD: helper to fetch all reports (including soft-deleted) from Firestore
    async function fetchAllReportsIncludeDeleted(): Promise<any[]> {
        try {
            const q = query(collection(db, 'cash_reports'), orderBy('date', 'desc'));
            const snaps = await getDocs(q);
            return snaps.docs.map(d => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    type: data.type || 'in',
                    date: data.date || defaultDate,
                    amount: Number(data.amount) || 0,
                    category: data.category || '',
                    description: data.description || '',
                    deleted: !!data.deleted,
                    deletedAt: data.deletedAt ? (data.deletedAt.toDate ? data.deletedAt.toDate().toISOString() : String(data.deletedAt)) : '',
                };
            });
        } catch (e) {
            console.warn('fetchAllReportsIncludeDeleted error', e);
            return [];
        }
    }

    // REPLACE exportReports implementation to export ALL records (including soft-deleted)
    async function exportReports() {
        try {
            setExporting(true);

            // fetch all from DB (including deleted) and export ALL (do not apply UI filters)
            const all = await fetchAllReportsIncludeDeleted();
            const rows = all; // export everything

            // headers include deleted info
            const headers = ['id', 'type', 'date', 'amount', 'category', 'description', 'deleted', 'deletedAt'];
            const lines = [headers.join(',')];
            for (const r of rows) {
                const line = [
                    escapeCsvCell(r.id),
                    escapeCsvCell(r.type),
                    escapeCsvCell(r.date),
                    escapeCsvCell(r.amount),
                    escapeCsvCell(r.category),
                    escapeCsvCell(r.description),
                    escapeCsvCell(r.deleted ? '1' : '0'),
                    escapeCsvCell(r.deletedAt || ''),
                ].join(',');
                lines.push(line);
            }
            const csv = lines.join('\n');

            // filename: include 'all' to indicate full export
            const filename = `cash_reports_all.csv`;

            if (Platform.OS === 'web') {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showToast(t('csv_file_downloaded', { defaultValue: 'CSV file downloaded' }), 'success');
            } else {
                // Native: reuse existing logic (try Downloads, SAF fallback, then app storage)
                if (Platform.OS === 'android') {
                    try {
                        const granted = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                            {
                                title: t('storage_permission_title', { defaultValue: 'Storage Permission' }),
                                message: t('storage_permission_message', { defaultValue: 'App needs access to save files to your Downloads folder' }),
                                buttonPositive: t('ok', { defaultValue: 'OK' }),
                                buttonNegative: t('cancel', { defaultValue: 'Cancel' }),
                            }
                        );
                        const fileNameWithPath = '/storage/emulated/0/Download/' + filename;
                        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                            try {
                                await FileSystem.writeAsStringAsync(fileNameWithPath, csv);
                                showToast(t('saved_to_downloads', { defaultValue: 'Saved to Downloads' }), 'success');
                            } catch (errWrite) {
                                console.warn('Direct write to Downloads failed, falling back to SAF:', errWrite);
                                const saved = await saveUsingSAF(csv, filename);
                                if (saved) showToast(t('saved_via_picker', { defaultValue: 'Saved via picker' }), 'success');
                                else {
                                    const fileUri = FileSystem.documentDirectory + filename;
                                    await FileSystem.writeAsStringAsync(fileUri, csv);
                                    showToast(t('saved_to_app_storage', { defaultValue: 'Saved to app storage' }), 'success');
                                }
                            }
                        } else {
                            const saved = await saveUsingSAF(csv, filename);
                            if (saved) showToast(t('saved_via_picker', { defaultValue: 'Saved via picker' }), 'success');
                            else {
                                const fileUri = FileSystem.documentDirectory + filename;
                                await FileSystem.writeAsStringAsync(fileUri, csv);
                                showToast(t('saved_to_app_storage', { defaultValue: 'Saved to app storage' }), 'success');
                            }
                        }
                    } catch (err) {
                        console.warn('Android export unexpected error:', err);
                        const saved = await saveUsingSAF(csv, filename);
                        if (saved) showToast(t('saved_via_picker', { defaultValue: 'Saved via picker' }), 'success');
                        else {
                            const fileUri = FileSystem.documentDirectory + filename;
                            try { await FileSystem.writeAsStringAsync(fileUri, csv); } catch { }
                            showToast(t('saved_to_app_storage', { defaultValue: 'Saved to app storage' }), 'success');
                        }
                    }
                } else {
                    const fileUri = FileSystem.documentDirectory + filename;
                    await FileSystem.writeAsStringAsync(fileUri, csv);
                    showToast(t('saved_to_app_storage', { defaultValue: 'Saved to app storage' }), 'success');
                }
            }
        } catch (err) {
            console.error('Export error:', err);
            showToast(t('failed_to_export_csv', { defaultValue: 'Failed to export CSV' }), 'error');
        } finally {
            setExporting(false);
        }
    }

    // NEW: build CSV from current filteredReports
    function buildCsvFromFilteredReports() {
        const rows = filteredReports;
        const headers = ['id', 'type', 'date', 'amount', 'category', 'description'];
        const lines = [headers.join(',')];
        for (const r of rows) {
            const line = [
                escapeCsvCell(r.id),
                escapeCsvCell(r.type),
                escapeCsvCell(r.date),
                escapeCsvCell(r.amount),
                escapeCsvCell(r.category),
                escapeCsvCell(r.description),
            ].join(',');
            lines.push(line);
        }
        return lines.join('\n');
    }

    // NEW: handler to save via SAF (user chooses folder)
    async function handleSaveToFolder() {
        setSavingSAF(true);
        try {
            // fetch all from DB (including deleted)
            const all = await fetchAllReportsIncludeDeleted();
            const rows = all; // export everything

            const headers = ['id', 'type', 'date', 'amount', 'category', 'description', 'deleted', 'deletedAt'];
            const lines = [headers.join(',')];
            for (const r of rows) {
                const line = [
                    escapeCsvCell(r.id),
                    escapeCsvCell(r.type),
                    escapeCsvCell(r.date),
                    escapeCsvCell(r.amount),
                    escapeCsvCell(r.category),
                    escapeCsvCell(r.description),
                    escapeCsvCell(r.deleted ? '1' : '0'),
                    escapeCsvCell(r.deletedAt || ''),
                ].join(',');
                lines.push(line);
            }
            const csv = lines.join('\n');

            const filename = `cash_reports_all.csv`;

            const savedUri = await saveUsingSAF(csv, filename);
            if (savedUri) {
                showToast(t('file_saved_successfully', { defaultValue: 'File successfully saved!' }), 'success');
                return;
            }
            // fallback to app storage
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, csv);
            showToast(t('unable_save_picker_fallback', { defaultValue: 'Unable to save via picker. File saved to app storage' }), 'success');
        } catch (err) {
            console.error('SAF save error:', err);
            showToast(t('failed_save_via_picker', { defaultValue: 'Failed to save via picker' }), 'error');
        } finally {
            setSavingSAF(false);
        }
    }

    // NEW helper: use Storage Access Framework (SAF) to let user pick a folder and save file there (Android)
    async function saveUsingSAF(content: string, filename: string): Promise<string | null> {
        try {
            // request user to pick a directory
            // note: StorageAccessFramework api available on expo-file-system
            // returns { directoryUri } or throws
            // adapt to environment: some expo versions return { granted, directoryUri }
            // try both shapes defensively
            // @ts-ignore
            const perm: any = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync?.();
            const dirUri = perm?.directoryUri ?? perm?.directoryURI ?? perm;
            if (!dirUri) return null;

            // create file in chosen directory
            // mime type for CSV:
            const mime = 'text/csv';
            // @ts-ignore
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, filename, mime);
            if (!fileUri) return null;

            // write content
            await FileSystem.writeAsStringAsync(fileUri, content);
            return fileUri;
        } catch (e) {
            console.warn('SAF save failed:', e);
            return null;
        }
    }

    // show loader if initial load - REMOVED to allow UI to render
    // if (loadingReports) { ... }


    const renderItem = ({ item }: { item: Report }) => {
        const isIncome = item.type === 'in';

        const actions = currentUserRole === 'Admin' ? [
            {
                label: t('edit', { defaultValue: 'Edit' }),
                onPress: () => openEdit(item),
                bg: '#E0F2FE',
                textColor: '#0369A1',
                disabled: operationLoading,
            },
            {
                label: t('delete', { defaultValue: 'Delete' }),
                onPress: () => confirmRemove(item.id),
                bg: '#FEE2E2',
                textColor: '#991B1B',
                disabled: operationLoading,
            },
        ] : [];

        return (
            <>
                <CardItem
                    icon={isIncome ? '↑' : '↓'}
                    badge={isIncome ? t('income', { defaultValue: 'Income' }).toUpperCase() : t('expense', { defaultValue: 'Expense' }).toUpperCase()}
                    badgeBg={isIncome ? '#D1FAE5' : '#FEE2E2'}
                    badgeTextColor={isIncome ? '#065F46' : '#991B1B'}
                    badgeBorderColor={isIncome ? '#10B981' : '#EF4444'}
                    date={formatDateDisplay(item.date)}
                    title={formatAmount(item.type === 'in' ? item.amount : -item.amount)}
                    titleColor={isIncome ? '#047857' : '#DC2626'}
                    category={item.category}
                    categoryBg="#F3F4F6"
                    categoryColor="#6B7280"
                    description={item.description}
                    meta={item.images && item.images.length ? (
                        <TouchableOpacity onPress={() => { setImageList(item.images || []); setActiveImageIndex(0); setImageModalVisible(true); }}>
                            <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{t('image_count_label', { count: item.images.length, defaultValue: `image : ${item.images.length} (total)` })}</Text>
                        </TouchableOpacity>
                    ) : undefined}
                    borderLeftColor={isIncome ? '#10B981' : '#EF4444'}
                    actions={actions}
                />
                {/* Images indicator is now shown inside CardItem via meta prop */}
            </>
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
                        <Text style={{ fontSize: 32 }}>💰</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('cash_report_title', { defaultValue: 'Cash Report' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('cash_report_subtitle', { defaultValue: 'Manage income, expenses, and cash balance' })}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Saldo Sekarang - Compact Card */}
            <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>{t('current_balance', { defaultValue: 'Current Balance' })}</Text>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: totalFilteredSaldo >= 0 ? '#10B981' : '#DC2626' }}>
                                {formatAmount(totalFilteredSaldo)}
                            </Text>
                        </View>
                        <View style={{
                            backgroundColor: totalFilteredSaldo >= 0 ? '#D1FAE5' : '#FEE2E2',
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: totalFilteredSaldo >= 0 ? '#10B981' : '#EF4444'
                        }}>
                            <Text style={{
                                color: totalFilteredSaldo >= 0 ? '#065F46' : '#991B1B',
                                fontWeight: '700',
                                fontSize: 12
                            }}>{filteredReports.length} {t('transactions', { defaultValue: 'Transactions' })}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Action Buttons - On Purple Gradient */}
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
                    {/* Left: Save button */}
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity
                            onPress={handleSaveToFolder}
                            disabled={savingSAF}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 10,
                                alignItems: 'center',
                                backgroundColor: savingSAF ? '#f0fdf4' : '#FFFFFF',
                                borderWidth: 1.5,
                                borderColor: '#10B981',
                                shadowColor: '#10B981',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.12,
                                shadowRadius: 4,
                                elevation: 2,
                            }}
                        >
                            {savingSAF ? (
                                <ActivityIndicator size="small" color="#10B981" />
                            ) : (
                                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13 }}>💾 {t('save', { defaultValue: 'Save' })}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Right: Add Report button (Admin only) */}
                    {currentUserRole === 'Admin' && (
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity activeOpacity={0.9} onPress={openAdd} style={{ width: '100%' }}>
                                <LinearGradient
                                    colors={['#7c3aed', '#6366f1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        width: '100%',
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        alignItems: 'center',
                                        shadowColor: '#7c3aed',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 4,
                                        elevation: 2,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ {t('report', { defaultValue: 'Report' })}</Text>
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
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>🔍 {t('filters', { defaultValue: 'Filters' })}</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filtersOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filtersOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Type & Category - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('type', { defaultValue: 'Type' })}
                                        value={filterType}
                                        options={[
                                            { label: t('all_type', { defaultValue: 'All Type' }), value: 'all' },
                                            { label: t('in', { defaultValue: 'In' }), value: 'in' },
                                            { label: t('out', { defaultValue: 'Out' }), value: 'out' }
                                        ]}
                                        onValueChange={(v: string) => setFilterType(v as 'all' | 'in' | 'out')}
                                        placeholder={t('select_type', { defaultValue: 'Select type' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('category', { defaultValue: 'Category' })}
                                        value={filterCategory}
                                        options={[
                                            { label: t('all_categories', { defaultValue: 'All Categories' }), value: 'All' },
                                            ...CATEGORIES.map(cat => ({ label: t(`category_${sanitizeCategoryKey(cat)}`, { defaultValue: cat }), value: cat }))
                                        ]}
                                        onValueChange={(v: string) => setFilterCategory(v || '')}
                                        placeholder={t('select_category', { defaultValue: 'Select category' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                            </View>

                            {/* Month & Year */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('month', { defaultValue: 'Month' })}
                                        value={filterMonth}
                                        options={[
                                            { label: t('all_months', { defaultValue: 'All Months' }), value: 'all' },
                                            ...MONTHS.slice(1).map((m, idx) => ({ label: t(`month_${m.toLowerCase()}`, { defaultValue: m }), value: String(idx + 1) }))
                                        ]}
                                        onValueChange={(v: string) => setFilterMonth(v ? v : 'all')}
                                        placeholder={t('all_months', { defaultValue: 'All Months' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label={t('year', { defaultValue: 'Year' })}
                                        value={filterYear}
                                        options={[
                                            { label: t('all_years', { defaultValue: 'All Years' }), value: 'all' },
                                            ...YEARS.map(y => ({ label: String(y), value: String(y) }))
                                        ]}
                                        onValueChange={(v: string) => setFilterYear(v ? v : 'all')}
                                        placeholder={t('all_years', { defaultValue: 'All Years' })}
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* List with modern card design */}
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
                    {loadingReports ? (
                        <ListLoadingState message={t('loading_reports', { defaultValue: 'Loading reports...' })} />
                    ) : (
                        <FlatList
                            data={displayedReports}
                            keyExtractor={(i) => i.id}
                            renderItem={renderItem}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 2,
                                paddingTop: 16,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} tintColor="#7c3aed" />
                            }
                            initialNumToRender={5}
                            maxToRenderPerBatch={5}
                            windowSize={10}
                            removeClippedSubviews={false}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={() => {
                                if (loadingMore) {
                                    return (
                                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                            <ActivityIndicator size="small" color="#7c3aed" />
                                            <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>{t('loading_more', { defaultValue: 'Loading more...' })}</Text>
                                        </View>
                                    );
                                }
                                return <View style={{ height: 20 }} />;
                            }}
                            ListEmptyComponent={() => (
                                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_data_available', { defaultValue: 'No data available' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_cash_transactions', { defaultValue: 'No cash transactions' })}{(filterMonth !== 'all' || filterYear !== 'all' || filterType !== 'all' || filterCategory !== '') ? ` ${t('for_selected_filters', { defaultValue: 'for selected filters' })}` : ''}
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                    {/* Image preview modal */}
                    <Modal visible={imageModalVisible} transparent animationType="fade" onRequestClose={() => setImageModalVisible(false)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                            {/* Close button */}
                            <TouchableOpacity activeOpacity={1} onPress={() => setImageModalVisible(false)} style={{ position: 'absolute', top: 40, right: 20 }}>
                                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
                            </TouchableOpacity>
                            {/* Prev / Next controls */}
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

                            {/* count indicator */}
                            <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 12, marginTop: 18 }}>{imageList.length > 0 ? `${activeImageIndex + 1} / ${imageList.length}` : ''}</Text>

                            {/* The image viewer - horizontally paging list */}
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
                </View>
            </View>

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6" style={{ flex: 1 }}>
                        <ScrollView scrollEnabled={!focusedField} showsVerticalScrollIndicator={false}>
                            <Text className="text-xl font-semibold mb-4">{editingId ? t('edit_report', { defaultValue: 'Edit Report' }) : t('add_report', { defaultValue: 'Add Report' })}</Text>

                            <SelectInput
                                label={t('type', { defaultValue: 'Type' })}
                                value={type}
                                options={[{ label: t('in', { defaultValue: 'In' }), value: 'in' }, { label: t('out', { defaultValue: 'Out' }), value: 'out' }]}
                                onValueChange={(v: string) => setType(v as 'in' | 'out')}
                                placeholder={t('select_type', { defaultValue: 'Select type' })}
                                onFocus={() => setFocusedField('type')}
                                onBlur={() => setFocusedField(null)}
                            />

                            <FloatingLabelInput
                                label={t('date', { defaultValue: 'Date' })}
                                value={formatDateDisplay(date)}
                                onChangeText={setDate}
                                placeholder={t('date_placeholder', { defaultValue: '11-Nov-2025' })}
                                editable={Platform.OS === 'web'}
                                onPress={() => {
                                    if (Platform.OS !== 'web') {
                                        setDatePickerVisible(true);
                                        setFocusedField('date');
                                    }
                                }}
                            />

                            <FloatingLabelInput
                                label={t('nominal', { defaultValue: 'Nominal' })}
                                value={amount}
                                onChangeText={(v) => setAmount(formatCurrency(v))}
                                placeholder={t('rp_0', { defaultValue: 'Rp 0' })}
                                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                            />

                            <SelectInput
                                label={t('category', { defaultValue: 'Category' })}
                                value={category}
                                options={CATEGORIES.map(cat => ({ label: t(`category_${sanitizeCategoryKey(cat)}`, { defaultValue: cat }), value: cat }))}
                                onValueChange={(v: string) => setCategory(v)}
                                placeholder={t('select_category', { defaultValue: 'Select category' })}
                                onFocus={() => setFocusedField('category')}
                                onBlur={() => setFocusedField(null)}
                            />

                            <FloatingLabelInput
                                label={t('description', { defaultValue: 'Description' })}
                                value={description}
                                onChangeText={setDescription}
                                placeholder={t('description_optional', { defaultValue: 'Description (optional)' })}
                                multiline
                                inputStyle={{ marginBottom: 12, minHeight: 100, paddingTop: 18 }}
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
                                                <TouchableOpacity onPress={() => { setImageList(images); setActiveImageIndex(idx); setImageModalVisible(true); }}>
                                                    <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: 8 }} />
                                                </TouchableOpacity>
                                                {/* Replace icon */}
                                                <TouchableOpacity onPress={() => handleReplaceImageInEdit(idx)} style={{ position: 'absolute', top: -6, right: 18, backgroundColor: '#F3F4F6', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: '#111827', fontWeight: '700' }}>✎</Text>
                                                </TouchableOpacity>
                                                {/* Delete icon */}
                                                <TouchableOpacity onPress={() => { setImageIndexToDelete(idx); setImageDeleteConfirmVisible(true); }} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </ScrollView>
                                ) : null}
                            </View>

                            <View className="flex-row justify-between mt-2" style={{ alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? (
                                        <ActivityIndicator size="small" color="#4fc3f7" />
                                    ) : (
                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Date Picker Modal */}
            <DateTimePickerModal
                isVisible={datePickerVisible}
                mode="date"
                onConfirm={(selectedDate: Date) => {
                    const y = selectedDate.getFullYear();
                    const m = `${selectedDate.getMonth() + 1}`.padStart(2, '0');
                    const d = `${selectedDate.getDate()}`.padStart(2, '0');
                    setDate(`${y}-${m}-${d}`);
                    setDatePickerVisible(false);
                }}
                onCancel={() => setDatePickerVisible(false)}
            />

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title={t('delete_report', { defaultValue: 'Delete Report' })}
                message={t('delete_report_message', { defaultValue: 'Delete this cash report? This will mark it as deleted. Continue?' })}
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
                confirmText={t('delete', { defaultValue: 'Delete' })}
                cancelText={t('cancel', { defaultValue: 'Cancel' })}
            />
            <ConfirmDialog
                visible={imageDeleteConfirmVisible}
                title={t('delete_image', { defaultValue: 'Delete Image' })}
                message={t('delete_image_message', { defaultValue: 'Delete this image? This will remove it from the report.' })}
                onConfirm={() => {
                    if (imageIndexToDelete != null) handleRemoveImageInEdit(imageIndexToDelete);
                    setImageIndexToDelete(null);
                    setImageDeleteConfirmVisible(false);
                }}
                onCancel={() => { setImageIndexToDelete(null); setImageDeleteConfirmVisible(false); }}
                confirmText={t('delete', { defaultValue: 'Delete' })}
                cancelText={t('cancel', { defaultValue: 'Cancel' })}
            />
        </SafeAreaView>
    );
}
