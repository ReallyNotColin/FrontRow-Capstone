// app/admin/settings.tsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Modal,
  TextInput,
  ActivityIndicator,
  Text,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import Dropdown from "react-native-input-select";
import { BlurView } from "expo-blur";
import { router } from "expo-router";

import { useThemedColor } from "@/components/ThemedColor";
import { useFontSize } from "@/components/FontTheme";
import { useAuth } from "@/auth/AuthProvider";

import { db, auth } from "@/db/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  multiFactor,
  TotpMultiFactorGenerator,
} from "firebase/auth";

export default function AdminSettings() {
  const { isDarkMode, setIsDarkMode, colors } = useThemedColor();
  const { fontSize, setFontSize } = useFontSize();
  const { signOut } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Password modal state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // MFA state
  const [checkingMfa, setCheckingMfa] = useState(true);
  const [totpEnrolled, setTotpEnrolled] = useState<boolean>(false);

  const activeColors = isDarkMode ? colors.dark : colors.light;
  const dangerColor = isDarkMode ? "#ff453a" : "#ff3b30";

  const textSizeOptions = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];

  // Fetch simple user info (email) like the user Settings screen
  useEffect(() => {
    const fetchUser = async () => {
      const u = auth.currentUser;
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setUserData(snap.exists() ? snap.data() : { email: u.email });
      }
    };
    fetchUser();
  }, []);

  // Check if TOTP already enrolled (mirror user Settings)
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
  }, [auth.currentUser?.uid]);

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

  const handlePasswordChange = async () => {
    const u = auth.currentUser;
    if (!u || !u.email) return;
    try {
      setSavingPassword(true);
      const cred = EmailAuthProvider.credential(u.email, currentPassword);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPassword);
      Alert.alert("Success", "Password updated successfully.");
      setPasswordModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? String(err));
    } finally {
      setSavingPassword(false);
    }
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
    <ScrollView style={{ backgroundColor: activeColors.background }}>
      {/* Header with "Close" to return to inbox */}
      <View style={[styles.header, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>
          Admin Settings
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: activeColors.text, fontWeight: "600" }}>Close</Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      {/* User Info */}
      {userData && (
        <ThemedView style={[styles.content, { paddingBottom: 12 }]}>
          <ThemedText type="subtitle" style={{ color: activeColors.text, marginBottom: 8, fontWeight: "700" }}>
            Your Info
          </ThemedText>
          <ThemedText style={{ color: activeColors.text }}>
            <ThemedText style={{ color: activeColors.text, fontWeight: "600" }}>Email: </ThemedText>
            {userData.email}
          </ThemedText>
        </ThemedView>
      )}

      <View style={[styles.dividerThin, { backgroundColor: activeColors.divider }]} />

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
              style={[styles.primaryButtonOutline, { borderColor: activeColors.divider, opacity: 0.6 }]}
            >
              <ThemedText style={[styles.primaryText, { color: activeColors.text }]}>Enabled</ThemedText>
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

        {/* Buttons row: Sign out + Change password */}
        <View style={styles.accountButtonsRow}>
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

      {/* Password Modal */}
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
              <Pressable onPress={handlePasswordChange} disabled={savingPassword} style={[styles.button, { backgroundColor: activeColors.primary }]}>
                <ThemedText style={{ color: "white" }}>{savingPassword ? "Saving…" : "Save"}</ThemedText>
              </Pressable>
            </View>
          </View>
        </BlurView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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

  accountButtonsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },

  // Buttons
  dangerButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dangerText: { fontWeight: "600" },
  primaryButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryText: { fontWeight: "600" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: {
    width: "85%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  button: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
});
