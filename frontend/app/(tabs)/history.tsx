// app/(tabs)/history.tsx
import React, { useState, useCallback } from "react";

import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemedColor } from "@/components/ThemedColor";
import { ThemedModal, ModalTitle, ModalProductName, ModalSectionText, ModalBrandName } from "@/components/ThemedModal";

import { useFocusEffect } from "@react-navigation/native";
import { onHistory, deleteHistory } from "@/db/history"; // ⬅️ live subscription API
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/db/firebaseConfig";

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

export default function Screen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;


  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState<any>(null);
  const [harmful, setHarmful] = useState<Row[]>([]);
  const [notHarmful, setNotHarmful] = useState<Row[]>([]);

  useFocusEffect(
    useCallback(() => {
      // Subscribe on focus; unsubscribe on blur/unmount
      const unsub = onHistory((rows: Row[]) => {
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
        {
          backgroundColor: activeColors.backgroundTitle,
          borderColor: activeColors.divider,
        },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <ThemedText type="default" style={[styles.foodName, { color: activeColors.text, flex: 1, flexWrap: "wrap" }]}>
          {item.foodName}
        </ThemedText>
        <TouchableOpacity onPress={() => item.id && deleteHistory(item.id)} style={{ marginLeft: 8 }}>
          <Ionicons name="close-circle" size={25} color={activeColors.text} />
        </TouchableOpacity>
      </View>

      <ThemedText type="default" style={[styles.details, { color: activeColors.secondaryText }]}>
        Warning: {item.warnings?.trim() ? item.warnings : "None"}
      </ThemedText>
      <ThemedText type="default" style={[styles.details, { color: activeColors.secondaryText }]}>
        Matched: {item.matched?.trim() ? item.matched : "None"}
      </ThemedText>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={async () => {
            if (!item.foodName) return;
            await fetchProductDetails(item.foodName);
            setModalVisible(true);
          }}
        >
          <ThemedText style={[styles.foodName, { color: activeColors.buttonText }]}>
            View Details
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors = {activeColors.gradientBackground} style = {styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
      <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <ThemedText type="title" style={{ color: activeColors.text }}>
          History
        </ThemedText>
      </ThemedView>
      <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <ThemedView style={styles.text}>
          <ThemedText type="subtitle" style={[styles.sectionHeader, { color: activeColors.text }]}>
            Harmful
          </ThemedText>
          {harmful.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>
              No harmful foods found.
            </ThemedText>
          ) : (
            harmful.map(renderEntry)
          )}

          <ThemedText type="subtitle" style={[styles.sectionHeader, { color: activeColors.text }]}>
            Not Harmful
          </ThemedText>
          {notHarmful.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText }]}>
              No safe foods logged yet.
            </ThemedText>
          ) : (
            notHarmful.map(renderEntry)
          )}
        </ThemedView>
        
        {/* Product Details Modal */}
        <ThemedModal 
          visible={modalVisible} 
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalHeader}>
            <ModalTitle>Product Details</ModalTitle>
            <TouchableOpacity 
              onPress={() => setModalVisible(false)} 
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="close-circle" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            {selectedFoodDetails ? (
              <View style={{ gap: 12 }}>
                  {/* Product Title */}
                    <ModalProductName style={{ fontWeight: "700", maxWidth: 300, color: "#333" }}>
                      {selectedFoodDetails.name}
                    </ModalProductName>
                    <ModalBrandName style={{ fontStyle: "italic", fontWeight: "500"}}>
                      by {selectedFoodDetails.brand_name}
                    </ModalBrandName>

                {/* Barcode */}
                {selectedFoodDetails.barcode && (
                  <ModalSectionText>
                    <ModalSectionText style={{ fontWeight: "500" }}>
                      Barcode:{" "}
                    </ModalSectionText>
                    {selectedFoodDetails.barcode}
                  </ModalSectionText>
                )}

                {/* Ingredients */}
                {selectedFoodDetails.ingredients && (
                  <ModalSectionText>
                    <ModalSectionText style={{ fontWeight: "500" }}>
                      Ingredients:{" "}
                    </ModalSectionText>
                    {selectedFoodDetails.ingredients}
                  </ModalSectionText>
                )}

                {/* Allergens/Warnings */}
                <ModalSectionText>
                  <ModalSectionText style={{ fontWeight: "500" }}>
                    Warnings:{" "}
                  </ModalSectionText>
                  {selectedFoodDetails.food?.food_attributes?.allergens?.allergen?.filter(
                    (a: any) => a.value !== "0"
                  ).length 
                    ? selectedFoodDetails.food.food_attributes.allergens.allergen
                        .filter((a: any) => a.value !== "0")
                        .map((a: any) => a.name)
                        .join(", ")
                    : "None"}
                </ModalSectionText>
              </View>
            ) : (
              <ModalSectionText>
                Loading product details...
              </ModalSectionText>
            )}
          </ScrollView>
        </ThemedModal>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {},
  gradient: {
    flex: 1,
  },
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    width: "100%",
  },
  text: {
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  sectionHeader: {
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 12,
  },
  entry: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  foodName: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  details: {
    marginTop: 2
  },
  emptyText: {
    fontStyle: "italic",
    marginBottom: 10,
  },
  actionButton: {
    backgroundColor: '#27778E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
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