"use client";

import { BarChart3, Check, Clock,Copy, Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react";
import React, { useEffect,useState } from "react";

import { logger } from "@/app/lib/logger";
import { useToast } from "@/hooks/useToast";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
  _count: {
    usages: number;
  };
}

interface ApiUsage {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  "clips:read",
  "clips:write",
  "clips:delete",
  "webhooks:read",
  "webhooks:write",
  "analytics:read",
  "*",
];

export default function ApiSettings() {
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [usages, setUsages] = useState<ApiUsage[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    scopes: [] as string[],
    expiresAt: "",
  });

  useEffect(() => {
    fetchApiKeys();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      fetchUsages(selectedKey.id);
    }
  }, [selectedKey]);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/keys");
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      logger.error("Error fetching API keys:", error);
      showToast("Failed to load API keys", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsages = async (keyId: string) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`);
      const data = await response.json();
      setUsages(data.apiKey?.usages || []);
    } catch (error) {
      logger.error("Error fetching usage:", error);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to create API key");

      showToast("API key created successfully", "success");
      setShowCreateModal(false);
      setFormData({ name: "", scopes: [], expiresAt: "" });
      fetchApiKeys();
    } catch (error) {
      logger.error("Error creating API key:", error);
      showToast("Failed to create API key", "error");
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone."))
      return;

    try {
      await fetch(`/api/keys/${id}`, { method: "DELETE" });
      showToast("API key deleted successfully", "success");
      if (selectedKey?.id === id) {
        setSelectedKey(null);
        setUsages([]);
      }
      fetchApiKeys();
    } catch (error) {
      logger.error("Error deleting API key:", error);
      showToast("Failed to delete API key", "error");
    }
  };

  const handleToggleKey = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      fetchApiKeys();
    } catch (error) {
      logger.error("Error toggling API key:", error);
      showToast("Failed to update API key", "error");
    }
  };

  const toggleScope = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    showToast("API key copied to clipboard", "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskKey = (key: string) => {
    if (showKey === key) return key;
    return `${key.slice(0, 7)}${"•".repeat(20)}${key.slice(-4)}`;
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
        <h2 className="text-lg font-extrabold text-white">API Keys</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all"
        >
          <Plus className="w-4 h-4" />
          Generate API Key
        </button>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No API keys configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Generate API keys to access ClipCash programmatically
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedKey?.id === apiKey.id
                    ? "bg-brand/10 border-brand/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
                onClick={() => setSelectedKey(apiKey)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{apiKey.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          apiKey.active
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {apiKey.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-xs font-mono text-muted-foreground">
                        {maskKey(apiKey.key)}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowKey(showKey === apiKey.key ? null : apiKey.key);
                        }}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {showKey === apiKey.key ? (
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyKey(apiKey.key);
                        }}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {copiedKey === apiKey.key ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {apiKey._count.usages} uses
                      </span>
                      {apiKey.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used {new Date(apiKey.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleKey(apiKey.id, apiKey.active);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {apiKey.active ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Key className="w-4 h-4 text-red-400" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKey(apiKey.id);
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

      {selectedKey && (
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Usage Dashboard</h3>
          {usages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage data yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {usages.map((usage) => (
                <div key={usage.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">
                      {usage.method} {usage.endpoint}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(usage.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span
                      className={
                        usage.statusCode >= 200 && usage.statusCode < 300
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      Status: {usage.statusCode}
                    </span>
                    <span>Response time: {usage.responseTime}ms</span>
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
            <h3 className="font-bold text-white text-lg mb-4">Generate API Key</h3>
            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-brand/50 focus:outline-none"
                  placeholder="Production API key"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2">Scopes</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20"
                    >
                      <input
                        type="checkbox"
                        checked={formData.scopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="rounded border-white/20 bg-white/10 text-brand focus:ring-brand"
                      />
                      <span className="text-xs text-white">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2">
                  Expiration (optional)
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-brand/50 focus:outline-none"
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
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
