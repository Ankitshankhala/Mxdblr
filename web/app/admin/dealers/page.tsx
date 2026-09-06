"use client";

/**
 * Admin dealers page (route: /admin/dealers). Lists dealer/customer accounts with
 * server-side filtering, search, sorting, pagination, and export, plus moderation
 * actions — approve / block / suspend (PUT /api/admin/dealers/:id/moderate).
 * Wrapped in AdminGuard.
 *
 * Filtering is server-side (GET /api/admin/dealers?…): State→District→City cascade,
 * Business Type, Status, global search (name/shop/mobile/GST/ID), registration date
 * range, sort, and pagination. Active filters are mirrored into the URL query string
 * so they survive refresh/back-navigation (spec §11). Export (CSV/Excel) streams the
 * SAME filtered set from GET /api/admin/dealers/export.
 *
 * Scope note: filters cover the columns that exist on the Dealer model. Rating,
 * verification, last-login, created-by, email, PENDING status and per-dealer product
 * categories are not part of the data model and are intentionally absent.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminGuard from "@/components/admin/AdminGuard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useToast } from "@/components/admin/Toast";

type DealerStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "REJECTED";

interface ApiDealer {
  id: string;
  ownerName: string;
  shopName: string;
  mobile: string;
  gstNumber: string | null;
  city: string;
  tehsil: string;
  district: string;
  state: string;
  pincode: string;
  businessType: string;
  status: DealerStatus;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface FilterOptions {
  states: string[];
  districts: string[];
  cities: string[];
  businessTypes: string[];
  statuses: string[];
  sortFields: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getAdminToken(): string {
  return (typeof window !== "undefined" && localStorage.getItem("adminToken")) || "";
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getAdminToken()}` };
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  RETAIL_SHOP: "Retail Shop",
  WHOLESALER: "Wholesaler",
  DISTRIBUTOR: "Distributor",
  REPAIR_SHOP: "Repair Shop",
  ONLINE_SELLER: "Online Seller",
  MOBILE_ACCESSORIES_STORE: "Mobile Accessories Store",
};
const btLabel = (v: string) => BUSINESS_TYPE_LABELS[v] ?? v;
const statusLabel = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

const SORT_LABELS: Record<string, string> = {
  date: "Registration Date",
  updated: "Last Updated",
  name: "Dealer Name",
  shop: "Shop Name",
  state: "State",
  city: "City",
  district: "District",
};

const STATUS_ACTIONS: Record<DealerStatus, DealerStatus[]> = {
  ACTIVE: ["SUSPENDED", "BLOCKED", "REJECTED"],
  SUSPENDED: ["ACTIVE", "BLOCKED", "REJECTED"],
  BLOCKED: ["ACTIVE", "REJECTED"],
  REJECTED: ["ACTIVE"],
};
const ACTION_TO_MODERATION: Record<DealerStatus, "SUSPEND" | "BLOCK" | "REJECT" | "ACTIVATE"> = {
  ACTIVE: "ACTIVATE",
  SUSPENDED: "SUSPEND",
  BLOCKED: "BLOCK",
  REJECTED: "REJECT",
};
const ACTION_LABELS: Record<DealerStatus, string> = {
  ACTIVE: "Activate",
  SUSPENDED: "Suspend",
  BLOCKED: "Block",
  REJECTED: "Reject",
};

interface Filters {
  search: string;
  state: string;
  district: string;
  city: string;
  businessType: string;
  status: string;
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  search: "", state: "", district: "", city: "", businessType: "",
  status: "", from: "", to: "", sort: "date", dir: "desc", page: 1,
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE",
  fontSize: 13, background: "#fff", color: "#1F1813", fontFamily: "inherit",
  outline: "none", width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6E6257", textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 5,
};

function filtersFromParams(sp: URLSearchParams): Filters {
  const dir = sp.get("dir");
  return {
    search: sp.get("search") ?? "",
    state: sp.get("state") ?? "",
    district: sp.get("district") ?? "",
    city: sp.get("city") ?? "",
    businessType: sp.get("businessType") ?? "",
    status: sp.get("status") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    sort: sp.get("sort") ?? "date",
    dir: dir === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1),
  };
}

function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.state) p.set("state", f.state);
  if (f.district) p.set("district", f.district);
  if (f.city) p.set("city", f.city);
  if (f.businessType) p.set("businessType", f.businessType);
  if (f.status) p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.sort && f.sort !== "date") p.set("sort", f.sort);
  if (f.dir !== "desc") p.set("dir", f.dir);
  if (f.page > 1) p.set("page", String(f.page));
  return p.toString();
}

function DealersContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [dealers, setDealers] = useState<ApiDealer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [options, setOptions] = useState<FilterOptions>({
    states: [], districts: [], cities: [], businessTypes: [], statuses: [], sortFields: [],
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ dealerId: string; newStatus: DealerStatus } | null>(null);
  const [viewDealer, setViewDealer] = useState<ApiDealer | null>(null);
  const [moderating, setModerating] = useState(false);

  // Reflect the applied filters into the URL so refresh/back preserves them.
  const syncUrl = useCallback((f: Filters) => {
    const q = filtersToQuery(f);
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }, [router]);

  // ── data loads ──────────────────────────────────────────────────────────────
  const fetchDealers = useCallback(async (f: Filters) => {
    setLoading(true);
    setFetchError("");
    try {
      const q = new URLSearchParams(filtersToQuery(f));
      const res = await fetch(`${API}/admin/dealers?${q.toString()}`, {
        headers: authHeaders(), cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDealers(json.data ?? []);
      if (json.pagination) setPagination(json.pagination);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load dealers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Cascade options depend on the selected state/district (so City lists only
  // cities in the chosen district, etc.).
  const fetchOptions = useCallback(async (state: string, district: string) => {
    try {
      const q = new URLSearchParams();
      if (state) q.set("state", state);
      if (district) q.set("district", district);
      const res = await fetch(`${API}/admin/dealers/filters/options?${q.toString()}`, {
        headers: authHeaders(), cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) setOptions(json.data);
    } catch {
      /* options are best-effort; filtering still works without them */
    }
  }, []);

  // Initial + whenever the *applied* filters change (via Apply / paging / sort).
  useEffect(() => { fetchDealers(filters); }, [fetchDealers, filters]);
  useEffect(() => { fetchOptions(filters.state, filters.district); }, [fetchOptions, filters.state, filters.district]);

  // ── filter panel local state (only committed on Apply) ───────────────────────
  const [draft, setDraft] = useState<Filters>(filters);
  useEffect(() => { setDraft(filters); }, [filters]);

  // Reset dependent levels when a parent changes.
  function setDraftField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value, page: 1 };
      if (key === "state") { next.district = ""; next.city = ""; }
      if (key === "district") { next.city = ""; }
      return next;
    });
    // Fetch child options immediately for a snappy cascade.
    if (key === "state") fetchOptions(value as string, "");
    if (key === "district") fetchOptions(draft.state, value as string);
  }

  function applyFilters() {
    const applied = { ...draft, page: 1 };
    setFilters(applied);
    syncUrl(applied);
  }

  function resetFilters() {
    setDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    syncUrl(DEFAULT_FILTERS);
    fetchOptions("", "");
  }

  function goToPage(page: number) {
    const next = { ...filters, page };
    setFilters(next);
    syncUrl(next);
  }

  function changeSort(sort: string, dir: "asc" | "desc") {
    const next = { ...filters, sort, dir, page: 1 };
    setFilters(next);
    setDraft(next);
    syncUrl(next);
  }

  // Active-filter tags: each removable chip clears one applied filter.
  const activeTags: { key: keyof Filters; label: string }[] = [];
  if (filters.search) activeTags.push({ key: "search", label: `Search: "${filters.search}"` });
  if (filters.state) activeTags.push({ key: "state", label: `State: ${filters.state}` });
  if (filters.district) activeTags.push({ key: "district", label: `District: ${filters.district}` });
  if (filters.city) activeTags.push({ key: "city", label: `City: ${filters.city}` });
  if (filters.businessType) activeTags.push({ key: "businessType", label: `Type: ${btLabel(filters.businessType)}` });
  if (filters.status) activeTags.push({ key: "status", label: `Status: ${statusLabel(filters.status)}` });
  if (filters.from) activeTags.push({ key: "from", label: `From: ${filters.from}` });
  if (filters.to) activeTags.push({ key: "to", label: `To: ${filters.to}` });

  function clearTag(key: keyof Filters) {
    const next: Filters = { ...filters, [key]: "", page: 1 };
    // Clearing a parent clears its children too.
    if (key === "state") { next.district = ""; next.city = ""; }
    if (key === "district") { next.city = ""; }
    setFilters(next);
    setDraft(next);
    syncUrl(next);
  }

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(true);
    try {
      const q = new URLSearchParams(filtersToQuery(filters));
      q.set("format", format);
      const res = await fetch(`${API}/admin/dealers/export?${q.toString()}`, {
        headers: authHeaders(), cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dealers-${new Date().toISOString().slice(0, 10)}.${format === "xlsx" ? "xls" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported ${pagination.total} dealer(s) as ${format.toUpperCase()}`);
    } catch (err: unknown) {
      showToast(`Export failed: ${err instanceof Error ? err.message : "unknown"}`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function applyModeration() {
    if (!confirmAction) return;
    setModerating(true);
    try {
      const res = await fetch(`${API}/admin/dealers/${confirmAction.dealerId}/moderate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: ACTION_TO_MODERATION[confirmAction.newStatus] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Dealer status updated to ${confirmAction.newStatus}`);
      setConfirmAction(null);
      setOpenMenu(null);
      await fetchDealers(filters);
    } catch (err: unknown) {
      showToast(`Error: ${err instanceof Error ? err.message : "Failed to update dealer"}`, "error");
    } finally {
      setModerating(false);
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // Debounced live search — typing updates the draft; Enter or Apply commits.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearchChange(value: string) {
    setDraft((d) => ({ ...d, search: value, page: 1 }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const next = { ...filters, search: value, page: 1 };
      setFilters(next);
      syncUrl(next);
    }, 400);
  }

  return (
    <div>
      {/* Header + export */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>Dealers</h1>
          <p style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>
            {pagination.total} dealer(s){activeTags.length ? " matching filters" : ""}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleExport("csv")} disabled={exporting || pagination.total === 0}
            style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 700, cursor: exporting ? "wait" : "pointer", opacity: pagination.total === 0 ? 0.5 : 1 }}>
            ⬇ CSV
          </button>
          <button onClick={() => handleExport("xlsx")} disabled={exporting || pagination.total === 0}
            style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 700, cursor: exporting ? "wait" : "pointer", opacity: pagination.total === 0 ? 0.5 : 1 }}>
            ⬇ Excel
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <svg width="14" height="14" fill="none" stroke="#6E6257" strokeWidth="2" viewBox="0 0 24 24"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={draft.search} onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            placeholder="Search name, shop, mobile, GST, or dealer ID…"
            aria-label="Search dealers"
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label htmlFor="sort" style={{ fontSize: 12, color: "#6E6257", fontWeight: 600 }}>Sort</label>
          <select id="sort" value={filters.sort} onChange={(e) => changeSort(e.target.value, filters.dir)}
            style={{ ...inputStyle, width: "auto" }}>
            {Object.keys(SORT_LABELS).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
          <button onClick={() => changeSort(filters.sort, filters.dir === "asc" ? "desc" : "asc")}
            title={filters.dir === "asc" ? "Ascending" : "Descending"}
            aria-label={`Sort direction: ${filters.dir === "asc" ? "ascending" : "descending"}`}
            style={{ ...inputStyle, width: 40, cursor: "pointer", fontWeight: 700 }}>
            {filters.dir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="f-state">State</label>
            <select id="f-state" value={draft.state} onChange={(e) => setDraftField("state", e.target.value)} style={inputStyle}>
              <option value="">All States</option>
              {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-district">District</label>
            <select id="f-district" value={draft.district} onChange={(e) => setDraftField("district", e.target.value)} disabled={!draft.state} style={{ ...inputStyle, opacity: draft.state ? 1 : 0.6 }}>
              <option value="">{draft.state ? "All Districts" : "Select state first"}</option>
              {options.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-city">City / Area</label>
            <select id="f-city" value={draft.city} onChange={(e) => setDraftField("city", e.target.value)} disabled={!draft.state} style={{ ...inputStyle, opacity: draft.state ? 1 : 0.6 }}>
              <option value="">{draft.state ? "All Cities" : "Select state first"}</option>
              {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-type">Dealer Type</label>
            <select id="f-type" value={draft.businessType} onChange={(e) => setDraftField("businessType", e.target.value)} style={inputStyle}>
              <option value="">All Types</option>
              {options.businessTypes.map((t) => <option key={t} value={t}>{btLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-status">Status</label>
            <select id="f-status" value={draft.status} onChange={(e) => setDraftField("status", e.target.value)} style={inputStyle}>
              <option value="">All Statuses</option>
              {options.statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-from">Registered From</label>
            <input id="f-from" type="date" value={draft.from} onChange={(e) => setDraftField("from", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="f-to">Registered To</label>
            <input id="f-to" type="date" value={draft.to} onChange={(e) => setDraftField("to", e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={resetFilters}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Reset Filters
          </button>
          <button onClick={applyFilters} className="btn-orange"
            style={{ padding: "9px 22px", fontSize: 13 }}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Active filter tags */}
      {activeTags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#6E6257", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active:</span>
          {activeTags.map((t) => (
            <button key={t.key} onClick={() => clearTag(t.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, border: "1px solid #E8E4DE", background: "#F8F6F2", color: "#1F1813", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {t.label}<span aria-hidden style={{ color: "#DC2626", fontWeight: 800 }}>×</span>
            </button>
          ))}
          <button onClick={resetFilters} style={{ fontSize: 12, color: "#F47920", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Clear all</button>
        </div>
      )}

      {/* Table / states */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>Loading dealers…</div>
      ) : fetchError ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "#DC2626", fontWeight: 600, marginBottom: 16 }}>{fetchError}</p>
          <button onClick={() => fetchDealers(filters)} className="btn-orange" style={{ padding: "9px 20px", fontSize: 13 }}>Retry</button>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }} onClick={() => setOpenMenu(null)}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                  {["Name", "Shop", "Mobile", "District", "City", "State", "Type", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6E6257", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.ownerName}</td>
                    <td style={{ padding: "10px 14px", color: "#6E6257" }}>{d.shopName}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{d.mobile}</td>
                    <td style={{ padding: "10px 14px", color: "#6E6257" }}>{d.district}</td>
                    <td style={{ padding: "10px 14px", color: "#6E6257" }}>{d.city}</td>
                    <td style={{ padding: "10px 14px", color: "#6E6257" }}>{d.state}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#EEF0FE", color: "#6366F1", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{btLabel(d.businessType)}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}><StatusBadge status={d.status} /></td>
                    <td style={{ padding: "10px 14px", color: "#6E6257", whiteSpace: "nowrap" }}>{fmtDate(d.createdAt)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === d.id ? null : d.id)}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          Actions
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {openMenu === d.id && (
                          <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #E8E4DE", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 160, overflow: "hidden" }}>
                            <button onClick={() => { setViewDealer(d); setOpenMenu(null); }}
                              style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#1F1813" }}>
                              View Details
                            </button>
                            {STATUS_ACTIONS[d.status].map((action) => (
                              <button key={action} onClick={() => setConfirmAction({ dealerId: d.id, newStatus: action })}
                                style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left", fontSize: 13, cursor: "pointer", fontWeight: 600, color: action === "BLOCKED" ? "#DC2626" : action === "REJECTED" ? "#6E6257" : action === "SUSPENDED" ? "#F59E0B" : "#2E7D32" }}>
                                {ACTION_LABELS[action]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {dealers.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#6E6257" }}>No dealers match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6E6257" }}>
              Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} total
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.5 : 1 }}>
                Previous
              </button>
              <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: pagination.page >= pagination.pages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.pages ? 0.5 : 1 }}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm moderation modal */}
      {confirmAction && (() => {
        const dealer = dealers.find((d) => d.id === confirmAction.dealerId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 380, width: "90%", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{ACTION_LABELS[confirmAction.newStatus]} Dealer?</div>
              <div style={{ fontSize: 13, color: "#6E6257", marginBottom: 20 }}>
                Are you sure you want to <strong>{ACTION_LABELS[confirmAction.newStatus].toLowerCase()}</strong> dealer <strong>{dealer?.ownerName}</strong>?
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmAction(null)} disabled={moderating}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={applyModeration} disabled={moderating}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: confirmAction.newStatus === "BLOCKED" || confirmAction.newStatus === "REJECTED" ? "#DC2626" : "#2E7D32", color: "#fff", fontWeight: 700, fontSize: 13, cursor: moderating ? "not-allowed" : "pointer", opacity: moderating ? 0.7 : 1 }}>
                  {moderating ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View dealer modal */}
      {viewDealer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460 }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Dealer Details</div>
              <button onClick={() => setViewDealer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257", fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {([
                ["Dealer ID", viewDealer.id],
                ["Name", viewDealer.ownerName],
                ["Shop Name", viewDealer.shopName],
                ["Mobile", viewDealer.mobile],
                ["GST Number", viewDealer.gstNumber || "—"],
                ["City", viewDealer.city],
                ["District", viewDealer.district],
                ["State", viewDealer.state],
                ["Pincode", viewDealer.pincode],
                ["Business Type", btLabel(viewDealer.businessType)],
                ["Joined", fmtDate(viewDealer.createdAt)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EDEA", fontSize: 13, gap: 16 }}>
                  <span style={{ color: "#6E6257", fontWeight: 500, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                <span style={{ color: "#6E6257", fontWeight: 500 }}>Status</span>
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
