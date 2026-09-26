// Upload limits
export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;
export const UPLOAD_CONCURRENCY = 3;

// Crypto
export const PBKDF2_ITERATIONS = 100000;

// Balance & wallet
export const BALANCE_REFRESH_INTERVAL_MS = 30000;
export const TRANSACTION_TIMEOUT_MS = 30000;

// Cache TTLs
export const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
export const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
export const EARNINGS_CACHE_TTL_MS = 5 * 60 * 1000;

// Jobs
export const JOB_ESTIMATED_SECONDS = 300;

// UI defaults
export const DEBOUNCE_DEFAULT_DELAY_MS = 300;

// Stellar
export const BASE_BACKOFF_MS = 300;
export const EXCELLENT_LATENCY_THRESHOLD_MS = 300;

// Virus scan
export const VIRUS_SCAN_DEFAULT_TIMEOUT_MS = 30000;

// CDN
export const CDN_STATIC_CACHE_MAX_AGE_S = 31_536_000; // 1 year — immutable assets
export const CDN_PUBLIC_CACHE_MAX_AGE_S = 86_400; // 1 day
export const CDN_PUBLIC_STALE_WHILE_REVALIDATE_S = 604_800; // 7 days
export const CDN_AVAILABILITY_CACHE_TTL_MS = 60_000; // 60 s