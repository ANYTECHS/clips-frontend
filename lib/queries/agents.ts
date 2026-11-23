import apiClient from "../apiClient";
import type { ReadyToPostKit } from "./clips";

export interface Agent {
  id: number;
  name: string;
  description: string;
  pricePerJobBNB: string;
  walletAddress: string;
  contractAddress: string;
}

export interface AgentJob {
  id: number;
  contractJobId: string;
  videoUrl: string;
  style: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  clientAddress: string;
  txHash: string;
  resultClipIds: number[];
  agentId: number;
  createdAt: string;
  clips?: any[];
  readyToPostKit?: ReadyToPostKit | null;
}

export const getAgents = async (): Promise<Agent[]> => {
  const res = await apiClient.get("/agents");
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
};

export const buildAgentPaymentXdr = async (data: {
  senderAddress: string;
  videoUrl: string;
  style?: string;
}): Promise<{ xdr: string; memo: string; amount: string }> => {
  const res = await apiClient.post("/stellar/agent/build-payment", {
    senderAddress: data.senderAddress,
    videoUrl: data.videoUrl,
    style: data.style,
  });
  return res.data;
};

export const hireAgent = async (data: {
  senderAddress: string;
  videoUrl: string;
  style?: string;
  signedXdr?: string;
}): Promise<AgentJob> => {
  const res = await apiClient.post("/stellar/agent/hire", {
    senderAddress: data.senderAddress,
    videoUrl: data.videoUrl,
    style: data.style,
    ...(data.signedXdr ? { signedXdr: data.signedXdr } : {}),
  });
  return res.data;
};
