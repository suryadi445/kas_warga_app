import {
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    signInWithEmailAndPassword,
    UserCredential,
} from 'firebase/auth';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Ensure proper typing when importing from a JS module that exports untyped values
const authInstance = auth as unknown as import('firebase/auth').Auth;
const dbInstance = db as unknown as import('firebase/firestore').Firestore;

// tipe response sederhana
type AuthResult = {
    success: boolean;
    user?: any;
    error?: string;
    code?: string | null;
    offline?: boolean; // new: indicates Firestore not reachable
};

// Tambahkan helper untuk pesan user-friendly berdasarkan kode error Firebase
function mapAuthError(code?: string | null, message?: string) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'Email already registered. Please login or use another email.';
        case 'auth/invalid-email':
            return 'Invalid email format.';
        case 'auth/weak-password':
            return 'Password is too weak. Use at least 6 characters.';
        case 'auth/user-not-found':
            return 'User not found. Please check your email or register first.';
        case 'auth/wrong-password':
            return 'Wrong password. Please try again.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check and try again.';
        case 'auth/configuration-not-found':
            return 'Authentication configuration not found. Check Firebase settings (Identity Toolkit API).';
        default:
            return message || 'An error occurred while processing your request.';
    }
};

// Sign up: buat auth user + simpan data di Firestore/users/{uid}
export const signUp = async (email: string, password: string, nama: string, phone = ''): Promise<AuthResult> => {
    try {
        const credential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = credential.user;

        // simpan data profil tambahan di Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            nama, // pastikan ini ada
            phone,
            role: 'Member',
            createdAt: serverTimestamp(),
        });

        console.log('User registered with nama:', nama); // debug log

        return { success: true, user: { uid: user.uid, email: user.email } };
    } catch (err: any) {
        console.error('signUp error:', err);
        const code = err?.code || null;
        const friendly = mapAuthError(code, err?.message);
        return {
            success: false,
            error: friendly,
            code,
        };
    }
};

// Helper: retry getDoc with timeout
async function getDocWithRetry(docRef: any, maxRetries = 3, timeoutMs = 10000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const promise = getDoc(docRef);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            );

            const snap = await Promise.race([promise, timeoutPromise]);
            return snap;
        } catch (err: any) {
            console.warn(`getDoc attempt ${i + 1} failed:`, err.message);
            if (i === maxRetries - 1) throw err;
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
}

// Sign in: menggunakan email & password
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = credential.user;

        // Try to read profile from Firestore with retry
        let profile = null;
        let isOffline = false;

        try {
            const docRef = doc(db, 'users', user.uid);
            const snap = await getDocWithRetry(docRef);
            profile = snap.exists() ? snap.data() : null;
        } catch (fireErr: any) {
            const msg = (fireErr?.message || '').toLowerCase();
            const code = fireErr?.code || '';

            isOffline =
                code === 'unavailable' ||
                code === 'failed-precondition' ||
                msg.includes('client is offline') ||
                msg.includes('network') ||
                msg.includes('timeout') ||
                msg.includes('failed to get document');

            console.warn('signIn: firestore read failed after retries', {
                code,
                message: fireErr?.message,
                isOffline
            });
        }

        return {
            success: true,
            user: { uid: user.uid, email: user.email, profile },
            offline: isOffline
        };

    } catch (err: any) {
        console.error('signIn error:', err);
        const code = err?.code || null;
        const friendly = mapAuthError(code, err?.message);
        return {
            success: false,
            error: friendly,
            code,
        };
    }
};

// Sign out
export const signOut = async (): Promise<AuthResult> => {
    try {
        await firebaseSignOut(authInstance);
        return { success: true };
    } catch (err: any) {
        console.error('signOut error:', err);
        return { success: false, error: err?.message || String(err), code: err?.code || null };
    }
};

// Get current user (synchronous)
export const getCurrentUser = () => {
    return authInstance.currentUser;
};

// New: check connection to Firebase (Firestore read + auth presence)
export const checkFirebaseConnection = async () => {
    try {
        // authInstance and dbInstance are defined earlier in this file
        const currentUser = authInstance?.currentUser || null;

        // perform a harmless read to verify Firestore connectivity
        const testRef = doc(dbInstance, '__health_check__', 'ping');
        const snap = await getDoc(testRef);

        return {
            success: true,
            authPresent: !!currentUser,
            firestoreReachable: true,
            docExists: snap.exists(),
        };
    } catch (err: any) {
        console.error('checkFirebaseConnection error:', err);
        return {
            success: false,
            error: err?.message || String(err),
            code: err?.code || null,
        };
    }
};

// Test Firestore connection (call from debug screen or console)
export const testFirestoreConnection = async () => {
    try {
        // Try to write a test document
        const testRef = await addDoc(collection(db, '_test_'), {
            timestamp: serverTimestamp(),
            test: true
        });
        console.log('Firestore write test success:', testRef.id);

        // Try to read it back
        const snap = await getDoc(doc(db, '_test_', testRef.id));
        console.log('Firestore read test success:', snap.exists());

        return { success: true, message: 'Firestore connected' };
    } catch (err: any) {
        console.error('Firestore test failed:', err);
        return { success: false, error: err.message, code: err.code };
    }
};
