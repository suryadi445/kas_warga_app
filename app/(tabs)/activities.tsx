import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

type Activity = {
    id: string;
    title: string;
    location: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    description: string;
};

export default function ActivitiesScreen() {
    const { showToast } = useToast();
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
                };
            });
            setItems(rows);
            setLoadingActivities(false);
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
            showToast('Permission Denied: Only admin can add activities', 'error');
            return;
        }
        setEditingId(null);
        setTitle('');
        setLocation('');
        // Set date/time empty for new activity
        setDate('');
        setTime('');
        setDescription('');
        setModalVisible(true);
    }

    function openEdit(a: Activity) {
        if (currentUserRole !== 'Admin') {
            showToast('Permission Denied: Only admin can edit activities', 'error');
            return;
        }
        setEditingId(a.id);
        setTitle(a.title);
        setLocation(a.location);
        setDate(a.date);
        // keep existing time or empty if not present (don't force default on edit)
        setTime(a.time || '');
        setDescription(a.description);
        setModalVisible(true);
    }

    async function save() {
        if (!title.trim()) {
            showToast('Title is required', 'error');
            return;
        }
        setOperationLoading(true);
        try {
            if (editingId) {
                const ref = doc(db, 'activities', editingId);
                await updateDoc(ref, { title, location, date, time, description, updatedAt: serverTimestamp() });
                showToast('Activity updated successfully', 'success');
            } else {
                await addDoc(collection(db, 'activities'), { title, location, date, time, description, createdAt: serverTimestamp() });
                showToast('Activity added successfully', 'success');
            }
            setModalVisible(false);
        } catch (e) {
            console.error('activity save error', e);
            showToast('Failed to save activity', 'error');
        } finally {
            setOperationLoading(false);
        }
    }

    function confirmRemove(id: string) {
        if (currentUserRole !== 'Admin') {
            showToast('Permission Denied: Only admin can delete activities', 'error');
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
            await deleteDoc(doc(db, 'activities', itemToDelete));
            showToast('Activity deleted successfully', 'success');
        } catch (e) {
            console.error('delete activity error', e);
            showToast('Failed to delete activity', 'error');
        } finally {
            setOperationLoading(false);
            setItemToDelete(null);
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
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>Activities</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            Manage community activities and events
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
                        }}>📢 All</Text>
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
                        }}>🟢 Active</Text>
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
                        }}>🟡 Upcoming</Text>
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
                        }}>🔴 Expired</Text>
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
                            label="Search"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search..."
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Activity</Text>
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
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>🔍 Filters</Text>
                        <Text style={{ fontSize: 16, color: '#7C3AED' }}>{filterStatusOpen ? '▾' : '▴'}</Text>
                    </TouchableOpacity>

                    {filterStatusOpen && (
                        <View style={{ marginTop: 10 }}>
                            {/* Status & Date - side by side */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
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
                                    <FloatingLabelInput
                                        label="Activity Date"
                                        value={filterDate ? formatDateOnly(filterDate) : ''}
                                        onChangeText={() => { }}
                                        placeholder="All dates"
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

            {loadingActivities ? (
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
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No activities found</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        No activities match your filters
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
                    </View>
                </View>
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{editingId ? 'Edit Activity' : 'Add Activity'}</Text>

                            <FloatingLabelInput
                                label="Activity Name"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Enter activity title"
                            />

                            <FloatingLabelInput
                                label="Location"
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Enter location"
                            />

                            <FloatingLabelInput
                                label="Date"
                                value={date ? formatDateOnly(date) : ''}
                                onChangeText={() => { }}
                                placeholder="Select date"
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
                                label="Time"
                                value={time}
                                onChangeText={() => { }}
                                placeholder="Select time"
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
                                <TouchableOpacity onPress={save} disabled={operationLoading} style={{ padding: 10 }}>
                                    {operationLoading ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Create'}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete Activity"
                message="Are you sure you want to delete this activity? This action cannot be undone."
                onConfirm={remove}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setItemToDelete(null);
                }}
            />
        </SafeAreaView>
    );
}
