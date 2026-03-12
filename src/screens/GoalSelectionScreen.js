import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { saveUserProfile, getUserProfile, saveSettings, getSettings } from '../services/storage';
import { getCurrentUser, saveProfileToCloud } from '../services/auth';

export default function GoalSelectionScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const { tdee } = route.params;

    const [cutRate, setCutRate] = useState(0.5); // lbs/week
    const [bulkRate, setBulkRate] = useState(0.5);
    const [selectedGoal, setSelectedGoal] = useState(null); // 'cut' | 'maintain' | 'bulk'

    // Calorie calculations
    const cutCalories = Math.round(tdee - cutRate * 500);
    const maintainCalories = tdee;
    const bulkCalories = Math.round(tdee + bulkRate * 500);

    const getCutLabel = () => {
        if (cutRate <= 0.5) return 'SUSTAINABLE';
        if (cutRate <= 1.0) return 'REALISTIC RANGE';
        return 'AGGRESSIVE';
    };

    const getBulkLabel = () => {
        if (bulkRate <= 0.3) return 'LEAN';
        if (bulkRate <= 0.7) return 'REALISTIC RANGE';
        return 'MASS';
    };

    const handleConfirm = async () => {
        if (!selectedGoal) { Alert.alert('Error', 'Please select a goal.'); return; }

        try {
            let dailyCalories;
            if (selectedGoal === 'cut') dailyCalories = cutCalories;
            else if (selectedGoal === 'maintain') dailyCalories = maintainCalories;
            else dailyCalories = bulkCalories;

            // Merge local and new data
            const existingProfile = await getUserProfile() || {};
            const fullProfile = {
                ...existingProfile,
                goal: selectedGoal,
                dailyCalories,
                tdee,
                onboardingComplete: true,
            };

            // 1. Update local user profile
            await saveUserProfile(fullProfile);

            // 2. Update settings calorie goal
            const settings = await getSettings();
            await saveSettings({ ...settings, calorieGoal: dailyCalories });

            // 3. Save ALL profile data to server (fixes name resetting bug)
            const user = getCurrentUser();
            if (user?.uid) {
                await saveProfileToCloud(user.uid, fullProfile);
            }

            // Navigate accordingly based on where the user came from
            if (route.params?.fromSettings) {
                navigation.goBack();
            } else {
                navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
            }
        } catch (error) {
            console.error("Confirm daily target error: ", error);
            Alert.alert('Error', error.message || 'An unexpected error occurred.');
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.replace('TDEECalculator');
                        }
                    }}
                >
                    <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AbWork</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.pageTitle}>Weekly Goal</Text>
                <Text style={styles.pageSubtitle}>
                    Adjust your intensity to see your daily calorie target update.
                </Text>

                {/* ==== CUT CARD ==== */}
                <TouchableOpacity
                    style={[styles.goalCard, selectedGoal === 'cut' && styles.cutCardSelected]}
                    onPress={() => setSelectedGoal('cut')}
                    activeOpacity={0.8}
                >
                    <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>RECOMMENDED</Text>
                    </View>
                    <View style={styles.goalRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.goalTitle}>Cut (Lose Weight)</Text>
                            <Text style={styles.goalSubtitle}>Target Pace</Text>
                        </View>
                        <View style={styles.goalCalCol}>
                            <Text style={styles.goalCalBig}>{cutCalories.toLocaleString()}</Text>
                            <Text style={styles.goalCalUnit}>KCAL / DAY</Text>
                        </View>
                    </View>
                    <View style={styles.weeklyRow}>
                        <Text style={styles.weeklyLabel}>Weekly Goal</Text>
                        <Text style={styles.weeklyVal}>{cutRate.toFixed(1)} lbs / week</Text>
                    </View>
                    <Slider
                        style={{ width: '100%', height: 30, marginTop: 4 }}
                        minimumValue={0.25}
                        maximumValue={2.0}
                        step={0.25}
                        value={cutRate}
                        onValueChange={setCutRate}
                        minimumTrackTintColor="#ef4444"
                        maximumTrackTintColor={colors.border}
                        thumbTintColor="#ef4444"
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>0.25 LBS</Text>
                        <Text style={[styles.sliderLabel, { color: '#ef4444' }]}>{getCutLabel()}</Text>
                        <Text style={styles.sliderLabel}>2.0 LBS</Text>
                    </View>
                </TouchableOpacity>

                {/* ==== MAINTAIN CARD ==== */}
                <TouchableOpacity
                    style={[styles.maintainCard, selectedGoal === 'maintain' && styles.goalCardSelected]}
                    onPress={() => setSelectedGoal('maintain')}
                    activeOpacity={0.8}
                >
                    <View style={styles.goalRow}>
                        <View>
                            <Text style={styles.goalTitleMaintain}>Maintain</Text>
                            <Text style={styles.goalSubtitle}>Stay at current weight</Text>
                        </View>
                        <View style={styles.goalCalCol}>
                            <Text style={styles.goalCalBig}>{maintainCalories.toLocaleString()}</Text>
                            <Text style={styles.goalCalUnit}>KCAL / DAY</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* ==== BULK CARD ==== */}
                <TouchableOpacity
                    style={[styles.goalCard, styles.bulkCard, selectedGoal === 'bulk' && styles.bulkCardSelected]}
                    onPress={() => setSelectedGoal('bulk')}
                    activeOpacity={0.8}
                >
                    <View style={styles.goalRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bulkTitle}>Bulk (Gain Weight)</Text>
                            <Text style={styles.goalSubtitle}>Target Pace</Text>
                        </View>
                        <View style={styles.goalCalCol}>
                            <Text style={styles.bulkCalBig}>{bulkCalories.toLocaleString()}</Text>
                            <Text style={styles.goalCalUnit}>KCAL / DAY</Text>
                        </View>
                    </View>
                    <View style={styles.weeklyRow}>
                        <Text style={styles.weeklyLabel}>Weekly Goal</Text>
                        <Text style={styles.bulkWeeklyVal}>{bulkRate.toFixed(1)} lbs / week</Text>
                    </View>
                    <Slider
                        style={{ width: '100%', height: 30, marginTop: 4 }}
                        minimumValue={0.25}
                        maximumValue={1.5}
                        step={0.25}
                        value={bulkRate}
                        onValueChange={setBulkRate}
                        minimumTrackTintColor="#4488ff"
                        maximumTrackTintColor={colors.border}
                        thumbTintColor="#4488ff"
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>0.25 LBS</Text>
                        <Text style={[styles.sliderLabel, { color: '#4488ff' }]}>{getBulkLabel()}</Text>
                        <Text style={styles.sliderLabel}>1.5 LBS</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Confirm Button */}
            <View style={[styles.confirmBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity
                    style={[styles.confirmBtn, !selectedGoal && { opacity: 0.5 }]}
                    onPress={handleConfirm}
                    disabled={!selectedGoal}
                >
                    <Text style={styles.confirmBtnText}>Confirm Daily Target</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    content: { paddingHorizontal: 20, paddingTop: 20 },
    pageTitle: { color: colors.text, fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },
    pageSubtitle: { color: colors.primary, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 24 },

    // Cut / generic goal card
    goalCard: {
        backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16,
        borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden',
    },
    cutCardSelected: { borderColor: '#ef4444' },
    goalCardSelected: { borderColor: colors.primary },
    recommendedBadge: {
        position: 'absolute', top: 4, right: 10, backgroundColor: 'transparent',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    recommendedText: { color: '#ef4444', fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },

    goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    goalTitle: { color: '#ef4444', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 2 },
    goalSubtitle: { color: colors.slate400, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },
    goalCalCol: { alignItems: 'flex-end' },
    goalCalBig: { color: colors.text, fontSize: 32, fontFamily: 'SpaceGrotesk_700Bold' },
    goalCalUnit: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },

    weeklyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    weeklyLabel: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    weeklyVal: { color: '#ef4444', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    sliderLabel: { color: colors.slate400, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },

    selectBtn: {
        backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', marginTop: 16,
    },
    selectBtnText: { color: colors.bgDark, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },

    // Maintain card
    maintainCard: {
        backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16,
        borderWidth: 1.5, borderColor: colors.border,
    },
    goalTitleMaintain: { color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 2 },

    // Bulk card
    bulkCard: { borderColor: colors.border },
    bulkCardSelected: { borderColor: '#4488ff' },
    bulkTitle: { color: '#4488ff', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 2 },
    bulkCalBig: { color: '#4488ff', fontSize: 32, fontFamily: 'SpaceGrotesk_700Bold' },
    bulkWeeklyVal: { color: '#4488ff', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    bulkSelectBtn: {
        backgroundColor: '#4488ff', borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', marginTop: 16,
    },
    bulkSelectText: { color: '#fff', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },

    // Confirm
    confirmBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bgDark,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    confirmBtn: {
        backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18,
        alignItems: 'center',
    },
    confirmBtnText: { color: colors.bgDark, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold' },
});
