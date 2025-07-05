import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, Button, FlatList, StyleSheet } from 'react-native';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

export default function AutocompleteScreen() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const fetchSuggestions = async (text: string) => {
    if (text.length < 2) return;
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/autocomplete?expression=${encodeURIComponent(text)}`);
      const data = await res.json();
      console.log('Frontend Autocomplete data:', data);
      setSuggestions(data?.suggestions?.suggestion || []);
    } catch (err) {
      console.error('Autocomplete fetch error:', err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 400), []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    debouncedFetch(text);
  };

  const handleView = (item: string) => {
    console.log(`View clicked for: ${item}`);
    // You can hook this up to a new endpoint here in the future
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Search for food</Text>
      <TextInput
        placeholder="Start typing a food name..."
        value={query}
        onChangeText={handleInputChange}
        style={styles.input}
      />

      <FlatList
        data={suggestions}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionText}>{item}</Text>
            <Button title="View" onPress={() => handleView(item)} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  suggestionBox: {
    padding: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
  },
  suggestionText: {
    fontSize: 16,
    marginBottom: 8,
  },
});
