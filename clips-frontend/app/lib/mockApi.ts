// This file replaces the backend server by mocking the needed endpoints client-side with simulated latency.

import { rateLimiter } from './rateLimiter';
import { combineShares, splitSecret } from "./shamirRecovery";

// Standardized API error class with code field
class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}
import type {
  DashboardStats,
  RevenuePoint,
  Project,
  UserProfile,
  EarningsBreakdownItem,
} from "../store/types";

export type OnboardingData = {
  username?: string;
  niche?: string;
  socialsConnected?: boolean;
  [key: string]: unknown;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  username?: string;
  onboardingStep: number;
  profile?: OnboardingData;
  socialRecoveryThreshold?: number;
  socialRecoveryGuardianCount?: number;
};

export const DEFAULT_ONBOARDING_STEP = 0;

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
  await delay(600);
  const user = users.find(u => u.email === email);
  return { exists: !!user };
}, 10, 10000);

export const login = rateLimiter(async (email: string, password?: string) => {
  await delay(800);
  const user = users.find(u => u.email === email);
  
  if (!user || (password && user.password !== password)) {
    throw new ApiError("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const token = `fake-jwt-token-${user.id}`;
  return { token, user };
}, 10, 10000);

export const signup = rateLimiter(async (email: string, password?: string, name?: string) => {
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
  await delay(600);
  const user = users.find(u => u.email === email);
  if (user) {
    const token = crypto.randomUUID();
    resetTokens[email] = { token, expiresAt: Date.now() + 3600000 };
  }
  return { success: true };
}, 5, 10000);

export const resetPassword = rateLimiter(async (token: string, newPassword: string) => {
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
  await delay(1800);

  const roll = Math.random();
  if (roll < 0.25) throw new ApiError("WALLET_REJECTED", "WALLET_REJECTED");
  if (roll < 0.4) throw new ApiError("NETWORK_ERROR", "NETWORK_ERROR");
  if (roll < 0.5) throw new ApiError("UPLOAD_FAILED", "UPLOAD_FAILED");

  return { success: true, txHash: `0x${Math.random().toString(16).slice(2, 18)}`, collection: data.collectionName };
}, 10, 10000);

export const postClips = rateLimiter(async (clipIds: string[]) => {
  await delay(1400);

  const roll = Math.random();
  if (roll < 0.2) throw new ApiError("NETWORK_ERROR", "NETWORK_ERROR");
  if (roll < 0.3) throw new ApiError("PLATFORM_AUTH_EXPIRED", "PLATFORM_AUTH_EXPIRED");

  return { success: true, posted: clipIds.length };
}, 10, 10000);

export const saveOnboarding = rateLimiter(async (userId: string, step: number, data: OnboardingData) => {
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

export const getEarningsReport = rateLimiter(async (userId: string) => {
  await delay(1000 + Math.random() * 500);
  
  const transactions: Transaction[] = [];
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
    
    transactions.push(tx);
    totalAmount += tx.amount;
  }
  
  return {
    transactions,
    summary: {
      total: totalAmount.toFixed(2),
      completed: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
      pending: transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0).toFixed(2),
    }
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

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  earnings: { total: "$12,450.80", trend: 12.5, trendLabel: "+12.5% from last month" },
  clips: { total: 142, trend: 8.2, trendLabel: "+8.2% from last month" },
  platforms: { total: 4, trend: 0, trendLabel: "Steady performance" },
};

export const MOCK_REVENUE_TREND: RevenuePoint[] = [
  { date: "2024-03-01", amount: 400 },
  { date: "2024-03-05", amount: 600 },
  { date: "2024-03-10", amount: 800 },
];

export const MOCK_PROJECTS: Project[] = [
  { id: "1", title: "Apex Legends", clipsGenerated: 2, status: "processing", accent: "" },
];

export const MOCK_USER_PROFILE: UserProfile = {
  id: "usr_001",
  name: "Alex Rivera",
  email: "alex@clipcash.ai",
  avatarUrl: "/avatar.png",
  plan: "pro",
  planUsagePercent: 80,
};

export const MOCK_EARNINGS_BREAKDOWN: EarningsBreakdownItem[] = [
  { id: "e1", label: "Apex", amount: 320.5, date: "2024-03-25", platform: "youtube" },
];

export async function fetchDashboardFromAPI(): Promise<{
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}> {
  await delay(1500);
  return {
    stats: MOCK_DASHBOARD_STATS,
    revenueTrend: MOCK_REVENUE_TREND,
    recentProjects: MOCK_PROJECTS,
  };
}

export async function fetchUserFromAPI(): Promise<UserProfile> {
  await delay(500);
  return MOCK_USER_PROFILE;
}

export async function fetchEarningsFromAPI(): Promise<{
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };
  breakdown: EarningsBreakdownItem[];
}> {
  await delay(800);
  return {
    totalEarnings: MOCK_DASHBOARD_STATS.earnings.total,
    totalTrend: MOCK_DASHBOARD_STATS.earnings.trend,
    trendLabel: MOCK_DASHBOARD_STATS.earnings.trendLabel,
    totalFiat: { value: MOCK_DASHBOARD_STATS.earnings.total, change: MOCK_DASHBOARD_STATS.earnings.trend },
    cryptoRevenue: { value: "1.25 ETH", change: 8.2 },
    pendingPayouts: { value: "$1,850.25", change: 0 },
    breakdown: MOCK_EARNINGS_BREAKDOWN,
  };
}
