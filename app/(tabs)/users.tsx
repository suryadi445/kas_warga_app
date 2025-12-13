import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import ListLoadingState from '../../src/components/ListLoadingState';
import LoadMore from '../../src/components/LoadMore';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db, storage } from '../../src/firebaseConfig';
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
    createdAt?: any;
    rejected?: boolean;
    approved?: boolean;
    rejectedAt?: any;
};

const ROLES = ['Member', 'Staff', 'Admin'];

export default function UsersScreen() {
    const insets = useSafeAreaInsets();
    const bottomInset = insets.bottom || 0;
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [canManageUsers, setCanManageUsers] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [rejectConfirmVisible, setRejectConfirmVisible] = useState(false);
    const [itemToReject, setItemToReject] = useState<string | null>(null);
    const [restoreConfirmVisible, setRestoreConfirmVisible] = useState(false);
    const [itemToRestore, setItemToRestore] = useState<string | null>(null);

    // NEW: role filter state (null = show all, 'Admin'/'Staff'/'Member' = show only that role)
    const [roleFilter, setRoleFilter] = useState<string | null>(null);

    // NEW: search query for name/email
    const [searchQuery, setSearchQuery] = useState<string>('');

    // NEW: active status filter ('all' | 'active' | 'inactive' | 'rejected')
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'rejected'>('all');

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
    const [photo, setPhoto] = useState<string | undefined>(undefined);

    // NEW: focused field for outline focus styling
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // NEW: dropdown open states
    const [genderOpen, setGenderOpen] = useState(false);
    const [religionOpen, setReligionOpen] = useState(false);
    const [maritalStatusOpen, setMaritalStatusOpen] = useState(false);

    // NEW: shared input styles (outline purple style like provided image)
    const INPUT_BASE: any = {
        borderWidth: 2,
        borderColor: '#7c3aed',

        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',

    };

    // NEW: saving state
    const [saving, setSaving] = useState(false);
    // track processing state per-user for long-running actions (approve/reject/activate)
    const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});

    const startProcessing = (id: string) => setProcessingIds(prev => ({ ...prev, [id]: true }));
    const stopProcessing = (id: string) => setProcessingIds(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    const isProcessing = (id: string) => !!processingIds[id];

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
            if (canManageUsers) loadUsers();
        }, [canManageUsers])
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

            // Prefer custom claims (role) if present; otherwise fallback to specific admin email for legacy support
            try {
                const idToken = await currentUser.getIdTokenResult(true);
                const claims = (idToken && idToken.claims) ? (idToken.claims as any) : {};
                if (claims.role === 'Admin') {
                    setCanManageUsers(true);
                    return;
                }
            } catch (err) {
                // ignore claim fetch errors and fall back to email check
            }

            // Back-compat: allow specific owner email as admin
            setCanManageUsers(currentUser.email === 'suryadi.hhb@gmail.com');
        } catch (error) {
            console.error('Failed to check permissions:', error);
        }
    }

    async function loadUsers() {
        const startTime = Date.now();
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'users'));
            const usersList: User[] = [];
            const deletions: Promise<any>[] = [];

            console.log('Total documents in Firestore users collection:', snapshot.size);

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();

                // Cleanup: if a user was rejected and the rejectedAt timestamp is older than 30 days,
                // schedule deletion from Firestore (do not include in users list).
                if (data.rejected === true && data.rejectedAt) {
                    try {
                        let rejectedDate: Date | null = null;
                        const ra = data.rejectedAt;
                        if (typeof ra.toDate === 'function') rejectedDate = ra.toDate();
                        else if (ra.seconds) rejectedDate = new Date(ra.seconds * 1000);
                        else if (typeof ra === 'number') rejectedDate = new Date(ra);

                        if (rejectedDate) {
                            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
                            if (Date.now() - rejectedDate.getTime() > THIRTY_DAYS_MS) {
                                // delete after 30 days
                                deletions.push(deleteDoc(doc(db, 'users', docSnap.id)));
                                return; // skip adding to usersList
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to evaluate rejectedAt for cleanup', err);
                    }
                }
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
                    createdAt: data.createdAt,
                    rejected: data.rejected === true,
                    rejectedAt: data.rejectedAt,
                    approved: data.approved === true,
                });
            });

            // perform deletions for expired rejected users
            if (deletions.length > 0) {
                try {
                    await Promise.all(deletions);
                    console.log('Cleaned up expired rejected users:', deletions.length);
                } catch (err) {
                    console.error('Error cleaning up rejected users:', err);
                }
            }

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
            showToast(t('failed_load_users', { defaultValue: 'Failed to load users from Firestore' }), 'error');
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
            }
            setLoading(false);
        }
    }

    function openEdit(u: User) {
        // Only admin can edit users
        if (!canManageUsers) {
            showToast(t('permission_denied_edit_user', { defaultValue: 'Permission Denied: Only admin can edit users' }), 'error');
            return;
        }

        // NEW: Protect master admin account
        // if (u.email === 'suryadi.hhb@gmail.com') {
        //     showToast(t('cannot_edit_master', { defaultValue: 'This account cannot be edited' }), 'error');
        //     return;
        // }

        setEditingId(u.id);
        setName(u.name);
        setEmail(u.email);
        setPhone(u.phone);
        setRole(u.role);
        setGenderOpen(false);
        setReligionOpen(false);
        setMaritalStatusOpen(false); // NEW: reset marital status dropdown
        setPhoto(u.photo || undefined);

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
                    setPhoto(data.profileImage || data.photo || undefined);
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
            showToast(t('permission_denied_add_user', { defaultValue: 'Permission Denied: Only admin can add users' }), 'error');
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
        setPhoto(undefined);
        setGenderOpen(false);
        setReligionOpen(false);
        setMaritalStatusOpen(false); // NEW: reset marital status dropdown
        setModalVisible(true);
    }

    // Image picker and upload functions
    async function pickImage() {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showToast(t('gallery_access_permission_required', { defaultValue: 'Gallery access permission required' }), 'error');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
            const uri = (res as any)?.assets?.[0]?.uri || (res as any)?.uri;
            if (uri) {
                setPhoto(uri);
            }
        } catch {
            // ignore
        }
    }

    // Upload image to Firebase Storage
    async function uploadImageToStorage(uri: string, userId: string): Promise<string> {
        // If already a remote URL (http/https), skip upload
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return uri;
        }

        try {
            // Fetch the local file and convert to blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Generate unique filename
            const filename = `user_photos/${userId}_${Date.now()}.jpg`;
            const storageRef = ref(storage, filename);

            // Upload to Firebase Storage
            await uploadBytes(storageRef, blob);

            // Get download URL
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
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

    // Date picker visibility states (ensure declared)
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [childDatePickerVisible, setChildDatePickerVisible] = useState(false);
    const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null);

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
            showToast(t('permission_denied_modify_user', { defaultValue: 'Permission Denied: Only admin can modify users' }), 'error');
            return;
        }

        if (!name.trim() || !email.trim()) {
            showToast(t('name_email_required', { defaultValue: 'Name and email are required' }), 'error');
            return;
        }

        // NEW: validation for creating user
        if (!editingId && !password.trim()) {
            showToast(t('password_required_new', { defaultValue: 'Password is required for new users' }), 'error');
            return;
        }

        if (!editingId && password.trim().length < 6) {
            showToast(t('password_min_length_user', { defaultValue: 'Password must be at least 6 characters' }), 'error');
            return;
        }

        try {
            setSaving(true); // START loading

            if (editingId) {
                // UPDATE existing user with complete data
                console.log('=== UPDATING USER ===');
                const docRef = doc(db, 'users', editingId);

                // Upload photo if it's a local file
                let uploadedPhotoUrl = photo || '';
                if (photo && !photo.startsWith('http')) {
                    try {
                        showToast(t('uploading_image', { defaultValue: 'Uploading image...' }), 'info');
                        uploadedPhotoUrl = await uploadImageToStorage(photo, editingId);
                    } catch (uploadError) {
                        console.error('Image upload failed:', uploadError);
                        showToast(t('image_upload_failed', { defaultValue: 'Image upload failed' }), 'error');
                        uploadedPhotoUrl = '';
                    }
                }

                await setDoc(docRef, {
                    nama: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    role: role,
                    gender: gender,
                    birthday: birthday,
                    religion: religion,
                    address: address,
                    maritalStatus: maritalStatus,
                    spouseName: maritalStatus === 'married' ? spouseName : '',
                    children: (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') ? children : [],
                    profileImage: uploadedPhotoUrl,
                }, { merge: true });

                const verifyDoc = await getDoc(docRef);
                const verifyData = verifyDoc.data();

                if (verifyData?.role !== role) {
                    throw new Error(`Role update failed! Expected: ${role}, Got: ${verifyData?.role}`);
                }

                showToast(t('user_updated_success', { defaultValue: 'User updated successfully!' }), 'success');
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

                    // Upload photo if provided
                    let uploadedPhotoUrl = '';
                    if (photo && !photo.startsWith('http')) {
                        try {
                            showToast(t('uploading_image', { defaultValue: 'Uploading image...' }), 'info');
                            uploadedPhotoUrl = await uploadImageToStorage(photo, newUser.uid);
                        } catch (uploadError) {
                            console.error('Image upload failed:', uploadError);
                            // Continue without photo
                        }
                    } else if (photo) {
                        uploadedPhotoUrl = photo;
                    }

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
                        profileImage: uploadedPhotoUrl,
                        createdAt: new Date(),
                    });

                    // Sign out from secondary auth
                    await secondarySignOut(secondaryAuth);

                    // Delete secondary app using deleteApp function
                    await deleteApp(secondaryApp);

                    console.log('User created successfully, secondary auth cleaned up');
                    showToast(t('user_created_success', { name, defaultValue: `User ${name} created successfully!` }), 'success');
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

            // User-friendly error messages (localized)
            let errorMessage = t('failed_to_save_user', { defaultValue: 'Failed to save user' });
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = t('email_in_use', { defaultValue: 'Email already in use. Please use a different email.' });
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = t('invalid_email', { defaultValue: 'Invalid email format.' });
            } else if (error.code === 'auth/weak-password') {
                errorMessage = t('weak_password', { defaultValue: 'Password is too weak. Use at least 6 characters.' });
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
            showToast(t('permission_denied_delete_user', { defaultValue: 'Permission Denied: Only admin can delete users' }), 'error');
            return;
        }

        // NEW: Protect master admin account
        const userToDelete = users.find(u => u.id === id);
        if (userToDelete && userToDelete.email === 'suryadi.hhb@gmail.com') {
            showToast(t('cannot_delete_master', { defaultValue: 'This account cannot be deleted' }), 'error');
            return;
        }

        setItemToDelete(id);
        setDeleteConfirmVisible(true);
    }

    async function removeConfirmed() {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, 'users', itemToDelete));
            showToast(t('user_deleted_success', { defaultValue: 'User deleted successfully' }), 'success');
            await loadUsers();
        } catch (error: any) {
            console.error('Failed to delete user:', error);
            showToast(t('failed_delete_user', { error: (error.message || 'Unknown error'), defaultValue: 'Failed to delete user: ' + (error.message || 'Unknown error') }), 'error');
        } finally {
            setDeleteConfirmVisible(false);
            setItemToDelete(null);
        }
    }

    // NEW: Toggle user activation status
    async function toggleUserActivation(userId: string, currentStatus: boolean | undefined) {
        if (!canManageUsers) {
            showToast(t('permission_denied_activate_user', { defaultValue: 'Permission Denied: Only admin can activate users' }), 'error');
            return;
        }

        try {
            // Server-side guard: ensure protected email cannot be toggled even if UI is bypassed
            const targetDoc = await getDoc(doc(db, 'users', userId));
            if (targetDoc.exists()) {
                const targetEmail = targetDoc.data().email;
                if (targetEmail === 'suryadi.hhb@gmail.com') {
                    showToast(t('cannot_toggle_master', { defaultValue: 'This account cannot be toggled' }), 'error');
                    return;
                }
            }

            // prevent duplicate operations
            if (isProcessing(userId)) return;
            startProcessing(userId);

            const newStatus = !currentStatus;
            // When activating (approving), mark as approved so the user is not treated as pending again
            try {
                if (newStatus === true) {
                    await updateDoc(doc(db, 'users', userId), { isActive: true, approved: true });
                    showToast(t('user_activated', { defaultValue: 'User successfully activated' }), 'success');
                } else {
                    await updateDoc(doc(db, 'users', userId), { isActive: false });
                    showToast(t('user_deactivated', { defaultValue: 'User successfully deactivated' }), 'success');
                }
                await loadUsers(); // Reload to reflect changes
            } finally {
                stopProcessing(userId);
            }
        } catch (error) {
            console.error('Failed to toggle user activation:', error);
            showToast(t('failed_update_user_status', { defaultValue: 'Failed to update user status' }), 'error');
        }
    }

    // Reject a user (mark as rejected)
    async function rejectUser(userId: string) {
        if (!canManageUsers) {
            showToast(t('permission_denied_reject_user', { defaultValue: 'Permission Denied: Only admin can reject users' }), 'error');
            return;
        }

        try {
            // Prevent rejecting master admin
            const targetDoc = await getDoc(doc(db, 'users', userId));
            if (targetDoc.exists()) {
                const targetEmail = targetDoc.data().email;
                if (targetEmail === 'suryadi.hhb@gmail.com') {
                    showToast(t('cannot_reject_master', { defaultValue: 'This account cannot be rejected' }), 'error');
                    return;
                }
            }

            // prevent duplicate operations
            if (isProcessing(userId)) return;
            startProcessing(userId);

            try {
                // Mark user as rejected and set rejectedAt timestamp. Do not delete immediately.
                await updateDoc(doc(db, 'users', userId), { isActive: false, rejected: true, rejectedAt: new Date() });
                showToast(t('user_rejected', { defaultValue: 'User successfully rejected' }), 'success');
                await loadUsers();
            } finally {
                stopProcessing(userId);
            }
        } catch (err) {
            console.error('Failed to reject user:', err);
            showToast(t('failed_reject_user', { defaultValue: 'Failed to reject user' }), 'error');
        }
    }

    // Restore a rejected user so they appear in the 'All' list (not pending)
    async function restoreUser(userId: string) {
        if (!canManageUsers) {
            showToast(t('permission_denied_restore_user', { defaultValue: 'Permission Denied: Only admin can restore users' }), 'error');
            return;
        }

        try {
            const targetDoc = await getDoc(doc(db, 'users', userId));
            if (targetDoc.exists()) {
                const targetEmail = targetDoc.data().email;
                if (targetEmail === 'suryadi.hhb@gmail.com') {
                    showToast(t('cannot_restore_master', { defaultValue: 'This account cannot be restored' }), 'error');
                    return;
                }
            }

            if (isProcessing(userId)) return;
            startProcessing(userId);

            try {
                // Restore as pending so admin can Approve/Reject again:
                // set createdAt to now so it is treated as newly-registered (pending)
                const now = new Date();
                await updateDoc(doc(db, 'users', userId), {
                    rejected: false,
                    rejectedAt: null,
                    approved: false,
                    isActive: false,
                    createdAt: now,
                });
                showToast(t('user_restored', { defaultValue: 'User successfully restored' }), 'success');
                await loadUsers();
                // ensure the UI shows the All list where pending users are visible
                setActiveFilter('all');
            } finally {
                stopProcessing(userId);
            }
        } catch (err) {
            console.error('Failed to restore user:', err);
            showToast(t('failed_restore_user', { defaultValue: 'Failed to restore user' }), 'error');
        }
    }

    // NEW: filtered users based on roleFilter and activeFilter
    function isUserPending(u: User) {
        try {
            const now = Date.now();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            let createdDate: Date | null = null;
            if (u.createdAt) {
                if (typeof (u as any).createdAt.toDate === 'function') createdDate = (u as any).createdAt.toDate();
                else if ((u as any).createdAt.seconds) createdDate = new Date((u as any).createdAt.seconds * 1000);
                else if (typeof (u as any).createdAt === 'number') createdDate = new Date((u as any).createdAt);
            }
            return !!createdDate && (now - createdDate.getTime() <= sevenDaysMs) && u.isActive !== true && u.rejected !== true && u.approved !== true;
        } catch (err) {
            return false;
        }
    }

    const filteredUsersBase = users
        .filter(u => (roleFilter ? u.role === roleFilter : true))
        .filter(u => {
            // 'all' should show everyone except rejected (include pending/new users)
            if (activeFilter === 'all') return u.rejected !== true;
            if (activeFilter === 'active') return u.isActive === true;
            if (activeFilter === 'inactive') return u.isActive !== true && u.rejected !== true && !isUserPending(u);
            if (activeFilter === 'rejected') return u.rejected === true;
            return true;
        })
        .filter(u => {
            const q = (searchQuery || '').trim().toLowerCase();
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        });

    // if viewing All, show pending users first while preserving order within groups
    const filteredUsers = (activeFilter === 'all')
        ? ([...filteredUsersBase.filter(isUserPending), ...filteredUsersBase.filter(u => !isUserPending(u))])
        : filteredUsersBase;

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

        // Compute pending status (newly-registered within 7 days and not active/not rejected)
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        let createdDate: Date | null = null;
        if (item.createdAt) {
            if (typeof item.createdAt.toDate === 'function') createdDate = item.createdAt.toDate();
            else if (item.createdAt.seconds) createdDate = new Date(item.createdAt.seconds * 1000);
            else if (typeof item.createdAt === 'number') createdDate = new Date(item.createdAt);
        }
        const isPending = !!createdDate && (now - createdDate.getTime() <= sevenDaysMs) && item.isActive !== true && item.rejected !== true && item.approved !== true;

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
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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

                            {/* Move Approve/Reject inline next to role badge for pending users */}
                            {isPending && canManageUsers && (
                                <View style={{ flexDirection: 'row', marginLeft: 8, gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => { if (!isProcessing(item.id)) toggleUserActivation(item.id, item.isActive); }}
                                        disabled={isProcessing(item.id)}
                                        style={{
                                            backgroundColor: '#DCFCE7',
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            opacity: isProcessing(item.id) ? 0.6 : 1,
                                        }}
                                    >
                                        {isProcessing(item.id) ? (
                                            <ActivityIndicator size="small" color="#065F46" />
                                        ) : (
                                            <Text style={{ color: '#065F46', fontWeight: '700', fontSize: 11 }}>Approve</Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            if (isProcessing(item.id)) return;
                                            setItemToReject(item.id);
                                            setRejectConfirmVisible(true);
                                        }}
                                        disabled={isProcessing(item.id)}
                                        style={{
                                            backgroundColor: '#FEE2E2',
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            opacity: isProcessing(item.id) ? 0.6 : 1,
                                        }}
                                    >
                                        {isProcessing(item.id) ? (
                                            <ActivityIndicator size="small" color="#991B1B" />
                                        ) : (
                                            <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 11 }}>Reject</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Activation Switch - Admin Only */}
                        {canManageUsers && (
                            // If user is pending, do not show activation switch here (Approve/Reject shown in actions)
                            (() => {
                                const isProtected = item.email === 'suryadi.hhb@gmail.com';
                                if (isPending || activeFilter === 'rejected' || item.rejected === true) {
                                    // For pending users or when viewing rejected users we hide the activation switch area entirely.
                                    // Approve/Reject buttons are shown inline for pending users; Restore button shown in Rejected view.
                                    return null;
                                }

                                return (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: '600',
                                            color: activationColor
                                        }}>
                                            {activationStatus}
                                        </Text>
                                        {isProcessing(item.id) ? (
                                            <ActivityIndicator size="small" color="#6366f1" />
                                        ) : (
                                            <Switch
                                                value={item.isActive === true}
                                                onValueChange={() => {
                                                    if (isProtected) {
                                                        showToast(t('cannot_toggle_master', { defaultValue: 'This account cannot be toggled' }), 'error');
                                                        return;
                                                    }
                                                    toggleUserActivation(item.id, item.isActive);
                                                }}
                                                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                                                thumbColor={item.isActive === true ? '#10B981' : '#9CA3AF'}
                                                ios_backgroundColor="#E5E7EB"
                                            />
                                        )}
                                    </View>
                                );
                            })()
                        )}
                    </View>

                    {/* Main content row: icon + title/subtitle + actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                            {/* User Photo */}
                            <View style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                backgroundColor: '#F3F4F6',
                                marginRight: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                borderWidth: 2,
                                borderColor: item.isActive ? colors.border : '#D1D5DB'
                            }}>
                                {item.photo ? (
                                    <Image source={{ uri: item.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                ) : (
                                    <Ionicons name="person" size={24} color="#9CA3AF" />
                                )}
                            </View>

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
                                {/* If viewing rejected list, show Restore action in actions column */}
                                {activeFilter === 'rejected' ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (isProcessing(item.id)) return;
                                            setItemToRestore(item.id);
                                            setRestoreConfirmVisible(true);
                                        }}
                                        disabled={isProcessing(item.id)}
                                        style={{
                                            backgroundColor: '#E0F2FE',
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            marginBottom: 8,
                                            opacity: isProcessing(item.id) ? 0.6 : 1
                                        }}
                                    >
                                        {isProcessing(item.id) ? (
                                            <ActivityIndicator size="small" color="#0369A1" />
                                        ) : (
                                            <Text style={{ color: '#0369A1', fontWeight: '700', fontSize: 11 }}>Restore</Text>
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <>
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
                                    </>
                                )}
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

    // NOTE: Show a non-fullscreen loading indicator inside the list area so header/filters remain visible
    // The list container below will render a loader when `loading` is true.

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
                        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{t('user_management_title', { defaultValue: 'User Management' })}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontSize: 13, lineHeight: 18 }}>
                            {t('user_management_subtitle', { defaultValue: 'Manage user accounts, roles, and permissions' })}
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
                        }}>{users.filter(u => u.rejected !== true).length}</Text>
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
                        }}>{users.filter(u => u.role === 'Admin' && u.rejected !== true).length}</Text>
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
                        }}>{users.filter(u => u.role === 'Staff' && u.rejected !== true).length}</Text>
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
                        }}>{users.filter(u => u.role === 'Member' && u.rejected !== true).length}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* NEW: Activation Status Filter (All/Active/Inactive) with Rejected separated to the right */}
            <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
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

                {/* Rejected button separated on the right, circular like Feedback List's mark button */}
                <TouchableOpacity
                    onPress={() => setActiveFilter('rejected')}
                    style={{
                        width: 44,
                        height: 44,
                        backgroundColor: activeFilter === 'rejected' ? '#6D28D9' : '#d72d27',
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: activeFilter === 'rejected' ? 0 : 1,
                        borderColor: '#d72d27'
                    }}
                >
                    <View
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: activeFilter === 'rejected' ? '#FFF' : '#FFF',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Ionicons name="trash" size={18} color={activeFilter === 'rejected' ? '#6D28D9' : '#d72d27'} />
                    </View>
                </TouchableOpacity>

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
                            🔒 Only admin can manage users
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
                                label={t('search')}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder={t('search_placeholder', { defaultValue: 'Search...' })}
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
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('add_user_button', { defaultValue: '+ User' })}</Text>
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
                    {loading ? (
                        <ListLoadingState message={t('loading_users', { defaultValue: 'Loading users...' })} />
                    ) : (
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
                                    <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>{t('no_users_found', { defaultValue: 'No users found' })}</Text>
                                    <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                        {t('no_users_match_filters', { defaultValue: 'No users match your filters' })}
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                </View>
            </View>

            {/* Modal Form - Create & Edit */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/30">
                    <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '90%' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text className="text-xl font-semibold mb-4">{editingId ? t('edit_user', { defaultValue: 'Edit User' }) : t('create_user', { defaultValue: 'Create New User' })}</Text>

                            {/* Photo Upload */}
                            <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                <TouchableOpacity onPress={pickImage} style={{ position: 'relative' }}>
                                    <View style={{
                                        width: 100,
                                        height: 100,
                                        borderRadius: 50,
                                        backgroundColor: '#F3F4F6',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: '#7c3aed',
                                        overflow: 'hidden'
                                    }}>
                                        {photo ? (
                                            <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        ) : (
                                            <Ionicons name="person" size={40} color="#9CA3AF" />
                                        )}
                                    </View>
                                    <View style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        backgroundColor: '#7c3aed',
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: '#fff'
                                    }}>
                                        <Ionicons name="camera" size={14} color="#fff" />
                                    </View>
                                </TouchableOpacity>
                                <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>{t('tap_to_change_photo', { defaultValue: 'Tap to change photo' })}</Text>
                                {photo && (
                                    <TouchableOpacity onPress={() => setPhoto(undefined)} style={{ marginTop: 4 }}>
                                        <Text style={{ color: '#EF4444', fontSize: 12 }}>{t('remove_photo', { defaultValue: 'Remove photo' })}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Basic Info */}
                            <FloatingLabelInput
                                label={`${t('full_name')} *`}
                                value={name}
                                onChangeText={setName}
                                placeholder={t('full_name', { defaultValue: 'Full name' })}
                            />

                            <FloatingLabelInput
                                label={`${t('email')} *`}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                // editable when creating new user, or when admin and not editing protected master
                                editable={!editingId || (canManageUsers && email !== 'suryadi.hhb@gmail.com')}
                                inputStyle={(!editingId || (canManageUsers && email !== 'suryadi.hhb@gmail.com')) ? undefined : { backgroundColor: '#F9FAFB' }}
                                placeholder={t('email_example', { defaultValue: 'email@example.com' })}
                            />

                            {!editingId && (
                                <FloatingLabelInput
                                    label={`${t('password')} *`}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    placeholder={t('password_min_length', { defaultValue: 'Min. 6 characters' })}
                                />
                            )}

                            <FloatingLabelInput
                                label={t('phone')}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
                                placeholder={t('phone_placeholder', { defaultValue: '08xxxxxxxxxx' })}
                            />

                            <SelectInput
                                label={`${t('role')} *`}
                                value={role}
                                options={ROLES.map(r => ({ label: t(`role_${r.toLowerCase()}`), value: r }))}
                                onValueChange={(v) => setRole(v)}
                                placeholder={t('select_role', { defaultValue: 'Select role' })}
                                onFocus={() => setFocusedField('role')}
                                onBlur={() => setFocusedField(null)}
                            />

                            <SelectInput
                                label={t('gender')}
                                value={gender}
                                options={GENDER_OPTIONS.map(g => ({ label: t(`gender_${g.toLowerCase()}`), value: g }))}
                                onValueChange={(v) => setGender(v)}
                                placeholder={t('select_gender', { defaultValue: 'Select gender' })}
                                onFocus={() => setFocusedField('gender')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Birthday */}
                            <FloatingLabelInput
                                label={t('birthday')}
                                value={formatDateDisplay(birthday)}
                                onChangeText={setBirthday}
                                placeholder={t('date_format_dmy', { defaultValue: 'dd-mm-yyyy' })}
                                editable={Platform.OS === 'web'}
                                onPress={() => {
                                    if (Platform.OS !== 'web') {
                                        setDatePickerVisible(true);
                                        setFocusedField('birthday');
                                    }
                                }}
                            />

                            <SelectInput
                                label={t('religion')}
                                value={religion}
                                options={RELIGION_OPTIONS.map(r => ({ label: t(`religion_${r.toLowerCase()}`), value: r }))}
                                onValueChange={(v) => setReligion(v)}
                                placeholder={t('select_religion', { defaultValue: 'Select religion' })}
                                onFocus={() => setFocusedField('religion')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Address */}
                            <FloatingLabelInput
                                label={t('address')}
                                value={address}
                                onChangeText={setAddress}
                                multiline
                                placeholder={t('full_address', { defaultValue: 'Full address' })}
                            />

                            <SelectInput
                                label={t('marital_status')}
                                value={maritalStatus}
                                options={MARITAL_STATUS_OPTIONS.map(o => ({ label: t(`marital_${o.value}`), value: o.value }))}
                                onValueChange={(v) => setMaritalStatus(v)}
                                placeholder={t('select_marital_status', { defaultValue: 'Select marital status' })}
                                onFocus={() => setFocusedField('maritalStatus')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Spouse Name */}
                            {maritalStatus === 'married' && (
                                <View style={{ marginBottom: 12 }}>
                                    <FloatingLabelInput
                                        label={t('spouse_name')}
                                        value={spouseName}
                                        onChangeText={setSpouseName}
                                        placeholder={t('spouse_name_placeholder', { defaultValue: 'Spouse full name' })}
                                    />
                                </View>
                            )}

                            {/* Children */}
                            {(maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') && (
                                <View style={{ marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text className="text-sm text-gray-600">{t('children')} ({children.length})</Text>
                                        <TouchableOpacity onPress={addChild}>
                                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>{t('add_child', { defaultValue: '+ Add child' })}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {children.map((ch, idx) => (
                                        <View key={idx} style={{ marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8 }}>
                                            {/* Child Name (label moved into FloatingLabelInput) */}
                                            <FloatingLabelInput
                                                label={t('child_name')}
                                                value={ch.name}
                                                onChangeText={(v) => updateChild(idx, 'name', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder={t('child_name_placeholder', { defaultValue: 'Child name' })}
                                            />

                                            {/* Birth Date (label moved into FloatingLabelInput) */}
                                            <FloatingLabelInput
                                                label={t('child_birth_date')}
                                                value={formatDateDisplay(ch.birthDate)}
                                                onChangeText={(v) => updateChild(idx, 'birthDate', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder={t('date_format_dmy', { defaultValue: 'dd-mm-yyyy' })}
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
                                                label={t('place_of_birth')}
                                                value={ch.placeOfBirth}
                                                onChangeText={(v) => updateChild(idx, 'placeOfBirth', v)}
                                                inputStyle={{ borderRadius: 6, padding: 8, marginTop: 4 }}
                                                placeholder={t('place_of_birth_placeholder', { defaultValue: 'City / Hospital' })}
                                            />

                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => removeChild(idx)} style={{ padding: 6 }}>
                                                    <Text style={{ color: '#EF4444', fontWeight: '600' }}>{t('remove')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View className="flex-row justify-between mt-4">
                                <TouchableOpacity onPress={() => !saving && setModalVisible(false)} disabled={saving} style={{ padding: 10, opacity: saving ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={saving} onPress={save} style={{ padding: 10, minWidth: 100, alignItems: 'center', justifyContent: 'center' }}>
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#4fc3f7" />
                                    ) : (
                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{editingId ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}</Text>
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
                title={t('delete_user_title', { defaultValue: 'Delete user' })}
                message={t('delete_user_message', { defaultValue: 'Delete this user? This action cannot be undone.' })}
                onConfirm={removeConfirmed}
                onCancel={() => { setDeleteConfirmVisible(false); setItemToDelete(null); }}
                confirmText={t('delete_confirm', { defaultValue: 'Delete' })}
                cancelText={t('cancel')}
            />

            {/* Confirm dialog for rejecting users (deletes their firestore doc) */}
            <ConfirmDialog
                visible={rejectConfirmVisible}
                title={t('reject_user_title', { defaultValue: 'Reject user' })}
                message={t('reject_user_message', { defaultValue: 'Reject this user? This action will move the user to Rejected list and remove after 30 days.' })}
                onConfirm={async () => {
                    try {
                        setRejectConfirmVisible(false);
                        if (itemToReject) {
                            await rejectUser(itemToReject);
                        }
                    } finally {
                        setItemToReject(null);
                    }
                }}
                onCancel={() => { setRejectConfirmVisible(false); setItemToReject(null); }}
                confirmText={t('reject_confirm', { defaultValue: 'Reject' })}
                cancelText={t('cancel')}
            />



            {/* Confirm dialog for restoring users from Rejected list */}
            <ConfirmDialog
                visible={restoreConfirmVisible}
                title={t('restore_user_title', { defaultValue: 'Restore user' })}
                message={t('restore_user_message', { defaultValue: 'Restore this user to pending review? The user will appear in the All list and admin can Approve or Reject.' })}
                onConfirm={async () => {
                    try {
                        setRestoreConfirmVisible(false);
                        if (itemToRestore) {
                            await restoreUser(itemToRestore);
                        }
                    } finally {
                        setItemToRestore(null);
                    }
                }}
                onCancel={() => { setRestoreConfirmVisible(false); setItemToRestore(null); }}
                confirmText={t('restore_confirm', { defaultValue: 'Restore' })}
                cancelText={t('cancel')}
            />
        </SafeAreaView>
    );
}
