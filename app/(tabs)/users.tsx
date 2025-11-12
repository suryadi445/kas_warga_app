import { useFocusEffect } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../src/firebaseConfig';
import { getCurrentUser } from '../../src/services/authService';

type User = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
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
        setModalVisible(true);
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

        if (!editingId) {
            Alert.alert('Error', 'Cannot create new users from this screen. Users are created via registration.');
            return;
        }

        try {
            console.log('=== STARTING USER UPDATE (with setDoc) ===');
            console.log('Editing user ID:', editingId);
            console.log('New role:', role);

            const docRef = doc(db, 'users', editingId);

            // Use setDoc with merge instead of updateDoc
            await setDoc(docRef, {
                nama: name.trim(),
                phone: phone.trim(),
                role: role, // explicit role update
            }, { merge: true });

            console.log('setDoc with merge completed');

            // Verify
            const verifyDoc = await getDoc(docRef);
            const verifyData = verifyDoc.data();
            console.log('Verified role:', verifyData?.role);

            if (verifyData?.role !== role) {
                throw new Error(`Role update failed! Expected: ${role}, Got: ${verifyData?.role}`);
            }

            setModalVisible(false);
            await loadUsers();

            Alert.alert('Success', `User role updated to ${role} successfully!`);
        } catch (error: any) {
            console.error('Update error:', error);
            Alert.alert('Error', error.message || 'Failed to update user');
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
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 18 }}>👤</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ color: '#111827', fontWeight: '600', marginRight: 8 }}>{item.name}</Text>
                                <View style={{ backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>{item.role}</Text>
                                </View>
                            </View>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.email}</Text>
                            {item.phone ? <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.phone}</Text> : null}
                        </View>
                    </View>

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

            {/* Modal Form - Edit only */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6">
                        <Text className="text-xl font-semibold mb-4">Edit User</Text>

                        <Text className="text-sm text-gray-600 mb-1">Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Full name"
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            className="border rounded-lg px-4 py-3 mb-3"
                            autoCapitalize="none"
                            editable={false}
                            style={{ backgroundColor: '#F9FAFB' }}
                        />

                        <Text className="text-sm text-gray-600 mb-1">Phone</Text>
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="08xxxxxxxxxx"
                            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Role</Text>
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

                        <View className="flex-row justify-between mt-2">
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="px-4 py-3">
                                <Text className="text-gray-600">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={save} className="px-4 py-3">
                                <Text className="text-[#4fc3f7] font-semibold">Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
