import AsyncStorage from '@react-native-async-storage/async-storage';

export type Profile = {
  name: string;
  allergens: string[];
};

export type GroupProfile = {
  groupName: string;
  members: Profile[];
};

const PROFILES_KEY = 'profiles';
const GROUPS_KEY = 'groups';
export const GROUP_KEY_PREFIX = 'group_';

export const getAllProfileData = async (): Promise<Record<string, string[]>> => {
  try {
    const raw = await AsyncStorage.getItem('profiles');
    const data = raw ? JSON.parse(raw) : {};
    return data;
  } catch (error) {
    console.error('Failed to load profile names', error);
    return {};
  }
}

/**
 * Save the entire profiles object.
 */
const saveAllProfileData = async (data: Record<string, string[]>): Promise<void> => {
  try {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save profiles data:', error);
  }
};

/**
 * Save a profile.
 */
export const saveProfile = async (profileName: string, options: string[]): Promise<void> => {
  const data = await getAllProfileData();
  data[profileName] = options;
  await saveAllProfileData(data);
};

/**
 * Get a single profile's options.
 */
export const getProfiles = async (profileName: string): Promise<string[]> => {
  const data = await getAllProfileData();
  return data[profileName] || [];
};

/**
 * Add a new option to a profile.
 */
export const addProfile = async (profileName: string, newOption: string): Promise<void> => {
  const data = await getAllProfileData();
  const currentOptions = data[profileName] || [];
  const updated = [...currentOptions, newOption];
  data[profileName] = updated;
  await saveAllProfileData(data);
};

/**
 * Update a specific option in a profile.
 */
export const updateProfile = async (
  profileName: string,
  oldOption: string,
  newOption: string
): Promise<void> => {
  const data = await getAllProfileData();
  const currentOptions = data[profileName] || [];
  const updated = currentOptions.map(opt => (opt === oldOption ? newOption : opt));
  data[profileName] = updated;
  await saveAllProfileData(data);
};

/**
 * Delete an option from a profile.
 */
export const deleteProfile = async (profileName: string, optionToDelete: string): Promise<void> => {
  const data = await getAllProfileData();
  const currentOptions = data[profileName] || [];
  const updated = currentOptions.filter(opt => opt !== optionToDelete);
  data[profileName] = updated;
  await saveAllProfileData(data);
};

/**
 * Clear all saved options for a specific profile.
 */
export const clearProfile = async (profileName: string): Promise<void> => {
  const data = await getAllProfileData();
  delete data[profileName];
  await saveAllProfileData(data);
};

/**
 * Get the list of all profile names.
 */
export const getAllProfileNames = async (): Promise<string[]> => {
  const data = await getAllProfileData();
  const data2 = Object.values(data);
  const names = data2.map(profile => profile.name);
  return names;
};


/**
 * Save a group profile consisting of multiple individual profile names.
 */
export const saveGroupProfile = async (groupName: string, profileNames: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${GROUPS_KEY}_${groupName}`, JSON.stringify(profileNames));

  } catch (error) {
    console.error(`Failed to save group profile '${groupName}':`, error);
  }
};

/**
 * Get a group profile's member profile names.
 */
export const getGroupMembers = async (groupName: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(`${GROUPS_KEY}_${groupName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(`Failed to get group profile '${groupName}':`, error);
    return [];
  }
};

/**
 * Get a list of all saved group profile names.
 */
export const getAllGroupProfileNames = async (): Promise<string[]> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys
      .filter(key => key.startsWith(GROUPS_KEY + '_'))
      .map(key => key.replace(GROUPS_KEY + '_', ''));
  } catch (error) {
    console.error('Failed to get all group profile names:', error);
    return [];
  }
};

/**
 * Delete a saved group profile.
 */
export const deleteGroupProfile = async (groupName: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${GROUPS_KEY}_${groupName}`);
  } catch (error) {
    console.error(`Failed to delete group profile '${groupName}':`, error);
  }
};

/**
 * Save the entire group profile object.
 */
const saveAllGroupData = async (data: Record<string, string[]>): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save group profile data:', error);
  }
};

export const getAllGroupData = async (): Promise<Record<string, string[]>> => {
  try {
    const raw = await AsyncStorage.getItem('groups');
    const data = raw ? JSON.parse(raw) : {};
    return data;
  } catch (error) {
    console.error('Failed to load group names', error);
    return {};
  }
}

/**
 * Save a profile.
 */
export const saveGroup = async (groupName: string, options: string[]): Promise<void> => {
  const data = await getAllGroupData();
  data[groupName] = options;
  await saveAllGroupData(data);
};