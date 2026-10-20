"use client";

import { useEffect, useState } from "react";
import type { NotificationChannel, NotificationPreferences } from "@/app/lib/notificationDelivery";
import type { NotificationType } from "@/app/api/notifications/notificationStore";
import { subscribeToPushNotifications } from "@/app/lib/browserNotifications";

const TYPES: { id: NotificationType; label: string }[] = [
  { id: "job_complete", label: "Video processing complete" },
  { id: "transform_complete", label: "Clip transformation complete" },
  { id: "mint_success", label: "NFT mint complete" },
  { id: "earnings_received", label: "Earnings received" },
];
const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: "inApp", label: "In-app" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
];

const DEFAULTS: NotificationPreferences = Object.fromEntries(
  TYPES.map(({ id }) => [id, { inApp: true, email: false, push: false }]),
) as NotificationPreferences;

export function NotificationChannelSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load notification preferences");
        const result = await response.json();
        if (active) setPreferences(result.data as NotificationPreferences);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load preferences");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function updatePreference(type: NotificationType, channel: NotificationChannel, enabled: boolean) {
    const key = `${type}:${channel}`;
    const next = {
      ...preferences,
      [type]: { ...preferences[type], [channel]: enabled },
    };
    setSaving(key);
    setError(null);
    try {
      if (channel === "push" && enabled && !(await subscribeToPushNotifications())) {
        throw new Error("Allow browser notifications to enable push delivery");
      }
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: next }),
      });
      if (!response.ok) throw new Error("Could not save notification preferences");
      const result = await response.json();
      setPreferences(result.data as NotificationPreferences);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save preferences");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="notification-channel-settings-title">
      <div>
        <h2 id="notification-channel-settings-title" className="text-lg font-extrabold text-white">
          Notification Delivery
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose where each update is delivered.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-surface">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-semibold">Notification</th>
              {CHANNELS.map((channel) => (
                <th key={channel.id} scope="col" className="px-3 py-3 text-center font-semibold">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((type) => (
              <tr key={type.id} className="border-b border-white/5 last:border-0">
                <th scope="row" className="px-5 py-4 text-left font-medium text-white">
                  {type.label}
                </th>
                {CHANNELS.map((channel) => {
                  const checked = preferences[type.id]?.[channel.id] ?? false;
                  const busy = saving === `${type.id}:${channel.id}`;
                  return (
                    <td key={channel.id} className="px-3 py-4 text-center">
                      <input
                        aria-label={`${channel.label} for ${type.label}`}
                        type="checkbox"
                        checked={checked}
                        disabled={loading || saving !== null || (channel.id === "inApp" && checked)}
                        onChange={(event) => void updatePreference(type.id, channel.id, event.target.checked)}
                        className="h-4 w-4 accent-brand disabled:opacity-50"
                      />
                      {busy && <span className="sr-only">Saving</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
