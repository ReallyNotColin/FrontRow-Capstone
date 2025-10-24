// app/(tabs)/settings.tsx
import React, { useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View, Modal, TextInput, ActivityIndicator } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { BlurView } from "expo-blur";
import Dropdown from "react-native-input-select";

import { useThemedColor } from "@/components/ThemedColor";
import { useFontSize } from "@/components/FontTheme";
import { useAuth } from "@/auth/AuthProvider";
import { db, auth } from "@/db/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  multiFactor,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { router } from "expo-router"; // NEW

export default function Screen() {
  const { isDarkMode, setIsDarkMode, colors } = useThemedColor();
  const { fontSize, setFontSize } = useFontSize();
  const { signOut } = useAuth();

  const [userData, setUserData] = useState<any>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // MFA state
  const [checkingMfa, setCheckingMfa] = useState(true);
  const [totpEnrolled, setTotpEnrolled] = useState<boolean>(false);

  const activeColors = isDarkMode ? colors.dark : colors.light;
  const sizeMultiplier = fontSize === 'medium' ? 1.25 : fontSize === 'large' ? 1.5 : 1;

  const textSizeOptions = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setUserData(userDoc.exists() ? userDoc.data() : { email: user.email });
      }
    };
    fetchUser();
  }, []);

  // NEW: check whether this user already has TOTP enrolled
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setTotpEnrolled(false);
      setCheckingMfa(false);
      return;
    }
    try {
      const factors = multiFactor(u).enrolledFactors ?? [];
      const hasTotp = factors.some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      setTotpEnrolled(hasTotp);
    } finally {
      setCheckingMfa(false);
    }
  }, [auth.currentUser?.uid]); // re-check on account switch

  const handlePasswordChange = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    try {
      setLoading(true);
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Success", "Password updated successfully.");
      setPasswordModalVisible(false);
      setNewPassword("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
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
      ],
      { cancelable: true }
    );
  };

  const goEnrollTotp = () => {
    const u = auth.currentUser;
    if (!u) {
      Alert.alert("You need to sign in first.");
      return;
    }
    router.push("/auth/mfa-enroll-totp");
  };

  return (
    <LinearGradient colors = {activeColors.gradientBackground} style = {styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>
          Settings
        </ThemedText>
      </ThemedView>
      <View style={[styles.divider, { backgroundColor: activeColors.divider }]} />
      <ScrollView>
        {/* User Info */}
        {userData && (
          <ThemedView style={[styles.text, { paddingBottom: 15 }]}>
            <ThemedText type="subtitle" style={{ color: activeColors.text, marginTop: 16, marginBottom: 8, fontWeight: "700" }}>
              Your Info
            </ThemedText>
            <ThemedText style={{ color: activeColors.text }}>
              <ThemedText style={{ color: activeColors.text, fontWeight: "600" }}>Email: </ThemedText>
              {userData.email}
            </ThemedText>
          </ThemedView>
        )}

        <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

        <ThemedView style={styles.text}>
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
            <View className="iconLabel" style={styles.iconLabel}>
              <IconSymbol name="textformat.size" color={activeColors.icon} size={24} />
              <ThemedText style={[styles.labelText, { color: activeColors.text }]}>Text Size</ThemedText>
            </View>
            <View style={styles.dropdownContainer}>
              <Dropdown
                label=""
                placeholder="Small"
                options={textSizeOptions}
                selectedValue={fontSize}
                onValueChange={(selected) => {
                  if (Array.isArray(selected)) {
                    setFontSize(selected[0] as "small" | "medium" | "large");
                  } else if (typeof selected === "string") {
                    setFontSize(selected as "small" | "medium" | "large");
                  }
                }}
                primaryColor={activeColors.primary}
                dropdownStyle={{
                  ...styles.dropdown,
                  backgroundColor: activeColors.backgroundTitle,
                  borderColor: activeColors.divider,
                }}
                placeholderStyle={{
                  color: activeColors.text,
                  fontSize: 20,
                }}
                selectedItemStyle={{ 
                  color: activeColors.text,
                  fontSize: 16 * sizeMultiplier,
                }}
                dropdownIconStyle={styles.hiddenIcon}
              />
            </View>
          </View>

          <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

          {/* MFA */}
          <View style={styles.settingRow}>
            <View style={styles.iconLabel}>
              <IconSymbol name="shield.checkerboard" color={activeColors.icon} size={24} />
              <ThemedText style={[styles.labelText, { color: activeColors.text }]}>
                Multi-Factor Authentication
              </ThemedText>
            </View>

            {checkingMfa ? (
              <ActivityIndicator />
            ) : totpEnrolled ? (
              <Pressable
                disabled
                style={[
                  styles.primaryButtonOutline,
                  { borderColor: activeColors.divider, opacity: 0.6 },
                ]}
              >
                <ThemedText style={[styles.primaryText, { color: activeColors.text }]}>
                  Enabled
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={goEnrollTotp}
                style={({ pressed }) => [
                  styles.primaryButtonOutline,
                  {
                    borderColor: activeColors.primary,
                    backgroundColor: pressed ? `${activeColors.primary}22` : "transparent",
                  },
                ]}
              >
                <IconSymbol name="lock.shield" color={activeColors.primary} size={20} />
                <ThemedText style={[styles.primaryText, { color: activeColors.primary, marginLeft: 8 }]}>
                  Set up MFA
                </ThemedText>
              </Pressable>
            )}
          </View>

          <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

          {/* Buttons row */}
          <View style={styles.accountButtonsRow}>
            <Pressable
              onPress={confirmSignOut}
              disabled={signingOut}
              style={({ pressed }) => [
                styles.dangerButton,
                {
                  borderColor: activeColors.red,
                  backgroundColor: pressed ? `${activeColors.red}22` : "transparent",
                },
              ]}
            >
              <IconSymbol name="rectangle.portrait.and.arrow.right" color={activeColors.red} size={22} />
              <ThemedText style={[styles.dangerText, { color: activeColors.red, marginLeft: 8 }]}>
                {signingOut ? "Signing out…" : "Sign Out"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setPasswordModalVisible(true)}
              style={({ pressed }) => [
                styles.primaryButtonOutline,
                {
                  borderColor: activeColors.primary,
                  backgroundColor: pressed ? `${activeColors.primary}22` : "transparent",
                },
              ]}
            >
              <IconSymbol name="key.fill" color={activeColors.primary} size={20} />
              <ThemedText style={[styles.primaryText, { color: activeColors.primary, marginLeft: 8 }]}>
                Change Password
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* Password Modal (unchanged) */}
        <Modal visible={passwordModalVisible} transparent animationType="fade">
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: activeColors.background }]}>
              <ThemedText type="subtitle" style={{ color: activeColors.text, marginBottom: 12 }}>
                Change Password
              </ThemedText>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Current password"
                placeholderTextColor="#bbbbbb"
                style={[styles.input, { borderColor: activeColors.divider, color: activeColors.text }]}
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="New password"
                placeholderTextColor="#bbbbbb"
                style={[styles.input, { borderColor: activeColors.divider, color: activeColors.text }]}
              />
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setPasswordModalVisible(false)} style={[styles.button, { backgroundColor: activeColors.divider }]}>
                  <ThemedText style={{ color: activeColors.text }}>Cancel</ThemedText>
                </Pressable>
                <Pressable onPress={handlePasswordChange} disabled={loading} style={[styles.button, { backgroundColor: activeColors.primary }]}>
                  <ThemedText style={{ color: "white" }}>{loading ? "Saving…" : "Save"}</ThemedText>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </Modal>
      </ScrollView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    width: "100%",
  },
  dividerThin: {
    height: 1,
    width: "150%",
    marginBottom: 15,
    marginTop: 15,
    alignSelf: "center",
  },
  text: {
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    flexWrap: "wrap",
    gap: 8,
  },
  settingRowDropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    flexWrap: "nowrap",
  },
  iconLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelText: {
    marginLeft: 8,
  },
  dropdownContainer: {
    alignSelf: "flex-end",
  },
  dropdown: {
    minWidth: 91,
    minHeight: 40,
    alignItems: "center",
    borderWidth: 1,
  },
  hiddenIcon: {
    display: "none",
  },

  // New styles for Sign Out button
  dangerButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dangerText: {
    fontWeight: "600",
  },
  primaryButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryText: {
    fontWeight: "600",
  },
  accountButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    flexWrap: "wrap",
    gap: 10,
  },

  modalOverlay: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  },
  modalContent: {
    width: "85%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
