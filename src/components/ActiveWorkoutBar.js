import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useWorkout } from '../contexts/WorkoutContext';

export default function ActiveWorkoutBar() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const navigation = useNavigation();
    const { activeWorkout, isMinimized, restoreWorkout, elapsedRef } = useWorkout();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!activeWorkout || !isMinimized) return;
        // Keep counting elapsed time while minimized
        const interval = setInterval(() => {
            const totalElapsed = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
            setElapsed(totalElapsed);
            elapsedRef.current = totalElapsed;
        }, 1000);
        return () => clearInterval(interval);
    }, [activeWorkout, isMinimized]);

    if (!activeWorkout || !isMinimized) return null;

    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');

    const handleOpen = () => {
        restoreWorkout();
        navigation.navigate('ActiveWorkout', { routine: activeWorkout.routine, restored: true });
    };

    return (
        <TouchableOpacity style={styles.bar} onPress={handleOpen} activeOpacity={0.85}>
            <View style={styles.barLeft}>
                <View style={styles.iconWrap}>
                    <MaterialIcons name="fitness-center" size={16} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.barLabel}>ACTIVE WORKOUT</Text>
                    <Text style={styles.barTitle}>{activeWorkout.routine.name}</Text>
                </View>
            </View>
            <View style={styles.barRight}>
                <Text style={styles.timeLabel}>TOTAL TIME</Text>
                <Text style={styles.timeValue}>
                    {hrs}:{mins}:<Text style={styles.timeSecs}>{secs}</Text>
                </Text>
            </View>
            <MaterialIcons name="expand-less" size={20} color={isDark ? '#71717a' : '#9ca3af'} />
        </TouchableOpacity>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    bar: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isDark ? '#111112' : colors.bgCard,
        borderTopWidth: 1.5, borderTopColor: colors.primary,
        borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : colors.border,
        paddingHorizontal: 16, paddingVertical: 10,
        gap: 10,
    },
    barLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: isDark ? '#1a2810' : '#e8f5e0',
        borderWidth: 1, borderColor: isDark ? '#2d4a1a' : '#b3e6a0',
        alignItems: 'center', justifyContent: 'center',
    },
    barLabel: {
        color: colors.primary, fontSize: 8, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase',
    },
    barTitle: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 1 },
    barRight: { alignItems: 'flex-end', marginRight: 4 },
    timeLabel: {
        color: isDark ? '#71717a' : '#9ca3af', fontSize: 8, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase',
    },
    timeValue: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] },
    timeSecs: { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' },
});
