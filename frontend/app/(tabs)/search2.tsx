import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, FlatList } from 'react-native';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

export default function AutocompleteScreen() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState(null);

  const fetchSuggestions = async (text) => {
    if (text.length < 2) return;
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/autocomplete?expression=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSuggestions(data?.suggestions?.suggestion || []);
    } catch (err) {
      console.error('Autocomplete fetch error:', err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 400), []);

  const handleInputChange = (text) => {
    setQuery(text);
    debouncedFetch(text);
  };

  const handleViewPress = async (foodText) => {
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/search-by-name?expression=${encodeURIComponent(foodText)}`);
      const data = await res.json();
      setSelectedFoodDetails(data);
    } catch (err) {
      console.error('Search by name error:', err);
    }
  };

  const renderSuggestion = ({ item }) => (
    <View style={styles.suggestionCard}>
      <Text style={styles.suggestionText}>{item}</Text>
      <Pressable style={styles.viewButton} onPress={() => handleViewPress(item)}>
        <Text style={styles.buttonText}>View</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Search for Food</Text>
      <TextInput
        placeholder="Start typing a food name..."
        value={query}
        onChangeText={handleInputChange}
        style={styles.input}
      />

      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={(item, index) => `${item}-${index}`}
        style={styles.list}
      />

      {selectedFoodDetails && (
        <View style={styles.jsonBox}>
          <Text selectable style={styles.jsonText}>
            {JSON.stringify(selectedFoodDetails, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
  },
  list: {
    marginTop: 20,
  },
  suggestionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  suggestionText: {
    fontSize: 16,
    flex: 1,
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007BFF',
    borderRadius: 6,
    marginLeft: 10,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
  },
  jsonBox: {
    marginTop: 20,
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 8,
  },
  jsonText: {
    fontSize: 12,
    color: '#333',
  },
});
