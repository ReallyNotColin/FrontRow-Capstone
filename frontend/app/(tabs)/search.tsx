import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

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
  const [expandedIndex, setExpandedIndex] = useState(null);
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

  const handleViewPress = async (foodText, index) => {
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/search-food-entry?name=${encodeURIComponent(foodText)}`);
      const data = await res.json();
      setSelectedFoodDetails(data);
      setExpandedIndex(index);
    } catch (err) {
      console.error('Search by name error:', err);
    }
  };

  const renderSuggestion = ({ item, index }) => (
    <View style={styles.suggestionCard}>
      <Text style={styles.suggestionText}>{item}</Text>
      <Pressable style={styles.viewButton} onPress={() => handleViewPress(item, index)}>
        <Text style={styles.buttonText}>View</Text>
      </Pressable>

      {expandedIndex === index && selectedFoodDetails && (
        <View style={styles.detailsBox}>
          <ScrollView style={styles.detailsScroll}>
            <Text selectable style={styles.detailsText}>
              {JSON.stringify(selectedFoodDetails, null, 2)}
            </Text>
          </ScrollView>
          <Pressable onPress={() => setExpandedIndex(null)} style={styles.collapseButton}>
            <Text style={styles.buttonText}>Collapse</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Search</ThemedText>
      </ThemedView>
      <ThemedView style={styles.divider} />

      <ThemedView style={styles.innerContainer}>
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
          scrollEnabled={false} 
        />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  innerContainer: {
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  list: {
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  suggestionCard: {
    flexDirection: 'column',
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  suggestionText: {
    fontSize: 16,
    marginBottom: 8,
  },
  viewButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007BFF',
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
  },
  detailsBox: {
    marginTop: 10,
    backgroundColor: '#f4f4f4',
    borderRadius: 6,
    padding: 10,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  detailsScroll: {
    maxHeight: 200,
  },
  detailsText: {
    fontSize: 12,
    color: '#333',
  },
  collapseButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#888',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
});

