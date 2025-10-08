// app/admin/ticket/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/db/firebaseConfig";

type TicketDoc = {
  food_name: string;
  brand_name: string;
  barcode: string;
  ingredients: string;
  warning?: string;
  serving?: string;
  serving_amount?: string;
  calories?: string;
  fat?: string;
  saturated_fat?: string;
  trans_fat?: string;
  monounsaturated_fat?: string;
  polyunsaturated_fat?: string;
  cholesterol?: string;
  sodium?: string;
  carbohydrate?: string;
  sugar?: string;
  added_sugars?: string;
  fiber?: string;
  protein?: string;
  potassium?: string;
  calcium?: string;
  iron?: string;
  vitamin_d?: string;

  status: "open" | "approved" | "rejected";
  createdAt?: Timestamp;
  createdBy?: string | null;
  reviewerNotes?: string;
};

const F = ({ label, value, onChangeText, multiline = false }: any) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value ?? ""}
      onChangeText={onChangeText}
      style={[styles.input, multiline && styles.inputMultiline]}
      multiline={multiline}
      autoCapitalize="none"
    />
  </View>
);

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Partial<TicketDoc>>({});

  useEffect(() => {
    const ref = doc(db, "ProductTickets", id!);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTicket(null);
        setLoading(false);
        return;
      }
      const data = snap.data() as any;
      setTicket({
        ...data,
        barcode: (data.barcode ?? "").toString(),
      });
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const set = (k: keyof TicketDoc) => (v: string) => setEdits((p) => ({ ...p, [k]: v }));

  const doAction = async (action: "saveEdits" | "approve" | "deny") => {
    try {
      if (!id) return;

      // Always get a valid Functions instance in the correct region
      const fns = getFunctions(app, "us-central1");
      const callable = httpsCallable(fns, "reviewTicket");

      const payload: any = { ticketId: id, action };
      if (Object.keys(edits).length > 0) payload.edits = edits;

      console.log("[reviewTicket] calling", payload);
      const res: any = await callable(payload);
      console.log("[reviewTicket] response", res?.data);

      if (!res?.data?.ok) throw new Error("Function failed");

      if (action === "saveEdits") {
        Alert.alert("Saved", "Edits saved on ticket.");
        setEdits({});
      } else if (action === "approve") {
        Alert.alert("Approved", "Ticket approved and published.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Denied", "Ticket denied and archived.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      console.error("[reviewTicket] error:", e);
      Alert.alert("Error", e?.message ?? String(e));
    }
  };

  const closeScreen = () => {
    if (Object.keys(edits).length > 0) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved edits on this ticket.",
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Discard & Close", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text>Ticket not found (may have been processed).</Text>
      </View>
    );
  }

  const disabled = ticket.status !== "open";

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>{ticket.food_name}</Text>
      <Text style={styles.meta}>
        {ticket.brand_name} • {ticket.barcode}
      </Text>
      {ticket.createdAt && <Text style={styles.meta}>Submitted {ticket.createdAt.toDate().toLocaleString()}</Text>}
      <View style={styles.divider} />

      {/* editable fields */}
      <F label="Food name" value={edits.food_name ?? ticket.food_name} onChangeText={set("food_name")} />
      <F label="Brand name" value={edits.brand_name ?? ticket.brand_name} onChangeText={set("brand_name")} />
      <F label="Barcode" value={edits.barcode ?? ticket.barcode} onChangeText={set("barcode")} />
      <F label="Ingredients" value={edits.ingredients ?? ticket.ingredients} onChangeText={set("ingredients")} multiline />
      <F label="Warnings (comma-separated)" value={edits.warning ?? ticket.warning} onChangeText={set("warning")} />

      <View style={{ height: 6 }} />
      <Text style={styles.h2}>Nutrition (per serving)</Text>

      {[
        "serving","serving_amount","calories","fat","saturated_fat","trans_fat",
        "monounsaturated_fat","polyunsaturated_fat","cholesterol","sodium","carbohydrate",
        "sugar","added_sugars","fiber","protein","potassium","calcium","iron","vitamin_d"
      ].map((key) => (
        <F
          key={key}
          label={key.replace(/_/g, " ")}
          value={(edits as any)[key] ?? (ticket as any)[key]}
          onChangeText={(val: string) => set(key as any)(val)}
        />
      ))}

      <View style={{ height: 8 }} />
      <F label="Reviewer notes" value={edits.reviewerNotes ?? ticket.reviewerNotes} onChangeText={set("reviewerNotes")} multiline />

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.light]} onPress={closeScreen}>
          <Text style={[styles.btnText, { color: "#333" }]}>Close</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.grey]} disabled={disabled} onPress={() => doAction("saveEdits")}>
          <Text style={styles.btnText}>Save Edits</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.green]} disabled={disabled} onPress={() => doAction("approve")}>
          <Text style={styles.btnText}>Approve</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.red]} disabled={disabled} onPress={() => doAction("deny")}>
          <Text style={styles.btnText}>Deny</Text>
        </Pressable>
      </View>

      {disabled && (
        <Text style={{ color: "#a00", marginTop: 8 }}>
          This ticket is no longer open (status: {ticket.status}).
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontWeight: "800", fontSize: 20 },
  h2: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  meta: { color: "#666", marginTop: 4 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 12 },
  label: { fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "white",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 20, flexWrap: "wrap" },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "700" },
  light: { backgroundColor: "#eee" },
  grey: { backgroundColor: "#666" },
  green: { backgroundColor: "#2e7d32" },
  red: { backgroundColor: "#c62828" },
});
