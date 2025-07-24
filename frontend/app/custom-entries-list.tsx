import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { searchCustomEntries, deleteCustomEntry } from '@/db/customFoods';

export default function CustomEntriesListScreen() {
  const [entries, setEntries] = useState([]);
  const navigation = useNavigation();

  const loadEntries = async () => {
    try {
      const results = await searchCustomEntries('');
      setEntries(results);
    } catch (error) {
      console.error('Failed to load custom entries:', error);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this custom entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomEntry(id);
            await loadEntries(); // Refresh the list
          },
        },
      ]
    );
  };

  const handleEdit = (entry) => {
    navigation.navigate('create-custom-entry', { entry });
   };

  const renderItem = ({ item }) => (
    <View style={styles.entryCard}>
      <Text style={styles.name}>{item.food_name}</Text>
      {item.barcode ? <Text style={styles.subtext}>Barcode: {item.barcode}</Text> : null}
      {item.allergens ? <Text style={styles.subtext}>Allergens: {item.allergens}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.editButton} onPress={() => handleEdit(item)}>
          <Text style={styles.buttonText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <Text style={styles.buttonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Custom Entries</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  list: {
    paddingBottom: 80,
  },
  entryCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
  },
  backButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#007BFF',
    borderRadius: 6,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
