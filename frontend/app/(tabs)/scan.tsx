import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Button, StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BlurView } from 'expo-blur';
import { saveToHistory } from '@/db/history';

// 🔁 Firestore
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ensureAnonAuth, db } from '@/db/firebaseConfig';

// --- helpers (unchanged) ---
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
  let upcaWithoutCheckDigit = '';

  switch (lastDigit) {
    case '0':
    case '1':
    case '2':
      upcaWithoutCheckDigit = manufacturer.slice(0, 2) + lastDigit + '0000' + manufacturer.slice(2, 5);
      break;
    case '3':
      upcaWithoutCheckDigit = manufacturer.slice(0, 3) + '00000' + manufacturer.slice(3, 5);
      break;
    case '4':
      upcaWithoutCheckDigit = manufacturer.slice(0, 4) + '00000' + manufacturer[4];
      break;
    default:
      upcaWithoutCheckDigit = manufacturer.slice(0, 5) + '0000' + lastDigit;
  }

  const upca11 = numberSystem + upcaWithoutCheckDigit; // 11 digits without check digit
  const checkDigit = calculateCheckDigit(upca11); // calculate check digit for UPC-A

  return upca11 + checkDigit; // return full 12-digit UPC-A
}

// Parse comma-separated warning string to FatSecret-like structure
const parseWarning = (warning?: string) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

// Build a FatSecret-shaped data object from Firestore doc for UI compatibility
const toFoodDetailsShape = (docData: any) => ({
  food: {
    food_name: docData.food_name || 'Unknown food',
    brand_name: docData.brand_name || '',
    food_attributes: {
      allergens: {
        allergen: parseWarning(docData.warning), // reuse UI allergen rendering
      },
    },
  },
});

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [foodDetails, setFoodDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Try multiple barcode normalizations to improve hit rate
  const findByBarcode = async (barcode: string) => {
    // Primary: exact match (your CSV import likely used 13-digit strings)
    let tries = [barcode];

    // Also try without a leading zero & last 12 digits (UPC-A vs EAN-13 quirks)
    if (barcode.startsWith('0')) tries.push(barcode.slice(1));
    if (barcode.length === 13) tries.push(barcode.slice(1)); // last 12 as UPC-A

    for (const b of tries) {
      const qRef = query(collection(db, 'Products'), where('barcode', '==', b));
      const snap = await getDocs(qRef);
      if (!snap.empty) return snap.docs[0].data();
    }
    return null;
  };

  const fetchFoodDetailsByBarcode = async (barcode: string) => {
    setLoadingDetails(true);
    try {
      await ensureAnonAuth(); // ✅ required for rules

      const docData = await findByBarcode(barcode);
      if (!docData) {
        console.warn('No Firestore document found for barcode:', barcode);
        setFoodDetails(null);
        setModalVisible(true);
        return;
      }

      const details = toFoodDetailsShape(docData);
      setFoodDetails(details);

      // Build history payload
      const foodName = details.food?.food_name || 'Unknown food';
      const allergensArray =
        details.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== '0') || [];
      const allergensString = allergensArray.map((a: any) => a.name).join(', ');

      const userAllergenProfile = ['Milk', 'Egg', 'Peanuts'];
      const matchedAllergens = allergensArray
        .map((a: any) => a.name)
        .filter((name: string) => userAllergenProfile.includes(name));
      const matchedString = matchedAllergens.join(', ');

      try {
        await saveToHistory(foodName, allergensString, matchedString);
        console.log('Successfully saved to history');
      } catch (saveError) {
        console.error('Error saving to history:', saveError);
      }

      setModalVisible(true);
    } catch (err) {
      console.error('Error fetching food details:', err);
      setFoodDetails(null);
      setModalVisible(true);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toGTIN13 = (barcode: string): string => {
    return barcode.padStart(13, '0');
  };

  const handleBarcodeScanned = async ({ data, type }: { data: string; type: string }) => {
    setScanned(true);

    let finalData = data;
    if (type === 'upc_e') {
      finalData = convertUPCEtoUPCA(data);
    }

    const gtin13 = toGTIN13(finalData);
    setScannedData(gtin13);
    await fetchFoodDetailsByBarcode(gtin13);
  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData(null);
    setFoodDetails(null);
    setModalVisible(false);
  };

  if (!permission) return <View />;

  if (!permission.granted) {
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

  const allergens =
    foodDetails?.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== '0') || [];

  const userAllergenProfile = ['Milk', 'Egg', 'Peanuts'];
  const matchedAllergens = allergens
    .map((a: any) => a.name)
    .filter((name: string) => userAllergenProfile.includes(name));
  const matchedString = matchedAllergens.join(', ');

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

        {loadingDetails && (
          <Text style={[styles.text, { marginTop: 20 }]}>Loading details...</Text>
        )}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Results</Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              {foodDetails?.food ? (
                <>
                  <Text style={styles.productName}>
                    {foodDetails.food.food_name}
                  </Text>

                  {foodDetails.food.brand_name && (
                    <Text style={styles.brandName}>
                      by {foodDetails.food.brand_name}
                    </Text>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Warnings</Text>
                    {allergens.length > 0 ? (
                      <View style={styles.allergenContainer}>
                        {allergens.map((a: any, i: number) => (
                          <View key={i} style={styles.allergenTag}>
                            <Text style={styles.allergenText}>{a.name}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.sectionText}>No warnings found</Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.errorText}>No food data found for this barcode.</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={resetScanner}
              >
                <Text style={styles.actionButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 20,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  allergenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  allergenTag: {
    backgroundColor: '#FF4D4D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  allergenText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
