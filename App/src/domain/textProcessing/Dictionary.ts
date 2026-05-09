export type TermFrequency = {
  term: string;
  frequency: number;
};

export interface Dictionary {
  all(): ReadonlyArray<TermFrequency>;
}
