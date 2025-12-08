import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../hooks/useDashboardData';
import { registerForPushNotificationsAsync, sendLocalNotification, setBadgeCount } from '../services/NotificationService';

export default function DashboardNotificationManager() {
    const { t } = useTranslation();
    const { cash, announcements, schedules, activities, loading } = useDashboardData();
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

        // Send notification for new cash reports
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
                sendLocalNotification(
                    t('notification_cash_title', { defaultValue: '💰 Cash Report' }),
                    body,
                    { type: 'cash' }
                );
            }
        }
        lastCashCount.current = cash.length;

        // Send notification for new announcements
        if (announcements.length > lastAnnouncementCount.current && lastAnnouncementCount.current >= 0) {
            const newCount = announcements.length - lastAnnouncementCount.current;
            sendLocalNotification(
                t('notification_announcement_title', { defaultValue: '📢 Announcement' }),
                t('notification_announcement_body', { count: newCount, defaultValue: `${newCount} active announcement(s) today` }),
                { type: 'announcement' }
            );
        }
        lastAnnouncementCount.current = announcements.length;

        // Send notification for new schedules
        if (schedules.length > lastScheduleCount.current && lastScheduleCount.current >= 0) {
            const newCount = schedules.length - lastScheduleCount.current;
            sendLocalNotification(
                t('notification_schedule_title', { defaultValue: '📅 Schedule' }),
                t('notification_schedule_body', { count: newCount, defaultValue: `${newCount} schedule(s) for today` }),
                { type: 'schedule' }
            );
        }
        lastScheduleCount.current = schedules.length;

        // Send notification for new activities
        if (activities.length > lastActivityCount.current && lastActivityCount.current >= 0) {
            const newCount = activities.length - lastActivityCount.current;
            sendLocalNotification(
                t('notification_activity_title', { defaultValue: '🎯 Activity' }),
                t('notification_activity_body', { count: newCount, defaultValue: `${newCount} activity(ies) scheduled for today` }),
                { type: 'activity' }
            );
        }
        lastActivityCount.current = activities.length;

    }, [loading, cash, announcements, schedules, activities, t]);

    return null;
}
