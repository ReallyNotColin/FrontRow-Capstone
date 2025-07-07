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
      //console.log('Full API response:', JSON.stringify(data, null, 2));
      // Get allergen names
      // Filter to only show present allergens
      //<Text selectable style={styles.detailsText}>
      //        {JSON.stringify(selectedFoodDetails, null, 2)}
      //      </Text>
      const allergens = data?.food?.food_attributes?.allergens?.allergen?.filter(a => a.value !== "0")?.map(a => a.name) || [];
      // Testing
      console.log('Allergens:', allergens);

      {allergens?.length > 0 && (
        <>
          <Text style={styles.detailsText}>Allergens:</Text>
          {allergens.map((a, i) => (
            <Text key={i} style={styles.detailsText}>• {a.name}</Text>
          ))}
        </>
      )}
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
            <View> 
              <Text style={styles.detailsText}>Allergens:</Text>
              {selectedFoodDetails?.food?.food_attributes?.allergens?.allergen
                ?.filter(a => a.value !== "0")
                ?.map((a, i) => (
                  <Text key={i} style={styles.detailsText}>• {a.name}</Text>
              )) || <Text style={styles.detailsText}>None</Text>}
            </View>
          
          
          </ScrollView>
          <Pressable onPress={() => setExpandedIndex(null)} style={styles.collapseButton}>
            <Text style={styles.buttonText}>Collapse</Text>
          </Pressable>
        </View>
      )}
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
    flexDirection: 'column',
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
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
