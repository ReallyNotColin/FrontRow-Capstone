import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { AuthProvider } from './auth/AuthProvider';
import 'react-native-reanimated';

import { initDB } from '@/db/history';
import { useEffect } from 'react';

import { ThemedColorProvider, useThemedColor } from '@/components/ThemedColor';
import { FontSizeProvider } from '@/components/FontTheme';

function NavigationWrapper() {
  const { isDarkMode, colors } = useThemedColor();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    initDB();

  }, []);

  if (!loaded) {
    return null;
  }

  const CustomDarkTheme = {
    ...NavigationDarkTheme,
    colors: {
      ...NavigationDarkTheme.colors,
      ...colors.dark, // <-- from ThemedColor.tsx
    },
  };

  const CustomLightTheme = {
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      ...colors.light, // <-- from ThemedColor.tsx
    },
  };

  return (
    <NavigationThemeProvider value={isDarkMode ? CustomDarkTheme : CustomLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FontSizeProvider>
        <ThemedColorProvider>
          <Slot />
          <NavigationWrapper />
        </ThemedColorProvider>
      </FontSizeProvider>
    </AuthProvider>
  );
}
