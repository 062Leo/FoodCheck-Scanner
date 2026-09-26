jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Pin the write target so the assertions below do not depend on the build type.
jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  WRITE_ENV: 'staging',
  WRITE_BASE_URL: 'https://world.openfoodfacts.net',
}));

import * as SecureStore from 'expo-secure-store';
import { OpenFoodFactsWriteClient, UploadError } from '../OpenFoodFactsWriteClient';
import { APP_NAME, APP_VERSION, STAGING_AUTH, resolveWriteEnvironment } from '../config';

const fetchMock = jest.fn();
global.fetch = fetchMock;

function withCredentials() {
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
    key === 'off_username' ? 'testuser' : 'testpass'
  );
}

function respond(body: string, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  });
}

const SAVED = JSON.stringify({ status: 1, status_verbose: 'fields saved' });

describe('resolveWriteEnvironment', () => {
  it('writes to staging in development and to production in release builds', () => {
    expect(resolveWriteEnvironment(undefined, true)).toBe('staging');
    expect(resolveWriteEnvironment(undefined, false)).toBe('production');
    expect(resolveWriteEnvironment('staging', false)).toBe('staging');
    expect(resolveWriteEnvironment('nonsense', true)).toBe('staging');
  });
});

describe('OpenFoodFactsWriteClient', () => {
  const client = new OpenFoodFactsWriteClient();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  describe('updateProduct', () => {
    it('posts credentials, app fields and non-empty values to the configured server', async () => {
      withCredentials();
      respond(SAVED);

      await client.updateProduct('1234567890123', {
        product_name: 'Test',
        brands: '',
        nutriment_sugars: '12.5',
        categories: undefined,
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://world.openfoodfacts.net/cgi/product_jqm2.pl');
      expect(init.headers).toMatchObject({ Authorization: STAGING_AUTH });
      const body = init.body as FormData;
      expect(body.get('code')).toBe('1234567890123');
      expect(body.get('user_id')).toBe('testuser');
      expect(body.get('password')).toBe('testpass');
      expect(body.get('app_name')).toBe(APP_NAME);
      expect(body.get('app_version')).toBe(APP_VERSION);
      expect(body.get('app_uuid')).toBeTruthy();
      expect(body.get('product_name')).toBe('Test');
      expect(body.get('nutriment_sugars')).toBe('12.5');
      expect(body.get('brands')).toBeNull();
      expect(body.get('categories')).toBeNull();
    });

    it('rejects without credentials and sends nothing', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await expect(client.updateProduct('123', {})).rejects.toMatchObject({
        code: 'no-credentials',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a response without status 1 as rejected', async () => {
      withCredentials();
      respond(JSON.stringify({ status: 0, status_verbose: 'no code or invalid code' }));

      await expect(client.updateProduct('123', {})).rejects.toThrow('no code or invalid code');
    });

    it('does not accept any response that merely contains a "1"', async () => {
      withCredentials();
      respond('<html>Error 1 occurred</html>');

      await expect(client.updateProduct('123', {})).rejects.toBeInstanceOf(UploadError);
    });

    it('reports HTTP and network errors as UploadError', async () => {
      withCredentials();
      respond('', 500);
      await expect(client.updateProduct('123', {})).rejects.toMatchObject({ code: 'rejected' });

      fetchMock.mockRejectedValue(new TypeError('Network request failed'));
      await expect(client.updateProduct('123', {})).rejects.toMatchObject({ code: 'network' });
    });
  });

  describe('credentials', () => {
    it('stores credentials after a successful check', async () => {
      respond(SAVED);

      await client.saveCredentials('user', 'secret');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_username', 'user');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_password', 'secret');
    });

    it('rejects invalid credentials (HTTP 403 or error text)', async () => {
      respond('', 403);
      await expect(client.saveCredentials('user', 'wrong')).rejects.toMatchObject({
        code: 'invalid-credentials',
      });

      respond('Invalid password');
      await expect(client.verifyCredentials('user', 'wrong')).rejects.toMatchObject({
        code: 'invalid-credentials',
      });
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('does not accept credentials when the server fails', async () => {
      respond('maintenance', 503);
      await expect(client.verifyCredentials('user', 'x')).rejects.toMatchObject({
        code: 'network',
      });
    });

    it('loads credentials only when both parts exist', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('user')
        .mockResolvedValueOnce(null);
      expect(await client.loadCredentials()).toBeNull();

      withCredentials();
      expect(await client.loadCredentials()).toEqual({
        username: 'testuser',
        password: 'testpass',
      });
    });
  });
});
