/**
 * A FoodData Central search response for a branded food, trimmed to the fields the app
 * reads. Shape and values follow a real response (api.nal.usda.gov/fdc/v1/foods/search);
 * names and barcode are replaced. Energy and sodium appear twice, as in the real data
 * (the second entry is the product as prepared).
 */
export const usdaBrandedSearch = {
  totalHits: 1,
  currentPage: 1,
  totalPages: 1,
  foodSearchCriteria: {
    query: '012345678905 OR 0012345678905 OR 00012345678905',
    dataType: ['Branded'],
    pageSize: 10,
  },
  foods: [
    {
      fdcId: 1000001,
      description: 'OAT CEREAL RINGS',
      dataType: 'Branded',
      gtinUpc: '00012345678905',
      publishedDate: '2023-04-27',
      modifiedDate: '2019-04-24',
      brandOwner: 'EXAMPLE FOODS INC.',
      brandName: 'Oat Rings',
      ingredients:
        'WHOLE GRAIN OATS, CORN STARCH, SUGAR, SALT, TRIPOTASSIUM PHOSPHATE. VITAMIN E (MIXED TOCOPHEROLS) ADDED TO PRESERVE FRESHNESS.VITAMINS AND MINERALS: CALCIUM CARBONATE, IRON AND ZINC (MINERAL NUTRIENTS), VITAMIN C (SODIUM ASCORBATE), A B VITAMIN (NIACINAMIDE), VITAMIN B6 (PYRIDOXINE HYDROCHLORIDE), VITAMIN A (PALMITATE), VITAMIN B1 (THIAMIN MONONITRATE), A B VITAMIN (FOLIC ACID), VITAMIN B12, VITAMIN D3.',
      marketCountry: 'United States',
      foodCategory: 'Processed Cereal Products',
      dataSource: 'GDSN',
      packageWeight: '18 ONZ',
      servingSize: 20,
      servingSizeUnit: 'GRM',
      householdServingFullText: '3/4 cup (20g)',
      foodNutrients: [
        {
          nutrientId: 1003,
          nutrientName: 'Protein',
          nutrientNumber: '203',
          unitName: 'G',
          value: 12.8,
        },
        {
          nutrientId: 1004,
          nutrientName: 'Total lipid (fat)',
          nutrientNumber: '204',
          unitName: 'G',
          value: 6.41,
        },
        {
          nutrientId: 1005,
          nutrientName: 'Carbohydrate, by difference',
          nutrientNumber: '205',
          unitName: 'G',
          value: 74.4,
        },
        {
          nutrientId: 1008,
          nutrientName: 'Energy',
          nutrientNumber: '208',
          unitName: 'KCAL',
          value: 359,
        },
        {
          nutrientId: 2000,
          nutrientName: 'Total Sugars',
          nutrientNumber: '269',
          unitName: 'G',
          value: 5.13,
        },
        {
          nutrientId: 1079,
          nutrientName: 'Fiber, total dietary',
          nutrientNumber: '291',
          unitName: 'G',
          value: 10.3,
        },
        {
          nutrientId: 1093,
          nutrientName: 'Sodium, Na',
          nutrientNumber: '307',
          unitName: 'MG',
          value: 487,
        },
        {
          nutrientId: 1258,
          nutrientName: 'Fatty acids, total saturated',
          nutrientNumber: '606',
          unitName: 'G',
          value: 1.28,
        },
        {
          nutrientId: 1008,
          nutrientName: 'Energy',
          nutrientNumber: '208',
          unitName: 'KCAL',
          value: 117,
        },
        {
          nutrientId: 1093,
          nutrientName: 'Sodium, Na',
          nutrientNumber: '307',
          unitName: 'MG',
          value: 154,
        },
      ],
    },
  ],
};
