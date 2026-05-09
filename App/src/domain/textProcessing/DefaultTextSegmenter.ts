import type { TextSegmentationResult, TextSegmenter } from './TextSegmenter';

export class DefaultTextSegmenter implements TextSegmenter {
  segment(text: string): TextSegmentationResult {
    const normalized = (text ?? '').trim();
    if (!normalized) {
      return { lines: [] };
    }

    const lines = normalized
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .flatMap((l) => splitLongIngredientLines(l));

    return { lines };
  }
}

function splitLongIngredientLines(line: string): string[] {
  const looksLikeIngredientList = /,|;|\(|\)|:/.test(line);
  if (!looksLikeIngredientList) return [line];

  const parts = line
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return parts.length > 1 ? parts : [line];
}
