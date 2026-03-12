import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ── Meals ──────────────────────────────────────────────
export async function getMeals() {
    const json = await AsyncStorage.getItem(KEYS.MEALS);
    return json ? JSON.parse(json) : [];
}

export async function addMeal(meal) {
    const meals = await getMeals();
    const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...meal,
    };
    meals.unshift(entry);
    await AsyncStorage.setItem(KEYS.MEALS, JSON.stringify(meals));
    return entry;
}

export async function deleteMeal(id) {
    const meals = await getMeals();
    const filtered = meals.filter((m) => m.id !== id);
    await AsyncStorage.setItem(KEYS.MEALS, JSON.stringify(filtered));
}

// ── Workouts ───────────────────────────────────────────
export async function getWorkouts() {
    const json = await AsyncStorage.getItem(KEYS.WORKOUTS);
    return json ? JSON.parse(json) : [];
}

export async function addWorkout(workout) {
    const workouts = await getWorkouts();
    const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        completed: false,
        ...workout,
    };
    workouts.unshift(entry);
    await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
    return entry;
}

export async function toggleWorkout(id) {
    const workouts = await getWorkouts();
    const updated = workouts.map((w) =>
        w.id === id ? { ...w, completed: !w.completed } : w
    );
    await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(updated));
    return updated;
}

export async function deleteWorkout(id) {
    const workouts = await getWorkouts();
    const filtered = workouts.filter((w) => w.id !== id);
    await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(filtered));
}

// ── Steps ──────────────────────────────────────────────
// Helper to generate a YYYY-MM-DD key in the user's LOCAL timezone
// (toISOString uses UTC which shifts dates after ~8PM in negative UTC offsets)
function localDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey() {
    return localDateKey(new Date());
}

export async function getStepsToday() {
    const json = await AsyncStorage.getItem(KEYS.STEPS);
    const data = json ? JSON.parse(json) : {};
    return data[todayKey()] || 0;
}

export async function setStepsToday(count) {
    const json = await AsyncStorage.getItem(KEYS.STEPS);
    const data = json ? JSON.parse(json) : {};
    data[todayKey()] = count;
    await AsyncStorage.setItem(KEYS.STEPS, JSON.stringify(data));
}

export async function addSteps(delta) {
    const current = await getStepsToday();
    const updated = current + delta;
    await setStepsToday(updated);
    return updated;
}

// Get average daily steps over the last N days (including today)
export async function getStepAverage(days) {
    const json = await AsyncStorage.getItem(KEYS.STEPS);
    const data = json ? JSON.parse(json) : {};
    let total = 0;
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = localDateKey(d);
        total += data[key] || 0;
    }
    return Math.round(total / days);
}

// Get daily step counts for the last N days as an array (most recent last)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export async function getStepHistory(days = 7) {
    const json = await AsyncStorage.getItem(KEYS.STEPS);
    const data = json ? JSON.parse(json) : {};
    const result = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = localDateKey(d);
        result.push({
            date: key,
            dayLabel: DAY_LABELS[d.getDay()],
            steps: data[key] || 0,
            isToday: i === 0,
        });
    }
    return result;
}

// ── Settings ───────────────────────────────────────────
const DEFAULT_SETTINGS = {
    userName: 'Alex Rivera',
    calorieGoal: 2000,
    stepGoal: 10000,
    openAIKey: '',
    customPresets: [],
    baseRestTimer: 60,
    theme: {
        primary: '#25f46a',
        secondary: '#3b82f6',
    },
};

export async function getSettings() {
    const json = await AsyncStorage.getItem(KEYS.SETTINGS);
    return json ? { ...DEFAULT_SETTINGS, ...JSON.parse(json) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings) {
    const current = await getSettings();
    const merged = { ...current, ...settings };

    // Ensure nested objects like theme are merged correctly, not overwritten
    if (settings.theme) {
        merged.theme = { ...current.theme, ...settings.theme };
    }

    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
}

// ── Helpers ────────────────────────────────────────────
export function getTodaysMeals(meals) {
    const today = todayKey();
    return meals.filter((m) => m.timestamp && m.timestamp.startsWith(today));
}

export function getTodaysWorkouts(workouts) {
    const today = todayKey();
    return workouts.filter((w) => w.timestamp && w.timestamp.startsWith(today));
}

export function calcMacroTotals(meals) {
    return meals.reduce(
        (acc, m) => ({
            calories: acc.calories + (m.calories || 0),
            protein: acc.protein + (m.protein || 0),
            carbs: acc.carbs + (m.carbs || 0),
            fat: acc.fat + (m.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

export function calcWorkoutTotals(workouts) {
    return workouts.reduce(
        (acc, w) => ({
            caloriesBurned: acc.caloriesBurned + (w.caloriesBurned || 0),
            totalMinutes: acc.totalMinutes + (w.duration || 0),
        }),
        { caloriesBurned: 0, totalMinutes: 0 }
    );
}

export async function clearAllData() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
}

// ── Food Diary ────────────────────────────────────────
const EMPTY_DIARY = { breakfast: [], lunch: [], dinner: [], snacks: [] };

export async function getDiaryForDate(dateKey) {
    const json = await AsyncStorage.getItem(KEYS.DIARY);
    const all = json ? JSON.parse(json) : {};
    return all[dateKey] ? { ...EMPTY_DIARY, ...all[dateKey] } : { ...EMPTY_DIARY };
}

export async function addFoodToDiary(dateKey, mealType, food) {
    const json = await AsyncStorage.getItem(KEYS.DIARY);
    const all = json ? JSON.parse(json) : {};
    if (!all[dateKey]) all[dateKey] = { ...EMPTY_DIARY };
    const entry = { id: Date.now().toString(), ...food };
    all[dateKey][mealType] = [...(all[dateKey][mealType] || []), entry];
    await AsyncStorage.setItem(KEYS.DIARY, JSON.stringify(all));
    return entry;
}

export async function removeFoodFromDiary(dateKey, mealType, id) {
    const json = await AsyncStorage.getItem(KEYS.DIARY);
    const all = json ? JSON.parse(json) : {};
    if (!all[dateKey] || !all[dateKey][mealType]) return;
    all[dateKey][mealType] = all[dateKey][mealType].filter(f => f.id !== id);
    await AsyncStorage.setItem(KEYS.DIARY, JSON.stringify(all));
}

export function calcDiaryTotals(diary) {
    const meals = [...diary.breakfast, ...diary.lunch, ...diary.dinner, ...diary.snacks];
    return meals.reduce(
        (acc, m) => ({
            calories: acc.calories + (m.calories || 0),
            protein: acc.protein + (m.protein || 0),
            carbs: acc.carbs + (m.carbs || 0),
            fat: acc.fat + (m.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

export function calcMealTypeTotal(foods) {
    return foods.reduce((sum, f) => sum + (f.calories || 0), 0);
}

// Get the most frequently logged foods from diary history
export async function getFrequentFoods(limit = 10) {
    const json = await AsyncStorage.getItem(KEYS.DIARY);
    const all = json ? JSON.parse(json) : {};
    const freq = {};
    for (const dateKey of Object.keys(all)) {
        const day = all[dateKey];
        for (const slot of ['breakfast', 'lunch', 'dinner', 'snacks']) {
            for (const food of (day[slot] || [])) {
                const key = (food.name || '').toLowerCase().trim();
                if (!key) continue;
                if (!freq[key]) freq[key] = { ...food, count: 0 };
                freq[key].count++;
            }
        }
    }
    return Object.values(freq)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

// Auto-assign food to diary slot based on current time
export async function addFoodToDiaryAutoSlot(dateKey, food) {
    const hour = new Date().getHours();
    let slot;
    if (hour < 11) slot = 'breakfast';
    else if (hour < 15) slot = 'lunch';
    else if (hour < 20) slot = 'dinner';
    else slot = 'snacks';
    return addFoodToDiary(dateKey, slot, food);
}


// ── Workout Routines ──────────────────────────────────
export async function getRoutines() {
    const json = await AsyncStorage.getItem(KEYS.ROUTINES);
    return json ? JSON.parse(json) : [];
}

export async function addRoutine(routine) {
    const routines = await getRoutines();
    const entry = { id: Date.now().toString(), ...routine };
    routines.push(entry);
    await AsyncStorage.setItem(KEYS.ROUTINES, JSON.stringify(routines));
    return entry;
}

export async function updateRoutine(id, data) {
    const routines = await getRoutines();
    const idx = routines.findIndex(r => r.id === id);
    if (idx !== -1) {
        routines[idx] = { ...routines[idx], ...data };
        await AsyncStorage.setItem(KEYS.ROUTINES, JSON.stringify(routines));
    }
    return routines;
}

export async function deleteRoutine(id) {
    const routines = await getRoutines();
    const filtered = routines.filter(r => r.id !== id);
    await AsyncStorage.setItem(KEYS.ROUTINES, JSON.stringify(filtered));
}

export async function saveRoutines(routines) {
    await AsyncStorage.setItem(KEYS.ROUTINES, JSON.stringify(routines));
}

export async function importRoutines(newRoutines) {
    const existing = await getRoutines();
    let added = 0;
    let skipped = 0;

    for (const nr of newRoutines) {
        const title = nr.name.trim().toLowerCase();
        // Check if we already have a routine with this exact name
        if (existing.some(r => r.name.trim().toLowerCase() === title)) {
            skipped++;
            continue;
        }

        // Append new routine
        existing.push({
            id: 'imported_' + Date.now().toString() + '_' + Math.random().toString(36).substring(7),
            ...nr
        });
        added++;
    }

    if (added > 0) {
        await AsyncStorage.setItem(KEYS.ROUTINES, JSON.stringify(existing));
    }

    return { added, skipped };
}

// ── Workout History ───────────────────────────────────
export async function getWorkoutHistory() {
    const json = await AsyncStorage.getItem(KEYS.WORKOUT_HISTORY);
    return json ? JSON.parse(json) : [];
}

export async function saveWorkoutSession(session) {
    const history = await getWorkoutHistory();
    const entry = { id: Date.now().toString(), ...session };
    history.unshift(entry);
    await AsyncStorage.setItem(KEYS.WORKOUT_HISTORY, JSON.stringify(history));
    return entry;
}

/**
 * Bulk-import workout sessions, deduplicating by startedAt timestamp
 * to prevent double-imports.
 */
export async function importWorkoutSessions(sessions) {
    const history = await getWorkoutHistory();
    const existingDates = new Set(history.map(h => h.startedAt));
    const newSessions = sessions.filter(s => !existingDates.has(s.startedAt));
    if (newSessions.length === 0) return { added: 0, skipped: sessions.length };
    const merged = [...newSessions, ...history];
    merged.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    await AsyncStorage.setItem(KEYS.WORKOUT_HISTORY, JSON.stringify(merged));
    return { added: newSessions.length, skipped: sessions.length - newSessions.length };
}

// ===== User Profile =====
export async function getUserProfile() {
    const json = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    return json ? JSON.parse(json) : null;
}

export async function saveUserProfile(profile) {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
}

// ── Chat History ─────────────────────────────────────────
export async function getChatHistory() {
    const json = await AsyncStorage.getItem(KEYS.CHAT_HISTORY);
    return json ? JSON.parse(json) : [];
}

export async function saveChatHistory(messages) {
    await AsyncStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(messages));
}

export async function clearChatHistory() {
    await AsyncStorage.removeItem(KEYS.CHAT_HISTORY);
}

// ── Saved Meals ──────────────────────────────────────────
export async function getSavedMeals() {
    const json = await AsyncStorage.getItem(KEYS.SAVED_MEALS);
    return json ? JSON.parse(json) : [];
}

export async function saveMeal(meal) {
    const meals = await getSavedMeals();
    const newMeal = {
        ...meal,
        id: `meal_${Date.now()}`,
        createdAt: new Date().toISOString(),
    };
    meals.unshift(newMeal);
    await AsyncStorage.setItem(KEYS.SAVED_MEALS, JSON.stringify(meals));
    return newMeal;
}

export async function deleteSavedMeal(id) {
    const meals = await getSavedMeals();
    const filtered = meals.filter(m => m.id !== id);
    await AsyncStorage.setItem(KEYS.SAVED_MEALS, JSON.stringify(filtered));
}

// ── Saved Recipes ──────────────────────────────────────────
export async function getSavedRecipes() {
    const json = await AsyncStorage.getItem(KEYS.SAVED_RECIPES);
    return json ? JSON.parse(json) : [];
}

export async function saveRecipe(recipe) {
    const recipes = await getSavedRecipes();
    const newRecipe = {
        ...recipe,
        id: `recipe_${Date.now()}`,
        createdAt: new Date().toISOString(),
    };
    recipes.unshift(newRecipe);
    await AsyncStorage.setItem(KEYS.SAVED_RECIPES, JSON.stringify(recipes));
    return newRecipe;
}

export async function deleteSavedRecipe(id) {
    const recipes = await getSavedRecipes();
    const filtered = recipes.filter(r => r.id !== id);
    await AsyncStorage.setItem(KEYS.SAVED_RECIPES, JSON.stringify(filtered));
}

// ── Exercise History & PR Tracking ────────────────────
// Returns { lastSets: [...], bestWeight, bestEstimated1RM } for a given exercise name
export async function getExerciseHistory(exerciseName) {
    const history = await getWorkoutHistory();
    const nameLower = (exerciseName || '').toLowerCase().trim();
    let lastSets = [];
    let bestWeight = 0;
    let bestE1RM = 0;

    for (const session of history) {
        for (const ex of (session.exerciseLogs || [])) {
            if ((ex.name || '').toLowerCase().trim() !== nameLower) continue;
            // Grab the most recent session's sets (first match since history is newest-first)
            if (lastSets.length === 0) {
                lastSets = (ex.sets || [])
                    .filter(s => s.completed)
                    .map(s => ({ weight: s.weight, reps: s.reps, weightUnit: s.weightUnit }));
            }
            // Scan all sets for all-time bests
            for (const s of (ex.sets || [])) {
                if (!s.completed) continue;
                const w = parseFloat(s.weight) || 0;
                const r = parseFloat(s.reps) || 0;
                if (w > bestWeight) bestWeight = w;
                const e1rm = w * (1 + r / 30);
                if (e1rm > bestE1RM) bestE1RM = e1rm;
            }
        }
    }
    return { lastSets, bestWeight, bestE1RM };
}

// ── Workout Streak ────────────────────────────────────
// Returns consecutive days (ending today) with at least one logged workout session
export async function getWorkoutStreak() {
    const history = await getWorkoutHistory();
    // Collect unique dates from session finishedAt timestamps
    const dates = new Set();
    for (const session of history) {
        const d = session.finishedAt || session.startedAt;
        if (d) dates.add(d.slice(0, 10)); // YYYY-MM-DD
    }
    // Count streak backwards from today
    let streak = 0;
    const d = new Date();
    while (true) {
        const key = localDateKey(d);
        if (dates.has(key)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

// ── Diary (Nutrition) Streak ──────────────────────────
// Returns consecutive days (ending today) with at least one food entry
export async function getDiaryStreak() {
    const json = await AsyncStorage.getItem(KEYS.DIARY);
    const all = json ? JSON.parse(json) : {};
    // Count streak backwards from today
    let streak = 0;
    const d = new Date();
    while (true) {
        const key = localDateKey(d);
        const day = all[key];
        if (day) {
            const total = (day.breakfast || []).length + (day.lunch || []).length +
                (day.dinner || []).length + (day.snacks || []).length;
            if (total > 0) {
                streak++;
                d.setDate(d.getDate() - 1);
                continue;
            }
        }
        break;
    }
    return streak;
}
