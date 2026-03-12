/**
 * Authentication Service — Firebase Auth wrapper
 */
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithCredential,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    sendEmailVerification as firebaseSendEmailVerification,
    deleteUser as firebaseDeleteUser,
} from 'firebase/auth';
import { auth } from './firebase';

// Sign up with email & password
export async function signUp(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
        await updateProfile(cred.user, { displayName });
    }
    return cred.user;
}

// Sign in with email & password
export async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

// Sign out
export async function signOut() {
    await firebaseSignOut(auth);
}

// Get current user (sync)
export function getCurrentUser() {
    return auth.currentUser;
}

// Listen for auth state changes
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// Sign in with Google (using ID token from expo-auth-session)
export async function signInWithGoogle(idToken) {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    return cred.user;
}

// Send password reset email
export async function sendPasswordResetEmail(email) {
    if (!email) throw new Error("Email is required for password reset");
    await firebaseSendPasswordResetEmail(auth, email);
}

// Send email verification
export async function sendVerificationEmail(user) {
    if (user) {
        await firebaseSendEmailVerification(user);
    }
}

// Delete account
export async function deleteAccount() {
    const user = auth.currentUser;
    if (user) {
        await firebaseDeleteUser(user);
    } else {
        throw new Error("No currently authenticated user to delete.");
    }
}

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Check if user has completed onboarding on the server
export async function getCloudProfile(uid) {
    if (!uid) return null;
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (e) {
        console.error("Error fetching cloud profile:", e);
        return null;
    }
}

// Mark onboarding as complete on the server
export async function saveProfileToCloud(uid, profileData) {
    if (!uid) return;
    try {
        await setDoc(doc(db, 'users', uid), profileData, { merge: true });
    } catch (e) {
        console.error("Error saving profile to cloud:", e);
    }
}
