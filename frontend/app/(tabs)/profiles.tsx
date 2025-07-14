import React from 'react';
import { ScrollView, StyleSheet, Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function Screen() {
  return (
    <View style={styles.container}>
      <ScrollView>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Profiles</ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <ThemedView style={styles.text}>
          <ThemedText>This screen is under construction.</ThemedText>
        </ThemedView>
      </ScrollView>

      <Pressable style={styles.floatingButton} onPress={() => console.log('Button pressed')}>
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
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
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
  },
});
