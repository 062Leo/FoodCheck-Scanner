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
/** Substances found: the E-number where there is one, so names and codes compare equal. */
const substances = (text: string) =>
  analyzer.analyze(text, SEEDED_RULES).map((f) => f.eNumber ?? f.canonicalKey);

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

  it('reads a written-out additive as one substance, not as the words inside it', () => {
    const bread = 'Weizenmehl, Wasser, Hefe, Salz, Emulgator: ';
    expect(
      keys(
        `${bread}Mono- und Diacetylweinsäureester von Mono- und Diglyceriden von Speisefettsäuren`
      )
    ).toEqual(keys(`${bread}E472e`));
    expect(
      keys('Mono- and diacetyl tartaric acid esters of mono- and diglycerides of fatty acids')
    ).toEqual([]);
    expect(substances('Kakaobutter, Emulgator: Polyglycerin-Polyricinoleat')).toEqual(
      substances('Kakaobutter, Emulgator: E476')
    );
    // ...and counts like its own E-number.
    expect(substances('Hefe, Sorbitanmonostearat, Natriumaluminiumsilicat')).toEqual(
      substances('Hefe, E491, E554')
    );
    expect(
      substances('Zucker, Milchsäureester von Mono- und Diglyceriden von Speisefettsäuren')
    ).toEqual(substances('Zucker, E472b'));
    expect(
      substances('flour, emulsifier lactic acid esters of mono- and diglycerides of fatty acids')
    ).toEqual(substances('flour, emulsifier E472b'));
    // Still found where the word stands on its own or the compound really contains it.
    expect(keys('Sorbit, Glycerin')).toHaveLength(2);
    expect(keys('Süßungsmittel: Aspartam-Acesulfam-Salz').length).toBeGreaterThan(0);
  });

  it('matches short translations of a rule only as words of their own', () => {
    const salt: FilterRule = {
      id: 1,
      key: 'Salz',
      type: 'ingredient',
      severity: 'red_flag',
      category: 'Eigene',
      translations: '{"fr":"Sel","es":"Sal","it":"Sale"}',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const found = (text: string) => analyzer.analyze(text, [salt]).length;

    expect(found('Kopfsalat, Gurken, Essig')).toBe(0);
    expect(found('Sellerie, Karotten, Salami')).toBe(0);
    expect(found('Eau, sel, sucre')).toBe(1);
    expect(found('Meersalz')).toBe(1);
  });

  it('still finds plurals of short translations and compounds of longer ones', () => {
    const rule = (key: string, translations: string): FilterRule => ({
      id: 1,
      key,
      type: 'ingredient',
      severity: 'red_flag',
      category: 'Eigene',
      translations,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const found = (text: string, r: FilterRule) => analyzer.analyze(text, [r]).length;

    expect(found('farine, œufs frais', rule('Ei', '{"fr":"Œuf"}'))).toBe(1);
    expect(found('magere melkpoeder', rule('Milch', '{"nl":"Melk"}'))).toBe(1);
    expect(found('suiker, walnoot', rule('Nuss', '{"nl":"Noot"}'))).toBe(1);
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
      ).toEqual(['Sugar', 'E476', 'Color']);
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

describe('RedFlagAnalyzer filter list additions', () => {
  it('matches "Citronensäure" as citric acid, once together with its E-number', () => {
    expect(substances('Wasser, Säuerungsmittel: Citronensäure')).toEqual(['E330']);
    expect(substances('Säuerungsmittel: Citronensäure (E330)')).toEqual(['E330']);
  });

  it('counts a cellulose ether once, not also as cellulose', () => {
    expect(substances('Wasser, Verdickungsmittel: Methylcellulose')).toEqual(['E461']);
    expect(substances('Verdickungsmittel: Hydroxypropylmethylcellulose (E464)')).toEqual(['E464']);
    expect(substances('Carboxymethylcellulose, mikrokristalline Cellulose')).toEqual([
      'E466',
      'E460',
    ]);
  });

  it('counts carmine and cochineal as one colour', () => {
    expect(substances('Farbstoff: Karmin (Cochenille), E120')).toEqual(['E120']);
  });

  it('finds the German spelling variants', () => {
    expect(keys('Propylenglycol')).toHaveLength(1);
    expect(keys('Sonnenblumenkernöl, Maisöl')).toEqual(['Sonnenblumenkernöl', 'Maisöl']);
    expect(keys('Erbseneiweiß, Weizeneiweiß')).toEqual(['Erbseneiweiß', 'Weizeneiweiß']);
    expect(keys('Selleriesaftpulver, Sellerieextrakt')).toEqual([
      'Selleriesaftpulver',
      'Celery Extract',
    ]);
  });

  it('counts a refined or hydrogenated oil once, not also as the plain oil', () => {
    expect(keys('Sonnenblumenöl raffiniert')).toEqual(['Sunflower Oil Refined']);
    expect(keys('Rapsöl, Pflanzenöl (Sonnenblume)')).toEqual(['Rapeseed Oil', 'Vegetable Oil']);
  });

  it('finds genetically modified ingredients but not the negated statement', () => {
    expect(keys('Sojabohnen (genetisch verändert)')).toEqual(['Genetically Modified']);
    expect(keys('Maisstärke aus gentechnisch verändertem Mais')).toEqual([
      'gentechnisch verändert',
    ]);
    expect(keys('Sojabohnen (nicht genetisch verändert)')).toEqual([]);
    expect(keys('Lecithin aus nicht gentechnisch veränderten Sojabohnen')).toEqual(['Lecithin']);
    expect(keys('Hergestellt ohne gentechnisch veränderte Organismen')).toEqual([]);
    expect(keys('Ohne Gentechnik')).toEqual([]);
    expect(keys('soybeans (non-genetically modified)')).toEqual([]);
    expect(keys('soja non génétiquement modifié')).toEqual([]);
  });

  it('finds alcohol but not alcohol-free, sugar alcohols or spirit vinegar', () => {
    expect(keys('Zucker, Alkohol, Kakao')).toEqual(['Sugar', 'Alcohol']);
    expect(keys('Vanilleextrakt (Ethanol)')).toEqual(['Ethanol']);
    expect(keys('alkoholfreies Bier')).toEqual([]);
    expect(keys('Bier, entalkoholisiert')).not.toContain('Alcohol');
    expect(keys('Süßungsmittel: Zuckeralkohole')).not.toContain('Alcohol');
    expect(keys('sweeteners (sugar alcohols)')).not.toContain('Alcohol');
    expect(keys('Malzgetränk, 0,0 % Alkohol')).toEqual([]);
    expect(keys('ohne Alkohol')).toEqual([]);
    expect(keys('Alkoholessig, Senfsaat')).toEqual([]);
    expect(keys("graines de moutarde, vinaigre d'alcool")).toEqual([]);
    expect(keys('bevanda analcolica, alcohol-free beer, sans alcool')).toEqual([]);
  });

  it('treats only 0.0 % as alcohol-free, not 10.0 % or 20.0 %', () => {
    expect(keys('Wein, 10,0 % Alkohol')).toEqual(['Alcohol']);
    expect(keys('liqueur, 20.0% alcohol')).toEqual(['Alcohol']);
    expect(keys('Likör, 15.0 % vol. Alkohol')).toEqual(['Alcohol']);
    expect(keys('0,0 % Alkohol')).toEqual([]);
    expect(keys('Bier alkoholfrei (0,0 %)')).toEqual([]);
    expect(keys('Malzgetränk (0.0% alcohol)')).toEqual([]);
  });

  it('finds talc but not "talk" inside de-alcoholised', () => {
    expect(keys('Trennmittel: Talkum')).toEqual(['Talc']);
    expect(keys('Trennmittel: Talk')).toEqual(['Talc']);
    expect(substances('Trennmittel: E553b')).toEqual(['E553B']);
    expect(keys('Talk, entalkoholisierter Wein')).toEqual(['Talc']);
    expect(keys('Wein, entalkoholisiert')).toEqual([]);
    expect(keys('entalkoholisierter Wein, Traubensaft')).not.toContain('Talc');
    expect(keys('Zucker, Alkohol')).toEqual(['Sugar', 'Alcohol']);
  });

  it('finds heat-treated milk but not raw or unpasteurised milk', () => {
    expect(keys('Milch, pasteurisiert')).toEqual(['Pasteurised']);
    expect(keys('pasteurized milk')).toEqual(['Pasteurized']);
    expect(keys('H-Milch, ultrahocherhitzt')).toEqual(['H-Milch', 'ultrahocherhitzt']);
    expect(keys('lait UHT')).toEqual(['UHT']);
    expect(keys('Rohmilch (nicht pasteurisiert)')).toEqual([]);
    expect(keys('Rohmilch, nicht wärmebehandelt')).toEqual([]);
    expect(keys('unpasteurised milk, unpasteurisierte Milch')).toEqual([]);
    expect(keys('lait cru non pasteurisé, ongepasteuriseerde melk')).toEqual([]);
    expect(keys('Ein Bauer ruhte')).toEqual([]);
    expect(keys('Vollmilch, Frisch-Milch')).toEqual([]);
  });

  it('finds insects, farmed fish and meat substitutes', () => {
    expect(keys('Mehl, Pulver aus Acheta domesticus (Hausgrille)')).toEqual(['Acheta domesticus']);
    expect(keys('Lachs (Salmo salar) aus Aquakultur, gezüchtet in Norwegen')).toEqual([
      'Aquaculture',
      'gezüchtet',
    ]);
    expect(keys('Wasser, Erbsenprotein, Mykoprotein')).toEqual(['Pea Protein', 'Mycoprotein']);
  });

  it('no longer flags packaging and propellant gases', () => {
    expect(
      keys('Sahne, Treibgas: Distickstoffmonoxid, Schutzgas: Kohlendioxid, E290, E941')
    ).toEqual([]);
  });
});
