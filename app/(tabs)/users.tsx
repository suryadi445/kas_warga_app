import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    const [users, setUsers] = useState<User[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [canManageUsers, setCanManageUsers] = useState(false);

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
            Alert.alert('Error', 'Failed to load users from Firestore');
        } finally {
            setLoading(false);
        }
    }

    function openEdit(u: User) {
        // Only super admin can edit users
        if (!canManageUsers) {
            Alert.alert('Permission Denied', 'Only super admin (suryadi.hhb@gmail.com) can edit users');
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
            Alert.alert('Permission Denied', 'Only super admin can add users');
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
            Alert.alert('Permission Denied', 'Only super admin can modify users');
            return;
        }

        if (!name.trim() || !email.trim()) {
            Alert.alert('Error', 'Name and email are required');
            return;
        }

        // NEW: validation for creating user
        if (!editingId && !password.trim()) {
            Alert.alert('Error', 'Password is required for new users');
            return;
        }

        if (!editingId && password.trim().length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
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

                Alert.alert('Success', 'User updated successfully!');
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
                    Alert.alert('Success', `User ${name} created successfully!`);
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

            Alert.alert('Error', errorMessage);
        } finally {
            setSaving(false); // STOP loading
        }
    }

    function remove(id: string) {
        if (!canManageUsers) {
            Alert.alert('Permission Denied', 'Only super admin can delete users');
            return;
        }

        Alert.alert('Confirm', 'Delete this user? This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', id));
                        Alert.alert('Success', 'User deleted successfully');
                        loadUsers();
                    } catch (error: any) {
                        console.error('Failed to delete user:', error);
                        Alert.alert('Error', 'Failed to delete user: ' + (error.message || 'Unknown error'));
                    }
                }
            },
        ]);
    }

    // NEW: Function to check and remove duplicates
    async function cleanupDuplicates() {
        if (!canManageUsers) {
            Alert.alert('Permission Denied', 'Only super admin can perform cleanup');
            return;
        }

        Alert.alert(
            'Cleanup Duplicates',
            'This will remove duplicate users based on email. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: async () => {
                        try {
                            const snapshot = await getDocs(collection(db, 'users'));
                            const emailMap = new Map<string, string>(); // email -> first doc id
                            const toDelete: string[] = [];

                            snapshot.forEach((docSnap) => {
                                const data = docSnap.data();
                                const email = data.email;

                                if (emailMap.has(email)) {
                                    // Duplicate found
                                    console.log('Duplicate found:', docSnap.id, email);
                                    toDelete.push(docSnap.id);
                                } else {
                                    emailMap.set(email, docSnap.id);
                                }
                            });

                            if (toDelete.length === 0) {
                                Alert.alert('No Duplicates', 'No duplicate users found');
                                return;
                            }

                            // Delete duplicates
                            for (const id of toDelete) {
                                await deleteDoc(doc(db, 'users', id));
                                console.log('Deleted duplicate:', id);
                            }

                            Alert.alert('Success', `Removed ${toDelete.length} duplicate user(s)`);
                            loadUsers();
                        } catch (error: any) {
                            console.error('Cleanup failed:', error);
                            Alert.alert('Error', 'Failed to cleanup: ' + error.message);
                        }
                    }
                }
            ]
        );
    }

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
                        <View style={{ backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>{item.role}</Text>
                        </View>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
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

            {/* User count */}
            <View className="px-6 mb-2">
                <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: '#374151', textAlign: 'center' }}>
                        Total Users: <Text style={{ fontWeight: '700' }}>{users.length}</Text>
                    </Text>
                    <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 12, marginTop: 4 }}>
                        Check console for detailed user list
                    </Text>
                </View>
            </View>

            {/* NEW: Add User Button - only for super admin */}
            {canManageUsers && (
                <View className="px-6 mb-2">
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
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+ Create New User</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Add cleanup button for super admin */}
            {canManageUsers && (
                <View className="px-6 mb-2">
                    <TouchableOpacity
                        onPress={cleanupDuplicates}
                        style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}
                    >
                        <Text style={{ color: '#92400E', textAlign: 'center', fontWeight: '600' }}>
                            🧹 Cleanup Duplicate Users
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* List */}
            <FlatList
                data={users}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
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
                                <TouchableOpacity onPress={() => setModalVisible(false)} className="px-4 py-3">
                                    <Text className="text-gray-600">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={save}
                                    className="px-4 py-3"
                                    disabled={saving}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        opacity: saving ? 0.5 : 1
                                    }}
                                >
                                    {saving && (
                                        <ActivityIndicator
                                            size="small"
                                            color="#4fc3f7"
                                            style={{ marginRight: 8 }}
                                        />
                                    )}
                                    <Text className="text-[#4fc3f7] font-semibold">
                                        {saving ? 'Saving...' : (editingId ? 'Save' : 'Create')}
                                    </Text>
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
        </SafeAreaView>
    );
}
