"use client";

/**
 * Admin categories page (route: /admin/categories). CRUD over product categories
 * with active toggle and ordering. Wrapped in AdminGuard.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  displayOrder: number;
  productCount: number;
  childrenCount: number;
  activeProductCount: number;
  outOfStockCount: number;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  brand: string;
  stockStatus: StockStatus;
  stockQty: number;
  moq: number;
  images: string | string[];
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7,
  border: "1px solid #E8E4DE", fontSize: 13, background: "#fff",
  color: "#1F1813", fontFamily: "inherit", outline: "none",
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6E6257",
  textTransform: "uppercase", letterSpacing: "0.05em",
  display: "block", marginBottom: 5,
};

const STOCK_COLORS: Record<StockStatus, { bg: string; color: string; label: string }> = {
  IN_STOCK:     { bg: "#E6F3E7", color: "#2E7D32", label: "In Stock" },
  LOW_STOCK:    { bg: "#FFF3E0", color: "#E65100", label: "Low Stock" },
  OUT_OF_STOCK: { bg: "#FCE7E7", color: "#C62828", label: "Out of Stock" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function fromImages(s: string | string[]): string[] {
  if (Array.isArray(s)) return s.filter(Boolean);
  return s ? s.split(",").filter(Boolean) : [];
}

// ── Image Upload Slot ─────────────────────────────────────────────────────────

function ImageUpload({ value, onChange, label, hint, maxH = 120 }: {
  value: string; onChange: (v: string) => void; label?: string; hint?: string; maxH?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { showToast } = useToast();

  const read = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Not an image", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Max 5 MB", "error"); return; }
    const fr = new FileReader();
    fr.onload = (e) => onChange(e.target?.result as string);
    fr.readAsDataURL(file);
  }, [onChange, showToast]);

  return (
    <div>
      {label && <label style={lbl}>{label}</label>}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) read(e.target.files[0]); e.target.value = ""; }} />
      {value ? (
        <div style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" style={{ width: "100%", maxHeight: maxH, objectFit: "contain", objectPosition: "center", borderRadius: 8, border: "1px solid #E8E4DE", display: "block", background: "#F5F3F0" }} />
          <button onClick={() => onChange("")} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <button onClick={() => ref.current?.click()} style={{ position: "absolute", bottom: 6, right: 6, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, border: "none", cursor: "pointer" }}>Change</button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${drag ? "#F47920" : "#E8E4DE"}`, borderRadius: 8, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: drag ? "#FFF3E8" : "#FAFAF9", transition: "all 0.15s" }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>🖼️</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: drag ? "#F47920" : "#1F1813" }}>Click or drag & drop</div>
          {hint && <div style={{ fontSize: 10, color: "#A8A39A", marginTop: 2 }}>{hint}</div>}
        </div>
      )}
    </div>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 999, background: value ? "#F47920" : "#E8E4DE", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: value ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ── Category Form Modal ───────────────────────────────────────────────────────

interface CatFormData {
  name: string; description: string; image: string;
  active: boolean; parentId: string; displayOrder: number;
}

const EMPTY_CAT: CatFormData = { name: "", description: "", image: "", active: true, parentId: "", displayOrder: 0 };

function CategoryModal({ editing, categories, onClose, onSaved }: {
  editing: Category | null; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<CatFormData>(
    editing ? { name: editing.name, description: editing.description, image: editing.image, active: editing.active, parentId: editing.parentId || "", displayOrder: editing.displayOrder } : { ...EMPTY_CAT }
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      const url = editing ? `${API}/admin/categories/${editing.id}` : `${API}/admin/categories`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, parentId: form.parentId || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || "Failed to save", "error");
        return;
      }
      showToast(editing ? "Category updated" : "Category created");
      onSaved();
      onClose();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  const parentOptions = categories.filter((c) => c.id !== editing?.id);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Category" : "New Category"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257", fontSize: 20 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Image */}
          <ImageUpload value={form.image} onChange={(v) => setForm((f) => ({ ...f, image: v }))} label="Category Image" hint="PNG, JPG — max 5 MB" />

          {/* Name */}
          <div>
            <label style={lbl}>Category Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. Wireless Chargers" autoFocus />
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inp, height: 72, resize: "vertical" }} placeholder="What products are in this category?" />
          </div>

          {/* Parent + Display Order */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Parent Category</label>
              <select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} style={inp}>
                <option value="">— Root (no parent) —</option>
                {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Display Order</label>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))} style={inp} min={0} />
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle value={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1F1813" }}>
              {form.active ? "Visible on storefront" : "Hidden from storefront"}
            </span>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick Product Modal ───────────────────────────────────────────────────────

const STOCK_OPTS = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];

function QuickProductModal({ category, onClose, onSaved }: {
  category: Category; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", brand: "MXD", sku: "", description: "", moq: 10, stockStatus: "IN_STOCK", stockQty: 0, image: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { showToast("Product name is required", "error"); return; }
    if (!form.sku.trim()) { showToast("SKU is required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/products`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          brand: form.brand.trim() || "MXD",
          sku: form.sku.trim().toUpperCase(),
          description: form.description,
          moq: form.moq,
          stockStatus: form.stockStatus,
          stockQty: form.stockQty,
          images: form.image ? [form.image] : [],
          categoryId: category.id,
        }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.message || d.errors?.[0]?.message || "Failed to create product", "error"); return; }
      showToast(`"${form.name}" added to ${category.name}`);
      onSaved();
      onClose();
    } catch { showToast("Failed to create product", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Add Product</div>
            <div style={{ fontSize: 11, color: "#6E6257", marginTop: 2 }}>Category: <strong style={{ color: "#F47920" }}>{category.name}</strong> — auto-assigned</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257", fontSize: 20 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <ImageUpload value={form.image} onChange={(v) => setForm((f) => ({ ...f, image: v }))} label="Product Image" hint="PNG, JPG — max 5 MB" maxH={100} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Product Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. MXD Neckband X1" autoFocus />
            </div>
            <div>
              <label style={lbl}>SKU *</label>
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} style={inp} placeholder="MXD-X1" />
            </div>
            <div>
              <label style={lbl}>Brand</label>
              <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} style={inp} placeholder="MXD" />
            </div>
            <div>
              <label style={lbl}>MOQ</label>
              <input type="number" value={form.moq} onChange={(e) => setForm((f) => ({ ...f, moq: Number(e.target.value) }))} style={inp} min={1} />
            </div>
            <div>
              <label style={lbl}>Stock Qty</label>
              <input type="number" value={form.stockQty} onChange={(e) => setForm((f) => ({ ...f, stockQty: Number(e.target.value) }))} style={inp} min={0} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Stock Status</label>
              <select value={form.stockStatus} onChange={(e) => setForm((f) => ({ ...f, stockStatus: e.target.value }))} style={inp}>
                {STOCK_OPTS.map((s) => <option key={s} value={s}>{STOCK_COLORS[s as StockStatus]?.label || s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inp, height: 60, resize: "vertical" }} placeholder="Optional product description" />
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>
            {saving ? "Adding…" : "+ Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Detail Panel ─────────────────────────────────────────────────────

function CategoryDetail({ category, categories, onClose, onRefresh }: {
  category: Category; categories: Category[]; onClose: () => void; onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditCat, setShowEditCat] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  useEffect(() => { loadProducts(); }, [category.id]);

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API}/admin/categories/${category.id}/products?search=${productSearch}`, { headers: authHeaders() });
      const d = await res.json();
      setProducts(d.data || []);
    } catch { showToast("Failed to load products", "error"); }
    finally { setLoadingProducts(false); }
  }

  async function deleteProduct(id: string) {
    try {
      await fetch(`${API}/admin/products/${id}`, { method: "DELETE", headers: authHeaders() });
      showToast("Product deleted");
      setDeleteProductId(null);
      loadProducts();
      onRefresh();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function bulkDeleteProducts() {
    if (!selectedProducts.size) return;
    try {
      await Promise.all([...selectedProducts].map((id) => fetch(`${API}/admin/products/${id}`, { method: "DELETE", headers: authHeaders() })));
      showToast(`${selectedProducts.size} product(s) deleted`);
      setSelectedProducts(new Set());
      loadProducts();
      onRefresh();
    } catch { showToast("Bulk delete failed", "error"); }
  }

  const filtered = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedProducts.has(p.id));

  function toggleAll() {
    if (allSelected) setSelectedProducts(new Set());
    else setSelectedProducts(new Set(filtered.map((p) => p.id)));
  }

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 900 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(720px, 100vw)", background: "#fff", zIndex: 950, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {category.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={category.image} alt={category.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid #E8E4DE" }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1813" }}>{category.name}</div>
            <div style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>
              {category.parent && <span>↳ {category.parent.name} · </span>}
              {category.productCount} product{category.productCount !== 1 ? "s" : ""}
              {category.childrenCount > 0 && ` · ${category.childrenCount} sub-categor${category.childrenCount !== 1 ? "ies" : "y"}`}
            </div>
          </div>
          <button onClick={() => setShowEditCat(true)} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit Category</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E8E4DE", flexShrink: 0 }}>
          {[
            { label: "Total Products", value: category.productCount, color: "#1F1813" },
            { label: "In Stock", value: category.activeProductCount, color: "#2E7D32" },
            { label: "Out of Stock", value: category.outOfStockCount, color: "#C62828" },
            { label: "Sub-categories", value: category.childrenCount, color: "#6366F1" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "12px 16px", borderRight: i < 3 ? "1px solid #E8E4DE" : "none", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#6E6257", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        {category.description && (
          <div style={{ padding: "12px 24px", background: "#FAFAF9", borderBottom: "1px solid #E8E4DE", fontSize: 13, color: "#6E6257", flexShrink: 0 }}>
            {category.description}
          </div>
        )}

        {/* Products section */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Products toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1813", flex: 1 }}>
              Products in {category.name}
              <span style={{ fontWeight: 400, color: "#6E6257", fontSize: 12, marginLeft: 8 }}>{filtered.length} shown</span>
            </div>
            {selectedProducts.size > 0 && (
              <button onClick={bulkDeleteProducts} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Delete {selectedProducts.size} selected
              </button>
            )}
            <button onClick={() => setShowAddProduct(true)} className="btn-orange" style={{ padding: "7px 14px", fontSize: 12 }}>
              + Add Product
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ ...inp, paddingLeft: 34 }}
              placeholder="Search products by name or SKU…"
            />
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" fill="none" stroke="#A8A39A" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </div>

          {/* Products table */}
          {loadingProducts ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>Loading products…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No products yet</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Add your first product to this category.</div>
              <button onClick={() => setShowAddProduct(true)} className="btn-orange" style={{ padding: "9px 20px", fontSize: 13 }}>+ Add Product</button>
            </div>
          ) : (
            <div style={{ border: "1px solid #E8E4DE", borderRadius: 10, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "32px 44px 1fr 90px 90px 90px 80px", alignItems: "center", padding: "8px 12px", background: "#FAFAF9", borderBottom: "1px solid #E8E4DE" }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>Img</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>Name / SKU</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>Brand</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>Stock</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>MOQ</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E6257", textTransform: "uppercase" }}>Actions</div>
              </div>
              {filtered.map((p, idx) => {
                const imgs = fromImages(p.images);
                const sc = STOCK_COLORS[p.stockStatus] || STOCK_COLORS.OUT_OF_STOCK;
                return (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "32px 44px 1fr 90px 90px 90px 80px", alignItems: "center", padding: "10px 12px", borderBottom: idx < filtered.length - 1 ? "1px solid #F0EDEA" : "none", background: selectedProducts.has(p.id) ? "#FFF8F0" : "#fff" }}>
                    <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} style={{ cursor: "pointer" }} />
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: "#F5F3F0", overflow: "hidden", border: "1px solid #E8E4DE" }}>
                      {imgs[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgs[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1F1813", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#A8A39A" }}>{p.sku}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#6E6257" }}>{p.brand}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 999, background: sc.bg, color: sc.color, whiteSpace: "nowrap" }}>{sc.label}</span>
                    <div style={{ fontSize: 12, color: "#1F1813" }}>×{p.moq}</div>
                    <button onClick={() => setDeleteProductId(p.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddProduct && (
        <QuickProductModal category={category} onClose={() => setShowAddProduct(false)} onSaved={() => { loadProducts(); onRefresh(); }} />
      )}
      {showEditCat && (
        <CategoryModal editing={category} categories={categories} onClose={() => setShowEditCat(false)} onSaved={() => { onRefresh(); setShowEditCat(false); }} />
      )}
      {deleteProductId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Product?</div>
            <div style={{ fontSize: 13, color: "#6E6257", marginBottom: 20 }}>This product will be permanently removed.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteProductId(null)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteProduct(deleteProductId)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function CategoriesContent() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [detailCat, setDetailCat] = useState<Category | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/categories`, { headers: authHeaders() });
      const d = await res.json();
      setCategories(d.data || []);
    } catch { showToast("Failed to load categories", "error"); }
    finally { setLoading(false); }
  }

  async function toggleActive(cat: Category) {
    try {
      await fetch(`${API}/admin/categories/${cat.id}/toggle`, { method: "PATCH", headers: authHeaders() });
      showToast(cat.active ? "Category hidden" : "Category activated");
      load();
    } catch { showToast("Failed", "error"); }
  }

  async function deleteCategory(id: string) {
    try {
      const res = await fetch(`${API}/admin/categories/${id}`, { method: "DELETE", headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Cannot delete", "error"); setDeleteCatId(null); return; }
      showToast("Category deleted");
      setDeleteCatId(null);
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function runBulkAction() {
    if (!bulkAction || !selected.size) return;
    try {
      const res = await fetch(`${API}/admin/categories/bulk`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: bulkAction, ids: [...selected] }),
      });
      if (!res.ok) { showToast("Bulk action failed", "error"); return; }
      showToast(`Bulk action applied to ${selected.size} categor${selected.size > 1 ? "ies" : "y"}`);
      setSelected(new Set());
      setBulkAction("");
      load();
    } catch { showToast("Bulk action failed", "error"); }
  }

  const filtered = categories.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleSelect(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>Categories</h1>
          <p style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>
            {categories.length} categories · {categories.reduce((s, c) => s + c.productCount, 0)} total products
          </p>
        </div>
        <button onClick={() => { setEditingCat(null); setShowModal(true); }} className="btn-orange" style={{ padding: "9px 18px", fontSize: 13 }}>
          + Add Category
        </button>
      </div>

      {/* Search + Bulk actions bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} placeholder="Search categories…" />
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" fill="none" stroke="#A8A39A" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </div>
        {selected.size > 0 && (
          <>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160 }}>
              <option value="">Bulk action…</option>
              <option value="activate">Activate</option>
              <option value="deactivate">Deactivate</option>
              <option value="delete">Delete (empty only)</option>
            </select>
            <button onClick={runBulkAction} disabled={!bulkAction} style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid #E8E4DE", background: bulkAction ? "#1F1813" : "#F5F3F0", color: bulkAction ? "#fff" : "#6E6257", fontSize: 13, fontWeight: 600, cursor: bulkAction ? "pointer" : "not-allowed" }}>
              Apply to {selected.size}
            </button>
          </>
        )}
      </div>

      {/* Categories grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6E6257" }}>Loading categories…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6E6257" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{search ? "No categories match your search" : "No categories yet"}</div>
          {!search && <button onClick={() => setShowModal(true)} className="btn-orange" style={{ padding: "9px 20px", marginTop: 8, fontSize: 13 }}>+ Create First Category</button>}
        </div>
      ) : (
        <>
          {/* Select all bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: selected.size > 0 ? "#FFF8F0" : "#FAFAF9", borderRadius: 8, border: "1px solid #E8E4DE" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: "#6E6257" }}>
              {selected.size > 0 ? `${selected.size} selected` : `Select all ${filtered.length}`}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map((cat) => (
              <div
                key={cat.id}
                style={{
                  background: "#fff",
                  border: `1px solid ${selected.has(cat.id) ? "#F47920" : "#E8E4DE"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  opacity: cat.active ? 1 : 0.65,
                  transition: "box-shadow 0.15s, border-color 0.15s",
                  cursor: "default",
                  boxShadow: selected.has(cat.id) ? "0 0 0 2px #F4792022" : "none",
                }}
              >
                {/* Category image */}
                <div
                  onClick={() => setDetailCat(cat)}
                  style={{
                    height: 120,
                    background: "#F5F3F0",
                    position: "relative",
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cat.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cat.image}
                      alt={cat.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "center",
                        padding: "6px",
                        boxSizing: "border-box",
                      }}
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        const fallback = img.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div style={{ display: cat.image ? "none" : "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontSize: 36, position: "absolute", inset: 0 }}>📂</div>
                  {/* Active badge */}
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: cat.active ? "#E6F3E7" : "#F0EDEA", color: cat.active ? "#2E7D32" : "#6E6257" }}>
                    {cat.active ? "ACTIVE" : "HIDDEN"}
                  </span>
                  {/* Checkbox */}
                  <div style={{ position: "absolute", top: 8, left: 8 }} onClick={(e) => { e.stopPropagation(); toggleSelect(cat.id); }}>
                    <input type="checkbox" checked={selected.has(cat.id)} onChange={() => toggleSelect(cat.id)} style={{ cursor: "pointer", width: 15, height: 15 }} />
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "12px 14px" }}>
                  <div onClick={() => setDetailCat(cat)} style={{ cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1813", marginBottom: 2 }}>{cat.name}</div>
                    {cat.parent && <div style={{ fontSize: 11, color: "#A8A39A", marginBottom: 4 }}>↳ {cat.parent.name}</div>}
                    {cat.description && <div style={{ fontSize: 12, color: "#6E6257", marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cat.description}</div>}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1F1813" }}>{cat.productCount} product{cat.productCount !== 1 ? "s" : ""}</span>
                    {cat.activeProductCount > 0 && <span style={{ fontSize: 11, color: "#2E7D32" }}>· {cat.activeProductCount} in stock</span>}
                    {cat.outOfStockCount > 0 && <span style={{ fontSize: 11, color: "#C62828" }}>· {cat.outOfStockCount} out</span>}
                    {cat.childrenCount > 0 && <span style={{ fontSize: 11, color: "#6366F1" }}>· {cat.childrenCount} sub</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => setDetailCat(cat)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1F1813" }}>
                      View & Manage
                    </button>
                    <button onClick={() => toggleActive(cat)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E8E4DE", background: cat.active ? "#FEF3D7" : "#E6F3E7", color: cat.active ? "#D97706" : "#2E7D32", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {cat.active ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => { setEditingCat(cat); setShowModal(true); }} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => setDeleteCatId(cat.id)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Category form modal */}
      {showModal && (
        <CategoryModal
          editing={editingCat}
          categories={categories}
          onClose={() => { setShowModal(false); setEditingCat(null); }}
          onSaved={load}
        />
      )}

      {/* Category detail side panel */}
      {detailCat && (
        <CategoryDetail
          category={detailCat}
          categories={categories}
          onClose={() => setDetailCat(null)}
          onRefresh={() => { load(); setDetailCat((prev) => categories.find((c) => c.id === prev?.id) || prev); }}
        />
      )}

      {/* Delete confirm */}
      {deleteCatId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 360, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Category?</div>
            <div style={{ fontSize: 13, color: "#6E6257", marginBottom: 20 }}>Categories with products or sub-categories cannot be deleted.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteCatId(null)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteCategory(deleteCatId)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(CategoriesContent);
