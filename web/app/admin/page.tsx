"use client";

import { useState, useEffect } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import StatCard from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminAuth } from "@/lib/admin/auth";

function useIsMobile(bp = 768) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const check = () => setV(window.innerWidth < bp);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [bp]);
  return v;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface Inquiry {
  id: string;
  status: string;
  createdAt: string;
  cartSnapshot: unknown[];
  dealer: { ownerName: string; shopName: string };
}

interface StockAlertProduct {
  name: string;
  sku: string;
  status: string;
}

function DashboardContent() {
  const isMobile = useIsMobile();
  const { hasAny } = useAdminAuth();
  const [stats, setStats] = useState({ dealers: 0, inquiriesToday: 0, lowStock: 0, outOfStock: 0 });
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [stockAlerts, setStockAlerts] = useState<StockAlertProduct[]>([]);
  const [stockAlertsLoading, setStockAlertsLoading] = useState(true);

  // Only show (and only fetch) the sections this role can access.
  const canCustomers = hasAny("MANAGE_CUSTOMERS");
  const canOrders = hasAny("CREATE_ORDERS", "EDIT_ORDERS", "VIEW_REPORTS");
  const canStock = hasAny("MANAGE_INVENTORY", "MANAGE_PRODUCTS");

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const headers = { "Content-Type": "application/json", ...authHeader(token) };

    // Start of today in ISO format for the "Inquiries Today" count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Total dealer count
    if (canCustomers) {
      fetch(`${API_BASE}/admin/dealers?limit=1`, { headers })
        .then((r) => r.json())
        .then((d) => setStats((s) => ({ ...s, dealers: d.pagination?.total ?? 0 })))
        .catch(() => {});
    }

    // Inquiries submitted today + recent inquiries
    if (canOrders) {
      fetch(
        `${API_BASE}/admin/inquiries?limit=1&from=${todayStart.toISOString()}&to=${tomorrowStart.toISOString()}`,
        { headers }
      )
        .then((r) => r.json())
        .then((d) => setStats((s) => ({ ...s, inquiriesToday: d.pagination?.total ?? 0 })))
        .catch(() => {});

      fetch(`${API_BASE}/admin/inquiries?limit=5&page=1`, { headers })
        .then((r) => r.json())
        .then((d) => setInquiries(d.data ?? []))
        .catch(() => {})
        .finally(() => setInquiriesLoading(false));
    } else {
      setInquiriesLoading(false);
    }

    // Stock stats + alerts
    if (canStock) {
      fetch(`${API_BASE}/admin/products/stock-summary`, { headers })
        .then((r) => r.json())
        .then((d) => {
          const summary: Array<{ stockStatus: string; _count: { stockStatus: number } }> = d.data || [];
          const low = summary.find((s) => s.stockStatus === "LOW_STOCK")?._count.stockStatus ?? 0;
          const out = summary.find((s) => s.stockStatus === "OUT_OF_STOCK")?._count.stockStatus ?? 0;
          setStats((s) => ({ ...s, lowStock: low, outOfStock: out }));
        })
        .catch(() => {});

      Promise.all([
        fetch(`${API_BASE}/admin/products?stockStatus=LOW_STOCK&limit=5`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/admin/products?stockStatus=OUT_OF_STOCK&limit=5`, { headers }).then((r) => r.json()),
      ])
        .then(([lowRes, outRes]) => {
          const lowItems: StockAlertProduct[] = (lowRes.products || []).map((p: { name: string; sku: string }) => ({ ...p, status: "LOW_STOCK" }));
          const outItems: StockAlertProduct[] = (outRes.products || []).map((p: { name: string; sku: string }) => ({ ...p, status: "OUT_OF_STOCK" }));
          setStockAlerts([...lowItems, ...outItems].slice(0, 8));
        })
        .catch(() => {})
        .finally(() => setStockAlertsLoading(false));
    } else {
      setStockAlertsLoading(false);
    }
  }, [canCustomers, canOrders, canStock]);

  return (
    <div>
      {/* Stats Row — 2-up on mobile, 4-up on desktop */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        {canCustomers && (
        <StatCard
          value={stats.dealers}
          label="Total Dealers"
          accent="#1A1A2E"
          href="/admin/dealers"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        )}
        {canOrders && (
        <StatCard
          value={stats.inquiriesToday}
          label="Inquiries Today"
          accent="#F47920"
          href="/admin/orders"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="12" y2="17" />
            </svg>
          }
        />
        )}
        {canStock && (<>
        <StatCard
          value={stats.lowStock}
          label="Low Stock Products"
          accent="#F59E0B"
          href="/admin/products?stockStatus=LOW_STOCK"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
        />
        <StatCard
          value={stats.outOfStock}
          label="Out of Stock"
          accent="#DC2626"
          href="/admin/products?stockStatus=OUT_OF_STOCK"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }
        />
        </>)}
      </div>

      {/* Main content — single column on mobile, two columns on desktop */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
          gap: isMobile ? 16 : 20,
          alignItems: "start",
        }}
      >
        {/* Recent Inquiries Table */}
        {canOrders && (
        <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>Recent Inquiries</div>
            <a href="/admin/orders" style={{ fontSize: 12, color: "#F47920", fontWeight: 600, textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F0EDEA" }}>
                  {["Dealer Name", "Shop", "Items", "Time", "Status", "Action"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inquiriesLoading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "24px 14px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>
                      Loading…
                    </td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "24px 14px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>
                      No inquiries yet
                    </td>
                  </tr>
                ) : (
                  inquiries.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{row.dealer.ownerName}</td>
                      <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>{row.dealer.shopName}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{Array.isArray(row.cartSnapshot) ? row.cartSnapshot.length : 0}</td>
                      <td style={{ padding: "10px 14px", color: "#6B6B7D", whiteSpace: "nowrap" }}>{timeAgo(row.createdAt)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <a
                          href={`/admin/orders`}
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #E8E4DE",
                            background: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1A1A2E",
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Low Stock Alert Panel */}
        {canStock && (
        <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="#F59E0B" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>Stock Alerts</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {stockAlertsLoading ? (
              <div style={{ padding: "24px 20px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>Loading…</div>
            ) : stockAlerts.length === 0 ? (
              <div style={{ padding: "24px 20px", textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>All products in stock</div>
            ) : (
              stockAlerts.map((p, i) => (
                <div key={p.sku} style={{ padding: "12px 20px", borderBottom: i < stockAlerts.length - 1 ? "1px solid #F0EDEA" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#6B6B7D", fontFamily: "monospace", marginTop: 2 }}>{p.sku}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge status={p.status} />
                    <a
                      href={`/admin/products`}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 5,
                        border: "1px solid #F47920",
                        background: "transparent",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#F47920",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      Update
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default AdminGuard(DashboardContent);
