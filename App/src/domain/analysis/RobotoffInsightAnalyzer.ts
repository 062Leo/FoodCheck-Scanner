import type { RobotoffInsight, AIInsightFinding } from '../../types/Robotoff';
import { isHighConfidence, isRelevantForAnalysis, formatInsightValue } from '../../types/Robotoff';

export class RobotoffInsightAnalyzer {
  analyze(insights: RobotoffInsight[]): AIInsightFinding[] {
    const findings: AIInsightFinding[] = [];

    for (const insight of insights) {
      if (!isRelevantForAnalysis(insight.type)) continue;
      if (!isHighConfidence(insight)) continue;

      findings.push({
        id: insight.id,
        type: insight.type,
        value: formatInsightValue(insight.type, insight.value_tag),
        confidence: insight.confidence,
        predictor: insight.predictor,
        annotation: insight.annotation,
        description: this.buildDescription(insight),
      });
    }

    findings.sort((a, b) => {
      const aConf = a.confidence ?? 0;
      const bConf = b.confidence ?? 0;
      return bConf - aConf;
    });

    return findings;
  }

  private buildDescription(insight: RobotoffInsight): string {
    const parts: string[] = [];

    if (insight.value_tag) {
      parts.push(`Erkannt als: ${formatInsightValue(insight.type, insight.value_tag)}`);
    }

    if (insight.confidence !== null) {
      parts.push(`Konfidenz: ${Math.round(insight.confidence * 100)}%`);
    }

    return parts.join(' · ');
  }
}
