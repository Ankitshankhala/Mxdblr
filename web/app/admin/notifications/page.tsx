"use client";

/**
 * Admin notifications page (route: /admin/notifications). View back-in-stock
 * subscriptions, trigger restock alerts, and send WhatsApp broadcasts via the
 * /api/admin/notify endpoints. Wrapped in AdminGuard.
 */
import { useState, useEffect, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getAdminToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("adminToken="))?.split("=")[1] ?? "";
}

type Product = {
  id: string;
  name: string;
  stockStatus: string;
  subscribers: number;
};

type HistoryEntry = {
  productId: string;
  productName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  channel: string;
  message: string;
  status: string;
  sentAt: string;
};

const STATES = ["Karnataka", "Tamil Nadu", "Andhra Pradesh", "Maharashtra", "Delhi", "All States"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function NotificationsContent() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [recipient, setRecipient] = useState("All Dealers");
  const [state, setState] = useState("Karnataka");
  const [channel, setChannel] = useState("WhatsApp");
  const [showPreview, setShowPreview] = useState(false);
  const [sendingRestock, setSendingRestock] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API}/admin/notify/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.success) setHistory(d.data);
    } catch {
      // silent — history stays empty
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const token = getAdminToken();

    fetch(`${API}/admin/notify/products-with-subs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setProducts(d.data); })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));

    loadHistory();
  }, [loadHistory]);

  const selectedProductData = products.find((p) => p.id === selectedProduct);

  async function handleTriggerRestock() {
    if (!selectedProduct) { showToast("Please select a product", "error"); return; }
    setSendingRestock(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API}/admin/notify/trigger/${selectedProduct}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        showToast(d.message || "Failed to send notifications", "error");
        return;
      }
      showToast(
        d.sent > 0
          ? `Notified ${d.sent} dealer${d.sent !== 1 ? "s" : ""} for ${selectedProductData?.name}`
          : d.message || "No subscribers found for this product"
      );
      setSelectedProduct("");
      await loadHistory();
      // Reload products to reflect updated subscriber counts
      const pRes = await fetch(`${API}/admin/notify/products-with-subs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pData = await pRes.json();
      if (pData.success) setProducts(pData.data);
    } catch {
      showToast("Network error — could not send notifications", "error");
    } finally {
      setSendingRestock(false);
    }
  }

  async function handleSendBroadcast() {
    if (!broadcastMsg.trim()) { showToast("Message cannot be empty", "error"); return; }
    setSendingBroadcast(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API}/admin/notify/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: broadcastMsg, recipient, state, channel }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        showToast(d.message || "Broadcast failed", "error");
        return;
      }
      showToast(
        d.sent > 0
          ? `Broadcast sent via ${channel} to ${d.sent} dealer${d.sent !== 1 ? "s" : ""}`
          : d.message || "No dealers found"
      );
      setBroadcastMsg("");
      setShowPreview(false);
    } catch {
      showToast("Network error — broadcast failed", "error");
    } finally {
      setSendingBroadcast(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE", fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 };
  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden", marginBottom: 24 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Trigger Restock Notifications */}
        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="#F47920" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>Trigger Restock Notification</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Select Product</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={inputStyle}
                disabled={loadingProducts}
              >
                <option value="">
                  {loadingProducts ? "Loading products…" : products.length === 0 ? "No products with subscribers" : "— Choose out-of-stock product —"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.subscribers} subscriber{p.subscribers !== 1 ? "s" : ""})
                  </option>
                ))}
              </select>
            </div>

            {selectedProductData && (
              <div style={{ background: "#FFF3E8", border: "1px solid #F47920", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#F47920", fontWeight: 700 }}>
                  {selectedProductData.subscribers} dealer{selectedProductData.subscribers !== 1 ? "s" : ""} subscribed
                </div>
                <div style={{ fontSize: 11, color: "#6B6B7D", marginTop: 2 }}>
                  Notification will be sent via WhatsApp to all subscribers
                </div>
              </div>
            )}

            <button
              onClick={handleTriggerRestock}
              disabled={sendingRestock || !selectedProduct}
              className="btn-orange"
              style={{ padding: "10px 20px", fontSize: 13, width: "100%" }}
            >
              {sendingRestock ? "Sending…" : "Trigger Notification"}
            </button>
          </div>
        </div>

        {/* Send Broadcast */}
        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="#6366F1" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>Send Broadcast</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Message</label>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Type your broadcast message here…"
                style={{ ...inputStyle, height: 90, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Recipient</label>
                <select value={recipient} onChange={(e) => setRecipient(e.target.value)} style={inputStyle}>
                  <option>All Dealers</option>
                  <option>Active Only</option>
                  <option>By State</option>
                </select>
              </div>
              {recipient === "By State" ? (
                <div>
                  <label style={labelStyle}>State</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
                    {STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Channel</label>
                  <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>
                    <option>WhatsApp</option>
                    <option>SMS</option>
                    <option>Both</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowPreview(true)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Preview
              </button>
              <button onClick={handleSendBroadcast} disabled={sendingBroadcast} className="btn-orange" style={{ flex: 1, padding: "9px", fontSize: 12 }}>
                {sendingBroadcast ? "Sending…" : "Send Broadcast"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification History */}
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>Notification History</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {loadingHistory ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>Loading history…</div>
          ) : history.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>
              No notifications sent yet. Trigger a restock notification above to see history here.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                  {["Product / Topic", "Recipients", "Channel", "Message", "Status", "Sent At"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((n, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, maxWidth: 180 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.productName}</div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>
                      {n.totalRecipients} dealer{n.totalRecipients !== 1 ? "s" : ""}
                      {n.failed > 0 && (
                        <span style={{ color: "#DC2626", fontSize: 11, marginLeft: 4 }}>({n.failed} failed)</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        background: n.channel === "WHATSAPP" ? "#E6F3E7" : n.channel === "SMS" ? "#EEF0FE" : "#FFF3E8",
                        color: n.channel === "WHATSAPP" ? "#2E7D32" : n.channel === "SMS" ? "#6366F1" : "#F47920",
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999
                      }}>
                        {n.channel === "WHATSAPP" ? "WhatsApp" : n.channel}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D", maxWidth: 220 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        background: n.status === "SENT" ? "#E6F3E7" : n.status === "PARTIAL" ? "#FFF3E8" : "#FCE7E7",
                        color: n.status === "SENT" ? "#2E7D32" : n.status === "PARTIAL" ? "#F47920" : "#DC2626",
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999
                      }}>{n.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D", whiteSpace: "nowrap", fontSize: 12 }}>{formatDate(n.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440 }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Message Preview</div>
              <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 12, color: "#6B6B7D", marginBottom: 6 }}>To: <strong>{recipient === "By State" ? `${state} dealers` : recipient}</strong> via <strong>{channel}</strong></div>
              <div style={{ background: "#F8F6F2", borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.6, color: "#1A1A2E", whiteSpace: "pre-wrap" }}>
                {broadcastMsg || "(No message entered)"}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setShowPreview(false)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Edit</button>
                <button onClick={() => { setShowPreview(false); handleSendBroadcast(); }} className="btn-orange" style={{ flex: 1, padding: "9px", fontSize: 13 }}>Send Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(NotificationsContent);
