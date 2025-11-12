// Import the functions you need from the SDKs you need
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
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
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Initialize Auth with React Native AsyncStorage persistence
let auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
} catch (e) {
    // log so you can see issues at startup; keep process running
    console.warn('Failed to initialize Firebase Auth with RN persistence:', e);
    // as fallback you may later import getAuth(app) if needed for web-only flows
}

// Initialize Firestore with RN-friendly settings to avoid WebChannel transport errors
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

// Export initialized instances
export { app, auth, db };
