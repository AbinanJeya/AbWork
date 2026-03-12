import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Alert } from 'react-native';

const KEYS = {
    MEALS: '@abwork_meals',
    WORKOUTS: '@abwork_workouts',
    STEPS: '@abwork_steps',
    SETTINGS: '@abwork_settings',
    DIARY: '@abwork_diary',
    ROUTINES: '@abwork_routines',
    WORKOUT_HISTORY: '@abwork_workout_history',
    USER_PROFILE: '@abwork_user_profile',
    XP: '@abwork_xp',
    CHAT_HISTORY: '@abwork_chat_history',
    SAVED_MEALS: '@abwork_saved_meals',
    SAVED_RECIPES: '@abwork_saved_recipes',
};

/**
 * Grabs EVERY single offline database on the phone, packages it into a massive JSON blob,
 * and pushes it securely to the currently logged in user's cloud document.
 */
export async function forceCloudBackup(silent = true) {
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user || !user.uid) return false;

        const db = getFirestore();
        const payload = {
            lastSynced: new Date().toISOString(),
            appVersion: '1.0.0',
            data: {}
        };

        // Extract all 12 databases from the phone's harddrive
        for (const [keyName, storageKey] of Object.entries(KEYS)) {
            const rawData = await AsyncStorage.getItem(storageKey);
            if (rawData) {
                payload.data[keyName] = JSON.parse(rawData);
            }
        }

        // Push massive payload to Firestore (creates or overwrites the doc)
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, payload, { merge: true });

        if (!silent) console.log("✅ Custom Cloud Backup Successful!");
        return true;
    } catch (error) {
        console.error("❌ Cloud Backup Failed: ", error);
        if (!silent) Alert.alert("Sync Error", "Failed to backup data to the cloud.");
        return false;
    }
}

/**
 * Reaches out to Firestore, downloads the giant JSON backup blob, 
 * and carefully injects each chunk back into the phone's offline database keys.
 */
export async function restoreFromCloud(uid) {
    try {
        if (!uid) return false;

        const db = getFirestore();
        const userDocRef = doc(db, 'users', uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            console.log("⚠️ No cloud backup found for this user. Starting fresh.");
            return false;
        }

        const payload = docSnap.data();
        if (!payload || !payload.data) {
            // Older legacy profiles might just have top-level keys
            console.log("⚠️ Legacy cloud profile detected. Handled safely.");
            return false;
        }

        const cloudData = payload.data;

        // Inject each cloud chunk back into AsyncStorage
        const promises = [];
        for (const [keyName, storageKey] of Object.entries(KEYS)) {
            if (cloudData[keyName]) {
                const jsonString = JSON.stringify(cloudData[keyName]);
                promises.push(AsyncStorage.setItem(storageKey, jsonString));
            }
        }

        await Promise.all(promises);
        console.log("✅ Cloud Restore Successful! All 12 databases rebuilt.");
        return true;

    } catch (error) {
        console.error("❌ Cloud Restore Failed: ", error);
        return false;
    }
}
