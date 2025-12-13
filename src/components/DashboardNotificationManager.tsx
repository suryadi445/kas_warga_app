import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebaseConfig';
import { useDashboardData } from '../hooks/useDashboardData';
import { registerForPushNotificationsAsync, setBadgeCount } from '../services/NotificationService';

export default function DashboardNotificationManager() {
    const { t } = useTranslation();
    const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user: any) => setCurrentUserId(user ? user.uid : null));
        return unsub;
    }, []);
    const { cash, announcements, schedules, activities, loading } = useDashboardData(0, currentUserId);
    const lastCashCount = useRef<number>(-1);
    const lastAnnouncementCount = useRef<number>(-1);
    const lastScheduleCount = useRef<number>(-1);
    const lastActivityCount = useRef<number>(-1);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        registerForPushNotificationsAsync();
    }, []);

    useEffect(() => {
        if (loading) return;

        const totalCount = cash.length + announcements.length + schedules.length + activities.length;

        // Update badge count
        setBadgeCount(totalCount);

        // Skip first load to avoid spamming on app open
        if (isFirstLoad.current) {
            lastCashCount.current = cash.length;
            lastAnnouncementCount.current = announcements.length;
            lastScheduleCount.current = schedules.length;
            lastActivityCount.current = activities.length;
            isFirstLoad.current = false;
            return;
        }

        // DashboardNotificationManager will NOT send local notifications directly; NotificationService is the single source-of-truth
        if (cash.length > lastCashCount.current && lastCashCount.current >= 0) {
            const newCash = cash.slice(0, cash.length - lastCashCount.current);
            const inCount = newCash.filter(c => c.type === 'in').length;
            const outCount = newCash.filter(c => c.type === 'out').length;

            let body = '';
            if (inCount > 0 && outCount > 0) {
                body = t('notification_cash_mixed', { inCount, outCount, defaultValue: `${inCount} income, ${outCount} expense transactions today` });
            } else if (inCount > 0) {
                body = t('notification_cash_in', { count: inCount, defaultValue: `${inCount} new income transaction(s) today` });
            } else if (outCount > 0) {
                body = t('notification_cash_out', { count: outCount, defaultValue: `${outCount} new expense transaction(s) today` });
            }

            if (body) {
                console.log('DashboardNotificationManager: new cash detected (skipping local push, NotificationService handles notifications)', { inCount, outCount });
            }
        }
        lastCashCount.current = cash.length;

        // Send notification for new announcements
        if (announcements.length > lastAnnouncementCount.current && lastAnnouncementCount.current >= 0) {
            const newCount = announcements.length - lastAnnouncementCount.current;
            console.log('DashboardNotificationManager: new announcements detected (skipping local push, NotificationService handles notifications)', { newCount });
            // NotificationService handles creating and sending notifications, so the manager skips local pushes.
        }
        lastAnnouncementCount.current = announcements.length;

        // Send notification for new schedules
        if (schedules.length > lastScheduleCount.current && lastScheduleCount.current >= 0) {
            const newCount = schedules.length - lastScheduleCount.current;
            console.log('DashboardNotificationManager: new schedules detected (skipping local push, NotificationService handles notifications)', { newCount });
            // NotificationService handles creating and sending notifications, so the manager skips local pushes.
        }
        lastScheduleCount.current = schedules.length;

        // Send notification for new activities
        if (activities.length > lastActivityCount.current && lastActivityCount.current >= 0) {
            const newCount = activities.length - lastActivityCount.current;
            console.log('DashboardNotificationManager: new activities detected (skipping local push, NotificationService handles notifications)', { newCount });
            // NotificationService handles creating and sending notifications, so the manager skips local pushes.
        }
        lastActivityCount.current = activities.length;

    }, [loading, cash, announcements, schedules, activities, t]);

    return null;
}
