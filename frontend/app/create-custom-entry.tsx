import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as SQLite from 'expo-sqlite';
import { saveToHistory } from '@/db/history';
import { initCustomDb, getCustomDb } from '@/db/customFoods';

// NOTE: Extend this list, OR look up an API to an existing database of allergens
const allergenOptions = [
  { id: 'Milk', name: 'Milk' },
  { id: 'Egg', name: 'Egg' },
  { id: 'Peanuts', name: 'Peanuts' },
  { id: 'Tree Nuts', name: 'Tree Nuts' },
  { id: 'Wheat', name: 'Wheat' },
  { id: 'Soy', name: 'Soy' },
  { id: 'Fish', name: 'Fish' },
  { id: 'Shellfish', name: 'Shellfish' },
  { id: 'Sesame', name: 'Sesame' },
  { id: 'Lactose', name: 'Lactose' },
  { id: 'Gluten', name: 'Gluten' },
  { id: 'Sulfites', name: 'Sulfites' },
  { id: 'MSG', name: 'MSG' },
];



export default function CreateCustomEntryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editingEntry = route.params?.entry;

  const [foodName, setFoodName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState([]);

  useEffect(() => {
    const init = async () => {
      await initCustomDb();
    };
    init();
  }, []);


  // Populate fields when editing
  useEffect(() => {
    if (editingEntry) {
      setFoodName(editingEntry.food_name || '');
      setBarcode(editingEntry.barcode || '');
      setSelectedAllergens(
        editingEntry.allergens?.split(',').map(a => a.trim()) || []
      );
    }
  }, [editingEntry]);

  const handleSave = async () => {
    if (!foodName.trim() || barcode.length !== 13) {
      Alert.alert('Validation Error', 'Please enter a food name and a valid 13-digit barcode.');
      return;
    }

    const allergenString = selectedAllergens.join(', ');
    const timestamp = Date.now();

    try {
      await saveToHistory(foodName, allergenString, allergenString);

      const customDb = getCustomDb();
      if (!customDb) {
        console.warn('[CustomDB] Not initialized');
        return;
      }


      if (editingEntry?.id) {
        // Update existing
        await customDb.runAsync(
          `UPDATE custom_entries 
           SET food_name = ?, barcode = ?, allergens = ? 
           WHERE id = ?`,
          [foodName, barcode, allergenString, editingEntry.id]
        );
        console.log('[CustomDB] Entry updated');
        Alert.alert('Updated', 'Custom entry updated!');
      } else {
        // Insert new
        await customDb.runAsync(
          'INSERT INTO custom_entries (food_name, barcode, allergens, created_at) VALUES (?, ?, ?, ?)',
          [foodName, barcode, allergenString, timestamp]
        );
        console.log('[CustomDB] New entry saved');
        Alert.alert('Saved', 'Custom entry saved!');
      }

      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save entry.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{editingEntry ? 'Edit' : 'Create'} Custom Entry</Text>

      <TextInput
        placeholder="Food name"
        value={foodName}
        onChangeText={setFoodName}
        style={styles.input}
      />

      <TextInput
        placeholder="13-digit barcode"
        value={barcode}
        onChangeText={setBarcode}
        keyboardType="number-pad"
        maxLength={13}
        style={styles.input}
      />

      <SectionedMultiSelect
        items={allergenOptions}
        uniqueKey="id"
        selectText="Select Harmful Ingredients"
        onSelectedItemsChange={setSelectedAllergens}
        selectedItems={selectedAllergens}
        confirmText="Confirm"
        showDropDowns={false}
        IconRenderer={Icon}
        styles={{ chipContainer: { backgroundColor: '#ff8080' } }}
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.buttonText}>{editingEntry ? 'Update Entry' : 'Save Entry'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
