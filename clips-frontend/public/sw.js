/**
 * Service Worker for Push Notifications
 * Handles background notifications when the tab is closed
 */

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(self.clients.claim());
});

/**
 * Handle push notifications from the server
 * This would be triggered by a backend service when processing completes
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

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

  event.waitUntil(self.registration.showNotification(data.title || "ClipCash", options));
});

/**
 * Handle notification click - navigate to the appropriate page
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
