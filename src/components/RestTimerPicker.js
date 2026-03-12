import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export default function RestTimerPicker({ visible, onClose, initialValue, onDone }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [minutes, setMinutes] = useState('0');
    const [seconds, setSeconds] = useState('0');
    const [activeField, setActiveField] = useState('min'); // 'min' or 'sec'

    useEffect(() => {
        if (visible && initialValue) {
            // Parse "MM:SS" or total seconds
            if (typeof initialValue === 'string' && initialValue.includes(':')) {
                const [m, s] = initialValue.split(':');
                setMinutes(parseInt(m) || 0 + '');
                setSeconds(parseInt(s) || 0 + '');
            } else {
                const total = parseInt(initialValue) || 0;
                setMinutes(Math.floor(total / 60) + '');
                setSeconds((total % 60) + '');
            }
            setActiveField('min');
        }
    }, [visible]);

    const handlePress = (key) => {
        if (activeField === 'min') {
            if (key === 'DEL') {
                setMinutes(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
            } else if (key !== '.') {
                const newVal = minutes === '0' ? key : minutes + key;
                if (parseInt(newVal) <= 59) setMinutes(newVal);
            }
        } else {
            if (key === 'DEL') {
                setSeconds(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
            } else if (key !== '.') {
                const newVal = seconds === '0' ? key : seconds + key;
                if (parseInt(newVal) <= 59) setSeconds(newVal);
            }
        }
    };

    const addQuickTime = (secs) => {
        let total = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0) + secs;
        if (total > 3599) total = 3599; // cap at 59:59
        setMinutes(Math.floor(total / 60) + '');
        setSeconds((total % 60) + '');
    };

    const handleDone = () => {
        const m = parseInt(minutes) || 0;
        const s = Math.min(parseInt(seconds) || 0, 59);
        const totalSecs = m * 60 + s;
        const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        onDone(formatted, totalSecs);
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
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.overlayBg} onPress={onClose} activeOpacity={1} />
                <View style={styles.sheet}>
                    {/* Header */}
                    <Text style={styles.headerLabel}>REST TIMER</Text>

                    {/* MM:SS Display */}
                    <View style={styles.timeRow}>
                        <TouchableOpacity
                            style={[styles.timeBox, activeField === 'min' && styles.timeBoxActive]}
                            onPress={() => setActiveField('min')}
                        >
                            <Text style={styles.timeBoxLabel}>MIN</Text>
                            <Text style={[styles.timeBoxValue, activeField === 'min' && styles.timeBoxValueActive]}>
                                {String(minutes).padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.timeSeparator}>:</Text>
                        <TouchableOpacity
                            style={[styles.timeBox, activeField === 'sec' && styles.timeBoxActive]}
                            onPress={() => setActiveField('sec')}
                        >
                            <Text style={styles.timeBoxLabel}>SEC</Text>
                            <Text style={[styles.timeBoxValue, activeField === 'sec' && styles.timeBoxValueActive]}>
                                {String(Math.min(parseInt(seconds) || 0, 59)).padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Presets */}
                    <View style={styles.presetRow}>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => addQuickTime(30)}>
                            <Text style={styles.presetText}>+ 30s</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => addQuickTime(60)}>
                            <Text style={styles.presetText}>+ 60s</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => addQuickTime(90)}>
                            <Text style={styles.presetText}>+ 90s</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Keypad */}
                    <View style={styles.keypad}>
                        {KEYS.map((row, ri) => (
                            <View key={ri} style={styles.keyRow}>
                                {row.map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.key, key === '.' && styles.keyDisabled]}
                                        onPress={() => handlePress(key)}
                                        activeOpacity={key === '.' ? 1 : 0.6}
                                        disabled={key === '.'}
                                    >
                                        {key === 'DEL' ? (
                                            <Text style={styles.keyText}>&#x232B;</Text>
                                        ) : key === '.' ? (
                                            <Text style={[styles.keyText, { opacity: 0.2 }]}>.</Text>
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
                </View>
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
        paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32,
        borderWidth: 1, borderColor: colors.border,
    },
    headerLabel: {
        color: '#9ca3af', fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16,
    },

    timeRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 16,
    },
    timeBox: {
        backgroundColor: colors.bgCard, borderRadius: 16, paddingVertical: 12,
        paddingHorizontal: 24, alignItems: 'center', minWidth: 100,
        borderWidth: 1, borderColor: colors.border,
    },
    timeBoxActive: { borderColor: colors.primary },
    timeBoxLabel: {
        color: '#6b7280', fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
    },
    timeBoxValue: { color: '#fff', fontSize: 36, fontFamily: 'SpaceGrotesk_700Bold' },
    timeBoxValueActive: { color: colors.primary },
    timeSeparator: { color: '#6b7280', fontSize: 36, fontFamily: 'SpaceGrotesk_700Bold' },

    presetRow: {
        flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center',
    },
    presetBtn: {
        backgroundColor: colors.primary + '15', borderRadius: 20,
        paddingHorizontal: 20, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.primary + '30',
    },
    presetText: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

    keypad: { gap: 8, marginBottom: 16 },
    keyRow: { flexDirection: 'row', gap: 8 },
    key: {
        flex: 1, height: 52, borderRadius: 12, backgroundColor: colors.bgCard,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    keyDisabled: { opacity: 0.3 },
    keyText: { color: '#fff', fontSize: 22, fontFamily: 'SpaceGrotesk_600SemiBold' },

    doneBtn: {
        backgroundColor: colors.primary, borderRadius: 14,
        paddingVertical: 16, alignItems: 'center',
    },
    doneBtnText: { color: '#000', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
