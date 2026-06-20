"use client";

/**
 * Admin inquiries/orders page (route: /admin/orders). Lists dealer inquiries with
 * filters and lets staff update inquiry status (PUT /api/admin/orders/:id/status).
 * Wrapped in AdminGuard.
 */
import { useState, useEffect, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useToast } from "@/components/admin/Toast";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

type InquiryStatus = "NEW" | "VIEWED" | "RESPONDED" | "CLOSED";

interface InquiryDealer {
  id: string;
  ownerName: string;
  shopName: string;
  mobile: string;
  whatsappNumber: string;
  city: string;
  district: string;
  state: string;
}

interface CartSnapshotItem {
  productId: string;
  quantity: number;
  product: { id: string; name: string; brand: string; sku: string; moq: number } | null;
}

interface Inquiry {
  id: string;
  dealerId: string;
  cartSnapshot: CartSnapshotItem[];
  whatsappSentAt: string;
  status: InquiryStatus;
  createdAt: string;
  dealer: InquiryDealer;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_FILTERS: (InquiryStatus | "All")[] = ["All", "NEW", "VIEWED", "RESPONDED", "CLOSED"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrdersContent() {
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewInquiry, setViewInquiry] = useState<Inquiry | null>(null);
  const [modalStatus, setModalStatus] = useState<InquiryStatus>("NEW");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchInquiries = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterStatus !== "All") params.set("status", filterStatus);

      const res = await fetch(`${BASE}/admin/inquiries?${params}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const json = await res.json();
      if (json.success) {
        setInquiries(json.data);
        setPagination(json.pagination);
      } else {
        showToast("Failed to load inquiries");
      }
    } catch {
      showToast("Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, showToast]);

  useEffect(() => {
    fetchInquiries(1);
  }, [fetchInquiries]);

  async function handleStatusUpdate() {
    if (!viewInquiry) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${BASE}/admin/inquiries/${viewInquiry.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ status: modalStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setInquiries((prev) =>
          prev.map((i) => (i.id === viewInquiry.id ? { ...i, status: modalStatus } : i))
        );
        showToast(`Status updated to ${modalStatus}`);
        setViewInquiry(null);
      } else {
        showToast("Failed to update status");
      }
    } catch {
      showToast("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Client-side date filter applied on top of server results
  const filtered = inquiries.filter((inq) => {
    if (dateFrom) {
      const created = new Date(inq.createdAt).toISOString().slice(0, 10);
      if (created < dateFrom) return false;
    }
    if (dateTo) {
      const created = new Date(inq.createdAt).toISOString().slice(0, 10);
      if (created > dateTo) return false;
    }
    return true;
  });

  const inputStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: 7,
    border: "1px solid #E8E4DE",
    fontSize: 13,
    background: "#fff",
    color: "#1A1A2E",
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={inputStyle}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 4, background: "#F8F6F2", borderRadius: 8, padding: 4, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: filterStatus === f ? "#fff" : "transparent",
                color: filterStatus === f ? "#1A1A2E" : "#6B6B7D",
                fontWeight: filterStatus === f ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: filterStatus === f ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {f === "All" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#6B6B7D", marginLeft: "auto" }}>
          {filtered.length} of {pagination.total} records
        </span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading inquiries...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                  {["Inquiry ID", "Dealer", "Shop", "City", "Items", "Received", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#6B6B7D",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inq) => (
                  <tr key={inq.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#6366F1", fontWeight: 700 }}>
                      {inq.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{inq.dealer.ownerName}</td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>{inq.dealer.shopName}</td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D", fontSize: 12 }}>{inq.dealer.city}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#EEF0FE", color: "#6366F1", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                        {inq.cartSnapshot.length} items
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6B6B7D", fontSize: 12, whiteSpace: "nowrap" }}>
                      {formatDate(inq.createdAt)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge status={inq.status} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => { setViewInquiry(inq); setModalStatus(inq.status); }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          border: "1px solid #E8E4DE",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          color: "#1A1A2E",
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#6B6B7D" }}>
                      No inquiries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchInquiries(p)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #E8E4DE",
                background: p === pagination.page ? "#F47920" : "#fff",
                color: p === pagination.page ? "#fff" : "#1A1A2E",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* View Inquiry Modal */}
      {viewInquiry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Inquiry Details</div>
                <div style={{ fontSize: 11, color: "#6B6B7D", fontFamily: "monospace", marginTop: 2 }}>
                  {viewInquiry.id}
                </div>
              </div>
              <button onClick={() => setViewInquiry(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 18 }}>
                ×
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {/* Dealer info */}
              <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6B7D", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dealer</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{viewInquiry.dealer.ownerName}</div>
                <div style={{ fontSize: 13, color: "#6B6B7D" }}>
                  {viewInquiry.dealer.shopName} · {viewInquiry.dealer.mobile}
                </div>
                <div style={{ fontSize: 12, color: "#6B6B7D", marginTop: 2 }}>
                  {viewInquiry.dealer.city}, {viewInquiry.dealer.district}, {viewInquiry.dealer.state}
                </div>
              </div>

              {/* Products */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6B7D", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Products Requested
                </div>
                <div style={{ border: "1px solid #E8E4DE", borderRadius: 8, overflow: "hidden" }}>
                  {viewInquiry.cartSnapshot.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderBottom: idx < viewInquiry.cartSnapshot.length - 1 ? "1px solid #F0EDEA" : "none",
                        fontSize: 13,
                      }}
                    >
                      <span>
                        {idx + 1}.{" "}
                        {item.product ? `${item.product.name} (${item.product.sku})` : item.productId}
                      </span>
                      <span style={{ fontWeight: 700, color: "#F47920" }}>× {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Received */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: "#E6F3E7", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#2E7D32", fontWeight: 600 }}>
                  Received: {formatDate(viewInquiry.createdAt)}
                </span>
              </div>

              {/* Status update */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  Update Status
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value as InquiryStatus)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE", fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none" }}
                >
                  {(["NEW", "VIEWED", "RESPONDED", "CLOSED"] as InquiryStatus[]).map((s) => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setViewInquiry(null)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Close
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updatingStatus}
                className="btn-orange"
                style={{ padding: "9px 20px", fontSize: 13 }}
              >
                {updatingStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(OrdersContent);
