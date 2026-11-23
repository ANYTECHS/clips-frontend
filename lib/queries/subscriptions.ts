import apiClient from "../apiClient";

type SubscriptionPlan = "STARTER" | "CREATOR" | "PRO";

export interface StellarSubscription {
  id: number;
  plan: SubscriptionPlan;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  startsAt: string;
  expiresAt: string;
  stellarAddress: string;
}

export const getMySubscription = async (): Promise<StellarSubscription | null> => {
  try {
    const res = await apiClient.get("/stellar/subscriptions/my");
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};

export const buildSubscriptionPaymentXdr = async (data: {
  senderAddress: string;
  plan: SubscriptionPlan;
}): Promise<{ xdr: string; amount: string; plan: string }> => {
  const res = await apiClient.post("/stellar/subscriptions/build-payment", data);
  return res.data;
};

export const activateSubscription = async (data: {
  senderAddress: string;
  plan: SubscriptionPlan;
  signedXdr: string;
}): Promise<StellarSubscription> => {
  const res = await apiClient.post("/stellar/subscriptions/activate", data);
  return res.data;
};
