export interface Translator {
  translate(text: string, targetLang?: string): Promise<string>;
}
