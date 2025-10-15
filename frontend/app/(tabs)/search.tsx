import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, FlatList, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { saveToHistory } from '@/db/history';
import { searchCustomEntries } from '@/db/customFoods';
import { useThemedColor } from '@/components/ThemedColor';
import { BlurView } from 'expo-blur';
import { LinearGradient } from "expo-linear-gradient";

// Firestore
import { collection, getDocs, query, where, limit, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/db/firebaseConfig";

// Compare helpers
import {
  compareProductToProfile,
  buildProductFromFirestoreDoc,
  type ProductDoc
} from '@/db/compare';

/** ---------- existing helpers (unchanged) ---------- */
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

const normalize = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/['’&]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokensOf = (s: string) => normalize(s).split(/\s+/).filter(Boolean);
const ngrams = (s: string, n: number): string[] => { const out: string[] = []; for (let i = 0; i <= s.length - n; i++) out.push(s.slice(i, i + n)); return out; };
const jaccard = (A: Set<string>, B: Set<string>) => { let inter = 0; for (const x of A) if (B.has(x)) inter++; const uni = A.size + B.size - inter; return uni === 0 ? 0 : inter / uni; };
function damerauOSA(a: string, b: string): number { const m=a.length,n=b.length;if(!m) return n; if(!n) return m; const dp=Array.from({length:m+1},()=>Array(n+1).fill(0)); for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j; for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost=a[i-1]===b[j-1]?0:1; dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost); if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) dp[i][j]=Math.min(dp[i][j],dp[i-2][j-2]+1); } } return dp[m][n]; }
function jaroWinkler(a: string, b: string): number { if(!a.length&&!b.length) return 1; const md=Math.max(0,Math.floor(Math.max(a.length,b.length)/2)-1); const aM=new Array(a.length).fill(false), bM=new Array(b.length).fill(false); let matches=0; for(let i=0;i<a.length;i++){ const st=Math.max(0,i-md), en=Math.min(i+md+1,b.length); for(let j=st;j<en;j++){ if(bM[j]||a[i]!==b[j]) continue; aM[i]=bM[j]=true; matches++; break; } } if(matches===0) return 0; let t=0,k=0; for(let i=0;i<a.length;i++){ if(!aM[i]) continue; while(!bM[k]) k++; if(a[i]!==b[k]) t++; k++; } const m=matches; const j=(m/a.length+m/b.length+(m-t/2)/m)/3; let l=0; while(l<4&&l<a.length&&l<b.length&&a[l]===b[l]) l++; return j + l*0.1*(1-j); }
function mongeElkanJW(q: string, cand: string): number { const qT=tokensOf(q), cT=tokensOf(cand); if(!qT.length||!cT.length) return 0; let sum=0; for(const qt of qT){ let best=0; for(const ct of cT){ const s=jaroWinkler(qt,ct); if(s>best) best=s; } sum+=best; } return sum/qT.length; }
function similarityScore(query: string, label: string): number { const q=normalize(query), l=normalize(label); const q3=new Set((q.length>=3?ngrams(q,3):ngrams(q,2))); const l3=new Set(ngrams(l,3)); const jac=jaccard(q3,l3); const dl=damerauOSA(q,l); const dlSim=1-dl/Math.max(q.length,l.length); const me=mongeElkanJW(q,l); const starts=l.startsWith(q)?0.08:0; return Math.max(0,Math.min(1,0.40*me+0.35*dlSim+0.25*jac+starts)); }
const STRICT_AFTER = 3;
function bestTokenSimilarities(qLower: string, labelLower: string) { const toks=tokensOf(labelLower); let bestJW=0; let bestDL=Number.POSITIVE_INFINITY; for(const t of toks){ const jw=jaroWinkler(qLower,t); if(jw>bestJW) bestJW=jw; const dl=damerauOSA(qLower,t); if(dl<bestDL) bestDL=dl; } return {bestJW,bestDL}; }
function passesPrecisionGate(qLower: string, item: any): boolean { const L=qLower.length; if(L<STRICT_AFTER) return true; const name=(item.name_lower??"").trim(); const brand=(item.brand_lower??"").trim(); const label=`${brand} ${name}`.trim(); const tokens=tokensOf(label); const tokenPrefix=tokens.some(t=>t.startsWith(qLower)); const containsSub=label.includes(qLower); const qGrams=new Set(L>=3?ngrams(qLower,3):ngrams(qLower,2)); let gramHits=0; if(item.index_ngrams?.length){ const idx=new Set(item.index_ngrams); for(const g of qGrams){ if(idx.has(g)){ gramHits++; } } } const {bestJW,bestDL}=bestTokenSimilarities(qLower,label); const jwOk=bestJW>=(L>=5?0.84:0.88); const dlOk=bestDL<=Math.ceil(L*0.4); if(L<=4){ return tokenPrefix||jwOk||containsSub||gramHits>=1||dlOk; } else { return tokenPrefix||jwOk||containsSub||gramHits>=2||dlOk; } }
const minScoreFor = (q: string) => { const L=q.length; if(L>=12) return 0.78; if(L>=9) return 0.74; if(L>=6) return 0.70; if(L>=4) return 0.66; return 0.58; };
const strongAnchor = (it: any, qLower: string) => { const rawLabel=`${it.brand_lower??""} ${it.name_lower??""}`.trim(); const normLabel=normalize(rawLabel); const toks=tokensOf(normLabel); const qToks=tokensOf(qLower); const tokenStarts=toks.some(t=>t.startsWith(qLower)); const labelContains=normLabel.includes(qLower); const crossPrefix=qToks.some(qt=>toks.some(t=>t.startsWith(qt)||qt.startsWith(t))); const tokenContainsEitherDir=qToks.some(qt=>toks.some(t=>t.includes(qt)||qt.includes(t))); return tokenStarts||labelContains||crossPrefix||tokenContainsEitherDir; };
const digitsOnly = (s: string) => (s ?? "").replace(/\D/g,"");
function barcodeVariants(raw: string): string[] { const d=digitsOnly(raw); const out=new Set<string>(); if(!d) return []; out.add(d); if(d.length===12) out.add("0"+d); else if(d.length===13&&d.startsWith("0")) out.add(d.slice(1)); else if(d.length>13){ out.add(d.slice(0,13)); out.add(d.slice(0,12)); } return Array.from(out); }
function matchesBarcodeClientSide(itemBarcode: string|undefined, qDigits: string): boolean { const id=digitsOnly(itemBarcode??""); if(!id||!qDigits) return false; if(id===qDigits) return true; if(qDigits.length>=8&&id.startsWith(qDigits)) return true; return false; }

/** ---------- Filters (unchanged) ---------- */
type AllergenFilters = { peanut: boolean; soy: boolean };
type FilterState = { allergens: AllergenFilters; customTerms: string[]; };
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

/** ---------- NEW: profiles picker state ---------- */
type ProfileChoice = {
  id: string;
  name: string;
  data: { allergens: string[]; intolerances: string[]; dietary: string[] };
};

export default function AutocompleteScreen() {
  const { isDarkMode, colors } = useThemedColor();
  const activeColors = isDarkMode ? colors.dark : colors.light;
  const navigation = useNavigation();

  const [queryText, setQueryText] = useState('');
  const [combinedSuggestions, setCombinedSuggestions] = useState<any[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedFoodDetails, setSelectedFoodDetails] = useState<any>(null);
  const [noResults, setNoResults] = useState(false);

  // Profiles (live)
  const [profiles, setProfiles] = useState<ProfileChoice[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingCompare, setPendingCompare] = useState<{
    product: ProductDoc;
    displayName: string;
    warningsString: string;
  } | null>(null);

  // Filters UI state (unchanged)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ allergens: { peanut: false, soy: false }, customTerms: [] });
  const [customInput, setCustomInput] = useState('');

  /** Subscribe to profiles for the logged-in user */
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

  /** Saved filter helpers (unchanged UI handlers) */
  const addCustomTerm = () => {
    const term = customInput.trim();
    if (!term) return;
    setFilters(prev => ({ ...prev, customTerms: Array.from(new Set([...prev.customTerms, term])) }));
    setCustomInput('');
    setTimeout(() => fetchSuggestions(queryText), 0);
  };
  const removeCustomTerm = (term: string) => {
    setFilters(prev => ({ ...prev, customTerms: prev.customTerms.filter(t => t !== term) }));
    setTimeout(() => fetchSuggestions(queryText), 0);
  };
  const toggleAllergen = (key: keyof AllergenFilters) => {
    setFilters(prev => ({ ...prev, allergens: { ...prev.allergens, [key]: !prev.allergens[key] } }));
    setTimeout(() => fetchSuggestions(queryText), 0);
  };

  /** Compare + save history (NEW, mirrors Scan screen) */
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
      matchedSummary = lines.join('; ');
    }

    const label = profileName && matchedSummary ? `${matchedSummary} [Profile: ${profileName}]` : matchedSummary;

    try {
      await saveToHistory(displayName, warningsString, label);
    } catch (e) {
      console.error('[search] Error saving to history:', e);
    }
  };

  const ensureProfileThenCompare = async (
    displayName: string,
    product: ProductDoc,
    warningsString: string
  ) => {
    if (profiles.length <= 1) {
      const chosen = profiles[0] ?? null;
      await runCompareAndHistory(displayName, product, warningsString, chosen?.data ?? null, chosen?.name ?? null);
    } else {
      setPendingCompare({ displayName, product, warningsString });
      setPickerVisible(true);
    }
  };

  /** ----------- your (existing) search pipeline below, unchanged except where noted ----------- */

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
      const qDigits = (text ?? "").replace(/\D/g, "");
      const isBarcodey = qDigits.length >= 6;
      const variants = isBarcodey ? barcodeVariants(qDigits) : [];

      const productsRef = collection(db, "Products");

      // Targeted queries
      const ngramQ = query(productsRef, where("index_ngrams", "array-contains-any", gramsForQuery), limit(50));
      const nameQ  = query(productsRef, where("name_lower", ">=", qLower), where("name_lower", "<=", qLower + "\uf8ff"), limit(20));
      const brandQ = query(productsRef, where("brand_lower", ">=", qLower), where("brand_lower", "<=", qLower + "\uf8ff"), limit(20));
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

      // Fallback
      let usedFallback = false;
      if (candidates.length === 0) {
        const allSnap = await getDocs(query(productsRef, limit(200)));
        allSnap.docs.map(mapDoc).forEach(item => { byId[item.id] = byId[item.id] ?? item; });
        candidates = Object.values(byId);
        usedFallback = true;

        if (isBarcodey) {
          const direct = candidates.filter(c => matchesBarcodeClientSide(c.barcode, qDigits));
          if (direct.length > 0) candidates = direct;
        }
      }

      // N-gram prune
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

      // Precision gate for text (skip for barcode)
      const filtered = (usedFallback || isBarcodey)
        ? candidates
        : candidates.filter(c => passesPrecisionGate(qLower, c));

      // Filters
      const filtered2 = filtered
        .filter(it => matchesAllergenFilters(it, filters.allergens))
        .filter(it => matchesCustomTerms(it, filters.customTerms));

      // Rank
      const labelOf = (it: any) => `${it.brand_lower ?? ""} ${it.name_lower ?? ""}`.trim();
      const cutoff = minScoreFor(qLower);

      const qDigitsOnly = qDigits;
      const scored = filtered2.map(it => {
        const base = similarityScore(qLower, labelOf(it));
        let bonus = 0;
        if (isBarcodey && matchesBarcodeClientSide(it.barcode, qDigitsOnly)) bonus += 0.25;
        return { it, s: base + bonus };
      });

      let ranked: any[] = [];
      if (usedFallback && !isBarcodey) {
        const anchored = scored.filter(x => strongAnchor(x.it, qLower));
        if (anchored.length > 0) ranked = anchored.sort((a, b) => b.s - a.s).map(x => x.it);
      }
      if (ranked.length === 0) {
        ranked = scored
          .filter(x => {
            if (isBarcodey && matchesBarcodeClientSide(x.it.barcode, qDigitsOnly)) return true;
            const anchored = strongAnchor(x.it, qLower);
            const anchoredCutoff = Math.max(0, cutoff - 0.18);
            return x.s >= (anchored ? anchoredCutoff : cutoff);
          })
          .sort((a, b) => b.s - a.s)
          .map(x => x.it);
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

      // Custom entries (filtered + ranked similarly)
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
          _raw: entry,
        };
      });

      let customFiltered = customCandidates
        .filter(it => matchesAllergenFilters(it, filters.allergens))
        .filter(it => matchesCustomTerms(it, filters.customTerms));

      if (isBarcodey) {
        const direct = customFiltered.filter(c => matchesBarcodeClientSide(c.barcode, qDigitsOnly));
        if (direct.length > 0) customFiltered = direct;
      }

      const customScored = customFiltered
        .filter(c => (usedFallback || isBarcodey) ? true : passesPrecisionGate(qLower, c))
        .map(c => {
          const s = similarityScore(qLower, `${c.brand_lower} ${c.name_lower}`);
          const bonus = (isBarcodey && matchesBarcodeClientSide(c.barcode, qDigitsOnly)) ? 0.25 : 0;
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

  /** Fetch full doc, show details; Compare now triggers profile picker + real compare */
  const handleViewPress = async (item: any, index: number) => {
    if (item.source === 'custom') {
      // Build faux "details" for existing UI
      const warningArray = parseWarning(item.warning);
      setSelectedFoodDetails({ food: { food_attributes: { allergens: { allergen: warningArray } } } });
      setExpandedIndex(index);
      return;
    }

    try {
      const snap = await getDoc(doc(db, "Products", item.id));
      if (snap.exists()) {
        const docData = snap.data();
        const warningArray = parseWarning(docData.warning);
        setSelectedFoodDetails({ food: { food_attributes: { allergens: { allergen: warningArray } } } });
        setExpandedIndex(index);
      }
    } catch (err) {
      console.error('Firestore food fetch error:', err);
    }
  };

  /** UI render */
  const renderSuggestion = ({ item, index }: { item: any; index: number }) => {
    const warnings = selectedFoodDetails?.food?.food_attributes?.allergens?.allergen?.filter((a: any) => a.value !== "0");

    // NEW: Compare handler using profile picker + compareProductToProfile
    const handleCompare = async () => {
      let product: ProductDoc | null = null;
      let displayName = item.brand_name ? `${item.brand_name} — ${item.name}` : item.name;
      let warningsString = (warnings ?? []).map((a: any) => a.name).join(', ');

      if (item.source === 'custom') {
        // Build ProductDoc from custom entry (try to align names with your compare’s parser)
        const raw = item._raw ?? {};
        const docLike = {
          food_name: item.name,
          brand_name: item.brand_name ?? "",
          barcode: item.barcode ?? "",
          ingredients: item.ingredients ?? "",
          warning: item.warning ?? "",

          calories: raw.calories ?? "",
          fat: raw.fat ?? "",
          saturated_fat: raw.saturated_fat ?? "",
          trans_fat: raw.trans_fat ?? "",
          cholesterol: raw.cholesterol ?? "",
          sodium: raw.sodium ?? "",
          carbohydrate: raw.carbohydrate ?? "",
          sugar: raw.sugar ?? "",
          added_sugars: raw.added_sugars ?? "",
          fiber: raw.fiber ?? "",
          protein: raw.protein ?? "",
          potassium: raw.potassium ?? "",
          calcium: raw.calcium ?? "",
          iron: raw.iron ?? "",
          vitamin_d: raw.vitamin_d ?? "",
        };
        product = buildProductFromFirestoreDoc(docLike);
      } else {
        try {
          const snap = await getDoc(doc(db, "Products", item.id));
          if (snap.exists()) {
            product = buildProductFromFirestoreDoc(snap.data());
            // update warningsString from the actual doc (ensure consistent)
            warningsString = parseWarning(snap.data().warning).map((a: any) => a.name).join(', ');
          }
        } catch (e) {
          console.error('[search] compare fetch doc error:', e);
        }
      }

      if (!product) return;

      await ensureProfileThenCompare(displayName, product, warningsString);
    };

    return (
      <View style={[styles.suggestionCard, { backgroundColor: activeColors.backgroundTitle, borderColor: activeColors.divider }]}>
        <Text style={[styles.suggestionText, { color: activeColors.text }]}>
          {item.brand_name ? `${item.brand_name} — ${item.name}` : item.name}
          {item.barcode ? `  ·  ${item.barcode}` : ''}{item.source === 'custom' && ' (Custom)'}
        </Text>

        <Pressable style={styles.viewButton} onPress={() => handleViewPress(item, index)}>
          <Text style={styles.buttonText}>View</Text>
        </Pressable>

        {expandedIndex === index && selectedFoodDetails && (
          <View style={[styles.detailsBox, { backgroundColor: activeColors.backgroundTitle, borderColor: 'transparent' }]}>
            <View style={styles.detailsRow}>
              <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>Put image here</Text></View>

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
                  <Pressable style={styles.primaryBtn} onPress={handleCompare}>
                    <Text style={styles.primaryBtnText}>Compare with My Profile</Text>
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
    <LinearGradient colors = {activeColors.gradientBackground} style = {styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} locations={[0, 0.4, 0.6, 1]}>
      <ThemedView style={[styles.container]}>
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
              <ThemedView style={[styles.innerContainer]}>
                <TextInput
                  placeholder="Start typing a food name or barcode..."
                  placeholderTextColor={activeColors.secondaryText}
                  value={queryText}
                  onChangeText={handleInputChange}
                  keyboardType="default"
                  style={[styles.input, { color: activeColors.text, borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}
                />

                {/* Filters trigger + dropdown (unchanged) */}
                <Pressable onPress={() => setFiltersOpen(v => !v)} style={[styles.filtersTrigger, { borderColor: activeColors.divider, backgroundColor: activeColors.backgroundTitle }]}>
                  <Text style={{ color: activeColors.text, fontWeight: '600' }}>
                    Filters {filtersOpen ? '▴' : '▾'}
                  </Text>
                  {(filters.allergens.peanut || filters.allergens.soy || filters.customTerms.length > 0) && (
                    <Text style={{ color: activeColors.secondaryText, marginTop: 4, fontSize: 12 }}>
                      Active: {[filters.allergens.peanut ? 'Peanut' : null, filters.allergens.soy ? 'Soy' : null, ...filters.customTerms.map(t => `“${t}”`)].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </Pressable>

                {filtersOpen && (
                  <View style={styles.filtersBox}>
                    <Text style={[styles.filtersLabel, { color: activeColors.secondaryText }]}>Allergens</Text>
                    <View style={styles.toggleRow}>
                      <Pressable onPress={() => toggleAllergen('peanut')} style={[styles.toggle, filters.allergens.peanut ? styles.toggleOn : styles.toggleOff]}>
                        <Text style={filters.allergens.peanut ? styles.toggleTextOn : styles.toggleTextOff}>Peanut</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleAllergen('soy')} style={[styles.toggle, filters.allergens.soy ? styles.toggleOn : styles.toggleOff]}>
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
                style={[styles.viewButton, { marginTop: 10, alignSelf: 'center' }]}
                onPress={() => navigation.navigate('create-ticket' as never)}
              >
                <Text style={styles.buttonText}>Create Product Request Ticket</Text>
              </Pressable>
            </View>
          }
        />

        {/* NEW: Profiles picker modal (mirrors Scan) */}
        <Modal animationType="slide" transparent visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.profileModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profiles</Text>
              </View>

              <ScrollView style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                {profiles.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.ppItem}
                    onPress={async () => {
                      setPickerVisible(false);
                      if (pendingCompare) {
                        const { displayName, product, warningsString } = pendingCompare;
                        setPendingCompare(null);
                        await runCompareAndHistory(displayName, product, warningsString, p.data, p.name);
                      }
                    }}
                  >
                    <Text style={styles.ppItemText}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setPickerVisible(false);
                    setPendingCompare(null);
                  }}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Modal>
      </ThemedView>
    </LinearGradient>
  );
}

/** ---------- styles (kept your existing ones; added a few for profile modal) ---------- */
const styles = StyleSheet.create({
  gradient: {flex: 1,},
  container: { flex: 1, backgroundColor: 'transparent' },
  titleContainer: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 24 },
  divider: { height: 2, backgroundColor: '#E5E5EA', marginBottom: 16, width: '100%' },
  innerContainer: { paddingHorizontal: 24, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderColor: '#888', padding: 8, borderRadius: 6, backgroundColor: 'transparent' },

  // Filters
  filtersTrigger: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  filtersBox: { marginTop: 8, padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, backgroundColor: 'transparent' },
  filtersLabel: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  toggleOff: { backgroundColor: '#f0f0f0', borderColor: '#d0d0d0' },
  toggleOn: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
  toggleTextOff: { color: '#666' },
  toggleTextOn: { color: '#fff' },

  customSection: { marginTop: 12 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  addButton: { backgroundColor: '#444', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ececec', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  chipText: { marginRight: 6, color: '#333' },
  chipClose: { padding: 2 },
  chipCloseText: { color: '#666', fontSize: 12 },
  filtersHint: { marginTop: 8, fontSize: 12 },

  list: { flex: 1, backgroundColor: 'transparent' },
  suggestionCard: { flexDirection: 'column', padding: 12, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 10, backgroundColor: 'transparent' },
  suggestionText: { fontSize: 16, marginBottom: 8 },
  viewButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#007BFF', borderRadius: 6 },
  buttonText: { color: 'white' },

  detailsBox: { marginTop: 10, backgroundColor: '#f4f4f4', borderRadius: 6, padding: 10, borderColor: '#ddd', borderWidth: 1, position: 'relative' },
  detailsRow: { flexDirection: 'row', gap: 12 },
  imagePlaceholder: { width: 96, height: 96, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center' },
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

  // Profile picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  profileModal: { backgroundColor: 'white', borderRadius: 20, width: '90%', maxHeight: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  modalActions: { padding: 20, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  actionButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

  ppItem: { paddingVertical: 10, marginBottom: 5, borderWidth: 1, borderRadius: 10, alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#ddd' },
  ppItemText: { fontSize: 16, fontWeight: '500' },

  noResultsText: { textAlign: 'center', marginTop: 12, fontSize: 14 },
});
