import { selectActiveProfile, useAllergenStore } from '../allergenStore';
import * as DatabaseService from '../../infrastructure/db/DatabaseService';
import { useTestDatabase } from '../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('allergenStore', () => {
  useTestDatabase();

  beforeEach(async () => {
    jest.restoreAllMocks();
    useAllergenStore.setState({ enabled: false, profile: [], status: 'loading' });
    await useAllergenStore.getState().loadProfile();
  });

  it('stores the profile in the database and loads it again', async () => {
    await useAllergenStore.getState().toggle('milk');
    await useAllergenStore.getState().toggle('gluten');
    await useAllergenStore.getState().toggle('milk');

    useAllergenStore.setState({ profile: [] });
    await useAllergenStore.getState().loadProfile();

    expect(useAllergenStore.getState().profile).toEqual(['gluten']);
    expect(await DatabaseService.getMetaValue(DatabaseService.META_ALLERGEN_PROFILE)).toBe(
      '["gluten"]'
    );
  });

  it('applies quick toggles in order without losing one', async () => {
    const store = useAllergenStore.getState();

    await Promise.all([store.toggle('milk'), store.toggle('eggs'), store.toggle('fish')]);

    expect(useAllergenStore.getState().profile).toEqual(['eggs', 'fish', 'milk']);
    await useAllergenStore.getState().loadProfile();
    expect(useAllergenStore.getState().profile).toEqual(['eggs', 'fish', 'milk']);
  });

  it('shows what is stored when saving fails', async () => {
    await useAllergenStore.getState().toggle('milk');
    jest.spyOn(DatabaseService, 'setMetaValue').mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await useAllergenStore.getState().toggle('eggs');

    expect(ok).toBe(false);
    expect(useAllergenStore.getState().profile).toEqual(['milk']);
  });

  it('refuses changes after a failed load, so the stored profile stays intact', async () => {
    await useAllergenStore.getState().toggle('milk');
    jest.spyOn(DatabaseService, 'getMetaValue').mockRejectedValueOnce(new Error('locked'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await useAllergenStore.getState().loadProfile();

    expect(useAllergenStore.getState().status).toBe('error');
    expect(await useAllergenStore.getState().toggle('eggs')).toBe(false);
    expect(await DatabaseService.getMetaValue(DatabaseService.META_ALLERGEN_PROFILE)).toBe(
      '["milk"]'
    );
  });

  it('is off by default and warns about nothing until switched on', async () => {
    await useAllergenStore.getState().toggle('milk');

    expect(useAllergenStore.getState().enabled).toBe(false);
    expect(selectActiveProfile(useAllergenStore.getState())).toEqual([]);

    expect(await useAllergenStore.getState().setEnabled(true)).toBe(true);
    useAllergenStore.setState({ enabled: false });
    await useAllergenStore.getState().loadProfile();

    expect(useAllergenStore.getState().enabled).toBe(true);
    expect(selectActiveProfile(useAllergenStore.getState())).toEqual(['milk']);
  });
});
