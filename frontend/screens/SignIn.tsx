// screens/SignIn.tsx
import React, { useEffect, useState } from "react";
import { View, TextInput, Button, Text, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";

export default function SignIn() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If auth state resolves and we have a user, hop to tabs.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/search"); // replace so back won't return to sign-in
    }
  }, [user, loading]);

  const onSignIn = async () => {
    const e = email.trim();
    if (!e || !password) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }
    try {
      setSubmitting(true);
      await signIn(e, password);
      // onAuthStateChanged will flip `user`, effect above will navigate
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Optional: while initial auth state is loading, render nothing (or a splash)
  if (loading) return null;

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24 }}>Sign In</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        value={email}
        style={{ borderWidth: 1, padding: 8 }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
        style={{ borderWidth: 1, padding: 8 }}
      />

      <Button title={submitting ? "Signing in..." : "Sign In"} onPress={onSignIn} disabled={submitting} />

      {/* Sign Up link */}
      <Pressable onPress={() => router.push("/auth/sign-up")} style={{ paddingVertical: 8 }}>
        <Text style={{ textAlign: "center", textDecorationLine: "underline" }}>
          Don’t have an account? Create one
        </Text>
      </Pressable>
    </View>
  );
}
