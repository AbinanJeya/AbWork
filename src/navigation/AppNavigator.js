import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { getUserProfile } from '../services/storage';
import { useTranslation } from '../services/i18n';

import DashboardScreen from '../screens/DashboardScreen';
import DiaryScreen from '../screens/DiaryScreen';
import AdviceScreen from '../screens/AdviceScreen';
import WorkoutPlannerScreen from '../screens/WorkoutPlannerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SettingsMenuScreen from '../screens/SettingsMenuScreen';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import HealthConnectOnboardingScreen from '../screens/HealthConnectOnboardingScreen';
import TDEECalculatorScreen from '../screens/TDEECalculatorScreen';
import GoalSelectionScreen from '../screens/GoalSelectionScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import WearableIntegrationScreen from '../screens/WearableIntegrationScreen';
import SleepScreen from '../screens/SleepScreen';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import AIChatOverlay from '../components/AIChatOverlay';
import WorkoutOverlay from '../components/WorkoutOverlay';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const tabIcons = {
    Dashboard: { lib: MaterialIcons, icon: 'home', iconActive: 'home' },
    Diary: { lib: MaterialIcons, icon: 'menu-book', iconActive: 'menu-book' },
    Advice: { lib: MaterialIcons, icon: 'auto-awesome', iconActive: 'auto-awesome' },
    Workout: { lib: MaterialCommunityIcons, icon: 'dumbbell', iconActive: 'dumbbell' },
    Profile: { lib: MaterialIcons, icon: 'person-outline', iconActive: 'person' },
};

function CustomTabBar({ state, descriptors, navigation }) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const styles = getStyles(colors);
    const [showChat, setShowChat] = useState(false);

    return (
        <>
            <AIChatOverlay
                visible={showChat}
                onClose={() => setShowChat(false)}
                context={{}}
            />

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const iconConfig = tabIcons[route.name] || tabIcons.Dashboard;
                    const IconComponent = iconConfig.lib;
                    const iconName = isFocused ? iconConfig.iconActive : iconConfig.icon;
                    const iconColor = isFocused ? colors.primary : colors.textSecondary;

                    return (
                        <TouchableOpacity
                            key={route.name}
                            onPress={onPress}
                            style={styles.tab}
                        >
                            <IconComponent
                                name={iconName}
                                size={24}
                                color={iconColor}
                            />
                            <Text style={[styles.tabLabel, isFocused && { color: colors.primary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                                {t('tab_' + (route.name === 'Workout' ? 'workouts' : route.name.toLowerCase()))}
                            </Text>
                            {isFocused && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </>
    );
}

function TabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Diary" component={DiaryScreen} />
            <Tab.Screen name="Advice" component={AdviceScreen} />
            <Tab.Screen name="Workout" component={WorkoutPlannerScreen} />
            <Tab.Screen name="Profile" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { colors } = useTheme();
    const [initialRoute, setInitialRoute] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const profile = await getUserProfile();
                if (profile?.onboardingComplete) {
                    setInitialRoute('Tabs');
                } else {
                    setInitialRoute('Welcome');
                }
            } catch {
                setInitialRoute('Welcome');
            }
        })();
    }, []);

    if (!initialRoute) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bgDark, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.bgDark }}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bgDark },
                }}
                initialRouteName={initialRoute}
            >
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="HealthConnectOnboarding" component={HealthConnectOnboardingScreen} />
                <Stack.Screen name="TDEECalculator" component={TDEECalculatorScreen} />
                <Stack.Screen name="GoalSelection" component={GoalSelectionScreen} />
                <Stack.Screen
                    name="Tabs"
                    component={TabNavigator}
                    options={{ freezeOnBlur: false }}
                />
                <Stack.Screen
                    name="CreateRoutine"
                    component={CreateRoutineScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <Stack.Screen
                    name="Leaderboard"
                    component={LeaderboardScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                    name="WorkoutHistory"
                    component={WorkoutHistoryScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                    name="SettingsMenu"
                    component={SettingsMenuScreen}
                    options={{
                        animation: 'fade',
                        animationDuration: 200,
                    }}
                />
                <Stack.Screen
                    name="WearableIntegration"
                    component={WearableIntegrationScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                    name="Sleep"
                    component={SleepScreen}
                    options={{ animation: 'slide_from_right' }}
                />
            </Stack.Navigator>
            <WorkoutOverlay />
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        flexDirection: 'row',
        backgroundColor: colors.tabBarBg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: 16,
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        gap: 4,
    },
    tabLabel: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk_500Medium',
        color: colors.textSecondary,
        letterSpacing: -0.2,
    },
    activeIndicator: {
        position: 'absolute',
        top: 0,
        width: 24,
        height: 3,
        borderRadius: 2,
        backgroundColor: colors.primary,
    },
});
