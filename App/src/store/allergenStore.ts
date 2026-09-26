import { create } from 'zustand';
import {
  getMetaValue,
  META_ALLERGEN_PROFILE,
  META_ALLERGEN_WARNING,
  setMetaValue,
} from '../infrastructure/db/DatabaseService';
import {
  EU_ALLERGENS,
  parseAllergenProfile,
  type EuAllergen,
} from '../domain/allergens/allergenProfile';

export type AllergenProfileStatus = 'loading' | 'ready' | 'error';

interface AllergenState {
  /** The warning is optional and off until the user switches it on in the settings. */
  enabled: boolean;
  profile: EuAllergen[];
  /** Changes are only possible when 'ready', so a failed load can never overwrite the stored profile. */
  status: AllergenProfileStatus;
  loadProfile: () => Promise<void>;
  /** Returns false if the change could not be stored; the profile then shows what is stored. */
  toggle: (allergen: EuAllergen) => Promise<boolean>;
  /** Switches the warning on or off; returns false if that could not be stored. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
}

const NO_ALLERGENS: EuAllergen[] = [];

/** The allergens to warn about: the profile while the warning is on, otherwise none. */
export function selectActiveProfile(state: AllergenState): EuAllergen[] {
  return state.enabled ? state.profile : NO_ALLERGENS;
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
      const [profile, enabled] = await Promise.all([
        getMetaValue(META_ALLERGEN_PROFILE),
        getMetaValue(META_ALLERGEN_WARNING),
      ]);
      set({ profile: parseAllergenProfile(profile), enabled: enabled === 'true', status: 'ready' });
    } catch (error) {
      console.error('Failed to load allergen profile:', error);
      set({ status: 'error' });
    }
  };

  return {
    enabled: false,
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

    setEnabled: (enabled) =>
      serialized(async () => {
        if (get().status !== 'ready') return false;
        set({ enabled });
        try {
          await setMetaValue(META_ALLERGEN_WARNING, String(enabled));
          return true;
        } catch (error) {
          console.error('Failed to store allergen warning setting:', error);
          await load();
          return false;
        }
      }),
  };
});
