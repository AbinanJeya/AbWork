import { Pedometer } from 'expo-sensors';
import { Platform, Alert, Linking } from 'react-native';
import { getStepsToday, setStepsToday, getSettings } from './storage';
import { getFitbitSteps } from './fitbit';
import { fetchDailySteps } from './health';

let subscription = null;
let sessionBaseSteps = 0;
let wearableSyncInterval = null;

export async function requestActivityPermission() {
    try {
        let { status } = await Pedometer.getPermissionsAsync();

        if (status !== 'granted') {
            const req = await Pedometer.requestPermissionsAsync();
            status = req.status;
        }

        console.log('Pedometer permission status:', status);

        if (status === 'denied' && !Pedometer.canAskAgain) {
            Alert.alert(
                'Permission Denied',
                'Step tracking needs Physical Activity permission. Please enable it in Settings.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() }
                ]
            );
        }

        return status === 'granted';
    } catch (err) {
        console.warn('Permission request error:', err);
        return false;
    }
}

export async function isPedometerAvailable() {
    try {
        return await Pedometer.isAvailableAsync();
    } catch {
        return false;
    }
}

// priority order for step data sources:
// health_connect > fitbit > phone pedometer
const DEVICE_PRIORITY = ['health_connect', 'fitbit'];
async function getActiveStepSource() {
    try {
        const s = await getSettings();
        const connections = s.wearableConnections || {};
        for (const deviceId of DEVICE_PRIORITY) {
            const conn = connections[deviceId];
            if (conn) {
                // If it's a granular connection object (like Health Connect), ensure syncSteps is true
                if (typeof conn === 'object') {
                    if (conn.connected && conn.syncSteps) return deviceId;
                } else {
                    return deviceId; // Legacy boolean fallback
                }
            }
        }
    } catch (e) {
        console.warn('Error checking wearable connections:', e);
    }
    return null; // No wearable connected — use phone pedometer
}

// Device display names for the dashboard
const DEVICE_NAMES = {
    health_connect: 'Health Connect',
    fitbit: 'Fitbit',
};

export function getDeviceName(deviceId) {
    return DEVICE_NAMES[deviceId] || null;
}

// ─── Public API ────────────────────────────────────

export async function getTodayStepCount() {
    // Check if a wearable is connected — if so, use its data
    const activeDevice = await getActiveStepSource();
    if (activeDevice) {
        let wearableSteps = 0;

        if (activeDevice === 'fitbit') {
            wearableSteps = await getFitbitSteps('today');
        } else if (activeDevice === 'health_connect') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            wearableSteps = await fetchDailySteps(startOfDay, now);
        }

        // Persist so other screens can access it
        await setStepsToday(wearableSteps);
        return wearableSteps;
    }
    // Fallback: phone pedometer stored value
    return await getStepsToday();
}

// Returns the active source info { deviceId, deviceName } or null
export async function getActiveStepSourceInfo() {
    const deviceId = await getActiveStepSource();
    if (deviceId) {
        return { deviceId, deviceName: DEVICE_NAMES[deviceId] };
    }
    return null;
}

export async function startStepWatcher(onUpdate) {
    if (subscription || wearableSyncInterval) return;

    // Check if we should use wearable data instead
    const activeDevice = await getActiveStepSource();

    if (activeDevice) {
        // Wearable connected — poll for step updates every 10 seconds
        console.log(`Step source: ${DEVICE_NAMES[activeDevice]} (wearable sync)`);

        const doSync = async () => {
            let steps = 0;
            if (activeDevice === 'fitbit') {
                steps = await getFitbitSteps('today');
            } else if (activeDevice === 'health_connect') {
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                steps = await fetchDailySteps(startOfDay, now);
            }
            await setStepsToday(steps);
            if (onUpdate) onUpdate(steps);
        };

        // Initial sync
        await doSync();

        // Periodic sync
        wearableSyncInterval = setInterval(doSync, 10000);
        return;
    }

    // No wearable — use phone pedometer
    const permGranted = await requestActivityPermission();
    if (!permGranted) {
        console.log('Step tracking permission denied');
        Alert.alert(
            'Permission Needed',
            'Step tracking requires the Activity Recognition permission. You can connect a wearable device in Settings, or set steps manually.',
        );
        return;
    }

    const available = await isPedometerAvailable();
    if (!available) {
        console.log('Pedometer sensor not available on this device');
        return;
    }

    // Record current stored steps so we add on top
    sessionBaseSteps = await getStepsToday();

    subscription = Pedometer.watchStepCount(async (result) => {
        const totalSteps = sessionBaseSteps + result.steps;
        await setStepsToday(totalSteps);
        if (onUpdate) onUpdate(totalSteps);
    });

    console.log('Pedometer watcher started (session base:', sessionBaseSteps, 'steps)');
}

export function stopStepWatcher() {
    if (subscription) {
        subscription.remove();
        subscription = null;
        console.log('Pedometer watcher stopped');
    }
    if (wearableSyncInterval) {
        clearInterval(wearableSyncInterval);
        wearableSyncInterval = null;
        console.log('Wearable sync stopped');
    }
}
