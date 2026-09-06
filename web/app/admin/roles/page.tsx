"use client";

/**
 * Admin roles & permissions editor (route: /admin/roles). Create/edit/delete
 * roles and toggle their permissions against the catalog from
 * GET /api/admin/permissions. The UI mirrors the server-side anti-escalation
 * rules (you cannot grant what you lack or touch a role at/above your rank).
 * Wrapped in AdminGuard; needs MANAGE_ROLES.
 */
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";
import { adminFetch, useAdminAuth, Permission } from "@/lib/admin/auth";

interface PermissionMeta {
  key: Permission;
  label: string;
  description: string;
  group: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  rank: number;
  userCount: number;
  permissions: Permission[];
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE",
  fontSize: 13, background: "#fff", color: "#1F1813", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6E6257", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5,
};

function RolesContent() {
  const { showToast } = useToast();
  const { me, refresh: refreshMe } = useAdminAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Set<Permission>>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

  const myRank = me?.role?.rank ?? 9999;
  const myPerms = useMemo(() => new Set<Permission>(me?.permissions ?? []), [me]);

  const groups = useMemo(() => {
    const g: Record<string, PermissionMeta[]> = {};
    for (const p of catalog) (g[p.group] ??= []).push(p);
    return g;
  }, [catalog]);

  async function load() {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        adminFetch("/admin/roles"),
        adminFetch("/admin/permissions"),
      ]);
      const rolesJson = await rolesRes.json();
      const permsJson = await permsRes.json();
      const loaded: Role[] = rolesJson.data || [];
      setRoles(loaded);
      setCatalog(permsJson.data || []);
      // seed editable drafts from server state
      const d: Record<string, Set<Permission>> = {};
      for (const r of loaded) d[r.id] = new Set(r.permissions);
      setDraft(d);
    } catch {
      showToast("Failed to load roles", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // A role is editable only if it is strictly less privileged than the current user
  // (matches the server's anti-escalation guard — e.g. nobody edits SUPER_ADMIN).
  function isEditable(role: Role): boolean {
    return role.rank > myRank;
  }

  function togglePerm(roleId: string, perm: Permission) {
    setDraft((prev) => {
      const next = new Set(prev[roleId]);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...prev, [roleId]: next };
    });
  }

  function isDirty(role: Role): boolean {
    const d = draft[role.id];
    if (!d) return false;
    if (d.size !== role.permissions.length) return true;
    return role.permissions.some((p) => !d.has(p));
  }

  async function saveRole(role: Role) {
    setSavingId(role.id);
    try {
      const res = await adminFetch(`/admin/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: Array.from(draft[role.id] ?? []) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to save");
      showToast(`${role.name} permissions updated`);
      await load();
      // If the edited role is the current user's own, refresh their permissions/menu.
      if (me?.role?.id === role.id) await refreshMe();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save role", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRole(role: Role) {
    try {
      const res = await adminFetch(`/admin/roles/${role.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to delete");
      showToast(`Role "${role.name}" deleted`);
      setDeleteConfirm(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete role", "error");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
        <p style={{ fontSize: 13, color: "#6E6257", maxWidth: 620 }}>
          Define what each role can do. Toggle permissions and click <strong>Save</strong> on a role to apply.
          Changes take effect immediately for all users with that role. The Super Admin role is protected and cannot be edited.
        </p>
        <button onClick={() => setShowCreate(true)} className="btn-orange"
          style={{ padding: "0 16px", height: 36, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
          + New Role
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {roles.map((role) => {
            const editable = isEditable(role);
            const dirty = isDirty(role);
            const d = draft[role.id] ?? new Set<Permission>();
            return (
              <div key={role.id} style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0EDEA", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#1F1813" }}>{role.name}</span>
                      {role.isSystem && (
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6366F1", background: "#EEF2FF", padding: "2px 8px", borderRadius: 999 }}>System</span>
                      )}
                      {!editable && (
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#92400E", background: "#FEF3C7", padding: "2px 8px", borderRadius: 999 }}>Protected</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#6E6257", marginTop: 3 }}>
                      {role.description} · {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editable && !role.isSystem && (
                      <button onClick={() => setDeleteConfirm(role)}
                        style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>
                        Delete
                      </button>
                    )}
                    {editable && (
                      <button onClick={() => saveRole(role)} disabled={!dirty || savingId === role.id}
                        className="btn-orange" style={{ padding: "7px 18px", fontSize: 12, opacity: dirty ? 1 : 0.5 }}>
                        {savingId === role.id ? "Saving…" : "Save"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "10px 24px" }}>
                  {Object.entries(groups).map(([group, perms]) => (
                    <div key={group}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A8A39A", marginBottom: 6 }}>{group}</div>
                      {perms.map((p) => {
                        const checked = d.has(p.key);
                        // Can't grant a permission you don't hold yourself.
                        const lockedByCaller = editable && !myPerms.has(p.key);
                        const disabled = !editable || lockedByCaller;
                        return (
                          <label key={p.key} title={lockedByCaller ? "You cannot grant a permission you do not hold" : p.description}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !checked ? 0.45 : 1 }}>
                            <input type="checkbox" checked={checked} disabled={disabled}
                              onChange={() => togglePerm(role.id, p.key)}
                              style={{ width: 15, height: 15, accentColor: "#F47920", cursor: disabled ? "not-allowed" : "pointer" }} />
                            <span style={{ fontSize: 12.5, color: "#1F1813" }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateRoleModal
          catalog={catalog}
          groups={groups}
          myPerms={myPerms}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
          showToast={showToast}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete role &ldquo;{deleteConfirm.name}&rdquo;?</div>
            <p style={{ fontSize: 13, color: "#6E6257", marginBottom: 20 }}>
              {deleteConfirm.userCount > 0
                ? `This role has ${deleteConfirm.userCount} user(s). Reassign them first — the server will block the deletion otherwise.`
                : "This permanently removes the role. This action cannot be undone."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteRole(deleteConfirm)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateRoleModal({
  catalog, groups, myPerms, onClose, onCreated, showToast,
}: {
  catalog: PermissionMeta[];
  groups: Record<string, PermissionMeta[]>;
  myPerms: Set<Permission>;
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function save() {
    if (name.trim().length < 2) { showToast("Role name must be at least 2 characters", "error"); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/admin/roles", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim(), permissions: Array.from(selected) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to create role");
      showToast(`Role "${name.trim()}" created`);
      onCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create role", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>New Role</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257" }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Role Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse Lead" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Permissions</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "8px 20px", marginTop: 4 }}>
              {Object.entries(groups).map(([group, perms]) => (
                <div key={group}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A8A39A", marginBottom: 6 }}>{group}</div>
                  {perms.map((p) => {
                    const locked = !myPerms.has(p.key);
                    return (
                      <label key={p.key} title={locked ? "You cannot grant a permission you do not hold" : p.description}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.45 : 1 }}>
                        <input type="checkbox" checked={selected.has(p.key)} disabled={locked} onChange={() => toggle(p.key)}
                          style={{ width: 15, height: 15, accentColor: "#F47920" }} />
                        <span style={{ fontSize: 12.5 }}>{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "#fff" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>{saving ? "Creating…" : "Create Role"}</button>
        </div>
      </div>
    </div>
  );
}

export default AdminGuard(RolesContent);
