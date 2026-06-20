"use client";

/**
 * Admin login page (route: /admin/login). Username + password form that posts to
 * POST /api/auth/admin/login and, on success, stores the admin JWT and redirects
 * into the admin shell. The only admin route not wrapped by AdminGuard.
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
      const res = await fetch(`${apiBase}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || d.message || "Invalid credentials");
      }
      const { token } = await res.json();
      localStorage.setItem("adminToken", token);
      // Set cookie so Next.js middleware can verify the JWT server-side on every request.
      // Not HttpOnly — we need JS to clear it on logout.
      // max-age=43200 matches the 12h admin token expiry set in the API.
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `adminToken=${token}; path=/; SameSite=Lax; max-age=43200${secure}`;
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 8,
    border: "1px solid #E8E4DE",
    fontSize: 14,
    background: "#fff",
    color: "#1A1A2E",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1A1A2E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 16,
          padding: "36px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "#F47920",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            MXD®
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1A1A2E",
              marginTop: 8,
            }}
          >
            Admin Login
          </div>
          <div style={{ fontSize: 12, color: "#6B6B7D", marginTop: 4 }}>
            Restricted access — authorised personnel only
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#6B6B7D",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              style={inputStyle}
              autoComplete="username"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#6B6B7D",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              style={{
                background: "#FCE7E7",
                color: "#DC2626",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-orange"
            style={{ padding: "13px 24px", fontSize: 14, borderRadius: 10, marginTop: 4 }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

      </div>
    </div>
  );
}
