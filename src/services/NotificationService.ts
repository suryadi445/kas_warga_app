import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

// Lazy import expo-notifications to handle Expo Go limitations
let Notifications: typeof import('expo-notifications') | null = null;

// Try to import expo-notifications, but don't crash if it fails
try {
    Notifications = require('expo-notifications');
} catch (e) {
    console.warn('[NotificationService] expo-notifications not available:', e);
}

/**
 * Background notification listener service
 * - Monitors a set of collections for newly added documents.
 * - Creates a notification document in "notifications" when a new document is inserted.
 * - Skips initial snapshot load to avoid creating notifications for existing documents.
 */

// Configure notification handler for push notifications (if available)
if (Notifications) {
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (e) {
        console.warn('[NotificationService] Failed to set notification handler:', e);
    }
}

// Collections to monitor for inserts (module-level so helpers can reuse)
const MONITORED_COLLECTIONS = [
    'cash_reports',
    'announcements',
    'schedules',
    'activities',
];

// Helper: convert possible date representations into Date
function toDateObject(d: any): Date | null {
    if (!d) return null;
    try {
        if (d?.toDate && typeof d.toDate === 'function') return d.toDate();
        if (typeof d === 'number') return new Date(d);
        if (typeof d === 'string') return new Date(d);
    } catch (e) {
        return null;
    }
    return null;
}

// Helper: check whether a doc should appear on the Dashboard for "today".
function isItemForToday(colName: string, data: any): boolean {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        switch (colName) {
            case 'cash_reports': {
                const d = data.date;
                if (!d) return false;
                const dObj = toDateObject(d);
                if (dObj) return dObj.toISOString().split('T')[0] === todayStr && !data.deleted;
                return String(d) === todayStr && !data.deleted;
            }
            case 'announcements': {
                const sd = toDateObject(data.startDate);
                const ed = toDateObject(data.endDate);
                if (!sd || !ed) return false;
                const today = new Date(todayStr);
                return today >= sd && today <= ed;
            }
            case 'activities': {
                const d = data.date;
                if (!d) return false;
                const dObj = toDateObject(d);
                if (dObj) return dObj.toISOString().split('T')[0] === todayStr;
                return String(d) === todayStr;
            }
            case 'schedules': {
                const today = new Date();
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
                const frequency = data.frequency || '';
                const days = Array.isArray(data.days) ? data.days : [];
                let createdAt: Date | undefined = undefined;
                if (data.createdAt) {
                    const c = toDateObject(data.createdAt);
                    if (c) createdAt = c;
                }
                if (frequency === 'twice_week') {
                    if (days && days.length > 0) return days.includes(dayOfWeek);
                    const base = createdAt ?? today;
                    const baseIdx = base.getDay();
                    const secondIdx = (baseIdx + 3) % 7;
                    const todayIdx = today.getDay();
                    return todayIdx === baseIdx || todayIdx === secondIdx;
                }
                if (frequency === 'month_twice') {
                    const base = createdAt ?? new Date();
                    const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                    const diffMs = startOfDay(today).getTime() - startOfDay(base).getTime();
                    if (diffMs < 0) return false;
                    const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    if (daysDiff % 14 !== 0) return false;
                    if (days && days.length > 0) return days.includes(dayOfWeek);
                    return true;
                }
                if (frequency === 'quarter') {
                    const base = createdAt ?? new Date();
                    const yearDiff = today.getFullYear() - base.getFullYear();
                    const monthDiff = today.getMonth() - base.getMonth() + yearDiff * 12;
                    if (monthDiff < 0) return false;
                    if (monthDiff % 3 !== 0) return false;
                    const baseDay = base.getDate();
                    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                    const targetDay = Math.min(baseDay, daysInMonth);
                    if (today.getDate() !== targetDay) return false;
                    if (days && days.length > 0) return days.includes(dayOfWeek);
                    return true;
                }
                if (!days || days.length === 0) return true;
                return days.includes(dayOfWeek);
            }
            default:
                return false;
        }
    } catch (e) {
        return false;
    }
}

// Helper: create or update a single summary notification for a given date
export async function createOrUpdateSummaryNotification(dateStr: string, totalCount: number) {
    try {
        if (!dateStr) dateStr = new Date().toISOString().split('T')[0];
        const id = `summary_${dateStr}`;
        const title = `${totalCount} Notifications for today`;
        const message = `You have ${totalCount} items in the dashboard today.`;
        const ref = doc(db, 'notifications', id);
        await setDoc(ref, {
            title,
            message,
            type: 'summary',
            date: dateStr,
            createdAt: serverTimestamp(),
            readBy: [],
            category: 'summary',
            sourceCollection: 'summary',
            referenceId: null,
            count: totalCount
        }, { merge: true });

        // send local push as a single consolidated notification
        try {
            await sendLocalNotification(title, message, { type: 'summary', count: totalCount });
        } catch (e) { /* ignore */ }
    } catch (e) {
        console.warn('[NotificationService] createOrUpdateSummaryNotification failed:', e);
    }
}

// Helper: scan all monitored collections once for today's items and create notifications + summary
export async function scanAllCollectionsForTodayAndCreateSummary() {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const foundRefs: Array<{ col: string; id: string; data: any }> = [];

        for (const colName of MONITORED_COLLECTIONS) {
            try {
                if (colName === 'schedules') {
                    const snap = await getDocs(collection(db, colName));
                    snap.forEach(d => {
                        const data: any = d.data();
                        if (isItemForToday(colName, data)) foundRefs.push({ col: colName, id: d.id, data });
                    });
                } else if (colName === 'announcements') {
                    const q = query(collection(db, colName), where('startDate', '<=', todayStr), where('endDate', '>=', todayStr));
                    const snap = await getDocs(q);
                    snap.forEach(d => { if (isItemForToday(colName, d.data())) foundRefs.push({ col: colName, id: d.id, data: d.data() }); });
                } else {
                    const q = query(collection(db, colName), where('date', '==', todayStr));
                    const snap = await getDocs(q);
                    snap.forEach(d => { if (isItemForToday(colName, d.data())) foundRefs.push({ col: colName, id: d.id, data: d.data() }); });
                }
            } catch (e) {
                // ignore per-collection errors
            }
        }

        // create per-item notifications (if not present)
        let createdCount = 0;
        for (const f of foundRefs) {
            try {
                const existingByRefQ = query(
                    collection(db, 'notifications'),
                    where('referenceId', '==', f.id),
                    where('sourceCollection', '==', f.col),
                    limit(1)
                );
                const existingByRefSnap = await getDocs(existingByRefQ);
                if (!existingByRefSnap.empty) continue;

                const title = f.col === 'cash_reports'
                    ? `${(f.data.type === 'out' ? 'New Expense' : 'New Income')} • Rp ${Number(f.data.amount || 0).toLocaleString()}`
                    : (f.data.title ? String(f.data.title) : `${f.col} created`);
                const message = f.col === 'cash_reports'
                    ? `${f.data.category ?? 'Umum'} ${f.data.description ? '— ' + f.data.description : ''}`.trim()
                    : (f.data.message ?? f.data.content ?? f.data.description ?? '');

                const notifId = `${f.col}_${f.id}`;
                const notifRef = doc(db, 'notifications', notifId);
                await setDoc(notifRef, {
                    title,
                    message: message || '',
                    type: 'info',
                    date: new Date().toISOString(),
                    createdAt: serverTimestamp(),
                    readBy: [],
                    category: f.col,
                    sourceCollection: f.col,
                    referenceId: f.id,
                }, { merge: false });
                createdCount++;
            } catch (e) {
                // ignore per-item creation failures
            }
        }

        // create/update summary if there's more than one
        if (createdCount > 1) {
            await createOrUpdateSummaryNotification(todayStr, createdCount);
        }
    } catch (e) {
        console.warn('[NotificationService] scanAllCollectionsForTodayAndCreateSummary failed:', e);
    }
}

export async function registerForPushNotificationsAsync() {
    if (!Notifications) {
        console.log('[NotificationService] Notifications not available in Expo Go');
        return;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }
        // If we have permissions, try to get an Expo push token and save to Firestore so server can push
        try {
            const tokenObj = await Notifications.getExpoPushTokenAsync();
            const token = (tokenObj as any)?.data;
            if (token) {
                // store token in devices collection for this user (if auth available)
                try {
                    // lazy import to avoid cycles
                    const { auth } = require('../firebaseConfig');
                    const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
                    const uid = auth?.currentUser?.uid;
                    const deviceRef = doc(db, 'devices', token);
                    await setDoc(deviceRef, {
                        token,
                        type: 'expo',
                        platform: Platform.OS,
                        uid: uid || null,
                        createdAt: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    console.warn('[NotificationService] failed to save device token to Firestore', e);
                }
            }
        } catch (e) {
            console.warn('[NotificationService] getExpoPushTokenAsync failed', e);
        }
    } catch (e) {
        console.warn('[NotificationService] registerForPushNotificationsAsync error:', e);
    }
}

export async function sendLocalNotification(title: string, body: string, data: any = {}) {
    if (!Notifications) {
        console.log('[NotificationService] Local notification skipped (Expo Go):', title);
        return;
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
            },
            trigger: null, // immediate
        });
    } catch (e) {
        console.warn('[NotificationService] sendLocalNotification error:', e);
    }
}

export async function setBadgeCount(count: number) {
    if (!Notifications) {
        return;
    }

    try {
        await Notifications.setBadgeCountAsync(count);
    } catch (e) {
        console.warn('[NotificationService] setBadgeCount error:', e);
    }
}


export function startNotificationListeners() {
    // avoid starting listeners multiple times (e.g. hot-reload) per JS runtime
    if ((global as any).__NOTIF_SERVICE_STARTED__) {
        console.debug('[NotificationService] already started, skipping');
        return () => { /* noop */ };
    }
    (global as any).__NOTIF_SERVICE_STARTED__ = true;

    const unsubs: (() => void)[] = [];

    try {
        // Collections to monitor for inserts
        const MONITORED_COLLECTIONS = [
            'cash_reports',
            'announcements',
            'schedules',
            'activities',
            // add other collections you want to monitor here
        ];

        // track whether we've seen the initial snapshot for each collection
        const initialSeen: Record<string, boolean> = {};

        // Helper: create or update a single summary notification for a given date
        async function createOrUpdateSummaryNotification(dateStr: string, totalCount: number) {
            try {
                if (!dateStr) dateStr = new Date().toISOString().split('T')[0];
                const id = `summary_${dateStr}`;
                const title = `${totalCount} Notifications for today`;
                const message = `You have ${totalCount} items in the dashboard today.`;
                const ref = doc(db, 'notifications', id);
                await setDoc(ref, {
                    title,
                    message,
                    type: 'summary',
                    date: dateStr,
                    createdAt: serverTimestamp(),
                    readBy: [],
                    category: 'summary',
                    sourceCollection: 'summary',
                    referenceId: null,
                    count: totalCount
                }, { merge: true });

                // send local push as a single consolidated notification
                try {
                    await sendLocalNotification(title, message, { type: 'summary', count: totalCount });
                } catch (e) { /* ignore */ }
            } catch (e) {
                console.warn('[NotificationService] createOrUpdateSummaryNotification failed:', e);
            }
        }

        // Helper: scan all monitored collections once for today's items and create notifications + summary
        async function scanAllCollectionsForTodayAndCreateSummary() {
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                const foundRefs: Array<{ col: string; id: string; data: any }> = [];

                for (const colName of MONITORED_COLLECTIONS) {
                    try {
                        if (colName === 'schedules') {
                            const snap = await getDocs(collection(db, colName));
                            snap.forEach(d => {
                                const data: any = d.data();
                                if (isItemForToday(colName, data)) foundRefs.push({ col: colName, id: d.id, data });
                            });
                        } else if (colName === 'announcements') {
                            const q = query(collection(db, colName), where('startDate', '<=', todayStr), where('endDate', '>=', todayStr));
                            const snap = await getDocs(q);
                            snap.forEach(d => { if (isItemForToday(colName, d.data())) foundRefs.push({ col: colName, id: d.id, data: d.data() }); });
                        } else {
                            const q = query(collection(db, colName), where('date', '==', todayStr));
                            const snap = await getDocs(q);
                            snap.forEach(d => { if (isItemForToday(colName, d.data())) foundRefs.push({ col: colName, id: d.id, data: d.data() }); });
                        }
                    } catch (e) {
                        // ignore per-collection errors
                    }
                }

                // create per-item notifications (if not present)
                let createdCount = 0;
                for (const f of foundRefs) {
                    try {
                        const existingByRefQ = query(
                            collection(db, 'notifications'),
                            where('referenceId', '==', f.id),
                            where('sourceCollection', '==', f.col),
                            limit(1)
                        );
                        const existingByRefSnap = await getDocs(existingByRefQ);
                        if (!existingByRefSnap.empty) continue;

                        const title = f.col === 'cash_reports'
                            ? `${(f.data.type === 'out' ? 'New Expense' : 'New Income')} • Rp ${Number(f.data.amount || 0).toLocaleString()}`
                            : (f.data.title ? String(f.data.title) : `${f.col} created`);
                        const message = f.col === 'cash_reports'
                            ? `${f.data.category ?? 'Umum'} ${f.data.description ? '— ' + f.data.description : ''}`.trim()
                            : (f.data.message ?? f.data.content ?? f.data.description ?? '');

                        const notifId = `${f.col}_${f.id}`;
                        const notifRef = doc(db, 'notifications', notifId);
                        await setDoc(notifRef, {
                            title,
                            message: message || '',
                            type: 'info',
                            date: new Date().toISOString(),
                            createdAt: serverTimestamp(),
                            readBy: [],
                            category: f.col,
                            sourceCollection: f.col,
                            referenceId: f.id,
                        }, { merge: false });
                        createdCount++;
                    } catch (e) {
                        // ignore per-item creation failures
                    }
                }

                // create/update summary if there's more than one
                if (createdCount > 1) {
                    await createOrUpdateSummaryNotification(todayStr, createdCount);
                }
            } catch (e) {
                console.warn('[NotificationService] scanAllCollectionsForTodayAndCreateSummary failed:', e);
            }
        }

        // Helper: convert possible date representations into Date
        function toDateObject(d: any): Date | null {
            if (!d) return null;
            try {
                if (d?.toDate && typeof d.toDate === 'function') return d.toDate();
                if (typeof d === 'number') return new Date(d);
                if (typeof d === 'string') return new Date(d);
            } catch (e) {
                return null;
            }
            return null;
        }

        // Helper: check whether a doc should appear on the Dashboard for "today".
        function isItemForToday(colName: string, data: any): boolean {
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                switch (colName) {
                    case 'cash_reports': {
                        const d = data.date;
                        if (!d) return false;
                        const dObj = toDateObject(d);
                        if (dObj) return dObj.toISOString().split('T')[0] === todayStr && !data.deleted;
                        return String(d) === todayStr && !data.deleted;
                    }
                    case 'announcements': {
                        const sd = toDateObject(data.startDate);
                        const ed = toDateObject(data.endDate);
                        if (!sd || !ed) return false;
                        const today = new Date(todayStr);
                        return today >= sd && today <= ed;
                    }
                    case 'activities': {
                        const d = data.date;
                        if (!d) return false;
                        const dObj = toDateObject(d);
                        if (dObj) return dObj.toISOString().split('T')[0] === todayStr;
                        return String(d) === todayStr;
                    }
                    case 'schedules': {
                        const today = new Date();
                        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
                        const frequency = data.frequency || '';
                        const days = Array.isArray(data.days) ? data.days : [];
                        let createdAt: Date | undefined = undefined;
                        if (data.createdAt) {
                            const c = toDateObject(data.createdAt);
                            if (c) createdAt = c;
                        }
                        if (frequency === 'twice_week') {
                            if (days && days.length > 0) return days.includes(dayOfWeek);
                            const base = createdAt ?? today;
                            const baseIdx = base.getDay();
                            const secondIdx = (baseIdx + 3) % 7;
                            const todayIdx = today.getDay();
                            return todayIdx === baseIdx || todayIdx === secondIdx;
                        }
                        if (frequency === 'month_twice') {
                            const base = createdAt ?? new Date();
                            const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                            const diffMs = startOfDay(today).getTime() - startOfDay(base).getTime();
                            if (diffMs < 0) return false;
                            const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            if (daysDiff % 14 !== 0) return false;
                            if (days && days.length > 0) return days.includes(dayOfWeek);
                            return true;
                        }
                        if (frequency === 'quarter') {
                            const base = createdAt ?? new Date();
                            const yearDiff = today.getFullYear() - base.getFullYear();
                            const monthDiff = today.getMonth() - base.getMonth() + yearDiff * 12;
                            if (monthDiff < 0) return false;
                            if (monthDiff % 3 !== 0) return false;
                            const baseDay = base.getDate();
                            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                            const targetDay = Math.min(baseDay, daysInMonth);
                            if (today.getDate() !== targetDay) return false;
                            if (days && days.length > 0) return days.includes(dayOfWeek);
                            return true;
                        }
                        if (!days || days.length === 0) return true;
                        return days.includes(dayOfWeek);
                    }
                    default:
                        return false;
                }
            } catch (e) {
                return false;
            }
        }

        for (const colName of MONITORED_COLLECTIONS) {
            initialSeen[colName] = false;

            try {
                const q = query(collection(db, colName), /* optional ordering */ orderBy('createdAt', 'desc'));
                const unsub = onSnapshot(q, snap => {
                    // debug
                    console.debug(`[NotificationService] snapshot for ${colName}: size=${snap.size}`);

                    const changes = snap.docChanges();
                    // If this is the first snapshot, we will skip the per-collection
                    // initial scan; instead we run a single global scan which will
                    // create per-item notifications and a single summary (if applicable).
                    if (!initialSeen[colName]) {
                        initialSeen[colName] = true;
                        // mark all collections as seen and perform a single global scan
                        for (const c of MONITORED_COLLECTIONS) initialSeen[c] = true;
                        console.debug('[NotificationService] performing global initial scan for today across monitored collections');
                        scanAllCollectionsForTodayAndCreateSummary().catch(e => console.warn('[NotificationService] global initial scan failed:', e));
                    }

                    for (const change of changes) {
                        if (change.type === 'added') {
                            (async () => {
                                try {
                                    const data = change.doc.data() as any;
                                    // Only create a notification if the document qualifies for the Dashboard today
                                    if (!isItemForToday(colName, data)) {
                                        console.debug(`[NotificationService] new ${colName}/${change.doc.id} is not for today, skipping notification`);
                                        return;
                                    }
                                    // Build a concise notification payload
                                    const title =
                                        colName === 'cash_reports'
                                            ? `${(data.type === 'out' ? 'New Expense' : 'New Income')} • Rp ${Number(data.amount || 0).toLocaleString()}`
                                            : (data.title ? String(data.title) : `${colName} created`);
                                    const message =
                                        colName === 'cash_reports'
                                            ? `${data.category ?? 'Umum'} ${data.description ? '— ' + data.description : ''}`.trim()
                                            : (data.message ?? data.content ?? data.description ?? '');

                                    // 1) Preferential check: existing notification with same referenceId + sourceCollection
                                    const existingByRefQ = query(
                                        collection(db, 'notifications'),
                                        where('referenceId', '==', change.doc.id),
                                        where('sourceCollection', '==', colName),
                                        limit(1)
                                    );
                                    const existingByRefSnap = await getDocs(existingByRefQ);
                                    if (!existingByRefSnap.empty) {
                                        console.debug(`[NotificationService] notification already exists for ${colName}/${change.doc.id} by referenceId, skipping`);
                                        return;
                                    }

                                    // NOTE: removed fallback title-based dedupe to allow multiple notifications
                                    // for different documents that happen to have identical titles/messages.
                                    // Only referenceId-based dedupe is applied above.

                                    // Use deterministic notification ID to avoid duplicates if created elsewhere later
                                    const notifId = `${colName}_${change.doc.id}`;
                                    const notifRef = doc(db, 'notifications', notifId);

                                    await setDoc(notifRef, {
                                        title,
                                        message: message || '',
                                        type: 'info',
                                        date: new Date().toISOString(),
                                        createdAt: serverTimestamp(),
                                        readBy: [], // per-user read tracking
                                        category: colName,
                                        sourceCollection: colName,
                                        referenceId: change.doc.id,
                                    }, { merge: false });

                                    console.debug(`[NotificationService] created notification ${notifId} for new doc in ${colName}`);
                                    try {
                                        await sendLocalNotification(title, message, { type: colName, referenceId: change.doc.id });
                                    } catch (e) { /* ignore */ }

                                    // Update daily summary count for today (non-summary notifications)
                                    try {
                                        const today = new Date();
                                        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                                        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                                        const qCount = query(collection(db, 'notifications'), where('createdAt', '>=', Timestamp.fromDate(start)), where('createdAt', '<=', Timestamp.fromDate(end)));
                                        const snapCount = await getDocs(qCount);
                                        let count = 0;
                                        snapCount.forEach(nd => {
                                            const data: any = nd.data();
                                            if (String(data?.type ?? '') !== 'summary') count++;
                                        });
                                        if (count > 0) {
                                            await createOrUpdateSummaryNotification(today.toISOString().split('T')[0], count);
                                        }
                                    } catch (e) { /* ignore */ }
                                } catch (err) {
                                    console.warn(`[NotificationService] failed to create notification for ${colName}:`, err);
                                }
                            })();
                        }
                    }
                }, err => {
                    console.warn(`[NotificationService] listener error for ${colName}:`, err);
                });

                unsubs.push(unsub);
            } catch (e) {
                console.error(`[NotificationService] failed to start listener for ${colName}:`, e);
            }
        }
    } catch (e) {
        console.error('[NotificationService] Failed to start notification listeners:', e);
    }

    // Return cleanup function
    return () => {
        console.log('[NotificationService] Cleaning up listeners...');
        unsubs.forEach(u => u());
        // clear global started flag so service can be restarted cleanly (e.g. during HMR)
        try { (global as any).__NOTIF_SERVICE_STARTED__ = false; } catch { }
    };
}

// Try to auto-schedule the summary task by default when the listeners start
// (only schedule if not already scheduled)
try {
    if (!((global as any).__NOTIF_SERVICE_SUMMARY_SCHEDULE_ID__)) {
        // default schedule: 09:45 threshold 7
        scheduleDailySummaryTask({ hour: 9, minute: 45, threshold: 7 });
    }
} catch (e) { /* ignore */ }

// Helper: compute ms until next target hour:minute
function msUntilNext(hour: number, minute: number) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
        // next day
        next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
}

// Schedule a daily JS check that runs at hour:minute and triggers summary creation when app is active.
export function scheduleDailySummaryTask(opts?: { hour?: number; minute?: number; threshold?: number }) {
    const hour = opts?.hour ?? 9;
    const minute = opts?.minute ?? 45;
    const threshold = opts?.threshold ?? 7;

    // avoid multiple schedules
    if ((global as any).__NOTIF_SERVICE_SUMMARY_SCHEDULE_ID__) {
        console.debug('[NotificationService] daily summary task already scheduled, skipping');
        return () => { /* noop */ };
    }

    let intervalRef: any = null;
    const runNow = async () => {
        try {
            console.debug('[NotificationService] running scheduled daily summary task...');
            // use existing scanning utility to create per-item notifications and summary
            // We'll perform a global scan (which creates per item notifications and a summary when more than 1 found).
            // If less than threshold, delete summary doc to avoid false summary.
            await scanAllCollectionsForTodayAndCreateSummary();
            // Now count the number of non-summary notifications for today.
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                const start = new Date(todayStr + 'T00:00:00.000Z');
                const end = new Date(todayStr + 'T23:59:59.999Z');
                // Load notifications for today's range and count
                const qCount = query(collection(db, 'notifications'), where('createdAt', '>=', Timestamp.fromDate(start)), where('createdAt', '<=', Timestamp.fromDate(end)));
                const snapCount = await getDocs(qCount);
                let count = 0;
                snapCount.forEach(nd => {
                    const data: any = nd.data();
                    if (String(data?.type ?? '') !== 'summary') count++;
                });
                if (count >= threshold) {
                    await createOrUpdateSummaryNotification(todayStr, count);
                }
            } catch (e) { /* ignore counting issues */ }
        } catch (e) {
            console.warn('[NotificationService] scheduled daily summary run failed:', e);
        }
    };

    const runAtNext = async () => {
        const delay = msUntilNext(hour, minute);
        console.debug('[NotificationService] scheduling daily summary run in ms', delay);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const timeoutRef = setTimeout(async () => {
            await runNow();
            // schedule interval for every 24 hours
            intervalRef = setInterval(async () => {
                await runNow();
            }, 24 * 60 * 60 * 1000);
            (global as any).__NOTIF_SERVICE_SUMMARY_INTERVAL_REF__ = intervalRef;
        }, delay);
        (global as any).__NOTIF_SERVICE_SUMMARY_TIMEOUT_REF__ = timeoutRef;
    };

    // schedule fallback OS notification for 9:45 so there is always at least a simple push even if app not running.
    let scheduledFallbackId: string | null = null;
    (async () => {
        try {
            if (Notifications) {
                // remove previous if exists
                if ((global as any).__NOTIF_SERVICE_SUMMARY_FALLBACK_ID__) {
                    try { await Notifications.cancelScheduledNotificationAsync((global as any).__NOTIF_SERVICE_SUMMARY_FALLBACK_ID__); } catch { }
                }
                const trigger = { hour, minute, repeats: true } as any;
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: 'Dashboard summary',
                        body: 'Check dashboard for notifications',
                        data: { type: 'summary_fallback' }
                    },
                    trigger
                });
                scheduledFallbackId = id;
                (global as any).__NOTIF_SERVICE_SUMMARY_FALLBACK_ID__ = id;
            }
        } catch (e) { console.warn('[NotificationService] scheduling fallback OS notification failed', e); }
    })();

    // Start JS scheduling
    runAtNext();
    (global as any).__NOTIF_SERVICE_SUMMARY_SCHEDULE_ID__ = true;

    // Cancellation function
    const cancel = () => {
        try { clearTimeout((global as any).__NOTIF_SERVICE_SUMMARY_TIMEOUT_REF__); } catch { }
        try { clearInterval((global as any).__NOTIF_SERVICE_SUMMARY_INTERVAL_REF__); } catch { }
        (global as any).__NOTIF_SERVICE_SUMMARY_SCHEDULE_ID__ = false;
        if (scheduledFallbackId && Notifications) {
            try { Notifications.cancelScheduledNotificationAsync(scheduledFallbackId); } catch { }
        }
    };
    (global as any).__NOTIF_SERVICE_SUMMARY_CANCEL__ = cancel;
    return cancel;
}

export function cancelDailySummaryTask() {
    try {
        const c = (global as any).__NOTIF_SERVICE_SUMMARY_CANCEL__;
        if (typeof c === 'function') c();
    } catch (e) { /* ignore */ }
}
