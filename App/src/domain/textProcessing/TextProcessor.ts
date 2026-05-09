import type { TextSegmentationResult, TextSegmenter } from './TextSegmenter';
import type { SpellCorrector } from './SpellCorrector';

export type TextProcessorInput = {
  rawText: string;
};

export type TextProcessorOutput = {
  cleanedText: string;
  segments: TextSegmentationResult;
};

export class TextProcessor {
  constructor(
    private readonly segmenter: TextSegmenter,
    private readonly spellCorrector: SpellCorrector,
  ) {}

  process(input: TextProcessorInput): TextProcessorOutput {
    const raw = normalizeWhitespace(input.rawText);

    const segments = this.segmenter.segment(raw);

    const correctedLines = segments.lines.map((line) => this.spellCorrector.correctLine(line));

    return {
      cleanedText: correctedLines.join('\n').trim(),
      segments,
    };
  }
}

function normalizeWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
