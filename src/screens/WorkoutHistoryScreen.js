import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useTranslation } from '../services/i18n';
import WorkoutCard from '../components/WorkoutCard';
import { getWorkouts, getWorkoutHistory } from '../services/storage';

export default function WorkoutHistoryScreen() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const [allWorkouts, setAllWorkouts] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedYears, setExpandedYears] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});

    const toggleYear = (year) => {
        setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
    };

    const toggleMonth = (yearMonthKey) => {
        setExpandedMonths(prev => ({ ...prev, [yearMonthKey]: !prev[yearMonthKey] }));
    };

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [plannedWorkouts, historyVars] = await Promise.all([
                getWorkouts(),
                getWorkoutHistory()
            ]);

            // Format history objects to perfectly match the WorkoutCard props
            const historyWorkouts = historyVars.map(h => {
                let d = h.startedAt ? new Date(h.startedAt) : new Date();
                let mins = Math.round((h.elapsedSeconds || h.duration || 0) / 60);
                return {
                    id: h.id || Math.random().toString(),
                    name: h.routineName || h.workoutName || 'Completed Workout',
                    type: 'default', // Maps to the global UI accent theme color
                    duration: mins, // Pure int, WorkoutCard natively appends " MIN" to the right badge
                    time: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
                    caloriesBurned: h.caloriesBurned || Math.round(mins * 6), // Estimate if missing
                    completed: true,
                    timestamp: h.startedAt || d.toISOString()
                };
            });

            // Make sure current tracked workouts explicitly have a sortable timestamp
            const currentWorkouts = plannedWorkouts.map(w => {
                let mappedTime = w.timestamp || new Date().toISOString();
                return {
                    ...w,
                    timestamp: mappedTime
                }
            });

            // Merge both lists, sort backward chronologically
            const combinedWorkouts = [...currentWorkouts, ...historyWorkouts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Group by Year > Month
            const grouped = {};
            combinedWorkouts.forEach(workout => {
                const dateObj = new Date(workout.timestamp);
                const year = dateObj.getFullYear().toString();
                const month = dateObj.toLocaleDateString([], { month: 'long' });

                if (!grouped[year]) {
                    grouped[year] = {};
                }
                if (!grouped[year][month]) {
                    grouped[year][month] = [];
                }
                grouped[year][month].push(workout);
            });

            // Automatically expand the most recent year and month if available
            const sortedYears = Object.keys(grouped).sort((a, b) => b - a);
            if (sortedYears.length > 0) {
                const recentYear = sortedYears[0];
                setExpandedYears({ [recentYear]: true });

                // Assuming Javascript object insertion order for months is slightly arbitrary, let's just grab the first one
                const recentMonth = Object.keys(grouped[recentYear])[0];
                if (recentMonth) {
                    setExpandedMonths({ [`${recentYear}-${recentMonth}`]: true });
                }
            } else {
                setExpandedYears({});
                setExpandedMonths({});
            }

            setAllWorkouts(grouped);

        } catch (err) {
            console.error('Workout History load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const renderItem = ({ item }) => (
        <WorkoutCard
            key={item.id}
            name={item.name}
            type={item.type}
            duration={item.duration}
            time={item.time}
            caloriesBurned={item.caloriesBurned}
            completed={item.completed}
            colors={colors}
            opacity={1}
        />
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{'Past Workouts'}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : Object.keys(allWorkouts).length === 0 ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>{t('noWorkoutsYet') || 'No workouts found.'}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                    {Object.keys(allWorkouts).sort((a, b) => b - a).map(year => {
                        const isYearExpanded = expandedYears[year];
                        const yearWorkoutCount = Object.values(allWorkouts[year]).reduce((acc, monthWorkouts) => acc + monthWorkouts.length, 0);

                        return (
                            <View key={year} style={styles.yearSection}>
                                <TouchableOpacity
                                    style={styles.yearHeader}
                                    onPress={() => toggleYear(year)}
                                >
                                    <View style={styles.headerTitleRow}>
                                        <Text style={styles.yearText}>{year}</Text>
                                        <Text style={styles.countBadge}>{yearWorkoutCount} workouts</Text>
                                    </View>
                                    <MaterialIcons
                                        name={isYearExpanded ? 'expand-less' : 'expand-more'}
                                        size={28}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>

                                {isYearExpanded && (
                                    <View style={styles.monthsContainer}>
                                        {Object.keys(allWorkouts[year]).map(month => {
                                            const monthKey = `${year}-${month}`;
                                            const isMonthExpanded = expandedMonths[monthKey];
                                            const monthWorkoutCount = allWorkouts[year][month].length;

                                            return (
                                                <View key={monthKey} style={styles.monthSection}>
                                                    <TouchableOpacity
                                                        style={styles.monthHeader}
                                                        onPress={() => toggleMonth(monthKey)}
                                                    >
                                                        <View style={styles.headerTitleRow}>
                                                            <Text style={styles.monthText}>{month}</Text>
                                                            <Text style={styles.monthCountBadge}>{monthWorkoutCount} workouts</Text>
                                                        </View>
                                                        <MaterialIcons
                                                            name={isMonthExpanded ? 'expand-less' : 'expand-more'}
                                                            size={24}
                                                            color={colors.textSecondary}
                                                        />
                                                    </TouchableOpacity>

                                                    {isMonthExpanded && (
                                                        <View style={styles.workoutsContainer}>
                                                            {allWorkouts[year][month].map(workout => (
                                                                <View key={workout.id} style={{ marginBottom: 12 }}>
                                                                    {renderItem({ item: workout })}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    listContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    yearSection: {
        marginBottom: 16,
    },
    yearHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.cardBg || colors.bgCard,
        borderWidth: 1,
        borderColor: colors.borderLight || colors.border,
        borderRadius: 12,
        marginBottom: 12,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    yearText: {
        fontSize: 22,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    countBadge: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.primary,
        backgroundColor: colors.bgDark || '#0F172A',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    monthsContainer: {
        paddingLeft: 12,
    },
    monthSection: {
        marginBottom: 8,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.cardBg || colors.bgCard,
        borderWidth: 1,
        borderColor: colors.borderLight || colors.border,
        borderRadius: 10,
        marginBottom: 8,
    },
    monthText: {
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        color: colors.textSecondary,
    },
    monthCountBadge: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.textSecondary,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        overflow: 'hidden',
    },
    workoutsContainer: {
        paddingTop: 8,
        paddingLeft: 4,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary || '#94A3B8',
        fontFamily: 'SpaceGrotesk_400Regular',
        textAlign: 'center',
    },
});
