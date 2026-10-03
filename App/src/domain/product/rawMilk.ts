/**
 * Raw-milk mentions in an ingredient text, shared by the raw-milk badge and the
 * "not_raw_milk" product check. A negated mention ("nicht aus Rohmilch") does not count.
 */
const RAW_MILK_WORDS = [
  'rohmilch',
  'vorzugsmilch',
  'raw milk',
  'raw-milk',
  'lait cru',
  'latte crudo',
  'leche cruda',
  'rauwe melk',
  'leite cru',
  'surowe mleko',
  'surowego mleka',
];

/** A negation shortly before the match: "nicht aus Rohmilch", "not made with raw milk". */
const NEGATION_BEFORE =
  /(^|[^\p{L}])(nicht|ohne|kein|keine|keiner|keinem|keinen|not|no|non|without|sans|pas|senza|sin|geen|niet|zonder|nie|não|nao)([^\p{L}]+\p{L}+){0,3}[^\p{L}]*$/u;

const LETTER = /\p{L}/u;

export interface RawMilkOptions {
  /** Also count a mention inside a compound word, e.g. "Ziegenrohmilch". Default: false. */
  inCompounds?: boolean;
}

/** True if the text mentions raw milk (at the start of a word by default) and not negated. */
export function mentionsRawMilk(text: string | undefined, options: RawMilkOptions = {}): boolean {
  const lower = (text ?? '').toLowerCase();
  if (!lower) return false;
  for (const word of RAW_MILK_WORDS) {
    let index = lower.indexOf(word);
    while (index !== -1) {
      const startsWord = index === 0 || !LETTER.test(lower[index - 1]);
      if (startsWord || options.inCompounds) {
        // Only look back within the same clause.
        const clause =
          lower
            .slice(0, index)
            .split(/[,;.:()[\]]/)
            .pop() ?? '';
        if (!NEGATION_BEFORE.test(clause)) return true;
      }
      index = lower.indexOf(word, index + 1);
    }
  }
  return false;
}
