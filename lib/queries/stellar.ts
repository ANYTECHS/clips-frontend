import apiClient from "../apiClient";

// Stellar wallet linking and on-chain tipping.

export const connectStellarWallet = async (stellarAddress: string, signature: string, nonce: string) => {
  const response = await apiClient.post('/auth/stellar/connect', {
    stellarAddress,
    signature,
    nonce,
  });
  return response.data;
};

export const getConnectWalletChallenge = async (stellarAddress: string) => {
  // Requires challenge with purpose: connect
  const response = await apiClient.get('/auth/stellar/connect/challenge', {
    params: { stellarAddress },
  });
  return response.data as { challenge: string; message: string; expiresIn: string };
};

export const disconnectStellarWallet = async () => {
  await apiClient.delete('/auth/stellar/disconnect');
};


export const buildTipTransaction = async (clipId: number, amount: string, senderAddress: string) => {
  const response = await apiClient.post('/stellar/tips/build', {
    clipId,
    amount,
    senderAddress,
  });
  return response.data;
};

export const submitTipTransaction = async (clipId: number, signedXdr: string, senderAddress: string) => {
  const response = await apiClient.post('/stellar/tips/submit', {
    clipId,
    signedXdr,
    senderAddress,
  });
  return response.data;
};

export const getTipStatus = async (tipId: string) => {
  const response = await apiClient.get(`/stellar/tips/${tipId}`);
  return response.data;
};
