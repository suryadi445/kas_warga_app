import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { useToast } from '../../src/contexts/ToastContext';
import { auth, db } from '../../src/firebaseConfig';
import { signOut } from '../../src/services/authService';

// react-native-svg: require once and cache on global to avoid duplicate native registration (RNSVGFilter error)
let Svg: any = null;
let Path: any = null;
try {
    // Use a global cache to store the loaded module so repeated imports reuse it
    // This prevents duplicate native view registration errors in some bundling/hot-reload scenarios.
    if (!(global as any).__RN_SVG_MODULE__) {
        try {
            // attempt to require the module once
            const rnSvg = require('react-native-svg');
            // store raw module object on global for reuse
            (global as any).__RN_SVG_MODULE__ = rnSvg;
        } catch (e) {
            // not available or failed to load; leave global unset
            (global as any).__RN_SVG_MODULE__ = null;
        }
    }

    const cached = (global as any).__RN_SVG_MODULE__;
    if (cached) {
        const rnSvg = cached;
        Svg = rnSvg.default ?? rnSvg;
        Path = rnSvg.Path ?? rnSvg?.Path;
    } else {
        Svg = null;
        Path = null;
    }
} catch (err) {
    // any unexpected error -> fallback to nulls
    Svg = null;
    Path = null;
}

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🗂️' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'cash_reports', label: 'Cash Reports', icon: '💰' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'activities', label: 'Activities', icon: '🗓️' },
    { id: 'scheduler', label: 'Scheduler', icon: '📅' },
    { id: 'documentation', label: 'Documentation', icon: '📸' },
    { id: 'organization', label: 'Organization', icon: '🏛️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'prayer', label: 'Prayer', icon: '🕋' },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'feedback_list', label: 'Feedback List', icon: '📋', adminOnly: true },
    { id: 'developer', label: 'Developer', icon: '🧑‍💻' },
];

export default function TabsIndex() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();

    const [selected, setSelected] = useState('cash_reports');
    const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
    const [appName, setAppName] = useState('Community App');
    const [appImage, setAppImage] = useState<string | undefined>(undefined);
    const [appDescription, setAppDescription] = useState(
        'Management application for cash, activities, and community information.'
    );

    const [search, setSearch] = useState('');

    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadFeedback, setUnreadFeedback] = useState(0);
    const [unreadNewUsers, setUnreadNewUsers] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);

    // check admin role
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const user = auth.currentUser;
                if (user) {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (mounted && userDoc.exists()) {
                        const data = userDoc.data();
                        if (data.role === 'Admin') {
                            setIsAdmin(true);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to check admin role', e);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // load app settings
    useEffect(() => {
        let unsub: (() => void) | null = null;
        (async () => {
            try {
                const ref = doc(db, 'settings', 'app');
                unsub = onSnapshot(
                    ref,
                    (snap) => {
                        if (snap.exists()) {
                            const data = snap.data() as any;
                            if (data.appName) setAppName(data.appName);
                            if (data.appImage) setAppImage(data.appImage);
                            if (data.appDescription) setAppDescription(data.appDescription);
                        }
                    },
                    (err) => console.warn('settings onSnapshot error', err)
                );
            } catch (e) {
                console.warn('Failed to load app name from settings', e);
            }
        })();
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // get device location once and store
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!mounted || !pos?.coords) return;
                const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                await AsyncStorage.setItem('deviceLocation', JSON.stringify(loc));
            } catch {
                // ignore
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // unread notifications badge (per-user logic should be implemented elsewhere)
    useEffect(() => {
        let unsub: (() => void) | null = null;
        try {
            const q = doc(db, 'meta', 'notifications'); // example: if you store meta counts
            unsub = onSnapshot(q, snap => {
                if (snap.exists()) {
                    const data = snap.data() as any;
                    setUnreadNotifications(Number(data.unread || 0));
                }
            }, () => { });
        } catch (e) { /* ignore */ }
        return () => { if (unsub) unsub(); };
    }, []);

    // listen for unread feedback (admin only)
    useEffect(() => {
        if (!isAdmin) return;

        // Fetch all and filter client-side to handle missing 'read' field
        const q = query(collection(db, 'feedbacks'));
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const unreadCount = snapshot.docs.filter((doc: any) => doc.data().read !== true).length;
            setUnreadFeedback(unreadCount);
        }, (error: any) => {
            console.error("Error fetching unread feedback count: ", error);
        });

        return () => unsubscribe();
    }, [isAdmin]);

    // listen for newly-registered users (admin only)
    useEffect(() => {
        if (!isAdmin) return;

        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            try {
                const now = Date.now();
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

                // Count only new users (created within timeframe) that are still pending
                const newCount = snapshot.docs.filter((d: any) => {
                    const data = d.data() as any;
                    const createdAt = data?.createdAt;
                    const isActive = data?.isActive === true;
                    const isRejected = data?.rejected === true;

                    if (isActive || isRejected) return false; // already handled

                    let createdDate: Date | null = null;
                    if (!createdAt) return false;
                    // Firestore Timestamp
                    if (typeof createdAt.toDate === 'function') {
                        createdDate = createdAt.toDate();
                    } else if (createdAt.seconds) {
                        createdDate = new Date(createdAt.seconds * 1000);
                    } else if (typeof createdAt === 'number') {
                        createdDate = new Date(createdAt);
                    }
                    if (!createdDate) return false;
                    return now - createdDate.getTime() <= sevenDaysMs;
                }).length;

                setUnreadNewUsers(newCount);
            } catch (err) {
                console.error('Error computing new users count', err);
            }
        }, (err: any) => console.error('users onSnapshot error', err));

        return () => unsubscribe();
    }, [isAdmin]);

    const filteredMenu = useMemo(() => {
        let items = MENU_ITEMS;
        if (!isAdmin) {
            items = items.filter(m => !m.adminOnly);
        }
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(m => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }, [search, isAdmin]);

    // responsive columns
    const columns = width > 420 ? 4 : 3;

    const onTilePress = (id: string) => {
        setSelected(id);
        const map: Record<string, string> = {
            dashboard: '/(tabs)/dashboard',
            users: '/(tabs)/users',
            cash_reports: '/(tabs)/cash_reports',
            announcements: '/(tabs)/announcements',
            activities: '/(tabs)/activities',
            scheduler: '/(tabs)/scheduler',
            documentation: '/(tabs)/documentation',
            organization: '/(tabs)/organization',
            settings: '/(tabs)/settings',
            prayer: '/(tabs)/prayer',
            developer: '/(tabs)/developer',
            feedback: '/(tabs)/feedback',
            feedback_list: '/(tabs)/feedback_list',
        };
        const route = map[id];
        if (route) router.push(route as any);
    };

    // render tile (compact -> more "kokoh")
    const renderTile = ({ item }: { item: { id: string; label: string; icon?: string } }) => {
        return (
            <Pressable
                onPress={() => onTilePress(item.id)}
                style={{
                    flexBasis: `${100 / columns}%`,
                    padding: 8,
                }}
                android_ripple={{ color: '#e6e6e6' }}
            >
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    paddingVertical: 10,     // lebih tebal
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.12,     // shadow lebih nyata
                    shadowOffset: { width: 0, height: 6 },
                    shadowRadius: 12,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: '#E6E9EE',  // subtle border to feel "solid"
                }}>
                    <View style={{
                        width: 52,               // ikon lebih besar
                        height: 52,
                        borderRadius: 12,
                        backgroundColor: '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6
                    }}>
                        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                        {item.id === 'feedback_list' && unreadFeedback > 0 && (
                            <View style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                backgroundColor: '#EF4444',
                                borderRadius: 10,
                                minWidth: 20,
                                height: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: '#fff'
                            }}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4 }}>
                                    {unreadFeedback > 99 ? '99+' : unreadFeedback}
                                </Text>
                            </View>
                        )}
                        {item.id === 'users' && unreadNewUsers > 0 && (
                            <View style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                backgroundColor: '#EF4444',
                                borderRadius: 10,
                                minWidth: 20,
                                height: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: '#fff'
                            }}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4 }}>
                                    {unreadNewUsers > 99 ? '99+' : unreadNewUsers}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text
                        style={{ fontSize: 12, color: '#111827', textAlign: 'center', fontWeight: '700' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {item.label}
                    </Text>
                </View>
            </Pressable>
        );
    };

    return (
        // disable automatic top safe-area so gradient can extend under status bar
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {/* Header */}
            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    paddingHorizontal: 20,
                    // gunakan inset top yang wajar
                    paddingTop: 14,
                    paddingBottom: 29, // beri sedikit ruang agar wave rapi
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 17,
                    overflow: 'visible'
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            backgroundColor: '#fff',
                            overflow: 'hidden',
                            marginRight: 12,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {appImage ? (
                                <Image source={{ uri: appImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                                <Text style={{ fontSize: 28 }}>🕌</Text>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{appName}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>{appDescription}</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* Decorative wave between gradient and content (SVG if available, else rounded View fallback) */}
            {Svg && Path ? (
                <Svg
                    viewBox="0 0 1440 120"
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: 75, marginTop: -40, marginBottom: -20 }}
                >
                    <Path
                        d="M0,40 C360,120 1080,-40 1440,40 L1440,120 L0,120 Z"
                        fill="#F8FAFC"
                    />
                </Svg>
            ) : (
                // fallback yang lebih kecil sehingga tidak menimpa banyak konten
                <View style={{
                    width: '100%',
                    height: 48,
                    marginTop: -28,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                }} />
            )}

            {/* Fixed Search Bar */}
            <View style={{ paddingHorizontal: 12, zIndex: 10 }}>
                <View style={{ marginBottom: 10 }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 10, // taller input
                        borderWidth: 1,
                        borderColor: '#E6E9EE', // more solid border
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowOffset: { width: 0, height: 4 },
                        shadowRadius: 8,
                        elevation: 3
                    }}>
                        <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10
                        }}>
                            <Ionicons name="search" size={18} color="#6B7280" />
                        </View>
                        <TextInput
                            placeholder="Search menu..."
                            placeholderTextColor="#9CA3AF"
                            value={search}
                            onChangeText={setSearch}
                            style={{ flex: 1, fontSize: 15, paddingVertical: 6, color: '#111827', fontWeight: '600' }}
                            accessibilityLabel="Search menu"
                        />
                        {search ? (
                            <TouchableOpacity onPress={() => setSearch('')} style={{ marginLeft: 8, padding: 6 }}>
                                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </View>

            {/* Scrollable Grid */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                    {filteredMenu.map(item => (
                        <React.Fragment key={item.id}>
                            {renderTile({ item } as any)}
                        </React.Fragment>
                    ))}
                </View>
            </ScrollView>

            {/* logout confirm dialog */}
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
                    } catch (err: any) {
                        console.error('Logout failed', err);
                        showToast?.('Failed to logout. Please try again.', 'error');
                    }
                }}
                onCancel={() => setLogoutConfirmVisible(false)}
                confirmText="Logout"
                cancelText="Cancel"
            />
        </SafeAreaView>
    );
}
