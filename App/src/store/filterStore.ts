import { create } from 'zustand';

import { FilterRuleRepository } from '../infrastructure/db/FilterRuleRepository';
import type { FilterRule, NewFilterRule } from '../types/FilterRule';

interface FilterStoreState {
  rules: FilterRule[];
  isLoading: boolean;
  isInitialized: boolean;
  loadRules: () => Promise<void>;
  addRule: (rule: NewFilterRule) => Promise<void>;
  updateRule: (id: number, changes: Partial<NewFilterRule>) => Promise<void>;
  deleteRule: (id: number) => Promise<void>;
}

const filterRuleRepository = new FilterRuleRepository();

export const useFilterStore = create<FilterStoreState>((set, get) => ({
  rules: [],
  isLoading: false,
  isInitialized: false,

  loadRules: async () => {
    if (get().isInitialized && get().rules.length > 0) {
      return;
    }

    set({ isLoading: true });

    try {
      const rules = await filterRuleRepository.findAll();
      set({ rules, isInitialized: true });
    } catch (error) {
      console.error('Failed to load filter rules:', error);
      set({ isInitialized: true });
    } finally {
      set({ isLoading: false });
    }
  },

  addRule: async (rule: NewFilterRule) => {
    set({ isLoading: true });

    try {
      await filterRuleRepository.insert(rule);
      const rules = await filterRuleRepository.findAll();
      set({ rules });
    } catch (error) {
      console.error('Failed to add filter rule:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateRule: async (id: number, changes: Partial<NewFilterRule>) => {
    set({ isLoading: true });

    try {
      await filterRuleRepository.update(id, changes);
      const rules = await filterRuleRepository.findAll();
      set({ rules });
    } catch (error) {
      console.error(`Failed to update filter rule ${id}:`, error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRule: async (id: number) => {
    set({ isLoading: true });

    try {
      await filterRuleRepository.deleteById(id);
      const rules = await filterRuleRepository.findAll();
      set({ rules });
    } catch (error) {
      console.error(`Failed to delete filter rule ${id}:`, error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
