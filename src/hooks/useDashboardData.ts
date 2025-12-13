import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';

export type CashItem = { id: string; type: 'in' | 'out'; date: string; amount: number; category?: string; description?: string; deleted?: boolean };
export type Announcement = { id: string; title: string; content: string; startDate?: string; endDate?: string; date?: string; role?: string; category?: string; description?: string };
export type Schedule = { id: string; activityName: string; time?: string; frequency?: string; days?: string[]; location?: string; description?: string; createdAt?: any };
export type Activity = { id: string; title: string; location?: string; date?: string; time?: string; description?: string };

export const useDashboardData = (refreshTrigger: number = 0, currentUserId?: string | null) => {
    const [cash, setCash] = useState<CashItem[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    const getTodayString = () => new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!currentUserId) {
            // If user is not authenticated, clear any data and don't start listeners.
            setCash([]);
            setAnnouncements([]);
            setSchedules([]);
            setActivities([]);
            setLoading(false);
            return;
        }
        const subs: (() => void)[] = [];
        let loadedCount = 0;
        const totalSubs = 4;

        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalSubs) setLoading(false);
        };

        try {
            const qCash = query(collection(db, 'cash_reports'), orderBy('createdAt', 'desc'));
            const unsubCash = onSnapshot(qCash, snap => {
                const todayStr = getTodayString();
                const rows: CashItem[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        type: data.type || 'in',
                        date: data.date || '',
                        amount: Number(data.amount) || 0,
                        category: data.category || '',
                        description: data.description || '',
                        deleted: !!data.deleted,
                    };
                }).filter(item => !item.deleted && item.date === todayStr);
                setCash(rows);
                checkLoaded();
            }, err => {
                console.warn('cash_reports snapshot err', err);
                if ((err as any)?.code === 'permission-denied') {
                    console.warn('[useDashboardData] permission-denied reading cash_reports. Ensure user is authenticated and Firestore rules allow read for this user. For local testing you can temporarily loosen rules in Firebase console.');
                }
                checkLoaded();
            });
            subs.push(unsubCash);
        } catch (e) { checkLoaded(); }

        try {
            const qAnn = query(collection(db, 'announcements'), orderBy('date', 'desc'));
            const unsubAnn = onSnapshot(qAnn, snap => {
                const todayStr = getTodayString();
                const rows: Announcement[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        title: data.title ?? '',
                        content: data.content ?? '',
                        startDate: data.startDate ?? '',
                        endDate: data.endDate ?? '',
                        date: data.date ?? '',
                        role: data.role ?? '',
                        category: data.category ?? '',
                        description: data.description ?? data.desc ?? data.details ?? data.body ?? '',
                    };
                }).filter(item => {
                    if (!item.startDate || !item.endDate) return false;
                    const today = new Date(todayStr);
                    const start = new Date(item.startDate);
                    const end = new Date(item.endDate);
                    return today >= start && today <= end;
                });
                setAnnouncements(rows);
                checkLoaded();
            }, err => {
                console.warn('announcements snapshot err', err);
                if ((err as any)?.code === 'permission-denied') {
                    console.warn('[useDashboardData] permission-denied reading announcements. Ensure user is authenticated and Firestore rules allow read for this user.');
                }
                checkLoaded();
            });
            subs.push(unsubAnn);
        } catch (e) { checkLoaded(); }

        try {
            const qSched = query(collection(db, 'schedules'), orderBy('createdAt', 'desc'));
            const unsubSched = onSnapshot(qSched, snap => {
                const today = new Date();
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
                const rows: Schedule[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    let createdAt: Date | undefined = undefined;
                    if (data.createdAt) {
                        try {
                            createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                        } catch (e) {
                            createdAt = new Date(data.createdAt);
                        }
                    }
                    return {
                        id: d.id,
                        activityName: data.activityName ?? '',
                        time: data.time ?? '',
                        frequency: data.frequency ?? '',
                        days: Array.isArray(data.days) ? data.days : [],
                        location: data.location ?? '',
                        description: data.description ?? data.desc ?? data.details ?? data.body ?? '',
                        createdAt,
                    };
                }).filter(item => {
                    const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

                    if (item.frequency === 'twice_week') {
                        if (item.days && item.days.length > 0) return item.days.includes(dayOfWeek);
                        const base = item.createdAt ?? today;
                        const baseIdx = base.getDay();
                        const secondIdx = (baseIdx + 3) % 7;
                        const todayIdx = today.getDay();
                        return todayIdx === baseIdx || todayIdx === secondIdx;
                    }

                    if (item.frequency === 'month_twice') {
                        const base = item.createdAt ?? startOfDay(new Date());
                        const diffMs = startOfDay(today).getTime() - startOfDay(base).getTime();
                        if (diffMs < 0) return false;
                        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        if (daysDiff % 14 !== 0) return false;
                        if (item.days && item.days.length > 0) return item.days.includes(dayOfWeek);
                        return true;
                    }

                    if (item.frequency === 'quarter') {
                        const base = item.createdAt ?? new Date();
                        const yearDiff = today.getFullYear() - base.getFullYear();
                        const monthDiff = today.getMonth() - base.getMonth() + yearDiff * 12;
                        if (monthDiff < 0) return false;
                        if (monthDiff % 3 !== 0) return false;
                        const baseDay = base.getDate();
                        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                        const targetDay = Math.min(baseDay, daysInMonth);
                        if (today.getDate() !== targetDay) return false;
                        if (item.days && item.days.length > 0) return item.days.includes(dayOfWeek);
                        return true;
                    }

                    if (!item.days || item.days.length === 0) return true;
                    return item.days.includes(dayOfWeek);
                });
                setSchedules(rows);
                checkLoaded();
            }, err => {
                console.warn('schedules snapshot err', err);
                if ((err as any)?.code === 'permission-denied') {
                    console.warn('[useDashboardData] permission-denied reading schedules. Ensure user is authenticated and Firestore rules allow read for this user.');
                }
                checkLoaded();
            });
            subs.push(unsubSched);
        } catch (e) { checkLoaded(); }

        try {
            const qAct = query(collection(db, 'activities'), orderBy('date', 'desc'));
            const unsubAct = onSnapshot(qAct, snap => {
                const todayStr = getTodayString();
                const rows: Activity[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        title: data.title ?? '',
                        location: data.location ?? '',
                        date: data.date ?? '',
                        time: data.time ?? '',
                        description: data.description ?? data.desc ?? data.details ?? data.body ?? '',
                    };
                }).filter(item => item.date === todayStr);
                setActivities(rows);
                checkLoaded();
            }, err => {
                console.warn('activities snapshot err', err);
                if ((err as any)?.code === 'permission-denied') {
                    console.warn('[useDashboardData] permission-denied reading activities. Ensure user is authenticated and Firestore rules allow read for this user.');
                }
                checkLoaded();
            });
            subs.push(unsubAct);
        } catch (e) { checkLoaded(); }

        return () => subs.forEach(u => u());
    }, [refreshTrigger, currentUserId]);

    return { cash, announcements, schedules, activities, loading };
};
