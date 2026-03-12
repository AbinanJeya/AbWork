import {
    initialize,
    requestPermission,
    readRecords,
    getGrantedPermissions,
    aggregateRecord,
} from 'react-native-health-connect';

// Define the permissions we want to request from the Android OS
const PERMISSIONS = [
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'ExerciseSession' },
];

/**
 * Initializes the Health Connect SDK.
 * Must be called before any other operations.
 * Returns true if available and initialized successfully.
 */
export async function initializeHealthConnect() {
    try {
        const isInitialized = await initialize();
        return isInitialized;
    } catch (err) {
        console.error("Health Connect init error:", err);
        return false;
    }
}

/**
 * Prompts the native Android OS bottom sheet asking the user for authorization
 * to read the requested Data Types (Steps, Heart Rate, etc).
 */
export async function requestHealthPermissions() {
    try {
        const granted = await requestPermission(PERMISSIONS);
        console.log("Health Connect Granted Permissions:", granted);
        return true;
    } catch (err) {
        console.error("Health Connect permission error:", err);
        return false;
    }
}

/**
 * Verifies if the app still retains the granted permissions 
 * without prompting the user.
 */
export async function checkGrantedPermissions() {
    try {
        const granted = await getGrantedPermissions();
        // Check if we have all the required read types
        const hasPermissions = PERMISSIONS.every(req =>
            granted.some(g => g.recordType === req.recordType && g.accessType === req.accessType)
        );
        return hasPermissions;
    } catch (err) {
        console.error("Error checking permissions:", err);
        return false;
    }
}

/**
 * Base helper to fetch today's steps. (For demonstration of analytics layer)
 */
export async function fetchDailySteps(startTime, endTime) {
    try {
        // Ensure SDK is initialized for this session before reading
        const isInitialized = await initializeHealthConnect();
        if (!isInitialized) {
            console.warn("Health Connect client failed to initialize.");
            return 0;
        }

        // Use the native Android aggregateRecord API
        // This natively sanitizes and deduplicates overlapping step records 
        // sent by multiple watches/phones to give one mathematically accurate COUNT_TOTAL
        const result = await aggregateRecord({
            recordType: 'Steps',
            timeRangeFilter: {
                operator: 'between',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            },
        });

        // The library might return countTotal under different casing depending on version
        return result.COUNT_TOTAL || result.countTotal || 0;
    } catch (err) {
        console.error("Error reading steps:", err);
        return 0;
    }
}

/**
 * Fetches daily step counts from Health Connect for the last N days.
 * Returns a map: { '2026-03-05': 8542, '2026-03-06': 12300, ... }
 */
export async function fetchWeeklySteps(days = 7) {
    try {
        const isInitialized = await initializeHealthConnect();
        if (!isInitialized) return {};

        const result = {};
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const key = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
            const steps = await fetchDailySteps(dayStart, dayEnd);
            result[key] = steps;
        }
        return result;
    } catch (err) {
        console.error("Error fetching weekly steps from HC:", err);
        return {};
    }
}

/**
 * Polls Android Health Connect for SleepSession records in the given time frame.
 * Parses and accumulates the total duration of each granular sleep stage.
 */
export async function fetchSleepData(startTime, endTime) {
    try {
        const isInitialized = await initializeHealthConnect();
        if (!isInitialized) return null;

        const result = await readRecords('SleepSession', {
            timeRangeFilter: {
                operator: 'between',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            },
        });

        console.log(`[HealthConnect API] Fetching Sleep from ${startTime.toLocaleDateString()} to ${endTime.toLocaleDateString()}`);
        console.log(`[HealthConnect API] RAW PAYLOAD:`, JSON.stringify(result.records, null, 2));

        const stats = {
            totalMinutes: 0,
            awakeMinutes: 0,
            lightMinutes: 0,
            deepMinutes: 0,
            remMinutes: 0,
            score: 0,
            sessions: result.records.length,
            timeline: [], // NEW: Chronological array of stages
        };

        if (result.records.length === 0) return stats;

        let totalTrackedMinutes = 0;

        result.records.forEach(session => {
            const startStr = session.startTime;
            const endStr = session.endTime;
            // Native session length just in case stages are missing
            const sessionDurationMs = new Date(endStr).getTime() - new Date(startStr).getTime();
            const sessionDurationMin = sessionDurationMs / (1000 * 60);

            let stagesFoundDuration = 0;

            if (session.stages && session.stages.length > 0) {
                // Pre-sort stages chronologically just in case Android API returns them out of order
                const sortedStages = [...session.stages].sort(
                    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                );

                sortedStages.forEach(stage => {
                    const stageMs = new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime();
                    const stageMin = stageMs / (1000 * 60);
                    stagesFoundDuration += stageMin;

                    // Health Connect Stage Types:
                    // 1: Awake
                    // 2: Sleeping (Generic)
                    // 3: Out of Bed
                    // 4: Light Sleep
                    // 5: Deep Sleep
                    // 6: REM Sleep

                    switch (stage.stage) {
                        case 1:
                        case 3:
                            stats.awakeMinutes += stageMin;
                            stats.timeline.push({ type: 'awake', minutes: stageMin });
                            break;
                        case 4:
                            stats.lightMinutes += stageMin;
                            stats.timeline.push({ type: 'light', minutes: stageMin });
                            break;
                        case 5:
                            stats.deepMinutes += stageMin;
                            stats.timeline.push({ type: 'deep', minutes: stageMin });
                            break;
                        case 6:
                            stats.remMinutes += stageMin;
                            stats.timeline.push({ type: 'rem', minutes: stageMin });
                            break;
                        default:
                            stats.lightMinutes += stageMin;
                            stats.timeline.push({ type: 'light', minutes: stageMin });
                            break;
                    }
                });
            } else {
                // If the device only reports gross sleep time without stages
                stats.lightMinutes += sessionDurationMin;
                stagesFoundDuration += sessionDurationMin;
                stats.timeline.push({ type: 'light', minutes: sessionDurationMin });
            }

            totalTrackedMinutes += stagesFoundDuration;
        });

        // Ensure calculations are rounded cleanly
        stats.totalMinutes = Math.round(totalTrackedMinutes);
        stats.awakeMinutes = Math.round(stats.awakeMinutes);
        stats.lightMinutes = Math.round(stats.lightMinutes);
        stats.deepMinutes = Math.round(stats.deepMinutes);
        stats.remMinutes = Math.round(stats.remMinutes);

        // Calculate a generic proxy sleep score (0-100) based on deep/rem ratio and total length
        // Target: 8 hrs (480 min). Ratio: ~20% Deep, ~25% REM.
        if (stats.totalMinutes > 0) {
            const durationScore = Math.min(100, (stats.totalMinutes / 480) * 100);
            const qualityRatio = (stats.deepMinutes + stats.remMinutes) / stats.totalMinutes;
            const qualityScore = Math.min(100, (qualityRatio / 0.45) * 100);
            stats.score = Math.round((durationScore * 0.6) + (qualityScore * 0.4));
        }

        return stats;

    } catch (err) {
        console.error("Error reading sleep data:", err);
        return null;
    }
}

/**
 * Polls Android Health Connect for ExerciseSession records.
 * Provides broad summaries (Duration, Exercise Type, Calories) but lacks set/rep specifics.
 */
export async function fetchWorkoutsData(startTime, endTime) {
    try {
        const isInitialized = await initializeHealthConnect();
        if (!isInitialized) return [];

        const result = await readRecords('ExerciseSession', {
            timeRangeFilter: {
                operator: 'between',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            },
        });

        // Map Health Connect schema into FitAI's standard history schema
        // Note: Health Connect cannot store Sets/Reps, so `exercises` will be empty/abstract.
        const mappedWorkouts = result.records.map(record => {
            const startStr = record.startTime;
            const endStr = record.endTime;
            const durationMs = new Date(endStr).getTime() - new Date(startStr).getTime();
            
            // HealthConnect exercise types map to enums (e.g. 8 = BIKE, 56 = RUN, 79 = WEIGHTLIFTING)
            // If unknown, we fallback to a generic name based on their internal numbering or the string if provided differently on Android 14.
            const hcTypeMap = {
                8: 'Cycling',
                56: 'Running',
                79: 'Weightlifting',
                82: 'Yoga',
                83: 'Walking'
            };
            const typeName = hcTypeMap[record.exerciseType] || `Workout (${record.exerciseType || 'Generic'})`;

            return {
                id: `hc_${record.metadata?.id || Date.now() + Math.random()}`,
                routineName: `Health Connect: ${typeName}`,
                startTime: startStr,
                endTime: endStr,
                duration: durationMs / 1000, 
                // We add a faux exercise so it looks somewhat valid in simple UI lists
                exercises: [{
                    exerciseId: 'hc_proxy',
                    name: typeName,
                    sets: []
                }],
                volume: 0, // Health connect lacks actual volume
                isExternal: true, // Tag it so UI knows it can't render detailed sets
                source: 'health_connect'
            };
        });

        return mappedWorkouts;

    } catch (err) {
        console.error("Error reading exercise session data:", err);
        return [];
    }
}
