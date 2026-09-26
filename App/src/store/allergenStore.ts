import { create } from 'zustand';
import {
  getMetaValue,
  META_ALLERGEN_PROFILE,
  setMetaValue,
} from '../infrastructure/db/DatabaseService';
import {
  EU_ALLERGENS,
  parseAllergenProfile,
  type EuAllergen,
} from '../domain/allergens/allergenProfile';

export type AllergenProfileStatus = 'loading' | 'ready' | 'error';

interface AllergenState {
  profile: EuAllergen[];
  /** Changes are only possible when 'ready', so a failed load can never overwrite the stored profile. */
  status: AllergenProfileStatus;
  loadProfile: () => Promise<void>;
  /** Returns false if the change could not be stored; the profile then shows what is stored. */
  toggle: (allergen: EuAllergen) => Promise<boolean>;
}

/** Loads and changes run one after another, so no change overtakes another. */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export const useAllergenStore = create<AllergenState>((set, get) => {
  const load = async () => {
    try {
      set({
        profile: parseAllergenProfile(await getMetaValue(META_ALLERGEN_PROFILE)),
        status: 'ready',
      });
    } catch (error) {
      console.error('Failed to load allergen profile:', error);
      set({ status: 'error' });
    }
  };

  return {
    profile: [],
    status: 'loading',

    loadProfile: () => {
      set({ status: 'loading' });
      return serialized(load);
    },

    toggle: (allergen) =>
      serialized(async () => {
        if (get().status !== 'ready') return false;
        const selected = new Set(get().profile);
        if (selected.has(allergen)) selected.delete(allergen);
        else selected.add(allergen);
        const profile = EU_ALLERGENS.filter((item) => selected.has(item));
        set({ profile });
        try {
          await setMetaValue(META_ALLERGEN_PROFILE, JSON.stringify(profile));
          return true;
        } catch (error) {
          console.error('Failed to store allergen profile:', error);
          await load();
          return false;
        }
      }),
  };
});
