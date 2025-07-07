import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getHistory } from '@/db/history';

export default function Screen() {
  const [harmful, setHarmful] = useState([]);
  const [notHarmful, setNotHarmful] = useState([]);

  useEffect(() => {
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
  }, []);

  const renderEntry = (item) => (
    <View key={item.id} style={styles.entry}>
      <Text style={styles.foodName}>{item.food_name}</Text>
      <Text style={styles.details}>Allergens: {item.allergens || 'None'}</Text>
      <Text style={styles.details}>Matched: {item.match || 'None'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">History</ThemedText>
      </ThemedView>
      <ThemedView style={styles.divider} />

      <ThemedView style={styles.text}>
        <Text style={styles.sectionHeader}>Harmful</Text>
        {harmful.length === 0 ? (
          <Text style={styles.emptyText}>No harmful foods found.</Text>
        ) : (
          harmful.map(renderEntry)
        )}

        <Text style={styles.sectionHeader}>Not Harmful</Text>
        {notHarmful.length === 0 ? (
          <Text style={styles.emptyText}>No safe foods logged yet.</Text>
        ) : (
          notHarmful.map(renderEntry)
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    backgroundColor: '#E5E5EA',
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
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  foodName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#333',
  },

  detailsHarm: {
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 10,
  },
});
