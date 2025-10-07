// app/admin/settings.tsx
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import Dropdown from "react-native-input-select";
import { useThemedColor } from "@/components/ThemedColor";
import { useFontSize } from "@/components/FontTheme";
import { useAuth } from "@/auth/AuthProvider";

export default function AdminSettings() {
  const { isDarkMode, setIsDarkMode, colors } = useThemedColor();
  const { fontSize, setFontSize } = useFontSize();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const activeColors = isDarkMode ? colors.dark : colors.light;
  const dangerColor = isDarkMode ? "#ff453a" : "#ff3b30";

  const textSizeOptions = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            setSigningOut(true);
            await signOut();
          } catch (e: any) {
            Alert.alert("Sign out failed", e?.message ?? String(e));
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: activeColors.background }}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>
          Admin Settings
        </ThemedText>
      </ThemedView>

      <View style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={styles.content}>
        {/* Dark Mode */}
        <View style={styles.settingRow}>
          <View style={styles.iconLabel}>
            <IconSymbol name="moon.fill" color={activeColors.icon} size={24} />
            <ThemedText style={[styles.labelText, { color: activeColors.text }]}>Dark Mode</ThemedText>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setIsDarkMode}
            trackColor={{ false: activeColors.switchTrack, true: activeColors.switchTrack }}
            thumbColor={activeColors.switchThumb}
          />
        </View>

        <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

        {/* Text Size */}
        <View style={styles.settingRowDropdown}>
          <View style={styles.iconLabel}>
            <IconSymbol name="textformat.size" color={activeColors.icon} size={24} />
            <ThemedText style={[styles.labelText, { color: activeColors.text }]}>Text Size</ThemedText>
          </View>
          <View style={styles.dropdownContainer}>
            <Dropdown
              label=""
              placeholder="Medium"
              options={textSizeOptions}
              selectedValue={fontSize}
              onValueChange={(selected) => {
                if (Array.isArray(selected)) setFontSize(selected[0] as "small" | "medium" | "large");
                else if (typeof selected === "string") setFontSize(selected as "small" | "medium" | "large");
              }}
              primaryColor={activeColors.primary}
              dropdownStyle={{
                ...styles.dropdown,
                backgroundColor: activeColors.background,
                borderColor: activeColors.divider,
              }}
              dropdownTextStyle={{ color: activeColors.text }}
              selectedItemStyle={{ color: activeColors.text }}
              dropdownIconStyle={styles.hiddenIcon}
            />
          </View>
        </View>

        <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

        {/* Sign Out */}
        <View style={{ paddingVertical: 12 }}>
          <Pressable
            onPress={confirmSignOut}
            disabled={signingOut}
            style={({ pressed }) => [
              styles.dangerButton,
              {
                borderColor: dangerColor,
                backgroundColor: pressed ? `${dangerColor}22` : "transparent",
              },
            ]}
          >
            <IconSymbol name="rectangle.portrait.and.arrow.right" color={dangerColor} size={22} />
            <ThemedText style={[styles.dangerText, { color: dangerColor, marginLeft: 8 }]}>
              {signingOut ? "Signing out…" : "Sign Out"}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { paddingTop: 20, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, marginBottom: 16, width: "100%" },
  dividerThin: { height: 1, width: "150%", marginBottom: 15, marginTop: 15, alignSelf: "center" },
  content: { backgroundColor: "transparent", paddingHorizontal: 24 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  settingRowDropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, flexWrap: "nowrap" },
  iconLabel: { flexDirection: "row", alignItems: "center" },
  labelText: { marginLeft: 8 },
  dropdownContainer: { alignSelf: "flex-end" },
  dropdown: { width: 91, minHeight: 40, alignItems: "center", borderWidth: 1 },
  hiddenIcon: { display: "none" },
  dangerButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  dangerText: { fontWeight: "600" },
});
