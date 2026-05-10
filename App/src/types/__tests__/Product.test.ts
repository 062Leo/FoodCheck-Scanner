import { getMissingScoreTags } from '../Product';
import type { Product } from '../Product';

function makeProduct(miscTags?: string[]): Product {
  return {
    ean: '123',
    name: 'Test',
    miscTags,
  };
}

describe('getMissingScoreTags', () => {
  it('should return empty array when miscTags is undefined', () => {
    expect(getMissingScoreTags(makeProduct())).toEqual([]);
  });

  it('should return empty array when no score-related tags exist', () => {
    expect(getMissingScoreTags(makeProduct(['en:organic', 'en:fair-trade']))).toEqual([]);
  });

  it('should extract nutriscore-missing tags', () => {
    const tags = getMissingScoreTags(
      makeProduct([
        'en:organic',
        'en:nutriscore-missing-category',
        'en:nutriscore-missing-nutrition-data',
      ])
    );
    expect(tags).toEqual([
      'en:nutriscore-missing-category',
      'en:nutriscore-missing-nutrition-data',
    ]);
  });

  it('should extract ecoscore tags', () => {
    const tags = getMissingScoreTags(
      makeProduct(['en:ecoscore-not-computed', 'en:ecoscore-extended-data-not-computed'])
    );
    expect(tags).toEqual(['en:ecoscore-not-computed', 'en:ecoscore-extended-data-not-computed']);
  });

  it('should extract both nutriscore and ecoscore tags', () => {
    const tags = getMissingScoreTags(
      makeProduct(['en:nutriscore-missing-category', 'en:ecoscore-not-computed', 'en:organic'])
    );
    expect(tags).toEqual(['en:nutriscore-missing-category', 'en:ecoscore-not-computed']);
  });

  it('should not include nutriscore-computed tags', () => {
    const tags = getMissingScoreTags(
      makeProduct(['en:nutriscore-computed', 'en:nutriscore-missing-nutrition-data-sodium'])
    );
    expect(tags).toEqual(['en:nutriscore-missing-nutrition-data-sodium']);
  });
});
