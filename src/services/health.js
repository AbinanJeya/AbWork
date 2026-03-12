/**
 * Platform-specific health data abstraction layer.
 * Automatically selects HealthKit (iOS) or Health Connect (Android)
 * so all screens can import from this single file.
 */
import { Platform } from 'react-native';

let healthModule;

if (Platform.OS === 'ios') {
    healthModule = require('./healthKit');
} else {
    healthModule = require('./healthConnect');
}

// ─── Re-export all functions with unified names ──────
export const initializeHealth = healthModule.initializeHealthKit || healthModule.initializeHealthConnect;
export const requestHealthPermissions = healthModule.requestHealthPermissions;
export const checkGrantedPermissions = healthModule.checkGrantedPermissions;
export const fetchDailySteps = healthModule.fetchDailySteps;
export const fetchWeeklySteps = healthModule.fetchWeeklySteps;
export const fetchSleepData = healthModule.fetchSleepData;
export const fetchWorkoutsData = healthModule.fetchWorkoutsData;

// Expose which platform backend is active
export const healthPlatform = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
export const healthPlatformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
