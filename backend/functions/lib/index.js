"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewTicket = void 0;
// backend/functions/src/index.ts
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
function assertAdmin(auth) {
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    }
    if (auth.token?.admin !== true) {
        throw new https_1.HttpsError("permission-denied", "Admin only.");
    }
}
function normalizeString(s) {
    return (s ?? "").toString().trim();
}
function toLowerOrEmpty(s) {
    return normalizeString(s).toLowerCase();
}
function sanitizeEdits(raw) {
    if (!raw)
        return {};
    const e = {};
    const copyKeys = [
        "food_name", "brand_name", "barcode", "ingredients", "warning", "serving", "serving_amount",
        "calories", "fat", "saturated_fat", "trans_fat", "monounsaturated_fat", "polyunsaturated_fat",
        "cholesterol", "sodium", "carbohydrate", "sugar", "added_sugars", "fiber", "protein",
        "potassium", "calcium", "iron", "vitamin_d", "reviewerNotes"
    ];
    for (const k of copyKeys) {
        if (k in raw) {
            // @ts-expect-error index
            e[k] = normalizeString(raw[k]);
        }
    }
    if ("food_name" in e)
        e.name_lower = toLowerOrEmpty(e.food_name);
    if ("brand_name" in e)
        e.brand_lower = toLowerOrEmpty(e.brand_name);
    return e;
}
function ticketToProductFields(t) {
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
        _sourceTicketId: t.id ?? "",
        _publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
}
exports.reviewTicket = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    assertAdmin(request.auth);
    const data = (request.data || {});
    const { ticketId, action } = data;
    if (!ticketId || typeof ticketId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "ticketId required.");
    }
    if (!["approve", "deny", "saveEdits"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid action.");
    }
    const ticketRef = db.collection("ProductTickets").doc(ticketId);
    const snap = await ticketRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Ticket not found.");
    }
    const ticket = snap.data();
    if (ticket.status !== "open") {
        throw new https_1.HttpsError("failed-precondition", "Ticket is not open.");
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const safeEdits = sanitizeEdits(data.edits);
    const reviewerNotes = normalizeString(data.notes);
    const eventRef = ticketRef.collection("events").doc();
    batch.set(eventRef, {
        at: now,
        action,
        adminUid: request.auth.uid,
        adminEmail: request.auth.token.email ?? null,
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
            reviewedBy: request.auth.uid,
        });
        batch.delete(ticketRef);
        await batch.commit();
        return { ok: true, action, ticketId };
    }
    // approve
    const merged = {
        ...ticket,
        ...safeEdits,
        id: ticketId,
        status: "approved",
        reviewerNotes: reviewerNotes || ticket.reviewerNotes || "",
        updatedAt: now,
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
        reviewedBy: request.auth.uid,
        publishedProductId: productsRef.id,
    });
    batch.delete(ticketRef);
    await batch.commit();
    return { ok: true, action, ticketId, productId: productsRef.id };
});
