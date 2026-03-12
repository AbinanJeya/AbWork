import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
    KeyboardAvoidingView, Platform, Image, Vibration,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { addRoutine, updateRoutine, getSettings } from '../services/storage';
import ExerciseSearchModal from '../components/ExerciseSearchModal';
import ExerciseActionModal from '../components/ExerciseActionModal';
import WeightKeypad from '../components/WeightKeypad';
import RestTimerPicker from '../components/RestTimerPicker';
import { MaterialIcons } from '@expo/vector-icons';

// Icon letter from exercise name
const getIconLetter = (name) => {
    const words = name.split(' ');
    return words[0]?.[0]?.toUpperCase() || 'E';
};

export default function CreateRoutineScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();

    const editRoutine = route.params?.editRoutine;

    const [name, setName] = useState(editRoutine?.name || '');
    const [exercises, setExercises] = useState(editRoutine?.exercises?.map(ex => {
        let setsArray = [];
        if (Array.isArray(ex.sets)) {
            // New structure: literal array of set definitions
            setsArray = ex.sets;
        } else {
            // Legacy structure migration
            const numSets = parseInt(ex.sets) || 3;
            setsArray = Array.from({ length: numSets }, (_, i) => ({
                id: `${Date.now()}-${i}-${Math.random()}`,
                setNum: i + 1,
                reps: String(ex.reps || '10'),
                weight: String(ex.weight || '0'),
            }));
        }

        return {
            ...ex,
            sets: setsArray,
            id: ex.id || Date.now().toString() + Math.random()
        };
    }) || []);
    const [showSearch, setShowSearch] = useState(false);

    // Weight keypad state
    const [weightKeypadVisible, setWeightKeypadVisible] = useState(false);
    const [weightKeypadExId, setWeightKeypadExId] = useState(null);
    const [weightKeypadSetId, setWeightKeypadSetId] = useState(null);
    const [weightUnit, setWeightUnit] = useState('LBS');

    // Rest timer state
    const [restPickerVisible, setRestPickerVisible] = useState(false);
    const [restPickerExId, setRestPickerExId] = useState(null);

    // Action menu state
    const [menuExId, setMenuExId] = useState(null);
    const [replaceExId, setReplaceExId] = useState(null);

    const [baseRestTimer, setBaseRestTimer] = useState(60);

    React.useEffect(() => {
        getSettings().then(s => {
            const baseTimer = s.baseRestTimer !== undefined ? s.baseRestTimer : 60;
            setBaseRestTimer(baseTimer);

            // Enforce floor on existing loaded exercises
            if (editRoutine?.exercises) {
                setExercises(prev => prev.map(ex => {
                    const parts = (ex.restTime || '01:30').split(':');
                    const exSecs = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
                    if (exSecs < baseTimer) {
                        return {
                            ...ex,
                            restTime: `${String(Math.floor(baseTimer / 60)).padStart(2, '0')}:${String(baseTimer % 60).padStart(2, '0')}`
                        };
                    }
                    return ex;
                }));
            }
        });
    }, [editRoutine]);

    const addExercise = (exerciseData) => {
        const defaultSecs = Math.max(90, baseRestTimer);
        const formattedRest = `${String(Math.floor(defaultSecs / 60)).padStart(2, '0')}:${String(defaultSecs % 60).padStart(2, '0')}`;
        
        const defaultSets = Array.from({ length: 3 }, (_, i) => ({
            id: `${Date.now()}-${i}`,
            setNum: i + 1,
            reps: '10',
            weight: '0'
        }));

        setExercises(prev => [...prev, {
            id: Date.now().toString(),
            name: exerciseData?.name || '',
            sets: defaultSets,
            restTime: formattedRest,
            bodyPart: exerciseData?.bodyPart || '',
            target: exerciseData?.target || '',
            equipment: exerciseData?.equipment || '',
            gifUrl: exerciseData?.gifUrl || '',
            isCustom: exerciseData?.isCustom || false
        }]);
    };

    const addSet = (exId) => {
        setExercises(prev => prev.map(ex => {
            if (ex.id !== exId) return ex;
            const newSetNum = ex.sets.length + 1;
            const lastSet = ex.sets[ex.sets.length - 1];
            return {
                ...ex,
                sets: [...ex.sets, {
                    id: Date.now().toString() + Math.random(),
                    setNum: newSetNum,
                    reps: lastSet ? lastSet.reps : '10',
                    weight: lastSet ? lastSet.weight : '0'
                }]
            };
        }));
    };

    const removeSet = (exId) => {
        setExercises(prev => prev.map(ex => {
            if (ex.id !== exId || ex.sets.length <= 1) return ex;
            return {
                ...ex,
                sets: ex.sets.slice(0, -1)
            };
        }));
    };

    const updateSetField = (exId, setId, field, value) => {
        setExercises(prev => prev.map(ex => {
            if (ex.id !== exId) return ex;
            return {
                ...ex,
                sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
            };
        }));
    };

    const updateExercise = (id, field, value) => {
        setExercises(prev => prev.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
    };

    const removeExercise = (id) => {
        setExercises(prev => prev.filter(ex => ex.id !== id));
        setMenuExId(null);
    };

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Error', 'Routine name is required.'); return; }
        if (exercises.length === 0) { Alert.alert('Error', 'Add at least one exercise.'); return; }
        const invalid = exercises.find(ex => !ex.name.trim());
        if (invalid) { Alert.alert('Error', 'All exercises must have a name.'); return; }

        const payload = {
            name: name.trim(),
            exercises: exercises.map(ex => ({
                name: ex.name.trim(),
                sets: ex.sets, // Already array mapping
                restTime: ex.restTime || '01:30',
                bodyPart: ex.bodyPart || '',
                target: ex.target || '',
                equipment: ex.equipment || '',
                isCustom: ex.isCustom || false
            })),
        };

        if (editRoutine) {
            await updateRoutine(editRoutine.id, payload);
        } else {
            await addRoutine(payload);
        }

        navigation.goBack();
    };

    const openWeightKeypad = (exId) => {
        const ex = exercises.find(e => e.id === exId);
        setWeightKeypadExId(exId);
        setWeightKeypadVisible(true);
    };

    const openRestPicker = (exId) => {
        setRestPickerExId(exId);
        setRestPickerVisible(true);
    };

    const handleReplace = (exId) => {
        setMenuExId(null);
        setReplaceExId(exId);
        setShowSearch(true);
    };

    const handleRename = (exId) => {
        setMenuExId(null);
        Alert.prompt && Alert.prompt(
            'Edit Exercise',
            'Enter new name:',
            (text) => { if (text?.trim()) updateExercise(exId, 'name', text.trim()); },
            'plain-text',
            exercises.find(ex => ex.id === exId)?.name || ''
        );
    };

    const getMuscleText = (ex) => {
        const parts = [];
        if (ex.bodyPart) parts.push(ex.bodyPart.toUpperCase());
        if (ex.target && ex.target.toUpperCase() !== ex.bodyPart?.toUpperCase()) {
            parts.push(ex.target.toUpperCase());
        }
        return parts.join(', ') || '';
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{editRoutine ? 'Edit Routine' : 'Create Routine'}</Text>
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                </View>

                {/* Routine Name */}
                <DraggableFlatList
                    data={exercises}
                    onDragBegin={() => Vibration.vibrate(40)}
                    onPlaceholderIndexChange={() => Vibration.vibrate(15)}
                    onDragEnd={({ data }) => setExercises(data)}
                    keyExtractor={(ex) => ex.id}
                    containerStyle={{ flex: 1 }}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={[styles.nameRow, { marginBottom: 16 }]}>
                            <TextInput
                                style={styles.nameInput}
                                value={name}
                                onChangeText={setName}
                                placeholder='Routine Name'
                                placeholderTextColor='#3f3f46'
                            />
                            <Text style={styles.editPen}>E</Text>
                        </View>
                    }
                    ListFooterComponent={
                        <>
                            <TouchableOpacity style={styles.addExerciseBtn} onPress={() => { setReplaceExId(null); setShowSearch(true); }}>
                                <Text style={styles.addIcon}>+</Text>
                                <Text style={styles.addExerciseText}>ADD EXERCISE</Text>
                            </TouchableOpacity>
                            <View style={{ height: 120 }} />
                        </>
                    }
                    renderItem={({ item: ex, drag, isActive }) => (
                            <ScaleDecorator activeScale={1}>
                                <View key={ex.id} style={[styles.exerciseCard, isActive && { opacity: 0.8, transform: [{ scale: 1.02 }] }]}>
                                    {/* Card Header */}
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardHeaderLeft}>
                                            <View style={styles.iconBadge}>
                                                {ex.gifUrl ? (
                                                    <Image source={{ uri: ex.gifUrl }} style={styles.iconImg} />
                                                ) : (
                                                    <Text style={styles.iconLetter}>{getIconLetter(ex.name || 'E')}</Text>
                                                )}
                                            </View>
                                            <TouchableOpacity 
                                                style={{ flex: 1 }}
                                                onPress={() => {
                                                    if (ex.isCustom) {
                                                        handleRename(ex.id);
                                                    } else {
                                                        Alert.alert('Cannot Rename', 'Standard database exercises cannot be renamed. Try creating a custom exercise instead.');
                                                    }
                                                }}
                                            >
                                                <Text style={styles.exerciseName} numberOfLines={1}>{ex.name || 'Untitled'}</Text>
                                                {getMuscleText(ex) ? (
                                                    <Text style={styles.muscleLabel}>{getMuscleText(ex)}</Text>
                                                ) : null}
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.cardActions}>
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => setMenuExId(menuExId === ex.id ? null : ex.id)}>
                                                <Text style={styles.dotsText}>...</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.dragHandle}
                                                onLongPress={drag}
                                                delayLongPress={100}
                                                disabled={isActive}
                                            >
                                                <MaterialIcons name="drag-indicator" size={24} color={colors.textSecondary || '#a1a1aa'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                            {/* Removed inline dropdown here. Handled by global bottom sheet */}

                            {/* Sets Container */}
                            <View style={styles.setsContainer}>
                                {/* Rest Timer Row (Moved to bottom) */}

                                {/* Set Table Headers */}
                                <View style={styles.setRowHeader}>
                                    <Text style={[styles.setColHeader, { flex: 0.5 }]}>SET</Text>
                                    <Text style={[styles.setColHeader, { flex: 1 }]}>LBS</Text>
                                    <Text style={[styles.setColHeader, { flex: 1 }]}>REPS</Text>
                                    <View style={{ width: 24 }} />
                                </View>

                                {/* Set Rows */}
                                {(ex.sets || []).map((set, setIndex) => (
                                    <View key={set.id} style={styles.setRow}>
                                        <Text style={[styles.setCellText, { flex: 0.5, color: colors.textSecondary }]}>{setIndex + 1}</Text>
                                        <TouchableOpacity 
                                            style={[styles.setCellBox, { flex: 1 }]}
                                            onPress={() => openWeightKeypad(ex.id, set.id)}
                                        >
                                            <Text style={[styles.setCellText, { color: colors.primary }]}>{set.weight || '-'}</Text>
                                        </TouchableOpacity>
                                        <View style={[styles.setCellBox, { flex: 1 }]}>
                                            <TextInput
                                                style={[styles.setCellText, { width: '100%', textAlign: 'center' }]}
                                                value={set.reps}
                                                onChangeText={v => updateSetField(ex.id, set.id, 'reps', v)}
                                                keyboardType="numeric"
                                                placeholderTextColor={colors.textSecondary}
                                            />
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.deleteSetBtn}
                                            onPress={() => removeSet(ex.id)}
                                            disabled={(ex.sets || []).length <= 1}
                                        >
                                            <MaterialIcons 
                                                name="remove-circle-outline" 
                                                size={20} 
                                                color={(ex.sets || []).length > 1 ? (isDark ? colors.white : colors.text) : colors.textMuted} 
                                            />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {/* Exercise Actions (Rest Timer + Add Set) */}
                                <View style={styles.actionRow}>
                                    <TouchableOpacity 
                                        style={styles.restTimerPill}
                                        onPress={() => openRestPicker(ex.id)}
                                    >
                                        <MaterialIcons name="timer" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                        <Text style={styles.restPillLabel}>Rest:</Text>
                                        <Text style={styles.restPillValue}>{ex.restTime || '01:30'}</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
                                        <MaterialIcons name="add" size={18} color={colors.primary} />
                                        <Text style={styles.addSetText}>Add Set</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                                </View>
                            </ScaleDecorator>
                        )}
                    />

                    {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.discardBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.discardText}>Discard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.startBtn} onPress={handleSave}>
                        <Text style={styles.startBtnText}>{editRoutine ? 'Save Routine' : 'Start Workout'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modals */}
            <ExerciseSearchModal
                visible={showSearch}
                onClose={() => { setShowSearch(false); setReplaceExId(null); }}
                onSelect={(ex) => {
                    if (replaceExId) {
                        // Replace existing exercise, keep sets/reps/weight/rest
                        setExercises(prev => prev.map(e => e.id === replaceExId ? {
                            ...e,
                            name: ex.name,
                            bodyPart: ex.bodyPart || '',
                            target: ex.target || '',
                            equipment: ex.equipment || '',
                            gifUrl: ex.gifUrl || '',
                        } : e));
                        setReplaceExId(null);
                    } else {
                        addExercise(ex);
                    }
                    setShowSearch(false);
                }}
            />

            {/* Exercise Action Modal (Bottom Sheet Replace/Remove/Move) */}
            <ExerciseActionModal
                visible={menuExId !== null}
                onClose={() => setMenuExId(null)}
                title={menuExId !== null ? exercises.find(e => e.id === menuExId)?.name : 'Exercise'}
                showEdit={false}
                onReplace={() => handleReplace(menuExId)}
                onRemove={() => removeExercise(menuExId)}
            />

            <WeightKeypad
                visible={weightKeypadVisible}
                onClose={() => setWeightKeypadVisible(false)}
                initialValue={weightKeypadExId && weightKeypadSetId ? exercises.find(e => e.id === weightKeypadExId)?.sets?.find(s => s.id === weightKeypadSetId)?.weight || '' : ''}
                initialUnit={weightUnit}
                onDone={(val, unit) => {
                    if (weightKeypadExId && weightKeypadSetId) updateSetField(weightKeypadExId, weightKeypadSetId, 'weight', val);
                    setWeightUnit(unit);
                    setWeightKeypadVisible(false);
                }}
            />

            <RestTimerPicker
                visible={restPickerVisible}
                onClose={() => setRestPickerVisible(false)}
                initialValue={exercises.find(e => e.id === restPickerExId)?.restTime || '01:30'}
                onDone={(formatted) => {
                    if (restPickerExId) updateExercise(restPickerExId, 'restTime', formatted);
                    setRestPickerVisible(false);
                }}
            />
        </KeyboardAvoidingView>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    saveBtn: {
        backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8,
        borderRadius: 20,
    },
    saveBtnText: { color: '#000', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },

    // Routine Name
    nameRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    nameInput: { flex: 1, color: colors.text, fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },
    editPen: { color: colors.textSecondary, fontSize: 12 },

    content: { paddingHorizontal: 16, paddingTop: 16 },

    // Exercise Card
    exerciseCard: {
        backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
        borderRadius: 16, padding: 12, marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 12,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    iconBadge: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    iconImg: { width: 32, height: 32, borderRadius: 8 },
    iconLetter: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    exerciseName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', maxWidth: 200 },
    muscleLabel: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 1 },

    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    dragHandle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    dotsText: { color: colors.textSecondary, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, marginTop: -6 },

    // Action Menu Dropdown
    menuDropdown: {
        backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10,
        overflow: 'hidden',
    },
    menuItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    menuItemText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Sets Layout
    setsContainer: { marginTop: 12 },

    setRowHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
    setColHeader: { textAlign: 'center', color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
    
    setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4, gap: 12 },
    setCellBox: { backgroundColor: colors.inputBg, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    setCellText: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', textAlign: 'center' },
    
    deleteSetBtn: { width: 24, alignItems: 'center', justifyContent: 'center' },
    
    // Exercise Action Row (Rest Timer + Add Set)
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
    
    restTimerPill: { 
        flexDirection: 'row', alignItems: 'center', 
        backgroundColor: colors.inputBg,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 10 
    },
    restPillLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', marginRight: 6 },
    restPillValue: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    addSetBtn: { 
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: colors.primaryDim,
        borderWidth: 1, borderColor: colors.primaryMid,
        borderRadius: 16, paddingVertical: 12 
    },
    addSetText: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

    // Add Exercise Button
    addExerciseBtn: {
        paddingVertical: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
        borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 4,
    },
    addIcon: { color: colors.textSecondary, fontSize: 20 },
    addExerciseText: { color: colors.textSecondary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2 },

    // Bottom Bar
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32,
        flexDirection: 'row', gap: 10,
        backgroundColor: colors.bg,
        borderTopWidth: 0,
    },
    discardBtn: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 14,
        paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    },
    discardText: { color: colors.textSecondary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    startBtn: {
        flex: 2, backgroundColor: colors.primary, borderRadius: 14,
        paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    },
    startBtnText: { color: '#000', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
});
