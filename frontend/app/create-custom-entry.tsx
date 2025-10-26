import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemedColor } from "@/components/ThemedColor";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

// Local DB helpers
import { initCustomDb, upsertCustomEntry } from '@/db/customFoods';

type EntryPayload = {
  // Product-ish fields (strings)
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

export default function CreateCustomEntryScreen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  useEffect(() => {
    // make sure sqlite db exists
    initCustomDb().catch((e) => console.warn("[CustomDB] init failed:", e));
  }, []);

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

  // Nutrition (strings)
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

  const [saving, setSaving] = useState(false);

  // Scan menu (modal)
  const [scanMenuVisible, setScanMenuVisible] = useState(false);
  const openScanMenu = () => setScanMenuVisible(true);
  const closeScanMenu = () => setScanMenuVisible(false);

  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [lastScan, setLastScan] = useState<{ rawText: string; fields: any } | null>(null);

  // Derived
  const name_lower = useMemo(() => food_name.trim().toLowerCase(), [food_name]);
  const brand_lower = useMemo(() => brand_name.trim().toLowerCase(), [brand_name]);

  const goBack = () => {
    if (router.canGoBack()) router.push("/(tabs)/search");
  };

  // Safely build picker options across old/new Expo SDKs.
  function safePickerOptions() {
    if ((ImagePicker as any)?.MediaType?.Images) {
      return { mediaTypes: ImagePicker.MediaType.Images, quality: 1 };
    }
    if ((ImagePicker as any)?.MediaTypeOptions?.Images) {
      return { mediaTypes: (ImagePicker as any).MediaTypeOptions.Images, quality: 1 };
    }
    return { quality: 1 } as const;
  }

  async function toBase64(uri: string): Promise<string> {
    const manip = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manip.base64) return manip.base64;
    return await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
  }

  // ---- OCR hook-in -------------------------------------------------------
  async function scanImageAndAutofill(uri: string) {
    try {
      const base64 = await toBase64(uri);

      Alert.alert("Scanning started", "We’re processing the image. This may take a moment.");

      const functions = getFunctions(undefined, "us-central1");
      const scanFn = httpsCallable(functions, "scanNutritionFromImage");
      const result: any = await scanFn({ imageBase64: base64 });

      if (!result?.data) {
        Alert.alert("Scan failed", "No data returned from OCR service.");
        return;
      }

      const { rawText, fields } = result.data as {
        rawText: string;
        fields: Partial<Record<keyof EntryPayload, string>>;
      };

      // Save for debugging (log + file)
      console.log("[OCR rawText]", rawText);
      console.log("[OCR fields]", fields);

      try {
        const path = `${FileSystem.documentDirectory}last-ocr.json`;
        await FileSystem.writeAsStringAsync(
          path,
          JSON.stringify({ at: new Date().toISOString(), rawText, fields }, null, 2)
        );
      } catch (e) {
        console.warn("Failed to write last-ocr.json:", e);
      }

      // Hydrate fields onto the form
      if (fields.food_name) setFoodName(fields.food_name);
      if (fields.brand_name) setBrandName(fields.brand_name);
      if (fields.barcode) setBarcode(fields.barcode);
      if (fields.serving) setServing(fields.serving);
      if (fields.serving_amount) setServingAmount(fields.serving_amount);
      if (fields.ingredients) setIngredients(fields.ingredients);
      if (fields.warning) setWarning(fields.warning);

      if (fields.calories) setCalories(fields.calories);
      if (fields.fat) setFat(fields.fat);
      if (fields.saturated_fat) setSaturatedFat(fields.saturated_fat);
      if (fields.trans_fat) setTransFat(fields.trans_fat);
      if (fields.monounsaturated_fat) setMonoFat(fields.monounsaturated_fat);
      if (fields.polyunsaturated_fat) setPolyFat(fields.polyunsaturated_fat);
      if (fields.cholesterol) setCholesterol(fields.cholesterol);
      if (fields.sodium) setSodium(fields.sodium);
      if (fields.carbohydrate) setCarb(fields.carbohydrate);
      if (fields.sugar) setSugar(fields.sugar);
      if (fields.added_sugars) setAddedSugars(fields.added_sugars);
      if (fields.fiber) setFiber(fields.fiber);
      if (fields.protein) setProtein(fields.protein);
      if (fields.potassium) setPotassium(fields.potassium);
      if (fields.calcium) setCalcium(fields.calcium);
      if (fields.iron) setIron(fields.iron);
      if (fields.vitamin_d) setVitaminD(fields.vitamin_d);

      setLastScan({ rawText, fields });
      setDebugModalOpen(true);
    } catch (e: any) {
      console.error("scanImageAndAutofill failed:", e);
      Alert.alert("Scan failed", e?.message ?? String(e));
    }
  }

  async function onScanFromCamera() {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to scan.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync(safePickerOptions() as any);
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
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPerm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync(safePickerOptions() as any);
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
    if (!barcode.trim()) return "Please enter the barcode.";
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
      if (v && isNaN(Number(String(v).trim()))) {
        return `${label} must be numeric (you can leave it blank if unknown).`;
      }
    }
    return null;
  };

  const onSave = async () => {
    // same validation you already have...
    const error = validate();
    if (error) {
      Alert.alert("Missing / invalid input", error);
      return;
    }

    try {
      setSaving(true);

      // Build the record exactly as CustomEntryRecord expects
      await upsertCustomEntry({
        // identity
        food_name: food_name.trim(),
        brand_name: brand_name.trim(),
        barcode: barcode.trim(),

        // text
        ingredients: ingredients.trim(),
        warning: warning.trim(), // <-- THIS replaces the old "allergens" idea

        // serving
        serving: serving.trim(),
        serving_amount: serving_amount.trim(),

        // nutrition (strings are fine)
        calories: calories.trim(),
        fat: fat.trim(),
        saturated_fat: saturated_fat.trim(),
        trans_fat: trans_fat.trim(),
        monounsaturated_fat: monounsaturated_fat.trim(),
        polyunsaturated_fat: polyunsaturated_fat.trim(),
        cholesterol: cholesterol.trim(),
        sodium: sodium.trim(),
        carbohydrate: carbohydrate.trim(),
        sugar: sugar.trim(),
        added_sugars: added_sugars.trim(),
        fiber: fiber.trim(),
        protein: protein.trim(),
        potassium: potassium.trim(),
        calcium: calcium.trim(),
        iron: iron.trim(),
        vitamin_d: vitamin_d.trim(),

        // derived
        name_lower: food_name.trim().toLowerCase(),
        brand_lower: brand_name.trim().toLowerCase(),
      });

      Alert.alert("Saved", "Custom entry saved locally!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Save custom entry failed:", e);
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1, backgroundColor: "#fafafaff" }}
    >
      <View style={{ flex: 1 }}>
        {/* Top header with Back */}
        <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ThemedText type="subtitle" style={{ color: activeColors.text }}>
              Create Custom Entry
            </ThemedText>
          </View>
        </ThemedView>
        <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

        {/* Floating scan button */}
        <View style={styles.scanAnchor}>
          <Pressable style={styles.scanBtn} onPress={openScanMenu}>
            <ThemedText style={styles.scanBtnText}>Autofill</ThemedText>
          </Pressable>
        </View>

        {/* Scan menu */}
        <Modal
          visible={scanMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={closeScanMenu}
        >
          <Pressable style={styles.menuOverlay} onPress={closeScanMenu}>
            <View pointerEvents="box-none" style={{ flex: 1 }}>
              <View style={styles.menuCard}>
                <Pressable style={styles.menuItem} onPress={onScanFromCamera}>
                  <ThemedText style={styles.menuItemText}>Use Camera</ThemedText>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable style={styles.menuItem} onPress={onScanFromPhotos}>
                  <ThemedText style={styles.menuItemText}>Use from Photos</ThemedText>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* DEBUG MODAL */}
        <Modal
          visible={debugModalOpen}
          animationType="slide"
          onRequestClose={() => setDebugModalOpen(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#fff",
              paddingTop: Platform.OS === "ios" ? 60 : 40,
              paddingBottom: 40,
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
              <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>OCR Result (debug)</ThemedText>
              <Pressable
                onPress={() => setDebugModalOpen(false)}
                style={{
                  backgroundColor: "#007AFF",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Close</ThemedText>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
              showsVerticalScrollIndicator
            >
              <ThemedText style={{ fontWeight: "700", marginBottom: 6 }}>Fields</ThemedText>
              <ThemedText
                style={{
                  fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
                  fontSize: 13,
                }}
              >
                {JSON.stringify(lastScan?.fields ?? {}, null, 2)}
              </ThemedText>

              <View style={{ height: 20 }} />

              <ThemedText style={{ fontWeight: "700", marginBottom: 6 }}>Raw Text</ThemedText>
              <ThemedText
                style={{
                  fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
                  fontSize: 13,
                }}
              >
                {lastScan?.rawText || ""}
              </ThemedText>
            </ScrollView>
          </View>
        </Modal>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle" style={styles.title}>
            Create Custom Entry
          </ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            You can scan a label to autofill, then save locally on your device.
          </ThemedText>

          {/* Core identity */}
          <Field
            label="Product name (as sold)"
            value={food_name}
            onChangeText={setFoodName}
            placeholder='e.g., "Strawberry Pretzels"'
          />
          <Field
            label="Brand name"
            value={brand_name}
            onChangeText={setBrandName}
            placeholder={"e.g., Brand Co."}
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
            placeholder='e.g., "28 g"'
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
            <ThemedText type="header" style={styles.sectionHeaderText}>
              Nutrition (per serving)
            </ThemedText>
          </View>
          <Field label="Calories" value={calories} onChangeText={setCalories} placeholder="e.g., 110" keyboardType="numeric" />
          <Field label="Fat (g)" value={fat} onChangeText={setFat} placeholder="e.g., 0.5" keyboardType="numeric" />
          <Field label="Saturated fat (g)" value={saturated_fat} onChangeText={setSaturatedFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Trans fat (g)" value={trans_fat} onChangeText={setTransFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Monounsaturated fat (g)" value={monounsaturated_fat} onChangeText={setMonoFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Polyunsaturated fat (g)" value={polyunsaturated_fat} onChangeText={setPolyFat} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Cholesterol (mg)" value={cholesterol} onChangeText={setCholesterol} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Sodium (mg)" value={sodium} onChangeText={setSodium} placeholder="e.g., 400" keyboardType="numeric" />
          <Field label="Carbohydrate (g)" value={carbohydrate} onChangeText={setCarb} placeholder="e.g., 23" keyboardType="numeric" />
          <Field label="Sugar (g)" value={sugar} onChangeText={setSugar} placeholder="e.g., <1" />
          <Field label="Added sugars (g)" value={added_sugars} onChangeText={setAddedSugars} placeholder="e.g., 0" keyboardType="numeric" />
          <Field label="Fiber (g)" value={fiber} onChangeText={setFiber} placeholder="e.g., 2" keyboardType="numeric" />
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="e.g., 3" keyboardType="numeric" />
          <Field label="Potassium (mg)" value={potassium} onChangeText={setPotassium} placeholder="e.g., 90" keyboardType="numeric" />
          <Field label="Calcium (mg)" value={calcium} onChangeText={setCalcium} placeholder="e.g., 10" keyboardType="numeric" />
          <Field label="Iron (mg)" value={iron} onChangeText={setIron} placeholder="e.g., 1.2" keyboardType="numeric" />
          <Field label="Vitamin D (mcg or IU as on label)" value={vitamin_d} onChangeText={setVitaminD} placeholder="e.g., 0" keyboardType="numeric" />

          {/* Derived preview */}
          <View style={{ marginTop: 10, marginBottom: 18 }}>
            <ThemedText style={styles.readonlyLabel}>Derived fields (auto):</ThemedText>
            <ThemedText style={styles.readonlyText}>name_lower: {name_lower || "—"}</ThemedText>
            <ThemedText style={styles.readonlyText}>brand_lower: {brand_lower || "—"}</ThemedText>
          </View>

          <Pressable style={[styles.submitBtn, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitText}>Save Entry</ThemedText>}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={goBack}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 24 },
  titleContainer: { paddingTop: 70, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, width: "100%" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6, color: "#212D39" },
  subtitle: { color: "#555", marginBottom: 16 },
  label: { color: "#364452ff", fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    fontSize: 17.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  sectionHeader: { marginTop: 8, marginBottom: 8 },
  sectionHeaderText: { color: "#364452ff", fontWeight: "700", fontSize: 16 },
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
  scanAnchor: { position: "absolute", right: 16, top: 60, zIndex: 1 }, // bumped below header
  scanBtn: { backgroundColor: "#1f2937", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  scanBtnText: { color: "#fff", fontWeight: "700" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.12)" },
  menuCard: {
    position: "absolute",
    right: 16,
    top: 96,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14 },
  menuItemText: { fontWeight: "600", color: "#111" },
  menuDivider: { height: 1, backgroundColor: "#eee" },
});
