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
import ListCardWrapper from '../../src/components/ListCardWrapper';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
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

    // ADDED: role filter state for list
    const [filterRole, setFilterRole] = useState<string>('All');

    // ADDED: status filter state for list (all / upcoming / active / expired)
    const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'active' | 'expired'>('all');
    // NEW: control show / collapse filters card (default = closed)
    const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

    // ADDED: compute displayed items based on role & status filter, then sort by status: active -> upcoming -> expired
    const displayedItems = items
        .filter(i => {
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
    }, [items, filterRole, filterStatus]);

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
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
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
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>Announcements</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6, color: activeCount > 0 ? '#065F46' : '#6B7280' }}>
                                {activeCount} Active
                            </Text>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                                Upcoming: {upcomingCount} · Expired: {expiredCount}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>{totalAnnouncements} Total</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* FILTERS: Card (show / collapse) */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    padding: 12,
                    elevation: 2,
                    overflow: 'hidden',
                }}>
                    <TouchableOpacity
                        onPress={() => setFiltersOpen(prev => !prev)}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Filters</Text>
                        <Text style={{ fontSize: 18, color: '#6B7280' }}>{filtersOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filtersOpen && (
                        <View style={{ marginTop: 12 }}>
                            {/* Status & Role - side by side */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label="Status"
                                        value={filterStatus}
                                        options={[
                                            { label: 'All Status', value: 'all' },
                                            { label: 'Upcoming', value: 'upcoming' },
                                            { label: 'Active', value: 'active' },
                                            { label: 'Expired', value: 'expired' }
                                        ]}
                                        onValueChange={(v: string) => setFilterStatus(v as 'all' | 'upcoming' | 'active' | 'expired')}
                                        placeholder="Select status"
                                        containerStyle={{ marginBottom: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SelectInput
                                        label="Role"
                                        value={filterRole}
                                        options={[
                                            { label: 'All Roles', value: 'All' },
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
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
                    <ListCardWrapper style={{ marginHorizontal: 0 }}>
                        <FlatList
                            data={paginatedItems}
                            keyExtractor={(i) => i.id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 80
                            }}
                            showsVerticalScrollIndicator={false}
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
                                                <Text style={{ fontSize: 20 }}>📢</Text>
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
                                        </View>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No announcements found</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        No announcements match your filters
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
                    </ListCardWrapper>
                </View>
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
                                        <Text style={{ color: startDate ? '#111827' : '#9CA3AF' }}>{startDate ? displayDateYMonD(startDate) : 'Select date'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Start Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setStartTimePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: startTime ? '#111827' : '#9CA3AF' }}>{startTime || 'Select time'}</Text>
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
                                        <Text style={{ color: endDate ? '#111827' : '#9CA3AF' }}>{endDate ? displayDateYMonD(endDate) : 'Select date'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>End Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setEndTimePickerVisible(true)}
                                        style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}
                                    >
                                        <Text style={{ color: endTime ? '#111827' : '#9CA3AF' }}>{endTime || 'Select time'}</Text>
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
