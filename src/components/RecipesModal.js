import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, TouchableWithoutFeedback
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { getSavedRecipes, deleteSavedRecipe } from '../services/storage';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const SLOT_ICONS = {
    Breakfast: 'wb-sunny',
    Lunch: 'restaurant',
    Dinner: 'nightlight-round',
    Snacks: 'icecream',
};

export function RecipesModal({ visible, onClose, onAddToDiary }) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = getStyles(colors, isDark);

    const [recipes, setRecipes] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // Slot picker state
    const [slotPickerRecipe, setSlotPickerRecipe] = useState(null);

    // Delete confirm state
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        if (visible) {
            (async () => {
                const saved = await getSavedRecipes();
                setRecipes(saved);
            })();
        }
    }, [visible]);

    const handleAddToDiary = (recipe, slot) => {
        if (onAddToDiary) {
            onAddToDiary({
                name: recipe.name,
                calories: recipe.calories || 0,
                protein: recipe.protein || 0,
                carbs: recipe.carbs || 0,
                fat: recipe.fat || 0,
                serving: '1 serving',
            }, slot.toLowerCase());
        }
        setSlotPickerRecipe(null);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteSavedRecipe(deleteTarget.id);
        setRecipes(prev => prev.filter(r => r.id !== deleteTarget.id));
        setDeleteTarget(null);
    };

    return (
        <>
            <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 24) }]} pointerEvents="box-none">
                        <View style={styles.sheet}>
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerLeft}>
                                    <MaterialIcons name="menu-book" size={20} color={colors.primary} />
                                    <Text style={styles.headerTitle}>My Recipes</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <MaterialIcons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                                {recipes.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <MaterialIcons name="menu-book" size={40} color={colors.textMuted} />
                                        <Text style={styles.emptyTitle}>No saved recipes</Text>
                                        <Text style={styles.emptySub}>
                                            Ask the AI chat for a recipe and save it!
                                        </Text>
                                    </View>
                                ) : (
                                    recipes.map((recipe) => {
                                        const isExpanded = expandedId === recipe.id;
                                        return (
                                            <TouchableOpacity
                                                key={recipe.id}
                                                style={styles.recipeCard}
                                                onPress={() => setExpandedId(isExpanded ? null : recipe.id)}
                                                activeOpacity={0.8}
                                            >
                                                {/* Header Row */}
                                                <View style={styles.recipeHeader}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.recipeName}>{recipe.name}</Text>
                                                        <View style={styles.tagRow}>
                                                            <View style={styles.tag}>
                                                                <MaterialIcons name="schedule" size={10} color={colors.primary} />
                                                                <Text style={styles.tagText}>{recipe.prepTime || '15 mins'}</Text>
                                                            </View>
                                                            <View style={[styles.tag, styles.tagHighlight]}>
                                                                <Text style={styles.tagHighlightText}>{recipe.tag || 'BALANCED'}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.calNum}>{recipe.calories}</Text>
                                                    <Text style={styles.calUnit}>kcal</Text>
                                                </View>

                                                {/* Macro Badges + action icons */}
                                                <View style={styles.macroRow}>
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
                                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                                            <TouchableOpacity
                                                                style={styles.iconBtn}
                                                                onPress={(e) => { e.stopPropagation?.(); setSlotPickerRecipe(recipe); }}
                                                            >
                                                                <MaterialIcons name="bookmark-border" size={16} color={colors.primary} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.iconBtnDanger}
                                                                onPress={(e) => { e.stopPropagation?.(); setDeleteTarget(recipe); }}
                                                            >
                                                                <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Expanded: ingredients, steps, actions */}
                                                {isExpanded && (
                                                    <View style={styles.expanded}>
                                                        <Text style={styles.subHead}>Ingredients</Text>
                                                        {(recipe.ingredients || []).map((ing, j) => (
                                                            <View key={j} style={styles.ingRow}>
                                                                <Text style={styles.bullet}>•</Text>
                                                                <Text style={styles.ingText}>{ing}</Text>
                                                            </View>
                                                        ))}

                                                        {recipe.steps && recipe.steps.length > 0 && (
                                                            <View>
                                                                <Text style={[styles.subHead, { marginTop: 12 }]}>Steps</Text>
                                                                {recipe.steps.map((step, j) => (
                                                                    <View key={j} style={styles.stepRow}>
                                                                        <View style={styles.stepNum}>
                                                                            <Text style={styles.stepNumText}>{j + 1}</Text>
                                                                        </View>
                                                                        <Text style={styles.stepText}>{step}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}

                                                        <View style={styles.actions}>
                                                            <TouchableOpacity
                                                                style={styles.addBtn}
                                                                onPress={() => setSlotPickerRecipe(recipe)}
                                                            >
                                                                <MaterialIcons name="bookmark-border" size={14} color={colors.bgDark} />
                                                                <Text style={styles.addBtnText}>Add to Diary</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.deleteBtn}
                                                                onPress={() => setDeleteTarget(recipe)}
                                                            >
                                                                <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}

                                                {/* Expand hint */}
                                                <View style={styles.expandHint}>
                                                    <MaterialIcons
                                                        name={isExpanded ? 'expand-less' : 'expand-more'}
                                                        size={18} color={colors.textMuted}
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Meal slot picker ── */}
            <Modal visible={!!slotPickerRecipe} animationType="fade" transparent onRequestClose={() => setSlotPickerRecipe(null)}>
                <View style={styles.centeredOverlay}>
                    <TouchableWithoutFeedback onPress={() => setSlotPickerRecipe(null)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.popupCard} pointerEvents="box-none">
                        <Text style={styles.popupTitle}>Add to which meal?</Text>
                        {MEAL_SLOTS.map(slot => (
                            <TouchableOpacity
                                key={slot}
                                style={styles.slotOption}
                                onPress={() => handleAddToDiary(slotPickerRecipe, slot)}
                            >
                                <View style={[styles.slotIconWrap, { backgroundColor: colors.primary + '18' }]}>
                                    <MaterialIcons name={SLOT_ICONS[slot]} size={18} color={colors.primary} />
                                </View>
                                <Text style={styles.slotOptionText}>{slot}</Text>
                                <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* ── Delete confirmation ── */}
            <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
                <View style={styles.centeredOverlay}>
                    <TouchableWithoutFeedback onPress={() => setDeleteTarget(null)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.popupCard} pointerEvents="box-none">
                        <View style={styles.deleteIconCircle}>
                            <MaterialIcons name="delete-outline" size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.popupTitle}>Delete Recipe?</Text>
                        <Text style={styles.popupSub}>
                            Are you sure you want to delete{' '}
                            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>
                                "{deleteTarget?.name}"
                            </Text>
                            ? This cannot be undone.
                        </Text>
                        <View style={styles.deleteBtnRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setDeleteTarget(null)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmDeleteBtn}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%', paddingTop: 8,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    closeBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    },
    scrollContent: { padding: 16 },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyTitle: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold' },
    emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 240 },

    // Recipe cards
    recipeCard: {
        backgroundColor: colors.surface, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    recipeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    recipeName: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 6 },
    tagRow: { flexDirection: 'row', gap: 6 },
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: colors.primaryDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    tagText: { color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' },
    tagHighlight: { backgroundColor: colors.primary + '18' },
    tagHighlightText: { color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },
    calNum: { color: colors.text, fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', marginLeft: 8 },
    calUnit: { color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 6 },

    macroRow: { flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' },
    macroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    macroBadgeText: { fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },

    iconBtn: {
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: colors.primary + '18',
        alignItems: 'center', justifyContent: 'center',
    },
    iconBtnDanger: {
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: 'rgba(255,107,107,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },

    expanded: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    subHead: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 6 },
    ingRow: { flexDirection: 'row', paddingVertical: 3 },
    bullet: { color: colors.primary, fontSize: 14, marginRight: 8, lineHeight: 20 },
    ingText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', flex: 1, lineHeight: 20 },

    stepRow: { flexDirection: 'row', paddingVertical: 4, gap: 8 },
    stepNum: {
        width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    stepNumText: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },
    stepText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', flex: 1, lineHeight: 20 },

    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    addBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 10,
    },
    addBtnText: { color: colors.bgDark, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    deleteBtn: {
        width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)',
    },
    expandHint: { alignItems: 'center', marginTop: 4 },

    // Centered overlay for popups
    centeredOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center',
    },
    popupCard: {
        width: 300, backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        borderRadius: 20, padding: 24, alignItems: 'center',
        borderWidth: 1, borderColor: isDark ? '#27272a' : '#e5e5e5',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    },
    popupTitle: {
        color: colors.text, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold',
        marginBottom: 4, textAlign: 'center',
    },
    popupSub: {
        color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium',
        textAlign: 'center', lineHeight: 20, marginBottom: 20, marginTop: 8,
    },

    // Slot options
    slotOption: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        width: '100%', paddingVertical: 12, paddingHorizontal: 12,
        borderRadius: 12, backgroundColor: isDark ? '#27272a' : '#f5f5f5',
        marginTop: 8,
    },
    slotIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    slotOptionText: {
        flex: 1, color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold',
    },

    // Delete confirmation
    deleteIconCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    deleteBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
    cancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
        backgroundColor: isDark ? '#27272a' : '#f0f0f0',
        borderWidth: 1, borderColor: isDark ? '#3f3f46' : '#d1d5db',
    },
    cancelBtnText: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    confirmDeleteBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
        backgroundColor: '#ef4444',
    },
    confirmDeleteBtnText: { color: '#fff', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
});
