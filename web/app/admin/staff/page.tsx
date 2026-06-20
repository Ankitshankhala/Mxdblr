"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";
import { adminFetch, useAdminAuth } from "@/lib/admin/auth";

interface RoleLite {
  id: string;
  name: string;
  rank: number;
}

interface StaffUser {
  id: string;
  username: string;
  active: boolean;
  role: RoleLite | null;
  createdAt: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE",
  fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5,
};

function StaffContent() {
  const { showToast } = useToast();
  const { me } = useAdminAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<StaffUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const myRank = me?.role?.rank ?? 9999;
  // Roles the current user is allowed to assign (strictly less privileged than self).
  const assignableRoles = useMemo(() => roles.filter((r) => r.rank > myRank), [roles, myRank]);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        adminFetch("/admin/users"),
        adminFetch("/admin/roles"),
      ]);
      const usersJson = await usersRes.json();
      const rolesJson = await rolesRes.json();
      setUsers(usersJson.data || []);
      setRoles((rolesJson.data || []).map((r: RoleLite) => ({ id: r.id, name: r.name, rank: r.rank })));
    } catch {
      showToast("Failed to load staff", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Can the current user manage this target user? (not self, and target strictly below me)
  function canManage(u: StaffUser): boolean {
    if (u.id === me?.id) return false;
    const targetRank = u.role?.rank ?? 9999;
    return targetRank > myRank;
  }

  async function changeRole(u: StaffUser, roleId: string) {
    if (roleId === u.role?.id) return;
    setBusyId(u.id);
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ roleId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed");
      showToast(`${u.username}'s role updated`);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update role", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(u: StaffUser) {
    setBusyId(u.id);
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed");
      showToast(`${u.username} ${u.active ? "deactivated" : "activated"}`);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update status", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(u: StaffUser) {
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed");
      showToast(`${u.username} deleted`);
      setDeleteConfirm(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete user", "error");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
        <p style={{ fontSize: 13, color: "#6B6B7D", maxWidth: 620 }}>
          Invite staff and assign them a role. Permissions are applied automatically from the assigned role.
          You can only manage users at a lower privilege level than your own.
        </p>
        {assignableRoles.length > 0 && (
          <button onClick={() => setShowCreate(true)} className="btn-orange"
            style={{ padding: "0 16px", height: 36, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
            + Add Staff
          </button>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                {["Username", "Role", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading…</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>No staff accounts yet.</td></tr>}
              {!loading && users.map((u) => {
                const manageable = canManage(u);
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                      {u.username}{isSelf && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#6B6B7D" }}>(you)</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {manageable ? (
                        <select
                          value={u.role?.id ?? ""}
                          disabled={busyId === u.id}
                          onChange={(e) => changeRole(u, e.target.value)}
                          style={{ ...inputStyle, width: "auto", padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
                        >
                          {/* current role first (may be above assignable list) */}
                          {u.role && !assignableRoles.some((r) => r.id === u.role!.id) && (
                            <option value={u.role.id}>{u.role.name}</option>
                          )}
                          {assignableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", background: "#F0EDEA", padding: "3px 10px", borderRadius: 999 }}>
                          {u.role?.name ?? "—"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: u.active ? "#D1FAE5" : "#F3F4F6", color: u.active ? "#059669" : "#6B7280" }}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6B6B7D", whiteSpace: "nowrap" }}>
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {manageable ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => toggleActive(u)} disabled={busyId === u.id}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}>
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => setDeleteConfirm(u)}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#A8A39A" }}>{isSelf ? "—" : "No access"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", fontSize: 12, color: "#6B6B7D" }}>
          {users.length} user{users.length !== 1 ? "s" : ""} total
        </div>
      </div>

      {showCreate && (
        <CreateStaffModal
          roles={assignableRoles}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
          showToast={showToast}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete &ldquo;{deleteConfirm.username}&rdquo;?</div>
            <p style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20 }}>This permanently removes the account. Consider deactivating instead if you may need it later.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateStaffModal({
  roles, onClose, onCreated, showToast,
}: {
  roles: RoleLite[];
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (username.trim().length < 3) { showToast("Username must be at least 3 characters", "error"); return; }
    if (password.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
    if (!roleId) { showToast("Select a role", "error"); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password, roleId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to create user");
      showToast(`Staff account "${username.trim()}" created`);
      onCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create user", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Add Staff</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D" }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Username *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya.manager" style={inputStyle} autoComplete="off" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Temporary Password *</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8 characters" style={inputStyle} autoComplete="new-password" />
            <p style={{ fontSize: 11, color: "#A8A39A", marginTop: 4 }}>Share this with the user securely; they sign in with it.</p>
          </div>
          <div>
            <label style={labelStyle}>Role *</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>{saving ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

export default AdminGuard(StaffContent);
