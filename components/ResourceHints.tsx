import { getCriticalResourceHints } from "@/app/lib/resourcePriority";

/**
 * Document-level resource hints ordered by loading priority.
 * Critical assets get the earliest network and rendering attention; the rest of
 * the page can still load later without blocking the first paint.
 */
export default function ResourceHints() {
  return (
    <>
      {getCriticalResourceHints().map((hint) => (
        <link
          key={`${hint.rel}:${hint.href}`}
          rel={hint.rel}
          href={hint.href}
          as={hint.as}
          crossOrigin={hint.crossOrigin}
          fetchPriority={hint.fetchPriority}
        />
      ))}
    </>
  );
}
