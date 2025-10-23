// backend/functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

type ReviewAction = "approve" | "deny" | "saveEdits";

type TicketDoc = {
  added_sugars?: string;
  barcode: string;
  brand_lower?: string;
  brand_name: string;
  calcium?: string;
  calories?: string;
  carbohydrate?: string;
  cholesterol?: string;
  fat?: string;
  fiber?: string;
  food_name: string;
  ingredients: string;
  iron?: string;
  monounsaturated_fat?: string;
  name_lower?: string;
  polyunsaturated_fat?: string;
  potassium?: string;
  protein?: string;
  saturated_fat?: string;
  serving?: string;
  serving_amount?: string;
  sodium?: string;
  sugar?: string;
  trans_fat?: string;
  vitamin_d?: string;
  warning?: string;

  status: "open" | "approved" | "rejected";
  createdBy: string | null;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewerNotes?: string;
};

type ReviewTicketInput = {
  ticketId: string;
  action: ReviewAction;
  edits?: Partial<TicketDoc>;
  notes?: string;
};

function assertAdmin(auth: { token?: any } | null | undefined) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Auth required.");
  }
  if (auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}

function normalizeString(s?: string | null) {
  return (s ?? "").toString().trim();
}

function toLowerOrEmpty(s?: string | null) {
  return normalizeString(s).toLowerCase();
}

function sanitizeEdits(raw?: Partial<TicketDoc>): Partial<TicketDoc> {
  if (!raw) return {};
  const e: Partial<TicketDoc> = {};
  const copyKeys: (keyof TicketDoc)[] = [
    "food_name","brand_name","barcode","ingredients","warning","serving","serving_amount",
    "calories","fat","saturated_fat","trans_fat","monounsaturated_fat","polyunsaturated_fat",
    "cholesterol","sodium","carbohydrate","sugar","added_sugars","fiber","protein",
    "potassium","calcium","iron","vitamin_d","reviewerNotes"
  ];
  for (const k of copyKeys) {
    if (k in raw) {
      // @ts-expect-error index
      e[k] = normalizeString(raw[k] as any);
    }
  }
  if ("food_name" in e) e.name_lower = toLowerOrEmpty(e.food_name);
  if ("brand_name" in e) e.brand_lower = toLowerOrEmpty(e.brand_name);
  return e;
}

function ticketToProductFields(t: TicketDoc | (TicketDoc & { id?: string })) {
  return {
    added_sugars: normalizeString(t.added_sugars),
    barcode: normalizeString(t.barcode),
    brand_lower: toLowerOrEmpty(t.brand_name),
    brand_name: normalizeString(t.brand_name),
    calcium: normalizeString(t.calcium),
    calories: normalizeString(t.calories),
    carbohydrate: normalizeString(t.carbohydrate),
    cholesterol: normalizeString(t.cholesterol),
    fat: normalizeString(t.fat),
    fiber: normalizeString(t.fiber),
    food_name: normalizeString(t.food_name),
    ingredients: normalizeString(t.ingredients),
    iron: normalizeString(t.iron),
    monounsaturated_fat: normalizeString(t.monounsaturated_fat),
    name_lower: toLowerOrEmpty(t.food_name),
    polyunsaturated_fat: normalizeString(t.polyunsaturated_fat),
    potassium: normalizeString(t.potassium),
    protein: normalizeString(t.protein),
    saturated_fat: normalizeString(t.saturated_fat),
    serving: normalizeString(t.serving),
    serving_amount: normalizeString(t.serving_amount),
    sodium: normalizeString(t.sodium),
    sugar: normalizeString(t.sugar),
    trans_fat: normalizeString(t.trans_fat),
    vitamin_d: normalizeString(t.vitamin_d),
    warning: normalizeString(t.warning),
    _source: "ticket",
    _sourceTicketId: (t as any).id ?? "",
    _publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

export const reviewTicket = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAdmin(request.auth);

    const data = (request.data || {}) as ReviewTicketInput;
    const { ticketId, action } = data;
    if (!ticketId || typeof ticketId !== "string") {
      throw new HttpsError("invalid-argument", "ticketId required.");
    }
    if (!["approve", "deny", "saveEdits"].includes(action)) {
      throw new HttpsError("invalid-argument", "Invalid action.");
    }

    const ticketRef = db.collection("ProductTickets").doc(ticketId);
    const snap = await ticketRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Ticket not found.");
    }
    const ticket = snap.data() as TicketDoc;

    if (ticket.status !== "open") {
      throw new HttpsError("failed-precondition", "Ticket is not open.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    const safeEdits = sanitizeEdits(data.edits);
    const reviewerNotes = normalizeString(data.notes);

    const eventRef = ticketRef.collection("events").doc();
    batch.set(eventRef, {
      at: now,
      action,
      adminUid: request.auth!.uid,
      adminEmail: request.auth!.token.email ?? null,
      edits: safeEdits,
      notes: reviewerNotes || null,
    });

    if (action === "saveEdits") {
      batch.update(ticketRef, {
        ...safeEdits,
        updatedAt: now,
        reviewerNotes: reviewerNotes || admin.firestore.FieldValue.delete(),
      });
      await batch.commit();
      return { ok: true, action, ticketId };
    }

    if (action === "deny") {
      const archiveRef = db.collection("ProductTickets_Archive").doc(ticketId);
      batch.set(archiveRef, {
        ...ticket,
        ...safeEdits,
        status: "rejected",
        reviewerNotes: reviewerNotes || ticket.reviewerNotes || "",
        archivedAt: now,
        reviewedBy: request.auth!.uid,
      });
      batch.delete(ticketRef);
      await batch.commit();
      return { ok: true, action, ticketId };
    }

    // approve
    const merged: TicketDoc & { id: string } = {
      ...ticket,
      ...safeEdits,
      id: ticketId,
      status: "approved",
      reviewerNotes: reviewerNotes || ticket.reviewerNotes || "",
      updatedAt: now as any,
    };

    const product = ticketToProductFields(merged);
    const candidateId = product.barcode?.replace(/\s+/g, "") || undefined;
    const productsRef = candidateId
      ? db.collection("Products").doc(candidateId)
      : db.collection("Products").doc();

    batch.set(productsRef, product, { merge: true });

    const archiveRef = db.collection("ProductTickets_Archive").doc(ticketId);
    batch.set(archiveRef, {
      ...merged,
      archivedAt: now,
      reviewedBy: request.auth!.uid,
      publishedProductId: productsRef.id,
    });

    batch.delete(ticketRef);
    await batch.commit();

    return { ok: true, action, ticketId, productId: productsRef.id };
  }
);
