import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

/**
 * Simple profile page.
 * - Loads data from AsyncStorage key "profile"
 * - Allows update/save back to AsyncStorage
 */

export default function ProfilePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // new fields
    const [gender, setGender] = useState(''); // e.g. Male/Female/Other
    const [birthday, setBirthday] = useState(''); // YYYY-MM-DD
    const [religion, setReligion] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('single'); // single, married, divorced, widowed
    const [spouseName, setSpouseName] = useState(''); // only when married
    const [children, setChildren] = useState<Array<{ name: string; birthDate: string; placeOfBirth: string }>>([]);

    // date picker modal: context can be 'birthday' or { type: 'child', index: number }
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [datePickerContext, setDatePickerContext] = useState<{ kind: 'birthday' } | { kind: 'child'; index: number } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('profile');
                if (raw) {
                    const p = JSON.parse(raw);
                    setName(p.name || '');
                    setRole(p.role || '');
                    setEmail(p.email || '');
                    setPhone(p.phone || '');
                    setGender(p.gender || '');
                    setBirthday(p.birthday || '');
                    setReligion(p.religion || '');
                    setMaritalStatus(p.maritalStatus || 'single');
                    setSpouseName(p.spouseName || '');
                    setChildren(p.children || []);
                } else {
                    // defaults
                    setName('Admin User');
                    setRole('Administrator');
                    setEmail('admin@example.com');
                    setPhone('08123456789');
                    setGender('');
                    setBirthday('');
                    setReligion('');
                    setMaritalStatus('single');
                    setSpouseName('');
                    setChildren([]);
                }
            } catch {
                // ignore load errors
            }
        })();
    }, []);

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
            Alert.alert('Validation', 'Name is required');
            return;
        }
        const payload = { name, role, email, phone };
        // include new fields
        const fullPayload = {
            ...payload,
            gender,
            birthday,
            religion,
            maritalStatus,
            spouseName,
            children,
        };
        try {
            await AsyncStorage.setItem('profile', JSON.stringify(fullPayload));
            Alert.alert('Success', 'Profile updated');
            router.back();
        } catch {
            Alert.alert('Error', 'Failed to save profile');
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" />
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#E5E7EB' }}>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>Profile</Text>
            </View>

            <ScrollView style={{ padding: 16 }}>
                <Text style={{ color: '#374151' }}>Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Role</Text>
                <TextInput value={role} onChangeText={setRole} placeholder="Role" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

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
                <TextInput value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

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

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
                        <Text style={{ color: '#6B7280' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={{ backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* DateTime picker modal used for profile birthday and children DOB on mobile */}
            <DateTimePickerModal
                isVisible={datePickerVisible}
                mode="date"
                onConfirm={(d: Date) => onDateConfirm(d)}
                onCancel={onDateCancel}
            />
        </SafeAreaView>
    );
}
