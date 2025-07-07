import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getHistory } from '@/db/history'; // Make sure this is correct

export default function Screen() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getHistory();
        setHistory(data);
      } catch (error) {
        console.error('[History] Failed to load history:', error);
      }
    };

    loadHistory();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">History</ThemedText>
      </ThemedView>
      <ThemedView style={styles.divider} />

      <ThemedView style={styles.text}>
        {history.length === 0 ? (
          <ThemedText>No history found yet.</ThemedText>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.entry}>
              <Text style={styles.foodName}>{item.food_name}</Text>
              <Text style={styles.details}>Allergens: {item.allergens || 'None'}</Text>
              <Text style={styles.details}>Matched: {item.match || 'None'}</Text>
            </View>
          ))
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
  entry: {
    marginBottom: 16,
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
});
