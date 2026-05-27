// This file replaces the backend server by mocking the needed endpoints client-side with simulated latency.

import { rateLimiter } from './rateLimiter';

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
  guardians?: string[];
  encryptedWalletBackup?: string;
};

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
    guardians: ["guardian1@example.com", "guardian2@example.com", "guardian3@example.com"],
    encryptedWalletBackup: "abandon ability able about above absent absorb abstract absurd abuse access accident"
  }
];

// In-memory social recovery sessions
const socialRecoverySessions: Record<string, {
  email: string;
  guardians: { email: string; approved: boolean }[];
  recoveryKeyEncrypted: string;
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
    throw new Error("Invalid credentials");
  }

  const token = `fake-jwt-token-${user.id}`;
  return { token, user };
}, 10, 10000);

export const signup = rateLimiter(async (email: string, password?: string, name?: string) => {
  await delay(800);
  
  if (users.find(u => u.email === email)) {
    throw new Error("User already exists");
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
  if (!email) throw new Error('Invalid or expired token');
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('User not found');
  user.password = newPassword;
  delete resetTokens[email];
  return { success: true };
}, 5, 10000);

export const mintCollection = rateLimiter(async (data: { collectionName: string; description: string; creatorRoyalty: string; listingPrice: string }) => {
  await delay(1800);

  const roll = Math.random();
  if (roll < 0.25) throw new Error("WALLET_REJECTED");
  if (roll < 0.4) throw new Error("NETWORK_ERROR");
  if (roll < 0.5) throw new Error("UPLOAD_FAILED");

  return { success: true, txHash: `0x${Math.random().toString(16).slice(2, 18)}`, collection: data.collectionName };
}, 10, 10000);

export const postClips = rateLimiter(async (clipIds: string[]) => {
  await delay(1400);

  const roll = Math.random();
  if (roll < 0.2) throw new Error("NETWORK_ERROR");
  if (roll < 0.3) throw new Error("PLATFORM_AUTH_EXPIRED");

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

  if (!user) throw new Error("User not found");

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

export const saveSocialRecoveryConfig = rateLimiter(async (email: string, guardians: string[], encryptedBackup: string) => {
  await delay(600);
  const user = users.find(u => u.email === email);
  if (!user) throw new Error("User not found");
  user.guardians = guardians;
  user.encryptedWalletBackup = encryptedBackup;
  return { success: true };
}, 10, 10000);

export const initiateSocialRecovery = rateLimiter(async (email: string) => {
  await delay(800);
  const user = users.find(u => u.email === email);
  if (!user) throw new Error("User not found");
  if (!user.guardians || user.guardians.length === 0) {
    throw new Error("No guardians configured for this account. Use mnemonic recovery instead.");
  }
  const sessionId = crypto.randomUUID();
  socialRecoverySessions[sessionId] = {
    email,
    guardians: user.guardians.map(g => ({ email: g, approved: false })),
    recoveryKeyEncrypted: user.encryptedWalletBackup || ""
  };
  return { sessionId, guardians: user.guardians };
}, 10, 10000);

export const approveGuardian = rateLimiter(async (sessionId: string, guardianEmail: string) => {
  await delay(400);
  const session = socialRecoverySessions[sessionId];
  if (!session) throw new Error("Invalid or expired session");
  const guardian = session.guardians.find(g => g.email === guardianEmail);
  if (!guardian) throw new Error("Guardian not found in this session");
  guardian.approved = true;
  return { success: true, guardians: session.guardians };
}, 20, 10000);

export const checkSocialRecovery = rateLimiter(async (sessionId: string) => {
  await delay(600);
  const session = socialRecoverySessions[sessionId];
  if (!session) throw new Error("Invalid or expired session");
  const approvedCount = session.guardians.filter(g => g.approved).length;
  const totalCount = session.guardians.length;
  const isRecoverable = approvedCount >= Math.ceil(totalCount / 2);
  return {
    success: true,
    isRecoverable,
    approvedCount,
    totalCount,
    guardians: session.guardians,
    encryptedBackup: isRecoverable ? session.recoveryKeyEncrypted : null
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
  initiateSocialRecovery,
  approveGuardian,
  checkSocialRecovery,
};
