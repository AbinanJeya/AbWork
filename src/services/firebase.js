// Firebase configuration
// Replace these values with your Firebase project config from:
// Firebase Console → Project Settings → General → Your apps → Config
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyCgPyRiIboztB5HxtbuyfJE45OdCsHRHR8",
    authDomain: "abwork-ae695.firebaseapp.com",
    projectId: "abwork-ae695",
    storageBucket: "abwork-ae695.firebasestorage.app",
    messagingSenderId: "802364713780",
    appId: "1:802364713780:web:4298eed6c5352c4e2e1361",
    measurementId: "G-5YV9ZH3N61",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

// Use AsyncStorage for auth persistence in React Native
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

export { app, auth, db };
