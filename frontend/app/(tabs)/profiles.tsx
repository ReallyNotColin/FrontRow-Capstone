import React, { useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Platform, ScrollView, View, Text, Modal, TextInput, Pressable, FlatList, StyleSheet, TouchableOpacity, Animated} from 'react-native';
import { useNavigation } from 'expo-router';

export default function Profile() {
  const [profileName, setprofileName] = useState(false);
  const [nestedVisible, setNestedVisible] = useState(false);
  const [nameInput, setnameInput] = useState('');
  const [profileInput, setprofileInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [moveMenu] = useState(new Animated.Value(0));
  const [allergensMenu] = useState(new Animated.Value(0));
  const [tagSelected, setTagSelected] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

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

  const handleAddItem = () => {
    if (profileInput.trim()) {
      setItems([...items, profileInput.trim()]);
      setprofileInput('');
    }
  };

  const handleTagPress = () => {
    setTagSelected(true);
    Animated.sequence([
      Animated.timing(moveMenu, {
        toValue: -160,
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
        {/* Replace this with a FlatList or mapped components */}
        <View style={styles.card}><Text>John Doe</Text></View>
        <View style={styles.card}><Text>Jane Smith</Text></View>
      </View>

      {/* Group Profiles Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Profiles</Text>
        {/* Replace this with your group data */}
        <View style={styles.card}><Text>Family Group</Text></View>
        <View style={styles.card}><Text>Work Team</Text></View>
      </View>
      </ScrollView>

      {/* Button at the bottom end of flex layout */}
      <View style={styles.buttonContainer}>
        <Pressable onPress={() => setprofileName(true)} style={styles.button}>
        <Text style={styles.continueButtonText}>+</Text>
      </Pressable>
      </View>
    </View>
      <Modal transparent visible={profileName} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Text style={styles.nameText}>What is their name?</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setnameInput}
              placeholder="Name"
            />
            <Text style={styles.label}>Items:</Text>
            <FlatList
              data={items}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => <Text style={styles.listItem}>• {item}</Text>}
              ListEmptyComponent={<Text style={styles.emptyText}>No items yet</Text>}
              style={{ maxHeight: 100 }}
            />
            <Pressable onPress={() => setNestedVisible(true)} style={styles.secondaryButton}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
            <Pressable onPress={() => setprofileName(false)} style={styles.closeButton}>
              <Text style={styles.continueButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={nestedVisible} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Animated.View style={{ transform: [{ translateY: moveMenu }] }}>
              <Text style={styles.nameText}>What is {nameInput}'s dietary restrictions?</Text>
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

            <Pressable onPress={() => setNestedVisible(false)} style={styles.secondaryButton}>
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
  color: '#fff',
},

});
