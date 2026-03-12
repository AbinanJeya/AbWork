import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, Animated } from 'react-native';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export default function ExerciseActionModal({
    visible,
    onClose,
    onReplace,
    onRemove,
    title = 'Exercise',
    showEdit = false,
    onEdit,
    onMoveUp,
    onMoveDown
}) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = getStyles(colors, isDark);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={1}>{title}</Text>
                        <Text style={styles.subtitle}>Options</Text>
                    </View>

                    <View style={styles.actionList}>
                        {showEdit && (
                            <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
                                <View style={styles.actionIconBox}>
                                    <MaterialIcons name="edit" size={22} color={colors.text} />
                                </View>
                                <Text style={styles.actionText}>Edit Name</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.actionBtn} onPress={onReplace}>
                            <View style={styles.actionIconBox}>
                                <MaterialIcons name="swap-horiz" size={24} color={colors.text} />
                            </View>
                            <Text style={styles.actionText}>Replace Exercise</Text>
                        </TouchableOpacity>

                        {onMoveUp && (
                            <TouchableOpacity style={styles.actionBtn} onPress={onMoveUp}>
                                <View style={styles.actionIconBox}>
                                    <MaterialIcons name="arrow-upward" size={24} color={colors.text} />
                                </View>
                                <Text style={styles.actionText}>Move Up</Text>
                            </TouchableOpacity>
                        )}

                        {onMoveDown && (
                            <TouchableOpacity style={styles.actionBtn} onPress={onMoveDown}>
                                <View style={styles.actionIconBox}>
                                    <MaterialIcons name="arrow-downward" size={24} color={colors.text} />
                                </View>
                                <Text style={styles.actionText}>Move Down</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.actionBtnDanger} onPress={onRemove}>
                            <View style={[styles.actionIconBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2' }]}>
                                <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
                            </View>
                            <Text style={styles.actionTextDanger}>Remove Exercise</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function getStyles(colors, isDark) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.6)',
        },
        sheet: {
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 12,
            elevation: 10,
            borderWidth: 1, borderColor: colors.border,
        },
        handleContainer: {
            alignItems: 'center',
            marginBottom: 16,
        },
        handle: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? '#3f3f46' : '#e5e7eb',
        },
        header: {
            marginBottom: 20,
            alignItems: 'flex-start',
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textSecondary,
        },
        actionList: {
            gap: 12,
            marginBottom: 24,
        },
        actionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bgCard,
            padding: 12,
            borderRadius: 16,
            borderWidth: 1, borderColor: colors.border,
        },
        actionBtnDanger: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bgCard,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            borderRadius: 16,
        },
        actionIconBox: {
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: isDark ? '#3f3f46' : '#e5e7eb',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        actionText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        actionTextDanger: {
            fontSize: 16,
            fontWeight: '600',
            color: '#ef4444',
        },
        cancelBtn: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            backgroundColor: colors.bgCard,
            borderRadius: 16,
            borderWidth: 1, borderColor: colors.border,
        },
        cancelBtnText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
    });
}
