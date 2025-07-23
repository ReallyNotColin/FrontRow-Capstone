import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

function calculateCheckDigit(upc: string): string {
  let sum = 0;
  for (let i = 0; i < upc.length; i++) {
    const digit = parseInt(upc[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const mod = sum % 10;
  return mod === 0 ? '0' : String(10 - mod);
}

function convertUPCEtoUPCA(upce: string): string {
  if (upce.length !== 8 || !/^\d+$/.test(upce)) return upce;

  const numberSystem = upce[0];
  const manufacturer = upce.slice(1, 7);
  const lastDigit = manufacturer[5];
  let upca = '';

  switch (lastDigit) {
    case '0':
    case '1':
    case '2':
      upca = manufacturer.slice(0, 2) + lastDigit + '0000' + manufacturer.slice(2, 5);
      break;
    case '3':
      upca = manufacturer.slice(0, 3) + '00000' + manufacturer.slice(3, 5);
      break;
    case '4':
      upca = manufacturer.slice(0, 4) + '00000' + manufacturer[4];
      break;
    default:
      upca = manufacturer.slice(0, 5) + '0000' + lastDigit;
  }

  const fullUPC = numberSystem + upca;
  return fullUPC + calculateCheckDigit(fullUPC);
}

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);

  const handleBarcodeScanned = ({ data, type }: { data: string, type: string }) => {
    setScanned(true);

    let finalData = data;
    if (type === 'upc_e') {
      finalData = convertUPCEtoUPCA(data);
    }

    setScannedData(finalData);
    console.log('Scanned:', finalData);
  };

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

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.text}> </Text>
        <Text style={styles.text}>Place barcode here</Text>
        {scannedData && (
          <Text style={[styles.text, { marginTop: 20 }]}>
            Scanned: {scannedData}
          </Text>
        )}
      </View>

      {scanned && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={() => {
            setScanned(false);
            setScannedData(null);
          }}>
            <Text style={styles.text}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
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
    textAlign: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 300,
    height: 200,
    borderWidth: 4,
    borderColor: 'white',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
});

