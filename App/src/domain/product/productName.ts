/** Placeholder names older app versions stored instead of leaving the name empty. */
const PLACEHOLDER_NAMES = new Set(['unbekanntes produkt', 'unknown product']);

export function hasProductName(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  return Boolean(trimmed) && !PLACEHOLDER_NAMES.has(trimmed!.toLowerCase());
}

/** The name to show, or the (translated) fallback for unnamed products. */
export function displayProductName(name: string | null | undefined, fallback: string): string {
  return hasProductName(name) ? name!.trim() : fallback;
}
