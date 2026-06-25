// This file replaces the backend server by mocking the needed endpoints client-side with simulated latency.

import { rateLimiter } from './rateLimiter';
import { combineShares, splitSecret } from "./shamirRecovery";
import type { User, OnboardingData } from "./types";
import { DEFAULT_ONBOARDING_STEP } from "./types";

// Re-export types for backward compatibility
export type { User, OnboardingData };
export { DEFAULT_ONBOARDING_STEP };

// Standardized API error class with code field
class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}


export function getOnboardingStepForEmail(email: string | null | undefined): number {
  if (!email) return DEFAULT_ONBOARDING_STEP;
  const user = users.find((u) => u.email === email);
  return user?.onboardingStep ?? DEFAULT_ONBOARDING_STEP;
}

// In-memory fake database
const users: User[] = [
  {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    username: "testuser",
    password: "Password123",
    onboardingStep: 3,
    profile: { niche: "gaming", username: "testuser" },
    walletNetwork: "testnet",
    socialRecoveryThreshold: 2,
    socialRecoveryGuardianCount: 3,
  }
];

type StoredRecoveryConfig = {
  email: string;
  threshold: number;
  guardians: { email: string; shareId: string }[];
};

const recoveryConfigs: Record<string, StoredRecoveryConfig> = {};
const guardianShares: Record<string, string> = {};

const socialRecoverySessions: Record<string, {
  email: string;
  threshold: number;
  guardians: { email: string; approved: boolean; shareId: string }[];
}> = {};

// Password reset tokens storage
const resetTokens: Record<string, { token: string; expiresAt: number }> = {};

// Helper to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Summary {
  total: string;
  completed: string;
  pending: string;
}

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  cryptoAmount?: number;
  cryptoCurrency?: 'ETH' | 'SOL' | 'USDC';
  platform: 'YouTube' | 'TikTok' | 'Instagram' | 'Twitch';
  type: 'payout' | 'royalty' | 'mint' | 'referral';
  status: 'completed' | 'pending' | 'failed';
  taxId: string;
};

// Wrapped API methods with rate limiting
export const checkEmail = rateLimiter(async (email: string) => {
  if (apiClient) {
    return apiClient.post<{ exists: boolean }>('/auth/check-email', { email });
  }
  await delay(600);
  const user = users.find(u => u.email === email);
  return { exists: !!user };
}, 10, 10000);

export const login = rateLimiter(async (email: string, password?: string) => {
  if (apiClient) {
    return apiClient.post('/auth/login', { email, password });
  }
  await delay(800);
  const user = users.find(u => u.email === email);

  if (!user || (password && user.password !== password)) {
    throw new ApiError("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const token = `fake-jwt-token-${user.id}`;
  return { token, user };
}, 10, 10000);

export const signup = rateLimiter(async (email: string, password?: string, name?: string) => {
  if (apiClient) {
    return apiClient.post('/auth/signup', { email, password, name });
  }
  await delay(800);

  if (users.find(u => u.email === email)) {
    throw new ApiError("User already exists", "USER_EXISTS");
  }

  const newUser: User = {
    id: Date.now().toString(),
    email,
    password,
    name: name || email.split('@')[0],
    onboardingStep: 1,
    profile: {}
  };

  users.push(newUser);

  const token = `fake-jwt-token-${newUser.id}`;
  return { token, user: newUser };
}, 10, 10000);

export const requestPasswordReset = rateLimiter(async (email: string) => {
  if (apiClient) {
    return apiClient.post('/auth/password-reset/request', { email });
  }
  await delay(600);
  const user = users.find(u => u.email === email);
  if (user) {
    const token = crypto.randomUUID();
    resetTokens[email] = { token, expiresAt: Date.now() + 3600000 };
  }
  return { success: true };
}, 5, 10000);

export const resetPassword = rateLimiter(async (token: string, newPassword: string) => {
  if (apiClient) {
    return apiClient.post('/auth/password-reset/reset', { token, newPassword });
  }
  await delay(800);
  const email = Object.keys(resetTokens).find(e =>
    resetTokens[e].token === token && resetTokens[e].expiresAt > Date.now()
  );
  if (!email) throw new ApiError('Invalid or expired token', 'INVALID_TOKEN');
  const user = users.find(u => u.email === email);
  if (!user) throw new ApiError('User not found', 'USER_NOT_FOUND');
  user.password = newPassword;
  delete resetTokens[email];
  return { success: true };
}, 5, 10000);

export const mintCollection = rateLimiter(async (data: { collectionName: string; description: string; creatorRoyalty: string; listingPrice: string }) => {
  if (apiClient) {
    try {
      return await apiClient.post('/mint', data);
    } catch (err) {
      if (err instanceof ApiResponseError) throw err.shape;
      throw err;
    }
  }
  await delay(1800);

  const roll = Math.random();
  if (roll < 0.25) throw new ApiError("WALLET_REJECTED", "WALLET_REJECTED");
  if (roll < 0.4) throw new ApiError("NETWORK_ERROR", "NETWORK_ERROR");
  if (roll < 0.5) throw new ApiError("UPLOAD_FAILED", "UPLOAD_FAILED");

  return { success: true, txHash: `0x${Math.random().toString(16).slice(2, 18)}`, collection: data.collectionName };
}, 10, 10000);

export const postClips = rateLimiter(async (clipIds: string[]) => {
  if (apiClient) {
    return apiClient.post('/clips/post', { clipIds });
  }
  await delay(1400);

  const roll = Math.random();
  if (roll < 0.2) throw new ApiError("NETWORK_ERROR", "NETWORK_ERROR");
  if (roll < 0.3) throw new ApiError("PLATFORM_AUTH_EXPIRED", "PLATFORM_AUTH_EXPIRED");

  return { success: true, posted: clipIds.length };
}, 10, 10000);

export const saveOnboarding = rateLimiter(async (userId: string, step: number, data: OnboardingData) => {
  if (apiClient) {
    return apiClient.post(`/users/${userId}/onboarding`, { step, data });
  }
  await delay(500);

  let user: User | undefined = users.find(u => u.id === userId);

  if (!user && typeof window !== "undefined") {
    const stored = localStorage.getItem("clipcash_user");
    if (stored) {
      const parsed = JSON.parse(stored) as User;
      if (parsed.id === userId) {
        user = parsed;
        users.push(user);
      }
    }
  }

  if (!user) throw new ApiError("User not found", "USER_NOT_FOUND");

  user.onboardingStep = step;
  user.profile = { ...user.profile, ...data };

  return { success: true, user };
}, 10, 10000);

export const getEarningsReport = rateLimiter(async (userId: string, { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}) => {
  await delay(1000 + Math.random() * 500);

  const allTransactions: Transaction[] = [];
  const platforms = ['YouTube', 'TikTok', 'Instagram', 'Twitch'] as const;
  const types = ['payout', 'royalty', 'mint', 'referral'] as const;
  const cryptoCurrencies = ['ETH', 'SOL', 'USDC'] as const;

  let totalAmount = 0;
  for (let i = 0; i < 55; i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)] as Transaction['platform'];
    const type = types[i % types.length] as Transaction['type'];
    const status = i % 7 === 0 ? 'pending' : (i % 17 === 0 ? 'failed' : 'completed');
    const amount = parseFloat((10 + Math.random() * 300).toFixed(2));
    const date = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const hasCrypto = type === 'mint' || type === 'royalty';

    const tx: Transaction = {
      id: `TX-${String(i + 1).padStart(5, '0')}`,
      date,
      description: `${platform} ${type} #${i + 1}`,
      amount,
      ...(hasCrypto && {
        cryptoAmount: parseFloat((amount / 2000 + Math.random() * 0.05).toFixed(4)),
        cryptoCurrency: cryptoCurrencies[i % cryptoCurrencies.length],
      }),
      platform,
      type,
      status,
      taxId: `TAX-${String(i + 1).padStart(3, '0')}`,
    };

    allTransactions.push(tx);
    totalAmount += tx.amount;
  }

  const total = allTransactions.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const start = (safePage - 1) * pageSize;
  const transactions = allTransactions.slice(start, start + pageSize);

  return {
    transactions,
    summary: {
      total: totalAmount.toFixed(2),
      completed: allTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
      pending: allTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
    },
    pagination: { page: safePage, pageSize, total, totalPages },
  };
}, 10, 10000);

export const sendGuardianInvitation = rateLimiter(
  async (guardianEmail: string, shareId: string, ownerEmail: string) => {
    await delay(200);
    if (typeof console !== "undefined" && console.info) {
      console.info(
        `[mock-email] Guardian invitation sent to ${guardianEmail} for account ${ownerEmail} (share ${shareId})`
      );
    }
    return { success: true };
  },
  20,
  10000
);

export const saveSocialRecoveryConfig = rateLimiter(
  async (
    email: string,
    guardians: string[],
    encryptedBackup: string,
    threshold: number
  ) => {
    await delay(600);
    const user = users.find((u) => u.email === email);
    if (!user) throw new Error("User not found");
    if (threshold < 2 || threshold > guardians.length) {
      throw new Error("Threshold must be at least 2 and cannot exceed guardian count.");
    }

    const shares = splitSecret(encryptedBackup, {
      shares: guardians.length,
      threshold,
    });

    const config: StoredRecoveryConfig = {
      email,
      threshold,
      guardians: [],
    };

    for (let i = 0; i < guardians.length; i++) {
      const shareId = crypto.randomUUID();
      guardianShares[shareId] = shares[i];
      config.guardians.push({ email: guardians[i], shareId });
      await sendGuardianInvitation(guardians[i], shareId, email);
    }

    recoveryConfigs[email] = config;
    user.socialRecoveryThreshold = threshold;
    user.socialRecoveryGuardianCount = guardians.length;

    return { success: true, threshold, guardianCount: guardians.length };
  },
  10,
  10000
);

export const initiateSocialRecovery = rateLimiter(async (email: string) => {
  await delay(800);
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error("User not found");
  const config = recoveryConfigs[email];
  if (!config || config.guardians.length === 0) {
    throw new Error("No guardians configured for this account. Use mnemonic recovery instead.");
  }

  const sessionId = crypto.randomUUID();
  socialRecoverySessions[sessionId] = {
    email,
    threshold: config.threshold,
    guardians: config.guardians.map((g) => ({
      email: g.email,
      approved: false,
      shareId: g.shareId,
    })),
  };

  return {
    sessionId,
    guardians: config.guardians.map((g) => g.email),
    threshold: config.threshold,
    guardianCount: config.guardians.length,
  };
}, 10, 10000);

export const approveGuardian = rateLimiter(async (sessionId: string, guardianEmail: string) => {
  await delay(400);
  const session = socialRecoverySessions[sessionId];
  if (!session) throw new Error("Invalid or expired session");
  const guardian = session.guardians.find((g) => g.email === guardianEmail);
  if (!guardian) throw new Error("Guardian not found in this session");
  guardian.approved = true;
  return { success: true, guardians: session.guardians };
}, 20, 10000);

export const checkSocialRecovery = rateLimiter(async (sessionId: string) => {
  await delay(600);
  const session = socialRecoverySessions[sessionId];
  if (!session) throw new Error("Invalid or expired session");
  const approvedGuardians = session.guardians.filter((g) => g.approved);
  const approvedCount = approvedGuardians.length;
  const totalCount = session.guardians.length;
  const isRecoverable = approvedCount >= session.threshold;

  let encryptedBackup: string | null = null;
  if (isRecoverable) {
    const shareValues = approvedGuardians
      .slice(0, session.threshold)
      .map((g) => guardianShares[g.shareId])
      .filter(Boolean);
    if (shareValues.length >= session.threshold) {
      encryptedBackup = combineShares(shareValues.slice(0, session.threshold));
    }
  }

  return {
    success: true,
    isRecoverable,
    approvedCount,
    totalCount,
    threshold: session.threshold,
    guardians: session.guardians,
    encryptedBackup,
  };
}, 20, 10000);

// MockApi object for backward compatibility
export const MockApi = {
  checkEmail,
  login,
  signup,
  requestPasswordReset,
  resetPassword,
  mintCollection,
  postClips,
  saveOnboarding,
  getEarningsReport,
  saveSocialRecoveryConfig,
  sendGuardianInvitation,
  initiateSocialRecovery,
  approveGuardian,
  checkSocialRecovery,
};

