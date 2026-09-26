# Notification Flow

ClipCash requests browser notifications from Settings so users can receive an alert when clip rendering finishes.

## Permission states

- `default`: the browser can still show a permission prompt.
- `granted`: browser notifications can be sent, unless the app preference is disabled.
- `denied`: the browser will not show another prompt until the user changes site settings.

`app/lib/notifications.ts` keeps localStorage synchronized with the browser permission and listens for permission changes through the Permissions API, window focus, and visibility changes.

## Denied permissions

When permission is denied, the Settings page keeps the notification control visible and explains how to enable notifications again. Chrome, Edge, and Firefox receive direct settings links where supported. Safari users receive manual instructions because Safari does not expose a stable notification-settings URL.

## Sending notifications

Call `requestNotificationPermission()` before enabling notifications and `canSendNotification()` before constructing a `Notification`. `sendNotification()` returns `null` when notifications are unsupported, disabled, or denied.
