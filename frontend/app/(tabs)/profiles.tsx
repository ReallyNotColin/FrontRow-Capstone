import React, { useState, useEffect } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Platform, ScrollView, View, Text, Modal, TextInput, Pressable, FlatList, StyleSheet, TouchableOpacity, Animated, Button } from 'react-native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveProfile, getProfiles, deleteProfile, getAllProfileNames, saveGroupProfile, getGroupMembers, getAllGroupProfileNames } from '@/db/Profiles';



export default function Profile() {
  const [profileNameModalVisible, setprofileNameModalVisible] = useState(false);
  const [profileprofileTypeModalVisible, setprofileprofileTypeModalVisible] = useState(false);
  const [profileTypeModalVisible, setprofileTypeModalVisible] = useState(false);
  const [gProfileModalVisible, setgProfileModalVisible] = useState(false);
  
  const [profileName, setprofileName] = useState('');
  const [groupName, setgroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const [individualProfiles, setIndividualProfiles] = useState<string[]>([]);
  const [groupProfiles, setGroupProfiles] = useState<Record<string, string[]>>({});
  
  const [moveMenu] = useState(new Animated.Value(0));
  const [allergensMenu] = useState(new Animated.Value(0));
  const [tagSelected, setTagSelected] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<{ name: string; allergens: string[] }[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  const allergenCheckboxes = [
    'Milk',
    'Lactose',
    'Egg',
    'Fish',
    'Gluten',
    'Nuts',
    'Peanuts',
    'Shellfish',
    'Soy',
    'Sesame',
  ];

  const handleTagPress = () => {
    setTagSelected(true);
    Animated.sequence([
      Animated.timing(moveMenu, {
        toValue: -10,
        duration: 300,
        useNativeDriver: true,
    }),
    Animated.timing(allergensMenu, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }),
  ]).start();
  }

const saveProfile = async () => {
  try {
    const existing = await AsyncStorage.getItem('profiles');
    const profiles = existing ? JSON.parse(existing) : [];

    const newProfile = {
      name: profileName,
      allergens: selectedAllergens,
    };

    profiles.push(newProfile);
    await AsyncStorage.setItem('profiles', JSON.stringify(profiles));

    console.log('Profile saved:', newProfile);

    // Reset states and close modal
    setprofileprofileTypeModalVisible(false);
    setprofileName('');
    setSelectedAllergens([]);
    loadProfiles(); // refresh UI
  } catch (error) {
    console.error('Failed to save profile', error);
  }
};

const loadProfiles = async () => {
  try {
    const stored = await AsyncStorage.getItem('profiles');
    if (stored) {
      setSavedProfiles(JSON.parse(stored));
    } else {
      setSavedProfiles([]);
    }
  } catch (e) {
    console.error('Failed to load profiles', e);  
  }
};

const loadGroupProfiles = async () => {
  try {
    const names = await getAllGroupProfileNames();
    const profileMap: Record<string, string[]> = {};

    for (const name of names) {
      const members = await getGroupMembers(name);
      profileMap[name] = members;
    }

    setGroupProfiles(profileMap);
  } catch (error) {
    console.error('Failed to load group profiles:', error);
  }
};
useEffect(() => {
  const fetchProfiles = async () => {
    const names = await getAllProfileNames();
    setAvailableProfiles(names);
  };
  fetchProfiles();
}, []);

useEffect(() => {
  const fetchProfiles = async () => {
    const individuals = await getAllProfileNames();
    const groups = await getAllGroupProfileNames();
    setIndividualProfiles(individuals);
    setGroupProfiles(groups);
  };
  fetchProfiles();
}, []);

const handleSaveGroup = async () => {
  await saveGroupProfile(groupName, groupMembers);
  setgroupName('');
  setGroupMembers([]);
  setgProfileModalVisible(false);
  await loadGroupProfiles();
};

useEffect(() => {
  loadProfiles();
  loadGroupProfiles();
}, []);


  return (
    <View style={styles.container}>
      <View style={styles.container}>
      <ScrollView>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Profiles</ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <View style={styles.section}>
          
          <Text style={styles.sectionTitle}>Profiles</Text>
            {savedProfiles.length === 0 ? (
              <Text style={{ fontStyle: 'italic', marginLeft: 12 }}>No profiles saved yet.</Text>
            ) : (
              savedProfiles.map((profile, index) => (
                <View key={index} style={styles.card}>
                  <Text style={{ fontWeight: 'bold' }}>{profile.name}</Text>
                  {profile.allergens.length > 0 ? (
                    <Text style={{ marginTop: 4, fontSize: 14 }}>
                      Allergens: {profile.allergens.join(', ')}
                    </Text>
                  ) : (
                <Text style={{ fontStyle: 'italic', fontSize: 14 }}>No allergens selected</Text>
              )}
      </View>
    ))
  )}
      </View>

      {/* Group Profiles Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Profiles</Text>
        {Object.keys(groupProfiles).length === 0 ? (
          <Text style={{ fontStyle: 'italic' }}>No group profiles saved.</Text>
        ) : (
          Object.entries(groupProfiles).map(([groupName, members]) => (
            <View key={groupName} style={styles.groupContainer}>
              <Text style={styles.groupTitle}>{groupName}</Text>
              {Array.isArray(members) && members.length > 0 ? (
                members.map((memberName, index) => (
                  <Text key={`${groupName}-${index}`} style={styles.groupMemberText}>
                    • {memberName}
                  </Text>
                ))
              ) : (
                <Text style={{ marginLeft: 10, fontStyle: 'italic' }}>No members</Text>
              )}
            </View>
          ))
        )}
      </View>
      </ScrollView>

      {/* Button at the bottom end of flex layout */}
      <View style={styles.buttonContainer}>
        <Pressable onPress ={() => {setprofileTypeModalVisible(true)}} style={styles.button}>
        <Text style={styles.continueButtonText}>+</Text>
      </Pressable>
      </View>
    </View>
    
    <Modal transparent animationType="fade" visible={profileTypeModalVisible} onRequestClose={() => setprofileTypeModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create New</Text>
          <Pressable
            style={styles.optionButton}
            onPress={() => {
              setprofileNameModalVisible(true);
              setprofileTypeModalVisible(false);
            }}
          >
            <Text>Individual Profile</Text>
          </Pressable>
          <Pressable
            style={styles.optionButton}
            onPress={() => {
              setgProfileModalVisible(true);
              setprofileTypeModalVisible(false);
            }}
          >
            <Text>Group Profile</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
      
      <Modal visible={gProfileModalVisible} transparent animationType="slide" onRequestClose={() => setgProfileModalVisible(false)}>
        <View style={styles.overlay}>
            <View style={styles.modalContent}>
              <Text style={styles.title}>Create Group Profile</Text>
              <TextInput
                style={styles.input}
                placeholder="Group Name"
                value={groupName}
                onChangeText={setgroupName}
              />
              <Text style={styles.modalSubtitle}>Select Profiles to Include</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {individualProfiles.map((profile) => {
                    const isSelected = groupMembers.includes(profile);
                    return (
                      <TouchableOpacity
                        key={profile}
                        style={styles.checkboxRow}
                        onPress={() => {
                          setGroupMembers((prev) =>
                            isSelected
                              ? prev.filter((p) => p !== profile)
                              : [...prev, profile]
                          );
                        }}
                      >
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]} />
                        <Text style={styles.checkboxLabel}>{profile}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveGroup}>
                    <Text style={{ color: 'white' }}>Save Group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setgProfileModalVisible(false)}>
                    <Text style={{ color: 'black' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
      </Modal>

      <Modal transparent visible={profileNameModalVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Text style={styles.nameText}>What is their name?</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setprofileName}
              placeholder="Name"
            />
            <Pressable onPress={() => {setprofileprofileTypeModalVisible(true); setprofileNameModalVisible(false);}} style={styles.secondaryButton}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={profileprofileTypeModalVisible} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Animated.View style={{ transform: [{ translateY: moveMenu }] }}>
              <Text style={styles.nameText}>What is {profileName}'s dietary restrictions?</Text>
            </Animated.View>
            <Animated.View style={[styles.secondaryButton, { transform: [{ translateY: moveMenu }] }]}>
              <Text style={styles.continueButtonText}>Select a tag</Text>
            </Animated.View>
            <Animated.View style={[styles.tagContainer, { transform: [{ translateY: moveMenu }] }]}>
              <TouchableOpacity style={styles.tagButton} onPress={handleTagPress}>
                <Text style={styles.tagText}>Allergens</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tagButton}>
                <Text style={styles.tagText}>Intolerances</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tagButton}>
                <Text style={styles.tagText}>Dietary</Text>
              </TouchableOpacity>
            </Animated.View>

            {tagSelected && (
              <Animated.View style={[styles.allergensMenuContainer, {opacity: allergensMenu }]}>
                {allergenCheckboxes.map((option) =>{
                  const isChecked = selectedAllergens.includes(option);
                  return(
                    <TouchableOpacity
                    key={option}
                    onPress={() =>{
                      setSelectedAllergens((prev) =>
                        isChecked
                          ? prev.filter((item) => item !== option)
                          : [...prev, option]
                    );
                    }}
                    style={styles.checkboxRow}>
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxChecked]} />
                      <Text style={styles.checkboxLabel}>{option}</Text>
                    </TouchableOpacity>
                  )
                })}
              </Animated.View>
            )}

            <Pressable onPress={() => {setprofileprofileTypeModalVisible(false); saveProfile();}} style={styles.secondaryButton}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1,
   },
  titleContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
    width: '100%',
  },
  text: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
    buttonContainer: {
    padding: 16,
    alignItems: 'flex-end', // align to right
    paddingBottom: Platform.OS === 'ios' ? 95 : 16,
  },
  button: {
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'black',
    fontSize: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 10,
  },
  card: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  openButton: { 
    backgroundColor: '#007AFF', 
    padding: 12,
    borderRadius: 20 
  },
  secondaryButton: {
    backgroundColor: '#ffffffff',
    padding: 10,
    marginTop: 10,
    borderRadius: 40,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalView: {
    backgroundColor: 'transparent',
    padding: 20,
    borderRadius: 12,
    width: 300,
  },
  input: {
    borderBottomWidth: 1,
    backgroundColor : 'white',
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    fontSize : 24,
    marginBottom: 10,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  listItem: {
    paddingVertical: 4,
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#999',
  },
  nameText: {
    justifyContent: 'center',
    alignItems : 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagButton: {
    backgroundColor: '#767676ff', // soft gray background
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  tagText: {
    color: '#000', // dark text
    fontSize: 14,
    fontWeight: '500',
  },
  allergensMenuContainer: {
  marginTop: 12,
  padding: 10,
  backgroundColor: '#ffffff',
  borderRadius: 8,
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
},
  allergensMenuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 6,
},

checkboxBox: {
  width: 20,
  height: 20,
  borderWidth: 1,
  borderColor: '#555',
  borderRadius: 4,
  marginRight: 10,
  backgroundColor: '#fff',
},

checkboxChecked: {
  backgroundColor: '#007AFF',
},

checkboxLabel: {
  fontSize: 16,
  color: 'black',
},
groupModalContainer: {
  backgroundColor: 'white',
  padding: 20,
  borderRadius: 10,
  width: '90%',
  maxHeight: '80%',
},
gInput: {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 6,
  padding: 10,
  marginBottom: 10,
},
modalSubtitle: {
  fontWeight: 'bold',
  marginVertical: 10,
},
profileOption: {
  padding: 10,
  borderBottomWidth: 1,
  borderColor: '#eee',
},
profileOptionSelected: {
  backgroundColor: '#d0ebff',
},
modalActions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 20,
},
saveButton: {
  backgroundColor: '#4CAF50',
  padding: 10,
  borderRadius: 6,
},
cancelButton: {
  padding: 10,
}, 
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'center',
  alignItems: 'center',
},
modalContainer: {
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 12,
  width: 300,
  alignItems: 'center',
},
modalTitle: {
  fontSize: 18,
  marginBottom: 20,
},
optionButton: {
  backgroundColor: '#f0f0f0',
  padding: 12,
  borderRadius: 8,
  width: '100%',
  marginTop: 10,
  alignItems: 'center',
},
  overlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '90%',

}, 
groupContainer: {
  marginTop: 10,
  padding: 10,
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  backgroundColor: '#f9f9f9',
},

groupTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 4,
},

groupMemberText: {
  fontSize: 14,
  marginLeft: 10,
},
});
