import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
    FlatList, Image, ActivityIndicator, Platform, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { searchExercises, getExercisesByCategory, BODY_PART_FILTERS, MUSCLE_GROUP_MAP } from '../services/exerciseDB';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = '@recent_exercises';

// Popular exercises (shown immediately, no search needed)
const POPULAR_EXERCISES = [
    { id: 'pop_1', name: 'Bench Press (Barbell)', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell', gifUrl: '' },
    { id: 'pop_2', name: 'Squat (Barbell)', bodyPart: 'quadriceps', target: 'quads', equipment: 'barbell', gifUrl: '' },
    { id: 'pop_3', name: 'Deadlift (Conventional)', bodyPart: 'hamstrings', target: 'spine', equipment: 'barbell', gifUrl: '' },
    { id: 'pop_4', name: 'Overhead Press', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell', gifUrl: '' },
    { id: 'pop_5', name: 'Incline Dumbbell Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: '' },
    { id: 'pop_6', name: 'Cable Row (Seated)', bodyPart: 'upper back', target: 'upper back', equipment: 'cable', gifUrl: '' },
    { id: 'pop_7', name: 'Pull-ups', bodyPart: 'lats', target: 'lats', equipment: 'body weight', gifUrl: '' },
    { id: 'pop_8', name: 'Lat Pulldown', bodyPart: 'lats', target: 'lats', equipment: 'cable', gifUrl: '' },
    { id: 'pop_9', name: 'Lateral Raises', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: '' },
    { id: 'pop_10', name: 'Bicep Curls', bodyPart: 'biceps', target: 'biceps', equipment: 'dumbbell', gifUrl: '' },
    { id: 'pop_11', name: 'Tricep Pushdown', bodyPart: 'triceps', target: 'triceps', equipment: 'cable', gifUrl: '' },
    { id: 'pop_12', name: 'Leg Press', bodyPart: 'quadriceps', target: 'quads', equipment: 'machine', gifUrl: '' },
    { id: 'pop_13', name: 'Romanian Deadlift', bodyPart: 'hamstrings', target: 'hamstrings', equipment: 'barbell', gifUrl: '' },
    { id: 'pop_14', name: 'Dumbbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: '' },
    { id: 'pop_15', name: 'Face Pulls', bodyPart: 'shoulders', target: 'rear delts', equipment: 'cable', gifUrl: '' },
];

// Icon letter from exercise name
const getIconLetter = (name) => {
    const words = name.split(' ');
    return words[0]?.[0]?.toUpperCase() || 'E';
};

// Muscle groups text from bodyPart + target
const getMuscleText = (ex) => {
    const parts = [];
    if (ex.bodyPart) parts.push(ex.bodyPart.charAt(0).toUpperCase() + ex.bodyPart.slice(1));
    if (ex.target && ex.target !== ex.bodyPart) parts.push(ex.target.charAt(0).toUpperCase() + ex.target.slice(1));
    return parts.join(', ') || 'General';
};

export default function ExerciseSearchModal({ visible, onClose, onSelect }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const insets = useSafeAreaInsets();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [showCustom, setShowCustom] = useState(false);
    const [customName, setCustomName] = useState('');
    const [recentExercises, setRecentExercises] = useState([]);

    useEffect(() => {
        if (visible) {
            setQuery('');
            setResults([]);
            setFilter('all');
            setShowCustom(false);
            setCustomName('');
            loadRecent();
            setKeyboardHeight(0);
        }
    }, [visible]);

    // Track keyboard height to adjust layout
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0)
        );
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const loadRecent = async () => {
        try {
            const data = await AsyncStorage.getItem(RECENT_KEY);
            if (data) setRecentExercises(JSON.parse(data));
        } catch { }
    };

    const saveRecent = async (exercise) => {
        try {
            let recent = [...recentExercises];
            recent = recent.filter(e => e.name !== exercise.name);
            recent.unshift(exercise);
            if (recent.length > 10) recent = recent.slice(0, 10);
            await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent));
        } catch { }
    };

    const handleSearch = async (text) => {
        setQuery(text);
        if (text.trim().length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const data = await searchExercises(text.trim(), 30);

            // Map the overarching broad `filter` key (e.g. 'arms') to explicit muscle substrings (e.g. ['biceps', 'triceps'])
            const allowedMuscles = filter === 'all' ? [] : (MUSCLE_GROUP_MAP[filter] || []);

            const filtered = filter === 'all'
                ? data
                : data.filter(ex => allowedMuscles.includes(ex.bodyPart?.toLowerCase()));
            setResults(filtered);
        } catch { setResults([]); }
        setLoading(false);
    };

    const handleFilterChange = async (key) => {
        setFilter(key);

        // If they have an active search query, filter the search query list natively
        if (query.trim().length >= 2) {
            setLoading(true);
            const data = await searchExercises(query.trim(), 40);
            const allowedMuscles = key === 'all' ? [] : (MUSCLE_GROUP_MAP[key] || []);
            const filtered = key === 'all'
                ? data
                : data.filter(ex => allowedMuscles.includes(ex.bodyPart?.toLowerCase()));
            setResults(filtered);
            setLoading(false);
        } else {
            // Otherwise, populate the screen with all offline exercises natively located in that category mapped block
            if (key === 'all') {
                setResults([]);
            } else {
                setLoading(true);
                const block = await getExercisesByCategory(key, 40);
                setResults(block);
                setLoading(false);
            }
        }
    };

    const handleSelectExercise = (exercise) => {
        const selected = {
            name: exercise.name,
            bodyPart: exercise.bodyPart || '',
            target: exercise.target || '',
            equipment: exercise.equipment || '',
            gifUrl: exercise.gifUrl || '',
        };
        saveRecent(selected);
        onSelect(selected);
        onClose();
    };

    const handleCreateCustom = () => {
        if (!customName.trim()) return;
        const custom = {
            name: customName.trim(),
            bodyPart: '', target: '', equipment: '', gifUrl: '', isCustom: true,
        };
        saveRecent(custom);
        onSelect(custom);
        onClose();
    };

    // Get display list: search results, category block, or popular
    const getDisplayList = () => {
        if (query.length >= 2 || filter !== 'all') return results;
        return POPULAR_EXERCISES;
    };

    const displayList = getDisplayList();

    // Filter the Recents cache row using the mapped broad groups
    const allowedRecentsMuscles = filter === 'all' ? [] : (MUSCLE_GROUP_MAP[filter] || []);
    const filteredRecent = filter === 'all' ? recentExercises
        : recentExercises.filter(ex => allowedRecentsMuscles.includes(ex.bodyPart?.toLowerCase()));

    const showRecent = query.length < 2 && filteredRecent.length > 0;
    const sectionTitle = query.length >= 2 || filter !== 'all' ? 'RESULTS' : 'POPULAR EXERCISES';

    const renderExercise = ({ item }) => (
        <TouchableOpacity style={styles.resultCard} onPress={() => handleSelectExercise(item)}>
            <View style={styles.iconBadge}>
                {item.gifUrl ? (
                    <Image source={{ uri: item.gifUrl }} style={styles.iconImg} resizeMode="cover" />
                ) : (
                    <Text style={styles.iconLetter}>{getIconLetter(item.name)}</Text>
                )}
            </View>
            <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.exerciseMuscles}>{getMuscleText(item)}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => handleSelectExercise(item)}>
                <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <View style={[styles.container, { paddingTop: insets.top }]} pointerEvents="box-none">
                    {/* Pull Handle */}
                    <View style={styles.pullHandle}><View style={styles.pullBar} /></View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Exercise</Text>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchRow}>
                        <View style={styles.searchContainer}>
                            <Text style={styles.searchIcon}>Q</Text>
                            <TextInput
                                style={styles.searchInput}
                                value={query}
                                onChangeText={handleSearch}
                                placeholder="Search exercises..."
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>
                    </View>

                    {/* Filter Chips — fixed, never shrinks */}
                    <View style={styles.filterWrapper}>
                        <FlatList
                            data={BODY_PART_FILTERS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.key}
                            contentContainerStyle={styles.filterRow}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
                                    onPress={() => handleFilterChange(item.key)}
                                >
                                    <Text style={[styles.filterLabel, filter === item.key && styles.filterLabelActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>

                    {/* Results — this is the only part that flexes */}
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={styles.loadingText}>Searching exercises...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={displayList}
                            keyExtractor={(item, i) => `${item.id || 'ex'}_${i}`}
                            renderItem={renderExercise}
                            contentContainerStyle={[styles.resultsList, { paddingBottom: Math.max(100, keyboardHeight + 20) }]}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            ListHeaderComponent={
                                <>
                                    {showRecent && (
                                        <>
                                            <Text style={styles.sectionLabel}>RECENTLY USED</Text>
                                            {filteredRecent.map((item, i) => (
                                                <TouchableOpacity key={'r_' + i} style={styles.resultCard} onPress={() => handleSelectExercise(item)}>
                                                    <View style={styles.iconBadge}>
                                                        <Text style={styles.iconLetter}>{getIconLetter(item.name)}</Text>
                                                    </View>
                                                    <View style={styles.exerciseInfo}>
                                                        <Text style={styles.exerciseName} numberOfLines={1}>{item.name}</Text>
                                                        <Text style={styles.exerciseMuscles}>{getMuscleText(item)}</Text>
                                                    </View>
                                                    <TouchableOpacity style={styles.addBtn} onPress={() => handleSelectExercise(item)}>
                                                        <Text style={styles.addBtnText}>+</Text>
                                                    </TouchableOpacity>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}
                                    <Text style={styles.sectionLabel}>{sectionTitle}</Text>
                                </>
                            }
                            ListEmptyComponent={
                                query.length >= 2 && !loading ? (
                                    <View style={styles.emptyBox}>
                                        <Text style={styles.emptyText}>No exercises found</Text>
                                        <Text style={styles.emptyHint}>Try a different search or create a custom exercise</Text>
                                    </View>
                                ) : null
                            }
                        />
                    )}

                    {/* Create Custom Exercise — hides when keyboard is up */}
                    {keyboardHeight === 0 && (
                        <View style={styles.bottomArea}>
                            {showCustom ? (
                                <View style={styles.customRow}>
                                    <TextInput
                                        style={styles.customInput}
                                        value={customName}
                                        onChangeText={setCustomName}
                                        placeholder="Custom exercise name..."
                                        placeholderTextColor={colors.textSecondary}
                                        autoFocus
                                    />
                                    <TouchableOpacity style={styles.customAddBtn} onPress={handleCreateCustom}>
                                        <Text style={styles.customAddText}>Add</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.createBtn} onPress={() => setShowCustom(true)}>
                                    <Text style={styles.createBtnText}>+ Create Custom Exercise</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    container: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: 40, overflow: 'hidden' },
    pullHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    pullBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
    },
    headerTitle: { color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    closeBtn: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    closeBtnText: { color: colors.textSecondary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    searchRow: { paddingHorizontal: 20, marginBottom: 12 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
    searchIcon: { color: colors.textSecondary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginRight: 8 },
    searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },

    filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
    filterChip: {
        height: 36, paddingHorizontal: 20, borderRadius: 18,
        backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary },
    filterLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', lineHeight: 18 },
    filterLabelActive: { color: '#000', fontFamily: 'SpaceGrotesk_700Bold' },

    resultsList: { paddingHorizontal: 20, paddingBottom: 100 },

    filterWrapper: { flexShrink: 0 },
    sectionLabel: {
        color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 8,
    },

    resultCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 12,
        marginBottom: 6, borderWidth: 1, borderColor: colors.border,
    },
    iconBadge: {
        width: 48, height: 48, minWidth: 48, minHeight: 48, borderRadius: 12,
        backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    iconImg: { width: 48, height: 48, borderRadius: 12 },
    iconLetter: { color: colors.primary, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    exerciseInfo: { flex: 1, flexShrink: 1 },
    exerciseName: { color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 2 },
    exerciseMuscles: { color: colors.textSecondary, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: {
        width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    addBtnText: { color: '#000', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', marginTop: -1 },

    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
    loadingText: { color: colors.textSecondary, fontSize: 13 },

    emptyBox: { alignItems: 'center', paddingTop: 40, gap: 6 },
    emptyText: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    emptyHint: { color: colors.textSecondary, fontSize: 13 },

    bottomArea: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
    createBtn: {
        backgroundColor: colors.bgCard, borderRadius: 14, paddingVertical: 14,
        alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    },
    createBtnText: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    customRow: { flexDirection: 'row', gap: 8 },
    customInput: {
        flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border,
    },
    customAddBtn: {
        backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20,
        alignItems: 'center', justifyContent: 'center',
    },
    customAddText: { color: '#000', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
});
