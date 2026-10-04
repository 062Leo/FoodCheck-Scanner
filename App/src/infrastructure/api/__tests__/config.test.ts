import {
  generateAppUUID,
  USER_AGENT,
  WIKIMEDIA_USER_AGENT,
  STAGING_AUTH,
  APP_NAME,
  APP_VERSION,
} from '../config';

describe('config', () => {
  describe('USER_AGENT', () => {
    it('names app and version without a contact address', () => {
      expect(USER_AGENT).toMatch(/^[\w.]+\/[\d.]+$/);
      expect(USER_AGENT).toContain(APP_NAME);
      expect(USER_AGENT).toContain(APP_VERSION);
    });
  });

  describe('WIKIMEDIA_USER_AGENT', () => {
    it('adds the public project page as contact, but no e-mail address', () => {
      expect(WIKIMEDIA_USER_AGENT).toBe(
        `${APP_NAME}/${APP_VERSION} (https://github.com/062Leo/FoodCheck-Scanner)`
      );
      expect(WIKIMEDIA_USER_AGENT).not.toContain('@');
    });
  });

  describe('STAGING_AUTH', () => {
    it('should be the off:off base64 value', () => {
      expect(STAGING_AUTH).toBe('Basic b2ZmOm9mZg==');
    });
  });
});

describe('generateAppUUID', () => {
  it('should produce a UUID-like string', () => {
    const uuid = generateAppUUID('testuser');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should be deterministic — same input produces same output', () => {
    const a = generateAppUUID('same-user');
    const b = generateAppUUID('same-user');
    expect(a).toBe(b);
  });

  it('should produce different outputs for different inputs', () => {
    const a = generateAppUUID('user-a');
    const b = generateAppUUID('user-b');
    expect(a).not.toBe(b);
  });

  it('should handle empty string input', () => {
    const uuid = generateAppUUID('');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
