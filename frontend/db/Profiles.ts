import AsyncStorage from '@react-native-async-storage/async-storage';

export type Profile = {
  name: string;
  allergens: string[];
};

const PROFILES_KEY = 'profiles';

/**
 * Load all saved profiles.
 */
export const getProfiles = async (): Promise<Profile[]> => {
  try {
    const json = await AsyncStorage.getItem(PROFILES_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Failed to load profiles', error);
    return [];
  }
};

/**
 * Save the full list of profiles.
 */
export const saveAllProfiles = async (profiles: Profile[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('Failed to save profiles', error);
  }
};

/**
 * Add a new profile.
 */
export const addProfile = async (newProfile: Profile): Promise<void> => {
  const profiles = await getProfiles();
  profiles.push(newProfile);
  await saveAllProfiles(profiles);
};

/**
 * Update a profile by name.
 */
export const updateProfile = async (
  name: string,
  updatedData: Partial<Profile>
): Promise<void> => {
  const profiles = await getProfiles();
  const updatedProfiles = profiles.map(p =>
    p.name === name ? { ...p, ...updatedData } : p
  );
  await saveAllProfiles(updatedProfiles);
};

/**
 * Delete a profile by name.
 */
export const deleteProfile = async (name: string): Promise<void> => {
  const profiles = await getProfiles();
  const updated = profiles.filter(p => p.name !== name);
  await saveAllProfiles(updated);
};

/**
 * Clear all saved profiles.
 */
export const clearAllProfiles = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROFILES_KEY);
  } catch (error) {
    console.error('Failed to clear all profiles', error);
  }
};
