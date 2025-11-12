// Import the functions you need from the SDKs you need
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { Firestore, initializeFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
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

// Initialize Auth with AsyncStorage persistence for React Native
let auth: Auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
} catch (e: any) {
    // If already initialized, fallback to getAuth
    if (e?.code === 'auth/already-initialized' || e?.message?.includes('already initialized')) {
        console.warn('Auth already initialized, using getAuth()');
        auth = getAuth(app);
    } else {
        console.error('Failed to initialize auth:', e);
        auth = getAuth(app);
    }
}

// Initialize Firestore with RN-friendly settings
let db: Firestore;
try {
    db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
    });
} catch (e: any) {
    if (e?.code === 'firestore/already-initialized' || e?.message?.includes('already initialized')) {
        console.warn('Firestore already initialized, using existing instance');
        const { getFirestore } = require('firebase/firestore');
        db = getFirestore(app);
    } else {
        throw e;
    }
}

// Export initialized instances
export { app, auth, db };
