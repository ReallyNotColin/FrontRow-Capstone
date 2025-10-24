// app/create-ticket.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/db/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ThemedText } from '@/components/ThemedText';

type TicketPayload = {
  // Product fields (strings to mirror Products)
  added_sugars: string;
  barcode: string;
  brand_lower: string;
  brand_name: string;
  calcium: string;
  calories: string;
  carbohydrate: string;
  cholesterol: string;
  fat: string;
  fiber: string;
  food_name: string;
  ingredients: string;
  iron: string;
  monounsaturated_fat: string;
  name_lower: string;
  polyunsaturated_fat: string;
  potassium: string;
  protein: string;
  saturated_fat: string;
  serving: string;          // e.g. "141 g"
  serving_amount: string;   // e.g. "3"
  sodium: string;
  sugar: string;
  trans_fat: string;
  vitamin_d: string;
  warning: string;          // "Wheat, Egg, Soy, Milk"

  // Ticket meta
  status: "open" | "approved" | "rejected";
  createdBy: string | null;
  createdAt: any;
  updatedAt: any;
  reviewerNotes?: string;
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemedText style={styles.label}>{children}</ThemedText>
);

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default" as "default" | "numeric",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) => (
  <View style={{ marginBottom: 14 }}>
    <Label>{label}</Label>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      style={[styles.input, multiline && styles.inputMultiline]}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize="none"
    />
  </View>
);

export default function CreateTicketScreen() {
  // Core fields
  const [food_name, setFoodName] = useState("");
  const [brand_name, setBrandName] = useState("");
  const [barcode, setBarcode] = useState("");

  // Ingredients + warnings
  const [ingredients, setIngredients] = useState("");
  const [warning, setWarning] = useState(""); // "Wheat, Egg, Soy, Milk"

  // Serving
  const [serving, setServing] = useState(""); // "141 g"
  const [serving_amount, setServingAmount] = useState("");

  // Nutrition (strings, numeric keypad where helpful)
  const [calories, setCalories] = useState("");
  const [fat, setFat] = useState("");
  const [saturated_fat, setSaturatedFat] = useState("");
  const [trans_fat, setTransFat] = useState("");
  const [monounsaturated_fat, setMonoFat] = useState("");
  const [polyunsaturated_fat, setPolyFat] = useState("");
  const [cholesterol, setCholesterol] = useState("");
  const [sodium, setSodium] = useState("");
  const [carbohydrate, setCarb] = useState("");
  const [sugar, setSugar] = useState("");
  const [added_sugars, setAddedSugars] = useState("");
  const [fiber, setFiber] = useState("");
  const [protein, setProtein] = useState("");
  const [potassium, setPotassium] = useState("");
  const [calcium, setCalcium] = useState("");
  const [iron, setIron] = useState("");
  const [vitamin_d, setVitaminD] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Scan menu (modal)
  const [scanMenuVisible, setScanMenuVisible] = useState(false);
  const openScanMenu = () => setScanMenuVisible(true);
  const closeScanMenu = () => setScanMenuVisible(false);

  // Derived
  const name_lower = useMemo(() => food_name.trim().toLowerCase(), [food_name]);
  const brand_lower = useMemo(() => brand_name.trim().toLowerCase(), [brand_name]);

  // ---- OCR hook-in -------------------------------------------------------
  // Replace the body of this function with your actual OCR + parsing pipeline.
  // Given an image URI, extract text and set the appropriate state fields.
  async function scanImageAndAutofill(uri: string) {
    try {
      // TODO: pipe to your OCR → parse → setState flow.
      // For now, just log and tell the user it ran.
      console.log("[scanImageAndAutofill] URI:", uri);

      // Example: after parsing `extracted` string, set fields:
      // const parsed = parseNutritionFromText(extracted);
      // if (parsed.ingredients) setIngredients(parsed.ingredients);
      // if (parsed.calories) setCalories(parsed.calories);
      // ...etc

      Alert.alert("Scanning started", "We’re processing the image. This may take a moment.");
    } catch (e: any) {
      console.error("scanImageAndAutofill failed:", e);
      Alert.alert("Scan failed", e?.message ?? String(e));
    }
  }

  async function onScanFromCamera() {
    try {
      // Ask for camera permission
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to scan.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      closeScanMenu();
      await scanImageAndAutofill(uri);
    } catch (e: any) {
      console.error("onScanFromCamera error:", e);
      Alert.alert("Camera error", e?.message ?? String(e));
    }
  }

  async function onScanFromPhotos() {
    try {
      // Ask for library permission
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPerm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // don’t open the editor; we want a straight pick → OCR
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      closeScanMenu();
      await scanImageAndAutofill(uri);
    } catch (e: any) {
      console.error("onScanFromPhotos error:", e);
      Alert.alert("Picker error", e?.message ?? String(e));
    }
  }
  // -----------------------------------------------------------------------

  const validate = (): string | null => {
    if (!food_name.trim()) return "Please enter the product name.";
    if (!brand_name.trim()) return "Please enter the brand name.";
    if (!barcode.trim()) return "Please enter the barcode (GTIN/EAN/UPC).";
    if (!ingredients.trim()) return "Please enter the full ingredients list (as printed).";

    // Optional numeric sanity checks
    const maybeNums = [
      { label: "Calories", v: calories },
      { label: "Fat", v: fat },
      { label: "Saturated fat", v: saturated_fat },
      { label: "Trans fat", v: trans_fat },
      { label: "Monounsaturated fat", v: monounsaturated_fat },
      { label: "Polyunsaturated fat", v: polyunsaturated_fat },
      { label: "Cholesterol", v: cholesterol },
      { label: "Sodium", v: sodium },
      { label: "Carbohydrate", v: carbohydrate },
      { label: "Sugar", v: sugar },
      { label: "Added sugars", v: added_sugars },
      { label: "Fiber", v: fiber },
      { label: "Protein", v: protein },
      { label: "Potassium", v: potassium },
      { label: "Calcium", v: calcium },
      { label: "Iron", v: iron },
      { label: "Vitamin D", v: vitamin_d },
    ];
    for (const { label, v } of maybeNums) {
      if (v && isNaN(Number(v.trim()))) {
        return `${label} must be numeric (you can leave it blank if unknown).`;
      }
    }
    return null;
  };

  const onSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Missing / invalid input", error);
      return;
    }

    const payload: TicketPayload = {
      added_sugars: added_sugars.trim(),
      barcode: barcode.trim(),
      brand_lower,
      brand_name: brand_name.trim(),
      calcium: calcium.trim(),
      calories: calories.trim(),
      carbohydrate: carbohydrate.trim(),
      cholesterol: cholesterol.trim(),
      fat: fat.trim(),
      fiber: fiber.trim(),
      food_name: food_name.trim(),
      ingredients: ingredients.trim(),
      iron: iron.trim(),
      monounsaturated_fat: monounsaturated_fat.trim(),
      name_lower,
      polyunsaturated_fat: polyunsaturated_fat.trim(),
      potassium: potassium.trim(),
      protein: protein.trim(),
      saturated_fat: saturated_fat.trim(),
      serving: serving.trim(),            // e.g. "141 g"
      serving_amount: serving_amount.trim(),
      sodium: sodium.trim(),
      sugar: sugar.trim(),
      trans_fat: trans_fat.trim(),
      vitamin_d: vitamin_d.trim(),
      warning: warning.trim(),

      // meta
      status: "open",
      createdBy: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewerNotes: "",
    };

    try {
      setSubmitting(true);
      await addDoc(collection(db, "ProductTickets"), payload);
      Alert.alert("Ticket submitted", "Thanks! Your product ticket was submitted for review.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Ticket submit failed:", e);
      Alert.alert("Submit failed", e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1, backgroundColor: "#fafafaff" }} 
    >
      <View style={{ flex: 1 }}>
        {/* Scan anchor button (top-right) */}
        <View style={styles.scanAnchor}>
          <Pressable style={styles.scanBtn} onPress={openScanMenu}>
            <ThemedText style={styles.scanBtnText}>Scan</ThemedText>
          </Pressable>
        </View>

        {/* The menu as a Modal so it overlays above everything */}
        <Modal
          visible={scanMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={closeScanMenu}
        >
          <Pressable style={styles.menuOverlay} onPress={closeScanMenu}>
            <View pointerEvents="box-none" style={{ flex: 1 }}>
              <View style={styles.menuCard}>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    onScanFromCamera();
                  }}
                >
                  <Text style={styles.menuItemText}>Use Camera</Text>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    onScanFromPhotos();
                  }}
                >
                  <Text style={styles.menuItemText}>Use from Photos</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* DEBUG MODAL: inspect OCR output */}
        <Modal
          visible={debugModalOpen}
          animationType="slide"
          onRequestClose={() => setDebugModalOpen(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#fff",
              paddingTop: Platform.OS === "ios" ? 60 : 40, // <-- Safe-area top
              paddingBottom: 40,                            // <-- So Close button isn’t hidden
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700" }}>OCR Result (debug)</Text>
              <Pressable
                onPress={() => setDebugModalOpen(false)}
                style={{
                  backgroundColor: "#007AFF",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 60, // <-- lets you scroll past bottom content
              }}
              showsVerticalScrollIndicator={true}
            >
              <Text style={{ fontWeight: "700", marginBottom: 6 }}>Fields</Text>
              <Text
                style={{
                  fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
                  fontSize: 13,
                }}
              >
                {JSON.stringify(lastScan?.fields ?? {}, null, 2)}
              </Text>

              <View style={{ height: 20 }} />

              <Text style={{ fontWeight: "700", marginBottom: 6 }}>Raw Text</Text>
              <Text
                style={{
                  fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
                  fontSize: 13,
                }}
              >
                {lastScan?.rawText || ""}
              </Text>
            </ScrollView>
          </View>
        </Modal>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type = 'subtitle' style={styles.title}>Create Product Ticket</ThemedText>
          <ThemedText type = 'default' style={styles.subtitle}>Please provide as much information as you can.</ThemedText>

          {/* Core identity */}
          <Field
            label="Product name (as sold)"
            value={food_name}
            onChangeText={setFoodName}
            placeholder='e.g., "Strawberry Cheesecake Ice Cream - 16oz"'
          />
          <Field
            label="Brand name"
            value={brand_name}
            onChangeText={setBrandName}
            placeholder={"e.g., Ben & Jerry's"}
          />
          <Field
            label="Barcode (GTIN/EAN/UPC)"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="e.g., 0076840400218"
            keyboardType="numeric"
          />

          {/* Ingredients & warnings */}
          <Field
            label="Ingredients (full list)"
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Comma separated as printed on label"
            multiline
          />
          <Field
            label="Allergen warnings (comma-separated)"
            value={warning}
            onChangeText={setWarning}
            placeholder='e.g., "Wheat, Egg, Soy, Milk"'
          />

          {/* Serving */}
          <Field
            label="Serving (with unit)"
            value={serving}
            onChangeText={setServing}
            placeholder='e.g., "141 g"'
          />
          <Field
            label="Servings per container"
            value={serving_amount}
            onChangeText={setServingAmount}
            placeholder="e.g., 3"
            keyboardType="numeric"
          />

          {/* Nutrition (per serving) */}
          <View style={styles.sectionHeader}>
            <ThemedText type = "header" style={styles.sectionHeaderText}>Nutrition (per serving)</ThemedText>
          </View>
          <Field label="Calories" value={calories} onChangeText={setCalories} placeholder="e.g., 340" keyboardType="numeric" />
          <Field label="Fat (g)" value={fat} onChangeText={setFat} placeholder="e.g., 19" keyboardType="numeric" />
          <Field label="Saturated fat (g)" value={saturated_fat} onChangeText={setSaturatedFat} placeholder="e.g., 10" keyboardType="numeric" />
          <Field label="Trans fat (g)" value={trans_fat} onChangeText={setTransFat} placeholder="e.g., 0.5" keyboardType="numeric" />
          <Field label="Monounsaturated fat (g)" value={monounsaturated_fat} onChangeText={setMonoFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Polyunsaturated fat (g)" value={polyunsaturated_fat} onChangeText={setPolyFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Cholesterol (mg)" value={cholesterol} onChangeText={setCholesterol} placeholder="e.g., 65" keyboardType="numeric" />
          <Field label="Sodium (mg)" value={sodium} onChangeText={setSodium} placeholder="e.g., 150" keyboardType="numeric" />
          <Field label="Carbohydrate (g)" value={carbohydrate} onChangeText={setCarb} placeholder="e.g., 38" keyboardType="numeric" />
          <Field label="Sugar (g)" value={sugar} onChangeText={setSugar} placeholder="e.g., 32" keyboardType="numeric" />
          <Field label="Added sugars (g)" value={added_sugars} onChangeText={setAddedSugars} placeholder="e.g., 26" keyboardType="numeric" />
          <Field label="Fiber (g)" value={fiber} onChangeText={setFiber} placeholder="e.g., 1" keyboardType="numeric" />
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="e.g., 5" keyboardType="numeric" />
          <Field label="Potassium (mg)" value={potassium} onChangeText={setPotassium} placeholder="e.g., 210" keyboardType="numeric" />
          <Field label="Calcium (mg)" value={calcium} onChangeText={setCalcium} placeholder="e.g., 150" keyboardType="numeric" />
          <Field label="Iron (mg)" value={iron} onChangeText={setIron} placeholder="e.g., 0.4" keyboardType="numeric" />
          <Field label="Vitamin D (mcg or IU as on label)" value={vitamin_d} onChangeText={setVitaminD} placeholder="e.g., 0" keyboardType="numeric" />

          {/* Derived preview */}
          <View style={{ marginTop: 10, marginBottom: 18 }}>
            <ThemedText style={styles.readonlyLabel}>Derived fields (auto):</ThemedText>
            <ThemedText style={styles.readonlyText}>name_lower: {name_lower || "—"}</ThemedText>
            <ThemedText style={styles.readonlyText}>brand_lower: {brand_lower || "—"}</ThemedText>
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitText}>Submit Ticket</ThemedText>}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24, marginTop:16 },
  title: { fontWeight: "700", marginBottom: 6, color: '#212D39' },
  subtitle: { color: "#555", marginBottom: 16 },
  label: { color: "#364452ff", fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    fontSize:17.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  sectionHeader: { marginTop: 8, marginBottom: 8 },
  sectionHeaderText: { color: "#364452ff", fontWeight: "700" },
  readonlyLabel: { fontWeight: "600", marginBottom: 4, color: "#555" },
  readonlyText: { color: "#777" },
  submitBtn: {
    backgroundColor: "#27778E",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  submitText: { color: "#fff", fontWeight: "700" },
  cancelBtn: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  cancelText: { color: "#444", fontWeight: "600" },

  // Scan menu / overlay
  scanAnchor: {
    position: "absolute",
    right: 16,
    top: 40,
    zIndex: 1,
  },
  scanBtn: {
    backgroundColor: "#1f2937",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  scanBtnText: { color: "#fff", fontWeight: "700" },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  menuCard: {
    position: "absolute",
    right: 16,
    top: 60,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 12, // Android stacking
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14 },
  menuItemText: { fontWeight: "600", color: "#111" },
  menuDivider: { height: 1, backgroundColor: "#eee" },
});
