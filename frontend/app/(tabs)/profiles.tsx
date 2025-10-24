// app/(tabs)/profiles.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Platform, ScrollView, View, Text, Modal, TextInput, Pressable,
  StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemedColor } from '@/components/ThemedColor';
import { LinearGradient } from "expo-linear-gradient";

import {
  onProfiles, onGroups,
  saveProfileFS, deleteProfileFS,
  saveGroupProfile, deleteGroupProfile,
  onPetProfiles, savePetProfile, deletePetProfile,
} from '@/db/Profiles';

type SavedProfile = {
  name: string;
  allergens: string[];
  intolerances: string[];
  dietary: string[];
};
type SavedPetProfile = {
  name: string;
  petType: string;
  allergens: string[];
};

type TagTab = 'allergens' | 'intolerances' | 'dietary' | null;

export default function Profile() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;

  /* ------------------ modal visibility ------------------ */
  const [profileTypeModalVisible, setprofileTypeModalVisible] = useState(false); // choose Individual/Group/Pet
  const [profileNameModalVisible, setprofileNameModalVisible] = useState(false); // individual: ask name
  const [profileprofileTypeModalVisible, setprofileprofileTypeModalVisible] = useState(false); // individual: pick tags
  const [gProfileModalVisible, setgProfileModalVisible] = useState(false); // group modal

  // Pet modals
  const [petNameTypeModalVisible, setPetNameTypeModalVisible] = useState(false); // ask pet name/type
  const [petTagsModalVisible, setPetTagsModalVisible] = useState(false); // pick pet tags

  /* ------------------ form state ------------------ */
  const [profileName, setprofileName] = useState('');
  const [groupName, setgroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupPetMembers, setGroupPetMembers] = useState<string[]>([]);

  // Pet form
  const [petName, setPetName] = useState('');
  const petTypeOptions = useMemo(() => ['Dog', 'Cat'], []);
  const [petType, setPetType] = useState<string>('Dog');

  // options (HUMAN)
  const allergenOptions = useMemo(
    () => ['Milk', 'Lactose', 'Egg', 'Fish', 'Gluten', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Sesame'],
    []
  );
  const intoleranceOptions = useMemo(
    () => ['Lactose', 'Gluten', 'Histamine', 'Salicylate', 'Soy', 'Corn', 'Caffeine', 'Sulfite'],
    []
  );
  const dietaryOptions = useMemo(
    () => ['High-Fat', 'High-Sodium', 'High-Sugar','High-Potassium', 'High-Cholesterol', 'High-Carbohydrates', 'High-Calcium', 'High-Iron', 'High-Protein', 'High-Fiber'],
    []
  );

  // PET options (fixed allergens only)
  const petAllergenOptions = useMemo(
    () => ['Beef','Chicken','Lamb','Dairy','Eggs','Wheat','Corn','Soy','Fish'],
    []
  );

  // individual selections
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedIntolerances, setSelectedIntolerances] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<TagTab>(null);
  const [customInput, setCustomInput] = useState(""); // text box for adding custom items

  // pet selections (ONLY allergens now)
  const [petSelectedAllergens, setPetSelectedAllergens] = useState<string[]>([]);

  /* ------------------ live data ------------------ */
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [individualProfiles, setIndividualProfiles] = useState<string[]>([]);
  const [groupProfiles, setGroupProfiles] = useState<Record<string, string[]>>({});
  const [petProfiles, setPetProfiles] = useState<SavedPetProfile[]>([]);

  /* ------------------ animations ------------------ */
  const [moveMenu] = useState(new Animated.Value(0));
  const [menuOpacity] = useState(new Animated.Value(0));
  const [petMoveMenu] = useState(new Animated.Value(0));
  const [petMenuOpacity] = useState(new Animated.Value(0));

  const openTagMenu = (tab: TagTab) => {
    setActiveTag(tab);
    Animated.sequence([
      Animated.timing(moveMenu, { toValue: -10, duration: 250, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  /* ------------------ CRUD (individual) ------------------ */
  const handleSaveProfile = async () => {
    try {
      await saveProfileFS(
        profileName.trim(),
        selectedAllergens,
        selectedIntolerances,
        selectedDietary
      );
      // reset
      setprofileprofileTypeModalVisible(false);
      setprofileName('');
      setSelectedAllergens([]);
      setSelectedIntolerances([]);
      setSelectedDietary([]);
      setActiveTag(null);
      moveMenu.setValue(0);
      menuOpacity.setValue(0);
    } catch (error) {
      console.error('Failed to save profile', error);
    }
  };
  const handleDeleteProfile = async (name: string) => {
    try { await deleteProfileFS(name); } catch (e) { console.error(e); }
  };
  const handleEditProfile = (profile: SavedProfile) => {
    setprofileName(profile.name);
    setSelectedAllergens(profile.allergens ?? []);
    setSelectedIntolerances(profile.intolerances ?? []);
    setSelectedDietary(profile.dietary ?? []);
    setActiveTag('allergens');
    setprofileprofileTypeModalVisible(true);
    moveMenu.setValue(-10);
    menuOpacity.setValue(1);
  };

  /* ------------------ CRUD (groups) ------------------ */
const handleSaveGroup = async () => {
  try {
    // Convert to typed members
    const typed = [
      ...groupMembers.map((name) => ({ name, kind: 'human' as const })),
      ...groupPetMembers.map((name) => ({ name, kind: 'pet' as const })),
    ];
    await saveGroupProfile(groupName.trim(), typed);

    // reset
    setgroupName('');
    setGroupMembers([]);
    setGroupPetMembers([]);
    setgProfileModalVisible(false);
  } catch (e) {
    console.error(e);
  }
};


  /* ------------------ CRUD (pets) ------------------ */
  const handleSavePet = async () => {
    try {
      // simplified API: savePetProfile(name, petType, allergens)
      await savePetProfile(
        petName.trim(),
        petType,
        petSelectedAllergens
      );
      // reset
      setPetTagsModalVisible(false);
      setPetName('');
      setPetType('Dog');
      setPetSelectedAllergens([]);
      petMoveMenu.setValue(0);
      petMenuOpacity.setValue(0);
    } catch (e) { console.error('Failed to save pet', e); }
  };
  const handleDeletePet = async (name: string) => {
    try { await deletePetProfile(name); } catch (e) { console.error(e); }
  };
  const handleEditPet = (pet: SavedPetProfile) => {
    setPetName(pet.name);
    setPetType(pet.petType || 'Dog');
    setPetSelectedAllergens(pet.allergens ?? []);
    setPetTagsModalVisible(true);
    petMoveMenu.setValue(-10);
    petMenuOpacity.setValue(1);
  };

  /* ------------------ subscriptions ------------------ */
  useEffect(() => {
    const unsubProfiles = onProfiles((profiles) => {
      setSavedProfiles(profiles);
      setIndividualProfiles(profiles.map((p) => p.name));
      setGroupMembers((prev) => prev.filter((n) => profiles.some((p) => p.name === n)));
    });
    const unsubGroups = onGroups((groupsMap) => setGroupProfiles(groupsMap));
    const unsubPets = onPetProfiles((rows) => setPetProfiles(rows as SavedPetProfile[]));
    return () => { unsubProfiles(); unsubGroups(); unsubPets(); };
  }, []);

  useFocusEffect(useCallback(() => { return () => {}; }, []));

  /* ------------------ current list helpers (human) ------------------ */
  const currentOptions = useMemo(() => {
    const base =
      activeTag === 'allergens' ? allergenOptions :
      activeTag === 'intolerances' ? intoleranceOptions :
      activeTag === 'dietary' ? dietaryOptions : [];

    const selected =
      activeTag === 'allergens' ? selectedAllergens :
      activeTag === 'intolerances' ? selectedIntolerances :
      activeTag === 'dietary' ? selectedDietary : [];

    const extra = selected.filter(s => !base.includes(s));
    return [...base, ...extra].sort((a, b) => a.localeCompare(b));
  }, [activeTag, allergenOptions, intoleranceOptions, dietaryOptions, selectedAllergens, selectedIntolerances, selectedDietary]);

  const currentSelected = useMemo(() => {
    if (activeTag === 'allergens') return selectedAllergens;
    if (activeTag === 'intolerances') return selectedIntolerances;
    if (activeTag === 'dietary') return selectedDietary;
    return [];
  }, [activeTag, selectedAllergens, selectedIntolerances, selectedDietary]);

  const toggleOption = (o: string) => {
    const s = currentSelected;
    const next = s.includes(o) ? s.filter((x) => x !== o) : [...s, o];
    if (activeTag === 'allergens') setSelectedAllergens(next);
    else if (activeTag === 'intolerances') setSelectedIntolerances(next);
    else if (activeTag === 'dietary') setSelectedDietary(next);
  };

  /* ------------------ PET list helpers (allergens only) ------------------ */
  const petCurrentOptions = petAllergenOptions;
  const petCurrentSelected = petSelectedAllergens;
  const petToggleOption = (o: string) => {
    const s = petCurrentSelected;
    const next = s.includes(o) ? s.filter((x) => x !== o) : [...s, o];
    setPetSelectedAllergens(next);
  };

  /* ------------------ render ------------------ */
  return (
    <LinearGradient colors={activeColors.gradientBackground} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
      <View style={[styles.container]}>
        <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
            <ThemedText type="title" style={{ color: activeColors.text }}>
                Profiles
            </ThemedText>
          </ThemedView>
          <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />
        <View style={styles.container}>
          <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
            {/* Individual Profiles */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: activeColors.text }]}>Profiles</ThemedText>

              {savedProfiles.length === 0 ? (
                <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText, marginLeft: 12 }]}>
                  No profiles saved yet.
                </ThemedText>
              ) : (
                savedProfiles.map((profile) => (
                  <View
                    key={profile.name}
                    style={[
                      styles.card,
                      { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider, borderWidth: 1 },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText style={[styles.cardTitle, { color: activeColors.text, flex: 1 }]}>{profile.name}</ThemedText>
                      <TouchableOpacity onPress={() => handleDeleteProfile(profile.name)} style={{ marginRight: 10 }}>
                        <ThemedText style={{ color: 'red' }}>Delete</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleEditProfile(profile)}>
                        <ThemedText style={{ color: '#007AFF' }}>Edit</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={[styles.cardDetails, { color: activeColors.secondaryText, marginTop: 6 }]}>
                      Allergens: {profile.allergens?.length ? profile.allergens.join(', ') : 'None'}
                    </ThemedText>
                    <ThemedText style={[styles.cardDetails, { color: activeColors.secondaryText, marginTop: 2 }]}>
                      Intolerances: {profile.intolerances?.length ? profile.intolerances.join(', ') : 'None'}
                    </ThemedText>
                    <ThemedText style={[styles.cardDetails, { color: activeColors.secondaryText, marginTop: 2 }]}>
                      Dietary: {profile.dietary?.length ? profile.dietary.join(', ') : 'None'}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>

            {/* Pet Profiles */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: activeColors.text }]}>Pet Profiles</ThemedText>
              {petProfiles.length === 0 ? (
                <ThemedText style={[styles.emptyText, { color: activeColors.secondaryText, marginLeft: 12 }]}>
                  No pet profiles saved.
                </ThemedText>
              ) : (
                petProfiles.map((pet) => (
                  <View
                    key={pet.name}
                    style={[
                      styles.card,
                      { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider, borderWidth: 1 },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText style={[styles.cardTitle, { color: activeColors.text, flex: 1 }]}>
                        {pet.name} • {pet.petType}
                      </ThemedText>
                      <TouchableOpacity onPress={() => handleDeletePet(pet.name)} style={{ marginRight: 10 }}>
                        <ThemedText style={{ color: 'red' }}>Delete</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleEditPet(pet)}>
                        <ThemedText style={{ color: '#007AFF' }}>Edit</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={[styles.cardDetails, { color: activeColors.secondaryText, marginTop: 6 }]}>
                      Allergens: {pet.allergens?.length ? pet.allergens.join(', ') : 'None'}
                    </ThemedText>
                    {/* Intolerances/Dietary removed for pets */}
                  </View>
                ))
              )}
            </View>

            {/* Group Profiles */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: activeColors.text }]}>Group Profiles</ThemedText>

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
                      { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText style={[styles.cardTitle, { color: activeColors.text }]}>{gName}</ThemedText>
                      <TouchableOpacity onPress={() => handleDeleteGroup(gName)}>
                        <ThemedText style={{ color: 'red' }}>Delete</ThemedText>
                      </TouchableOpacity>
                    </View>

                    {Array.isArray(members) && members.length > 0 ? (
                      members.map((m, idx) => (
                        <ThemedText
                          key={`${gName}-${idx}`}
                          style={[styles.groupMemberText, { color: activeColors.secondaryText }]}
                        >
                          • {m.name} {m.kind === 'pet' ? '🐾' : ''}
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
            <Pressable
              onPress={() => setprofileTypeModalVisible(true)}
              style={[styles.button, { backgroundColor: '#27778E' }]}
            >
              <Text style={styles.continueButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Choose create type */}
        <Modal transparent animationType="fade" visible={profileTypeModalVisible} onRequestClose={() => setprofileTypeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.headerBackRow}>
                <Pressable onPress={() => setprofileTypeModalVisible(false)}>
                  <Text style={styles.headerBackText}>&lt; Back</Text>
                </Pressable>
              </View>
              <Text style={styles.modalTitle}>Create New</Text>
              <Pressable
                style={styles.optionButton}
                onPress={() => { setprofileNameModalVisible(true); setprofileTypeModalVisible(false); }}
              >
                <Text>Individual Profile</Text>
              </Pressable>
              <Pressable
                style={styles.optionButton}
                onPress={() => { setPetNameTypeModalVisible(true); setprofileTypeModalVisible(false); }}
              >
                <Text>Pet Profile</Text>
              </Pressable>
              <Pressable
                style={styles.optionButton}
                onPress={() => { setgProfileModalVisible(true); setprofileTypeModalVisible(false); }}
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
              <TextInput style={styles.input} placeholder="Group Name" value={groupName} onChangeText={setgroupName} />
              <Text style={styles.modalSubtitle}>Select Profiles to Include</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {individualProfiles.map((name) => {
                  const isSelected = groupMembers.includes(name);
                  return (
                    <TouchableOpacity
                      key={name}
                      style={styles.checkboxRow}
                      onPress={() => {
                        setGroupMembers((prev) =>
                          isSelected ? prev.filter((p) => p !== name) : [...prev, name]
                        );
                      }}
                    >
                      <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]} />
                      <Text style={styles.checkboxLabel}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[styles.modalSubtitle, { marginTop: 12 }]}>Add Pet Profiles</Text>
                </ScrollView>
                <ScrollView style={{ maxHeight: 200 }}>
                  {petProfiles.map((pet) => {
                    const isSelected = groupPetMembers.includes(pet.name);
                    return (
                      <TouchableOpacity
                        key={pet.name}
                        style={styles.checkboxRow}
                        onPress={() => {
                          setGroupPetMembers((prev) =>
                            isSelected ? prev.filter((n) => n !== pet.name) : [...prev, pet.name]
                          );
                        }}
                      >
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]} />
                        <Text style={styles.checkboxLabel}>{pet.name} • {pet.petType}</Text>
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

        {/* Create Individual: ask for name */}
        <Modal transparent visible={profileNameModalVisible} animationType="slide" onRequestClose={() => setprofileNameModalVisible(false)}>
          <View style={styles.modalBackground}>
            <View style={styles.headerBackRow}>
              <Pressable onPress={() => setprofileNameModalVisible(false)}>
                <Text style={styles.headerBackText}>&lt; Back</Text>
              </Pressable>
            </View>
            <View style={styles.modalView}>
              <View style={styles.headerBackRow}>
                <Pressable onPress={() => setprofileNameModalVisible(false)}>
                  <Text style={[styles.headerBackText, {color: 'white'}]}>&lt; Back</Text>
                </Pressable>
              </View>

              <Text style={styles.nameText}>What is their name?</Text>
              <TextInput style={styles.input} value={profileName} onChangeText={setprofileName} placeholder="Name" />
              <Pressable
                onPress={() => { setprofileprofileTypeModalVisible(true); setprofileNameModalVisible(false); }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Create/Edit Individual: pick tags */}
        <Modal transparent visible={profileprofileTypeModalVisible} animationType="fade" onRequestClose={() => setprofileprofileTypeModalVisible(false)}>
          <View style={styles.modalBackground}>
            <View style={styles.modalView}>
              <View style={styles.headerBackRow}>
                <Pressable onPress={() => setprofileprofileTypeModalVisible(false)}>
                  <Text style={[styles.headerBackText, {color:'white'}]}>&lt; Back</Text>
                </Pressable>
              </View>

              <Animated.View style={{ transform: [{ translateY: moveMenu }] }}>
                <Text style={styles.nameText}>What is {profileName}'s dietary profile?</Text>
              </Animated.View>

              <Animated.View style={[styles.tagRow, { transform: [{ translateY: moveMenu }] }]}>
                <TouchableOpacity style={styles.tagButton} onPress={() => openTagMenu('allergens')}>
                  <Text style={styles.tagText}>Allergens</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tagButton} onPress={() => openTagMenu('intolerances')}>
                  <Text style={styles.tagText}>Intolerances</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tagButton} onPress={() => openTagMenu('dietary')}>
                  <Text style={styles.tagText}>Dietary</Text>
                </TouchableOpacity>
              </Animated.View>

              {activeTag && (
                <Animated.View style={[styles.allergensMenuContainer, { opacity: menuOpacity }]}>
                  <ScrollView style={{ maxHeight: 260 }}>
                    {currentOptions.map((o) => {
                      const isChecked =
                        (activeTag === 'allergens' ? selectedAllergens :
                        activeTag === 'intolerances' ? selectedIntolerances : selectedDietary).includes(o);
                      return (
                        <TouchableOpacity key={o} onPress={() => toggleOption(o)} style={styles.checkboxRow}>
                          <View style={[styles.checkboxBox, isChecked && styles.checkboxChecked]} />
                          <Text style={styles.checkboxLabel}>{o}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* pinned "Add custom" row (still available for HUMAN profiles) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    <TextInput
                      value={customInput}
                      onChangeText={setCustomInput}
                      placeholder={`Add custom ${activeTag?.slice(0, -1) ?? 'item'}`}
                      placeholderTextColor="#8a8a8a"
                      style={[styles.input, { flex: 1, marginBottom: 0, fontSize:18 }]}
                    />
                    <Pressable
                      onPress={() => {
                        const v = customInput.trim();
                        if (!v) return;
                        // prevent dup in defaults ∪ current selections
                        if (currentOptions.some(x => x.toLowerCase() === v.toLowerCase())) {
                          setCustomInput("");
                          return;
                        }
                        if (activeTag === 'allergens') setSelectedAllergens(prev => [...prev, v]);
                        else if (activeTag === 'intolerances') setSelectedIntolerances(prev => [...prev, v]);
                        else if (activeTag === 'dietary') setSelectedDietary(prev => [...prev, v]);
                        setCustomInput("");
                      }}
                      style={[styles.secondaryButton, { marginLeft: 8 }]}
                    >
                      <Text style={styles.secondaryButtonText}>Add</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}

              <Pressable onPress={handleSaveProfile} style={[styles.secondaryButton, { marginTop: 12 }]}>
                <Text style={styles.secondaryButtonText}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setprofileprofileTypeModalVisible(false)} style={[styles.cancelButton, { alignSelf: 'center' }]}>
                <Text style={{ color: 'black' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Create/Edit Pet: ask name & type */}
        <Modal transparent visible={petNameTypeModalVisible} animationType="slide" onRequestClose={() => setPetNameTypeModalVisible(false)}>
          <View style={styles.modalBackground}>
            <View style={styles.modalView}>
              <View style={styles.headerBackRow}>
                <Pressable onPress={() => setPetNameTypeModalVisible(false)}>
                  <Text style={[styles.headerBackText, {color: 'white'}]}>&lt; Back</Text>
                </Pressable>
              </View>

              <Text style={styles.nameText}>Pet info</Text>
              <TextInput style={styles.input} placeholder="Pet Name" value={petName} onChangeText={setPetName} />
              <Text style={[styles.modalSubtitle, { color: 'white', alignSelf: 'center' }]}>Type</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
                {petTypeOptions.map((t) => {
                  const selected = petType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setPetType(t)}
                      style={[
                        styles.pill,
                        { backgroundColor: selected ? '#FFD54F' : '#eee', marginHorizontal: 6 },
                      ]}
                    >
                      <Text style={{ color: selected ? '#000' : '#333' }}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Pressable
                onPress={() => { setPetTagsModalVisible(true); setPetNameTypeModalVisible(false); petMenuOpacity.setValue(1)}}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Create/Edit Pet: pick tags (ALLERGENS ONLY) */}
        <Modal transparent visible={petTagsModalVisible} animationType="fade" onRequestClose={() => setPetTagsModalVisible(false)}>
          <View style={styles.modalBackground}>
            <View style={styles.modalView}>
              <View style={styles.headerBackRow}>
                <Pressable onPress={() => setPetTagsModalVisible(false)}>
                  <Text style={[styles.headerBackText, {color: 'white'}]}>&lt; Back</Text>
                </Pressable>
              </View>

              <Animated.View style={{ transform: [{ translateY: petMoveMenu }] }}>
                <Text style={styles.nameText}>What is {petName}'s allergen profile?</Text>
              </Animated.View>

              {/* Allergens checklist (no tabs, no custom add) */}
              <Animated.View style={[styles.allergensMenuContainer, { opacity: petMenuOpacity }]}>
                <ScrollView style={{ maxHeight: 260 }}>
                  {petAllergenOptions.map((o) => {
                    const isChecked = petSelectedAllergens.includes(o);
                    return (
                      <TouchableOpacity key={o} onPress={() => {
                        const next = isChecked
                          ? petSelectedAllergens.filter(x => x !== o)
                          : [...petSelectedAllergens, o];
                        setPetSelectedAllergens(next);
                      }} style={styles.checkboxRow}>
                        <View style={[styles.checkboxBox, isChecked && styles.checkboxChecked]} />
                        <Text style={styles.checkboxLabel}>{o}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Animated.View>
              <Pressable onPress={handleSavePet} style={[styles.secondaryButton, { marginTop: 12 }]}>
                <Text style={styles.secondaryButtonText}>Save Pet</Text>
              </Pressable>
              <Pressable onPress={() => setPetTagsModalVisible(false)} style={[styles.cancelButton, { alignSelf: 'center' }]}>
                <Text style={{ color: 'black' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  titleContainer: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, width: '100%' },

  buttonContainer: { position: 'absolute', right: 16, alignItems: 'flex-end', bottom: Platform.OS === 'ios' ? 95 : 16, backgroundColor: 'transparent' },
  button: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: "#fff", fontSize: 50, fontWeight:800, marginBottom: 4.25 },

  section: {paddingHorizontal: 25, paddingVertical: 12},
  sectionTitle: { fontWeight: 'bold', marginBottom: 12},

  card: { padding: 12, borderRadius: 8, marginBottom: 8 },
  cardTitle: { fontWeight: 'bold' },
  cardDetails: {},
  emptyText: { fontStyle: 'italic' },

  groupContainer: { marginTop: 10, padding: 10, borderWidth: 1, borderRadius: 8, backgroundColor: '#f9f9f9' },
  groupMemberText: { marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: 300, alignItems: 'center' },
  modalTitle: { fontSize: 18, marginBottom: 20 },
  optionButton: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, width: '100%', marginTop: 10, alignItems: 'center' },

  overlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, maxHeight: '90%' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },

  modalBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalView: { backgroundColor: 'transparent', padding: 20, borderRadius: 12, width: 320 },

  input: {
    borderBottomWidth: 1, backgroundColor: 'white', borderColor: '#ccc',
    borderRadius: 20, paddingVertical: 6, paddingLeft: 12, fontSize: 20, marginBottom: 10,
  },
  nameText: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: 'white', paddingVertical: 18, paddingHorizontal: 12 },

  tagRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  tagButton: { backgroundColor: '#767676ff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginHorizontal: 4 },
  tagText: { color: '#000', fontSize: 14, fontWeight: '500' },

  allergensMenuContainer: {
    marginTop: 12, padding: 10, backgroundColor: '#ffffff',
    borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#555', borderRadius: 4, marginRight: 10, backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#007AFF' },
  checkboxLabel: { fontSize: 16, color: 'black' },

  secondaryButton: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 40, alignItems: 'center' },
  secondaryButtonText: { color: '#000', fontWeight: '600' },
  saveButton: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 6 },
  cancelButton: { padding: 10 },

  // Pet UI
  pill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  modalSubtitle: { fontSize: 14, marginTop: 6, marginBottom: 8 },

  // Back buttons (absolute)
  headerBackRow: {
    position: "absolute",
    left: 16,
    top: -50,
  },
  headerBackText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
