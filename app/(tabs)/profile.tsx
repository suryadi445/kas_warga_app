import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LinearGradientModule from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image, // ADD: Import Image component
    Platform,
    RefreshControl,
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
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { getCurrentUser, signOut } from '../../src/services/authService';

// safe LinearGradient reference
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

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

    // Pull to refresh
    const { refreshing, onRefresh } = useRefresh(async () => {
        await loadUserProfile();
    });

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
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Gradient Header Background */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingTop: 10, paddingBottom: 70, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
            >
                {/* Logout Button - Top Right */}
                <View style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                        }}
                    >
                        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Logout</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 20, alignItems: 'center', paddingTop: 10 }}>
                    {/* Profile Image with frame */}
                    <View style={{
                        width: 110,
                        height: 110,
                        borderRadius: 55,
                        backgroundColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        padding: 4,
                        overflow: 'hidden'
                    }}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                        ) : (
                            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 48 }}>👤</Text>
                            </View>
                        )}
                    </View>

                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>
                        {name || 'Suryadi'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 2 }}>
                        {role || 'Member'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'center' }}>
                        {phone || '089678468651'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'center' }}>
                        {email || 'suryadi.hhb@gmail.com'}
                    </Text>
                </View>
            </LinearGradient>

            {/* Action Buttons - Overlapping */}
            <View style={{ marginTop: -50, paddingHorizontal: 10, marginBottom: 16, zIndex: 10 }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    padding: 12,
                    flexDirection: 'row',
                    gap: 8,
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                }}>
                    <TouchableOpacity
                        onPress={pickImageNative}
                        style={{
                            flex: 1,
                            backgroundColor: '#EEF2FF',
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#C7D2FE'
                        }}
                    >
                        <Text style={{ fontSize: 16, marginBottom: 2 }}>📷</Text>
                        <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 11 }}>Change Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setImageClearVisible(true)}
                        style={{
                            flex: 1,
                            backgroundColor: '#FEF2F2',
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#FECACA'
                        }}
                    >
                        <Text style={{ fontSize: 16, marginBottom: 2 }}>🗑️</Text>
                        <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 11 }}>Clear Photo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Form Content Card */}
            <ScrollView
                style={{ flex: 1, paddingHorizontal: 10 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                }
            >
                <ListCardWrapper style={{ marginHorizontal: 0, marginBottom: 16 }}>
                    <View style={{ padding: 20 }}>
                        {/* Personal Information Section */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
                                PERSONAL INFORMATION
                            </Text>

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Full Name</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter your full name"
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                    fontSize: 14,
                                    backgroundColor: '#F9FAFB'
                                }}
                            />

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Role</Text>
                            {/* Role field: only editable by super admin (suryadi.hhb@gmail.com) */}
                            {canEditRole ? (
                                <>
                                    <TouchableOpacity
                                        onPress={() => setRoleOpen((v) => !v)}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: '#E5E7EB',
                                            borderRadius: 10,
                                            padding: 12,
                                            marginBottom: 12,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: '#F9FAFB'
                                        }}
                                    >
                                        <Text style={{ color: role ? '#111827' : '#9CA3AF', fontSize: 14 }}>{role || 'Select role'}</Text>
                                        <Text style={{ color: '#6B7280' }}>▾</Text>
                                    </TouchableOpacity>
                                    {roleOpen && (
                                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, marginTop: -6, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                            {ROLE_OPTIONS.map((r) => (
                                                <TouchableOpacity
                                                    key={r}
                                                    onPress={() => { setRole(r); setRoleOpen(false); }}
                                                    style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: r === ROLE_OPTIONS[ROLE_OPTIONS.length - 1] ? 0 : 1, borderBottomColor: '#E5E7EB' }}
                                                >
                                                    <Text style={{ color: '#111827', fontSize: 14 }}>{r}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                    <Text style={{ color: '#10B981', fontSize: 11, marginTop: -6, marginBottom: 12 }}>
                                        ✓ You have super admin privileges
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#F9FAFB' }}>
                                        <Text style={{ color: '#6B7280', fontSize: 14 }}>{role}</Text>
                                    </View>
                                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: -6, marginBottom: 12 }}>
                                        Only super admin can change user roles
                                    </Text>
                                </>
                            )}

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Gender</Text>
                            <TouchableOpacity
                                onPress={() => setGenderOpen((v) => !v)}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#F9FAFB'
                                }}
                            >
                                <Text style={{ color: gender ? '#111827' : '#9CA3AF', fontSize: 14 }}>{gender || 'Select gender'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {genderOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, marginTop: -6, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    {GENDER_OPTIONS.map((g) => (
                                        <TouchableOpacity
                                            key={g}
                                            onPress={() => { setGender(g); setGenderOpen(false); }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: g === GENDER_OPTIONS[GENDER_OPTIONS.length - 1] ? 0 : 1, borderBottomColor: '#E5E7EB' }}
                                        >
                                            <Text style={{ color: '#111827', fontSize: 14 }}>{g}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Birthday</Text>
                            {Platform.OS === 'web' ? (
                                <TextInput value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: '#F9FAFB' }} />
                            ) : (
                                <TouchableOpacity onPress={openDatePickerForBirthday} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#F9FAFB' }}>
                                    <Text style={{ color: birthday ? '#111827' : '#9CA3AF', fontSize: 14 }}>{birthday || 'Select birthday'}</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Email</Text>
                            <TextInput value={email} editable={false} placeholder="email@example.com" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: '#F3F4F6', color: '#6B7280' }} />

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Religion</Text>
                            <TouchableOpacity
                                onPress={() => setReligionOpen((v) => !v)}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#F9FAFB'
                                }}
                            >
                                <Text style={{ color: religion ? '#111827' : '#9CA3AF', fontSize: 14 }}>{religion || 'Select religion'}</Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {religionOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, marginTop: -6, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    {RELIGION_OPTIONS.map((r) => (
                                        <TouchableOpacity
                                            key={r}
                                            onPress={() => { setReligion(r); setReligionOpen(false); }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: r === RELIGION_OPTIONS[RELIGION_OPTIONS.length - 1] ? 0 : 1, borderBottomColor: '#E5E7EB' }}
                                        >
                                            <Text style={{ color: '#111827', fontSize: 14 }}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Phone</Text>
                            <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: '#F9FAFB' }} />

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Address</Text>
                            <TextInput
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Full address"
                                multiline
                                numberOfLines={3}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                    fontSize: 14,
                                    textAlignVertical: 'top',
                                    minHeight: 80,
                                    backgroundColor: '#F9FAFB'
                                }}
                            />
                        </View>

                        {/* Family Information Section */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
                                FAMILY INFORMATION
                            </Text>

                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Marital Status</Text>
                            <TouchableOpacity
                                onPress={() => setMaritalStatusOpen((v) => !v)}
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#F9FAFB'
                                }}
                            >
                                <Text style={{ color: maritalStatus ? '#111827' : '#9CA3AF', fontSize: 14 }}>
                                    {MARITAL_STATUS_OPTIONS.find(o => o.value === maritalStatus)?.label || 'Select marital status'}
                                </Text>
                                <Text style={{ color: '#6B7280' }}>▾</Text>
                            </TouchableOpacity>
                            {maritalStatusOpen && (
                                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, marginTop: -6, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    {MARITAL_STATUS_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            onPress={() => {
                                                setMaritalStatus(opt.value);
                                                setMaritalStatusOpen(false);
                                                if (opt.value !== 'married') setSpouseName('');
                                            }}
                                            style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: opt.value === MARITAL_STATUS_OPTIONS[MARITAL_STATUS_OPTIONS.length - 1].value ? 0 : 1, borderBottomColor: '#E5E7EB' }}
                                        >
                                            <Text style={{ color: '#111827', fontSize: 14 }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* spouse name when married */}
                            {maritalStatus === 'married' && (
                                <>
                                    <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Spouse Name</Text>
                                    <TextInput value={spouseName} onChangeText={setSpouseName} placeholder="Spouse full name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: '#F9FAFB' }} />
                                </>
                            )}

                            {/* children: show only when married/divorced/widowed */}
                            {(maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') && (
                                <>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ color: '#374151', fontWeight: '700', fontSize: 14 }}>Children ({children.length})</Text>
                                        <TouchableOpacity onPress={addChild} style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                                            <Text style={{ color: '#0369A1', fontWeight: '700', fontSize: 13 }}>+ Add</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {children.map((ch, idx) => (
                                        <View key={idx} style={{ marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#F9FAFB' }}>
                                            <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Name</Text>
                                            <TextInput value={ch.name} onChangeText={(v) => updateChild(idx, 'name', v)} placeholder="Child name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, backgroundColor: '#fff' }} />

                                            <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Birth Date</Text>
                                            {Platform.OS === 'web' ? (
                                                <TextInput value={ch.birthDate} onChangeText={(v) => updateChild(idx, 'birthDate', v)} placeholder="YYYY-MM-DD" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, backgroundColor: '#fff' }} />
                                            ) : (
                                                <TouchableOpacity onPress={() => openDatePickerForChild(idx)} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' }}>
                                                    <Text style={{ color: ch.birthDate ? '#111827' : '#9CA3AF', fontSize: 13 }}>{ch.birthDate || 'Select date'}</Text>
                                                </TouchableOpacity>
                                            )}

                                            <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Place of Birth</Text>
                                            <TextInput value={ch.placeOfBirth} onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)} placeholder="City / Hospital" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, backgroundColor: '#fff' }} />

                                            <TouchableOpacity onPress={() => requestRemoveChild(idx)} style={{ backgroundColor: '#FEE2E2', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                                                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Remove Child</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>

                        {/* Save Button - Inside ScrollView */}
                        <View style={{ marginTop: 24, marginBottom: 8 }}>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                style={{
                                    backgroundColor: '#6366f1',
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    opacity: saving ? 0.6 : 1,
                                    elevation: 4,
                                    shadowColor: '#6366f1',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 6,
                                }}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save Profile</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ListCardWrapper>
            </ScrollView>

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
