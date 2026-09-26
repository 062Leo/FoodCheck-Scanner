import { mapSelectionToImage, normalizeIngredientsOcrText } from '../ocrGeometry';

describe('mapSelectionToImage', () => {
  // A 4:3 photo (4000x3000) shown in a tall 400x800 view: scale 0.1, centred vertically
  // (drawn 400x300, offset y = 250).
  const view = { width: 400, height: 800 };
  const image = { width: 4000, height: 3000 };

  it('maps a selection with one scale factor and the letter-box offset', () => {
    expect(mapSelectionToImage({ x: 100, y: 300, width: 200, height: 100 }, view, image)).toEqual({
      originX: 1000,
      originY: 500,
      width: 2000,
      height: 1000,
    });
  });

  it('clips selections that reach into the black bars', () => {
    expect(mapSelectionToImage({ x: 0, y: 200, width: 400, height: 200 }, view, image)).toEqual({
      originX: 0,
      originY: 0,
      width: 4000,
      height: 1500,
    });
  });

  it('rejects selections outside the photo or too small', () => {
    expect(mapSelectionToImage({ x: 0, y: 0, width: 400, height: 200 }, view, image)).toBeNull();
    expect(mapSelectionToImage({ x: 10, y: 300, width: 1, height: 1 }, view, image)).toBeNull();
  });
});

describe('normalizeIngredientsOcrText', () => {
  it('joins hyphenated words and line breaks into one paragraph', () => {
    expect(normalizeIngredientsOcrText('Zutaten: Wasser, Zu-\ncker,\nSalz  ,\nAroma')).toBe(
      'Zutaten: Wasser, Zucker, Salz , Aroma'
    );
  });

  it('keeps hyphens that belong to the word', () => {
    expect(normalizeIngredientsOcrText('Glukose-\nFruktose-Sirup')).toBe('Glukose-Fruktose-Sirup');
  });
});
