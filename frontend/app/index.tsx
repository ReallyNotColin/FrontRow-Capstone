// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/search" />; // starts at search for now (change to scan once screen is complete)
}