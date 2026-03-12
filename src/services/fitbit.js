import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FITBIT_CLIENT_ID = '23V3KK';
const FITBIT_API_BASE = 'https://api.fitbit.com/1/user/-'; // "-" means currently logged in user

// The scopes required to read all the fitness data requested
export const FITBIT_SCOPES = ['activity', 'heartrate', 'sleep', 'nutrition', 'weight', 'profile', 'settings'];

export const fitbitDiscovery = {
    authorizationEndpoint: 'https://www.fitbit.com/oauth2/authorize',
    tokenEndpoint: 'https://api.fitbit.com/oauth2/token',
    revocationEndpoint: 'https://api.fitbit.com/oauth2/revoke',
};

// Using a proxy to standard expo proxy to simplify redirect URIs
// We explicitly define our custom deep link scheme that is set in app.json
export const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'abwork', // Defined in app.json
    path: 'fitbit-auth'
});

export async function saveFitbitToken(token) {
    if (token) {
        await AsyncStorage.setItem('@fitbit_access_token', token);
    }
}

export async function disconnectFitbit() {
    await AsyncStorage.removeItem('@fitbit_access_token');
}

export async function getFitbitToken() {
    return await AsyncStorage.getItem('@fitbit_access_token');
}

/**
 * Generic Fetch Request to Fitbit API
 */
async function fetchFitbitData(endpoint) {
    const token = await getFitbitToken();
    if (!token) throw new Error('Not authenticated with Fitbit');

    const response = await fetch(`${FITBIT_API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 401) {
        // Token expired normally handled with refresh tokens, but we use the 1-year implicit grant tokens for simplicity here
        await disconnectFitbit();
        throw new Error('Fitbit token expired. Please reconnect.');
    }

    if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Fitbit API Error: ${response.status} ${errData}`);
    }

    return await response.json();
}

/**
 * Helper to get local YYYY-MM-DD instead of UTC which rolls over in the evening
 */
function getLocalYYYYMMDD() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get daily step count
 */
export async function getFitbitSteps(dateStr = 'today') {
    try {
        const formattedDate = dateStr === 'today' ? getLocalYYYYMMDD() : dateStr;
        const data = await fetchFitbitData(`/activities/date/${formattedDate}.json`);
        return data?.summary?.steps || 0;
    } catch (e) {
        console.warn('Failed to fetch Fitbit Steps:', e);
        return 0;
    }
}

/**
 * Get resting heart rate for the day
 */
export async function getFitbitRestingHeartRate(dateStr = 'today') {
    try {
        const formattedDate = dateStr === 'today' ? getLocalYYYYMMDD() : dateStr;
        const data = await fetchFitbitData(`/activities/heart/date/${formattedDate}/1d.json`);
        return data?.['activities-heart']?.[0]?.value?.restingHeartRate || null;
    } catch (e) {
        console.warn('Failed to fetch Fitbit HR:', e);
        return null;
    }
}

/**
 * Get sleep data for the day
 */
export async function getFitbitSleep(dateStr = 'today') {
    try {
        // Note: fitbit sleep API uses YYYY-MM-DD
        const formattedDate = dateStr === 'today' ? getLocalYYYYMMDD() : dateStr;
        const data = await fetchFitbitData(`/sleep/date/${formattedDate}.json`);

        if (data?.sleep && data.sleep.length > 0) {
            const mainSleep = data.sleep.find(s => s.isMainSleep) || data.sleep[0];
            return {
                durationMinutes: mainSleep.duration / 60000,
                efficiency: mainSleep.efficiency,
                score: mainSleep.efficiency // Fallback if premium sleep score isn't avail
            };
        }
        return null;
    } catch (e) {
        console.warn('Failed to fetch Fitbit Sleep:', e);
        return null;
    }
}

/**
 * Get daily logged calories
 */
export async function getFitbitCalories(dateStr = 'today') {
    try {
        const formattedDate = dateStr === 'today' ? getLocalYYYYMMDD() : dateStr;
        const data = await fetchFitbitData(`/activities/date/${formattedDate}.json`);
        return data?.summary?.caloriesOut || 0; // Or caloriesBMR depending on need
    } catch (e) {
        console.warn('Failed to fetch Fitbit Calories:', e);
        return 0;
    }
}

export async function getFitbitWeight(dateStr = 'today') {
    try {
        const formattedDate = dateStr === 'today' ? getLocalYYYYMMDD() : dateStr;
        const data = await fetchFitbitData(`/body/log/weight/date/${formattedDate}/1d.json`);
        return data?.weight?.[0]?.weight || null;
    } catch (e) {
        console.warn('Failed to fetch Fitbit Weight:', e);
        return null;
    }
}
