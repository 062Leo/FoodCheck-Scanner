import { create } from 'zustand';

import { FilterRuleRepository } from '../infrastructure/db/FilterRuleRepository';
import { CatalogRatingService } from '../services/CatalogRatingService';
import type { FilterRule, NewFilterRule } from '../types/FilterRule';
import { useCatalogStore } from './catalogStore';

interface FilterStoreState {
  rules: FilterRule[];
  isLoading: boolean;
  isInitialized: boolean;
  loadRules: () => Promise<void>;
  /** The mutating actions resolve to false if the change could not be saved. */
  addRule: (rule: NewFilterRule) => Promise<boolean>;
  updateRule: (id: number, changes: Partial<NewFilterRule>) => Promise<boolean>;
  deleteRule: (id: number) => Promise<boolean>;
}

const filterRuleRepository = new FilterRuleRepository();
const catalogRatingService = new CatalogRatingService();

/** Applies changed rules to the stored catalog ratings in the background. */
function rerateCatalog(force: boolean): void {
  catalogRatingService
    .schedule(() => useFilterStore.getState().rules, force)
    .then((changed) => (changed > 0 ? useCatalogStore.getState().loadAll() : undefined))
    .catch((error) => console.error('Failed to re-rate catalog:', error));
}

let loading: Promise<void> | null = null;

export const useFilterStore = create<FilterStoreState>((set, get) => {
  const mutate = async (action: () => Promise<void>, description: string): Promise<boolean> => {
    set({ isLoading: true });
    try {
      await action();
      const rules = await filterRuleRepository.findAll();
      set({ rules });
      rerateCatalog(true);
      return true;
    } catch (error) {
      console.error(`Failed to ${description}:`, error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  };

  const loadFromDatabase = async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const rules = await filterRuleRepository.findAll();
      set({ rules, isInitialized: true });
      rerateCatalog(false);
    } catch (error) {
      console.error('Failed to load filter rules:', error);
      set({ isInitialized: true });
    } finally {
      set({ isLoading: false });
    }
  };

  return {
    rules: [],
    isLoading: false,
    isInitialized: false,

    loadRules: () => {
      if (get().isInitialized && get().rules.length > 0) {
        return Promise.resolve();
      }
      // Several screens may ask at start-up; they share one load.
      loading ??= loadFromDatabase().finally(() => {
        loading = null;
      });
      return loading;
    },
    addRule: (rule) => mutate(() => filterRuleRepository.insert(rule), 'add filter rule'),

    updateRule: (id, changes) =>
      mutate(() => filterRuleRepository.update(id, changes), `update filter rule ${id}`),

    deleteRule: (id) =>
      mutate(() => filterRuleRepository.deleteById(id), `delete filter rule ${id}`),
  };
});
