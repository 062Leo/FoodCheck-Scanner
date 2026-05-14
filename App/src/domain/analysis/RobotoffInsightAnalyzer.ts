import type { RobotoffInsight, AIInsightFinding } from '../../types/Robotoff';
import { isHighConfidence, isRelevantForAnalysis, formatInsightValue } from '../../types/Robotoff';
import { getTranslations } from '../../i18n/translations';
import type { SupportedLanguage } from '../../i18n/translations';

export class RobotoffInsightAnalyzer {
  analyze(insights: RobotoffInsight[], language: SupportedLanguage = 'de'): AIInsightFinding[] {
    const tx = getTranslations(language);
    const findings: AIInsightFinding[] = [];

    for (const insight of insights) {
      if (!isRelevantForAnalysis(insight.type)) continue;
      if (!isHighConfidence(insight)) continue;

      findings.push({
        id: insight.id,
        type: insight.type,
        value: formatInsightValue(insight.type, insight.value_tag, tx['product.ai.unknown']),
        confidence: insight.confidence,
        predictor: insight.predictor,
        annotation: insight.annotation,
        description: this.buildDescription(insight, language),
      });
    }

    findings.sort((a, b) => {
      const aConf = a.confidence ?? 0;
      const bConf = b.confidence ?? 0;
      return bConf - aConf;
    });

    return findings;
  }

  private buildDescription(insight: RobotoffInsight, language: SupportedLanguage): string {
    const tx = getTranslations(language);
    const parts: string[] = [];

    if (insight.value_tag) {
      parts.push(
        `${tx['product.ai.recognizedAs']} ${formatInsightValue(insight.type, insight.value_tag, tx['product.ai.unknown'])}`
      );
    }

    if (insight.confidence !== null) {
      parts.push(`${tx['product.ai.confidence']} ${Math.round(insight.confidence * 100)}%`);
    }

    return parts.join(' · ');
  }
}
