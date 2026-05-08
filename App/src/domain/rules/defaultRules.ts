import type { RedFlagFinding } from '../../types/ScanResult';

export type RedFlagRule = Omit<RedFlagFinding, 'ingredient'> & {
  searchTerm: string;
};

export const defaultRules: RedFlagRule[] = [
  {
    searchTerm: 'Palmöl',
    category: 'Kritische Öle',
    severity: 'critical',
  },
  {
    searchTerm: 'Palmfett',
    category: 'Kritische Öle',
    severity: 'critical',
  },
  {
    searchTerm: 'Glukosesirup',
    category: 'Zucker',
    severity: 'warning',
  },
  {
    searchTerm: 'Glucose-Fructose-Sirup',
    category: 'Zucker',
    severity: 'warning',
  },
  {
    searchTerm: 'Natriumnitrit',
    category: 'Konservierungsstoffe',
    severity: 'critical',
  },
  {
    searchTerm: 'Natriumnitrat',
    category: 'Konservierungsstoffe',
    severity: 'critical',
  },
  {
    searchTerm: 'künstliche Farbstoffe',
    category: 'Farbstoffe',
    severity: 'warning',
  },
  {
    searchTerm: 'Tartrazin',
    category: 'Farbstoffe',
    severity: 'warning',
  },
];
