import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { SEEDED_RULES } from '../__fixtures__/goldenRuleSets';
import { findOccurrences, normalizeENumberSpacing, segmentSpans } from '../IngredientMatching';

const analyzer = new RedFlagAnalyzer();
const keys = (text: string) => analyzer.analyze(text, SEEDED_RULES).map((f) => f.canonicalKey);

describe('IngredientMatching', () => {
  it('joins spaced and hyphenated E-numbers', () => {
    expect(normalizeENumberSpacing('Säuerungsmittel E 330, E-211, e 150d')).toBe(
      'Säuerungsmittel E330, E211, e150d'
    );
  });

  it('does not match an E-number inside a longer code', () => {
    expect(findOccurrences('e1400, e1412', 'E140')).toHaveLength(0);
    expect(findOccurrences('e140, e1400', 'E140')).toEqual([{ start: 0, end: 4 }]);
  });

  it('matches abbreviations only as whole words', () => {
    expect(findOccurrences('mitbhtx', 'BHT')).toHaveLength(0);
    expect(findOccurrences('antioxidant (bht)', 'BHT')).toHaveLength(1);
  });

  it('keeps decimal commas inside a segment', () => {
    const text = 'Kakao 7,4%, Zucker';
    const spans = segmentSpans(text);
    expect(spans.map((s) => text.slice(s.start, s.end).trim())).toEqual(['Kakao 7,4%', 'Zucker']);
  });
});

describe('RedFlagAnalyzer matching', () => {
  it('does not report sugar inside "Zuckerkulör"', () => {
    expect(keys('Wasser, Farbstoff Zuckerkulör')).not.toContain('Sugar');
  });

  it('still reports sugar in German compounds such as "Rohrzucker"', () => {
    expect(keys('Rohrzucker, Wasser')).toContain('Sugar');
  });

  it('counts glucose-fructose syrup once', () => {
    expect(keys('Wasser, Glukose-Fruktose-Sirup')).toEqual(['Glucose Fructose Syrup']);
  });

  it('counts a named additive and its E-number once', () => {
    expect(keys('Kakaomasse, Emulgator: Lecithin (E322)')).toEqual(['Lecithin']);
  });

  it('drops a class label when the substance itself is flagged', () => {
    expect(keys('Süßungsmittel (Sorbit, Aspartam)')).toEqual(['Sorbitol', 'Aspartame']);
  });

  it('keeps a class label when nothing more specific was found', () => {
    expect(keys('Wasser, Farbstoff (Carotin)')).toEqual(['Color']);
  });

  it('recognises spaced E-numbers', () => {
    expect(keys('Wasser, Säuerungsmittel E 330')).toContain('E330');
  });

  it('does not treat the grain amaranth as the colour E123', () => {
    expect(analyzer.analyze('Haferflocken, Amaranth gepufft', SEEDED_RULES)).toHaveLength(0);
    expect(analyzer.analyzeTaxonomy('Haferflocken, Amaranth gepufft')).toHaveLength(0);
    expect(keys('Zucker, Farbstoff: Amaranth')).toContain('Amaranth');
  });

  it('reports nothing for an empty text without nutriments', () => {
    expect(analyzer.analyze('', SEEDED_RULES)).toEqual([]);
  });
});
