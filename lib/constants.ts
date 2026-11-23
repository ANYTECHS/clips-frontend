// Centralised numeric limits, timeouts and thresholds (issue #1350).
//
// Every tunable number used by the API routes (app/api) and the shared lib
// helpers (lib/) lives here under a descriptive name, so limits can be found,
// reviewed and changed in one place. Well-known protocol values (HTTP status
// codes, byte offsets inside file-signature checks, fixed-width regex
// quantifiers such as the 11-character YouTube id) are intentionally left
// inline where they are self-describing. Next.js route segment config
// (`export const maxDuration`) must stay a literal because it is read
// statically at build time.

// ── Units ────────────────────────────────────────────────────────────────────

const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * BYTES_PER_KB;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

/** Progress value representing a finished operation (0–100 scale). */
export const PROGRESS_COMPLETE = 100;
/** Progress value used when the total size is unknown. */
export const PROGRESS_INDETERMINATE = -1;

// ── Backend / proxy ──────────────────────────────────────────────────────────

/** Fallback backend base URL when API_URL is not configured. */
export const DEFAULT_API_URL = "https://clipcash-api.onrender.com";

/**
 * Upper bound for non-GET proxied requests. Render's free tier can take 30+s
 * to cold-start, which exceeds undici's default 10s connect timeout.
 */
export const PROXY_BACKEND_TIMEOUT_MS = 45 * MS_PER_SECOND;

/** Hex characters kept from the SHA-256 digest when building an ETag. */
export const ETAG_HASH_LENGTH = 32;

/** Max characters of a backend error body written to the server log. */
export const ERROR_LOG_PREVIEW_CHARS = 500;

/** Max characters of a request body written by the structured API logger. */
export const API_LOG_BODY_PREVIEW_CHARS = 500;

/** Per-dependency timeout for the deep health check. */
export const HEALTH_CHECK_TIMEOUT_MS = 2 * MS_PER_SECOND;

// ── Server-sent events ───────────────────────────────────────────────────────

/** SSE `retry:` hint sent to clients in the terminal `closing` event. */
export const SSE_RECONNECT_RETRY_MS = MS_PER_SECOND;

/** Grace period for terminal SSE events to flush before the process exits. */
export const SSE_SHUTDOWN_FLUSH_MS = 500;

// ── Downloads / uploads ──────────────────────────────────────────────────────

/** Size cap for files streamed through /api/download. */
export const DOWNLOAD_PROXY_MAX_BYTES = BYTES_PER_GB;

/** Size cap for files streamed through /api/youtube-dl (Vercel response limit). */
export const YOUTUBE_PROXY_MAX_BYTES = 2 * BYTES_PER_GB;

/** Bytes buffered from an upload stream before running magic-byte detection. */
export const MIME_SNIFF_BUFFER_BYTES = 4100;

/** Leading bytes inspected by the magic-byte sniffer. */
export const MIME_SNIFF_HEADER_BYTES = 64;

/** Max characters of an upstream R2 error body written to the server log. */
export const R2_ERROR_LOG_CHARS = 200;

/** Max characters of an upstream R2 error body returned to the client. */
export const R2_ERROR_MESSAGE_CHARS = 100;

/** Files larger than this are uploaded to R2 instead of Cloudinary. */
export const HYBRID_UPLOAD_THRESHOLD_BYTES = 95 * BYTES_PER_MB;

/** Maximum accepted video upload size. */
export const MAX_VIDEO_FILE_SIZE_BYTES = BYTES_PER_GB;

/** Max length of a generated download filename (before the extension). */
export const MAX_DOWNLOAD_FILENAME_LENGTH = 100;

// ── Clips / videos ───────────────────────────────────────────────────────────

/** Page size for clip listings. */
export const CLIPS_PAGE_SIZE = 20;

/** Default page size for video listings. */
export const VIDEOS_PAGE_SIZE = 10;

/** Number of recent projects shown on the dashboard. */
export const DASHBOARD_RECENT_PROJECTS = 6;

/** Clips fetched when filtering /clips client-side by video id. */
export const CLIPS_FALLBACK_FETCH_LIMIT = 50;

/** Viral score at or above which a clip is rated "high". */
export const VIRAL_SCORE_HIGH = 80;

/** Viral score at or above which a clip is rated "medium". */
export const VIRAL_SCORE_MEDIUM = 50;

// ── Session / auth ───────────────────────────────────────────────────────────

/** Default idle timeout when NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES is unset. */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

/** Minimum gap between persisted activity timestamps (scroll/mousemove throttle). */
export const ACTIVITY_WRITE_THROTTLE_MS = MS_PER_SECOND;

/** How often the idle-session watcher checks for expiry. */
export const IDLE_CHECK_INTERVAL_MS = 15 * MS_PER_SECOND;

/** How long a step-up verification stays valid for sensitive actions. */
export const STEP_UP_WINDOW_MS = 5 * MS_PER_MINUTE;

// ── Crypto (lib/secureStorage) ───────────────────────────────────────────────

export const PBKDF2_ITERATIONS = 100_000;
export const AES_KEY_LENGTH_BITS = 256;
export const AES_KEY_BYTES = AES_KEY_LENGTH_BITS / 8;
export const PBKDF2_SALT_BYTES = 16;
export const AES_GCM_IV_BYTES = 12;

// ── Stellar signatures (lib/wallet) ──────────────────────────────────────────

/** Hex length of a raw 64-byte ed25519 signature. */
export const ED25519_SIGNATURE_HEX_LENGTH = 128;

/** Byte length of a signature carrying a 2-byte type/length prefix. */
export const PREFIXED_SIGNATURE_BYTES = 66;

/** Size of the prefix stripped from a prefixed signature. */
export const SIGNATURE_PREFIX_BYTES = 2;

// ── UI feedback ──────────────────────────────────────────────────────────────

/** How long "Copied!" feedback stays visible. */
export const COPY_FEEDBACK_MS = 2 * MS_PER_SECOND;

/** Backend messages shorter than this are not shown verbatim to users. */
export const FRIENDLY_MESSAGE_MIN_LENGTH = 3;

/** Backend messages longer than this are replaced with a generic fallback. */
export const FRIENDLY_MESSAGE_MAX_LENGTH = 110;
