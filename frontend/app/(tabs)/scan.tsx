// app/(tabs)/scan.tsx
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Platform, Button, StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, Pressable } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BlurView } from 'expo-blur';
import { saveToHistory } from '@/db/history';

import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/db/firebaseConfig';

import { compareProductToProfile, buildProductFromFirestoreDoc, type ProductDoc } from '@/db/compare';

type ProfileChoice = {
  id: string;
  name: string;
  data: { allergens: string[]; intolerances: string[]; dietary: string[] };
};

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

  const upca11 = numberSystem + upcaWithoutCheckDigit;
  const checkDigit = calculateCheckDigit(upca11);
  return upca11 + checkDigit;
}

const parseWarning = (warning?: string) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

const toFoodDetailsShape = (docData: any) => ({
  food: {
    food_name: docData.food_name || 'Unknown food',
    brand_name: docData.brand_name || '',
    food_attributes: {
      allergens: {
        allergen: parseWarning(docData.warning),
      },
    },
  },
});

// ---- NEW: live profiles + picker ----
function ProfilePickerModal({
  visible,
  profiles,
  onCancel,
  onPick,
}: {
  visible: boolean;
  profiles: ProfileChoice[];
  onCancel: () => void;
  onPick: (p: ProfileChoice) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.ppOverlay}>
        <View style={styles.ppBox}>
          <Text style={styles.ppTitle}>Choose a profile</Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {profiles.map(p => (
              <Pressable key={p.id} style={styles.ppItem} onPress={() => onPick(p)}>
                <Text style={styles.ppItemText}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.ppCancel} onPress={onCancel}>
            <Text style={styles.ppCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [foodDetails, setFoodDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [compareLines, setCompareLines] = useState<string[]>([]);

  const [profiles, setProfiles] = useState<ProfileChoice[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    displayName: string;
    product: ProductDoc;
    warningsString: string;
  } | null>(null);

  // Subscribe to profiles
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'profiles');
    const unsub = onSnapshot(ref, (snap) => {
      const arr: ProfileChoice[] = [];
      let idx = 1;
      snap.forEach(docSnap => {
        const d = docSnap.data() as any;
        arr.push({
          id: docSnap.id,
          name: d.name || d.profileName || `Profile ${idx++}`,
          data: {
            allergens: Array.isArray(d.allergens) ? d.allergens : [],
            intolerances: Array.isArray(d.intolerances) ? d.intolerances : [],
            dietary: Array.isArray(d.dietary) ? d.dietary : [],
          },
        });
      });
      setProfiles(arr);
    });
    return unsub;
  }, []);

  const findByBarcode = async (barcode: string) => {
    let tries = [barcode.trim()];
    if (barcode.startsWith('0')) tries.push(barcode.slice(1));
    if (barcode.length === 13) tries.push(barcode.slice(1));

    for (const b of tries) {
      const qRef = query(collection(db, 'Products'), where('barcode', '==', b));
      const snap = await getDocs(qRef);
      if (!snap.empty) return snap.docs[0].data();
    }
    return null;
  };

  const runCompareAndHistory = async (
    displayName: string,
    product: ProductDoc,
    warningsString: string,
    profileData: { allergens: string[]; intolerances: string[]; dietary: string[] } | null,
    profileName: string | null
  ) => {
    let matchedSummary = '';
    if (profileData) {
      const cmp = compareProductToProfile(product, profileData);
      const lines = [...cmp.summary.allergens, ...cmp.summary.intolerances, ...cmp.summary.dietary];
      setCompareLines(lines);
      matchedSummary = lines.join('; ');
    } else {
      setCompareLines([]);
    }
    const matchedWithProfile = profileName ? `${matchedSummary}${matchedSummary ? ' ' : ''}[Profile: ${profileName}]` : matchedSummary;

    try {
      await saveToHistory(displayName, warningsString, matchedWithProfile);
    } catch (saveError) {
      console.error('Error saving to history:', saveError);
    }

    setModalVisible(true);
  };

  const ensureProfileThenCompare = async (displayName: string, product: ProductDoc, warningsString: string) => {
    if (profiles.length <= 1) {
      const chosen = profiles[0] ?? null;
      await runCompareAndHistory(displayName, product, warningsString, chosen?.data ?? null, chosen?.name ?? null);
    } else {
      setPendingProduct({ displayName, product, warningsString });
      setPickerVisible(true);
    }
  };

  const fetchFoodDetailsByBarcode = async (barcode: string) => {
    setLoadingDetails(true);
    try {
      const docData = await findByBarcode(barcode);
      if (!docData) {
        console.warn('No Firestore document found for barcode:', barcode);
        setFoodDetails(null);
        setCompareLines([]);
        setModalVisible(true);
        return;
      }

      const details = toFoodDetailsShape(docData);
      setFoodDetails(details);

      const product = buildProductFromFirestoreDoc(docData);
      const foodName = details.food?.food_name || 'Unknown food';
      const allergensArray =
        details.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== '0') || [];
      const allergensString = allergensArray.map((a: any) => a.name).join(', ');

      await ensureProfileThenCompare(foodName, product, allergensString);
    } catch (err) {
      console.error('Error fetching food details:', err);
      setFoodDetails(null);
      setCompareLines([]);
      setModalVisible(true);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toGTIN13 = (barcode: string): string => barcode.padStart(13, '0');

  const handleBarcodeScanned = async ({ data, type }: { data: string; type: string }) => {
    setScanned(true);

    let finalData = data;
    if (type === 'upc_e') finalData = convertUPCEtoUPCA(data);

    const gtin13 = toGTIN13(finalData);
    setScannedData(gtin13);
    await fetchFoodDetailsByBarcode(gtin13);
  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData(null);
    setFoodDetails(null);
    setCompareLines([]);
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

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'] }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.text}> </Text>
        <ThemedText style={styles.text}>Place barcode here</ThemedText>

        {loadingDetails && <Text style={[styles.text, { marginTop: 20 }]}>Loading details...</Text>}
      </View>

      {/* Results modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Results</Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              {foodDetails?.food ? (
                <>
                  <Text style={styles.productName}>{foodDetails.food.food_name}</Text>
                  {foodDetails.food.brand_name && <Text style={styles.brandName}>by {foodDetails.food.brand_name}</Text>}

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

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Matches with Selected Profile</Text>
                    {compareLines.length > 0 ? (
                      compareLines.map((line, idx) => (
                        <Text key={idx} style={styles.sectionText}>• {line}</Text>
                      ))
                    ) : (
                      <Text style={styles.sectionText}>None 🎉</Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.errorText}>No food data found for this barcode.</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionButton} onPress={resetScanner}>
                <Text style={styles.actionButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Profile Picker */}
      <ProfilePickerModal
        visible={pickerVisible}
        profiles={profiles}
        onCancel={() => { setPickerVisible(false); setPendingProduct(null); }}
        onPick={async (p) => {
          setPickerVisible(false);
          if (pendingProduct) {
            const { displayName, product, warningsString } = pendingProduct;
            setPendingProduct(null);
            await runCompareAndHistory(displayName, product, warningsString, p.data, p.name);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  permissionContainer: { 
    flex: 1, 
    backgroundColor: 'transparent' },

  titleContainer: { 
    paddingTop: 60, 
    paddingBottom: 10, 
    paddingHorizontal: 24 },

  divider: { 
    height: 2, 
    backgroundColor: '#E5E5EA', 
    marginBottom: 16, 
    width: '100%' },

  textContainer: {
     backgroundColor: 'transparent', 
    paddingHorizontal: 24 },

  buttonWrapper: { marginTop: 16 },

  text: { 
    fontWeight: 'bold', 
    color: 'white', 
    textAlign: 'center', 
    paddingBottom: Platform.OS === 'ios' ? 50 : 0 },

  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center' },

  scanBox: { 
    width: 300, 
    height: 200, 
    borderWidth: 4, 
    borderColor: 'white', 
    borderRadius: 10, 
    backgroundColor: 'transparent' },

  // results modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' },

  modalContent: { 
    backgroundColor: 'white', 
    borderRadius: 20, width: '90%', 
    maxHeight: '80%', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 4, 
    elevation: 5 },

  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0' },

  modalTitle: { 
    fontSize: 30, 
    fontWeight: 'bold', 
    color: '#333' },

  modalScroll: { padding: 20 },

  productName: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 8 },

  brandName: { 
    fontSize: 16, 
    color: '#666', 
    marginBottom: 20, 
    fontStyle: 'italic' },

  section: { marginBottom: 20 },

  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 8 },

  sectionText: { 
    fontSize: 14, 
    color: '#666', 
    lineHeight: 20 },

  allergenContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginTop: 8 },

  allergenTag: { 
    backgroundColor: '#FF4D4D', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 15,
     marginRight: 8, 
     marginBottom: 8 },

  allergenText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: '600' },

  errorText: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    marginTop: 20 },

  modalActions: { 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: '#e0e0e0' },

  actionButton: { 
    backgroundColor: '#007AFF', 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center' },

  actionButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '600' },

  // profile picker
  ppOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' },

  ppBox: { 
    width: '85%', 
    backgroundColor: '#fff', 
    padding: 18, borderRadius: 12 },

  ppTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 12 },

  ppItem: { 
    paddingVertical: 10, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderBottomColor: '#ddd' },

  ppItemText: { fontSize: 16 },
  ppCancel: { 
    marginTop: 12, 
    alignSelf: 'flex-end', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    backgroundColor: '#eee', 
    borderRadius: 8 },

  ppCancelText: { 
    color: '#333', 
    fontWeight: '600' },
});
