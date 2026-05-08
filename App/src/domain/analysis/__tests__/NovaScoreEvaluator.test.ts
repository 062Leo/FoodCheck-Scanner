import { NovaScoreEvaluator } from '../NovaScoreEvaluator';

describe('NovaScoreEvaluator', () => {
  let evaluator: NovaScoreEvaluator;

  beforeEach(() => {
    evaluator = new NovaScoreEvaluator();
  });

  it('should map Nova score 1 to correct label and color', () => {
    const result = evaluator.evaluate(1);
    expect(result).toEqual({
      score: 1,
      label: 'Minimal verarbeitet',
      color: '#4CAF50',
    });
  });

  it('should map Nova score 2 to correct label and color', () => {
    const result = evaluator.evaluate(2);
    expect(result).toEqual({
      score: 2,
      label: 'Wenig verarbeitet',
      color: '#8BC34A',
    });
  });

  it('should map Nova score 3 to correct label and color', () => {
    const result = evaluator.evaluate(3);
    expect(result).toEqual({
      score: 3,
      label: 'Mäßig verarbeitet',
      color: '#FFC107',
    });
  });

  it('should map Nova score 4 to correct label and color', () => {
    const result = evaluator.evaluate(4);
    expect(result).toEqual({
      score: 4,
      label: 'Hochverarbeitet',
      color: '#F44336',
    });
  });

  it('should return default label and color for undefined score', () => {
    const result = evaluator.evaluate(undefined);
    expect(result).toEqual({
      score: 1,
      label: 'Unbekannt',
      color: '#757575',
    });
  });
});
