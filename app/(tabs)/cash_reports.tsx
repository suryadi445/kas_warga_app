import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, PermissionsAndroid, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

type Report = {
    id: string;
    type: 'in' | 'out';
    date: string; // YYYY-MM-DD
    amount: number;
    category: string;
    description: string;
};

const DEFAULT_CATEGORY = 'Umum';
const sampleData: Report[] = [
    { id: 'r1', type: 'in', date: '2024-01-05', amount: 250000, category: 'Iuran', description: 'Iuran bulan Januari' },
    { id: 'r2', type: 'out', date: '2024-01-10', amount: 50000, category: 'Operasional', description: 'Beli ATK' },
];

export default function CashReportsScreen() {
    const { showToast } = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false); // for save/delete ops
    const [exporting, setExporting] = useState(false); // NEW: exporting state
    const [savingSAF, setSavingSAF] = useState(false); // NEW: saving via SAF state (separate spinner for "Share / Save to...")

    // ADDED: modal & editing state (used by openAdd/openEdit/save)
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // ADDED: filter state and pickers
    const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterMonth, setFilterMonth] = useState<number | null>(null);
    const [filterYear, setFilterYear] = useState<number | null>(null);
    const [monthPickerVisible, setMonthPickerVisible] = useState(false);
    const [yearPickerVisible, setYearPickerVisible] = useState(false);
    const [typePickerVisible, setTypePickerVisible] = useState(false);
    const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

    // ADDED: months & years helpers
    const MONTHS = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const YEARS = Array.from({ length: 6 }).map((_, i) => currentYear - i); // last 6 years

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
                });
            });
            setReports(rows);
        } catch (err) {
            console.error('Failed to load reports:', err);
            showToast('Failed to load cash reports', 'error');
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

    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const [type, setType] = useState<'in' | 'out'>('in');
    const [date, setDate] = useState<string>(defaultDate);
    // amount sebagai string terformat (mis. "Rp 1.000")
    const [amount, setAmount] = useState<string>('Rp 0');
    // kategori hanya placeholder (opsional)
    const [category, setCategory] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    const CATEGORIES = ['Zakat', 'Infaq', 'Shadaqah', 'Waqf', 'Qurban', 'Fidyah', 'In-Kind Donation', 'Other'];

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

    // hitung total saldo sekarang (in +, out -)
    const totalSaldo = reports.reduce((acc, r) => acc + (r.type === 'in' ? r.amount : -r.amount), 0);

    // ADDED: compute filteredReports and totalFilteredSaldo used by UI
    const filteredReports = reports.filter((r) => {
        // guard if date missing or invalid
        if (!r.date) return false;
        const d = new Date(r.date);
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterCategory && r.category !== filterCategory) return false;
        if (filterMonth && (d.getMonth() + 1) !== filterMonth) return false;
        if (filterYear && d.getFullYear() !== filterYear) return false;
        return true;
    });

    // ADDED: total of filtered reports (in = +, out = -)
    const totalFilteredSaldo = filteredReports.reduce((acc, r) => acc + (r.type === 'in' ? r.amount : -r.amount), 0);

    function openAdd() {
        setEditingId(null);
        setType('in');
        setDate(defaultDate);
        setAmount('Rp 0');
        setCategory('');
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(r: Report) {
        setEditingId(r.id);
        setType(r.type);
        setDate(r.date);
        setAmount(formatCurrency(String(r.amount)));
        setCategory(r.category || '');
        setDescription(r.description);
        setModalVisible(true);
    }

    function save() {
        if (!date.trim() || !amount.trim()) {
            showToast('Date and amount are required', 'error');
            return;
        }
        const amt = parseCurrency(amount);
        (async () => {
            setOperationLoading(true);
            try {
                if (editingId) {
                    const ref = doc(db, 'cash_reports', editingId);
                    await updateDoc(ref, { type, date, amount: amt, category, description });
                    showToast('Report updated', 'success');
                } else {
                    // create with deleted flag = false
                    await addDoc(collection(db, 'cash_reports'), { type, date, amount: amt, category, description, createdAt: new Date(), deleted: false });
                    showToast('Report added', 'success');
                }
                // reload via shared loader
                await loadReports();
                // make saved entry visible by setting filters to its date (optional)
                try {
                    const [yStr, mStr] = date.split('-');
                    setFilterYear(Number(yStr));
                    setFilterMonth(Number(mStr));
                } catch { /* ignore parse errors */ }
                setModalVisible(false);
            } catch (err) {
                console.error('Save error:', err);
                showToast('Failed to save report', 'error');
            } finally {
                setOperationLoading(false);
            }
        })();
    }

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    function confirmRemove(id: string) {
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function removeConfirmed() {
        if (!itemToDelete) return;
        setDeleteConfirmVisible(false);
        setOperationLoading(true);
        try {
            const ref = doc(db, 'cash_reports', itemToDelete);
            await updateDoc(ref, { deleted: true, deletedAt: new Date() });
            await loadReports();
            showToast('Report deleted', 'success');
        } catch (err) {
            console.error('Soft-delete error:', err);
            showToast('Failed to delete report', 'error');
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
                showToast('CSV file downloaded', 'success');
            } else {
                // Native: reuse existing logic (try Downloads, SAF fallback, then app storage)
                if (Platform.OS === 'android') {
                    try {
                        const granted = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                            {
                                title: 'Storage Permission',
                                message: 'App needs access to save files to your Downloads folder',
                                buttonPositive: 'OK',
                                buttonNegative: 'Cancel',
                            }
                        );
                        const fileNameWithPath = '/storage/emulated/0/Download/' + filename;
                        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                            try {
                                await FileSystem.writeAsStringAsync(fileNameWithPath, csv);
                                showToast(`Saved to Downloads`, 'success');
                            } catch (errWrite) {
                                console.warn('Direct write to Downloads failed, falling back to SAF:', errWrite);
                                const saved = await saveUsingSAF(csv, filename);
                                if (saved) showToast('Saved via picker', 'success');
                                else {
                                    const fileUri = FileSystem.documentDirectory + filename;
                                    await FileSystem.writeAsStringAsync(fileUri, csv);
                                    showToast('Saved to app storage', 'success');
                                }
                            }
                        } else {
                            const saved = await saveUsingSAF(csv, filename);
                            if (saved) showToast('Saved via picker', 'success');
                            else {
                                const fileUri = FileSystem.documentDirectory + filename;
                                await FileSystem.writeAsStringAsync(fileUri, csv);
                                showToast('Saved to app storage', 'success');
                            }
                        }
                    } catch (err) {
                        console.warn('Android export unexpected error:', err);
                        const saved = await saveUsingSAF(csv, filename);
                        if (saved) showToast('Saved via picker', 'success');
                        else {
                            const fileUri = FileSystem.documentDirectory + filename;
                            try { await FileSystem.writeAsStringAsync(fileUri, csv); } catch { }
                            showToast('Saved to app storage', 'success');
                        }
                    }
                } else {
                    const fileUri = FileSystem.documentDirectory + filename;
                    await FileSystem.writeAsStringAsync(fileUri, csv);
                    showToast('Saved to app storage', 'success');
                }
            }
        } catch (err) {
            console.error('Export error:', err);
            showToast('Failed to export CSV', 'error');
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
                showToast('File successfully saved!', 'success');
                return;
            }
            // fallback to app storage
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, csv);
            showToast('Unable to save via picker. File saved to app storage', 'success');
        } catch (err) {
            console.error('SAF save error:', err);
            showToast('Failed to save via picker', 'error');
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

    // show loader if initial load
    if (loadingReports) {
        return (
            <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#6B7280' }}>Loading reports...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderItem = ({ item }: { item: Report }) => {
        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <View style={{
                                    backgroundColor: item.type === 'in' ? '#ECFDF5' : '#FEF2F2',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    marginRight: 8
                                }}>
                                    <Text style={{
                                        color: item.type === 'in' ? '#065F46' : '#7F1D1D',
                                        fontWeight: '700',
                                        fontSize: 11
                                    }}>
                                        {item.type === 'in' ? 'IN' : 'OUT'}
                                    </Text>
                                </View>
                                <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.date}</Text>
                            </View>

                            <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16 }}>
                                {formatAmount(item.type === 'in' ? item.amount : -item.amount)}
                            </Text>

                            {item.category ? (
                                <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{item.category}</Text>
                            ) : null}

                            {item.description ? (
                                <Text numberOfLines={2} style={{ color: '#374151', marginTop: 4 }}>{item.description}</Text>
                            ) : null}
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
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>💰</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Cash Report</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage income, expenses, and cash balance.
                </Text>
            </View>

            {/* Saldo Sekarang */}
            <View className="px-6 mb-3">
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 14,
                        padding: 14,
                        elevation: 3,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Current Balance</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: totalFilteredSaldo >= 0 ? '#065F46' : '#7F1D1D' }}>
                                {formatAmount(totalFilteredSaldo)}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{filteredReports.length} transactions</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* FILTERS: Type + Category + Month + Year */}
            <View className="px-6 mb-3">
                {/* Type & Category - side by side */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                    {/* Type select dropdown */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Type</Text>
                        <TouchableOpacity
                            onPress={() => setTypePickerVisible(!typePickerVisible)}
                            className="border rounded-lg px-4 py-3 flex-row justify-between items-center"
                        >
                            <Text>{filterType === 'all' ? 'All' : filterType === 'in' ? 'In' : 'Out'}</Text>
                            <Text className="text-gray-400">▾</Text>
                        </TouchableOpacity>
                        {typePickerVisible && (
                            <View className="bg-gray-50 rounded-lg mt-2 absolute top-16 left-0 right-6 z-10">
                                {(['all', 'in', 'out'] as const).map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => {
                                            setFilterType(t);
                                            setTypePickerVisible(false);
                                        }}
                                        className="px-4 py-3"
                                    >
                                        <Text className="text-gray-800">
                                            {t === 'all' ? 'All' : t === 'in' ? 'In' : 'Out'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Category select dropdown */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Category</Text>
                        <TouchableOpacity
                            onPress={() => setCategoryPickerVisible(!categoryPickerVisible)}
                            className="border rounded-lg px-4 py-3 flex-row justify-between items-center"
                        >
                            <Text>{filterCategory ? filterCategory : 'All'}</Text>
                            <Text className="text-gray-400">▾</Text>
                        </TouchableOpacity>
                        {categoryPickerVisible && (
                            <View className="bg-gray-50 rounded-lg mt-2 absolute top-16 right-0 left-6 z-10" style={{ maxHeight: 200 }}>
                                <ScrollView showsVerticalScrollIndicator={true}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setFilterCategory(null);
                                            setCategoryPickerVisible(false);
                                        }}
                                        className="px-4 py-3"
                                    >
                                        <Text className="text-gray-800 font-semibold">All</Text>
                                    </TouchableOpacity>
                                    {CATEGORIES.map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            onPress={() => {
                                                setFilterCategory(cat);
                                                setCategoryPickerVisible(false);
                                            }}
                                            className="px-4 py-3"
                                        >
                                            <Text className="text-gray-800">{cat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>

                {/* Month & Year selectors as one row (2 columns) */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => setMonthPickerVisible(true)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                        }}
                    >
                        <Text style={{ color: '#374151', fontWeight: '500', fontSize: 14 }}>{filterMonth ? MONTHS[filterMonth] : 'All Months'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setYearPickerVisible(true)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                        }}
                    >
                        <Text style={{ color: '#374151', fontWeight: '500', fontSize: 14 }}>{filterYear ? String(filterYear) : 'All Years'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Month Picker Modal */}
                <Modal visible={monthPickerVisible} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Select Month</Text>
                            {MONTHS.map((m, idx) => {
                                const monthValue = idx === 0 ? null : idx;
                                const selected = monthValue === filterMonth || (idx === 0 && filterMonth === null);
                                return (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => {
                                            setFilterMonth(monthValue);
                                            setMonthPickerVisible(false);
                                        }}
                                        style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selected ? '#8b5cf6' : 'transparent', marginBottom: 6 }}
                                    >
                                        <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '700' : '500' }}>{m}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity onPress={() => setMonthPickerVisible(false)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                                <Text style={{ color: '#6B7280' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Year Picker Modal */}
                <Modal visible={yearPickerVisible} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Select Year</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setFilterYear(null);
                                    setYearPickerVisible(false);
                                }}
                                style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 6 }}
                            >
                                <Text style={{ color: filterYear === null ? '#8b5cf6' : '#111827', fontWeight: filterYear === null ? '700' : '500' }}>All</Text>
                            </TouchableOpacity>
                            {YEARS.map((y) => {
                                const selected = filterYear === y;
                                return (
                                    <TouchableOpacity
                                        key={String(y)}
                                        onPress={() => {
                                            setFilterYear(selected ? null : y);
                                            setYearPickerVisible(false);
                                        }}
                                        style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selected ? '#8b5cf6' : 'transparent', marginBottom: 6 }}
                                    >
                                        <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '700' : '500' }}>{y}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity onPress={() => setYearPickerVisible(false)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                                <Text style={{ color: '#6B7280' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>

            {/* Add button */}
            <View className="px-6 mb-2" style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        onPress={handleSaveToFolder}
                        disabled={savingSAF}
                        style={{
                            borderRadius: 999,
                            paddingVertical: 12,
                            alignItems: 'center',
                            backgroundColor: savingSAF ? '#f0fdf4' : '#F3F4F6',
                            borderWidth: 1,
                            borderColor: '#86efac',
                        }}
                    >
                        {savingSAF ? (
                            <ActivityIndicator size="small" color="#16a34a" />
                        ) : (
                            <Text style={{ color: '#16a34a', fontWeight: '700' }}>Save to...</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                    <TouchableOpacity activeOpacity={0.85} onPress={openAdd}>
                        <LinearGradient
                            colors={['#10B981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                paddingVertical: 12,
                                borderRadius: 999,
                                alignItems: 'center',
                                elevation: 3,
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Report</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            <FlatList
                data={filteredReports}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
            />

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6" style={{ flex: 1 }}>
                        <ScrollView scrollEnabled={!categoryOpen} showsVerticalScrollIndicator={false}>
                            <Text className="text-xl font-semibold mb-4">{editingId ? 'Edit Report' : 'Add Report'}</Text>

                            <Text className="text-sm text-gray-600 mb-1">Type</Text>
                            <View className="flex-row mb-3">
                                <TouchableOpacity
                                    onPress={() => setType('in')}
                                    className={`flex-1 rounded-xl px-4 py-3 mr-2 items-center ${type === 'in' ? 'bg-[#ECFDF5]' : 'bg-gray-100'}`}
                                    style={{ borderWidth: type === 'in' ? 1 : 0, borderColor: '#10B981' }}
                                >
                                    <Text className={`font-semibold ${type === 'in' ? 'text-[#065F46]' : 'text-gray-700'}`}>In</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setType('out')}
                                    className={`flex-1 rounded-xl px-4 py-3 items-center ${type === 'out' ? 'bg-[#FEF2F2]' : 'bg-gray-100'}`}
                                    style={{ borderWidth: type === 'out' ? 1 : 0, borderColor: '#DC2626' }}
                                >
                                    <Text className={`font-semibold ${type === 'out' ? 'text-[#7F1D1D]' : 'text-gray-700'}`}>Out</Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-sm text-gray-600 mb-1">Date</Text>
                            <TouchableOpacity
                                onPress={() => setDatePickerVisible(true)}
                                className="border rounded-lg px-4 py-3 mb-3"
                            >
                                <Text style={{ color: date ? '#111827' : '#9CA3AF' }}>{date || 'Select date'}</Text>
                            </TouchableOpacity>

                            <Text className="text-sm text-gray-600 mb-1">Nominal</Text>
                            <TextInput
                                value={amount}
                                onChangeText={(v) => {
                                    const next = formatCurrency(v);
                                    setAmount(next);
                                }}
                                placeholder="Rp 0"
                                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                                className="border rounded-lg px-4 py-3 mb-3"
                            />

                            <Text className="text-sm text-gray-600 mb-1">Category</Text>
                            <TouchableOpacity
                                onPress={() => setCategoryOpen(!categoryOpen)}
                                className="border rounded-lg px-4 py-3 mb-3 flex-row justify-between items-center"
                            >
                                <Text>{category || 'Select category'}</Text>
                                <Text className="text-gray-400">▾</Text>
                            </TouchableOpacity>
                            {categoryOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12, height: 250, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    <ScrollView scrollEnabled={true} showsVerticalScrollIndicator={true}>
                                        {CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => {
                                                    setCategory(cat);
                                                    setCategoryOpen(false);
                                                }}
                                                style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
                                            >
                                                <Text style={{ color: category === cat ? '#6366f1' : '#111827', fontWeight: category === cat ? '600' : '400' }}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <Text className="text-sm text-gray-600 mb-1">Description</Text>
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Description (optional)"
                                multiline={true}
                                numberOfLines={4}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    marginBottom: 12,
                                    textAlignVertical: 'top',
                                    minHeight: 100,
                                }}
                            />

                            <View className="flex-row justify-between mt-2" style={{ alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? (
                                        <ActivityIndicator size="small" color="#4fc3f7" />
                                    ) : (
                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Add'}</Text>
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
                title="Delete Report"
                message="Delete this cash report? This will mark it as deleted. Continue?"
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
                confirmText="Delete"
                cancelText="Cancel"
            />
        </SafeAreaView>
    );
}
