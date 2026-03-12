import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export default function CalorieBar({ consumed = 0, goal = 2000, protein = 0, carbs = 0, fat = 0 }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const remaining = Math.max(goal - consumed, 0);
    const progress = Math.min(consumed / goal, 1);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.label}>REMAINING BUDGET</Text>
                    <View style={styles.valueRow}>
                        <Text style={styles.bigValue}>{remaining}</Text>
                        <Text style={styles.unit}> kcal</Text>
                    </View>
                </View>
                <View style={styles.rightSide}>
                    <Text style={styles.progress}>{consumed.toLocaleString()} / {goal.toLocaleString()}</Text>
                </View>
            </View>

            <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>

            <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.macroText}>Protein: {protein}g</Text>
                </View>
                <View style={styles.macroItem}>
                    <View style={[styles.dot, { backgroundColor: colors.blue400 }]} />
                    <Text style={styles.macroText}>Carbs: {carbs}g</Text>
                </View>
                <View style={styles.macroItem}>
                    <View style={[styles.dot, { backgroundColor: colors.yellow400 }]} />
                    <Text style={styles.macroText}>Fats: {fat}g</Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    label: {
        color: colors.textMuted,
        fontSize: 10,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    bigValue: {
        fontSize: 32,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.white,
    },
    unit: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.textMuted,
    },
    rightSide: {
        alignItems: 'flex-end',
    },
    progress: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.text,
    },
    barTrack: {
        height: 10,
        backgroundColor: colors.primaryMid,
        borderRadius: 999,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
    macroRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 16,
    },
    macroItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    macroText: {
        fontSize: 11,
        color: colors.slate400,
    },
});
