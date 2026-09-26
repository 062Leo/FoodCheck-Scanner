import { ALLERGEN_PROFILE_KEY, useAllergenStore } from '../allergenStore';
import * as DatabaseService from '../../infrastructure/db/DatabaseService';
import { useTestDatabase } from '../../testing/testDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('allergenStore', () => {
  useTestDatabase();

  beforeEach(() => {
    useAllergenStore.setState({ profile: [] });
  });

  it('stores the profile in the database and loads it again', async () => {
    await useAllergenStore.getState().toggle('milk');
    await useAllergenStore.getState().toggle('gluten');
    await useAllergenStore.getState().toggle('milk');

    useAllergenStore.setState({ profile: [] });
    await useAllergenStore.getState().loadProfile();

    expect(useAllergenStore.getState().profile).toEqual(['gluten']);
    expect(await DatabaseService.getMetaValue(ALLERGEN_PROFILE_KEY)).toBe('["gluten"]');
  });

  it('keeps the previous selection when storing fails', async () => {
    jest.spyOn(DatabaseService, 'setMetaValue').mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await useAllergenStore.getState().toggle('eggs');

    expect(ok).toBe(false);
    expect(useAllergenStore.getState().profile).toEqual([]);
  });
});
