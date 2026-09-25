/**
 * Barcode validation for food products (EAN-8, EAN-13, UPC-A).
 * The check digit rejects most misreads that happen in bad light or at an angle.
 */

function checkDigitValid(digits: string): boolean {
  const body = digits.slice(0, -1);
  const expected = Number(digits[digits.length - 1]);
  let sum = 0;
  // Weights 3,1,3,1… from the rightmost body digit (GS1 rule for all lengths).
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === expected;
}

/**
 * Returns the canonical product code or null if the input is not a valid
 * EAN-8/EAN-13/UPC-A. UPC-A (12 digits) is returned as EAN-13 with a leading zero,
 * which is how Open Food Facts stores it.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length !== 8 && digits.length !== 12 && digits.length !== 13) return null;
  if (!checkDigitValid(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

export function isValidBarcode(raw: string): boolean {
  return normalizeBarcode(raw) !== null;
}
