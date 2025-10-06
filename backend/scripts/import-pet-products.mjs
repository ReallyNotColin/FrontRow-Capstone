// backend/scripts/import-pet-products.mjs
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

/**
 * USAGE:
 *   node backend/scripts/import-pet-products.mjs backend/data/pet_products_with_lower.json
 *
 * ENV:
 *   GOOGLE_APPLICATION_CREDENTIALS=<abs path to your service-account.json>
 *   (Optional) FIREBASE_PROJECT_ID=<your-project-id>
 */

function must(v, msg) {
  if (!v) throw new Error(msg);
  return v;
}

const jsonPath = must(process.argv[2], "Path to JSON is required as argv[2]");
const abs = path.resolve(jsonPath);
if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

const serviceApp = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID, // optional
});
const db = admin.firestore();

// minor helpers
const norm = (s) => (s ?? "").toString().trim();
const normLower = (s) => norm(s).toLowerCase();
const normBarcode = (s) => norm(s).replace(/\s+/g, ""); // remove spaces, keep leading zeros

/** Validate minimal fields; return cleaned doc + id */
function prepareDoc(raw) {
  // Required (you can relax these if needed)
  const food_name = norm(raw.food_name);
  const brand_name = norm(raw.brand_name);
  const barcode = normBarcode(raw.barcode); // may be empty

  if (!food_name || !brand_name) {
    return { skip: true, reason: "Missing food_name or brand_name" };
  }

  // Build the document as-is, but normalized where it matters.
  // You can add more normalization here if you want.
  const doc = {
    type_pet: norm(raw.type_pet),
    lifestage: norm(raw.lifestage),
    food_type: norm(raw.food_type),
    brand_name,
    pack_name: norm(raw.pack_name),
    food_name,
    barcode, // keep normalized
    ingredients: norm(raw.ingredients),
    calories: norm(raw.calories),
    protein: norm(raw.protein),
    carbohydrate: norm(raw.carbohydrate),
    fat: norm(raw.fat),
    fiber: norm(raw.fiber),
    ash: norm(raw.ash),
    taurine: norm(raw.taurine),
    AAFCO_alligned: norm(raw.AAFCO_alligned),

    // keep your *_lower fields if present, or derive them
    name_lower: normLower(raw.name_lower || raw.food_name),
    brand_lower: normLower(raw.brand_lower || raw.brand_name),
    pack_lower: normLower(raw.pack_lower || raw.pack_name),

    _importedAt: admin.firestore.FieldValue.serverTimestamp(),
    _source: "bulk-import",
  };

  // Choose ID: prefer barcode if non-empty; else auto.
  const id = barcode || undefined;
  return { skip: false, id, doc };
}

async function main() {
  const text = fs.readFileSync(abs, "utf8");
  /** @type {Array<Record<string, any>>} */
  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error("JSON root must be an array");

  const writer = db.bulkWriter();
  let ok = 0, skipped = 0, failed = 0;

  writer.onWriteError((err) => {
    console.error("Write error:", err);
    // returning false will stop retries; here we let the SDK retry default times
    return true;
  });

  for (const raw of items) {
    const { skip, reason, id, doc } = prepareDoc(raw);
    if (skip) {
      skipped++;
      console.warn("[SKIP]", reason, raw?.food_name || raw?.barcode || "");
      continue;
    }
    const ref = id
      ? db.collection("PetProducts").doc(id)
      : db.collection("PetProducts").doc();
    writer.set(ref, doc, { merge: true });
    ok++;
  }

  await writer.close();
  console.log(`Done. Imported: ${ok}, Skipped: ${skipped}, Failed (reported via handler): ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
