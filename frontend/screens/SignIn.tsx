// src/screens/SignIn.tsx
import React, { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 12 }}>Sign In</Text>
      <TextInput placeholder="Email" autoCapitalize="none" onChangeText={setEmail} value={email} style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} />
      <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} value={password} style={{ borderWidth: 1, marginBottom: 12, padding: 8 }} />
      <Button title="Sign In" onPress={() => signIn(email.trim(), password)} />
    </View>
  );
}
