import { Redirect } from "expo-router";
import { useAuth } from "../auth/AuthProvider"; // ← relative to app/
export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Redirect href="/(tabs)/search" /> : <Redirect href="./auth/sign-in" />;
}