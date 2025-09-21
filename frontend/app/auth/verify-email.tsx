// app/auth/verify.tsx
import React, { useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";

export default function Verify() {
  const { user, resendVerification, refreshAuthClaims } = useAuth();
  const [busy, setBusy] = useState(false);

  const onResend = async () => {
    setBusy(true);
    try {
      await resendVerification();
      Alert.alert("Verification email sent");
    } catch (e: any) {
      Alert.alert("Failed to send email", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onIveVerified = async () => {
    setBusy(true);
    try {
      await refreshAuthClaims(); // updates user.emailVerified
      if (user?.emailVerified) router.replace("/(tabs)/search");
      else Alert.alert("Still not verified", "Open the email link, then tap again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex:1, justifyContent:"center", alignItems:"center", padding:24 }}>
      <Text style={{ fontSize: 20, marginBottom: 12 }}>Verify your email</Text>
      <Text style={{ textAlign: "center", marginBottom: 24 }}>
        We sent a verification link to your email. Open it, then come back and tap below.
      </Text>
      <Button title={busy ? "Checking..." : "I've verified"} onPress={onIveVerified} disabled={busy} />
      <View style={{ height: 12 }} />
      <Button title="Resend verification email" onPress={onResend} disabled={busy} />
    </View>
  );
}
