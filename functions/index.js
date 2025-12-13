const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const moment = require('moment-timezone');

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = require('firebase-admin/firestore');
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
    .schedule('15 6 * * *') // 06:15
    .timeZone('Asia/Jakarta')
    .onRun(async (context) => {
        console.log('dailyDashboardSummary triggered', new Date().toISOString());
        const jakartaNow = moment().tz('Asia/Jakarta');
        const todayStr = toDateStringJakarta(jakartaNow);
        const threshold = process.env.SUMMARY_THRESHOLD ? Number(process.env.SUMMARY_THRESHOLD) : 1;

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
                    // Avoid composite index requirement by querying only one range field (endDate >= today)
                    // and filtering the other (startDate <= today) in memory.
                    const snap = await db.collection(col).where('endDate', '>=', todayStr).get();
                    snap.forEach(d => {
                        const data = d.data();
                        // Manual check for startDate <= todayStr (string comparison works for YYYY-MM-DD)
                        if (data.startDate && data.startDate <= todayStr) {
                            if (isItemForToday(col, data, jakartaNow)) found.push({ col, id: d.id, data });
                        }
                    });
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
                            createdAt: FieldValue.serverTimestamp(),
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

            console.log(`Summary check: found=${found.length}, createdNew=${createdCount}, threshold=${threshold}`);

            // create summary if threshold met (based on TOTAL items found today, not just new ones)
            if (found.length >= threshold) {
                // Skip creating persistent summary notification in Firestore as per user request.
                // Only send push notification.
                console.log('Threshold met, preparing push notifications...');

                // send push to all known devices (expo tokens)
                try {
                    const tokensSnap = await db.collection('devices').get();
                    const messages = [];
                    tokensSnap.forEach(d => {
                        const data = d.data();
                        if (data && data.token && String(data.type || '').toLowerCase() === 'expo') {
                            messages.push({
                                to: data.token,
                                title: `${found.length} Notifications for today`,
                                body: `You have ${found.length} items notification today.`,
                                data: { type: 'summary' }
                            });
                        }
                    });

                    console.log(`Found ${messages.length} devices to send push to.`);

                    if (messages.length > 0) {
                        await sendExpoNotifications(messages);
                    }
                } catch (e) {
                    console.warn('sendExpoNotifications failed', e);
                }
            } else {
                console.log('Threshold not met, skipping summary push.');
            }

            console.log('dailyDashboardSummary completed');
        } catch (e) {
            console.error('dailyDashboardSummary failed', e);
        }

        return null;
    });

// HTTP endpoint for sending push notifications (workaround for React Native auth issue)
exports.sendPushHTTP = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log('sendPush called via HTTP');

    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('No Authorization header or invalid format');
            res.status(401).json({ error: 'unauthenticated', message: 'Authentication required' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verify the ID token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
            console.log('Token verified, uid:', decodedToken.uid);
        } catch (err) {
            console.error('Token verification failed:', err);
            res.status(401).json({ error: 'unauthenticated', message: 'Invalid or expired token' });
            return;
        }

        // Check if caller is admin
        const callerSnap = await db.collection('users').doc(decodedToken.uid).get();
        const callerData = callerSnap.data();
        const role = callerData?.role || '';

        if (role !== 'admin' && role !== 'Admin') {
            console.error('User is not admin, role:', role);
            res.status(403).json({ error: 'permission-denied', message: 'Only admins can send broadcast notifications' });
            return;
        }

        console.log('Admin verified, proceeding with broadcast');

        // Extract data from request body
        const data = req.body.data || req.body;
        const title = String(data?.title || 'Notification');
        const body = String(data?.body || '');
        const payload = data?.data || {};
        const targetRole = data?.role || 'all'; // 'all', 'admin', 'member', 'staff'

        let targetUids = null;
        if (targetRole !== 'all') {
            console.log(`Fetching users with role: ${targetRole}`);
            const usersSnap = await db.collection('users').where('role', '==', targetRole).get();
            targetUids = new Set(usersSnap.docs.map(d => d.id));
            console.log(`Found ${targetUids.size} users with role ${targetRole}`);
        }

        const tokensSnap = await db.collection('devices').get();
        const messages = [];
        tokensSnap.forEach(d => {
            const docData = d.data();
            if (docData && docData.token && String(docData.type || '').toLowerCase() === 'expo') {
                // If targeting all, or if device uid matches a target uid
                if (targetUids === null || (docData.uid && targetUids.has(docData.uid))) {
                    messages.push({ to: docData.token, title, body, data: payload });
                }
            }
        });

        console.log(`Prepared ${messages.length} messages for role ${targetRole}`);

        if (messages.length === 0) {
            res.status(200).json({ result: { sent: 0 } });
            return;
        }

        await sendExpoNotifications(messages);

        // Save to history
        try {
            await db.collection('broadcasts').add({
                title,
                body,
                role: targetRole,
                sentCount: messages.length,
                createdAt: FieldValue.serverTimestamp(),
                senderUid: decodedToken.uid
            });
        } catch (err) {
            console.error('Failed to save broadcast history', err);
            // Don't fail the function if history save fails, as notifications are already sent
        }

        res.status(200).json({ result: { sent: messages.length } });
    } catch (e) {
        console.error('sendPush processing failed', e);
        res.status(500).json({ error: 'internal', message: 'Failed to send push notifications' });
    }
});
