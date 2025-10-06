import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { saveToHistory } from '@/db/history';
import { searchCustomEntries } from '@/db/customFoods';
import { useThemedColor } from '@/components/ThemedColor';

// Firestore
import { collection, getDocs, query, where, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/db/firebaseConfig"; 

// Debounce
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

const parseWarning = (warning?: string | null) => {
  if (!warning) return [];
  return warning
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, value: '1' }));
};

// ---------- Normalization & utilities ----------
const normalize = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/['’&]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokensOf = (s: string) => normalize(s).split(/\s+/).filter(Boolean);

const ngrams = (s: string, n: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i <= s.length - n; i++) out.push(s.slice(i, i + n));
  return out;
};

const jaccard = (A: Set<string>, B: Set<string>) => {
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni === 0 ? 0 : inter / uni;
};

// ---------- Damerau–Levenshtein (OSA variant) ----------
function damerauOSA(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

// ---------- Jaro–Winkler ----------
function jaroWinkler(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      matches++; break;
    }
  }
  if (matches === 0) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;

  let l = 0;
  while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) l++;
  return jaro + l * 0.1 * (1 - jaro);
}

// ---------- Monge–Elkan with JW ----------
function mongeElkanJW(q: string, cand: string): number {
  const qToks = tokensOf(q);
  const cToks = tokensOf(cand);
  if (!qToks.length || !cToks.length) return 0;
  let sum = 0;
  for (const qt of qToks) {
    let best = 0;
    for (const ct of cToks) {
      const s = jaroWinkler(qt, ct);
      if (s > best) best = s;
    }
    sum += best;
  }
  return sum / qToks.length;
}

// ---------- Combined similarity (0..1) ----------
function similarityScore(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);

  const q3 = new Set((q.length >= 3 ? ngrams(q, 3) : ngrams(q, 2)));
  const l3 = new Set(ngrams(l, 3));
  const jac = jaccard(q3, l3);

  const dl = damerauOSA(q, l);
  const dlSim = 1 - dl / Math.max(q.length, l.length);

  const me = mongeElkanJW(q, l);

  const starts = l.startsWith(q) ? 0.08 : 0;

  return Math.max(0, Math.min(1, 0.40 * me + 0.35 * dlSim + 0.25 * jac + starts));
}

// ---------- Precision gate helpers ----------
const STRICT_AFTER = 3;

function bestTokenSimilarities(qLower: string, labelLower: string) {
  const toks = tokensOf(labelLower);
  let bestJW = 0;
  let bestDL = Number.POSITIVE_INFINITY;
  for (const t of toks) {
    const jw = jaroWinkler(qLower, t);
    if (jw > bestJW) bestJW = jw;
    const dl = damerauOSA(qLower, t);
    if (dl < bestDL) bestDL = dl;
  }
  return { bestJW, bestDL };
}

function passesPrecisionGate(qLower: string, item: any): boolean {
  const L = qLower.length;
  if (L < STRICT_AFTER) return true;

  const name = (item.name_lower ?? "").trim();
  const brand = (item.brand_lower ?? "").trim();
  const label = `${brand} ${name}`.trim();
  const tokens = tokensOf(label);

  const tokenPrefix = tokens.some(t => t.startsWith(qLower));
  const containsSub = label.includes(qLower);

  const qGrams = new Set(L >= 3 ? ngrams(qLower, 3) : ngrams(qLower, 2));
  let gramHits = 0;
  if (item.index_ngrams?.length) {
    const idx = new Set(item.index_ngrams);
    for (const g of qGrams) { if (idx.has(g)) gramHits++; }
  }

  const { bestJW, bestDL } = bestTokenSimilarities(qLower, label);
  const jwOk = bestJW >= (L >= 5 ? 0.84 : 0.88);
  const dlOk = bestDL <= Math.ceil(L * 0.4);

  if (L <= 4) {
    return tokenPrefix || jwOk || containsSub || gramHits >= 1 || dlOk;
  } else {
    return tokenPrefix || jwOk || containsSub || gramHits >= 2 || dlOk;
  }
}

// ---------- Hard similarity cutoff (length-aware) ----------
const minScoreFor = (q: string) => {
  const L = q.length;
  if (L >= 12) return 0.78;
  if (L >= 9)  return 0.74;
  if (L >= 6)  return 0.70;
  if (L >= 4)  return 0.66;
  return 0.58;
};

// ---------- Strong anchor helper (normalized) ----------
const strongAnchor = (it: any, qLower: string) => {
  const rawLabel = `${it.brand_lower ?? ""} ${it.name_lower ?? ""}`.trim();
  const normLabel = normalize(rawLabel);
  const toks = tokensOf(normLabel);
  const qToks = tokensOf(qLower);

  const tokenStarts = toks.some(t => t.startsWith(qLower));
  const labelContains = normLabel.includes(qLower);
  const crossPrefix = qToks.some(qt =>
    toks.some(t => t.startsWith(qt) || qt.startsWith(t))
  );
  const tokenContainsEitherDir = qToks.some(qt =>
    toks.some(t => t.includes(qt) || qt.includes(t))
  );

  return tokenStarts || labelContains || crossPrefix || tokenContainsEitherDir;
};

// ---------- Barcode helpers ----------
const digitsOnly = (s: string) => (s ?? "").replace(/\D/g, "");

// Generate plausible stored variants from a user-entered code.
function barcodeVariants(raw: string): string[] {
  const d = digitsOnly(raw);
  const out = new Set<string>();
  if (!d) return [];
  out.add(d);
  if (d.length === 12) out.add("0" + d);
  else if (d.length === 13 && d.startsWith("0")) out.add(d.slice(1));
  else if (d.length > 13) { out.add(d.slice(0, 13)); out.add(d.slice(0, 12)); }
  return Array.from(out);
}

// For fallback/local filtering: exact digits-only match; allow prefix when query >= 8 digits
function matchesBarcodeClientSide(itemBarcode: string | undefined, qDigits: string): boolean {
  const id = digitsOnly(itemBarcode ?? "");
  if (!id || !qDigits) return false;
  if (id === qDigits) return true;
  if (qDigits.length >= 8 && id.startsWith(qDigits)) return true;
  return false;
}

// ---------- Filters ----------
type AllergenFilters = { peanut: boolean; soy: boolean };
type FilterState = {
  allergens: AllergenFilters;
  customTerms: string[]; // user-defined terms (match ANY)
};

const matchesAllergenFilters = (it: any, filters: AllergenFilters): boolean => {
  const warn = normalize(it.warning ?? "");
  const ingred = normalize(it.ingredients ?? "");
  const haystack = `${warn} ${ingred}`;

  if (filters.peanut && !haystack.includes('peanut')) return false;
  if (filters.soy && !haystack.includes('soy')) return false;
  return true;
};

const matchesCustomTerms = (it: any, terms: string[]): boolean => {
  if (!terms.length) return true;
  const warn = normalize(it.warning ?? "");
  const ingred = normalize(it.ingredients ?? "");
  const haystack = `${warn} ${ingred}`;
  return terms.some(t => haystack.includes(normalize(t)));
};

export default function AutocompleteScreen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;
  const navigation = useNavigation();

  const [queryText, setQueryText] = useState('');
  const [combinedSuggestions, setCombinedSuggestions] = useState<any[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState<any>(null);
  const [allergenMatches, setAllergenMatches] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Filters UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    allergens: { peanut: false, soy: false },
    customTerms: [],
  });
  const [customInput, setCustomInput] = useState('');

  const addCustomTerm = () => {
    const term = customInput.trim();
    if (!term) return;
    setFilters(prev => ({
      ...prev,
      customTerms: Array.from(new Set([...prev.customTerms, term])),
    }));
    setCustomInput('');
    setTimeout(() => fetchSuggestions(queryText), 0);
  };

  const removeCustomTerm = (term: string) => {
    setFilters(prev => ({
      ...prev,
      customTerms: prev.customTerms.filter(t => t !== term),
    }));
    setTimeout(() => fetchSuggestions(queryText), 0);
  };

  const toggleAllergen = (key: keyof AllergenFilters) => {
    setFilters(prev => ({
      ...prev,
      allergens: { ...prev.allergens, [key]: !prev.allergens[key] },
    }));
    setTimeout(() => fetchSuggestions(queryText), 0);
  };

  const fetchSuggestions = async (text: string) => {
    if ((text ?? "").length < 2) {
      setCombinedSuggestions([]);
      setNoResults(false);
      return;
    }

    try {
      const qLower = normalize(text);
      const grams = qLower.length >= 3 ? ngrams(qLower, 3) : ngrams(qLower, 2);
      const gramsForQuery = grams.slice(0, 20);

      // Barcode intent
      const qDigits = digitsOnly(text);
      const isBarcodey = qDigits.length >= 6;
      const variants = isBarcodey ? barcodeVariants(qDigits) : [];

      const productsRef = collection(db, "Products");

      // --- 1) Targeted queries ---
      const ngramQ = query(
        productsRef,
        where("index_ngrams", "array-contains-any", gramsForQuery),
        limit(50)
      );
      const nameQ = query(
        productsRef,
        where("name_lower", ">=", qLower),
        where("name_lower", "<=", qLower + "\uf8ff"),
        limit(20)
      );
      const brandQ = query(
        productsRef,
        where("brand_lower", ">=", qLower),
        where("brand_lower", "<=", qLower + "\uf8ff"),
        limit(20)
      );
      // NEW: barcode targeted query
      const barcodeQPromise = isBarcodey && variants.length > 0
        ? getDocs(query(productsRef, where("barcode", "in", variants.slice(0, 10)), limit(20)))
        : Promise.resolve({ size: 0, docs: [] } as any);

      const [ngramSnap, nameSnap, brandSnap, barcodeSnap] = await Promise.all([
        getDocs(ngramQ),
        getDocs(nameQ),
        getDocs(brandQ),
        barcodeQPromise,
      ]);

      const mapDoc = (docSnap: any) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.food_name,
          name_lower: d.name_lower ?? (d.food_name ?? "").toLowerCase(),
          brand_name: d.brand_name,
          brand_lower: d.brand_lower ?? (d.brand_name ?? "").toLowerCase(),
          barcode: d.barcode,
          warning: d.warning,
          ingredients: d.ingredients,
          index_ngrams: d.index_ngrams ?? [],
          source: "firebase" as const,
        };
      };

      const byId: Record<string, any> = {};
      [...ngramSnap.docs, ...nameSnap.docs, ...brandSnap.docs, ...barcodeSnap.docs]
        .map(mapDoc)
        .forEach(item => { byId[item.id] = byId[item.id] ?? item; });

      let candidates: any[] = Object.values(byId);

      // Fallback scan if targeted empty
      let usedFallback = false;
      if (candidates.length === 0) {
        const allSnap = await getDocs(query(productsRef, limit(200)));
        allSnap.docs.map(mapDoc).forEach(item => { byId[item.id] = byId[item.id] ?? item; });
        candidates = Object.values(byId);
        usedFallback = true;
        console.log('[search] rescue fallback used — scanned', candidates.length, 'docs');

        if (isBarcodey) {
          const directBarcodeMatches = candidates.filter(c => matchesBarcodeClientSide(c.barcode, qDigits));
          if (directBarcodeMatches.length > 0) {
            candidates = directBarcodeMatches;
          }
        }
      }

      // N-gram prune (skip if fallback)
      const gramsSet = new Set(grams);
      const shouldPruneByNgrams = !usedFallback;
      const minOverlap = qLower.length >= 6 ? 2 : 0;
      if (shouldPruneByNgrams) {
        candidates = candidates.filter((c) => {
          const idx = new Set(c.index_ngrams ?? []);
          if (idx.size) {
            let hits = 0;
            for (const g of gramsSet) { if (idx.has(g)) { hits++; if (hits >= minOverlap) return true; } }
            return minOverlap === 0;
          }
          return true;
        });
      }

      // Precision gate
      const STRICT_AFTER_LOCAL = 2;
      const bestTokenSimilaritiesLocal = (ql: string, labelLower: string) => {
        const toks = tokensOf(labelLower);
        let bestJW = 0;
        let bestDL = Number.POSITIVE_INFINITY;
        for (const t of toks) {
          const jw = jaroWinkler(ql, t);
          if (jw > bestJW) bestJW = jw;
          const dl = damerauOSA(ql, t);
          if (dl < bestDL) bestDL = dl;
        }
        return { bestJW, bestDL };
      };
      const passesPrecisionGateLocal = (ql: string, item: any): boolean => {
        const L = ql.length;
        if (L < STRICT_AFTER_LOCAL) return true;

        const name = (item.name_lower ?? "").trim();
        const brand = (item.brand_lower ?? "").trim();
        const label = `${brand} ${name}`.trim();
        const tokens = tokensOf(label);

        const tokenPrefix = tokens.some(t => t.startsWith(ql));
        const containsSub = label.includes(ql);

        const qGrams = new Set(L >= 3 ? ngrams(ql, 3) : ngrams(ql, 2));
        let gramHits = 0;
        if (item.index_ngrams?.length) {
          const idx = new Set(item.index_ngrams);
          for (const g of qGrams) { if (idx.has(g)) gramHits++; }
        }

        const { bestJW, bestDL } = bestTokenSimilaritiesLocal(ql, label);
        const jwOk = bestJW >= (L >= 5 ? 0.84 : 0.88);
        const dlOk = bestDL <= Math.ceil(L * 0.4);

        if (L <= 4) {
          return tokenPrefix || jwOk || containsSub || gramHits >= 1 || dlOk;
        } else {
          return tokenPrefix || jwOk || containsSub || gramHits >= 2 || dlOk;
        }
      };

      let filtered = (usedFallback || isBarcodey)
        ? candidates
        : candidates.filter(c => passesPrecisionGateLocal(qLower, c));

      filtered = filtered
        .filter(it => matchesAllergenFilters(it, filters.allergens))
        .filter(it => matchesCustomTerms(it, filters.customTerms));

      const labelOf = (it: any) => `${it.brand_lower ?? ""} ${it.name_lower ?? ""}`.trim();
      const cutoff = minScoreFor(qLower);

      const scored = filtered.map(it => {
        const base = similarityScore(qLower, labelOf(it));
        let bonus = 0;
        if (isBarcodey && matchesBarcodeClientSide(it.barcode, qDigits)) bonus += 0.25;
        return { it, s: base + bonus };
      });

      let ranked: any[] = [];
      if (usedFallback && !isBarcodey) {
        const anchored = scored.filter(x => strongAnchor(x.it, qLower));
        if (anchored.length > 0) {
          ranked = anchored.sort((a, b) => b.s - a.s).map(x => x.it);
        }
      }
      if (ranked.length === 0) {
        const kept = scored
          .filter(x => {
            if (isBarcodey && matchesBarcodeClientSide(x.it.barcode, qDigits)) return true;
            const anchored = strongAnchor(x.it, qLower);
            const anchoredCutoff = Math.max(0, cutoff - 0.18);
            return x.s >= (anchored ? anchoredCutoff : cutoff);
          })
          .sort((a, b) => b.s - a.s)
          .map(x => x.it);
        ranked = kept;
      }

      const targetedFound = (ngramSnap.size + nameSnap.size + brandSnap.size + (barcodeSnap.size || 0)) > 0;
      if (ranked.length === 0) {
        if (targetedFound) {
          ranked = scored.sort((a, b) => b.s - a.s).slice(0, 10).map(x => x.it);
          console.log('[search] rescue: kept top-10 after local filters since targeted queries had hits');
        } else if (usedFallback && scored.length > 0) {
          ranked = scored.sort((a, b) => b.s - a.s).slice(0, 10).map(x => x.it);
          console.log('[search] tiny-db rescue: kept top-10 after fallback scan');
        }
      }

      const firestoreResults = ranked.map(d => ({
        id: d.id,
        name: d.name,
        barcode: d.barcode,
        brand_name: d.brand_name,
        warning: d.warning,
        ingredients: d.ingredients,
        source: "firebase" as const,
      }));

      const customResults = await searchCustomEntries(text);
      const customCandidates = customResults.map((entry: any) => {
        const brand_lower = (entry.brand_name ?? "").toLowerCase();
        const name_lower  = (entry.food_name ?? "").toLowerCase();
        return {
          id: `custom-${entry.barcode ?? entry.food_name}-${Math.random()}`,
          name: entry.food_name,
          barcode: entry.barcode,
          brand_name: entry.brand_name ?? "",
          warning: entry.allergens ?? "",
          ingredients: entry.ingredients ?? "",
          brand_lower, name_lower,
          source: "custom" as const,
        };
      });

      let customFiltered = customCandidates
        .filter(it => matchesAllergenFilters(it, filters.allergens))
        .filter(it => matchesCustomTerms(it, filters.customTerms));

      if (isBarcodey) {
        const direct = customFiltered.filter(c => matchesBarcodeClientSide(c.barcode, qDigits));
        if (direct.length > 0) customFiltered = direct;
      }

      const customScored = customFiltered
        .filter(c => (usedFallback || isBarcodey) ? true : passesPrecisionGate(qLower, c))
        .map(c => {
          const s = similarityScore(qLower, `${c.brand_lower} ${c.name_lower}`);
          const bonus = (isBarcodey && matchesBarcodeClientSide(c.barcode, qDigits)) ? 0.25 : 0;
          return { it: c, s: s + bonus };
        });

      const customKept = customScored
        .sort((a, b) => b.s - a.s)
        .map(x => {
          const { brand_lower, name_lower, ...rest } = x.it;
          return rest;
        });

      const combined = [...customKept, ...firestoreResults];
      setCombinedSuggestions(combined);
      setNoResults(combined.length === 0);

      if (combined.length === 0) {
        console.log('[search] no results — qLower:', qLower, {
          targetedCounts: { ngram: ngramSnap.size, name: nameSnap.size, brand: brandSnap.size, barcode: barcodeSnap.size || 0 },
          isBarcodey, variants, qDigits,
          filters,
        });
      }

    } catch (err) {
      console.error("Firestore fetch error:", err);
      setCombinedSuggestions([]);
      setNoResults(true);
    }
  };

  const debouncedFetch = useMemo(
    () => debounce((t: string) => fetchSuggestions(t), 400),
    [filters.allergens.peanut, filters.allergens.soy, filters.customTerms.join('|')]
  );

  const handleInputChange = (text: string) => {
    setQueryText(text);
    debouncedFetch(text);
  };

  const handleViewPress = async (foodText: string, index: number) => {
    const item = combinedSuggestions[index];

    if (item.source === 'custom') {
      const warningArray = parseWarning(item.warning);
      setSelectedFoodDetails({
        food: { food_attributes: { allergens: { allergen: warningArray } } }
      });
      setExpandedIndex(index);

      const warningsString = warningArray.map(a => a.name).join(', ');
      const profile = ['Milk', 'Egg', 'Peanuts'];
      const matched = warningArray.filter(a => profile.includes(a.name)).map(a => a.name);
      try {
        await saveToHistory(foodText, warningsString, matched.join(', '));
      } catch (err) {
        console.error('History save error:', err);
      }
      return;
    }

    try {
      const snap = await getDoc(doc(db, "Products", item.id));
      if (snap.exists()) {
        const docData = snap.data();
        const warningArray = parseWarning(docData.warning);
        setSelectedFoodDetails({
          food: { food_attributes: { allergens: { allergen: warningArray } } }
        });
        setExpandedIndex(index);
      }
    } catch (err) {
      console.error('Firestore food fetch error:', err);
    }
  };

  const renderSuggestion = ({ item, index }: { item: any; index: number }) => {
    const warnings = selectedFoodDetails?.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== "0");
    const profile = ['Milk', 'Egg', 'Peanuts'];

    const handleCompareAllergens = () => {
      const matched = warnings?.filter((a: any) => profile.includes(a.name)) ?? [];
      setAllergenMatches(matched.map((a: any) => a.name));
      setModalVisible(true);
    };

    return (
      <View style={[styles.suggestionCard, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
        <Text style={[styles.suggestionText, { color: activeColors.text }]}>
          {item.brand_name ? `${item.brand_name} — ${item.name}` : item.name}
          {item.barcode ? `  ·  ${item.barcode}` : ''}
          {item.source === 'custom' && ' (Custom)'}
        </Text>

        <Pressable style={styles.viewButton} onPress={() => handleViewPress(item.name, index)}>
          <Text style={styles.buttonText}>View</Text>
        </Pressable>

        {expandedIndex === index && selectedFoodDetails && (
          <View style={[styles.detailsBox, { backgroundColor: activeColors.backgroundTitle, borderColor: 'transparent' }]}>
            <View style={styles.detailsRow}>
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Put image here</Text>
              </View>

              <View style={styles.detailsCol}>
                <Text style={[styles.prodTitle, { color: activeColors.text }]}>
                  {item.brand_name ? `${item.brand_name} — ${item.name}` : item.name}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: activeColors.secondaryText }]}>Barcode:</Text>
                  <Text style={[styles.metaValue, { color: activeColors.text }]}>{item.barcode ?? '—'}</Text>
                </View>

                {!!item.ingredients && (
                  <Text style={[styles.ingredientsText, { color: activeColors.text }]} numberOfLines={4}>
                    <Text style={[styles.metaLabel, { color: activeColors.secondaryText }]}>Ingredients: </Text>
                    {item.ingredients}
                  </Text>
                )}

                {warnings?.length ? (
                  <View style={styles.allergenContainer}>
                    <Text style={[styles.detailsText, { color: activeColors.text }]}>Warnings:</Text>
                    <View style={styles.allergenBlockWrapper}>
                      {warnings.map((a: any, i: number) => (
                        <View key={i} style={styles.allergenBlock}>
                          <Text style={styles.allergenText}>{a.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.detailsText, { color: activeColors.secondaryText, marginTop: 6 }]}>
                    No warnings found
                  </Text>
                )}

                <View style={styles.detailsButtonsRow}>
                  <Pressable onPress={() => setExpandedIndex(null)} style={[styles.secondaryBtn]}>
                    <Text style={styles.secondaryBtnText}>Collapse</Text>
                  </Pressable>

                  <Pressable style={styles.primaryBtn} onPress={handleCompareAllergens}>
                    <Text style={styles.primaryBtnText}>Compare with My Allergens</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <FlatList
        data={combinedSuggestions}
        keyExtractor={(item, index) => `${item.id ?? item.name}-${item.source}-${index}`}
        renderItem={renderSuggestion}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            <ThemedView style={[styles.titleContainer, { backgroundColor: activeColors.backgroundTitle }]}>
              <ThemedText type="title" style={{ color: activeColors.text }}>Search</ThemedText>
            </ThemedView>
            <ThemedView style={[styles.divider, { backgroundColor: activeColors.divider }]} />
            <ThemedView style={[styles.innerContainer, { backgroundColor: activeColors.background }]}>
              <TextInput
                placeholder="Start typing a food name or barcode..."
                placeholderTextColor={activeColors.secondaryText}
                value={queryText}
                onChangeText={handleInputChange}
                keyboardType="default"
                style={[styles.input, { color: activeColors.text, borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}
              />

              <Pressable
                onPress={() => setFiltersOpen(v => !v)}
                style={[styles.filtersTrigger, { borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}
              >
                <Text style={{ color: activeColors.text, fontWeight: '600' }}>
                  Filters {filtersOpen ? '▴' : '▾'}
                </Text>
                {(filters.allergens.peanut || filters.allergens.soy || filters.customTerms.length > 0) && (
                  <Text style={{ color: { ...activeColors }.secondaryText, marginTop: 4, fontSize: 12 }}>
                    Active: {[
                      filters.allergens.peanut ? 'Peanut' : null,
                      filters.allergens.soy ? 'Soy' : null,
                      ...filters.customTerms.map(t => `“${t}”`)
                    ].filter(Boolean).join(', ')}
                  </Text>
                )}
              </Pressable>

              {filtersOpen && (
                <View style={styles.filtersBox}>
                  <Text style={[styles.filtersLabel, { color: activeColors.secondaryText }]}>Allergens</Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => toggleAllergen('peanut')}
                      style={[
                        styles.toggle,
                        filters.allergens.peanut ? styles.toggleOn : styles.toggleOff
                      ]}
                    >
                      <Text style={filters.allergens.peanut ? styles.toggleTextOn : styles.toggleTextOff}>Peanut</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => toggleAllergen('soy')}
                      style={[
                        styles.toggle,
                        filters.allergens.soy ? styles.toggleOn : styles.toggleOff
                      ]}
                    >
                      <Text style={filters.allergens.soy ? styles.toggleTextOn : styles.toggleTextOff}>Soy</Text>
                    </Pressable>
                  </View>

                  <View style={styles.customSection}>
                    <Text style={[styles.filtersLabel, { color: activeColors.secondaryText }]}>Custom filters</Text>
                    <View style={styles.customRow}>
                      <TextInput
                        placeholder="Type a word (e.g., sesame)"
                        placeholderTextColor={activeColors.secondaryText}
                        value={customInput}
                        onChangeText={setCustomInput}
                        onSubmitEditing={addCustomTerm}
                        style={[styles.customInput, { color: activeColors.text, borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}
                      />
                      <Pressable style={styles.addButton} onPress={addCustomTerm}>
                        <Text style={styles.addButtonText}>Add</Text>
                      </Pressable>
                    </View>

                    {filters.customTerms.length > 0 && (
                      <View style={styles.chipsRow}>
                        {filters.customTerms.map(term => (
                          <View key={term} style={styles.chip}>
                            <Text style={styles.chipText}>{term}</Text>
                            <Pressable onPress={() => removeCustomTerm(term)} style={styles.chipClose}>
                              <Text style={styles.chipCloseText}>✕</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={[styles.filtersHint, { color: activeColors.secondaryText }]}>
                      Custom filters match if the term appears in either the ingredients or warning fields. Multiple terms match any.
                    </Text>
                  </View>
                </View>
              )}

              {noResults && (
                <Text style={[styles.noResultsText, { color: activeColors.secondaryText }]}>
                  No results found. Try a different search term or adjust filters.
                </Text>
              )}
            </ThemedView>
          </>
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: 24 }}>
            <Pressable
              style={[styles.viewButton, { marginTop: 10, alignSelf: 'center' }]}
              onPress={() => navigation.navigate('create-custom-entry' as never)}
            >
              <Text style={styles.buttonText}>Create Custom Entry</Text>
            </Pressable>

            <Pressable
              style={[styles.viewButton, { marginTop: 10, alignSelf: 'center' }]}
              onPress={() => navigation.navigate('custom-entries-list' as never)}
            >
              <Text style={styles.buttonText}>View Custom Entries</Text>
            </Pressable>

            
            <Pressable
              style={[styles.viewButton, { marginTop: 10, alignSelf: 'center', backgroundColor: '#6B7280' }]}
              onPress={() => navigation.navigate('ocr-scan-screen' as never)}
            >
              <Text style={styles.buttonText}>Can’t find a product?</Text>
            </Pressable>
          </View>
        }
      />

      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeading}>⚠️ Allergen Match</Text>
            {allergenMatches.length > 0 ? (
              allergenMatches.map((name, idx) => (
                <Text key={idx} style={styles.modalText}>• {name}</Text>
              ))
            ) : (
              <Text style={styles.modalText}>No matches found 🎉</Text>
            )}
            <Pressable style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  titleContainer: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, backgroundColor: '#E5E5EA', marginBottom: 16, width: '100%' },
  innerContainer: { paddingHorizontal: 24, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderColor: '#888', padding: 8, borderRadius: 6, backgroundColor: 'transparent' },

  filtersTrigger: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  filtersBox: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  filtersLabel: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleOff: { backgroundColor: '#f0f0f0', borderColor: '#d0d0d0' },
  toggleOn: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
  toggleTextOff: { color: '#666' },
  toggleTextOn: { color: '#fff' },

  customSection: { marginTop: 12 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButton: {
    backgroundColor: '#444',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ececec',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipText: { marginRight: 6, color: '#333' },
  chipClose: { padding: 2 },
  chipCloseText: { color: '#666', fontSize: 12 },

  filtersHint: { marginTop: 8, fontSize: 12 },

  list: { flex: 1, backgroundColor: 'transparent' },
  suggestionCard: { flexDirection: 'column', padding: 12, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 10, backgroundColor: 'transparent' },
  suggestionText: { fontSize: 16, marginBottom: 8 },
  viewButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#007BFF', borderRadius: 6 },
  buttonText: { color: 'white' },

  // Expanded details box
  detailsBox: { marginTop: 10, backgroundColor: '#f4f4f4', borderRadius: 6, padding: 10, borderColor: '#ddd', borderWidth: 1, position: 'relative' },
  detailsRow: { flexDirection: 'row', gap: 12 },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 12, color: '#777', textAlign: 'center', paddingHorizontal: 6 },
  detailsCol: { flex: 1, minWidth: 0 },
  prodTitle: { fontWeight: '600', fontSize: 16, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap' },
  metaLabel: { fontSize: 12, marginRight: 6 },
  metaValue: { fontSize: 14 },
  ingredientsText: { marginTop: 2, fontSize: 13, lineHeight: 18 },

  detailsText: { color: '#333' },
  allergenContainer: { marginTop: 10 },
  allergenBlockWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  allergenBlock: { backgroundColor: '#FF4D4D', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  allergenText: { color: 'white', fontSize: 12 },

  detailsButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: { backgroundColor: '#FF7F50', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  primaryBtnText: { color: 'white', fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#e5e5e5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  secondaryBtnText: { color: '#222', fontWeight: '600' },

  detailsScroll: { maxHeight: 200 },

  collapseButton: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#888', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },

  compareButton: { position: 'absolute', bottom: 10, left: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#FF7F50' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%', elevation: 10, alignItems: 'center' },
  modalHeading: { fontWeight: 'bold', fontSize: 18, marginBottom: 10 },
  modalText: { fontSize: 14, marginVertical: 2, color: '#333' },
  modalCloseButton: { marginTop: 16, backgroundColor: '#444', paddingVertical: 6, paddingHorizontal: 20, borderRadius: 6 },

  noResultsText: { textAlign: 'center', marginTop: 12, fontSize: 14 },
});
