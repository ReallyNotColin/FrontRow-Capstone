// frontend/utils/nutritionOCR.ts
export type ParsedNutrition = {
  food_name?: string;
  brand_name?: string;
  serving?: string;
  serving_amount?: string;
  ingredients?: string;
  warning?: string;

  calories?: string;
  fat?: string;
  saturated_fat?: string;
  trans_fat?: string;
  monounsaturated_fat?: string;
  polyunsaturated_fat?: string;
  cholesterol?: string;
  sodium?: string;
  carbohydrate?: string;
  sugar?: string;
  added_sugars?: string;
  fiber?: string;
  protein?: string;
  potassium?: string;
  calcium?: string;
  iron?: string;
  vitamin_d?: string;
};

const num = (s?: string) => (s || "").replace(/[^\d.]/g, "");

export function parseNutritionFacts(raw: string): ParsedNutrition {
  const text = raw.replace(/\r/g, "").toLowerCase();

  let ingredients = "";
  const ingMatch = text.match(/ingredients?\s*[:\-]\s*([\s\S]+?)(?:\n|may contain|contains|allergen|warning|distributed by|manufactured)/);
  if (ingMatch) ingredients = ingMatch[1].replace(/\n/g, " ").trim();

  let warning = "";
  const warnMatch = text.match(/contains?\s*[:\-]\s*([^\n]+)/);
  if (warnMatch) warning = warnMatch[1].replace(/\./g, "").trim();

  let serving = "";
  const servingMatch = text.match(/serving size\s*([^\n]+)/);
  if (servingMatch) serving = servingMatch[1].trim();

  let serving_amount = "";
  const spc = text.match(/servings?\s+per\s+container\s*([^\n]+)/);
  if (spc) serving_amount = num(spc[1]);

  const grab = (label: RegExp) => {
    const m = text.match(label);
    if (!m) return "";
    return num(m[1] || m[0]);
  };

  return {
    ingredients,
    warning,
    serving,
    serving_amount,

    calories: grab(/calories[^\d]*(\d+)/),
    fat: grab(/total\s+fat[^\d]*(\d+\.?\d*)\s*g/),
    saturated_fat: grab(/saturated\s+fat[^\d]*(\d+\.?\d*)\s*g/),
    trans_fat: grab(/trans\s+fat[^\d]*(\d+\.?\d*)\s*g/),
    monounsaturated_fat: grab(/monounsaturated\s+fat[^\d]*(\d+\.?\d*)\s*g/),
    polyunsaturated_fat: grab(/polyunsaturated\s+fat[^\d]*(\d+\.?\d*)\s*g/),
    cholesterol: grab(/cholesterol[^\d]*(\d+\.?\d*)\s*mg/),
    sodium: grab(/sodium[^\d]*(\d+\.?\d*)\s*mg/),
    carbohydrate: grab(/total\s+carbohydrate[^\d]*(\d+\.?\d*)\s*g/),
    fiber: grab(/dietary\s+fiber[^\d]*(\d+\.?\d*)\s*g/),
    sugar: grab(/total\s+sugars?[^\d]*(\d+\.?\d*)\s*g/),
    added_sugars: grab(/added\s+sugars?[^\d]*(\d+\.?\d*)\s*g/),
    protein: grab(/protein[^\d]*(\d+\.?\d*)\s*g/),

    potassium: grab(/potassium[^\d]*(\d+\.?\d*)\s*mg/),
    calcium: grab(/calcium[^\d]*(\d+\.?\d*)\s*mg/),
    iron: grab(/iron[^\d]*(\d+\.?\d*)\s*mg/),
    vitamin_d: grab(/vitamin\s*d[^\d]*(\d+\.?\d*)\s*(mcg|iu)/),
  };
}

export async function callVisionOcr(base64: string, apiKey: string): Promise<string> {
  const body = {
    requests: [
      { image: { content: base64 }, features: [{ type: "TEXT_DETECTION" }] }
    ],
  };
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vision OCR failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json?.responses?.[0]?.fullTextAnnotation?.text || "";
}
