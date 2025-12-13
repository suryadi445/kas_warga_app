# Firebase Cloud Functions for kas_warga

This folder contains a scheduled Cloud Function that runs daily at 09:45 (Asia/Jakarta) to:

1. Scan monitored collections (cash_reports, announcements, schedules, activities) for "today" items
2. Create per-item notification documents in `notifications` if not already present
3. Create a summary notification `notifications/summary_<YYYY-MM-DD>` if the number of created notifications >= threshold
4. Send push notifications using Expo push tokens stored in `devices` collection

## Deploy

Install deps and deploy:

```bash
cd functions
npm install
npx firebase-tools deploy --only functions:dailyDashboardSummary
```

Note: set `SUMMARY_THRESHOLD` env var in Cloud Functions to override default 7 if needed.

## CI / GitHub Actions
If you want to automatically deploy your function on push, add a GitHub secret `FIREBASE_TOKEN` (generated via `firebase login:ci`) and `FIREBASE_PROJECT` with your project id. A sample workflow is included in `.github/workflows/deploy-functions.yml`.

## Note on permissions & billing
- Deploying Cloud Functions requires proper IAM roles. Ensure the account used for deploying has `roles/iam.serviceAccountUser`.
- Scheduled cron (Cloud Scheduler) may require a billing-enabled Firebase project (Blaze plan).

## How push tokens are used

Clients should store Expo push tokens into Firestore `devices` collection (this project saves them during registration).
The scheduled function reads `devices` and sends expo push notifications using `expo-server-sdk`.
