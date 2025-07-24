import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase; // Declare db at the top

export const initDB = async () => {
  db = await SQLite.openDatabaseAsync('history');

  try {
    await db.execAsync('DROP TABLE IF EXISTS history;');
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food_name TEXT UNIQUE,
        allergens TEXT,
        match TEXT,
        timestamp INTEGER
      );`
    );
    console.log('[Setup] History table created successfully');
  } catch (error) {
    console.error('[Setup] Error creating history table:', error);
  }
};

export const saveToHistory = async (
  foodName: string,
  allergens: string,
  match: string
) => {
  const timestamp = Date.now();
  if (!db) {
    console.warn('[Save] DB not initialized');
    return;
  }

  try {
    await db.runAsync(
      'INSERT INTO history (food_name, allergens, match, timestamp) VALUES (?, ?, ?, ?)',
      [foodName, allergens, match, timestamp]
    );
    console.log('[Save] Insert successful');
  } catch (error:any) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        console.log('[Save] Duplicate entry detected, skipping insert');
    } else {
      console.error('[Save] Error inserting into history:', error);
  }}
};

export const getHistory = async () => {
  if (!db) return [];
  try {
    return await db.getAllAsync('SELECT * FROM history ORDER BY timestamp DESC');
  } catch (error) {
    console.error('[Get] Error fetching history:', error);
    return [];
  }
};

export const clearHistory = async () => {
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM history');
    console.log('[Clear] History cleared');
  } catch (error) {
    console.error('[Clear] Error clearing history:', error);
  }
};

export const deleteHistoryItem = async (id: number) => {
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM history WHERE id = ?', [id]);
    console.log('[Delete] Item deleted');
  } catch (error) {
    console.error('[Delete] Error deleting item:', error);
  }
};
