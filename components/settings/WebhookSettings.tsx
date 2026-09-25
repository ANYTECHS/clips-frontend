"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  description?: string;
  active: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  eventType: string;
  statusCode?: number;
  response?: string;
  attempt: number;
  success: boolean;
  deliveredAt?: string;
  nextRetryAt?: string;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  "clip.created",
  "clip.processed",
  "clip.published",
  "clip.minted",
  "payment.received",
  "user.created",
  "subscription.updated",
];

export default function WebhookSettings() {
  const { showToast } = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
    secret: "",
    description: "",
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (selectedWebhook) {
      fetchDeliveries(selectedWebhook.id);
    }
  }, [selectedWebhook]);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch("/api/webhooks");
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      showToast("Failed to load webhooks", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      const data = await response.json();
      setDeliveries(data.deliveries || []);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to create webhook");

      showToast("Webhook created successfully", "success");
      setShowCreateModal(false);
      setFormData({ url: "", events: [], secret: "", description: "" });
      fetchWebhooks();
    } catch (error) {
      console.error("Error creating webhook:", error);
      showToast("Failed to create webhook", "error");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      showToast("Webhook deleted successfully", "success");
      if (selectedWebhook?.id === id) {
        setSelectedWebhook(null);
        setDeliveries([]);
      }
      fetchWebhooks();
    } catch (error) {
      console.error("Error deleting webhook:", error);
      showToast("Failed to delete webhook", "error");
    }
  };

  const handleToggleWebhook = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      fetchWebhooks();
    } catch (error) {
      console.error("Error toggling webhook:", error);
      showToast("Failed to update webhook", "error");
    }
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const generateSecret = () => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setFormData((prev) => ({ ...prev, secret }));
  };

  const getDeliveryStatusIcon = (delivery: WebhookDelivery) => {
    if (delivery.success) return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (delivery.nextRetryAt) return <Clock className="w-4 h-4 text-yellow-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  if (loading) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-white/10 rounded" />
          <div className="h-20 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-white">Webhooks</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        {webhooks.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No webhooks configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add webhooks to receive real-time notifications for events
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedWebhook?.id === webhook.id
                    ? "bg-brand/10 border-brand/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
                onClick={() => setSelectedWebhook(webhook)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white truncate">{webhook.url}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          webhook.active
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {webhook.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {webhook.description && (
                      <p className="text-xs text-muted-foreground truncate">{webhook.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.slice(0, 3).map((event) => (
                        <span
                          key={event}
                          className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-muted-foreground"
                        >
                          {event}
                        </span>
                      ))}
                      {webhook.events.length > 3 && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-muted-foreground">
                          +{webhook.events.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWebhook(webhook.id, webhook.active);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {webhook.active ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWebhook(webhook.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedWebhook && (
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Delivery Logs</h3>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivery logs yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getDeliveryStatusIcon(delivery)}
                      <span className="text-xs font-bold text-white">{delivery.eventType}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>Attempt {delivery.attempt}</span>
                    {delivery.statusCode && <span>Status: {delivery.statusCode}</span>}
                    {delivery.nextRetryAt && (
                      <span>Retry: {new Date(delivery.nextRetryAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white text-lg mb-4">Create Webhook</h3>
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white mb-2">URL</label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-brand/50 focus:outline-none"
                  placeholder="https://your-server.com/webhook"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2">Events</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20"
                    >
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-white/20 bg-white/10 text-brand focus:ring-brand"
                      />
                      <span className="text-xs text-white">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2">Secret</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={16}
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-brand/50 focus:outline-none font-mono"
                    placeholder="Webhook signing secret"
                  />
                  <button
                    type="button"
                    onClick={generateSecret}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs hover:bg-white/10"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-brand/50 focus:outline-none"
                  placeholder="Production webhook for clip events"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover"
                >
                  Create Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}