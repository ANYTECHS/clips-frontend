import { DICEBEAR_ORIGIN } from "@/app/lib/resourceHints";

/**
 * Document-level hints for the landing critical path.
 * Dicebear preconnect avoids connection setup before the first hero avatar fetch.
 */
export default function ResourceHints() {
  return (
    <link rel="preconnect" href={DICEBEAR_ORIGIN} crossOrigin="anonymous" />
  );
}
