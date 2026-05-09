export type SymSpellConfig = {
  maxEditDistance: number;
  prefixLength: number;
};

export const defaultSymSpellConfig: SymSpellConfig = {
  maxEditDistance: 2,
  prefixLength: 7,
};
