import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    PermissionsAndroid,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { useRefresh } from '../../src/hooks/useRefresh';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// import { LinearGradient } from 'expo-linear-gradient';
import * as LinearGradientModule from 'expo-linear-gradient';

// safe LinearGradient reference (some environments export default, some named)
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

export default function SettingsScreen() {
    const { showToast } = useToast(); // added
    const { t } = useTranslation();
    const [appName, setAppName] = useState('Kas Warga');
    const [appImage, setAppImage] = useState<string | undefined>(undefined);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [businessType, setBusinessType] = useState('Community Service');
    const [phone, setPhone] = useState('081234567890');
    const [email, setEmail] = useState('info@example.com');
    const [address, setAddress] = useState('Jl. Contoh No.1, Kota');
    const [location, setLocation] = useState(''); // human-readable location storage (used with map)
    const [modalVisible, setModalVisible] = useState(false);
    // new bank account state
    const [bankAccount, setBankAccount] = useState('');
    // dynamic payment methods: phone number + provider (e.g. 0899.. - OVO)
    const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; number: string; provider: string }>>([]);

    // NEW: saving state for settings save button
    const [savingSettings, setSavingSettings] = useState(false);

    // confirm delete for payment methods
    const [pmDeleteVisible, setPmDeleteVisible] = useState(false);
    const [pmToDelete, setPmToDelete] = useState<string | null>(null);

    // NEW: coordinates state + map modal
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    // temp state used inside map modal (so cancel doesn't overwrite)
    const [tmpLat, setTmpLat] = useState<number | null>(latitude);
    const [tmpLng, setTmpLng] = useState<number | null>(longitude);

    // NEW: app description
    const [appDescription, setAppDescription] = useState(
        'Management application for cash, activities, and mosque or community information. Use the menu below to access cash, schedule, announcements, documentation, and more.'
    );

    // NEW: permission dialog state
    const [permDialogVisible, setPermDialogVisible] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // reverse geocode using Nominatim (OpenStreetMap)
    async function reverseGeocode(lat: number | null, lon: number | null) {
        if (lat == null || lon == null) return null;
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
                String(lat)
            )}&lon=${encodeURIComponent(String(lon))}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'kas-warga-app' } });
            if (!res.ok) return null;
            const data = await res.json();
            // prefer display_name, fallback to lat/lon
            return data?.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        } catch (err) {
            return null;
        }
    }

    // load settings from Firestore (real-time) with AsyncStorage fallback
    useEffect(() => {
        let unsub: (() => void) | null = null;
        (async () => {
            try {
                const ref = doc(db, 'settings', 'app');
                unsub = onSnapshot(ref, (snap) => {
                    if (!snap.exists()) return;
                    const s = snap.data() as any;
                    if (s.appName) setAppName(s.appName);
                    if (s.appImage) setAppImage(s.appImage); // ensures index sees cloud URL
                    if (s.businessType) setBusinessType(s.businessType);
                    if (s.phone) setPhone(s.phone);
                    if (s.email) setEmail(s.email);
                    if (s.address) setAddress(s.address);
                    if (s.bankAccount) setBankAccount(s.bankAccount);
                    if (Array.isArray(s.paymentMethods)) setPaymentMethods(s.paymentMethods);
                    if (s.location) setLocation(s.location);
                    if (s.latitude != null) setLatitude(s.latitude);
                    if (s.longitude != null) setLongitude(s.longitude);
                    if (s.appDescription) setAppDescription(s.appDescription);
                }, (err) => {
                    console.warn('settings onSnapshot error', err);
                });
            } catch (e) {
                // fallback to AsyncStorage if Firestore unavailable
                try {
                    const raw = await AsyncStorage.getItem('settings');
                    if (raw) {
                        const s = JSON.parse(raw);
                        if (s.bankAccount) setBankAccount(s.bankAccount);
                        if (Array.isArray(s.paymentMethods)) setPaymentMethods(s.paymentMethods);
                        if (s.location) setLocation(s.location);
                        if (s.address) setAddress(s.address);
                        if (s.appImage) setAppImage(s.appImage);
                    }
                } catch { /* ignore */ }
            }
        })();
        return () => { if (unsub) unsub(); };
    }, [refreshTrigger]);

    const { refreshing, onRefresh } = useRefresh(async () => {
        setRefreshTrigger(prev => prev + 1);
    });

    // persist paymentMethods whenever it changes (write to Firestore + AsyncStorage fallback)
    useEffect(() => {
        (async () => {
            try {
                const ref = doc(db, 'settings', 'app');
                // updateDoc does not accept merge option; call updateDoc normally
                await updateDoc(ref, { paymentMethods }).catch(async () => {
                    // if update fails (doc may not exist), use setDoc with merge
                    await setDoc(ref, { paymentMethods }, { merge: true });
                });
            } catch {
                // fallback to AsyncStorage
                try {
                    const raw = await AsyncStorage.getItem('settings');
                    const base = raw ? JSON.parse(raw) : {};
                    base.paymentMethods = paymentMethods;
                    await AsyncStorage.setItem('settings', JSON.stringify(base));
                } catch { /* ignore */ }
            }
        })();
    }, [paymentMethods]);

    // upload helper: upload local uri to Firebase Storage and return download URL
    async function uploadImageToStorage(uri: string) {
        try {
            setUploadingImage(true);
            // fetch file as blob
            const response = await fetch(uri);
            const blob = await response.blob();
            // create storage path
            const storage = getStorage();
            const path = `settings/app_${Date.now()}.jpg`;
            const ref = storageRef(storage, path);
            // upload
            await uploadBytes(ref, blob);
            // get public download URL
            const url = await getDownloadURL(ref);
            return url;
        } catch (err) {
            console.error('uploadImageToStorage error', err);
            return null;
        } finally {
            setUploadingImage(false);
        }
    }

    // Ensure gallery permission on Android/iOS
    async function ensureGalleryPermission() {
        if (Platform.OS === 'android') {
            try {
                const apiLevel = Platform.Version as number;
                const perm = apiLevel >= 33
                    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

                const granted = await PermissionsAndroid.check(perm);
                if (granted) return true;

                const res = await PermissionsAndroid.request(perm);
                return res === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn('Android permission error', err);
                return false;
            }
        } else {
            // iOS: allow 'granted' or 'limited'
            const { requestMediaLibraryPermissionsAsync } = await import('expo-image-picker');
            const r = await requestMediaLibraryPermissionsAsync();
            if (r.granted) return true;
            // some iOS versions return status 'limited' in r.status
            if ((r as any).status === 'limited') return true;
            return false;
        }
    }

    // image picker helper: pick then upload to storage, store URL in appImage
    async function pickAppImage() {
        try {
            // ensure permission cross-platform
            const ok = await ensureGalleryPermission();
            if (!ok) {
                setPermDialogVisible(true);
                return;
            }

            const { launchImageLibraryAsync } = await import('expo-image-picker');
            const res = await launchImageLibraryAsync({ quality: 0.7, base64: false });
            const uri = (res as any)?.assets?.[0]?.uri || (res as any)?.uri;
            if (uri) {
                // upload to Firebase Storage and get download URL
                const downloadUrl = await uploadImageToStorage(uri);
                if (downloadUrl) {
                    setAppImage(downloadUrl);
                    showToast(t('image_uploaded', { defaultValue: 'Image uploaded' }), 'success');
                } else {
                    showToast(t('failed_to_upload_image', { defaultValue: 'Failed to upload image' }), 'error');
                }
            }
        } catch (err) {
            console.error('pickAppImage error', err);
            showToast(t('failed_to_pick_upload_image', { defaultValue: 'Failed to pick/upload image' }), 'error');
        }
    }

    function save() {
        if (!appName.trim()) {
            showToast(t('app_name_required', { defaultValue: 'App name is required' }), 'error');
            return;
        }
        // commit tmp coords if map modal still open values were edited
        setLatitude((lat) => lat ?? tmpLat);
        setLongitude((lng) => lng ?? tmpLng);
        setModalVisible(false);
    }

    async function saveSettings() {
        setSavingSettings(true);
        // commit tmp coords if map modal still open values were edited
        const finalLat = (latitude ?? tmpLat) ?? null;
        const finalLng = (longitude ?? tmpLng) ?? null;
        setLatitude((lat) => lat ?? tmpLat);
        setLongitude((lng) => lng ?? tmpLng);

        const payload: any = {
            appName,
            appDescription,
            appImage: appImage || '',
            businessType,
            phone,
            email,
            address,
            bankAccount,
            paymentMethods,
            location,
            latitude: finalLat,
            longitude: finalLng,
            updatedAt: serverTimestamp(),
        };

        try {
            const ref = doc(db, 'settings', 'app');
            // try update (merge)
            await updateDoc(ref, payload).catch(async () => {
                // if update fails, set doc
                await setDoc(ref, payload, { merge: true });
            });
            // also mirror to AsyncStorage for offline
            try {
                await AsyncStorage.setItem('settings', JSON.stringify(payload));
            } catch { }
            showToast(t('settings_saved_cloud', { defaultValue: 'Settings saved to cloud' }), 'success');
        } catch (e) {
            console.error('saveSettings error', e);
            // fallback to AsyncStorage only
            try {
                await AsyncStorage.setItem('settings', JSON.stringify(payload));
                showToast(t('settings_saved_locally', { defaultValue: 'Settings saved locally (no network)' }), 'info');
            } catch {
                showToast(t('failed_to_save_settings', { defaultValue: 'Failed to save settings' }), 'error');
            }
        } finally {
            setModalVisible(false);
            setSavingSettings(false);
        }
    }

    function addPaymentMethod() {
        setPaymentMethods((p) => [...p, { id: Date.now().toString(), number: '', provider: '' }]);
    }
    function updatePaymentMethod(id: string, field: 'number' | 'provider', value: string) {
        setPaymentMethods((p) => p.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    }
    // show confirmation before removing payment method
    function confirmRemovePaymentMethod(id: string) {
        setPmToDelete(id);
        setPmDeleteVisible(true);
    }
    function removePaymentMethodConfirmed() {
        if (!pmToDelete) return;
        setPaymentMethods((p) => p.filter((m) => m.id !== pmToDelete));
        setPmDeleteVisible(false);
        showToast(t('payment_method_removed', { defaultValue: 'Payment method removed' }), 'success');
        setPmToDelete(null);
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Gradient Header Background */}
                <LinearGradient
                    colors={['#6366f1', '#8b5cf6', '#a855f7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: 20, paddingBottom: 100, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
                >
                    <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
                        {/* App Image with elegant frame */}
                        <View style={{
                            width: 110,
                            height: 110,
                            borderRadius: 55,
                            backgroundColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 6,
                            elevation: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            padding: 4
                        }}>
                            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                {appImage ? (
                                    <Image source={{ uri: appImage }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text style={{ fontSize: 48 }}>🕌</Text>
                                )}
                            </View>
                        </View>

                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 }}>
                            {appName}
                        </Text>

                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
                            {businessType}
                        </Text>

                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
                            {appDescription}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Main Content Card - Overlapping with gradient */}
                <View style={{ marginTop: -70, paddingHorizontal: 16 }}>
                    <View style={{
                        backgroundColor: '#fff',
                        borderRadius: 24,
                        padding: 20,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                    }}>
                        {/* Phone - full row */}
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                    <Text style={{ fontSize: 14 }}>📞</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>{t('phone_label', { defaultValue: 'Phone' })}</Text>
                                    <Text numberOfLines={1} style={{ color: '#111827', fontSize: 13, fontWeight: '600' }}>{phone}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Email - full row */}
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                    <Text style={{ fontSize: 14 }}>✉️</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>{t('email_label', { defaultValue: 'Email' })}</Text>
                                    <Text numberOfLines={1} style={{ color: '#111827', fontSize: 13, fontWeight: '600' }}>{email}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Address - full row */}
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                    <Text style={{ fontSize: 14 }}>📍</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>{t('address_label', { defaultValue: 'Address' })}</Text>
                                    <Text style={{ color: '#111827', fontSize: 12, lineHeight: 16 }}>{address}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Bank Account - full row (if exists) */}
                        {bankAccount && (
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Text style={{ fontSize: 14 }}>🏦</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>{t('bank_account_label', { defaultValue: 'Bank Account' })}</Text>
                                        <Text numberOfLines={1} style={{ color: '#111827', fontSize: 12, fontWeight: '600' }}>{bankAccount}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Edit Button - always visible */}
                        <TouchableOpacity
                            onPress={() => { setTmpLat(latitude); setTmpLng(longitude); setModalVisible(true); }}
                            style={{ marginTop: 4 }}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#8b5cf6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    elevation: 4,
                                    shadowColor: '#6366f1',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 6
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('edit_settings', { defaultValue: '✏️ Edit Settings' })}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Edit Settings Modal - Full form */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%', flex: 1 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{t('app_settings', { defaultValue: 'App Settings' })}</Text>

                            {/* App Image Section */}
                            <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', overflow: 'hidden', marginBottom: 12, borderWidth: 2, borderColor: '#6366f1' }}>
                                    {appImage ? (
                                        <Image source={{ uri: appImage }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 40 }}>🕌</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ color: '#374151', marginBottom: 6, fontSize: 12 }}>{t('app_logo', { defaultValue: 'App Logo' })}</Text>
                                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                                    <TouchableOpacity onPress={pickAppImage} style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ color: '#374151', fontSize: 12 }}>{uploadingImage ? t('uploading', { defaultValue: 'Uploading...' }) : t('pick_image', { defaultValue: 'Pick Image' })}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setAppImage(undefined)} style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ color: '#EF4444', fontSize: 12 }}>{t('clear', { defaultValue: 'Clear' })}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <FloatingLabelInput
                                label={t('app_name_label', { defaultValue: 'App Name' })}
                                value={appName}
                                onChangeText={setAppName}
                                placeholder={t('enter_app_name', { defaultValue: 'Enter app name' })}
                            />

                            <FloatingLabelInput
                                label={t('app_description_label', { defaultValue: 'App Description' })}
                                value={appDescription}
                                onChangeText={setAppDescription}
                                placeholder={t('short_description_placeholder', { defaultValue: 'Short description shown on main page' })}
                                multiline
                                inputStyle={{ minHeight: 80, paddingTop: 18 }}
                            />

                            <FloatingLabelInput
                                label={t('business_type_label', { defaultValue: 'Business Type' })}
                                value={businessType}
                                onChangeText={setBusinessType}
                                placeholder={t('business_type_placeholder', { defaultValue: 'Business / organization type' })}
                            />

                            <FloatingLabelInput
                                label={t('phone_label', { defaultValue: 'Phone' })}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder={t('phone_placeholder', { defaultValue: '08xxxx' })}
                                keyboardType="phone-pad"
                            />

                            <FloatingLabelInput
                                label={t('email_label', { defaultValue: 'Email' })}
                                value={email}
                                onChangeText={setEmail}
                                placeholder={t('email_placeholder', { defaultValue: 'email@example.com' })}
                                keyboardType="email-address"
                            />

                            <FloatingLabelInput
                                label={t('address_label', { defaultValue: 'Address' })}
                                value={address}
                                onChangeText={setAddress}
                                placeholder={t('enter_address', { defaultValue: 'Enter address' })}
                                multiline
                                inputStyle={{ minHeight: 100, paddingTop: 18 }}
                            />

                            <View style={{ marginTop: -10, marginBottom: 12, alignItems: 'flex-end' }}>
                                <TouchableOpacity
                                    onPress={() => setMapModalVisible(true)}
                                    style={{
                                        borderWidth: 1,
                                        borderColor: '#3B82F6',
                                        borderRadius: 8,
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 12 }}>
                                        {t('pick_location_on_map', { defaultValue: '📍 Pick location on map' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <FloatingLabelInput
                                label={t('bank_account_label', { defaultValue: 'Bank Account' })}
                                value={bankAccount}
                                onChangeText={setBankAccount}
                                placeholder={t('bank_account_placeholder', { defaultValue: '1234567890 (Bank Name - Account Name)' })}
                            />

                            {/* Payment Methods - wrapped with FloatingLabel style */}
                            <View style={{ position: 'relative', marginBottom: 16, marginTop: 2 }}>
                                {/* Floating Label */}
                                <View style={{
                                    position: 'absolute',
                                    top: -8,
                                    left: 12,
                                    backgroundColor: '#fff',
                                    paddingHorizontal: 6,
                                    zIndex: 10
                                }}>
                                    <Text style={{
                                        color: '#6B7280',
                                        fontSize: 12,
                                        fontWeight: '600'
                                    }}>
                                        {t('payment_methods_label', { defaultValue: 'Payment Methods' })}
                                    </Text>
                                </View>

                                {/* Container with border */}
                                <View style={{
                                    borderWidth: 2,
                                    borderColor: '#7c3aed',
                                    borderRadius: 12,
                                    padding: 12,
                                }}>

                                    {/* Payment methods list */}
                                    {paymentMethods.map((pm) => (
                                        <View key={pm.id} style={{
                                            marginBottom: 12,
                                            paddingTop: 8,
                                            backgroundColor: '#fff'
                                        }}>
                                            <FloatingLabelInput
                                                label={t('phone_number_label', { defaultValue: 'Phone Number' })}
                                                value={pm.number}
                                                onChangeText={(v) => updatePaymentMethod(pm.id, 'number', v)}
                                                placeholder={t('phone_example', { defaultValue: 'e.g. 0899xxxxxx' })}
                                                keyboardType="phone-pad"
                                                containerStyle={{ marginBottom: 8 }}
                                            />
                                            <FloatingLabelInput
                                                label={t('provider_label', { defaultValue: 'Provider' })}
                                                value={pm.provider}
                                                onChangeText={(v) => updatePaymentMethod(pm.id, 'provider', v)}
                                                placeholder={t('provider_example', { defaultValue: 'e.g. OVO / GoPay / Dana' })}
                                                containerStyle={{ marginBottom: 0 }}
                                            />
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                                                <TouchableOpacity onPress={() => confirmRemovePaymentMethod(pm.id)} style={{ padding: 6 }}>
                                                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>✕ {t('remove', { defaultValue: 'Remove' })}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    {/* Add button */}
                                    <TouchableOpacity
                                        onPress={addPaymentMethod}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: '#3B82F6',
                                            borderRadius: 8,
                                            paddingVertical: 12,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 14 }}>{t('add_payment_method', { defaultValue: '+ Add Payment Method' })}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} disabled={savingSettings} style={{ padding: 10, opacity: savingSettings ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={saveSettings} disabled={savingSettings} style={{ padding: 10 }}>
                                    {savingSettings ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>{t('save', { defaultValue: 'Save' })}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Map picker modal */}
            <Modal visible={mapModalVisible} animationType="slide" transparent onRequestClose={() => setMapModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <View style={{
                        width: '90%',
                        maxWidth: 400,
                        backgroundColor: '#fff',
                        borderRadius: 24,
                        padding: 20,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#111827' }}>
                            {t('select_location_on_map', { defaultValue: 'Select Location on Map' })}
                        </Text>

                        {/* Map View for selecting location */}
                        <View style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                            <MapView
                                style={{ width: '100%', height: '100%' }}
                                initialRegion={{
                                    latitude: latitude ?? 0,
                                    longitude: longitude ?? 0,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                }}
                                onRegionChangeComplete={(region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
                                    setTmpLat(region.latitude);
                                    setTmpLng(region.longitude);
                                }}
                            >
                                {latitude !== null && longitude !== null && (
                                    <Marker
                                        coordinate={{ latitude, longitude }}
                                        title={t('selected_location', { defaultValue: 'Selected Location' })}
                                        description={address}
                                        pinColor="#6366f1"
                                    />
                                )}
                            </MapView>
                        </View>

                        {/* Address and Coordinates Display */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>{t('selected_address', { defaultValue: 'Selected Address:' })}</Text>
                            <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500' }}>
                                {address || t('no_address_selected', { defaultValue: 'No address selected' })}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', marginBottom: 2, marginTop: 12 }}>
                            <View style={{ flex: 1 }}>
                                <FloatingLabelInput
                                    label={t('latitude', { defaultValue: 'Latitude' })}
                                    value={String(tmpLat ?? '')}
                                    onChangeText={(text) => setTmpLat(parseFloat(text))}
                                    keyboardType="numeric"
                                    containerStyle={{ backgroundColor: '#F9FAFB', borderRadius: 12 }}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                            <View style={{ flex: 1 }}>
                                <FloatingLabelInput
                                    label={t('longitude', { defaultValue: 'Longitude' })}
                                    value={String(tmpLng ?? '')}
                                    onChangeText={(text) => setTmpLng(parseFloat(text))}
                                    keyboardType="numeric"
                                    containerStyle={{ backgroundColor: '#F9FAFB', borderRadius: 12 }}
                                />
                            </View>
                        </View>

                        {/* Save and Cancel Buttons */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                                onPress={() => setMapModalVisible(false)}
                                style={{
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: 12,
                                    paddingVertical: 10,
                                    paddingHorizontal: 16,
                                    marginRight: 10,
                                    elevation: 2,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '500' }}>{t('cancel', { defaultValue: 'Cancel' })}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={save}
                                style={{
                                    backgroundColor: '#6366f1',
                                    borderRadius: 12,
                                    paddingVertical: 10,
                                    paddingHorizontal: 16,
                                    elevation: 2,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 4,
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>
                                    {savingSettings ? <ActivityIndicator color="#fff" size="small" /> : t('save_location', { defaultValue: 'Save Location' })}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={pmDeleteVisible}
                title={t('remove_payment_method_title', { defaultValue: 'Remove payment method' })}
                message={t('remove_payment_method_message', { defaultValue: 'Are you sure you want to remove this payment method?' })}
                onConfirm={removePaymentMethodConfirmed}
                onCancel={() => { setPmDeleteVisible(false); setPmToDelete(null); }}
                confirmText={t('remove', { defaultValue: 'Remove' })}
                cancelText={t('cancel', { defaultValue: 'Cancel' })}
            />

            <ConfirmDialog
                visible={permDialogVisible}
                title={t('gallery_permission_title', { defaultValue: 'Gallery permission required' })}
                message={t('gallery_permission_message', { defaultValue: 'Gallery access is required to pick an app image. Open app settings to grant permission?' })}
                onConfirm={() => {
                    setPermDialogVisible(false);
                    Linking.openSettings().catch(() => {
                        showToast?.(t('unable_open_settings', { defaultValue: 'Unable to open settings' }), 'error');
                    });
                }}
                onCancel={() => setPermDialogVisible(false)}
                confirmText={t('open_settings', { defaultValue: 'Open settings' })}
                cancelText={t('cancel', { defaultValue: 'Cancel' })}
            />
        </SafeAreaView>
    );
}
