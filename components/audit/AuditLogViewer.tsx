"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  X,
} from "lucide-react";

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorId: string;
  actorType: "user" | "api_key" | "system" | "admin";
  action: string;
  resource: string;
  resourceId?: string | null;
  status: "success" | "failure";
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  previousHash?: string | null;
  eventHash: string;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & pagination
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Integrity verification
  const [verifying, setVerifying] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<{
    verified?: boolean;
    totalChecked?: number;
    error?: string;
  } | null>(null);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });

      if (actionFilter) params.append("action", actionFilter);
      if (resourceFilter) params.append("resource", resourceFilter);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }

      const json = await res.json();
      setLogs(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, statusFilter]);

  const verifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/audit-logs/verify");
      const data = await res.json();
      setIntegrityStatus(data);
    } catch (err: any) {
      setIntegrityStatus({ verified: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Audit Trail</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Tamper-evident, cryptographically chained records of security actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={verifyIntegrity}
            disabled={verifying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            title="Verify cryptographic hash chain integrity"
          >
            {verifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : integrityStatus?.verified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            ) : integrityStatus?.verified === false ? (
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>
              {verifying
                ? "Verifying Chain..."
                : integrityStatus?.verified
                ? `Chain Verified (${integrityStatus.totalChecked})`
                : integrityStatus?.verified === false
                ? "Chain Tampered!"
                : "Verify Hash Chain"}
            </span>
          </button>

          <button
            onClick={() => fetchLogs()}
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-xl border border-border transition-colors"
            title="Refresh logs"
            aria-label="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface p-4 rounded-xl border border-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-foreground-muted" />
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface-subtle border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-3 text-foreground-muted" />
          <input
            type="text"
            placeholder="Filter by resource..."
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface-subtle border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface-subtle border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        <div className="flex items-center justify-end text-xs text-foreground-muted pr-2">
          Total: {totalCount} events
        </div>
      </div>

      {/* Table view */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-foreground-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            Loading audit records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No audit records found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle text-foreground-muted uppercase text-[11px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-foreground-muted">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        {log.actorType === "api_key" ? (
                          <Key className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-sky-500" />
                        )}
                        <span className="font-mono">{log.actorId.slice(0, 10)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground-muted">
                      <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">
                        {log.resource}
                        {log.resourceId ? `:${log.resourceId.slice(0, 8)}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Failure
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
                        title="View event payload and integrity hash"
                        aria-label="View event payload"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-surface-subtle/50 text-xs">
            <span className="text-foreground-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border bg-surface text-foreground disabled:opacity-40 hover:bg-surface-hover"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-surface text-foreground disabled:opacity-40 hover:bg-surface-hover"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Audit Event Details</h3>
                <p className="text-xs text-foreground-muted font-mono">{selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-foreground-muted hover:text-foreground"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-foreground-muted">Timestamp:</span>
                  <p className="font-medium text-foreground">{new Date(selectedLog.timestamp).toISOString()}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Action:</span>
                  <p className="font-mono font-medium text-primary">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Actor:</span>
                  <p className="font-mono text-foreground">
                    {selectedLog.actorType}: {selectedLog.actorId}
                  </p>
                </div>
                <div>
                  <span className="text-foreground-muted">Resource:</span>
                  <p className="font-mono text-foreground">
                    {selectedLog.resource} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ""}
                  </p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <span className="text-foreground-muted">IP Address:</span>
                    <p className="font-mono text-foreground">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {/* Cryptographic hash proof */}
              <div className="p-3 bg-surface-subtle rounded-xl border border-border space-y-1.5 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Tamper-Evident Hash Proof
                </span>
                <div>
                  <span className="text-foreground-muted">Event Hash:</span>
                  <p className="font-mono text-[11px] text-foreground break-all">{selectedLog.eventHash}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Previous Chained Hash:</span>
                  <p className="font-mono text-[11px] text-foreground-muted break-all">
                    {selectedLog.previousHash || "Genesis"}
                  </p>
                </div>
              </div>

              {/* Sanitized Metadata */}
              <div>
                <span className="font-semibold text-foreground text-xs block mb-1">Sanitized Event Metadata:</span>
                <pre className="p-3 bg-surface-subtle border border-border rounded-xl text-xs font-mono overflow-x-auto text-foreground">
                  {selectedLog.metadata ? JSON.stringify(selectedLog.metadata, null, 2) : "No metadata recorded."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
