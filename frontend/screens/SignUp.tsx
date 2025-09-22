// screens/SignUp.tsx
import React, { useState } from "react";
import { View, TextInput, Button, Text, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";

export default function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    const e = email.trim();
    if (!e || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      setSubmitting(true);
      await signUp(e, password);          // creates the user
      Alert.alert("Check your email", "We sent you a verification link.");
      router.replace("./app/auth/verify-email");     // go to verify flow, not tabs
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 12 }}>Create Account</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
        style={{ borderWidth: 1, marginBottom: 12, padding: 8 }}
      />
      <Button title={submitting ? "Creating..." : "Sign Up"} onPress={handleSignUp} disabled={submitting} />
      {error && <Text style={{ color: "red", marginTop: 10 }}>{error}</Text>}
    </View>
  );
}
