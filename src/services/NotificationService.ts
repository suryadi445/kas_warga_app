import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

type Notification = {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    date: string;
    read: boolean;
    category?: string;
    sourceCollection?: string;
};

// Helper: get today string
const getTodayString = () => new Date().toISOString().split('T')[0];

// Helper: save notification to Firestore
async function saveNotificationToFirestore(notif: Notification) {
    try {
        const ref = doc(db, 'notifications', notif.id);
        // Always create new notification with read: false (since we only process 'added' docs)
        await setDoc(ref, {
            title: notif.title,
            message: notif.message,
            type: notif.type,
            date: notif.date,
            read: false,
            category: notif.category,
            sourceCollection: notif.sourceCollection,
        });
    } catch (e) {
        console.error('Failed to save notification:', e);
    }
}

// Start notification listeners (call this once on app start)
export function startNotificationListeners() {
    const unsubs: (() => void)[] = [];
    const todayStr = getTodayString();

    // Listen to Cash Reports
    const qCash = query(collection(db, 'cash_reports'), orderBy('createdAt', 'desc'));
    const unsubCash = onSnapshot(qCash, snap => {
        snap.docChanges()
            .filter(change => change.type === 'added') // ONLY process newly added docs
            .map(change => change.doc)
            .filter(d => {
                const data = d.data() as any;
                return !data.deleted && data.date === todayStr;
            })
            .forEach(d => {
                const data = d.data() as any;
                const amount = Number(data.amount) || 0;
                const type = data.type || 'in';
                const notifId = `cash_${d.id}`;
                const notif: Notification = {
                    id: notifId,
                    title: type === 'in' ? 'Cash In Transaction' : 'Cash Out Transaction',
                    message: `${data.category || 'Transaction'}: Rp ${amount.toLocaleString()} - ${data.description || 'No description'}`,
                    type: type === 'in' ? 'success' : 'info',
                    date: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
                    read: false,
                    category: 'Cash',
                    sourceCollection: 'cash_reports'
                };
                saveNotificationToFirestore(notif);
            });
    });
    unsubs.push(unsubCash);

    // Listen to Announcements
    const qAnn = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubAnn = onSnapshot(qAnn, snap => {
        snap.docChanges()
            .filter(change => change.type === 'added')
            .map(change => change.doc)
            .filter(d => {
                const data = d.data() as any;
                if (!data.startDate || !data.endDate) return false;
                const today = new Date(todayStr);
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                return today >= start && today <= end;
            })
            .forEach(d => {
                const data = d.data() as any;
                const notifId = `ann_${d.id}`;
                const notif: Notification = {
                    id: notifId,
                    title: 'New Announcement',
                    message: `${data.title}: ${data.content}`,
                    type: 'info',
                    date: data.date || new Date().toISOString(),
                    read: false,
                    category: 'Announcement',
                    sourceCollection: 'announcements'
                };
                saveNotificationToFirestore(notif);
            });
    });
    unsubs.push(unsubAnn);

    // Listen to Schedules
    const qSched = query(collection(db, 'schedules'), orderBy('createdAt', 'desc'));
    const unsubSched = onSnapshot(qSched, snap => {
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        snap.docChanges()
            .filter(change => change.type === 'added')
            .map(change => change.doc)
            .filter(d => {
                const data = d.data() as any;
                if (!data.days || data.days.length === 0) return true;
                return data.days.includes(dayOfWeek);
            })
            .forEach(d => {
                const data = d.data() as any;
                const notifId = `sched_${d.id}`;
                const notif: Notification = {
                    id: notifId,
                    title: 'Schedule Reminder',
                    message: `${data.activityName} today at ${data.time || 'TBD'} - ${data.location || 'No location'}`,
                    type: 'info',
                    date: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
                    read: false,
                    category: 'Schedule',
                    sourceCollection: 'schedules'
                };
                saveNotificationToFirestore(notif);
            });
    });
    unsubs.push(unsubSched);

    // Listen to Activities
    const qAct = query(collection(db, 'activities'), orderBy('date', 'desc'));
    const unsubAct = onSnapshot(qAct, snap => {
        snap.docChanges()
            .filter(change => change.type === 'added')
            .map(change => change.doc)
            .filter(d => {
                const data = d.data() as any;
                return data.date === todayStr;
            })
            .forEach(d => {
                const data = d.data() as any;
                const notifId = `act_${d.id}`;
                const notif: Notification = {
                    id: notifId,
                    title: 'Activity Today',
                    message: `${data.title} at ${data.time || 'TBD'} - ${data.location || 'No location'}`,
                    type: 'warning',
                    date: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
                    read: false,
                    category: 'Activity',
                    sourceCollection: 'activities'
                };
                saveNotificationToFirestore(notif);
            });
    });
    unsubs.push(unsubAct);

    // Return cleanup function
    return () => unsubs.forEach(u => u());
}
