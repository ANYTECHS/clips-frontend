// Upload limits

/** Maximum size of a single uploaded file, in bytes. */
export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
/** Maximum number of files accepted in one upload request. */
export const MAX_FILES_PER_REQUEST = 10;
/** Number of files uploaded in parallel by the upload progress hook. */
export const UPLOAD_CONCURRENCY = 3;

// Crypto

/** PBKDF2 iteration count used when deriving encryption keys from a passphrase. */
export const PBKDF2_ITERATIONS = 100000;

// Balance & wallet

/** Default interval between balance refreshes, in milliseconds. */
export const BALANCE_REFRESH_INTERVAL_MS = 30000;
/** Default timeout for a Stellar transaction, in milliseconds. */
export const TRANSACTION_TIMEOUT_MS = 30000;

// Cache TTLs

/** How long a fetched XLM price is cached, in milliseconds. */
export const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
/** How long the dashboard store's data is cached, in milliseconds. */
export const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
/** How long the earnings store's data is cached, in milliseconds. */
export const EARNINGS_CACHE_TTL_MS = 5 * 60 * 1000;

// Jobs

/** Estimated duration of a processing job, in seconds. */
export const JOB_ESTIMATED_SECONDS = 300;

// UI defaults

/** Default debounce delay, in milliseconds. */
export const DEBOUNCE_DEFAULT_DELAY_MS = 300;

// Stellar

/** Base delay for the jittered exponential retry backoff: an attempt waits a random 0 to (this × 2^n) milliseconds. */
export const BASE_BACKOFF_MS = 300;
/** Latency threshold for an "excellent" rating, in milliseconds. */
export const EXCELLENT_LATENCY_THRESHOLD_MS = 300;

// Virus scan

/** Fallback virus-scan timeout when `VIRUS_SCAN_TIMEOUT` is unset, in milliseconds. */
export const VIRUS_SCAN_DEFAULT_TIMEOUT_MS = 30000;

// CDN

/** `Cache-Control: max-age` for static CDN assets — 1 year, immutable assets. */
export const CDN_STATIC_CACHE_MAX_AGE_S = 31_536_000;
/** `Cache-Control: max-age` for public CDN assets — 1 day. */
export const CDN_PUBLIC_CACHE_MAX_AGE_S = 86_400;
/** `stale-while-revalidate` window for public CDN assets — 7 days. */
export const CDN_PUBLIC_STALE_WHILE_REVALIDATE_S = 604_800;
/** CDN availability cache TTL — 60 s. */
export const CDN_AVAILABILITY_CACHE_TTL_MS = 60_000;

// Performance monitoring (#882) — Web Vitals budgets
// Google's "good" and "needs-improvement" upper bounds: a value at or below the
// `GOOD` bound rates "good", at or below the `NEEDS_IMPROVEMENT` bound rates
// "needs-improvement", anything higher rates "poor". Milliseconds unless the
// name has no `_MS` suffix, which marks a unitless score.

/** Largest Contentful Paint budget, in milliseconds: at or below this it rates "good". */
export const LCP_GOOD_THRESHOLD_MS = 2500;
/** Largest Contentful Paint budget, in milliseconds: at or below this it rates "needs-improvement". */
export const LCP_NEEDS_IMPROVEMENT_THRESHOLD_MS = 4000;
/** Cumulative Layout Shift budget, unitless layout-shift score: at or below this it rates "good". */
export const CLS_GOOD_THRESHOLD = 0.1;
/** Cumulative Layout Shift budget, unitless layout-shift score: at or below this it rates "needs-improvement". */
export const CLS_NEEDS_IMPROVEMENT_THRESHOLD = 0.25;
/** First Contentful Paint budget, in milliseconds: at or below this it rates "good". */
export const FCP_GOOD_THRESHOLD_MS = 1800;
/** First Contentful Paint budget, in milliseconds: at or below this it rates "needs-improvement". */
export const FCP_NEEDS_IMPROVEMENT_THRESHOLD_MS = 3000;
/** Time to First Byte budget, in milliseconds: at or below this it rates "good". */
export const TTFB_GOOD_THRESHOLD_MS = 800;
/** Time to First Byte budget, in milliseconds: at or below this it rates "needs-improvement". */
export const TTFB_NEEDS_IMPROVEMENT_THRESHOLD_MS = 1800;

// Performance monitoring (#882) — app-specific metric budgets
// Same `[good, needs-improvement]` shape as the Web Vitals budgets above.

/** Dashboard load budget, in milliseconds: at or below this it rates "good". */
export const DASHBOARD_LOAD_GOOD_THRESHOLD_MS = 1000;
/** Dashboard load budget, in milliseconds: at or below this it rates "needs-improvement". */
export const DASHBOARD_LOAD_NEEDS_IMPROVEMENT_THRESHOLD_MS = 3000;
/** Total upload duration budget, in milliseconds: at or below this it rates "good". */
export const UPLOAD_TOTAL_GOOD_THRESHOLD_MS = 30_000;
/** Total upload duration budget, in milliseconds: at or below this it rates "needs-improvement". */
export const UPLOAD_TOTAL_NEEDS_IMPROVEMENT_THRESHOLD_MS = 120_000;
/** Per-chunk upload duration budget, in milliseconds: at or below this it rates "good". */
export const UPLOAD_CHUNK_GOOD_THRESHOLD_MS = 5_000;
/** Per-chunk upload duration budget, in milliseconds: at or below this it rates "needs-improvement". */
export const UPLOAD_CHUNK_NEEDS_IMPROVEMENT_THRESHOLD_MS = 15_000;
/** CDN purge duration budget, in milliseconds: at or below this it rates "good". */
export const CDN_PURGE_GOOD_THRESHOLD_MS = 500;
/** CDN purge duration budget, in milliseconds: at or below this it rates "needs-improvement". */
export const CDN_PURGE_NEEDS_IMPROVEMENT_THRESHOLD_MS = 2_000;
/** Heap-used ratio (usedJSHeapSize / jsHeapSizeLimit) budget: at or below this it rates "good". */
export const MEMORY_HEAP_USED_RATIO_GOOD_THRESHOLD = 0.7;
/** Heap-used ratio (usedJSHeapSize / jsHeapSizeLimit) budget: at or below this it rates "needs-improvement". */
export const MEMORY_HEAP_USED_RATIO_NEEDS_IMPROVEMENT_THRESHOLD = 0.9;
// Shared by the `render.*` metrics: one 60fps frame budget, then a noticeably
// janky commit.
/** Render commit budget for the `render.*` metrics, in milliseconds: one 60fps frame, at or below which it rates "good". */
export const RENDER_GOOD_THRESHOLD_MS = 16;
/** Render commit budget above which a commit is noticeably janky, in milliseconds. */
export const RENDER_NEEDS_IMPROVEMENT_THRESHOLD_MS = 50;

// Time units

/** Milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000;
/** Milliseconds in one hour. */
export const MS_PER_HOUR = 3_600_000;
/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

// Earnings demo ledger seed (#1106)
// `earningsStore` seeds each user a fixed, reproducible ledger from their id.
// The two generators are plain LCGs whose only difference is their constants,
// so seeded amount and date vary independently but stay stable per user.

/** Rows seeded per user. */
export const EARNINGS_SEED_TRANSACTION_COUNT = 55;
/** Amount generator: multiplier. */
export const EARNINGS_AMOUNT_RNG_MULTIPLIER = 9301;
/** Amount generator: increment. */
export const EARNINGS_AMOUNT_RNG_INCREMENT = 49297;
/** Amount generator: modulus. */
export const EARNINGS_AMOUNT_RNG_MODULUS = 233280;
/** Date generator: multiplier. */
export const EARNINGS_DATE_RNG_MULTIPLIER = 4451;
/** Date generator: increment. */
export const EARNINGS_DATE_RNG_INCREMENT = 12301;
/** Date generator: modulus. */
export const EARNINGS_DATE_RNG_MODULUS = 100003;
/** Every Nth seeded transaction is pending — ~10% pending. */
export const EARNINGS_PENDING_EVERY_NTH_TRANSACTION = 10;
/** Every Nth seeded transaction is failed — ~6% failed. */
export const EARNINGS_FAILED_EVERY_NTH_TRANSACTION = 17;
/** Smallest seeded payout, in USD. */
export const EARNINGS_MIN_AMOUNT_USD = 10;
/** Random range added to the minimum, so amounts span 10-300, in USD. */
export const EARNINGS_AMOUNT_SPREAD_USD = 290;
/** Dates spread over ~13 months, for two full trend periods. */
export const EARNINGS_HISTORY_SPREAD_DAYS = 395;
/** Leading userId chars shown in a seeded tx id. */
export const EARNINGS_TX_ID_USER_PREFIX_LENGTH = 4;
/** Fixed demo rate used to derive a crypto amount, in USD per crypto unit. */
export const EARNINGS_USD_PER_CRYPTO_UNIT = 2000;
/** Random crypto amount added on top of the conversion. */
export const EARNINGS_CRYPTO_AMOUNT_JITTER = 0.05;
/** Decimal places kept on a crypto amount. */
export const EARNINGS_CRYPTO_AMOUNT_DECIMALS = 4;

// Colour & accessibility

/** Largest value of one 8-bit RGB channel. */
export const RGB_CHANNEL_MAX = 255;
/** Characters per channel in a 6-digit hex colour. */
export const HEX_PAIR_LENGTH = 2;
// WCAG relative luminance / sRGB gamma curve (#brand-kit contrast checks).
/** sRGB linearization threshold: below this, the channel is already linear. */
export const SRGB_LINEARIZATION_THRESHOLD = 0.03928;
/** Divisor used in the linear branch of the sRGB curve. */
export const SRGB_LINEAR_SLOPE_DIVISOR = 12.92;
/** Added before the gamma exponent is applied. */
export const SRGB_GAMMA_OFFSET = 0.055;
/** Divides the offset value. */
export const SRGB_GAMMA_SCALE = 1.055;
/** Exponent of the sRGB curve. */
export const SRGB_GAMMA_EXPONENT = 2.4;
/** Red weight in relative luminance. */
export const LUMINANCE_COEFFICIENT_R = 0.2126;
/** Green weight in relative luminance. */
export const LUMINANCE_COEFFICIENT_G = 0.7152;
/** Blue weight in relative luminance. */
export const LUMINANCE_COEFFICIENT_B = 0.0722;
/** Added to both luminances in the contrast ratio. */
export const WCAG_CONTRAST_OFFSET = 0.05;
/** WCAG AA minimum for normal text. */
export const WCAG_AA_MIN_CONTRAST_RATIO = 4.5;

// Audio — voiceover normalization (#1106)

/** Lowest multiplier peak normalization may apply. */
export const NORMALIZATION_GAIN_MIN = 0.5;
/** Highest multiplier (+12 dB) before distortion. */
export const NORMALIZATION_GAIN_MAX = 4.0;
/** Shortest trimmed take the mixer will schedule. */
export const MIN_EFFECTIVE_TRIM_DURATION_S = 0.1;
/**
 * Slack allowed when checking an audio track against the video duration, in
 * seconds. Sample rates and frame rounding mean an exactly-fitting track can
 * come out a fraction long, and rejecting that would fail a valid mix.
 */
export const AUDIO_END_TOLERANCE_S = 0.001;

// Audio — WAV encoding (#1106). Byte offsets and sizes from the RIFF/WAV layout;
// the 16-bit PCM samples follow `WAV_HEADER_SIZE_BYTES`.

/** RIFF + "fmt " + "data" header before samples. */
export const WAV_HEADER_SIZE_BYTES = 44;
/** Byte offset of the "RIFF" chunk size field. */
export const WAV_RIFF_CHUNK_SIZE_OFFSET = 4;
/** RIFF chunk size excludes the first 8 header bytes. */
export const WAV_RIFF_CHUNK_SIZE_BASE_BYTES = 36;
/** Byte offset of the "fmt " chunk size field. */
export const WAV_FMT_CHUNK_SIZE_OFFSET = 16;
/** A PCM "fmt " chunk is 16 bytes. */
export const WAV_FMT_CHUNK_SIZE_BYTES = 16;
/** Byte offset of the audio format code field. */
export const WAV_AUDIO_FORMAT_OFFSET = 20;
/** Byte offset of the channel count field. */
export const WAV_CHANNEL_COUNT_OFFSET = 22;
/** Byte offset of the byte-rate field (sample rate × channels × bytes per sample). */
export const WAV_BYTE_RATE_OFFSET = 28;
/** Byte offset of the block-align field (bytes per sample frame). */
export const WAV_BLOCK_ALIGN_OFFSET = 32;
/** Byte offset of the bit depth field. */
export const WAV_BITS_PER_SAMPLE_OFFSET = 34;
/** Byte offset of the "data" chunk id. */
export const WAV_DATA_CHUNK_OFFSET = 36;
/** Byte offset of the "data" chunk size field. */
export const WAV_DATA_CHUNK_SIZE_OFFSET = 40;
/** Bit depth written into the "fmt " chunk. */
export const PCM_BITS_PER_SAMPLE = 16;
/** Scale applied to negative samples (-1 maps to -32768). */
export const PCM16_NEGATIVE_SCALE = 0x8000;
/** Scale applied to positive samples (1 maps to 32767). */
export const PCM16_POSITIVE_SCALE = 0x7fff;

// Wallet transaction history (#1106)

/** Leading chars kept when shortening a wallet address. */
export const ADDRESS_PREFIX_LENGTH = 6;
/** Trailing chars kept when shortening a wallet address. */
export const ADDRESS_SUFFIX_LENGTH = 4;
/** Shorter addresses (6 + 4) are masked entirely. */
export const MIN_ADDRESS_LENGTH_FOR_PARTIAL = 10;
/** Wei in one ETH. */
export const WEI_PER_ETH = 1e18;
/** Below this, ETH amounts show 8 decimals instead of 5. */
export const SMALL_ETH_AMOUNT_THRESHOLD = 0.001;
/** At or above this a block count is settled and hidden. */
export const CONFIRMATIONS_DISPLAY_LIMIT = 10;
/** Lamports in one SOL. */
export const LAMPORTS_PER_SOL = 1e9;
/** Decimal places SOL amounts are rounded to. */
export const SOL_DECIMALS = 9;

// Layout shift debugging (#873)

/** Decimal places used when logging a CLS value. */
export const CLS_LOG_PRECISION = 4;
/** How long the dev-only shift highlight stays on, in milliseconds. */
export const LAYOUT_SHIFT_DEBUG_HIGHLIGHT_MS = 2000;

// Video export / transcode targets (#1106)

/** Rows in a 720p frame. */
export const RESOLUTION_720P_HEIGHT = 720;
/** Columns in a 1080p frame. */
export const RESOLUTION_1080P_WIDTH = 1920;
/** Rows in a 1080p frame. */
export const RESOLUTION_1080P_HEIGHT = 1080;
/** Export bitrate for 720p, also the floor for scaled exports, in kbps. */
export const BITRATE_720P_KBPS = 5_000;
/** Export bitrate for 1080p, the reference for a full-HD frame, in kbps. */
export const BITRATE_1080P_KBPS = 8_000;
