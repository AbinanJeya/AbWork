import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
    Dimensions, Modal, Alert, Vibration
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, runOnJS
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { getRoutines, deleteRoutine, getWorkouts, getWorkoutHistory, saveRoutines, getExerciseHistory, getSettings } from '../services/storage';
import { fetchWorkoutsData } from '../services/health';
import { useWorkout } from '../contexts/WorkoutContext';
import { useTranslation, getMonthNames } from '../services/i18n';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -80;
const DAYS_HEADER = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ROUTINE_ICONS = [
    { lib: MaterialCommunityIcons, name: 'dumbbell' },
    { lib: MaterialIcons, name: 'fitness-center' },
    { lib: MaterialIcons, name: 'directions-run' },
    { lib: MaterialCommunityIcons, name: 'arm-flex' },
];

// ── Swipeable Row Component (Reanimated Setup) ───────────────────────────
function SwipeableRow({ children, onDelete, colors, isDark }) {
    const { t } = useTranslation();
    const translateX = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .onUpdate((event) => {
            // Clamp open stroke between -100 and 0
            translateX.value = Math.max(-100, Math.min(0, event.translationX));
        })
        .onEnd((event) => {
            const shouldOpen = translateX.value < -45 || event.velocityX < -500;
            if (shouldOpen) {
                translateX.value = withSpring(-90, { stiffness: 400, damping: 25 });
            } else {
                translateX.value = withSpring(0, { stiffness: 400, damping: 25 });
            }
        });

    const rStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
            {/* Delete background — always rendered */}
            <TouchableOpacity
                style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 90,
                    backgroundColor: '#ef4444',
                    alignItems: 'center', justifyContent: 'center',
                }}
                onPress={() => {
                    translateX.value = withSpring(0);
                    onDelete();
                }}
                activeOpacity={0.8}
            >
                <MaterialIcons name="delete" size={24} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 2 }}>{t('delete').toUpperCase()}</Text>
            </TouchableOpacity>

            {/* Foreground Draggable Card */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[{ backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5', borderRadius: 14 }, rStyle]}>
                    {children}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

export default function WorkoutPlannerScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const tMonthNames = getMonthNames(t);
    const tDaysHeader = [t('sun').slice(0, 2).toUpperCase(), t('mon').slice(0, 2).toUpperCase(), t('tue').slice(0, 2).toUpperCase(), t('wed').slice(0, 2).toUpperCase(), t('thu').slice(0, 2).toUpperCase(), t('fri').slice(0, 2).toUpperCase(), t('sat').slice(0, 2).toUpperCase()];
    const [routines, setRoutines] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(true);
    const [workoutDates, setWorkoutDates] = useState(new Set());

    const now = new Date();
    const [calMonth, setCalMonth] = useState(now.getMonth());
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [workoutStreak, setWorkoutStreak] = useState(0);

    // Today for calendar highlight
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDay = now.getDate();
    const todayMonth = now.getMonth();
    const todayYear = now.getFullYear();

    const loadData = useCallback(async () => {
        try {
            const [r, allWorkouts, history, s] = await Promise.all([
                getRoutines(), 
                getWorkouts(), 
                getWorkoutHistory(),
                getSettings()
            ]);

            setRoutines(r);
            
            const dates = new Set();
            // From workout log (timestamp field)
            (allWorkouts || []).forEach(w => {
                if (w.timestamp) dates.add(w.timestamp.slice(0, 10));
            });
            // From workout history (startedAt / finishedAt fields)
            (history || []).forEach(w => {
                if (w.startedAt) dates.add(w.startedAt.slice(0, 10));
                if (w.finishedAt) dates.add(w.finishedAt.slice(0, 10));
            });

            // Fetch Health Connect and merge into Dates to keep calendar & streaks alive
            const conn = s.wearableConnections?.health_connect;
            if (typeof conn === 'object' && conn.syncWorkouts) {
                const endWindow = new Date();
                const startWindow = new Date();
                startWindow.setMonth(startWindow.getMonth() - 2); // 2 months lookup for streak continuity
                const hcWorkouts = await fetchWorkoutsData(startWindow, endWindow) || [];
                hcWorkouts.forEach(hc => {
                    dates.add(hc.startTime.slice(0, 10));
                });
            }

            setWorkoutDates(dates);

            // Compute the real streak based on the merged Dates pool
            let streak = 0;
            const streakCursor = new Date();
            while (true) {
                const key = streakCursor.toISOString().slice(0, 10);
                if (dates.has(key)) {
                    streak++;
                    streakCursor.setDate(streakCursor.getDate() - 1);
                } else {
                    break;
                }
            }
            setWorkoutStreak(streak);

        } catch (err) {
            console.error('Routines load error:', err);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [actionTarget, setActionTarget] = useState(null);

    const handleDelete = (id, name) => {
        setDeleteTarget({ id, name });
    };

    const confirmDelete = async () => {
        if (deleteTarget) {
            await deleteRoutine(deleteTarget.id);
            await loadData();
        }
        setDeleteTarget(null);
    };

    const workoutCtx = useWorkout();

    const handleStartWorkout = async (routine) => {
        const exerciseLogs = await Promise.all((routine.exercises || []).map(async (ex) => {
            // Fetch last session's data for smart defaults
            const hist = await getExerciseHistory(ex.name);
            const numSets = ex.sets || 3;
            return {
                name: ex.name,
                muscleGroup: ex.muscleGroup || '',
                equipment: ex.equipment || '',
                weightUnit: 'kg',
                restMin: '1',
                restSec: '30',
                bestWeight: hist.bestWeight,
                bestE1RM: hist.bestE1RM,
                sets: Array.isArray(ex.sets) 
                    ? ex.sets.map((s, i) => {
                        const lastSet = hist.lastSets[i] || hist.lastSets[hist.lastSets.length - 1];
                        const defWeight = s.weight || lastSet?.weight || ex.weight || '';
                        const defReps = s.reps || lastSet?.reps || ex.reps || '12';
                        const prevStr = lastSet ? `${lastSet.weight}${lastSet.weightUnit || 'kg'} x ${lastSet.reps}` : '';
                        return {
                            id: `${Date.now()}-${i}-${Math.random()}`,
                            setNum: i + 1,
                            weight: defWeight,
                            reps: defReps,
                            prev: prevStr,
                            completed: false,
                        };
                    })
                    : Array.from({ length: numSets }, (_, i) => {
                        const lastSet = hist.lastSets[i] || hist.lastSets[hist.lastSets.length - 1];
                        const defWeight = lastSet?.weight || ex.weight || '';
                        const defReps = lastSet?.reps || ex.reps || '12';
                        const prevStr = lastSet ? `${lastSet.weight}${lastSet.weightUnit || 'kg'} x ${lastSet.reps}` : (ex.weight ? `${ex.weight}${ex.weightUnit || 'kg'} x ${ex.reps || '12'}` : '');
                        return {
                            id: `${Date.now()}-${i}`,
                            setNum: i + 1,
                            weight: defWeight,
                            reps: defReps,
                            prev: prevStr,
                            completed: false,
                        };
                    }),
            };
        }));
        workoutCtx.startWorkout(routine, exerciseLogs);
    };

    // Calendar
    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    };

    const buildCalendarDays = () => {
        const firstDay = new Date(calYear, calMonth, 1);
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        let startDow = firstDay.getDay(); // Sun=0, already correct for SU-first
        const cells = [];
        // Empty spacers for alignment (no prev month days)
        for (let i = 0; i < startDow; i++) {
            cells.push({ day: '', type: 'empty' });
        }
        // Current month days only
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasWorkout = workoutDates.has(dateStr);
            const isToday = calYear === todayYear && calMonth === todayMonth && d === todayDay;
            cells.push({ day: d, type: 'current', highlighted: hasWorkout, isToday });
        }
        // No next month overflow
        return cells;
    };

    const calendarDays = buildCalendarDays();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                        <MaterialIcons name="fitness-center" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.pageTitle}>{t('workouts')}</Text>
                </View>

                {/* Streak Indicator */}
                {workoutStreak > 0 && (
                    <View style={[styles.streakBadge, { borderColor: '#38bdf8' }]}>
                        <MaterialIcons name="flash-on" size={16} color="#38bdf8" style={styles.streakIconBlue} />
                        <Text style={[styles.streakText, { color: '#38bdf8' }]}>{workoutStreak}</Text>
                    </View>
                )}
            </View>

            <DraggableFlatList
                containerStyle={{ flex: 1 }}
                contentContainerStyle={styles.content}
                data={routines}
                onDragBegin={() => Vibration.vibrate(40)}
                onPlaceholderIndexChange={() => Vibration.vibrate(15)}
                onDragEnd={({ data }) => {
                    setRoutines(data);
                    saveRoutines(data);
                }}
                keyExtractor={(r) => r.id}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListHeaderComponent={
                    <>
                        {/* My Routines Header */}
                        <View style={styles.myRoutinesRow}>
                            <Text style={styles.myRoutinesTitle}>{t('myRoutines')}</Text>
                        </View>
                        
                        {routines.length === 0 && (
                            <View style={styles.emptyCard}>
                                <MaterialIcons name="fitness-center" size={40} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>{t('noRoutines')}</Text>
                                <Text style={styles.emptyText}>
                                    {t('createFirstRoutine')}
                                </Text>
                            </View>
                        )}
                    </>
                }
                renderItem={({ item: r, drag, isActive, getIndex }) => {
                    const index = getIndex() || 0;
                    const exerciseCount = r.exercises?.length || 0;
                    const hash = (r.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const iconConfig = ROUTINE_ICONS[hash % ROUTINE_ICONS.length];
                    const IconLib = iconConfig.lib;

                    const cardContent = (
                        <TouchableOpacity
                            style={[styles.routineCard, isActive && styles.routineCardActive]}
                            activeOpacity={0.8}
                            onLongPress={() => {
                                if (!isActive) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setActionTarget(r);
                                }
                            }}
                            delayLongPress={300}
                        >
                            <View style={styles.routineRow}>
                                <TouchableOpacity
                                    onLongPress={drag}
                                    delayLongPress={100}
                                    disabled={isActive}
                                    style={styles.dragHandleSquare}
                                >
                                    <MaterialIcons name="drag-indicator" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>

                                <View style={styles.routineIconSquare}>
                                    <IconLib name={iconConfig.name} size={22} color={colors.textMuted} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.routineName}>{r.name}</Text>
                                    <Text style={styles.routineMeta}>
                                        {(r.exercises || []).slice(0, 2).map(e => e.muscleGroup || e.name).filter(Boolean).join(', ') || t('general')} • {exerciseCount} {t('exercises')}
                                    </Text>
                                </View>

                                <TouchableOpacity style={styles.startBadge} onPress={() => handleStartWorkout(r)}>
                                    <Text style={styles.startBadgeText}>{t('startWorkout').toUpperCase()}</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    );

                    return (
                        <ScaleDecorator activeScale={1.02}>
                            <SwipeableRow
                                key={r.id}
                                colors={colors}
                                isDark={isDark}
                                onDelete={() => handleDelete(r.id, r.name)}
                            >
                                {cardContent}
                            </SwipeableRow>
                        </ScaleDecorator>
                    );
                }}
                ListFooterComponent={
                    <>
                        {/* Create New Routine Button */}
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => navigation.navigate('CreateRoutine')}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="add-circle-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.createBtnText}>{t('createRoutine').toUpperCase()}</Text>
                        </TouchableOpacity>

                        {/* Workout Activity Calendar */}
                        <View style={styles.calendarCard}>
                            <TouchableOpacity
                                style={styles.calendarHeader}
                                onPress={() => setCalendarOpen(o => !o)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.calendarTitleRow}>
                                    <MaterialIcons name="calendar-month" size={22} color={colors.primary} />
                                    <Text style={styles.calendarTitle}>{t('workoutActivity')}</Text>
                                </View>
                                <MaterialIcons
                                    name={calendarOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                                    size={24}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>

                            {calendarOpen && (
                                <View style={styles.calendarBody}>
                                    <View style={styles.monthRow}>
                                        <Text style={styles.monthText}>{tMonthNames[calMonth]} {calYear}</Text>
                                        <View style={styles.monthNav}>
                                            <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth}>
                                                <MaterialIcons name="chevron-left" size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth}>
                                                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.calGrid}>
                                        {tDaysHeader.map(d => (
                                            <View key={d} style={styles.calCell}>
                                                <Text style={styles.calDayHeader}>{d}</Text>
                                            </View>
                                        ))}

                                        {calendarDays.map((cell, i) => (
                                            <View key={i} style={styles.calCell}>
                                                {cell.highlighted ? (
                                                    <View style={styles.calDayHighlighted}>
                                                        <Text style={styles.calDayHighlightedText}>{cell.day}</Text>
                                                    </View>
                                                ) : cell.isToday ? (
                                                    <Text style={styles.calDayToday}>{cell.day}</Text>
                                                ) : (
                                                    <Text style={[
                                                        styles.calDayText,
                                                        cell.type !== 'current' && styles.calDayDimmed,
                                                    ]}>{cell.day}</Text>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={{ height: 40 }} />
                    </>
                }
            />

            {/* Custom Delete Confirmation Modal */}
            <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
                <TouchableOpacity style={styles.deleteOverlay} activeOpacity={1} onPress={() => setDeleteTarget(null)}>
                    <TouchableOpacity activeOpacity={1} style={styles.deleteModal}>
                        <View style={styles.deleteIconCircle}>
                            <MaterialIcons name="delete-outline" size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.deleteTitle}>{t('deleteRoutine')}</Text>
                        <Text style={styles.deleteMsg}>
                            {t('areYouSureDelete')}{'\n'}
                            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>
                                "{deleteTarget?.name}"
                            </Text>?
                        </Text>
                        <View style={styles.deleteBtnRow}>
                            <TouchableOpacity
                                style={styles.deleteCancelBtn}
                                onPress={() => setDeleteTarget(null)}
                            >
                                <Text style={styles.deleteCancelText}>{t('no')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteConfirmBtn}
                                onPress={confirmDelete}
                            >
                                <Text style={styles.deleteConfirmText}>{t('yesDelete')}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Custom Action Screen Modal */}
            <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
                <TouchableOpacity style={styles.deleteOverlay} activeOpacity={1} onPress={() => setActionTarget(null)}>
                    <TouchableOpacity activeOpacity={1} style={styles.actionModal}>
                        <Text style={styles.actionTitle}>{t('manage', { defaultValue: 'Manage Routine' })}</Text>
                        <Text style={styles.actionRoutineName}>{actionTarget?.name}</Text>

                        <TouchableOpacity style={[styles.actionOptionBtn, styles.actionEditBtn]} onPress={() => {
                            navigation.navigate('CreateRoutine', { editRoutine: actionTarget });
                            setActionTarget(null);
                        }}>
                            <MaterialIcons name="edit" size={20} color="#fff" />
                            <Text style={[styles.actionOptionText, { color: '#fff' }]}>{t('edit', { defaultValue: 'Edit Routine' }).toUpperCase()}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.actionOptionBtn, styles.actionDeleteBtn]} onPress={() => {
                            const r = actionTarget;
                            setActionTarget(null);
                            handleDelete(r.id, r.name);
                        }}>
                            <MaterialIcons name="delete-outline" size={20} color="#fff" />
                            <Text style={[styles.actionOptionText, { color: '#fff' }]}>{t('delete', { defaultValue: 'Delete Routine' }).toUpperCase()}</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    content: { paddingBottom: 120, paddingHorizontal: 16 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary + '18',
        alignItems: 'center', justifyContent: 'center',
    },
    pageTitle: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5 },

    // Streak indicator
    streakBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: isDark ? '#1a1a1d' : '#f0f9ff',
        borderWidth: 1, borderRadius: 12,
        shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    streakIconBlue: { textShadowColor: 'rgba(56,189,248,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
    streakText: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    myRoutinesRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 20,
        marginBottom: 8,
    },
    myRoutinesTitle: { color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    reorderText: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Routine Cards
    routineCard: {
        backgroundColor: colors.bgCard, borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    routineCardActive: {
        borderColor: colors.primary,
        shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
    },
    routineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dragHandleSquare: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10,
        marginLeft: -4, marginRight: -4,
    },
    routineIconSquare: {
        width: 48, height: 48, borderRadius: 10,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    routineName: {
        color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase', letterSpacing: 1,
    },
    routineMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    startBadge: {
        backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 5,
        borderRadius: 999,
    },
    startBadgeText: { color: isDark ? '#0a0a0a' : '#fff', fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.5 },

    // Create New Routine
    createBtn: {
        marginTop: 16, paddingVertical: 18, borderWidth: 2,
        borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
        borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
    },
    createBtnText: {
        color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2, textTransform: 'uppercase',
    },

    // Empty
    emptyCard: {
        backgroundColor: colors.bgCard, borderRadius: 20, padding: 32,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 8, gap: 10,
    },
    emptyTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

    // Calendar
    calendarCard: {
        marginTop: 28, backgroundColor: colors.bgCard, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border,
        overflow: 'hidden',
    },
    calendarHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16,
    },
    calendarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    calendarTitle: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    calendarBody: { paddingHorizontal: 16, paddingBottom: 20 },
    monthRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingHorizontal: 2,
    },
    monthText: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    monthNav: { flexDirection: 'row', gap: 8 },
    monthNavBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
        width: '14.28%',
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 6,
    },
    calDayHeader: {
        color: colors.textMuted, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
    },
    calDayText: { color: colors.text, fontSize: 13 },
    calDayDimmed: { color: isDark ? '#333' : '#ccc' },
    calDayToday: {
        color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold',
    },
    calDayHighlighted: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 4,
    },
    calDayHighlightedText: { color: isDark ? '#0a0a0a' : '#fff', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

    // Delete Confirmation Modal
    deleteOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center',
    },
    deleteModal: {
        width: 300, backgroundColor: colors.bg,
        borderRadius: 20, padding: 24, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    },
    deleteIconCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    deleteTitle: {
        color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8,
    },
    deleteMsg: {
        color: colors.textSecondary, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium',
        textAlign: 'center', lineHeight: 20, marginBottom: 24,
    },
    deleteBtnRow: {
        flexDirection: 'row', gap: 12, width: '100%',
    },
    deleteCancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderWidth: 1, borderColor: colors.border,
    },
    deleteCancelText: {
        color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold',
    },
    deleteConfirmBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
        backgroundColor: '#ef4444',
    },
    deleteConfirmText: {
        color: '#fff', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold',
    },

    // Action Menu Modal
    actionModal: {
        width: 300, backgroundColor: colors.bg,
        borderRadius: 20, padding: 24, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    },
    actionTitle: {
        color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
    },
    actionRoutineName: {
        color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 20,
        textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
    },
    actionOptionBtn: {
        width: '100%', paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 14, marginBottom: 12, borderWidth: 1,
    },
    actionEditBtn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionDeleteBtn: {
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
        marginBottom: 0,
    },
    actionOptionText: {
        fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold',
    },
});
