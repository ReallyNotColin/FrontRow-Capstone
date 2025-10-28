import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { auth } from "@/db/firebaseConfig";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import {
  multiFactor,
  TotpMultiFactorGenerator,
  getAuth,
} from "firebase/auth";

export default function MfaEnrollTotp() {
  const [phase, setPhase] = useState<"idle" | "generating" | "ready" | "verifying" | "done">("idle");
  const [secret, setSecret] = useState<null | Awaited<ReturnType<typeof TotpMultiFactorGenerator.generateSecret>>>(null);
  const [otpUri, setOtpUri] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    // Auto-start generation when screen opens
    const run = async () => {
      const u = auth.currentUser;
      if (!u) {
        Alert.alert("Please sign in first.");
        router.replace("/auth/sign-in");
        return;
      }

      // If already enrolled, bounce back
      const enrolled = multiFactor(u).enrolledFactors ?? [];
      if (enrolled.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
        Alert.alert("MFA already enabled for this account.");
        router.back();
        return;
      }

      try {
        setPhase("generating");
        const session = await multiFactor(u).getSession();
        const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
        setSecret(totpSecret);

        // Build otpauth URL for QR (or use helper)
        const uri = totpSecret.generateQrCodeUrl({
          accountName: u.email ?? "user",
          issuer: "NibbleWise",
        });
        setOtpUri(uri);
        setPhase("ready");
      } catch (e: any) {
        setPhase("idle");
        Alert.alert("Could not prepare TOTP", e?.message ?? String(e));
      }
    };
    run();
  }, []);

  const onVerify = async () => {
    const u = auth.currentUser;
    if (!u || !secret) return;

    if (!code || code.trim().length < 6) {
      Alert.alert("Enter the 6-digit code from your authenticator app.");
      return;
    }

    try {
      setPhase("verifying");
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(u).enroll(assertion, "Authenticator app");
      setPhase("done");
      Alert.alert("Success", "MFA has been enabled for your account.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setPhase("ready");
      Alert.alert("Enrollment failed", e?.message ?? String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16, marginTop:"36" }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Set up MFA (TOTP)</Text>

      {phase === "generating" && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text>Preparing TOTP secret…</Text>
        </View>
      )}

      {phase === "ready" && secret && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontWeight: "600" }}>1) Scan this QR in your authenticator</Text>
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            {otpUri ? <QRCode value={otpUri} size={220} /> : <ActivityIndicator />}
          </View>

          <Text style={{ color: "#666" }}>
            If you can’t scan the QR, add the account manually using this secret:
          </Text>
          <View style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: "#ddd" }}>
            <Text selectable style={{ fontFamily: "monospace" }}>
              {secret.secretKey}
            </Text>
          </View>

          <Text style={{ fontWeight: "600", marginTop: 8 }}>2) Enter the 6-digit code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            maxLength={6}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 18,
              letterSpacing: 4,
            }}
          />

          <Pressable
            onPress={onVerify}
            disabled={phase === "verifying"}
            style={({ pressed }) => ({
              marginTop: 12,
              backgroundColor: pressed ? "#27778E" : "#27778E",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            })}
          >
            {phase === "verifying" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "white", fontWeight: "700" }}>Verify & Enable</Text>
            )}
          </Pressable>
        </View>
      )}

      {phase === "done" && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text>MFA enabled 🎉</Text>
        </View>
      )}
    </ScrollView>
  );
}
