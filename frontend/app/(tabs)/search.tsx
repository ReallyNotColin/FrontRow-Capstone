import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView, StyleSheet } from 'react-native';

export default function SearchScreen() {
  const [barcode, setBarcode] = useState('');
  const [foodId, setFoodId] = useState('');
  const [barcodeResult, setBarcodeResult] = useState('');
  const [foodResult, setFoodResult] = useState('');

  const lookupBarcode = async () => {
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/lookup-food-id?barcode=${barcode}`);
      const data = await res.json();
      setBarcodeResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setBarcodeResult('Error retrieving food ID');
    }
  };

  const lookupFood = async () => {
    try {
      const res = await fetch(`https://frontrow-capstone.onrender.com/food-details?food_id=${foodId}`);
      const data = await res.json();
      setFoodResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setFoodResult('Error retrieving food details');
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
      />
      <Button title="Submit Barcode" onPress={lookupBarcode} />
      <Text style={styles.result}>{barcodeResult}</Text>

      <Text style={styles.heading}>Lookup Food ID → Details</Text>
      <TextInput
        placeholder="Enter food_id"
        value={foodId}
        onChangeText={setFoodId}
        style={styles.input}
      />
      <Button title="Submit Food ID" onPress={lookupFood} />
      <Text style={styles.result}>{foodResult}</Text>
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
});
