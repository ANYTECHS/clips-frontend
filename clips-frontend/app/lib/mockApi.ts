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
  platform: 'YouTube' | 'TikTok' | 'Instagram' | 'Twitch';
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
    
    // Mock 50+ transactions totaling ~$12,450 matching dashboard
    const baseTransactions: Omit<Transaction, 'id'>[] = [
      { date: '2024-10-15', description: 'YouTube Shorts payout #47', amount: 245.80, platform: 'YouTube', status: 'completed', taxId: 'TX-001' },
      { date: '2024-10-12', description: 'TikTok viral clips batch', amount: 189.50, platform: 'TikTok', status: 'completed', taxId: 'TX-002' },
      { date: '2024-10-10', description: 'Instagram Reels monetization', amount: 156.20, platform: 'Instagram', status: 'completed', taxId: 'TX-003' },
      { date: '2024-10-08', description: 'Twitch highlights payout', amount: 98.75, platform: 'Twitch', status: 'pending', taxId: 'TX-004' },
      // ... more data to sum ~$12k
    ];
    
    // Generate 50+ varied transactions
    const transactions: Transaction[] = [];
    const platforms = ['YouTube', 'TikTok', 'Instagram', 'Twitch'] as const;
    const statuses = ['completed', 'pending', 'failed'] as const;
    
    let totalAmount = 0;
    for (let i = 0; i < 55; i++) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)] as Transaction['platform'];
      const status = i % 7 === 0 ? 'pending' : (i % 17 === 0 ? 'failed' : 'completed');
      const amount = (10 + Math.random() * 300).toFixed(2);
      const date = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const tx: Transaction = {
        id: `tx-${Date.now()}-${i}`,
        date,
        description: `${platform} payout #${i + 1}`,
        amount: parseFloat(amount),
        platform,
        status,
        taxId: `TX-${String(i + 1).padStart(3, '0')}`,
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
