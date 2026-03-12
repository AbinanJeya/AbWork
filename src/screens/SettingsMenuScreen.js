import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
    Modal, PanResponder, Linking, Switch, FlatList, TouchableWithoutFeedback
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, isColorBright, getProjectedHex } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSettings, saveSettings, clearAllData, getUserProfile, saveUserProfile, importWorkoutSessions, importRoutines } from '../services/storage';
import { auth, onAuthChange, sendPasswordResetEmail, deleteAccount } from '../services/auth';
import { useTranslation, LANGUAGES } from '../services/i18n';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseAndImportCSV } from '../services/csvImport';
import { exportWorkoutHistoryToCSV } from '../services/csvExport';
import { addXP, XP_AMOUNTS } from '../services/leveling';
import RestTimerPicker from '../components/RestTimerPicker';

const PRESET_COLORS = ['#25f46a', '#007AFF', '#FF9500', '#FF2D55'];
const WHEEL_SIZE = 240;

function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ColorWheelModal({ visible, onClose, onSavePreset }) {
    const { colors, isDark, baseHSV } = useTheme();
    // getStyles is evaluated at render time so it is available
    const styles = getStyles(colors, isDark);

    // Limit extreme brightness so colors pop against the respective backgrounds
    const minVal = isDark ? 0.6 : 0.2;
    const maxVal = isDark ? 1.0 : 0.6;

    const [wheelHue, setWheelHue] = useState(baseHSV.h);
    const [wheelSat, setWheelSat] = useState(baseHSV.s);
    // wheelVal is now exclusively a 0.0 to 1.0 relative percentage of the slider to prevent memory loss across mode flips
    const [wheelVal, setWheelVal] = useState(baseHSV.v);

    const wheelPanRef = useRef(null);
    const wheelLayout = useRef({ pageX: 0, pageY: 0 });

    const handleWheelTouchGlobal = (pageX, pageY) => {
        const cx = wheelLayout.current.pageX + (WHEEL_SIZE / 2);
        const cy = wheelLayout.current.pageY + (WHEEL_SIZE / 2);
        const dx = pageX - cx, dy = pageY - cy;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        setWheelHue(angle);
        setWheelSat(1);
    };

    if (!wheelPanRef.current) {
        wheelPanRef.current = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => handleWheelTouchGlobal(e.nativeEvent.pageX, e.nativeEvent.pageY),
            onPanResponderMove: (e) => handleWheelTouchGlobal(e.nativeEvent.pageX, e.nativeEvent.pageY),
        });
    }
    const wheelPanResponder = wheelPanRef.current;

    const sliderPanRef = useRef(null);
    const sliderLayout = useRef({ width: 0, pageX: 0 });

    const handleSliderTouch = (pageX) => {
        const { pageX: slX, width: slW } = sliderLayout.current;
        if (slW === 0) return;
        let p = (pageX - slX) / slW;
        p = Math.max(0, Math.min(1, p));
        setWheelVal(p);
    };

    if (!sliderPanRef.current) {
        sliderPanRef.current = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => handleSliderTouch(e.nativeEvent.pageX),
            onPanResponderMove: (e) => handleSliderTouch(e.nativeEvent.pageX),
        });
    }

    // Map value linearly between 0 and 1 for the percentage string display
    const displayPercentage = Math.round(wheelVal * 100);

    // Convert the raw math into the contextual safe hex for immediate previewing on the slider/circle
    const safeV = minVal + (wheelVal * (maxVal - minVal));
    const selectedWheelColor = hsvToHex(wheelHue, wheelSat, safeV);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={[styles.modalOverlay, { padding: 24 }]}>
                <TouchableWithoutFeedback onPress={() => onClose(null)}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <View style={[styles.wheelModal, { width: 320, padding: 32, borderRadius: 32 }]}>
                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                        <Text style={[styles.wheelTitle, { fontSize: 20 }]}>Custom Accent</Text>
                        <Text style={[styles.wheelSubtitle, { color: colors.textSecondary }]}>Pick your unique brand hue</Text>
                    </View>

                    <View
                        style={styles.wheelContainer}
                        {...wheelPanResponder.panHandlers}
                        onLayout={(e) => {
                            e.target.measure((x, y, width, height, pageX, pageY) => {
                                wheelLayout.current = { pageX, pageY };
                            });
                        }}
                    >
                        {/* Seamless Rainbow Outer Ring */}
                        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                            {Array.from({ length: 72 }, (_, i) => {
                                const hue = i * 5;
                                const angleRad = (hue - 90) * Math.PI / 180;
                                const radius = WHEEL_SIZE / 2 - 16;
                                return (
                                    <View key={i} style={{
                                        position: 'absolute',
                                        left: WHEEL_SIZE / 2 + Math.cos(angleRad) * radius - 20,
                                        top: WHEEL_SIZE / 2 + Math.sin(angleRad) * radius - 20,
                                        width: 40, height: 40, borderRadius: 20,
                                        backgroundColor: hsvToHex(hue, 1, safeV), // Ring actively dims/brightens with slider safe guards!
                                    }} />
                                );
                            })}
                        </View>

                        {/* Inner Mask Cutout */}
                        <View pointerEvents="none" style={{
                            position: 'absolute',
                            left: 32, top: 32, right: 32, bottom: 32,
                            borderRadius: 999,
                            backgroundColor: colors.bgCard,
                            shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <View style={{
                                width: 64, height: 64, borderRadius: 32,
                                backgroundColor: selectedWheelColor,
                                shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                                borderWidth: 4, borderColor: isDark ? '#333' : '#fff'
                            }} />
                        </View>

                        {/* Draggable Wheel Cursor */}
                        <View style={[styles.wheelCursor, {
                            left: WHEEL_SIZE / 2 + Math.cos((wheelHue - 90) * Math.PI / 180) * (WHEEL_SIZE / 2 - 16) - 16,
                            top: WHEEL_SIZE / 2 + Math.sin((wheelHue - 90) * Math.PI / 180) * (WHEEL_SIZE / 2 - 16) - 16,
                            borderColor: selectedWheelColor
                        }]} pointerEvents="none" />
                    </View>

                    {/* Brightness Control */}
                    <View style={{ width: '100%', marginTop: 32, marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 1 }}>Brightness</Text>
                            <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' }}>{displayPercentage}%</Text>
                        </View>
                        <View
                            style={{ width: '100%', height: 40, justifyContent: 'center' }}
                            {...sliderPanRef.current.panHandlers}
                            onLayout={(e) => {
                                e.target.measure((x, y, width, height, pageX, pageY) => {
                                    sliderLayout.current = { width, pageX };
                                });
                            }}
                        >
                            <View pointerEvents="none" style={{ width: '100%', height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.surface }}>
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <View key={i} style={{ flex: 1, backgroundColor: hsvToHex(wheelHue, 1, minVal + (i / 19) * (maxVal - minVal)) }} />
                                ))}
                            </View>
                            <View style={{
                                position: 'absolute',
                                left: `${wheelVal * 100}%`,
                                width: 28, height: 28, borderRadius: 14,
                                marginLeft: -14,
                                backgroundColor: '#fff',
                                borderWidth: 3, borderColor: selectedWheelColor,
                                shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }
                            }} pointerEvents="none" />
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={{ width: '100%', gap: 12 }}>
                        <TouchableOpacity
                            style={[styles.wheelApplyBtn, { backgroundColor: selectedWheelColor, shadowColor: selectedWheelColor, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } }]}
                            onPress={() => onClose({ h: wheelHue, s: wheelSat, v: wheelVal })}
                        >
                            <Text style={[styles.wheelApplyText, { color: isColorBright(selectedWheelColor) ? '#000' : '#fff' }]}>Confirm Selection</Text>
                        </TouchableOpacity>
                        {onSavePreset && (
                            <TouchableOpacity
                                style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: selectedWheelColor }}
                                onPress={() => onSavePreset({ h: wheelHue, s: wheelSat, v: wheelVal })}
                            >
                                <Text style={{ color: selectedWheelColor, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' }}>Save as Custom Preset</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} onPress={() => onClose(null)}>
                            <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function SettingsMenuScreen() {
    const { colors, isDark, accent, setAccent, setAccentHSV, setDarkMode } = useTheme();
    const styles = getStyles(colors, isDark);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const [apiKey, setApiKey] = useState('');
    const [apiKeyStatus, setApiKeyStatus] = useState(null);
    const [geminiKey, setGeminiKey] = useState('');
    const [geminiKeyStatus, setGeminiKeyStatus] = useState(null);
    const [accentColor, setAccentColor] = useState(accent ?? '#25f46a');
    const [userEmail, setUserEmail] = useState('');
    const [customPresets, setCustomPresets] = useState([]);

    const [baseRestTimer, setBaseRestTimer] = useState(60);
    const [showRestPicker, setShowRestPicker] = useState(false);

    // Keep the local preset preview strictly synced with the active contextual accent
    React.useEffect(() => {
        setAccentColor(accent);
    }, [accent]);

    // Color wheel
    const [showColorWheel, setShowColorWheel] = useState(false);

    // Timezone
    const [selectedTimezone, setSelectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [showTzPicker, setShowTzPicker] = useState(false);
    const [tzSearch, setTzSearch] = useState('');

    // Language
    const { lang, changeLanguage, t } = useTranslation();
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [langSearch, setLangSearch] = useState('');
    const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    // Import
    const [importLoading, setImportLoading] = useState(false);
    const [importProgress, setImportProgress] = useState('');
    const [showImportResult, setShowImportResult] = useState(false);
    const [importStats, setImportStats] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);

    const importCancelRef = useRef(false);

    // Routine Selection Modal
    const [showRoutineSelector, setShowRoutineSelector] = useState(false);
    const [pendingRoutines, setPendingRoutines] = useState([]);
    const [selectedRoutines, setSelectedRoutines] = useState(new Set());
    const [tempImportStats, setTempImportStats] = useState(null);

    // Custom Modals
    const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '' });
    const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', actionText: '', onConfirm: null, isDestructive: false });

    const showAlert = (title, message) => setAlertModal({ visible: true, title, message });
    const showConfirm = (title, message, actionText, onConfirm, isDestructive = false) => {
        setConfirmModal({ visible: true, title, message, actionText, onConfirm, isDestructive });
    };

    const changeAccent = (colorPayload) => {
        if (typeof colorPayload === 'object' && colorPayload !== null) {
            setAccentHSV(colorPayload);
        } else {
            setAccentColor(colorPayload);
            setAccent(colorPayload);
        }
    };

    const handleSaveCustomPreset = async (presetHSV) => {
        // Convert to standard hex for rendering locally
        const newHex = hsvToHex(presetHSV.h, presetHSV.s, presetHSV.v).toLowerCase();

        // Ensure no duplicates exist
        let updatedList = [...customPresets];
        if (!updatedList.includes(newHex) && !PRESET_COLORS.map(c => c.toLowerCase()).includes(newHex)) {
            updatedList.push(newHex);
            setCustomPresets(updatedList);
            await saveSettings({ customPresets: updatedList });
            showAlert('Preset Saved', 'Your custom color has been added to your preset list.');
        }

        changeAccent(presetHSV);
        setShowColorWheel(false);
    };

    const handleDeleteCustomPreset = async (hexToRemove) => {
        let updatedList = customPresets.filter(c => c !== hexToRemove);
        setCustomPresets(updatedList);
        await saveSettings({ customPresets: updatedList });
        if (accentColor?.toLowerCase() === hexToRemove.toLowerCase()) {
            changeAccent(PRESET_COLORS[0]);
        }
    };

    React.useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setUserEmail(user?.email || '');
        });
        return unsubscribe;
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadSettings();
        }, [])
    );

    const loadSettings = async () => {
        const s = await getSettings();
        setApiKey(s.openAIKey || '');
        setGeminiKey(s.geminiKey || '');
        if (s.timezone) setSelectedTimezone(s.timezone);
        setCustomPresets(s.customPresets || []);
        setBaseRestTimer(s.baseRestTimer !== undefined ? s.baseRestTimer : 60);
    };

    const handleSaveApiKey = async () => {
        await saveSettings({ openAIKey: apiKey });
        if (!apiKey || apiKey.trim().length < 10) {
            setApiKeyStatus('invalid');
            setTimeout(() => setApiKeyStatus(null), 3000);
            return;
        }
        setApiKeyStatus('checking');
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
            });
            if (res.ok) {
                setApiKeyStatus('valid');
            } else {
                setApiKeyStatus('invalid');
            }
        } catch {
            setApiKeyStatus('invalid');
        }
        setTimeout(() => setApiKeyStatus(null), 3000);
    };

    const handleSaveGeminiKey = async () => {
        await saveSettings({ geminiKey: geminiKey });
        if (!geminiKey || geminiKey.trim().length < 10) {
            setGeminiKeyStatus('invalid');
            setTimeout(() => setGeminiKeyStatus(null), 3000);
            return;
        }
        setGeminiKeyStatus('checking');
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`);
            if (res.ok) {
                setGeminiKeyStatus('valid');
            } else {
                setGeminiKeyStatus('invalid');
            }
        } catch {
            setGeminiKeyStatus('invalid');
        }
        setTimeout(() => setGeminiKeyStatus(null), 3000);
    };

    const handleChangePassword = async () => {
        if (!userEmail) return;
        showConfirm('Set / Change Password', `A secure password reset link will be sent to:\n${userEmail}`, 'Send Email', async () => {
            try {
                await sendPasswordResetEmail(userEmail);
                showAlert('Email Sent', 'Check your inbox for a secure link to manage your password.');
            } catch (err) {
                showAlert('Error', err.message || 'Could not send reset email.');
            }
        });
    };

    const handleLogout = () => {
        showConfirm('Log Out', 'Are you sure you want to log out?', 'Log Out', async () => {
            // Force a massive cloud sync right before destroying the session to prevent losing any logs created within the 2-minute polling window
            try {
                const { forceCloudBackup } = require('../services/cloudSync');
                await forceCloudBackup(true);

                const { signOut } = require('../services/auth');
                await signOut();
                await clearAllData();
            } catch (e) {
                console.log('Firebase sign out error:', e);
            }


            try {
                // Attempt to reset from the parent (Tab Navigator) first
                const parent = navigation.getParent();
                if (parent) {
                    parent.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                } else {
                    // Fallback to direct replace
                    navigation.replace('Welcome');
                }
            } catch (err) {
                navigation.navigate('Welcome');
            }
        }, true);
    };

    const handleDeleteAccount = () => {
        showConfirm(
            'Delete Account',
            'Are you absolutely sure you want to permanently delete your account? This action cannot be undone and will erase all your data.',
            'Delete Forever',
            async () => {
                try {
                    await deleteAccount();
                    await clearAllData();
                    showAlert('Account Deleted', 'Your account and all associated data have been permanently removed.');

                    const parent = navigation.getParent();
                    if (parent) {
                        parent.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    } else {
                        navigation.replace('Welcome');
                    }
                } catch (e) {
                    console.error('Delete account error:', e);
                    // Google requires re-authentication for sensitive actions if the token is old
                    if (e.message?.includes('requires-recent-login') || e.code === 'auth/requires-recent-login') {
                        showAlert('Authentication Required', 'Please log out and log back in to verify your identity before deleting your account.');
                    } else {
                        showAlert('Error', e.message || 'Could not delete your account. Please try again.');
                    }
                }
            },
            true // isDestructive
        );
    };

    const handleRecalcTDEE = () => {
        navigation.navigate('TDEECalculator', { fromSettings: true });
    };

    const handleClearData = () => {
        showConfirm('Clear All Data', 'This will delete all your meals, workouts, and settings. Are you sure?', 'Yes', async () => {
            await clearAllData();
            showAlert('Done', 'All data has been cleared.');
        }, true);
    };

    const handleImportCSV = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const file = result.assets[0];
            setImportLoading(true);
            setImportProgress('Reading file...');
            importCancelRef.current = false;

            const csvText = await FileSystem.readAsStringAsync(file.uri);
            setImportProgress('Parsing & matching exercises...');

            const parsed = await parseAndImportCSV(
                csvText,
                (current, total) => setImportProgress(`Processing workout ${current} of ${total}...`),
                () => importCancelRef.current
            );

            if (parsed.sessions.length === 0) {
                setImportLoading(false);
                showAlert('Import Failed', parsed.errors.length > 0 ? parsed.errors[0] : 'No valid workout sessions found in the CSV file.');
                return;
            }

            setImportProgress('Saving to history...');
            const mergeResult = await importWorkoutSessions(parsed.sessions);

            let xpGained = 0;
            let leveledUp = false;
            let newLevel = null;
            if (mergeResult.added > 0) {
                const result = await addXP(mergeResult.added * XP_AMOUNTS.WORKOUT_COMPLETED, 'bulk_csv_import');
                xpGained = mergeResult.added * XP_AMOUNTS.WORKOUT_COMPLETED;
                leveledUp = result.leveledUp;
                newLevel = result.level;
            }

            const initialStats = {
                ...parsed.stats,
                added: mergeResult.added,
                skipped: mergeResult.skipped,
                errors: parsed.errors,
                xpGained,
                leveledUp,
                newLevel,
            };

            setImportLoading(false);

            if (parsed.routines && parsed.routines.length > 0) {
                // Pause and show selection modal
                setPendingRoutines(parsed.routines);
                setSelectedRoutines(new Set(parsed.routines.map(r => r.name)));
                setTempImportStats(initialStats);
                setShowRoutineSelector(true);
            } else {
                // No routines, finish immediately
                setImportStats(initialStats);
                setShowImportResult(true);
            }
        } catch (err) {
            setImportLoading(false);
            if (err.message === 'IMPORT_CANCELLED') {
                return; // Silently abort if user cancelled
            }
            console.error('Import error:', err);
            showAlert('Import Error', 'Something went wrong while importing. Please try again.');
        }
    };

    const handleSaveSelectedRoutines = async () => {
        try {
            setImportLoading(true);
            const routinesToSave = pendingRoutines.filter(r => selectedRoutines.has(r.name));
            const routineMergeResult = await importRoutines(routinesToSave);

            setImportLoading(false);
            setShowRoutineSelector(false);
            setImportStats({
                ...tempImportStats,
                routinesAdded: routineMergeResult.added,
                routinesSkipped: routineMergeResult.skipped,
            });
            setShowImportResult(true);
        } catch (err) {
            setImportLoading(false);
            console.error('Save routines error:', err);
            showAlert('Error', 'Failed to save selected routines.');
        }
    };

    const handleExportHistory = async () => {
        try {
            setExportLoading(true);
            const result = await exportWorkoutHistoryToCSV();
            setExportLoading(false);

            // If success, nothing to do (share sheet handles it)
            if (!result.success) {
                showAlert('Export Failed', result.error || 'Something went wrong.');
            }
        } catch (err) {
            setExportLoading(false);
            console.error('Export exception:', err);
            showAlert('Export Error', 'An unexpected error occurred during export.');
        }
    };

    const openColorWheel = () => { setShowColorWheel(true); };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settings')}</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Personal Info */}
                {!!userEmail && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PERSONAL INFO</Text>
                        <View style={styles.actionCard}>
                            <View style={styles.personalRow}>
                                <Text style={styles.personalLabel}>Email</Text>
                                <Text style={styles.personalValue} numberOfLines={1}>{userEmail}</Text>
                            </View>
                            <View style={styles.personalDivider} />
                            <TouchableOpacity style={styles.personalRow} onPress={handleChangePassword}>
                                <Text style={styles.personalLabel}>Password</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.personalActionText}>Change / Set Password</Text>
                                    <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PREFERENCES</Text>
                    <View style={styles.themeCard}>
                        <TouchableOpacity style={[styles.darkModeRow, { paddingBottom: 0 }]} onPress={() => setShowRestPicker(true)}>
                            <View style={styles.darkModeLeft}>
                                <View style={styles.darkModeIcon}>
                                    <MaterialIcons name="timer" size={22} color={colors.textSecondary} />
                                </View>
                                <View>
                                    <Text style={styles.darkModeTitle}>Base Rest Timer</Text>
                                    <Text style={styles.darkModeSub}>Default timer for new exercises</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: colors.primary, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' }}>
                                    {Math.floor(baseRestTimer / 60)}:{String(baseRestTimer % 60).padStart(2, '0')}
                                </Text>
                                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Theme Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('themeSettings')}</Text>
                    <View style={styles.themeCard}>
                        {/* Dark Mode Toggle */}
                        <View style={styles.darkModeRow}>
                            <View style={styles.darkModeLeft}>
                                <View style={styles.darkModeIcon}>
                                    <MaterialIcons name="dark-mode" size={22} color={colors.textSecondary} />
                                </View>
                                <View>
                                    <Text style={styles.darkModeTitle}>{t('darkMode')}</Text>
                                    <Text style={styles.darkModeSub}>{t('darkModeSub')}</Text>
                                </View>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={(val) => setDarkMode(val)}
                                trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                                thumbColor={'#fff'}
                            />
                        </View>

                        {/* Accent Color */}
                        <View style={styles.accentSection}>
                            <Text style={styles.accentLabel}>{t('accentColor')}</Text>
                            <View>
                                <View style={styles.accentRow}>
                                    <View style={styles.swatchRow}>
                                        <TouchableOpacity
                                            style={[styles.swatch, styles.swatchNone, !accentColor && styles.swatchActive]}
                                            onPress={() => changeAccent('')}
                                        >
                                            <View style={styles.noneLine} />
                                        </TouchableOpacity>
                                        {PRESET_COLORS.map(c => {
                                            const renderedHex = getProjectedHex(c, isDark);
                                            return (
                                                <TouchableOpacity key={c}
                                                    style={[styles.swatch, { backgroundColor: renderedHex }, (accentColor || '').toLowerCase() === c.toLowerCase() && styles.swatchActive]}
                                                    onPress={() => changeAccent(c)} />
                                            );
                                        })}
                                    </View>
                                    <TouchableOpacity style={styles.colorWheelBtn} onPress={() => openColorWheel()}>
                                        <MaterialIcons name="color-lens" size={22} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                {customPresets.length > 0 && (
                                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                        <Text style={{ color: colors.slate400, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.5, marginBottom: 8, paddingLeft: 2 }}>CUSTOM</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
                                            {customPresets.map((c, idx) => {
                                                const renderedHex = getProjectedHex(c, isDark);
                                                return (
                                                    <View key={c + idx}>
                                                        <TouchableOpacity
                                                            style={[styles.swatch, { backgroundColor: renderedHex }, (accentColor || '').toLowerCase() === c.toLowerCase() && styles.swatchActive]}
                                                            onPress={() => changeAccent(c)}
                                                        />
                                                        <TouchableOpacity
                                                            style={{ position: 'absolute', top: -4, right: -4, backgroundColor: colors.bgCard, borderRadius: 10, padding: 2, borderWidth: 1, borderColor: colors.border }}
                                                            onPress={() => handleDeleteCustomPreset(c)}
                                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                        >
                                                            <MaterialIcons name="close" size={10} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {/* AI Integration */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('aiIntegration')}</Text>
                    <View style={styles.aiCard}>
                        <View style={styles.aiHeaderRow}>
                            <View style={styles.aiLeft}>
                                <MaterialIcons name="psychology" size={20} color={colors.primary} />
                                <Text style={styles.aiTitle}>{t('openaiKey')}</Text>
                            </View>
                            <View style={styles.secureBadge}>
                                <Text style={styles.secureBadgeText}>{t('secure')}</Text>
                            </View>
                        </View>
                        <View style={styles.apiKeyRow}>
                            <TextInput style={styles.apiInput} value={apiKey} onChangeText={(v) => { setApiKey(v); setApiKeyStatus(null); }}
                                placeholder="sk-••••••••••••••••" placeholderTextColor={colors.textSecondary}
                                secureTextEntry autoCapitalize="none" autoCorrect={false} />
                            <TouchableOpacity
                                style={[styles.saveBadge, apiKeyStatus === 'valid' && { backgroundColor: '#22c55e' }, apiKeyStatus === 'invalid' && { backgroundColor: '#ef4444' }]}
                                onPress={handleSaveApiKey}
                            >
                                <Text style={[styles.saveBadgeText, apiKeyStatus !== 'valid' && apiKeyStatus !== 'invalid' && { color: colors.textOnPrimary }]}>
                                    {apiKeyStatus === 'checking' ? '...' : apiKeyStatus === 'valid' ? '✓' : apiKeyStatus === 'invalid' ? '✗' : 'SAVE'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.getKeyBtn} onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
                            <Text style={styles.getKeyText}>{t('getApiKey')}</Text>
                            <MaterialIcons name="open-in-new" size={12} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Gemini API Key */}
                    <View style={[styles.aiCard, { marginTop: 10 }]}>
                        <View style={styles.aiHeaderRow}>
                            <View style={styles.aiLeft}>
                                <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                                <Text style={styles.aiTitle}>{t('geminiKey')}</Text>
                            </View>
                            <View style={styles.secureBadge}>
                                <Text style={styles.secureBadgeText}>{t('secure')}</Text>
                            </View>
                        </View>
                        <View style={styles.apiKeyRow}>
                            <TextInput style={styles.apiInput} value={geminiKey} onChangeText={(v) => { setGeminiKey(v); setGeminiKeyStatus(null); }}
                                placeholder="AIza••••••••••••••••" placeholderTextColor={colors.textSecondary}
                                secureTextEntry autoCapitalize="none" autoCorrect={false} />
                            <TouchableOpacity
                                style={[styles.saveBadge, geminiKeyStatus === 'valid' && { backgroundColor: '#22c55e' }, geminiKeyStatus === 'invalid' && { backgroundColor: '#ef4444' }]}
                                onPress={handleSaveGeminiKey}
                            >
                                <Text style={[styles.saveBadgeText, geminiKeyStatus !== 'valid' && geminiKeyStatus !== 'invalid' && { color: colors.textOnPrimary }]}>
                                    {geminiKeyStatus === 'checking' ? '...' : geminiKeyStatus === 'valid' ? '✓' : geminiKeyStatus === 'invalid' ? '✗' : 'SAVE'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.getKeyBtn} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
                            <Text style={styles.getKeyText}>{t('getApiKey')}</Text>
                            <MaterialIcons name="open-in-new" size={12} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Wearable Devices */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>WEARABLE DEVICES</Text>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('WearableIntegration')}
                        activeOpacity={0.75}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="watch" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>Connect Devices</Text>
                                <Text style={styles.actionCardSub}>Pixel Watch, Health Connect, Fitbit</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Language */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('language')}</Text>
                    <View style={styles.actionCard}>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => setShowLangPicker(!showLangPicker)}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="translate" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>{currentLang.native}</Text>
                                <Text style={styles.actionCardSub}>{currentLang.name}</Text>
                            </View>
                            <MaterialIcons name={showLangPicker ? 'expand-less' : 'expand-more'} size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                        {showLangPicker && (
                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                <TextInput
                                    style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
                                    value={langSearch}
                                    onChangeText={setLangSearch}
                                    placeholder={t('selectLanguage')}
                                    placeholderTextColor={colors.textMuted}
                                />
                                <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {LANGUAGES.filter(l => l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.native.toLowerCase().includes(langSearch.toLowerCase())).map(l => (
                                        <TouchableOpacity
                                            key={l.code}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: lang === l.code ? colors.primary + '12' : 'transparent' }}
                                            onPress={() => { changeLanguage(l.code); setShowLangPicker(false); setLangSearch(''); }}
                                        >
                                            <View>
                                                <Text style={{ color: lang === l.code ? colors.primary : colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{l.native}</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' }}>{l.name}</Text>
                                            </View>
                                            {lang === l.code && <MaterialIcons name="check" size={16} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>

                {/* Timezone */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('timezone')}</Text>
                    <View style={styles.actionCard}>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => setShowTzPicker(!showTzPicker)}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>{selectedTimezone.replace(/_/g, ' ')}</Text>
                                <Text style={styles.actionCardSub}>{t('affectsCalendar')}</Text>
                            </View>
                            <MaterialIcons name={showTzPicker ? 'expand-less' : 'expand-more'} size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                        {showTzPicker && (
                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                <TextInput
                                    style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
                                    value={tzSearch}
                                    onChangeText={setTzSearch}
                                    placeholder={t('searchTimezone')}
                                    placeholderTextColor={colors.textMuted}
                                />
                                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {(() => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland']; } })().filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase())).map(item => (
                                        <TouchableOpacity
                                            key={item}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selectedTimezone === item ? colors.primary + '12' : 'transparent' }}
                                            onPress={async () => { setSelectedTimezone(item); setShowTzPicker(false); setTzSearch(''); await saveSettings({ timezone: item }); }}
                                        >
                                            <Text style={{ color: selectedTimezone === item ? colors.primary : colors.text, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>{item.replace(/_/g, ' ')}</Text>
                                            {selectedTimezone === item && <MaterialIcons name="check" size={16} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>

                {/* Data & Import */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DATA & IMPORT</Text>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={handleImportCSV}
                        activeOpacity={0.7}
                        disabled={importLoading}
                    >
                        <View style={styles.actionCardRow}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="cloud-upload" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>
                                    {importLoading ? 'Importing...' : 'Import Workout History'}
                                </Text>
                                <Text style={styles.actionCardSub}>
                                    {importLoading ? importProgress : 'Hevy & Strong CSV files'}
                                </Text>
                            </View>
                            {importLoading ? (
                                <TouchableOpacity
                                    onPress={() => importCancelRef.current = true}
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{ color: '#ef4444', fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' }}>Cancel</Text>
                                </TouchableOpacity>
                            ) : (
                                <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { marginTop: 12 }]}
                        onPress={handleExportHistory}
                        activeOpacity={0.7}
                        disabled={exportLoading}
                    >
                        <View style={styles.actionCardRow}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="file-download" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>
                                    {exportLoading ? 'Exporting...' : 'Export Workout History'}
                                </Text>
                                <Text style={styles.actionCardSub}>
                                    {exportLoading ? 'Generating CSV...' : 'Save as CSV file'}
                                </Text>
                            </View>
                            {exportLoading ? (
                                <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold' }}>⏳</Text>
                            ) : (
                                <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Recalculate TDEE */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.actionCard} onPress={handleRecalcTDEE} activeOpacity={0.7}>
                        <View style={styles.actionCardRow}>
                            <View style={styles.actionIconCircle}>
                                <MaterialIcons name="calculate" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>{t('recalcTdee')}</Text>
                                <Text style={styles.actionCardSub}>{t('recalcTdeeSub')}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Clear Data */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.actionCard} onPress={handleClearData} activeOpacity={0.7}>
                        <View style={styles.actionCardRow}>
                            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>{t('clearData')}</Text>
                                <Text style={styles.actionCardSub}>{t('clearDataSub')}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Log Out */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.actionCard} onPress={handleLogout} activeOpacity={0.7}>
                        <View style={styles.actionCardRow}>
                            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <MaterialIcons name="logout" size={20} color="#ef4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionCardTitle}>{t('logOut')}</Text>
                                <Text style={styles.actionCardSub}>{t('logOutSub')}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Delete Account */}
                <View style={styles.section}>
                    <TouchableOpacity style={[styles.actionCard, { borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1 }]} onPress={handleDeleteAccount} activeOpacity={0.7}>
                        <View style={styles.actionCardRow}>
                            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <MaterialIcons name="person-remove" size={20} color="#ef4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.actionCardTitle, { color: '#ef4444' }]}>Delete Account</Text>
                                <Text style={styles.actionCardSub}>Permanently delete your profile and all data.</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color="#ef4444" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Routine Selection Modal */}
            <Modal visible={showRoutineSelector} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowRoutineSelector(false)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={[styles.wheelModal, { maxHeight: '80%' }]} pointerEvents="box-none">
                        <Text style={styles.wheelTitle}>Import Routines</Text>
                        <Text style={styles.wheelSubtitle}>We found these routines in your history. Select the ones you want to save as templates.</Text>

                        <ScrollView style={{ width: '100%', marginVertical: 16 }} indicatorStyle={isDark ? "white" : "black"}>
                            {pendingRoutines.map((routine, idx) => {
                                const isSelected = selectedRoutines.has(routine.name);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            const newSet = new Set(selectedRoutines);
                                            if (isSelected) newSet.delete(routine.name);
                                            else newSet.add(routine.name);
                                            setSelectedRoutines(newSet);
                                        }}
                                    >
                                        <MaterialIcons
                                            name={isSelected ? "check-box" : "check-box-outline-blank"}
                                            size={24}
                                            color={isSelected ? colors.primary : colors.textMuted}
                                        />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={{ color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{routine.name}</Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>{routine.exercises.length} exercises</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={{ width: '100%', flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                                onPress={() => {
                                    setShowRoutineSelector(false);
                                    setImportStats(tempImportStats);
                                    setShowImportResult(true);
                                }}
                            >
                                <Text style={{ color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold' }}>Skip</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                                onPress={handleSaveSelectedRoutines}
                            >
                                <Text style={{ color: '#fff', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>
                                    Save ({selectedRoutines.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Import Result Modal */}
            <Modal visible={showImportResult} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowImportResult(false)}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>
                    <View style={styles.wheelModal} pointerEvents="box-none">
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <MaterialIcons name="check-circle" size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.wheelTitle}>Import Complete</Text>
                        </View>
                        {importStats && (
                            <View style={{ width: '100%', gap: 8, marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                    <Text style={{ color: isDark ? '#a1a1aa' : '#6b7280', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Workouts Added</Text>
                                    <Text style={{ color: colors.primary, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{importStats.added}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                    <Text style={{ color: isDark ? '#a1a1aa' : '#6b7280', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Unique Exercises</Text>
                                    <Text style={{ color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{importStats.exercises}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                    <Text style={{ color: isDark ? '#a1a1aa' : '#6b7280', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Total Sets</Text>
                                    <Text style={{ color: colors.text, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{importStats.sets}</Text>
                                </View>
                                {importStats.routinesAdded > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                        <Text style={{ color: isDark ? '#a1a1aa' : '#6b7280', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Routines Created</Text>
                                        <Text style={{ color: '#10b981', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{importStats.routinesAdded}</Text>
                                    </View>
                                )}
                                {importStats.skipped > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#f3f4f6' }}>
                                        <Text style={{ color: '#f59e0b', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Duplicates Skipped</Text>
                                        <Text style={{ color: '#f59e0b', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{importStats.skipped}</Text>
                                    </View>
                                )}
                                {importStats.xpGained > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                                        <Text style={{ color: '#8b5cf6', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' }}>Retroactive XP</Text>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: '#8b5cf6', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>+{importStats.xpGained} XP</Text>
                                            {importStats.leveledUp && (
                                                <Text style={{ color: '#f59e0b', fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 2 }}>LEVEL UP! (Lv {importStats.newLevel})</Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                        <TouchableOpacity
                            style={{ width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center' }}
                            onPress={() => setShowImportResult(false)}
                        >
                            <Text style={{ color: isDark ? '#000' : '#fff', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {showColorWheel && (
                <ColorWheelModal
                    visible={showColorWheel}
                    onClose={(payload) => {
                        if (payload) changeAccent(payload);
                        setShowColorWheel(false);
                    }}
                    onSavePreset={handleSaveCustomPreset}
                />
            )}

            {showRestPicker && (
                <RestTimerPicker
                    visible={showRestPicker}
                    initialValue={baseRestTimer}
                    onClose={() => setShowRestPicker(false)}
                    onDone={async (formatted, totalSecs) => {
                        setBaseRestTimer(totalSecs);
                        await saveSettings({ baseRestTimer: totalSecs });
                    }}
                />
            )}

            {/* Simple Alert Modal */}
            <Modal
                visible={alertModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAlertModal({ ...alertModal, visible: false })}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalIconBg, { backgroundColor: colors.primary + '22' }]}>
                            <MaterialIcons name="info-outline" size={28} color={colors.primary} />
                        </View>
                        <Text style={styles.modalTitle}>{alertModal.title}</Text>
                        <Text style={styles.modalMessage}>{alertModal.message}</Text>
                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setAlertModal({ ...alertModal, visible: false })}
                        >
                            <Text style={styles.modalBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                visible={confirmModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setConfirmModal({ ...confirmModal, visible: false })}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalIconBg, { backgroundColor: confirmModal.isDestructive ? 'rgba(239, 68, 68, 0.1)' : colors.primary + '22' }]}>
                            <MaterialIcons name={confirmModal.isDestructive ? 'warning-amber' : 'help-outline'} size={28} color={confirmModal.isDestructive ? '#ef4444' : colors.primary} />
                        </View>
                        <Text style={styles.modalTitle}>{confirmModal.title}</Text>
                        <Text style={styles.modalMessage}>{confirmModal.message}</Text>

                        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.bgCard, borderColor: colors.border }]}
                                onPress={() => setConfirmModal({ ...confirmModal, visible: false })}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.slate400 }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { flex: 1, backgroundColor: confirmModal.isDestructive ? 'rgba(239, 68, 68, 1)' : colors.primary, borderColor: colors.border }]}
                                onPress={() => {
                                    setConfirmModal({ ...confirmModal, visible: false });
                                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                                }}
                            >
                                <Text style={[styles.modalBtnText, { color: confirmModal.isDestructive ? '#ffffff' : colors.bgDark }]}>{confirmModal.actionText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (colors, isDark) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        gap: 12,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', flex: 1 },
    content: { paddingBottom: 120 },

    section: { paddingHorizontal: 16, marginBottom: 16, marginTop: 8 },
    sectionTitle: { color: colors.text, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2, marginBottom: 12 },

    // Theme
    themeCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    darkModeRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16,
    },
    darkModeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    darkModeIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    darkModeTitle: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    darkModeSub: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },

    accentSection: {
        paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border,
    },
    accentLabel: {
        color: colors.textSecondary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2,
    },
    accentRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    swatchRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchActive: {
        borderWidth: 2, borderColor: colors.primary,
        shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
        transform: [{ scale: 1.1 }],
    },
    swatchNone: {
        backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    noneLine: {
        width: '140%', height: 1.5, backgroundColor: colors.textSecondary,
        transform: [{ rotate: '45deg' }], position: 'absolute',
    },
    colorWheelBtn: {
        width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    },

    // AI
    aiCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    aiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    aiLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiTitle: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium' },
    secureBadge: { backgroundColor: colors.primaryDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    secureBadgeText: { color: colors.primary, fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
    apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    apiInput: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border,
    },
    saveBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    saveBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },
    getKeyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 2,
    },
    getKeyText: { color: colors.primary, fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },

    // Action cards
    actionCard: {
        backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    actionCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    // Personal Info
    personalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    personalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    personalLabel: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },
    personalValue: { color: colors.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', flex: 1, textAlign: 'right', marginLeft: 16 },
    personalActionText: { color: colors.primary, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },

    actionIconCircle: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },
    actionCardTitle: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
    actionCardSub: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },

    // Logout
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 14, paddingVertical: 16,
        borderWidth: 2, borderColor: colors.border,
    },
    logoutText: { color: colors.textSecondary, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14 },

    // Color Wheel Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    wheelModal: {
        backgroundColor: colors.bg, borderRadius: 24, padding: 24, width: 300,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    wheelTitle: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 },
    wheelContainer: {
        width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2,
        backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', overflow: 'hidden', position: 'relative',
    },
    wheelCenterOverlay: {
        position: 'absolute', width: WHEEL_SIZE * 0.38, height: WHEEL_SIZE * 0.38,
        borderRadius: WHEEL_SIZE * 0.19, backgroundColor: isDark ? '#222' : '#fff',
        left: WHEEL_SIZE * 0.31, top: WHEEL_SIZE * 0.31,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: isDark ? '#333' : '#e0e0e0',
    },
    wheelCenterPreview: {
        width: WHEEL_SIZE * 0.28, height: WHEEL_SIZE * 0.28, borderRadius: WHEEL_SIZE * 0.14,
    },
    wheelCursor: {
        position: 'absolute', width: 32, height: 32, borderRadius: 16,
        borderWidth: 4, backgroundColor: '#fff',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 },
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 12 },
    previewSwatch: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
    previewHex: { color: colors.text, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    brightnessRow: { width: '100%', marginBottom: 16 },
    brightnessLabel: { color: colors.slate400, fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', marginBottom: 6 },
    brightnessTrack: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 32 },
    brightnessBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    brightnessBtnText: { color: colors.text, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    brightnessFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
    wheelSubtitle: { color: colors.primary, fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 10, textAlign: 'center' },
    wheelActions: { alignItems: 'center', gap: 8, width: '100%', marginTop: 8 },
    wheelApplyBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
    wheelApplyText: { color: '#000', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
    wheelCancelBtn: { paddingVertical: 8, alignItems: 'center' },
    wheelCancelText: { color: colors.textSecondary, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },

    // Custom Modals
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000
    },
    modalContent: {
        backgroundColor: colors.bg, borderRadius: 24, padding: 24,
        alignItems: 'center', width: '100%', borderWidth: 1, borderColor: colors.border
    },
    modalIconBg: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16
    },
    modalTitle: { color: colors.text, fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8, textAlign: 'center' },
    modalMessage: { color: colors.slate400, fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    modalBtn: { backgroundColor: colors.bgCard, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    modalBtnText: { color: colors.primary, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },
});
