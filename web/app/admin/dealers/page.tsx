"use client";

/**
 * Admin dealers page (route: /admin/dealers). Lists dealer/customer accounts with
 * search and moderation actions — approve / block / suspend
 * (PUT /api/admin/dealers/:id/moderate). Wrapped in AdminGuard.
 */
import { useState, useEffect, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useToast } from "@/components/admin/Toast";

type DealerStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "REJECTED" | "PENDING";

type Dealer = {
  id: string;
  name: string;
  shop: string;
  mobile: string;
  district: string;
  state: string;
  businessType: string;
  status: DealerStatus;
  joined: string;
};

// Shape returned by GET /api/admin/dealers
interface ApiDealer {
  id: string;
  ownerName: string;
  shopName: string;
  mobile: string;
  district: string;
  state: string;
  businessType: string;
  status: DealerStatus;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getAdminToken(): string {
  return (
    (typeof window !== "undefined" && localStorage.getItem("adminToken")) || ""
  );
}

function mapApiDealer(d: ApiDealer): Dealer {
  return {
    id: d.id,
    name: d.ownerName,
    shop: d.shopName,
    mobile: d.mobile,
    district: d.district,
    state: d.state,
    businessType: d.businessType,
    status: d.status,
    joined: new Date(d.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

const FILTER_OPTIONS: (DealerStatus | "All")[] = [
  "All",
  "ACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "REJECTED",
  "PENDING",
];
const STATUS_ACTIONS: Record<DealerStatus, DealerStatus[]> = {
  ACTIVE:    ["SUSPENDED", "BLOCKED", "REJECTED"],
  SUSPENDED: ["ACTIVE", "BLOCKED", "REJECTED"],
  BLOCKED:   ["ACTIVE", "REJECTED"],
  REJECTED:  ["ACTIVE"],
  PENDING:   ["ACTIVE", "REJECTED"],
};
const ACTION_LABELS: Record<DealerStatus, string> = {
  ACTIVE: "Activate",
  SUSPENDED: "Suspend",
  BLOCKED: "Block",
  REJECTED: "Reject",
  PENDING: "Set Pending",
};

function DealersContent() {
  const { showToast } = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DealerStatus | "All">("All");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    dealerId: string;
    newStatus: DealerStatus;
  } | null>(null);
  const [viewDealer, setViewDealer] = useState<Dealer | null>(null);
  const [moderating, setModerating] = useState(false);

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch(`${API}/admin/dealers`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw: ApiDealer[] = json.data ?? json ?? [];
      setDealers(raw.map(mapApiDealer));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dealers";
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  const filtered = dealers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.name.toLowerCase().includes(q) ||
      d.shop.toLowerCase().includes(q) ||
      d.mobile.includes(q) ||
      d.district.toLowerCase().includes(q);
    const matchStatus = filterStatus === "All" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function applyAction() {
    if (!confirmAction) return;
    setModerating(true);
    try {
      const res = await fetch(
        `${API}/admin/dealers/${confirmAction.dealerId}/moderate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
          },
          body: JSON.stringify({ action: confirmAction.newStatus }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Dealer status updated to ${confirmAction.newStatus}`);
      setConfirmAction(null);
      setOpenMenu(null);
      // Refresh list from server to get fresh state
      await fetchDealers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update dealer";
      showToast(`Error: ${msg}`);
    } finally {
      setModerating(false);
    }
  }

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

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#6B6B7D" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid #F47920",
            borderTopColor: "transparent",
            margin: "0 auto 12px",
            animation: "spin 0.8s linear infinite",
          }}
        />
        Loading dealers...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "#DC2626", fontWeight: 600, marginBottom: 16 }}>
          {fetchError}
        </p>
        <button
          type="button"
          onClick={fetchDealers}
          style={{
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: "#F47920",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="#6B6B7D"
            strokeWidth="2"
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, shop, mobile…"
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#F8F6F2",
            borderRadius: 8,
            padding: 4,
            flexWrap: "wrap",
          }}
        >
          {FILTER_OPTIONS.map((f) => (
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
                boxShadow:
                  filterStatus === f ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {f === "All" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E8E4DE",
          borderRadius: 12,
          overflow: "hidden",
        }}
        onClick={() => setOpenMenu(null)}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                {[
                  "Name",
                  "Shop",
                  "Mobile",
                  "District",
                  "State",
                  "Type",
                  "Status",
                  "Joined",
                  "Actions",
                ].map((h) => (
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
              {filtered.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                    {d.name}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>
                    {d.shop}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  >
                    {d.mobile}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>
                    {d.district}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>
                    {d.state}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        background: "#EEF0FE",
                        color: "#6366F1",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {d.businessType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#6B6B7D",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.joined}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div
                      style={{ position: "relative" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setOpenMenu(openMenu === d.id ? null : d.id)
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #E8E4DE",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        Actions
                        <svg
                          width="10"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {openMenu === d.id && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 4px)",
                            background: "#fff",
                            border: "1px solid #E8E4DE",
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            zIndex: 100,
                            minWidth: 160,
                            overflow: "hidden",
                          }}
                        >
                          <button
                            onClick={() => {
                              setViewDealer(d);
                              setOpenMenu(null);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "9px 14px",
                              border: "none",
                              background: "none",
                              textAlign: "left",
                              fontSize: 13,
                              cursor: "pointer",
                              color: "#1A1A2E",
                            }}
                          >
                            View Details
                          </button>
                          {STATUS_ACTIONS[d.status].map((action) => (
                            <button
                              key={action}
                              onClick={() =>
                                setConfirmAction({
                                  dealerId: d.id,
                                  newStatus: action,
                                })
                              }
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "9px 14px",
                                border: "none",
                                background: "none",
                                textAlign: "left",
                                fontSize: 13,
                                cursor: "pointer",
                                color:
                                  action === "BLOCKED"
                                    ? "#DC2626"
                                    : action === "REJECTED"
                                    ? "#6B6B7D"
                                    : action === "SUSPENDED"
                                    ? "#F59E0B"
                                    : "#2E7D32",
                                fontWeight: 600,
                              }}
                            >
                              {ACTION_LABELS[action]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: 32,
                      textAlign: "center",
                      color: "#6B6B7D",
                    }}
                  >
                    No dealers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #E8E4DE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: "#6B6B7D" }}>
            Showing {filtered.length} of {dealers.length} dealers
          </span>
          <button
            type="button"
            onClick={fetchDealers}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid #E8E4DE",
              background: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              color: "#6B6B7D",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Confirm action modal */}
      {confirmAction &&
        (() => {
          const dealer = dealers.find((d) => d.id === confirmAction.dealerId);
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 28,
                  maxWidth: 380,
                  width: "90%",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}
                >
                  {ACTION_LABELS[confirmAction.newStatus]} Dealer?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6B6B7D",
                    marginBottom: 20,
                  }}
                >
                  Are you sure you want to{" "}
                  <strong>
                    {ACTION_LABELS[confirmAction.newStatus].toLowerCase()}
                  </strong>{" "}
                  dealer <strong>{dealer?.name}</strong>?
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => setConfirmAction(null)}
                    disabled={moderating}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "1px solid #E8E4DE",
                      background: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyAction}
                    disabled={moderating}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        confirmAction.newStatus === "BLOCKED" ||
                        confirmAction.newStatus === "REJECTED"
                          ? "#DC2626"
                          : "#2E7D32",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: moderating ? "not-allowed" : "pointer",
                      opacity: moderating ? 0.7 : 1,
                    }}
                  >
                    {moderating ? "Saving..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* View Dealer modal */}
      {viewDealer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 460,
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #E8E4DE",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                Dealer Details
              </div>
              <button
                onClick={() => setViewDealer(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6B6B7D",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {(
                [
                  ["Name", viewDealer.name],
                  ["Shop Name", viewDealer.shop],
                  ["Mobile", viewDealer.mobile],
                  ["District", viewDealer.district],
                  ["State", viewDealer.state],
                  ["Business Type", viewDealer.businessType],
                  ["Joined", viewDealer.joined],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #F0EDEA",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#6B6B7D", fontWeight: 500 }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#6B6B7D", fontWeight: 500 }}>
                  Status
                </span>
                <StatusBadge status={viewDealer.status} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(DealersContent);
