// This file replaces the backend server by mocking the needed endpoints client-side with simulated latency.

export type User = {
  id: string;
  email: string;
  name?: string;
  username?: string;
  password?: string;
  onboardingStep: number;
  profile?: Record<string, any>;
};

// In-memory fake database
const users: User[] = [];

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

export const MockApi = {
  /**
   * Check if a user with the given email exists
   */
  checkEmail: async (email: string) => {
    await delay(600); // Simulate network latency
    const user = users.find(u => u.email === email);
    return { exists: !!user };
  },

  /**
   * Login an existing user
   */
  login: async (email: string, password?: string) => {
    await delay(800);
    const user = users.find(u => u.email === email);
    
    // Simplistic auth check
    if (!user || (password && user.password !== password)) {
      throw new Error("Invalid credentials");
    }

    // Mock generic token
    const token = `fake-jwt-token-${user.id}`;
    
    return { token, user };
  },

  /**
   * Signup a new user
   */
  signup: async (email: string, password?: string, name?: string) => {
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
  },

  /**
   * Simulate minting an NFT collection — randomly fails to test error handling
   */
  mintCollection: async (data: { collectionName: string; description: string; creatorRoyalty: string; listingPrice: string }) => {
    await delay(1800);

    // Simulate random failure scenarios
    const roll = Math.random();
    if (roll < 0.25) throw new Error("WALLET_REJECTED");
    if (roll < 0.4) throw new Error("NETWORK_ERROR");
    if (roll < 0.5) throw new Error("UPLOAD_FAILED");

    return { success: true, txHash: `0x${Math.random().toString(16).slice(2, 18)}`, collection: data.collectionName };
  },

  /**
   * Simulate posting clips to platforms
   */
  postClips: async (clipIds: string[]) => {
    await delay(1400);

    const roll = Math.random();
    if (roll < 0.2) throw new Error("NETWORK_ERROR");
    if (roll < 0.3) throw new Error("PLATFORM_AUTH_EXPIRED");

    return { success: true, posted: clipIds.length };
  },

  saveOnboarding: async (userId: string, step: number, data: any) => {
    await delay(500); // Usually faster for background auto-save
    
    let user: User | undefined = users.find(u => u.id === userId);
    
    // Auto-recover lost memory db from localStorage on page refresh/HMR
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
  },

  /**
   * Get earnings report / transaction history for tax purposes
   */
  getEarningsReport: async (userId: string) => {
    await delay(1000 + Math.random() * 500); // Variable latency for realism
    
    // Generate 50+ varied transactions
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
  }
};
