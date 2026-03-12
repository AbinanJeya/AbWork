import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

const icons = {
    run: 'directions-run',
    strength: 'fitness-center',
    cardio: 'favorite',
    yoga: 'self-improvement',
    cycling: 'directions-bike',
    swimming: 'pool',
    default: 'fitness-center',
};

export default function WorkoutCard({ name, type, duration, time, caloriesBurned, completed, onToggle, opacity = 1 }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const icon = icons[type] || icons.default;

    const iconColors = {
        run: { bg: colors.blueBg, text: colors.blue500 },
        strength: { bg: colors.orangeBg, text: colors.orange500 },
        cardio: { bg: colors.orangeBg, text: colors.orange500 },
        yoga: { bg: 'rgba(168,85,247,0.1)', text: '#a855f7' },
        cycling: { bg: colors.primaryDim, text: colors.primary },
        swimming: { bg: colors.blueBg, text: colors.blue500 },
        default: { bg: colors.primaryDim, text: colors.primary },
    };

    const typeColors = iconColors[type] || iconColors.default;

    return (
        <View style={[styles.card, { opacity }]}>
            <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: typeColors.bg }]}>
                    <MaterialIcons name={icon} size={22} color={typeColors.text} />
                </View>
                <View style={styles.body}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.meta}>
                        {time ? `${time}` : 'Completed'}
                    </Text>
                </View>
                {duration !== undefined && (
                    <View style={styles.calCol}>
                        <Text style={styles.calValue}>{duration}</Text>
                        <Text style={styles.calLabel}>MIN</Text>
                    </View>
                )}
                {onToggle && (
                    <TouchableOpacity onPress={onToggle} style={styles.checkArea}>
                        <View style={[styles.checkbox, completed && styles.checkboxChecked]}>
                            {completed && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    card: {
        backgroundColor: colors.cardBg || colors.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.borderLight || colors.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 22,
    },
    body: {
        flex: 1,
    },
    name: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
        color: colors.text,
    },
    meta: {
        fontSize: 12,
        color: colors.slate400,
        marginTop: 2,
    },
    calCol: {
        alignItems: 'flex-end',
    },
    calValue: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
    },
    calLabel: {
        fontSize: 9,
        color: colors.slate500,
        textTransform: 'uppercase',
    },
    checkArea: {
        padding: 4,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.primaryGlow,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    checkmark: {
        color: colors.bgDark,
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
});
