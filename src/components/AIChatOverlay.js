import React, { useState, useRef } from 'react';
import {
    View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { askNutritionQuestion } from '../services/openai';

export default function AIChatOverlay({ visible, onClose, context }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: "Hi! I'm your AI nutrition assistant. Ask me anything about your diet, meals, or fitness goals!" },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef();

    const handleSend = async () => {
        const q = input.trim();
        if (!q || loading) return;

        setInput('');
        setMessages((prev) => [...prev, { role: 'user', text: q }]);
        setLoading(true);

        try {
            const answer = await askNutritionQuestion(q, context);
            setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
        } catch {
            setMessages((prev) => [...prev, { role: 'assistant', text: "Sorry, I couldn't process that. Check your API key in Settings." }]);
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessages([
            { role: 'assistant', text: "Hi! I'm your AI nutrition assistant. Ask me anything about your diet, meals, or fitness goals!" },
        ]);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.aiIcon}>
                                <MaterialIcons name="smart-toy" size={16} color={colors.primary} />
                            </View>
                            <Text style={styles.headerTitle}>Nutrition AI</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(_, i) => i.toString()}
                        style={styles.chatList}
                        onContentSizeChange={() => listRef.current?.scrollToEnd()}
                        renderItem={({ item }) => (
                            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                                <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
                                    {item.text}
                                </Text>
                            </View>
                        )}
                    />

                    {loading && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.loadingText}>Thinking...</Text>
                        </View>
                    )}

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Can I eat peanut butter now?"
                            placeholderTextColor={colors.slate500}
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                        />
                        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                            <Text style={styles.sendIcon}>➤</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: colors.bgDark,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%',
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primaryMid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.white,
        fontSize: 16,
    },
    closeText: {
        color: colors.slate400,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    chatList: {
        flex: 1,
        padding: 16,
    },
    bubble: {
        maxWidth: '80%',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
    },
    aiBubble: {
        backgroundColor: colors.surface,
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    userBubble: {
        backgroundColor: colors.primary,
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    bubbleText: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    userBubbleText: {
        color: colors.bgDark,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    loadingText: {
        color: colors.slate400,
        fontSize: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    input: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: colors.white,
        fontSize: 14,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendIcon: {
        color: colors.bgDark,
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
});
