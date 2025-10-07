import React, { useEffect, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemedColor } from '@/components/ThemedColor';
import { onResults, clearResults } from '@/db/history';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/db/firebaseConfig';

type Row = {
  id: string;
  foodName?: string;
  warnings?: string;
  matched?: string;
  // createdAt?: any; // optional, not used in UI
};

const parseWarning = (warning?: string | null) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

export default function ResultsScreen() {
  const router = useRouter();
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  const [harmful, setHarmful] = useState<Row[]>([]);
  const [notHarmful, setNotHarmful] = useState<Row[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      // Subscribe on focus; unsubscribe on blur/unmount
      const unsub = onResults((rows: Row[]) => {
        // If any legacy docs exist, coalesce old keys → new keys
        const normalized = rows.map((r: any) => ({
          id: r.id,
          foodName: r.foodName ?? r.food_name ?? "Unknown",
          warnings: r.warnings ?? r.allergens ?? "",
          matched: r.matched ?? r.match ?? "",
        })) as Row[];

        const harmfulEntries = normalized.filter(
          (item) => item.matched && item.matched.trim() !== ""
        );
        const safeEntries = normalized.filter(
          (item) => !item.matched || item.matched.trim() === ""
        );

        setHarmful(harmfulEntries);
        setNotHarmful(safeEntries);
      });

      return () => unsub();
    }, [])
  );

  const handleClose = async () => {
    await clearResults();
    router.push("/scan");
  };

  const fetchProductDetails = async (foodName: string) => {
    try {
      const productsRef = collection(db, "Products");
      const q = query(
        productsRef,
        where("name_lower", ">=", foodName.toLowerCase()),
        where("name_lower", "<=", foodName.toLowerCase() + "\uf8ff"),
        limit(1)
      );
      
      let snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log("Not found in Products, checking PetProducts...");
        const petProductsRef = collection(db, "PetProducts");
        const qPet = query(
          petProductsRef,
          where("name_lower", ">=", foodName.toLowerCase()),
          where("name_lower", "<=", foodName.toLowerCase() + "\uf8ff"),
          limit(1)
        );
        snapshot = await getDocs(qPet);
      }
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const warningArray = parseWarning(docData.warning);
        
        setSelectedFoodDetails({
          name: docData.food_name,
          brand_name: docData.brand_name,
          barcode: docData.barcode,
          ingredients: docData.ingredients,
          food: {
            food_attributes: {
              allergens: {
                allergen: warningArray
              }
            }
          }
        });
      } else {
        setSelectedFoodDetails({
          name: foodName,
          brand_name: null,
          barcode: null,
          ingredients: null,
          food: {
            food_attributes: {
              allergens: {
                allergen: []
              }
            }
          }
        });
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      setSelectedFoodDetails(null);
    }
  };

  const renderEntry = (item: Row) => (
    <View
      key={item.id}
      style={[
        styles.entry,
        { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider },
      ]}
    >
      <ThemedText style={[styles.foodName, { color: activeColors.text }]}>
        {item.foodName}
      </ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>
        Allergens: {item.warnings?.trim() ? item.warnings : 'None'}
      </ThemedText>
      <ThemedText style={[styles.details, { color: activeColors.secondaryText }]}>
        Matched: {item.matched?.trim() ? item.matched : 'None'}
      </ThemedText>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
          <TouchableOpacity 
            onPress={async () => {
              if (!item.foodName) return;
              await fetchProductDetails(item.foodName);
              setModalVisible(true);
            }} 
            style={styles.actionButton}>
            <ThemedText style={[styles.foodName, { color: activeColors.buttonText }]}>View Details</ThemedText>
          </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ThemedView style={[styles.header, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>Results</ThemedText>
        <TouchableOpacity onPress={handleClose}>
            <Ionicons name = "close-circle" size={28} color={activeColors.text} />
        </TouchableOpacity>
      </ThemedView>
      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]}/>

      <ThemedView style={styles.text}>
        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>Harmful</ThemedText>
        {harmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>No harmful foods found.</ThemedText>
        ) : (
          harmful.map(renderEntry)
        )}

        <ThemedText style={[styles.sectionHeader, { color: activeColors.text }]}>Not Harmful</ThemedText>
        {notHarmful.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>No safe foods logged yet.</ThemedText>
        ) : (
          notHarmful.map(renderEntry)
        )}
      </ThemedView>

      {/* Product Details Modal */}
      <Modal 
        animationType="slide" 
        transparent 
        visible={modalVisible} 
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={{ color: activeColors.text }}>
                Product Details
              </ThemedText>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)} 
                style={{ marginLeft: 8 }}
              >
                <Ionicons name="close-circle" size={24} color={activeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {selectedFoodDetails ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.detailsRow}>
                    {/* Product Title */}
                    <View style={styles.imagePlaceholder}></View>
                    <View style={styles.detailsColumn}>
                      <ThemedText style={{ color: activeColors.text, fontWeight: "700", fontSize: 18, maxWidth: 200}}>
                        { selectedFoodDetails.name}
                      </ThemedText>
                      <ThemedText style={{ color: '#666',fontStyle: "italic", fontWeight: "500", fontSize: 16 }}>
                        <ThemedText style={{ color: '#666',fontStyle: "italic", fontWeight: "500", fontSize: 16 }}>
                          by{" "}
                        </ThemedText>
                      { selectedFoodDetails.brand_name}
                    </ThemedText>
                    </View>
                  </View>

                  {/* Barcode */}
                  {selectedFoodDetails.barcode && (
                    <ThemedText style={{ color: activeColors.text }}>
                      <ThemedText style={{ color: activeColors.secondaryText, fontWeight: "500" }}>
                        Barcode:{" "}
                      </ThemedText>
                      {selectedFoodDetails.barcode}
                    </ThemedText>
                  )}

                  {/* Ingredients */}
                  {selectedFoodDetails.ingredients && (
                    <ThemedText style={{ color: activeColors.text }}>
                      <ThemedText style={{ color: activeColors.secondaryText, fontWeight: "500" }}>
                        Ingredients:{" "}
                      </ThemedText>
                      {selectedFoodDetails.ingredients}
                    </ThemedText>
                  )}

                  {/* Allergens/Warnings */}
                  <ThemedText style={{ color: activeColors.text }}>
                    <ThemedText style={{ color: activeColors.secondaryText, fontWeight: "500" }}>
                      Warnings:{" "}
                    </ThemedText>
                    {selectedFoodDetails.food?.food_attributes?.allergens?.allergen?.filter(
                      (a: any) => a.value !== "0"
                    ).length 
                      ? selectedFoodDetails.food.food_attributes.allergens.allergen
                          .filter((a: any) => a.value !== "0")
                          .map((a: any) => a.name)
                          .join(", ")
                      : "None"}
                  </ThemedText>
                </View>
              ) : (
                <ThemedText style={{ color: activeColors.secondaryText }}>
                  Loading product details...
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 2,
    marginBottom: 16,
    width: '100%',
  },
  text: {
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  entry: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  foodName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
  },
  emptyText: {
    fontStyle: 'italic',
    marginBottom: 10,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    width: '90%', 
    maxHeight: '80%', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 4, 
    elevation: 5 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0' 
  },
  modalScroll: { 
    padding: 20,
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
  },
  detailsColumn: {
    flexDirection: 'column',
    paddingLeft: 15,
    justifyContent: "center"
  }
});