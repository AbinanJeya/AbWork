import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme';
import { I18nProvider } from './src/services/i18n';
import { WorkoutProvider } from './src/contexts/WorkoutContext';
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { AppState } from 'react-native';
import { forceCloudBackup } from './src/services/cloudSync';

function AppStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Automatically push all 12 local databases to Firestore constantly
  React.useEffect(() => {
    // 1. Push when app goes to background
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        forceCloudBackup(true)
          .then(success => { if (success) console.log("☁️ Auto-Background Cloud Sync Completed"); })
          .catch(err => console.error("Auto Sync Failed", err));
      }
    });

    // 2. Push actively every 2 minutes while app is running
    const syncInterval = setInterval(() => {
      forceCloudBackup(true)
        .then(success => { if (success) console.log("☁️ Continuous Active Cloud Sync Completed"); })
        .catch(err => console.error("Continuous Sync Failed", err));
    }, 120000);

    return () => {
      subscription.remove();
      clearInterval(syncInterval);
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0c0d0c', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#59f20d" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <ThemeProvider>
            <WorkoutProvider>
              <NavigationContainer>
                <AppStatusBar />
                <AppNavigator />
              </NavigationContainer>
            </WorkoutProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
