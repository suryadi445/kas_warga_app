import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
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

export default function SettingsScreen() {
    const [appName, setAppName] = useState('Kas Warga');
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

    // NEW: coordinates state + map modal
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    // temp state used inside map modal (so cancel doesn't overwrite)
    const [tmpLat, setTmpLat] = useState<number | null>(latitude);
    const [tmpLng, setTmpLng] = useState<number | null>(longitude);

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

    // load saved settings (including bank account) on mount
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('settings');
                if (raw) {
                    const s = JSON.parse(raw);
                    if (s.bankAccount) setBankAccount(s.bankAccount);
                    if (Array.isArray(s.paymentMethods)) setPaymentMethods(s.paymentMethods);
                    if (s.location) setLocation(s.location);
                    if (s.address) setAddress(s.address);
                }
            } catch {
                // ignore
            }
        })();
    }, []);

    // persist paymentMethods whenever it changes (merge into settings)
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('settings');
                const base = raw ? JSON.parse(raw) : {};
                base.paymentMethods = paymentMethods;
                // keep bankAccount if present
                if (!base.bankAccount && bankAccount) base.bankAccount = bankAccount;
                await AsyncStorage.setItem('settings', JSON.stringify(base));
            } catch {
                // ignore save errors
            }
        })();
    }, [paymentMethods]);

    function save() {
        if (!appName.trim()) {
            Alert.alert('Error', 'App name is required');
            return;
        }
        // commit tmp coords if map modal still open values were edited
        setLatitude((lat) => lat ?? tmpLat);
        setLongitude((lng) => lng ?? tmpLng);
        // nilai disimpan di state lokal; tambahkan persistence jika diperlukan
        setModalVisible(false);
    }

    async function saveSettings() {
        try {
            // additionally persist bank account into same settings key
            const raw = await AsyncStorage.getItem('settings');
            const base = raw ? JSON.parse(raw) : {};
            const merged = { ...base, bankAccount, location, address };
            await AsyncStorage.setItem('settings', JSON.stringify(merged));
        } catch {
            // optionally show error
        }
        // commit tmp coords if map modal still open values were edited
        setLatitude((lat) => lat ?? tmpLat);
        setLongitude((lng) => lng ?? tmpLng);
        // nilai disimpan di state lokal; tambahkan persistence jika diperlukan
        setModalVisible(false);
    }

    function addPaymentMethod() {
        setPaymentMethods((p) => [...p, { id: Date.now().toString(), number: '', provider: '' }]);
    }
    function updatePaymentMethod(id: string, field: 'number' | 'provider', value: string) {
        setPaymentMethods((p) => p.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    }
    function removePaymentMethod(id: string) {
        setPaymentMethods((p) => p.filter((m) => m.id !== id));
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 32 }}>⚙️</Text>
                </View>
                <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '700' }}>App Settings</Text>
                <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    Update app details, address, and payment methods.
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ marginTop: 10 }}>
                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 16 }}>Edit</Text>
                </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, elevation: 2 }}>
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

                        {/* Open map modal directly */}
                        <TouchableOpacity onPress={() => { setTmpLat(latitude); setTmpLng(longitude); setMapModalVisible(true); }} style={{ marginTop: 8 }}>
                            <Text style={{ color: '#06B6D4', fontWeight: '600' }}>Set location on map</Text>
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

                            <Text style={{ color: '#374151', marginTop: 8 }}>App Name</Text>
                            <TextInput value={appName} onChangeText={setAppName} placeholder="App name" style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 }} />

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
                                        <TouchableOpacity onPress={() => removePaymentMethod(pm.id)} style={{ padding: 6 }}>
                                            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity onPress={addPaymentMethod} style={{ marginTop: 6, paddingVertical: 10 }}>
                                <Text style={{ color: '#06B6D4', fontWeight: '700' }}>+ Add payment method</Text>
                            </TouchableOpacity>

                            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                                <Text style={{ color: '#374151', marginTop: 8 }}>Location Coordinates</Text>
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

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10 }}>
                                    <Text style={{ color: '#6B7280' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={saveSettings} style={{ padding: 10 }}>
                                    <Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Map picker modal */}
            <Modal visible={mapModalVisible} animationType="slide" transparent onRequestClose={() => setMapModalVisible(false)}>
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
            </Modal>
        </SafeAreaView>
    );
}
