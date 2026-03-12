/**
 * Friends & Leaderboard Service
 * Real friends via shareable links + AI competitor that chases your goals.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FRIENDS_KEY = '@abwork_friends';
const USER_ID_KEY = '@abwork_user_id';

// Generate a unique user ID (or retrieve existing)
export async function getUserId() {
    let id = await AsyncStorage.getItem(USER_ID_KEY);
    if (!id) {
        id = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem(USER_ID_KEY, id);
    }
    return id;
}

// Get shareable invite link
export async function getInviteLink() {
    const id = await getUserId();
    return `abworks.app/invite/${id}`;
}

// Get friends list
export async function getFriends() {
    try {
        const json = await AsyncStorage.getItem(FRIENDS_KEY);
        return json ? JSON.parse(json) : [];
    } catch { return []; }
}

// Add a friend
export async function addFriend(friend) {
    const friends = await getFriends();
    friends.push({ id: Date.now().toString(), ...friend });
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

// Remove a friend
export async function removeFriend(id) {
    const friends = await getFriends();
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends.filter(f => f.id !== id)));
}

/**
 * Generate an AI competitor that chases the user's step goal but never beats them.
 * The AI always sits between 70-95% of the user's steps (never equal or above).
 * It feels like a real competitor pushing you to stay ahead.
 */
function generateAICompetitor(userSteps, stepGoal) {
    // AI tracks relative to user — always slightly behind
    // The closer the user is to goal, the harder the AI pushes
    const goalProgress = Math.min(userSteps / Math.max(stepGoal, 1), 1);

    // AI effort ramps up as user gets closer to goal
    // At 0% progress: AI at 50-60% of user steps
    // At 50% progress: AI at 70-80% of user steps
    // At 100% progress: AI at 85-95% of user steps
    const minRatio = 0.50 + goalProgress * 0.35; // 0.50 → 0.85
    const maxRatio = 0.60 + goalProgress * 0.35; // 0.60 → 0.95

    // Use a seeded-ish variation based on the day so it's consistent per day
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const pseudoRandom = ((daySeed * 9301 + 49297) % 233280) / 233280; // 0-1

    const ratio = minRatio + pseudoRandom * (maxRatio - minRatio);
    const aiSteps = Math.max(0, Math.floor(userSteps * ratio));

    return {
        name: 'AI Coach',
        avatar: null,
        steps: aiSteps,
        isAI: true,
        isYou: false,
    };
}

/**
 * Get leaderboard data
 * @param {'daily'|'weekly'|'monthly'} period
 * @param {number} userSteps - current user's step count
 * @param {string} userName - current user's name
 * @param {number} stepGoal - user's daily step goal
 * @returns {Array} sorted leaderboard entries with ranks
 */
export function getLeaderboard(period, userSteps, userName, stepGoal = 10000) {
    const entries = [];

    // Scale step goal by period
    const periodGoal = period === 'daily' ? stepGoal
        : period === 'weekly' ? stepGoal * 7
            : stepGoal * 30;

    // Add the AI competitor
    const ai = generateAICompetitor(userSteps, periodGoal);
    entries.push({
        rank: 0,
        ...ai,
    });

    // Add real friends (from storage, loaded async elsewhere — for now just AI + you)
    // Future: pass friends array in here

    // Add the current user (always #1 vs AI)
    entries.push({
        rank: 0,
        name: userName || 'You',
        avatar: null,
        steps: userSteps,
        isYou: true,
        isAI: false,
    });

    // Sort by steps descending, assign ranks
    entries.sort((a, b) => b.steps - a.steps);
    entries.forEach((e, i) => { e.rank = i + 1; });

    return entries;
}

export function formatSteps(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString();
}
