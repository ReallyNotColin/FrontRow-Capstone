import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// COLIN: Import for text input, button, and alert (which alert should probably be replaced with the actual API from fatsecret later)
import React, { useState } from 'react';
import { TextInput, Button, Alert } from 'react-native';

const [inputValue, setInputValue] = useState('');
const [foodData, setFoodData] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');


export default function HomeScreen() {

  const callBarcodeLookup = async () => {
  setLoading(true);
  setError('');
  setFoodData(null);

  try {
    const response = await fetch(`https://frontrow-capstone.onrender.com/lookup-food_id?barcode=${inputValue}`);
    if (!response.ok) {
      const text = await response.text();
      console.error('Unexpected response:', text);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    setFoodData(data.food); // API should return { food: {...} }
  } catch (err) {
    setError('Failed to fetch food details. Try another barcode.');
    console.error('Error fetching barcode:', err);
  } finally {
    setLoading(false);
  }
};



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
        onPress={callBarcodeLookup}
      />



      {loading && <Text>Loading...</Text>}

      {error.length > 0 && (
        <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>
      )}

      {foodData && (
        <View style={{ marginTop: 20, padding: 12, borderWidth: 1, borderRadius: 8 }}>
          {foodData.food_image && (
            <Image
              source={{ uri: foodData.food_image }}
              style={{ width: '100%', height: 200, resizeMode: 'contain', marginBottom: 12 }}
            />
          )}
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{foodData.food_name}</Text>
          <Text style={{ fontStyle: 'italic', marginVertical: 4 }}>
            {foodData.food_type} {foodData.brand_name ? `— ${foodData.brand_name}` : ''}
          </Text>
          <ScrollView style={{ maxHeight: 200, marginTop: 8 }}>
            <Text>{JSON.stringify(foodData, null, 2)}</Text>
          </ScrollView>
        </View>
      )}
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
