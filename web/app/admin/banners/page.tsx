"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type BannerType = "SIMPLE" | "PRODUCT_PROMO" | "BRAND_PROMO";

interface Banner {
  id: string;
  bannerType: BannerType;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  image: string;
  bgColor: string;
  accentColor: string;
  logoImage: string;
  productImage1: string;
  productImage2: string;
  productImage3: string;
  overlayOpacity: number;
  textAlignment: string;
  active: boolean;
  displayOrder: number;
}

const EMPTY: Omit<Banner, "id" | "displayOrder"> = {
  bannerType: "SIMPLE",
  title: "",
  subtitle: "",
  ctaText: "Browse Catalog",
  ctaLink: "/catalog",
  image: "",
  bgColor: "#1A1A2E",
  accentColor: "#F47920",
  logoImage: "",
  productImage1: "",
  productImage2: "",
  productImage3: "",
  overlayOpacity: 0.35,
  textAlignment: "left",
  active: true,
};

const BANNER_TYPE_LABELS: Record<BannerType, string> = {
  SIMPLE: "Simple Banner",
  PRODUCT_PROMO: "Product Promotion",
  BRAND_PROMO: "Brand Promotion",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7,
  border: "1px solid #E8E4DE", fontSize: 13, background: "#fff",
  color: "#1A1A2E", fontFamily: "inherit", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6B6B7D",
  textTransform: "uppercase", letterSpacing: "0.05em",
  display: "block", marginBottom: 5,
};

function ImageUploadSlot({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Not an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("File exceeds 5 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [onChange, showToast]);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); e.target.value = ""; }} />
      {value ? (
        <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #E8E4DE", display: "block" }} />
          <button onClick={() => onChange("")} style={{ position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <button onClick={() => ref.current?.click()} style={{ position: "absolute", bottom: 5, right: 5, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer" }}>Change</button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? "#F47920" : "#E8E4DE"}`,
            borderRadius: 8, padding: "14px 10px", textAlign: "center",
            cursor: "pointer", background: dragging ? "#FFF3E8" : "#FAFAF9",
            transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>🖼️</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: dragging ? "#F47920" : "#1A1A2E" }}>Upload or drag & drop</div>
          {hint && <div style={{ fontSize: 10, color: "#A8A39A", marginTop: 2 }}>{hint}</div>}
        </div>
      )}
    </div>
  );
}

function BannersContent() {
  const { showToast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<Omit<Banner, "id" | "displayOrder">>(EMPTY);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API}/admin/banners`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setBanners(d.data || []);
    } catch { showToast("Failed to load banners", "error"); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      bannerType: b.bannerType || "SIMPLE",
      title: b.title,
      subtitle: b.subtitle,
      ctaText: b.ctaText,
      ctaLink: b.ctaLink,
      image: b.image,
      bgColor: b.bgColor,
      accentColor: b.accentColor,
      logoImage: b.logoImage || "",
      productImage1: b.productImage1 || "",
      productImage2: b.productImage2 || "",
      productImage3: b.productImage3 || "",
      overlayOpacity: b.overlayOpacity ?? 0.35,
      textAlignment: b.textAlignment || "left",
      active: b.active,
    });
    setShowModal(true);
  }

  async function uploadIfBase64(data: string, token: string): Promise<string> {
    if (!data || !data.startsWith("data:")) return data;
    const res = await fetch(`${API}/admin/upload?folder=mxdblr/banners`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Image upload failed");
    }
    const { url } = await res.json();
    return url as string;
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    try {
      const token = localStorage.getItem("adminToken") ?? "";
      // Upload any base64 images to Cloudinary/local storage first
      const [image, logoImage, productImage1, productImage2, productImage3] = await Promise.all([
        uploadIfBase64(form.image, token),
        uploadIfBase64(form.logoImage, token),
        uploadIfBase64(form.productImage1, token),
        uploadIfBase64(form.productImage2, token),
        uploadIfBase64(form.productImage3, token),
      ]);
      const payload = { ...form, image, logoImage, productImage1, productImage2, productImage3 };

      const url = editing ? `${API}/admin/banners/${editing.id}` : `${API}/admin/banners`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Server error ${res.status}`);
      }
      showToast(editing ? "Banner updated" : "Banner created");
      setShowModal(false);
      load();
    } catch (e: any) { showToast(e.message || "Failed to save banner", "error"); }
  }

  async function handleDelete(id: string) {
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${API}/admin/banners/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      showToast("Banner deleted");
      setShowDeleteConfirm(null);
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function toggleActive(b: Banner) {
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${API}/admin/banners/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !b.active }),
      });
      showToast(!b.active ? "Banner activated" : "Banner hidden");
      load();
    } catch { showToast("Failed to update", "error"); }
  }

  async function move(b: Banner, dir: -1 | 1) {
    const newOrder = b.displayOrder + dir;
    if (newOrder < 0 || newOrder >= banners.length) return;
    try {
      const token = localStorage.getItem("adminToken");
      const other = banners.find((x) => x.displayOrder === newOrder);
      if (!other) return;
      await Promise.all([
        fetch(`${API}/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ displayOrder: newOrder }) }),
        fetch(`${API}/admin/banners/${other.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ displayOrder: b.displayOrder }) }),
      ]);
      load();
    } catch { showToast("Failed to reorder", "error"); }
  }

  const readBgFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Not an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("File exceeds 5 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => setForm((f) => ({ ...f, image: e.target?.result as string }));
    reader.readAsDataURL(file);
  }, [showToast]);

  const typeBadgeColor: Record<BannerType, string> = {
    SIMPLE: "#E3EDFF",
    PRODUCT_PROMO: "#FFF3E0",
    BRAND_PROMO: "#F3E8FF",
  };
  const typeBadgeText: Record<BannerType, string> = {
    SIMPLE: "#2563EB",
    PRODUCT_PROMO: "#D97706",
    BRAND_PROMO: "#7C3AED",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>Hero Banners</h1>
          <p style={{ fontSize: 12, color: "#6B6B7D", marginTop: 2 }}>Manage the sliding banners on the homepage hero section</p>
        </div>
        <button onClick={openAdd} className="btn-orange" style={{ padding: "9px 18px", fontSize: 13 }}>
          + Add Banner
        </button>
      </div>

      {/* Banner cards */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6B6B7D" }}>Loading banners…</div>
      ) : banners.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6B6B7D" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🖼️</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No banners yet</div>
          <div style={{ fontSize: 13 }}>Click "Add Banner" to create your first hero slide.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...banners].sort((a, b) => a.displayOrder - b.displayOrder).map((b, idx) => (
            <div
              key={b.id}
              style={{
                background: "#fff",
                border: "1px solid #E8E4DE",
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                gap: 0,
                opacity: b.active ? 1 : 0.55,
              }}
            >
              {/* Preview strip */}
              <div
                style={{
                  width: 200,
                  minHeight: 110,
                  background: b.bgColor,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  padding: "14px 16px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {b.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={b.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {b.image && (
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${b.bgColor}cc 0%, transparent 100%)` }} />
                )}
                {/* Product images preview for PRODUCT_PROMO */}
                {b.bannerType === "PRODUCT_PROMO" && (b.productImage1 || b.productImage2 || b.productImage3) && (
                  <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 3 }}>
                    {[b.productImage1, b.productImage2, b.productImage3].filter(Boolean).map((img, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={i} src={img} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, background: "rgba(255,255,255,0.1)" }} />
                    ))}
                  </div>
                )}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ width: 20, height: 3, background: b.accentColor, borderRadius: 2, marginBottom: 6 }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 6, maxWidth: 120 }}>{b.title}</div>
                  <div style={{ display: "inline-block", background: b.accentColor, color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>{b.ctaText}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>{b.title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: b.active ? "#E6F3E7" : "#F0EDEA",
                      color: b.active ? "#2E7D32" : "#6B6B7D",
                    }}>{b.active ? "LIVE" : "HIDDEN"}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: typeBadgeColor[b.bannerType as BannerType] || "#F0EDEA",
                      color: typeBadgeText[b.bannerType as BannerType] || "#6B6B7D",
                    }}>{BANNER_TYPE_LABELS[b.bannerType as BannerType] || b.bannerType}</span>
                    <span style={{ fontSize: 10, color: "#A8A39A" }}>Slide {idx + 1}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B6B7D", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.subtitle}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#A8A39A", flexWrap: "wrap" }}>
                    <span>CTA: <strong style={{ color: "#1A1A2E" }}>{b.ctaText}</strong></span>
                    <span>→ <strong style={{ color: "#6366F1" }}>{b.ctaLink}</strong></span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      BG: <span style={{ width: 12, height: 12, borderRadius: 3, background: b.bgColor, display: "inline-block", border: "1px solid #E8E4DE" }} />
                      Accent: <span style={{ width: 12, height: 12, borderRadius: 3, background: b.accentColor, display: "inline-block", border: "1px solid #E8E4DE" }} />
                    </span>
                    {b.bannerType === "PRODUCT_PROMO" && (
                      <span style={{ color: "#D97706" }}>
                        {[b.productImage1, b.productImage2, b.productImage3].filter(Boolean).length} product image(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => move(b, -1)} disabled={idx === 0} title="Move up" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" fill="none" stroke="#1A1A2E" strokeWidth="2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button onClick={() => move(b, 1)} disabled={idx === banners.length - 1} title="Move down" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", cursor: idx === banners.length - 1 ? "not-allowed" : "pointer", opacity: idx === banners.length - 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" fill="none" stroke="#1A1A2E" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                  <button onClick={() => toggleActive(b)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: b.active ? "#FEF3D7" : "#E6F3E7", color: b.active ? "#D97706" : "#2E7D32", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {b.active ? "Hide" : "Show"}
                  </button>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(b)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => setShowDeleteConfirm(b.id)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Banner?</div>
            <div style={{ fontSize: 13, color: "#6B6B7D", marginBottom: 20 }}>This will remove the slide from the homepage immediately.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Banner" : "New Banner"}</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B7D", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>

              {/* Banner type selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Banner Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["SIMPLE", "PRODUCT_PROMO", "BRAND_PROMO"] as BannerType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm((f) => ({ ...f, bannerType: type }))}
                      style={{
                        flex: 1, padding: "9px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: form.bannerType === type ? `2px solid ${type === "PRODUCT_PROMO" ? "#F47920" : "#1A1A2E"}` : "2px solid #E8E4DE",
                        background: form.bannerType === type ? (type === "PRODUCT_PROMO" ? "#FFF3E0" : "#F0F0F5") : "#fff",
                        color: form.bannerType === type ? (type === "PRODUCT_PROMO" ? "#D97706" : "#1A1A2E") : "#6B6B7D",
                        transition: "all 0.15s",
                      }}
                    >
                      {BANNER_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div
                style={{
                  background: form.bgColor,
                  borderRadius: 10,
                  marginBottom: 20,
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 110,
                  display: "flex",
                }}
              >
                {form.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={form.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {/* Gradient so text stays readable over the background image */}
                {form.image && (
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${form.bgColor}f0 0%, ${form.bgColor}bb 45%, transparent 100%)` }} />
                )}
                {/* Text side */}
                <div style={{ position: "relative", zIndex: 1, flex: 1, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: form.accentColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>PREVIEW</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 4 }}>{form.title || "Banner Title"}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>{form.subtitle || "Subtitle appears here"}</div>
                  <span style={{ display: "inline-block", background: form.accentColor, color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 6, alignSelf: "flex-start" }}>{form.ctaText || "CTA"}</span>
                </div>
                {/* Product images side — only for PRODUCT_PROMO */}
                {form.bannerType === "PRODUCT_PROMO" && (form.productImage1 || form.productImage2 || form.productImage3) && (
                  <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, justifyContent: "center", padding: "12px 16px 12px 8px" }}>
                    {[form.productImage1, form.productImage2, form.productImage3].filter(Boolean).map((img, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={i} src={img} alt="" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 6, background: "rgba(255,255,255,0.1)" }} />
                    ))}
                  </div>
                )}
                {form.bannerType === "BRAND_PROMO" && form.logoImage && (
                  <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "center", padding: "12px 20px 12px 8px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.logoImage} alt="Logo" style={{ width: 70, height: 70, objectFit: "contain" }} />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Common fields */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Title *</label>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. Quality for Everyone." />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Subtitle</label>
                  <textarea value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} style={{ ...inputStyle, height: 56, resize: "vertical" }} placeholder="Supporting text below the title" />
                </div>
                <div>
                  <label style={labelStyle}>CTA Button Text</label>
                  <input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} style={inputStyle} placeholder="Browse Catalog" />
                </div>
                <div>
                  <label style={labelStyle}>CTA Link</label>
                  <input value={form.ctaLink} onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))} style={inputStyle} placeholder="/catalog" />
                </div>
                <div>
                  <label style={labelStyle}>Background Color</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={form.bgColor} onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))} style={{ width: 40, height: 36, borderRadius: 6, border: "1px solid #E8E4DE", cursor: "pointer", padding: 2 }} />
                    <input value={form.bgColor} onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))} style={{ ...inputStyle, flex: 1 }} placeholder="#1A1A2E" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Accent Color</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={form.accentColor} onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))} style={{ width: 40, height: 36, borderRadius: 6, border: "1px solid #E8E4DE", cursor: "pointer", padding: 2 }} />
                    <input value={form.accentColor} onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))} style={{ ...inputStyle, flex: 1 }} placeholder="#F47920" />
                  </div>
                </div>

                {/* Text alignment */}
                <div>
                  <label style={labelStyle}>Text Alignment</label>
                  <select value={form.textAlignment} onChange={(e) => setForm((f) => ({ ...f, textAlignment: e.target.value }))} style={{ ...inputStyle }}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                  </select>
                </div>

                {/* Background image */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Background Image (optional)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) readBgFile(e.target.files[0]); e.target.value = ""; }} />
                  {form.image ? (
                    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image} alt="Banner" style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #E8E4DE", display: "block" }} />
                      <button onClick={() => setForm((f) => ({ ...f, image: "" }))} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      <button onClick={() => fileInputRef.current?.click()} style={{ position: "absolute", bottom: 6, right: 6, padding: "4px 10px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}>Change</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) readBgFile(e.dataTransfer.files[0]); }}
                      style={{
                        border: `2px dashed ${isDragging ? "#F47920" : "#E8E4DE"}`,
                        borderRadius: 8, padding: "16px 16px", textAlign: "center",
                        cursor: "pointer", background: isDragging ? "#FFF3E8" : "#FAFAF9",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>🖼️</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDragging ? "#F47920" : "#1A1A2E" }}>Click to upload or drag & drop</div>
                      <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 3 }}>PNG, JPG, WEBP — max 5 MB. Shows as overlay behind text.</div>
                    </div>
                  )}
                </div>


                {/* Product Promo fields */}
                {form.bannerType === "PRODUCT_PROMO" && (
                  <>
                    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #E8E4DE", paddingTop: 14, marginTop: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706", marginBottom: 12 }}>📦 Product Images (shown on the right side of the banner)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <ImageUploadSlot value={form.productImage1} onChange={(v) => setForm((f) => ({ ...f, productImage1: v }))} label="Product Image 1" hint="PNG with transparent bg recommended" />
                        <ImageUploadSlot value={form.productImage2} onChange={(v) => setForm((f) => ({ ...f, productImage2: v }))} label="Product Image 2" hint="Optional" />
                        <ImageUploadSlot value={form.productImage3} onChange={(v) => setForm((f) => ({ ...f, productImage3: v }))} label="Product Image 3" hint="Optional" />
                      </div>
                    </div>
                  </>
                )}

                {/* Brand Promo fields */}
                {form.bannerType === "BRAND_PROMO" && (
                  <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #E8E4DE", paddingTop: 14, marginTop: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 12 }}>🏷️ Brand Logo (shown on the right side of the banner)</div>
                    <ImageUploadSlot value={form.logoImage} onChange={(v) => setForm((f) => ({ ...f, logoImage: v }))} label="Brand Logo" hint="PNG with transparent background recommended" />
                  </div>
                )}

                {/* Active toggle */}
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                    style={{
                      width: 44, height: 24, borderRadius: 999,
                      background: form.active ? "#F47920" : "#E8E4DE",
                      border: "none", cursor: "pointer", position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: form.active ? 23 : 3,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                    {form.active ? "Visible on homepage" : "Hidden from homepage"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13 }}>
                {editing ? "Save Changes" : "Create Banner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(BannersContent);
