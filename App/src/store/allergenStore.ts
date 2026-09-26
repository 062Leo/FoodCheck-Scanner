import { create } from 'zustand';
import { getMetaValue, setMetaValue } from '../infrastructure/db/DatabaseService';
import {
  EU_ALLERGENS,
  parseAllergenProfile,
  type EuAllergen,
} from '../domain/allergens/allergenProfile';

/** Stored in the database, so the profile is part of every backup. */
export const ALLERGEN_PROFILE_KEY = 'allergen_profile';

interface AllergenState {
  profile: EuAllergen[];
  loadProfile: () => Promise<void>;
  /** Returns false if the change could not be stored; the profile is then unchanged. */
  toggle: (allergen: EuAllergen) => Promise<boolean>;
}

export const useAllergenStore = create<AllergenState>((set, get) => ({
  profile: [],

  loadProfile: async () => {
    try {
      set({ profile: parseAllergenProfile(await getMetaValue(ALLERGEN_PROFILE_KEY)) });
    } catch (error) {
      console.error('Failed to load allergen profile:', error);
    }
  },

  toggle: async (allergen) => {
    const previous = get().profile;
    const selected = new Set(previous);
    if (selected.has(allergen)) selected.delete(allergen);
    else selected.add(allergen);
    const profile = EU_ALLERGENS.filter((item) => selected.has(item));
    set({ profile });
    try {
      await setMetaValue(ALLERGEN_PROFILE_KEY, JSON.stringify(profile));
      return true;
    } catch (error) {
      console.error('Failed to store allergen profile:', error);
      set({ profile: previous });
      return false;
    }
  },
}));
