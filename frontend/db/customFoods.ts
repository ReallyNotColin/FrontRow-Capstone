import * as SQLite from 'expo-sqlite';

let customDb: SQLite.SQLiteDatabase;

export const initCustomDb = async () => {
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
};

import { normalizeString } from '@/utils/normalize';

export const searchCustomEntries = async (query: string) => {
  if (!customDb) await initCustomDb();

  try {
    const normalizedQuery = normalizeString(query);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean); // tokenize

    // Get all entries (we'll filter in JS)
    const all = await customDb.getAllAsync('SELECT * FROM custom_entries');

    // Filter by checking if every token is in the normalized food name
    const filtered = all.filter(entry => {
      const normalizedName = normalizeString(entry.food_name);
      return tokens.every(token => normalizedName.includes(token));
    });

    return filtered;
  } catch (error) {
    console.error('[CustomDB] Token search failed:', error);
    return [];
  }
};

