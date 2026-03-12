import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
    ActivityIndicator, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { saveUserProfile, getUserProfile, saveSettings, getSettings } from '../services/storage';
import { signUp, signIn, signInWithGoogle, sendVerificationEmail, signOut } from '../services/auth';
import { restoreFromCloud } from '../services/cloudSync';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
    webClientId: '802364713780-bjp3s75fdtb2h9hup2gsveg1i7m14qjr.apps.googleusercontent.com',
});

export default function WelcomeScreen({ navigation }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLogin, setIsLogin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

    const showError = (title, message) => setErrorModal({ visible: true, title, message });

    const getFirebaseErrorMessage = (code) => {
        switch (code) {
            case 'auth/email-already-in-use': return 'An account with this email already exists.';
            case 'auth/invalid-email': return 'Please enter a valid email address.';
            case 'auth/weak-password': return 'Password must be at least 6 characters.';
            case 'auth/user-not-found': return 'No account found with this email.';
            case 'auth/wrong-password': return 'Incorrect password.';
            case 'auth/invalid-credential': return 'Invalid email or password.';
            case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
            case 'auth/network-request-failed': return 'Network error. Check your connection.';
            default: return 'Something went wrong. Please try again.';
        }
    };

    const handleAuth = async () => {
        if (!email.trim() || !password.trim()) {
            showError('Missing Information', 'Please fill in all fields.');
            return;
        }
        if (!isLogin && password.length < 8) {
            showError('Invalid Password', 'Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                const user = await signIn(email.trim(), password);

                // Enforce email verification
                if (!user.emailVerified) {
                    await signOut();
                    setLoading(false);
                    Alert.alert(
                        "Email Not Verified",
                        "Please verify your email address before logging in.",
                        [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Resend Email",
                                onPress: async () => {
                                    try {
                                        // To resend safely, we sign them back in temporarily 
                                        const tempUser = await signIn(email.trim(), password);
                                        await sendVerificationEmail(tempUser);
                                        await signOut();
                                        Alert.alert("Sent", "A new verification email has been sent.");
                                    } catch (e) {
                                        showError("Error", "Could not resend email.");
                                    }
                                }
                            }
                        ]
                    );
                    return;
                }

                // Verified login: proceed normally. Trigger the massive Cloud Pull
                await restoreFromCloud(user.uid);

                // Now that the cloud sync has finished injecting into AsyncStorage, read 
                // the local profile to see if they've ever completed Onboarding before
                const existing = await getUserProfile() || {};
                const hasOnboarded = existing.onboardingComplete === true;

                if (hasOnboarded) {
                    navigation.replace('Tabs');
                } else {
                    navigation.replace('HealthConnectOnboarding');
                }

            } else {
                // Handle Registration
                const user = await signUp(email.trim(), password);
                await sendVerificationEmail(user);
                await signOut(); // Force them out so they must verify

                Alert.alert(
                    "Verify Your Email",
                    "We've sent a verification link to your email. Please verify your account before logging in."
                );
                setIsLogin(true); // Switch to login screen
            }
        } catch (err) {
            console.error('Auth error:', err.code, err.message);
            showError('Authentication Error', getFirebaseErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleSkipLogin = async () => {
        const existing = await getUserProfile();
        if (existing?.onboardingComplete) {
            navigation.replace('Tabs');
        } else {
            await saveUserProfile({ email: '', authMethod: 'skipped' });
            navigation.replace('HealthConnectOnboarding');
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();

            // Force sign out to always show the account picker
            try { await GoogleSignin.signOut(); } catch (e) { }

            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.data?.idToken || userInfo.idToken;

            if (!idToken) throw new Error("Could not retrieve Google ID Token");

            const user = await signInWithGoogle(idToken);

            // Verified login: proceed normally. Trigger the massive Cloud Pull
            await restoreFromCloud(user.uid);

            // Check if this newly restored local profile indicates they've finished setup
            const existing = await getUserProfile() || {};
            const hasOnboarded = existing.onboardingComplete === true;

            if (hasOnboarded) {
                navigation.replace('Tabs');
            } else {
                navigation.replace('HealthConnectOnboarding');
            }
        } catch (err) {
            console.error('Google auth error:', err);
            showError('Google Sign-In Error', err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Logo */}
                <View style={styles.logoWrap}>
                    <View style={styles.logoBg}>
                        <MaterialIcons name="fitness-center" size={28} color={colors.primary} />
                    </View>
                </View>

                <Text style={styles.title}>Welcome to{'\n'}AbWork</Text>
                <Text style={styles.subtitle}>
                    Track steps, log workouts, and fuel your{'\n'}body with AI-driven nutrition.
                </Text>

                {/* Email */}
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputRow}>
                    <MaterialIcons name="email" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="name@example.com"
                        placeholderTextColor={colors.slate500}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                {/* Password */}
                <Text style={styles.label}>{isLogin ? 'Password' : 'Create Password'}</Text>
                <View style={styles.inputRow}>
                    <MaterialIcons name="lock-outline" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Must be at least 8 characters"
                        placeholderTextColor={colors.slate500}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Sign Up / Log In Button */}
                <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleAuth} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={colors.bgDark} />
                    ) : (
                        <Text style={styles.primaryBtnText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
                    )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Skip & Google */}
                <View style={styles.socialRow}>
                    <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin} disabled={loading}>
                        <Text style={styles.socialIcon}>G</Text>
                        <Text style={styles.socialLabel}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialBtn} onPress={handleSkipLogin}>
                        <MaterialIcons name="arrow-forward" size={16} color={colors.text} />
                        <Text style={styles.socialLabel}>Skip</Text>
                    </TouchableOpacity>
                </View>

                {/* Toggle Login / Signup */}
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleRow}>
                    <Text style={styles.toggleText}>
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Custom Error Modal */}
            <Modal
                visible={errorModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBg}>
                            <MaterialIcons name="error-outline" size={28} color="#ef4444" />
                        </View>
                        <Text style={styles.modalTitle}>{errorModal.title}</Text>
                        <Text style={styles.modalMessage}>{errorModal.message}</Text>
                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setErrorModal({ ...errorModal, visible: false })}
                        >
                            <Text style={styles.modalBtnText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    content: { paddingHorizontal: 24, paddingTop: 30 },

    logoWrap: { alignItems: 'center', marginBottom: 20 },
    logoBg: {
        width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primaryDim,
        alignItems: 'center', justifyContent: 'center',
    },

    title: { color: colors.text, fontSize: 32, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', lineHeight: 40 },
    subtitle: {
        color: colors.primary, fontSize: 14, textAlign: 'center', marginTop: 12, marginBottom: 30,
        lineHeight: 22, fontFamily: 'SpaceGrotesk_500Medium',
    },

    label: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8, marginTop: 16 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    },
    inputIcon: { fontSize: 16, marginRight: 10 },
    input: { flex: 1, color: colors.white, fontSize: 14, paddingVertical: 16 },
    eyeIcon: { fontSize: 18, padding: 4 },

    primaryBtn: {
        backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18,
        alignItems: 'center', marginTop: 24,
    },
    primaryBtnText: { color: colors.bgDark, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.slate400, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.5 },

    socialRow: { flexDirection: 'row', gap: 12 },
    socialBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    socialIcon: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: colors.text },
    socialLabel: { color: colors.text, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold' },

    toggleRow: { alignItems: 'center', marginTop: 24 },
    toggleText: { color: colors.primary, fontSize: 14 },
    toggleLink: { fontFamily: 'SpaceGrotesk_700Bold' },

    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', padding: 24
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
    modalBtn: { backgroundColor: colors.bgCard, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    modalBtnText: { color: colors.primary, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
});
