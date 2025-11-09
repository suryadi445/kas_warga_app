import { Ionicons } from '@expo/vector-icons';
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
    View,
} from 'react-native';

type User = {
    id: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
};

const ROLES = ['Admin', 'Treasurer', 'Member'];

export default function UsersScreen() {
    const [users, setUsers] = useState<User[]>([
        { id: '1', name: 'Admin Demo', email: 'admin@demo.com', phone: '081234567890', password: '12345678', role: 'Admin' },
    ]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('12345678');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState(ROLES[2]);
    const [roleOpen, setRoleOpen] = useState(false);

    function openAdd() {
        setEditingId(null);
        setName('');
        setEmail('');
        setPhone('');
        setPassword('12345678');
        setRole(ROLES[2]);
        setModalVisible(true);
    }

    function openEdit(u: User) {
        setEditingId(u.id);
        setName(u.name);
        setEmail(u.email);
        setPhone(u.phone);
        setPassword(u.password);
        setRole(u.role);
        setModalVisible(true);
    }

    function save() {
        if (!name.trim() || !email.trim()) {
            Alert.alert('Error', 'Nama dan email wajib diisi');
            return;
        }
        if (editingId) {
            setUsers((prev) => prev.map((p) => (p.id === editingId ? { ...p, name, email, phone, password, role } : p)));
        } else {
            const newUser: User = {
                id: Date.now().toString(),
                name,
                email,
                phone,
                password,
                role,
            };
            setUsers((prev) => [newUser, ...prev]);
        }
        setModalVisible(false);
    }

    function remove(id: string) {
        Alert.alert('Konfirmasi', 'Hapus user ini?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => setUsers((p) => p.filter((i) => i.id !== id)) },
        ]);
    }

    const renderItem = ({ item }: { item: User }) => {
        return (
            <View className="mx-6 my-3">
                {/* improved container: fixed minHeight, row layout, consistent spacing */}
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
                            <Text style={{ color: '#111827', fontWeight: '600' }}>{item.name}</Text>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>{item.email} • {item.phone}</Text>
                        </View>
                    </View>

                    {/* right column: fixed width so buttons align across rows */}
                    <View style={{ width: 150, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Text style={{ color: '#7C3AED', marginRight: 12, fontSize: 13, fontWeight: '600' }}>{item.role}</Text>
                        <TouchableOpacity style={{ marginRight: 10 }} onPress={() => openEdit(item)}>
                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => remove(item.id)}>
                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Hapus</Text>
                        </TouchableOpacity>
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
                <Text className="text-[#4fc3f7] text-2xl font-bold">Users</Text>
                <Text className="text-gray-500 text-sm">Kelola akun pengguna</Text>
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
                        <Text className="text-white font-semibold">+ Tambah User</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={users}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
            />

            {/* Modal Form */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6">
                        <Text className="text-xl font-semibold mb-4">{editingId ? 'Edit User' : 'Tambah User'}</Text>

                        <Text className="text-sm text-gray-600 mb-1">Nama</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Nama lengkap"
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="email@contoh.com"
                            keyboardType="email-address"
                            className="border rounded-lg px-4 py-3 mb-3"
                            autoCapitalize="none"
                        />

                        <Text className="text-sm text-gray-600 mb-1">No HP</Text>
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="08xxxxxxxxxx"
                            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                            className="border rounded-lg px-4 py-3 mb-3"
                        />

                        <Text className="text-sm text-gray-600 mb-1">Password</Text>
                        <View className="relative mb-3">
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Minimal 8 karakter"
                                secureTextEntry={!showPassword}
                                className="border rounded-lg px-4 py-3"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((v) => !v)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: [{ translateY: -12 }] }}
                            >
                                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#4b5563" />
                            </TouchableOpacity>
                        </View>

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
