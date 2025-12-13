import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { app, auth } from '../firebaseConfig';
import { useDashboardData } from '../hooks/useDashboardData';
import { areNotificationsAvailable, registerForPushNotificationsAsync, sendLocalNotification, setBadgeCount } from '../services/NotificationService';

export default function DashboardNotificationManager() {
    const { t } = useTranslation();
    const { showToast } = useToast();
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
        if (currentUserId) {
            registerForPushNotificationsAsync();
        }
    }, [currentUserId]);

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
        if (cash.length > lastCashCount.current && lastCashCount.current > 0) {
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
        if (announcements.length > lastAnnouncementCount.current && lastAnnouncementCount.current > 0) {
            const newCount = announcements.length - lastAnnouncementCount.current;
            console.log('DashboardNotificationManager: new announcements detected (skipping local push, NotificationService handles notifications)', { newCount });
            // NotificationService handles creating and sending notifications, so the manager skips local pushes.
        }
        lastAnnouncementCount.current = announcements.length;

        // Send notification for new schedules
        if (schedules.length > lastScheduleCount.current && lastScheduleCount.current > 0) {
            const newCount = schedules.length - lastScheduleCount.current;
            console.log('DashboardNotificationManager: new schedules detected', { newCount });
            // Run async notification logic in an IIFE to allow use of await
            (async () => {
                try {
                    const title = t('notification_new_schedule_title', { defaultValue: 'New schedule(s) added' });
                    const body = t('notification_new_schedule_body', { count: newCount, defaultValue: `${newCount} new schedule(s) added` });

                    // 1) Try server-side push via callable function
                    try {
                        const functions = getFunctions(app);
                        const sendPush = httpsCallable<{
                            title: string;
                            body: string;
                            data?: any;
                        }, { sent: number }>(functions, 'sendPush');
                        const res = await sendPush({ title, body, data: { type: 'schedules', count: newCount } });
                        const sent = (res?.data?.sent) ?? 0;
                        console.log('DashboardNotificationManager: sendPush result', sent);
                        if (sent > 0) {
                            // optionally show small toast to confirm
                            showToast(t('notification_push_sent', { count: sent, defaultValue: `${sent} push(s) sent` }), 'success');
                            // don't send local notification if push succeeded
                            return;
                        }
                    } catch (e) {
                        console.warn('DashboardNotificationManager: sendPush callable failed, falling back', e);
                    }

                    // 2) Fallback to local notification if available
                    if (areNotificationsAvailable()) {
                        try {
                            await sendLocalNotification(title, body, { type: 'schedules', count: newCount });
                        } catch (e) {
                            showToast(body, 'info');
                        }
                    } else {
                        // 3) Final fallback: in-app toast
                        showToast(body, 'info');
                    }
                } catch (e) {
                    console.warn('DashboardNotificationManager: failed to notify about new schedules', e);
                }
            })();
            // NotificationService also creates persistent notifications in Firestore, so manager only triggers local fallback
        }
        lastScheduleCount.current = schedules.length;

        // Send notification for new activities
        if (activities.length > lastActivityCount.current && lastActivityCount.current > 0) {
            const newCount = activities.length - lastActivityCount.current;
            console.log('DashboardNotificationManager: new activities detected (skipping local push, NotificationService handles notifications)', { newCount });
            // NotificationService handles creating and sending notifications, so the manager skips local pushes.
        }
        lastActivityCount.current = activities.length;

    }, [loading, cash, announcements, schedules, activities, t]);

    return null;
}
