// app/(tabs)/search.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, FlatList, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { saveToHistory } from '@/db/history';
import { searchCustomEntries } from '@/db/customFoods';
import { useThemedColor } from '@/components/ThemedColor';

// Firestore
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/db/firebaseConfig';

// Compare helpers
import { compareProductToProfile, buildProductFromFirestoreDoc, type ProductDoc } from '@/db/compare';

type ProfileChoice = {
  id: string;
  name: string;
  data: { allergens: string[]; intolerances: string[]; dietary: string[] };
};

const debounce = (func: any, delay: number) => {
  let timeout: any;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

const parseWarning = (warning?: string) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

// ---- Profile Picker modal ----
function ProfilePickerModal({
  visible,
  profiles,
  onCancel,
  onPick,
}: {
  visible: boolean;
  profiles: ProfileChoice[];
  onCancel: () => void;
  onPick: (p: ProfileChoice) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.ppOverlay}>
        <View style={styles.ppBox}>
          <Text style={styles.ppTitle}>Choose a profile</Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {profiles.map(p => (
              <Pressable key={p.id} style={styles.ppItem} onPress={() => onPick(p)}>
                <Text style={styles.ppItemText}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.ppCancel} onPress={onCancel}>
            <Text style={styles.ppCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function AutocompleteScreen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;
  const navigation = useNavigation();
  const [queryText, setQueryText] = useState('');
  const [combinedSuggestions, setCombinedSuggestions] = useState<any[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState<any>(null);

  // Compare output modal
  const [compareLines, setCompareLines] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // ---- NEW: live profiles + picker ----
  const [profiles, setProfiles] = useState<ProfileChoice[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    displayName: string;
    product: ProductDoc;
    warningsString: string;
  } | null>(null);

  // Subscribe to profiles
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'profiles');
    const unsub = onSnapshot(ref, (snap) => {
      const arr: ProfileChoice[] = [];
      let idx = 1;
      snap.forEach(docSnap => {
        const d = docSnap.data() as any;
        arr.push({
          id: docSnap.id,
          name: d.name || d.profileName || `Profile ${idx++}`,
          data: {
            allergens: Array.isArray(d.allergens) ? d.allergens : [],
            intolerances: Array.isArray(d.intolerances) ? d.intolerances : [],
            dietary: Array.isArray(d.dietary) ? d.dietary : [],
          },
        });
      });
      setProfiles(arr);
    });
    return unsub;
  }, []);

  const fetchSuggestions = async (text: string) => {
    if (text.length < 2) { setCombinedSuggestions([]); return; }
    try {
      const searchText = text.toLowerCase();

      // Firestore "Products" prefix search
      const firestoreQuery = query(
        collection(db, 'Products'),
        where('name_lower', '>=', searchText),
        where('name_lower', '<=', searchText + '\uf8ff')
      );
      const firestoreSnapshot = await getDocs(firestoreQuery);
      const firestoreResults = firestoreSnapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          name: d.food_name,
          barcode: d.barcode,
          brand_name: d.brand_name,
          warning: d.warning,
          source: 'firebase' as const,
        };
      });

      // Custom entries
      const customResults = await searchCustomEntries(text);
      const customFormatted = customResults.map((entry: any) => ({
        name: entry.food_name,
        barcode: entry.barcode ?? '',
        brand_name: entry.brand_name ?? '',
        warning: entry.allergens ?? '',
        source: 'custom' as const,
      }));

      setCombinedSuggestions([...customFormatted, ...firestoreResults]);
    } catch (err) {
      console.error('Firestore fetch error:', err);
    }
  };

  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 400), []);

  const handleInputChange = (text: string) => {
    setQueryText(text);
    debouncedFetch(text);
  };

  // Ensure a profile is chosen (auto-use single; pick if many)
  const ensureProfileAndCompare = async (displayName: string, product: ProductDoc, warningsString: string) => {
    if (profiles.length <= 1) {
      const chosen = profiles[0] ?? null;
      await runCompareAndHistory(displayName, product, warningsString, chosen?.data ?? null, chosen?.name ?? null);
    } else {
      setPendingProduct({ displayName, product, warningsString });
      setPickerVisible(true);
    }
  };

  // Compare + save history with profile name included
  const runCompareAndHistory = async (
    displayName: string,
    product: ProductDoc,
    warningsString: string,
    profileData: { allergens: string[]; intolerances: string[]; dietary: string[] } | null,
    profileName: string | null
  ) => {
    let matchedSummary = '';
    if (profileData) {
      const cmp = compareProductToProfile(product, profileData);
      const lines = [...cmp.summary.allergens, ...cmp.summary.intolerances, ...cmp.summary.dietary];
      setCompareLines(lines);
      matchedSummary = lines.join('; ');
    } else {
      setCompareLines([]);
    }
    const matchedWithProfile = profileName ? `${matchedSummary}${matchedSummary ? ' ' : ''}[Profile: ${profileName}]` : matchedSummary;
    try {
      await saveToHistory(displayName, warningsString, matchedWithProfile);
    } catch (err) {
      console.error('History save error:', err);
    }
    setModalVisible(true);
  };

  const handleViewPress = async (foodText: string, index: number) => {
    const item = combinedSuggestions[index];

    if (item.source === 'custom') {
      const warningArray = parseWarning(item.warning);
      setSelectedFoodDetails({
        food: { food_attributes: { allergens: { allergen: warningArray } } }
      });
      setExpandedIndex(index);

      const product: ProductDoc = {
        food_name: foodText,
        ingredients: '',
        warning: item.warning || '',
      };
      const warningsString = warningArray.map(a => a.name).join(', ');
      await ensureProfileAndCompare(foodText, product, warningsString);
      return;
    }

    // Firestore entry
    try {
      const firestoreQuery = query(
        collection(db, 'Products'),
        where('name_lower', '==', foodText.toLowerCase())
      );
      const snapshot = await getDocs(firestoreQuery);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as any;
        const warningArray = parseWarning(docData.warning);

        setSelectedFoodDetails({
          food: { food_attributes: { allergens: { allergen: warningArray } } }
        });
        setExpandedIndex(index);

        const product = buildProductFromFirestoreDoc(docData);
        const warningsString = warningArray.map(a => a.name).join(', ');
        await ensureProfileAndCompare(foodText, product, warningsString);
      }
    } catch (err) {
      console.error('Firestore food fetch error:', err);
    }
  };

  const renderSuggestion = ({ item, index }: any) => {
    const warnings = selectedFoodDetails?.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== '0');

    return (
      <View style={[styles.suggestionCard, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
        <Text style={[styles.suggestionText, { color: activeColors.text }]}>
          {item.brand_name ? `${item.brand_name} — ${item.name}` : item.name}
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
                  <Text style={[styles.detailsText, { color: activeColors.text }]}>Warnings:</Text>
                  <View style={styles.allergenBlockWrapper}>
                    {warnings.map((a: any, i: number) => (
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

            <Pressable style={[styles.viewButton, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => setModalVisible(true)}>
              <Text style={styles.buttonText}>Compare with My Profile</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
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

        {/* Compare results */}
        {modalVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalHeading}>Profile Comparison</Text>
              {compareLines.length > 0 ? (
                compareLines.map((line, idx) => (
                  <Text key={idx} style={styles.modalText}>• {line}</Text>
                ))
              ) : (
                <Text style={styles.modalText}>No issues found 🎉</Text>
              )}
              <Pressable style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Profile Picker */}
        <ProfilePickerModal
          visible={pickerVisible}
          profiles={profiles}
          onCancel={() => { setPickerVisible(false); setPendingProduct(null); }}
          onPick={async (p) => {
            setPickerVisible(false);
            if (pendingProduct) {
              const { displayName, product, warningsString } = pendingProduct;
              setPendingProduct(null);
              await runCompareAndHistory(displayName, product, warningsString, p.data, p.name);
            }
          }}
        />
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
  detailsText: { color: '#333' },
  collapseButton: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#888', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  allergenContainer: { marginTop: 10 },
  allergenBlockWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  allergenBlock: { backgroundColor: '#FF4D4D', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  allergenText: { color: 'white', fontSize: 12 },

  // compare modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%', elevation: 10, alignItems: 'center' },
  modalHeading: { fontWeight: 'bold', fontSize: 18, marginBottom: 10 },
  modalText: { fontSize: 14, marginVertical: 2, color: '#333' },
  modalCloseButton: { marginTop: 16, backgroundColor: '#444', paddingVertical: 6, paddingHorizontal: 20, borderRadius: 6 },

  // profile picker modal
  ppOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  ppBox: { width: '85%', backgroundColor: '#fff', padding: 18, borderRadius: 12 },
  ppTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  ppItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  ppItemText: { fontSize: 16 },
  ppCancel: { marginTop: 12, alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#eee', borderRadius: 8 },
  ppCancelText: { color: '#333', fontWeight: '600' },
});
