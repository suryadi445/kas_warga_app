import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LinearGradientModule from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image, // ADD: Import Image component
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
import ListCardWrapper from '../../src/components/ListCardWrapper';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db, storage } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';
import { setAppLanguage } from '../../src/i18n';
import { getCurrentUser, signOut } from '../../src/services/authService';
import { deleteImageFromStorageByUrl } from '../../src/utils/storage';

// safe LinearGradient reference
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

export default function ProfilePage() {
    const router = useRouter();
    const { colorScheme, toggleColorScheme } = useColorScheme();
    const { t } = useTranslation();
    const [appLang, setAppLang] = useState<string>('en');
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


    // date picker modal: context can be 'birthday' or { type: 'child', index: number }
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [datePickerContext, setDatePickerContext] = useState<{ kind: 'birthday' } | { kind: 'child'; index: number } | null>(null);

    // Note: dropdown open state is handled by SelectInput internally
    const [canEditRole, setCanEditRole] = useState(false); // NEW: check if user can edit roles
    const [currentUserRole, setCurrentUserRole] = useState<string>('Member'); // NEW: track current user's role

    // confirm states for child remove and image clear (missing previously)
    const [childDeleteVisible, setChildDeleteVisible] = useState(false);
    const [childToDeleteIndex, setChildToDeleteIndex] = useState<number | null>(null);
    const [imageClearVisible, setImageClearVisible] = useState(false);

    const MARITAL_STATUS_OPTIONS = [
        { value: 'single', labelKey: 'marital_single' },
        { value: 'married', labelKey: 'marital_married' },
        { value: 'divorced', labelKey: 'marital_divorced' },
        { value: 'widowed', labelKey: 'marital_widowed' },
    ];

    // Load profile on mount
    useEffect(() => {
        loadUserProfile();
        (async () => {
            try {
                const lang = await AsyncStorage.getItem('appLang');
                if (lang) setAppLang(lang);
            } catch (e) { }
        })();
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
                        const msRaw = data.maritalStatus ?? 'single';
                        const msNorm = typeof msRaw === 'string' ? msRaw.trim().toLowerCase() : String(msRaw).toLowerCase();
                        setMaritalStatus(msNorm);
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

    // Upload profile image to Firebase Storage
    async function uploadProfileImage(uri: string): Promise<string> {
        // If already a remote URL (http/https), skip upload
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return uri;
        }

        try {
            // Fetch the local file and convert to blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Generate unique filename using uid
            const filename = `profile_images/${uid}_${Date.now()}.jpg`;
            const storageRef = ref(storage, filename);

            // Upload to Firebase Storage
            await uploadBytes(storageRef, blob);

            // Get download URL
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading profile image:', error);
            throw error;
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

            // Upload profile image to Firebase Storage if it's a local file
            let uploadedImageUrl = profileImage || '';
            if (profileImage && !profileImage.startsWith('http')) {
                try {
                    showToast(t('uploading_image', { defaultValue: 'Uploading image...' }), 'info');
                    uploadedImageUrl = await uploadProfileImage(profileImage);
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    showToast(t('image_upload_failed', { defaultValue: 'Image upload failed, saving without image' }), 'error');
                    uploadedImageUrl = '';
                }
            }

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
                profileImage: uploadedImageUrl,
            };

            // Only include role if user is super admin (can edit role)
            if (canEditRole) {
                updateData.role = role;
            } else {
                updateData.role = role;
            }

            console.log('Saving profile with data:', updateData);

            // Get previous profile to delete image if replaced
            const prevSnap = await getDoc(doc(db, 'users', uid));
            const prevProfileImage = prevSnap.exists() ? (prevSnap.data() as any)?.profileImage : null;

            await setDoc(doc(db, 'users', uid), updateData, { merge: true });

            // Delete previous profile image from Storage if it exists and differs from current
            try {
                if (prevProfileImage && prevProfileImage !== uploadedImageUrl) {
                    const deleted = await deleteImageFromStorageByUrl(prevProfileImage);
                    if (!deleted) {
                        console.warn('Failed to delete previous profile image from storage:', prevProfileImage);
                        showToast?.(t('failed_to_delete_storage_image', { defaultValue: 'Failed to delete previous storage image. Check storage rules.' }), 'error');
                    } else {
                        showToast?.(t('deleted_old_image', { defaultValue: 'Previous image removed from storage' }), 'success');
                    }
                }
            } catch (err) { console.warn('Error while deleting previous profile image', err); }

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

    const GENDER_OPTIONS = [
        { value: 'Male', labelKey: 'gender_male' },
        { value: 'Female', labelKey: 'gender_female' },
        { value: 'Other', labelKey: 'gender_other' },
    ];
    const RELIGION_OPTIONS = [
        { value: 'Islam', labelKey: 'religion_islam' },
        { value: 'Christianity', labelKey: 'religion_christianity' },
        { value: 'Catholicism', labelKey: 'religion_catholicism' },
        { value: 'Hinduism', labelKey: 'religion_hinduism' },
        { value: 'Buddhism', labelKey: 'religion_buddhism' },
        { value: 'Confucianism', labelKey: 'religion_confucianism' },
        { value: 'Other', labelKey: 'religion_other' },
    ];
    const ROLE_OPTIONS = [
        { value: 'Member', labelKey: 'role_member' },
        { value: 'Admin', labelKey: 'role_admin' },
        { value: 'Staff', labelKey: 'role_staff' },
    ];

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
                    <Text style={{ marginTop: 12, color: '#6B7280' }}>{t('loading_profile')}</Text>
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
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('logout')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Language switch */}
                <View style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={async () => {
                            const newLang = appLang === 'id' ? 'en' : 'id';
                            await setAppLanguage(newLang);
                            setAppLang(newLang);
                        }}
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.3)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 36,
                            width: 36
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>
                            {appLang === 'id' ? '🇮🇩' : '🇬🇧'}
                        </Text>
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
                        <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 11 }}>{t('change_photo')}</Text>
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
                        <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 11 }}>{t('clear_photo')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Form Content Card */}
            <ScrollView
                style={{ flex: 1, paddingHorizontal: 10 }}
                contentContainerStyle={{ paddingBottom: 0, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
                }
            >
                <ListCardWrapper style={{ marginHorizontal: 0, marginBottom: 0, flex: 1 }}>
                    <View style={{ padding: 20 }}>
                        {/* Personal Information Section */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
                                {t('personal_information')}
                            </Text>

                            <FloatingLabelInput
                                label={t('full_name')}
                                value={name}
                                onChangeText={setName}
                                placeholder={t('full_name_placeholder', { defaultValue: 'Enter your full name' })}
                                containerStyle={{ marginBottom: 12 }}
                                inputStyle={{ backgroundColor: '#F9FAFB' }}
                            />

                            {canEditRole ? (
                                <SelectInput
                                    label={t('role')}
                                    value={role}
                                    options={ROLE_OPTIONS.map(r => ({ label: t(r.labelKey), value: r.value }))}
                                    onValueChange={(v) => setRole(v)}
                                    placeholder={t('select_role')}
                                    containerStyle={{ marginBottom: 12 }}
                                />
                            ) : (
                                <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#F9FAFB' }}>
                                    <Text style={{ color: '#6B7280', fontSize: 14 }}>{role}</Text>
                                </View>
                            )}

                            <SelectInput
                                label={t('gender')}
                                value={gender}
                                options={GENDER_OPTIONS.map(g => ({ label: t(g.labelKey), value: g.value }))}
                                onValueChange={(v) => setGender(v)}
                                placeholder={t('select_gender')}
                                containerStyle={{ marginBottom: 12 }}
                            />

                            {Platform.OS === 'web' ? (
                                <FloatingLabelInput
                                    label={t('birthday')}
                                    value={birthday}
                                    onChangeText={setBirthday}
                                    placeholder={t('date_format_iso', { defaultValue: 'YYYY-MM-DD' })}
                                    containerStyle={{ marginBottom: 12 }}
                                    inputStyle={{ backgroundColor: '#F9FAFB' }}
                                />
                            ) : (
                                <FloatingLabelInput
                                    label={t('birthday')}
                                    value={birthday}
                                    onPress={openDatePickerForBirthday}
                                    placeholder={t('select_birthday', { defaultValue: 'Select birthday' })}
                                    containerStyle={{ marginBottom: 12 }}
                                    inputStyle={{ backgroundColor: '#F9FAFB' }}
                                />
                            )}

                            <FloatingLabelInput
                                label={t('email')}
                                value={email}
                                editable={false}
                                placeholder={t('email_example', { defaultValue: 'email@example.com' })}
                                containerStyle={{ marginBottom: 12 }}
                                inputStyle={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                            />

                            <SelectInput
                                label={t('religion')}
                                value={religion}
                                options={RELIGION_OPTIONS.map(r => ({ label: t(r.labelKey), value: r.value }))}
                                onValueChange={(v) => setReligion(v)}
                                placeholder={t('select_religion')}
                                containerStyle={{ marginBottom: 12 }}
                            />

                            <FloatingLabelInput
                                label={t('phone')}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder={t('phone_placeholder', { defaultValue: '08xxxx' })}
                                keyboardType="phone-pad"
                                containerStyle={{ marginBottom: 12 }}
                                inputStyle={{ backgroundColor: '#F9FAFB' }}
                            />

                            <FloatingLabelInput
                                label={t('address')}
                                value={address}
                                onChangeText={setAddress}
                                placeholder={t('full_address', { defaultValue: 'Full address' })}
                                multiline
                                numberOfLines={3}
                                containerStyle={{ marginBottom: 12 }}
                                inputStyle={{ backgroundColor: '#F9FAFB', minHeight: 80 }}
                            />
                        </View>

                        {/* Family Information Section */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
                                {t('family_information')}
                            </Text>

                            <SelectInput
                                label={t('marital_status')}
                                value={maritalStatus}
                                options={MARITAL_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value }))}
                                onValueChange={(v) => { setMaritalStatus(v); if (v !== 'married') setSpouseName(''); }}
                                placeholder={t('select_marital_status')}
                                containerStyle={{ marginBottom: 12 }}
                            />

                            {/* spouse name when married */}
                            {maritalStatus === 'married' && (
                                <>
                                    <FloatingLabelInput
                                        label={t('spouse_name')}
                                        value={spouseName}
                                        onChangeText={setSpouseName}
                                        placeholder={t('spouse_name_placeholder')}
                                        containerStyle={{ marginBottom: 12 }}
                                        inputStyle={{ backgroundColor: '#F9FAFB' }}
                                    />
                                </>
                            )}

                            {/* children: show only when married/divorced/widowed */}
                            {(maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') && (
                                <>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ color: '#374151', fontWeight: '700', fontSize: 14 }}>{t('children')} ({children.length})</Text>
                                        <TouchableOpacity onPress={addChild} style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                                            <Text style={{ color: '#0369A1', fontWeight: '700', fontSize: 13 }}>{t('add')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {children.map((ch, idx) => (
                                        <View key={idx} style={{ marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#F9FAFB' }}>
                                            <FloatingLabelInput
                                                label={t('child_name')}
                                                value={ch.name}
                                                onChangeText={(v) => updateChild(idx, 'name', v)}
                                                placeholder={t('child_name_placeholder')}
                                                containerStyle={{ marginBottom: 8 }}
                                                inputStyle={{ backgroundColor: '#fff' }}
                                            />

                                            {Platform.OS === 'web' ? (
                                                <FloatingLabelInput
                                                    label={t('child_birth_date')}
                                                    value={ch.birthDate}
                                                    onChangeText={(v) => updateChild(idx, 'birthDate', v)}
                                                    placeholder={t('date_format_iso', { defaultValue: 'YYYY-MM-DD' })}
                                                    containerStyle={{ marginBottom: 8 }}
                                                    inputStyle={{ backgroundColor: '#fff' }}
                                                />
                                            ) : (
                                                <FloatingLabelInput
                                                    label={t('child_birth_date')}
                                                    value={ch.birthDate}
                                                    onPress={() => openDatePickerForChild(idx)}
                                                    placeholder={t('select_date')}
                                                    containerStyle={{ marginBottom: 8 }}
                                                    inputStyle={{ backgroundColor: '#fff' }}
                                                />
                                            )}

                                            <FloatingLabelInput
                                                label={t('place_of_birth')}
                                                value={ch.placeOfBirth}
                                                onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)}
                                                placeholder={t('place_of_birth_placeholder')}
                                                containerStyle={{ marginBottom: 8 }}
                                                inputStyle={{ backgroundColor: '#fff' }}
                                            />

                                            <TouchableOpacity onPress={() => requestRemoveChild(idx)} style={{ backgroundColor: '#FEE2E2', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                                                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>{t('remove_child')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>

                        {/* Save Button - Inside ScrollView */}
                        <View style={{ marginTop: 0, marginBottom: 48 }}>
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
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('save_profile')}</Text>
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
                title={t('logout_confirm_title')}
                message={t('logout_confirm_message')}
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
                confirmText={t('logout')}
                cancelText={t('cancel')}
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
                confirmText={t('retry')}
                cancelText={t('cancel')}
            />

            <ConfirmDialog
                visible={childDeleteVisible}
                title={t('remove_child')}
                message="Are you sure you want to remove this child?"
                onConfirm={removeChildConfirmed}
                onCancel={() => { setChildDeleteVisible(false); setChildToDeleteIndex(null); }}
                confirmText={t('remove')}
                cancelText={t('cancel')}
            />

            <ConfirmDialog
                visible={imageClearVisible}
                title={t('clear_profile_image_title')}
                message={t('clear_profile_image_message')}
                onConfirm={() => {
                    setImageClearVisible(false);
                    revokePreviousImage();
                    setProfileImage(undefined);
                    showToast('Profile image cleared', 'success');
                }}
                onCancel={() => setImageClearVisible(false)}
                confirmText={t('remove')}
                cancelText={t('cancel')}
            />
        </SafeAreaView>
    );
}
