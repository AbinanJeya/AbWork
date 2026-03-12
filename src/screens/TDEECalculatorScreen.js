import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { saveUserProfile, getUserProfile } from '../services/storage';
import WeightKeypad from '../components/WeightKeypad';

const ACTIVITY_LEVELS = [
    { label: 'Sedentary (Little/No Exercise)', multiplier: 1.2 },
    { label: 'Lightly Active (1-3 days/week)', multiplier: 1.375 },
    { label: 'Moderately Active (3-5 days/week)', multiplier: 1.55 },
    { label: 'Very Active (6-7 days/week)', multiplier: 1.725 },
    { label: 'Extremely Active (Athlete)', multiplier: 1.9 },
];

export default function TDEECalculatorScreen({ route, navigation }) {
    const isUpdate = route?.params?.fromSettings;
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const scrollRef = useRef(null);

    const [firstName, setFirstName] = useState('');
    const [gender, setGender] = useState('male');
    const [age, setAge] = useState('25');
    const [weight, setWeight] = useState('75');
    const [weightUnit, setWeightUnit] = useState('kg');
    const [height, setHeight] = useState('180');
    const [heightUnit, setHeightUnit] = useState('cm');
    const [feet, setFeet] = useState('5');
    const [inches, setInches] = useState('11');
    const [activityIndex, setActivityIndex] = useState(2);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [tdee, setTdee] = useState(null);

    // Keypad State
    const [keypadVisible, setKeypadVisible] = useState(false);
    const [keypadField, setKeypadField] = useState(null);
    const [keypadVal, setKeypadVal] = useState('');
    const [keypadLabel, setKeypadLabel] = useState('');

    const openKeypad = (field, value, label) => {
        setKeypadField(field);
        setKeypadVal(value);
        setKeypadLabel(label);
        setKeypadVisible(true);
    };

    // Intercept Physical Android Back Button
    useEffect(() => {
        const handleHardwareBackPress = () => {
            if (isUpdate) {
                navigation.goBack();
            } else {
                navigation.replace('HealthConnectOnboarding');
            }
            return true; // Prevent default behavior (exiting app/going to home)
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleHardwareBackPress);
        return () => backHandler.remove();
    }, [navigation, isUpdate]);

    const handleKeypadDone = (val) => {
        switch (keypadField) {
            case 'age': setAge(val); break;
            case 'weight': setWeight(val); break;
            case 'height': setHeight(val); break;
            case 'feet': setFeet(val); break;
            case 'inches': setInches(val); break;
        }
    };

    const handleBack = async () => {
        if (isUpdate) {
            navigation.goBack();
        } else {
            navigation.replace('HealthConnectOnboarding');
        }
    };

    const calculateTDEE = () => {
        if (!firstName.trim()) { Alert.alert('Error', 'Please enter your profile name.'); return; }

        const ageNum = parseInt(age) || 25;

        // Convert weight to kg
        let weightKg = parseFloat(weight) || 75;
        if (weightUnit === 'lbs') weightKg = weightKg * 0.453592;

        // Convert height to cm
        let heightCm;
        if (heightUnit === 'cm') {
            heightCm = parseFloat(height) || 180;
        } else {
            const ft = parseInt(feet) || 5;
            const inc = parseInt(inches) || 10;
            heightCm = ft * 30.48 + inc * 2.54;
        }

        // Mifflin-St Jeor
        let bmr;
        if (gender === 'male') {
            bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5;
        } else {
            bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161;
        }

        const result = Math.round(bmr * ACTIVITY_LEVELS[activityIndex].multiplier);
        setTdee(result);

        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const handleContinue = async () => {
        if (!tdee) { Alert.alert('Error', 'Please calculate your TDEE first.'); return; }

        const existing = await getUserProfile() || {};
        await saveUserProfile({
            ...existing,
            firstName: firstName.trim(),
            gender,
            age: parseInt(age),
            weight: parseFloat(weight),
            weightUnit,
            height: heightUnit === 'cm' ? parseFloat(height) : null,
            heightUnit,
            feet: heightUnit === 'ft' ? parseInt(feet) : null,
            inches: heightUnit === 'ft' ? parseInt(inches) : null,
            activityLevel: ACTIVITY_LEVELS[activityIndex].label,
            tdee,
        });

        navigation.replace('GoalSelection', { tdee, fromSettings: isUpdate });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                    <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>TDEE Calculator</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Brand */}
                <View style={styles.brandRow}>
                    <View style={styles.brandIcon}><MaterialIcons name="analytics" size={16} color={colors.primary} /></View>
                    <Text style={styles.brandText}>ABWORK FITNESS</Text>
                </View>

                <Text style={styles.pageTitle}>Personal Information</Text>
                <Text style={styles.pageSubtitle}>Tell us a bit about yourself to calculate your maintenance calories.</Text>

                {/* Profile Name */}
                <Text style={styles.label}>Profile Name</Text>
                <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="e.g. Alex"
                    placeholderTextColor={colors.slate500}
                />

                {/* Gender */}
                <Text style={styles.label}>Biological Gender</Text>
                <View style={styles.genderRow}>
                    <TouchableOpacity
                        style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                        onPress={() => setGender('male')}
                    >
                        <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>MALE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                        onPress={() => setGender('female')}
                    >
                        <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>FEMALE</Text>
                    </TouchableOpacity>
                </View>

                {/* Age & Weight */}
                <View style={styles.rowTwo}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Age</Text>
                        <View style={styles.unitInputRow}>
                            <TouchableOpacity style={{ flex: 1, paddingVertical: 14, justifyContent: 'center' }} onPress={() => openKeypad('age', age, 'AGE')} activeOpacity={0.7}>
                                <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>{age}</Text>
                            </TouchableOpacity>
                            <Text style={styles.unitFixed}>YEARS</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Weight</Text>
                        <View style={styles.unitInputRow}>
                            <TouchableOpacity style={{ flex: 1, paddingVertical: 14, justifyContent: 'center' }} onPress={() => openKeypad('weight', weight, 'WEIGHT')} activeOpacity={0.7}>
                                <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>{weight}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setWeightUnit(w => w === 'kg' ? 'lbs' : 'kg')}>
                                <View style={styles.unitToggle}>
                                    <Text style={styles.unitToggleText}>{weightUnit.toUpperCase()}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Height */}
                <View style={styles.heightHeader}>
                    <Text style={styles.label}>Height</Text>
                    <TouchableOpacity onPress={() => setHeightUnit(h => h === 'cm' ? 'ft' : 'cm')}>
                        <View style={styles.unitToggleSmall}>
                            <Text style={styles.unitToggleTextSmall}>{heightUnit === 'cm' ? 'CM' : 'FT/IN'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
                {heightUnit === 'cm' ? (
                    <View style={styles.unitInputRow}>
                        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, justifyContent: 'center' }} onPress={() => openKeypad('height', height, 'HEIGHT (CM)')} activeOpacity={0.7}>
                            <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>{height}</Text>
                        </TouchableOpacity>
                        <Text style={styles.unitFixed}>CM</Text>
                    </View>
                ) : (
                    <View style={styles.rowTwo}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.unitInputRow}>
                                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, justifyContent: 'center' }} onPress={() => openKeypad('feet', feet, 'FEET')} activeOpacity={0.7}>
                                    <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>{feet}</Text>
                                </TouchableOpacity>
                                <Text style={styles.unitFixed}>FT</Text>
                            </View>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.unitInputRow}>
                                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, justifyContent: 'center' }} onPress={() => openKeypad('inches', inches, 'INCHES')} activeOpacity={0.7}>
                                    <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>{inches}</Text>
                                </TouchableOpacity>
                                <Text style={styles.unitFixed}>IN</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Activity Level */}
                <Text style={styles.label}>Activity Level</Text>
                <TouchableOpacity
                    style={styles.activityPicker}
                    onPress={() => setShowActivityPicker(!showActivityPicker)}
                >
                    <Text style={styles.activityPickerText}>{ACTIVITY_LEVELS[activityIndex].label}</Text>
                    <Text style={styles.activityArrow}>{showActivityPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showActivityPicker && (
                    <View style={styles.activityDropdown}>
                        {ACTIVITY_LEVELS.map((level, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.activityOption, activityIndex === i && styles.activityOptionActive]}
                                onPress={() => { setActivityIndex(i); setShowActivityPicker(false); }}
                            >
                                <Text style={[styles.activityOptionText, activityIndex === i && { color: colors.primary }]}>
                                    {level.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Calculate Button */}
                <TouchableOpacity style={styles.calcBtn} onPress={calculateTDEE}>
                    <Text style={styles.calcBtnText}>CALCULATE MY TDEE</Text>
                </TouchableOpacity>

                {/* Result */}
                {tdee && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultLabel}>YOUR MAINTENANCE ENERGY</Text>
                        <View style={styles.resultRow}>
                            <Text style={styles.resultBig}>{tdee.toLocaleString()}</Text>
                            <Text style={styles.resultUnit}>kcal</Text>
                        </View>
                        <Text style={styles.resultSub}>
                            This is the amount of energy you need daily to maintain your current weight.
                        </Text>

                        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
                            <Text style={styles.continueBtnText}>Continue to Goal Selection →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>

            <WeightKeypad
                visible={keypadVisible}
                onClose={() => setKeypadVisible(false)}
                initialValue={keypadVal}
                label={keypadLabel}
                showUnitToggle={false}
                onDone={(val) => handleKeypadDone(val)}
            />
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

    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    brandIcon: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    brandText: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.5 },

    pageTitle: { color: colors.text, fontSize: 26, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 6 },
    pageSubtitle: { color: colors.slate400, fontSize: 13, lineHeight: 20, marginBottom: 20 },

    label: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16,
        color: colors.white, fontSize: 14, borderWidth: 1, borderColor: colors.border,
    },

    genderRow: { flexDirection: 'row', gap: 10 },
    genderBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    genderBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
    genderText: { color: colors.slate400, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
    genderTextActive: { color: colors.primary },

    rowTwo: { flexDirection: 'row', gap: 12 },

    unitInputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    },
    unitInput: { flex: 1, color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', paddingVertical: 14 },
    unitFixed: { color: colors.slate400, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
    unitToggle: {
        backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8,
    },
    unitToggleSmall: {
        backgroundColor: colors.primaryDim, paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 6,
    },
    unitToggleText: { color: colors.bgDark, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },
    unitToggleTextSmall: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },

    heightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },

    activityPicker: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    activityPickerText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', flex: 1 },
    activityArrow: { color: colors.primary, fontSize: 12 },

    activityDropdown: {
        backgroundColor: colors.surface, borderRadius: 14, marginTop: 4,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    activityOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    activityOptionActive: { backgroundColor: colors.primaryDim },
    activityOptionText: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' },

    calcBtn: {
        backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18,
        alignItems: 'center', marginTop: 28,
    },
    calcBtnText: { color: colors.bgDark, fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold' },

    resultCard: {
        backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, marginTop: 20,
        borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    resultLabel: { color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, marginBottom: 8 },
    resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    resultBig: { color: colors.text, fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold' },
    resultUnit: { color: colors.primary, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    resultSub: { color: colors.slate400, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },

    continueBtn: {
        backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
        alignItems: 'center', marginTop: 20, width: '100%',
    },
    continueBtnText: { color: colors.bgDark, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
});
