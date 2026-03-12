import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { getSavedMeals, saveMeal, deleteSavedMeal, getSettings } from '../services/storage';
import { searchFoodMultiple } from '../services/openai';
import { searchFoodDatabase, lookupBarcode } from '../services/foodDatabase';
import { BarcodeScannerModal } from './BarcodeScannerModal';

const GRAMS_MAP = {
    g: 1, ml: 1, oz: 28, cup: 240, tbsp: 15, tsp: 5,
    scoop: 30, piece: 30, serving: 100, slice: 25, bar: 50, packet: 30,
};
const ALL_UNITS = Object.keys(GRAMS_MAP);

export function MyMealsModal({ visible, onClose, onAddToDiary }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);

    // View state
    const [view, setView] = useState('list'); // 'list' | 'create'

    // Saved meals
    const [meals, setMeals] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // Meal builder
    const [mealName, setMealName] = useState('');
    const [ingredients, setIngredients] = useState([]);

    // Food search for builder
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Selected food serving adjustment
    const [selectedFood, setSelectedFood] = useState(null);
    const [servingQty, setServingQty] = useState(1);
    const [servingUnit, setServingUnit] = useState('serving');
    const [gramsPerUnit, setGramsPerUnit] = useState(100);
    const [showScanner, setShowScanner] = useState(false);
    const [slotPickerMeal, setSlotPickerMeal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        if (visible) {
            loadMeals();
            setView('list');
        }
    }, [visible]);

    const loadMeals = async () => {
        const saved = await getSavedMeals();
        setMeals(saved);
    };

    const resetBuilder = () => {
        setMealName('');
        setIngredients([]);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedFood(null);
    };

    // ─── Search ──────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSelectedFood(null);
        try {
            const s = await getSettings();
            const [dbR, aiR] = await Promise.all([
                searchFoodDatabase(searchQuery, 6).catch(() => []),
                searchFoodMultiple(searchQuery, s.openAIKey).catch(() => []),
            ]);
            const dbTagged = (dbR || []).map(r => ({ ...r, source: 'database' }));
            const aiTagged = (aiR || []).map(r => ({ ...r, source: 'ai' }));
            const seen = new Set();
            const merged = [];
            for (const item of [...dbTagged, ...aiTagged]) {
                const key = item.name.toLowerCase().trim();
                if (!seen.has(key)) { seen.add(key); merged.push(item); }
            }
            setSearchResults(merged);
        } catch {
            setSearchResults([]);
        }
        setSearching(false);
    };

    const handleBarcodeResult = async (barcodeString) => {
        setSearching(true);
        setShowScanner(false);
        try {
            const item = await lookupBarcode(barcodeString);
            if (item) {
                selectFood({ ...item, source: 'barcode' });
            } else {
                Alert.alert('Not Found', 'Could not find product for this barcode.');
            }
        } catch {
            Alert.alert('Error', 'Barcode lookup failed.');
        }
        setSearching(false);
    };

    // ─── Select food & serving ───────
    const selectFood = (food) => {
        setSelectedFood(food);
        // Parse serving if available
        const ser = food.serving || '';
        const match = ser.match(/([\d.]+)\s*(g|ml|oz|cup|tbsp|tsp|scoop|piece|serving|slice)/i);
        if (match) {
            setServingQty(parseFloat(match[1]) || 1);
            const u = match[2].toLowerCase();
            setServingUnit(u);
            setGramsPerUnit(GRAMS_MAP[u] || 100);
        } else {
            setServingQty(1);
            setServingUnit('serving');
            setGramsPerUnit(100);
        }
    };

    const getScaled = (baseVal) => {
        const totalGrams = servingQty * gramsPerUnit;
        return Math.round((baseVal / 100) * totalGrams);
    };

    const addFoodToMeal = () => {
        if (!selectedFood) return;
        const totalGrams = servingQty * gramsPerUnit;
        ingredients.push({
            name: selectedFood.name,
            amount: `${servingQty} ${servingUnit}`,
            calories: getScaled(selectedFood.calories_per_100g || selectedFood.calories || 0),
            protein: getScaled(selectedFood.protein_per_100g || selectedFood.protein || 0),
            carbs: getScaled(selectedFood.carbs_per_100g || selectedFood.carbs || 0),
            fat: getScaled(selectedFood.fat_per_100g || selectedFood.fat || 0),
        });
        setIngredients([...ingredients]);
        setSelectedFood(null);
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeIngredient = (idx) => {
        setIngredients(prev => prev.filter((_, i) => i !== idx));
    };

    // ─── Save meal ───────────────────
    const handleSaveMeal = async () => {
        if (!mealName.trim()) {
            Alert.alert('Name Required', 'Enter a name for your meal.');
            return;
        }
        if (ingredients.length === 0) {
            Alert.alert('No Ingredients', 'Add at least one ingredient.');
            return;
        }
        const totals = ingredients.reduce((a, i) => ({
            calories: a.calories + i.calories, protein: a.protein + i.protein,
            carbs: a.carbs + i.carbs, fat: a.fat + i.fat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        await saveMeal({ name: mealName.trim(), ...totals, ingredients, source: 'custom' });
        Alert.alert('Saved!', `"${mealName.trim()}" added to My Meals.`);
        resetBuilder();
        setView('list');
        loadMeals();
    };

    // ─── Add meal to diary ───────────
    const handleAddToDiary = (meal, slot) => {
        if (onAddToDiary) {
            onAddToDiary({
                name: meal.name,
                calories: Math.round(meal.calories || 0),
                protein: Math.round(meal.protein || 0),
                carbs: Math.round(meal.carbs || 0),
                fat: Math.round(meal.fat || 0),
                serving: `1 meal (${meal.ingredients?.length || 0} items)`,
            }, slot);
        }
        setSlotPickerMeal(null);
        Alert.alert('Added!', `"${meal.name}" added to ${slot}.`);
    };

    const handleDelete = (meal) => {
        setDeleteTarget(meal);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteSavedMeal(deleteTarget.id);
        loadMeals();
        setDeleteTarget(null);
    };

    const totalMacros = ingredients.reduce((a, i) => ({
        calories: a.calories + i.calories, protein: a.protein + i.protein,
        carbs: a.carbs + i.carbs, fat: a.fat + i.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return (
        <>
            <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetContainer} pointerEvents="box-none">
                        <View style={styles.sheet}>
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerLeft}>
                                    {view === 'create' && (
                                        <TouchableOpacity onPress={() => { resetBuilder(); setView('list'); }} style={{ marginRight: 8 }}>
                                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                                        </TouchableOpacity>
                                    )}
                                    <MaterialIcons name="restaurant" size={20} color={colors.primary} />
                                    <Text style={styles.headerTitle}>{view === 'list' ? 'My Meals' : 'Create Meal'}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <MaterialIcons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                                {view === 'list' ? (
                                    <>
                                        {/* Create new meal button */}
                                        <TouchableOpacity style={styles.createBtn} onPress={() => setView('create')}>
                                            <MaterialIcons name="add-circle" size={20} color={colors.primary} />
                                            <Text style={styles.createBtnText}>Create New Meal</Text>
                                        </TouchableOpacity>

                                        {meals.length === 0 ? (
                                            <View style={styles.emptyState}>
                                                <MaterialIcons name="restaurant" size={40} color={colors.textMuted} />
                                                <Text style={styles.emptyTitle}>No saved meals</Text>
                                                <Text style={styles.emptySub}>Create a meal or ask AI to generate one!</Text>
                                            </View>
                                        ) : (
                                            meals.map((meal) => {
                                                const isExpanded = expandedId === meal.id;
                                                return (
                                                    <TouchableOpacity key={meal.id} style={styles.mealCard} activeOpacity={0.8}
                                                        onPress={() => setExpandedId(isExpanded ? null : meal.id)}>
                                                        <View style={styles.mealRow}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.mealName}>{meal.name}</Text>
                                                                <Text style={styles.mealMeta}>{meal.ingredients?.length || 0} items · {Math.round(meal.calories || 0)} kcal</Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                                <TouchableOpacity style={styles.iconBtn} onPress={() => setSlotPickerMeal(meal)}>
                                                                    <MaterialIcons name="add" size={16} color={colors.primary} />
                                                                </TouchableOpacity>
                                                                <TouchableOpacity style={styles.iconBtnDanger} onPress={() => handleDelete(meal)}>
                                                                    <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>

                                                        <View style={styles.macroRow}>
                                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                                                                <Text style={[styles.macroBadgeText, { color: '#3b82f6' }]}>P: {Math.round(meal.protein || 0)}g</Text>
                                                            </View>
                                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                                                                <Text style={[styles.macroBadgeText, { color: '#eab308' }]}>C: {Math.round(meal.carbs || 0)}g</Text>
                                                            </View>
                                                            <View style={[styles.macroBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                                                                <Text style={[styles.macroBadgeText, { color: '#ef4444' }]}>F: {Math.round(meal.fat || 0)}g</Text>
                                                            </View>
                                                        </View>

                                                        {isExpanded && (
                                                            <View style={styles.expanded}>
                                                                <Text style={styles.subHead}>Ingredients</Text>
                                                                {(meal.ingredients || []).map((ing, j) => (
                                                                    <View key={j} style={styles.ingRow}>
                                                                        <Text style={styles.bullet}>•</Text>
                                                                        <Text style={styles.ingText}>{ing.amount || ''} {ing.name}</Text>
                                                                        <Text style={styles.ingCal}>{ing.calories} kcal</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}

                                                        <View style={{ alignItems: 'center', marginTop: 4 }}>
                                                            <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textMuted} />
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </>
                                ) : (
                                    /* ─── Create Meal View ─── */
                                    <>
                                        {/* Meal name input */}
                                        <TextInput
                                            style={styles.nameInput}
                                            value={mealName}
                                            onChangeText={setMealName}
                                            placeholder="Meal name (e.g. Power Bowl)"
                                            placeholderTextColor={colors.textMuted}
                                        />

                                        {/* Current ingredients */}
                                        {ingredients.length > 0 && (
                                            <View style={styles.ingredientsList}>
                                                <Text style={styles.subHead}>Ingredients ({ingredients.length})</Text>
                                                {ingredients.map((ing, idx) => (
                                                    <View key={idx} style={styles.ingItem}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.ingItemName}>{ing.name}</Text>
                                                            <Text style={styles.ingItemMeta}>{ing.amount} · {ing.calories} kcal · P:{ing.protein}g C:{ing.carbs}g F:{ing.fat}g</Text>
                                                        </View>
                                                        <TouchableOpacity onPress={() => removeIngredient(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                            <MaterialIcons name="close" size={16} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}

                                                {/* Totals */}
                                                <View style={styles.totalsRow}>
                                                    <Text style={styles.totalsLabel}>Total</Text>
                                                    <Text style={styles.totalsCal}>{totalMacros.calories} kcal</Text>
                                                    <Text style={[styles.totalsM, { color: '#3b82f6' }]}>P:{totalMacros.protein}g</Text>
                                                    <Text style={[styles.totalsM, { color: '#eab308' }]}>C:{totalMacros.carbs}g</Text>
                                                    <Text style={[styles.totalsM, { color: '#ef4444' }]}>F:{totalMacros.fat}g</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Search for food */}
                                        <Text style={styles.subHead}>Search Foods to Add</Text>
                                        <View style={styles.searchRow}>
                                            <TextInput
                                                style={styles.searchInput}
                                                value={searchQuery}
                                                onChangeText={setSearchQuery}
                                                placeholder="Search (e.g. chicken breast 200g)"
                                                placeholderTextColor={colors.textMuted}
                                                onSubmitEditing={handleSearch}
                                                returnKeyType="search"
                                            />
                                            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                                                {searching ? (
                                                    <ActivityIndicator size="small" color={colors.bgDark} />
                                                ) : (
                                                    <MaterialIcons name="search" size={20} color={colors.bgDark} />
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.barcodeBtn} onPress={() => setShowScanner(true)}>
                                                <MaterialIcons name="qr-code-scanner" size={18} color={colors.primary} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Selected food serving adjustment */}
                                        {selectedFood && (
                                            <View style={styles.servingCard}>
                                                <Text style={styles.servingFoodName}>{selectedFood.name}</Text>
                                                <View style={styles.servingRow}>
                                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setServingQty(Math.max(0.5, servingQty - 0.5))}>
                                                        <MaterialIcons name="remove" size={16} color={colors.primary} />
                                                    </TouchableOpacity>
                                                    <TextInput
                                                        style={styles.qtyInput}
                                                        value={String(servingQty)}
                                                        onChangeText={t => setServingQty(parseFloat(t) || 0)}
                                                        keyboardType="decimal-pad"
                                                    />
                                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setServingQty(servingQty + 0.5)}>
                                                        <MaterialIcons name="add" size={16} color={colors.primary} />
                                                    </TouchableOpacity>

                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: 8 }}>
                                                        {ALL_UNITS.map(u => (
                                                            <TouchableOpacity key={u}
                                                                style={[styles.unitChip, servingUnit === u && styles.unitChipActive]}
                                                                onPress={() => { setServingUnit(u); setGramsPerUnit(GRAMS_MAP[u] || 100); }}>
                                                                <Text style={[styles.unitChipText, servingUnit === u && styles.unitChipTextActive]}>{u}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>

                                                {/* Preview macros */}
                                                <View style={styles.previewMacros}>
                                                    <Text style={styles.previewCal}>{getScaled(selectedFood.calories_per_100g || selectedFood.calories || 0)} kcal</Text>
                                                    <Text style={[styles.previewM, { color: '#3b82f6' }]}>P: {getScaled(selectedFood.protein_per_100g || selectedFood.protein || 0)}g</Text>
                                                    <Text style={[styles.previewM, { color: '#eab308' }]}>C: {getScaled(selectedFood.carbs_per_100g || selectedFood.carbs || 0)}g</Text>
                                                    <Text style={[styles.previewM, { color: '#ef4444' }]}>F: {getScaled(selectedFood.fat_per_100g || selectedFood.fat || 0)}g</Text>
                                                </View>

                                                <TouchableOpacity style={styles.addFoodBtn} onPress={addFoodToMeal}>
                                                    <MaterialIcons name="add" size={16} color={colors.bgDark} />
                                                    <Text style={styles.addFoodBtnText}>Add to Meal</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Search results */}
                                        {searchResults.length > 0 && !selectedFood && (
                                            <View style={styles.resultsList}>
                                                {searchResults.map((item, idx) => (
                                                    <TouchableOpacity key={idx} style={styles.resultItem} onPress={() => selectFood(item)}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.resultName}>{item.name}</Text>
                                                            <Text style={styles.resultMeta}>
                                                                {item.calories_per_100g || item.calories || 0} kcal/100g · P:{item.protein_per_100g || item.protein || 0}g
                                                            </Text>
                                                        </View>
                                                        <View style={[styles.sourceBadge, { backgroundColor: item.source === 'database' ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)' }]}>
                                                            <Text style={[styles.sourceBadgeText, { color: item.source === 'database' ? '#3b82f6' : '#a855f7' }]}>
                                                                {item.source === 'database' ? 'DB' : 'AI'}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}

                                        {/* Save meal button */}
                                        {ingredients.length > 0 && (
                                            <TouchableOpacity style={styles.saveMealBtn} onPress={handleSaveMeal}>
                                                <MaterialIcons name="bookmark" size={16} color={colors.bgDark} />
                                                <Text style={styles.saveMealBtnText}>Save Meal</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Meal slot picker */}
            <Modal visible={!!slotPickerMeal} animationType="fade" transparent onRequestClose={() => setSlotPickerMeal(null)}>
                <View style={styles.slotOverlay}>
                    <TouchableWithoutFeedback onPress={() => setSlotPickerMeal(null)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.slotCard} pointerEvents="box-none">
                        <Text style={styles.slotTitle}>Add to which meal?</Text>
                        {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map(slot => (
                            <TouchableOpacity key={slot} style={styles.slotOption} onPress={() => handleAddToDiary(slotPickerMeal, slot.toLowerCase())}>
                                <MaterialIcons name={slot === 'Breakfast' ? 'wb-sunny' : slot === 'Lunch' ? 'restaurant' : slot === 'Dinner' ? 'nightlight-round' : 'icecream'} size={18} color={colors.primary} />
                                <Text style={styles.slotOptionText}>{slot}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Delete confirmation modal */}
            <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
                <View style={styles.deleteOverlay}>
                    <TouchableWithoutFeedback onPress={() => setDeleteTarget(null)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.deletePopup} pointerEvents="box-none">
                        <View style={styles.deleteIconCircle}>
                            <MaterialIcons name="delete-outline" size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.deleteTitle}>Delete Meal?</Text>
                        <Text style={styles.deleteSub}>
                            Are you sure you want to delete{' '}
                            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>
                                "{deleteTarget?.name}"
                            </Text>
                            ? This cannot be undone.
                        </Text>
                        <View style={styles.deleteBtnRow}>
                            <TouchableOpacity
                                style={styles.deleteCancelBtn}
                                onPress={() => setDeleteTarget(null)}
                            >
                                <Text style={styles.deleteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteConfirmBtn}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.deleteConfirmText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <BarcodeScannerModal
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onBarcodeScanned={handleBarcodeResult}
            />
        </>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheetContainer: { flex: 1, justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingTop: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { padding: 16 },

    // Create button
    createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30', borderRadius: 14, paddingVertical: 14, marginBottom: 16, borderStyle: 'dashed' },
    createBtnText: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 50, gap: 8 },
    emptyTitle: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold' },
    emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 240 },

    // Meal cards
    mealCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    mealRow: { flexDirection: 'row', alignItems: 'flex-start' },
    mealName: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    mealMeta: { color: colors.textMuted, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },
    iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' },
    iconBtnDanger: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,107,0.1)' },

    // Slot picker
    slotOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    slotCard: { backgroundColor: colors.bg, borderRadius: 18, padding: 20, width: 260, borderWidth: 1, borderColor: colors.border },
    slotTitle: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', marginBottom: 14 },
    slotOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 8 },
    slotOptionText: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },

    macroRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    macroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    macroBadgeText: { fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },

    expanded: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    subHead: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 6, marginTop: 4 },
    ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
    bullet: { color: colors.primary, fontSize: 14, marginRight: 8, lineHeight: 20 },
    ingText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', flex: 1, lineHeight: 20 },
    ingCal: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Create meal view
    nameInput: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },

    ingredientsList: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16 },
    ingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    ingItemName: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    ingItemMeta: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },

    totalsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 4 },
    totalsLabel: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    totalsCal: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    totalsM: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },

    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
    searchBtn: { width: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    barcodeBtn: { width: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

    // Serving adjustment
    servingCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '40', padding: 14, marginBottom: 12 },
    servingFoodName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 10 },
    servingRow: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
    qtyInput: { width: 50, textAlign: 'center', color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginHorizontal: 4 },
    unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 6 },
    unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    unitChipText: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },
    unitChipTextActive: { color: colors.bgDark },

    previewMacros: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 10 },
    previewCal: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    previewM: { fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' },

    addFoodBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
    addFoodBtnText: { color: colors.bgDark, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

    // Search results
    resultsList: { marginBottom: 12 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
    resultName: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    resultMeta: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },
    sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
    sourceBadgeText: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },

    // Save button
    saveMealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
    saveMealBtnText: { color: colors.bgDark, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },

    // Delete confirmation modal
    deleteOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center',
    },
    deletePopup: {
        width: 300, backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        borderRadius: 20, padding: 24, alignItems: 'center',
        borderWidth: 1, borderColor: isDark ? '#27272a' : '#e5e5e5',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    },
    deleteIconCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    deleteTitle: {
        color: colors.text, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold',
        marginBottom: 4, textAlign: 'center',
    },
    deleteSub: {
        color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium',
        textAlign: 'center', lineHeight: 20, marginBottom: 20, marginTop: 8,
    },
    deleteBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
    deleteCancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
        backgroundColor: isDark ? '#27272a' : '#f0f0f0',
        borderWidth: 1, borderColor: isDark ? '#3f3f46' : '#d1d5db',
    },
    deleteCancelText: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    deleteConfirmBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
        backgroundColor: '#ef4444',
    },
    deleteConfirmText: { color: '#fff', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
});
