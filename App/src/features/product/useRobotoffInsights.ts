import { useEffect, useState } from 'react';
import { RobotoffClient } from '../../infrastructure/api/RobotoffClient';
import { RobotoffInsightAnalyzer } from '../../domain/analysis/RobotoffInsightAnalyzer';
import type { AIInsightFinding } from '../../types/Robotoff';
import type { SupportedLanguage } from '../../i18n/translations';

/** One client for the app, so its 15-minute cache is actually shared. */
const robotoffClient = new RobotoffClient();
const insightAnalyzer = new RobotoffInsightAnalyzer();

/** Loads Open Food Facts' automatic suggestions for a product (online only). */
export function useRobotoffInsights(
  ean: string | undefined,
  enabled: boolean,
  language: SupportedLanguage
) {
  const [insights, setInsights] = useState<AIInsightFinding[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ean || !enabled) return;
    let cancelled = false;
    setLoading(true);
    robotoffClient
      .getInsights(ean)
      .then((raw) => {
        if (!cancelled) setInsights(insightAnalyzer.analyze(raw, language));
      })
      .catch(() => {
        if (!cancelled) setInsights([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ean, enabled, language]);

  return { insights, loading };
}
