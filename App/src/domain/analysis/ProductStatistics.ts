import type { ProductRecord } from '../../types/Product';

export interface ProductStats {
  totalProducts: number;
  totalScans: number;
  ratingDistribution: Record<string, number>;
  novaDistribution: Record<string, number>;
  ultraProcessedRatio: number;
  averageScansPerProduct: number;
}

export interface CollectionBreakdown {
  mostScanned: ProductRecord[];
  recentlyScanned: ProductRecord[];
  highestRisk: ProductRecord[];
}

export class ProductStatistics {
  static computeStats(
    products: ProductRecord[],
    stats?: {
      totalScans: number;
      ratingDistribution: Record<string, number>;
      novaDistribution: Record<string, number>;
    }
  ): ProductStats {
    const totalProducts = products.length;
    const totalScans = stats?.totalScans ?? products.length;
    const ratingDistribution = stats?.ratingDistribution ?? {};
    const novaDistribution = stats?.novaDistribution ?? {};

    // Compute ultra-processed ratio (Nova 4)
    const nova4Count = Number(novaDistribution['4'] ?? 0);
    const ultraProcessedRatio = totalProducts > 0 ? nova4Count / totalProducts : 0;

    const averageScansPerProduct = totalProducts > 0 ? totalScans / totalProducts : 0;

    return {
      totalProducts,
      totalScans,
      ratingDistribution,
      novaDistribution,
      ultraProcessedRatio,
      averageScansPerProduct,
    };
  }

  static computeAdditiveFrequency(
    products: ProductRecord[]
  ): Array<{ additive: string; count: number }> {
    const frequency: Map<string, number> = new Map();

    for (const product of products) {
      if (!product.raw_json) continue;
      try {
        const parsed = JSON.parse(product.raw_json) as Record<string, unknown>;
        const p = (parsed.product || parsed) as Record<string, unknown>;
        const additives = p.additivesTags ?? p.additives_tags;
        if (Array.isArray(additives)) {
          for (const tag of additives) {
            const name = String(tag)
              .replace(/^[a-z]{2}:/, '')
              .replace(/-/g, ' ');
            frequency.set(name, (frequency.get(name) || 0) + 1);
          }
        }
      } catch {
        // Skip unparseable JSON
      }
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([additive, count]) => ({ additive, count }));
  }

  static getRatingSummary(products: ProductRecord[]): {
    ok: number;
    warning: number;
    critical: number;
  } {
    return {
      ok: products.filter((p) => p.rating === 'OK').length,
      warning: products.filter((p) => p.rating === 'Warning').length,
      critical: products.filter((p) => p.rating === 'Critical').length,
    };
  }

  static getNovaSummary(products: ProductRecord[]): Record<number, number> {
    const summary: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of products) {
      if (p.nova_score) {
        summary[p.nova_score] = (summary[p.nova_score] || 0) + 1;
      }
    }
    return summary;
  }
}
