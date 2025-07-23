import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Builds the storage key for a given profile.
 */
const getKey = (profileName: string) => `options_${profileName}`;

/**
 * Save the full list of options for a profile.
 */
export const saveProfile = async (profileName: string, options: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(getKey(profileName), JSON.stringify(options));
  } catch (error) {
    console.error(`Failed to save options for ${profileName}`, error);
  }
};

/**
 * Retrieve the saved options for a profile.
 */
export const getProfiles = async (profileName: string): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(getKey(profileName));
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Failed to load options for ${profileName}`, error);
    return [];
  }
};

/**
 * Add a new option to the profile's list.
 */
export const addProfile = async (profileName: string, newOption: string): Promise<void> => {
  const currentOptions = await getProfiles(profileName);
  const updated = [...currentOptions, newOption];
  await saveProfile(profileName, updated);
};

/**
 * Update an existing option with a new value.
 */
export const updateProfile = async (
  profileName: string,
  oldOption: string,
  newOption: string
): Promise<void> => {
  const currentOptions = await getProfiles(profileName);
  const updated = currentOptions.map(opt => (opt === oldOption ? newOption : opt));
  await saveProfile(profileName, updated);
};

/**
 * Delete an option from the profile's list.
 */
export const deleteProfile = async (profileName: string, optionToDelete: string): Promise<void> => {
  const currentOptions = await getProfiles(profileName);
  const updated = currentOptions.filter(opt => opt !== optionToDelete);
  await saveProfile(profileName, updated);
};

/**
 * Clear all saved options for a profile.
 */
export const clearProfile = async (profileName: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(getKey(profileName));
  } catch (error) {
    console.error(`Failed to clear options for ${profileName}`, error);
  }
};
