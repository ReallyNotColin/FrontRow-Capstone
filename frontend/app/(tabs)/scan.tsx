// app/(tabs)/scan.tsx
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useEffect, useState, useCallback } from 'react';
import { Platform, Button, StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, Pressable, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BlurView } from 'expo-blur';
import { saveToHistory, saveToResults } from '@/db/history';
import { useRouter } from 'expo-router';
import { useFocusEffect } from "@react-navigation/native";
import { useThemedColor } from '@/components/ThemedColor';
import { LinearGradient } from "expo-linear-gradient";
import LottieView from 'lottie-react-native';

import { collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/db/firebaseConfig';

import { compareProductToProfile, buildProductFromFirestoreDoc, type ProductDoc, compareProductAgainstPetProfile, type PetProfileInput } from '@/db/compare';

type ProfileChoice = {
  id: string;
  name: string;
  data: { allergens: string[]; intolerances: string[]; dietary: string[] };
};

type GroupChoice = {
  id: string;
  name: string;
  members: string[];
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
function summarizePetCompare(
  displayName: string,
  result: ReturnType<typeof compareProductAgainstPetProfile>,
  profileName: string
) {
  if (result.matches.length === 0) return '';
  const parts = result.matches.map(
    m => `${m.allergen} via ${m.matchedBy}${m.evidence ? ` (“${m.evidence}”)` : ''}`
  );
  return `${parts.join('; ')} [Profile: ${profileName}]`;
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

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [foodDetails, setFoodDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const { activeColors } = useThemedColor();

  const [compareLines, setCompareLines] = useState<string[]>([]);

  const [profiles, setProfiles] = useState<ProfileChoice[]>([]);
  const [pets, setPets] = useState<ProfileChoice[]>([]);
  const [groups, setGroups] = useState<GroupChoice[]>([]);
  const { isDarkMode } = useThemedColor();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    displayName: string;
    product: ProductDoc;
    warningsString: string;
  } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<{
  type: 'profile' | 'pet' | 'group';
  data: ProfileChoice | GroupChoice;} | null>(null);

  // Subscribe to profiles
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'profiles');
    const refGroup = collection(db, 'users', uid, 'groups');
    const refPet = collection(db, 'users', uid, 'pets');
    
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
    
    const unsubPet = onSnapshot(refPet, (snap) => {
      const arr: ProfileChoice[] = [];
      let idx = 1;
      snap.forEach(docSnap => {
        const d = docSnap.data() as any;
        arr.push({
          id: docSnap.id,
          name: d.name || `Pet ${idx++}`,
          data: {
            allergens: Array.isArray(d.allergens) ? d.allergens : [],
            intolerances: Array.isArray(d.intolerances) ? d.intolerances : [],
            dietary: Array.isArray(d.dietary) ? d.dietary : [],
          },
        });
      });
      setPets(arr);
    });

    const unsubGroup = onSnapshot(refGroup, (snap) => {
      const arr: GroupChoice[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data() as any;
        const memberNames: string[] = Array.isArray(d.members) ? d.members : [];
        arr.push({
          id: docSnap.id,
          name: d.name,
          members: memberNames,
        });
      });
      setGroups(arr);
    });
    return () => {
      unsub();
      unsubPet();
      unsubGroup();
    };
  }, [profiles]);

 // -------- PET COMPARE HELPERS (NEW) --------
const norm = (s?: string) => (s ?? "").toString().toLowerCase().trim();
const splitCSV = (s?: string) =>
  norm(s)
    .split(/[,\n;]/g)
    .map(t => t.trim())
    .filter(Boolean);

// Expand as needed
const PET_SYNONYMS: Record<string, string[]> = {
  dairy: ["milk", "cream", "cheese", "whey", "casein", "butter", "yogurt"],
  eggs: ["egg", "egg yolk", "albumen"],
  fish: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine"],
  beef: ["beef"],
  chicken: ["chicken"],
  lamb: ["lamb", "mutton"],
  wheat: ["wheat", "graham", "semolina", "farina"],
  corn: ["corn", "maize", "cornstarch"],
  soy: ["soy", "soya", "soy lecithin", "soybean"],
};

/**
 * Compare product ingredients/warnings against a pet allergen list.
 * Returns { ok, matches[], summaryLabel }
 */
function comparePetProduct(
  product: { ingredients?: string; warning?: string },
  petAllergens: string[] = []
) {
  const ingredients = norm(product.ingredients);
  const warningList = splitCSV(product.warning);

  const wanted = new Set<string>();
  for (const raw of petAllergens) {
    const key = norm(raw);
    if (!key) continue;
    wanted.add(key);
    (PET_SYNONYMS[key] ?? []).forEach(a => wanted.add(a));
  }

  const found = new Set<string>();

  // Exact matches against warning CSV
  for (const w of warningList) {
    if (wanted.has(w)) found.add(w);
  }

  // Substring search in free-text ingredients
  for (const t of wanted) {
    if (t && ingredients.includes(t)) found.add(t);
  }

  const matches = Array.from(found);
  const ok = matches.length === 0;
  const summaryLabel = ok
    ? "No pet allergen matches"
    : `Pet allergen matches: ${matches.join(", ")}`;

  return { ok, matches, summaryLabel };
}


   // Try multiple barcode normalizations to improve hit rate
  const findByBarcode = async (barcode: string) => {
    // Primary: exact match (your CSV import likely used 13-digit strings)
    let tries = [barcode.trim()];
    
    // Also try without a leading zero & last 12 digits (UPC-A vs EAN-13 quirks)
    if (barcode.startsWith('0')) tries.push(barcode.slice(1));
    if (barcode.length === 13) tries.push(barcode.slice(1));

    for (const b of tries) {
      const qRef = query(collection(db, 'Products'), where('barcode', '==', b));
      const snap = await getDocs(qRef);
      if (!snap.empty) return snap.docs[0].data();
    }
    return null;
  };
  const findPetByBarcode = async (barcode: string) => {
    let tries = [barcode.trim()];
    if (barcode.startsWith('0')) tries.push(barcode.slice(1));
    if (barcode.length === 13) tries.push(barcode.slice(1));

    for (const b of tries) {
      const qRef = query(collection(db, 'PetProducts'), where('barcode', '==', b));
      const snap = await getDocs(qRef);
      if (!snap.empty) return snap.docs[0].data();
    }
    return null;
  };

  const runCompareAndHistory = async (
    displayName: string,
    product: ProductDoc,
    warningsString: string,
    profileData: 
      | { allergens: string[]; intolerances: string[]; dietary: string[] } 
      | { name: string; data: { allergens: string[]; intolerances: string[]; dietary: string[] } }[]
      | null,
    profileName: string | null
  ) => {
    let matchedSummary = '';
    let allCompareLines: string[] = [];

    const profilesArray =
      Array.isArray(profileData)
        ? profileData
        : profileData
        ? [{ name: profileName, data: profileData }]
        : [];

    for (const {name, data} of profilesArray) {
      const cmp = compareProductToProfile(product, data);
      const lines = [...cmp.summary.allergens, ...cmp.summary.intolerances, ...cmp.summary.dietary];

    if (lines.length > 0) {
      allCompareLines.push(...lines);
      const summary = `${lines.join('; ')} [Profile: ${name}]`;
      matchedSummary = matchedSummary
        ? `${matchedSummary} | ${summary}`
        : summary;
    }
  }
  setCompareLines(allCompareLines);
    let matchedWithProfile = matchedSummary;
    if (matchedSummary && profileName) {
    matchedWithProfile = `${matchedSummary} [Profile: ${profileName}]`;
  }
  
    try {
      await saveToHistory(displayName, warningsString, matchedWithProfile);
    } catch (saveError) {
      console.error('Error saving to history:', saveError);
    }
    
    try {
      await saveToResults(displayName, warningsString, matchedWithProfile);
    } catch (saveError) {
      console.error('Error saving to results:', saveError);
    }
    setModalVisible(true);
  };

// -------- PET COMPARE SAVE (REPLACE) --------
async function runCompareAndHistoryPet(
  displayName: string,
  product: ProductDoc,
  warningsString: string,
  pet: { name: string; data: { allergens: string[] } }
) {
  const { matches, summaryLabel } = comparePetProduct(
    { ingredients: product.ingredients, warning: warningsString },
    pet.data?.allergens ?? []
  );

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  // Build a normalized payload so History/Results can render matches
  const payload = {
    type: "pet",
    profileType: "pet",
    profileName: pet.name,
    productId: product.barcode?.trim() || (product as any).id || null,
    productName: displayName,
    matches,                    // <-- critical for History/Results list
    matchedAllergens: matches,  // <-- mirror key in case readers use this
    summaryLabel,               // <-- optional but useful for UI
    comparedAt: new Date().toISOString(),
    createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : null,
  };

  // Use your existing helpers if present; otherwise fall back to direct writes
  try {
    // @ts-ignore optional helper
    if (typeof addHistory === "function") await addHistory(uid, payload);
    else await addDoc(collection(db, "users", uid, "history"), payload);
  } catch {
    await addDoc(collection(db, "users", uid, "history"), payload);
  }

  try {
    // @ts-ignore optional helper
    if (typeof addResult === "function") await addResult(uid, payload);
    else await addDoc(collection(db, "users", uid, "results"), payload);
  } catch {
    await addDoc(collection(db, "users", uid, "results"), payload);
  }
}

type GroupMemberTyped = { name: string; kind: 'human' | 'pet' };

async function runCompareGroupMixed(
  displayName: string,
  product: ProductDoc,
  warningsString: string,
  groupMembers: GroupMemberTyped[],
  allHumanProfiles: { name: string; data: any }[],
  allPetProfiles: { name: string; data: { allergens: string[] } }[],
  runHuman: (displayName: string, product: ProductDoc, warningsString: string, members: any[], groupName: string | null) => Promise<void>,
  runPetOne: (displayName: string, product: ProductDoc, warningsString: string, pet: { name: string; data: { allergens: string[] } }) => Promise<void>
) {
  const humanNames = groupMembers.filter(m => m.kind === 'human').map(m => m.name);
  const petNames   = groupMembers.filter(m => m.kind === 'pet').map(m => m.name);

  const humanProfiles = allHumanProfiles.filter(p => humanNames.includes(p.name));
  const petProfiles   = allPetProfiles.filter(p => petNames.includes(p.name));

  // 1) Humans: single combined compare (your existing multi-member logic)
  if (humanProfiles.length > 0) {
    await runHuman(displayName, product, warningsString, humanProfiles, null);
  }

  // 2) Pets: run per pet profile and append their summaries/history
  for (const pet of petProfiles) {
    await runPetOne(displayName, product, warningsString, pet);
  }
}


  const ensureProfileThenCompare = async (displayName: string, product: ProductDoc, warningsString: string) => {
    if (selectedProfile) {
      if (selectedProfile.type === 'profile') {
        const profile = selectedProfile.data as ProfileChoice;
        await runCompareAndHistory(displayName, product, warningsString, profile.data, profile.name);
      } else if (selectedProfile.type === 'pet') {
        const pet = selectedProfile.data as ProfileChoice;
        await runCompareAndHistoryPet(displayName, product, warningsString, { name: pet.name, data: { allergens: pet.data.allergens ?? [] } });
      } else {
        // GROUP: mixed members
        const group = selectedProfile.data as GroupChoice;
        const membersTyped = (group.members as any[]).map((m) =>
          typeof m === 'string' ? ({ name: m, kind: 'human' }) : m
        ) as { name: string; kind: 'human'|'pet' }[];

        // Build lookups from current in-memory lists
        const humanList = profiles.map(p => ({ name: p.name, data: p.data }));
        const petList   = pets.map(p => ({ name: p.name, data: { allergens: p.data.allergens ?? [] } }));

        await runCompareGroupMixed(
          displayName,
          product,
          warningsString,
          membersTyped,
          humanList,
          petList,
          // human
          async (dn, prod, warn, memberProfiles, groupName) => {
            await runCompareAndHistory(dn, prod, warn, memberProfiles, group.name);
          },
          // pet one-by-one
          async (dn, prod, warn, pet) => {
            await runCompareAndHistoryPet(dn, prod, warn, pet);
          }
        );
      }

      return;
    }
    
    if (profiles.length + pets.length <= 1) {
      const chosen = profiles[0] ?? pets[0] ?? null;
      //await runCompareAndHistory(displayName, product, warningsString, chosen?.data ?? null, chosen?.name ?? null);
      if (!chosen) {
       setPendingProduct(null);
       setPickerVisible(true);
      return;
     }
     if ((chosen as ProfileChoice) && pets.find(p => p.id === chosen!.id)) {
       await runCompareAndHistoryPet(
         displayName,
         product,
         warningsString,
         { name: chosen!.name, data: { allergens: (chosen as ProfileChoice).data.allergens ?? [] } }
       );
     } else {
       await runCompareAndHistory(displayName, product, warningsString, (chosen as ProfileChoice).data, chosen!.name);
     }
    } else {
      setPendingProduct({ displayName, product, warningsString });
      setPickerVisible(true);
    }
  };

  const fetchFoodDetailsByBarcode = async (barcode: string, isPet: boolean = false) => {
    setLoadingDetails(true);
    try {
      let docData = isPet ? await findPetByBarcode(barcode) : await findByBarcode(barcode);
      if (!docData && !isPet) {
        console.log('Not found in Products, checking PetProducts...');
        docData = await findPetByBarcode(barcode);
      }
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

      if (isPet) {
        await ensureProfileThenCompare(foodName, product, allergensString);
      } else {
        await ensureProfileThenCompare(foodName, product, allergensString);
      }
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
  
    const isPetScan = selectedProfile?.type === 'pet';
    await fetchFoodDetailsByBarcode(gtin13, isPetScan)

  };

  const resetScanner = () => {
    setScanned(false);
    setScannedData(null);
    setFoodDetails(null);
    setCompareLines([]);
    setModalVisible(false);
    setSelectedProfile(null); 
  };

  const scanAnother = () => {
  setScanned(false);
  setScannedData(null);
  setFoodDetails(null);
  setCompareLines([]);
  setModalVisible(false);
  };

  useFocusEffect(
    useCallback(() => {
      resetScanner();
    }, [])
  );

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <LinearGradient colors = {activeColors.gradientBackground} style = {styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
        <ScrollView style={[styles.container]}>
          <ThemedView style={[styles.titleContainer,{backgroundColor: activeColors.backgroundTitle}]}>
            <ThemedText type="title" style={{ color: activeColors.text}}>
              Scan
            </ThemedText>
          </ThemedView>
          <ThemedView style={[styles.divider, {backgroundColor: activeColors.divider}]} />
          <ThemedView style={styles.textContainer}>
            <ThemedText style={{ color: activeColors.text}}>
              We need your permission to access the camera in order to scan barcodes.
            </ThemedText>
            <View style={styles.buttonWrapper}>
              <Button onPress={requestPermission} title="Grant Permission" />
            </View>
          </ThemedView>
        </ScrollView>
      </LinearGradient>
    );
  }

  const allergens =
    foodDetails?.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== '0') || [];

  return (
    <View style={styles.container}>
      <View style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
        <Image 
          source={isDarkMode
            ? require('@/assets/images/banner-dark.png')
            : require('@/assets/images/banner-light.png')
          }        
          style={styles.bannerImage}
          resizeMode="contain"
        />
    </View>
    <View style={[styles.divider, { backgroundColor: activeColors.divider }]} />
      <CameraView
        style={[StyleSheet.absoluteFill, { top: 78 }]}
        facing={facing}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'] }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <View style={styles.hintBox}>
          <ThemedText style={styles.hintText}>Place barcode here</ThemedText>
        </View>

        {loadingDetails && (
          <View style={styles.loadingOverlay}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.lottieContainer}>
              <LottieView
                source={require('@/assets/images/loading.json')}
                autoPlay
                loop
                style={{ width: 150, height: 150 }}
              />
            </View>
          </View>
        )}

      </View>

      {/* Results modal */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scanned</Text>
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
                </>
              ) : (
                <Text style={styles.errorText}>No food data found for this barcode.</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionButton} onPress={scanAnother}>
                <Text style={styles.actionButtonText}>Scan Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton2}
                onPress={() => {
                  setModalVisible(false);
                  resetScanner(); 
                  router.push('/results') ;
                }}>
                <Text style={styles.actionButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Profile Picker */}
      <Modal animationType="fade" transparent visible={pickerVisible} onRequestClose={() => setModalVisible(false)}>
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan for:</Text>
            </View>

            <ScrollView style={[styles.modalScroll, {backgroundColor: "#f0f0f0"}]}>
              <Text style={styles.modalSubtitle}>Profiles:</Text>
                {profiles.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.ppItem}
                    onPress={async () => {
                      setPickerVisible(false);
                      setSelectedProfile({ type: 'profile', data: p }); // Save the selection
                      if (pendingProduct) {
                        const { displayName, product, warningsString } = pendingProduct;
                        setPendingProduct(null);
                        await runCompareAndHistory(displayName, product, warningsString, p.data, p.name);
                      }
                    }}
                  >
                    <Text style={styles.ppItemText}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              <Text style={styles.modalSubtitle}>Pet Profiles:</Text>
                {pets.map((pet, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.ppItem}
                    onPress={async () => {
                      setPickerVisible(false);
                      setSelectedProfile({ type: 'pet', data: pet });
                      if (pendingProduct) {
                        const { displayName, product, warningsString } = pendingProduct;
                        setPendingProduct(null);
                        await runCompareAndHistoryPet(displayName, product, warningsString, { name: pet.name, data: { allergens: pet.data.allergens ?? [] } });
                      }
                    }}
                  >
                    <Text style={styles.ppItemText}>{pet.name}</Text>
                  </TouchableOpacity>
                ))}
              <Text style={styles.modalSubtitle}>Groups:</Text>
                {groups.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.ppItem}
                    onPress={async () => {
                      setPickerVisible(false);
                      setSelectedProfile({ type: 'group', data: g });
                      if (pendingProduct) {
                        const { displayName, product, warningsString } = pendingProduct;
                        setPendingProduct(null);
                        const memberProfiles = g.members
                          .map(name => profiles.find(profile => profile.name === name))
                          .filter(Boolean) as { name: string; data: any }[];
                        await runCompareAndHistory(displayName, product, warningsString, memberProfiles, null);
                      }
                    }}
                  >
                    <Text style={styles.ppItemText}>{g.name}</Text>
                  </TouchableOpacity>
                ))}

            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setPickerVisible(false);
                  setPendingProduct(null);
                }}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bannerImage: {
    width: 300,
    height: 50,
  },
  divider: {
    height: 2,
    width: '100%',
    zIndex: 10,
  },
  textContainer: {
    backgroundColor: 'transparent', 
    paddingHorizontal: 24 },

  buttonWrapper: { marginTop: 16 },

  text: { 
    fontWeight: 'bold', 
    color: 'white', 
    textAlign: 'center', 
    paddingBottom: Platform.OS === 'ios' ? 50 : 0 
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

  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center' },

  scanBox: { 
    width: 275, 
    height: 175, 
    borderWidth: 3, 
    borderColor: 'white',
    borderStyle: 'dashed',  
    borderRadius: 10,
    marginBottom: 15, 
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

    modalSubtitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333' },

  modalScroll: { padding: 20 },

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

    actionButton2: {
    backgroundColor: '#74B72E',
    padding: 15,
    marginTop:5,
    borderRadius: 10,
    alignItems: 'center',
  },

  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // profile picker,
  ppItem: { 
    paddingVertical: 10, 
    marginBottom: 5,
    borderWidth: 1, 
    borderRadius:10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ddd' },

  ppItemText: { 
    fontSize: 16,
    fontWeight: '500'
  },

  hintBox: {
  backgroundColor: 'rgba(39, 119, 142, 0.8)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
  alignSelf: 'center',
},

hintText: {
  color: 'white',
  fontWeight: 'bold',
  textAlign: 'center',
},

loadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999, 
},

lottieContainer: {
    width: 160,
    height: 160,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },


});
