import {
  selectIsOnline,
  selectResourceStatus,
  useSyncStore,
} from "./syncStore";

const idle = { status: "idle" as const, lastSyncedAt: null, error: null };

describe("syncStore", () => {
  beforeEach(() => {
    useSyncStore.setState({ resources: {}, isOnline: true });
  });

  it("starts with empty resources and online mode", () => {
    expect(useSyncStore.getState().resources).toEqual({});
    expect(selectIsOnline(useSyncStore.getState())).toBe(true);
    expect(useSyncStore.getState().getResourceStatus("missing")).toEqual(idle);
  });

  it("sets syncing and error states, then marks a resource synced", () => {
    useSyncStore.getState().setStatus("dashboard", "syncing");
    expect(selectResourceStatus("dashboard")(useSyncStore.getState())).toEqual({
      status: "syncing",
      lastSyncedAt: null,
      error: null,
    });

    useSyncStore.getState().setStatus("dashboard", "error", "offline");
    expect(useSyncStore.getState().getResourceStatus("dashboard")).toMatchObject({
      status: "error",
      error: "offline",
    });

    useSyncStore.getState().markSynced("dashboard");
    expect(useSyncStore.getState().getResourceStatus("dashboard")).toMatchObject({
      status: "synced",
      error: null,
    });
    expect(useSyncStore.getState().getResourceStatus("dashboard").lastSyncedAt).toEqual(expect.any(Number));
  });

  it("marks conflicts while preserving the previous sync timestamp", () => {
    useSyncStore.setState({
      resources: { projects: { status: "synced", lastSyncedAt: 42, error: null } },
    });
    useSyncStore.getState().markConflict("projects");
    expect(useSyncStore.getState().getResourceStatus("projects")).toEqual({
      status: "conflict",
      lastSyncedAt: 42,
      error: null,
    });
  });

  it("switches online/offline modes in response to updates and browser events", () => {
    useSyncStore.getState().setOnline(false);
    expect(selectIsOnline(useSyncStore.getState())).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(selectIsOnline(useSyncStore.getState())).toBe(true);
    window.dispatchEvent(new Event("offline"));
    expect(selectIsOnline(useSyncStore.getState())).toBe(false);
  });

  it("keeps concurrent resource updates isolated", async () => {
    await Promise.all(
      ["dashboard", "earnings", "wallet"].map(async (resource) => {
        useSyncStore.getState().setStatus(resource, "syncing");
        useSyncStore.getState().markSynced(resource);
      }),
    );
    expect(Object.keys(useSyncStore.getState().resources)).toEqual([
      "dashboard",
      "earnings",
      "wallet",
    ]);
    expect(Object.values(useSyncStore.getState().resources).every((entry) => entry.status === "synced")).toBe(true);
  });
});
