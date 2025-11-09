import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

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
    const [reports, setReports] = useState<Report[]>(sampleData);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

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
            Alert.alert('Error', 'Date dan nominal wajib diisi');
            return;
        }
        const amt = parseCurrency(amount);
        if (editingId) {
            setReports((prev) => prev.map((p) => (p.id === editingId ? { ...p, type, date, amount: amt, category, description } : p)));
        } else {
            const newReport: Report = {
                id: Date.now().toString(),
                type,
                date,
                amount: amt,
                category,
                description,
            };
            setReports((prev) => [newReport, ...prev]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Konfirmasi', 'Hapus laporan kas ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => setReports((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    // NEW: filter state
    const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
    const [filterMonth, setFilterMonth] = useState<number | null>(null); // 1-12 or null = all
    const [filterYear, setFilterYear] = useState<number | null>(null); // year or null = all

    // NEW: picker modal visibility
    const [monthPickerVisible, setMonthPickerVisible] = useState(false);
    const [yearPickerVisible, setYearPickerVisible] = useState(false);

    // helper: months and years list
    const MONTHS = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const YEARS = Array.from({ length: 6 }).map((_, i) => currentYear - i); // last 6 years, latest first

    // NEW: filtered reports based on filters
    const filteredReports = reports.filter((r) => {
        const d = new Date(r.date);
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterMonth && d.getMonth() + 1 !== filterMonth) return false;
        if (filterYear && d.getFullYear() !== filterYear) return false;
        return true;
    });

    // update total to reflect filtered results
    const totalFilteredSaldo = filteredReports.reduce((acc, r) => acc + (r.type === 'in' ? r.amount : -r.amount), 0);

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
                            <TouchableOpacity onPress={() => remove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Hapus</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            {/* Header */}
            <View className="px-6 pt-6 pb-4 items-center">
                <View
                    className="w-20 h-20 bg-[#4fc3f7] rounded-full items-center justify-center mb-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <Text className="text-white text-2xl">💰</Text>
                </View>
                <Text className="text-[#4fc3f7] text-2xl font-bold">Cash Reports</Text>
                <Text className="text-gray-500 text-sm">Kelola pemasukan dan pengeluaran</Text>
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
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Saldo Sekarang</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: totalFilteredSaldo >= 0 ? '#065F46' : '#7F1D1D' }}>
                                {formatAmount(totalFilteredSaldo)}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{filteredReports.length} transaksi</Text>
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
            <View className="px-6 mb-2">
                <TouchableOpacity activeOpacity={0.85} onPress={openAdd}>
                    <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="rounded-full py-3 items-center"
                        style={{ elevation: 3 }}
                    >
                        <Text className="text-white font-semibold">+ Tambah Laporan</Text>
                    </LinearGradient>
                </TouchableOpacity>
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
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6">
                        <Text className="text-xl font-semibold mb-4">{editingId ? 'Edit Laporan' : 'Tambah Laporan'}</Text>

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
                            placeholder="Kategori (opsional)"
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Description</Text>
                        <TextInput value={description} onChangeText={setDescription} placeholder="Deskripsi (opsional)" className="border rounded-lg px-4 py-3 mb-3" />

                        <View className="flex-row justify-between mt-2">
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="px-4 py-3">
                                <Text className="text-gray-600">Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={save} className="px-4 py-3">
                                <Text className="text-[#4fc3f7] font-semibold">{editingId ? 'Simpan' : 'Tambah'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
