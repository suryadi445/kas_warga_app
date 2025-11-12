// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCIKaNM55000CAyBb8qJgrd9689CovvpCY",
    authDomain: "masjid-arrahman.firebaseapp.com",
    projectId: "masjid-arrahman",
    storageBucket: "masjid-arrahman.firebasestorage.app",
    messagingSenderId: "946911544305",
    appId: "1:946911544305:web:968e89282ddc5fa6207a50",
    measurementId: "G-XV5VC2ZQC6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Re-export canonical firebase instances to avoid duplicate initialization
export * from './firebaseConfig';
