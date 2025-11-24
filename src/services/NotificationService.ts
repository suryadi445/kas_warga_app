import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Background notification listener service
 * This service ONLY READS notifications, it should NOT write/update any documents
 */
export function startNotificationListeners() {
    const unsubs: (() => void)[] = [];

    try {
        // Listen to notifications collection (READ ONLY)
        const q = query(collection(db, 'notifications'), orderBy('date', 'desc'));
        const unsubNotif = onSnapshot(q, snap => {
            // IMPORTANT: Only read data, do NOT call setDoc or updateDoc here
            const notifs = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // You can store in memory or trigger UI updates, but DO NOT write to Firestore
            console.log(`[NotificationService] Loaded ${notifs.length} notifications`);
        }, err => {
            console.warn('[NotificationService] Notification listener error:', err);
        });
        unsubs.push(unsubNotif);

    } catch (e) {
        console.error('[NotificationService] Failed to start notification listener:', e);
    }

    // Return cleanup function
    return () => {
        console.log('[NotificationService] Cleaning up listeners...');
        unsubs.forEach(u => u());
    };
}
