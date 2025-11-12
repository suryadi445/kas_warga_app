import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../src/firebaseConfig';
import { getCurrentUser } from '../../src/services/authService';

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uid, setUid] = useState<string | null>(null);

    // profile fields
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [gender, setGender] = useState('');
    const [birthday, setBirthday] = useState('');
    const [religion, setReligion] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('single');
    const [spouseName, setSpouseName] = useState('');
    const [children, setChildren] = useState<Array<{ name: string; birthDate: string; placeOfBirth: string }>>([]);

    // date picker modal: context can be 'birthday' or { type: 'child', index: number }
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [datePickerContext, setDatePickerContext] = useState<{ kind: 'birthday' } | { kind: 'child'; index: number } | null>(null);

    useEffect(() => {
        loadUserProfile();
    }, []);

    // Reload profile setiap kali tab difocus
    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
        }, [])
    );

    async function loadUserProfile() {
        try {
            setLoading(true);
            const currentUser = getCurrentUser();

            if (!currentUser) {
                Alert.alert('Error', 'User tidak login', [
                    { text: 'Login', onPress: () => router.replace('/login') }
                ]);
                return;
            }

            setUid(currentUser.uid);
            setEmail(currentUser.email || '');

            // Load data dari Firestore with retry
            let retries = 3;
            let lastError = null;

            for (let i = 0; i < retries; i++) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setName(data.nama || '');
                        setRole(data.role || 'Member');
                        setPhone(data.phone || '');
                        setGender(data.gender || '');
                        setBirthday(data.birthday || '');
                        setReligion(data.religion || '');
                        setMaritalStatus(data.maritalStatus || 'single');
                        setSpouseName(data.spouseName || '');
                        setChildren(data.children || []);
                    }

                    return; // Success
                } catch (err: any) {
                    lastError = err;
                    console.warn(`Load profile attempt ${i + 1} failed:`, err.message);

                    // Check if it's a "database not created" error
                    if (err.message?.includes('unavailable') || err.message?.includes('not found')) {
                        throw new Error('Firestore database belum dibuat di Firebase Console. Buat database terlebih dahulu.');
                    }

                    if (i < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
                    }
                }
            }

            throw lastError;

        } catch (error: any) {
            console.error('Load profile error:', error);

            const message = error.message?.includes('database belum dibuat')
                ? error.message
                : 'Gagal memuat profil. Pastikan:\n1. Firestore database sudah dibuat\n2. Koneksi internet aktif\n3. Rules Firestore sudah diset';

            Alert.alert('Error', message, [
                { text: 'Retry', onPress: () => loadUserProfile() },
                { text: 'Cancel', style: 'cancel' }
            ]);
        } finally {
            setLoading(false);
        }
    }

    function addChild() {
        setChildren((c) => [...c, { name: '', birthDate: '', placeOfBirth: '' }]);
    }
    function removeChild(idx: number) {
        setChildren((c) => c.filter((_, i) => i !== idx));
    }
    function updateChild(idx: number, field: 'name' | 'birthDate' | 'placeOfBirth', value: string) {
        setChildren((c) => c.map((ch, i) => (i === idx ? { ...ch, [field]: value } : ch)));
    }

    // open date picker for profile birthday or a child
    function openDatePickerForBirthday() {
        setDatePickerContext({ kind: 'birthday' });
        setDatePickerVisible(true);
    }
    function openDatePickerForChild(index: number) {
        setDatePickerContext({ kind: 'child', index });
        setDatePickerVisible(true);
    }
    function onDateConfirm(date: Date) {
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        const val = `${y}-${m}-${d}`;
        if (datePickerContext?.kind === 'birthday') {
            setBirthday(val);
        } else if (datePickerContext?.kind === 'child') {
            updateChild(datePickerContext.index, 'birthDate', val);
        }
        setDatePickerVisible(false);
        setDatePickerContext(null);
    }
    function onDateCancel() {
        setDatePickerVisible(false);
        setDatePickerContext(null);
    }

    async function handleSave() {
        if (!name.trim()) {
            Alert.alert('Validation', 'Nama wajib diisi');
            return;
        }

        if (!uid) {
            Alert.alert('Error', 'User ID tidak ditemukan');
            return;
        }

        try {
            setSaving(true);

            // Update ke Firestore
            await updateDoc(doc(db, 'users', uid), {
                nama: name,
                phone,
                gender,
                birthday,
                religion,
                maritalStatus,
                spouseName: maritalStatus === 'married' ? spouseName : '',
                children: (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') ? children : [],
            });

            Alert.alert('Sukses', 'Profil berhasil diperbarui');
            router.back();
        } catch (error: any) {
            console.error('Save profile error:', error);
            Alert.alert('Error', 'Gagal menyimpan: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading profile...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>👤</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>User Profile</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Edit and save your profile data.
                </Text>
            </View>

            <ScrollView style={{ padding: 16 }}>
                <Text style={{ color: '#374151' }}>Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Role</Text>
                <TextInput value={role} onChangeText={setRole} placeholder="Role" editable={false} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: '#F9FAFB' }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Gender</Text>
                <TextInput value={gender} onChangeText={setGender} placeholder="Male / Female / Other" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Birthday</Text>
                {Platform.OS === 'web' ? (
                    <TextInput value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />
                ) : (
                    <TouchableOpacity onPress={openDatePickerForBirthday} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8 }}>
                        <Text style={{ color: '#111827' }}>{birthday || 'Select birthday'}</Text>
                    </TouchableOpacity>
                )}

                <Text style={{ color: '#374151', marginTop: 12 }}>Email</Text>
                <TextInput value={email} editable={false} placeholder="email@example.com" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: '#F9FAFB' }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Religion</Text>
                <TextInput value={religion} onChangeText={setReligion} placeholder="Religion" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Phone</Text>
                <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Marital Status</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    {['single', 'married', 'divorced', 'widowed'].map((s, i) => {
                        const selected = maritalStatus === s;
                        return (
                            <TouchableOpacity
                                key={s}
                                onPress={() => {
                                    setMaritalStatus(s);
                                    if (s !== 'married') setSpouseName('');
                                }}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: selected ? '#6366f1' : '#F3F4F6',
                                    marginRight: i === 3 ? 0 : 8,
                                }}
                            >
                                <Text style={{ color: selected ? '#fff' : '#111827', fontWeight: selected ? '700' : '600' }}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* spouse name when married */}
                {maritalStatus === 'married' && (
                    <View style={{ marginTop: 12 }}>
                        <Text style={{ color: '#374151' }}>Spouse Name</Text>
                        <TextInput value={spouseName} onChangeText={setSpouseName} placeholder="Spouse full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />
                    </View>
                )}

                {/* children: show only when married/divorced/widowed */}
                {(maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') && (
                    <View style={{ marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: '#374151', fontWeight: '600' }}>Children ({children.length})</Text>
                            <TouchableOpacity onPress={addChild}>
                                <Text style={{ color: '#06B6D4', fontWeight: '600' }}>+ Add child</Text>
                            </TouchableOpacity>
                        </View>
                        {children.map((ch, idx) => (
                            <View key={idx} style={{ marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8 }}>
                                <Text style={{ color: '#374151' }}>Name</Text>
                                <TextInput value={ch.name} onChangeText={(v) => updateChild(idx, 'name', v)} placeholder="Child name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 6 }} />

                                <Text style={{ color: '#374151', marginTop: 8 }}>Birth Date</Text>
                                {Platform.OS === 'web' ? (
                                    <TextInput value={ch.birthDate} onChangeText={(v) => updateChild(idx, 'birthDate', v)} placeholder="YYYY-MM-DD" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 6 }} />
                                ) : (
                                    <TouchableOpacity onPress={() => openDatePickerForChild(idx)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 10, marginTop: 6 }}>
                                        <Text>{ch.birthDate || 'Select date'}</Text>
                                    </TouchableOpacity>
                                )}

                                <Text style={{ color: '#374151', marginTop: 8 }}>Place of Birth</Text>
                                <TextInput value={ch.placeOfBirth} onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)} placeholder="City / Hospital" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 6 }} />

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                    <TouchableOpacity onPress={() => removeChild(idx)} style={{ padding: 6 }}>
                                        <Text style={{ color: '#EF4444', fontWeight: '600' }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }} disabled={saving}>
                        <Text style={{ color: '#6B7280' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSave}
                        style={{ backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, opacity: saving ? 0.7 : 1 }}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* DateTime picker modal used for profile birthday and children DOB on mobile */}
            <DateTimePickerModal
                isVisible={datePickerVisible}
                mode="date"
                onConfirm={onDateConfirm}
                onCancel={onDateCancel}
            />
        </SafeAreaView>
    );
}
