// app/auth/verify-email.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { auth } from "@/db/firebaseConfig";

export default function VerifyEmail() {
  const { user, loading, sendVerificationEmail, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user?.emailVerified) {
      router.replace("/(tabs)/search");
    }
  }, [user, loading]);

  if (loading) return null;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, marginBottom: 12 }}>Verify your email</Text>
      <Text style={{ marginBottom: 24 }}>
        We sent a verification link to {user?.email}. Please click the link in your email,
        then return here and tap “I’ve verified”.
      </Text>

      <Button
        title={busy ? "Sending..." : "Resend verification email"}
        disabled={busy}
        onPress={async () => {
          try {
            setBusy(true);
            await sendVerificationEmail();
            Alert.alert("Sent", "Check your inbox (and spam).");
          } catch (e: any) {
            Alert.alert("Failed", e?.message ?? String(e));
          } finally {
            setBusy(false);
          }
        }}
      />

      <View style={{ height: 12 }} />

      <Button
        title="I’ve verified"
        onPress={async () => {
          try {
            setBusy(true);
            await refreshUser();
            if (auth.currentUser?.emailVerified) {
              router.replace("/(tabs)/search");
            } else {
              Alert.alert("Not verified yet", "Please click the link in your email, then try again.");
            }
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
