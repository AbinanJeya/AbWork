import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, useTheme } from '../theme';

export default function StepRing({ steps = 0, goal = 10000, size = 220 }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(steps / goal, 1);
    const dashOffset = circumference * (1 - progress);
    const center = size / 2;

    return (
        <View style={styles.container}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={colors.surfaceLight}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={colors.primary}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                />
            </Svg>
            <View style={styles.centerContent}>
                <MaterialCommunityIcons name="shoe-print" size={28} color={colors.primary} style={{ marginBottom: 4 }} />
                <Text style={styles.count}>{steps.toLocaleString()}</Text>
                <Text style={styles.goal}>/ {goal.toLocaleString()} steps</Text>
            </View>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    centerContent: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 28,
        marginBottom: 4,
    },
    count: {
        fontSize: 36,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    goal: {
        fontSize: 14,
        color: colors.slate400,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
});
