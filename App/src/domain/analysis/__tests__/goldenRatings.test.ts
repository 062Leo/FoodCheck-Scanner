/// <reference types="node" />
/**
 * Golden-master test: pins the rating output for a fixed product set.
 *
 * Refactorings must keep this output identical. Deliberate behaviour changes
 * regenerate the baseline with `GOLDEN_UPDATE=1 npx jest goldenRatings` and
 * document the diff.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FilterRule } from '../../../types/FilterRule';
import type { Product } from '../../../types/Product';
import { GOLDEN_PRODUCTS } from '../__fixtures__/goldenProducts';
import { CUSTOMISED_RULES, SEEDED_RULES } from '../__fixtures__/goldenRuleSets';
import { ProductRating } from '../ProductRating';
import { RedFlagAnalyzer } from '../RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../NovaScoreEvaluator';
import { defaultRules } from '../../rules/defaultRules';

const BASELINE_FILE = path.join(__dirname, '..', '__fixtures__', 'goldenRatings.baseline.json');

function rate(product: Product, rules: FilterRule[]) {
  const rater = new ProductRating(new RedFlagAnalyzer(defaultRules), new NovaScoreEvaluator());
  const result = rater.rate(product, rules);
  return {
    status: result.status,
    nova: result.nova.score,
    redFlags: result.redFlags.map(
      (f) => `${f.severity}|${f.category}|${f.canonicalKey ?? ''}|${f.ingredient}`
    ),
  };
}

function computeAll() {
  const output: Record<string, Record<string, ReturnType<typeof rate>>> = {};
  for (const [name, rules] of [
    ['seeded', SEEDED_RULES],
    ['customised', CUSTOMISED_RULES],
  ] as const) {
    output[name] = {};
    for (const product of GOLDEN_PRODUCTS) {
      output[name][`${product.ean} ${product.name}`] = rate(product, rules);
    }
  }
  return output;
}

describe('golden ratings', () => {
  it('match the recorded baseline', () => {
    const actual = computeAll();
    if (process.env.GOLDEN_UPDATE === '1') {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(actual, null, 2) + '\n');
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    expect(actual).toEqual(baseline);
  });
});
