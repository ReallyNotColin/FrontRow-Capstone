// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    // temporary splash (helps you see if you're stuck here)
    return null; // or <YourSplash />
  }

  return user
    ? <Redirect href='/(tabs)/search' />
    : <Redirect href='/auth/sign-in' />;
}
