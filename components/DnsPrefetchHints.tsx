import { DNS_PREFETCH_ORIGINS } from "@/app/lib/dnsPrefetchOrigins";

/**
 * Document-level DNS-prefetch hints (#918).
 * Resolves external hostnames before the browser opens connections.
 */
export default function DnsPrefetchHints() {
  return (
    <>
      {DNS_PREFETCH_ORIGINS.map((href) => (
        <link key={href} rel="dns-prefetch" href={href} />
      ))}
    </>
  );
}
