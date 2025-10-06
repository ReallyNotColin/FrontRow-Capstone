// db/compare.ts
// Unified compare helpers used by scan & search

export type ProductDoc = {
  // label fields
  food_name: string;
  brand_name: string;
  barcode?: string;

  // text we scan for allergens/intolerances
  ingredients?: string;
  warning?: string;

  // nutrition (strings; grams assumed if no unit)
  calories?: string;
  fat?: string;
  saturated_fat?: string;
  trans_fat?: string;
  cholesterol?: string; // mg or g handled
  sodium?: string;      // mg or g handled
  carbohydrate?: string;
  sugar?: string;
  added_sugars?: string;
  fiber?: string;
  protein?: string;
  potassium?: string;   // mg/g handled
  calcium?: string;     // mg/g handled
  iron?: string;        // mg/g handled
  vitamin_d?: string;   // mcg/µg or IU-ish (we treat mcg-ish)
};

export type ProfileData = {
  allergens: string[];
  intolerances: string[];
  dietary: string[]; // e.g. ["High-Fat", "High-Sodium"]
};

// ---------- Normalization & parsing helpers ----------
const normalize = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());

// naive unit parsing: returns grams-equivalent
function parseAmountToGramsLike(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (Number.isNaN(num)) return null;

  if (s.includes("mg")) return num / 1000;                // mg → g
  if (s.includes("mcg") || s.includes("μg")) return num / 1_000_000; // mcg → g
  if (s.includes("g")) return num;                         // g
  return num; // assume grams
}

// ---------- Synonyms ----------
const SYNONYMS: Record<string, string[]> = {
  milk: ["dairy", "lactose", "casein", "whey"],
  lactose: ["milk", "whey", "casein"],
  egg: ["albumen", "egg white", "egg yolk"],
  gluten: ["wheat", "barley", "rye", "malt"],
  nuts: ["almond", "walnut", "pecan", "hazelnut", "cashew", "pistachio"],
  peanuts: ["peanut", "groundnut", "arachis"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish"],
  soy: ["soya", "soybean", "lecithin (soy)", "soy lecithin"],
  sesame: ["tahini", "sesamum"],
  fish: ["salmon", "tuna", "cod", "anchovy", "sardine"],
};

function expandTerms(userTerms: string[] = []): string[] {
  const out = new Set<string>();
  for (const raw of userTerms) {
    const key = normalize(raw);
    if (!key) continue;
    out.add(key);
    const syns = SYNONYMS[key] || [];
    for (const s of syns) out.add(normalize(s));
  }
  return Array.from(out);
}

// ---------- Dietary thresholds ----------
const DIET_THRESHOLDS_GRAMS: Record<string, number> = {
  "high-fat": 17,          // g per serving
  "high-saturated": 5,     // g
  "high-sugar": 22.5,      // g
  "high-sodium": 0.6,      // g (600 mg)
  "high-carbohydrates": 45,// g
  "high-protein": 20,      // g
  "high-fiber": 6,         // g
  "high-potassium": 1.0,   // g (1000 mg)
  "high-calcium": 0.26,    // g (260 mg)
  "high-iron": 0.018,      // g (18 mg)
  "high-cholesterol": 0.3, // g (300 mg)
};

function dietKey(s: string) {
  return normalize(s).replace(/\s+/g, "-"); // "High Fat" -> "high-fat"
}

// ---------- Public: build product doc from Firestore data ----------
export function buildProductFromFirestoreDoc(d: any): ProductDoc {
  return {
    food_name: (d.food_name ?? "").toString(),
    brand_name: (d.brand_name ?? "").toString(),
    barcode: (d.barcode ?? "").toString(),

    ingredients: (d.ingredients ?? "").toString(),
    warning: (d.warning ?? "").toString(),

    calories: (d.calories ?? "").toString(),
    fat: (d.fat ?? "").toString(),
    saturated_fat: (d.saturated_fat ?? "").toString(),
    trans_fat: (d.trans_fat ?? "").toString(),
    cholesterol: (d.cholesterol ?? "").toString(),
    sodium: (d.sodium ?? "").toString(),
    carbohydrate: (d.carbohydrate ?? "").toString(),
    sugar: (d.sugar ?? "").toString(),
    added_sugars: (d.added_sugars ?? "").toString(),
    fiber: (d.fiber ?? "").toString(),
    protein: (d.protein ?? "").toString(),
    potassium: (d.potassium ?? "").toString(),
    calcium: (d.calcium ?? "").toString(),
    iron: (d.iron ?? "").toString(),
    vitamin_d: (d.vitamin_d ?? "").toString(),
  };
}

// ---------- Core compare ----------
export function compareProductToProfile(product: ProductDoc, profile: ProfileData) {
  const hay = normalize(
    [product.ingredients, product.warning, product.food_name, product.brand_name]
      .filter(Boolean)
      .join(" | ")
  );

  // Expand terms & find hits
  const allergenTerms = expandTerms(profile.allergens);
  const intoleranceTerms = expandTerms(profile.intolerances);

  const allergenHitsRaw = allergenTerms.filter((t) => t && hay.includes(t));
  const intoleranceHitsRaw = intoleranceTerms.filter((t) => t && hay.includes(t));

  // Unique + title-case for display
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  const allergenHits = uniq(allergenHitsRaw).map(titleCase);
  const intoleranceHits = uniq(intoleranceHitsRaw).map(titleCase);

  // Dietary evaluation
  const grams = {
    fat: parseAmountToGramsLike(product.fat),
    saturated_fat: parseAmountToGramsLike(product.saturated_fat),
    sugar: parseAmountToGramsLike(product.sugar),
    sodium: parseAmountToGramsLike(product.sodium),
    carbohydrate: parseAmountToGramsLike(product.carbohydrate),
    protein: parseAmountToGramsLike(product.protein),
    fiber: parseAmountToGramsLike(product.fiber),
    potassium: parseAmountToGramsLike(product.potassium),
    calcium: parseAmountToGramsLike(product.calcium),
    iron: parseAmountToGramsLike(product.iron),
    cholesterol: parseAmountToGramsLike(product.cholesterol),
  };

  const FIELD_MAP: Record<string, keyof typeof grams> = {
    "high-fat": "fat",
    "high-saturated": "saturated_fat",
    "high-sugar": "sugar",
    "high-sodium": "sodium",
    "high-carbohydrates": "carbohydrate",
    "high-protein": "protein",
    "high-fiber": "fiber",
    "high-potassium": "potassium",
    "high-calcium": "calcium",
    "high-iron": "iron",
    "high-cholesterol": "cholesterol",
  };

  const requested = new Set(profile.dietary.map(dietKey));
  const dietaryFindings: { key: string; value: number; threshold: number }[] = [];

  for (const key of requested) {
    const field = FIELD_MAP[key];
    const threshold = DIET_THRESHOLDS_GRAMS[key];
    if (!field || threshold == null) continue;
    const val = grams[field];
    if (val != null && val >= threshold) {
      dietaryFindings.push({ key, value: val, threshold });
    }
  }

  // Build summary strings suited for UI/history
  const dietarySummary = dietaryFindings.map((f) =>
    `${titleCase(f.key.replace(/-/g, " "))}: ${f.value} g (≥ ${f.threshold} g)`
  );

  return {
    hasIssues: allergenHits.length > 0 || intoleranceHits.length > 0 || dietaryFindings.length > 0,
    details: {
      allergenHitsRaw,
      intoleranceHitsRaw,
      dietaryFindings,
    },
    summary: {
      allergens: allergenHits,           // ["Milk", "Wheat"]
      intolerances: intoleranceHits,     // ["Lactose"]
      dietary: dietarySummary,           // ["High Sodium: 0.8 g (≥ 0.6 g)"]
    },
  };
}
