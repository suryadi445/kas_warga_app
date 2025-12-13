import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as LinearGradientModule from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Linking, Modal, ScrollView, StatusBar, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../../src/contexts/ToastContext';
import { db } from '../../src/firebaseConfig';
import { sendLocalNotification } from '../../src/services/NotificationService';

// safe LinearGradient reference (some environments export default, some named)
const LinearGradient = (LinearGradientModule as any)?.LinearGradient ?? (LinearGradientModule as any)?.default ?? View;

import { cancelDailySummaryTask, scanAllCollectionsForTodayAndCreateSummary, scheduleDailySummaryTask } from '../../src/services/NotificationService';
export default function DeveloperScreen() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewItems, setPreviewItems] = useState<Array<{ col: string; id: string; title?: string; message?: string }>>([]);
    const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(true);
    const [scheduleThreshold, setScheduleThreshold] = useState<number>(7);

    useEffect(() => {
        // read current schedule state from global if previously scheduled
        try {
            const present = !!((global as any).__NOTIF_SERVICE_SUMMARY_SCHEDULE_ID__);
            setScheduleEnabled(present);
        } catch (e) { }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const v = await AsyncStorage.getItem('summarySchedulingEnabled');
                const th = await AsyncStorage.getItem('summarySchedulingThreshold');
                if (v !== null) setScheduleEnabled(v === 'true');
                if (th !== null) setScheduleThreshold(Number(th));
            } catch (e) { }
        })();
    }, []);

    const copyToClipboard = async (value: string) => {
        try {
            await Clipboard.setStringAsync(value);
            showToast(t('copied_to_clipboard', { defaultValue: 'Copied to clipboard' }), 'success');
        } catch (err) {
            showToast(t('failed_to_copy', { defaultValue: 'Failed to copy' }), 'error');
        }
    };
    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#6366f1' }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Full Screen Gradient Background */}
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingTop: 10, paddingBottom: 10, paddingHorizontal: 20 }}
                >
                    {/* Avatar Section - Outside Card */}
                    <View style={{ alignItems: 'center', marginBottom: 10 }}>
                        <View style={{
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            backgroundColor: 'black',
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.12,
                            shadowRadius: 4,
                            padding: 2,
                            overflow: 'hidden'
                        }}>
                            <Image
                                source={require('../../assets/images/suryadi.png')}
                                style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden' }}
                                resizeMode="center"
                            />
                        </View>

                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
                            Suryadi
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', textAlign: 'center' }}>
                            Developer
                        </Text>
                    </View>

                    {/* White Card - Main Content */}
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
                        {/* Contact Information Section */}
                        <View style={{ marginBottom: 14 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>
                                {t('contact_information', { defaultValue: 'CONTACT INFORMATION' })}
                            </Text>

                            {/* WhatsApp */}
                            <TouchableOpacity
                                onPress={() => Linking.openURL('https://wa.me/6289678468651')}
                                style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 8 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Image
                                            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' }}
                                            style={{ width: 14, height: 14 }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600' }}>WhatsApp</Text>
                                        <Text style={{ color: '#111827', fontSize: 12, fontWeight: '600' }}>089678468651</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Donation / Bank Info (compact) */}
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>Buy Me A Coffee</Text>
                                <View style={{ height: 6 }} />
                                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 }} />

                                <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
                                    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
                                        <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Today's Dashboard Items Preview</Text>
                                        <FlatList
                                            data={previewItems}
                                            keyExtractor={(item) => `${item.col}_${item.id}`}
                                            renderItem={({ item }) => (
                                                <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                                    <Text style={{ fontWeight: '700' }}>{item.col} — {item.title || item.id}</Text>
                                                    <Text style={{ color: '#666' }}>{item.message}</Text>
                                                    <Text style={{ color: '#999', marginTop: 6 }}>{item.id}</Text>
                                                </View>
                                            )}
                                        />
                                        <TouchableOpacity onPress={() => setPreviewVisible(false)} style={{ marginTop: 12, padding: 12, backgroundColor: '#111827', borderRadius: 8 }}>
                                            <Text style={{ color: '#fff', textAlign: 'center' }}>Close Preview</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Modal>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>Bank Account</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <TouchableOpacity onPress={() => copyToClipboard('0671808478')} activeOpacity={0.75}>
                                                <Text style={{ color: '#548affff', fontSize: 11, fontWeight: '600' }}>0671808478 (BCA)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => copyToClipboard('0671808478')} activeOpacity={0.75} style={{ marginLeft: 8 }}>
                                                <Ionicons name="copy-outline" size={14} color="#548affff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>Ovo/Gopay/Dana</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
                                            <TouchableOpacity onPress={() => copyToClipboard('089678468651')} activeOpacity={0.75}>
                                                <Text style={{ color: '#548affff', fontSize: 11, fontWeight: '600' }}>089678468651</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => copyToClipboard('089678468651')} activeOpacity={0.75} style={{ marginLeft: 8 }}>
                                                <Ionicons name="copy-outline" size={14} color="#548affff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Address */}
                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <Text style={{ fontSize: 13 }}>🏠</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Address</Text>
                                        <Text style={{ color: '#111827', fontSize: 12, lineHeight: 15 }}>
                                            Jl. H. Gadung no 20, Pondok Ranji, Ciputat Timur, Tangerang Selatan, Banten
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Quote Section */}
                        <View style={{ marginBottom: 12 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>
                                {t('inspiration', { defaultValue: 'INSPIRATION' })}
                            </Text>

                            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 }}>
                                <Text style={{
                                    color: '#374151',
                                    fontStyle: 'italic',
                                    fontSize: 12,
                                    lineHeight: 16,
                                    textAlign: 'center',
                                    marginBottom: 6
                                }}>
                                    "Jika anak Adam meninggal, terputuslah amalnya kecuali dari yang tiga; Sedekah jariyah, ilmu yang bermanfaat, atau anak saleh yang mendoakan."
                                </Text>
                                <Text style={{ color: '#6B7280', fontSize: 10, textAlign: 'center', fontWeight: '600' }}>
                                    (HR. Muslim, no. 1631)
                                </Text>
                            </View>
                        </View>

                        {/* Thank You Section */}
                        {/* Dev Test Buttons */}
                        <View style={{ marginBottom: 12, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 10 }}>
                            <Text style={{ fontWeight: '700', color: '#374151', marginBottom: 8 }}>Auto summary notification</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#4B5563', marginRight: 8 }}>Enable 09:45</Text>
                                    <Switch value={scheduleEnabled} onValueChange={async (v) => {
                                        setScheduleEnabled(v);
                                        try {
                                            if (v) {
                                                // schedule with current threshold
                                                scheduleDailySummaryTask({ hour: 9, minute: 45, threshold: scheduleThreshold });
                                                showToast('Auto summary scheduling enabled', 'success');
                                            } else {
                                                cancelDailySummaryTask();
                                                showToast('Auto summary scheduling disabled', 'success');
                                            }
                                            await AsyncStorage.setItem('summarySchedulingEnabled', v ? 'true' : 'false');
                                        } catch (e) { showToast('Failed to toggle scheduling', 'error'); }
                                    }} />
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#4B5563', marginRight: 8 }}>Threshold</Text>
                                    <TextInput
                                        value={String(scheduleThreshold)}
                                        keyboardType='number-pad'
                                        onChangeText={(v) => {
                                            const parsed = Number(v) || 0;
                                            setScheduleThreshold(parsed);
                                        }}
                                        onEndEditing={async () => {
                                            if (scheduleEnabled) {
                                                cancelDailySummaryTask();
                                                scheduleDailySummaryTask({ hour: 9, minute: 45, threshold: scheduleThreshold });
                                                showToast('Threshold updated', 'success');
                                            }
                                            try { await AsyncStorage.setItem('summarySchedulingThreshold', String(scheduleThreshold)); } catch (e) { }
                                        }}
                                        style={{ width: 48, textAlign: 'center', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 }}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={{ marginTop: 12, marginBottom: 12 }}>
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const ref = await addDoc(collection(db, 'cash_reports'), {
                                            date: todayStr,
                                            amount: 10000,
                                            type: 'in',
                                            category: 'Dev Test',
                                            description: 'Test cash report for notification',
                                            createdAt: serverTimestamp()
                                        });
                                        showToast('Test cash report created (id: ' + ref.id + ')', 'success');
                                    } catch (err) {
                                        console.error('create test cash failed', err);
                                        showToast('Failed to create test cash report', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#E6F4EA', padding: 12, borderRadius: 10, marginBottom: 8 }}
                            >
                                <Text style={{ color: '#065F46', fontWeight: '700', textAlign: 'center' }}>Create Test Cash (today)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const batch = [] as Promise<any>[];
                                        for (let i = 0; i < 5; i++) {
                                            const amount = 5000 * (i + 1);
                                            const type = i % 2 === 0 ? 'in' : 'out';
                                            batch.push(addDoc(collection(db, 'cash_reports'), {
                                                date: todayStr,
                                                amount,
                                                type,
                                                category: `Dev Batch ${i + 1}`,
                                                description: `Bulk test item #${i + 1}`,
                                                createdAt: serverTimestamp()
                                            }));
                                        }
                                        const refs = await Promise.all(batch);
                                        showToast(`Created ${refs.length} test cash reports`, 'success');
                                    } catch (err) {
                                        console.error('create 5 test cash failed', err);
                                        showToast('Failed to create 5 test cash reports', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10, marginBottom: 8 }}
                            >
                                <Text style={{ color: '#065F46', fontWeight: '700', textAlign: 'center' }}>Create 5 Test Cash (today)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        // 1. Create 5 test cash
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const batchPromises: any[] = [];
                                        for (let i = 0; i < 5; i++) {
                                            batchPromises.push(addDoc(collection(db, 'cash_reports'), {
                                                date: todayStr,
                                                amount: 10000 + i * 1000,
                                                type: i % 2 === 0 ? 'in' : 'out',
                                                category: `Dev QuickSample ${i + 1}`,
                                                description: `Quick sample ${i + 1}`,
                                                createdAt: serverTimestamp()
                                            }));
                                        }
                                        const refs = await Promise.all(batchPromises);

                                        // 2. Notify today's dashboard items (backfill)
                                        let createdNotifs = 0;
                                        const today = new Date().toISOString().split('T')[0];
                                        const toScan: Array<{ col: string; queryRef: any }> = [];
                                        toScan.push({ col: 'cash_reports', queryRef: query(collection(db, 'cash_reports'), where('date', '==', today)) });
                                        toScan.push({ col: 'activities', queryRef: query(collection(db, 'activities'), where('date', '==', today)) });
                                        toScan.push({ col: 'announcements', queryRef: query(collection(db, 'announcements'), where('startDate', '<=', today), where('endDate', '>=', today)) });
                                        const schedSnap = await getDocs(collection(db, 'schedules'));
                                        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
                                        // flatten scanning
                                        for (const sc of toScan) {
                                            try {
                                                const snap = await getDocs(sc.queryRef);
                                                snap.forEach(async d => {
                                                    const id = d.id;
                                                    const notifId = `${sc.col}_${id}`;
                                                    // create a notifications doc if not exist
                                                    try {
                                                        const notifRef = doc(db, 'notifications', notifId);
                                                        const existing = await getDocs(query(collection(db, 'notifications'), where('__name__', '==', notifId)));
                                                        const existingFound = existing.size > 0;
                                                        if (!existingFound) {
                                                            await setDoc(notifRef, {
                                                                title: `${sc.col} update`,
                                                                message: `${sc.col} ${id} created`,
                                                                type: 'dashboard',
                                                                sourceCollection: sc.col,
                                                                referenceId: id,
                                                                createdAt: serverTimestamp(),
                                                                readBy: []
                                                            });
                                                            createdNotifs++;
                                                        }
                                                    } catch (err) {
                                                        // ignore write errors for dev test
                                                    }
                                                });
                                            } catch (err) { /* ignore */ }
                                        }
                                        // scan schedules
                                        schedSnap.forEach(async sDoc => {
                                            try {
                                                const sData: any = sDoc.data();
                                                const days = Array.isArray(sData.days) ? sData.days : [];
                                                if ((!sData.frequency && (!days || days.length === 0)) || (days && days.includes(dayOfWeek))) {
                                                    const id = sDoc.id;
                                                    const notifId = `schedules_${id}`;
                                                    try {
                                                        const notifRef = doc(db, 'notifications', notifId);
                                                        const existing = await getDocs(query(collection(db, 'notifications'), where('__name__', '==', notifId)));
                                                        const existingFound = existing.size > 0;
                                                        if (!existingFound) {
                                                            await setDoc(notifRef, {
                                                                title: `Schedule: ${sData.activityName || id}`,
                                                                message: sData.description || '',
                                                                type: 'dashboard',
                                                                sourceCollection: 'schedules',
                                                                referenceId: id,
                                                                createdAt: serverTimestamp(),
                                                                readBy: []
                                                            });
                                                            createdNotifs++;
                                                        }
                                                    } catch { }
                                                }
                                            } catch { }
                                        });

                                        // create a summary notification if more than 1 notifications were created
                                        try {
                                            if (createdNotifs > 1) {
                                                const summaryId = `summary_${today}`;
                                                await setDoc(doc(db, 'notifications', summaryId), {
                                                    title: `${createdNotifs} Notifications for today`,
                                                    message: `You have ${createdNotifs} items on the dashboard today.`,
                                                    type: 'summary',
                                                    date: today,
                                                    createdAt: serverTimestamp(),
                                                    readBy: [],
                                                    category: 'summary',
                                                    sourceCollection: 'summary',
                                                    referenceId: null,
                                                    count: createdNotifs
                                                }, { merge: true });
                                                await sendLocalNotification(`${createdNotifs} Notifications for today`, `You have ${createdNotifs} items on the dashboard today.`, { type: 'summary', count: createdNotifs });
                                            }
                                        } catch (e) { console.warn('Failed to create summary notification:', e); }

                                        showToast(`Created ${refs.length} cash items and ${createdNotifs} notifications`, 'success');
                                    } catch (err) {
                                        console.error('Quick sample failed', err);
                                        showToast('Quick sample test failed (check permissions)', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#E0F2FE', padding: 12, borderRadius: 10, marginBottom: 8 }}
                            >
                                <Text style={{ color: '#0C4A6E', fontWeight: '700', textAlign: 'center' }}>Quick Sample Test (create + notify)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const results: any[] = [];

                                        // Cash reports for today
                                        try {
                                            const cashQ = query(collection(db, 'cash_reports'), where('date', '==', todayStr));
                                            const cashSnap = await getDocs(cashQ);
                                            cashSnap.forEach(d => results.push({ col: 'cash_reports', id: d.id, data: d.data() }));
                                        } catch (e) { /* ignore */ }

                                        // Activities for today
                                        try {
                                            const actQ = query(collection(db, 'activities'), where('date', '==', todayStr));
                                            const actSnap = await getDocs(actQ);
                                            actSnap.forEach(d => results.push({ col: 'activities', id: d.id, data: d.data() }));
                                        } catch (e) { /* ignore */ }

                                        // Announcements active today
                                        try {
                                            const annQ = query(collection(db, 'announcements'), where('startDate', '<=', todayStr), where('endDate', '>=', todayStr));
                                            const annSnap = await getDocs(annQ);
                                            annSnap.forEach(d => results.push({ col: 'announcements', id: d.id, data: d.data() }));
                                        } catch (e) { /* ignore */ }

                                        // Schedules: we'll read all and filter by day/frequency
                                        try {
                                            const schedSnap = await getDocs(collection(db, 'schedules'));
                                            const today = new Date();
                                            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
                                            schedSnap.forEach(d => {
                                                const data: any = d.data();
                                                const frequency = data.frequency || '';
                                                const days = Array.isArray(data.days) ? data.days : [];
                                                let createdAt: any = data.createdAt ?? undefined;
                                                if (createdAt && typeof createdAt?.toDate === 'function') createdAt = createdAt.toDate();
                                                // Basic frequency checks
                                                let ok = false;
                                                if (!frequency && (!days || days.length === 0)) ok = true;
                                                if (days && days.length > 0 && days.includes(dayOfWeek)) ok = true;
                                                if (frequency === 'twice_week') {
                                                    if (days && days.length > 0) ok = days.includes(dayOfWeek);
                                                    else {
                                                        const base = createdAt ?? today;
                                                        const baseIdx = base.getDay();
                                                        const secondIdx = (baseIdx + 3) % 7;
                                                        const todayIdx = today.getDay();
                                                        ok = todayIdx === baseIdx || todayIdx === secondIdx;
                                                    }
                                                }
                                                if (frequency === 'month_twice') {
                                                    const base = createdAt ?? new Date();
                                                    const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                                                    const diffMs = startOfDay(today).getTime() - startOfDay(base).getTime();
                                                    if (diffMs >= 0) {
                                                        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                        if (daysDiff % 14 === 0) ok = true;
                                                    }
                                                }
                                                if (frequency === 'quarter') {
                                                    const base = createdAt ?? new Date();
                                                    const yearDiff = today.getFullYear() - base.getFullYear();
                                                    const monthDiff = today.getMonth() - base.getMonth() + yearDiff * 12;
                                                    if (monthDiff >= 0 && monthDiff % 3 === 0) ok = true;
                                                }
                                                if (ok) results.push({ col: 'schedules', id: d.id, data: d.data() });
                                            });
                                        } catch (e) { /* ignore */ }

                                        // Create notifications for each result if not exist
                                        let created = 0;
                                        for (const r of results) {
                                            try {
                                                const notifId = `${r.col}_${r.id}`;
                                                const notifRef = doc(db, 'notifications', notifId);
                                                // Set doc only if not exists
                                                await setDoc(notifRef, {
                                                    title: r.col === 'cash_reports' ? `${(r.data?.type === 'out' ? 'New Expense' : 'New Income')} • Rp ${Number(r.data?.amount || 0).toLocaleString()}` : (r.data?.title || `${r.col} created`),
                                                    message: r.data?.description ?? r.data?.content ?? r.data?.message ?? '',
                                                    type: 'info',
                                                    date: new Date().toISOString(),
                                                    createdAt: serverTimestamp(),
                                                    readBy: [],
                                                    category: r.col,
                                                    sourceCollection: r.col,
                                                    referenceId: r.id
                                                }, { merge: false });
                                                // schedule local push
                                                await sendLocalNotification(r.col === 'cash_reports' ? '💰 Cash Report' : '📢 New Item', r.data?.description ?? r.data?.content ?? '', { type: r.col, referenceId: r.id });
                                                created++;
                                            } catch (err) {
                                                // ignore duplicates and permission issues
                                            }
                                        }
                                        // create or update a summary for today's count
                                        try {
                                            if (created > 1) {
                                                const summaryId = `summary_${todayStr}`;
                                                await setDoc(doc(db, 'notifications', summaryId), {
                                                    title: `${created} Notifications for today`,
                                                    message: `You have ${created} items on the dashboard today.`,
                                                    type: 'summary',
                                                    date: todayStr,
                                                    createdAt: serverTimestamp(),
                                                    readBy: [],
                                                    category: 'summary',
                                                    sourceCollection: 'summary',
                                                    referenceId: null,
                                                    count: created
                                                }, { merge: true });
                                                await sendLocalNotification(`${created} Notifications for today`, `You have ${created} items on the dashboard today.`, { type: 'summary', count: created });
                                            }
                                        } catch (e) { console.warn('Failed to create summary notification (notify-today):', e); }
                                        showToast(`Created ${created} notification(s) for today's items`, 'success');
                                    } catch (err) {
                                        console.error('Notify today button failed', err);
                                        showToast('Failed to create notifications', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#EDF2FF', padding: 12, borderRadius: 10, marginTop: 8 }}
                            >
                                <Text style={{ color: '#3730a3', fontWeight: '700', textAlign: 'center' }}>Notify Today's Dashboard Items</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        setPreviewItems([]);
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const found: any[] = [];

                                        // cash_reports
                                        try {
                                            const cashQ = query(collection(db, 'cash_reports'), where('date', '==', todayStr));
                                            const snap = await getDocs(cashQ);
                                            snap.forEach(d => found.push({ col: 'cash_reports', id: d.id, title: d.data()?.category || '', message: d.data()?.description || '' }));
                                        } catch (e) { /* ignore */ }

                                        // activities
                                        try {
                                            const actQ = query(collection(db, 'activities'), where('date', '==', todayStr));
                                            const snap = await getDocs(actQ);
                                            snap.forEach(d => found.push({ col: 'activities', id: d.id, title: d.data()?.title || '', message: d.data()?.description || '' }));
                                        } catch (e) { /* ignore */ }

                                        // announcements
                                        try {
                                            const annQ = query(collection(db, 'announcements'), where('startDate', '<=', todayStr), where('endDate', '>=', todayStr));
                                            const snap = await getDocs(annQ);
                                            snap.forEach(d => found.push({ col: 'announcements', id: d.id, title: d.data()?.title || '', message: d.data()?.content || '' }));
                                        } catch (e) { /* ignore */ }

                                        // schedules (basic day-of-week filter)
                                        try {
                                            const schedSnap = await getDocs(collection(db, 'schedules'));
                                            const today = new Date();
                                            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
                                            schedSnap.forEach(d => {
                                                const data: any = d.data();
                                                const days = Array.isArray(data.days) ? data.days : [];
                                                if ((!data.frequency && (!days || days.length === 0)) || (days && days.includes(dayOfWeek))) {
                                                    found.push({ col: 'schedules', id: d.id, title: data.activityName || '', message: data.description || '' });
                                                }
                                            });
                                        } catch (e) { /* ignore */ }

                                        setPreviewItems(found);
                                        setPreviewVisible(true);
                                    } catch (err) {
                                        console.error('Preview today failed', err);
                                        showToast('Failed to preview today items', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#F0F9FF', padding: 12, borderRadius: 10, marginTop: 8 }}
                            >
                                <Text style={{ color: '#065F46', fontWeight: '700', textAlign: 'center' }}>Preview Today's Items</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        // 1) Delete cash_reports where category starts with 'Dev'
                                        const q1 = query(collection(db, 'cash_reports'), where('category', '>=', 'Dev'), where('category', '<=', 'Dev\uf8ff'));
                                        const snap1 = await getDocs(q1);
                                        const batch = writeBatch(db);
                                        let deletedCount = 0;
                                        const MAX_BATCH = 400; // limit per batch
                                        let docCount = 0;
                                        snap1.forEach(d => {
                                            batch.delete(doc(db, 'cash_reports', d.id));
                                            docCount++;
                                        });
                                        if (docCount > 0) {
                                            await batch.commit();
                                            deletedCount += docCount;
                                        }

                                        // 2) Delete notifications created for dev tests
                                        const notifQ = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(300));
                                        const notifSnap = await getDocs(notifQ);
                                        const deleteNotifBatch = writeBatch(db);
                                        let notifDeleteCount = 0;
                                        notifSnap.forEach(nd => {
                                            const data = nd.data() as any;
                                            const title = String(data.title ?? '').toLowerCase();
                                            const message = String(data.message ?? '').toLowerCase();
                                            const category = String(data.category ?? '').toLowerCase();
                                            const src = String(data.sourceCollection ?? '').toLowerCase();
                                            if (category === 'devtest' || src === 'dev' || title.includes('test') || message.includes('test') || category.startsWith('dev')) {
                                                deleteNotifBatch.delete(doc(db, 'notifications', nd.id));
                                                notifDeleteCount++;
                                            }
                                        });
                                        if (notifDeleteCount > 0) {
                                            await deleteNotifBatch.commit();
                                            deletedCount += notifDeleteCount;
                                        }

                                        // 3) Also try to delete today's summary notification if exists
                                        try {
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const summaryId = `summary_${todayStr}`;
                                            const sDoc = await getDocs(query(collection(db, 'notifications'), where('__name__', '==', summaryId)));
                                            if (sDoc && !sDoc.empty) {
                                                await deleteDoc(doc(db, 'notifications', summaryId));
                                                deletedCount++;
                                            }
                                        } catch (e) { }

                                        showToast(`Deleted ${deletedCount} dev items/notifications`, 'success');
                                    } catch (err) {
                                        console.error('Clear dev items failed', err);
                                        showToast('Failed to clear dev items (check permissions)', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, marginTop: 8 }}
                            >
                                <Text style={{ color: '#991B1B', fontWeight: '700', textAlign: 'center' }}>Clear Dev Test Items</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const id = `dev_test_${Date.now()}`;
                                        const title = 'Test Notification';
                                        const message = 'This is a developer test notification.';
                                        await setDoc(doc(db, 'notifications', id), {
                                            title,
                                            message,
                                            type: 'dev',
                                            date: new Date().toISOString(),
                                            createdAt: serverTimestamp(),
                                            readBy: [],
                                            category: 'devtest',
                                            sourceCollection: 'dev'
                                        });
                                        // also send a local push (if available)
                                        await sendLocalNotification(title, message, { type: 'dev', referenceId: id });
                                        showToast('Test notification created and local push sent', 'success');
                                    } catch (err) {
                                        console.error('create test notification failed', err);
                                        showToast('Failed to create test notification', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10 }}
                            >
                                <Text style={{ color: '#92400E', fontWeight: '700', textAlign: 'center' }}>Create Test Notification</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        await scanAllCollectionsForTodayAndCreateSummary();
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        // the scan will already create the summary for >1 results, but ensure it's created now
                                        const created = 0; // no-op, scan created items
                                        showToast('Ran scheduled summary scan (check Firestore notifications)', 'success');
                                    } catch (err) {
                                        console.error('Run summary now failed', err);
                                        showToast('Failed to run summary now', 'error');
                                    }
                                }}
                                style={{ backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, marginTop: 8 }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '700', textAlign: 'center' }}>Run Scheduled Summary Now</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#C7D2FE' }}>
                            <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>
                                {t('developer_thank_you', { defaultValue: 'Thank you for using this application!' })}
                            </Text>
                            <Text style={{ color: '#6366F1', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                                {t('developer_support_contact', { defaultValue: 'For support, collaboration, or donations, please contact the above contact information.' })}
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
