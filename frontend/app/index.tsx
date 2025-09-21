import { Redirect } from "expo-router";
import { useAuth } from "../auth/AuthProvider"; // ← relative to app/
export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  
  if (!user) return <Redirect href="/auth/sign-in" />;
  if (!user.emailVerified) return <Redirect href="/auth/verify-email" />;

  return <Redirect href="/(tabs)/scan" />;
}
