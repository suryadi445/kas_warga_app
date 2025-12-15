import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

// Get current app version from Constants (using expoConfig which is the modern approach)
export function getCurrentAppVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
}

export function getCurrentBuildNumber(): string {
    if (Platform.OS === 'ios') {
        return Constants.expoConfig?.ios?.buildNumber || '1';
    }
    return Constants.expoConfig?.android?.versionCode?.toString() || '1';
}

// Version info stored in Firebase
export interface VersionInfo {
    version: string;
    buildNumber: string;
    releaseNotes?: string;
    mandatory?: boolean;
    updateUrl?: string;
    publishedAt?: any;
    publishedBy?: string;
}

// Check if new version is available
export function isNewerVersion(currentVersion: string, remoteVersion: string): boolean {
    const current = currentVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(current.length, remote.length); i++) {
        const c = current[i] || 0;
        const r = remote[i] || 0;
        if (r > c) return true;
        if (r < c) return false;
    }
    return false;
}

// Fetch latest version from Firebase
export async function getLatestVersionFromFirebase(): Promise<VersionInfo | null> {
    try {
        const ref = doc(db, 'settings', 'app_version');
        const snap = await getDoc(ref);

        if (snap.exists()) {
            return snap.data() as VersionInfo;
        }
        return null;
    } catch (error) {
        console.warn('[VersionService] Failed to fetch version from Firebase:', error);
        return null;
    }
}

// Publish new version to Firebase (called after build)
export async function publishVersionToFirebase(
    releaseNotes?: string,
    mandatory?: boolean,
    updateUrl?: string,
    publishedBy?: string
): Promise<boolean> {
    try {
        const ref = doc(db, 'settings', 'app_version');
        const versionData: VersionInfo = {
            version: getCurrentAppVersion(),
            buildNumber: getCurrentBuildNumber(),
            releaseNotes: releaseNotes || '',
            mandatory: mandatory || false,
            updateUrl: updateUrl || '',
            publishedAt: serverTimestamp(),
            publishedBy: publishedBy || 'Unknown',
        };

        await setDoc(ref, versionData);
        console.log('[VersionService] Version published to Firebase:', versionData);
        return true;
    } catch (error) {
        console.error('[VersionService] Failed to publish version to Firebase:', error);
        return false;
    }
}

// Check for update and return result
export interface UpdateCheckResult {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes?: string;
    mandatory?: boolean;
    updateUrl?: string;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
    const currentVersion = getCurrentAppVersion();
    const latestInfo = await getLatestVersionFromFirebase();

    if (!latestInfo) {
        return {
            hasUpdate: false,
            currentVersion,
            latestVersion: currentVersion,
        };
    }

    const hasUpdate = isNewerVersion(currentVersion, latestInfo.version);

    return {
        hasUpdate,
        currentVersion,
        latestVersion: latestInfo.version,
        releaseNotes: latestInfo.releaseNotes,
        mandatory: latestInfo.mandatory,
        updateUrl: latestInfo.updateUrl,
    };
}

// Track when user dismissed update (for non-mandatory updates)
const LAST_DISMISSED_VERSION_KEY = 'last_dismissed_version';

export async function dismissUpdateForVersion(version: string): Promise<void> {
    try {
        await AsyncStorage.setItem(LAST_DISMISSED_VERSION_KEY, version);
    } catch (error) {
        console.warn('[VersionService] Failed to save dismissed version:', error);
    }
}

export async function getLastDismissedVersion(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LAST_DISMISSED_VERSION_KEY);
    } catch (error) {
        console.warn('[VersionService] Failed to get dismissed version:', error);
        return null;
    }
}
