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
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/db/firebaseConfig";

// ---------- OCR PARSER -------------
function normalizeForParsing(s: string) {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .replace(/ +:/g, ":")
    .trim();
}

function parseNutritionFacts(ocr: string) {
  const out: any = {};
  const text = normalizeForParsing(ocr);
  const lines = text.split("\n");
  console.log("[OCR][first 20 lines]");
  lines.slice(0, 20).forEach((l, i) =>
    console.log(String(i + 1).padStart(2, "0"), l)
  );
  const idxIngredients = text.toUpperCase().indexOf("INGREDIENT");
  console.log("[OCR] indexOf(INGREDIENT) =", idxIngredients);

  const ingredientBlockRegex =
    /(INGREDIENTS?|Ingredients?)[\s:]*([\s\S]*?)(?=\n\s*(CONTAINS?:|ALLERGEN|PHENYLKETONURICS|CAFFEINE|NUTRITION\s+FACTS|%?\s*DAILY\s*VALUE|\*|$))/i;
  const ingMatch = text.match(ingredientBlockRegex);
  if (ingMatch) {
    let raw = ingMatch[2].trim();
    raw = raw.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    raw = raw
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s*—\s*/g, " - ")
      .replace(/\s*-\s*/g, " - ")
      .replace(/ ,/g, ",")
      .replace(/\s+\./g, ".");
    out.ingredients = raw;
    console.log("[PARSE] ingredients ✓", out.ingredients.slice(0, 120), "…");
  } else {
    console.log("[PARSE] ingredients ✗ (no match)");
  }

  const containsRegex = /\bCONTAINS?:\s*([^\n]+)/i;
  const containsMatch = text.match(containsRegex);
  if (containsMatch) {
    out.warning = containsMatch[1].trim().replace(/\s*,\s*/g, ", ");
    console.log("[PARSE] warning ✓", out.warning);
  }

  return out;
}

// ---------- UI COMPONENTS ----------
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

// ---------- MAIN ----------
export default function CreateTicketScreen() {
  const [food_name, setFoodName] = useState("");
  const [brand_name, setBrandName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [warning, setWarning] = useState("");

  // Debug modal state
  const [ocrRaw, setOcrRaw] = useState("");
  const [ocrDebugOpen, setOcrDebugOpen] = useState(false);

  // Derived
  const name_lower = useMemo(() => food_name.trim().toLowerCase(), [food_name]);
  const brand_lower = useMemo(
    () => brand_name.trim().toLowerCase(),
    [brand_name]
  );

  // ---------- OCR handlers ----------
  async function pickImage(fromCamera: boolean) {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 1,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          quality: 1,
        });
      }
      if (result.canceled) return;
      const asset = result.assets[0];

      // Optional: upscale image for better OCR
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1500 } }],
        { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );

      // 👇 Replace this with your OCR call
      // For now, just load raw text from mock
      const ocrText = "Nutrition Facts...\nIngredients: CARBONATED WATER, LESS THAN 2% OF: CARAMEL COLOR...";
      setOcrRaw(ocrText);
      setOcrDebugOpen(true);

      const parsed = parseNutritionFacts(ocrText);
      if (parsed.ingredients) setIngredients(parsed.ingredients);
      if (parsed.warning) setWarning(parsed.warning);
    } catch (e: any) {
      console.error("Image picker/OCR failed", e);
      Alert.alert("Error", e?.message ?? String(e));
    }
  }

  const onSubmit = async () => {
    if (!food_name.trim()) return Alert.alert("Missing", "Please enter name.");
    if (!brand_name.trim()) return Alert.alert("Missing", "Please enter brand.");
    if (!barcode.trim()) return Alert.alert("Missing", "Please enter barcode.");

    try {
      const payload = {
        food_name,
        brand_name,
        brand_lower,
        name_lower,
        barcode,
        ingredients,
        warning,
        status: "open",
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, "ProductTickets"), payload);
      Alert.alert("Success", "Ticket submitted!");
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Submit failed", e?.message ?? String(e));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Create Product Ticket</Text>
          <View style={{ flexDirection: "row" }}>
            <Pressable
              style={styles.scanBtn}
              onPress={() => pickImage(false)}
            >
              <Text style={styles.scanBtnText}>📁</Text>
            </Pressable>
            <Pressable
              style={styles.scanBtn}
              onPress={() => pickImage(true)}
            >
              <Text style={styles.scanBtnText}>📷</Text>
            </Pressable>
          </View>
        </View>

        <Field
          label="Product name"
          value={food_name}
          onChangeText={setFoodName}
        />
        <Field
          label="Brand name"
          value={brand_name}
          onChangeText={setBrandName}
          placeholder='e.g., "Ben & Jerry\s"'
        />
        <Field
          label="Barcode"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="numeric"
        />
        <Field
          label="Ingredients"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
        />
        <Field
          label="Warnings"
          value={warning}
          onChangeText={setWarning}
          multiline
        />

        <Pressable style={styles.submitBtn} onPress={onSubmit}>
          <Text style={styles.submitText}>Submit Ticket</Text>
        </Pressable>

        {/* Debug Modal */}
        <Modal visible={ocrDebugOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                Raw OCR (first 2000 chars)
              </Text>
              <ScrollView style={{ maxHeight: 400 }}>
                <Text
                  selectable
                  style={{
                    fontFamily: Platform.select({
                      ios: "Menlo",
                      android: "monospace",
                    }),
                  }}
                >
                  {ocrRaw.slice(0, 2000)}
                </Text>
              </ScrollView>
              <Pressable
                onPress={() => setOcrDebugOpen(false)}
                style={{ alignSelf: "flex-end", padding: 10 }}
              >
                <Text style={{ color: "#007AFF", fontWeight: "700" }}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700" },
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
  scanBtn: {
    marginLeft: 8,
    backgroundColor: "#eee",
    padding: 8,
    borderRadius: 8,
  },
  scanBtnText: { fontSize: 18 },
  submitBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  submitText: { color: "#fff", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    maxHeight: "80%",
  },
});
