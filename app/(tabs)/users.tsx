import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { getCurrentUser } from '../../src/services/authService';

type User = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    photo?: string; // NEW: optional photo URL
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

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState(ROLES[0]);
    const [roleOpen, setRoleOpen] = useState(false);
    const [password, setPassword] = useState(''); // NEW: for creating users

    // NEW: Complete profile fields
    const [gender, setGender] = useState('');
    const [birthday, setBirthday] = useState('');
    const [religion, setReligion] = useState('');
    const [address, setAddress] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('single');
    const [spouseName, setSpouseName] = useState('');
    const [children, setChildren] = useState<Array<{ name: string; birthDate: string; placeOfBirth: string }>>([]);

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
                    phone: data.phone || '',
                    role: data.role || 'Member',
                    photo: data.profileImage || data.photo || data.image || '', // NEW: pick available photo field
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
        setRole(ROLES[0]); // Default: Member
        setGender('');
        setBirthday('');
        setReligion('');
        setAddress('');
        setMaritalStatus('single');
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

    // NEW: filtered users based on roleFilter
    const filteredUsers = users
        .filter(u => (roleFilter ? u.role === roleFilter : true))
        .filter(u => {
            const q = (searchQuery || '').trim().toLowerCase();
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        });

    const renderItem = ({ item }: { item: User }) => {
        // Role badge color
        const roleColors = {
            Admin: { bg: '#FEE2E2', text: '#991B1B' },
            Staff: { bg: '#DBEAFE', text: '#1E40AF' },
            Member: { bg: '#E0E7FF', text: '#3730A3' },
        };
        const colors = roleColors[item.role as keyof typeof roleColors] || roleColors.Member;

        return (
            <View className="mx-6 my-3">
                <View
                    style={{
                        position: 'relative', // enable absolute positioning for badge
                        minHeight: 72,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: '#F3F4F6',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    {/* Role badge positioned top-right */}
                    <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}>
                        <TouchableOpacity
                            onPress={() => {
                                // Filter users by role
                                setRoleFilter(roleFilter === item.role ? null : item.role);
                            }}
                            style={{
                                backgroundColor: colors.bg,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: roleFilter === item.role ? 2 : 0,
                                borderColor: colors.text,
                            }}
                        >
                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', marginRight: 4 }}>{item.role}</Text>
                            <Text style={{ color: colors.text, fontSize: 11 }}>▾</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Left: avatar + info */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            {item.photo ? (
                                <Image
                                    source={{ uri: item.photo }}
                                    style={{ width: 48, height: 48, borderRadius: 24 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={{ fontSize: 18 }}>👤</Text>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#111827', fontWeight: '600', marginBottom: 4 }}>{item.name}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.email}</Text>
                            {item.phone ? <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.phone}</Text> : null}
                        </View>
                    </View>

                    {/* Right: actions (Edit/Delete) */}
                    {canManageUsers && (
                        <View style={{ width: 150, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <TouchableOpacity style={{ marginRight: 10 }} onPress={() => openEdit(item)}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => remove(item.id)}>
                                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading users...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>👤</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>User Management</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Manage user accounts, roles, and permissions.
                </Text>
            </View>

            {/* Info/Warning banner */}
            {!canManageUsers && (
                <View className="px-6 mb-2">
                    <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
                        <Text style={{ color: '#991B1B', textAlign: 'center', fontSize: 13 }}>
                            🔒 Only super admin (suryadi.hhb@gmail.com) can manage users
                        </Text>
                    </View>
                </View>
            )}

            {/* User count with breakdown */}
            <View className="px-6 mb-2">
                <View style={{ backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Total Users - leftmost (smaller) */}
                        <TouchableOpacity onPress={() => setRoleFilter(null)} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 28,
                                backgroundColor: roleFilter === null ? '#6366f1' : '#E6EEF8',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: roleFilter === null ? 2 : 0,
                                borderColor: '#4f46e5'
                            }}>
                                <Text style={{ color: roleFilter === null ? '#fff' : '#1f2937', fontWeight: '700', fontSize: 16 }}>{users.length}</Text>
                            </View>
                            <Text style={{ marginTop: 6, color: '#374151', fontWeight: '700', fontSize: 12 }}>Total</Text>
                        </TouchableOpacity>

                        {/* Admin */}
                        <TouchableOpacity onPress={() => setRoleFilter(roleFilter === 'Admin' ? null : 'Admin')} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 28,
                                backgroundColor: roleFilter === 'Admin' ? '#991B1B' : '#FEE2E2',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: roleFilter === 'Admin' ? 2 : 0,
                                borderColor: '#7f1d1d'
                            }}>
                                <Text style={{ color: roleFilter === 'Admin' ? '#fff' : '#991B1B', fontWeight: '700', fontSize: 16 }}>{users.filter(u => u.role === 'Admin').length}</Text>
                            </View>
                            <Text style={{ marginTop: 6, color: '#991B1B', fontWeight: '600', fontSize: 12 }}>Admin</Text>
                        </TouchableOpacity>

                        {/* Staff */}
                        <TouchableOpacity onPress={() => setRoleFilter(roleFilter === 'Staff' ? null : 'Staff')} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 28,
                                backgroundColor: roleFilter === 'Staff' ? '#1E40AF' : '#DBEAFE',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: roleFilter === 'Staff' ? 2 : 0,
                                borderColor: '#1e3a8a'
                            }}>
                                <Text style={{ color: roleFilter === 'Staff' ? '#fff' : '#1E40AF', fontWeight: '700', fontSize: 16 }}>{users.filter(u => u.role === 'Staff').length}</Text>
                            </View>
                            <Text style={{ marginTop: 6, color: '#1E40AF', fontWeight: '600', fontSize: 12 }}>Staff</Text>
                        </TouchableOpacity>

                        {/* Member */}
                        <TouchableOpacity onPress={() => setRoleFilter(roleFilter === 'Member' ? null : 'Member')} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 28,
                                backgroundColor: roleFilter === 'Member' ? '#3730A3' : '#E0E7FF',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: roleFilter === 'Member' ? 2 : 0,
                                borderColor: '#3730a3'
                            }}>
                                <Text style={{ color: roleFilter === 'Member' ? '#fff' : '#3730A3', fontWeight: '700', fontSize: 16 }}>{users.filter(u => u.role === 'Member').length}</Text>
                            </View>
                            <Text style={{ marginTop: 6, color: '#3730A3', fontWeight: '600', fontSize: 12 }}>Member</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* NEW: Add User Button - only for super admin */}
            {canManageUsers && (
                <View className="px-6 mb-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Left: search (nama / email) */}
                    <View style={{ flex: 1 }}>
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search..."
                            style={{
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                borderRadius: 12,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: '#fff',
                            }}
                            returnKeyType="search"
                        />
                    </View>

                    {/* Right: create button */}
                    <View style={{ width: 160 }}>
                        <TouchableOpacity onPress={openAdd}>
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
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ User</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* List */}
            <FlatList
                data={filteredUsers}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                numColumns={1}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12, paddingBottom: bottomInset }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            />

            {/* Modal Form - Create & Edit */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '90%' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text className="text-xl font-semibold mb-4">{editingId ? 'Edit User' : 'Create New User'}</Text>

                            {/* Basic Info */}
                            <Text className="text-sm text-gray-600 mb-1">Name *</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Full name"
                                className="border rounded-lg px-4 py-3 mb-3"
                            />

                            <Text className="text-sm text-gray-600 mb-1">Email *</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="email@example.com"
                                keyboardType="email-address"
                                className="border rounded-lg px-4 py-3 mb-3"
                                autoCapitalize="none"
                                editable={!editingId}
                                style={{ backgroundColor: editingId ? '#F9FAFB' : '#fff' }}
                            />

                            {!editingId && (
                                <>
                                    <Text className="text-sm text-gray-600 mb-1">Password *</Text>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Min. 6 characters"
                                        secureTextEntry
                                        className="border rounded-lg px-4 py-3 mb-3"
                                    />
                                </>
                            )}

                            <Text className="text-sm text-gray-600 mb-1">Phone</Text>
                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="08xxxxxxxxxx"
                                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                                className="border rounded-lg px-4 py-3 mb-3"
                            />

                            <Text className="text-sm text-gray-600 mb-1">Role *</Text>
                            <TouchableOpacity
                                onPress={() => setRoleOpen((v) => !v)}
                                className="border rounded-lg px-4 py-3 mb-3 flex-row justify-between items-center"
                            >
                                <Text>{role}</Text>
                                <Text className="text-gray-400">▾</Text>
                            </TouchableOpacity>
                            {roleOpen && (
                                <View className="bg-gray-50 rounded-lg mb-3">
                                    {ROLES.map((r) => (
                                        <TouchableOpacity
                                            key={r}
                                            onPress={() => {
                                                setRole(r);
                                                setRoleOpen(false);
                                            }}
                                            className="px-4 py-3"
                                        >
                                            <Text className="text-gray-800">{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Gender */}
                            <Text className="text-sm text-gray-600 mb-1">Gender</Text>
                            <TouchableOpacity
                                onPress={() => setGenderOpen((v) => !v)}
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <Text style={{ color: gender ? '#111827' : '#9CA3AF' }}>{gender || 'Select gender'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {genderOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12 }}>
                                    {GENDER_OPTIONS.map((g) => (
                                        <TouchableOpacity
                                            key={g}
                                            onPress={() => { setGender(g); setGenderOpen(false); }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                                        >
                                            <Text style={{ color: '#111827' }}>{g}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Birthday */}
                            <Text className="text-sm text-gray-600 mb-1">Birthday</Text>
                            {Platform.OS === 'web' ? (
                                <TextInput
                                    value={birthday}
                                    onChangeText={setBirthday}
                                    placeholder="YYYY-MM-DD"
                                    className="border rounded-lg px-4 py-3 mb-3"
                                />
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setDatePickerVisible(true)}
                                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12 }}
                                >
                                    <Text style={{ color: birthday ? '#111827' : '#9CA3AF' }}>{birthday || 'Select birthday'}</Text>
                                </TouchableOpacity>
                            )}

                            {/* Religion */}
                            <Text className="text-sm text-gray-600 mb-1">Religion</Text>
                            <TouchableOpacity
                                onPress={() => setReligionOpen((v) => !v)}
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <Text style={{ color: religion ? '#111827' : '#9CA3AF' }}>{religion || 'Select religion'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {religionOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12 }}>
                                    {RELIGION_OPTIONS.map((r) => (
                                        <TouchableOpacity
                                            key={r}
                                            onPress={() => { setReligion(r); setReligionOpen(false); }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                                        >
                                            <Text style={{ color: '#111827' }}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Address */}
                            <Text className="text-sm text-gray-600 mb-1">Address</Text>
                            <TextInput
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Full address"
                                multiline
                                numberOfLines={3}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 8,
                                    padding: 10,
                                    marginBottom: 12,
                                    textAlignVertical: 'top',
                                    minHeight: 80,
                                }}
                            />

                            {/* Marital Status - Select Option (changed from buttons) */}
                            <Text className="text-sm text-gray-600 mb-1">Marital Status</Text>
                            <TouchableOpacity
                                onPress={() => setMaritalStatusOpen((v) => !v)}
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <Text style={{ color: maritalStatus ? '#111827' : '#9CA3AF' }}>
                                    {MARITAL_STATUS_OPTIONS.find(o => o.value === maritalStatus)?.label || 'Select marital status'}
                                </Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {maritalStatusOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12 }}>
                                    {MARITAL_STATUS_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            onPress={() => {
                                                setMaritalStatus(opt.value);
                                                setMaritalStatusOpen(false);
                                                if (opt.value !== 'married') setSpouseName('');
                                            }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                                        >
                                            <Text style={{ color: '#111827' }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Spouse Name */}
                            {maritalStatus === 'married' && (
                                <View style={{ marginBottom: 12 }}>
                                    <Text className="text-sm text-gray-600 mb-1">Spouse Name</Text>
                                    <TextInput
                                        value={spouseName}
                                        onChangeText={setSpouseName}
                                        placeholder="Spouse full name"
                                        className="border rounded-lg px-4 py-3"
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
                                            <Text style={{ color: '#374151', fontSize: 12 }}>Child Name</Text>
                                            <TextInput
                                                value={ch.name}
                                                onChangeText={(v) => updateChild(idx, 'name', v)}
                                                placeholder="Child name"
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 4 }}
                                            />

                                            <Text style={{ color: '#374151', fontSize: 12, marginTop: 8 }}>Birth Date</Text>
                                            {Platform.OS === 'web' ? (
                                                <TextInput
                                                    value={ch.birthDate}
                                                    onChangeText={(v) => updateChild(idx, 'birthDate', v)}
                                                    placeholder="YYYY-MM-DD"
                                                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 4 }}
                                                />
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setEditingChildIndex(idx);
                                                        setChildDatePickerVisible(true);
                                                    }}
                                                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 4 }}
                                                >
                                                    <Text style={{ color: ch.birthDate ? '#111827' : '#9CA3AF' }}>
                                                        {ch.birthDate || 'Select birth date'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}

                                            <Text style={{ color: '#374151', fontSize: 12, marginTop: 8 }}>Place of Birth</Text>
                                            <TextInput
                                                value={ch.placeOfBirth}
                                                onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)}
                                                placeholder="City / Hospital"
                                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 4 }}
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
                onCancel={() => setDatePickerVisible(false)}
            />

            {/* NEW: Date Picker Modal for Child Birth Date */}
            <DateTimePickerModal
                isVisible={childDatePickerVisible}
                mode="date"
                onConfirm={onChildDateConfirm}
                onCancel={() => {
                    setChildDatePickerVisible(false);
                    setEditingChildIndex(null);
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
