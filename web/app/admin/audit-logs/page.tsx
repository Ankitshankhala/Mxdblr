"use client";

/**
 * Admin audit-log viewer (route: /admin/audit-logs). Read-only feed of recent
 * role/permission/user changes from GET /api/admin/audit-logs. Wrapped in
 * AdminGuard; needs MANAGE_ROLES or MANAGE_ADMINS.
 */
import { useEffect, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";
import { adminFetch } from "@/lib/admin/auth";

interface AuditLog {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  details: Record<string, unknown>;
  createdAt: string;
}

const ACTION_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ROLE_CREATED: { label: "Role created", color: "#059669", bg: "#D1FAE5" },
  ROLE_UPDATED: { label: "Role updated", color: "#2563EB", bg: "#DBEAFE" },
  ROLE_PERMISSIONS_UPDATED: { label: "Permissions updated", color: "#2563EB", bg: "#DBEAFE" },
  ROLE_DELETED: { label: "Role deleted", color: "#DC2626", bg: "#FCE7E7" },
  USER_CREATED: { label: "User created", color: "#059669", bg: "#D1FAE5" },
  USER_ROLE_CHANGED: { label: "Role changed", color: "#2563EB", bg: "#DBEAFE" },
  USER_ACTIVATED: { label: "User activated", color: "#059669", bg: "#D1FAE5" },
  USER_DEACTIVATED: { label: "User deactivated", color: "#B45309", bg: "#FEF3C7" },
  USER_DELETED: { label: "User deleted", color: "#DC2626", bg: "#FCE7E7" },
  DEALER_PRICING_CHANGED: { label: "Dealer prices changed", color: "#B8560F", bg: "#FFF3E8" },
  DEALER_LOGIN_CODE_ISSUED: { label: "Login code issued", color: "#6366F1", bg: "#EEF0FE" },
};

/** "9 Oct, 4:56 pm" in the viewer's time zone, like the When column. */
function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** One detail value as words: dates formatted, yes/no, list counts. Never raw JSON. */
function detailValue(value: unknown): string {
  if (typeof value === "string") return ISO_DATE.test(value) ? shortDateTime(value) : value;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return value == null ? "—" : "updated";
}

/** "expiresAt" -> "expires at", "newDealer" -> "new dealer". */
function detailKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

/** The Details column as readable text, e.g. "Login code · expires 9 Oct, 4:56 pm · new dealer". */
function summarizeDetails(action: string, details: Record<string, unknown>): string {
  const d = details ?? {};
  if (Object.keys(d).length === 0) return "—";

  if (action === "DEALER_LOGIN_CODE_ISSUED") {
    const parts = ["Login code"];
    if (typeof d.expiresAt === "string") parts.push(`expires ${shortDateTime(d.expiresAt)}`);
    if (d.newDealer === true) parts.push("new dealer");
    return parts.join(" · ");
  }
  if (action === "DEALER_PRICING_CHANGED" && typeof d.priceTier === "string") {
    const now = `Price ${d.priceTier} · ${d.showPrices ? "shown" : "hidden"}`;
    return typeof d.previous === "string" ? `${now} (was ${d.previous})` : now;
  }

  const parts: string[] = [];
  const known = new Set(["permissions", "roleName", "roleId", "name", "active", "description", "rank"]);
  if (Array.isArray(d.permissions)) parts.push(`${d.permissions.length} permission${d.permissions.length === 1 ? "" : "s"}`);
  if (typeof d.roleName === "string") parts.push(`role: ${d.roleName}`);
  if (typeof d.name === "string") parts.push(`name: ${d.name}`);
  if (typeof d.active === "boolean") parts.push(d.active ? "activated" : "deactivated");
  if (typeof d.description === "string") parts.push("description updated");
  // Anything else (future actions) still reads as words rather than raw JSON.
  for (const [key, value] of Object.entries(d)) {
    if (!known.has(key)) parts.push(`${detailKey(key)}: ${detailValue(value)}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

function AuditLogsContent() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch("/admin/audit-logs?limit=200");
        const d = await res.json();
        if (!res.ok) throw new Error(d.message || "Failed");
        setLogs(d.data || []);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to load audit log", "error");
      } finally {
        setLoading(false);
      }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6E6257", marginBottom: 20, maxWidth: 620 }}>
        A record of every role, permission and staff-account change, plus dealer login codes and price-list changes: who did what, and when. Most recent first.
      </p>

      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                {["When", "Actor", "Action", "Target", "Details"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E6257", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>Loading…</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>No audit entries yet.</td></tr>}
              {!loading && logs.map((log) => {
                const style = ACTION_STYLE[log.action] ?? { label: log.action, color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "12px 16px", color: "#6E6257", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{log.actorName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: style.bg, color: style.color, whiteSpace: "nowrap" }}>
                        {style.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: "#1F1813" }}>{log.targetName || "—"}</span>
                      <span style={{ color: "#A8A39A", fontSize: 11, marginLeft: 6 }}>{log.targetType}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6E6257", fontSize: 12, minWidth: 220 }}>{summarizeDetails(log.action, log.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", fontSize: 12, color: "#6E6257" }}>
          Showing {logs.length} most recent {logs.length === 1 ? "entry" : "entries"}
        </div>
      </div>
    </div>
  );
}

export default AdminGuard(AuditLogsContent);
