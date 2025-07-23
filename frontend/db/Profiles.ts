import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveProfile = async (profile: string, options: string[]) => {
  await AsyncStorage.setItem(`options_${profile}`, JSON.stringify(options));
};

export const getProfiles = async (profile: string): Promise<string[]> => {
  const data = await AsyncStorage.getItem(`options_${profile}`);
  return data ? JSON.parse(data) : [];
};

export const deleteProfile = async (profile: string, optionToRemove: string) => {
  const current = await getProfiles(profile);
  const updated = current.filter(opt => opt !== optionToRemove);
  await saveProfile(profile, updated);
};
