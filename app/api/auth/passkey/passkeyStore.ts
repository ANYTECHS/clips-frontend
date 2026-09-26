/**
 * passkeyStore — per-user WebAuthn credential and challenge storage adapter.
 *
 * In single-instance / dev environment, backed by an in-process Map.
 * Can be swapped for Redis / database storage in production without touching API routes.
 */

export interface PasskeyCredential {
  credentialId: string;
  publicKey: string;
  userId: string;
  counter: number;
  transports?: string[];
  createdAt: string;
  stellarPublicKey?: string;
}

export interface PasskeyStore {
  getCredentials(userId: string): PasskeyCredential[];
  getCredentialById(credentialId: string): PasskeyCredential | undefined;
  addCredential(userId: string, cred: PasskeyCredential): void;
  updateCounter(credentialId: string, newCounter: number): void;
  saveChallenge(userId: string, challenge: string): void;
  getChallenge(userId: string): string | undefined;
  clearChallenge(userId: string): void;
  hasPasskey(userId: string): boolean;
  clear(): void;
}

class MapPasskeyStore implements PasskeyStore {
  private readonly credentialsMap = new Map<string, PasskeyCredential[]>();
  private readonly challengesMap = new Map<string, string>();

  getCredentials(userId: string): PasskeyCredential[] {
    return this.credentialsMap.get(userId) ?? [];
  }

  getCredentialById(credentialId: string): PasskeyCredential | undefined {
    for (const creds of this.credentialsMap.values()) {
      const match = creds.find((c) => c.credentialId === credentialId);
      if (match) return match;
    }
    return undefined;
  }

  addCredential(userId: string, cred: PasskeyCredential): void {
    const existing = this.getCredentials(userId);
    const updated = [cred, ...existing.filter((c) => c.credentialId !== cred.credentialId)];
    this.credentialsMap.set(userId, updated);
  }

  updateCounter(credentialId: string, newCounter: number): void {
    const cred = this.getCredentialById(credentialId);
    if (cred) {
      cred.counter = newCounter;
    }
  }

  saveChallenge(userId: string, challenge: string): void {
    this.challengesMap.set(userId, challenge);
  }

  getChallenge(userId: string): string | undefined {
    return this.challengesMap.get(userId);
  }

  clearChallenge(userId: string): void {
    this.challengesMap.delete(userId);
  }

  hasPasskey(userId: string): boolean {
    const creds = this.getCredentials(userId);
    return creds.length > 0;
  }

  clear(): void {
    this.credentialsMap.clear();
    this.challengesMap.clear();
  }
}

export const passkeyStore: PasskeyStore = new MapPasskeyStore();
