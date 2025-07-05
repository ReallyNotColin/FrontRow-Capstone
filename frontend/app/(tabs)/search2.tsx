import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, ScrollView, StyleSheet } from 'react-native';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

export default function AutocompleteScreen() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const fetchSuggestions = async (text: string) => {
    if (text.length < 2) return;
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/autocomplete?expression=${encodeURIComponent(text)}`);
      const data = await res.json();
      console.log('Frontend Autocomplete data:', data);
      setSuggestions(data?.suggestions?.suggestion || []);
      console.log(suggestions);
    } catch (err) {
      console.error('Autocomplete fetch error:', err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 400), []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    debouncedFetch(text);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Search for food</Text>
      <TextInput
        placeholder="Start typing a food name..."
        value={query}
        onChangeText={handleInputChange}
        style={styles.input}
      />

      <View style={styles.card}>
        <Text style={styles.subheading}>Raw JSON:</Text>
        <ScrollView style={styles.jsonScroll}>
          <Text selectable style={styles.jsonText}>
            {JSON.stringify(suggestions, null, 2)}
          </Text>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
  },
  card: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  subheading: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  jsonScroll: {
    maxHeight: 300,
  },
  jsonText: {
    fontSize: 12,
    color: '#333',
  },
});
