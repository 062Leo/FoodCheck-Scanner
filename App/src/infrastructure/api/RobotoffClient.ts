import { ApiError } from './ApiError';
import { retryWithBackoff } from './retry';
import { fetchWithTimeout } from './fetchWithTimeout';
import { USER_AGENT } from './config';
import type { RobotoffInsight, RobotoffInsightsResponse } from '../../types/Robotoff';

const ROBOTOFF_BASE_URL = 'https://robotoff.openfoodfacts.org/api/v1';

export class RobotoffClient {
  private inMemoryCache: Map<string, { insights: RobotoffInsight[]; timestamp: number }>;
  private cacheTTLMs: number;

  constructor(cacheTTLMinutes = 15) {
    this.inMemoryCache = new Map();
    this.cacheTTLMs = cacheTTLMinutes * 60 * 1000;
  }

  async getInsights(ean: string): Promise<RobotoffInsight[]> {
    const cached = this.inMemoryCache.get(ean);
    if (cached && Date.now() - cached.timestamp < this.cacheTTLMs) {
      return cached.insights;
    }

    try {
      // Hints are optional: one retry at most, so a busy server cannot keep them loading.
      return await retryWithBackoff(() => this.fetchInsights(ean), { retries: 1 });
    } catch {
      return [];
    }
  }

  private async fetchInsights(ean: string): Promise<RobotoffInsight[]> {
    const url = `${ROBOTOFF_BASE_URL}/insights?barcode=${encodeURIComponent(ean)}`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new ApiError(
        `Robotoff API returned ${response.status} for EAN ${ean}`,
        response.status
      );
    }

    const data = (await response.json()) as RobotoffInsightsResponse;

    if (data.status === 'no_insights') {
      this.inMemoryCache.set(ean, {
        insights: [],
        timestamp: Date.now(),
      });
      return [];
    }

    const insights = data.insights || [];
    this.inMemoryCache.set(ean, {
      insights,
      timestamp: Date.now(),
    });

    return insights;
  }
}
