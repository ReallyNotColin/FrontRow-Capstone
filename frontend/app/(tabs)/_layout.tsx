import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useThemedColor } from '@/components/ThemedColor';

export default function TabLayout() {
  const { activeColors } = useThemedColor();

  const activeTintColor = activeColors.primary;
  const inactiveTintColor = activeColors.secondaryText;
  const backgroundColor = activeColors.background;
  const backgroundTitleColor = activeColors.backgroundTitle;
  const borderTopColor = activeColors.divider;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: backgroundTitleColor,
            borderTopColor: borderTopColor,
            borderTopWidth: 1,
          },
          default: {
            backgroundColor: backgroundTitleColor,
            borderTopColor: borderTopColor,
            borderTopWidth: 1,
          },
        }),
      }}
    >
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={Platform.OS === 'ios' ? 35 : 28} name="camera" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Profiles',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={Platform.OS === 'ios' ? 38 : 28} name="person.2" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

