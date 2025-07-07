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
  const [allergenMatches, setAllergenMatches] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

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
      const allergens = data?.food?.food_attributes?.allergens?.allergen?.filter(a => a.value !== "0")?.map(a => a.name) || [];
      // Testing
      console.log('Allergens:', allergens);

      setSelectedFoodDetails(data);
      setExpandedIndex(index);
    } catch (err) {
      console.error('Search by name error:', err);
    }
  };

  const renderSuggestion = ({ item, index }) => {
    const allergens = selectedFoodDetails?.food?.food_attributes?.allergens?.allergen?.filter(a => a.value !== "0");

    const profile = ['Milk', 'Egg', 'Peanuts'];

    const handleCompareAllergens = () => {
      const matched = allergens.filter(a => profile.includes(a.name));
      setAllergenMatches(matched.map(a => a.name));
      setModalVisible(true);
    };

    return (
      <View style={styles.suggestionCard}>
        <Text style={styles.suggestionText}>{item}</Text>
        <Pressable style={styles.viewButton} onPress={() => handleViewPress(item, index)}>
          <Text style={styles.buttonText}>View</Text>
        </Pressable>

        {expandedIndex === index && selectedFoodDetails && (
          <View style={styles.detailsBox}>
            <ScrollView style={styles.detailsScroll}>
              {allergens?.length > 0 && (
                <View style={styles.allergenContainer}>
                  <Text style={styles.detailsText}>Allergens:</Text>
                  <View style={styles.allergenBlockWrapper}>
                    {allergens.map((a, i) => (
                      <View key={i} style={styles.allergenBlock}>
                        <Text style={styles.allergenText}>{a.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {(!allergens || allergens.length === 0) && (
                <Text style={styles.detailsText}>No allergens found</Text>
              )}
            </ScrollView>
            <Pressable onPress={() => setExpandedIndex(null)} style={styles.collapseButton}>
              <Text style={styles.buttonText}>Collapse</Text>
            </Pressable>

            <Pressable style={styles.compareButton} onPress={handleCompareAllergens}>
                    <Text style={styles.buttonText}>Compare with My Allergens</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

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
    position: 'relative',
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
  allergenContainer: {
    marginTop: 10,
  },
  allergenBlockWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  allergenBlock: {
    backgroundColor: '#FF4D4D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  allergenText: {
    color: 'white',
    fontSize: 12,
  },
  compareButton: {
    position : 'absolute',
    bottom: 10,
    left: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FF7F50',
    borderRadius: 6,
  },
  
  matchText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B00020',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    elevation: 10,
    alignItems: 'center',
  },
  modalHeading: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    marginVertical: 2,
    color: '#333',
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: '#444',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
});

