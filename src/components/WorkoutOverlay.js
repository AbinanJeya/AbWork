import React, { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder,
    Dimensions, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useWorkout } from '../contexts/WorkoutContext';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';

const { height: SCREEN_H } = Dimensions.get('window');
const TAB_BAR_H = 80;
const BAR_H = 64;
const SNAP_THRESHOLD = 120; // px drag to trigger snap

export default function WorkoutOverlay() {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const workout = useWorkout();
    const { activeWorkout, isExpanded, restTimer, restDuration } = workout;

    // translateY: 0 = fully expanded, SCREEN_H = off-screen
    const translateY = useRef(new Animated.Value(SCREEN_H)).current;
    const elapsed = useRef(0);
    const [, forceUpdate] = React.useState(0);

    // Tick elapsed while minimized
    useEffect(() => {
        if (!activeWorkout) return;
        const interval = setInterval(() => {
            elapsed.current = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
            workout.elapsedRef.current = elapsed.current;
            if (!isExpanded) forceUpdate(n => n + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeWorkout, isExpanded]);

    // Animate on expand/minimize
    useEffect(() => {
        if (!activeWorkout) {
            Animated.timing(translateY, {
                toValue: SCREEN_H, duration: 300, useNativeDriver: true,
            }).start();
            return;
        }
        Animated.spring(translateY, {
            toValue: isExpanded ? 0 : SCREEN_H,
            damping: 25, stiffness: 200, mass: 1, useNativeDriver: true,
        }).start();
    }, [isExpanded, !!activeWorkout]);

    // Keep a ref to workout so PanResponder's closure isn't stale
    const workoutRef = useRef(workout);
    workoutRef.current = workout;

    // PanResponder for drag-to-minimize
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => {
                if (workoutRef.current?.isModalOpen) return false;
                return gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx);
            },
            onPanResponderMove: (_, gs) => {
                if (gs.dy > 0) {
                    translateY.setValue(gs.dy);
                }
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > SNAP_THRESHOLD || gs.vy > 0.5) {
                    // Animate fully off screen, THEN minimize state
                    Animated.timing(translateY, {
                        toValue: SCREEN_H, duration: 250, useNativeDriver: true,
                    }).start(() => {
                        const w = workoutRef.current;
                        w.minimizeWorkout(w.activeWorkout?.exerciseLogs || []);
                    });
                } else {
                    // Snap back to fully expanded
                    Animated.spring(translateY, {
                        toValue: 0, damping: 25, stiffness: 200, useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    if (!activeWorkout) return null;

    const e = elapsed.current;
    const hrs = String(Math.floor(e / 3600)).padStart(2, '0');
    const mins = String(Math.floor((e % 3600) / 60)).padStart(2, '0');
    const secs = String(e % 60).padStart(2, '0');

    return (
        <>
            {/* Minimized bar — show when not expanded */}
            {!isExpanded && (
                <TouchableOpacity
                    style={[styles.miniBar, { bottom: TAB_BAR_H + 8 }]}
                    onPress={() => workout.expandWorkout()}
                    activeOpacity={0.9}
                >
                    <View style={styles.miniBarInner}>
                        <View style={styles.miniBarLeft}>
                            <View style={styles.miniIconWrap}>
                                <MaterialIcons name="timer" size={18} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.miniLabel}>ACTIVE WORKOUT</Text>
                                <Text style={styles.miniTitle} numberOfLines={1}>
                                    {activeWorkout.routine.name}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.miniBarRight}>
                            {restTimer !== null && restTimer > 0 && (
                                <View style={styles.miniRestWrap}>
                                    <View style={[styles.miniRestProgress, { width: `${(restTimer / Math.max(1, restDuration)) * 100}%` }]} />
                                    <MaterialIcons name="timer" size={12} color={colors.primary} />
                                    <Text style={styles.miniRestText}>
                                        {String(Math.floor(restTimer / 60)).padStart(2, '0')}:{String(restTimer % 60).padStart(2, '0')}
                                    </Text>
                                </View>
                            )}
                            <View style={[styles.miniTimeCol, restTimer !== null && restTimer > 0 && { display: 'none' }]}>
                                <Text style={styles.miniTimeLabel}>TOTAL TIME</Text>
                                <Text style={styles.miniTimeValue}>
                                    {hrs}:{mins}:<Text style={styles.miniTimeSecs}>{secs}</Text>
                                </Text>
                            </View>
                            <MaterialIcons name="expand-less" size={22} color={isDark ? '#71717a' : '#9ca3af'} />
                        </View>
                    </View>
                </TouchableOpacity>
            )}

            {/* Full workout panel — animated slide */}
            <Animated.View
                style={[styles.overlay, { transform: [{ translateY }] }]}
                {...panResponder.panHandlers}
            >
                <ActiveWorkoutScreen isOverlay={true} />
            </Animated.View>
        </>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    // Minimized bar
    miniBar: {
        position: 'absolute', left: 12, right: 12,
        zIndex: 50,
    },
    miniBarInner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        borderWidth: 2, borderColor: colors.primary,
        borderRadius: 16,
        paddingHorizontal: 16, paddingVertical: 12,
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 }, elevation: 20,
    },
    miniBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    miniIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: isDark ? '#27272a' : '#f0f0f0',
        alignItems: 'center', justifyContent: 'center',
    },
    miniLabel: {
        color: colors.primary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase',
    },
    miniTitle: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 1 },
    miniBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    miniTimeCol: { alignItems: 'flex-end' },
    miniTimeLabel: {
        color: isDark ? '#71717a' : '#9ca3af', fontSize: 8, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase',
    },
    miniTimeValue: { color: colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] },
    miniTimeSecs: { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' },

    miniRestWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4,
        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.1)',
        borderRadius: 8,
        position: 'relative', overflow: 'hidden',
    },
    miniRestProgress: {
        position: 'absolute', top: 0, bottom: 0, left: 0,
        backgroundColor: colors.primary,
        opacity: 0.15,
    },
    miniRestText: {
        color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums']
    },

    // Full overlay
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isDark ? '#0c0d0c' : '#f5f5f5',
        zIndex: 100,
    },
});
