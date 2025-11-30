import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser } from '../../src/services/authService';

type User = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    photo?: string; // NEW: optional photo URL
    isActive?: boolean; // NEW: activation status
};

const ROLES = ['Member', 'Staff', 'Admin'];

export default function UsersScreen() {
    const insets = useSafeAreaInsets();
    const bottomInset = insets.bottom || 0;
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [canManageUsers, setCanManageUsers] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // NEW: role filter state (null = show all, 'Admin'/'Staff'/'Member' = show only that role)
    const [roleFilter, setRoleFilter] = useState<string | null>(null);

    // NEW: search query for name/email
    const [searchQuery, setSearchQuery] = useState<string>('');

    // NEW: active status filter ('all' | 'active' | 'inactive')
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // PAGINATION state
    const USERS_PER_PAGE = 5;
    const [displayedCount, setDisplayedCount] = useState<number>(USERS_PER_PAGE);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    // role empty by default so Add modal shows placeholder "Choose role"
    const [role, setRole] = useState<string>('');
    // roleOpen managed inside SelectInput
    const [roleOpen, setRoleOpen] = useState(false);
    const [password, setPassword] = useState(''); // NEW: for creating users

    // NEW: Complete profile fields
    const [gender, setGender] = useState('');
    const [birthday, setBirthday] = useState('');
    const [religion, setReligion] = useState('');
    const [address, setAddress] = useState('');
    // maritalStatus empty by default so Add modal shows placeholder "Choose marital status"
    const [maritalStatus, setMaritalStatus] = useState<string>('');
    const [spouseName, setSpouseName] = useState('');
    const [children, setChildren] = useState<Array<{ name: string; birthDate: string; placeOfBirth: string }>>([]);

    // NEW: focused field for outline focus styling
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // NEW: shared input styles (outline purple style like provided image)
    const INPUT_BASE: any = {
        borderWidth: 2,
        borderColor: '#7c3aed',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    };
    const INPUT_FOCUS: any = {
        borderColor: '#5b21b6',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    };
    const INPUT_MULTILINE: any = { minHeight: 80, textAlignVertical: 'top' };
    // placeholder color consistent with FloatingLabelInput inactive label
    const PLACEHOLDER_COLOR = '#6B7280';

    // NEW: Dropdown states
    const [genderOpen, setGenderOpen] = useState(false);
    const [religionOpen, setReligionOpen] = useState(false);
    const [maritalStatusOpen, setMaritalStatusOpen] = useState(false); // NEW: marital status dropdown
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    // NEW: state for child date picker
    const [childDatePickerVisible, setChildDatePickerVisible] = useState(false);
    const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null);

    // NEW: saving state
    const [saving, setSaving] = useState(false);

    const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
    const RELIGION_OPTIONS = ['Islam', 'Christianity', 'Catholicism', 'Hinduism', 'Buddhism', 'Confucianism', 'Other'];
    const MARITAL_STATUS_OPTIONS = [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
        { value: 'divorced', label: 'Divorced' },
        { value: 'widowed', label: 'Widowed' },
    ];

    // content height used by tab bar (icons + label area)
    const CONTENT_TAB_HEIGHT = Platform.OS === 'ios' ? 64 : 56;
    const totalTabHeight = CONTENT_TAB_HEIGHT + (insets.bottom || (Platform.OS === 'ios' ? 16 : 4));

    useEffect(() => {
        checkPermissions();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadUsers();
        }, [])
    );

    // Reset displayed count when users or filters change
    useEffect(() => {
        setDisplayedCount(USERS_PER_PAGE);
    }, [users, roleFilter, searchQuery]);

    const { refreshing, onRefresh } = useRefresh(loadUsers);

    // Load more handler
    const handleLoadMore = () => {
        if (loadingMore) return;
        if (displayedCount >= filteredUsers.length) return;
        setLoadingMore(true);
        setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + USERS_PER_PAGE, filteredUsers.length));
            setLoadingMore(false);
        }, 400);
    };

    async function checkPermissions() {
        try {
            const currentUser = getCurrentUser();
            if (!currentUser) return;

            // Only suryadi.hhb@gmail.com can manage users
            setCanManageUsers(currentUser.email === 'suryadi.hhb@gmail.com');
        } catch (error) {
            console.error('Failed to check permissions:', error);
        }
    }

    async function loadUsers() {
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'users'));
            const usersList: User[] = [];

            console.log('Total documents in Firestore users collection:', snapshot.size);

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                console.log('User document:', {
                    id: docSnap.id,
                    nama: data.nama,
                    email: data.email,
                    role: data.role
                });

                usersList.push({
                    id: docSnap.id,
                    name: data.nama || data.name || 'No Name',
                    email: data.email || '',
                    // ensure phone is a string (handles numeric values stored previously)
                    phone: data.phone !== undefined && data.phone !== null ? String(data.phone) : '',
                    role: data.role || 'Member',
                    photo: data.profileImage || data.photo || data.image || '', // NEW: pick available photo field
                    isActive: data.isActive, // NEW: include activation status
                });
            });

            console.log('Total users loaded:', usersList.length);
            console.log('Users list:', usersList);

            // Sort: Admin first, then Staff, then Member
            usersList.sort((a, b) => {
                const roleOrder = { Admin: 0, Staff: 1, Member: 2 };
                return (roleOrder[a.role as keyof typeof roleOrder] || 3) - (roleOrder[b.role as keyof typeof roleOrder] || 3);
            });

            setUsers(usersList);
        } catch (error) {
            console.error('Failed to load users:', error);
            showToast('Failed to load users from Firestore', 'error');
        } finally {
            setLoading(false);
        }
    }

    function openEdit(u: User) {
        // Only super admin can edit users
        if (!canManageUsers) {
            showToast('Permission Denied: Only super admin can edit users', 'error');
            return;
        }

        // NEW: Protect master admin account
        if (u.email === 'suryadi.hhb@gmail.com') {
            showToast('This account cannot be edited', 'error');
            return;
        }

        setEditingId(u.id);
        setName(u.name);
        setEmail(u.email);
        setPhone(u.phone);
        setRole(u.role);
        setGenderOpen(false);
        setReligionOpen(false);
        setMaritalStatusOpen(false); // NEW: reset marital status dropdown

        // Load complete profile data from Firestore
        (async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', u.id));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setGender(data.gender || '');
                    setBirthday(data.birthday || '');
                    setReligion(data.religion || '');
                    setAddress(data.address || '');
                    setMaritalStatus(data.maritalStatus || 'single');
                    setSpouseName(data.spouseName || '');
                    setChildren(data.children || []);
                    // ensure phone shown in modal is string
                    setPhone(data.phone !== undefined && data.phone !== null ? String(data.phone) : '');
                }
            } catch (error) {
                console.error('Failed to load user details:', error);
            }
        })();

        setModalVisible(true);
    }

    // NEW: function to open add user modal
    function openAdd() {
        if (!canManageUsers) {
            showToast('Permission Denied: Only super admin can add users', 'error');
            return;
        }

        setEditingId(null);
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setRole(''); // Default: empty => show "Choose role"
        setGender('');
        setBirthday('');
        setReligion('');
        setAddress('');
        setMaritalStatus(''); // Default: empty => show "Choose marital status"
        setSpouseName('');
        setChildren([]);
        setGenderOpen(false);
        setReligionOpen(false);
        setMaritalStatusOpen(false); // NEW: reset marital status dropdown
        setModalVisible(true);
    }

    // NEW: Children management functions
    function addChild() {
        setChildren((c) => [...c, { name: '', birthDate: '', placeOfBirth: '' }]);
    }
    function removeChild(idx: number) {
        setChildren((c) => c.filter((_, i) => i !== idx));
    }
    function updateChild(idx: number, field: 'name' | 'birthDate' | 'placeOfBirth', value: string) {
        setChildren((c) => c.map((ch, i) => (i === idx ? { ...ch, [field]: value } : ch)));
    }

    function onDateConfirm(date: Date) {
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        setBirthday(`${y}-${m}-${d}`);
        setDatePickerVisible(false);
        setFocusedField(null); // clear focus after selection
    }

    // NEW: handler for child date picker
    function onChildDateConfirm(date: Date) {
        if (editingChildIndex !== null) {
            const y = date.getFullYear();
            const m = `${date.getMonth() + 1}`.padStart(2, '0');
            const d = `${date.getDate()}`.padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            updateChild(editingChildIndex, 'birthDate', dateStr);
        }
        setChildDatePickerVisible(false);
        setEditingChildIndex(null);
        setFocusedField(null); // clear focus after selection
    }

    async function save() {
        if (!canManageUsers) {
            showToast('Permission Denied: Only super admin can modify users', 'error');
            return;
        }

        if (!name.trim() || !email.trim()) {
            showToast('Name and email are required', 'error');
            return;
        }

        // NEW: validation for creating user
        if (!editingId && !password.trim()) {
            showToast('Password is required for new users', 'error');
            return;
        }

        if (!editingId && password.trim().length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            setSaving(true); // START loading

            if (editingId) {
                // UPDATE existing user with complete data
                console.log('=== UPDATING USER ===');
                const docRef = doc(db, 'users', editingId);

                await setDoc(docRef, {
                    nama: name.trim(),
                    phone: phone.trim(),
                    role: role,
                    gender: gender,
                    birthday: birthday,
                    religion: religion,
                    address: address,
                    maritalStatus: maritalStatus,
                    spouseName: maritalStatus === 'married' ? spouseName : '',
                    children: (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') ? children : [],
                }, { merge: true });

                const verifyDoc = await getDoc(docRef);
                const verifyData = verifyDoc.data();

                if (verifyData?.role !== role) {
                    throw new Error(`Role update failed! Expected: ${role}, Got: ${verifyData?.role}`);
                }

                showToast('User updated successfully!', 'success');
            } else {
                // NEW: CREATE new user with complete data
                console.log('=== CREATING NEW USER ===');

                const { initializeApp, deleteApp } = await import('firebase/app'); // ADD deleteApp import
                const { getAuth, createUserWithEmailAndPassword, signOut: secondarySignOut } = await import('firebase/auth');
                const { firebaseConfig } = await import('../../src/firebaseConfig');

                // Create secondary app to avoid signing out current user
                const secondaryAppName = `Secondary_${Date.now()}`;
                let secondaryApp;
                let secondaryAuth;

                try {
                    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
                    secondaryAuth = getAuth(secondaryApp);

                    console.log('Secondary app created:', secondaryAppName);

                    // Create user with secondary auth
                    const userCredential = await createUserWithEmailAndPassword(
                        secondaryAuth,
                        email.trim(),
                        password.trim()
                    );
                    const newUser = userCredential.user;

                    console.log('Auth user created:', newUser.uid);

                    // Create Firestore document with complete profile data
                    await setDoc(doc(db, 'users', newUser.uid), {
                        uid: newUser.uid,
                        email: email.trim(),
                        nama: name.trim(),
                        phone: phone.trim(),
                        role: role,
                        gender: gender || '',
                        birthday: birthday || '',
                        religion: religion || '',
                        address: address || '',
                        maritalStatus: maritalStatus || 'single',
                        spouseName: maritalStatus === 'married' ? spouseName : '',
                        children: (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') ? children : [],
                        createdAt: new Date(),
                    });

                    // Sign out from secondary auth
                    await secondarySignOut(secondaryAuth);

                    // Delete secondary app using deleteApp function
                    await deleteApp(secondaryApp);

                    console.log('User created successfully, secondary auth cleaned up');
                    showToast(`User ${name} created successfully!`, 'success');
                } catch (innerError: any) {
                    console.error('Inner error during user creation:', innerError);

                    // Clean up secondary app on error
                    try {
                        if (secondaryAuth) await secondarySignOut(secondaryAuth);
                        if (secondaryApp) await deleteApp(secondaryApp); // Use deleteApp here too
                    } catch (cleanupError) {
                        console.error('Cleanup error:', cleanupError);
                    }

                    throw innerError;
                }
            }

            setModalVisible(false);
            await loadUsers();

        } catch (error: any) {
            console.error('Save error:', error);

            // User-friendly error messages
            let errorMessage = 'Failed to save user';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email already in use. Please use a different email.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Use at least 6 characters.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            showToast(errorMessage, 'error');
        } finally {
            setSaving(false); // STOP loading
        }
    }

    function remove(id: string) {
        if (!canManageUsers) {
            showToast('Permission Denied: Only super admin can delete users', 'error');
            return;
        }

        // NEW: Protect master admin account
        const userToDelete = users.find(u => u.id === id);
        if (userToDelete && userToDelete.email === 'suryadi.hhb@gmail.com') {
            showToast('This account cannot be deleted', 'error');
            return;
        }

        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function removeConfirmed() {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, 'users', itemToDelete));
            showToast('User deleted successfully', 'success');
            await loadUsers();
        } catch (error: any) {
            console.error('Failed to delete user:', error);
            showToast('Failed to delete user: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setDeleteConfirmVisible(false);
            setItemToDelete(null);
        }
    }

    // NEW: Toggle user activation status
    async function toggleUserActivation(userId: string, currentStatus: boolean | undefined) {
        if (!canManageUsers) {
            showToast('Permission Denied: Only admin can activate users', 'error');
            return;
        }

        try {
            // Server-side guard: ensure protected email cannot be toggled even if UI is bypassed
            const targetDoc = await getDoc(doc(db, 'users', userId));
            if (targetDoc.exists()) {
                const targetEmail = targetDoc.data().email;
                if (targetEmail === 'suryadi.hhb@gmail.com') {
                    showToast('This account cannot be deactivated', 'error');
                    return;
                }
            }

            const newStatus = !currentStatus;
            await updateDoc(doc(db, 'users', userId), { isActive: newStatus });
            showToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
            await loadUsers(); // Reload to reflect changes
        } catch (error) {
            console.error('Failed to toggle user activation:', error);
            showToast('Failed to update user status', 'error');
        }
    }

    // NEW: filtered users based on roleFilter and activeFilter
    const filteredUsers = users
        .filter(u => (roleFilter ? u.role === roleFilter : true))
        .filter(u => {
            if (activeFilter === 'active') return u.isActive === true;
            if (activeFilter === 'inactive') return u.isActive !== true;
            return true; // 'all'
        })
        .filter(u => {
            const q = (searchQuery || '').trim().toLowerCase();
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        });

    // Paginated users for display
    const displayedUsers = filteredUsers.slice(0, displayedCount);

    // Helper: mask phone number for privacy (show only for admin)
    function maskPhoneNumber(phone: string): string {
        if (!phone) return '';
        // If phone is less than 4 characters, just return it
        if (phone.length <= 4) return phone;
        // Show first part and mask last 4 digits
        // Example: 08123456789 -> 0812345xxxx
        const visiblePart = phone.slice(0, -4);
        return `${visiblePart}xxxx`;
    }

    const renderItem = ({ item }: { item: User }) => {
        // Role badge color
        const roleColors = {
            Admin: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
            Staff: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
            Member: { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },
        };
        const colors = roleColors[item.role as keyof typeof roleColors] || roleColors.Member;

        // Mask phone number if user is not admin
        const displayPhone = canManageUsers ? item.phone : maskPhoneNumber(item.phone);

        // Activation status indicator
        const activationStatus = item.isActive === true ? 'Active' : 'Inactive';
        const activationColor = item.isActive === true ? '#10B981' : '#EF4444';

        return (
            <View style={{ marginHorizontal: 0, marginVertical: 8 }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    borderLeftWidth: 4,
                    borderLeftColor: item.isActive === true ? colors.border : '#9CA3AF',
                    opacity: item.isActive === true ? 1 : 0.7
                }}>
                    {/* Top row: badge + activation switch (admin only) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{
                            backgroundColor: colors.bg,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: roleFilter === item.role ? 1 : 0,
                            borderColor: roleFilter === item.role ? colors.border : undefined,
                        }}>
                            <Text style={{
                                color: colors.text,
                                fontWeight: '700',
                                fontSize: 11,
                            }}>
                                {item.role}
                            </Text>
                        </View>

                        {/* Activation Switch - Admin Only */}
                        {canManageUsers && (
                            // Disable switch for protected account
                            (() => {
                                const isProtected = item.email === 'suryadi.hhb@gmail.com';
                                return (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: '600',
                                            color: activationColor
                                        }}>
                                            {activationStatus}
                                        </Text>
                                        <Switch
                                            value={item.isActive === true}
                                            onValueChange={() => {
                                                if (isProtected) {
                                                    showToast('This account cannot be deactivated', 'error');
                                                    return;
                                                }
                                                toggleUserActivation(item.id, item.isActive);
                                            }}
                                            trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                                            thumbColor={item.isActive === true ? '#10B981' : '#9CA3AF'}
                                            ios_backgroundColor="#E5E7EB"
                                        />
                                    </View>
                                );
                            })()
                        )}
                    </View>

                    {/* Main content row: icon + title/subtitle + actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                            <Text style={{ fontSize: 24, marginRight: 12 }}>👤</Text>

                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontWeight: '800',
                                    color: '#111827',
                                    fontSize: 18,
                                    marginBottom: 4,
                                    letterSpacing: -0.5,
                                }}>
                                    {item.name}
                                </Text>

                                <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>
                                    {item.email}
                                </Text>

                                {displayPhone && (
                                    <Text numberOfLines={2} style={{ color: '#6B7280', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                                        {displayPhone}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Right: action buttons stacked */}
                        {canManageUsers && (
                            <View style={{ marginLeft: 12, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                                <TouchableOpacity
                                    onPress={() => openEdit(item)}
                                    style={{
                                        backgroundColor: '#E0F2FE',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <Text style={{ color: '#0369A1', fontWeight: '700', fontSize: 11 }}>
                                        Edit
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => remove(item.id)}
                                    style={{
                                        backgroundColor: '#FEE2E2',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 11 }}>
                                        Delete
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    // helper: display date like "11-Nov-2025"
    function formatDateDisplay(dateStr: string) {
        if (!dateStr) return '';
        // handle YYYY-MM-DD
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        if (isoMatch) {
            const [, y, m, d] = isoMatch;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = months[Number(m) - 1] || m;
            return `${Number(d)}-${monthName}-${y}`;
        }
        // try native Date parse fallback
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${dt.getDate()}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
        }
        return dateStr;
    }

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading users...</Text>
            </SafeAreaView>
        );
    }

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
            <View style={{ padding: 16, paddingBottom: 12 }}>
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
                        <Text style={{ fontSize: 32 }}>👤</Text>
                    </View>

                    {/* Text on right */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>User Management</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            Manage user accounts, roles, and permissions
                        </Text>
                    </View>
                </View>
            </View>

            {/* Role Filter Tab Switcher - Modern Glass Design */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 12,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)'
                }}>
                    <TouchableOpacity
                        onPress={() => setRoleFilter(null)}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: roleFilter === null ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: roleFilter === null ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: roleFilter === null ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: roleFilter === null ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 11
                        }}>👥 All</Text>
                        <Text style={{
                            color: roleFilter === null ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{users.length}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setRoleFilter(roleFilter === 'Admin' ? null : 'Admin')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: roleFilter === 'Admin' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: roleFilter === 'Admin' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: roleFilter === 'Admin' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: roleFilter === 'Admin' ? '#DC2626' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 11
                        }}>👑 Admin</Text>
                        <Text style={{
                            color: roleFilter === 'Admin' ? '#DC2626' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{users.filter(u => u.role === 'Admin').length}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setRoleFilter(roleFilter === 'Staff' ? null : 'Staff')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: roleFilter === 'Staff' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: roleFilter === 'Staff' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: roleFilter === 'Staff' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: roleFilter === 'Staff' ? '#2563EB' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 11
                        }}>⚡ Staff</Text>
                        <Text style={{
                            color: roleFilter === 'Staff' ? '#2563EB' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{users.filter(u => u.role === 'Staff').length}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setRoleFilter(roleFilter === 'Member' ? null : 'Member')}
                        style={{
                            flex: 1,
                            paddingVertical: 6,
                            backgroundColor: roleFilter === 'Member' ? '#FFFFFF' : 'transparent',
                            borderRadius: 9,
                            shadowColor: roleFilter === 'Member' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 6,
                            elevation: roleFilter === 'Member' ? 3 : 0,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{
                            color: roleFilter === 'Member' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '700',
                            textAlign: 'center',
                            fontSize: 11
                        }}>🌟 Member</Text>
                        <Text style={{
                            color: roleFilter === 'Member' ? '#7C3AED' : 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '800',
                            fontSize: 14,
                            marginTop: 1
                        }}>{users.filter(u => u.role === 'Member').length}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* NEW: Activation Status Filter */}
            <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 12, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 4 }}>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('all')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: activeFilter === 'all' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: activeFilter === 'all' ? '#FFFFFF' : '#1F2937' }}>All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('active')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: activeFilter === 'active' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: activeFilter === 'active' ? '#FFFFFF' : '#1F2937' }}>✓ Active</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('inactive')}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: activeFilter === 'inactive' ? '#6D28D9' : 'transparent'
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: activeFilter === 'inactive' ? '#FFFFFF' : '#1F2937' }}>⏳ Inactive</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Info/Warning banner */}
            {!canManageUsers && (
                <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                    <View style={{
                        backgroundColor: 'rgba(254, 242, 242, 0.95)',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#FCA5A5',
                        shadowColor: '#DC2626',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2
                    }}>
                        <Text style={{ color: '#991B1B', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                            🔒 Only super admin can manage users
                        </Text>
                    </View>
                </View>
            )}

            {/* NEW: Add User Button - only for super admin */}
            {canManageUsers && (
                <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                    <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 20,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.15,
                        shadowRadius: 20,
                        elevation: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        {/* Left: search (60%) */}
                        <View style={{ flex: 1.5 }}>
                            <FloatingLabelInput
                                label="Search"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search..."
                                containerStyle={{ marginBottom: 0 }}
                            />
                        </View>

                        {/* Right: create button (40%) */}
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={openAdd} activeOpacity={0.9} style={{ width: '100%' }}>
                                <LinearGradient
                                    colors={['#7c3aed', '#6366f1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        width: '100%',
                                        height: 44,
                                        borderRadius: 12,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        shadowColor: '#7c3aed',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                        elevation: 4,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ User</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* List with pagination */}
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
                <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    elevation: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    overflow: 'hidden',
                    flex: 1
                }}>
                    <FlatList
                        data={displayedUsers}
                        keyExtractor={(i) => i.id}
                        renderItem={renderItem}
                        numColumns={1}
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
                        keyboardShouldPersistTaps="handled"
                        // Load more pagination
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.2}
                        ListFooterComponent={() => (
                            <LoadMore
                                loading={loadingMore}
                                hasMore={displayedCount < filteredUsers.length}
                            />
                        )}
                        ListEmptyComponent={() => (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>👤</Text>
                                <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>No users found</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                    No users match your filters
                                </Text>
                            </View>
                        )}
                    />
                </View>
            </View>

            {/* Modal Form - Create & Edit */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '90%' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text className="text-xl font-semibold mb-4">{editingId ? 'Edit User' : 'Create New User'}</Text>

                            {/* Basic Info */}
                            <FloatingLabelInput
                                label="Name *"
                                value={name}
                                onChangeText={setName}
                                placeholder="Full name"
                            />

                            <FloatingLabelInput
                                label="Email *"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                editable={!editingId}
                                inputStyle={editingId ? { backgroundColor: '#F9FAFB' } : undefined}
                                placeholder="email@example.com"
                            />

                            {!editingId && (
                                <FloatingLabelInput
                                    label="Password *"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    placeholder="Min. 6 characters"
                                />
                            )}

                            <FloatingLabelInput
                                label="Phone"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                                placeholder="08xxxxxxxxxx"
                            />

                            <SelectInput
                                label="Role *"
                                value={role}
                                options={ROLES}
                                onValueChange={(v) => setRole(v)}
                                placeholder="Select role"
                                onFocus={() => setFocusedField('role')}
                                onBlur={() => setFocusedField(null)}
                            />

                            <SelectInput
                                label="Gender"
                                value={gender}
                                options={GENDER_OPTIONS}
                                onValueChange={(v) => setGender(v)}
                                placeholder="Select gender"
                                onFocus={() => setFocusedField('gender')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Birthday */}
                            <FloatingLabelInput
                                label="Birthday"
                                value={formatDateDisplay(birthday)}
                                onChangeText={setBirthday}
                                placeholder="dd-mm-yyyy"
                                editable={Platform.OS === 'web'}
                                onPress={() => {
                                    if (Platform.OS !== 'web') {
                                        setDatePickerVisible(true);
                                        setFocusedField('birthday');
                                    }
                                }}
                            />

                            <SelectInput
                                label="Religion"
                                value={religion}
                                options={RELIGION_OPTIONS}
                                onValueChange={(v) => setReligion(v)}
                                placeholder="Select religion"
                                onFocus={() => setFocusedField('religion')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Address */}
                            <FloatingLabelInput
                                label="Address"
                                value={address}
                                onChangeText={setAddress}
                                multiline
                                placeholder="Full address"
                            />

                            <SelectInput
                                label="Marital Status"
                                value={maritalStatus}
                                options={MARITAL_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                                onValueChange={(v) => setMaritalStatus(v)}
                                placeholder="Select marital status"
                                onFocus={() => setFocusedField('maritalStatus')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Spouse Name */}
                            {maritalStatus === 'married' && (
                                <View style={{ marginBottom: 12 }}>
                                    <FloatingLabelInput
                                        label="Spouse Name"
                                        value={spouseName}
                                        onChangeText={setSpouseName}
                                        placeholder="Spouse full name"
                                    />
                                </View>
                            )}

                            {/* Children */}
                            {(maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') && (
                                <View style={{ marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text className="text-sm text-gray-600">Children ({children.length})</Text>
                                        <TouchableOpacity onPress={addChild}>
                                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>+ Add child</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {children.map((ch, idx) => (
                                        <View key={idx} style={{ marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8 }}>
                                            {/* Child Name (label moved into FloatingLabelInput) */}
                                            <FloatingLabelInput
                                                label="Child Name"
                                                value={ch.name}
                                                onChangeText={(v) => updateChild(idx, 'name', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder="Child name"
                                            />

                                            {/* Birth Date (label moved into FloatingLabelInput) */}
                                            <FloatingLabelInput
                                                label="Birth Date"
                                                value={formatDateDisplay(ch.birthDate)}
                                                onChangeText={(v) => updateChild(idx, 'birthDate', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder="dd-mm-yyyy"
                                                editable={Platform.OS === 'web'}
                                                onPress={() => {
                                                    if (Platform.OS !== 'web') {
                                                        setEditingChildIndex(idx);
                                                        setChildDatePickerVisible(true);
                                                    }
                                                }}
                                            />

                                            {/* Place of Birth (label moved into FloatingLabelInput) */}
                                            <FloatingLabelInput
                                                label="Place of Birth"
                                                value={ch.placeOfBirth}
                                                onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder="City / Hospital"
                                            />

                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => removeChild(idx)} style={{ padding: 6 }}>
                                                    <Text style={{ color: '#EF4444', fontWeight: '600' }}>Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View className="flex-row justify-between mt-4">
                                <TouchableOpacity onPress={() => !saving && setModalVisible(false)} disabled={saving} style={{ padding: 10, opacity: saving ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={saving} onPress={save} style={{ padding: 10, minWidth: 100, alignItems: 'center', justifyContent: 'center' }}>
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#4fc3f7" />
                                    ) : (
                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? 'Save' : 'Create'}</Text>
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
                onConfirm={onDateConfirm}
                onCancel={() => { setDatePickerVisible(false); setFocusedField(null); }}
            />

            {/* NEW: Date Picker Modal for Child Birth Date */}
            <DateTimePickerModal
                isVisible={childDatePickerVisible}
                mode="date"
                onConfirm={onChildDateConfirm}
                onCancel={() => {
                    setChildDatePickerVisible(false);
                    setEditingChildIndex(null);
                    setFocusedField(null);
                }}
            />

            {/* Confirm dialogs */}
            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete user"
                message="Delete this user? This action cannot be undone."
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
                confirmText="Delete"
                cancelText="Cancel"
            />
        </SafeAreaView>
    );
}
