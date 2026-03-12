import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, PanResponder, Animated } from 'react-native';
import { useTheme } from '../theme';

const LB_TO_KG = 0.453592;
const KG_TO_LB = 2.20462;

export default function WeightKeypad({ visible, onClose, initialValue, initialUnit, onDone, label, showUnitToggle = true }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [value, setValue] = useState('');
    const [unit, setUnit] = useState('LBS');

    const panY = useRef(new Animated.Value(0)).current;

    const resetPan = () => {
        Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
        }).start();
    };

    const closeAnim = () => {
        Animated.timing(panY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            onClose();
        });
    };

    useEffect(() => {
        if (visible) {
            setValue(initialValue || '');
            setUnit(initialUnit || 'LBS');
            panY.setValue(0);
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 4,
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => Math.abs(gestureState.dy) > 4,
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dy > 120 || gestureState.vy > 1.0) {
                    closeAnim();
                } else {
                    resetPan();
                }
            }
        })
    ).current;

    const handlePress = (key) => {
        if (key === 'DEL') {
            setValue(prev => prev.slice(0, -1));
        } else if (key === '.') {
            if (!value.includes('.')) setValue(prev => prev + '.');
        } else {
            // If value is just '0', replace it with the new digit
            if (value === '0') {
                setValue(key);
            } else if (value.replace('.', '').length < 5) {
                setValue(prev => prev + key);
            }
        }
    };

    const toggleUnit = (newUnit) => {
        if (newUnit === unit) return;
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) {
            const converted = newUnit === 'KG' ? num * LB_TO_KG : num * KG_TO_LB;
            setValue(converted % 1 === 0 ? converted.toFixed(0) : converted.toFixed(1));
        }
        setUnit(newUnit);
    };

    const handleDone = () => {
        onDone(value || '0', unit);
        onClose();
    };

    const KEYS = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'DEL'],
    ];

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay} {...panResponder.panHandlers}>
                <TouchableOpacity style={styles.overlayBg} onPress={onClose} activeOpacity={1} />
                <Animated.View style={[styles.sheet, { transform: [{ translateY: panY }] }]}>
                    {/* Drag Handle */}
                    <View style={styles.dragHandle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerLabel}>{label || 'WEIGHT VALUE'}</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.valueText}>{value || '0'}</Text>
                                {showUnitToggle && <Text style={styles.unitLabel}>{unit}</Text>}
                            </View>
                        </View>
                        {/* KG / LBS Toggle */}
                        {showUnitToggle && (
                            <View style={styles.togglePill}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, unit === 'KG' && styles.toggleBtnActive]}
                                    onPress={() => toggleUnit('KG')}
                                >
                                    <Text style={[styles.toggleText, unit === 'KG' && styles.toggleTextActive]}>KG</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, unit === 'LBS' && styles.toggleBtnActive]}
                                    onPress={() => toggleUnit('LBS')}
                                >
                                    <Text style={[styles.toggleText, unit === 'LBS' && styles.toggleTextActive]}>LBS</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Keypad */}
                    <View style={styles.keypad}>
                        {KEYS.map((row, ri) => (
                            <View key={ri} style={styles.keyRow}>
                                {row.map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.key}
                                        onPress={() => handlePress(key)}
                                        activeOpacity={0.6}
                                    >
                                        {key === 'DEL' ? (
                                            <Text style={styles.keyText}>&#x232B;</Text>
                                        ) : (
                                            <Text style={styles.keyText}>{key}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}
                    </View>

                    {/* Done Button */}
                    <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        backgroundColor: colors.bg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
        borderWidth: 1, borderColor: colors.border,
    },
    dragHandle: {
        width: 40, height: 4, backgroundColor: '#4b5563',
        borderRadius: 2, alignSelf: 'center', marginBottom: 16,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24,
    },
    headerLabel: {
        color: '#9ca3af', fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
    },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    valueText: { color: colors.primary, fontSize: 42, fontFamily: 'SpaceGrotesk_700Bold' },
    unitLabel: { color: '#6b7280', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },

    togglePill: {
        flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 20,
        padding: 3, marginTop: 8, borderWidth: 1, borderColor: colors.border,
    },
    toggleBtn: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 17 },
    toggleBtnActive: { backgroundColor: colors.primary },
    toggleText: { color: '#6b7280', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
    toggleTextActive: { color: '#000' },

    keypad: { gap: 8, marginBottom: 16 },
    keyRow: { flexDirection: 'row', gap: 8 },
    key: {
        flex: 1, height: 56, borderRadius: 12, backgroundColor: colors.bgCard,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    keyText: { color: '#fff', fontSize: 22, fontFamily: 'SpaceGrotesk_600SemiBold' },

    doneBtn: {
        backgroundColor: colors.primary, borderRadius: 14,
        paddingVertical: 16, alignItems: 'center',
    },
    doneBtnText: { color: '#000', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
