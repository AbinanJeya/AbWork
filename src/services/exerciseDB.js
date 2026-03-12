/**
 * Local Exercise Database Service
 * Exclusively uses the bundled exercises.json parsed from the user's CSV.
 * Search is entirely offline, lightning fast, and has 0 rate limits.
 */

// Load the local JSON directly
const localDatabase = require('../data/exercises.json');

/**
 * Maps the specific muscles to overarching categories for the UI filter chips
 */
export const BODY_PART_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'chest', label: 'Chest', emoji: '🫁' },
    { key: 'back', label: 'Back', emoji: '🔙' },
    { key: 'legs', label: 'Legs', emoji: '🦵' },
    { key: 'arms', label: 'Arms', emoji: '💪' },
    { key: 'shoulders', label: 'Shoulders', emoji: '🦾' },
    { key: 'core', label: 'Core', emoji: '🍫' },
    { key: 'cardio', label: 'Cardio' },
];

/**
 * The array of valid explicit primary_muscles for each overarching Category key
 * Keys MUST perfectly match the `key` strings inside BODY_PART_FILTERS
 */
export const MUSCLE_GROUP_MAP = {
    'chest': ['chest'],
    'back': ['upper back', 'lower back', 'lats', 'traps'],
    'legs': ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
    'arms': ['biceps', 'triceps', 'forearms'],
    'shoulders': ['shoulders'],
    'core': ['abdominals'],
    'cardio': ['cardio', 'full body', 'other'],
};

/**
 * Formats a raw JSON object into our App's standard Exercise schema
 */
const formatExercise = (item, index) => {
    // Only map valid images to `gifUrl` (React Native Image crashes on .mp4 strings)
    const mediaUrl = item.sourceType === 'image' && item.source ? item.source : '';

    return {
        id: `local_${index}`,
        name: item.name || '',
        gifUrl: mediaUrl,
        bodyPart: (item.primary_muscle || 'general').toLowerCase(),
        target: (item.secondary_muscle || '').toLowerCase(),
        equipment: (item.equipment || '').toLowerCase(),
    };
};

/**
 * Searches the offline database by name (case-insensitive)
 * @param {string} query - search term
 * @param {number} limit - max results
 */
export async function searchExercises(query, limit = 20) {
    if (!query || query.trim().length === 0) return [];

    const searchLow = query.toLowerCase().trim();

    // Perform purely offline string matching
    let results = localDatabase.filter(item =>
        (item.name || '').toLowerCase().includes(searchLow)
    );

    // Hard cap the max items rendered to prevent list lag
    results = results.slice(0, limit);

    return results.map((item, index) => formatExercise(item, index));
}

/**
 * Fallback to grab all exercises in a specific broad category 
 */
export async function getExercisesByCategory(categoryId, limit = 20) {
    const validMuscles = MUSCLE_GROUP_MAP[categoryId] || [];
    if (validMuscles.length === 0) return [];

    let results = localDatabase.filter(item => {
        const pm = (item.primary_muscle || '').toLowerCase();
        return validMuscles.includes(pm);
    });

    results = results.slice(0, limit);
    return results.map((item, index) => formatExercise(item, index));
}
