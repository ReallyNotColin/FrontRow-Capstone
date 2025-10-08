// frontend/app/create-ticket.tsx
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
} from "react-native";
import { router } from "expo-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/db/firebaseConfig";

import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import { callVisionOcr, parseNutritionFacts } from "@/utils/nutritionOCR";

type TicketPayload = {
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
  serving: string;
  serving_amount: string;
  sodium: string;
  sugar: string;
  trans_fat: string;
  vitamin_d: string;
  warning: string;

  status: "open" | "approved" | "rejected";
  createdBy: string | null;
  createdAt: any;
  updatedAt: any;
  reviewerNotes?: string;
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.label}>{children}</Text>
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

// ⚠️ For dev: put your Vision API key here, or better: pull from env
const VISION_API_KEY = "<YOUR_VISION_API_KEY>";

export default function CreateTicketScreen() {
  // Core fields
  const [food_name, setFoodName] = useState("");
  const [brand_name, setBrandName] = useState("");
  const [barcode, setBarcode] = useState("");

  // Ingredients + warnings
  const [ingredients, setIngredients] = useState("");
  const [warning, setWarning] = useState("");

  // Serving
  const [serving, setServing] = useState("");
  const [serving_amount, setServingAmount] = useState("");

  // Nutrition
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
  const [busyScan, setBusyScan] = useState(false);

  // Derived
  const name_lower = useMemo(() => food_name.trim().toLowerCase(), [food_name]);
  const brand_lower = useMemo(() => brand_name.trim().toLowerCase(), [brand_name]);

  const validate = (): string | null => {
    if (!food_name.trim()) return "Please enter the product name.";
    if (!brand_name.trim()) return "Please enter the brand name.";
    if (!barcode.trim()) return "Please enter the barcode (GTIN/EAN/UPC).";
    if (!ingredients.trim()) return "Please enter the full ingredients list (as printed).";

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
      if (v && isNaN(Number(v.trim()))) return `${label} must be numeric (or leave blank).`;
    }
    return null;
  };

  const applyParsed = (p: ReturnType<typeof parseNutritionFacts>) => {
    if (p.serving) setServing(p.serving);
    if (p.serving_amount) setServingAmount(p.serving_amount);
    if (p.ingredients) setIngredients(p.ingredients);
    if (p.warning) setWarning(p.warning);

    if (p.calories) setCalories(p.calories);
    if (p.fat) setFat(p.fat);
    if (p.saturated_fat) setSaturatedFat(p.saturated_fat);
    if (p.trans_fat) setTransFat(p.trans_fat);
    if (p.monounsaturated_fat) setMonoFat(p.monounsaturated_fat);
    if (p.polyunsaturated_fat) setPolyFat(p.polyunsaturated_fat);
    if (p.cholesterol) setCholesterol(p.cholesterol);
    if (p.sodium) setSodium(p.sodium);
    if (p.carbohydrate) setCarb(p.carbohydrate);
    if (p.sugar) setSugar(p.sugar);
    if (p.added_sugars) setAddedSugars(p.added_sugars);
    if (p.fiber) setFiber(p.fiber);
    if (p.protein) setProtein(p.protein);
    if (p.potassium) setPotassium(p.potassium);
    if (p.calcium) setCalcium(p.calcium);
    if (p.iron) setIron(p.iron);
    if (p.vitamin_d) setVitaminD(p.vitamin_d);
  };

  const askAndScan = async () => {
    try {
      setBusyScan(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to scan labels.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const base64 = result.assets[0].base64!;
      const text = await callVisionOcr(base64, VISION_API_KEY);

      if (!text?.trim()) {
        Alert.alert("No text found", "Try retaking the photo with better lighting and focus.");
        return;
      }

      const parsed = parseNutritionFacts(text);
      applyParsed(parsed);
      Alert.alert("Scanned", "We filled what we could — please review the fields.");
    } catch (e: any) {
      console.error("OCR scan failed:", e);
      Alert.alert("Scan failed", e?.message ?? String(e));
    } finally {
      setBusyScan(false);
    }
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
      serving: serving.trim(),
      serving_amount: serving_amount.trim(),
      sodium: sodium.trim(),
      sugar: sugar.trim(),
      trans_fat: trans_fat.trim(),
      vitamin_d: vitamin_d.trim(),
      warning: warning.trim(),

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
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Title row + Scan button */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={styles.title}>Create Product Ticket</Text>
          <Pressable
            onPress={askAndScan}
            disabled={busyScan}
            style={({ pressed }) => [
              {
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#007AFF",
                opacity: pressed || busyScan ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: "#007AFF", fontWeight: "700" }}>
              {busyScan ? "Scanning…" : "Scan Label"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.subtitle}>Please provide as much information as you can.</Text>

        {/* Core identity */}
        <Field label="Product name (as sold)" value={food_name} onChangeText={setFoodName} placeholder='e.g., "Strawberry Cheesecake Ice Cream - 16oz"' />
        <Field
          label="Brand name"
          value={brand_name}
          onChangeText={setBrandName}
          placeholder={`e.g., "Ben & Jerry's"`}
        />
        <Field label="Barcode (GTIN/EAN/UPC)" value={barcode} onChangeText={setBarcode} placeholder="e.g., 0076840400218" keyboardType="numeric" />

        {/* Ingredients & warnings */}
        <Field label="Ingredients (full list)" value={ingredients} onChangeText={setIngredients} placeholder="Comma separated as printed on label" multiline />
        <Field label="Allergen warnings (comma-separated)" value={warning} onChangeText={setWarning} placeholder='e.g., "Wheat, Egg, Soy, Milk"' />

        {/* Serving */}
        <Field label="Serving (with unit)" value={serving} onChangeText={setServing} placeholder='e.g., "141 g"' />
        <Field label="Servings per container" value={serving_amount} onChangeText={setServingAmount} placeholder="e.g., 3" keyboardType="numeric" />

        {/* Nutrition */}
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Nutrition (per serving)</Text></View>
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
          <Text style={styles.readonlyLabel}>Derived fields (auto):</Text>
          <Text style={styles.readonlyText}>name_lower: {name_lower || "—"}</Text>
          <Text style={styles.readonlyText}>brand_lower: {brand_lower || "—"}</Text>
        </View>

        <Pressable style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Ticket</Text>}
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#555", marginTop: 6, marginBottom: 16 },
  label: { fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  sectionHeader: { marginTop: 8, marginBottom: 8 },
  sectionHeaderText: { fontWeight: "700", fontSize: 16 },
  readonlyLabel: { fontWeight: "600", marginBottom: 4, color: "#555" },
  readonlyText: { color: "#777" },
  submitBtn: { backgroundColor: "#007AFF", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 12 },
  submitText: { color: "#fff", fontWeight: "700" },
  cancelBtn: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  cancelText: { color: "#444", fontWeight: "600" },
});
