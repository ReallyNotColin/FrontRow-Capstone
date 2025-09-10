// app/_layout.tsx
import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';

import { AuthProvider } from '../auth/AuthProvider';
import { ThemedColorProvider, useThemedColor } from '@/components/ThemedColor';
import { FontSizeProvider } from '@/components/FontTheme';

function ThemeWrapper(props) {
  const { children } = props;
  const { isDarkMode, colors } = useThemedColor();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  const CustomDarkTheme = {
    ...NavigationDarkTheme,
    colors: {
      ...NavigationDarkTheme.colors,
      ...colors.dark,
    },
  };

  const CustomLightTheme = {
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      ...colors.light,
    },
  };

  const theme = isDarkMode ? CustomDarkTheme : CustomLightTheme;

  return (
    <ThemeProvider value={theme}>
      {children}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FontSizeProvider>
        <ThemedColorProvider>
          {/* Single navigator tree via Slot; child groups define Tabs/Stack */}
          <ThemeWrapper>
            <Slot />
          </ThemeWrapper>
        </ThemedColorProvider>
      </FontSizeProvider>
    </AuthProvider>
  );
}
