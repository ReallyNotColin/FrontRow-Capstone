import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  Platform, ScrollView, View, Text, Modal, TextInput, Pressable,
  StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useThemedColor } from '@/components/ThemedColor';

// 🔁 Firestore-backed helpers (realtime)
import {
  onProfiles, onGroups,
  saveProfileFS, deleteProfileFS,
  saveGroupProfile, deleteGroupProfile,
} from '@/db/Profiles';

export default function Profile() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  // Modal states
  const [profileNameModalVisible, setprofileNameModalVisible] = useState(false);
  const [profileprofileTypeModalVisible, setprofileprofileTypeModalVisible] = useState(false);
  const [profileTypeModalVisible, setprofileTypeModalVisible] = useState(false);
  const [gProfileModalVisible, setgProfileModalVisible] = useState(false);

  // Form inputs
  const [profileName, setprofileName] = useState('');
  const [groupName, setgroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  // Data (live)
  const [savedProfiles, setSavedProfiles] = useState<{ name: string; allergens: string[] }[]>([]);
  const [individualProfiles, setIndividualProfiles] = useState<string[]>([]);
  const [groupProfiles, setGroupProfiles] = useState<Record<string, string[]>>({});

  // UI animations/state
  const [moveMenu] = useState(new Animated.Value(0));
  const [allergensMenu] = useState(new Animated.Value(0));
  const [tagSelected, setTagSelected] = useState(false);

  const allergenCheckboxes = useMemo(() => ([
    'Milk', 'Lactose', 'Egg', 'Fish', 'Gluten', 'Nuts',
    'Peanuts', 'Shellfish', 'Soy', 'Sesame',
  ]), []);

  const handleTagPress = () => {
    setTagSelected(true);
    Animated.sequence([
      Animated.timing(moveMenu, { toValue: -10, duration: 300, useNativeDriver: true }),
      Animated.timing(allergensMenu, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // ✅ Save individual profile (Firestore)
  const handleSaveProfile = async () => {
    try {
      await saveProfileFS(profileName.trim(), selectedAllergens);
      setprofileprofileTypeModalVisible(false);
      setprofileName('');
      setSelectedAllergens([]);
    } catch (error) {
      console.error('Failed to save profile', error);
    }
  };

  // ✅ Save group (Firestore)
  const handleSaveGroup = async () => {
    try {
      await saveGroupProfile(groupName.trim(), groupMembers);
      setgroupName('');
      setGroupMembers([]);
      setgProfileModalVisible(false);
    } catch (error) {
      console.error('Failed to save group', error);
    }
  };

  // ✅ Delete group/profile (Firestore)
  const handleDeleteGroup = async (name: string) => {
    try {
      await deleteGroupProfile(name);
    } catch (error) {
      console.error('Failed to delete group', error);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    try {
      await deleteProfileFS(name);
    } catch (error) {
      console.error('Failed to delete profile', error);
    }
  };

  const handleEditProfile = (profile: { name: string; allergens: string[] }) => {
    setprofileName(profile.name);
    setSelectedAllergens(profile.allergens);
    setprofileprofileTypeModalVisible(true);
  };

  // 🔴 Realtime subscriptions
  useEffect(() => {
    // Individuals
    const unsubProfiles = onProfiles((profiles) => {
      setSavedProfiles(profiles);                             // [{name, allergens}]
      setIndividualProfiles(profiles.map(p => p.name));       // ["Alice","Bob",...]
      // Keep selected group members valid if any were deleted
      setGroupMembers(prev => prev.filter(n => profiles.some(p => p.name === n)));
    });

    // Groups
    const unsubGroups = onGroups((groupsMap) => {
      setGroupProfiles(groupsMap);                            // { groupName: [members...] }
    });

    return () => { unsubProfiles(); unsubGroups(); };
  }, []);

  // Optional: refresh when screen regains focus (usually unnecessary with realtime,
  // but harmless if you keep it for safety)
  useFocusEffect(useCallback(() => {
    // no-op: realtime keeps things fresh
    return () => {};
  }, []));

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      <View style={styles.container}>
        <ScrollView>
          <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
            <ThemedText type="title" style={{ color: activeColors.text }}>
              Profiles
            </ThemedText>
          </ThemedView>
          <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />

          {/* Individual Profiles */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: activeColors.text }]}>Profiles</ThemedText>

            {savedProfiles.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText, marginLeft: 12 }]}>
                No profiles saved yet.
              </ThemedText>
            ) : (
              savedProfiles.map((profile, index) => (
                <View
                  key={index}
                  style={[
                    styles.card,
                    { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider, borderWidth: 1 }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={[styles.cardTitle, { color: activeColors.text, flex: 1 }]}>
                      {profile.name}
                    </ThemedText>
                    <TouchableOpacity onPress={() => handleDeleteProfile(profile.name)} style={{ marginRight: 10 }}>
                      <ThemedText style={{ color: 'red' }}>Delete</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditProfile(profile)}>
                      <ThemedText style={{ color: '#007AFF' }}>Edit</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {profile.allergens.length > 0 ? (
                    <ThemedText style={[styles.cardDetails, { color: activeColors.secondaryText, marginTop: 4 }]}>
                      Allergens: {profile.allergens.join(', ')}
                    </ThemedText>
                  ) : (
                    <ThemedText style={[styles.cardDetails, { fontStyle: 'italic', color: activeColors.secondaryText, marginTop: 4 }]}>
                      No allergens selected
                    </ThemedText>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Group Profiles */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: activeColors.text }]}>Group Profiles</ThemedText>

            {Object.keys(groupProfiles).length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText, marginLeft: 12 }]}>
                No group profiles saved.
              </ThemedText>
            ) : (
              Object.entries(groupProfiles).map(([gName, members]) => (
                <View
                  key={gName}
                  style={[
                    styles.groupContainer,
                    { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={[styles.cardTitle, { color: activeColors.text }]}>{gName}</ThemedText>
                    <TouchableOpacity onPress={() => handleDeleteGroup(gName)}>
                      <ThemedText style={{ color: 'red' }}>Delete</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {Array.isArray(members) && members.length > 0 ? (
                    members.map((memberName, idx) => (
                      <ThemedText
                        key={`${gName}-${idx}`}
                        style={[styles.groupMemberText, { color: activeColors.secondaryText }]}
                      >
                        • {memberName}
                      </ThemedText>
                    ))
                  ) : (
                    <ThemedText style={{ marginLeft: 10, fontStyle: 'italic' }}>No members</ThemedText>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Floating add button */}
        <View style={styles.buttonContainer}>
          <Pressable onPress={() => { setprofileTypeModalVisible(true); }} style={[styles.button, { backgroundColor: '#007AFF' }]}>
            <Text style={styles.continueButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Create: choose type */}
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

      {/* Create Group */}
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
              {individualProfiles.map((name) => {
                const isSelected = groupMembers.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={styles.checkboxRow}
                    onPress={() => {
                      setGroupMembers(prev => isSelected ? prev.filter(p => p !== name) : [...prev, name]);
                    }}
                  >
                    <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]} />
                    <Text style={styles.checkboxLabel}>{name}</Text>
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

      {/* Create Individual: name */}
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
            <Pressable
              onPress={() => { setprofileprofileTypeModalVisible(true); setprofileNameModalVisible(false); }}
              style={styles.secondaryButton}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create Individual: allergens */}
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
              <Animated.View style={[styles.allergensMenuContainer, { opacity: allergensMenu }]}>
                {allergenCheckboxes.map((option) => {
                  const isChecked = selectedAllergens.includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        setSelectedAllergens(prev =>
                          isChecked ? prev.filter(item => item !== option) : [...prev, option]
                        );
                      }}
                      style={styles.checkboxRow}
                    >
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxChecked]} />
                      <Text style={styles.checkboxLabel}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            <Pressable
              onPress={() => { setprofileprofileTypeModalVisible(false); handleSaveProfile(); }}
              style={styles.secondaryButton}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleContainer: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, marginBottom: 16, width: '100%' },
  buttonContainer: {
    padding: 16,
    alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 95 : 16,
  },
  button: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  continueButtonText: { fontSize: 28 },
  section: { marginBottom: 24 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12, marginLeft: 10 },
  card: { padding: 12, borderRadius: 8, marginBottom: 8 },
  cardTitle: { fontWeight: 'bold' },
  cardDetails: {},
  emptyText: { fontStyle: 'italic' },
  secondaryButton: {
    backgroundColor: '#ffffffff', padding: 10, marginTop: 10,
    borderRadius: 40, alignItems: 'center',
  },
  modalBackground: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalView: { backgroundColor: 'transparent', padding: 20, borderRadius: 12, width: 300 },
  input: {
    borderBottomWidth: 1, backgroundColor: 'white', borderColor: '#ccc',
    borderRadius: 20, paddingVertical: 6, paddingLeft: 12, fontSize: 24, marginBottom: 10,
  },
  nameText: {
    justifyContent: 'center', alignItems: 'center', fontSize: 24, fontWeight: 'bold',
    color: 'white', paddingVertical: 18, paddingHorizontal: 12,
  },
  tagContainer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tagButton: {
    backgroundColor: '#767676ff', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 10, marginHorizontal: 4,
  },
  tagText: { color: '#000', fontSize: 14, fontWeight: '500' },
  allergensMenuContainer: {
    marginTop: 12, padding: 10, backgroundColor: '#ffffff',
    borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#555', borderRadius: 4, marginRight: 10, backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#007AFF' },
  checkboxLabel: { fontSize: 16, color: 'black' },
  overlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, maxHeight: '90%' },
  groupContainer: { marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#f9f9f9' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: 300, alignItems: 'center' },
  modalTitle: { fontSize: 18, marginBottom: 20 },
  optionButton: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, width: '100%', marginTop: 10, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { fontWeight: 'bold', marginVertical: 10 },
  groupMemberText: { marginLeft: 10 },
  saveButton: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 6 },
  cancelButton: { padding: 10 },
});
