import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const normU = (s: string) => (s || '').toUpperCase().replace(/\s+/g, ' ').trim();

function extractIngredientsBlock(fullText: string) {
  const T = fullText.replace(/\r/g, '');
  const m = T.match(/INGREDIENTS?:\s*([\s\S]*?)(?:\n[A-Z][A-Z \-:0-9]+:|\n*CONTAINS\b|\n*ALLERGENS?\b|$)/i);
  if (!m) return { ingredientsLine: '', ingredientsList: [] as string[] };
  const line = m[1].split('\n').map(s => s.trim()).join(' ');
  const list = line
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(tok => {
      const up = tok.replace(/[^A-Z]/g, '').length;
      const letters = tok.replace(/[^A-Za-z]/g, '').length;
      return letters === 0 ? false : (up / letters) >= 0.6;
    });
  return { ingredientsLine: line, ingredientsList: Array.from(new Set(list)) };
}

function extractWarnings(fullText: string) {
  const lines = fullText.split(/\n+/).map(s => normU(s));
  const hits: string[] = [];
  for (const L of lines) {
    if (/^CONTAINS\b/.test(L)) hits.push(L);
    if (/MANUFACTURED IN A FACILITY\b/.test(L)) hits.push(L);
    if (/PROCESSES|HANDLES/.test(L) && /PEANUT|TREE NUT|FISH|SHELLFISH|WHEAT|SOY|EGG|MILK|SESAME/.test(L)) hits.push(L);
    if (/BIOENGINEERED/.test(L)) hits.push(L);
  }
  return Array.from(new Set(hits));
}

function parseNutritionFacts(fullText: string) {
  const T = fullText.replace(/\r/g, '');
  const get = (label: RegExp, unit?: RegExp) => {
    const m = T.match(new RegExp(`${label.source}\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*${unit ? unit.source : ''}`, 'i'));
    return m ? m[1] : '';
  };
  const calories = (() => {
    const m = T.match(/CALORIES\s*([0-9]{1,4})/i);
    return m ? m[1] : '';
  })();

  return {
    serving_size: (() => {
      const m = T.match(/SERVING SIZE\s*:?([\s\S]*?)(?:\n|$)/i);
      return m ? m[1].trim() : '';
    })(),
    servings_per_container: (() => {
      const m = T.match(/SERVINGS?\s+PER\s+CONTAINER\s*:?([\s\S]*?)(?:\n|$)/i);
      return m ? m[1].trim() : '';
    })(),
    calories,
    total_fat_g: get(/TOTAL\s+FAT/, /(G|GRAMS?)/i),
    sat_fat_g: get(/SATURATED\s+FAT/, /(G|GRAMS?)/i),
    trans_fat_g: get(/TRANS\s+FAT/, /(G|GRAMS?)/i),
    cholesterol_mg: get(/CHOLESTEROL/, /(MG|MILLIGRAMS?)/i),
    sodium_mg: get(/SODIUM/, /(MG|MILLIGRAMS?)/i),
    total_carbs_g: get(/TOTAL\s+CARBOHYDRATE/, /(G|GRAMS?)/i),
    fiber_g: get(/DIETARY\s+FIBER/, /(G|GRAMS?)/i),
    total_sugars_g: get(/TOTAL\s+SUGARS/, /(G|GRAMS?)/i),
    added_sugars_g: get(/ADDED\s+SUGARS/, /(G|GRAMS?)/i),
    protein_g: get(/PROTEIN/, /(G|GRAMS?)/i),
    vitamin_d_mcg: get(/VITAMIN\s*D/, /(MCG|µG|UG|IU)/i),
    calcium_mg: get(/CALCIUM/, /(MG)/i),
    iron_mg: get(/IRON/, /(MG)/i),
    potassium_mg: get(/POTASSIUM/, /(MG)/i),
  };
}

export default function OcrScanScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [debugText, setDebugText] = useState('');
  const [ocrReady, setOcrReady] = useState<boolean | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  // Lazy probe so the route doesn't crash if native module isn't linked (Expo Go)
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') { setOcrReady(false); return; }
        const mod = await import('expo-text-extractor');
        // Some versions export flags (not required). If import succeeded, we're good.
        setOcrReady(true);
      } catch (e: any) {
        setOcrReady(false);
        setOcrError(e?.message ?? 'Native OCR module not available. Use a Development Build.');
      }
    })();
  }, []);

  const captureAndProcess = async () => {
    try {
      if (!cameraRef.current) return;
      setBusy(true);

      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });

      const { extractTextFromImage } = await import('expo-text-extractor');
      const lines = await extractTextFromImage(photo.uri);
      const text = (lines || []).join('\n');
      setDebugText(text.slice(0, 2000));

      const nutrition = parseNutritionFacts(text);
      const { ingredientsLine } = extractIngredientsBlock(text);
      const warnings = extractWarnings(text);

      navigation.navigate('create-custom-entry' as never, {
        prefill: {
          food_name: '',
          barcode: '',
          ingredients: ingredientsLine,
          warnings: warnings.join(', '),
          nutrition,
          manufacturer: '',
          contact: '',
        }
      } as never);
    } catch (e: any) {
      console.error(e);
      Alert.alert('OCR error', e?.message ?? 'Failed to read text.');
    } finally {
      setBusy(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission required.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Grant</Text></Pressable>
      </View>
    );
  }

  if (ocrReady === false) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginHorizontal: 24 }}>
          OCR isn’t available in this runtime. Build and open a <Text style={{ fontWeight: '700' }}>Development Build</Text> to use on-device OCR (no API keys).
        </Text>
        {!!ocrError && <Text style={{ marginTop: 8, color: '#c00' }}>{ocrError}</Text>}
        <Pressable style={[styles.btn, { marginTop: 16 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      <View style={styles.overlay}>
        <Text style={styles.hint}>Align the Nutrition Facts panel, then tap Scan.</Text>
        <Pressable style={styles.scanBtn} onPress={captureAndProcess} disabled={busy || ocrReady !== true}>
          {busy ? <ActivityIndicator /> : <Text style={styles.scanBtnText}>Scan</Text>}
        </Pressable>
        {!!debugText && (
          <ScrollView style={styles.debugBox}>
            <Text style={styles.debugText}>{debugText}</Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btn: { marginTop: 12, backgroundColor: '#007BFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' },
  hint: { color: '#fff', marginBottom: 8 },
  scanBtn: { alignSelf: 'center', backgroundColor: '#FF7F50', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  scanBtnText: { color: '#fff', fontWeight: '700' },
  debugBox: { maxHeight: 160, marginTop: 10, backgroundColor: '#111', borderRadius: 8, padding: 8 },
  debugText: { color: '#9ae6b4', fontSize: 12, lineHeight: 16 },

  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '500',
  },
});
