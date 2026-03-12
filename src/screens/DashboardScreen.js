import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import StepRing from '../components/StepRing';
import WorkoutCard from '../components/WorkoutCard';
import {
    getMeals, getWorkouts, getSettings, getUserProfile,
    getTodaysMeals, getTodaysWorkouts,
    calcMacroTotals, calcWorkoutTotals, getWorkoutHistory, getStepHistory,
} from '../services/storage';
import { getTodayStepCount, startStepWatcher, stopStepWatcher, getActiveStepSourceInfo } from '../services/pedometer';
import { fetchWeeklySteps } from '../services/health';
import { getFitbitCalories } from '../services/fitbit';
import { getNutritionSuggestion } from '../services/openai';
import { getLeaderboard, formatSteps } from '../services/friends';
import { useTranslation } from '../services/i18n';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

// ── Weekly Step Rings Card ────────────────────────────
const RING_SIZE = 38;
const RING_RADIUS = 14;
const RING_STROKE = 3.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~87.96

function WeeklyStepsCard({ history, goal, colors }) {
    if (!history || history.length === 0) return null;

    // Build date range label
    const startDate = new Date(history[0].date);
    const endDate = new Date(history[history.length - 1].date);
    const fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const rangeLabel = `${fmt(startDate)} - ${fmt(endDate)}`;

    return (
        <View style={{
            marginTop: 12, marginHorizontal: 24,
            backgroundColor: colors.bgCard || 'rgba(255,255,255,0.04)',
            borderRadius: 22, padding: 16,
            borderWidth: 1, borderColor: colors.border || 'rgba(255,255,255,0.06)',
        }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>Last 7 Days</Text>
                <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>{rangeLabel}</Text>
            </View>

            {/* Ring Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                {history.map((day, idx) => {
                    const pct = goal > 0 ? Math.min(day.steps / goal, 1) : 0;
                    const offset = RING_CIRCUMFERENCE * (1 - pct);
                    const isComplete = pct >= 1;

                    return (
                        <View key={idx} style={{ alignItems: 'center', gap: 5, flex: 1 }}>
                            <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                                <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
                                    {/* Background track */}
                                    <SvgCircle
                                        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                                        stroke={colors.border || 'rgba(255,255,255,0.06)'}
                                        strokeWidth={RING_STROKE} fill="transparent"
                                    />
                                    {/* Progress arc */}
                                    <SvgCircle
                                        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                                        stroke={isComplete ? colors.primary : (pct > 0 ? colors.primary + '80' : 'transparent')}
                                        strokeWidth={RING_STROKE} fill="transparent"
                                        strokeDasharray={`${RING_CIRCUMFERENCE}`}
                                        strokeDashoffset={`${offset}`}
                                        strokeLinecap="round"
                                    />
                                </Svg>
                                {/* Checkmark overlay for completed days */}
                                {isComplete && (
                                    <View style={{ position: 'absolute' }}>
                                        <MaterialIcons name="check" size={13} color={colors.primary} />
                                    </View>
                                )}
                            </View>
                            <Text style={{
                                fontSize: 9,
                                fontFamily: day.isToday ? 'SpaceGrotesk_700Bold' : 'SpaceGrotesk_600SemiBold',
                                color: day.isToday ? colors.primary : colors.textSecondary,
                                textTransform: 'uppercase',
                            }}>
                                {day.isToday ? 'Today' : day.dayLabel}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

export default function DashboardScreen() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [steps, setSteps] = useState(0);
    const [settings, setSettingsState] = useState({ stepGoal: 10000, calorieGoal: 2000, userName: 'Alex Rivera' });
    const [userName, setUserName] = useState('');
    const [intake, setIntake] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [workoutStats, setWorkoutStats] = useState({ caloriesBurned: 0, totalMinutes: 0 });
    const [recentWorkouts, setRecentWorkouts] = useState([]);
    const [aiMessage, setAiMessage] = useState('Loading AI suggestion...');
    const [aiSnacks, setAiSnacks] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [stepSource, setStepSource] = useState(null);
    const [profileImg, setProfileImg] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weeklySteps, setWeeklySteps] = useState([]);
    const nav = useNavigation();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [allMeals, allWorkouts, s, stepCount, historyVars, stepHist] = await Promise.all([
                getMeals(), getWorkouts(), getSettings(), getTodayStepCount(), getWorkoutHistory(), getStepHistory(7),
            ]);

            setSettingsState(s);
            setSteps(stepCount);

            // Merge Health Connect step history into the weekly rings if HC steps are enabled
            const conn = s.wearableConnections?.health_connect;
            if (typeof conn === 'object' && conn.syncSteps) {
                try {
                    const hcSteps = await fetchWeeklySteps(7); // { '2026-03-05': 8542, ... }
                    const merged = stepHist.map(day => ({
                        ...day,
                        steps: Math.max(day.steps, hcSteps[day.date] || 0), // Take the higher value to avoid double-counting
                    }));
                    setWeeklySteps(merged);
                } catch (e) {
                    console.warn('HC weekly steps merge failed:', e);
                    setWeeklySteps(stepHist);
                }
            } else {
                setWeeklySteps(stepHist);
            }

            // Check if steps come from a wearable
            const sourceInfo = await getActiveStepSourceInfo();
            setStepSource(sourceInfo);

            const todayMeals = getTodaysMeals(allMeals);
            const todayWorkouts = getTodaysWorkouts(allWorkouts);
            const macros = calcMacroTotals(todayMeals);
            const wStats = calcWorkoutTotals(todayWorkouts);

            if (sourceInfo?.deviceId === 'fitbit') {
                const fitbitCal = await getFitbitCalories('today');
                if (fitbitCal > 0) wStats.caloriesBurned = fitbitCal;
            }

            setIntake(macros);
            setWorkoutStats(wStats);

            // Format history objects to perfectly match the WorkoutCard props
            const historyWorkouts = historyVars.map(h => {
                let d = new Date(h.startedAt || new Date());
                let mins = Math.round((h.elapsedSeconds || 0) / 60);
                return {
                    id: h.id,
                    name: h.routineName || 'Completed Workout',
                    type: 'default', // Maps to the global UI accent theme color
                    duration: mins, // Must be pure int, WorkoutCard natively appends " mins"
                    time: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), // e.g. "Mar 5"
                    caloriesBurned: h.caloriesBurned || Math.round(mins * 6), // Estimate if missing
                    completed: true,
                    timestamp: h.startedAt || new Date().toISOString()
                };
            });

            // Make sure current workouts explicitly have a sortable timestamp
            const currentWorkouts = allWorkouts.map(w => ({
                ...w, timestamp: w.timestamp || new Date().toISOString()
            }));

            // Merge both lists, sort backwards by time, take top 3
            const combinedWorkouts = [...currentWorkouts, ...historyWorkouts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setRecentWorkouts(combinedWorkouts.slice(0, 3));

            // Get AI suggestion
            const msg = await getNutritionSuggestion(macros, s);
            setAiMessage(msg);

            // Load leaderboard
            const profile = await getUserProfile();
            setUserName(profile?.firstName || '');
            const lb = getLeaderboard('weekly', stepCount, profile?.firstName || 'You', s.stepGoal || 10000);
            setLeaderboard(lb);
            setProfileImg(profile?.profileImage || null);
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Start pedometer watcher for real-time step updates on Android
    useEffect(() => {
        startStepWatcher((newSteps) => {
            setSteps(newSteps);
        });
        return () => stopStepWatcher();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return t('goodMorning');
        if (h < 17) return t('goodAfternoon');
        return t('goodEvening');
    };

    const distance = ((steps * 0.0008).toFixed(1)); // rough km estimate

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting().toUpperCase()}</Text>
                    <Text style={styles.userName}>{userName || settings.userName}</Text>
                </View>
                <View style={styles.avatar}>
                    {profileImg ? (
                        <Image source={{ uri: profileImg }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                    ) : (
                        <MaterialIcons name="person" size={20} color={colors.textSecondary} />
                    )}
                    <View style={styles.statusDot} />
                </View>
            </View>

            {/* Step Ring Hero */}
            <View style={styles.stepSection}>
                <Text style={{ position: 'absolute', top: 15, right: 15, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', color: colors.textSecondary, opacity: 0.7, zIndex: 10 }}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={styles.stepGlow} />
                <StepRing steps={steps} goal={settings.stepGoal} colors={colors} />
                {stepSource && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'center' }}>
                        <MaterialIcons name="watch" size={12} color={colors.primary} />
                        <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', color: colors.primary }}>Synced from {stepSource.deviceName}</Text>
                    </View>
                )}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{workoutStats.caloriesBurned}</Text>
                        <Text style={styles.statLabel}>KCAL</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{distance}</Text>
                        <Text style={styles.statLabel}>KM</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{workoutStats.totalMinutes}</Text>
                        <Text style={styles.statLabel}>MIN</Text>
                    </View>
                </View>
            </View>

            {/* 7-Day Step Rings */}
            <WeeklyStepsCard history={weeklySteps} goal={settings.stepGoal} colors={colors} />

            {/* Mini Leaderboard Widget */}
            {leaderboard.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('friendsLeaderboard')}</Text>
                        <TouchableOpacity onPress={() => nav.getParent()?.navigate('Leaderboard')}>
                            <Text style={styles.seeMore}>{t('seeMore')}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.lbCard}>
                        {leaderboard.slice(0, 3).map((entry, i) => {
                            const rankColors = [colors.primary, '#94a3b8', '#b87333'];
                            const maxS = leaderboard[0]?.steps || 1;
                            return (
                                <View key={i} style={[styles.lbRow, i < 2 && styles.lbRowBorder]}>
                                    <View style={[styles.lbRankBadge, { backgroundColor: rankColors[i] + '22', borderColor: rankColors[i] + '55' }]}>
                                        <Text style={[styles.lbRankText, { color: rankColors[i] }]}>{i + 1}</Text>
                                    </View>
                                    <View style={styles.lbAvatar}>
                                        <MaterialIcons name={entry.isAI ? "smart-toy" : "person"} size={14} color={colors.textSecondary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.lbName, entry.isYou && { color: colors.primary }]}>
                                            {entry.isYou ? t('you') : entry.name}
                                        </Text>
                                        <View style={styles.lbBarBg}>
                                            <View style={[styles.lbBarFill, { width: `${(entry.steps / maxS) * 100}%` }]} />
                                        </View>
                                    </View>
                                    <Text style={styles.lbSteps}>{formatSteps(entry.steps)}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Sleep Data Quick Portal */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Sleep Data</Text>
                </View>
                <TouchableOpacity
                    style={styles.sleepCard}
                    onPress={() => nav.getParent()?.navigate('Sleep') || nav.navigate('Sleep')}
                >
                    <View style={styles.sleepIconBg}>
                        <MaterialIcons name="nights-stay" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.sleepTextCol}>
                        <Text style={styles.sleepTitle}>Sleep Analysis</Text>
                        <Text style={styles.sleepSubtitle}>View overnight rest details</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* AI Nutrition Assistant */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('aiNutritionAssistant')}</Text>
                    <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>{t('aiActive')}</Text>
                    </View>
                </View>
                <View style={styles.aiCard}>
                    <View style={styles.aiRow}>
                        <View style={styles.aiIconBox}>
                            <MaterialIcons name="smart-toy" size={18} color={colors.primary} />
                        </View>
                        <Text style={styles.aiText}>{aiMessage}</Text>
                    </View>
                    <View style={styles.aiSnackRow}>
                        <View style={styles.aiSnackCard}>
                            <Text style={styles.aiSnackLabel}>{t('snack')}</Text>
                            <Text style={styles.aiSnackName}>Greek Yogurt & Nuts</Text>
                            <Text style={styles.aiSnackMeta}>180 kcal • 15g Protein</Text>
                        </View>
                        <View style={styles.aiSnackCard}>
                            <Text style={styles.aiSnackLabel}>{t('postGym')}</Text>
                            <Text style={styles.aiSnackName}>Protein Shake</Text>
                            <Text style={styles.aiSnackMeta}>220 kcal • 24g Protein</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Recent Workouts */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recentWorkouts')}</Text>
                    <TouchableOpacity onPress={() => nav.navigate('WorkoutHistory')}>
                        <Text style={styles.viewAll}>{t('viewAll')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.workoutList}>
                    {recentWorkouts.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>{t('noWorkoutsYet')}</Text>
                        </View>
                    ) : (
                        recentWorkouts.map((w) => (
                            <WorkoutCard
                                key={w.id}
                                name={w.name}
                                type={w.type}
                                duration={w.duration}
                                time={w.time}
                                caloriesBurned={w.caloriesBurned}
                                completed={w.completed}
                                colors={colors}
                                opacity={1}
                            />
                        ))
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        paddingBottom: 160,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    greeting: {
        color: colors.primary,
        fontSize: 11,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        letterSpacing: 2,
    },
    userName: {
        color: colors.text,
        fontSize: 24,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -0.5,
        marginTop: 2,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    statusDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.bgDark,
    },

    // Step section
    stepSection: {
        alignItems: 'center',
        paddingVertical: 32,
        marginHorizontal: 24,
        marginTop: 8,
        borderRadius: 24,
        backgroundColor: colors.bgCard,
        borderWidth: 1,
        borderColor: colors.border,
        position: 'relative',
        overflow: 'hidden',
    },
    stepGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        gap: 16,
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    statValue: {
        color: colors.primary,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 16,
        fontVariant: ['tabular-nums'],
    },
    statLabel: {
        color: colors.slate400,
        fontSize: 10,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        letterSpacing: 1,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: 32,
        backgroundColor: colors.slate800,
    },

    // Sections
    section: {
        marginTop: 32,
        paddingHorizontal: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    viewAll: {
        color: colors.primary,
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    aiBadge: {
        backgroundColor: colors.primaryDim,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    aiBadgeText: {
        color: colors.primary,
        fontSize: 10,
        fontFamily: 'SpaceGrotesk_700Bold',
    },

    // AI Card
    aiCard: {
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    aiRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    aiIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primaryMid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiText: {
        flex: 1,
        color: colors.text,
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_400Regular',
        lineHeight: 20,
    },
    aiSnackRow: {
        flexDirection: 'row',
        gap: 12,
    },
    aiSnackCard: {
        flex: 1,
        backgroundColor: colors.bgDark,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    aiSnackLabel: {
        color: colors.primary,
        fontSize: 10,
        fontFamily: 'SpaceGrotesk_700Bold',
        marginBottom: 4,
    },
    aiSnackName: {
        color: colors.text,
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        marginBottom: 4,
    },
    aiSnackMeta: {
        color: colors.slate500,
        fontSize: 9,
        fontFamily: 'SpaceGrotesk_400Regular',
    },
    sleepCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sleepIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    sleepTextCol: {
        flex: 1,
    },
    sleepTitle: {
        color: colors.text,
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_700Bold',
        marginBottom: 2,
    },
    sleepSubtitle: {
        color: colors.slate500,
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_500Medium',
    },

    // Workouts
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
        fontFamily: 'SpaceGrotesk_400Regular',
    },

    // Mini Leaderboard
    seeMore: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    lbCard: {
        backgroundColor: colors.bgCard, borderRadius: 16, padding: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    lbRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    lbMedal: { fontSize: 18, width: 28, textAlign: 'center' },
    lbRankBadge: {
        width: 28, height: 28, borderRadius: 14,
        borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    },
    lbRankText: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    lbAvatar: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    lbName: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', marginBottom: 3 },
    lbBarBg: { height: 5, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
    lbBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    lbSteps: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'], width: 40, textAlign: 'right' },
});
