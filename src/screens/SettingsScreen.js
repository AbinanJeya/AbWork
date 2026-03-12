import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
    Image, ActionSheetIOS, Platform, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSettings, saveSettings, setStepsToday, getUserProfile, saveUserProfile } from '../services/storage';
import { getXPData, getLevelInfo, addXP, awardDailyBonus, XP_AMOUNTS } from '../services/leveling';
import { auth } from '../services/auth';
import { useTranslation } from '../services/i18n';

const PLANS = ['Cut', 'Bulk', 'Maintain'];
const PLAN_KEYS = { 'Cut': 'cut', 'Bulk': 'bulk', 'Maintain': 'maintain' };




export default function SettingsScreen() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const navigation = useNavigation();

    const [userName, setUserName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [currentPlan, setCurrentPlan] = useState('Maintain');
    const [tdee, setTdee] = useState(2500);
    const [calorieGoal, setCalorieGoal] = useState('');
    const [editingCalories, setEditingCalories] = useState(false);
    const [stepGoal, setStepGoal] = useState('');
    const [editingSteps, setEditingSteps] = useState(false);
    const [userWeight, setUserWeight] = useState(null); // in lbs


    const [manualSteps, setManualSteps] = useState('');
    const [saved, setSaved] = useState(false);
    const [levelInfo, setLevelInfo] = useState({ level: 1, title: 'Newcomer', progress: 0, totalXP: 0, xpInLevel: 0, xpNeeded: 1000 });
    const [profileImage, setProfileImage] = useState(null);

    // Macro split (percentages)
    const [carbsPct, setCarbsPct] = useState(40);
    const [proteinPct, setProteinPct] = useState(30);
    const [fatsPct, setFatsPct] = useState(30);

    // Timezone
    const [selectedTimezone, setSelectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [showTzPicker, setShowTzPicker] = useState(false);
    const [tzSearch, setTzSearch] = useState('');



    useFocusEffect(
        useCallback(() => {
            loadSettings();
        }, [])
    );

    const loadSettings = async () => {
        const s = await getSettings();
        const profile = await getUserProfile();
        setUserName(profile?.firstName || s.userName || 'User');
        setTdee(profile?.tdee || 2500);
        setStepGoal(String(s.stepGoal || 10000));

        const plan = profile?.goal ? (profile.goal.charAt(0).toUpperCase() + profile.goal.slice(1)) : 'Maintain';
        setCurrentPlan(plan);
        setCalorieGoal(String(profile?.dailyCalories || s.calorieGoal || 2000));
        setProfileImage(profile?.profileImage || null);

        // Get weight in lbs for macro calculation
        const w = profile?.weight || null;
        const wUnit = profile?.weightUnit || 'lbs';
        const weightLbs = w ? (wUnit === 'kg' ? w * 2.205 : w) : null;
        setUserWeight(weightLbs);

        // Calculate smart macro defaults if no saved macros
        if (s.macros) {
            setCarbsPct(s.macros.carbs || 40);
            setProteinPct(s.macros.protein || 30);
            setFatsPct(s.macros.fats || 30);
        } else if (weightLbs) {
            const dailyCal = profile?.dailyCalories || s.calorieGoal || 2000;
            calcSmartMacros(weightLbs, dailyCal);
        }

        // Load level info
        const xpData = await getXPData();
        setLevelInfo(getLevelInfo(xpData.totalXP));

        // Timezone
        if (s.timezone) setSelectedTimezone(s.timezone);
    };

    // Removed handlePlanChange because it forces destructive 20% generic overrides.
    // Plan changes should strictly happen inside GoalSelectionScreen slider UI.

    // Smart macro calculation: Protein=1g/lb, Fats=22.5% TDEE, Carbs=remainder
    const calcSmartMacros = (weightLbs, dailyCal) => {
        const proteinG = Math.round(weightLbs); // 1g per lb
        const proteinCal = proteinG * 4;
        const fatCal = Math.round(dailyCal * 0.225); // 22.5% of calories
        const fatG = Math.round(fatCal / 9);
        const carbCal = dailyCal - proteinCal - fatCal;
        const carbG = Math.max(0, Math.round(carbCal / 4));

        const pPct = Math.round((proteinCal / dailyCal) * 100);
        const fPct = Math.round((fatCal / dailyCal) * 100);
        const cPct = Math.max(0, 100 - pPct - fPct);

        setProteinPct(Math.min(pPct, 60));
        setFatsPct(Math.min(fPct, 40));
        setCarbsPct(Math.max(cPct, 5));
    };

    // Macro gram calculations
    const cal = parseInt(calorieGoal) || 2000;
    const carbsGrams = Math.round((carbsPct / 100) * cal / 4);
    const proteinGrams = Math.round((proteinPct / 100) * cal / 4);
    const fatsGrams = Math.round((fatsPct / 100) * cal / 9);
    const totalPct = carbsPct + proteinPct + fatsPct;

    const handleMacroPctChange = (macro, value) => {
        const v = Math.round(value);
        if (macro === 'carbs') {
            setCarbsPct(v);
            const remaining = 100 - v;
            const ratio = proteinPct / (proteinPct + fatsPct || 1);
            setProteinPct(Math.round(remaining * ratio));
            setFatsPct(remaining - Math.round(remaining * ratio));
        } else if (macro === 'protein') {
            setProteinPct(v);
            const remaining = 100 - v;
            const ratio = carbsPct / (carbsPct + fatsPct || 1);
            setCarbsPct(Math.round(remaining * ratio));
            setFatsPct(remaining - Math.round(remaining * ratio));
        } else {
            setFatsPct(v);
            const remaining = 100 - v;
            const ratio = carbsPct / (carbsPct + proteinPct || 1);
            setCarbsPct(Math.round(remaining * ratio));
            setProteinPct(remaining - Math.round(remaining * ratio));
        }
    };

    const handlePickImage = () => {
        Alert.alert(t('profilePicture'), t('chooseOption'), [
            {
                text: t('takePhoto'),
                onPress: async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.7,
                    });
                    if (!result.canceled && result.assets?.[0]) {
                        const uri = result.assets[0].uri;
                        setProfileImage(uri);
                        const profile = await getUserProfile() || {};
                        await saveUserProfile({ ...profile, profileImage: uri });
                    }
                },
            },
            {
                text: t('chooseFromLibrary'),
                onPress: async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Permission needed', 'Photo library permission is required.');
                        return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.7,
                    });
                    if (!result.canceled && result.assets?.[0]) {
                        const uri = result.assets[0].uri;
                        setProfileImage(uri);
                        const profile = await getUserProfile() || {};
                        await saveUserProfile({ ...profile, profileImage: uri });
                    }
                },
            },
            { text: t('cancel'), style: 'cancel' },
        ]);
    };

    const handleSave = async () => {
        await saveSettings({
            userName,
            calorieGoal: parseInt(calorieGoal) || 2000,
            stepGoal: parseInt(stepGoal) || 10000,
            macros: { carbs: carbsPct, protein: proteinPct, fats: fatsPct },
            timezone: selectedTimezone,
        });
        const profile = await getUserProfile();
        if (profile) {
            await saveUserProfile({
                ...profile,
                firstName: userName,
                goal: currentPlan.toLowerCase(),
                dailyCalories: parseInt(calorieGoal) || 2000,
                profileImage: profileImage,
            });
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                        <MaterialIcons name="person" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.headerTitle}>{t('profile')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={handleSave}>
                        <MaterialIcons name="check" size={24} color={saved ? colors.primary : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.getParent()?.navigate('SettingsMenu')}>
                        <MaterialIcons name="settings" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Profile */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarRing}>
                        <View style={styles.avatarInner}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                            ) : (
                                <MaterialIcons name="person" size={36} color={colors.textSecondary} />
                            )}
                        </View>
                        <TouchableOpacity style={styles.cameraIcon} onPress={handlePickImage}>
                            <MaterialIcons name="camera-alt" size={12} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.nameRow}>
                        {editingName ? (
                            <TextInput style={styles.nameInput} value={userName} onChangeText={setUserName}
                                onBlur={() => setEditingName(false)} autoFocus selectTextOnFocus />
                        ) : (
                            <Text style={styles.profileName}>{userName}</Text>
                        )}
                        <TouchableOpacity
                            style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                            onPress={() => setEditingName(true)}
                        >
                            <MaterialIcons name="edit" size={14} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.profileSub}>{levelInfo.title} • {t('level')} {levelInfo.level}</Text>

                    {/* XP Progress Bar */}
                    <View style={styles.xpSection}>
                        <View style={styles.xpLevelRow}>
                            <Text style={styles.xpLevelLabel}>LEVEL {levelInfo.level}</Text>
                            <Text style={styles.xpLevelLabel}>LEVEL {Math.min(levelInfo.level + 1, 100)}</Text>
                        </View>
                        <View style={styles.xpBarBg}>
                            <View style={[styles.xpBarFill, { width: `${Math.round(levelInfo.progress * 100)}%` }]} />
                        </View>
                        <Text style={styles.xpText}>
                            {levelInfo.xpInLevel.toLocaleString()} / {levelInfo.xpNeeded.toLocaleString()} XP TO MILESTONE
                        </Text>
                    </View>
                </View>

                {/* Current Plan — Read Only */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('currentPlan')}</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
                            onPress={() => navigation.navigate('GoalSelection', { tdee, fromSettings: true })}
                        >
                            <Text style={{ color: colors.primary, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 }}>Edit Plan</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 }}>{currentPlan}</Text>
                            <Text style={{ color: colors.textSecondary, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, marginTop: 4 }}>
                                Target: {calorieGoal} kcal / day
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.slate400, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12 }}>Maintenance (TDEE)</Text>
                            <Text style={{ color: colors.textSecondary, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14 }}>{tdee.toLocaleString()} kcal</Text>
                        </View>
                    </View>
                </View>

                {/* Daily Goals */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('dailyGoals')}</Text>
                    <View style={styles.goalsRow}>
                        <View style={styles.goalCard}>
                            <Text style={styles.goalLabel}>{t('calorieGoal')}</Text>
                            <View style={styles.goalValRow}>
                                {editingCalories ? (
                                    <TextInput style={styles.goalInput} value={calorieGoal} onChangeText={setCalorieGoal}
                                        onBlur={() => setEditingCalories(false)} keyboardType="numeric" autoFocus selectTextOnFocus />
                                ) : (
                                    <Text style={styles.goalVal}>{parseInt(calorieGoal).toLocaleString()}</Text>
                                )}
                                <TouchableOpacity
                                    style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                                    onPress={() => setEditingCalories(true)}
                                >
                                    <MaterialIcons name="edit" size={12} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.goalCard}>
                            <Text style={styles.goalLabel}>{t('stepGoal')}</Text>
                            <View style={styles.goalValRow}>
                                {editingSteps ? (
                                    <TextInput style={styles.goalInput} value={stepGoal} onChangeText={setStepGoal}
                                        onBlur={() => setEditingSteps(false)} keyboardType="numeric" autoFocus selectTextOnFocus />
                                ) : (
                                    <Text style={styles.goalVal}>{parseInt(stepGoal).toLocaleString()}</Text>
                                )}
                                <TouchableOpacity
                                    style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                                    onPress={() => setEditingSteps(true)}
                                >
                                    <MaterialIcons name="edit" size={12} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Macro Split — individual bars with sliders */}
                <View style={styles.section}>
                    <View style={styles.macroHeader}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('macroSplit')}</Text>
                        <TouchableOpacity onPress={() => {
                            if (userWeight) {
                                calcSmartMacros(userWeight, parseInt(calorieGoal) || 2000);
                            } else {
                                setCarbsPct(40); setProteinPct(30); setFatsPct(30);
                            }
                        }}>
                            <Text style={styles.recalcBtn}>{t('recalculate')}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.macroCard}>
                        {/* Top summary bar */}
                        <View style={styles.macroTopBar}>
                            <View style={[styles.macroTopSeg, { flex: carbsPct, backgroundColor: colors.primary }]} />
                            <View style={[styles.macroTopSeg, { flex: proteinPct, backgroundColor: colors.primary, opacity: 0.6 }]} />
                            <View style={[styles.macroTopSeg, { flex: fatsPct, backgroundColor: colors.primary, opacity: 0.3 }]} />
                        </View>

                        {/* Individual macro rows */}
                        {[
                            { name: t('carbohydrates'), pct: carbsPct, grams: carbsGrams, onChange: (v) => handleMacroPctChange('carbs', v) },
                            { name: t('protein'), pct: proteinPct, grams: proteinGrams, onChange: (v) => handleMacroPctChange('protein', v) },
                            { name: t('fats'), pct: fatsPct, grams: fatsGrams, onChange: (v) => handleMacroPctChange('fats', v) },
                        ].map((macro) => (
                            <View key={macro.name} style={styles.macroRow}>
                                <View style={styles.macroRowHeader}>
                                    <Text style={styles.macroRowName}>{macro.name}</Text>
                                    <View style={styles.macroRowVals}>
                                        <Text style={styles.macroRowPct}>{macro.pct}%</Text>
                                        <Text style={styles.macroRowGrams}>{macro.grams}g</Text>
                                    </View>
                                </View>
                                <Slider
                                    style={{ width: '100%', height: 28 }}
                                    minimumValue={5}
                                    maximumValue={70}
                                    step={1}
                                    value={macro.pct}
                                    onValueChange={macro.onChange}
                                    minimumTrackTintColor={colors.primary}
                                    maximumTrackTintColor={colors.border}
                                    thumbTintColor={colors.primary}
                                />
                            </View>
                        ))}

                        {/* Total check */}
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalCheck, totalPct === 100 && { color: colors.primary }]}>
                                {totalPct === 100 ? '✓' : '⚠'} Total distribution equals {totalPct}%
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary + '18',
        alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: 120 },

    // Profile
    profileSection: { alignItems: 'center', paddingVertical: 24 },
    avatarRing: { position: 'relative', marginBottom: 12 },
    avatarInner: {
        width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
        borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: { width: 88, height: 88, borderRadius: 44 },
    cameraIcon: {
        position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.bgDark,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    profileName: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold' },
    nameInput: {
        color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', borderBottomWidth: 2,
        borderBottomColor: colors.primary, paddingVertical: 2, minWidth: 80, textAlign: 'center',
    },
    profileSub: { color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 4 },

    // XP Progress Bar
    xpSection: { width: '90%', marginTop: 12 },
    xpLevelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    xpLevelLabel: { color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
    xpBarBg: {
        width: '100%', height: 10, backgroundColor: colors.surface, borderRadius: 5,
        overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    },
    xpBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
    xpText: { color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', textAlign: 'center', marginTop: 6 },

    section: { paddingHorizontal: 16, marginBottom: 16 },
    sectionTitle: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, marginBottom: 12 },

    // Plan toggle
    planToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 4, height: 48 },
    planBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    planBtnActive: { backgroundColor: colors.primary },
    planBtnText: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', opacity: 0.6 },
    planBtnTextActive: { color: colors.bgDark, opacity: 1 },
    planHint: { color: colors.slate400, fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'SpaceGrotesk_500Medium' },

    // Goals
    goalsRow: { flexDirection: 'row', gap: 12 },
    goalCard: {
        flex: 1, backgroundColor: colors.bgCard, padding: 16, borderRadius: 14,
        borderWidth: 1, borderColor: colors.border,
    },
    goalLabel: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', opacity: 0.6, marginBottom: 6 },
    goalValRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalVal: { color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    goalInput: {
        color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', borderBottomWidth: 2,
        borderBottomColor: colors.primary, minWidth: 60, paddingVertical: 0,
    },

    // Macro split
    macroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    recalcBtn: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },
    macroCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    macroTopBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 16 },
    macroTopSeg: { height: 10 },
    macroRow: { marginBottom: 12 },
    macroRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    macroRowName: { color: colors.slate400, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 1 },
    macroRowVals: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    macroRowPct: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    macroRowGrams: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    totalRow: { marginTop: 4, alignItems: 'center' },
    totalCheck: { color: colors.slate400, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' },

    // Action cards
    actionCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    actionCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    actionIconCircle: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    actionCardTitle: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    actionCardSub: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },

    // Steps
    stepEntryRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
    stepInput: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border,
    },
    setStepBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    setStepText: { color: '#000', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },

    // Timezone
    tzBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    tzBtnText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },
    tzPickerContainer: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    tzSearchInput: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    tzOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
    tzOptionActive: { backgroundColor: colors.primary + '12' },
    tzOptionText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' },
});
