import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, FlatList, StyleSheet } from 'react-native';

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
    if (text.length < 2) return; // don't spam with short queries
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/autocomplete?expression=${encodeURIComponent(text)}`);
      const data = await res.json();
      console.log('Frontend Autocomplete data:', data);
      setSuggestions(data?.foods?.food || []);
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
    <View style={styles.container}>
      <Text style={styles.heading}>Search for food</Text>
      <TextInput
        placeholder="Start typing a food name..."
        value={query}
        onChangeText={handleInputChange}
        style={styles.input}
      />
      <FlatList
        data={suggestions}
        keyExtractor={(item, index) => `${item.food_id || index}`}
        renderItem={({ item }) => (
          <View style={styles.suggestionItem}>
            <Text>{item.food_name}</Text>
          </View>
        )}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
  },
  suggestionItem: {
    padding: 10,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
});
