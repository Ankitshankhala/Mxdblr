"use client";

/**
 * Admin product-features page (route: /admin/features). CRUD over the
 * ProductFeature master list — the central catalogue of supported technologies
 * (fast-charge standards, wireless, cable types, data speeds, protections,
 * certifications) that products reference by slug. Grouped by category. Wrapped
 * in AdminGuard. Mirrors the /admin/brands convention.
 *
 * Media: each feature has an ICON (`logo`) and an optional IMAGE (`image`), plus a
 * `displayMode` (ICON | IMAGE | BOTH). Both assets support upload (file picker +
 * drag-drop, with preview / replace / remove) and "Choose from Library" (assets
 * already used by other features, from GET /admin/features/library). Uploads go
 * through POST /admin/upload — PNG/JPG/WebP/GIF pass through; SVG is sanitized
 * server-side before storage.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

type FeatureCategory = "CHARGING" | "WIRELESS" | "CABLE" | "DATA" | "PROTECTION" | "CERTIFICATION";
type DisplayMode = "ICON" | "IMAGE" | "BOTH";

interface Feature {
  id: string;
  name: string;
  slug: string;
  logo: string;   // icon
  image: string;  // larger photo
  displayMode: DisplayMode;
  category: FeatureCategory;
  description: string;
  active: boolean;
  displayOrder: number;
  productCount?: number;
}

interface LibraryAsset {
  url: string;
  kind: "icon" | "image";
  name: string;
  category: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const CATEGORIES: { value: FeatureCategory; label: string }[] = [
  { value: "CHARGING", label: "Charging" },
  { value: "WIRELESS", label: "Wireless" },
  { value: "CABLE", label: "Cable / Connector" },
  { value: "DATA", label: "Data Transfer" },
  { value: "PROTECTION", label: "Protection" },
  { value: "CERTIFICATION", label: "Certification" },
];

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: "ICON", label: "Icon only" },
  { value: "IMAGE", label: "Image only" },
  { value: "BOTH", label: "Icon + Image" },
];

// Accepted upload types (raster pass through; SVG is sanitized server-side).
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const ACCEPT_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

const EMPTY: Omit<Feature, "id"> = {
  name: "", slug: "", logo: "", image: "", displayMode: "ICON",
  category: "CHARGING", description: "", active: true, displayOrder: 0,
};

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #E8E4DE",
  fontSize: 13, background: "#fff", color: "#1A1A2E", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6B6B7D", textTransform: "uppercase",
  letterSpacing: "0.05em", display: "block", marginBottom: 5,
};

function authHeaders(json = true): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : "";
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { Authorization: `Bearer ${token}` };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target?.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Small preview box that renders an icon/image URL or a data-URI, with a fallback. */
function AssetThumb({ url, size = 40, rounded = 7 }: { url: string; size?: number; rounded?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span style={{ width: size, height: size, borderRadius: rounded, border: "1px solid #E8E4DE", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ objectFit: "contain", padding: 3, width: "100%", height: "100%" }} onError={() => setBroken(true)} />
      ) : (
        <span style={{ fontSize: 10, color: "#A8A39A" }}>—</span>
      )}
    </span>
  );
}

/**
 * One media slot (Icon or Image): upload (click or drag-drop), preview,
 * replace/remove, and "Choose from Library". `value` is the stored URL/data-URI;
 * `onChange("")` clears it.
 */
function AssetField({
  kind, value, onChange, onOpenLibrary,
}: {
  kind: "icon" | "image";
  value: string;
  onChange: (v: string) => void;
  onOpenLibrary: () => void;
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const label = kind === "icon" ? "Icon" : "Image";

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPT_EXT.test(file.name) && !ACCEPT.includes(file.type)) {
      showToast(`${label}: unsupported type. Use PNG, JPG, WebP, GIF or SVG.`, "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast(`${label}: file exceeds 5 MB.`, "error");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${API_BASE}/admin/upload?folder=mxdblr/features`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ data: dataUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Upload failed");
      onChange(d.url as string);
      showToast(`${label} uploaded`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : `${label} upload failed`, "error");
    } finally {
      setUploading(false);
    }
  }, [kind, label, onChange, showToast]);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
      />
      {value ? (
        <div style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid #E8E4DE", borderRadius: 8, padding: 10, background: "#FAFAF9" }}>
          <AssetThumb url={value} size={kind === "image" ? 56 : 44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#1A1A2E", fontWeight: 600, wordBreak: "break-all", lineHeight: 1.4, maxHeight: 34, overflow: "hidden" }}>
              {value.startsWith("data:") ? "Uploaded file (inline)" : value}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
                style={{ fontSize: 11, fontWeight: 700, color: "#F47920", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {uploading ? "Uploading…" : "Replace"}
              </button>
              <button type="button" onClick={onOpenLibrary}
                style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Choose from library
              </button>
              <button type="button" onClick={() => onChange("")}
                style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragOver ? "#F47920" : "#E8E4DE"}`, borderRadius: 8, padding: "16px 14px",
            textAlign: "center", cursor: "pointer", background: dragOver ? "#FFF7F0" : "#FAFAF9",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
            {uploading ? "Uploading…" : `Drop ${label.toLowerCase()} here or click to upload`}
          </div>
          <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 3 }}>PNG, JPG, WebP, GIF, SVG — max 5 MB</div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenLibrary(); }}
            style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#6366F1", background: "none", border: "none", cursor: "pointer" }}>
            or choose from library
          </button>
        </div>
      )}
    </div>
  );
}

/** Searchable/filterable gallery of assets already used by other features. */
function LibraryPicker({
  open, kind, assets, onPick, onClose,
}: {
  open: boolean;
  kind: "icon" | "image";
  assets: LibraryAsset[];
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  if (!open) return null;

  const pool = assets.filter((a) => a.kind === kind);
  const cats = Array.from(new Set(pool.map((a) => a.category)));
  const filtered = pool.filter((a) =>
    (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.url.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || a.category === cat)
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={`Choose ${kind} from library`}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Choose {kind === "icon" ? "an Icon" : "an Image"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "12px 20px", display: "flex", gap: 10, borderBottom: "1px solid #F0EDEA" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library…" style={{ ...inputStyle, flex: 1 }} autoFocus />
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#6B6B7D", fontSize: 13 }}>
              {pool.length === 0 ? `No ${kind}s in the library yet — upload one to reuse it later.` : "No matches."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 10 }}>
              {filtered.map((a) => (
                <button key={`${a.kind}:${a.url}`} type="button" onClick={() => { onPick(a.url); onClose(); }}
                  title={a.name}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", cursor: "pointer" }}>
                  <AssetThumb url={a.url} size={54} />
                  <span style={{ fontSize: 10, color: "#6B6B7D", textAlign: "center", lineHeight: 1.3, maxHeight: 26, overflow: "hidden" }}>{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturesContent() {
  const { showToast } = useToast();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [form, setForm] = useState<Omit<Feature, "id">>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<Feature | null>(null);
  const [saving, setSaving] = useState(false);

  const [library, setLibrary] = useState<LibraryAsset[]>([]);
  const [libraryFor, setLibraryFor] = useState<"icon" | "image" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/features`, { headers: authHeaders(false) });
      const d = await res.json();
      setFeatures(d.data || []);
    } catch {
      showToast("Failed to load features", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary() {
    try {
      const res = await fetch(`${API_BASE}/admin/features/library`, { headers: authHeaders(false) });
      const d = await res.json();
      setLibrary(d.data || []);
    } catch {
      /* best-effort; picker will just show empty */
    }
  }

  useEffect(() => { load(); loadLibrary(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, displayOrder: features.length });
    setShowModal(true);
  }

  function openEdit(f: Feature) {
    setEditing(f);
    setForm({
      name: f.name, slug: f.slug, logo: f.logo, image: f.image,
      displayMode: f.displayMode ?? "ICON", category: f.category,
      description: f.description, active: f.active, displayOrder: f.displayOrder,
    });
    setShowModal(true);
  }

  function handleNameChange(name: string) {
    // Only auto-fill slug/logo path while adding (slug is the logo filename key —
    // don't silently repoint an existing feature's logo on rename).
    setForm((f) => ({ ...f, name, ...(editing ? {} : { slug: toSlug(name), logo: f.logo || `/product-features/${toSlug(name)}.svg` }) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast("Feature name is required", "error"); return; }
    // Guardrail: the chosen display mode needs the matching asset present.
    if ((form.displayMode === "IMAGE" || form.displayMode === "BOTH") && !form.image) {
      showToast("Selected display mode needs an image.", "error"); return;
    }
    if ((form.displayMode === "ICON" || form.displayMode === "BOTH") && !form.logo) {
      showToast("Selected display mode needs an icon.", "error"); return;
    }
    setSaving(true);
    try {
      const url = editing ? `${API_BASE}/admin/features/${editing.id}` : `${API_BASE}/admin/features`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to save");
      showToast(editing ? "Feature updated" : "Feature added");
      setShowModal(false);
      load();
      loadLibrary();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save feature", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: Feature) {
    try {
      const res = await fetch(`${API_BASE}/admin/features/${f.id}`, { method: "DELETE", headers: authHeaders(false) });
      if (!res.ok) throw new Error("Failed");
      showToast("Feature deleted");
      setDeleteConfirm(null);
      load();
    } catch {
      showToast("Failed to delete feature", "error");
    }
  }

  async function toggleActive(f: Feature) {
    try {
      const res = await fetch(`${API_BASE}/admin/features/${f.id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ active: !f.active }),
      });
      if (!res.ok) throw new Error("Failed");
      setFeatures((prev) => prev.map((x) => x.id === f.id ? { ...x, active: !x.active } : x));
    } catch {
      showToast("Failed to update feature", "error");
    }
  }

  const grouped = CATEGORIES
    .map((c) => ({ ...c, items: features.filter((f) => f.category === c.value) }))
    .filter((g) => g.items.length > 0);

  const modeLabel = (m: DisplayMode) => DISPLAY_MODES.find((x) => x.value === m)?.label ?? m;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>Product Features</h1>
          <p style={{ fontSize: 13, color: "#6B6B7D", marginTop: 2, maxWidth: 620 }}>
            The master list of supported technologies. Each feature has an icon and/or image —
            upload your own (PNG/JPG/WebP/GIF/SVG) or reuse one from the library. Products reference
            features by slug and the storefront shows the media automatically.
          </p>
        </div>
        <button onClick={openAdd} className="btn-orange" style={{ padding: "0 16px", height: 36, fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          + Add Feature
        </button>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "#6B6B7D", background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12 }}>Loading…</div>
      )}

      {!loading && features.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#6B6B7D", background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12 }}>
          No features yet. Add your first supported technology.
        </div>
      )}

      {!loading && grouped.map((group) => (
        <div key={group.value} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#F47920", marginBottom: 8 }}>
            {group.label} <span style={{ color: "#A8A39A" }}>({group.items.length})</span>
          </h2>
          <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
                    {["Icon", "Image", "Name", "Mode", "Slug", "Used By", "Status", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B7D", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid #F0EDEA" }}>
                      <td style={{ padding: "10px 16px" }}><AssetThumb url={f.logo} size={34} /></td>
                      <td style={{ padding: "10px 16px" }}>{f.image ? <AssetThumb url={f.image} size={34} rounded={5} /> : <span style={{ color: "#D0CCC4", fontSize: 12 }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{f.name}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#EEF0FE", color: "#6366F1", whiteSpace: "nowrap" }}>{modeLabel(f.displayMode ?? "ICON")}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "#6366F1" }}>{f.slug}</td>
                      <td style={{ padding: "12px 16px", color: "#6B6B7D" }}>{f.productCount ?? 0}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => toggleActive(f)}
                          style={{ padding: "3px 10px", borderRadius: 12, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: f.active ? "#D1FAE5" : "#F3F4F6", color: f.active ? "#059669" : "#6B7280" }}>
                          {f.active ? "Active" : "Hidden"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}>Edit</button>
                          <button onClick={() => setDeleteConfirm(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {!loading && features.length > 0 && (
        <div style={{ fontSize: 12, color: "#6B6B7D" }}>{features.length} feature{features.length !== 1 ? "s" : ""} total</div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Feature" : "Add Feature"}</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D" }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
              <div>
                <label style={labelStyle}>Feature Name *</label>
                <input value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Qualcomm Quick Charge" style={inputStyle} autoFocus />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FeatureCategory }))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Slug</label>
                  <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }} />
                </div>
              </div>

              {/* Display mode */}
              <div>
                <label style={labelStyle}>Display Mode</label>
                <div style={{ display: "flex", gap: 4, background: "#F8F6F2", borderRadius: 8, padding: 4 }}>
                  {DISPLAY_MODES.map((m) => (
                    <button key={m.value} type="button" onClick={() => setForm((f) => ({ ...f, displayMode: m.value }))}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: form.displayMode === m.value ? 700 : 500, cursor: "pointer", background: form.displayMode === m.value ? "#fff" : "transparent", color: form.displayMode === m.value ? "#1A1A2E" : "#6B6B7D", boxShadow: form.displayMode === m.value ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon slot (shown for ICON / BOTH) */}
              {(form.displayMode === "ICON" || form.displayMode === "BOTH") && (
                <AssetField kind="icon" value={form.logo} onChange={(v) => setForm((f) => ({ ...f, logo: v }))} onOpenLibrary={() => setLibraryFor("icon")} />
              )}
              {/* Image slot (shown for IMAGE / BOTH) */}
              {(form.displayMode === "IMAGE" || form.displayMode === "BOTH") && (
                <AssetField kind="image" value={form.image} onChange={(v) => setForm((f) => ({ ...f, image: v }))} onOpenLibrary={() => setLibraryFor("image")} />
              )}

              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Shown on the product detail page under this feature." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Display Order</label>
                  <input type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))} min={0} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.active ? "active" : "hidden"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "active" }))} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="active">Active (visible)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1A1A2E" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>
                {saving ? "Saving…" : editing ? "Update Feature" : "Add Feature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Library picker (shared by icon + image slots) */}
      <LibraryPicker
        open={libraryFor !== null}
        kind={libraryFor ?? "icon"}
        assets={library}
        onPick={(url) => {
          if (libraryFor === "icon") setForm((f) => ({ ...f, logo: url }));
          else if (libraryFor === "image") setForm((f) => ({ ...f, image: url }));
        }}
        onClose={() => setLibraryFor(null)}
      />

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete “{deleteConfirm.name}”?</div>
            <p style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20 }}>
              {deleteConfirm.productCount
                ? `This feature is used by ${deleteConfirm.productCount} product${deleteConfirm.productCount !== 1 ? "s" : ""} — it will be removed from all of them.`
                : "This removes the feature from the master list."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(FeaturesContent);
