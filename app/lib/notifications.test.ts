import {
  getNotificationSettingsInstructions,
  getNotificationSettingsUrl,
  requestNotificationPermission,
  storePermission,
} from "./notifications";

describe("notifications permission flow", () => {
  const originalNotification = window.Notification;

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: originalNotification,
    });
    jest.restoreAllMocks();
  });

  function mockNotification(permission: NotificationPermission) {
    const requestPermission = jest.fn().mockResolvedValue(permission);
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission,
        requestPermission,
      },
    });
    return requestPermission;
  }

  it("does not re-prompt when the browser already denied permission", async () => {
    const requestPermission = mockNotification("denied");

    await expect(requestNotificationPermission()).resolves.toBe("denied");

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("ignores stale stored denial when the browser can still prompt", async () => {
    const requestPermission = mockNotification("default");
    requestPermission.mockResolvedValueOnce("granted");
    storePermission("denied");

    await expect(requestNotificationPermission()).resolves.toBe("granted");

    expect(requestPermission).toHaveBeenCalled();
  });

  it("returns browser-specific notification settings links", () => {
    expect(getNotificationSettingsUrl("Mozilla/5.0 Chrome/120 Safari/537.36")).toBe(
      "chrome://settings/content/notifications",
    );
    expect(getNotificationSettingsUrl("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toBeNull();
  });

  it("returns Safari-specific settings instructions", () => {
    expect(getNotificationSettingsInstructions("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toMatch(
      /Safari Settings/i,
    );
  });
});
