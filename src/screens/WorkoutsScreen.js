import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import WorkoutCard from '../components/WorkoutCard';
import { AddWorkoutModal } from '../components/AddModal';
import {
    getWorkouts, addWorkout, toggleWorkout, getSettings,
    getTodaysWorkouts, calcWorkoutTotals, getUserProfile,
} from '../services/storage';
import { getTodayStepCount } from '../services/pedometer';
import { getCoachMessage } from '../services/openai';

export default function WorkoutsScreen() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const insets = useSafeAreaInsets();
    const [workouts, setWorkouts] = useState([]);
    const [settings, setSettingsState] = useState({ stepGoal: 10000 });
    const [steps, setSteps] = useState(0);
    const [workoutStats, setWorkoutStats] = useState({ caloriesBurned: 0, totalMinutes: 0 });
    const [coachMsg, setCoachMsg] = useState('"Push through the last set! Your recovery is improving!" 💪');
    const [showAddModal, setShowAddModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [profileImg, setProfileImg] = useState(null);

    const loadData = useCallback(async () => {
        try {
            const [allWorkouts, s, stepCount, profile] = await Promise.all([
                getWorkouts(), getSettings(), getTodayStepCount(), getUserProfile(),
            ]);

            setSettingsState(s);
            setSteps(stepCount);
            setProfileImg(profile?.profileImage || null);

            const todayWorkouts = getTodaysWorkouts(allWorkouts);
            const stats = calcWorkoutTotals(todayWorkouts);
            setWorkouts(todayWorkouts);
            setWorkoutStats(stats);

            // Get AI coach message
            const msg = await getCoachMessage(todayWorkouts, stepCount, s);
            setCoachMsg(msg);
        } catch (err) {
            console.error('Workouts load error:', err);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleAddWorkout = async (w) => {
        await addWorkout(w);
        await loadData();
    };

    const handleToggle = async (id) => {
        await toggleWorkout(id);
        await loadData();
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
                    <Text style={{ fontSize: 22 }}>📅</Text>
                    <Text style={styles.pageTitle}>Workout Log</Text>
                    <View style={styles.profileBtn}>
                        {profileImg ? (
                            <Image source={{ uri: profileImg }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                        ) : (
                            <MaterialIcons name="person" size={18} color={colors.textSecondary} />
                        )}
                    </View>
                </View>

                {/* AI Coach Section */}
                <View style={styles.coachSection}>
                    <View style={styles.coachHeader}>
                        <View style={styles.coachHeaderLeft}>
                            <Text style={{ fontSize: 16 }}>🧠</Text>
                            <Text style={styles.coachLabel}>AI COACH ACTIVE</Text>
                        </View>
                        <View style={styles.pulseDot} />
                    </View>

                    {/* Waveform */}
                    <View style={styles.waveform}>
                        {[16, 32, 48, 40, 24, 36, 44, 20, 28].map((h, i) => (
                            <View key={i} style={[styles.waveBar, { height: h }]} />
                        ))}
                    </View>

                    <Text style={styles.coachText}>"{coachMsg}"</Text>

                    <TouchableOpacity style={styles.askBtn} onPress={loadData}>
                        <MaterialIcons name="mic" size={14} color={colors.primary} />
                        <Text style={styles.askBtnText}>Ask for Tips</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Stats */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>STEP GOAL</Text>
                        <View style={styles.statValueRow}>
                            <Text style={styles.statBig}>{steps.toLocaleString()}</Text>
                            <Text style={styles.statSuffix}>/ {(settings.stepGoal / 1000).toFixed(0)}k</Text>
                        </View>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>CALORIES</Text>
                        <View style={styles.statValueRow}>
                            <Text style={styles.statBig}>{workoutStats.caloriesBurned}</Text>
                            <Text style={styles.statSuffix}>kcal</Text>
                        </View>
                    </View>
                </View>

                {/* Today's Schedule */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.workoutList}>
                        {workouts.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No workouts scheduled. Add one!</Text>
                            </View>
                        ) : (
                            workouts.map((w) => (
                                <WorkoutCard
                                    key={w.id}
                                    name={w.name}
                                    type={w.type}
                                    duration={w.duration}
                                    time={w.time}
                                    completed={w.completed}
                                    onToggle={() => handleToggle(w.id)}
                                    opacity={w.completed ? 0.6 : 1}
                                />
                            ))
                        )}
                    </View>
                </View>

                {/* Log New Workout Button */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.bigBtn} onPress={() => setShowAddModal(true)}>
                        <Text style={{ fontSize: 18 }}>➕</Text>
                        <Text style={styles.bigBtnText}>Log New Workout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <AddWorkoutModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddWorkout}
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
        paddingBottom: 100,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    pageTitle: {
        color: colors.text,
        fontSize: 24,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -0.5,
    },
    profileBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryDim,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Coach
    coachSection: {
        margin: 16,
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: 'center',
    },
    coachHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 16,
    },
    coachHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    coachLabel: {
        color: colors.primary,
        fontSize: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        height: 48,
        gap: 3,
        marginBottom: 16,
    },
    waveBar: {
        width: 3,
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
    coachText: {
        color: colors.text,
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_500Medium',
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
        marginBottom: 16,
    },
    askBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    askBtnText: {
        color: colors.bgDark,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
    },

    // Stats
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginTop: 4,
    },
    statBig: {
        fontSize: 26,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    statSuffix: {
        fontSize: 12,
        color: colors.slate400,
        marginBottom: 2,
    },

    // Schedule
    section: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    seeAll: {
        color: colors.primary,
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    workoutList: {
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

    // Big button
    bigBtn: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        elevation: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    bigBtnText: {
        color: colors.bgDark,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 17,
    },
});
