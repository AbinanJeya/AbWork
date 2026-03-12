import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, BackHandler, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { initializeHealth, requestHealthPermissions, checkGrantedPermissions } from '../services/health';
import { saveSettings, getSettings } from '../services/storage';

export default function HealthConnectOnboardingScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [showSkipWarning, setShowSkipWarning] = useState(false);

    const proceedToTDEE = () => {
        navigation.replace('TDEECalculator');
    };

    useEffect(() => {
        const autoCheckPermissions = async () => {
            try {
                const isInstalled = await initializeHealthConnect();
                if (isInstalled) {
                    const hasPerms = await checkGrantedPermissions();
                    if (hasPerms) {
                        // Already connected at OS level!
                        const settings = await getSettings();
                        await saveSettings({
                            ...settings,
                            wearableConnections: { ...(settings.wearableConnections || {}), health_connect: true }
                        });
                        proceedToTDEE();
                        return; // Prevent turning off checkingStatus as it navigates away
                    }
                }
            } catch (e) {
                console.log("Auto-check permissions error:", e);
            }
            // Not connected yet, show the screen
            setCheckingStatus(false);
        };
        autoCheckPermissions();
    }, []);

    useEffect(() => {
        const handleHardwareBackPress = () => {
            // Sign out if they back out of onboarding completely
            try {
                const { signOut } = require('../services/auth');
                signOut();
            } catch (e) { }
            navigation.replace('Welcome');
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleHardwareBackPress);
        return () => backHandler.remove();
    }, [navigation]);

    const handleConnect = async () => {
        setLoading(true);
        try {
            const isInstalled = await initializeHealthConnect();

            // If the user physically doesn't have Health Connect installed
            if (!isInstalled) {
                setLoading(false);
                Alert.alert(
                    "Health Connect Missing",
                    "We couldn't detect Android Health Connect. Please continue to set up your profile manually.",
                    [{ text: "Continue", onPress: proceedToTDEE }]
                );
                return;
            }

            // Prompt native OS permissions
            const granted = await requestHealthPermissions();

            if (granted) {
                // Save it into local settings so Pedometer module knows to read from it
                const settings = await getSettings();
                await saveSettings({
                    ...settings,
                    wearableConnections: { ...(settings.wearableConnections || {}), health_connect: true }
                });
                proceedToTDEE();
            } else {
                setLoading(false);
                Alert.alert(
                    "Connection Failed",
                    "We need these permissions to automatically track your steps and calorie burn. You can try again or skip.",
                    [{ text: "Okay", style: "cancel" }]
                );
            }
        } catch (error) {
            console.error("Health Connect onboarding error:", error);
            setLoading(false);
        }
    };

    const handleSkip = () => {
        setShowSkipWarning(true);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

            {/* Custom Skip Modal */}
            <Modal
                visible={showSkipWarning}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSkipWarning(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBg}>
                            <MaterialIcons name="warning-amber" size={32} color="#F44336" />
                        </View>
                        <Text style={styles.modalTitle}>Are you sure?</Text>
                        <Text style={styles.modalText}>
                            Without Health Connect, AbWork won't be able to automatically sync your daily steps, heart rate, or burned calories from your device.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setShowSkipWarning(false)}
                            >
                                <Text style={styles.modalBtnCancelText}>Go Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnDanger]}
                                onPress={() => {
                                    setShowSkipWarning(false);
                                    proceedToTDEE();
                                }}
                            >
                                <Text style={styles.modalBtnDangerText}>Skip Anyway</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {checkingStatus ? (
                <View style={styles.loaderCenter}>
                    <ActivityIndicator size="large" color="#4285F4" />
                </View>
            ) : (
                <>
                    <View style={styles.content}>

                        {/* Visual Header */}
                        <View style={styles.iconContainer}>
                            <View style={styles.pulseRing}>
                                <FontAwesome5 name="heartbeat" size={48} color="#4285F4" />
                            </View>
                        </View>

                        <Text style={styles.title}>Unlock Your Data</Text>
                        <Text style={styles.subtitle}>
                            Connect Android Health Connect to automatically sync your daily steps, sleep, and workouts instantly.
                        </Text>

                        {/* Benefits List */}
                        <View style={styles.benefitsBox}>
                            <View style={styles.benefitRow}>
                                <MaterialIcons name="directions-walk" size={24} color={colors.primary} />
                                <Text style={styles.benefitText}>Accurate daily step tracking</Text>
                            </View>
                            <View style={styles.benefitRow}>
                                <MaterialIcons name="local-fire-department" size={24} color={colors.primary} />
                                <Text style={styles.benefitText}>Automatic calorie burn sync</Text>
                            </View>
                            <View style={styles.benefitRow}>
                                <MaterialIcons name="bedtime" size={24} color={colors.primary} />
                                <Text style={styles.benefitText}>Deep sleep cycle insights</Text>
                            </View>
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.connectButton}
                            onPress={handleConnect}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.connectButtonText}>Connect Health Connect</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={handleSkip}
                            disabled={loading}
                        >
                            <Text style={styles.skipButtonText}>Skip for now</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    loaderCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(66, 133, 244, 0.3)',
    },
    title: {
        fontSize: 28,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_400Regular',
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 48,
    },
    benefitsBox: {
        width: '100%',
        backgroundColor: isDark ? colors.card : '#F5F7FA',
        padding: 24,
        borderRadius: 20,
        gap: 20,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    benefitText: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.text,
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
        gap: 16,
    },
    connectButton: {
        backgroundColor: '#4285F4', // Google Health Connect Color
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    connectButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    skipButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButtonText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.bg,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 22,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    modalText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_400Regular',
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnCancel: {
        backgroundColor: colors.bgCard,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalBtnDanger: {
        backgroundColor: '#F44336',
    },
    modalBtnCancelText: {
        color: colors.text,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 15,
    },
    modalBtnDangerText: {
        color: '#FFFFFF',
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 15,
    },
});
