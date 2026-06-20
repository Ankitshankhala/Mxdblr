"use client";

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
};

function summarizeDetails(details: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const parts: string[] = [];
  if (Array.isArray(details.permissions)) parts.push(`${(details.permissions as unknown[]).length} permission(s)`);
  if (typeof details.roleName === "string") parts.push(`role: ${details.roleName}`);
  if (typeof details.name === "string") parts.push(`name: ${details.name}`);
  if (typeof details.active === "boolean") parts.push(`active: ${details.active}`);
  if (typeof details.description === "string" && !parts.length) parts.push("description updated");
  return parts.length ? parts.join(" · ") : JSON.stringify(details);
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
      <p style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20, maxWidth: 620 }}>
        A record of every role, permission, and staff-account change — who did what, and when. Most recent first.
      </p>

      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                {["When", "Actor", "Action", "Target", "Details"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading…</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>No audit entries yet.</td></tr>}
              {!loading && logs.map((log) => {
                const style = ACTION_STYLE[log.action] ?? { label: log.action, color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "12px 16px", color: "#6B6B7D", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{log.actorName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: style.bg, color: style.color, whiteSpace: "nowrap" }}>
                        {style.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: "#1A1A2E" }}>{log.targetName || "—"}</span>
                      <span style={{ color: "#A8A39A", fontSize: 11, marginLeft: 6 }}>{log.targetType}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6B6B7D", fontSize: 12 }}>{summarizeDetails(log.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", fontSize: 12, color: "#6B6B7D" }}>
          Showing {logs.length} most recent {logs.length === 1 ? "entry" : "entries"}
        </div>
      </div>
    </div>
  );
}

export default AdminGuard(AuditLogsContent);
