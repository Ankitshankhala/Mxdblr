"use client";

import { useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

type GeoRule = {
  id: string;
  state: string;
  districts: string;
  status: "ALLOWED" | "BLOCKED";
};

const INITIAL_RULES: GeoRule[] = [
  { id: "1", state: "Karnataka", districts: "All Districts", status: "ALLOWED" },
  { id: "2", state: "Tamil Nadu", districts: "All Districts", status: "ALLOWED" },
  { id: "3", state: "Andhra Pradesh", districts: "All Districts", status: "ALLOWED" },
  { id: "4", state: "Maharashtra", districts: "All Districts", status: "BLOCKED" },
  { id: "5", state: "Delhi", districts: "All Districts", status: "BLOCKED" },
  { id: "6", state: "Others", districts: "All Districts", status: "BLOCKED" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Others",
];

function GeoContent() {
  const { showToast } = useToast();
  const [rules, setRules] = useState<GeoRule[]>(INITIAL_RULES);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ state: INDIAN_STATES[0], districts: "All Districts", status: "ALLOWED" as "ALLOWED" | "BLOCKED" });

  function toggleStatus(id: string) {
    setRules((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const newStatus = r.status === "ALLOWED" ? "BLOCKED" : "ALLOWED";
      showToast(`${r.state} is now ${newStatus}`);
      return { ...r, status: newStatus };
    }));
  }

  function openEdit(rule: GeoRule) {
    setEditId(rule.id);
    setForm({ state: rule.state, districts: rule.districts, status: rule.status });
    setShowAdd(true);
  }

  function openAdd() {
    setEditId(null);
    setForm({ state: INDIAN_STATES[0], districts: "All Districts", status: "ALLOWED" });
    setShowAdd(true);
  }

  function handleSave() {
    if (!form.state.trim()) { showToast("State is required", "error"); return; }
    if (editId) {
      setRules((prev) => prev.map((r) => r.id === editId ? { ...r, state: form.state, districts: form.districts, status: form.status } : r));
      showToast("Geo rule updated");
    } else {
      setRules((prev) => [...prev, { id: String(Date.now()), state: form.state, districts: form.districts, status: form.status }]);
      showToast("Geo rule added");
    }
    setShowAdd(false);
  }

  function handleDelete(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    showToast("Geo rule removed");
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE", fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 };

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: "#EEF0FE", border: "1px solid #c7c9f7", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <svg width="16" height="16" fill="none" stroke="#6366F1" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>Registered Dealer Bypass</div>
          <div style={{ fontSize: 12, color: "#4A4A8A", marginTop: 2 }}>
            Registered and approved dealers bypass geo restrictions and can access the portal from anywhere in India. Geo rules apply to unregistered visitors only.
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openAdd} className="btn-orange" style={{ padding: "9px 18px", fontSize: 13 }}>
          + Add Rule
        </button>
      </div>

      {/* Rules Table */}
      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                {["State", "Districts", "Status", "Toggle", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13 }}>{rule.state}</td>
                  <td style={{ padding: "12px 16px", color: "#6B6B7D" }}>{rule.districts}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: rule.status === "ALLOWED" ? "#E6F3E7" : "#FCE7E7",
                      color: rule.status === "ALLOWED" ? "#2E7D32" : "#DC2626",
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                    }}>
                      {rule.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleStatus(rule.id)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: "none",
                        background: rule.status === "ALLOWED" ? "#2E7D32" : "#E8E4DE",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                        padding: 0,
                      }}
                      aria-label={`Toggle ${rule.state}`}
                    >
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: 3,
                        left: rule.status === "ALLOWED" ? 23 : 3,
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(rule)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDelete(rule.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440 }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editId ? "Edit Geo Rule" : "Add Geo Rule"}</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>State</label>
                <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={inputStyle}>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Districts (optional)</label>
                <input value={form.districts} onChange={(e) => setForm((f) => ({ ...f, districts: e.target.value }))} style={inputStyle} placeholder="All Districts or specific ones…" />
              </div>
              <div>
                <label style={labelStyle}>Access</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["ALLOWED", "BLOCKED"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setForm((f) => ({ ...f, status: opt }))}
                      style={{
                        flex: 1, padding: "9px", borderRadius: 7, border: "2px solid",
                        borderColor: form.status === opt ? (opt === "ALLOWED" ? "#2E7D32" : "#DC2626") : "#E8E4DE",
                        background: form.status === opt ? (opt === "ALLOWED" ? "#E6F3E7" : "#FCE7E7") : "#fff",
                        color: form.status === opt ? (opt === "ALLOWED" ? "#2E7D32" : "#DC2626") : "#6B6B7D",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} className="btn-orange" style={{ padding: "9px 20px", fontSize: 13 }}>Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(GeoContent);
