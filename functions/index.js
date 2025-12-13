const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const moment = require('moment-timezone');

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

const MONITORED_COLLECTIONS = ['cash_reports', 'announcements', 'schedules', 'activities'];

function toDateStringJakarta(date) {
    // Return YYYY-MM-DD in Asia/Jakarta timezone
    return moment(date).tz('Asia/Jakarta').format('YYYY-MM-DD');
}

function isItemForToday(colName, data, jakartaNow) {
    try {
        const todayStr = toDateStringJakarta(jakartaNow);
        switch (colName) {
            case 'cash_reports': {
                const d = data.date;
                if (!d) return false;
                const ds = moment(d).tz('Asia/Jakarta').format('YYYY-MM-DD');
                return ds === todayStr && !data.deleted;
            }
            case 'announcements': {
                const sd = data.startDate ? moment(data.startDate).tz('Asia/Jakarta').startOf('day') : null;
                const ed = data.endDate ? moment(data.endDate).tz('Asia/Jakarta').startOf('day') : null;
                if (!sd || !ed) return false;
                const today = moment(jakartaNow).startOf('day');
                return today.isSameOrAfter(sd) && today.isSameOrBefore(ed);
            }
            case 'activities': {
                const d = data.date;
                if (!d) return false;
                const ds = moment(d).tz('Asia/Jakarta').format('YYYY-MM-DD');
                return ds === todayStr;
            }
            case 'schedules': {
                const dayOfWeek = moment(jakartaNow).tz('Asia/Jakarta').format('dddd');
                const freq = data.frequency || '';
                const days = Array.isArray(data.days) ? data.days : [];
                const createdAt = data.createdAt ? moment(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt).tz('Asia/Jakarta') : null;

                if (freq === 'twice_week') {
                    if (days && days.length > 0) return days.includes(dayOfWeek);
                    const base = createdAt || moment(jakartaNow);
                    const baseIdx = base.day();
                    const secondIdx = (baseIdx + 3) % 7;
                    const todayIdx = moment(jakartaNow).day();
                    return todayIdx === baseIdx || todayIdx === secondIdx;
                }

                if (freq === 'month_twice') {
                    const base = createdAt || moment(jakartaNow);
                    const diffDays = Math.floor(moment(jakartaNow).startOf('day').diff(base.startOf('day'), 'days'));
                    if (diffDays < 0) return false;
                    if (diffDays % 14 !== 0) return false;
                    if (days && days.length > 0) return days.includes(dayOfWeek);
                    return true;
                }

                if (freq === 'quarter') {
                    const base = createdAt || moment(jakartaNow);
                    const months = (moment(jakartaNow).year() - base.year()) * 12 + (moment(jakartaNow).month() - base.month());
                    if (months < 0) return false;
                    if ((months % 3) !== 0) return false;
                    const baseDay = base.date();
                    const daysInMonth = moment(jakartaNow).daysInMonth();
                    const target = Math.min(baseDay, daysInMonth);
                    if (moment(jakartaNow).date() !== target) return false;
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
        console.warn('isItemForToday error', e);
        return false;
    }
}

async function sendExpoNotifications(messages) {
    // messages: [{ to, title, body, data }]
    const chunks = expo.chunkPushNotifications(messages.map(m => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data || {}
    })));

    for (const chunk of chunks) {
        try {
            const receipts = await expo.sendPushNotificationsAsync(chunk);
            // receipts can be logged or processed for errors
            console.log('expo receipts', receipts.slice(0, 5));
        } catch (e) {
            console.error('expo send error', e);
        }
    }
}

exports.dailyDashboardSummary = functions.pubsub
    .schedule('45 9 * * *') // 09:45
    .timeZone('Asia/Jakarta')
    .onRun(async (context) => {
        console.log('dailyDashboardSummary triggered', new Date().toISOString());
        const jakartaNow = moment().tz('Asia/Jakarta');
        const todayStr = toDateStringJakarta(jakartaNow);
        const threshold = process.env.SUMMARY_THRESHOLD ? Number(process.env.SUMMARY_THRESHOLD) : 7;

        try {
            const found = [];

            for (const col of MONITORED_COLLECTIONS) {
                if (col === 'schedules') {
                    const snap = await db.collection(col).get();
                    snap.forEach(d => {
                        const data = d.data();
                        if (isItemForToday(col, data, jakartaNow)) found.push({ col, id: d.id, data });
                    });
                } else if (col === 'announcements') {
                    const snap = await db.collection(col).where('startDate', '<=', todayStr).where('endDate', '>=', todayStr).get();
                    snap.forEach(d => { if (isItemForToday(col, d.data(), jakartaNow)) found.push({ col, id: d.id, data: d.data() }); });
                } else {
                    const snap = await db.collection(col).where('date', '==', todayStr).get();
                    snap.forEach(d => { if (isItemForToday(col, d.data(), jakartaNow)) found.push({ col, id: d.id, data: d.data() }); });
                }
            }

            // create per-item notifications if not exists
            let createdCount = 0;
            for (const f of found) {
                try {
                    const notifId = `${f.col}_${f.id}`;
                    const notifRef = db.collection('notifications').doc(notifId);
                    const existing = await notifRef.get();
                    if (!existing.exists) {
                        const title = f.col === 'cash_reports' ? `${(f.data.type === 'out' ? 'New Expense' : 'New Income')} • Rp ${Number(f.data.amount || 0).toLocaleString()}` : (f.data.title || `${f.col} created`);
                        const message = f.col === 'cash_reports' ? `${f.data.category ?? 'Umum'} ${f.data.description ? '— ' + f.data.description : ''}`.trim() : (f.data.message ?? f.data.content ?? f.data.description ?? '');
                        await notifRef.set({
                            title,
                            message,
                            type: 'info',
                            date: new Date().toISOString(),
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            readBy: [],
                            category: f.col,
                            sourceCollection: f.col,
                            referenceId: f.id
                        });
                        createdCount++;
                    }
                } catch (e) {
                    console.warn('per-item create failed', e);
                }
            }

            // create summary if threshold met
            if (createdCount >= threshold) {
                const summaryId = `summary_${todayStr}`;
                await db.collection('notifications').doc(summaryId).set({
                    title: `${createdCount} Notifications for today`,
                    message: `You have ${createdCount} items on the dashboard today.`,
                    type: 'summary',
                    date: todayStr,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    readBy: [],
                    category: 'summary',
                    sourceCollection: 'summary',
                    referenceId: null,
                    count: createdCount
                }, { merge: true });

                // send push to all known devices (expo tokens)
                try {
                    const tokensSnap = await db.collection('devices').get();
                    const messages = [];
                    tokensSnap.forEach(d => {
                        const data = d.data();
                        if (data && data.token && String(data.type || '').toLowerCase() === 'expo') {
                            messages.push({ to: data.token, title: `${createdCount} Notifications for today`, body: `You have ${createdCount} items on the dashboard today.`, data: { type: 'summary' } });
                        }
                    });

                    if (messages.length > 0) {
                        await sendExpoNotifications(messages);
                    }
                } catch (e) {
                    console.warn('sendExpoNotifications failed', e);
                }
            }

            console.log('dailyDashboardSummary completed', { found: found.length, createdCount });
        } catch (e) {
            console.error('dailyDashboardSummary failed', e);
        }

        return null;
    });
