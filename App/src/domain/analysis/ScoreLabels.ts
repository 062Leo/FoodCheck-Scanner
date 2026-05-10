import type { Product, NovaScore } from '../../types/Product';

export function getNutriScoreLabel(grade: string | null | undefined): string {
  if (!grade) return 'Not available';
  const g = grade.toLowerCase();
  switch (g) {
    case 'a':
      return 'A – Very good';
    case 'b':
      return 'B – Good';
    case 'c':
      return 'C – Average';
    case 'd':
      return 'D – Poor';
    case 'e':
      return 'E – Bad';
    default:
      return 'Not available';
  }
}

export function getNovaGroupLabel(group: NovaScore | number | null | undefined): string {
  if (group == null) return 'Not available';
  switch (group) {
    case 1:
      return 'Unprocessed / Minimally processed';
    case 2:
      return 'Processed culinary ingredients';
    case 3:
      return 'Processed foods';
    case 4:
      return 'Ultra-processed food products';
    default:
      return 'Not available';
  }
}

export function getEcoScoreLabel(grade: string | null | undefined): string {
  if (!grade) return 'Not available';
  const g = grade.toLowerCase();
  switch (g) {
    case 'a':
      return 'A – Very low impact';
    case 'b':
      return 'B – Low impact';
    case 'c':
      return 'C – Moderate impact';
    case 'd':
      return 'D – High impact';
    case 'e':
      return 'E – Very high impact';
    default:
      return 'Not available';
  }
}

export function canComputeNutriScore(product: Product): boolean {
  if (!product.miscTags) return false;
  return !product.miscTags.includes('en:nutriscore-not-computed');
}
