import { StoredProductRefreshService } from '../services/StoredProductRefreshService';
import { useCatalogStore } from './catalogStore';
import { useFilterStore } from './filterStore';

const refreshService = new StoredProductRefreshService();

/**
 * Brings products stored with an older Open Food Facts field set up to date in the
 * background and shows their new ratings in the catalog. Call after the rules are loaded.
 */
export function refreshOutdatedProducts(): void {
  // Without rules (e.g. they could not be loaded) every rating would come out wrong.
  if (useFilterStore.getState().rules.length === 0) return;
  refreshService
    .start(
      () => useFilterStore.getState().rules,
      () => void useCatalogStore.getState().loadAll()
    )
    .catch((error) => console.error('Failed to refresh stored products:', error));
}
