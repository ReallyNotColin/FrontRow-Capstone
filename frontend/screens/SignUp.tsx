// screens/SignUp.tsx
import React, { useState } from "react";
import { View, TextInput, Button, Text, Alert, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform,} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { useThemedColor } from "@/components/ThemedColor";


export default function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode, colors } = useThemedColor();
  const c = isDarkMode ? colors.dark : colors.light;

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
    <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: c.background }}
          behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 12, color: c.text }}>Create Account</Text>
        <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={"#8a8a8a"}
            style={{
              borderWidth: 1,
              borderColor: c.divider,
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
            placeholderTextColor={"#8a8a8a"}
            style={{
              borderWidth: 1,
              borderColor: c.divider,
              color: c.text,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 16,
            }}
          />
          <Pressable
            disabled={submitting}
            onPress={handleSignUp}
            style={({ pressed }) => ({
              opacity: submitting ? 0.7 : pressed ? 0.95 : 1,
              backgroundColor: c.primary,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            })}
          >
            {submitting && <ActivityIndicator color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {submitting ? 'Creating...' : 'Sign Up'}
            </Text>
          </Pressable>
          <Pressable
            onPress={router.back}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              backgroundColor: '#c23b22',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 12, 
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        {error && <Text style={{ color: "red", marginTop: 10 }}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}
