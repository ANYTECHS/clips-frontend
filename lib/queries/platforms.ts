import apiClient from "../apiClient";

export const disconnectPlatform = async (platform: string) => {
  await apiClient.delete(`/platforms/${platform}`);
};
