// app/admin/_layout.tsx
import React from "react";
import { Stack, router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { useThemedColor } from "@/components/ThemedColor";

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  if (loading) return null;
  if (!isAdmin) return null;

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Ticket Inbox",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/admin/settings")}
              style={{ paddingHorizontal: 8, paddingVertical: 6 }}
            >
              <Text style={{ fontWeight: "600", color: activeColors.primary }}>
                Settings
              </Text>
            </Pressable>
          ),
          // Optional: make the whole header follow your theme
          headerStyle: { backgroundColor: activeColors.background },
          headerTitleStyle: { color: activeColors.text },
          headerTintColor: activeColors.text,
        }}
      />
      <Stack.Screen name="ticket/[id]" options={{ title: "Ticket" }} />
      <Stack.Screen name="settings" options={{ title: "Admin Settings" }} />
    </Stack>
  );
}
