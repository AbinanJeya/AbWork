import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

export function SnackCard({ name, calories, prepTime, tag, image }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    return (
        <View style={styles.snackCard}>
            {image ? (
                <Image source={{ uri: image }} style={styles.snackImage} />
            ) : (
                <View style={[styles.snackImage, { backgroundColor: colors.surface }]}>
                    <MaterialIcons name="restaurant" size={32} color={colors.primary} />
                </View>
            )}
            <View style={styles.snackBody}>
                <Text style={styles.snackName} numberOfLines={1}>{name}</Text>
                <View style={styles.snackMeta}>
                    <Text style={styles.metaText}>⏱ {prepTime} • {calories} kcal</Text>
                </View>
                {tag && (
                    <View style={styles.tagContainer}>
                        <Text style={styles.tag}>{tag}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

export function MealListCard({ name, protein, carbs, fat, calories, prepTime, image }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    return (
        <View style={styles.mealListCard}>
            {image ? (
                <Image source={{ uri: image }} style={styles.mealThumb} />
            ) : (
                <View style={[styles.mealThumb, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                    <MaterialIcons name="restaurant-menu" size={28} color={colors.textSecondary} />
                </View>
            )}
            <View style={styles.mealBody}>
                <View>
                    <Text style={styles.mealName}>{name}</Text>
                    <Text style={styles.mealMacros}>
                        {protein}g Protein • {carbs}g Carbs • {fat}g Fat
                    </Text>
                </View>
                <View style={styles.mealFooter}>
                    <Text style={styles.mealCal}>{calories} kcal</Text>
                    {prepTime && (
                        <View style={styles.timeRow}>
                            <Text style={styles.timeText}>⏱ {prepTime}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    // Snack card (horizontal scroll)
    snackCard: {
        width: 220,
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    snackImage: {
        width: '100%',
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    snackBody: {
        padding: 12,
    },
    snackName: {
        color: colors.white,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
    },
    snackMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    metaText: {
        color: colors.textMuted,
        fontSize: 11,
    },
    tagContainer: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    tag: {
        backgroundColor: colors.primaryDim,
        color: colors.primary,
        fontSize: 9,
        fontFamily: 'SpaceGrotesk_700Bold',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        overflow: 'hidden',
    },

    // Meal list card
    mealListCard: {
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        gap: 12,
    },
    mealThumb: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    mealBody: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    mealName: {
        color: colors.white,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
    },
    mealMacros: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 4,
    },
    mealFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mealCal: {
        color: colors.primary,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 14,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        color: colors.textMuted,
        fontSize: 11,
    },
});
