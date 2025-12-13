import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingLabelInput from '../../src/components/FloatingLabelInput';
import ListLoadingState from '../../src/components/ListLoadingState';
import SelectInput from '../../src/components/SelectInput';
import { useToast } from '../../src/contexts/ToastContext';
import { auth, db } from '../../src/firebaseConfig';

type Broadcast = {
    id: string;
    title: string;
    body: string;
    role: string;
    sentCount: number;
    createdAt: any;
};

export default function BroadcastScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Filter state
    const [filterRole, setFilterRole] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [role, setRole] = useState('all');
    const [sending, setSending] = useState(false);


    useEffect(() => {
        const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Broadcast[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() } as Broadcast);
            });
            setBroadcasts(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching broadcasts: ", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        let date: Date;
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp && typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else if (timestamp && typeof timestamp.seconds === 'number') {
            date = new Date(timestamp.seconds * 1000);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            // Fallback: try to construct a Date from timestamp
            date = new Date(timestamp);
        }
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const sendBroadcast = async () => {
        if (!auth.currentUser) {
            showToast('You are not authenticated. Please login again.', 'error');
            return;
        }

        if (!title || !body) {
            showToast('Please fill title and message', 'error');
            return;
        }
        setSending(true);
        try {
            console.log('Refreshing auth token... currentUser:', auth.currentUser?.uid, auth.currentUser?.email);
            const token = await auth.currentUser!.getIdToken(true);
            console.log('Got ID token length:', token?.length || 0);

            // Workaround: Call Cloud Function via REST API with Authorization header
            // This fixes the React Native auth token issue with httpsCallable
            const functionUrl = 'https://us-central1-masjid-app-df8c8.cloudfunctions.net/sendPushHTTP';

            console.log('Calling sendPush cloud function via REST API...');
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    data: { title, body, role }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Function call failed:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('sendPush result:', result);

            const sent = result.result?.sent || 0;
            showToast(`Sent to ${sent} devices`, 'success');
            setModalVisible(false);
            setTitle('');
            setBody('');
            setRole('all');
        } catch (e: any) {
            console.error("sendBroadcast failed:", e);

            // Handle specific error codes
            const errorMessage = e.message || String(e);
            if (errorMessage.includes('401') || errorMessage.includes('unauthenticated')) {
                showToast('Authentication failed. Please logout and login again.', 'error');
                try {
                    await auth.signOut();
                } catch (signOutErr) {
                    console.warn('Error during signOut:', signOutErr);
                }
                router.push('/(auth)/login');
            } else if (errorMessage.includes('403') || errorMessage.includes('permission-denied')) {
                showToast('Permission denied. You must be an Admin to send broadcasts.', 'error');
            } else {
                showToast(errorMessage || 'Failed to send broadcast', 'error');
            }
        } finally {
            setSending(false);
        }
    };

    const filteredBroadcasts = broadcasts.filter(b => {
        const matchesRole = filterRole === 'all' || (b.role || 'all') === filterRole;
        const titleText = (b.title || '').toString();
        const bodyText = (b.body || '').toString();
        const matchesSearch = searchQuery === '' ||
            titleText.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bodyText.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRole && matchesSearch;
    });

    const renderItem = ({ item }: { item: Broadcast }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
                    <Text style={[styles.badgeText, { color: '#1E40AF' }]}>
                        Target: {(item.role || 'all').toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.message}>{item.body || ''}</Text>
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-done" size={16} color="#10B981" />
                <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>Sent to {item.sentCount ?? 0} devices</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <LinearGradient
                colors={['#7c3aed', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            />

            <View style={styles.headerContainer}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="radio-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{t('menu_broadcast', { defaultValue: 'Broadcast' })}</Text>
                        <Text style={styles.headerSubtitle}>{t('broadcast_subtitle', { defaultValue: 'Send push notifications to users' })}</Text>
                    </View>
                </View>
            </View>

            {/* Filter Tabs */}
            <View style={{ paddingHorizontal: 20, marginTop: 10, marginBottom: 16 }}>
                <View style={styles.filterContainer}>
                    {['all', 'admin', 'member', 'staff'].map(r => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setFilterRole(r)}
                            style={[styles.filterTab, filterRole === r && styles.filterTabActive]}
                        >
                            <Text style={[styles.filterTabText, filterRole === r && styles.filterTabTextActive]}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Create Button & Search Container - Matching users.tsx style */}
            <View style={{ paddingHorizontal: 20, marginBottom: 46 }}>
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
                            label={t('search', { defaultValue: 'Search' })}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t('search_placeholder', { defaultValue: 'Search...' })}
                            containerStyle={{ marginBottom: 0 }}
                        />
                    </View>

                    {/* Right: create button (40%) */}
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.9} style={{ width: '100%' }}>
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
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('add_broadcast', { defaultValue: '+ Broadcast' })}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* List Container - Matching users.tsx style */}
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
                        <ListLoadingState message="Loading history..." />
                    ) : (
                        <FlatList
                            data={filteredBroadcasts}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
                                    <Text style={styles.emptyText}>{t('no_broadcasts_found')}</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>

            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Broadcast</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            <View style={{ zIndex: 2000, marginTop: 16 }}>
                                <SelectInput
                                    label="Target Audience"
                                    value={role}
                                    onValueChange={setRole}
                                    options={[
                                        { label: 'All Users', value: 'all' },
                                        { label: 'Admins Only', value: 'admin' },
                                        { label: 'Staff Only', value: 'staff' },
                                        { label: 'Members Only', value: 'member' }
                                    ]}
                                    placeholder="Select Target Audience"
                                />
                            </View>

                            <FloatingLabelInput
                                label="Title"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Notification Title"
                            />

                            <FloatingLabelInput
                                label="Message"
                                value={body}
                                onChangeText={setBody}
                                placeholder="Notification Message"
                                multiline
                                numberOfLines={4}
                                containerStyle={{ height: 120 }}
                                inputStyle={{ height: 120, textAlignVertical: 'top' }}
                            />

                            <TouchableOpacity
                                onPress={sendBroadcast}
                                disabled={sending}
                                style={[styles.sendButton, sending && { opacity: 0.7 }]}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.sendButtonText}>Send Broadcast</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
    headerContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    headerSubtitle: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12 },
    listContent: { padding: 16, paddingBottom: 80 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    date: { fontSize: 12, color: '#6B7280' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
    message: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
    fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    modalContent: { flex: 1, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 10 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    sendButton: { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    // Filter styles
    filterContainer: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
    filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
    filterTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
    filterTabText: { color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', fontSize: 12 },
    filterTabTextActive: { color: '#7C3AED' }
});
