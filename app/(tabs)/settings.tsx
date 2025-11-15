import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog'; // added
import { useToast } from '../../src/contexts/ToastContext'; // added
import { db } from '../../src/firebaseConfig';

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// import { LinearGradient } from 'expo-linear-gradient';
import * as LinearGradientModule from 'expo-linear-gradient';

// safe LinearGradient reference (some environments export default, some named)
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

export default function SettingsScreen() {
    const { showToast } = useToast(); // added
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
    }, []);

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
                    showToast('Image uploaded', 'success');
                } else {
                    showToast('Failed to upload image', 'error');
                }
            }
        } catch (err) {
            console.error('pickAppImage error', err);
            showToast('Failed to pick/upload image', 'error');
        }
    }

    function save() {
        if (!appName.trim()) {
            showToast('App name is required', 'error');
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
            showToast('Settings saved to cloud', 'success');
        } catch (e) {
            console.error('saveSettings error', e);
            // fallback to AsyncStorage only
            try {
                await AsyncStorage.setItem('settings', JSON.stringify(payload));
                showToast('Settings saved locally (no network)', 'info');
            } catch {
                showToast('Failed to save settings', 'error');
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
        showToast('Payment method removed', 'success');
        setPmToDelete(null);
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {/* Header */}
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>⚙️</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>App Settings</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Update app details, address, and payment methods.
                </Text>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, elevation: 2 }}>
                    {/* App Image Preview */}
                    {appImage && (
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                            <Image source={{ uri: appImage }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                        </View>
                    )}
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>{appName}</Text>
                    <Text style={{ color: '#6B7280', marginTop: 6 }}>{businessType}</Text>

                    {/* Coordinates preview */}
                    <View style={{ marginTop: 10 }}>
                        <Text style={{ color: '#374151', fontSize: 12 }}>Coordinates</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>
                            {latitude !== null && longitude !== null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'Not set'}
                        </Text>
                    </View>
                    {/* end location display */}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                        <View>
                            <Text style={{ color: '#374151', fontSize: 12 }}>Phone</Text>
                            <Text style={{ color: '#111827', marginTop: 4 }}>{phone}</Text>
                        </View>
                        <View>
                            <Text style={{ color: '#374151', fontSize: 12 }}>Email</Text>
                            <Text style={{ color: '#111827', marginTop: 4 }}>{email}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                        <Text style={{ color: '#374151', fontSize: 12 }}>Address</Text>
                        <Text style={{ color: '#111827', marginTop: 4 }}>{address}</Text>
                    </View>

                    <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => { setTmpLat(latitude); setTmpLng(longitude); setModalVisible(true); }}>
                            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Edit</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* existing Edit modal */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' }}>
                        <ScrollView>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Edit Settings</Text>

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
                                <Text style={{ color: '#374151', marginBottom: 6, fontSize: 12 }}>App Logo</Text>
                                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                                    <TouchableOpacity onPress={pickAppImage} style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ color: '#374151', fontSize: 12 }}>{uploadingImage ? 'Uploading...' : 'Pick Image'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setAppImage(undefined)} style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ color: '#EF4444', fontSize: 12 }}>Clear</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={{ color: '#374151', marginTop: 8 }}>App Name</Text>
                            <TextInput value={appName} onChangeText={setAppName} placeholder="App name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            {/* NEW: App Description */}
                            <Text style={{ color: '#374151', marginTop: 8 }}>App Description</Text>
                            <TextInput
                                value={appDescription}
                                onChangeText={setAppDescription}
                                placeholder="Short description shown on the main page"
                                multiline
                                numberOfLines={3}
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6, textAlignVertical: 'top', minHeight: 80 }}
                            />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Business Type</Text>
                            <TextInput value={businessType} onChangeText={setBusinessType} placeholder="Business / organization type" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Phone</Text>
                            <TextInput value={phone} onChangeText={setPhone} placeholder="08xxxx" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Email</Text>
                            <TextInput value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

                            <Text style={{ color: '#374151', marginTop: 8 }}>Address</Text>
                            {Platform.OS === 'web' ? (
                                <div style={{ marginTop: 6 }}>
                                    <textarea value={address} onChange={(e: any) => setAddress(e.target.value)} rows={4} style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E7EB', padding: 10 }} />
                                </div>
                            ) : (
                                <TextInput value={address} onChangeText={setAddress} placeholder="Address" multiline numberOfLines={4} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6, textAlignVertical: 'top', height: 120 }} />
                            )}

                            <View style={{ marginTop: 0, marginLeft: 'auto' }}>
                                {Platform.OS === 'web' ? (
                                    <View style={{ marginTop: 6 }}>
                                        <TextInput value={tmpLat !== null ? String(tmpLat) : ''} onChangeText={(v) => setTmpLat(v ? Number(v) : null)} placeholder="Latitude" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />
                                        <TextInput value={tmpLng !== null ? String(tmpLng) : ''} onChangeText={(v) => setTmpLng(v ? Number(v) : null)} placeholder="Longitude" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />
                                        <TouchableOpacity onPress={() => { setMapModalVisible(true); }} style={{ marginTop: 8 }}>
                                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Open map picker</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity onPress={() => setMapModalVisible(true)} style={{ marginTop: 6 }}>
                                        <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Pick location on map</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text style={{ color: '#374151', marginTop: 12 }}>Bank Account</Text>
                            <TextInput
                                value={bankAccount}
                                onChangeText={setBankAccount}
                                placeholder="Example: 1234567890 (Bank Name - Account Name)"
                                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }}
                            />

                            {/* dynamic payment methods */}
                            <Text style={{ color: '#374151', marginTop: 12, marginBottom: 6 }}>Payment Methods</Text>
                            {paymentMethods.map((pm) => (
                                <View key={pm.id} style={{ marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8 }}>
                                    <TextInput
                                        value={pm.number}
                                        onChangeText={(v) => updatePaymentMethod(pm.id, 'number', v)}
                                        placeholder="Phone number (e.g. 0899xxxxxx)"
                                        keyboardType="phone-pad"
                                        style={{ borderWidth: 0, paddingVertical: 6 }}
                                    />
                                    <TextInput
                                        value={pm.provider}
                                        onChangeText={(v) => updatePaymentMethod(pm.id, 'provider', v)}
                                        placeholder="Provider (e.g. OVO / GoPay / Dana)"
                                        style={{ borderWidth: 0, paddingVertical: 6, marginTop: 4 }}
                                    />
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                        <TouchableOpacity onPress={() => confirmRemovePaymentMethod(pm.id)} style={{ padding: 6 }}>
                                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity onPress={addPaymentMethod} style={{ marginTop: 6, paddingVertical: 10 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '700' }}>+ Add payment method</Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} disabled={savingSettings} style={{ padding: 10, opacity: savingSettings ? 0.6 : 1 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={saveSettings} disabled={savingSettings} style={{ padding: 10 }}>
                                    {savingSettings ? <ActivityIndicator size="small" color="#4fc3f7" /> : <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal >

            {/* Map picker modal */}
            < Modal visible={mapModalVisible} animationType="slide" transparent onRequestClose={() => setMapModalVisible(false)
            }>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, height: Platform.OS === 'web' ? 420 : 480 }}>
                        <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Pick location</Text>
                        {Platform.OS !== 'web' ? (
                            <View style={{ flex: 1 }}>
                                <MapView
                                    style={{ flex: 1, borderRadius: 8 }}
                                    initialRegion={{
                                        latitude: tmpLat ?? (latitude ?? -6.200000),
                                        longitude: tmpLng ?? (longitude ?? 106.816666),
                                        latitudeDelta: 0.01,
                                        longitudeDelta: 0.01,
                                    }}
                                    onPress={(e: any) => {
                                        const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                                        setTmpLat(lat);
                                        setTmpLng(lng);
                                    }}
                                >
                                    {tmpLat != null && tmpLng != null ? <Marker coordinate={{ latitude: tmpLat, longitude: tmpLng }} /> : null}
                                </MapView>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                                    <TouchableOpacity onPress={() => { setMapModalVisible(false); }} style={{ padding: 10 }}>
                                        <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (tmpLat != null && tmpLng != null) {
                                                // reverse geocode tmp coords and set address
                                                try {
                                                    const addr = await reverseGeocode(tmpLat, tmpLng);
                                                    const coordLabel = `${tmpLat.toFixed(6)}, ${tmpLng.toFixed(6)}`;
                                                    setLatitude(tmpLat);
                                                    setLongitude(tmpLng);
                                                    setAddress(addr ?? coordLabel);
                                                    setLocation(addr ?? coordLabel);
                                                } catch {
                                                    // fallback to coords
                                                    const coordLabel = `${tmpLat.toFixed(6)}, ${tmpLng.toFixed(6)}`;
                                                    setLatitude(tmpLat);
                                                    setLongitude(tmpLng);
                                                    setAddress(coordLabel);
                                                    setLocation(coordLabel);
                                                }
                                            }
                                            setMapModalVisible(false);
                                        }}
                                    >
                                        <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Select</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#374151', textAlign: 'center', marginBottom: 12 }}>
                                    To select a location, use the map below or enter coordinates manually.
                                </Text>
                                <View style={{ flexDirection: 'row', width: '100%', marginBottom: 12 }}>
                                    <TextInput
                                        value={tmpLat !== null ? String(tmpLat) : ''}
                                        onChangeText={(v) => setTmpLat(v ? Number(v) : null)}
                                        placeholder="Latitude"
                                        keyboardType="numeric"
                                        style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginRight: 8 }}
                                    />
                                    <TextInput
                                        value={tmpLng !== null ? String(tmpLng) : ''}
                                        onChangeText={(v) => setTmpLng(v ? Number(v) : null)}
                                        placeholder="Longitude"
                                        keyboardType="numeric"
                                        style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10 }}
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={async () => {
                                        if (tmpLat != null && tmpLng != null) {
                                            // reverse geocode tmp coords and set address
                                            try {
                                                const addr = await reverseGeocode(tmpLat, tmpLng);
                                                const coordLabel = `${tmpLat.toFixed(6)}, ${tmpLng.toFixed(6)}`;
                                                setLatitude(tmpLat);
                                                setLongitude(tmpLng);
                                                setAddress(addr ?? coordLabel);
                                                setLocation(addr ?? coordLabel);
                                            } catch {
                                                // fallback to coords
                                                const coordLabel = `${tmpLat.toFixed(6)}, ${tmpLng.toFixed(6)}`;
                                                setLatitude(tmpLat);
                                                setLongitude(tmpLng);
                                                setAddress(coordLabel);
                                                setLocation(coordLabel);
                                            }
                                        }
                                        setMapModalVisible(false);
                                    }}
                                    style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#4fc3f7' }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>Select this location</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal >

            <ConfirmDialog
                visible={pmDeleteVisible}
                title="Remove payment method"
                message="Are you sure you want to remove this payment method?"
                onConfirm={removePaymentMethodConfirmed}
                onCancel={() => { setPmDeleteVisible(false); setPmToDelete(null); }}
                confirmText="Remove"
                cancelText="Cancel"
            />

            {/* Permission dialog when gallery permission is denied */}
            <ConfirmDialog
                visible={permDialogVisible}
                title="Gallery permission required"
                message="Gallery access is required to pick an app image. Open app settings to grant permission?"
                onConfirm={() => {
                    setPermDialogVisible(false);
                    Linking.openSettings().catch(() => {
                        showToast?.('Unable to open settings', 'error');
                    });
                }}
                onCancel={() => setPermDialogVisible(false)}
                confirmText="Open settings"
                cancelText="Cancel"
            />
        </SafeAreaView >
    );
}
