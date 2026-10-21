/**
 * Service Worker for Push Notifications, Caching, and Offline Support
 * 
 * Features:
 * - Push notifications (original functionality)
 * - Cache-first strategy for static assets
 * - Network-first strategy for API responses
 * - Stale-while-revalidate for performance
 * - Offline fallback for critical pages
 * 
 * Cache buckets:
 * - static-v1: Static assets (CSS, JS, fonts)
 * - api-v1: API responses with TTL
 * - pages-v1: HTML pages for offline access
 * 
 * See: https://web.dev/articles/service-worker-caching-strategies
 */

const STATIC_CACHE = "static-v1";
const API_CACHE = "api-v1";
const PAGES_CACHE = "pages-v1";
const CACHE_VERSION = 1;
const CACHES_TO_CLEAN = ["static-v0", "api-v0", "pages-v0"];

// Static assets that should be cached on install
const OFFLINE_URL = "/offline.html";
const SYNC_QUEUE = "sync-queue-v1";
const SYNC_TAG = "replay-api-requests";

const CRITICAL_ASSETS = [
  "/",
  OFFLINE_URL,
  "/favicon.ico",
];

// API endpoints with cache strategies
const CACHE_FIRST_ENDPOINTS = [
  "/api/prices/",
  "/api/config/",
];

const NETWORK_FIRST_ENDPOINTS = [
  "/api/projects",
  "/api/clips",
  "/api/user",
];

const STALE_WHILE_REVALIDATE_ENDPOINTS = [
  "/api/analytics/",
];

/**
 * Install event: Cache critical assets
 */
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("Caching critical assets");
      return cache.addAll(CRITICAL_ASSETS).catch((error) => {
        console.warn("Failed to cache some assets:", error);
        // Don't fail install if optional assets are unavailable
      });
    })
  );

  self.skipWaiting();
});

/**
 * Activate event: Clean up old cache versions
 */
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (CACHES_TO_CLEAN.includes(cacheName)) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  event.waitUntil(self.clients.claim());
});

/**
 * Fetch event: Implement caching strategies
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Queue failed same-origin API writes for background sync replay
  if (request.method !== "GET") {
    if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
      event.respondWith(fetchOrQueue(request));
    }
    return;
  }

  // Skip external/cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Apply caching strategy based on URL
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isCacheFirstEndpoint(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isNetworkFirstEndpoint(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaleWhileRevalidateEndpoint(url.pathname)) {
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else {
    event.respondWith(networkWithFallbackStrategy(request));
  }
});

/**
 * Handle push notifications (original functionality)
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "Your clips are ready!",
      icon: "/avatar.png",
      badge: "/avatar.png",
      tag: data.tag || "processing-complete",
      data: {
        url: data.url || "/projects",
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "ClipCash", options)
    );
  } catch (error) {
    console.error("Failed to handle push notification:", error);
  }
});

/**
 * Handle notification clicks
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/projects";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

/**
 * Caching strategy implementations
 */

/**
 * Cache-first: Return from cache, fallback to network
 * Used for: Static assets, config
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cloned = response.clone();
      cache.put(request, cloned);
    }

    return response;
  } catch (error) {
    console.error("Fetch failed:", error);
    return new Response("Offline - Resource not available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Network-first: Try network, fallback to cache
 * Used for: Dynamic API data, user-specific content
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cloned = response.clone();
      cache.put(request, cloned);
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(
      JSON.stringify({
        error: "Network request failed and no cache available",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Stale-while-revalidate: Return cached immediately, update in background
 * Used for: Analytics, non-critical data
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cloned = response.clone();
      cache.put(request, cloned);
    }
    return response;
  });

  return cached || fetchPromise;
}

/**
 * Network with fallback: Try network, use cache or offline fallback
 */
async function networkWithFallbackStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Try cache
    const cache = await caches.open(PAGES_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Offline fallback for HTML pages
    if (request.headers.get("accept")?.includes("text/html")) {
      const offlinePageCache = await caches.open(PAGES_CACHE);
      const offlinePage =
        (await caches.match(OFFLINE_URL)) || (await offlinePageCache.match("/"));
      if (offlinePage) {
        return offlinePage;
      }
    }

    return new Response("Offline - Resource not available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Helper functions to determine cache strategy
 */

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2?|ttf|otf|eot|svg|ico|png|jpg|jpeg|gif|webp|avif)$/.test(
      pathname
    )
  );
}

function isCacheFirstEndpoint(pathname) {
  return CACHE_FIRST_ENDPOINTS.some((endpoint) =>
    pathname.includes(endpoint)
  );
}

function isNetworkFirstEndpoint(pathname) {
  return NETWORK_FIRST_ENDPOINTS.some((endpoint) =>
    pathname.includes(endpoint)
  );
}

function isStaleWhileRevalidateEndpoint(pathname) {
  return STALE_WHILE_REVALIDATE_ENDPOINTS.some((endpoint) =>
    pathname.includes(endpoint)
  );
}

/**
 * Background sync: failed API writes are stored in SYNC_QUEUE and replayed
 * when connectivity returns (`sync` event, or on next activation where the
 * Background Sync API is unsupported).
 */
async function fetchOrQueue(request) {
  try {
    return await fetch(request.clone());
  } catch (error) {
    const body = await request.clone().text();
    const cache = await caches.open(SYNC_QUEUE);
    const key = `/__sync__/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await cache.put(
      key,
      new Response(
        JSON.stringify({
          url: request.url,
          method: request.method,
          headers: [...request.headers],
          body,
        })
      )
    );
    if (self.registration.sync) {
      await self.registration.sync.register(SYNC_TAG).catch(() => {});
    }
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function replayQueuedRequests() {
  const cache = await caches.open(SYNC_QUEUE);
  for (const key of await cache.keys()) {
    const entry = await (await cache.match(key)).json();
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined,
        credentials: "same-origin",
      });
      await cache.delete(key);
    } catch {
      // Still offline — rethrow so the browser retries the sync later
      throw new Error("Replay failed; will retry");
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedRequests());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "REPLAY_QUEUE") {
    event.waitUntil(replayQueuedRequests().catch(() => {}));
  }
});
