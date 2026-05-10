import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import type { Dictionary, TermFrequency } from '../../domain/textProcessing/Dictionary';

export class AssetDictionaryProvider implements Dictionary {
  private constructor(private readonly terms: TermFrequency[]) {}

  static async fromAsset(
    moduleIdOrContent: number | TermFrequency[]
  ): Promise<AssetDictionaryProvider> {
    if (Array.isArray(moduleIdOrContent)) {
      return new AssetDictionaryProvider(moduleIdOrContent);
    }

    if (typeof moduleIdOrContent !== 'number') {
      throw new Error(
        `Invalid asset module id for dictionary. Expected a number from require(...), got ${Object.prototype.toString.call(moduleIdOrContent)}.`
      );
    }

    const asset = Asset.fromModule(moduleIdOrContent);
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri;
    const content = await FileSystem.readAsStringAsync(uri);

    const terms = JSON.parse(content) as TermFrequency[];
    return new AssetDictionaryProvider(terms);
  }

  all(): ReadonlyArray<TermFrequency> {
    return this.terms;
  }
}
