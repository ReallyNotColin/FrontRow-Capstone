// backend/functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
// 🔽 NEW: Google Cloud Vision client for OCR
import { ImageAnnotatorClient } from "@google-cloud/vision";
admin.initializeApp();
const db = admin.firestore();
// Initialize a single Vision client instance (uses default service account)
const vision = new ImageAnnotatorClient();
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


/* ------------------------- NEW: OCR callable (Vision) ------------------------- */

/**
 * Callable: scanNutritionFromImage
 * Input: { imageBase64: string }
 * Output: { rawText: string, fields: Partial<TicketDoc> }
 *
 * Notes:
 * - Uses DOCUMENT_TEXT_DETECTION for dense text (nutrition labels).
 * - Keep payloads reasonable (consider resizing on-device).
 */
export const scanNutritionFromImage = onCall(
  { region: "us-central1", cors: true, maxInstances: 5 },
  async (request) => {
    try {
      const imageBase64 = request.data?.imageBase64 as string | undefined;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        throw new HttpsError("invalid-argument", "imageBase64 is required.");
      }

      // OCR
      const [result] = await vision.documentTextDetection({
        image: { content: Buffer.from(imageBase64, "base64") },
      });

      const rawText: string = result.fullTextAnnotation?.text ?? "";
      if (!rawText) {
        return { rawText: "", fields: {} };
      }

    // --- Heuristic parsing (improved for per-serving vs per-container) ---
    /**
     * Strategy
     * 1) Normalize common OCR issues (O->0 before units/percents).
     * 2) Collapse spaces, keep newlines to keep row structure.
     * 3) For each label, grab the **first** numeric+unit occurrence
     *    after the label (that corresponds to "Per serving" on US labels).
     */

    function normalizeOcr(s: string) {
      // Fix "Og"/"Omg"/"Om cg" type mistakes and % DV zeros
      let t = s
        .replace(/(?<=\s|^)[Oo](?=\s*%)/g, "0")        // "O%" -> "0%"
        .replace(/(?<=\s|^)O(?=\s*g\b)/g, "0")        // "Og" -> "0g"
        .replace(/(?<=\s|^)O(?=\s*mg\b)/g, "0")       // "Omg" -> "0mg"
        .replace(/(?<=\s|^)O(?=\s*mcg\b)/g, "0")      // "Omcg" -> "0mcg"
        .replace(/(?<=\s|^)O(?=\s*IU\b)/g, "0");      // "OIU" -> "0 IU"
      // Standardize “Total Carb.” vs “Total Carbohydrate”
      t = t.replace(/Total\s*Carb\./gi, "Total Carbohydrate");
      return t;
    }

    const text = normalizeOcr(rawText || "")
      .replace(/[^\S\r\n]+/g, " ") // collapse spaces but keep newlines
      .trim();

    function firstNumberAfter(label: RegExp, units?: string[]) {
      // Find the label, then the first number (optionally with unit) that follows.
      const idx = text.search(label);
      if (idx === -1) return "";
      const slice = text.slice(idx); // from label onward (captures per-serving first)
      // number like "<1", "1", "1.2"
      const num = "(?:<\\s*1|\\d+(?:\\.\\d+)?)";
      const unit = units && units.length ? `\\s*(?:${units.join("|")})\\b` : "";
      const re = new RegExp(`${num}${unit}`, "i");
      const m = slice.match(re);
      return m?.[0] ?? "";
    }

    function coerceNumberStr(s: string): string {
      if (!s) return "";
      const trimmed = s.replace(/\s+/g, "");
      if (/^<\s*1$/i.test(trimmed) || /^<1/.test(trimmed)) return "0.5"; // normalize "<1" → "0.5"
      // strip units if somehow included
      const n = trimmed.replace(/(mg|mcg|g|iu)$/i, "");
      return n;
    }

    const fields: any = {};

    // Calories usually appear as a bare number; take the first after "Calories"
    fields.calories = coerceNumberStr(firstNumberAfter(/Calories/i));

    // Fats
    fields.fat                = coerceNumberStr(firstNumberAfter(/Total\s*Fat/i, ["g"]));
    fields.saturated_fat      = coerceNumberStr(firstNumberAfter(/Saturated\s*Fat/i, ["g"]));
    fields.trans_fat          = coerceNumberStr(firstNumberAfter(/Trans\s*Fat/i, ["g"]));
    fields.monounsaturated_fat= coerceNumberStr(firstNumberAfter(/Monounsaturated\s*Fat/i, ["g"]));
    fields.polyunsaturated_fat= coerceNumberStr(firstNumberAfter(/Polyunsaturated\s*Fat/i, ["g"]));

    // Cholesterol / Sodium
    fields.cholesterol = coerceNumberStr(firstNumberAfter(/Cholesterol/i, ["mg"]));
    fields.sodium      = coerceNumberStr(firstNumberAfter(/Sodium/i, ["mg"]));

    // Carbs + Fiber + Sugars
    fields.carbohydrate = coerceNumberStr(firstNumberAfter(/Total\s*Carbohydrate/i, ["g"]));
    fields.fiber        = coerceNumberStr(firstNumberAfter(/Dietary\s*Fiber|Fiber/i, ["g"]));

    /**
     * Sugars lines can be:
     *   "Total Sugars <1g" and "Incl. Added Sugars 0g"
     * Take the first number after "Total Sugars" and after "Added Sugars".
     */
    fields.sugar         = coerceNumberStr(firstNumberAfter(/Total\s*Sugars/i, ["g"]));
    fields.added_sugars  = coerceNumberStr(firstNumberAfter(/Added\s*Sugars/i, ["g"]));

    // Protein
    fields.protein   = coerceNumberStr(firstNumberAfter(/Protein/i, ["g"]));

    // Vitamins & Minerals
    fields.vitamin_d = coerceNumberStr(firstNumberAfter(/Vitamin\s*D/i, ["mcg", "IU", "iu", "MCG"]));
    fields.calcium   = coerceNumberStr(firstNumberAfter(/Calcium/i, ["mg"]));
    fields.iron      = coerceNumberStr(firstNumberAfter(/Iron/i, ["mg"]));
    fields.potassium = coerceNumberStr(firstNumberAfter(/Potassium/i, ["mg"]));

    // Serving
    {
      const m =
        text.match(/Serving\s*size\s*([^\n]+)/i) ||
        text.match(/Serving\s*size[:\s]*([^\n]+)/i);
      fields.serving = m ? m[1].trim() : "";
    }

    // Servings per container (robust for "3 servings per container")
    {
      // Try strict “servings per container: <…>”
      let m = text.match(/servings?\s*per\s*container[:\s]*([^\n]+)/i);
      let amt = m ? m[1] : "";

      // If not captured, search anywhere for "<number> servings per container"
      if (!amt) {
        m = text.match(/(\d+(?:\.\d+)?)\s*servings?\s*per\s*container/i);
        amt = m ? m[1] : "";
      }

      fields.serving_amount = (amt || "").toString().replace(/[^\d.]/g, "").trim();
    }


    // Ingredients / allergen warnings (not present in this label, but keep)
    {
      const ing =
        text.match(/ingredients?[:\s]*([\s\S]*?)(?:\n\n|may contain|contains|allergens?)/i) ||
        text.match(/ingredients?[:\s]*([\s\S]*)$/i);
      fields.ingredients = ing ? ing[1].replace(/\s+/g, " ").trim() : "";

      const warn =
        text.match(/(may contain|contains)[:\s]*([^\n]+)/i) ||
        text.match(/allergens?[:\s]*([^\n]+)/i);
      fields.warning = warn
        ? (warn[2] || warn[1]).replace(/^(may contain|contains)[:\s]*/i, "").trim()
        : "";
    }

    return { rawText, fields };
    } catch (err: any) {
      // Convert unknown errors to HttpsError for consistent client handling
      const message = err?.message || "OCR failed";
      throw new HttpsError("internal", message);
    }
  }
);