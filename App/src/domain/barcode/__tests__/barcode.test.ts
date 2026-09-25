import { isValidBarcode, normalizeBarcode } from '../barcode';

describe('normalizeBarcode', () => {
  it('accepts valid EAN-13 and EAN-8 codes', () => {
    expect(normalizeBarcode('3017624010701')).toBe('3017624010701');
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });

  it('turns UPC-A into EAN-13 with a leading zero', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });

  it('ignores spaces and hyphens from manual input', () => {
    expect(normalizeBarcode(' 4006381 333931 ')).toBe('4006381333931');
    expect(normalizeBarcode('4006-3813-33931')).toBe('4006381333931');
  });

  it('rejects misreads with a wrong check digit', () => {
    expect(normalizeBarcode('3017624010702')).toBeNull();
    expect(normalizeBarcode('96385075')).toBeNull();
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(normalizeBarcode('123')).toBeNull();
    expect(normalizeBarcode('30176240107010')).toBeNull();
    expect(normalizeBarcode('30176240107O1')).toBeNull();
    expect(isValidBarcode('')).toBe(false);
  });
});
