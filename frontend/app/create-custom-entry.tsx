import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as SQLite from 'expo-sqlite';
import { saveToHistory } from '@/db/history';
import { initCustomDb, getCustomDb } from '@/db/customFoods';

// NOTE: Extend this list, OR refer to an existing database of allergens
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

// Helper functions for barcode normalization and validation

const onlyDigits = (s: string) => (s || '').replace(/\D+/g, '');

function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = first12.charCodeAt(i) - 48;
    if ((i + 1) % 2 === 0) sum += 3 * n; else sum += n;
  }
  const mod = sum % 10;
  return mod === 0 ? '0' : String(10 - mod);
} // END of ean13CheckDigit()

function isValidEAN13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false;
  return ean[12] === ean13CheckDigit(ean.slice(0, 12));
}// END of isValidEAN13()

function upcaCheckDigit(first11: string): string {
  let sumOdd = 0, sumEven = 0;
  for (let i = 0; i < 11; i++) {
    const n = first11.charCodeAt(i) - 48;
    if ((i + 1) % 2 === 1) sumOdd += n; else sumEven += n;
  }
  const total = sumOdd * 3 + sumEven;
  const mod = total % 10;
  return mod === 0 ? '0' : String(10 - mod);
} // END of upcaCheckDigit()

function isValidUPCA(upcA: string): boolean {
  if (!/^\d{12}$/.test(upcA)) return false;
  return upcA[11] === upcaCheckDigit(upcA.slice(0, 11));
} // END of isValidUPCA()


function upceToUpca(upceRaw: string): string | null {
  const s = onlyDigits(upceRaw);
  if (!(s.length === 6 || s.length === 8)) return null;

  let ns = '0';
  let body = '';
  if (s.length === 6) {
    body = s;
  } else {
    ns = s[0];
    if (ns !== '0' && ns !== '1') return null;
    body = s.slice(1, 7); 
  }

  const a = body[0], b = body[1], c = body[2], d = body[3], e = body[4], n = body[5];

  let manufacturer = '';
  let product = '';

  if ('012'.includes(n)) {
    manufacturer = a + b + n + '00';
    product      = '00' + c + d + e;
  } else if (n === '3') {
    manufacturer = a + b + c + '00';
    product      = '000' + d + e;
  } else if (n === '4') {
    manufacturer = a + b + c + d + '0';
    product      = '0000' + e;
  } else {
    // 5..9
    manufacturer = a + b + c + d + e;
    product      = '0000' + n;
  }

  const upcNoCheck = ns + manufacturer + product; // 11 digits total
  const check = upcaCheckDigit(upcNoCheck);
  return upcNoCheck + check; // 12 digits total
}


function upcaToEan13(upcA: string): string | null {
  if (!/^\d{12}$/.test(upcA)) return null;
  const first12 = ('0' + upcA).slice(0, 12); // leading 0 + first 11 data digits of UPC-A
  const eanCheck = ean13CheckDigit(first12);
  return first12 + eanCheck; // 13 digits total
}



// This function calls the above helper functions to normalize any of the three barcode types to EAN-13
function normalizeToEan13(input: string): { ean13: string, variant: 'EAN-13'|'UPC-A'|'UPC-E' } | null {
  
  // cleans the input (the barcode) to only digits to process into a barcode type
  const digits = onlyDigits(input);

  // 13 digits == validate EAN-13 
  if (digits.length === 13 && isValidEAN13(digits)) {
    return { ean13: digits, variant: 'EAN-13' };
  }

  // 12 digits == validate UPC-A and convert
  if (digits.length === 12 && isValidUPCA(digits)) {
    const ean = upcaToEan13(digits);
    if (ean) return { ean13: ean, variant: 'UPC-A' };
  }

  // 8 || 6 digits == treat as UPC-E, expand to UPC-A, THEN to EAN-13
  if (digits.length === 8 || digits.length === 6) {
    const upcA = upceToUpca(digits);
    if (upcA && isValidUPCA(upcA)) {
      const ean = upcaToEan13(upcA);
      if (ean) return { ean13: ean, variant: 'UPC-E' };
    }
  }

  return null; 
} // END of normalizeToEan13()


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


  useEffect(() => {
    if (editingEntry) {
      setFoodName(editingEntry.food_name || '');
      setBarcode(editingEntry.barcode || '');
      setSelectedAllergens(
        editingEntry.allergens?.split(',').map(a => a.trim()) || []
      );
    }
  }, [editingEntry]);

  // SPRINT 3: Updated handleSave to support multiple barcode types
  const handleSave = async () => {
    const cleanedName = foodName.trim();
    const norm = normalizeToEan13(barcode);

    if (!cleanedName || !norm) {
      Alert.alert(
        'Validation Error',
        'Enter a food name and a valid barcode (EAN-13, UPC-A, or UPC-E).'
      );
      return;
    }

    const normalized13 = norm.ean13;
    const allergenString = selectedAllergens.join(', ');
    const timestamp = Date.now();

    try {
      await saveToHistory(cleanedName, allergenString, allergenString);

      const customDb = getCustomDb();
      if (!customDb) {
        console.warn('[CustomDB] Not initialized');
        return;
      }

      if (editingEntry?.id) {
        await customDb.runAsync(
          `UPDATE custom_entries 
          SET food_name = ?, barcode = ?, allergens = ? 
          WHERE id = ?`,
          [cleanedName, normalized13, allergenString, editingEntry.id]
        );
        Alert.alert('Updated', 'Custom entry updated!');
      } else {
        await customDb.runAsync(
          'INSERT INTO custom_entries (food_name, barcode, allergens, created_at) VALUES (?, ?, ?, ?)',
          [cleanedName, normalized13, allergenString, timestamp]
        );
        Alert.alert('Saved', 'Custom entry saved!');
      }

      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save entry.');
    }
  }; // END of handleSave() 

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
        // SPRINT 3: Updated placeholder and keyboard type
        placeholder="Barcode (EAN-13 / UPC-A / UPC-E)"
        value={barcode}
        onChangeText={setBarcode}
        keyboardType="number-pad"
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
