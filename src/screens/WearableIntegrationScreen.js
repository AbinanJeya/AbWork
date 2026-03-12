import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Switch, Modal, Linking, StatusBar, Animated, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { getSettings, saveSettings } from '../services/storage';
import {
    FITBIT_CLIENT_ID, FITBIT_SCOPES, fitbitDiscovery, redirectUri,
    saveFitbitToken, disconnectFitbit
} from '../services/fitbit';
import { initializeHealth, requestHealthPermissions, healthPlatformName } from '../services/health';
import { useTranslation } from '../services/i18n';

// ─── Data types each device can provide ────────────
const DATA_TYPES = {
    steps: { icon: 'directions-walk', label: 'Steps' },
    heartRate: { icon: 'favorite', label: 'Heart Rate' },
    sleep: { icon: 'bedtime', label: 'Sleep' },
    calories: { icon: 'local-fire-department', label: 'Calories' },
    workouts: { icon: 'fitness-center', label: 'Workouts' },
    spo2: { icon: 'air', label: 'Blood Oxygen' },
};

// ─── Device Definitions ────────────────────────────
const DEVICES = [
    {
        id: 'health_connect',
        name: 'Health Connect',
        subtitle: 'Android\'s unified health platform',
        icon: 'favorite',
        color: '#4CAF50',
        features: ['Steps & Activity', 'Heart Rate', 'Sleep Tracking', 'Calorie Sync'],
        provides: ['steps', 'heartRate', 'sleep', 'calories', 'workouts'],
        deeplink: 'android-health-connect://',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
        priority: 1,
    },
];

// ─── Feature Tag ───────────────────────────────────
function FeatureTag({ label, color }) {
    return (
        <View style={[featureTagStyles.tag, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[featureTagStyles.text, { color }]}>{label}</Text>
        </View>
    );
}
const featureTagStyles = StyleSheet.create({
    tag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, marginRight: 6, marginBottom: 6 },
    text: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' },
});

// ─── Device Card ───────────────────────────────────
function DeviceCard({ device, connectionState, onToggle, onToggleSetting, colors, isDark, activeDataSources }) {
    const [expanded, setExpanded] = useState(false);
    
    // connectionState can be a boolean OR an object for granular settings
    const isConnected = typeof connectionState === 'object' ? connectionState.connected : !!connectionState;
    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (isConnected) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isConnected]);

    const bgCard = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    const borderCard = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    // Which data types this device is the active source for (only count if granular sync is true)
    const activeFor = isConnected
        ? device.provides.filter(dt => {
            if (activeDataSources[dt] !== device.id) return false;
            // Check if granular setting disabled it
            if (typeof connectionState === 'object' && device.id === 'health_connect') {
                if (dt === 'steps' && !connectionState.syncSteps) return false;
                if (dt === 'sleep' && !connectionState.syncSleep) return false;
                if (dt === 'workouts' && !connectionState.syncWorkouts) return false;
            }
            return true;
        })
        : [];
    // Which data types are provided but another device has priority OR user disabled it
    const overriddenFor = isConnected
        ? device.provides.filter(dt => {
            if (!activeFor.includes(dt)) return true;
            return false;
        })
        : [];

    return (
        <View style={[
            cardStyles.card,
            { backgroundColor: bgCard, borderColor: isConnected ? device.color + '60' : borderCard }
        ]}>
            {/* Connected dot — top right corner */}
            {isConnected && (
                <Animated.View style={[cardStyles.connectedDot, { backgroundColor: device.color, transform: [{ scale: pulseAnim }] }]} />
            )}

            {/* Header Row */}
            <TouchableOpacity
                style={cardStyles.headerRow}
                activeOpacity={0.7}
                onPress={() => setExpanded(e => !e)}
            >
                <View style={[
                    cardStyles.iconWrap, 
                    { 
                        backgroundColor: device.id === 'health_connect' ? 'transparent' : device.color + '20',
                        overflow: device.id === 'health_connect' ? 'hidden' : 'visible'
                    }
                ]}>
                    {device.id === 'health_connect' ? (
                        <Image 
                            source={require('../../assets/health_connect.png')} 
                            style={{ width: '100%', height: '100%', resizeMode: 'cover' }} 
                        />
                    ) : (
                        <MaterialIcons name={device.icon} size={26} color={device.color} />
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={[cardStyles.name, { color: colors.text }]}>{device.name}</Text>
                    <Text style={[cardStyles.subtitle, { color: colors.textSecondary }]}>{device.subtitle}</Text>
                </View>

                <Switch
                    value={isConnected}
                    onValueChange={() => onToggle(device.id)}
                    trackColor={{ false: isDark ? '#333' : '#ccc', true: device.color + '60' }}
                    thumbColor={isConnected ? device.color : (isDark ? '#666' : '#aaa')}
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
            </TouchableOpacity>

            {/* Connected Status Bar */}
            {isConnected && (
                <View style={[cardStyles.statusBar, { backgroundColor: device.color + '10' }]}>
                    <MaterialIcons name="check-circle" size={14} color={device.color} />
                    <Text style={[cardStyles.statusText, { color: device.color }]}>
                        Connected · {activeFor.length} active source{activeFor.length !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}

            {/* Active data source pills */}
            {isConnected && (activeFor.length > 0 || overriddenFor.length > 0) && (
                <View style={cardStyles.dataSourceRow}>
                    {activeFor.map(dt => (
                        <View key={dt} style={[cardStyles.dataSourcePill, { backgroundColor: device.color + '18', borderColor: device.color + '40' }]}>
                            <MaterialIcons name={DATA_TYPES[dt].icon} size={12} color={device.color} />
                            <Text style={[cardStyles.dataSourceText, { color: device.color }]}>{DATA_TYPES[dt].label}</Text>
                        </View>
                    ))}
                    {overriddenFor.map(dt => (
                        <View key={dt} style={[cardStyles.dataSourcePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                            <MaterialIcons name={DATA_TYPES[dt].icon} size={12} color={colors.textMuted} />
                            <Text style={[cardStyles.dataSourceText, { color: colors.textMuted, textDecorationLine: 'line-through' }]}>{DATA_TYPES[dt].label}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Expanded: Features + Granular Controls + Open App */}
            {expanded && (
                <View style={[cardStyles.expandedSection, { borderTopWidth: 1, borderTopColor: borderCard, paddingTop: 16 }]}>
                    
                    {/* Granular Toggles for Health Connect */}
                    {isConnected && typeof connectionState === 'object' && device.id === 'health_connect' && (
                        <View style={cardStyles.settingsSection}>
                            <Text style={[cardStyles.settingsTitle, { color: colors.text }]}>Sync Preferences</Text>
                            
                            <View style={cardStyles.settingRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={[cardStyles.settingIcon, { backgroundColor: '#4CAF5015' }]}><MaterialIcons name="directions-walk" size={16} color="#4CAF50" /></View>
                                    <View>
                                        <Text style={[cardStyles.settingLabel, { color: colors.text }]}>Sync Steps & Activity</Text>
                                        <Text style={[cardStyles.settingSub, { color: colors.textSecondary }]}>Power your daily rings</Text>
                                    </View>
                                </View>
                                <Switch value={!!connectionState.syncSteps} onValueChange={(val) => onToggleSetting('health_connect', 'syncSteps', val)}
                                    trackColor={{ false: isDark ? '#333' : '#ccc', true: '#4CAF5060' }} thumbColor={connectionState.syncSteps ? '#4CAF50' : (isDark ? '#666' : '#aaa')} style={{ transform: [{ scale: 0.75 }] }} />
                            </View>

                            <View style={cardStyles.settingRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={[cardStyles.settingIcon, { backgroundColor: '#FF980015' }]}><MaterialIcons name="bedtime" size={16} color="#FF9800" /></View>
                                    <View>
                                        <Text style={[cardStyles.settingLabel, { color: colors.text }]}>Sync Sleep Data</Text>
                                        <Text style={[cardStyles.settingSub, { color: colors.textSecondary }]}>Track rest & recovery</Text>
                                    </View>
                                </View>
                                <Switch value={!!connectionState.syncSleep} onValueChange={(val) => onToggleSetting('health_connect', 'syncSleep', val)}
                                    trackColor={{ false: isDark ? '#333' : '#ccc', true: '#FF980060' }} thumbColor={connectionState.syncSleep ? '#FF9800' : (isDark ? '#666' : '#aaa')} style={{ transform: [{ scale: 0.75 }] }} />
                            </View>

                            <View style={cardStyles.settingRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={[cardStyles.settingIcon, { backgroundColor: '#9C27B015' }]}><MaterialIcons name="fitness-center" size={16} color="#9C27B0" /></View>
                                    <View>
                                        <Text style={[cardStyles.settingLabel, { color: colors.text }]}>Sync Workouts</Text>
                                        <Text style={[cardStyles.settingSub, { color: colors.textSecondary }]}>Pull top-level sessions</Text>
                                    </View>
                                </View>
                                <Switch value={!!connectionState.syncWorkouts} onValueChange={(val) => onToggleSetting('health_connect', 'syncWorkouts', val)}
                                    trackColor={{ false: isDark ? '#333' : '#ccc', true: '#9C27B060' }} thumbColor={connectionState.syncWorkouts ? '#9C27B0' : (isDark ? '#666' : '#aaa')} style={{ transform: [{ scale: 0.75 }] }} />
                            </View>
                        </View>
                    )}

                    {/* App Links & Disconnect */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: isConnected && typeof connectionState === 'object' ? 12 : 0 }}>
                        <TouchableOpacity
                            style={[cardStyles.openAppBtn, { borderColor: device.color + '50' }]}
                            onPress={() => Linking.canOpenURL(device.deeplink)
                                .then(can => Linking.openURL(can ? device.deeplink : device.storeUrl))
                                .catch(() => Linking.openURL(device.storeUrl))
                            }
                            activeOpacity={0.75}
                        >
                            <MaterialIcons name="open-in-new" size={15} color={device.color} />
                            <Text style={[cardStyles.openAppText, { color: device.color }]}>Open {device.name}</Text>
                        </TouchableOpacity>

                        {isConnected && (
                            <TouchableOpacity onPress={() => onToggle(device.id)} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                                <Text style={{ color: '#ef4444', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 }}>Disconnect</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const cardStyles = StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    name: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15 },
    subtitle: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, marginTop: 2 },
    connectedDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', top: 10, right: 10, zIndex: 10 },
    statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, marginTop: -4 },
    statusText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12 },
    dataSourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
    dataSourcePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    dataSourceText: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' },
    expandedSection: { padding: 16 },
    featureWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    openAppBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    openAppText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 },
    settingsSection: { marginBottom: 16 },
    settingsTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, marginBottom: 12 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
    settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 },
    settingSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, marginTop: 1 },
});

// ─── Compute which device is the active source per data type ─────
// Priority: whichever connected device has the lowest `priority` number wins each data type.
// This prevents overlapping data — e.g. steps only come from ONE source.
function computeActiveDataSources(connectedDevices) {
    const sources = {};
    const connectedList = DEVICES
        .filter(d => connectedDevices[d.id])
        .sort((a, b) => a.priority - b.priority);

    for (const device of connectedList) {
        for (const dt of device.provides) {
            // Check if user has explicitly disabled this data type via granular settings
            const conn = connectedDevices[device.id];
            let isEnabled = true;
            if (typeof conn === 'object' && device.id === 'health_connect') {
                if (dt === 'steps' && !conn.syncSteps) isEnabled = false;
                if (dt === 'sleep' && !conn.syncSleep) isEnabled = false;
                if (dt === 'workouts' && !conn.syncWorkouts) isEnabled = false;
                // Heat rate, calories, spo2 could be tied to their respective parents or added later
            }

            if (isEnabled && !sources[dt]) {
                sources[dt] = device.id;
            }
        }
    }
    return sources;
}

// ─── Main Screen ───────────────────────────────────
export default function WearableIntegrationScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const styles = getStyles(colors, isDark);

    const [connectedDevices, setConnectedDevices] = useState({});
    const [dialog, setDialog] = useState(null); // { type, device, blockedBy }

    // --- OAuth Hooks ---
    const [fitbitReq, fitbitRes, fitbitPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: FITBIT_CLIENT_ID,
            scopes: FITBIT_SCOPES,
            redirectUri,
            responseType: AuthSession.ResponseType.Token,
        },
        fitbitDiscovery
    );

    useEffect(() => {
        if (fitbitRes?.type === 'success') {
            const { access_token } = fitbitRes.params;
            saveFitbitToken(access_token).then(() => {
                completeConnection('fitbit');
            });
        } else if (fitbitRes?.type === 'error' || fitbitRes?.type === 'cancel') {
            console.log("Fitbit Auth Failed/Canceled:", fitbitRes);
        }
    }, [fitbitRes]);

    useEffect(() => {
        (async () => {
            const s = await getSettings();
            setConnectedDevices(s.wearableConnections || {});
        })();
    }, []);

    const activeDataSources = computeActiveDataSources(connectedDevices);

    const toggleDevice = async (id) => {
        const device = DEVICES.find(d => d.id === id);
        // connection objects evaluate to true
        const isConnected = !!connectedDevices[id];

        if (!isConnected) {
            const alreadyConnected = DEVICES.filter(d => d.id !== id && !!connectedDevices[d.id]);
            if (alreadyConnected.length > 0) {
                setDialog({ type: 'block', device, blockedBy: alreadyConnected });
                return;
            }
            setDialog({ type: 'connect', device });
        } else {
            setDialog({ type: 'disconnect', device });
        }
    };

    const doConnect = async (id) => {
        if (id === 'fitbit') {
            setDialog(null); // Close dialog while auth happens
            fitbitPromptAsync();
            return; // `completeConnection` handles success later
        }

        if (id === 'health_connect') {
            setDialog(null); // Close dialog during native flow
            const isInstalled = await initializeHealthConnect();
            if (!isInstalled) {
                const device = DEVICES.find(d => d.id === 'health_connect');
                Linking.openURL(device.storeUrl);
                return;
            }

            const granted = await requestHealthPermissions();
            if (granted) {
                await completeConnection('health_connect');
            }
            return;
        }

        await completeConnection(id);
    };

    const completeConnection = async (id) => {
        // Upgrade health_connect to structured object with default sync settings
        const statePayload = id === 'health_connect' 
            ? { connected: true, syncSteps: true, syncSleep: true, syncWorkouts: false } 
            : true;

        const updated = { ...connectedDevices, [id]: statePayload };
        setConnectedDevices(updated);
        const s = await getSettings();
        await saveSettings({ ...s, wearableConnections: updated });
        if (dialog?.type !== 'block') setDialog(null);
    };

    const toggleSetting = async (deviceId, settingKey, value) => {
        if (!connectedDevices[deviceId] || typeof connectedDevices[deviceId] !== 'object') return;
        
        const updatedDeviceState = { ...connectedDevices[deviceId], [settingKey]: value };
        const updated = { ...connectedDevices, [deviceId]: updatedDeviceState };
        
        setConnectedDevices(updated);
        const s = await getSettings();
        await saveSettings({ ...s, wearableConnections: updated });
    };

    const doDisconnect = async (id) => {
        if (id === 'fitbit') {
            await disconnectFitbit();
        }

        const updated = { ...connectedDevices };
        delete updated[id];
        setConnectedDevices(updated);
        const s = await getSettings();
        await saveSettings({ ...s, wearableConnections: updated });
        setDialog(null);
    };

    const connectedCount = Object.keys(connectedDevices).length;

    return (
        <View style={{ flex: 1, backgroundColor: colors.bgDark }}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* ─── Custom Dialog Modal ─── */}
            <Modal
                visible={!!dialog}
                transparent
                animationType="fade"
                onRequestClose={() => setDialog(null)}
            >
                <View style={dialogStyles.overlay}>
                    <View style={[dialogStyles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        {dialog?.type === 'block' && (
                            <>
                                <View style={[dialogStyles.iconCircle, { backgroundColor: '#ef444420' }]}>
                                    <MaterialIcons name="link-off" size={28} color="#ef4444" />
                                </View>
                                <Text style={[dialogStyles.title, { color: colors.text }]}>Before We Connect You</Text>
                                <Text style={[dialogStyles.body, { color: colors.textSecondary }]}>
                                    To prevent duplicate data, please disconnect from{' '}
                                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>
                                        {dialog.blockedBy.map(d => d.name).join(', ')}
                                    </Text>
                                    {' '}first, then try again.
                                </Text>
                                <TouchableOpacity
                                    style={[dialogStyles.btnPrimary, { backgroundColor: colors.primary }]}
                                    onPress={() => setDialog(null)}
                                >
                                    <Text style={dialogStyles.btnPrimaryText}>Got It</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {dialog?.type === 'connect' && (
                            <>
                                <View style={[dialogStyles.iconCircle, { backgroundColor: dialog.device.color + '20' }]}>
                                    <MaterialIcons name={dialog.device.icon} size={28} color={dialog.device.color} />
                                </View>
                                <Text style={[dialogStyles.title, { color: colors.text }]}>Connect {dialog.device.name}</Text>
                                <Text style={[dialogStyles.body, { color: colors.textSecondary }]}>
                                    AbWork will sync your{' '}
                                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }}>
                                        {dialog.device.features.slice(0, 2).join(' and ')}
                                    </Text>
                                    {' '}data automatically every 10 seconds.
                                </Text>
                                <View style={dialogStyles.btnRow}>
                                    <TouchableOpacity
                                        style={[dialogStyles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                                        onPress={() => setDialog(null)}
                                    >
                                        <Text style={[dialogStyles.btnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[dialogStyles.btnPrimary, { backgroundColor: dialog.device.color, flex: 1 }]}
                                        onPress={() => doConnect(dialog.device.id)}
                                    >
                                        <MaterialIcons name="link" size={16} color="#fff" />
                                        <Text style={dialogStyles.btnPrimaryText}>Connect</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                        {dialog?.type === 'disconnect' && (
                            <>
                                <View style={[dialogStyles.iconCircle, { backgroundColor: '#ef444415' }]}>
                                    <MaterialIcons name="link-off" size={28} color="#ef4444" />
                                </View>
                                <Text style={[dialogStyles.title, { color: colors.text }]}>Disconnect {dialog.device.name}</Text>
                                <Text style={[dialogStyles.body, { color: colors.textSecondary }]}>
                                    AbWork will stop syncing data from this device. You can reconnect at any time.
                                </Text>
                                <View style={dialogStyles.btnRow}>
                                    <TouchableOpacity
                                        style={[dialogStyles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                                        onPress={() => setDialog(null)}
                                    >
                                        <Text style={[dialogStyles.btnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[dialogStyles.btnPrimary, { backgroundColor: '#ef4444', flex: 1 }]}
                                        onPress={() => doDisconnect(dialog.device.id)}
                                    >
                                        <Text style={dialogStyles.btnPrimaryText}>Disconnect</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Wearable Devices</Text>
                    <Text style={styles.headerSub}>Connect your fitness tracker</Text>
                </View>
                {connectedCount > 0 && (
                    <View style={[styles.connectedBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                        <View style={[styles.connBadgeDot, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.connectedBadgeText, { color: colors.primary }]}>
                            {connectedCount} Active
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Deduplication info banner */}
                <View style={[styles.syncBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                    <MaterialIcons name="sync" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.syncTitle, { color: colors.primary }]}>Smart Data Sync</Text>
                        <Text style={[styles.syncSub, { color: colors.textSecondary }]}>
                            Each data type (steps, heart rate, sleep) is collected from only one device at a time to prevent duplicates. Higher-priority devices take precedence.
                        </Text>
                    </View>
                </View>

                {/* Data source summary — only when 2+ devices */}
                {connectedCount >= 2 && (
                    <View style={[styles.priorityCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                        <Text style={[styles.priorityTitle, { color: colors.text }]}>Active Data Sources</Text>
                        <Text style={[styles.prioritySub, { color: colors.textMuted }]}>Each metric uses the highest-priority connected device</Text>
                        <View style={styles.priorityGrid}>
                            {Object.entries(activeDataSources).map(([dt, deviceId]) => {
                                const device = DEVICES.find(d => d.id === deviceId);
                                return (
                                    <View key={dt} style={[styles.priorityRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
                                        <MaterialIcons name={DATA_TYPES[dt].icon} size={16} color={device.color} />
                                        <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>{DATA_TYPES[dt].label}</Text>
                                        <View style={[styles.prioritySourcePill, { backgroundColor: device.color + '18' }]}>
                                            <View style={[styles.prioritySourceDot, { backgroundColor: device.color }]} />
                                            <Text style={[styles.prioritySourceName, { color: device.color }]}>{device.name}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* All Devices */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ALL DEVICES</Text>
                {DEVICES.map(device => (
                    <DeviceCard
                        key={device.id}
                        device={device}
                        connectionState={connectedDevices[device.id]}
                        onToggle={toggleDevice}
                        onToggleSetting={toggleSetting}
                        colors={colors}
                        isDark={isDark}
                        activeDataSources={activeDataSources}
                    />
                ))}

                {/* Info note */}
                <View style={[styles.noteCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                    <MaterialIcons name="info-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.noteText, { color: colors.textMuted }]}>
                        Each data type is sourced from only one device to prevent double-counting. The corresponding app must be installed on your phone. Data stays on-device.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────
function getStyles(colors, isDark) {
    return StyleSheet.create({
        header: {
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingHorizontal: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        backBtn: {
            width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        headerTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: colors.text },
        headerSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 1 },
        connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
        connBadgeDot: { width: 7, height: 7, borderRadius: 3.5 },
        connectedBadgeText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12 },
        scroll: { paddingHorizontal: 20, paddingTop: 20 },
        syncBanner: {
            flexDirection: 'row', gap: 12, alignItems: 'flex-start',
            padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 20,
        },
        syncTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
        syncSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17 },
        priorityCard: {
            borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20,
        },
        priorityTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, marginBottom: 2 },
        prioritySub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, marginBottom: 12 },
        priorityGrid: {},
        priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
        priorityLabel: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, flex: 1 },
        prioritySourcePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
        prioritySourceDot: { width: 6, height: 6, borderRadius: 3 },
        prioritySourceName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11 },
        sectionLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 10 },
        noteCard: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 12,
        },
        noteText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, flex: 1, lineHeight: 18 },
    });
}

const dialogStyles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center', justifyContent: 'center', padding: 28,
    },
    card: {
        width: '100%', borderRadius: 24, borderWidth: 1,
        padding: 24, alignItems: 'center', gap: 12,
    },
    iconCircle: {
        width: 64, height: 64, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    title: {
        fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, textAlign: 'center',
    },
    body: {
        fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14,
        textAlign: 'center', lineHeight: 21, marginBottom: 4,
    },
    btnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
    btnPrimary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 14, borderRadius: 14, width: '100%',
    },
    btnPrimaryText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#fff' },
    btnSecondary: {
        paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    btnSecondaryText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14 },
});
