import type { AdditiveInfo, AdditiveFunctionClass } from './AdditiveTaxonomyTypes';
import { ADDITIVE_TAXONOMY } from './AdditiveTaxonomyData';

export class IngredientTaxonomy {
  private readonly byENumber: Map<string, AdditiveInfo>;
  private readonly byAlias: Map<string, AdditiveInfo>;

  constructor(taxonomy: AdditiveInfo[] = ADDITIVE_TAXONOMY) {
    this.byENumber = new Map();
    this.byAlias = new Map();

    for (const entry of taxonomy) {
      this.byENumber.set(this.normalizeENumber(entry.eNumber), entry);
      for (const alias of entry.aliases) {
        this.byAlias.set(alias.toLowerCase(), entry);
      }
      this.byAlias.set(entry.name.toLowerCase(), entry);
      this.byAlias.set(entry.eNumber.toLowerCase(), entry);
    }
  }

  findByENumber(eNumber: string): AdditiveInfo | undefined {
    return this.byENumber.get(this.normalizeENumber(eNumber));
  }

  findByText(text: string): AdditiveInfo | undefined {
    const normalized = text.toLowerCase().trim();
    const eNumber = this.extractENumberPattern(normalized);
    if (eNumber) {
      const byE = this.findByENumber(eNumber);
      if (byE) return byE;
    }
    const direct = this.byAlias.get(normalized);
    if (direct) return direct;

    // Try each word individually for multi-word ingredient names
    const words = normalized.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      const match = this.byAlias.get(word);
      if (match) return match;
    }

    return undefined;
  }

  findByFunctionClass(functionClass: AdditiveFunctionClass): AdditiveInfo[] {
    const results: AdditiveInfo[] = [];
    for (const entry of this.byENumber.values()) {
      if (entry.functionClass === functionClass) {
        results.push(entry);
      }
    }
    return results;
  }

  getHighRiskAdditives(): AdditiveInfo[] {
    const results: AdditiveInfo[] = [];
    for (const entry of this.byENumber.values()) {
      if (entry.riskLevel === 'high') {
        results.push(entry);
      }
    }
    return results;
  }

  getByRiskLevel(level: AdditiveInfo['riskLevel']): AdditiveInfo[] {
    const results: AdditiveInfo[] = [];
    for (const entry of this.byENumber.values()) {
      if (entry.riskLevel === level) {
        results.push(entry);
      }
    }
    return results;
  }

  normalizeENumber(raw: string): string {
    const cleaned = raw.toUpperCase().replace(/\s+/g, '').trim();
    if (!cleaned.startsWith('E')) return cleaned;
    const numeric = cleaned.substring(1);
    if (/^\d{3,4}$/.test(numeric)) {
      return `E${numeric}`;
    }
    const match = numeric.match(/^(\d{3,4})([a-z]?)$/i);
    if (match) {
      return `E${match[1]}${match[2] ? match[2] : ''}`;
    }
    return cleaned;
  }

  extractENumberPattern(text: string): string | undefined {
    const patterns = [
      /e\s*(\d{3,4}[a-z]?)/i,
      /(\d{3,4}[a-z]?)\s*\(?e\)?/i,
      /e[\s-]*(\d{3,4})[\s-]*([a-z])?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return `E${match[1]}${match[2] || ''}`.toUpperCase();
      }
    }
    return undefined;
  }

  getAllFunctionClasses(): AdditiveFunctionClass[] {
    const classes = new Set<AdditiveFunctionClass>();
    for (const entry of this.byENumber.values()) {
      classes.add(entry.functionClass);
    }
    return Array.from(classes).sort();
  }
}
