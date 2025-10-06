// app/admin/index.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp } from "firebase/firestore";
import { db } from "@/db/firebaseConfig";

type TicketListItem = {
  id: string;
  food_name: string;
  brand_name: string;
  barcode: string;
  createdAt?: Timestamp;
  createdBy?: string | null;
};

export default function AdminInbox() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "ProductTickets"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: TicketListItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          food_name: data.food_name ?? "",
          brand_name: data.brand_name ?? "",
          barcode: (data.barcode ?? "").toString().trim(),
          createdAt: data.createdAt,
          createdBy: data.createdBy ?? null,
        });
      });
      setTickets(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading tickets…</Text>
      </View>
    );
  }

  if (tickets.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No open tickets 🎉</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={tickets}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/admin/ticket/${item.id}`)}>
          <Text style={styles.title}>{item.food_name}</Text>
          <Text style={styles.sub}>{item.brand_name}</Text>
          {!!item.barcode && <Text style={styles.meta}>Barcode: {item.barcode}</Text>}
          {item.createdAt && (
            <Text style={styles.meta}>
              Submitted: {item.createdAt.toDate().toLocaleString()}
            </Text>
          )}
          {!!item.createdBy && <Text style={styles.meta}>By: {item.createdBy}</Text>}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "white",
  },
  title: { fontWeight: "700", fontSize: 16 },
  sub: { color: "#555", marginTop: 2 },
  meta: { color: "#777", marginTop: 4, fontSize: 12 },
});
