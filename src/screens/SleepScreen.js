import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, G } from 'react-native-svg';
import { fetchSleepData, checkGrantedPermissions, requestHealthPermissions } from '../services/health';
import { getSettings } from '../services/storage';

export default function SleepScreen() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [sleepData, setSleepData] = useState({
        totalMinutes: 0,
        awakeMinutes: 0,
        lightMinutes: 0,
        deepMinutes: 0,
        remMinutes: 0,
        score: 0,
        sessions: 0
    });

    const loadSleep = useCallback(async () => {
        setLoading(true);
        try {
            // First check if user has specifically disabled Sleep sync in granular settings
            const s = await getSettings();
            const conn = s.wearableConnections?.health_connect;
            if (typeof conn === 'object' && !conn.syncSleep) {
                console.log("[SleepScreen] Sync Sleep is disabled in granular settings.");
                setLoading(false);
                return; // Leave sleepData at 0s, triggering the disabled UI state
            }
            let hasPerms = await checkGrantedPermissions();
            if (!hasPerms) {
                console.log("[SleepScreen] Missing granular sleep permissions. Triggering OS prompt...");
                hasPerms = await requestHealthPermissions();
                if (!hasPerms) {
                    console.log("[SleepScreen] User rejected sleep permission prompt.");
                    setLoading(false);
                    return;
                }
            }

            // Massive 36 Hour Window:
            // Searches from 12:00 PM (Noon) yesterday up through 23:59 PM (Midnight) of the target day
            const endWindow = new Date(selectedDate);
            endWindow.setHours(23, 59, 59, 999);
            const startWindow = new Date(endWindow.getTime() - (24 * 60 * 60 * 1000));
            startWindow.setHours(12, 0, 0, 0);

            const data = await fetchSleepData(startWindow, endWindow);

            if (data) {
                setSleepData(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadSleep();
    }, [loadSleep]);

    // Graph Constants
    const radius = 90;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;
    const center = radius + strokeWidth;
    const size = center * 2;

    const totalMin = sleepData.totalMinutes || 1; // Prevent div by 0

    const stageColors = {
        awake: '#ff7f50', // Orange
        light: '#38bdf8', // Light blue
        deep: '#1d4ed8',  // Deep blue
        rem: '#a855f7'    // Purple
    };

    const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const getDateLabel = () => {
        const today = new Date();
        const isToday =
            selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();

        if (isToday) return 'Today';

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const isYesterday =
            selectedDate.getDate() === yesterday.getDate() &&
            selectedDate.getMonth() === yesterday.getMonth() &&
            selectedDate.getFullYear() === yesterday.getFullYear();

        if (isYesterday) return 'Yesterday';

        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return selectedDate.toLocaleDateString('en-US', options);
    };

    const handlePrevDay = () => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        setSelectedDate(prev);
    };

    const handleNextDay = () => {
        const today = new Date();
        // Prevent going into the future
        if (selectedDate.getDate() === today.getDate() && selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear()) {
            return;
        }
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        setSelectedDate(next);
    };

    // Check if next button should be disabled (can't see future sleep)
    const isToday = (() => {
        const today = new Date();
        return selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();
    })();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sleep Analysis</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <MaterialIcons name="share" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Date Bar */}
                <View style={styles.dateBar}>
                    <TouchableOpacity style={styles.dateBtn} onPress={handlePrevDay}>
                        <MaterialIcons name="chevron-left" size={26} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.dateText}>{getDateLabel()}</Text>
                    <TouchableOpacity
                        style={[styles.dateBtn, isToday && { opacity: 0.3 }]}
                        onPress={handleNextDay}
                        disabled={isToday}
                    >
                        <MaterialIcons name="chevron-right" size={26} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : (
                    <>
                        {/* Circular Progress Section */}
                        <View style={styles.heroSection}>
                            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                                    <G rotation="-90" origin={`${center}, ${center}`}>
                                        {/* Background Track */}
                                        <Circle
                                            cx={center} cy={center} r={radius}
                                            stroke={isDark ? colors.surface : "#E2E8F0"}
                                            strokeWidth={strokeWidth}
                                            fill="none"
                                        />

                                        {sleepData.totalMinutes > 0 && (
                                            <>
                                                {(() => {
                                                    let cumulativeOffset = circumference;

                                                    // Create 4 simple slices representing the gross totals
                                                    const pieSlices = [
                                                        { type: 'deep', minutes: sleepData.deepMinutes },
                                                        { type: 'light', minutes: sleepData.lightMinutes },
                                                        { type: 'rem', minutes: sleepData.remMinutes },
                                                        { type: 'awake', minutes: sleepData.awakeMinutes },
                                                    ].filter(s => s.minutes > 0);

                                                    return pieSlices.map((slice, index) => {
                                                        const segRatio = slice.minutes / totalMin;
                                                        const segStrokeLength = circumference * segRatio;
                                                        const emptySpace = circumference - segStrokeLength;

                                                        const offsetForThisSeg = cumulativeOffset;
                                                        cumulativeOffset -= segStrokeLength;

                                                        return (
                                                            <Circle
                                                                key={index}
                                                                cx={center} cy={center} r={radius}
                                                                stroke={stageColors[slice.type] || stageColors.light}
                                                                strokeWidth={strokeWidth}
                                                                fill="none"
                                                                strokeDasharray={`${segStrokeLength} ${emptySpace}`}
                                                                strokeDashoffset={offsetForThisSeg}
                                                                strokeLinecap="butt" // Keeps the blocks perfectly square against each other
                                                            />
                                                        );
                                                    });
                                                })()}
                                            </>
                                        )}
                                    </G>
                                </Svg>

                                <View style={styles.centerContents}>
                                    <Text style={styles.centerLabel}>Total Time</Text>
                                    <Text style={styles.centerValue}>{formatTime(sleepData.totalMinutes)}</Text>
                                    {sleepData.totalMinutes > 0 && (
                                        <Text style={styles.centerTrend}>Score {sleepData.score}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Legend */}
                            {sleepData.totalMinutes > 0 ? (
                                <View style={styles.legendGrid}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#ff7f50' }]} />
                                        <Text style={styles.legendText}>Awake ({formatTime(sleepData.awakeMinutes)})</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#a855f7' }]} />
                                        <Text style={styles.legendText}>REM ({formatTime(sleepData.remMinutes)})</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
                                        <Text style={styles.legendText}>Light ({formatTime(sleepData.lightMinutes)})</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#1d4ed8' }]} />
                                        <Text style={styles.legendText}>Deep ({formatTime(sleepData.deepMinutes)})</Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={[styles.legendText, { marginTop: 20, textAlign: 'center', lineHeight: 22 }]}>
                                    No sleep data recorded for last night.{'\n'}
                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Make sure 'Sync Sleep Data' is enabled in Wearable Integrations.</Text>
                                </Text>
                            )}
                        </View>

                        {/* Sleep Factors */}
                        <View style={styles.factorsSection}>
                            <Text style={styles.factorsTitle}>Sleep Factors</Text>

                            <View style={styles.factorCard}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconBg, { backgroundColor: colors.primary + '20' }]}>
                                        <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
                                    </View>
                                    <View style={styles.cardTextCol}>
                                        <Text style={styles.cardTitle}>Sleep Quality</Text>
                                        <Text style={styles.cardSubtitle}>Based on deep & REM ratios</Text>
                                    </View>
                                </View>
                                <Text style={[styles.cardValue, { color: colors.primary }]}>{sleepData.score}%</Text>
                            </View>

                            <View style={styles.factorCard}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconBg, { backgroundColor: colors.primary + '20' }]}>
                                        <MaterialIcons name="sync" size={22} color={colors.primary} />
                                    </View>
                                    <View style={styles.cardTextCol}>
                                        <Text style={styles.cardTitle}>Interruptions</Text>
                                        <Text style={styles.cardSubtitle}>Tracked periods awake</Text>
                                    </View>
                                </View>
                                <Text style={[styles.cardValue, { color: colors.primary }]}>
                                    {sleepData.awakeMinutes > 40 ? 'High' : (sleepData.awakeMinutes > 15 ? 'Normal' : 'Low')}
                                </Text>
                            </View>

                            <View style={styles.factorCard}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconBg, { backgroundColor: colors.primary + '20' }]}>
                                        <MaterialIcons name="nightlight-round" size={22} color={colors.primary} />
                                    </View>
                                    <View style={styles.cardTextCol}>
                                        <Text style={styles.cardTitle}>Efficiency</Text>
                                        <Text style={styles.cardSubtitle}>Time asleep vs in bed</Text>
                                    </View>
                                </View>
                                <Text style={styles.cardValueBlank}>
                                    {sleepData.totalMinutes > 0 ? 'Good' : '--'}
                                </Text>
                            </View>

                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.bgDark,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
    },
    iconBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    dateBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.bgDark,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
    },
    dateBtn: {
        padding: 8,
        borderRadius: 20,
    },
    dateText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        color: colors.text,
    },
    content: {
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
    },
    centerContents: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerLabel: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.textSecondary,
    },
    centerValue: {
        fontSize: 36,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
        marginVertical: 4,
    },
    centerTrend: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        color: colors.primary,
    },
    legendGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        marginTop: 32,
        gap: 16,
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '45%',
        gap: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.text,
    },
    factorsSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    factorsTitle: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    factorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isDark ? colors.card : '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'transparent',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBg: {
        padding: 10,
        borderRadius: 12,
    },
    cardTextCol: {
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    cardSubtitle: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.textSecondary,
        marginTop: 2,
    },
    cardValue: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    cardValueBlank: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    }
});
