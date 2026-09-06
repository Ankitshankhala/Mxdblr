"use client";

/**
 * Admin settings page (route: /admin/settings). Edit non-sensitive system config
 * (secret fields shown masked) and change the admin password. Wrapped in AdminGuard.
 */
import { useState, useEffect } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function SettingsContent() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState({
    whatsappNumber: "",
    msg91ApiKey: "",
    cloudinaryCloud: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [showMsg91, setShowMsg91] = useState(false);
  const [showCloudKey, setShowCloudKey] = useState(false);
  const [showCloudSecret, setShowCloudSecret] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/admin/settings`, {
          headers: { "Content-Type": "application/json", ...authHeader() },
        });
        if (!res.ok) throw new Error("Failed to load settings");
        const { settings: s } = await res.json();
        setSettings({
          whatsappNumber: s.whatsappNumber ?? "",
          msg91ApiKey: s.msg91ApiKey ?? "",
          cloudinaryCloud: s.cloudinaryCloud ?? "",
          cloudinaryApiKey: s.cloudinaryApiKey ?? "",
          cloudinaryApiSecret: s.cloudinaryApiSecret ?? "",
        });
      } catch {
        showToast("Failed to load settings", "error");
      } finally {
        setLoadingSettings(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      showToast("Settings saved successfully");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleChangePassword() {
    if (!passwords.current) { showToast("Enter current password", "error"); return; }
    if (!passwords.newPass || passwords.newPass.length < 8) { showToast("New password must be 8+ characters", "error"); return; }
    if (passwords.newPass !== passwords.confirm) { showToast("Passwords do not match", "error"); return; }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update password");
      showToast("Password changed successfully");
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update password", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 13, background: "#fff", color: "#1F1813", fontFamily: "inherit", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6E6257", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 };
  const sectionStyle: React.CSSProperties = { background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, marginBottom: 20 };

  function MaskedInput({ value, show, onToggle, onChange, name }: { value: string; show: boolean; onToggle: () => void; onChange: (v: string) => void; name: string }) {
    return (
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          name={name}
          style={{ ...inputStyle, paddingRight: 44 }}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6E6257", padding: 0 }}
        >
          {show ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  if (loadingSettings) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", color: "#6E6257", fontSize: 14 }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Integration Settings */}
      <div style={sectionStyle}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E8E4DE" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1813" }}>Integration Settings</div>
          <div style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>WhatsApp, SMS, and media storage configuration</div>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>WhatsApp Business Number</label>
            <input
              value={settings.whatsappNumber}
              onChange={(e) => setSettings((s) => ({ ...s, whatsappNumber: e.target.value }))}
              style={inputStyle}
              placeholder="+91 XXXXX XXXXX"
            />
            <div style={{ fontSize: 11, color: "#6E6257", marginTop: 4 }}>Used for sending inquiry notifications to admin</div>
          </div>

          <div>
            <label style={labelStyle}>MSG91 API Key</label>
            <MaskedInput
              value={settings.msg91ApiKey}
              show={showMsg91}
              onToggle={() => setShowMsg91((v) => !v)}
              onChange={(v) => setSettings((s) => ({ ...s, msg91ApiKey: v }))}
              name="msg91"
            />
            <div style={{ fontSize: 11, color: "#6E6257", marginTop: 4 }}>Used for SMS and WhatsApp API via MSG91</div>
          </div>

          <div style={{ height: 1, background: "#E8E4DE" }} />

          <div style={{ fontSize: 12, fontWeight: 700, color: "#6E6257", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cloudinary (Media Storage)</div>

          <div>
            <label style={labelStyle}>Cloud Name</label>
            <input
              value={settings.cloudinaryCloud}
              onChange={(e) => setSettings((s) => ({ ...s, cloudinaryCloud: e.target.value }))}
              style={inputStyle}
              placeholder="my-cloud"
            />
          </div>

          <div>
            <label style={labelStyle}>Cloudinary API Key</label>
            <MaskedInput
              value={settings.cloudinaryApiKey}
              show={showCloudKey}
              onToggle={() => setShowCloudKey((v) => !v)}
              onChange={(v) => setSettings((s) => ({ ...s, cloudinaryApiKey: v }))}
              name="cloudkey"
            />
          </div>

          <div>
            <label style={labelStyle}>Cloudinary API Secret</label>
            <MaskedInput
              value={settings.cloudinaryApiSecret}
              show={showCloudSecret}
              onToggle={() => setShowCloudSecret((v) => !v)}
              onChange={(v) => setSettings((s) => ({ ...s, cloudinaryApiSecret: v }))}
              name="cloudsecret"
            />
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="btn-orange"
            style={{ padding: "11px 24px", fontSize: 13, alignSelf: "flex-start" }}
          >
            {savingSettings ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div style={sectionStyle}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E8E4DE" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1813" }}>Change Admin Password</div>
          <div style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>Update your admin login credentials</div>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              style={inputStyle}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={passwords.newPass}
              onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))}
              style={inputStyle}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              style={inputStyle}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>
          {passwords.newPass && passwords.confirm && passwords.newPass !== passwords.confirm && (
            <div style={{ color: "#DC2626", fontSize: 12 }}>Passwords do not match</div>
          )}
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            style={{ padding: "11px 24px", borderRadius: 10, border: "2px solid #1F1813", background: "#1F1813", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}
          >
            {savingPassword ? "Updating…" : "Change Password"}
          </button>
        </div>
      </div>

      {/* System Info */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E8E4DE" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1813" }}>System Information</div>
        </div>
        <div style={{ padding: "16px 24px" }}>
          {([
            ["App Version", "v1.0.0-beta"],
            ["Build", "Next.js 15 · TypeScript · Tailwind CSS v4"],
            ["Backend", "Node.js + Express"],
            ["Database", "PostgreSQL"],
            ["Deployment", "Hostinger VPS KVM 2"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F0EDEA", fontSize: 13 }}>
              <span style={{ color: "#6E6257" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "#1F1813" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminGuard(SettingsContent);
