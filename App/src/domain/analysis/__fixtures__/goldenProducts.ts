import type { Product } from '../../../types/Product';

/**
 * Fixed reference set of realistic products used to pin down rating behaviour.
 * Ingredient lists are typical label texts (DE/EN/FR), not tied to real brands.
 * Any change to rating output for these products must be deliberate and documented.
 */
export const GOLDEN_PRODUCTS: Product[] = [
  {
    ean: '4000000000001',
    name: 'Mineralwasser',
    ingredientsText: 'Natürliches Mineralwasser',
    novaScore: 1,
  },
  {
    ean: '4000000000002',
    name: 'Nuss-Nougat-Creme',
    ingredientsText:
      'Zucker, Palmöl, Haselnüsse 13%, fettarmer Kakao 7,4%, Magermilchpulver 6,6%, Emulgator Lecithine (Soja), Vanillin',
    novaScore: 4,
    nutriments: {
      sugars100g: 56.3,
      fat100g: 30.9,
      saturatedFat100g: 10.6,
      salt100g: 0.107,
      energyKcal100g: 539,
    },
  },
  {
    ean: '4000000000003',
    name: 'Cola',
    ingredientsText:
      'Wasser, Zucker, Kohlensäure, Farbstoff E150d, Säuerungsmittel Phosphorsäure, natürliches Aroma, Aroma Koffein',
    novaScore: 4,
    nutriments: { sugars100g: 10.6, energyKcal100g: 42 },
  },
  {
    ean: '4000000000004',
    name: 'Cola light',
    ingredientsText:
      'Wasser, Kohlensäure, Farbstoff Zuckerkulör E150d, Süßungsmittel Aspartam und Acesulfam K, Säuerungsmittel Phosphorsäure und Citronensäure, Aroma, Koffein',
    novaScore: 4,
  },
  {
    ean: '4000000000005',
    name: 'Amaranth-Müsli',
    ingredientsText: 'Haferflocken 60%, Amaranth gepufft 10%, Rosinen, Sonnenblumenkerne',
    novaScore: 1,
  },
  {
    ean: '4000000000006',
    name: 'Bratwurst',
    ingredientsText:
      'Schweinefleisch 85%, Wasser, Speisesalz, Gewürze, Dextrose, Stabilisator: Diphosphate, Antioxidationsmittel: Natriumascorbat, Konservierungsstoff: Natriumnitrit',
    novaScore: 4,
  },
  {
    ean: '4000000000007',
    name: 'Fruchtgummi',
    ingredientsText:
      'Glukosesirup, Zucker, Gelatine, Dextrose, Säuerungsmittel: Citronensäure, Fruchtsaft aus Fruchtsaftkonzentrat, Farbstoffe: E 120, E 100, Überzugsmittel: Bienenwachs, Carnaubawachs',
    novaScore: 4,
  },
  {
    ean: '4000000000008',
    name: 'Toastbrot',
    ingredientsText:
      'Weizenmehl, Wasser, Hefe, Rapsöl, Zucker, Speisesalz, Emulgatoren (E471, E472e), Mehlbehandlungsmittel Ascorbinsäure',
    novaScore: 4,
  },
  {
    ean: '4000000000009',
    name: 'Naturjoghurt',
    ingredientsText: 'Joghurt mild 3,8% Fett',
    novaScore: 1,
  },
  {
    ean: '4000000000010',
    name: 'Tomatenketchup',
    ingredientsText: 'Tomatenmark, Branntweinessig, Zucker, Salz, Gewürze',
    novaScore: 3,
    nutriments: { sugars100g: 22, salt100g: 1.8 },
  },
  {
    ean: '4000000000011',
    name: 'Limonade',
    ingredientsText: 'Wasser, Glukose-Fruktose-Sirup, Säuerungsmittel Citronensäure, Aroma',
    novaScore: 4,
  },
  {
    ean: '4000000000012',
    name: 'Chocolate bar',
    ingredientsText:
      'Sugar, glucose syrup, hydrogenated vegetable fat (palm kernel oil), whey powder, emulsifier (soy lecithin), salt, flavourings, colour (E102)',
    novaScore: 4,
  },
  {
    ean: '4000000000013',
    name: 'Pudding',
    ingredientsText: 'Wasser, modifizierte Stärke, E1400, E1412, Zucker',
    novaScore: 4,
  },
  {
    ean: '4000000000014',
    name: 'Eistee mit E-Nummern',
    ingredientsText: 'Wasser, Säuerungsmittel E 330, Konservierungsstoff E-211',
    novaScore: 4,
  },
  { ean: '4000000000015', name: 'Ohne Daten' },
  { ean: '4000000000016', name: 'Nur NOVA 4', novaScore: 4 },
  { ean: '4000000000017', name: 'Reis', ingredientsText: 'Reis' },
  {
    ean: '4000000000018',
    name: 'Zuckerreiche Cerealien',
    ingredientsText: 'Maismehl, Zucker, Salz, Gerstenmalzextrakt',
    novaScore: 3,
    nutriments: { sugars100g: 45, salt100g: 1.1, energyKcal100g: 380 },
  },
  {
    ean: '4000000000019',
    name: 'Kartoffelchips',
    ingredientsText: 'Kartoffeln, Sonnenblumenöl (35%), Speisesalz',
    novaScore: 3,
  },
  {
    ean: '4000000000020',
    name: 'Instantnudeln',
    ingredientsText:
      'Weizenmehl, Palmöl, Salz, Geschmacksverstärker Mononatriumglutamat, Hefeextrakt, Maltodextrin, E621',
    novaScore: 4,
  },
  {
    ean: '4000000000021',
    name: 'Olivenöl',
    ingredientsText: 'Natives Olivenöl extra',
    novaScore: 2,
  },
  {
    ean: '4000000000022',
    name: 'Margarine',
    ingredientsText:
      'Pflanzliche Öle und Fette (Palm, Raps) in veränderlichen Anteilen, Wasser, Speisesalz 0,1%, Emulgator (Mono- und Diglyceride von Speisefettsäuren), Säuerungsmittel (Citronensäure), Vitamine A und D, Farbstoff (Carotin)',
    novaScore: 4,
  },
  {
    ean: '4000000000023',
    name: 'Pâte à tartiner',
    ingredientsText:
      'Sucre, huile de palme, noisettes 13 %, lait écrémé en poudre, cacao maigre, émulsifiants : lécithines (soja), vanilline',
    novaScore: 4,
  },
  {
    ean: '4000000000024',
    name: 'Kaugummi zuckerfrei',
    ingredientsText:
      'Süßungsmittel (Sorbit, Maltit, Mannit, Aspartam, Acesulfam K), Kaumasse, Aromen, Verdickungsmittel (Gummi arabicum), Feuchthaltemittel (Glycerin), Emulgator (Sojalecithin), Farbstoff (E171), Antioxidationsmittel (E321)',
    novaScore: 4,
  },
  { ean: '4000000000025', name: 'Tafelwasser', ingredientsText: 'Wasser' },
  {
    ean: '4000000000026',
    name: 'Butter',
    ingredientsText: 'Unsalted butter (cream)',
    novaScore: 2,
  },
  {
    ean: '4000000000027',
    name: 'Zartbitterschokolade',
    ingredientsText: 'Kakaomasse, Zucker, Kakaobutter, Emulgator: Lecithin (E322), Vanilleextrakt',
    novaScore: 4,
  },
  {
    ean: '4000000000028',
    name: 'Kurkuma gemahlen',
    ingredientsText: 'Kurkuma, Pfeffer',
    novaScore: 1,
  },
  {
    ean: '4000000000029',
    name: 'Eistee Pfirsich',
    ingredientsText:
      'Wasser, Zucker, Schwarzteeextrakt, Säuerungsmittel Citronensäure, Säureregulator Natriumcitrate, Aroma, Antioxidationsmittel Ascorbinsäure',
    novaScore: 4,
  },
  {
    ean: '4000000000030',
    name: 'Proteinriegel',
    ingredientsText:
      'Milchproteinisolat, Sojaprotein, Maltitsirup, Kakaobutter, Sucralose, Emulgator E322',
    novaScore: 4,
    nutriments: { sugars100g: 1.2, fat100g: 12, energyKcal100g: 360 },
  },
  {
    ean: '4000000000031',
    name: 'Haferdrink',
    ingredientsText: 'Wasser, Hafer 10%, Rapsöl, Salz',
    novaScore: 3,
    nutriments: { sugars100g: 4, salt100g: 0.1 },
  },
  {
    ean: '4000000000032',
    name: 'Nur Nährwerte',
    nutriments: { sugars100g: 30, fat100g: 25, energyKcal100g: 480 },
  },
];
