import { View, Text, StyleSheet } from 'react-native';

export default function CreateCustomEntryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Custom Entry</Text>
      {/* Add your input fields and logic here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
