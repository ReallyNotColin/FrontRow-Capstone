import * as SQLite from 'expo-sqlite';
import { normalizeString } from '@/utils/normalize';

let customDb: SQLite.SQLiteDatabase;
export const getCustomDb = () => customDb;

async function ensureColumns() {
  const info = await customDb.getAllAsync<{name: string}>(`PRAGMA table_info(custom_entries);`);
  const names = new Set(info.map(r => r.name));
  const add = async (col: string, type: string) =>
    customDb.execAsync(`ALTER TABLE custom_entries ADD COLUMN ${col} ${type};`);

  if (!names.has('ingredients')) await add('ingredients', 'TEXT');
  if (!names.has('warning')) await add('warning', 'TEXT');
  if (!names.has('manufacturer')) await add('manufacturer', 'TEXT');
  if (!names.has('contact')) await add('contact', 'TEXT');
  if (!names.has('nutrition_json')) await add('nutrition_json', 'TEXT');
}

export const initCustomDb = async () => {
  if (customDb) return;
  customDb = await SQLite.openDatabaseAsync('customFoods');
  await customDb.execAsync(`
    CREATE TABLE IF NOT EXISTS custom_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      allergens TEXT,
      created_at INTEGER
    );
  `);
  await ensureColumns();
};

export const searchCustomEntries = async (query: string) => {
  if (!customDb) await initCustomDb();
  try {
    const normalizedQuery = normalizeString(query);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const all = await customDb.getAllAsync('SELECT * FROM custom_entries');
    const filtered = all.filter((entry: any) => {
      const normalizedName = normalizeString(entry.food_name);
      return tokens.every((token: string) => normalizedName.includes(token));
    });
    return filtered;
  } catch (error) {
    console.error('[CustomDB] Token search failed:', error);
    return [];
  }
};

export const deleteCustomEntry = async (id: number) => {
  if (!customDb) await initCustomDb();
  try {
    await customDb.runAsync('DELETE FROM custom_entries WHERE id = ?', [id]);
    console.log(`Deleted custom entry with ID ${id}`);
  } catch (error) {
    console.error('[CustomDB] Failed to delete entry:', error);
  }
};
