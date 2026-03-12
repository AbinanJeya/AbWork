import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';

// ─── Permissions ─────────────────────────────────────
const HK_PERMISSIONS = {
    permissions: {
        read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.StepCount,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.Workout,
        ],
    },
};

/**
 * Initializes Apple HealthKit.
 * Returns true if available (iOS only).
 */
export async function initializeHealthKit() {
    if (Platform.OS !== 'ios') return false;
    return new Promise((resolve) => {
        AppleHealthKit.isAvailable((err, available) => {
            if (err || !available) {
                console.warn('HealthKit not available:', err);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Prompts the native iOS HealthKit authorization sheet.
 */
export async function requestHealthPermissions() {
    return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(HK_PERMISSIONS, (err) => {
            if (err) {
                console.error('HealthKit permission error:', err);
                resolve(false);
            } else {
                console.log('HealthKit permissions granted');
                resolve(true);
            }
        });
    });
}

/**
 * Checks if HealthKit permissions have already been granted.
 * Note: iOS doesn't expose exact grant status for read permissions,
 * so we assume granted if HealthKit is available and initialized.
 */
export async function checkGrantedPermissions() {
    return initializeHealthKit();
}

/**
 * Fetches step count from HealthKit for a given time range.
 */
export async function fetchDailySteps(startTime, endTime) {
    try {
        // Ensure HealthKit is authorized
        await requestHealthPermissions();

        return new Promise((resolve) => {
            AppleHealthKit.getStepCount(
                {
                    startDate: startTime.toISOString(),
                    endDate: endTime.toISOString(),
                },
                (err, results) => {
                    if (err) {
                        console.error('HealthKit steps error:', err);
                        resolve(0);
                    } else {
                        resolve(results?.value || 0);
                    }
                }
            );
        });
    } catch (err) {
        console.error('Error reading HealthKit steps:', err);
        return 0;
    }
}

/**
 * Fetches daily step counts from HealthKit for the last N days.
 * Returns a map: { '2026-03-05': 8542, '2026-03-06': 12300, ... }
 */
export async function fetchWeeklySteps(days = 7) {
    try {
        await requestHealthPermissions();

        return new Promise((resolve) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (days - 1));
            startDate.setHours(0, 0, 0, 0);

            AppleHealthKit.getDailyStepCountSamples(
                {
                    startDate: startDate.toISOString(),
                    endDate: new Date().toISOString(),
                },
                (err, results) => {
                    if (err) {
                        console.error('HealthKit weekly steps error:', err);
                        resolve({});
                        return;
                    }

                    const map = {};
                    (results || []).forEach(sample => {
                        // sample.startDate is ISO string, extract local date key
                        const d = new Date(sample.startDate);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        map[key] = (map[key] || 0) + (sample.value || 0);
                    });
                    resolve(map);
                }
            );
        });
    } catch (err) {
        console.error('Error fetching HealthKit weekly steps:', err);
        return {};
    }
}

/**
 * Fetches sleep analysis data from HealthKit for the given time frame.
 * Maps to the same stats object as healthConnect.js `fetchSleepData`.
 */
export async function fetchSleepData(startTime, endTime) {
    try {
        await requestHealthPermissions();

        return new Promise((resolve) => {
            AppleHealthKit.getSleepSamples(
                {
                    startDate: startTime.toISOString(),
                    endDate: endTime.toISOString(),
                },
                (err, results) => {
                    if (err) {
                        console.error('HealthKit sleep error:', err);
                        resolve(null);
                        return;
                    }

                    const stats = {
                        totalMinutes: 0,
                        awakeMinutes: 0,
                        lightMinutes: 0,
                        deepMinutes: 0,
                        remMinutes: 0,
                        score: 0,
                        sessions: 0,
                        timeline: [],
                    };

                    if (!results || results.length === 0) {
                        resolve(stats);
                        return;
                    }

                    // Count unique sessions (group by rough start time)
                    const sessionStarts = new Set();

                    results.forEach(sample => {
                        const startMs = new Date(sample.startDate).getTime();
                        const endMs = new Date(sample.endDate).getTime();
                        const durationMin = (endMs - startMs) / (1000 * 60);

                        // Track unique sessions (within 30 min window)
                        const sessionKey = Math.floor(startMs / (30 * 60 * 1000));
                        sessionStarts.add(sessionKey);

                        // HealthKit sleep values:
                        // INBED, ASLEEP, AWAKE, CORE (light), DEEP, REM
                        const val = (sample.value || '').toUpperCase();

                        if (val === 'AWAKE' || val === 'INBED') {
                            stats.awakeMinutes += durationMin;
                            stats.timeline.push({ type: 'awake', minutes: durationMin });
                        } else if (val === 'DEEP') {
                            stats.deepMinutes += durationMin;
                            stats.timeline.push({ type: 'deep', minutes: durationMin });
                        } else if (val === 'REM') {
                            stats.remMinutes += durationMin;
                            stats.timeline.push({ type: 'rem', minutes: durationMin });
                        } else {
                            // ASLEEP, CORE, or unknown → light
                            stats.lightMinutes += durationMin;
                            stats.timeline.push({ type: 'light', minutes: durationMin });
                        }
                    });

                    stats.sessions = sessionStarts.size;
                    stats.totalMinutes = Math.round(
                        stats.lightMinutes + stats.deepMinutes + stats.remMinutes + stats.awakeMinutes
                    );
                    stats.awakeMinutes = Math.round(stats.awakeMinutes);
                    stats.lightMinutes = Math.round(stats.lightMinutes);
                    stats.deepMinutes = Math.round(stats.deepMinutes);
                    stats.remMinutes = Math.round(stats.remMinutes);

                    // Sleep score (same formula as healthConnect.js)
                    if (stats.totalMinutes > 0) {
                        const durationScore = Math.min(100, (stats.totalMinutes / 480) * 100);
                        const qualityRatio = (stats.deepMinutes + stats.remMinutes) / stats.totalMinutes;
                        const qualityScore = Math.min(100, (qualityRatio / 0.45) * 100);
                        stats.score = Math.round((durationScore * 0.6) + (qualityScore * 0.4));
                    }

                    resolve(stats);
                }
            );
        });
    } catch (err) {
        console.error('Error reading HealthKit sleep data:', err);
        return null;
    }
}

/**
 * Fetches workout sessions from HealthKit.
 * Maps to the same schema as healthConnect.js `fetchWorkoutsData`.
 */
export async function fetchWorkoutsData(startTime, endTime) {
    try {
        await requestHealthPermissions();

        return new Promise((resolve) => {
            AppleHealthKit.getSamples(
                {
                    startDate: startTime.toISOString(),
                    endDate: endTime.toISOString(),
                    type: 'Workout',
                },
                (err, results) => {
                    if (err) {
                        console.error('HealthKit workouts error:', err);
                        resolve([]);
                        return;
                    }

                    const mapped = (results || []).map(record => {
                        const startMs = new Date(record.start || record.startDate).getTime();
                        const endMs = new Date(record.end || record.endDate).getTime();
                        const durationSec = (endMs - startMs) / 1000;

                        // Map HealthKit activityName 
                        const typeName = record.activityName || record.type || 'Workout';

                        return {
                            id: `hk_${record.id || Date.now() + Math.random()}`,
                            routineName: `Apple Health: ${typeName}`,
                            startTime: record.start || record.startDate,
                            endTime: record.end || record.endDate,
                            duration: durationSec,
                            exercises: [{
                                exerciseId: 'hk_proxy',
                                name: typeName,
                                sets: [],
                            }],
                            volume: 0,
                            isExternal: true,
                            source: 'apple_health',
                        };
                    });

                    resolve(mapped);
                }
            );
        });
    } catch (err) {
        console.error('Error reading HealthKit workouts:', err);
        return [];
    }
}
