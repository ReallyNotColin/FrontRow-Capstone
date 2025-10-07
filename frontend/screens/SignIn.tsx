// screens/SignIn.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { useThemedColor } from "@/components/ThemedColor";

export default function SignIn() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { isDarkMode, colors } = useThemedColor();
  const c = isDarkMode ? colors.dark : colors.light;

  // If auth state resolves and we have a user, hop to tabs.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/scan"); // replace so back won't return to sign-in
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

  if (loading) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 12, justifyContent: "center", color: c.text }}>
          Sign In
        </Text>

        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={c.mutedText ?? "#8a8a8a"}
          style={{
            borderWidth: 1,
            borderColor: c.divider,
            backgroundColor: c.card ?? (isDarkMode ? "#1c1c1e" : "#fff"),
            color: c.text,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 10,
          }}
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={c.mutedText ?? "#8a8a8a"}
          style={{
            borderWidth: 1,
            borderColor: c.divider,
            backgroundColor: c.card ?? (isDarkMode ? "#1c1c1e" : "#fff"),
            color: c.text,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 16,
          }}
        />

        <Pressable
          disabled={submitting}
          onPress={onSignIn}
          style={({ pressed }) => ({
            opacity: submitting ? 0.7 : pressed ? 0.95 : 1,
            backgroundColor: c.primary,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700" }}>Sign In</Text>
          )}
        </Pressable>

        {/* Sign Up link */}
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <Pressable onPress={() => router.push("/auth/sign-up")}>
            <Text style={{ color: c.primary, textDecorationLine: "underline", fontWeight: "600" }}>
              Don’t have an account? Create one
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
