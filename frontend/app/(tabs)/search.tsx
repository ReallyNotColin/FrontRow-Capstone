import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView, StyleSheet, Image } from 'react-native';

export default function SearchScreen() {
  const [barcode, setBarcode] = useState('');
  const [foodId, setFoodId] = useState('');
  const [barcodeResult, setBarcodeResult] = useState('');
  const [foodResult, setFoodResult] = useState<any>(null);
  const [error, setError] = useState('');

  const lookupBarcode = async () => {
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/lookup-food-id?barcode=${barcode}`);
      const data = await res.json();
      setBarcodeResult(JSON.stringify(data, null, 2));

      // Try to auto-fill the food_id if found
      const id = data?.food_id || data?.food?.food_id;
      if (id) {
        setFoodId(id.toString());
      }
    } catch (err) {
      setBarcodeResult('Error retrieving food ID');
    }
  };

  const lookupFood = async () => {
    try {
      setError('');
      const res = await fetch(`https://frontrow-capstone.onrender.com/food-details?food_id=${foodId}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setFoodResult(null);
      } else {
        setFoodResult(data.food); // store as object
      }
    } catch (err) {
      setError('Error retrieving food details');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Lookup Barcode → Food ID</Text>
      <TextInput
        placeholder="Enter 13-digit barcode"
        value={barcode}
        onChangeText={setBarcode}
        style={styles.input}
        keyboardType="numeric"
      />
      <Button title="Submit Barcode" onPress={lookupBarcode} />
      <Text style={styles.result}>{barcodeResult}</Text>

      <Text style={styles.heading}>Lookup Food ID → Details</Text>
      <TextInput
        placeholder="Enter food_id"
        value={foodId}
        onChangeText={setFoodId}
        style={styles.input}
        keyboardType="numeric"
      />
      <Button title="Submit Food ID" onPress={lookupFood} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {foodResult && (
        <View style={styles.card}>
          {foodResult.food_image ? (
            <Image
              source={{ uri: foodResult.food_image }}
              style={{ width: '100%', height: 200, resizeMode: 'contain', marginBottom: 12 }}
            />
          ) : (
            <Text style={styles.imageNote}>[No image provided]</Text>
          )}
          <Text style={styles.title}>{foodResult.food_name}</Text>
          <Text style={styles.subtitle}>
            {foodResult.food_type}
            {foodResult.brand_name ? ` — ${foodResult.brand_name}` : ''}
          </Text>
          <ScrollView style={{ maxHeight: 200 }}>
            <Text selectable>{JSON.stringify(foodResult, null, 2)}</Text>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    padding: 8,
    borderRadius: 6,
  },
  result: {
    marginTop: 10,
    backgroundColor: '#eee',
    padding: 10,
    fontFamily: 'monospace',
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
  card: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 12,
  },
  imageNote: {
    fontStyle: 'italic',
    color: '#aaa',
    marginBottom: 10,
  },
});
