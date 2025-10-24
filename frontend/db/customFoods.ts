// db/customFoods.ts
import * as SQLite from "expo-sqlite";

// If your app already imports from 'expo-sqlite/next', keep it consistent.
// The async API used below is supported by modern expo-sqlite.

let customDb: SQLite.SQLiteDatabase;

export const getCustomDb = () => customDb;

export type CustomEntryRecord = {
  // identity
  food_name: string;
  brand_name: string;
  barcode: string;

  // text
  ingredients: string;
  warning: string;

  // serving
  serving: string;
  serving_amount: string;

  // nutrition
  calories: string;
  fat: string;
  saturated_fat: string;
  trans_fat: string;
  monounsaturated_fat: string;
  polyunsaturated_fat: string;
  cholesterol: string;
  sodium: string;
  carbohydrate: string;
  sugar: string;
  added_sugars: string;
  fiber: string;
  protein: string;
  potassium: string;
  calcium: string;
  iron: string;
  vitamin_d: string;

  // derived
  name_lower: string;
  brand_lower: string;
};

export const initCustomDb = async () => {
  if (customDb) return;
  customDb = await SQLite.openDatabaseAsync("customFoods");

  // Base table (create if not exists)
  await customDb.execAsync(`
    CREATE TABLE IF NOT EXISTS custom_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      created_at INTEGER
    );
  `);

  // Ensure all columns exist (idempotent). Some SQLite builds support IF NOT EXISTS;
  // for safety, we try and ignore "duplicate column" errors.
  const addCols = [
    ["brand_name", "TEXT"],
    ["ingredients", "TEXT"],
    ["warning", "TEXT"],
    ["serving", "TEXT"],
    ["serving_amount", "TEXT"],
    ["calories", "TEXT"],
    ["fat", "TEXT"],
    ["saturated_fat", "TEXT"],
    ["trans_fat", "TEXT"],
    ["monounsaturated_fat", "TEXT"],
    ["polyunsaturated_fat", "TEXT"],
    ["cholesterol", "TEXT"],
    ["sodium", "TEXT"],
    ["carbohydrate", "TEXT"],
    ["sugar", "TEXT"],
    ["added_sugars", "TEXT"],
    ["fiber", "TEXT"],
    ["protein", "TEXT"],
    ["potassium", "TEXT"],
    ["calcium", "TEXT"],
    ["iron", "TEXT"],
    ["vitamin_d", "TEXT"],
    ["name_lower", "TEXT"],
    ["brand_lower", "TEXT"]
  ] as const;

  for (const [col, type] of addCols) {
    try {
      await customDb.execAsync(`ALTER TABLE custom_entries ADD COLUMN ${col} ${type}`);
    } catch (e: any) {
      // Ignore if column already exists
      if (!/duplicate column|already exists/i.test(String(e?.message ?? e))) {
        console.warn(`[CustomDB] add column ${col} failed:`, e);
      }
    }
  }
};

// Simple text normalizer used by search
export const normalizeString = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/['’&]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Upsert by (barcode, name_lower) to avoid naive duplicates
export const upsertCustomEntry = async (rec: CustomEntryRecord) => {
  if (!customDb) await initCustomDb();

  const now = Date.now();

  // Try update
  const updateSql = `
    UPDATE custom_entries SET
      food_name=?,
      brand_name=?,
      ingredients=?,
      warning=?,
      serving=?,
      serving_amount=?,
      calories=?,
      fat=?,
      saturated_fat=?,
      trans_fat=?,
      monounsaturated_fat=?,
      polyunsaturated_fat=?,
      cholesterol=?,
      sodium=?,
      carbohydrate=?,
      sugar=?,
      added_sugars=?,
      fiber=?,
      protein=?,
      potassium=?,
      calcium=?,
      iron=?,
      vitamin_d=?,
      name_lower=?,
      brand_lower=?,
      created_at=COALESCE(created_at, ?)
    WHERE barcode=? AND name_lower=?;
  `;

  const updateArgs = [
    rec.food_name,
    rec.brand_name,
    rec.ingredients,
    rec.warning,
    rec.serving,
    rec.serving_amount,
    rec.calories,
    rec.fat,
    rec.saturated_fat,
    rec.trans_fat,
    rec.monounsaturated_fat,
    rec.polyunsaturated_fat,
    rec.cholesterol,
    rec.sodium,
    rec.carbohydrate,
    rec.sugar,
    rec.added_sugars,
    rec.fiber,
    rec.protein,
    rec.potassium,
    rec.calcium,
    rec.iron,
    rec.vitamin_d,
    rec.name_lower,
    rec.brand_lower,
    now,
    rec.barcode,
    rec.name_lower,
  ];

  const { changes } = await customDb.runAsync(updateSql, updateArgs as any);
  if (changes && changes > 0) return; // updated

  // Insert
  const insertSql = `
    INSERT INTO custom_entries (
      food_name, brand_name, barcode, ingredients, warning,
      serving, serving_amount,
      calories, fat, saturated_fat, trans_fat, monounsaturated_fat, polyunsaturated_fat,
      cholesterol, sodium, carbohydrate, sugar, added_sugars, fiber, protein,
      potassium, calcium, iron, vitamin_d,
      name_lower, brand_lower, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
  `;
  const insertArgs = [
    rec.food_name,
    rec.brand_name,
    rec.barcode,
    rec.ingredients,
    rec.warning,
    rec.serving,
    rec.serving_amount,
    rec.calories,
    rec.fat,
    rec.saturated_fat,
    rec.trans_fat,
    rec.monounsaturated_fat,
    rec.polyunsaturated_fat,
    rec.cholesterol,
    rec.sodium,
    rec.carbohydrate,
    rec.sugar,
    rec.added_sugars,
    rec.fiber,
    rec.protein,
    rec.potassium,
    rec.calcium,
    rec.iron,
    rec.vitamin_d,
    rec.name_lower,
    rec.brand_lower,
    now,
  ];
  await customDb.runAsync(insertSql, insertArgs as any);
};

// Existing helpers kept intact (search/delete) – adapt if you want to use more fields in search.
export const searchCustomEntries = async (query: string) => {
  if (!customDb) await initCustomDb();
  try {
    const tokens = normalizeString(query).split(/\s+/).filter(Boolean);
    const all = await customDb.getAllAsync("SELECT * FROM custom_entries");
    return all.filter((row: any) => {
      const hay = normalizeString(`${row.brand_name ?? ""} ${row.food_name ?? ""}`);
      return tokens.every((t) => hay.includes(t));
    });
  } catch (error) {
    console.error("[CustomDB] Token search failed:", error);
    return [];
  }
};

export const deleteCustomEntry = async (id: number) => {
  if (!customDb) await initCustomDb();
  try {
    await customDb.runAsync("DELETE FROM custom_entries WHERE id = ?", [id]);
  } catch (error) {
    console.error("[CustomDB] Failed to delete entry:", error);
  }
};
