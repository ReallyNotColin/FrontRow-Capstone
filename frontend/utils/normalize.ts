export function normalizeString(input: string): string {
  return input
    .normalize("NFD")                    // split characters and diacritics
    .replace(/[\u0300-\u036f]/g, '')    // remove diacritics
    .replace(/[^\w\s]/g, '')            // remove punctuation
    .toLowerCase();                     // lowercase
}
