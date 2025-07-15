import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) 
    // Camera permissions are still loading.
    return <View />;

  if (!permission.granted) {
     // Camera permissions are not granted yet.
    return (
      <View style={styles.permissionContainer}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Scan</ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <ThemedView style={styles.textContainer}>
          <ThemedText>
            We need your permission to access the camera in order to scan barcodes.
          </ThemedText>
          <View style={styles.buttonWrapper}>
            <Button onPress={requestPermission} title="Grant Permission" />
          </View>
        </ThemedView>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing={facing} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
          <Text style={styles.text}>Flip Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: 'transparent',
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
  textContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
  buttonWrapper: {
    marginTop: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#00000088',
    padding: 12,
    borderRadius: 8,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    paddingBottom: Platform.OS === 'ios' ? 50 : 0,
  },
});
