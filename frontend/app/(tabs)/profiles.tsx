import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function Screen() {
  const [profiles, setProfiles] = useState([]);
  const [groupProfiles, setGroupProfiles] = useState([]);

  return (
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
        <Pressable style={styles.button} onPress={() => console.log('Pressed')}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  card: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
});
