import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import CalorieBar from '../components/CalorieBar';
import { SnackCard, MealListCard } from '../components/MealCard';
import { AddMealModal } from '../components/AddModal';
import {
    getMeals, addMeal, deleteMeal, getSettings,
    getTodaysMeals, calcMacroTotals,
} from '../services/storage';
import { getAISnackSuggestions } from '../services/openai';

export default function MealsScreen() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const insets = useSafeAreaInsets();
    const [meals, setMeals] = useState([]);
    const [settings, setSettingsState] = useState({ calorieGoal: 2000 });
    const [intake, setIntake] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [snackSuggestions, setSnackSuggestions] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingSnacks, setLoadingSnacks] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [allMeals, s] = await Promise.all([getMeals(), getSettings()]);
            setSettingsState(s);

            const todayMeals = getTodaysMeals(allMeals);
            const macros = calcMacroTotals(todayMeals);
            setIntake(macros);
            setMeals(todayMeals);

            // Load AI snack suggestions
            setLoadingSnacks(true);
            const snacks = await getAISnackSuggestions(macros, s);
            setSnackSuggestions(snacks);
            setLoadingSnacks(false);
        } catch (err) {
            console.error('Meals load error:', err);
            setLoadingSnacks(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleAddMeal = async (meal) => {
        await addMeal(meal);
        await loadData();
    };

    const handleDeleteMeal = (id, name) => {
        Alert.alert('Delete Meal', `Remove "${name}" from today's log?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteMeal(id);
                    await loadData();
                },
            },
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <Text style={styles.pageTitle}>AI Meal & Snack Suggestions</Text>
                    <View style={styles.aiIconBtn}>
                        <MaterialIcons name="smart-toy" size={18} color={colors.primary} />
                    </View>
                </View>

                {/* Calorie Progress */}
                <View style={styles.section}>
                    <CalorieBar
                        consumed={intake.calories}
                        goal={settings.calorieGoal}
                        protein={intake.protein}
                        carbs={intake.carbs}
                        fat={intake.fat}
                    />
                </View>

                {/* AI Recommended Snacks */}
                <View style={styles.sectionNoHPad}>
                    <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
                        <Text style={styles.sectionTitle}>AI Recommended Snacks</Text>
                        <TouchableOpacity onPress={loadData}>
                            <Text style={styles.viewAll}>{loadingSnacks ? 'Loading...' : 'Refresh'}</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={snackSuggestions}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                        keyExtractor={(_, i) => i.toString()}
                        renderItem={({ item }) => (
                            <SnackCard
                                name={item.name}
                                calories={item.calories}
                                prepTime={item.prepTime}
                                tag={item.tag}
                            />
                        )}
                    />
                </View>

                {/* Today's Meals */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Meals</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{meals.length} logged</Text>
                        </View>
                    </View>
                    <View style={styles.mealList}>
                        {meals.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No meals logged today. Tap + to add one!</Text>
                            </View>
                        ) : (
                            meals.map((m) => (
                                <TouchableOpacity key={m.id} onLongPress={() => handleDeleteMeal(m.id, m.name)}>
                                    <MealListCard
                                        name={m.name}
                                        calories={m.calories}
                                        protein={m.protein}
                                        carbs={m.carbs}
                                        fat={m.fat}
                                    />
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Floating Add Button */}
            <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            <AddMealModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddMeal}
            />
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        paddingBottom: 120,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    pageTitle: {
        color: colors.text,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
        flex: 1,
    },
    aiIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryMid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: {
        paddingHorizontal: 16,
        marginTop: 16,
    },
    sectionNoHPad: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        color: colors.white,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    viewAll: {
        color: colors.primary,
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    badge: {
        backgroundColor: colors.primaryMid,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        color: colors.primary,
        fontSize: 11,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontStyle: 'italic',
    },
    mealList: {
        gap: 12,
    },
    emptyCard: {
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyText: {
        color: colors.slate400,
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    fabIcon: {
        color: colors.bgDark,
        fontSize: 28,
        fontFamily: 'SpaceGrotesk_700Bold',
        marginTop: -2,
    },
});
