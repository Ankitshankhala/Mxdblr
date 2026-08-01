"use client";

/**
 * Admin announcements page (route: /admin/announcements). CRUD over the
 * storefront marquee messages (text + active flag + order). Wrapped in AdminGuard.
 */
import { useState, useEffect } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

interface Announcement {
  id: string;
  text: string;
  active: boolean;
  displayOrder: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Keep in sync with MAX_TEXT_LENGTH in api/src/routes/admin/announcements.ts.
const MAX_TEXT_LENGTH = 200;

const EMPTY: Omit<Announcement, "id"> = {
  text: "",
  active: true,
  displayOrder: 0,
};

function AnnouncementsContent() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<Omit<Announcement, "id">>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function authHeaders() {
    const token = localStorage.getItem("adminToken");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/announcements`, { headers: authHeaders() });
      const d = await res.json();
      setItems(d.data || []);
    } catch {
      showToast("Failed to load announcements", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, displayOrder: items.length });
    setShowModal(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({ text: a.text, active: a.active, displayOrder: a.displayOrder });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.text.trim()) { showToast("Message text is required", "error"); return; }
    setSaving(true);
    try {
      const url = editing ? `${API_BASE}/admin/announcements/${editing.id}` : `${API_BASE}/admin/announcements`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || d.message || "Failed to save");
      showToast(editing ? "Message updated" : "Message added");
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || "Failed to save message", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API_BASE}/admin/announcements/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Message deleted");
      setDeleteConfirm(null);
      load();
    } catch {
      showToast("Failed to delete message", "error");
    }
  }

  async function toggleActive(a: Announcement) {
    try {
      const res = await fetch(`${API_BASE}/admin/announcements/${a.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) throw new Error("Failed");
      setItems((prev) => prev.map((x) => x.id === a.id ? { ...x, active: !x.active } : x));
    } catch {
      showToast("Failed to update message", "error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE",
    fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase",
    letterSpacing: "0.05em", display: "block", marginBottom: 5,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13, color: "#6B6B7D", marginTop: 2 }}>
            Messages that scroll in the announcement bar at the top of the home page. Active messages show in display order.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-orange"
          style={{ padding: "0 16px", height: 36, fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
        >
          + Add Message
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
              {["Message", "Order", "Status", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>
                  No messages yet. Add one — until then the home bar shows the default messages.
                </td>
              </tr>
            )}
            {!loading && items.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, maxWidth: 520 }}>{a.text}</td>
                <td style={{ padding: "12px 16px", color: "#6B6B7D" }}>{a.displayOrder}</td>
                <td style={{ padding: "12px 16px" }}>
                  <button
                    onClick={() => toggleActive(a)}
                    style={{
                      padding: "3px 10px", borderRadius: 12, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: a.active ? "#D1FAE5" : "#F3F4F6",
                      color: a.active ? "#059669" : "#6B7280",
                    }}
                  >
                    {a.active ? "Active" : "Hidden"}
                  </button>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEdit(a)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(a.id)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", fontSize: 12, color: "#6B6B7D" }}>
          {items.length} message{items.length !== 1 ? "s" : ""} total
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Message" : "Add Message"}</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D" }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Message *</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value.slice(0, MAX_TEXT_LENGTH) }))}
                  placeholder="e.g. Free Delivery on Orders above ₹5,000"
                  rows={2}
                  maxLength={MAX_TEXT_LENGTH}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.4 }}
                  autoFocus
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: "#A8A39A" }}>
                    Shown in the scrolling bar at the top of the home page. Keep it short.
                  </p>
                  <span style={{ fontSize: 11, color: form.text.length >= MAX_TEXT_LENGTH ? "#DC2626" : "#A8A39A", whiteSpace: "nowrap" }}>
                    {form.text.length}/{MAX_TEXT_LENGTH}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                    min={0}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    value={form.active ? "active" : "hidden"}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "active" }))}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="active">Active (visible)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-orange"
                style={{ padding: "9px 22px", fontSize: 13 }}
              >
                {saving ? "Saving…" : editing ? "Update Message" : "Add Message"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete Message?</div>
            <p style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20 }}>
              This removes the message from the announcement bar. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(AnnouncementsContent);
