import { z } from "zod";
import type { StellarNetwork } from "./networkConfig";

/**
 * User Preferences — Issue #1240.
 *
 * Provides typed preferences, schema validation, avatar validation,
 * IANA timezone validation, and local/API synchronization.
 */

export const NOTIFICATION_EVENTS = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationChannelPreferences {
  job_complete: boolean;
  transform_complete: boolean;
  mint_success: boolean;
  earnings_received: boolean;
}

export type ThemePreference = "light" | "dark" | "system";
export type LanguagePreference = "en" | "es" | "fr" | "pt";
export type GasPreference = "slow" | "medium" | "fast";

export interface UserPreferences {
  profile: {
    displayName: string;
    avatarUrl: string | null;
  };
  notifications: {
    email: NotificationChannelPreferences;
    push: NotificationChannelPreferences;
    inApp: NotificationChannelPreferences;
  };
  display: {
    theme: ThemePreference;
    language: LanguagePreference;
    timezone: string;
  };
  wallet: {
    defaultNetwork: StellarNetwork;
    gasPreference: GasPreference;
    autoConnect: boolean;
  };
  privacy: {
    analyticsOptOut: boolean;
    dataExportStatus?: "idle" | "requested" | "processing" | "ready";
    dataExportRequestedAt?: string | null;
  };
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  profile: {
    displayName: "",
    avatarUrl: null,
  },
  notifications: {
    email: {
      job_complete: true,
      transform_complete: true,
      mint_success: true,
      earnings_received: true,
    },
    push: {
      job_complete: true,
      transform_complete: true,
      mint_success: true,
      earnings_received: true,
    },
    inApp: {
      job_complete: true,
      transform_complete: true,
      mint_success: true,
      earnings_received: true,
    },
  },
  display: {
    theme: "dark",
    language: "en",
    timezone: "UTC",
  },
  wallet: {
    defaultNetwork: "testnet",
    gasPreference: "medium",
    autoConnect: false,
  },
  privacy: {
    analyticsOptOut: false,
    dataExportStatus: "idle",
    dataExportRequestedAt: null,
  },
};

export const defaultUserPreferences = DEFAULT_USER_PREFERENCES;

// ─── Timezone Validation ──────────────────────────────────────────────────────

/**
 * Validates whether a given string is a valid IANA timezone identifier.
 */
export function validateTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a list of supported IANA timezones.
 */
export function getSupportedTimezones(): string[] {
  if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
    try {
      return (Intl as any).supportedValuesOf("timeZone");
    } catch {
      // Fallback
    }
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Dubai",
    "Australia/Sydney",
  ];
}

// ─── Avatar Validation ────────────────────────────────────────────────────────

export const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB limit

export interface AvatarValidationResult {
  valid: boolean;
  mimeType?: string;
  error?: string;
}

/**
 * Validates avatar image file content and magic bytes.
 * Supported formats: JPEG, PNG, GIF, WebP.
 * Enforces strictly <= 1 MB size.
 */
export function validateAvatarFile(
  bytes: Uint8Array | ArrayBuffer | Buffer,
  declaredSize?: number
): AvatarValidationResult {
  const size = declaredSize ?? (bytes as any).byteLength ?? (bytes as any).length;
  if (!size || size > MAX_AVATAR_BYTES) {
    return { valid: false, error: "Avatar file exceeds maximum size limit of 1 MB" };
  }

  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 8) {
    return { valid: false, error: "File is too small or truncated to be a valid image" };
  }

  // Check Magic Bytes:
  // JPEG: FF D8 FF
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47 &&
    u8[4] === 0x0d &&
    u8[5] === 0x0a &&
    u8[6] === 0x1a &&
    u8[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png" };
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) {
    return { valid: true, mimeType: "image/gif" };
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8.length >= 12 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp" };
  }

  return {
    valid: false,
    error: "Invalid image format. Allowed formats are JPEG, PNG, GIF, and WebP.",
  };
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const channelPreferencesSchema = z.object({
  job_complete: z.boolean(),
  transform_complete: z.boolean(),
  mint_success: z.boolean(),
  earnings_received: z.boolean(),
});

export const UserPreferencesSchema = z.object({
  profile: z
    .object({
      displayName: z.string().max(100).optional(),
      avatarUrl: z.string().nullable().optional(),
    })
    .optional(),
  notifications: z
    .object({
      email: channelPreferencesSchema.partial().optional(),
      push: channelPreferencesSchema.partial().optional(),
      inApp: channelPreferencesSchema.partial().optional(),
    })
    .optional(),
  display: z
    .object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      language: z.enum(["en", "es", "fr", "pt"]).optional(),
      timezone: z
        .string()
        .refine(validateTimezone, { message: "Invalid IANA timezone identifier" })
        .optional(),
    })
    .optional(),
  wallet: z
    .object({
      defaultNetwork: z.enum(["testnet", "mainnet"]).optional(),
      gasPreference: z.enum(["slow", "medium", "fast"]).optional(),
      autoConnect: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      analyticsOptOut: z.boolean().optional(),
      dataExportStatus: z.enum(["idle", "requested", "processing", "ready"]).optional(),
      dataExportRequestedAt: z.string().nullable().optional(),
    })
    .optional(),
});

export type UserPreferencesPatch = z.infer<typeof UserPreferencesSchema>;

// ─── Storage Helpers ──────────────────────────────────────────────────────────

const PREFERENCES_STORAGE_KEY = "clipcash_user_preferences";
const NETWORK_OVERRIDE_KEY = "clipcash_network_override";

export const UserPreferencesStorage = {
  get(): UserPreferences {
    if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
    try {
      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!stored) return DEFAULT_USER_PREFERENCES;
      const parsed = JSON.parse(stored);
      return deepMerge(DEFAULT_USER_PREFERENCES, parsed);
    } catch {
      return DEFAULT_USER_PREFERENCES;
    }
  },

  set(preferences: Partial<UserPreferences>): void {
    if (typeof window === "undefined") return;
    try {
      const current = UserPreferencesStorage.get();
      const updated = deepMerge(current, preferences);
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));

      // Synchronize network override key for backwards compatibility
      if (updated.wallet?.defaultNetwork) {
        localStorage.setItem(NETWORK_OVERRIDE_KEY, updated.wallet.defaultNetwork);
      }
      // Synchronize theme key for early initialization
      if (updated.display?.theme) {
        localStorage.setItem("clipcash-theme", updated.display.theme);
      }
      // Synchronize analytics opt-out
      if (typeof updated.privacy?.analyticsOptOut === "boolean") {
        localStorage.setItem("clipcash_analytics_opt_out", String(updated.privacy.analyticsOptOut));
      }
    } catch {
      // Ignore storage errors
    }
  },
};

export const NetworkPreferenceStorage = {
  get: (): StellarNetwork | null => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(NETWORK_OVERRIDE_KEY);
    if (stored === "mainnet" || stored === "testnet") {
      return stored as StellarNetwork;
    }
    return null;
  },

  set: (network: StellarNetwork): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem(NETWORK_OVERRIDE_KEY, network);
    }
  },

  getKey: (): string => NETWORK_OVERRIDE_KEY,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    const sVal = (source as any)[key];
    const tVal = (target as any)[key];
    if (sVal !== undefined) {
      if (
        sVal !== null &&
        typeof sVal === "object" &&
        !Array.isArray(sVal) &&
        tVal !== null &&
        typeof tVal === "object" &&
        !Array.isArray(tVal)
      ) {
        (result as any)[key] = deepMerge(tVal, sVal);
      } else {
        (result as any)[key] = sVal;
      }
    }
  }
  return result;
}
