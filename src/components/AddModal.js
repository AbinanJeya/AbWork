import React, { useState } from 'react';
import {
    View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, TouchableWithoutFeedback
} from 'react-native';
import { useTheme } from '../theme';
import { searchFoodDatabase } from '../services/openai';
import { getSettings } from '../services/storage';

const WORKOUT_TYPES = [
    { key: 'run', label: '🏃 Run' },
    { key: 'strength', label: 'Strength' },
    { key: 'cardio', label: '🫀 Cardio' },
    { key: 'yoga', label: '🧘 Yoga' },
    { key: 'cycling', label: '🚴 Cycling' },
    { key: 'swimming', label: '🏊 Swimming' },
];

export function AddMealModal({ visible, onClose, onAdd }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        const settings = await getSettings();
        const result = await searchFoodDatabase(searchQuery, settings);
        setIsSearching(false);

        if (result) {
            setName(result.name);
            setCalories(String(result.calories));
            setProtein(String(result.protein));
            setCarbs(String(result.carbs));
            setFat(String(result.fat));
        } else {
            Alert.alert("Search Failed", "Could not find nutrition info. Check your API key or enter manually.");
        }
    };

    const handleAdd = () => {
        if (!name || !calories) return;
        onAdd({
            name,
            calories: parseInt(calories) || 0,
            protein: parseInt(protein) || 0,
            carbs: parseInt(carbs) || 0,
            fat: parseInt(fat) || 0,
        });
        setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetContainer} pointerEvents="box-none">
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <Text style={styles.title}>Log Meal</Text>

                        {/* AI Search Bar */}
                        <View style={styles.searchRow}>
                            <TextInput
                                style={[styles.input, styles.flex1, { marginBottom: 0 }]}
                                placeholder="AI Search (e.g. 2 eggs)"
                                placeholderTextColor={colors.slate500}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={isSearching}>
                                {isSearching ? <ActivityIndicator size="small" color={colors.bgDark} /> : <Text style={styles.searchBtnText}>🔍</Text>}
                            </TouchableOpacity>
                        </View>
                        <View style={styles.divider} />

                        <TextInput style={styles.input} placeholder="Meal name" placeholderTextColor={colors.slate500} value={name} onChangeText={setName} />
                        <TextInput style={styles.input} placeholder="Calories (kcal)" placeholderTextColor={colors.slate500} value={calories} onChangeText={setCalories} keyboardType="numeric" />

                        <View style={styles.row3}>
                            <TextInput style={[styles.input, styles.flex1]} placeholder="Protein (g)" placeholderTextColor={colors.slate500} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                            <TextInput style={[styles.input, styles.flex1]} placeholder="Carbs (g)" placeholderTextColor={colors.slate500} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                            <TextInput style={[styles.input, styles.flex1]} placeholder="Fat (g)" placeholderTextColor={colors.slate500} value={fat} onChangeText={setFat} keyboardType="numeric" />
                        </View>

                        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                            <Text style={styles.addBtnText}>+ Add Meal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

export function AddWorkoutModal({ visible, onClose, onAdd }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [name, setName] = useState('');
    const [duration, setDuration] = useState('');
    const [caloriesBurned, setCaloriesBurned] = useState('');
    const [type, setType] = useState('strength');
    const [time, setTime] = useState('');

    const handleAdd = () => {
        if (!name) return;
        onAdd({
            name,
            duration: parseInt(duration) || 0,
            caloriesBurned: parseInt(caloriesBurned) || 0,
            type,
            time: time || 'Anytime',
        });
        setName(''); setDuration(''); setCaloriesBurned(''); setTime('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetContainer} pointerEvents="box-none">
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <Text style={styles.title}>Log Workout</Text>

                        <TextInput style={styles.input} placeholder="Workout name" placeholderTextColor={colors.slate500} value={name} onChangeText={setName} />

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                            {WORKOUT_TYPES.map((t) => (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.typeChip, type === t.key && styles.typeChipActive]}
                                    onPress={() => setType(t.key)}
                                >
                                    <Text style={[styles.typeChipText, type === t.key && styles.typeChipTextActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.row2}>
                            <TextInput style={[styles.input, styles.flex1]} placeholder="Duration (mins)" placeholderTextColor={colors.slate500} value={duration} onChangeText={setDuration} keyboardType="numeric" />
                            <TextInput style={[styles.input, styles.flex1]} placeholder="Calories burned" placeholderTextColor={colors.slate500} value={caloriesBurned} onChangeText={setCaloriesBurned} keyboardType="numeric" />
                        </View>

                        <TextInput style={styles.input} placeholder="Time (e.g. 07:00 AM)" placeholderTextColor={colors.slate500} value={time} onChangeText={setTime} />

                        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                            <Text style={styles.addBtnText}>+ Log Workout</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheetContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        borderWidth: 1,
        borderColor: colors.border,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.slate500,
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.white,
        marginBottom: 20,
    },
    input: {
        backgroundColor: colors.bgCard,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: colors.white,
        fontSize: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    row2: { flexDirection: 'row', gap: 12 },
    row3: { flexDirection: 'row', gap: 8 },
    flex1: { flex: 1 },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    searchBtn: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        width: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBtnText: {
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: 16,
    },
    typeScroll: {
        marginBottom: 12,
    },
    typeChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: colors.bgCard,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    typeChipActive: {
        backgroundColor: colors.primaryDim,
        borderColor: colors.primary,
    },
    typeChipText: {
        color: colors.slate400,
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    typeChipTextActive: {
        color: colors.primary,
    },
    addBtn: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    addBtnText: {
        color: colors.bgDark,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 16,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    cancelText: {
        color: colors.slate400,
        fontFamily: 'SpaceGrotesk_500Medium',
        fontSize: 14,
    },
});
