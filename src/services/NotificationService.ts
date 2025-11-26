import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Background notification listener service
 * - Monitors a set of collections for newly added documents.
 * - Creates a notification document in "notifications" when a new document is inserted.
 * - Skips initial snapshot load to avoid creating notifications for existing documents.
 */

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

        for (const colName of MONITORED_COLLECTIONS) {
            initialSeen[colName] = false;

            try {
                const q = query(collection(db, colName), /* optional ordering */ orderBy('createdAt', 'desc'));
                const unsub = onSnapshot(q, snap => {
                    // debug
                    console.debug(`[NotificationService] snapshot for ${colName}: size=${snap.size}`);

                    const changes = snap.docChanges();
                    // If this is the first snapshot, mark seen and skip processing its 'added' items
                    if (!initialSeen[colName]) {
                        initialSeen[colName] = true;
                        console.debug(`[NotificationService] initial load for ${colName}, skipping ${changes.length} existing docs`);
                        return;
                    }

                    for (const change of changes) {
                        if (change.type === 'added') {
                            (async () => {
                                try {
                                    const data = change.doc.data() as any;
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
