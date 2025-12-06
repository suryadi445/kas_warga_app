// Import the functions you need from the SDKs you need
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore, initializeFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyD7VYiv1DKcbSrU9YYb6VcqkKkvCb8xOHg",
    authDomain: "masjid-app-df8c8.firebaseapp.com",
    projectId: "masjid-app-df8c8",
    storageBucket: "masjid-app-df8c8.firebasestorage.app",
    messagingSenderId: "111955001223",
    appId: "1:111955001223:web:915630ca1e6b87b61f9d22",
    measurementId: "G-7HQQRLVZ9F"
};

// Initialize Firebase app (avoid double init)
const app: FirebaseApp = getApps().length ? (getApps()[0] as FirebaseApp) : initializeApp(firebaseConfig);

// Initialize Auth - simple approach without persistence config
let auth: Auth;
try {
    auth = getAuth(app);
    console.log('Auth initialized successfully');
} catch (e: any) {
    console.error('Failed to initialize auth:', e);
    auth = getAuth(app);
}

// Initialize Firestore with proper error handling
let db: Firestore;
try {
    db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
    });
    console.log('Firestore initialized successfully');
} catch (e: any) {
    if (e?.code === 'firestore/already-initialized' || e?.message?.includes('already initialized')) {
        console.warn('Firestore already initialized, using existing instance');
        db = getFirestore(app);
    } else {
        console.error('Firestore initialization warning:', e.message);
        db = getFirestore(app);
    }
}

// Initialize Firebase Storage
let storage: FirebaseStorage;
try {
    storage = getStorage(app);
    console.log('Storage initialized successfully');
} catch (e: any) {
    console.error('Storage initialization error:', e.message);
    storage = getStorage(app);
}

// Export initialized instances
export { app, auth, db, storage };
