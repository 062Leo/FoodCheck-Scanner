import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { SEEDED_RULES } from '../__fixtures__/goldenRuleSets';
import {
  IngredientStructure,
  findOccurrences,
  lowerCasePreservingLength,
  normalizeENumberSpacing,
} from '../IngredientMatching';
import type { FilterRule } from '../../../types/FilterRule';

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

  it('matches known abbreviations only as whole words, other short keys as substrings', () => {
    expect(findOccurrences('mitbhtx', 'BHT')).toHaveLength(0);
    expect(findOccurrences('antioxidant (bht)', 'BHT')).toHaveLength(1);
    expect(findOccurrences('meersalz, zucker', 'SALZ')).toHaveLength(1);
  });

  it('finds the ingredient item a position belongs to', () => {
    const text = 'Füllung (Zucker, Farbstoff: Carotin), Wasser. Salz';
    const structure = new IngredientStructure(text);
    const item = (word: string) => {
      const span = structure.itemAt(text.indexOf(word));
      return text.slice(span.start, span.end).trim();
    };
    expect(item('Carotin')).toBe('Farbstoff: Carotin');
    expect(item('Zucker')).toBe('Zucker');
    expect(item('Füllung')).toBe('Füllung (Zucker, Farbstoff: Carotin)');
    expect(item('Wasser')).toBe('Wasser');
    expect(item('Salz')).toBe('Salz');
  });

  it('keeps decimal commas inside an item and ignores unclosed brackets', () => {
    const text = 'Kakao 7,4%, Schokolade (Zucker, Salz';
    const structure = new IngredientStructure(text);
    const first = structure.itemAt(0);
    expect(text.slice(first.start, first.end)).toBe('Kakao 7,4%');
    const salt = structure.itemAt(text.indexOf('Salz'));
    expect(text.slice(salt.start, salt.end).trim()).toBe('Salz');
  });

  it('matches E-numbers with roman or letter suffixes for keys without suffix', () => {
    expect(findOccurrences('e500ii, e450a', 'E500')).toHaveLength(1);
    expect(findOccurrences('e500ii, e450a', 'E450')).toHaveLength(1);
    expect(findOccurrences('e150d', 'E150a')).toHaveLength(0);
  });

  it('keeps the string length when lower-casing', () => {
    const text = 'İçerik: Palmöl';
    expect(lowerCasePreservingLength(text)).toHaveLength(text.length);
  });

  it('does not join "Vitamin E 150"', () => {
    expect(normalizeENumberSpacing('Vitamin E 150 mg, E 330')).toBe('Vitamin E 150 mg, E330');
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

  describe('regressions from review', () => {
    const rule = (key: string, severity: FilterRule['severity'] = 'ok'): FilterRule => ({
      id: 9000,
      type: 'ingredient',
      key,
      category: 'Test',
      severity,
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const nutrientRule = (
      severity: FilterRule['severity'],
      operator: 'gt' | 'lt',
      threshold: number
    ): FilterRule => ({
      id: 9100,
      type: 'nutrient',
      key: 'sugars_100g',
      category: 'Zucker & Sirupe',
      operator,
      threshold,
      severity,
      created_at: '2026-01-01T00:00:00.000Z',
    });

    it('finds E-numbers with suffixes such as E500ii', () => {
      expect(keys('Backtriebmittel: E500ii, E503ii, Stabilisator E450i, E452i')).toEqual([
        'E500',
        'E503',
        'E450',
        'E452',
      ]);
    });

    it('keeps a class label whose own ingredient has nothing specific', () => {
      expect(keys('Füllung (Zucker, Farbstoff: Carotin), Wasser')).toEqual(['Sugar', 'Color']);
      expect(keys('Zucker. Emulgator Lecithin. Farbstoff Carotin')).toEqual([
        'Sugar',
        'Lecithin',
        'Color',
      ]);
    });

    it('survives unclosed brackets', () => {
      expect(
        keys('Zucker, Schokolade (Kakaomasse, Emulgator E476, Wasser, Farbstoff Carotin')
      ).toEqual(['Sugar', 'Emulsifier', 'Color']);
    });

    it('does not merge distinct additives of one family', () => {
      expect(keys('Emulgatoren (E472a, E472c)')).toEqual(['E472a', 'E472c']);
      expect(keys('Farbstoffe (E160b, E160c)')).toEqual(['E160b', 'E160c']);
    });

    it('merges caramel colour variants within one ingredient', () => {
      expect(keys('Farbstoff Zuckerkulör E150d')).toHaveLength(1);
    });

    it('keeps different starches apart', () => {
      expect(keys('Distärkephosphat, Acetyliertes Distärkephosphat')).toEqual([
        'Distarch Phosphate',
        'Acetylated Distarch Phosphate',
      ]);
    });

    it('lets an ok rule whitelist the same additive under another name', () => {
      const found = analyzer.analyze('Säuerungsmittel Zitronensäure', [
        ...SEEDED_RULES,
        rule('E330'),
      ]);
      expect(found.map((f) => f.canonicalKey)).not.toContain('Citric Acid');
    });

    it('lets an ok rule in one language whitelist other languages', () => {
      expect(
        analyzer.analyze('sucre, Zucker', [rule('Sugar', 'red_flag'), rule('Zucker')])
      ).toEqual([]);
    });

    it('applies an ok nutrient rule only while its own condition holds', () => {
      const rules = [nutrientRule('red_flag', 'gt', 20), nutrientRule('ok', 'lt', 5)];
      expect(analyzer.analyze('', rules, { sugars100g: 50 })).toHaveLength(1);
      expect(analyzer.analyze('', rules, { sugars100g: 3 })).toHaveLength(0);
    });

    it('skips taxonomy findings whitelisted by an ok rule', () => {
      expect(analyzer.analyzeTaxonomy('Konservierungsstoff E211', [rule('E211')])).toEqual([]);
    });

    it('does not count a grain amaranth next to a colour item', () => {
      expect(keys('Müsli (Amaranth gepufft, Farbstoff: Carotin)')).toEqual(['Color']);
    });

    it('treats artificial sweeteners as a class label', () => {
      expect(keys('Wasser, künstliche Süßungsmittel (Aspartam, Acesulfam K)')).toEqual([
        'Aspartame',
        'Acesulfame K',
      ]);
    });

    it('does not crash on malformed stored translations', () => {
      const bad = { ...rule('Meine Zutat', 'red_flag'), translations: '{"de": 5, "fr": "e"}' };
      expect(analyzer.analyze('Wasser, Salz', [bad])).toEqual([]);
    });
  });
});
