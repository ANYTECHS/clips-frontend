import { RequestCache } from "./RequestCache";
import { warmCriticalData } from "./warmCriticalData";
import type { UserProfile } from "@/app/store/types";
import * as api from "@/app/store/api";

jest.mock("@/app/store/api");

describe("warmCriticalData", () => {
  it("warms the shared profile cache for the next consumer", async () => {
    const cache = new RequestCache();
    const profile = {
      id: "user-1",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
      plan: "pro",
      planUsagePercent: 12,
    } satisfies UserProfile;
    (api.fetchUserFromAPI as jest.Mock).mockResolvedValue(profile);

    await warmCriticalData(undefined, cache);
    await expect(cache.fetch("/api/user", api.fetchUserFromAPI)).resolves.toEqual(profile);

    expect(api.fetchUserFromAPI).toHaveBeenCalledTimes(1);
  });
});