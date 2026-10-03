import { useAllergenStore } from './allergenStore';
import { useCatalogStore } from './catalogStore';
import { useFilterStore } from './filterStore';

/** Reloads all database-backed state, e.g. after a backup was restored. */
export async function reloadStores(): Promise<void> {
  useFilterStore.setState({ isInitialized: false, rules: [] });
  await useFilterStore.getState().loadRules();
  await useCatalogStore.getState().loadAll();
  await useAllergenStore.getState().loadProfile();
}
