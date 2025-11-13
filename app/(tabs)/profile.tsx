import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image, // ADD: Import Image component
    Platform,
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
import { getCurrentUser, signOut } from '../../src/services/authService';

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
    const [loadErrorVisible, setLoadErrorVisible] = useState(false);
    const [loadErrorMessage, setLoadErrorMessage] = useState('');
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
    const [address, setAddress] = useState('');

    // NEW: profile image state
    const [profileImage, setProfileImage] = useState<string | undefined>(undefined);

    // NEW: marital status dropdown state
    const [maritalStatusOpen, setMaritalStatusOpen] = useState(false);

    // date picker modal: context can be 'birthday' or { type: 'child', index: number }
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [datePickerContext, setDatePickerContext] = useState<{ kind: 'birthday' } | { kind: 'child'; index: number } | null>(null);

    // dropdown open state
    const [genderOpen, setGenderOpen] = useState(false);
    const [religionOpen, setReligionOpen] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const [canEditRole, setCanEditRole] = useState(false); // NEW: check if user can edit roles
    const [currentUserRole, setCurrentUserRole] = useState<string>('Member'); // NEW: track current user's role

    // confirm states for child remove and image clear (missing previously)
    const [childDeleteVisible, setChildDeleteVisible] = useState(false);
    const [childToDeleteIndex, setChildToDeleteIndex] = useState<number | null>(null);
    const [imageClearVisible, setImageClearVisible] = useState(false);

    const MARITAL_STATUS_OPTIONS = [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
        { value: 'divorced', label: 'Divorced' },
        { value: 'widowed', label: 'Widowed' },
    ];

    // Load profile on mount
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
                showToast('User not logged in', 'error');
                router.replace('/login');
                return;
            }

            console.log('Loading profile for user:', currentUser.uid, currentUser.email);

            setUid(currentUser.uid);
            setEmail(currentUser.email || '');

            // Check if user is the super admin
            setCanEditRole(currentUser.email === 'suryadi.hhb@gmail.com');

            // Load data dari Firestore with retry - FORCE FRESH READ
            let retries = 3;
            let lastError = null;

            for (let i = 0; i < retries; i++) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    console.log(`Profile load attempt ${i + 1}:`, userDoc.exists() ? 'Document found' : 'Document not found');

                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        console.log('=== PROFILE DATA FROM FIRESTORE ===');
                        console.log('Raw data:', JSON.stringify(data, null, 2));
                        console.log('Role value:', data.role);
                        console.log('Role type:', typeof data.role);
                        console.log('===================================');

                        // Force refresh all fields from Firestore
                        setName(data.nama || data.name || '');
                        setRole(data.role || 'Member');
                        setPhone(data.phone || '');
                        setGender(data.gender || '');
                        setBirthday(data.birthday || '');
                        setReligion(data.religion || '');
                        setMaritalStatus(data.maritalStatus || 'single');
                        setSpouseName(data.spouseName || '');
                        setChildren(data.children || []);
                        setAddress(data.address || '');
                        setProfileImage(data.profileImage || undefined); // NEW: load profile image

                        console.log('State updated - Role:', data.role);
                    } else {
                        console.warn('User document does not exist in Firestore');
                        showToast('Profile data not found. Please complete your profile.', 'info');
                    }

                    return; // Success
                } catch (err: any) {
                    lastError = err;
                    console.error(`Load profile attempt ${i + 1} failed:`, err.message);

                    if (err.message?.includes('unavailable') || err.message?.includes('not found')) {
                        throw new Error('Firestore database not yet created in Firebase Console.');
                    }

                    if (i < retries - 1) {
                        console.log(`Retrying in ${1500 * (i + 1)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
                    }
                }
            }

            throw lastError;

        } catch (error: any) {
            console.error('Load profile error:', error);
            const message = error.message?.includes('database not yet created')
                ? error.message
                : 'Failed to load profile. Make sure:\n1. Firestore database is created\n2. Internet connection is active\n3. Firestore rules are set';

            setLoadErrorMessage(message);
            setLoadErrorVisible(true);
        } finally {
            setLoading(false);
        }
    }

    function addChild() {
        setChildren((c) => [...c, { name: '', birthDate: '', placeOfBirth: '' }]);
    }
    function requestRemoveChild(idx: number) {
        setChildToDeleteIndex(idx);
        setChildDeleteVisible(true);
    }
    function removeChildConfirmed() {
        if (childToDeleteIndex === null) return;
        setChildren((c) => c.filter((_, i) => i !== childToDeleteIndex));
        setChildDeleteVisible(false);
        setChildToDeleteIndex(null);
        showToast('Child removed', 'success');
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

    // NEW: image upload helpers
    function revokePreviousImage() {
        try {
            if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('blob:')) {
                URL.revokeObjectURL(profileImage);
            }
        } catch { }
    }

    async function pickImageNative() {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showToast('Gallery access permission required', 'error');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
            const uri = (res as any)?.assets?.[0]?.uri || (res as any)?.uri;
            if (uri) {
                revokePreviousImage();
                setProfileImage(uri);
            }
        } catch {
            // ignore
        }
    }

    async function handleSave() {
        if (!name.trim()) {
            showToast('Name is required', 'error');
            return;
        }

        if (!uid) {
            showToast('User ID not found', 'error');
            return;
        }

        try {
            setSaving(true);

            const updateData: any = {
                uid,
                email,
                nama: name,
                phone,
                gender,
                birthday,
                religion,
                maritalStatus,
                spouseName: maritalStatus === 'married' ? spouseName : '',
                children: (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') ? children : [],
                address: address,
                profileImage: profileImage || '', // use profileImage only
            };

            // Only include role if user is super admin (can edit role)
            if (canEditRole) {
                updateData.role = role;
            } else {
                updateData.role = role;
            }

            console.log('Saving profile with data:', updateData);

            await setDoc(doc(db, 'users', uid), updateData, { merge: true });

            showToast('Profile updated successfully', 'success');
            await loadUserProfile();
        } catch (error: any) {
            console.error('Save profile error:', error);
            showToast('Failed to save: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleLogout() {
        setLogoutConfirmVisible(true);
    }

    const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
    const RELIGION_OPTIONS = ['Islam', 'Christianity', 'Catholicism', 'Hinduism', 'Buddhism', 'Confucianism', 'Other'];
    const ROLE_OPTIONS = ['Member', 'Admin', 'Staff'];

    // Temporary debug function
    async function forceUpdateRole() {
        if (!uid) return;

        try {
            await setDoc(doc(db, 'users', uid), {
                role: 'Admin'
            }, { merge: true });

            showToast('Role force updated to Admin. Reloading...', 'success');
            await loadUserProfile();
        } catch (error: any) {
            showToast(error.message || 'Error', 'error');
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

            <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 160 }}>
                {/* Profile Image Section */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: 12, borderWidth: 3, borderColor: '#6366f1' }}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 48 }}>👤</Text>
                            </View>
                        )}
                    </View>

                    <Text style={{ color: '#374151', marginBottom: 6 }}>Profile Image</Text>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
                        <TouchableOpacity onPress={pickImageNative} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, flex: 1 }}>
                            <Text style={{ color: '#374151', textAlign: 'center' }}>Pick from gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setImageClearVisible(true)} style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, flex: 1 }}>
                            <Text style={{ color: '#EF4444', textAlign: 'center' }}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={{ color: '#374151' }}>Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Role</Text>
                {/* Role field: only editable by super admin (suryadi.hhb@gmail.com) */}
                {canEditRole ? (
                    <>
                        <TouchableOpacity
                            onPress={() => setRoleOpen((v) => !v)}
                            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB' }}
                        >
                            <Text style={{ color: role ? '#111827' : '#9CA3AF' }}>{role || 'Select role'}</Text>
                            <Text style={{ color: '#6B7280' }}>▾</Text>
                        </TouchableOpacity>
                        {roleOpen && (
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
                                {ROLE_OPTIONS.map((r) => (
                                    <TouchableOpacity
                                        key={r}
                                        onPress={() => { setRole(r); setRoleOpen(false); }}
                                        style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                                    >
                                        <Text style={{ color: '#111827' }}>{r}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        <Text style={{ color: '#10B981', fontSize: 12, marginTop: 2 }}>
                            ✓ You have super admin privileges
                        </Text>
                    </>
                ) : (
                    <>
                        <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8, backgroundColor: '#F9FAFB' }}>
                            <Text style={{ color: '#6B7280' }}>{role}</Text>
                        </View>
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>
                            Only super admin can change user roles
                        </Text>
                    </>
                )}

                <Text style={{ color: '#374151', marginTop: 12 }}>Gender</Text>
                <TouchableOpacity
                    onPress={() => setGenderOpen((v) => !v)}
                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <Text style={{ color: gender ? '#111827' : '#9CA3AF' }}>{gender || 'Select gender'}</Text>
                    <Text style={{ color: '#6B7280' }}>▾</Text>
                </TouchableOpacity>
                {genderOpen && (
                    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
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

                <Text style={{ color: '#374151', marginTop: 12 }}>Birthday</Text>
                {Platform.OS === 'web' ? (
                    <TextInput value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />
                ) : (
                    <TouchableOpacity onPress={openDatePickerForBirthday} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8 }}>
                        <Text style={{ color: birthday ? '#111827' : '#9CA3AF' }}>{birthday || 'Select birthday'}</Text>
                    </TouchableOpacity>
                )}

                <Text style={{ color: '#374151', marginTop: 12 }}>Email</Text>
                <TextInput value={email} editable={false} placeholder="email@example.com" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: '#F9FAFB' }} />

                <Text style={{ color: '#374151', marginTop: 12 }}>Religion</Text>
                <TouchableOpacity
                    onPress={() => setReligionOpen((v) => !v)}
                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <Text style={{ color: religion ? '#111827' : '#9CA3AF' }}>{religion || 'Select religion'}</Text>
                    <Text style={{ color: '#6B7280' }}>▾</Text>
                </TouchableOpacity>
                {religionOpen && (
                    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
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

                <Text style={{ color: '#374151', marginTop: 12 }}>Phone</Text>
                <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 }} />

                {/* NEW: Address field - after Phone and before Marital Status */}
                <Text style={{ color: '#374151', marginTop: 12 }}>Address</Text>
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
                        marginTop: 8,
                        textAlignVertical: 'top',
                        minHeight: 80,
                    }}
                />

                {/* Marital Status - Select Option (changed from buttons) */}
                <Text style={{ color: '#374151', marginTop: 12 }}>Marital Status</Text>
                <TouchableOpacity
                    onPress={() => setMaritalStatusOpen((v) => !v)}
                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <Text style={{ color: maritalStatus ? '#111827' : '#9CA3AF' }}>
                        {MARITAL_STATUS_OPTIONS.find(o => o.value === maritalStatus)?.label || 'Select marital status'}
                    </Text>
                    <Text style={{ color: '#6B7280' }}>▾</Text>
                </TouchableOpacity>
                {maritalStatusOpen && (
                    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 6 }}>
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
                                        <Text style={{ color: ch.birthDate ? '#111827' : '#9CA3AF' }}>{ch.birthDate || 'Select date'}</Text>
                                    </TouchableOpacity>
                                )}

                                <Text style={{ color: '#374151', marginTop: 8 }}>Place of Birth</Text>
                                <TextInput value={ch.placeOfBirth} onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)} placeholder="City / Hospital" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginTop: 6 }} />

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                    <TouchableOpacity onPress={() => requestRemoveChild(idx)} style={{ padding: 6 }}>
                                        <Text style={{ color: '#EF4444', fontWeight: '600' }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Fixed Footer */}
            <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                padding: 16,
                paddingBottom: Platform.OS === 'ios' ? 34 : 16,
                borderTopWidth: 1,
                borderTopColor: '#E5E7EB',
                elevation: 8,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: -2 }
            }}>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={{
                        backgroundColor: '#6366f1',
                        paddingVertical: 14,
                        borderRadius: 999,
                        alignItems: 'center',
                        marginBottom: 8,
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save Profile</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                        backgroundColor: '#FEF2F2',
                        paddingVertical: 14,
                        borderRadius: 999,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#EF4444',
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Logout</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <DateTimePickerModal
                isVisible={datePickerVisible}
                mode="date"
                onConfirm={onDateConfirm}
                onCancel={onDateCancel}
            />

            {/* ConfirmDialog components (logout and load error) */}
            <ConfirmDialog
                visible={logoutConfirmVisible}
                title="Logout"
                message="Are you sure you want to logout?"
                onConfirm={async () => {
                    setLogoutConfirmVisible(false);
                    try {
                        await signOut();
                        await AsyncStorage.removeItem('user');
                        router.replace('/login');
                    } catch (err) {
                        showToast('Failed to logout. Please try again.', 'error');
                    }
                }}
                onCancel={() => setLogoutConfirmVisible(false)}
                confirmText="Logout"
                cancelText="Cancel"
            />

            <ConfirmDialog
                visible={loadErrorVisible}
                title="Error"
                message={loadErrorMessage}
                onConfirm={() => {
                    setLoadErrorVisible(false);
                    loadUserProfile();
                }}
                onCancel={() => setLoadErrorVisible(false)}
                confirmText="Retry"
                cancelText="Close"
            />

            <ConfirmDialog
                visible={childDeleteVisible}
                title="Remove child"
                message="Are you sure you want to remove this child?"
                onConfirm={removeChildConfirmed}
                onCancel={() => { setChildDeleteVisible(false); setChildToDeleteIndex(null); }}
                confirmText="Remove"
                cancelText="Cancel"
            />

            <ConfirmDialog
                visible={imageClearVisible}
                title="Clear profile image"
                message="Clear profile image? This action cannot be undone."
                onConfirm={() => {
                    setImageClearVisible(false);
                    revokePreviousImage();
                    setProfileImage(undefined);
                    showToast('Profile image cleared', 'success');
                }}
                onCancel={() => setImageClearVisible(false)}
                confirmText="Clear"
                cancelText="Cancel"
            />
        </SafeAreaView>
    );
}
