// utils/compare.ts
export type ProductDoc = {
  id?: string;
  food_name?: string;       // "Strawberry Cheesecake Ice Cream - 16oz"
  ingredients?: string;     // free text
  warning?: string;         // "Wheat, Egg, Soy, Milk"
  // nutrition (strings in your DB; we'll parse numbers)
  calories?: string;
  fat?: string;
  saturated_fat?: string;
  trans_fat?: string;
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
};

export type SavedProfileUI = {
  allergens?: string[];     // e.g., ["Milk","Lactose","Egg",...]
  intolerances?: string[];  // e.g., ["Lactose","Gluten","Soy",...]
  dietary?: string[];       // e.g., ["High-Fat","High-Sodium",...]
};

export type CompareReason =
  | { type: "allergen"; term: string; matchedBy: "warning" | "ingredient" | "alias"; snippet?: string }
  | { type: "intolerance"; term: string; matchedBy: "ingredient" | "alias"; snippet?: string }
  | { type: "dietary"; term: string; field: string; value: number; unit: string; dv: number; percentDV: number; thresholdPercent: number };

export type CompareResult = {
  harmful: boolean;
  reasons: CompareReason[];
  summary: {
    allergens: string[];
    intolerances: string[];
    dietary: string[];
  };
};

/* -------------------- helpers -------------------- */
const lc = (s?: string | null) => (s ?? "").toLowerCase();
const asTokens = (s?: string | null) =>
  lc(s).replace(/[()]/g, " ").replace(/[^a-z0-9+&/,'\s-]/g, "").split(/[\s,;/]+/).filter(Boolean);
const commaList = (s?: string | null) => lc(s).split(",").map(x => x.trim()).filter(Boolean);
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};
const hasPhrase = (hay: string, needle: string) => hay.includes(needle.toLowerCase());

/* -------------------- synonyms -------------------- */
// “Nuts” means tree nuts in your UI; “Peanuts” is separate
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  milk: ["milk","cream","butter","ghee","cheese","yogurt","whey","casein","milkfat","skim milk"],
  egg: ["egg","egg yolk","albumen","ovalbumin"],
  soy: ["soy","soybean","soya","soy lecithin","edamame","tofu","tempeh"],
  wheat: ["wheat","semolina","spelt","graham","farina","durum"],
  gluten: ["wheat","barley","rye","malt","semolina","spelt","graham"],
  peanut: ["peanut","groundnut"],
  tree_nut: ["almond","walnut","pecan","hazelnut","cashew","pistachio","macadamia","brazil nut","pine nut"],
  sesame: ["sesame","tahini"],
  fish: ["fish","anchovy","salmon","tuna","cod","haddock","pollock"],
  shellfish: ["shrimp","prawn","lobster","crab","crayfish","scallop","clam","oyster","mussel"],
};

const INTOLERANCE_SYNONYMS: Record<string, string[]> = {
  lactose: ALLERGEN_SYNONYMS.milk, // lactose intolerance → any dairy term
  gluten: ALLERGEN_SYNONYMS.gluten,
  histamine: ["vinegar","yeast extract","soy sauce","fish sauce","sauerkraut","kimchi","fermented","cured"], // heuristic
  salicylate: ["wintergreen","mint","willow","balsam"], // heuristic (very approximate)
  soy: ALLERGEN_SYNONYMS.soy,
  corn: ["corn","corn starch","cornstarch","corn syrup","hfcs","high fructose corn syrup","dextrose","maltodextrin"],
  caffeine: ["caffeine","coffee","espresso","tea","matcha","yerba mate","guarana","cocoa","chocolate"],
  sulfite: ["sulfite","sulphite","sulfur dioxide","sodium metabisulfite","potassium metabisulfite"],
};

/* -------------------- %DV tables -------------------- */
// Units and Daily Values (FDA adults/children 4+; adjust as needed)
const DV: Record<string, { dv: number; unit: "g" | "mg" | "mcg" }> = {
  fat:            { dv: 78,   unit: "g"   },
  saturated_fat:  { dv: 20,   unit: "g"   },
  sodium:         { dv: 2300, unit: "mg"  },
  carbohydrate:   { dv: 275,  unit: "g"   },
  added_sugars:   { dv: 50,   unit: "g"   },
  fiber:          { dv: 28,   unit: "g"   },
  protein:        { dv: 50,   unit: "g"   },
  cholesterol:    { dv: 300,  unit: "mg"  },
  potassium:      { dv: 4700, unit: "mg"  },
  calcium:        { dv: 1300, unit: "mg"  },
  iron:           { dv: 18,   unit: "mg"  },
};

// Product field → base unit in your docs
const FIELD_UNITS: Record<string, "g" | "mg" | "mcg"> = {
  fat: "g",
  saturated_fat: "g",
  sodium: "mg",
  carbohydrate: "g",
  added_sugars: "g",
  sugar: "g",
  fiber: "g",
  protein: "g",
  cholesterol: "mg",
  potassium: "mg",
  calcium: "mg",
  iron: "mg",
};

function toDVUnit(field: string, value: number): number {
  const target = DV[field]?.unit;
  const source = FIELD_UNITS[field];
  if (!target || !source) return value;
  if (source === target) return value;
  if (source === "mg" && target === "g") return value / 1000;
  if (source === "g" && target === "mg") return value * 1000;
  if (source === "mcg" && target === "mg") return value / 1000;
  if (source === "mg" && target === "mcg") return value * 1000;
  if (source === "mcg" && target === "g") return value / 1_000_000;
  if (source === "g" && target === "mcg") return value * 1_000_000;
  return value;
}

/* -------------------- normalize UI strings -------------------- */
function uiAllergenToKey(s: string): string {
  const k = lc(s);
  if (k === "nuts") return "tree_nut";
  if (k === "peanuts") return "peanut";
  return k; // milk, egg, fish, gluten, shellfish, soy, sesame
}

function uiIntoleranceToKey(s: string): string {
  return lc(s); // lactose, gluten, histamine, salicylate, soy, corn, caffeine, sulfite
}

const DIETARY_TO_FIELD: Record<string, string[]> = {
  "high-fat": ["fat"],
  "high-sodium": ["sodium"],
  "high-sugar": ["added_sugars","sugar"], // prefer added_sugars; fallback sugar
  "high-potassium": ["potassium"],
  "high-cholesterol": ["cholesterol"],
  "high-carbohydrates": ["carbohydrate"],
  "high-calcium": ["calcium"],
  "high-iron": ["iron"],
  "high-protein": ["protein"],        // UI typo handled below
  "high-fiber": ["fiber"],
};

export function normalizeProfileFromUI(p: SavedProfileUI, strictnessThresholdPercent = 0.20) {
  const allergens = (p.allergens ?? []).map(uiAllergenToKey);
  const intolerances = (p.intolerances ?? []).map(uiIntoleranceToKey);
  const dietaryKeys = (p.dietary ?? []).map(s => lc(s))
    .map(s => s.replace(/\s+/g, "-"))
    .map(s => s.replace(/–/g, "-"));

  return { allergens, intolerances, dietaryKeys, strictnessThresholdPercent };
}

/* -------------------- compare -------------------- */
export function compareProductToProfile(product: ProductDoc, uiProfile: SavedProfileUI): CompareResult {
  const { allergens, intolerances, dietaryKeys, strictnessThresholdPercent } = normalizeProfileFromUI(uiProfile);

  const reasons: CompareReason[] = [];
  const ingText = lc(product.ingredients);
  const ingTokens = asTokens(product.ingredients);
  const warnings = commaList(product.warning);

  // 1) Allergens: warning first, then aliases in ingredients
  for (const a of allergens) {
    if (warnings.includes(a)) {
      reasons.push({ type: "allergen", term: a, matchedBy: "warning", snippet: a });
      continue;
    }
    const aliases = ALLERGEN_SYNONYMS[a] ?? [a];
    const hit = aliases.find(alias => ingTokens.includes(alias) || hasPhrase(ingText, alias));
    if (hit) reasons.push({ type: "allergen", term: a, matchedBy: "alias", snippet: hit });
  }

  // 2) Intolerances: aliases in ingredients (labels rarely list them)
  for (const it of intolerances) {
    const aliases = INTOLERANCE_SYNONYMS[it] ?? [it];
    const hit = aliases.find(alias => ingTokens.includes(alias) || hasPhrase(ingText, alias));
    if (hit) reasons.push({ type: "intolerance", term: it, matchedBy: "alias", snippet: hit });
  }

  // 3) Dietary: %DV per serving vs threshold
  const threshold = strictnessThresholdPercent;

  const checkField = (term: string, field: string) => {
    const dvInfo = DV[field];
    if (!dvInfo) return;
    const raw = num((product as any)[field]);
    if (raw == null) return;
    const normalized = toDVUnit(field, raw);
    const pctDV = normalized / dvInfo.dv;
    if (pctDV >= threshold) {
      reasons.push({
        type: "dietary",
        term,
        field,
        value: normalized,
        unit: dvInfo.unit,
        dv: dvInfo.dv,
        percentDV: pctDV,
        thresholdPercent: threshold,
      });
    }
  };

  for (const tag of dietaryKeys) {
    const fields = DIETARY_TO_FIELD[tag];
    if (!fields) continue;
    // Prefer the first available field (e.g., added_sugars over sugar)
    const available = fields.find(f => num((product as any)[f]) != null);
    if (available) checkField(tag, available);
  }

  const humanPct = (n: number) => `${Math.round(n * 100)}%`;

  const summary = {
    allergens: reasons.filter(r => r.type === "allergen").map(r => {
      const rr = r as Extract<CompareReason,{type:"allergen"}>;
      return `Allergen: ${rr.term} (via ${rr.matchedBy}${rr.snippet ? `: "${rr.snippet}"` : ""})`;
    }),
    intolerances: reasons.filter(r => r.type === "intolerance").map(r => {
      const rr = r as Extract<CompareReason,{type:"intolerance"}>;
      return `Intolerance: ${rr.term} (via ${rr.matchedBy}${rr.snippet ? `: "${rr.snippet}"` : ""})`;
    }),
    dietary: reasons.filter(r => r.type === "dietary").map(r => {
      const rr = r as Extract<CompareReason,{type:"dietary"}>;
      return `Dietary: ${rr.term} — ${rr.field} ${rr.value}${rr.unit} ≈ ${humanPct(rr.percentDV)} DV (≥ ${humanPct(rr.thresholdPercent)})`;
    }),
  };

  return { harmful: reasons.length > 0, reasons, summary };
}

/* Optional: helper to build from your Firestore doc */
export function buildProductFromFirestoreDoc(d: any): ProductDoc {
  return {
    food_name: d.food_name,
    ingredients: d.ingredients,
    warning: d.warning,
    calories: d.calories,
    fat: d.fat,
    saturated_fat: d.saturated_fat,
    trans_fat: d.trans_fat,
    cholesterol: d.cholesterol,
    sodium: d.sodium,
    carbohydrate: d.carbohydrate,
    sugar: d.sugar,
    added_sugars: d.added_sugars,
    fiber: d.fiber,
    protein: d.protein,
    potassium: d.potassium,
    calcium: d.calcium,
    iron: d.iron,
  };
}
