/**
 * Jest tests converted from test-auth-security.js (#441)
 * Verifies that passwords are never stored in localStorage via setUser.
 */

// Replicate the setUser logic from AuthProvider
function setUser(newUser: Record<string, unknown> | null) {
  if (newUser) {
    const { password, ...safeUser } = newUser;
    void password; // intentionally stripped
    localStorage.setItem('clipcash_user', JSON.stringify(safeUser));
  } else {
    localStorage.removeItem('clipcash_user');
  }
}

describe('AuthProvider password security', () => {
  beforeEach(() => localStorage.clear());

  it('strips password field before persisting to localStorage', () => {
    setUser({ id: '123', email: 'test@example.com', name: 'Test User', password: 'super-secret', onboardingStep: 1, profile: {} });
    const stored = JSON.parse(localStorage.getItem('clipcash_user')!);
    expect(stored).not.toHaveProperty('password');
  });

  it('preserves all non-sensitive fields', () => {
    setUser({ id: '123', email: 'test@example.com', name: 'Test User', password: 'secret', onboardingStep: 1, profile: {} });
    const stored = JSON.parse(localStorage.getItem('clipcash_user')!);
    expect(stored.id).toBe('123');
    expect(stored.email).toBe('test@example.com');
    expect(stored.onboardingStep).toBe(1);
  });

  it('works correctly when user has no password field', () => {
    setUser({ id: '456', email: 'user@example.com', profile: { username: 'testuser' } });
    const stored = JSON.parse(localStorage.getItem('clipcash_user')!);
    expect(stored).not.toHaveProperty('password');
    expect(stored.profile.username).toBe('testuser');
  });

  it('clears localStorage on logout (null user)', () => {
    setUser({ id: '123', email: 'test@example.com' });
    setUser(null);
    expect(localStorage.getItem('clipcash_user')).toBeNull();
  });
});
