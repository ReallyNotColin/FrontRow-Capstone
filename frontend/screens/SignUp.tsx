import React, { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { signUpWithEmail } from "@/db/auth";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    try {
      setError(null);
      const cred = await signUpWithEmail(email.trim(), password);
      console.log("User created:", cred.user.uid);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
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
      <Button title="Sign Up" onPress={handleSignUp} />
      {error && <Text style={{ color: "red", marginTop: 10 }}>{error}</Text>}
    </View>
  );
}
