import { secureStorage } from './secureStorage';

describe('secureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('encrypts and decrypts data round-trip', async () => {
    const testKey = 'test-key';
    const testValue = 'test-value-123';
    await secureStorage.setItem(testKey, testValue);
    const retrieved = await secureStorage.getItem(testKey);
    expect(retrieved).toBe(testValue);
  });

  it('returns null for non-existent key', async () => {
    const result = await secureStorage.getItem('non-existent');
    expect(result).toBeNull();
  });

  it('clears data on removeItem', async () => {
    await secureStorage.setItem('key', 'value');
    await secureStorage.removeItem('key');
    const result = await secureStorage.getItem('key');
    expect(result).toBeNull();
  });

  it('clears unencrypted data on first read', async () => {
    localStorage.setItem('mixed-key', 'plain-text');
    const result = await secureStorage.getItem('mixed-key');
    expect(result).toBeNull();
    expect(localStorage.getItem('mixed-key')).toBeNull();
  });
});
