import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
    Share, Alert, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { getLeaderboard, getInviteLink, formatSteps } from '../services/friends';
import { getSettings, getUserProfile, getStepAverage } from '../services/storage';
import { getTodayStepCount } from '../services/pedometer';
import * as Clipboard from 'expo-clipboard';

export default function LeaderboardScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();

    const [period, setPeriod] = useState('weekly');
    const [leaderboard, setLeaderboard] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);

    useFocusEffect(
        useCallback(() => { loadData(); }, [period])
    );

    const loadData = async () => {
        const profile = await getUserProfile();
        const s = await getSettings();
        const steps = await getTodayStepCount();
        const userName = profile?.firstName || 'You';
        const stepGoal = s.stepGoal || 10000;

        // Daily = today's steps, Weekly = 7-day avg, Monthly = 30-day avg
        let userSteps;
        if (period === 'daily') {
            userSteps = steps;
        } else if (period === 'weekly') {
            userSteps = await getStepAverage(7);
        } else {
            userSteps = await getStepAverage(30);
        }

        const data = getLeaderboard(period, userSteps, userName, stepGoal);
        setLeaderboard(data);

        const link = await getInviteLink();
        setInviteLink(link);
    };

    const handleShare = async () => {
        const link = await getInviteLink();
        setInviteLink(link);
        setShowInvite(true);
    };

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShareInvite = async () => {
        try {
            await Share.share({
                message: `Join me on AbWork and let's compete!\n\n${inviteLink}`,
            });
        } catch { }
    };

    const you = leaderboard.find(e => e.isYou);
    const maxSteps = leaderboard.length > 0 ? leaderboard[0].steps : 1;

    const periods = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friends Leaderboard</Text>
                <TouchableOpacity onPress={handleShare}>
                    <View style={styles.shareBtn}>
                        <Text style={{ fontSize: 22, color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' }}>+</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Period Toggle */}
            <View style={styles.periodToggle}>
                {periods.map(p => (
                    <TouchableOpacity
                        key={p.key}
                        style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
                        onPress={() => setPeriod(p.key)}
                    >
                        <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Head-to-Head Display */}
                <View style={styles.podium}>
                    {/* 1st Place */}
                    {leaderboard[0] && (
                        <View style={styles.podiumCenter}>
                            <Text style={styles.crownEmoji}>⭐</Text>
                            <View style={[styles.podiumAvatarBig, { borderColor: colors.primary }]}>
                                <Text style={styles.podiumEmojiBig}>{leaderboard[0].isAI ? "AI" : ""}</Text>
                                <View style={[styles.podiumBadge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.podiumBadgeText}>1</Text>
                                </View>
                            </View>
                            <Text style={styles.podiumNameBig} numberOfLines={1}>
                                {leaderboard[0].isYou ? 'YOU' : leaderboard[0].name}
                            </Text>
                            <Text style={styles.podiumStepsBig}>{formatSteps(leaderboard[0].steps)} steps</Text>
                        </View>
                    )}

                    {/* 2nd Place */}
                    {leaderboard[1] && (
                        <View style={styles.podiumSide}>
                            <View style={[styles.podiumAvatar, { borderColor: '#94a3b8' }]}>
                                <Text style={styles.podiumEmoji}>{leaderboard[1].isAI ? "AI" : ""}</Text>
                                <View style={[styles.podiumBadge, { backgroundColor: '#94a3b8' }]}>
                                    <Text style={styles.podiumBadgeText}>2</Text>
                                </View>
                            </View>
                            <Text style={styles.podiumName} numberOfLines={1}>
                                {leaderboard[1].isYou ? 'YOU' : leaderboard[1].name}
                            </Text>
                            <Text style={styles.podiumSteps}>{formatSteps(leaderboard[1].steps)}</Text>
                        </View>
                    )}
                </View>

                {/* All entries as ranked cards */}
                {leaderboard.map((entry) => (
                    <View key={entry.rank} style={[styles.rankCard, entry.isYou && styles.youCard]}>
                        <Text style={[styles.rankNum, entry.isYou && { color: colors.primary }]}>{entry.rank}</Text>
                        <View style={[
                            styles.rankAvatar,
                            { backgroundColor: entry.isYou ? colors.primary + '30' : entry.isAI ? '#a855f730' : '#3b82f630' },
                            entry.isYou && { borderWidth: 2, borderColor: colors.primary },
                        ]}>
                            <Text style={{ fontSize: 18 }}>{entry.isAI ? "AI" : ""}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.rankName, entry.isYou && styles.youName]}>
                                {entry.isYou ? 'YOU' : entry.name}
                            </Text>
                            <View style={styles.rankBarBg}>
                                <View style={[styles.rankBarFill, { width: `${(entry.steps / maxSteps) * 100}%` }]} />
                            </View>
                            {entry.isAI && (
                                <Text style={styles.aiLabel}>AI competitor adapting to your pace</Text>
                            )}
                        </View>
                        <Text style={[styles.rankSteps, entry.isYou && { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                            {entry.steps.toLocaleString()}
                        </Text>
                    </View>
                ))}

                {/* Lead info */}
                {you && leaderboard.length > 1 && (
                    <View style={styles.leadInfo}>
                        <Text style={styles.leadText}>
                            {you.rank === 1
                                ? `You're leading by ${(you.steps - leaderboard[1].steps).toLocaleString()} steps!`
                                : `${(leaderboard[0].steps - you.steps).toLocaleString()} steps behind ${leaderboard[0].name}`}
                        </Text>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* Bottom Banner */}
            {you && (
                <View style={styles.bottomBanner}>
                    <View style={styles.bannerBadge}>
                        <Text style={styles.bannerBadgeText}>{you.rank}</Text>
                    </View>
                    <Text style={styles.bannerText}>
                        You're in {you.rank}{getOrdinal(you.rank)} place! Keep moving.
                    </Text>
                    <TouchableOpacity style={styles.bannerShareBtn} onPress={handleShareInvite}>
                        <Text style={styles.bannerShareText}>SHARE</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Invite Friends Modal */}
            <Modal visible={showInvite} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.inviteSheet}>
                        <View style={styles.inviteHeader}>
                            <Text style={styles.inviteTitle}>Invite Friends</Text>
                            <TouchableOpacity onPress={() => setShowInvite(false)}>
                                <View style={styles.inviteClose}>
                                    <Text style={styles.inviteCloseText}>✕</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inviteDesc}>
                            Share your unique link to challenge friends and climb the leaderboard together.
                        </Text>

                        <Text style={styles.inviteLinkLabel}>SHARABLE LINK</Text>
                        <View style={styles.linkRow}>
                            <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
                            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink}>
                                <Text style={styles.copyBtnText}>{copied ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.shareInviteBtn} onPress={handleShareInvite}>
                            <Text style={styles.shareInviteBtnText}>📤  Share Invite</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    shareBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30',
    },

    periodToggle: {
        flexDirection: 'row', marginHorizontal: 16, borderRadius: 14,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    periodBtnActive: { backgroundColor: colors.primary, borderRadius: 12 },
    periodText: { color: colors.slate400, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    periodTextActive: { color: colors.bgDark, fontFamily: 'SpaceGrotesk_700Bold' },

    content: { paddingHorizontal: 16, paddingTop: 16 },

    // Podium
    podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 24, gap: 8 },
    podiumSide: { alignItems: 'center', width: 100 },
    podiumCenter: { alignItems: 'center', width: 120, marginBottom: 8 },
    crownEmoji: { fontSize: 20, marginBottom: 4 },
    podiumAvatar: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface,
        borderWidth: 3, alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    podiumAvatarBig: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface,
        borderWidth: 3, alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    podiumEmoji: { fontSize: 28 },
    podiumEmojiBig: { fontSize: 40 },
    podiumBadge: {
        position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bgDark,
    },
    podiumBadgeText: { color: colors.bgDark, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    podiumName: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', marginTop: 8 },
    podiumNameBig: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 8 },
    podiumSteps: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', opacity: 0.7 },
    podiumStepsBig: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

    // Rank cards
    rankCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 16, padding: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    rankNum: { color: colors.slate400, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', width: 20, textAlign: 'center' },
    rankAvatar: {
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    },
    rankName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', marginBottom: 4 },
    rankBarBg: { height: 6, backgroundColor: colors.bgDark, borderRadius: 3, overflow: 'hidden' },
    rankBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    rankSteps: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    aiLabel: { color: '#a855f7', fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 3, fontStyle: 'italic' },

    // Lead info
    leadInfo: {
        backgroundColor: colors.primary + '10', borderRadius: 14, padding: 16,
        marginTop: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '30',
    },
    leadText: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', textAlign: 'center' },

    // Divider
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 2, marginHorizontal: 12 },

    // YOU card
    youCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.primary + '15', borderRadius: 16, padding: 14,
        borderWidth: 2, borderColor: colors.primary,
    },
    youRank: { color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', width: 20, textAlign: 'center' },
    youName: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', fontStyle: 'italic', marginBottom: 4 },
    youBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    youBehind: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 4 },
    youSteps: { color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    // Bottom banner
    bottomBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 16,
    },
    bannerBadge: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgDark,
        alignItems: 'center', justifyContent: 'center',
    },
    bannerBadgeText: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
    bannerText: { flex: 1, color: colors.bgDark, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
    bannerShareBtn: {
        backgroundColor: colors.bgDark, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    },
    bannerShareText: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },

    // Invite Modal
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
    inviteSheet: {
        width: '88%', backgroundColor: colors.bg, borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: colors.primary + '30',
    },
    inviteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    inviteTitle: { color: colors.text, fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },
    inviteClose: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    inviteCloseText: { color: colors.slate400, fontSize: 16 },
    inviteDesc: { color: colors.slate400, fontSize: 14, lineHeight: 20, marginBottom: 20 },
    inviteLinkLabel: { color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, marginBottom: 8 },
    linkRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    linkText: { flex: 1, color: colors.primary, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium' },
    copyBtn: {
        width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    copyBtnText: { fontSize: 18 },
    shareInviteBtn: {
        backgroundColor: colors.bgCard, borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    shareInviteBtnText: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
