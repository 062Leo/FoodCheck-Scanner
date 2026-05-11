import { DefaultTextSegmenter } from '../../domain/textProcessing/DefaultTextSegmenter';
import { SymSpellSpellCorrector } from '../../domain/textProcessing/SymSpellSpellCorrector';
import { TextProcessor } from '../../domain/textProcessing/TextProcessor';

import { AssetDictionaryProvider } from './AssetDictionaryProvider';

export async function createIngredientsTextProcessor(): Promise<TextProcessor> {
  const dictionary = await AssetDictionaryProvider.fromAsset(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../assets/dictionaries/ingredients_symspell.json')
  );

  return new TextProcessor(new DefaultTextSegmenter(), new SymSpellSpellCorrector(dictionary));
}
