import * as FileSystem from 'expo-file-system/legacy'; // use legacy API so writeAsStringAsync is available
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, PermissionsAndroid, Platform, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    const [filterMonth, setFilterMonth] = useState<number | null>(null); // 1..12 or null
    const [filterYear, setFilterYear] = useState<number | null>(null);
    const [monthPickerVisible, setMonthPickerVisible] = useState(false);
    const [yearPickerVisible, setYearPickerVisible] = useState(false);

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
                                showToast('Permission denied. Saved to app storage', 'info');
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
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#6B7280' }}>Loading reports...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderItem = ({ item }: { item: Report }) => {
        const sign = item.type === 'in' ? '+' : '-';
        const color = item.type === 'in' ? '#10B981' : '#EF4444'; // green/red
        return (
            <View className="mx-6 my-3">
                <View
                    style={{
                        minHeight: 72,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: '#F9FAFB',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 18 }}>{item.type === 'in' ? '⬆️' : '⬇️'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            {item.category ? (
                                <>
                                    <Text style={{ color: '#111827', fontWeight: '600' }}>{item.category}</Text>
                                    <Text style={{ color: '#111827', fontWeight: '600', marginTop: 2 }}>{item.date}</Text>
                                </>
                            ) : (
                                <Text style={{ color: '#111827', fontWeight: '600' }}>{item.date}</Text>
                            )}
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>{item.description || '—'}</Text>
                        </View>
                    </View>

                    <View style={{ width: 150, alignItems: 'flex-end' }}>
                        <Text style={{ color, fontWeight: '700' }}>
                            {sign} Rp {Number(item.amount).toLocaleString('id-ID')}
                        </Text>
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                            <TouchableOpacity style={{ marginRight: 14 }} onPress={() => openEdit(item)}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmRemove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
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

            {/* FILTERS: Type + Month + Year */}
            <View className="px-6 mb-3">
                {/* Type segmented */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {(['all', 'in', 'out'] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setFilterType(t)}
                            style={{
                                flex: t === 'all' ? 1.2 : 1,
                                borderRadius: 12,
                                paddingVertical: 8,
                                alignItems: 'center',
                                backgroundColor: filterType === t ? '#6366f1' : '#F3F4F6',
                            }}
                        >
                            <Text style={{ color: filterType === t ? '#fff' : '#374151', fontWeight: '600' }}>
                                {t === 'all' ? 'All' : t === 'in' ? 'In' : 'Out'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Month & Year selectors as one row (2 columns) */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => setMonthPickerVisible(true)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#374151', fontWeight: '600' }}>{filterMonth ? MONTHS[filterMonth] : 'All months'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setYearPickerVisible(true)}
                        style={{
                            width: 140,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#374151', fontWeight: '600' }}>{filterYear ? String(filterYear) : 'All years'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Month Picker Modal */}
                <Modal visible={monthPickerVisible} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Pilih Bulan</Text>
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
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Pilih Tahun</Text>
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
                    <TouchableOpacity activeOpacity={0.85} onPress={openAdd}>
                        <LinearGradient
                            colors={['#6366f1', '#8b5cf6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', elevation: 3 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Report</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <View style={{ width: 140 }}>
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
                    <View className="bg-white rounded-t-3xl p-6">
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
                        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" className="border rounded-lg px-4 py-3 mb-3" />

                        <Text className="text-sm text-gray-600 mb-1">Nominal</Text>
                        <TextInput
                            value={amount}
                            onChangeText={(v) => {
                                // terima input apa saja, ubah ke formatted currency
                                const next = formatCurrency(v);
                                setAmount(next);
                            }}
                            placeholder="Rp 0"
                            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Category</Text>
                        <TextInput
                            value={category}
                            onChangeText={setCategory}
                            placeholder="Category (optional)"
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Description</Text>
                        <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" className="border rounded-lg px-4 py-3 mb-3" />

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
                    </View>
                </View>
            </Modal>

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
