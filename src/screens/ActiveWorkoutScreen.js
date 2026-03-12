import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Vibration, Dimensions, Modal, TouchableWithoutFeedback, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme } from '../theme';
import { saveWorkoutSession } from '../services/storage';
import { addXP, XP_AMOUNTS } from '../services/leveling';
import { useWorkout } from '../contexts/WorkoutContext';
import { getExerciseHistory, getSettings, updateRoutine } from '../services/storage';
import WeightKeypad from '../components/WeightKeypad';
import ExerciseSearchModal from '../components/ExerciseSearchModal';
import ExerciseActionModal from '../components/ExerciseActionModal';
import { useNavigation } from '@react-navigation/native';
function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return { hrs: String(hrs).padStart(2, '0'), mins: String(mins).padStart(2, '0'), secs: String(secs).padStart(2, '0') };
}

const getIconLetter = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'E';
};

export default function ActiveWorkoutScreen({ isOverlay }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const insets = useSafeAreaInsets();
    const workout = useWorkout();
    const navigation = useNavigation();
    const { setIsModalOpen, restTimer, setRestTimer, restDuration, setRestDuration } = workout;
    const routine = workout.activeWorkout?.routine;

    if (!routine) return null;

    const buildExerciseLogs = () => (routine.exercises || []).map(ex => {
        const parts = (ex.restTime || '01:30').split(':');
        return {
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: ex.name,
            muscleGroup: ex.muscleGroup || '',
            equipment: ex.equipment || '',
            weightUnit: 'kg',
            restMin: parts[0] || '01',
            restSec: parts[1] || '30',
            bestWeight: ex.bestWeight || 0,
            bestE1RM: ex.bestE1RM || 0,
            sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
                id: `${Date.now()}-${i}`,
                setNum: i + 1,
                weight: ex.weight || '',
                reps: ex.reps || '12',
                prev: ex.weight ? `${ex.weight}${ex.weightUnit || 'kg'} x ${ex.reps || '12'}` : '',
                completed: false,
                isPR: false,
            })),
        };
    });

    const getInitialLogs = () => {
        if (workout.activeWorkout?.exerciseLogs) {
            return workout.activeWorkout.exerciseLogs.map((log, index) => ({
                id: log.id || `restored-ex-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
                ...log
            }));
        }
        return buildExerciseLogs();
    };

    const getInitialElapsed = () => {
        if (workout.elapsedRef.current > 0) {
            return workout.elapsedRef.current;
        }
        return 0;
    };

    const [exerciseLogs, setExerciseLogs] = useState(getInitialLogs);
    const [elapsedSeconds, setElapsedSeconds] = useState(getInitialElapsed);
    const [routineModified, setRoutineModified] = useState(false);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const startTimeRef = useRef(
        workout.activeWorkout ? workout.activeWorkout.startTime : Date.now()
    );
    const elapsedInterval = useRef(null);
    const restInterval = useRef(null);

    const [baseRestTimer, setBaseRestTimer] = useState(60);

    useEffect(() => {
        getSettings().then(s => {
            const baseTimer = s.baseRestTimer !== undefined ? s.baseRestTimer : 60;
            setBaseRestTimer(baseTimer);

            setExerciseLogs(prev => prev.map(log => {
                const exSecs = (parseInt(log.restMin) || 0) * 60 + (parseInt(log.restSec) || 0);
                if (exSecs < baseTimer) {
                    return {
                        ...log,
                        restMin: String(Math.floor(baseTimer / 60)).padStart(2, '0'),
                        restSec: String(baseTimer % 60).padStart(2, '0')
                    };
                }
                return log;
            }));
        });
    }, []);

    const handleMinimize = () => {
        workout.minimizeWorkout(exerciseLogs);
    };

    const handleAddExercise = (selectedEx) => {
        const defaultSecs = Math.max(90, baseRestTimer);
        const newEx = {
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: selectedEx.name,
            muscleGroup: selectedEx.bodyPart || selectedEx.target || '',
            equipment: selectedEx.equipment || '',
            weightUnit: 'kg',
            restMin: String(Math.floor(defaultSecs / 60)).padStart(2, '0'),
            restSec: String(defaultSecs % 60).padStart(2, '0'),
            bestWeight: 0,
            bestE1RM: 0,
            sets: [{
                id: `${Date.now()}-0`,
                setNum: 1,
                weight: '',
                reps: '12',
                prev: '',
                completed: false,
                isPR: false,
            }],
        };

        if (replaceExIndex !== null) {
            setExerciseLogs(prev => {
                const updated = [...prev];
                updated[replaceExIndex] = newEx;
                return updated;
            });
            setReplaceExIndex(null);
        } else {
            setExerciseLogs(prev => [...prev, newEx]);
        }
        setRoutineModified(true);
        setShowExSearch(false);
    };

    const handleRemoveExercise = () => {
        if (actionExIndex !== null) {
            setExerciseLogs(prev => prev.filter((_, i) => i !== actionExIndex));
            setActionExIndex(null);
            setActionModalVisible(false);
            setRoutineModified(true);

            // Auto finish if no exercises left
            if (exerciseLogs.length <= 1) {
                setShowDiscardModal(true);
            }
        }
    };

    // Keypad state
    const [keypadVisible, setKeypadVisible] = useState(false);

    // Custom Modals
    const [showExSearch, setShowExSearch] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [actionExIndex, setActionExIndex] = useState(null);
    const [replaceExIndex, setReplaceExIndex] = useState(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [keypadMode, setKeypadMode] = useState('weight');
    const [keypadTarget, setKeypadTarget] = useState(null);
    const [keypadInitVal, setKeypadInitVal] = useState('');
    const [keypadInitUnit, setKeypadInitUnit] = useState('KG');
    const [keypadLabel, setKeypadLabel] = useState('WEIGHT');
    const [keypadShowUnit, setKeypadShowUnit] = useState(true);

    useEffect(() => {
        setIsModalOpen(
            actionModalVisible ||
            showExSearch ||
            keypadVisible ||
            showDiscardModal ||
            showFinishModal
        );
    }, [actionModalVisible, showExSearch, keypadVisible, showDiscardModal, showFinishModal, setIsModalOpen]);

    const openKeypad = (mode, exIndex, setOrField) => {
        const ex = exerciseLogs[exIndex];
        setKeypadMode(mode);
        if (mode === 'weight') {
            setKeypadTarget({ exIndex, setId: setOrField.id });
            setKeypadInitVal(setOrField.weight || '0');
            setKeypadInitUnit(ex.weightUnit === 'kg' ? 'KG' : 'LBS');
            setKeypadLabel('WEIGHT');
            setKeypadShowUnit(true);
        } else if (mode === 'reps') {
            setKeypadTarget({ exIndex, setId: setOrField.id });
            setKeypadInitVal(setOrField.reps || '0');
            setKeypadLabel('REPS');
            setKeypadShowUnit(false);
        } else if (mode === 'rest') {
            setKeypadTarget({ exIndex });
            const totalSec = (parseInt(ex.restMin) || 0) * 60 + (parseInt(ex.restSec) || 0);
            const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const ss = String(totalSec % 60).padStart(2, '0');
            setKeypadInitVal(`${mm}:${ss}`);
            setKeypadLabel('REST TIME');
            setKeypadShowUnit(false);
        }
        setKeypadVisible(true);
    };

    const handleKeypadDone = (value, unit) => {
        if (!keypadTarget) return;
        if (keypadMode === 'weight') {
            updateSetField(keypadTarget.exIndex, keypadTarget.setId, 'weight', value);
            const newUnit = unit === 'KG' ? 'kg' : 'lbs';
            setExerciseLogs(prev => {
                const updated = [...prev];
                updated[keypadTarget.exIndex] = { ...updated[keypadTarget.exIndex], weightUnit: newUnit };
                return updated;
            });
        } else if (keypadMode === 'reps') {
            updateSetField(keypadTarget.exIndex, keypadTarget.setId, 'reps', value);
        } else if (keypadMode === 'rest') {
            // Parse value as seconds
            const num = parseInt(value) || 0;
            const mins = String(Math.floor(num / 60));
            const secs = String(num % 60);
            setExerciseLogs(prev => {
                const updated = [...prev];
                updated[keypadTarget.exIndex] = { ...updated[keypadTarget.exIndex], restMin: mins, restSec: secs };
                return updated;
            });
        }
        setKeypadTarget(null);
    };

    // Elapsed timer
    useEffect(() => {
        elapsedInterval.current = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(elapsedInterval.current);
    }, []);

    // Rest timer
    useEffect(() => {
        if (restTimer === null) { clearInterval(restInterval.current); return; }
        if (restTimer <= 0) {
            setRestTimer(null);
            // Staccato high-force hardware pulses (THUD...THUD...THUD pattern)
            const pattern = [0];
            for (let i = 0; i < 15; i++) {
                pattern.push(60); // 60ms hit (maximizes start/stop force)
                pattern.push(120); // 120ms wait
            }
            Vibration.vibrate(pattern);
            return;
        }
        restInterval.current = setInterval(() => {
            setRestTimer(prev => {
                if (prev <= 1) {
                    clearInterval(restInterval.current);
                    const pattern = [0];
                    for (let i = 0; i < 15; i++) {
                        pattern.push(60);
                        pattern.push(120);
                    }
                    Vibration.vibrate(pattern);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(restInterval.current);
    }, [restTimer !== null]);

    const getRestSeconds = (ex) => (parseInt(ex.restMin) || 0) * 60 + (parseInt(ex.restSec) || 0);

    const updateSetField = (exIndex, setId, field, value) => {
        setExerciseLogs(prev => {
            const updated = [...prev];
            const ex = { ...updated[exIndex] };
            ex.sets = ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s);
            updated[exIndex] = ex;
            return updated;
        });
    };

    const toggleSet = (exIndex, setId) => {
        setExerciseLogs(prev => {
            const updated = [...prev];
            const ex = { ...updated[exIndex] };
            ex.sets = ex.sets.map(s => {
                if (s.id === setId) {
                    const wasCompleted = s.completed;
                    let isPR = s.isPR || false;

                    if (!wasCompleted) {
                        // Check for PR
                        const w = parseFloat(s.weight) || 0;
                        const r = parseFloat(s.reps) || 0;
                        const e1rm = w * (1 + r / 30);

                        // It's a PR if it beats the best all-time weight OR the best all-time estimated 1RM
                        // AND the weight is greater than 0
                        if (w > 0 && (w > ex.bestWeight || e1rm > ex.bestE1RM)) {
                            isPR = true;
                            // Update the local bests so subsequent sets don't repeatedly trigger unless they are even better
                            ex.bestWeight = Math.max(ex.bestWeight, w);
                            ex.bestE1RM = Math.max(ex.bestE1RM, e1rm);
                            // Distinct haptic thud for PR celebration
                            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) { }
                        } else {
                            // Start rest timer (only if not a PR to avoid double haptics)
                            const restSecs = getRestSeconds(ex);
                            if (restSecs > 0) { setRestDuration(restSecs); setRestTimer(restSecs); }
                            Vibration.vibrate(40);
                        }
                    } else {
                        isPR = false; // Reset PR flag if unchecking
                        Vibration.vibrate(15);
                    }
                    return { ...s, completed: !wasCompleted, isPR };
                }
                return s;
            });
            updated[exIndex] = ex;
            return updated;
        });
    };

    const addSet = (exIndex) => {
        setExerciseLogs(prev => {
            const updated = [...prev];
            const ex = { ...updated[exIndex] };
            const last = ex.sets[ex.sets.length - 1];
            ex.sets = [...ex.sets, {
                id: `${Date.now()}-${ex.sets.length}`,
                setNum: ex.sets.length + 1,
                weight: last?.weight || '', reps: last?.reps || '12',
                prev: '', completed: false,
            }];
            updated[exIndex] = ex;
            return updated;
        });
        setRoutineModified(true);
    };

    const removeSet = (exIndex) => {
        setExerciseLogs(prev => {
            const updated = [...prev];
            const ex = { ...updated[exIndex] };
            if (ex.sets.length > 1) {
                ex.sets = ex.sets.slice(0, -1);
            }
            updated[exIndex] = ex;
            return updated;
        });
        setRoutineModified(true);
    };

    const executeDiscard = () => {
        setShowDiscardModal(false);
        workout.endWorkout();
        navigation.goBack();
    };

    const handleFinish = () => {
        if (routineModified && routine?.id) {
            Alert.alert(
                'Save Routine Changes?',
                'You modified the exercises and sets. Save these changes to your base routine?',
                [
                    { text: 'Finish Without Saving', onPress: () => setShowFinishModal(true) },
                    { 
                        text: 'Save & Finish', 
                        onPress: async () => {
                            const payload = {
                                exercises: exerciseLogs.map(ex => ({
                                    name: ex.name.trim(),
                                    sets: ex.sets,
                                    restTime: `${String(ex.restMin).padStart(2,'0')}:${String(ex.restSec).padStart(2,'0')}`,
                                    bodyPart: ex.muscleGroup || '',
                                    equipment: ex.equipment || '',
                                    isCustom: ex.isCustom || false
                                }))
                            };
                            try {
                                await updateRoutine(routine.id, payload);
                            } catch (e) {
                                console.error('Failed to update routine', e);
                            }
                            setShowFinishModal(true);
                        } 
                    },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } else {
            setShowFinishModal(true);
        }
    };

    const executeFinish = async () => {
        setShowFinishModal(false);
        clearInterval(elapsedInterval.current);
        const session = {
            routineId: routine.id,
            routineName: routine.name,
            startedAt: new Date(startTimeRef.current).toISOString(),
            finishedAt: new Date().toISOString(),
            elapsedSeconds,
            exerciseLogs: exerciseLogs.map(ex => ({
                name: ex.name,
                sets: ex.sets.map(s => ({ ...s })),
            })),
        };
        await saveWorkoutSession(session);
        const xpResult = await addXP(XP_AMOUNTS.WORKOUT_COMPLETED, 'workout_completed');
        workout.endWorkout();
        const t = formatTime(elapsedSeconds);
        setTimeout(() => {
            Alert.alert(
                'Workout Complete',
                `Total Time: ${t.hrs}:${t.mins}:${t.secs}\nRoutine: ${routine.name}\n+${XP_AMOUNTS.WORKOUT_COMPLETED} XP${xpResult.leveledUp ? ` • Level Up! Level ${xpResult.level}` : ''}`,
                [{ text: 'Great!', onPress: () => { navigation.goBack(); } }]
            );
        }, 300); // Slight delay for smooth modal close transition
    };

    const skipRest = () => setRestTimer(null);
    const adjustRest = (delta) => setRestTimer(prev => Math.max(0, (prev || 0) + delta));

    const time = formatTime(elapsedSeconds);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleMinimize} style={styles.minimizeBtn}>
                    <MaterialIcons name="expand-more" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <View style={styles.headerLeft}>
                    <MaterialIcons name="fitness-center" size={18} color={colors.primary} />
                    <View>
                        <Text style={styles.headerTitle}>{routine.name}</Text>
                        <Text style={styles.headerSubtitle}>Active Session</Text>
                    </View>
                </View>
                <View style={[styles.headerRight, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
                    <TouchableOpacity onPress={() => setIsReorderMode(!isReorderMode)}>
                        <MaterialIcons 
                            name={isReorderMode ? "check" : "list"} 
                            size={24} 
                            color={isReorderMode ? colors.primary : colors.textSecondary} 
                        />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.totalTimeLabel}>TOTAL TIME</Text>
                        <Text style={styles.totalTimeValue}>
                            {time.hrs}:{time.mins}:<Text style={styles.totalTimeSecs}>{time.secs}</Text>
                        </Text>
                    </View>
                </View>
            </View>

            {/* Exercises Scroll */}
            <DraggableFlatList
                data={exerciseLogs}
                onDragBegin={() => Vibration.vibrate(40)} // Crisp deep thud for pickup
                onPlaceholderIndexChange={() => Vibration.vibrate(15)} // Ultra-fast hardware tick for sliding past slots
                onDragEnd={({ data }) => {
                    setExerciseLogs(data);
                    setRoutineModified(true);
                }}
                keyExtractor={(item, index) => item.id ? item.id : `fallback-key-${index}`}
                containerStyle={{ flex: 1 }}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item: exercise, getIndex, drag, isActive: isDragging }) => {
                    const exIndex = getIndex();

                    // If globally dragging or in Reorder Mode, render the minimalist row overlay
                    if (isReorderMode || isDragging) {
                        return (
                            <ScaleDecorator activeScale={1}>
                                <TouchableOpacity 
                                    onLongPress={isReorderMode ? drag : null} 
                                    delayLongPress={isReorderMode ? 10 : 200}
                                    style={[styles.dragOverlayRow, { backgroundColor: colors.surface, opacity: isDragging ? 0.8 : 1 }]}
                                >
                                    <View style={styles.dragOverlayIconBadge}>
                                        {exercise.gifUrl ? (
                                            <Image source={{ uri: exercise.gifUrl }} style={styles.dragOverlayIconImg} />
                                        ) : (
                                            <Text style={styles.dragOverlayIconLetter}>{getIconLetter(exercise.name)}</Text>
                                        )}
                                    </View>
                                    <Text style={[styles.dragOverlayName, { color: isDragging ? colors.primary : colors.text }]}>{exercise.name}</Text>
                                    
                                    {isReorderMode && (
                                         <MaterialIcons name="drag-handle" size={24} color={colors.textMuted} />
                                    )}
                                </TouchableOpacity>
                            </ScaleDecorator>
                        );
                    }

                    return (
                        <ScaleDecorator activeScale={1}>
                            <View key={exercise.id} style={styles.exerciseSection}>
                                {/* Exercise header */}
                                <View style={styles.exerciseHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.exerciseNameRow}>
                                            <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name.toUpperCase()}</Text>
                                            <TouchableOpacity
                                                style={styles.restPill}
                                                onPress={() => openKeypad('rest', exIndex)}
                                            >
                                                <MaterialIcons name="timer" size={10} color={colors.textMuted} />
                                                <Text style={styles.restPillText}>
                                                    {String(parseInt(exercise.restMin) || 0).padStart(2, '0')}:{String(parseInt(exercise.restSec) || 0).padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.exerciseMeta}>
                                            {exercise.equipment || 'Barbell'} • {exercise.muscleGroup || 'General'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ padding: 4, marginTop: 4 }}
                                        onPress={() => {
                                            setActionExIndex(exIndex);
                                            setActionModalVisible(true);
                                        }}
                                    >
                                        <MaterialIcons name="more-vert" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                        {/* Column headers */}
                        <View style={styles.colHeaders}>
                            <Text style={[styles.colHeader, { width: 36, textAlign: 'center', marginLeft: 4 }]}>SET</Text>
                            <Text style={[styles.colHeader, { flex: 1, paddingLeft: 8 }]}>PREVIOUS</Text>
                            <Text style={[styles.colHeader, { width: 58, textAlign: 'center' }]}>LBS</Text>
                            <Text style={[styles.colHeader, { width: 58, textAlign: 'center' }]}>REPS</Text>
                            <Text style={[styles.colHeader, { width: 38, textAlign: 'center' }]}>DONE</Text>
                        </View>

                        {/* Set rows */}
                        {exercise.sets.map((set, si) => {
                            const isActive = !set.completed && (si === 0 || exercise.sets[si - 1]?.completed);
                            return (
                                <View
                                    key={set.id}
                                    style={[
                                        styles.setRow,
                                        set.completed && styles.setRowCompleted,
                                        isActive && styles.setRowActive,
                                    ]}
                                >
                                    <Text style={[styles.setNum, set.completed && styles.setNumDone,
                                    isActive && styles.setNumActive]}>{set.setNum}</Text>

                                    <View style={styles.prevBadge}>
                                        <Text style={styles.prevText}>{set.prev || '—'}</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.inputCell, set.isPR && styles.inputCellPR]}
                                        onPress={() => openKeypad('weight', exIndex, set)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={[styles.inputText,
                                            isActive && styles.inputTextActive,
                                            set.completed && styles.inputTextDone,
                                            set.isPR && { color: '#000' } // Override text color when PR
                                            ]}>{set.weight || '0'}</Text>

                                            {/* PR Badge Celebration */}
                                            {set.isPR && (
                                                <View style={styles.prBadge}>
                                                    <Text style={styles.prBadgeText}>PR</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.inputCell}
                                        onPress={() => openKeypad('reps', exIndex, set)}
                                    >
                                        <Text style={[styles.inputText,
                                        set.completed && styles.inputTextDone,
                                        ]}>{set.reps || '0'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.checkWrap}
                                        onPress={() => toggleSet(exIndex, set.id)}
                                    >
                                        {set.completed ? (
                                            <View style={styles.checkFilled}>
                                                <MaterialIcons name="check" size={14} color={colors.textOnPrimary} />
                                            </View>
                                        ) : (
                                            <View style={[styles.checkEmpty, isActive && styles.checkEmptyActive]} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}

                        {/* Add/Remove set */}
                        <View style={styles.setActions}>
                            <TouchableOpacity onPress={() => removeSet(exIndex)}>
                                <Text style={styles.setActionText}>− Remove</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => addSet(exIndex)}>
                                <Text style={styles.setActionText}>＋ Add Set</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </ScaleDecorator>
                    );
                }}
                ListFooterComponent={<View style={{ height: 200 }} />}
            />

            {/* Rest Timer Popup — bottom right */}
            {restTimer !== null && (
                <View style={styles.restPopup}>
                    {/* Progress bar */}
                    <View style={styles.restProgressBar}>
                        <View style={[styles.restProgressFill, {
                            width: `${restDuration > 0 ? ((restDuration - restTimer) / restDuration) * 100 : 0}%`
                        }]} />
                    </View>
                    <View style={styles.restPopupBody}>
                        <View>
                            <Text style={styles.restPopupLabel}>RESTING</Text>
                            <Text style={styles.restPopupTime}>
                                {String(Math.floor(restTimer / 60)).padStart(2, '0')}:{String(restTimer % 60).padStart(2, '0')}
                            </Text>
                        </View>
                        <View style={styles.restPopupBtns}>
                            <TouchableOpacity style={styles.restPopupBtn} onPress={() => adjustRest(-15)}>
                                <Text style={styles.restPopupBtnText}>-15<Text style={{ fontSize: 7 }}>s</Text></Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.restPopupBtn} onPress={() => adjustRest(15)}>
                                <Text style={styles.restPopupBtnText}>+15<Text style={{ fontSize: 7 }}>s</Text></Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.restPopupBtn} onPress={skipRest}>
                                <Text style={[styles.restPopupBtnText, { color: colors.textSecondary }]}>Skip</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Bottom Bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
                <TouchableOpacity
                    style={styles.addExerciseBtn}
                    onPress={() => setShowExSearch(true)}
                >
                    <MaterialIcons name="add" size={18} color={colors.text} />
                    <Text style={styles.addExerciseText}>ADD EXERCISE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.discardBtn}
                    onPress={() => setShowDiscardModal(true)}
                >
                    <MaterialIcons name="delete-outline" size={18} color={colors.red500} />
                    <Text style={styles.discardBtnText}>DISCARD WORKOUT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                    <MaterialIcons name="check-circle" size={18} color={colors.textOnPrimary} />
                    <Text style={styles.finishBtnText}>FINISH WORKOUT</Text>
                </TouchableOpacity>
            </View>

            {/* Keypad */}
            <WeightKeypad
                visible={keypadVisible}
                onClose={() => setKeypadVisible(false)}
                initialValue={keypadInitVal}
                initialUnit={keypadInitUnit}
                onDone={handleKeypadDone}
                label={keypadLabel}
                showUnitToggle={keypadShowUnit}
            />

            {/* Custom Settings Modals */}
            <Modal transparent visible={showDiscardModal} animationType="fade" onRequestClose={() => setShowDiscardModal(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowDiscardModal(false)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.modalContent} pointerEvents="box-none">
                        <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                            <MaterialIcons name="delete-outline" size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.modalTitle}>Discard Workout</Text>
                        <Text style={styles.modalMsg}>Are you sure you want to discard this workout? Your progress will not be saved.</Text>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDiscardModal(false)}>
                                <Text style={styles.modalBtnCancelText}>Keep Going</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnConfirmDanger} onPress={executeDiscard}>
                                <Text style={styles.modalBtnConfirmTextDanger}>Discard</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showFinishModal} animationType="fade" onRequestClose={() => setShowFinishModal(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowFinishModal(false)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.modalContent} pointerEvents="box-none">
                        <View style={[styles.modalIconContainer, { backgroundColor: colors.primary + '18' }]}>
                            <MaterialIcons name="emoji-events" size={28} color={colors.primary} />
                        </View>
                        <Text style={styles.modalTitle}>Finish Workout</Text>
                        <Text style={styles.modalMsg}>You are about to complete the "{routine.name}" workout. Great job!</Text>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowFinishModal(false)}>
                                <Text style={styles.modalBtnCancelText}>Not Yet</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnConfirm} onPress={executeFinish}>
                                <Text style={styles.modalBtnConfirmText}>Finish Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Search Modal */}
            <ExerciseSearchModal
                visible={showExSearch}
                onClose={() => {
                    setShowExSearch(false);
                    setReplaceExIndex(null);
                }}
                onSelect={handleAddExercise}
            />

            {/* Exercise Action Modal (Bottom Sheet Replace/Remove) */}
            <ExerciseActionModal
                visible={actionModalVisible}
                onClose={() => {
                    setActionModalVisible(false);
                    setActionExIndex(null);
                }}
                onReplace={() => {
                    setActionModalVisible(false);
                    setReplaceExIndex(actionExIndex);
                    setShowExSearch(true);
                }}
                onRemove={handleRemoveExercise}
                title={actionExIndex !== null ? exerciseLogs[actionExIndex]?.name : 'Exercise'}
            />
        </View>
    );
}

const { width: SW } = Dimensions.get('window');

const getStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    minimizeBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.inputBg,
        alignItems: 'center', justifyContent: 'center',
    },
    headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
    headerTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.3, textTransform: 'uppercase' },
    headerSubtitle: { color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', letterSpacing: 1.5, textTransform: 'uppercase' },
    headerRight: { alignItems: 'flex-end' },
    totalTimeLabel: {
        color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2, textTransform: 'uppercase',
    },
    totalTimeValue: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    totalTimeSecs: { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' },

    // Content
    content: { paddingHorizontal: 16, paddingTop: 16 },

    // Exercise section
    exerciseSection: { marginBottom: 28 },
    exerciseHeader: { marginBottom: 10, paddingHorizontal: 4 },
    exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    exerciseName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.2, textTransform: 'uppercase' },
    exerciseMeta: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    
    // Minimal Drag Overlay specific styles
    dragOverlayRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16,
        marginBottom: 8, borderRadius: 12,
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { height: 2, width: 0 }
    },
    dragOverlayIconBadge: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: colors.inputBg,
        alignItems: 'center', justifyContent: 'center', marginRight: 16,
        borderWidth: 1, borderColor: colors.border
    },
    dragOverlayIconImg: { width: 38, height: 38, borderRadius: 19 },
    dragOverlayIconLetter: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    dragOverlayName: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', flex: 1 },

    restPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3,
        backgroundColor: colors.inputBg,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 4,
    },
    restPillText: { color: colors.textMuted, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'], letterSpacing: 0.8 },

    // Column headers
    colHeaders: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 4, marginBottom: 6,
    },
    colHeader: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Set rows
    setRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 10, padding: 8, marginBottom: 7,
    },
    setRowCompleted: {
        opacity: 0.55,
    },
    setRowActive: {
        backgroundColor: colors.cardBg,
        borderColor: colors.primary,
    },
    setNum: { width: 36, textAlign: 'center', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textMuted, fontVariant: ['tabular-nums'] },
    setNumDone: { color: colors.textSecondary },
    setNumActive: { color: colors.text },

    prevBadge: {
        flex: 1, backgroundColor: colors.inputBg,
        borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8,
    },
    prevText: { color: colors.textMuted, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] },

    inputCell: {
        width: 58, backgroundColor: colors.inputBg,
        borderRadius: 6, paddingVertical: 6, alignItems: 'center',
    },
    inputText: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] },
    inputTextActive: { color: colors.primary },
    inputTextDone: { color: colors.textSecondary },

    checkWrap: { width: 36, alignItems: 'flex-end', paddingRight: 2 },
    checkFilled: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    checkEmpty: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 2, borderColor: colors.borderLight,
    },
    checkEmptyActive: { borderColor: colors.border },

    // Set actions
    setActions: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingHorizontal: 4, paddingTop: 4,
    },
    setActionText: { color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // PR Badge Celebration
    inputCellPR: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        borderWidth: 1,
        shadowColor: colors.primary,
        shadowOpacity: 0.6,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
    },
    prBadge: {
        backgroundColor: colors.text,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
        marginLeft: 4,
    },
    prBadgeText: {
        color: colors.primary,
        fontSize: 8,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 0.5,
    },

    // Rest popup
    restPopup: {
        position: 'absolute', left: 16, right: 16, bottom: 210,
        backgroundColor: colors.bgCard,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 14, overflow: 'hidden', zIndex: 50,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 }, elevation: 10,
    },
    restProgressBar: {
        height: 2, backgroundColor: colors.inputBg, width: '100%',
    },
    restProgressFill: { height: '100%', backgroundColor: colors.primary },
    restPopupBody: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 10, gap: 8,
    },
    restPopupLabel: {
        color: colors.textSecondary, fontSize: 8, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2.5, textTransform: 'uppercase',
    },
    restPopupTime: {
        color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold',
        fontVariant: ['tabular-nums'], letterSpacing: -1.5, marginTop: 2,
    },
    restPopupBtns: { flexDirection: 'row', gap: 8 },
    restPopupBtn: {
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 8,
    },
    restPopupBtnText: { color: colors.text, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },

    // Bottom bar
    bottomBar: {
        paddingHorizontal: 16, paddingTop: 8,
        backgroundColor: colors.bg,
    },
    addExerciseBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.bgCard,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 14, paddingVertical: 12, marginBottom: 8,
    },
    addExerciseText: {
        color: colors.text,
        fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.8,
    },
    discardBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.bgCard,
        borderWidth: 1, borderColor: colors.red500 + '33',
        borderRadius: 14, paddingVertical: 12, marginBottom: 8,
    },
    discardBtnText: {
        color: colors.red500,
        fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.8,
    },
    finishBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.primary,
        borderRadius: 14, paddingVertical: 12,
        shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    finishBtnText: {
        color: colors.textOnPrimary,
        fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.8,
    },

    // Modals
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.bg,
        borderRadius: 24, padding: 24,
        alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    modalIconContainer: {
        width: 64, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', color: colors.text,
        marginBottom: 8, textAlign: 'center', letterSpacing: -0.5,
    },
    modalMsg: {
        fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium', color: colors.textMuted,
        textAlign: 'center', marginBottom: 24, lineHeight: 20,
    },
    modalBtns: { width: '100%', gap: 12 },
    modalBtnCancel: {
        width: '100%', paddingVertical: 16, borderRadius: 16,
        backgroundColor: colors.bgCard,
        alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    modalBtnCancelText: { color: colors.textSecondary, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    modalBtnConfirm: {
        width: '100%', paddingVertical: 16, borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    modalBtnConfirmText: { color: colors.textOnPrimary, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    modalBtnConfirmDanger: {
        width: '100%', paddingVertical: 16, borderRadius: 16,
        backgroundColor: colors.red500,
        alignItems: 'center', shadowColor: colors.red500, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    modalBtnConfirmTextDanger: { color: '#fff', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
});
