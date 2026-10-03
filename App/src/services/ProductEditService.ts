import type { FilterRule } from '../types/FilterRule';
import type { Product, ProductRecord } from '../types/Product';
import type { ScanResult } from '../types/ScanResult';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { rateProduct } from '../domain/analysis/rateProduct';
import {
  applyForm,
  formFromProduct,
  toOffPayload,
  type ProductFormValues,
} from '../domain/product/productForm';
import {
  changedFields,
  mergeEditedFields,
  parseEditedFields,
  serializeEditedFields,
} from '../domain/product/editedFields';
import { productFromRecord, toProductRecord } from './ProductLookupService';

export interface EditSession {
  ean: string;
  /** The product as stored (or an empty product for a new barcode). */
  product: Product;
  record: ProductRecord | null;
  /** The form as loaded; used to find out which fields the user changed. */
  initial: ProductFormValues;
}

export interface ProductEditDependencies {
  repository?: ProductRepository;
  writeClient?: Pick<OpenFoodFactsWriteClient, 'updateProduct'>;
  now?: () => Date;
}

/** Loading, saving and contributing edits of a product. */
export class ProductEditService {
  private readonly repository: ProductRepository;
  private readonly writeClient: Pick<OpenFoodFactsWriteClient, 'updateProduct'>;
  private readonly now: () => Date;

  constructor(dependencies: ProductEditDependencies = {}) {
    this.repository = dependencies.repository ?? new ProductRepository();
    this.writeClient = dependencies.writeClient ?? new OpenFoodFactsWriteClient();
    this.now = dependencies.now ?? (() => new Date());
  }

  /** Nothing is stored until the user saves; a new barcode starts with an empty form. */
  async open(ean: string): Promise<EditSession> {
    const record = await this.repository.findByEan(ean);
    const product = record ? productFromRecord(record) : { ean, name: '' };
    return { ean, product, record, initial: formFromProduct(product) };
  }

  /**
   * Saves the form locally, re-rates the product and remembers which fields the user
   * changed, so later Open Food Facts updates keep exactly these fields.
   */
  async save(
    session: EditSession,
    values: ProductFormValues,
    rules: FilterRule[]
  ): Promise<{ product: Product; rating: ScanResult }> {
    const product = applyForm(session.product, values);
    const rating = rateProduct(product, rules);
    const timestamp = this.now().toISOString();
    const previous = session.record;

    const record: ProductRecord = {
      ...toProductRecord(
        product,
        rating,
        previous?.scanned_at ?? timestamp,
        previous?.last_api_fetch ?? null
      ),
      last_seen_at: previous?.last_seen_at ?? timestamp,
      edited_at: timestamp,
    };
    // An edit adds no Open Food Facts data: a product stored with an older field set
    // stays marked as such, so the background refresh still completes it.
    if (previous) record.data_version = previous.data_version ?? null;
    const edited = mergeEditedFields(
      parseEditedFields(previous?.edited_fields, previous?.edited_at),
      changedFields(session.initial, values)
    );
    await this.repository.saveEdit(record, serializeEditedFields(edited));
    return { product, rating };
  }

  /**
   * What an upload sends: the fields the user changed on this device, now or earlier.
   * Unchanged values may be an old copy of OFF's data and would undo newer
   * corrections there. A product that never came from OFF is sent completely.
   */
  offPayload(session: EditSession, values: ProductFormValues): Record<string, string> {
    const record = session.record;
    if (!record?.last_api_fetch) return toOffPayload(values);
    const changedNow = changedFields(session.initial, values);
    const edited = mergeEditedFields(
      parseEditedFields(record.edited_fields, record.edited_at),
      changedNow
    );
    // Ingredients changed now: only the languages that changed, not every stored text.
    const languages = changedNow.includes('ingredients')
      ? new Set(
          Object.keys(values.ingredients).filter(
            (lang) =>
              values.ingredients[lang].trim() !== (session.initial.ingredients[lang] ?? '').trim()
          )
        )
      : undefined;
    return toOffPayload(values, edited, languages);
  }

  /** Whether the form differs from how it was loaded or last saved. */
  hasChanges(session: EditSession, values: ProductFormValues): boolean {
    return changedFields(session.initial, values).length > 0;
  }

  /** Sends a payload from `offPayload` to Open Food Facts (see config.ts for the target). */
  async contribute(ean: string, payload: Record<string, string>): Promise<void> {
    await this.writeClient.updateProduct(ean, payload);
  }
}
