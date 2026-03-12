import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl,
    Modal, PanResponder, Animated, Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import {
    getDiaryForDate, addFoodToDiary, removeFoodFromDiary,
    calcDiaryTotals, calcMealTypeTotal, getSettings, getDiaryStreak,
} from '../services/storage';
import { AddFoodModal } from '../components/AddFoodModal';
import { RecipesModal } from '../components/RecipesModal';
import { MyMealsModal } from '../components/MyMealsModal';
import { addXP, XP_AMOUNTS } from '../services/leveling';
import { useTranslation, getMonthNames, getWeekdays } from '../services/i18n';

// ─── Helpers ──────────────────────────────────────
function todayKey(tz) {
    if (tz) {
        return new Date().toLocaleDateString('en-CA', { timeZone: tz });
    }
    return new Date().toISOString().slice(0, 10);
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function getWeekDays(centerDate) {
    const parts = centerDate.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        const yy = dd.getFullYear();
        const mm = String(dd.getMonth() + 1).padStart(2, '0');
        const ddNum = String(dd.getDate()).padStart(2, '0');
        days.push({
            key: `${yy}-${mm}-${ddNum}`,
            dayName: DAY_NAMES[dd.getDay()],
            dayNum: dd.getDate(),
        });
    }
    return days;
}

function getMonthGrid(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
    return cells;
}

function dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MEAL_SECTIONS = [
    { key: 'breakfast', label: 'Breakfast', icon: 'wb-twilight' },
    { key: 'lunch', label: 'Lunch', icon: 'light-mode' },
    { key: 'dinner', label: 'Dinner', icon: 'dark-mode' },
    { key: 'snacks', label: 'Snacks', icon: 'restaurant' },
];

const SWIPE_THRESHOLD = 50;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Calendar Popup ───────────────────────────────
function CalendarPopup({ visible, onClose, selectedDate, onSelectDate, colors, isDark }) {
    const { t } = useTranslation();
    const monthNames = getMonthNames(t);
    const parts = selectedDate.split('-');
    const [viewYear, setViewYear] = useState(parseInt(parts[0]));
    const [viewMonth, setViewMonth] = useState(parseInt(parts[1]) - 1);

    // Reset view to selected date's month when opened
    React.useEffect(() => {
        if (visible) {
            const p = selectedDate.split('-');
            setViewYear(parseInt(p[0]));
            setViewMonth(parseInt(p[1]) - 1);
        }
    }, [visible, selectedDate]);

    const grid = getMonthGrid(viewYear, viewMonth);
    const today = todayKey();
    const WEEKDAY_HEADERS = [t('mon').charAt(0), t('tue').charAt(0), t('wed').charAt(0), t('thu').charAt(0), t('fri').charAt(0), t('sat').charAt(0), t('sun').charAt(0)];

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
        else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
        else setViewMonth(viewMonth + 1);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={calStyles(colors, isDark).backdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={calStyles(colors, isDark).popup}>
                    {/* Month navigation */}
                    <View style={calStyles(colors, isDark).monthRow}>
                        <TouchableOpacity onPress={prevMonth} style={calStyles(colors, isDark).arrowBtn}>
                            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={calStyles(colors, isDark).monthTitle}>
                            {monthNames[viewMonth]} {viewYear}
                        </Text>
                        <TouchableOpacity onPress={nextMonth} style={calStyles(colors, isDark).arrowBtn}>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Weekday headers */}
                    <View style={calStyles(colors, isDark).weekRow}>
                        {WEEKDAY_HEADERS.map((h, i) => (
                            <Text key={i} style={calStyles(colors, isDark).weekHeader}>{h}</Text>
                        ))}
                    </View>

                    {/* Day grid */}
                    <View style={calStyles(colors, isDark).grid}>
                        {grid.map((day, i) => {
                            if (day === null) return <View key={`pad-${i}`} style={calStyles(colors, isDark).cell} />;
                            const key = dateKey(viewYear, viewMonth, day);
                            const isSelected = key === selectedDate;
                            const isToday = key === today;
                            return (
                                <TouchableOpacity
                                    key={key}
                                    style={calStyles(colors, isDark).cell}
                                    onPress={() => { onSelectDate(key); onClose(); }}
                                >
                                    <View style={[
                                        calStyles(colors, isDark).cellCircle,
                                        isSelected && calStyles(colors, isDark).cellSelected,
                                        isToday && !isSelected && calStyles(colors, isDark).cellToday,
                                    ]}>
                                        <Text style={[
                                            calStyles(colors, isDark).cellText,
                                            isSelected && calStyles(colors, isDark).cellTextSelected,
                                            isToday && !isSelected && calStyles(colors, isDark).cellTextToday,
                                        ]}>
                                            {day}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const calStyles = (colors, isDark) => StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    popup: {
        width: 320, backgroundColor: colors.bg,
        borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    },
    monthRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
    },
    arrowBtn: { padding: 4 },
    monthTitle: {
        color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold',
    },
    weekRow: {
        flexDirection: 'row', marginBottom: 8,
    },
    weekHeader: {
        flex: 1, textAlign: 'center', color: colors.textSecondary,
        fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    grid: {
        flexDirection: 'row', flexWrap: 'wrap',
    },
    cell: {
        width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    },
    cellCircle: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    cellSelected: {
        backgroundColor: colors.primary,
    },
    cellToday: {
        borderWidth: 1.5, borderColor: colors.primary,
    },
    cellText: {
        color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium',
    },
    cellTextSelected: { color: colors.textOnPrimary, fontFamily: 'SpaceGrotesk_700Bold' },
    cellTextToday: { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' },
});

// ─── Component ────────────────────────────────────
export default function DiaryScreen() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const [selectedDate, setSelectedDate] = useState(todayKey());
    const [diary, setDiary] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] });
    const [settings, setSettingsState] = useState({ calorieGoal: 2000 });
    const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [activeMealType, setActiveMealType] = useState('breakfast');
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [myMealsVisible, setMyMealsVisible] = useState(false);
    const [recipesVisible, setRecipesVisible] = useState(false);
    const [savedMeals, setSavedMeals] = useState([]);
    const [savedRecipes, setSavedRecipes] = useState([]);
    const [diaryStreak, setDiaryStreak] = useState(0);

    const weekDays = getWeekDays(selectedDate);

    // ─── Swipe to change days ───
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => {
                return Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
            },
            onPanResponderMove: (_, gs) => {
                swipeAnim.setValue(gs.dx);
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
                    // Swipe right → previous day
                    Animated.timing(swipeAnim, { toValue: SCREEN_W, duration: 150, useNativeDriver: true }).start(() => {
                        navigateDay(-1);
                        swipeAnim.setValue(-SCREEN_W);
                        Animated.timing(swipeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
                    });
                } else if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -0.5) {
                    // Swipe left → next day
                    Animated.timing(swipeAnim, { toValue: -SCREEN_W, duration: 150, useNativeDriver: true }).start(() => {
                        navigateDay(1);
                        swipeAnim.setValue(SCREEN_W);
                        Animated.timing(swipeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
                    });
                } else {
                    Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const loadData = useCallback(async () => {
        try {
            const [d, s, streak] = await Promise.all([getDiaryForDate(selectedDate), getSettings(), getDiaryStreak()]);
            setDiary(d);
            setSettingsState(s);
            setTotals(calcDiaryTotals(d));
            setDiaryStreak(streak);

            // If selected date is "today", refresh it using the saved timezone
            const tzToday = todayKey(s.timezone);
            if (selectedDate === todayKey() || selectedDate === tzToday) {
                if (selectedDate !== tzToday) setSelectedDate(tzToday);
            }
        } catch (err) {
            console.error('Diary load error:', err);
        }
    }, [selectedDate]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

    const navigateWeek = (direction) => {
        const parts = selectedDate.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + direction * 7);
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setSelectedDate(`${yy}-${mm}-${dd}`);
    };

    const navigateDay = (direction) => {
        const parts = selectedDate.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + direction);
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setSelectedDate(`${yy}-${mm}-${dd}`);
    };

    // Keep navigateDay accessible to PanResponder via ref
    const navigateDayRef = useRef(navigateDay);
    navigateDayRef.current = navigateDay;
    const navigateWeekRef = useRef(navigateWeek);
    navigateWeekRef.current = navigateWeek;

    // Override navigateDay in pan responder to use ref
    const navigateDayFromSwipe = (dir) => navigateDayRef.current(dir);

    // Re-create panResponder with ref-based navigate
    const swipePan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => {
                return Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
            },
            onPanResponderMove: (_, gs) => {
                swipeAnim.setValue(gs.dx);
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
                    Animated.timing(swipeAnim, { toValue: SCREEN_W, duration: 150, useNativeDriver: true }).start(() => {
                        navigateDayRef.current(-1);
                        swipeAnim.setValue(-SCREEN_W);
                        Animated.timing(swipeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
                    });
                } else if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -0.5) {
                    Animated.timing(swipeAnim, { toValue: -SCREEN_W, duration: 150, useNativeDriver: true }).start(() => {
                        navigateDayRef.current(1);
                        swipeAnim.setValue(SCREEN_W);
                        Animated.timing(swipeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
                    });
                } else {
                    Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const handleAddFood = (mealType) => {
        setActiveMealType(mealType);
        setAddModalVisible(true);
    };

    const handleSaveFood = async (food, slot) => {
        await addFoodToDiary(selectedDate, slot || activeMealType, food);
        await addXP(XP_AMOUNTS.FOOD_LOGGED, 'food_logged');
        await loadData();
    };

    const handleDeleteFood = (mealType, id, name) => {
        Alert.alert('Remove Food', `Remove "${name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => { await removeFoodFromDiary(selectedDate, mealType, id); await loadData(); },
            },
        ]);
    };

    const progress = settings.calorieGoal > 0 ? Math.min(totals.calories / settings.calorieGoal, 1) : 0;
    const remaining = Math.max(settings.calorieGoal - totals.calories, 0);
    const ringSize = 80;
    const strokeWidth = 6;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Sticky Header */}
            <View style={styles.stickyHeader}>
                {/* Top row: Title | Calendar & Streak */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIcon}>
                            <MaterialIcons name="menu-book" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.headerTitle}>{t('foodDiary')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => setCalendarVisible(true)}>
                            <MaterialIcons name="calendar-today" size={20} color={colors.text} />
                        </TouchableOpacity>

                        {/* Streak Indicator */}
                        {diaryStreak > 0 && (
                            <View style={[styles.streakBadge, { borderColor: colors.primary }]}>
                                <MaterialIcons name="flash-on" size={16} color={colors.primary} style={styles.streakIconGreen} />
                                <Text style={[styles.streakText, { color: colors.primary }]}>{diaryStreak}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Day Selector Strip — swipeable */}
                <View
                    style={styles.dayStrip}
                    onStartShouldSetResponder={() => false}
                    onMoveShouldSetResponder={(e, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy)}
                    onResponderRelease={(e) => {
                        const touch = e.nativeEvent;
                        // handled by individual items
                    }}
                >
                    {weekDays.map(day => {
                        const isSelected = day.key === selectedDate;
                        const isToday = day.key === todayKey();
                        return (
                            <TouchableOpacity
                                key={day.key}
                                style={[styles.dayItem, isSelected && styles.dayItemActive]}
                                onPress={() => setSelectedDate(day.key)}
                            >
                                <Text style={[styles.dayName, isSelected && styles.dayNameActive, !isSelected && styles.dayNameInactive]}>
                                    {t(day.dayName.toLowerCase())}
                                </Text>
                                <Text style={[styles.dayNum, isSelected && styles.dayNumActive, !isSelected && styles.dayNumInactive]}>
                                    {day.dayNum}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {/* Swipe hint arrows + label */}
                <View style={styles.weekViewRow}>
                    <TouchableOpacity onPress={() => navigateWeek(-1)}>
                        <MaterialIcons name="chevron-left" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.weekViewLabel}>WEEKLY VIEW</Text>
                    <TouchableOpacity onPress={() => navigateWeek(1)}>
                        <MaterialIcons name="chevron-right" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Swipeable Content */}
            <Animated.View style={{ flex: 1, transform: [{ translateX: swipeAnim }] }} {...swipePan.panHandlers}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Daily Calories Summary */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryTop}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.summaryLabel}>{t('dailyCalories')}</Text>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}
                                        onPress={() => setMyMealsVisible(true)}
                                    >
                                        <MaterialIcons name="restaurant" size={12} color={colors.primary} />
                                        <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{t('myMeals')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                        onPress={() => { setRecipesVisible(true); }}
                                    >
                                        <MaterialIcons name="menu-book" size={12} color={colors.textSecondary} />
                                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{t('recipes')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.calRow}>
                                    <Text style={styles.calBig}>{totals.calories.toLocaleString()}</Text>
                                    <Text style={styles.calGoal}>/ {settings.calorieGoal.toLocaleString()} kcal</Text>
                                </View>
                                <Text style={styles.calRemaining}>{remaining.toLocaleString()} {t('kcalRemaining')}</Text>
                            </View>
                            {/* Progress Ring */}
                            <View style={styles.ringWrap}>
                                <Svg width={ringSize} height={ringSize} style={{ transform: [{ rotate: '-90deg' }] }}>
                                    <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={colors.primary + '30'} strokeWidth={strokeWidth} fill="transparent" />
                                    <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={colors.primary} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" />
                                </Svg>
                                <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
                            </View>
                        </View>
                        {/* Macro Bars */}
                        <View style={styles.macroRow}>
                            {(() => {
                                const cal = settings.calorieGoal || 2000;
                                const m = settings.macros || {};
                                const proteinGoal = Math.round(((m.protein || 30) / 100) * cal / 4);
                                const carbsGoal = Math.round(((m.carbs || 40) / 100) * cal / 4);
                                const fatGoal = Math.round(((m.fats || 30) / 100) * cal / 9);
                                return [
                                    { label: t('protein'), val: totals.protein, goal: proteinGoal },
                                    { label: t('carbs'), val: totals.carbs, goal: carbsGoal },
                                    { label: t('fats'), val: totals.fat, goal: fatGoal },
                                ];
                            })().map(m => (
                                <View key={m.label} style={styles.macroItem}>
                                    <Text style={styles.macroLabel}>{m.label}</Text>
                                    <Text style={styles.macroVal}>{m.val}g<Text style={styles.macroGoal}>/{m.goal}g</Text></Text>
                                    <View style={styles.macroBarBg}>
                                        <View style={[styles.macroBarFill, { width: `${Math.min((m.val / m.goal) * 100, 100)}%` }]} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Meal Sections */}
                    {MEAL_SECTIONS.map(section => {
                        const foods = diary[section.key] || [];
                        const sectionCal = calcMealTypeTotal(foods);
                        const isEmpty = foods.length === 0;
                        return (
                            <View key={section.key} style={[styles.mealCard, isEmpty && styles.mealCardEmpty]}>
                                {/* Meal Header */}
                                <View style={styles.mealHeader}>
                                    <View style={styles.mealHeaderLeft}>
                                        <MaterialIcons name={section.icon} size={22} color={colors.primary} />
                                        <Text style={styles.mealTitle}>{t(section.key)}</Text>
                                    </View>
                                    <Text style={styles.mealCal}>{sectionCal > 0 ? `${sectionCal} kcal` : '-- kcal'}</Text>
                                </View>

                                {/* Food Items */}
                                <View style={styles.mealBody}>
                                    {isEmpty ? (
                                        <Text style={styles.emptyText}>{t('noFoodLogged')}</Text>
                                    ) : (
                                        foods.map(f => (
                                            <TouchableOpacity
                                                key={f.id}
                                                style={styles.foodRow}
                                                onLongPress={() => handleDeleteFood(section.key, f.id, f.name)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.foodName}>{f.name}</Text>
                                                    <Text style={styles.foodMeta}>
                                                        {f.serving ? `${f.serving} • ` : ''}P: {f.protein}g, C: {f.carbs}g, F: {f.fat}g
                                                    </Text>
                                                </View>
                                                <Text style={styles.foodCal}>{f.calories} kcal</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>

                                {/* Add Food Button */}
                                <TouchableOpacity style={styles.addFoodBtn} onPress={() => handleAddFood(section.key)}>
                                    <MaterialIcons name="add-circle" size={18} color={colors.primary} />
                                    <Text style={styles.addFoodText}>{t('addFood')}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    <View style={{ height: 100 }} />
                </ScrollView>
            </Animated.View>

            <AddFoodModal
                visible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onAdd={handleSaveFood}
                mealType={activeMealType}
            />

            <RecipesModal
                visible={recipesVisible}
                onClose={() => setRecipesVisible(false)}
                onAddToDiary={handleSaveFood}
            />

            <MyMealsModal
                visible={myMealsVisible}
                onClose={() => setMyMealsVisible(false)}
                onAddToDiary={handleSaveFood}
            />

            <CalendarPopup
                visible={calendarVisible}
                onClose={() => setCalendarVisible(false)}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                colors={colors}
                isDark={isDark}
            />
        </View>
    );
}

// ─── Styles ─────────────────────────────────────
const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Sticky Header
    stickyHeader: {
        backgroundColor: colors.headerBg,
        paddingHorizontal: 16, paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 16,
        marginHorizontal: -16,
    },
    headerBtn: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: isDark ? '#1a1a1d' : '#f0f0f0',
    },
    headerTitle: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary + '18',
        alignItems: 'center', justifyContent: 'center',
    },

    // Streak indicator
    streakBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: isDark ? '#1a1a1d' : '#e0faeb',
        borderWidth: 1, borderRadius: 12,
        shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    streakIconGreen: { textShadowColor: 'rgba(37,244,106,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
    streakText: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    // Day Strip
    dayStrip: {
        flexDirection: 'row', justifyContent: 'space-between', gap: 4,
    },
    dayItem: {
        flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12,
    },
    dayItemActive: {
        backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 14,
    },
    dayName: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', textTransform: 'uppercase', marginBottom: 2 },
    dayNameActive: { color: colors.textOnPrimary, fontFamily: 'SpaceGrotesk_700Bold' },
    dayNameInactive: { color: colors.textSecondary, opacity: 0.5 },
    dayNum: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    dayNumActive: { color: colors.textOnPrimary, fontSize: 18 },
    dayNumInactive: { color: colors.text, opacity: 0.5 },
    weekViewRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 8,
    },
    weekViewLabel: {
        color: colors.textSecondary,
        fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 2, textTransform: 'uppercase',
    },

    content: { padding: 16, gap: 16 },

    // Summary Card
    summaryCard: {
        backgroundColor: colors.bgCard, borderRadius: 20,
        padding: 20, borderWidth: 1, borderColor: colors.border,
    },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' },
    calRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
    calBig: { color: colors.text, fontSize: 34, fontFamily: 'SpaceGrotesk_700Bold' },
    calGoal: { color: colors.textSecondary, fontSize: 13 },
    calRemaining: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', marginTop: 4 },
    ringWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    ringText: { position: 'absolute', color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    // Macro Row
    macroRow: {
        flexDirection: 'row', gap: 16, marginTop: 20, paddingTop: 20,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    macroItem: { flex: 1, alignItems: 'center' },
    macroLabel: { color: colors.textSecondary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
    macroVal: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 4 },
    macroGoal: { color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },
    macroBarBg: { width: '100%', height: 4, backgroundColor: colors.primaryDim, borderRadius: 2, marginTop: 6 },
    macroBarFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },

    // Meal Card
    mealCard: {
        backgroundColor: colors.bgCard, borderRadius: 20,
        overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    },
    mealCardEmpty: { opacity: 0.75 },
    mealHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealTitle: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    mealCal: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },
    mealBody: { padding: 16, gap: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

    // Food Row
    foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    foodName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },
    foodMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    foodCal: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Add Food Button
    addFoodBtn: {
        paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, backgroundColor: colors.primaryDim,
    },
    addFoodText: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
});
