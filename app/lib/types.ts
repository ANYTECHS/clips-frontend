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
  password?: string;
  onboardingStep: number;
  profile?: OnboardingData;
  walletAddress?: string;
  walletType?: string;
  walletNetwork?: "testnet" | "mainnet";
  socialRecoveryThreshold?: number;
  socialRecoveryGuardianCount?: number;
};

export const DEFAULT_ONBOARDING_STEP = 0;
