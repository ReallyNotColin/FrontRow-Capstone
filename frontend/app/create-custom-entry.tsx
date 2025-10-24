import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as SQLite from 'expo-sqlite';
import { saveToHistory } from '@/db/history';
import { initCustomDb, getCustomDb } from '@/db/customFoods';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemedColor } from '@/components/ThemedColor';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

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

// ---------- barcode helpers ----------
// ---------- barcode helpers ----------
const onlyDigits = (s: string) => (s || '').replace(/\D+/g, '');

function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = first12.charCodeAt(i) - 48;
    if ((i + 1) % 2 === 0) sum += 3 * n; else sum += n;
  }
  const mod = sum % 10;
  return mod === 0 ? '0' : String(10 - mod);
}

function isValidEAN13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false;
  return ean[12] === ean13CheckDigit(ean.slice(0, 12));
}

function upcaCheckDigit(first11: string): string {
  let sumOdd = 0, sumEven = 0;
  for (let i = 0; i < 11; i++) {
    const n = first11.charCodeAt(i) - 48;
    if ((i + 1) % 2 === 1) sumOdd += n; else sumEven += n;
  }
  const total = sumOdd * 3 + sumEven;
  const mod = total % 10;
  return mod === 0 ? '0' : String(10 - mod);
}

function isValidUPCA(upcA: string): boolean {
  if (!/^\d{12}$/.test(upcA)) return false;
  return upcA[11] === upcaCheckDigit(upcA.slice(0, 11));
}

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

  const upcNoCheck = ns + manufacturer + product; // 11 digits
  const check = upcaCheckDigit(upcNoCheck);
  return upcNoCheck + check; // 12 digits
}

function upcaToEan13(upcA: string): string | null {
  if (!/^\d{12}$/.test(upcA)) return null;
  const first12 = ('0' + upcA).slice(0, 12);
  const eanCheck = ean13CheckDigit(first12);
  return first12 + eanCheck;
}

// Normalize any supported code to EAN-13
function normalizeToEan13(input: string): { ean13: string, variant: 'EAN-13'|'UPC-A'|'UPC-E' } | null {
  const digits = onlyDigits(input);

  if (digits.length === 13 && isValidEAN13(digits)) {
    return { ean13: digits, variant: 'EAN-13' };
  }

  if (digits.length === 12 && isValidUPCA(digits)) {
    const ean = upcaToEan13(digits);
    if (ean) return { ean13: ean, variant: 'UPC-A' };
  }

  if (digits.length === 8 || digits.length === 6) {
    const upcA = upceToUpca(digits);
    if (upcA && isValidUPCA(upcA)) {
      const ean = upcaToEan13(upcA);
      if (ean) return { ean13: ean, variant: 'UPC-E' };
    }
  }

  return null;
}

export default function CreateCustomEntryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editingEntry: any = ((route as any) as any).params?.entry;

  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  const [foodName, setFoodName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

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
        editingEntry.allergens?.split(',').map((a: string) => a.trim()) || []
      );
    }
  }, [editingEntry]);

  const goBackToSearch = () => {
    // Prefer a real back if we navigated here from Search; otherwise go straight to Search.
    // Adjust the route name if your Search route differs.
    // @ts-ignore
    if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('search' as never);
    // For Expo Router nested tabs, you might instead do:
    // navigation.navigate('(tabs)' as never, { screen: 'search' } as never);
  };

  // Save handler
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
  };

  return (
  <LinearGradient
    colors={activeColors.gradientBackground}
    style={styles.gradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    locations={[0, 0.4, 0.6, 1]}
  >
    <ThemedView style={[styles.container]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
            <Ionicons name="arrow-back" size={28} color={activeColors.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={{ color: activeColors.text }}>
            {editingEntry ? 'Edit' : 'Create'} Custom Entry
          </ThemedText>
        </View>
      </ThemedView>

      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

      <ThemedView style={styles.innerContainer}>
        <TextInput
          placeholder="Food name"
          placeholderTextColor={activeColors.secondaryText}
          value={foodName}
          onChangeText={setFoodName}
          style={[
            styles.input,
            {
              color: activeColors.text,
              borderColor: activeColors.divider,
              backgroundColor: activeColors.backgroundTitle,
              fontSize: 19,
              padding: 12,
            },
          ]}
        />

        <TextInput
          placeholder="Barcode (EAN-13 / UPC-A / UPC-E)"
          placeholderTextColor={activeColors.secondaryText}
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="number-pad"
          style={[
            styles.input,
            {
              color: activeColors.text,
              borderColor: activeColors.divider,
              backgroundColor: activeColors.backgroundTitle,
              fontSize: 19,
              padding: 12,
            },
          ]}
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
          type="default"
          styles={{
            chipContainer: { backgroundColor: '#ff8080' },
            chipText: { color: activeColors.text },
            selectToggleText: { color: activeColors.text },
            itemText: { color: activeColors.text },
            subItemText: { color: activeColors.text },
            confirmText: { color: activeColors.text },
            searchTextInput: { color: activeColors.text },
            selectedItemText: { color: activeColors.text },
          }}
        />

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          <Pressable style={[styles.saveButton, {width: '100%', alignSelf:'stretch'}]} onPress={handleSave}>
            <ThemedText style={styles.buttonText}>
              {editingEntry ? 'Update Entry' : 'Save Entry'}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </ThemedView>
  </LinearGradient>
);

}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    paddingTop: 70,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    width: '100%',
  },
  innerContainer: {
    padding: 24,
    backgroundColor: 'transparent',
  // NEW: back button
  },
  backButton: {
    marginTop: 20,
    padding: 6,
    backgroundColor: '#007BFF',
    borderRadius: 6,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    paddingTop: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#27778E',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});