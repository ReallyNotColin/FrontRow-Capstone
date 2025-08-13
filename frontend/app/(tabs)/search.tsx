import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { saveToHistory } from '@/db/history';
import { searchCustomEntries } from '@/db/customFoods';
import { useThemedColor } from '@/components/ThemedColor';

// Firestore
import { collection, getDocs, query, where } from "firebase/firestore";
import { ensureAnonAuth, db } from "@/db/firebaseConfig"; 

// Debounce
const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};


const parseWarning = (warning) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

export default function AutocompleteScreen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;
  const navigation = useNavigation();
  const [queryText, setQueryText] = useState('');
  const [combinedSuggestions, setCombinedSuggestions] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState(null);
  const [allergenMatches, setAllergenMatches] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchSuggestions = async (text) => {
    if (text.length < 2) return;
    try {
      await ensureAnonAuth(); 

      const searchText = text.toLowerCase();
      const firestoreQuery = query(
        collection(db, "Products"),     
        where("name_lower", ">=", searchText),
        where("name_lower", "<=", searchText + "\uf8ff")
      );

      const firestoreSnapshot = await getDocs(firestoreQuery);
      const firestoreResults = firestoreSnapshot.docs.map(doc => {
        const d = doc.data();
        return {
          name: d.food_name,     
          barcode: d.barcode,
          brand_name: d.brand_name,
          warning: d.warning,    
          source: 'firebase',
        };
      });

      const customResults = await searchCustomEntries(text);
      const customFormatted = customResults.map(entry => ({
        name: entry.food_name,
        barcode: entry.barcode,
        brand_name: entry.brand_name,
        warning: entry.warning,   
        source: 'custom',
      }));

      setCombinedSuggestions([...customFormatted, ...firestoreResults]);
    } catch (err) {
      console.error('Firestore fetch error:', err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 400), []);

  const handleInputChange = (text) => {
    setQueryText(text);
    debouncedFetch(text);
  };

  const handleViewPress = async (foodText, index) => {
    const item = combinedSuggestions[index];

    if (item.source === 'custom') {
      const warningArray = parseWarning(item.warning);

      setSelectedFoodDetails({
        food: { food_attributes: { allergens: { allergen: warningArray } } }
      });
      setExpandedIndex(index);

      // Save to history
      const warningsString = warningArray.map(a => a.name).join(', ');
      const profile = ['Milk', 'Egg', 'Peanuts'];
      const matched = warningArray.filter(a => profile.includes(a.name)).map(a => a.name);
      try {
        await saveToHistory(foodText, warningsString, matched.join(', '));
        console.log('Saved to history');
      } catch (err) {
        console.error('History save error:', err);
      }
      return;
    }
    try {
      await ensureAnonAuth(); 

      const firestoreQuery = query(
        collection(db, "Products"),
        where("name_lower", "==", foodText.toLowerCase())
      );

      const snapshot = await getDocs(firestoreQuery);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const warningArray = parseWarning(docData.warning);

        setSelectedFoodDetails({
          food: { food_attributes: { allergens: { allergen: warningArray } } }
        });
        setExpandedIndex(index);

        // Save to history
        const warningsString = warningArray.map(a => a.name).join(', ');
        const profile = ['Milk', 'Egg', 'Peanuts'];
        const matched = warningArray.filter(a => profile.includes(a.name)).map(a => a.name);
        try {
          await saveToHistory(foodText, warningsString, matched.join(', '));
          console.log('Saved to history');
        } catch (err) {
          console.error('History save error:', err);
        }
      }
    } catch (err) {
      console.error('Firestore food fetch error:', err);
    }
  };

  const renderSuggestion = ({ item, index }) => {
    // Read from the reused shape:
    // selectedFoodDetails.food.food_attributes.allergens.allergen : [{name, value}]
    const warnings = selectedFoodDetails?.food?.food_attributes?.allergens?.allergen?.filter(a => a.value !== "0");
    const profile = ['Milk', 'Egg', 'Peanuts'];

    const handleCompareAllergens = () => {
      const matched = warnings.filter(a => profile.includes(a.name));
      setAllergenMatches(matched.map(a => a.name));
      setModalVisible(true);
    };

    return (
      <View style={[styles.suggestionCard, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
        <Text style={[styles.suggestionText, { color: activeColors.text }]}>
          {item.brand_name 
            ? `${item.brand_name} — ${item.name}` 
            : item.name
          }
          {item.source === 'custom' && ' (Custom)'}
        </Text>
        <Pressable style={styles.viewButton} onPress={() => handleViewPress(item.name, index)}>
          <Text style={styles.buttonText}>View</Text>
        </Pressable>

        {expandedIndex === index && selectedFoodDetails && (
          <View style={[styles.detailsBox, { backgroundColor: activeColors.backgroundTitle, borderColor: 'transparent' }]}>
            <ScrollView style={styles.detailsScroll}>
              {warnings?.length > 0 ? (
                <View style={styles.allergenContainer}>
                  <Text style={[styles.detailsText, { color: activeColors.text}]}>Warnings:</Text>
                  <View style={styles.allergenBlockWrapper}>
                    {warnings.map((a, i) => (
                      <View key={i} style={styles.allergenBlock}>
                        <Text style={styles.allergenText}>{a.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.detailsText}>No warnings found</Text>
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
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle}]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>Search</ThemedText>
      </ThemedView>
      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={[styles.innerContainer, { backgroundColor: activeColors.background }]}>
        <TextInput
          placeholder="Start typing a food name..."
          placeholderTextColor={activeColors.secondaryText}
          value={queryText}
          onChangeText={handleInputChange}
          style={[styles.input, { color: activeColors.text, borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}
        />

        <FlatList
          data={combinedSuggestions}
          renderItem={renderSuggestion}
          keyExtractor={(item, index) => `${item.name}-${item.source}-${index}`}
          style={styles.list}
          scrollEnabled={false}
        />

        <Pressable
          style={[styles.viewButton, { marginTop: 10, alignSelf: 'center' }]}
          onPress={() => navigation.navigate('create-custom-entry')}
        >
          <Text style={styles.buttonText}>Create Custom Entry</Text>
        </Pressable>

        <Pressable
          style={[styles.viewButton, { marginTop: 10, alignSelf: 'center' }]}
          onPress={() => navigation.navigate('custom-entries-list')}
        >
          <Text style={styles.buttonText}>View Custom Entries</Text>
        </Pressable>

        {modalVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalHeading}>⚠️ Allergen Match</Text>
              {allergenMatches.length > 0 ? (
                allergenMatches.map((name, idx) => (
                  <Text key={idx} style={styles.modalText}>• {name}</Text>
                ))
              ) : (
                <Text style={styles.modalText}>No matches found 🎉</Text>
              )}
              <Pressable style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  titleContainer: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, backgroundColor: '#E5E5EA', marginBottom: 16, width: '100%' },
  innerContainer: { paddingHorizontal: 24, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderColor: '#888', padding: 8, borderRadius: 6, backgroundColor: 'transparent' },
  list: { marginTop: 20, backgroundColor: 'transparent' },
  suggestionCard: { flexDirection: 'column', padding: 12, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 10, backgroundColor: 'transparent' },
  suggestionText: { fontSize: 16, marginBottom: 8 },
  viewButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#007BFF', borderRadius: 6 },
  buttonText: { color: 'white' },
  detailsBox: { marginTop: 10, backgroundColor: '#f4f4f4', borderRadius: 6, padding: 10, borderColor: '#ddd', borderWidth: 1, position: 'relative' },
  detailsScroll: { maxHeight: 200 },
  detailsText: { fontSize: 12, color: '#333' },
  collapseButton: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#888', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  allergenContainer: { marginTop: 10 },
  allergenBlockWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  allergenBlock: { backgroundColor: '#FF4D4D', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  allergenText: { color: 'white', fontSize: 12 },
  compareButton: { position: 'absolute', bottom: 10, left: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#FF7F50' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%', elevation: 10, alignItems: 'center' },
  modalHeading: { fontWeight: 'bold', fontSize: 18, marginBottom: 10 },
  modalText: { fontSize: 14, marginVertical: 2, color: '#333' },
  modalCloseButton: { marginTop: 16, backgroundColor: '#444', paddingVertical: 6, paddingHorizontal: 20, borderRadius: 6 },
});
