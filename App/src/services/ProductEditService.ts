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
    const edited = mergeEditedFields(
      parseEditedFields(previous?.edited_fields, previous?.edited_at),
      changedFields(session.initial, values)
    );
    await this.repository.saveEdit(record, serializeEditedFields(edited));
    return { product, rating };
  }

  /** Sends the entered values to Open Food Facts (see config.ts for the target). */
  async contribute(ean: string, values: ProductFormValues): Promise<void> {
    await this.writeClient.updateProduct(ean, toOffPayload(values));
  }
}
