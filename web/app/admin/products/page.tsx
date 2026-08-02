"use client";

/**
 * Admin product management page (route: /admin/products). List with search/
 * filter, create/edit forms (image upload via POST /api/admin/upload), stock
 * updates, new-arrival/best-seller toggles, and CSV import. Wrapped in AdminGuard.
 */
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import AdminGuard from "@/components/admin/AdminGuard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useToast } from "@/components/admin/Toast";

type Attribute = { key: string; value: string };

type Product = {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: any;
  categoryId: string;
  moq: number;
  stockStatus: string;
  stockQty: number;
  active: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  images: string[];
  description: string;
  attributes: any[];
  features?: any[];
  featureSlugs?: string[];
};

interface AdminFeature {
  id: string;
  name: string;
  slug: string;
  logo: string;
  category: string;
}

function getCategoryName(cat: any): string {
  if (!cat) return "";
  if (typeof cat === "string") return cat;
  return cat.name || "";
}

const STOCK_OPTIONS = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];
const PAGE_SIZES = [10, 25, 50, 100];

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First" },
  { value: "oldest",     label: "Oldest First" },
  { value: "name_asc",   label: "Name A–Z" },
  { value: "name_desc",  label: "Name Z–A" },
  { value: "sku_asc",    label: "SKU A–Z" },
  { value: "stock_high", label: "Stock ↑" },
  { value: "stock_low",  label: "Stock ↓" },
];

interface ApiCategory { id: string; name: string; slug: string; }

const EMPTY_PRODUCT: Omit<Product, "id"> = {
  name: "", brand: "MXD", sku: "", category: "", categoryId: "", moq: 10,
  stockStatus: "IN_STOCK", stockQty: 0, active: true, isNewArrival: false, isBestSeller: false,
  images: [], description: "", attributes: [{ key: "", value: "" }], featureSlugs: [],
};

const CSV_TEMPLATE =
  `category,name,sku,brand,description,moq,image_urls\r\n` +
  `Earphones,MXD-M8,MXD-M8,MXD,"10mm speaker earphone with 3.5mm jack",10,https://example.com/image1.jpg|https://example.com/image2.jpg\r\n`;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Ellipsis pagination: always shows first/last 2 pages + window around current
function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total - 1, total];
  if (current >= total - 3) return [1, 2, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, 2, "...", current - 1, current, current + 1, "...", total - 1, total];
}

function ProductsContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // ── Server-side data state ──────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Filter + pagination state ───────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState(() => searchParams.get("stockStatus") ?? "");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // ── Supporting state ────────────────────────────────────────────────────────
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Add / Edit modal ────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(EMPTY_PRODUCT);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // ── CSV import modal ────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  type ImportStep = "upload" | "map" | "result";
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const IMPORT_FIELDS: { key: string; label: string; required: boolean }[] = [
    { key: "name",        label: "Product Name",  required: true  },
    { key: "category",    label: "Category",       required: false },
    { key: "sku",         label: "SKU",            required: false },
    { key: "brand",       label: "Brand",          required: false },
    { key: "description", label: "Description",    required: false },
    { key: "moq",         label: "MOQ",            required: false },
    { key: "image_urls",  label: "Image URLs",     required: false },
  ];
  const [colMap, setColMap] = useState<Record<string, string>>({
    name: "", category: "", sku: "", brand: "", description: "", moq: "", image_urls: "",
  });

  const [apiBrands, setApiBrands] = useState<string[]>([]);
  const [apiFeatures, setApiFeatures] = useState<AdminFeature[]>([]);

  // ── Bulk feature assignment ────────────────────────────────────────────────
  // Row selection is per-page on purpose: selecting rows you cannot see is how
  // people accidentally retag a whole catalog. To cover everything, raise the
  // page size (PAGE_SIZES tops out at 100) or narrow the filters first — the
  // action bar always states exactly how many products will be written.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSlugs, setBulkSlugs] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"add" | "replace" | "remove">("add");
  const [bulkSaving, setBulkSaving] = useState(false);

  const pageIds = products.map((p) => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleRow(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleAllOnPage() {
    setSelectedIds((cur) =>
      allOnPageSelected ? cur.filter((id) => !pageIds.includes(id)) : [...new Set([...cur, ...pageIds])]
    );
  }

  function openBulk() {
    setBulkSlugs([]);
    setBulkMode("add");
    setBulkOpen(true);
  }

  function toggleBulkSlug(slug: string) {
    setBulkSlugs((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  }

  async function applyBulkFeatures() {
    // "replace" with nothing selected is the documented way to clear features;
    // add/remove with nothing selected is a no-op the API rejects, so catch it here.
    if (bulkSlugs.length === 0 && bulkMode !== "replace") {
      showToast("Pick at least one technology", "error");
      return;
    }
    setBulkSaving(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/bulk-features`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productIds: selectedIds, featureSlugs: bulkSlugs, mode: bulkMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Bulk update failed");

      const missing = (data.data?.slugsNotFound ?? []).length;
      showToast(
        `${data.data.updated} product${data.data.updated === 1 ? "" : "s"} updated` +
          (missing > 0 ? ` — ${missing} unknown technolog${missing === 1 ? "y" : "ies"} skipped` : "")
      );
      setBulkOpen(false);
      setSelectedIds([]);
      loadProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bulk update failed", "error");
    } finally {
      setBulkSaving(false);
    }
  }

  // ── Load categories + brands + features once ───────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_BASE}/admin/categories`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setApiCategories(d.data); })
      .catch(() => {});
    fetch(`${API_BASE}/admin/brands`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setApiBrands(d.data.map((b: { name: string }) => b.name)); })
      .catch(() => {});
    fetch(`${API_BASE}/admin/features`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setApiFeatures(d.data.filter((f: AdminFeature & { active?: boolean }) => f.active !== false)); })
      .catch(() => {});
  }, []);

  // ── Server-side fetch ───────────────────────────────────────────────────────
  async function loadProducts(
    page = currentPage,
    size = pageSize,
    q = search,
    stock = stockFilter,
    cat = categoryFilter,
    brand = brandFilter,
    sort = sortBy,
  ) {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const params = new URLSearchParams({ page: String(page), limit: String(size) });
      if (q.trim())    params.set("search", q.trim());
      if (stock)       params.set("stockStatus", stock);
      if (cat)         params.set("category", cat);
      if (brand.trim()) params.set("brand", brand.trim());
      if (sort !== "newest") params.set("sortBy", sort);
      const res = await fetch(`${API_BASE}/admin/products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProducts(data.data || []);
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
      setCurrentPage(page);
    } catch { showToast("Failed to load products", "error"); }
    finally { setLoading(false); }
  }

  // Initial load
  useEffect(() => { loadProducts(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Re-fetch when filters/sort/pageSize change (reset to page 1)
  function applyFilter(overrides: {
    stock?: string; cat?: string; brand?: string; sort?: string; size?: number;
  }) {
    const stock = overrides.stock ?? stockFilter;
    const cat   = overrides.cat   ?? categoryFilter;
    const brand = overrides.brand ?? brandFilter;
    const sort  = overrides.sort  ?? sortBy;
    const size  = overrides.size  ?? pageSize;
    loadProducts(1, size, search, stock, cat, brand, sort);
  }

  // Debounced search
  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadProducts(1, pageSize, val, stockFilter, categoryFilter, brandFilter, sortBy);
    }, 300);
  }

  // Pagination
  function goToPage(pg: number) {
    if (pg < 1 || pg > totalPages) return;
    loadProducts(pg);
  }

  // Showing range
  const showFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showTo   = Math.min(currentPage * pageSize, totalCount);

  // ── Add / Edit handlers ─────────────────────────────────────────────────────
  function openAdd() {
    setEditingProduct(null);
    setForm({ ...EMPTY_PRODUCT, attributes: [{ key: "", value: "" }], featureSlugs: [] });
    setShowModal(true);
  }
  function openEdit(p: Product) {
    setEditingProduct(p);
    const normAttrs: Attribute[] = (p.attributes as any[]).map((a: any) => ({
      key: a.attributeType?.name || a.key || "",
      value: a.value || "",
    }));
    // features come back as [{ feature: { slug, ... }, displayOrder }] — extract ordered slugs.
    const featureSlugs: string[] = ((p.features as any[]) || [])
      .map((link: any) => link.feature?.slug || link.slug)
      .filter(Boolean);
    setForm({
      name: p.name, brand: p.brand, sku: p.sku,
      category: getCategoryName(p.category),
      // Seed the id from the returned category object (or top-level categoryId)
      // so the select is pre-populated and edits preserve the assignment.
      categoryId: (p.category && typeof p.category === "object" ? p.category.id : "") || p.categoryId || "",
      moq: p.moq,
      stockStatus: p.stockStatus, stockQty: p.stockQty ?? 0, active: p.active ?? true, isNewArrival: p.isNewArrival, isBestSeller: p.isBestSeller,
      images: [...p.images], description: p.description, attributes: normAttrs, featureSlugs,
    });
    setShowModal(true);
  }

  function toggleFeature(slug: string) {
    setForm((f) => {
      const cur = f.featureSlugs ?? [];
      return { ...f, featureSlugs: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] };
    });
  }

  async function handleSave() {
    if (!form.name || !form.sku) { showToast("Name and SKU are required", "error"); return; }
    try {
      const token = localStorage.getItem("adminToken");
      const url = editingProduct
        ? `${API_BASE}/admin/products/${editingProduct.id}`
        : `${API_BASE}/admin/products`;
      const attributes = (form.attributes as Attribute[])
        .filter((a) => a.key.trim() !== "")
        .map((a) => ({ name: a.key.trim(), value: a.value }));
      // Build the payload explicitly. The API expects `categoryId` (not the
      // display `category` name), and only when a category is actually selected —
      // sending an empty string would violate the Product→Category foreign key.
      const { category: _categoryName, categoryId, ...rest } = form;
      const payload: Record<string, unknown> = {
        ...rest,
        images: form.images,
        attributes,
      };
      if (categoryId) payload.categoryId = categoryId;
      const res = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || e.message || "Failed"); }
      showToast(editingProduct ? "Product updated" : "Product added");
      setShowModal(false);
      loadProducts();
    } catch (e: any) { showToast(e.message || "Failed to save", "error"); }
  }

  async function handleDelete(id: string) {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Product deleted");
      setShowDeleteConfirm(null);
      loadProducts();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function handleToggleBestSeller(p: Product) {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/${p.id}/best-seller`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isBestSeller: !p.isBestSeller }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(p.isBestSeller ? "Removed from Best Sellers" : "Marked as Best Seller");
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, isBestSeller: !p.isBestSeller } : x));
    } catch { showToast("Failed to update", "error"); }
  }

  async function handleToggleNewArrival(p: Product) {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/${p.id}/new-arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isNewArrival: !p.isNewArrival }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(p.isNewArrival ? "Removed from New Arrivals" : "Marked as New Arrival");
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, isNewArrival: !p.isNewArrival } : x));
    } catch { showToast("Failed to update", "error"); }
  }

  async function handleToggleActive(p: Product) {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/${p.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(p.active ? "Product hidden from storefront" : "Product is now visible");
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, active: !p.active } : x));
    } catch { showToast("Failed to update visibility", "error"); }
  }

  // ── CSV import ──────────────────────────────────────────────────────────────
  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mxd_products_template.csv";
    a.click();
  }

  function parseCSVClient(text: string): Record<string, string>[] {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines: string[] = [];
    let cur = "", inQ = false;
    for (const ch of normalized) {
      if (ch === '"') inQ = !inQ;
      if (ch === "\n" && !inQ) { lines.push(cur); cur = ""; } else cur += ch;
    }
    if (cur.trim()) lines.push(cur);
    if (lines.length < 2) return [];
    function splitLine(line: string): string[] {
      const fields: string[] = [];
      let f = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { f += '"'; i++; } else q = !q; }
        else if (c === ',' && !q) { fields.push(f); f = ""; }
        else f += c;
      }
      fields.push(f);
      return fields;
    }
    const headers = splitLine(lines[0]).map(h => h.trim());
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = splitLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || "").trim(); });
      return row;
    });
  }

  function autoDetectMapping(headers: string[]): Record<string, string> {
    const lower = headers.map(h => h.toLowerCase());
    function best(candidates: string[]): string {
      for (const c of candidates) {
        const idx = lower.indexOf(c);
        if (idx !== -1) return headers[idx];
      }
      return "";
    }
    return {
      name:        best(["name", "product name", "product_name", "title"]),
      category:    best(["category", "category name", "cat"]),
      sku:         best(["sku", "product sku", "product_sku", "code", "item code"]),
      brand:       best(["brand", "brand name", "manufacturer"]),
      description: best(["description", "desc", "details"]),
      moq:         best(["moq", "min qty", "minimum order", "min_qty"]),
      image_urls:  best(["image_urls", "image url", "images", "image", "photo", "photo_url"]),
    };
  }

  async function handleFileSelectedForMapping(file: File) {
    setCsvFile(file);
    const text = await file.text();
    const rows = parseCSVClient(text);
    if (rows.length === 0) { showToast("CSV is empty or unreadable", "error"); return; }
    const headers = Object.keys(rows[0]);
    setCsvHeaders(headers);
    setCsvRows(rows);
    setColMap(autoDetectMapping(headers));
    setImportStep("map");
  }

  function buildNormalizedCSV(rows: Record<string, string>[], mapping: Record<string, string>): string {
    const fields = ["name", "category", "sku", "brand", "description", "moq", "image_urls"];
    function esc(v: string): string {
      return v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"` : v;
    }
    const header = fields.join(",");
    const dataLines = rows.map(row =>
      fields.map(f => esc(mapping[f] ? (row[mapping[f]] || "") : "")).join(",")
    );
    return [header, ...dataLines].join("\r\n");
  }

  async function handleImport() {
    if (!colMap.name) { showToast("You must map the Product Name column", "error"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const normalizedCsv = buildNormalizedCSV(csvRows, colMap);
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/products/csv-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ csv: normalizedCsv }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Import failed");
      setImportResult(data);
      setImportStep("result");
      loadProducts(1);
    } catch (e: any) {
      showToast(e.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  function closeImportModal() {
    setShowImportModal(false);
    setCsvFile(null);
    setImportResult(null);
    setImportStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setColMap({ name: "", category: "", sku: "", brand: "", description: "", moq: "", image_urls: "" });
  }

  // ── Image upload helpers ────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const token = localStorage.getItem("adminToken");
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) { showToast(`${file.name} is not a supported image type`, "error"); continue; }
      if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} exceeds 5 MB`, "error"); continue; }
      setUploading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch(`${API_BASE}/admin/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: base64 }),
        });
        const json = await res.json();
        if (!json.success || !json.url) throw new Error(json.message || "Upload failed");
        setForm((f) => ({ ...f, images: [...f.images, json.url] }));
      } catch (e: any) {
        showToast(e.message || `Failed to upload ${file.name}`, "error");
      } finally {
        setUploading(false);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false); }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer.files); }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) { uploadFiles(e.target.files); e.target.value = ""; }
  function removeImage(idx: number) { setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) })); }
  function addAttr() { setForm((f) => ({ ...f, attributes: [...f.attributes, { key: "", value: "" }] })); }
  function updateAttr(idx: number, field: "key" | "value", val: string) {
    setForm((f) => ({ ...f, attributes: f.attributes.map((a, i) => i === idx ? { ...a, [field]: val } : a) }));
  }
  function removeAttr(idx: number) { setForm((f) => ({ ...f, attributes: f.attributes.filter((_, i) => i !== idx) })); }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE", fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 };
  const selectStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 7, border: "1px solid #E8E4DE", fontSize: 12, background: "#fff", color: "#1A1A2E", cursor: "pointer", outline: "none", height: 36 };

  return (
    <div>
      {/* ── Top bar: search + action buttons ─────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <svg width="14" height="14" fill="none" stroke="#6B6B7D" strokeWidth="2" viewBox="0 0 24 24"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name, SKU, brand…"
            style={{ ...inputStyle, paddingLeft: 32, height: 36, padding: "0 12px 0 32px" }}
          />
        </div>
        <button
          onClick={() => { setShowImportModal(true); setImportResult(null); setCsvFile(null); }}
          style={{ padding: "0 14px", height: 36, borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", color: "#1A1A2E", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
          </svg>
          Import CSV
        </button>
        <button onClick={openAdd} className="btn-orange" style={{ padding: "0 16px", height: 36, fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
          + Add Product
        </button>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); applyFilter({ cat: e.target.value }); }}
          style={selectStyle}
        >
          <option value="">All Categories</option>
          {apiCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>

        {/* Brand */}
        <select
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); applyFilter({ brand: e.target.value }); }}
          style={selectStyle}
        >
          <option value="">All Brands</option>
          {apiBrands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Stock status */}
        <select
          value={stockFilter}
          onChange={(e) => { setStockFilter(e.target.value); applyFilter({ stock: e.target.value }); }}
          style={selectStyle}
        >
          <option value="">All Stock</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); applyFilter({ sort: e.target.value }); }}
          style={selectStyle}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Active filter count badge */}
        {(search || stockFilter || categoryFilter || brandFilter) && (
          <button
            onClick={() => {
              setSearch(""); setStockFilter(""); setCategoryFilter(""); setBrandFilter("");
              loadProducts(1, pageSize, "", "", "", "", sortBy);
            }}
            style={{ padding: "0 10px", height: 36, borderRadius: 7, border: "1px solid #F47920", background: "transparent", color: "#F47920", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Clear filters ×
          </button>
        )}
      </div>

      {/* ── Bulk action bar — only present while rows are selected ───────────── */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            background: "#FFF3E8", border: "1px solid #F9C89B", borderRadius: 10,
            padding: "10px 14px", marginBottom: 12,
          }}
        >
          <strong style={{ fontSize: 13, color: "#B8560F" }}>
            {selectedIds.length} product{selectedIds.length === 1 ? "" : "s"} selected
          </strong>
          <button
            type="button"
            onClick={openBulk}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#F47920", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Assign technologies
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, cursor: "pointer", color: "#6B6B7D" }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                <th style={{ padding: "10px 0 10px 14px", width: 34 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label={allOnPageSelected ? "Deselect all rows on this page" : "Select all rows on this page"}
                    style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#F47920" }}
                  />
                </th>
                {["Image", "Name", "Brand", "SKU", "Category", "MOQ", "Stock Status", "Visibility", "Best Seller", "New Arrival", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading products…</td></tr>
              )}
              {!loading && products.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #F0EDEA", background: selectedIds.includes(p.id) ? "#FFFaf5" : undefined }}>
                  <td style={{ padding: "10px 0 10px 14px" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleRow(p.id)}
                      aria-label={`Select ${p.name}`}
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#F47920" }}
                    />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: "#F8F6F2", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <svg width="16" height="16" fill="none" stroke="#6B6B7D" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, maxWidth: 180 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>{p.brand}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#6366F1" }}>{p.sku}</td>
                  <td style={{ padding: "10px 14px", color: "#6B6B7D" }}>{getCategoryName(p.category)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{p.moq}</td>
                  <td style={{ padding: "10px 14px" }}><StatusBadge status={p.stockStatus} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      onClick={() => handleToggleActive(p)}
                      title={p.active ? "Hide from storefront" : "Show on storefront"}
                      aria-pressed={p.active}
                      aria-label={p.active ? `Hide ${p.name} from storefront` : `Show ${p.name} on storefront`}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: p.active ? "1px solid #059669" : "1px solid #E8E4DE",
                        background: p.active ? "#D1FAE5" : "#F3F4F6",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        color: p.active ? "#059669" : "#6B7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.active ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      onClick={() => handleToggleBestSeller(p)}
                      title={p.isBestSeller ? "Remove from Best Sellers" : "Mark as Best Seller"}
                      aria-pressed={p.isBestSeller}
                      aria-label={p.isBestSeller ? `Remove ${p.name} from Best Sellers` : `Mark ${p.name} as Best Seller`}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: p.isBestSeller ? "1px solid #6366F1" : "1px solid #E8E4DE",
                        background: p.isBestSeller ? "#EEF2FF" : "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        color: p.isBestSeller ? "#6366F1" : "#6B6B7D",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.isBestSeller ? "★ Top Pick" : "☆ Add"}
                    </button>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      onClick={() => handleToggleNewArrival(p)}
                      title={p.isNewArrival ? "Remove from New Arrivals" : "Mark as New Arrival"}
                      aria-pressed={p.isNewArrival}
                      aria-label={p.isNewArrival ? `Remove ${p.name} from New Arrivals` : `Mark ${p.name} as New Arrival`}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: p.isNewArrival ? "1px solid #F47920" : "1px solid #E8E4DE",
                        background: p.isNewArrival ? "#FFF3E8" : "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        color: p.isNewArrival ? "#F47920" : "#6B6B7D",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.isNewArrival ? "★ Featured" : "☆ Add"}
                    </button>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}>Edit</button>
                      <button onClick={() => setShowDeleteConfirm(p.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && products.length === 0 && (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table footer: count + rows-per-page + pagination ─────────────── */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>

          {/* Left: count + rows-per-page */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#6B6B7D" }}>
              {totalCount === 0
                ? "No products"
                : `Showing ${showFrom}–${showTo} of ${totalCount} Products`}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#6B6B7D", whiteSpace: "nowrap" }}>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setPageSize(size);
                  applyFilter({ size });
                }}
                style={{ ...selectStyle, height: 28, padding: "0 6px", fontSize: 12 }}
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Right: pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, cursor: currentPage === 1 ? "not-allowed" : "pointer", color: currentPage === 1 ? "#ccc" : "#1A1A2E" }}
              >Prev</button>

              {buildPageRange(currentPage, totalPages).map((pg, i) =>
                pg === "..." ? (
                  <span key={`ellipsis-${i}`} style={{ padding: "4px 6px", fontSize: 12, color: "#6B6B7D", userSelect: "none" }}>…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => goToPage(pg as number)}
                    style={{
                      padding: "4px 9px", borderRadius: 6, border: "1px solid",
                      borderColor: pg === currentPage ? "#F47920" : "#E8E4DE",
                      background: pg === currentPage ? "#F47920" : "#fff",
                      color: pg === currentPage ? "#fff" : "#1A1A2E",
                      fontSize: 12, fontWeight: pg === currentPage ? 700 : 400, cursor: "pointer",
                      minWidth: 32,
                    }}
                  >{pg}</button>
                )
              )}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, cursor: currentPage === totalPages ? "not-allowed" : "pointer", color: currentPage === totalPages ? "#ccc" : "#1A1A2E" }}
              >Next</button>
            </div>
          )}
        </div>
      </div>

      {/* ── CSV Import Modal ───────────────────────────────────────────────────── */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: importStep === "map" ? 560 : 480, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Import Products via CSV</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  {(["upload", "map", "result"] as const).map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: importStep === s ? "#F47920" : i < ["upload", "map", "result"].indexOf(importStep) ? "#22C55E" : "#E8E4DE",
                        color: importStep === s || i < ["upload", "map", "result"].indexOf(importStep) ? "#fff" : "#6B6B7D",
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 11, color: importStep === s ? "#F47920" : "#6B6B7D", fontWeight: importStep === s ? 700 : 400 }}>
                        {s === "upload" ? "Upload" : s === "map" ? "Map Columns" : "Done"}
                      </span>
                      {i < 2 && <div style={{ width: 20, height: 1, background: "#E8E4DE" }} />}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={closeImportModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {importStep === "upload" && (
                <>
                  <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#6B6B7D", lineHeight: 1.7 }}>
                    Upload <strong style={{ color: "#1A1A2E" }}>any CSV file</strong> — you will map your column names in the next step.
                    Multiple images: pipe-separated URLs in your image column.
                  </div>
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelectedForMapping(f); e.target.value = ""; }} />
                  <div onClick={() => csvInputRef.current?.click()}
                    style={{ border: `2px dashed ${csvFile ? "#F47920" : "#E8E4DE"}`, borderRadius: 10, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: csvFile ? "#FFF8F2" : "#FAFAF9", marginBottom: 16 }}>
                    <svg width="28" height="28" fill="none" stroke={csvFile ? "#F47920" : "#A8A39A"} strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 8px", display: "block" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>Click to select CSV file</div>
                    <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 4 }}>Any CSV format — column mapping in the next step</div>
                  </div>
                  <button onClick={downloadTemplate}
                    style={{ background: "none", border: "none", color: "#6366F1", fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
                    </svg>
                    Download CSV Template
                  </button>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={closeImportModal} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </div>
                </>
              )}

              {importStep === "map" && (
                <>
                  <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#6B6B7D" }}>
                    <strong style={{ color: "#1A1A2E" }}>{csvFile?.name}</strong>
                    {" "}— {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} detected. Map your CSV columns to the product fields below.
                  </div>
                  {csvHeaders.length > 0 && (
                    <div style={{ marginBottom: 14, background: "#FAFAF9", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#6B6B7D" }}>
                      <strong style={{ color: "#1A1A2E" }}>Detected columns: </strong>
                      {csvHeaders.map(h => (
                        <code key={h} style={{ background: "#E8E4DE", padding: "1px 5px", borderRadius: 3, marginRight: 4 }}>{h}</code>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {IMPORT_FIELDS.map(field => (
                      <div key={field.key} style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E" }}>
                          {field.label}
                          {field.required && <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span>}
                        </div>
                        <select
                          value={colMap[field.key]}
                          onChange={(e) => setColMap(m => ({ ...m, [field.key]: e.target.value }))}
                          style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${colMap[field.key] ? "#22C55E" : "#E8E4DE"}`, fontSize: 12, background: colMap[field.key] ? "#F0FDF4" : "#fff", color: "#1A1A2E", outline: "none" }}
                        >
                          <option value="">— skip this field —</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}{csvRows[0]?.[h] ? ` (e.g. "${csvRows[0][h].slice(0, 30)}")` : ""}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {!colMap.name && (
                    <div style={{ background: "#FEF2F2", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#DC2626", marginBottom: 14 }}>
                      Product Name is required — please map a column to it.
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <button onClick={() => setImportStep("upload")} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={closeImportModal} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                      <button onClick={handleImport} disabled={!colMap.name || importing} className="btn-orange"
                        style={{ padding: "9px 20px", fontSize: 13, opacity: !colMap.name || importing ? 0.6 : 1, cursor: !colMap.name || importing ? "not-allowed" : "pointer" }}>
                        {importing ? "Importing…" : `Import ${csvRows.length} rows`}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {importStep === "result" && importResult && (
                <div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "#F0FDF4", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#16A34A" }}>{importResult.imported}</div>
                      <div style={{ fontSize: 11, color: "#6B6B7D", fontWeight: 600 }}>NEW PRODUCTS</div>
                    </div>
                    <div style={{ flex: 1, background: "#EFF6FF", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#2563EB" }}>{importResult.updated}</div>
                      <div style={{ fontSize: 11, color: "#6B6B7D", fontWeight: 600 }}>UPDATED</div>
                    </div>
                    <div style={{ flex: 1, background: "#FFF7ED", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#EA580C" }}>{importResult.skipped}</div>
                      <div style={{ fontSize: 11, color: "#6B6B7D", fontWeight: 600 }}>SKIPPED</div>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", marginBottom: 16, maxHeight: 120, overflowY: "auto" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 6 }}>ERRORS</div>
                      {importResult.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#7F1D1D", marginBottom: 2 }}>• {e}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={closeImportModal} className="btn-orange" style={{ padding: "9px 20px", fontSize: 13 }}>Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 360, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Product?</div>
            <div style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editingProduct ? "Edit Product" : "Add Product"}</div>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 18 }}>×</button>
            </div>

            <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Product Name</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. MXD-395 Wireless Headphone" />
                </div>
                <div>
                  <label style={labelStyle}>Compatible Brand</label>
                  <input
                    list="brands-datalist"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    style={inputStyle}
                    placeholder={apiBrands.length ? "Pick or type a brand…" : "e.g. Samsung, Apple, OnePlus"}
                  />
                  <datalist id="brands-datalist">
                    {apiBrands.map((b) => <option key={b} value={b} />)}
                  </datalist>
                  {apiBrands.length === 0 && (
                    <p style={{ fontSize: 11, color: "#F47920", marginTop: 4 }}>
                      No brands added yet — <a href="/admin/brands" style={{ color: "#F47920" }}>add brands first</a>
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>SKU</label>
                  <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} style={inputStyle} placeholder="e.g. MXD-395" />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} style={inputStyle}>
                    <option value="">— Select category —</option>
                    {apiCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>MOQ</label>
                  <input type="number" value={form.moq} onChange={(e) => setForm((f) => ({ ...f, moq: Number(e.target.value) }))} style={inputStyle} min={1} />
                </div>
                <div>
                  <label style={labelStyle}>Stock Status</label>
                  <select value={form.stockStatus} onChange={(e) => setForm((f) => ({ ...f, stockStatus: e.target.value }))} style={inputStyle}>
                    {STOCK_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Stock Quantity</label>
                  <input
                    type="number"
                    value={form.stockQty}
                    onChange={(e) => setForm((f) => ({ ...f, stockQty: Math.max(0, Number(e.target.value)) }))}
                    style={inputStyle}
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Storefront Visibility</label>
                  <select
                    value={form.active ? "visible" : "hidden"}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "visible" }))}
                    style={inputStyle}
                  >
                    <option value="visible">Visible (shown on site)</option>
                    <option value="hidden">Hidden (admin only)</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, height: 70, resize: "vertical" }} placeholder="Short product description…" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Product Images</label>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style={{ display: "none" }} onChange={handleFileChange} />
                  <div onClick={() => !uploading && fileInputRef.current?.click()} onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    style={{ border: `2px dashed ${isDragging ? "#F47920" : "#E8E4DE"}`, borderRadius: 10, padding: "24px 16px", textAlign: "center", cursor: uploading ? "wait" : "pointer", background: isDragging ? "#FFF3E8" : "#FAFAF9", transition: "all 0.15s", userSelect: "none", opacity: uploading ? 0.7 : 1 }}>
                    {uploading ? (
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#F47920" }}>Uploading to Cloudinary…</div>
                    ) : (
                      <>
                        <svg width="32" height="32" fill="none" stroke={isDragging ? "#F47920" : "#A8A39A"} strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 10px" }}>
                          <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                        </svg>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDragging ? "#F47920" : "#1A1A2E" }}>
                          {isDragging ? "Drop images here" : "Click to upload or drag & drop"}
                        </div>
                        <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 4 }}>PNG, JPG, WEBP · Max 5 MB · Uploads to Cloudinary CDN</div>
                      </>
                    )}
                  </div>
                  {form.images.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                      {form.images.map((src, idx) => (
                        <div key={idx} style={{ position: "relative", width: 80, height: 80 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Product image ${idx + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #E8E4DE" }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }} />
                          <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                            aria-label={`Remove image ${idx + 1}`}
                            style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, lineHeight: 1, padding: 0 }}>×</button>
                          {idx === 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "#F47920", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>MAIN</div>}
                        </div>
                      ))}
                      <div onClick={() => !uploading && fileInputRef.current?.click()}
                        style={{ width: 80, height: 80, borderRadius: 8, border: "2px dashed #E8E4DE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: uploading ? "wait" : "pointer", color: "#A8A39A", gap: 4, fontSize: 10, fontWeight: 600 }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add more
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Attributes</label>
                  <button onClick={addAttr} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #F47920", background: "transparent", color: "#F47920", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.attributes.map((attr, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={attr.key} onChange={(e) => updateAttr(idx, "key", e.target.value)} placeholder="Key (e.g. Color)" style={{ ...inputStyle, flex: 1 }} />
                      <input value={attr.value} onChange={(e) => updateAttr(idx, "value", e.target.value)} placeholder="Value (e.g. Black)" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => removeAttr(idx)} aria-label={`Remove attribute ${idx + 1}`} style={{ padding: "6px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", cursor: "pointer", flexShrink: 0 }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supported Technologies — toggle chips from the feature master list */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Supported Technologies</label>
                  <span style={{ fontSize: 11, color: "#A8A39A" }}>
                    {(form.featureSlugs?.length ?? 0)} selected
                  </span>
                </div>
                {apiFeatures.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#A8A39A" }}>
                    No features defined yet. Add them under Product Features.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                    {["CHARGING", "WIRELESS", "CABLE", "DATA", "PROTECTION", "CERTIFICATION"]
                      .map((cat) => ({ cat, items: apiFeatures.filter((f) => f.category === cat) }))
                      .filter((g) => g.items.length > 0)
                      .map(({ cat, items }) => (
                        <div key={cat}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#A8A39A", marginBottom: 6 }}>{cat}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {items.map((f) => {
                              const on = (form.featureSlugs ?? []).includes(f.slug);
                              return (
                                <button
                                  key={f.slug}
                                  type="button"
                                  onClick={() => toggleFeature(f.slug)}
                                  aria-pressed={on}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "5px 10px", borderRadius: 16, cursor: "pointer",
                                    fontSize: 12, fontWeight: 600,
                                    border: on ? "1px solid #F47920" : "1px solid #E8E4DE",
                                    background: on ? "#FFF3E8" : "#fff",
                                    color: on ? "#B8560F" : "#6B6B7D",
                                  }}
                                >
                                  {f.logo && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={f.logo} alt="" width={16} height={16} style={{ objectFit: "contain" }} />
                                  )}
                                  {f.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "#A8A39A", marginTop: 6 }}>
                  Selection order sets which icons show first on the product card (max 4 + “+N more”).
                </p>
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} className="btn-orange" style={{ padding: "9px 20px", fontSize: 13 }}>Save Product</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk "Assign technologies" modal ─────────────────────────────────── */}
      {bulkOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E8E4DE" }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1A1A2E" }}>Assign technologies</h2>
              <p style={{ fontSize: 12, color: "#6B6B7D", marginTop: 3 }}>
                Applies to the {selectedIds.length} selected product{selectedIds.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div style={{ padding: "16px 24px", overflowY: "auto" }}>
              <label style={{ ...labelStyle }}>Mode</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                {([
                  { key: "add", label: "Add", hint: "Keep existing, add these" },
                  { key: "replace", label: "Replace", hint: "These become the full set" },
                  { key: "remove", label: "Remove", hint: "Unlink these only" },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setBulkMode(m.key)}
                    aria-pressed={bulkMode === m.key}
                    title={m.hint}
                    style={{
                      padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
                      border: bulkMode === m.key ? "1px solid #F47920" : "1px solid #E8E4DE",
                      background: bulkMode === m.key ? "#FFF3E8" : "#fff",
                      color: bulkMode === m.key ? "#B8560F" : "#6B6B7D",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#A8A39A", marginBottom: 14 }}>
                {bulkMode === "add" && "Existing technologies are kept; these are appended. Re-running changes nothing."}
                {bulkMode === "replace" && "Existing technologies are discarded. Selecting none clears them entirely."}
                {bulkMode === "remove" && "Only the technologies picked below are unlinked; the rest are kept."}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Technologies</label>
                <span style={{ fontSize: 11, color: "#A8A39A" }}>{bulkSlugs.length} selected</span>
              </div>

              {apiFeatures.length === 0 ? (
                <p style={{ fontSize: 12, color: "#A8A39A" }}>No features defined yet. Add them under Product Features.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["CHARGING", "WIRELESS", "CABLE", "DATA", "PROTECTION", "CERTIFICATION"]
                    .map((cat) => ({ cat, items: apiFeatures.filter((f) => f.category === cat) }))
                    .filter((g) => g.items.length > 0)
                    .map(({ cat, items }) => (
                      <div key={cat}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#A8A39A", marginBottom: 6 }}>{cat}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {items.map((f) => {
                            const on = bulkSlugs.includes(f.slug);
                            return (
                              <button
                                key={f.slug}
                                type="button"
                                onClick={() => toggleBulkSlug(f.slug)}
                                aria-pressed={on}
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  padding: "5px 10px", borderRadius: 16, cursor: "pointer",
                                  fontSize: 12, fontWeight: 600,
                                  border: on ? "1px solid #F47920" : "1px solid #E8E4DE",
                                  background: on ? "#FFF3E8" : "#fff",
                                  color: on ? "#B8560F" : "#6B6B7D",
                                }}
                              >
                                {f.logo && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.logo} alt="" width={16} height={16} style={{ objectFit: "contain" }} />
                                )}
                                {f.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setBulkOpen(false)}
                disabled={bulkSaving}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: bulkSaving ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={applyBulkFeatures}
                disabled={bulkSaving}
                className="btn-orange"
                style={{ padding: "9px 20px", fontSize: 13, opacity: bulkSaving ? 0.6 : 1, cursor: bulkSaving ? "not-allowed" : "pointer" }}
              >
                {bulkSaving ? "Applying…" : `Apply to ${selectedIds.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(ProductsContent);
