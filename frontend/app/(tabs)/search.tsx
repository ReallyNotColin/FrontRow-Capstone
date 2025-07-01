import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// COLIN: Import for text input, button, and alert (which alert should probably be replaced with the actual API from fatsecret later)
import React, { useState } from 'react';
import { TextInput, Button, Alert } from 'react-native';

export default function HomeScreen() {

  const [inputValue, setInputValue] = useState('');

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.stepContainer}>
      <ThemedText type="subtitle">Try an API call</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Enter something..."
        value={inputValue}
        onChangeText={setInputValue}
      />
      <Button
        title="Submit"
        onPress={() => {
          // COLIN: Replace this alert with the actual API call later
          Alert.alert('Input Submitted', `You entered: ${inputValue}`);
        }}
      />
    </ThemedView>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },

});
