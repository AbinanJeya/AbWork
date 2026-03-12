import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, TouchableWithoutFeedback
} from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { searchFoodMultiple } from '../services/openai';
import { searchFoodDatabase, lookupBarcode } from '../services/foodDatabase';
import { getSettings, getSavedMeals, saveMeal, deleteSavedMeal, getSavedRecipes } from '../services/storage';
import { BarcodeScannerModal } from './BarcodeScannerModal';

const ALL_UNITS = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'scoop', 'piece', 'serving', 'slice', 'bar', 'packet'];

// Grams per single unit (rough defaults)
const GRAMS_MAP = {
    g: 1, ml: 1, oz: 28, cup: 240, tbsp: 15, tsp: 5,
    scoop: 30, piece: 30, serving: 100, slice: 25, bar: 50, packet: 30, tablet: 5,
};

export function AddFoodModal({ visible, onClose, onAdd, mealType }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState(null);

    // Serving state: qty (decimal) + unit
    const [servingQty, setServingQty] = useState(1);
    const [servingUnit, setServingUnit] = useState('g');
    const [gramsPerUnit, setGramsPerUnit] = useState(1);
    const [showUnitPicker, setShowUnitPicker] = useState(false);

    const [showScanner, setShowScanner] = useState(false);

    // My Meals state
    const [showMyMeals, setShowMyMeals] = useState(false);
    const [savedMeals, setSavedMeals] = useState([]);
    const [expandedMealId, setExpandedMealId] = useState(null);
    const [showCreateMeal, setShowCreateMeal] = useState(false);
    const [customMealName, setCustomMealName] = useState('');
    const [customIngredients, setCustomIngredients] = useState([]);
    const [newIngName, setNewIngName] = useState('');
    const [newIngCal, setNewIngCal] = useState('');
    const [newIngP, setNewIngP] = useState('');
    const [newIngC, setNewIngC] = useState('');
    const [newIngF, setNewIngF] = useState('');

    // Recipes state
    const [showRecipes, setShowRecipes] = useState(false);
    const [savedRecipes, setSavedRecipes] = useState([]);
    const [expandedRecipeId, setExpandedRecipeId] = useState(null);

    // Meal type switcher
    const [activeMeal, setActiveMeal] = useState(mealType);
    const [showMealDropdown, setShowMealDropdown] = useState(false);

    useEffect(() => {
        if (visible) setActiveMeal(mealType);
    }, [visible, mealType]);

    useEffect(() => {
        if (visible && showMyMeals) loadMyMeals();
    }, [visible, showMyMeals]);

    useEffect(() => {
        if (visible && showRecipes) {
            (async () => {
                const r = await getSavedRecipes();
                setSavedRecipes(r);
            })();
        }
    }, [visible, showRecipes]);

    const loadMyMeals = async () => {
        const meals = await getSavedMeals();
        setSavedMeals(meals);
    };

    const reset = () => {
        setSearchQuery(''); setResults([]); setHasSearched(false);
        setExpandedIndex(null); setServingQty(1); setServingUnit('g'); setGramsPerUnit(1);
        setShowUnitPicker(false); setShowMyMeals(false); setShowCreateMeal(false);
        setShowRecipes(false); setExpandedRecipeId(null);
        setShowMealDropdown(false); setActiveMeal(mealType);
    };

    const handleAddMealToDiary = (meal) => {
        onAdd({
            name: meal.name,
            calories: Math.round(meal.calories),
            protein: Math.round(meal.protein),
            carbs: Math.round(meal.carbs),
            fat: Math.round(meal.fat),
            serving: `1 meal (${meal.ingredients?.length || 0} items)`,
        }, activeMeal);
        reset();
        onClose();
    };

    const handleDeleteMeal = (id, name) => {
        Alert.alert('Delete Meal', `Remove "${name}" from My Meals?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteSavedMeal(id);
                    loadMyMeals();
                }
            },
        ]);
    };

    const handleAddCustomIngredient = () => {
        if (!newIngName.trim()) return;
        setCustomIngredients(prev => [...prev, {
            name: newIngName.trim(),
            amount: '1 serving',
            calories: parseInt(newIngCal) || 0,
            protein: parseInt(newIngP) || 0,
            carbs: parseInt(newIngC) || 0,
            fat: parseInt(newIngF) || 0,
        }]);
        setNewIngName(''); setNewIngCal(''); setNewIngP(''); setNewIngC(''); setNewIngF('');
    };

    const handleSaveCustomMeal = async () => {
        if (!customMealName.trim() || customIngredients.length === 0) {
            Alert.alert('Missing Info', 'Add a meal name and at least one ingredient.');
            return;
        }
        const totals = customIngredients.reduce((a, i) => ({
            calories: a.calories + i.calories, protein: a.protein + i.protein,
            carbs: a.carbs + i.carbs, fat: a.fat + i.fat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        await saveMeal({ name: customMealName.trim(), ...totals, ingredients: customIngredients, source: 'custom' });
        Alert.alert('Saved!', `"${customMealName.trim()}" added to My Meals.`);
        setCustomMealName(''); setCustomIngredients([]); setShowCreateMeal(false);
        loadMyMeals();
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setHasSearched(true);
        setExpandedIndex(null);
        try {
            const s = await getSettings();
            const [dbResults, aiResults] = await Promise.all([
                searchFoodDatabase(searchQuery, 6).catch(() => []),
                searchFoodMultiple(searchQuery, s.openAIKey).catch(() => []),
            ]);
            const dbTagged = (dbResults || []).map(r => ({ ...r, source: 'database' }));
            const aiTagged = (aiResults || []).map(r => ({ ...r, source: 'ai' }));
            const seen = new Set();
            const merged = [];
            for (const item of [...dbTagged, ...aiTagged]) {
                const key = item.name.toLowerCase().trim();
                if (!seen.has(key)) { seen.add(key); merged.push(item); }
            }
            setResults(merged);
        } catch (err) {
            console.error('Food search error:', err);
            setResults([]);
        }
        setSearching(false);
    };

    const handleBarcodeResult = async (barcodeString) => {
        setSearching(true);
        setHasSearched(true);
        try {
            const item = await lookupBarcode(barcodeString);
            if (item && item.name) {
                setResults([{ ...item, source: 'barcode' }]);
                setExpandedIndex(0);
                initServingFromItem(item);
                setSearchQuery(item.name);
            } else {
                Alert.alert('Not Found', `No product found for barcode ${barcodeString}. Try searching by name instead.`);
                setResults([]);
            }
        } catch (err) {
            console.error('Barcode lookup error:', err);
            Alert.alert('Error', 'Failed to look up barcode. Please try again.');
            setResults([]);
        }
        setSearching(false);
    };

    // Initialize serving controls from an item's parsed data
    const initServingFromItem = (item) => {
        if (item.servingUnit && item.servingUnit !== 'g') {
            // Product has a native unit (scoop, cup, etc.)
            setServingUnit(item.servingUnit);
            setServingQty(item.servingQty || 1);
            setGramsPerUnit(item.gramsPerUnit || GRAMS_MAP[item.servingUnit] || 100);
        } else {
            // Default to grams
            const match = item.serving?.match(/([\d.]+)/);
            setServingQty(match ? parseFloat(match[1]) : 100);
            setServingUnit('g');
            setGramsPerUnit(1);
        }
    };

    const handleExpand = (index) => {
        if (expandedIndex === index) {
            setExpandedIndex(null);
            setShowUnitPicker(false);
        } else {
            setExpandedIndex(index);
            setShowUnitPicker(false);
            initServingFromItem(results[index]);
        }
    };

    // Calculate total grams from qty * gramsPerUnit
    const totalGrams = servingQty * gramsPerUnit;

    // Scale macro values from per-100g to the current total grams
    const getScaled = (baseVal) => {
        return Math.round((baseVal / 100) * totalGrams * 10) / 10;
    };

    const handleLogFood = (item) => {
        const unitLabel = servingUnit === 'g' ? `${Math.round(totalGrams)}g` : `${servingQty} ${servingUnit}`;
        onAdd({
            name: item.name,
            calories: Math.round(getScaled(item.calories)),
            protein: Math.round(getScaled(item.protein)),
            carbs: Math.round(getScaled(item.carbs)),
            fat: Math.round(getScaled(item.fat)),
            serving: unitLabel,
        }, activeMeal);
        reset();
        onClose();
    };

    const changeUnit = (newUnit) => {
        const newGPU = gramsPerUnit; // keep the item's grams per unit if switching back
        // If switching to grams, convert current qty to total grams
        if (newUnit === 'g') {
            setServingQty(Math.round(totalGrams * 10) / 10);
            setGramsPerUnit(1);
        } else if (newUnit === 'ml') {
            setServingQty(Math.round(totalGrams * 10) / 10);
            setGramsPerUnit(1);
        } else {
            // Use the item's gramsPerUnit if it matches, else use default
            const gpu = GRAMS_MAP[newUnit] || 100;
            setGramsPerUnit(gpu);
            setServingQty(Math.round((totalGrams / gpu) * 10) / 10);
        }
        setServingUnit(newUnit);
        setShowUnitPicker(false);
    };

    const adjustQty = (delta) => {
        const step = servingUnit === 'g' || servingUnit === 'ml' ? 10 : 0.5;
        setServingQty(q => Math.max(step, Math.round((q + delta * step) * 10) / 10));
    };

    const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };

    const getSourceBadge = (source) => {
        switch (source) {
            case 'database': return { label: '🌐 Database', color: '#3b82f6' };
            case 'barcode': return { label: '📷 Scanned', color: '#a855f7' };
            case 'ai': return { label: 'AI', color: colors.primary };
            default: return null;
        }
    };

    const formatUnit = (u) => {
        const labels = {
            g: 'g', ml: 'ml', oz: 'oz', cup: 'cup', tbsp: 'tbsp', tsp: 'tsp',
            scoop: 'scoop', piece: 'pc', serving: 'srv', slice: 'slice', bar: 'bar', packet: 'pkt'
        };
        return labels[u] || u;
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <TouchableWithoutFeedback onPress={() => { reset(); onClose(); }}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <View style={styles.sheet} pointerEvents="box-none">
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                            <Text style={styles.closeBtn}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.sheetTitle}>Log Food</Text>
                        <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                            <Text style={styles.doneBtn}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar + Barcode */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchRow}>
                            <MaterialIcons name="search" size={18} color={colors.slate500} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search for food (e.g., Chicken Breast)"
                                placeholderTextColor={colors.slate500}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            <TouchableOpacity
                                style={{ padding: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                                onPress={() => setShowScanner(true)}
                            >
                                <MaterialIcons name="camera-alt" size={18} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Meal Badge + Meals / Recipes pills */}
                    <View style={styles.mealBadgeRow}>
                        <TouchableOpacity style={styles.mealBadge} onPress={() => setShowMealDropdown(!showMealDropdown)}>
                            <Text style={styles.mealBadgeText}>Adding to {mealLabels[activeMeal] || 'Meal'}</Text>
                            <MaterialIcons name={showMealDropdown ? 'expand-less' : 'expand-more'} size={14} color={colors.primary} style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.mealBadge, showMyMeals && { backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '50' }]}
                            onPress={() => { setShowMyMeals(!showMyMeals); setShowRecipes(false); }}
                        >
                            <MaterialIcons name="restaurant" size={12} color={showMyMeals ? colors.primary : colors.textMuted} style={{ marginRight: 3 }} />
                            <Text style={[styles.mealBadgeText, showMyMeals && { color: colors.primary }]}>Meals</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.mealBadge, showRecipes && { backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '50' }]}
                            onPress={() => { setShowRecipes(!showRecipes); setShowMyMeals(false); }}
                        >
                            <MaterialIcons name="menu-book" size={12} color={showRecipes ? colors.primary : colors.textMuted} style={{ marginRight: 3 }} />
                            <Text style={[styles.mealBadgeText, showRecipes && { color: colors.primary }]}>Recipes</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Meal type dropdown */}
                    {showMealDropdown && (
                        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 8, flexWrap: 'wrap' }}>
                            {Object.entries(mealLabels).filter(([k]) => k !== activeMeal).map(([key, label]) => (
                                <TouchableOpacity key={key}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
                                    onPress={() => { setActiveMeal(key); setShowMealDropdown(false); }}
                                >
                                    <MaterialIcons name={key === 'breakfast' ? 'wb-sunny' : key === 'lunch' ? 'restaurant' : key === 'dinner' ? 'nightlight-round' : 'icecream'} size={12} color={colors.textMuted} />
                                    <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Results / My Meals */}
                    <ScrollView style={styles.resultsList} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        {showRecipes ? (
                            /* ─── Recipes List ─── */
                            <View>
                                {savedRecipes.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="menu-book" size={32} color={colors.slate500} style={{ marginBottom: 8 }} />
                                        <Text style={styles.hintText}>No saved recipes yet</Text>
                                        <Text style={styles.hintSubtext}>Ask the AI for a recipe and save it!</Text>
                                    </View>
                                ) : (
                                    savedRecipes.map((recipe) => {
                                        const isExp = expandedRecipeId === recipe.id;
                                        return (
                                            <TouchableOpacity key={recipe.id} style={styles.savedMealCard} onPress={() => setExpandedRecipeId(isExp ? null : recipe.id)} activeOpacity={0.7}>
                                                <View style={styles.savedMealTop}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.savedMealName}>{recipe.name}</Text>
                                                        <Text style={styles.savedMealMacro}>{recipe.calories} kcal • P: {recipe.protein}g • C: {recipe.carbs}g • F: {recipe.fat}g</Text>
                                                    </View>
                                                    <MaterialIcons name={isExp ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
                                                </View>
                                                {isExp && (
                                                    <View style={styles.savedMealExpanded}>
                                                        <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 }}>Ingredients</Text>
                                                        {(recipe.ingredients || []).map((ing, j) => (
                                                            <View key={j} style={{ flexDirection: 'row', paddingVertical: 2 }}>
                                                                <Text style={{ color: colors.primary, fontSize: 12, marginRight: 6 }}>•</Text>
                                                                <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 }}>{ing}</Text>
                                                            </View>
                                                        ))}
                                                        {recipe.steps && recipe.steps.length > 0 && (
                                                            <View style={{ marginTop: 8 }}>
                                                                <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 }}>Steps</Text>
                                                                {recipe.steps.map((step, j) => (
                                                                    <View key={j} style={{ flexDirection: 'row', paddingVertical: 2, gap: 6 }}>
                                                                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                                                                            <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' }}>{j + 1}</Text>
                                                                        </View>
                                                                        <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 }}>{step}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}
                                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                                            <TouchableOpacity style={styles.addMealDiaryBtn} onPress={() => { onAdd({ name: recipe.name, calories: recipe.calories || 0, protein: recipe.protein || 0, carbs: recipe.carbs || 0, fat: recipe.fat || 0, serving: '1 serving' }, activeMeal); reset(); onClose(); }}>
                                                                <MaterialIcons name="add" size={14} color={colors.bgDark} />
                                                                <Text style={styles.addMealDiaryBtnText}>Add to Diary</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                        ) : showMyMeals ? (
                            <View>
                                <View style={styles.myMealsHeader}>
                                    <Text style={styles.myMealsTitle}>My Meals</Text>
                                </View>

                                {/* Saved Meals List */}
                                {savedMeals.length === 0 && (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="restaurant" size={32} color={colors.slate500} style={{ marginBottom: 8 }} />
                                        <Text style={styles.hintText}>No saved meals yet</Text>
                                        <Text style={styles.hintSubtext}>Create one here or ask the AI in the Advice tab</Text>
                                    </View>
                                )}

                                {savedMeals.map((meal) => {
                                    const isExp = expandedMealId === meal.id;
                                    return (
                                        <TouchableOpacity key={meal.id} style={styles.savedMealCard} onPress={() => setExpandedMealId(isExp ? null : meal.id)} activeOpacity={0.7}>
                                            <View style={styles.savedMealTop}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={styles.savedMealName}>{meal.name}</Text>
                                                        <View style={[styles.sourcePill, { backgroundColor: meal.source === 'ai' ? colors.primaryDim : colors.surface }]}>
                                                            <Text style={[styles.sourcePillText, { color: meal.source === 'ai' ? colors.primary : colors.textMuted }]}>{meal.source === 'ai' ? 'AI' : 'Custom'}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.savedMealMacro}>{meal.calories} kcal • P: {meal.protein}g • C: {meal.carbs}g • F: {meal.fat}g</Text>
                                                </View>
                                                <MaterialIcons name={isExp ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
                                            </View>
                                            {isExp && (
                                                <View style={styles.savedMealExpanded}>
                                                    {meal.ingredients?.map((ing, j) => (
                                                        <View key={j} style={styles.savedMealIngRow}>
                                                            <Text style={styles.savedMealIngName}>{ing.amount} {ing.name}</Text>
                                                            <Text style={styles.savedMealIngMacro}>{ing.calories} kcal</Text>
                                                        </View>
                                                    ))}
                                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                                        <TouchableOpacity style={styles.addMealDiaryBtn} onPress={() => handleAddMealToDiary(meal)}>
                                                            <MaterialIcons name="add" size={14} color={colors.bgDark} />
                                                            <Text style={styles.addMealDiaryBtnText}>Add to Diary</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={styles.deleteMealBtn} onPress={() => handleDeleteMeal(meal.id, meal.name)}>
                                                            <MaterialIcons name="delete-outline" size={14} color={'#FF6B6B'} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View>
                                {searching && (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator color={colors.primary} size="large" />
                                        <Text style={styles.loadingText}>Searching foods...</Text>
                                    </View>
                                )}

                                {!searching && hasSearched && results.length === 0 && (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No results found. Try a different search.</Text>
                                    </View>
                                )}

                                {!searching && results.map((item, index) => {
                                    const isExpanded = expandedIndex === index;
                                    const scaledCal = isExpanded ? Math.round(getScaled(item.calories)) : item.calories;
                                    const scaledP = isExpanded ? getScaled(item.protein) : item.protein;
                                    const scaledC = isExpanded ? getScaled(item.carbs) : item.carbs;
                                    const scaledF = isExpanded ? getScaled(item.fat) : item.fat;
                                    const badge = getSourceBadge(item.source);

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.resultCard, isExpanded && styles.resultCardExpanded]}
                                            onPress={() => handleExpand(index)}
                                            activeOpacity={0.7}
                                        >
                                            {/* Top row */}
                                            <View style={styles.resultTopRow}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={styles.nameWithBadge}>
                                                        <Text style={styles.resultName}>{item.name}</Text>
                                                        {badge && (
                                                            <View style={[styles.sourceBadge, { backgroundColor: badge.color + '20' }]}>
                                                                <Text style={[styles.sourceBadgeText, { color: badge.color }]}>{badge.label}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={styles.resultMeta}>
                                                        {item.brand && item.brand !== 'Generic' ? `${item.brand} • ` : ''}{item.serving} • {item.calories} kcal/100g
                                                    </Text>
                                                </View>
                                                {!isExpanded ? (
                                                    <View style={styles.plusBtn}>
                                                        <Text style={styles.plusBtnText}>＋</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.collapseIcon}>▲</Text>
                                                )}
                                            </View>

                                            {/* Expanded */}
                                            {isExpanded && (
                                                <View style={styles.expandedBody}>
                                                    {/* Serving Adjuster */}
                                                    <View style={styles.servingRow}>
                                                        <Text style={styles.servingLabel}>Amount</Text>
                                                        <View style={styles.servingControl}>
                                                            <TouchableOpacity style={styles.servingBtn} onPress={() => adjustQty(-1)}>
                                                                <Text style={styles.servingBtnText}>−</Text>
                                                            </TouchableOpacity>
                                                            <TextInput
                                                                style={styles.servingInput}
                                                                value={String(servingQty)}
                                                                onChangeText={(t) => {
                                                                    const cleaned = t.replace(/[^0-9.]/g, '');
                                                                    if (cleaned === '' || cleaned === '.') {
                                                                        setServingQty(0);
                                                                        return;
                                                                    }
                                                                    const num = parseFloat(cleaned);
                                                                    if (!isNaN(num)) setServingQty(num);
                                                                }}
                                                                keyboardType="decimal-pad"
                                                                selectTextOnFocus
                                                            />
                                                            <TouchableOpacity style={styles.servingBtn} onPress={() => adjustQty(1)}>
                                                                <Text style={styles.servingBtnText}>＋</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        {/* Unit toggle */}
                                                        <TouchableOpacity
                                                            style={styles.unitBadge}
                                                            onPress={() => setShowUnitPicker(!showUnitPicker)}
                                                        >
                                                            <Text style={styles.unitBadgeText}>{formatUnit(servingUnit)}</Text>
                                                            <Text style={styles.unitArrow}>▼</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    {/* Unit Picker Dropdown */}
                                                    {showUnitPicker && (
                                                        <View style={styles.unitDropdown}>
                                                            {ALL_UNITS.map(u => (
                                                                <TouchableOpacity
                                                                    key={u}
                                                                    style={[styles.unitOption, servingUnit === u && styles.unitOptionActive]}
                                                                    onPress={() => changeUnit(u)}
                                                                >
                                                                    <Text style={[styles.unitOptionText, servingUnit === u && { color: colors.primary }]}>
                                                                        {formatUnit(u)}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* Total display */}
                                                    <View style={styles.totalRow}>
                                                        <Text style={styles.totalLabel}>
                                                            {servingUnit !== 'g' && servingUnit !== 'ml'
                                                                ? `≈ ${Math.round(totalGrams)}g`
                                                                : ''}
                                                        </Text>
                                                        <View style={styles.totalCalCol}>
                                                            <Text style={styles.totalCalLabel}>TOTAL</Text>
                                                            <Text style={styles.totalCalVal}>{scaledCal} kcal</Text>
                                                        </View>
                                                    </View>

                                                    {/* Macro Boxes */}
                                                    <View style={styles.macroBoxRow}>
                                                        <View style={styles.macroBox}>
                                                            <Text style={styles.macroBoxLabel}>PROTEIN</Text>
                                                            <Text style={styles.macroBoxVal}>{scaledP}g</Text>
                                                        </View>
                                                        <View style={styles.macroBox}>
                                                            <Text style={styles.macroBoxLabel}>CARBS</Text>
                                                            <Text style={styles.macroBoxVal}>{scaledC}g</Text>
                                                        </View>
                                                        <View style={styles.macroBox}>
                                                            <Text style={styles.macroBoxLabel}>FATS</Text>
                                                            <Text style={styles.macroBoxVal}>{scaledF}g</Text>
                                                        </View>
                                                    </View>

                                                    {/* Log Button */}
                                                    <TouchableOpacity style={styles.logBtn} onPress={() => handleLogFood(item)}>
                                                        <Text style={styles.logBtnText}>✓  Log to Diary</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}

                                {!searching && !hasSearched && (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="search" size={32} color={colors.slate500} style={{ marginBottom: 8 }} />
                                        <Text style={styles.hintText}>Search for food or scan a barcode</Text>
                                        <Text style={styles.hintSubtext}>Try "kirkland chicken breast", "banana", or tap the camera to scan</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>

            <BarcodeScannerModal
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={handleBarcodeResult}
            />
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '85%', flex: 1,
    },
    handle: {
        width: 48, height: 5, backgroundColor: colors.slate800, borderRadius: 3,
        alignSelf: 'center', marginTop: 12,
    },
    sheetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    closeBtn: { color: colors.slate400, fontSize: 18, padding: 4, minWidth: 60 },
    sheetTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },
    doneBtn: {
        color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold',
        backgroundColor: colors.primaryDim, paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 999, overflow: 'hidden', minWidth: 60, textAlign: 'right',
    },

    searchContainer: { paddingHorizontal: 20, paddingBottom: 12 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
        borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, color: colors.white, fontSize: 14, paddingVertical: 14 },
    barcodeBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
        marginLeft: 8, borderWidth: 1, borderColor: colors.primary + '40',
    },
    barcodeBtnText: { fontSize: 18 },

    mealBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
    mealBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
        paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    },
    mealBadgeText: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' },

    resultsList: { flex: 1, paddingHorizontal: 20 },

    resultCard: {
        backgroundColor: colors.bgCard, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: 'hidden',
    },
    resultCardExpanded: { borderColor: colors.primary, borderWidth: 1.5 },
    resultTopRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
    },
    nameWithBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    resultName: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    sourceBadgeText: { fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold' },
    resultMeta: { color: colors.slate400, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 3 },
    plusBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    plusBtnText: { color: colors.primary, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    collapseIcon: { color: colors.slate400, fontSize: 14, padding: 8 },

    expandedBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },

    // Serving row
    servingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    servingLabel: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', width: 50 },
    servingControl: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    servingBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bgCard,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    servingBtnText: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    servingInput: {
        color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center',
        width: 56, paddingVertical: 4,
    },
    unitBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 8,
    },
    unitBadgeText: { color: colors.bgDark, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    unitArrow: { color: colors.bgDark, fontSize: 8 },

    // Unit picker
    unitDropdown: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 6,
        backgroundColor: colors.bgCard, borderRadius: 12, padding: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    unitOption: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    },
    unitOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
    unitOptionText: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Total row
    totalRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 4,
    },
    totalLabel: { color: colors.slate400, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },
    totalCalCol: { alignItems: 'flex-end' },
    totalCalLabel: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 1 },
    totalCalVal: { color: colors.primary, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },

    macroBoxRow: { flexDirection: 'row', gap: 8 },
    macroBox: {
        flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    macroBoxLabel: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 1, marginBottom: 4 },
    macroBoxVal: { color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    logBtn: {
        backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    logBtnText: { color: colors.bgDark, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    loadingContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    loadingText: { color: colors.slate400, fontSize: 14 },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: colors.slate400, fontSize: 14 },
    hintIcon: { fontSize: 32, marginBottom: 12 },
    hintText: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', marginBottom: 4 },
    hintSubtext: { color: colors.slate400, fontSize: 13 },

    // My Meals
    myMealsHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
    },
    myMealsTitle: { color: colors.text, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold' },
    createMealBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primaryDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    createMealBtnText: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' },
    customMealForm: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    customMealNameInput: {
        color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold',
        borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10, marginBottom: 10,
    },
    customIngRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    customIngName: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    customIngMacro: { color: colors.textMuted, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },
    customAddSection: { marginTop: 8 },
    customAddName: {
        color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium',
        backgroundColor: colors.bgDark, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border, marginBottom: 6,
    },
    customMacroInputRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
    customMacroInput: {
        flex: 1, color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium',
        backgroundColor: colors.bgDark, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
        borderWidth: 1, borderColor: colors.border, textAlign: 'center',
    },
    customAddIngBtn: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    saveCustomBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary,
    },
    saveCustomBtnText: { color: colors.bgDark, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    savedMealCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    savedMealTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    savedMealName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    savedMealMacro: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 3 },
    sourcePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    sourcePillText: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },
    savedMealExpanded: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
    savedMealIngRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
    },
    savedMealIngName: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },
    savedMealIngMacro: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' },
    addMealDiaryBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary,
    },
    addMealDiaryBtnText: { color: colors.bgDark, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    deleteMealBtn: {
        width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)',
    },
});
