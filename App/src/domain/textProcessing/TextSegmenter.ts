export type TextSegmentationResult = {
  lines: string[];
};

export interface TextSegmenter {
  segment(text: string): TextSegmentationResult;
}
