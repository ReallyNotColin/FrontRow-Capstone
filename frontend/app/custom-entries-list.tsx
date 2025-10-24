import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { searchCustomEntries, deleteCustomEntry } from '@/db/customFoods';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemedColor } from '@/components/ThemedColor';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function CustomEntriesListScreen() {
  const [entries, setEntries] = useState([]);
  const navigation = useNavigation();
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;
  
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
            await loadEntries();
          },
        },
      ]
    );
  };

  const handleEdit = (entry) => {
    navigation.navigate('create-custom-entry' as never, { entry } as never);
  };

  const goBackToSearch = () => {
    if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('search' as never);
  };

    const renderItem = ({ item }) => (
    <View style={[styles.entryCard, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
      <ThemedText type = 'header' style={[styles.name, { color: activeColors.text }]}>{item.food_name}</ThemedText>
      {item.barcode ? (
        <ThemedText type = 'default' style={[styles.subtext, { color: activeColors.secondaryText }]}>
          Barcode: {item.barcode}
        </ThemedText>
      ) : null}
      {item.allergens ? (
        <ThemedText style={[styles.subtext, { color: activeColors.secondaryText }]}>
          Allergens: {item.allergens}
        </ThemedText>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.editButton} onPress={() => handleEdit(item)}>
          <ThemedText style={styles.buttonText}>Edit</ThemedText>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <ThemedText style={styles.buttonText}>Delete</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
<<<<<<< Updated upstream
    <LinearGradient colors={activeColors.gradientBackground} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
      <ThemedView style={styles.container}>
        <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Ionicons name="arrow-back" size={28} color={activeColors.text} />
            </TouchableOpacity>
            <ThemedText type="subtitle" style={{ color: activeColors.text }}>
              Your Custom Entries
            </ThemedText>
          </View>
        </ThemedView>
        <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />
        
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          style={{ backgroundColor: 'transparent' }}
        />
      </ThemedView>
    </LinearGradient>
=======
    <View style={styles.container}>
      {/* NEW: Back to Search */}
      <Pressable onPress={goBackToSearch} style={[styles.backButton, { alignSelf: 'flex-start', marginTop: 40 }]}>
        <Text style={styles.backButtonText}>{'\u2039'} Back </Text>
      </Pressable>

      <Text style={styles.title}>Your Custom Entries</Text>

      <FlatList
        data={entries}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
>>>>>>> Stashed changes
  );
}


const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
<<<<<<< Updated upstream
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    paddingTop: 70,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  divider: {
    height: 2,
    width: '100%',
    marginBottom: 16,
=======
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 12,
>>>>>>> Stashed changes
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  entryCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  name: {
    fontWeight: '600',
  },
  subtext: {
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#477629',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#c23b22',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
  },
<<<<<<< Updated upstream
});
=======

  // already in your file, reused:
  backButton: {
    marginTop: 20,
    padding: 6,
    backgroundColor: '#007BFF',
    borderRadius: 3,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 12,
  },
});
>>>>>>> Stashed changes
