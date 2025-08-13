import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getHistory } from '@/db/history';
import { useFocusEffect } from '@react-navigation/native';
import { useThemedColor } from '@/components/ThemedColor';

export default function Screen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  const [harmful, setHarmful] = useState([]);
  const [notHarmful, setNotHarmful] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          const data = await getHistory();
          const harmfulEntries = data.filter(item => item.match && item.match.trim() !== '');
          const safeEntries = data.filter(item => !item.match || item.match.trim() === '');
          setHarmful(harmfulEntries);
          setNotHarmful(safeEntries);
        } catch (error) {
          console.error('[History] Failed to load history:', error);
        }
      };

      loadHistory();
    }, [])
  );

  const renderEntry = (item) => (
    <View key={item.id} style={[styles.entry, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
      <ThemedText style={[styles.foodName, { color: activeColors.text }]}>{item.food_name}</ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>Allergens: {item.allergens || 'None'}</ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>Matched: {item.match || 'None'}</ThemedText>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>History</ThemedText>
      </ThemedView>
      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={styles.text}>
        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>Harmful</ThemedText>
        {harmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>No harmful foods found.</ThemedText>
        ) : (
          harmful.map(renderEntry)
        )}

        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>Not Harmful</ThemedText>
        {notHarmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>No safe foods logged yet.</ThemedText>
        ) : (
          notHarmful.map(renderEntry)
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  },
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    marginBottom: 16,
    width: '100%',
  },
  text: {
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  entry: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    // backgroundColor and borderColor set dynamically
  },
  foodName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
  },
  emptyText: {
    fontStyle: 'italic',
    marginBottom: 10,
  },
});
