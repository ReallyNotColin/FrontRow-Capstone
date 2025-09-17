// app/(tabs)/history.tsx
import React, { useState, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemedColor } from "@/components/ThemedColor";

import { useFocusEffect } from "@react-navigation/native";
import { onHistory } from "@/db/history"; // ⬅️ live subscription API

type Row = {
  id: string;
  foodName?: string;
  warnings?: string;
  matched?: string;
  // createdAt?: any; // optional, not used in UI
};

export default function Screen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  const [harmful, setHarmful] = useState<Row[]>([]);
  const [notHarmful, setNotHarmful] = useState<Row[]>([]);

  useFocusEffect(
    useCallback(() => {
      // Subscribe on focus; unsubscribe on blur/unmount
      const unsub = onHistory((rows: Row[]) => {
        // If any legacy docs exist, coalesce old keys → new keys
        const normalized = rows.map((r: any) => ({
          id: r.id,
          foodName: r.foodName ?? r.food_name ?? "Unknown",
          warnings: r.warnings ?? r.allergens ?? "",
          matched: r.matched ?? r.match ?? "",
        })) as Row[];

        const harmfulEntries = normalized.filter(
          (item) => item.matched && item.matched.trim() !== ""
        );
        const safeEntries = normalized.filter(
          (item) => !item.matched || item.matched.trim() === ""
        );

        setHarmful(harmfulEntries);
        setNotHarmful(safeEntries);
      });

      return () => unsub();
    }, [])
  );

  const renderEntry = (item: Row) => (
    <View
      key={item.id}
      style={[
        styles.entry,
        {
          backgroundColor: activeColors.backgroundTitle,
          borderColor: activeColors.divider,
        },
      ]}
    >
      <ThemedText style={[styles.foodName, { color: activeColors.text }]}>
        {item.foodName}
      </ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>
        Allergens: {item.warnings?.trim() ? item.warnings : "None"}
      </ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>
        Matched: {item.matched?.trim() ? item.matched : "None"}
      </ThemedText>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ThemedView
        style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}
      >
        <ThemedText type="title" style={{ color: activeColors.text }}>
          History
        </ThemedText>
      </ThemedView>
      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={styles.text}>
        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>
          Harmful
        </ThemedText>
        {harmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>
            No harmful foods found.
          </ThemedText>
        ) : (
          harmful.map(renderEntry)
        )}

        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>
          Not Harmful
        </ThemedText>
        {notHarmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>
            No safe foods logged yet.
          </ThemedText>
        ) : (
          notHarmful.map(renderEntry)
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {},
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    marginBottom: 16,
    width: "100%",
  },
  text: {
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  entry: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  foodName: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
  },
  emptyText: {
    fontStyle: "italic",
    marginBottom: 10,
  },
});
