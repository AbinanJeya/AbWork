/**
 * Leveling & XP System
 *
 * XP Sources:
 *   • 1 XP per step
 *   • 50 XP per food item logged
 *   • 500 XP for reaching daily step goal
 *   • 500 XP for staying within daily calorie goal
 *   • 500 XP per workout routine completed
 *
 * Levels 1-100 with scaling XP thresholds and progressive titles.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const XP_KEY = '@abwork_xp';

// ── Level Thresholds ────────────────────────────────────
// XP needed to reach each level (cumulative).
// Formula: level N requires 800 * N^1.3 total XP (rounded)
function xpForLevel(level) {
    if (level <= 1) return 0;
    return Math.round(800 * Math.pow(level, 1.3));
}

// Pre-compute thresholds for levels 1-100
const LEVEL_THRESHOLDS = [];
for (let i = 0; i <= 100; i++) {
    LEVEL_THRESHOLDS[i] = xpForLevel(i);
}

// ── Level Titles ────────────────────────────────────────
const LEVEL_TITLES = [
    { min: 1, max: 3, title: 'Newcomer' },
    { min: 4, max: 6, title: 'Beginner' },
    { min: 7, max: 10, title: 'Starter' },
    { min: 11, max: 14, title: 'Novice' },
    { min: 15, max: 19, title: 'Apprentice' },
    { min: 20, max: 24, title: 'Dedicated' },
    { min: 25, max: 29, title: 'Committed' },
    { min: 30, max: 34, title: 'Intermediate' },
    { min: 35, max: 39, title: 'Experienced' },
    { min: 40, max: 44, title: 'Advanced' },
    { min: 45, max: 49, title: 'Skilled' },
    { min: 50, max: 54, title: 'Expert' },
    { min: 55, max: 59, title: 'Veteran' },
    { min: 60, max: 64, title: 'Elite' },
    { min: 65, max: 69, title: 'Master' },
    { min: 70, max: 74, title: 'Grandmaster' },
    { min: 75, max: 79, title: 'Champion' },
    { min: 80, max: 84, title: 'Conqueror' },
    { min: 85, max: 89, title: 'Legend' },
    { min: 90, max: 94, title: 'Mythic' },
    { min: 95, max: 99, title: 'Transcendent' },
    { min: 100, max: 100, title: 'Ultimate' },
];

// ── Public API ──────────────────────────────────────────

/**
 * Get the current XP data
 * @returns {{ totalXP: number, dailyBonuses: object }}
 */
export async function getXPData() {
    try {
        const json = await AsyncStorage.getItem(XP_KEY);
        if (json) return JSON.parse(json);
    } catch (e) { console.error('getXPData error:', e); }
    return { totalXP: 0, dailyBonuses: {} };
}

/**
 * Save XP data
 */
async function saveXPData(data) {
    await AsyncStorage.setItem(XP_KEY, JSON.stringify(data));
}

/**
 * Add XP and return the new state
 * @param {number} amount - XP to add
 * @param {string} [reason] - for logging/debugging
 * @returns {{ totalXP, level, title, levelProgress, xpToNext, leveledUp }}
 */
export async function addXP(amount, reason = '') {
    const data = await getXPData();
    const oldLevel = getLevelFromXP(data.totalXP);
    data.totalXP += amount;
    await saveXPData(data);
    const newLevel = getLevelFromXP(data.totalXP);
    const info = getLevelInfo(data.totalXP);
    return {
        ...info,
        xpAdded: amount,
        leveledUp: newLevel > oldLevel,
        reason,
    };
}

/**
 * Award daily bonus (step goal / calorie goal) — only once per day
 * @param {'stepGoal' | 'calorieGoal'} bonusType
 * @returns {{ awarded: boolean, ...levelInfo }}
 */
export async function awardDailyBonus(bonusType) {
    const data = await getXPData();
    const today = new Date().toISOString().split('T')[0];
    if (!data.dailyBonuses) data.dailyBonuses = {};
    const key = `${bonusType}_${today}`;
    if (data.dailyBonuses[key]) {
        // Already awarded today
        return { awarded: false, ...getLevelInfo(data.totalXP) };
    }
    data.dailyBonuses[key] = true;
    data.totalXP += 500;

    // Clean up old daily bonuses (older than 7 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    for (const k of Object.keys(data.dailyBonuses)) {
        const dateStr = k.split('_').pop();
        if (dateStr < cutoffStr) delete data.dailyBonuses[k];
    }

    await saveXPData(data);
    return { awarded: true, ...getLevelInfo(data.totalXP) };
}

// ── Level Calculations ──────────────────────────────────

/**
 * Get level from total XP
 */
export function getLevelFromXP(totalXP) {
    let level = 1;
    for (let i = 2; i <= 100; i++) {
        if (totalXP >= LEVEL_THRESHOLDS[i]) level = i;
        else break;
    }
    return level;
}

/**
 * Get the title for a given level
 */
export function getTitleForLevel(level) {
    for (const t of LEVEL_TITLES) {
        if (level >= t.min && level <= t.max) return t.title;
    }
    return 'Ultimate';
}

/**
 * Get full level info object from total XP
 */
export function getLevelInfo(totalXP) {
    const level = getLevelFromXP(totalXP);
    const title = getTitleForLevel(level);
    const currentLevelXP = LEVEL_THRESHOLDS[level] || 0;
    const nextLevelXP = level < 100 ? LEVEL_THRESHOLDS[level + 1] : currentLevelXP;
    const xpInLevel = totalXP - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const progress = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;

    return {
        totalXP,
        level,
        title,
        currentLevelXP,
        nextLevelXP,
        xpInLevel,
        xpNeeded,
        progress, // 0-1 for progress bar
    };
}

// ── XP Award Constants ──────────────────────────────────
export const XP_AMOUNTS = {
    FOOD_LOGGED: 50,
    WORKOUT_COMPLETED: 500,
    STEP_GOAL_REACHED: 500,  // daily bonus
    CALORIE_GOAL_MET: 500,   // daily bonus
    PER_STEP: 1,
};
