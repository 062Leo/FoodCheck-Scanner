import type { NovaScore } from '../../types/Product';
import type { NovaDetails } from '../../types/ScanResult';

export class NovaScoreEvaluator {
  evaluate(score: NovaScore | undefined): NovaDetails {
    switch (score) {
      case 1:
        return {
          score: 1,
          label: 'Minimal verarbeitet',
          color: '#4CAF50',
        };
      case 2:
        return {
          score: 2,
          label: 'Wenig verarbeitet',
          color: '#8BC34A',
        };
      case 3:
        return {
          score: 3,
          label: 'Mäßig verarbeitet',
          color: '#FFC107',
        };
      case 4:
        return {
          score: 4,
          label: 'Hochverarbeitet',
          color: '#F44336',
        };
      default:
        return {
          score: 1,
          label: 'Unbekannt',
          color: '#757575',
        };
    }
  }
}
