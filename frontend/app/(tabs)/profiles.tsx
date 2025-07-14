import React, { useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Platform, ScrollView, View, Text, Modal, TextInput, Pressable, FlatList, StyleSheet,} from 'react-native';

export default function Profile() {
  const [mainVisible, setMainVisible] = useState(false);
  const [nestedVisible, setNestedVisible] = useState(false);
  const [mainInput, setMainInput] = useState('');
  const [nestedInput, setNestedInput] = useState('');
  const [items, setItems] = useState<string[]>([]);

  const handleAddItem = () => {
    if (nestedInput.trim()) {
      setItems([...items, nestedInput.trim()]);
      setNestedInput('');
    }
  };

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
        <Pressable onPress={() => setMainVisible(true)} style={styles.button}>
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
      </View>
    </View>
      <Modal transparent visible={mainVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Text>Main Input:</Text>
            <TextInput
              style={styles.input}
              value={mainInput}
              onChangeText={setMainInput}
              placeholder="Main value"
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
              <Text style={styles.buttonText}>Add Item</Text>
            </Pressable>
            <Pressable onPress={() => setMainVisible(false)} style={styles.closeButton}>
              <Text style={styles.buttonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={nestedVisible} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Text>Nested Input:</Text>
            <TextInput
              style={styles.input}
              value={nestedInput}
              onChangeText={setNestedInput}
              placeholder="Add item"
            />
            <Pressable onPress={handleAddItem} style={styles.secondaryButton}>
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
            <Pressable onPress={() => setNestedVisible(false)} style={styles.closeButton}>
              <Text style={styles.buttonText}>Done</Text>
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
  buttonText: {
    color: '#fff',
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
    padding: 12, borderRadius: 8 
  },
  secondaryButton: {
    backgroundColor: '#34C759',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalView: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: 300,
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 6,
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
});
