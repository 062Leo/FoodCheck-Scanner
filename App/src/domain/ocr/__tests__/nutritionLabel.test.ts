import { parseNutritionLabel } from '../nutritionLabel';

describe('parseNutritionLabel', () => {
  it('reads a typical German table', () => {
    expect(
      parseNutritionLabel(
        [
          'Nährwerte pro 100 g',
          'Brennwert 1.540 kJ / 368 kcal',
          'Fett 12,5 g',
          'davon gesättigte Fettsäuren 3,1 g',
          'Kohlenhydrate 55 g',
          'davon Zucker 22 g',
          'Ballaststoffe 4,2 g',
          'Eiweiss 7,8 g',
          'Salz <0,5 g',
        ].join('\n')
      )
    ).toEqual({
      energyKcal100g: 368,
      fat100g: 12.5,
      saturatedFat100g: 3.1,
      carbohydrates100g: 55,
      sugars100g: 22,
      fiber100g: 4.2,
      proteins100g: 7.8,
      salt100g: 0.5,
    });
  });

  it('prefers kcal next to its unit over kJ', () => {
    expect(parseNutritionLabel('Energie 368 kcal (1540 kJ)').energyKcal100g).toBe(368);
    expect(parseNutritionLabel('Energie 1540 kJ (368 kcal)').energyKcal100g).toBe(368);
  });

  it('converts kJ when no kcal value is given', () => {
    expect(parseNutritionLabel('Energy 523 kJ').energyKcal100g).toBe(125);
  });

  it('reads "Energie (kJ/kcal) 1540/368"', () => {
    expect(parseNutritionLabel('Energie (kJ/kcal) 1540/368').energyKcal100g).toBe(368);
  });

  it('reads English labels including "Fiber" and "Sugar"', () => {
    expect(
      parseNutritionLabel('Fat 3.2g\nof which saturates 1.1g\nSugar 9g\nFiber 2g\nProtein 5g')
    ).toEqual({
      fat100g: 3.2,
      saturatedFat100g: 1.1,
      sugars100g: 9,
      fiber100g: 2,
      proteins100g: 5,
    });
  });

  it('reads traces as zero', () => {
    expect(parseNutritionLabel('Salz Spuren').salt100g).toBe(0);
  });

  it('does not take the saturated fat value for fat', () => {
    expect(parseNutritionLabel('davon gesättigte Fettsäuren 2 g')).toEqual({ saturatedFat100g: 2 });
  });

  it('returns nothing for text without nutrients and never throws', () => {
    expect(parseNutritionLabel('Hergestellt in Deutschland')).toEqual({});
    expect(parseNutritionLabel(null as unknown as string)).toEqual({});
  });
});
