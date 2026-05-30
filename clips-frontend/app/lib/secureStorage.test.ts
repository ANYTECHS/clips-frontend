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

// Property-based tests for round-trip correctness (#440)
describe('secureStorage – property-based round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Generate varied string payloads to test round-trip fidelity
  const payloads: [string, string][] = [
    ['empty string', ''],
    ['plain ascii', 'hello world'],
    ['unicode emoji', '🎬🚀✨'],
    ['json object', JSON.stringify({ id: 1, name: 'clip', tags: ['a', 'b'] })],
    ['special chars', '!@#$%^&*()<>?/\\|{}[]`~'],
    ['long string', 'x'.repeat(10_000)],
    ['newlines and tabs', 'line1\nline2\ttabbed'],
    ['null-like string', 'null'],
    ['number-like string', '3.14159'],
  ];

  it.each(payloads)('round-trips value: %s', async (_label, value) => {
    const key = `prop-test-${_label}`;
    await secureStorage.setItem(key, value);
    const result = await secureStorage.getItem(key);
    expect(result).toBe(value);
  });

  // Property: stored value is never the plaintext (encryption actually happens)
  it.each([
    ['secret data', 'my-secret-value'],
    ['json payload', '{"token":"abc123"}'],
  ])('stored bytes differ from plaintext for: %s', async (_label, value) => {
    const key = `encrypt-check-${_label}`;
    await secureStorage.setItem(key, value);
    const raw = localStorage.getItem(key);
    expect(raw).not.toBe(value);
    expect(raw).not.toBeNull();
  });

  // Property: overwriting a key returns the latest value
  it('last write wins on same key', async () => {
    await secureStorage.setItem('overwrite-key', 'first');
    await secureStorage.setItem('overwrite-key', 'second');
    expect(await secureStorage.getItem('overwrite-key')).toBe('second');
  });

  // Property: independent keys do not interfere with each other
  it('multiple keys are stored and retrieved independently', async () => {
    const entries = [['k1', 'v1'], ['k2', 'v2'], ['k3', 'v3']] as const;
    for (const [k, v] of entries) await secureStorage.setItem(k, v);
    for (const [k, v] of entries) expect(await secureStorage.getItem(k)).toBe(v);
  });
});
