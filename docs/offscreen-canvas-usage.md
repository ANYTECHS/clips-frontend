# OffscreenCanvas usage

Guidance for moving canvas rendering off the main thread with
`OffscreenCanvas`.

## Where it's used

`app/lib/imageUtils.ts` generates gradient blur placeholders for images.
The original `generateBlurPlaceholder`/`getBlurPlaceholder` draw onto a
`<canvas>` element and encode with `toDataURL` synchronously on the main
thread — fine for one thumbnail, but every extra placeholder (e.g. a unique
gradient per clip in a grid, instead of one shared static placeholder) adds
more main-thread drawing and JPEG-encoding work.

`generateBlurPlaceholderAsync`/`getBlurPlaceholderAsync` do the same
drawing and encoding inside `app/workers/blurPlaceholder.worker.ts`, using
`new OffscreenCanvas(width, height)` and `canvas.convertToBlob(...)` — none
of it runs on the main thread.

```ts
import { getBlurPlaceholderAsync } from "@/app/lib/imageUtils";

const placeholder = await getBlurPlaceholderAsync(thumbnailUrl);
```

## Fallback

`generateBlurPlaceholderAsync` checks for `Worker` and `OffscreenCanvas`
support before using them:

```ts
function supportsOffscreenCanvas(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}
```

When either is missing (older Safari, SSR, jsdom in tests) it falls back to
the original synchronous `generateBlurPlaceholder`, which runs on the main
thread but works everywhere `<canvas>` does. Callers always get a resolved
placeholder either way — the fallback is transparent.

## Adding a new OffscreenCanvas worker

Follow the pattern in `app/workers/blurPlaceholder.worker.ts` /
`app/workers/clipRanking.worker.ts`:

1. Define a typed `Request`/`Response` message shape.
2. In the worker, do the heavy work (canvas drawing, scoring, etc.) and
   `postMessage` the result back.
3. In the caller, feature-detect before constructing the worker, keep a
   `Map<requestId, resolve>` for in-flight requests, and fall back to an
   equivalent synchronous (or main-thread) implementation when the API
   isn't available.
