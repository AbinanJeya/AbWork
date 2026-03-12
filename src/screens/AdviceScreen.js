import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Platform, Alert, Keyboard, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import {
    getSettings, getDiaryForDate, calcDiaryTotals,
    getFrequentFoods, addFoodToDiaryAutoSlot, getUserProfile,
    getChatHistory, saveChatHistory, clearChatHistory, saveMeal, saveRecipe,
} from '../services/storage';
import {
    askNutritionQuestion, getSmartRecipes, getMacroSolverSuggestion,
    generateMeal, addIngredientToMeal, generateRecipeFromChat,
} from '../services/openai';
import { useTranslation } from '../services/i18n';

function todayKey() { return new Date().toISOString().slice(0, 10); }

const FILTERS = ['All', 'Under 10 Min', 'No-Cook', 'High Protein', 'Post-Workout'];
const FILTER_KEYS = { 'All': 'filterAll', 'Under 10 Min': 'filterUnder10', 'No-Cook': 'filterNoCook', 'High Protein': 'filterHighProtein', 'Post-Workout': 'filterPostWorkout' };

const DEFAULT_QUICK_FOODS = [
    { name: 'Greek Yogurt', calories: 130, protein: 15, carbs: 8, fat: 4 },
    { name: 'Protein Bar', calories: 210, protein: 20, carbs: 24, fat: 8 },
    { name: 'Chicken Breast (150g)', calories: 248, protein: 46, carbs: 0, fat: 5 },
    { name: 'Protein Shake', calories: 180, protein: 25, carbs: 8, fat: 3 },
    { name: 'Hard Boiled Eggs (2)', calories: 156, protein: 12, carbs: 1, fat: 11 },
    { name: 'Cottage Cheese', calories: 110, protein: 14, carbs: 5, fat: 4 },
    { name: 'Almonds (30g)', calories: 170, protein: 6, carbs: 6, fat: 15 },
    { name: 'Tuna Can', calories: 120, protein: 28, carbs: 0, fat: 1 },
];

export default function AdviceScreen() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    // Data
    const [remaining, setRemaining] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 70 });
    const [quickFoods, setQuickFoods] = useState(DEFAULT_QUICK_FOODS);
    const [recipes, setRecipes] = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [recipesLoading, setRecipesLoading] = useState(false);
    const [expandedRecipe, setExpandedRecipe] = useState(null);
    const [macroAlert, setMacroAlert] = useState(null);

    // Chat
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const scrollRef = useRef(null);
    const recipeCache = useRef({});

    // Meal builder
    const [activeMeal, setActiveMeal] = useState(null);
    const [addIngredientInput, setAddIngredientInput] = useState('');
    const [mealSaved, setMealSaved] = useState(false);
    const [mealLoading, setMealLoading] = useState(false);
    const [expandedChatRecipe, setExpandedChatRecipe] = useState(null);

    const loadData = useCallback(async () => {
        try {
            const [settings, diary, profile] = await Promise.all([
                getSettings(),
                getDiaryForDate(todayKey()),
                getUserProfile(),
            ]);

            const totals = calcDiaryTotals(diary);
            const goal = parseInt(settings.calorieGoal) || 2000;
            const macros = settings.macros || { carbs: 40, protein: 30, fats: 30 };

            const proteinGoal = Math.round((macros.protein / 100) * goal / 4);
            const carbsGoal = Math.round((macros.carbs / 100) * goal / 4);
            const fatsGoal = Math.round((macros.fats / 100) * goal / 9);

            const rem = {
                calories: Math.max(0, goal - totals.calories),
                protein: Math.max(0, proteinGoal - totals.protein),
                carbs: Math.max(0, carbsGoal - totals.carbs),
                fat: Math.max(0, fatsGoal - totals.fat),
            };
            setRemaining(rem);

            // Protein deficit alert after 6 PM
            const hour = new Date().getHours();
            if (hour >= 18 && rem.protein > 30) {
                const suggestion = await getMacroSolverSuggestion(rem);
                setMacroAlert({ deficit: rem.protein, suggestion });
            } else {
                setMacroAlert(null);
            }

            // Load frequent foods
            const freq = await getFrequentFoods(8);
            if (freq.length > 0) {
                setQuickFoods(freq);
            }

            // Load recipes
            loadRecipes(rem, 'All');

            // Load saved chat history
            const savedChat = await getChatHistory();
            if (savedChat.length > 0) setChatMessages(savedChat);
        } catch (err) {
            console.error('Advice screen load error:', err);
        }
    }, []);

    const loadRecipes = async (rem, filter) => {
        // Check cache first for instant switching
        if (recipeCache.current[filter]) {
            setRecipes(recipeCache.current[filter]);
            return;
        }
        setRecipesLoading(true);
        try {
            const r = await getSmartRecipes(rem, filter);
            recipeCache.current[filter] = r;
            setRecipes(r);
        } catch {
            console.warn('Failed to load recipes');
        }
        setRecipesLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleFilterChange = (filter) => {
        setActiveFilter(filter);
        loadRecipes(remaining, filter);
    };

    const handleQuickAdd = async (food) => {
        try {
            await addFoodToDiaryAutoSlot(todayKey(), {
                name: food.name,
                calories: food.calories,
                protein: food.protein,
                carbs: food.carbs,
                fat: food.fat,
            });
            const hour = new Date().getHours();
            const slot = hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 20 ? 'Dinner' : 'Snacks';
            Alert.alert('Added!', `${food.name} added to ${slot}`);
            loadData();
        } catch (err) {
            Alert.alert('Error', 'Failed to add food');
        }
    };

    const handleRecipeAdd = async (recipe) => {
        await addFoodToDiaryAutoSlot(todayKey(), {
            name: recipe.name,
            calories: recipe.calories,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
        });
        const hour = new Date().getHours();
        const slot = hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 20 ? 'Dinner' : 'Snacks';
        Alert.alert('Added!', `${recipe.name} added to ${slot}`);
        loadData();
    };

    const scaleRecipe = (recipe) => {
        if (remaining.calories <= 0) return recipe;
        const factor = remaining.calories / recipe.calories;
        return {
            ...recipe,
            calories: remaining.calories,
            protein: Math.round(recipe.protein * factor),
            carbs: Math.round(recipe.carbs * factor),
            fat: Math.round(recipe.fat * factor),
            ingredients: recipe.ingredients.map(ing => {
                const match = ing.match(/^([\d.]+)/);
                if (match) {
                    const scaled = (parseFloat(match[1]) * factor).toFixed(1).replace(/\.0$/, '');
                    return ing.replace(match[1], scaled);
                }
                return ing;
            }),
            _scaled: true,
        };
    };

    const MEAL_KEYWORDS = ['create a meal', 'make a meal', 'meal with', 'build a meal', 'create meal', 'make meal'];
    const RECIPE_KEYWORDS = ['recipe for', 'recipe of', 'make a recipe', 'create a recipe', 'recipe with', 'how to make', 'how to cook', 'give me a recipe', 'a recipe', 'recipe'];

    const handleSendChat = async (overrideText) => {
        const text = (typeof overrideText === 'string' ? overrideText : chatInput).trim();
        if (!text || chatLoading) return;
        setChatInput('');
        const userMsg = { role: 'user', text };
        const updated = [...chatMessages, userMsg];
        setChatMessages(updated);
        setChatLoading(true);

        const isMealRequest = MEAL_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
        const isRecipeRequest = !isMealRequest && RECIPE_KEYWORDS.some(kw => text.toLowerCase().includes(kw));

        try {
            if (isMealRequest) {
                const meal = await generateMeal(text);
                if (meal && meal.ingredients) {
                    setActiveMeal(meal);
                    setMealSaved(false);
                    const aiMsg = { role: 'ai', text: `Here's your meal: **${meal.name}**`, type: 'meal' };
                    const final = [...updated, aiMsg];
                    setChatMessages(final);
                    await saveChatHistory(final);
                } else {
                    const context = { remaining, todayDate: todayKey() };
                    const reply = await askNutritionQuestion(text, context, chatMessages);
                    const aiMsg = { role: 'ai', text: reply };
                    const final = [...updated, aiMsg];
                    setChatMessages(final);
                    await saveChatHistory(final);
                }
            } else if (isRecipeRequest) {
                console.log("RECIPE REQUEST DETECTED:", text);
                const recipe = await generateRecipeFromChat(text);
                console.log("RECIPE RESULT:", recipe ? "success" : "null");
                if (recipe && recipe.ingredients) {
                    const aiMsg = { role: 'ai', text: `Here's your recipe: **${recipe.name}**`, type: 'recipe', recipe: recipe };
                    const final = [...updated, aiMsg];
                    setChatMessages(final);
                    await saveChatHistory(final);
                } else {
                    const context = { remaining, todayDate: todayKey() };
                    const reply = await askNutritionQuestion(text, context, chatMessages);
                    const aiMsg = { role: 'ai', text: reply };
                    const final = [...updated, aiMsg];
                    setChatMessages(final);
                    await saveChatHistory(final);
                }
            } else {
                const context = { remaining, todayDate: todayKey() };
                const reply = await askNutritionQuestion(text, context, chatMessages);
                const aiMsg = { role: 'ai', text: reply };
                const final = [...updated, aiMsg];
                setChatMessages(final);
                await saveChatHistory(final);
            }
        } catch {
            const errMsg = { role: 'ai', text: "Couldn't get a response. Check your API key in Settings." };
            const final = [...updated, errMsg];
            setChatMessages(final);
            await saveChatHistory(final);
        }
        setChatLoading(false);
    };

    const handleAddIngredient = async () => {
        if (!addIngredientInput.trim() || !activeMeal || mealLoading) return;
        setMealLoading(true);
        const updated = await addIngredientToMeal(activeMeal, addIngredientInput.trim());
        if (updated && updated.ingredients) {
            setActiveMeal(updated);
            setMealSaved(false);
        }
        setAddIngredientInput('');
        setMealLoading(false);
    };

    const handleRemoveIngredient = (index) => {
        if (!activeMeal) return;
        const newIngredients = activeMeal.ingredients.filter((_, i) => i !== index);
        const totals = newIngredients.reduce((acc, ing) => ({
            calories: acc.calories + (ing.calories || 0),
            protein: acc.protein + (ing.protein || 0),
            carbs: acc.carbs + (ing.carbs || 0),
            fat: acc.fat + (ing.fat || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        setActiveMeal({ ...activeMeal, ingredients: newIngredients, ...totals });
        setMealSaved(false);
    };

    const handleSaveMeal = async () => {
        if (!activeMeal) return;
        await saveMeal({
            name: activeMeal.name,
            calories: activeMeal.calories,
            protein: activeMeal.protein,
            carbs: activeMeal.carbs,
            fat: activeMeal.fat,
            ingredients: activeMeal.ingredients,
            source: 'ai',
        });
        setMealSaved(true);
        Alert.alert('Saved!', `"${activeMeal.name}" added to My Meals.`);
    };


    const handleSaveRecipe = async (recipe) => {
        await saveRecipe({
            name: recipe.name,
            calories: recipe.calories,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
            prepTime: recipe.prepTime || '15 mins',
            tag: recipe.tag || 'BALANCED',
            ingredients: recipe.ingredients || [],
            steps: recipe.steps || [],
            source: 'ai',
        });
        Alert.alert('Saved!', `"${recipe.name}" saved to your Recipes.`);
    };

    const handleClearChat = async () => {
        setChatMessages([]);
        setActiveMeal(null);
        setMealSaved(false);
        await clearChatHistory();
    };

    // Keyboard — move only the floating pill
    const keyboardHeight = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const show = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => Animated.timing(keyboardHeight, { toValue: e.endCoordinates.height - 50, duration: 250, useNativeDriver: false }).start()
        );
        const hide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => Animated.timing(keyboardHeight, { toValue: 0, duration: 200, useNativeDriver: false }).start()
        );
        return () => { show.remove(); hide.remove(); };
    }, []);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                        <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.headerTitle}>Advice</Text>
                </View>
                <View style={styles.remainingBadge}>
                    <Text style={styles.remainingText}>{remaining.calories} kcal left</Text>
                </View>
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Macro Alert */}
                    {macroAlert && (
                        <View style={styles.alertCard}>
                            <View style={styles.alertRow}>
                                <MaterialIcons name="warning" size={18} color="#f59e0b" />
                                <Text style={styles.alertTitle}>
                                    You're {macroAlert.deficit}g short on protein
                                </Text>
                            </View>
                            <Text style={styles.alertText}>{macroAlert.suggestion}</Text>
                        </View>
                    )}

                    {/* Quick Add Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>{t('quickAdd')}</Text>
                            <Text style={styles.sectionSub}>{t('tapToLog')}</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                            {quickFoods.map((food, i) => (
                                <View key={i} style={styles.quickCard}>
                                    <Text style={styles.quickName} numberOfLines={1}>{food.name}</Text>
                                    <Text style={styles.quickCal}>{food.calories} kcal</Text>
                                    <View style={styles.quickMacroRow}>
                                        <Text style={styles.quickMacro}>P {food.protein}g</Text>
                                        <Text style={styles.quickMacroDot}>·</Text>
                                        <Text style={styles.quickMacro}>C {food.carbs}g</Text>
                                    </View>
                                    <TouchableOpacity style={styles.quickAddBtn} onPress={() => handleQuickAdd(food)}>
                                        <MaterialIcons name="add" size={18} color={colors.bgDark} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Recipes Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('recipesForYou')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {FILTERS.map(f => (
                                <TouchableOpacity key={f}
                                    style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                                    onPress={() => handleFilterChange(f)}
                                >
                                    <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{t(FILTER_KEYS[f])}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {recipesLoading ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.loadingText}>Finding recipes...</Text>
                            </View>
                        ) : (
                            recipes.map((recipe, i) => {
                                const isExpanded = expandedRecipe === i;
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.recipeCard}
                                        onPress={() => setExpandedRecipe(isExpanded ? null : i)}
                                        activeOpacity={0.8}
                                    >
                                        {/* Header Row */}
                                        <View style={styles.recipeHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.recipeName}>{recipe.name}</Text>
                                                <View style={styles.recipeTagRow}>
                                                    <View style={styles.recipeTag}>
                                                        <MaterialIcons name="schedule" size={10} color={colors.primary} />
                                                        <Text style={styles.recipeTagText}>{recipe.prepTime}</Text>
                                                    </View>
                                                    <View style={[styles.recipeTag, styles.recipeTagHighlight]}>
                                                        <Text style={styles.recipeTagTextHighlight}>{recipe.tag}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <Text style={styles.recipeCal}>{recipe.calories}</Text>
                                            <Text style={styles.recipeCalUnit}>kcal</Text>
                                        </View>

                                        {/* Macro Badges + collapsed actions */}
                                        <View style={styles.recipeMacros}>
                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                                                <Text style={[styles.macroBadgeText, { color: '#3b82f6' }]}>P: {recipe.protein}g</Text>
                                            </View>
                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                                                <Text style={[styles.macroBadgeText, { color: '#eab308' }]}>C: {recipe.carbs}g</Text>
                                            </View>
                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                                                <Text style={[styles.macroBadgeText, { color: '#ef4444' }]}>F: {recipe.fat}g</Text>
                                            </View>
                                            <View style={{ flex: 1 }} />
                                            {!isExpanded && (
                                                <TouchableOpacity
                                                    style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' }}
                                                    onPress={() => handleSaveRecipe(recipe)}
                                                >
                                                    <MaterialIcons name="bookmark-border" size={16} color={colors.primary} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Expanded: ingredients, steps, actions */}
                                        {isExpanded && (
                                            <View style={styles.recipeExpanded}>
                                                <Text style={styles.recipeSubHead}>{t('ingredients')}</Text>
                                                {(recipe.ingredients || []).map((ing, j) => (
                                                    <View key={j} style={styles.ingredientRow}>
                                                        <Text style={styles.ingredientBullet}>•</Text>
                                                        <Text style={styles.ingredientText}>{ing}</Text>
                                                    </View>
                                                ))}

                                                <Text style={[styles.recipeSubHead, { marginTop: 12 }]}>Steps</Text>
                                                {(recipe.steps || []).map((step, j) => (
                                                    <View key={j} style={styles.stepRow}>
                                                        <View style={styles.stepNum}>
                                                            <Text style={styles.stepNumText}>{j + 1}</Text>
                                                        </View>
                                                        <Text style={styles.stepText}>{step}</Text>
                                                    </View>
                                                ))}

                                                <View style={styles.recipeActions}>
                                                    <TouchableOpacity
                                                        style={styles.scaleBtn}
                                                        onPress={() => {
                                                            const scaled = scaleRecipe(recipe);
                                                            const newRecipes = [...recipes];
                                                            newRecipes[i] = scaled;
                                                            setRecipes(newRecipes);
                                                        }}
                                                    >
                                                        <MaterialIcons name="tune" size={14} color={colors.primary} />
                                                        <Text style={styles.scaleBtnText}>
                                                            {recipe._scaled ? 'Scaled ✓' : 'Scale to Fit'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.addRecipeBtn} onPress={() => handleSaveRecipe(recipe)}>
                                                        <MaterialIcons name="bookmark" size={14} color={colors.bgDark} />
                                                        <Text style={styles.addRecipeBtnText}>{t('saveToRecipes')}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)' }}
                                                        onPress={() => { const newR = [...recipes]; newR.splice(i, 1); setRecipes(newR); }}
                                                    >
                                                        <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* AI Chat Section */}
                    <View style={styles.section}>
                        <View style={styles.chatHeader}>
                            <Text style={[styles.sectionTitle, { marginBottom: 0, paddingHorizontal: 0 }]}>{t('aiNutrition')}</Text>
                            {chatMessages.length > 0 && (
                                <TouchableOpacity onPress={handleClearChat} style={styles.clearBtn}>
                                    <MaterialIcons name="delete-outline" size={16} color={colors.textMuted} />
                                    <Text style={styles.clearBtnText}>Clear</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Chat Messages */}
                        <View style={styles.chatBox}>
                            {chatMessages.length === 0 && (
                                <View style={styles.chatEmpty}>
                                    <MaterialIcons name="smart-toy" size={28} color={colors.textMuted} />
                                    <Text style={styles.chatEmptyText}>
                                        Ask me anything about nutrition, meals, or macros
                                    </Text>
                                </View>
                            )}
                            {chatMessages.map((msg, i) => (
                                <View key={i}>
                                    {msg.type === 'meal' && activeMeal ? (
                                        <View style={styles.mealCard}>
                                            <View style={styles.mealCardHeader}>
                                                <MaterialIcons name="restaurant-menu" size={18} color={colors.primary} />
                                                <Text style={styles.mealCardTitle}>{activeMeal.name}</Text>
                                            </View>
                                            <View style={styles.mealMacroRow}>
                                                <Text style={styles.mealMacro}>{activeMeal.calories} kcal</Text>
                                                <Text style={[styles.mealMacro, { color: '#4ECDC4' }]}>P: {activeMeal.protein}g</Text>
                                                <Text style={[styles.mealMacro, { color: '#FFD93D' }]}>C: {activeMeal.carbs}g</Text>
                                                <Text style={[styles.mealMacro, { color: '#FF6B6B' }]}>F: {activeMeal.fat}g</Text>
                                            </View>
                                            <View style={styles.mealIngList}>
                                                {activeMeal.ingredients.map((ing, j) => (
                                                    <View key={j} style={styles.mealIngRow}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.mealIngName}>{ing.amount} {ing.name}</Text>
                                                            <Text style={styles.mealIngMacro}>{ing.calories} kcal • P: {ing.protein}g • C: {ing.carbs}g • F: {ing.fat}g</Text>
                                                        </View>
                                                        <TouchableOpacity onPress={() => handleRemoveIngredient(j)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                            <MaterialIcons name="close" size={16} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>
                                            <View style={styles.mealAddRow}>
                                                <TextInput
                                                    style={styles.mealAddInput}
                                                    value={addIngredientInput}
                                                    onChangeText={setAddIngredientInput}
                                                    placeholder="Add ingredient (e.g. steamed carrots)"
                                                    placeholderTextColor={colors.textMuted}
                                                    onSubmitEditing={handleAddIngredient}
                                                    returnKeyType="done"
                                                />
                                                <TouchableOpacity style={styles.mealAddBtn} onPress={handleAddIngredient} disabled={mealLoading}>
                                                    {mealLoading ? (
                                                        <ActivityIndicator size="small" color={colors.primary} />
                                                    ) : (
                                                        <MaterialIcons name="add" size={18} color={colors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.mealSaveBtn, mealSaved && { backgroundColor: colors.surface }]}
                                                onPress={handleSaveMeal}
                                                disabled={mealSaved}
                                            >
                                                <MaterialIcons name={mealSaved ? 'check' : 'bookmark-border'} size={16} color={mealSaved ? colors.primary : colors.bgDark} />
                                                <Text style={[styles.mealSaveBtnText, mealSaved && { color: colors.primary }]}>
                                                    {mealSaved ? 'Saved to My Meals' : 'Save Meal'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : msg.type === 'recipe' && msg.recipe ? (
                                        <TouchableOpacity style={styles.recipeCard} activeOpacity={0.8} onPress={() => setExpandedChatRecipe(expandedChatRecipe === i ? null : i)}>
                                            {/* Header Row */}
                                            <View style={styles.recipeHeader}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.recipeName}>{msg.recipe.name}</Text>
                                                    <View style={styles.recipeTagRow}>
                                                        <View style={styles.recipeTag}>
                                                            <MaterialIcons name="schedule" size={10} color={colors.primary} />
                                                            <Text style={styles.recipeTagText}>{msg.recipe.prepTime || '15 mins'}</Text>
                                                        </View>
                                                        <View style={[styles.recipeTag, styles.recipeTagHighlight]}>
                                                            <Text style={styles.recipeTagTextHighlight}>{msg.recipe.tag || 'BALANCED'}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                                <Text style={styles.recipeCal}>{msg.recipe.calories}</Text>
                                                <Text style={styles.recipeCalUnit}>kcal</Text>
                                            </View>

                                            {/* Macro Badges + collapsed actions */}
                                            <View style={styles.recipeMacros}>
                                                <View style={[styles.macroBadge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                                                    <Text style={[styles.macroBadgeText, { color: '#3b82f6' }]}>P: {msg.recipe.protein}g</Text>
                                                </View>
                                                <View style={[styles.macroBadge, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                                                    <Text style={[styles.macroBadgeText, { color: '#eab308' }]}>C: {msg.recipe.carbs}g</Text>
                                                </View>
                                                <View style={[styles.macroBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                                                    <Text style={[styles.macroBadgeText, { color: '#ef4444' }]}>F: {msg.recipe.fat}g</Text>
                                                </View>
                                                <View style={{ flex: 1 }} />
                                                {expandedChatRecipe !== i && (
                                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                                        <TouchableOpacity
                                                            style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' }}
                                                            onPress={() => handleSaveRecipe(msg.recipe)}
                                                        >
                                                            <MaterialIcons name="bookmark-border" size={16} color={colors.primary} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,107,0.1)' }}
                                                            onPress={() => { const updated = chatMessages.filter((_, idx) => idx !== i); setChatMessages(updated); }}
                                                        >
                                                            <MaterialIcons name="delete-outline" size={15} color="#ff6b6b" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Expanded: ingredients, steps, save */}
                                            {expandedChatRecipe === i && (
                                                <View style={styles.recipeExpanded}>
                                                    <Text style={styles.recipeSubHead}>Ingredients</Text>
                                                    {(msg.recipe.ingredients || []).map((ing, j) => (
                                                        <View key={j} style={styles.ingredientRow}>
                                                            <Text style={styles.ingredientBullet}>•</Text>
                                                            <Text style={styles.ingredientText}>{ing}</Text>
                                                        </View>
                                                    ))}

                                                    <Text style={[styles.recipeSubHead, { marginTop: 12 }]}>Steps</Text>
                                                    {(msg.recipe.steps || []).map((step, j) => (
                                                        <View key={j} style={styles.stepRow}>
                                                            <View style={styles.stepNum}>
                                                                <Text style={styles.stepNumText}>{j + 1}</Text>
                                                            </View>
                                                            <Text style={styles.stepText}>{step}</Text>
                                                        </View>
                                                    ))}

                                                    <View style={styles.recipeActions}>
                                                        <TouchableOpacity style={styles.addRecipeBtn} onPress={() => handleSaveRecipe(msg.recipe)}>
                                                            <MaterialIcons name="bookmark" size={14} color={colors.bgDark} />
                                                            <Text style={styles.addRecipeBtnText}>Save to Recipes</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)' }}
                                                            onPress={() => { const updated = chatMessages.filter((_, idx) => idx !== i); setChatMessages(updated); }}
                                                        >
                                                            <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Expand hint arrow */}
                                            <View style={{ alignItems: 'center', marginTop: 4 }}>
                                                <MaterialIcons name={expandedChatRecipe === i ? 'expand-less' : 'expand-more'} size={18} color={colors.textMuted} />
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={[styles.chatBubble, msg.role === 'user' ? styles.chatUser : styles.chatAi]}>
                                            {msg.role === 'ai' && (
                                                <MaterialIcons name="smart-toy" size={14} color={colors.primary} style={{ marginRight: 6, marginTop: 2 }} />
                                            )}
                                            <Text style={[styles.chatBubbleText, msg.role === 'user' && styles.chatUserText]}>
                                                {msg.text}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                            {chatLoading && (
                                <View style={[styles.chatBubble, styles.chatAi]}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={styles.chatBubbleText}> Thinking...</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={{ height: 500 }} />
                </ScrollView>

                {/* Floating Chat Input Pill */}
                <Animated.View style={[styles.chatInputBar, { bottom: Animated.add(keyboardHeight, 92) }]}>
                    <TextInput
                        style={styles.chatInput}
                        value={chatInput}
                        onChangeText={setChatInput}
                        placeholder="Ask about nutrition..."
                        placeholderTextColor={colors.textMuted}
                        onSubmitEditing={() => handleSendChat()}
                        returnKeyType="send"
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={() => handleSendChat()} disabled={chatLoading}>
                        <MaterialIcons name="send" size={18} color={chatInput.trim() ? colors.bgDark : colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View >
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5 },
    remainingBadge: {
        backgroundColor: colors.primaryDim, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 12,
    },
    remainingText: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },
    content: { paddingTop: 8 },

    // Alert
    alertCard: {
        marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(245,158,11,0.08)',
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    },
    alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    alertTitle: { color: '#f59e0b', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    alertText: { color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', lineHeight: 18 },

    // Section
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
    sectionTitle: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, paddingHorizontal: 16, marginBottom: 10 },
    sectionSub: { color: colors.textMuted, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium' },

    // Quick Add
    quickRow: { paddingLeft: 16, paddingRight: 8, gap: 10 },
    quickCard: {
        width: 130, backgroundColor: colors.bgCard, borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: colors.border, position: 'relative',
    },
    quickName: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4, paddingRight: 24 },
    quickCal: { color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 },
    quickMacroRow: { flexDirection: 'row', alignItems: 'center' },
    quickMacro: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_500Medium' },
    quickMacroDot: { color: colors.textMuted, fontSize: 9, marginHorizontal: 3 },
    quickAddBtn: {
        position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },

    // Filters
    filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },
    filterTextActive: { color: colors.bgDark },

    // Recipe Card
    recipeCard: {
        marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.bgCard,
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border,
    },
    recipeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    recipeName: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 6 },
    recipeTagRow: { flexDirection: 'row', gap: 6 },
    recipeTag: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    recipeTagText: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold' },
    recipeTagHighlight: { backgroundColor: colors.primaryDim },
    recipeTagTextHighlight: { color: colors.primary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold' },
    recipeCal: { color: colors.text, fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', marginLeft: 8 },
    recipeCalUnit: { color: colors.textMuted, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 4 },
    recipeMacros: { flexDirection: 'row', gap: 8, marginTop: 10 },
    macroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    macroBadgeText: { fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },

    // Recipe Expanded
    recipeExpanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    recipeSubHead: { color: colors.text, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1, marginBottom: 6 },
    ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
    ingredientBullet: { color: colors.primary, fontSize: 12, marginRight: 6, marginTop: 1 },
    ingredientText: { color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
    stepNum: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    stepNumText: { color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },
    stepText: { color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', flex: 1, lineHeight: 18 },
    recipeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    scaleBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.primary,
    },
    scaleBtnText: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    addRecipeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary,
    },
    addRecipeBtnText: { color: colors.bgDark, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },

    // Loading
    loadingBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    loadingText: { color: colors.textMuted, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },


    // Chat header
    chatHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, marginBottom: 10,
    },
    clearBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
        backgroundColor: colors.surface,
    },
    clearBtnText: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Chat
    chatBox: {
        marginHorizontal: 16, backgroundColor: colors.bgCard, borderRadius: 14,
        padding: 14, borderWidth: 1, borderColor: colors.border, minHeight: 120,
    },
    chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
    chatEmptyText: { color: colors.textMuted, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', textAlign: 'center' },
    chatBubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '90%', flexDirection: 'row', flexWrap: 'wrap' },
    chatUser: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
    chatAi: { backgroundColor: colors.surface, alignSelf: 'flex-start', alignItems: 'flex-start' },
    chatBubbleText: { color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', lineHeight: 19, flexShrink: 1 },
    chatUserText: { color: colors.bgDark },

    // Chat Input - Floating pill
    chatInputBar: {
        position: 'absolute', left: 16, right: 16, bottom: 92,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 6, paddingLeft: 16,
        backgroundColor: colors.bgCard, borderRadius: 28,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    },
    chatInput: {
        flex: 1, color: colors.text,
        fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium',
        paddingVertical: 8,
    },
    sendBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },

    // Meal Card (in chat)
    mealCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: colors.primary + '40', marginBottom: 8,
    },
    mealCardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
    },
    mealCardTitle: {
        color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', flex: 1,
    },
    mealMacroRow: {
        flexDirection: 'row', gap: 10, marginBottom: 12,
        backgroundColor: colors.surface, borderRadius: 10, padding: 8,
    },
    mealMacro: {
        color: colors.text, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold',
    },
    mealIngList: { gap: 6, marginBottom: 10 },
    mealIngRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.surface, borderRadius: 10, padding: 10,
    },
    mealIngName: {
        color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    mealIngMacro: {
        color: colors.textMuted, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2,
    },
    mealAddRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
    },
    mealAddInput: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12,
        paddingVertical: 8, color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium',
        borderWidth: 1, borderColor: colors.border,
    },
    mealAddBtn: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary,
    },
    mealSaveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary,
    },
    mealSaveBtnText: {
        color: colors.bgDark, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold',
    },
});
