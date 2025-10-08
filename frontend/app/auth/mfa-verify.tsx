import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { getPendingMfaResolver, clearPendingMfaResolver } from "@/auth/mfaResolverStore";
import { TotpMultiFactorGenerator } from "firebase/auth";

export default function MfaVerify() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const resolver = getPendingMfaResolver();
    if (!resolver) {
      // If user hit this screen without a resolver (e.g., deep refresh), bounce back to sign-in
      router.replace("/auth/sign-in");
    }
  }, []);

  const onVerify = async () => {
    const resolver = getPendingMfaResolver();
    if (!resolver) {
      Alert.alert("Missing session", "Please sign in again.");
      router.replace("/auth/sign-in");
      return;
    }
    if (!code || code.trim().length < 6) {
      Alert.alert("Enter the 6-digit code");
      return;
    }
    try {
      setSubmitting(true);
      // Find a TOTP hint among enrolled factors
      const totpHint = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!totpHint) {
        Alert.alert("No TOTP factor found", "This account doesn’t have a TOTP factor enrolled.");
        return;
      }
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code.trim());
      await resolver.resolveSignIn(assertion);
      clearPendingMfaResolver();
      // AuthProvider will route you after auth state changes; but we can be explicit:
      router.replace("/(tabs)/scan");
    } catch (e: any) {
      Alert.alert("Verification failed", e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    clearPendingMfaResolver();
    router.replace("/auth/sign-in");
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Enter verification code</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        placeholder="123456"
        maxLength={6}
        style={{
          borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, letterSpacing: 4,
        }}
      />

      <Pressable
        onPress={onVerify}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#0a84ffcc" : "#0a84ff",
          paddingVertical: 12, borderRadius: 10, alignItems: "center",
        })}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Verify</Text>}
      </Pressable>

      <Pressable onPress={onCancel} style={{ alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ color: "#666" }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
