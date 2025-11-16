import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';

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
};

const ROLES = ['All', 'Admin', 'Staff', 'User'];

export default function AnnouncementsScreen() {
    const { showToast } = useToast();
    const [items, setItems] = useState<Announcement[]>([]);
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

    // Date/Time pickers
    const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
    const [startTimePickerVisible, setStartTimePickerVisible] = useState(false);
    const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);

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
                };
            });
            setItems(rows);
            setLoadingAnnouncements(false);
        }, (err) => {
            console.error('announcements snapshot error', err);
            setLoadingAnnouncements(false);
        });
        return () => unsub();
    }, []);

    function openAdd() {
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
    }

    function openEdit(a: Announcement) {
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
    }

    async function save() {
        if (!category.trim() || !role.trim() || !title.trim() || !content.trim() || !startDate || !startTime || !endDate || !endTime) {
            showToast('Please fill all fields', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'announcements', editingId);
                await updateDoc(ref, { category, role, title, content, startDate, startTime, endDate, endTime, date: new Date().toISOString().split('T')[0] });
                showToast('Announcement updated successfully', 'success');
            } else {
                await addDoc(collection(db, 'announcements'), {
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
                showToast('Announcement added successfully', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('announcement save error', e);
            showToast('Failed to save announcement', 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function remove() {
        if (!itemToDelete) return;

        setDeleteConfirmVisible(false);
        setOperationLoading(true);

        try {
            await deleteDoc(doc(db, 'announcements', itemToDelete));
            showToast('Announcement deleted successfully', 'success');
        } catch (e) {
            console.error('delete announcement error', e);
            showToast('Failed to delete announcement', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
        }
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

    const renderItem = ({ item }: { item: Announcement }) => {
        const status = getAnnouncementStatus(item);
        const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
            upcoming: { bg: '#FEF3C7', text: '#92400E', label: 'Upcoming' },
            active: { bg: '#ECFDF5', text: '#065F46', label: 'Active' },
            expired: { bg: '#FEF2F2', text: '#7F1D1D', label: 'Expired' },
        };

        return (
            <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <View style={{ backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 10 }}>{item.category}</Text>
                                </View>
                                <View style={{ backgroundColor: '#DDD6FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                                    <Text style={{ color: '#4F46E5', fontWeight: '600', fontSize: 10 }}>{item.role}</Text>
                                </View>

                                {/* status badge */}
                                {status ? (
                                    <View style={{ backgroundColor: statusStyles[status].bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                                        <Text style={{ color: statusStyles[status].text, fontWeight: '700', fontSize: 10 }}>
                                            {statusStyles[status].label}
                                        </Text>
                                    </View>
                                ) : null}

                                <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.date}</Text>
                            </View>
                            <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16 }}>{item.title}</Text>
                            <Text numberOfLines={2} style={{ color: '#374151', marginTop: 6 }}>{item.content}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>{item.startDate} {item.startTime} - {item.endDate} {item.endTime}</Text>
                        </View>

                        <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                            <TouchableOpacity disabled={operationLoading} onPress={() => openEdit(item)} style={{ marginBottom: 8 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={operationLoading} onPress={() => confirmRemove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600', opacity: operationLoading ? 0.5 : 1 }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // ADDED: role filter state for list
    const [filterRole, setFilterRole] = useState<string | null>(null);
    const [filterRoleOpen, setFilterRoleOpen] = useState(false);

    // ADDED: status filter state for list (all / upcoming / active / expired)
    const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'expired'>('all');
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);
    const STATUS_OPTIONS = ['all', 'upcoming', 'active', 'expired'] as const;
    const STATUS_LABEL: Record<string, string> = { all: 'All', upcoming: 'Upcoming', active: 'Active', expired: 'Expired' };

    // ADDED: compute displayed items based on role & status filter, then sort by status: active -> upcoming -> expired
    const displayedItems = items
        .filter(i => {
            // role filter
            if (filterRole && filterRole !== 'All' && (i.role || '') !== filterRole) return false;
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
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>📢</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>Announcements</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Create and manage community announcements.
                </Text>
            </View>

            {/* Summary card (matches cash_reports style) */}
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
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Active Announcements</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: activeCount > 0 ? '#065F46' : '#6B7280' }}>
                                {activeCount} active
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Upcoming: {upcomingCount} · Expired: {expiredCount}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{totalAnnouncements} total</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* FILTERS: Status + Role (styled like cash_reports) */}
            <View className="px-6 mb-3">
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                    {/* Status select */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Status</Text>
                        <TouchableOpacity
                            onPress={() => setFilterStatusOpen(!filterStatusOpen)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Text>{STATUS_LABEL[filterStatus]}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                        {filterStatusOpen && (
                            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 30, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <ScrollView style={{ maxHeight: 200 }}>
                                    {STATUS_OPTIONS.map(s => (
                                        <TouchableOpacity key={s} onPress={() => { setFilterStatus(s); setFilterStatusOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                            <Text style={{ color: filterStatus === s ? '#6366f1' : '#111827', fontWeight: filterStatus === s ? '600' : '400' }}>
                                                {STATUS_LABEL[s]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Role select */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>Role</Text>
                        <TouchableOpacity
                            onPress={() => setFilterRoleOpen(!filterRoleOpen)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Text>{filterRole || 'All'}</Text>
                            <Text style={{ color: '#9CA3AF' }}>▾</Text>
                        </TouchableOpacity>
                        {filterRoleOpen && (
                            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#F9FAFB', borderRadius: 8, zIndex: 20, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <ScrollView style={{ maxHeight: 200 }}>
                                    <TouchableOpacity onPress={() => { setFilterRole(null); setFilterRoleOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                        <Text style={{ color: filterRole === null ? '#6366f1' : '#111827', fontWeight: filterRole === null ? '600' : '400' }}>All</Text>
                                    </TouchableOpacity>
                                    {ROLES.map(r => (
                                        <TouchableOpacity key={r} onPress={() => { setFilterRole(r); setFilterRoleOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                            <Text style={{ color: filterRole === r ? '#6366f1' : '#111827', fontWeight: filterRole === r ? '600' : '400' }}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Row 2: create button (aligned right) */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View style={{ width: 160 }}>
                    <TouchableOpacity disabled={operationLoading} onPress={openAdd}>
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
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ Announcement</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {loadingAnnouncements ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#6366f1" />
                </View>
            ) : (
                <FlatList data={displayedItems} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 32 }} />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView scrollEnabled={!roleOpen} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? 'Edit Announcement' : 'Create Announcement'}</Text>

                            {/* Role - Dropdown */}
                            <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Role *</Text>
                            <TouchableOpacity
                                onPress={() => setRoleOpen(!roleOpen)}
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
                            >
                                <Text style={{ color: role ? '#111827' : '#9CA3AF' }}>{role || 'Select role'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {roleOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12, height: 200, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    <ScrollView showsVerticalScrollIndicator={true}>
                                        {ROLES.map((r) => (
                                            <TouchableOpacity
                                                key={r}
                                                onPress={() => {
                                                    setRole(r);
                                                    setRoleOpen(false);
                                                }}
                                                style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
                                            >
                                                <Text style={{ color: role === r ? '#6366f1' : '#111827', fontWeight: role === r ? '600' : '400' }}>{r}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Category - Text Input */}
                            <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Category *</Text>
                            <TextInput
                                value={category}
                                onChangeText={setCategory}
                                placeholder="Enter category"
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12 }}
                            />

                            {/* Title */}
                            <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Title *</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Enter announcement title" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12 }} />

                            {/* Content */}
                            <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Content *</Text>
                            <TextInput value={content} onChangeText={setContent} placeholder="Enter announcement content" multiline numberOfLines={4} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12, textAlignVertical: 'top', minHeight: 100 }} />

                            {/* Start Date & Time */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Start Date *</Text>
                                    <TouchableOpacity
                                        onPress={() => setStartDatePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: startDate ? '#111827' : '#9CA3AF' }}>{startDate || 'YYYY-MM-DD'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Start Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setStartTimePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: startTime ? '#111827' : '#9CA3AF' }}>{startTime || 'HH:MM'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* End Date & Time */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>End Date *</Text>
                                    <TouchableOpacity
                                        onPress={() => setEndDatePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: endDate ? '#111827' : '#9CA3AF' }}>{endDate || 'YYYY-MM-DD'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>End Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setEndTimePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: endTime ? '#111827' : '#9CA3AF' }}>{endTime || 'HH:MM'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Buttons */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => !operationLoading && setModalVisible(false)} disabled={operationLoading} style={{ padding: 10, opacity: operationLoading ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280', fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={operationLoading} onPress={save} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Create'}</Text>}
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
                title="Delete Announcement"
                message="Are you sure you want to delete this announcement? This action cannot be undone."
                onConfirm={remove}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setItemToDelete(null);
                }}
            />
        </SafeAreaView>
    );
}
