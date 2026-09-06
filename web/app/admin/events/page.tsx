"use client";

/**
 * Admin events page (route: /admin/events). CRUD over the homepage "Events &
 * Activities" section: title/description/date/location/category, multi-image
 * upload, video URLs + direct video upload, publish/feature toggles, reorder,
 * and a pre-publish preview. Wrapped in AdminGuard. Mirrors the banners page
 * conventions (token auth, uploadIfBase64, toast, modal).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useToast } from "@/components/admin/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type EventCategory =
  | "PRODUCT_LAUNCH" | "DEALER_MEETUP" | "TRAINING" | "EXHIBITION" | "CELEBRATION" | "OTHER";

const CATEGORY_LABELS: Record<EventCategory, string> = {
  PRODUCT_LAUNCH: "Product Launch",
  DEALER_MEETUP: "Dealer Meetup",
  TRAINING: "Training",
  EXHIBITION: "Exhibition",
  CELEBRATION: "Celebration",
  OTHER: "Other",
};

interface EventVideo {
  url: string;
  thumbnailUrl: string;
  source: "youtube" | "vimeo" | "upload" | "url";
}

interface EventRecord {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  eventDate: string;
  location: string;
  coverImage: string;
  images: string[];
  videos: EventVideo[];
  published: boolean;
  featured: boolean;
  displayOrder: number;
}

type EventForm = Omit<EventRecord, "id" | "displayOrder">;

const EMPTY: EventForm = {
  title: "",
  description: "",
  category: "DEALER_MEETUP",
  eventDate: new Date().toISOString().slice(0, 10),
  location: "",
  coverImage: "",
  images: [],
  videos: [],
  published: false,
  featured: false,
};

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7,
  border: "1px solid #E8E4DE", fontSize: 13, background: "#fff",
  color: "#1F1813", fontFamily: "inherit", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6E6257",
  textTransform: "uppercase", letterSpacing: "0.05em",
  display: "block", marginBottom: 5,
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── video URL helpers (mirror api/lib/video + web EventsActivities) ───────────
function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function vmId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
function videoThumb(v: EventVideo): string {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  const id = ytId(v.url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}
function videoEmbed(url: string): string | null {
  const y = ytId(url);
  if (y) return `https://www.youtube.com/embed/${y}?rel=0`;
  const v = vmId(url);
  if (v) return `https://player.vimeo.com/video/${v}`;
  return null;
}

/** Inline playable preview for one video (admin editor). */
function VideoPlayer({ video }: { video: EventVideo }) {
  const embed = videoEmbed(video.url);
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Video preview"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: "100%", aspectRatio: "16 / 9", border: "none", borderRadius: 8, background: "#000", display: "block" }}
      />
    );
  }
  if (video.url) {
    return (
      <video src={video.url} poster={video.thumbnailUrl || undefined} controls playsInline style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 8, background: "#000", display: "block" }} />
    );
  }
  return null;
}

function EventsContent() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  const coverRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API}/admin/events`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setEvents(d.data || []);
    } catch { showToast("Failed to load events", "error"); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, eventDate: new Date().toISOString().slice(0, 10) });
    setPreview(false);
    setShowModal(true);
  }

  function openEdit(ev: EventRecord) {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description,
      category: ev.category,
      eventDate: (ev.eventDate || "").slice(0, 10),
      location: ev.location,
      coverImage: ev.coverImage,
      images: ev.images || [],
      videos: ev.videos || [],
      published: ev.published,
      featured: ev.featured,
    });
    setPreview(false);
    setShowModal(true);
  }

  // ── media helpers ──────────────────────────────────────────────────────────
  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target?.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  const onCoverPick = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Not an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Image exceeds 5 MB", "error"); return; }
    setForm((f) => ({ ...f, coverImage: "" }));
    const data = await readFileAsDataUrl(file);
    setForm((f) => ({ ...f, coverImage: data }));
  }, [showToast]);

  const onImagesPick = useCallback(async (files: FileList) => {
    const valid = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) { showToast(`${f.name}: not an image`, "error"); return false; }
      if (f.size > 5 * 1024 * 1024) { showToast(`${f.name}: exceeds 5 MB`, "error"); return false; }
      return true;
    });
    const datas = await Promise.all(valid.map(readFileAsDataUrl));
    setForm((f) => ({ ...f, images: [...f.images, ...datas].slice(0, 30) }));
  }, [showToast]);

  async function onVideoFilePick(file: File) {
    if (!file.type.startsWith("video/")) { showToast("Not a video file", "error"); return; }
    if (file.size > MAX_VIDEO_BYTES) { showToast("Video exceeds 50 MB", "error"); return; }
    setVideoUploading(true);
    try {
      const token = localStorage.getItem("adminToken") ?? "";
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/admin/upload/video?folder=mxdblr/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Video upload failed");
      setForm((f) => ({
        ...f,
        videos: [...f.videos, { url: d.url, thumbnailUrl: d.thumbnailUrl || "", source: "upload" }],
      }));
      showToast("Video uploaded");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Video upload failed", "error");
    } finally {
      setVideoUploading(false);
    }
  }

  function addVideoUrl() {
    setForm((f) => ({ ...f, videos: [...f.videos, { url: "", thumbnailUrl: "", source: "url" }] }));
  }
  function updateVideoUrl(i: number, url: string) {
    setForm((f) => ({ ...f, videos: f.videos.map((v, idx) => (idx === i ? { ...v, url } : v)) }));
  }
  function removeVideo(i: number) {
    setForm((f) => ({ ...f, videos: f.videos.filter((_, idx) => idx !== i) }));
  }
  function removeImage(i: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  }

  async function uploadIfBase64(data: string, token: string): Promise<string> {
    if (!data || !data.startsWith("data:")) return data;
    const res = await fetch(`${API}/admin/upload?folder=mxdblr/events`, {
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

  // ── save / delete / toggles ────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    if (!form.eventDate) { showToast("Event date is required", "error"); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem("adminToken") ?? "";
      const coverImage = await uploadIfBase64(form.coverImage, token);
      const images = await Promise.all(form.images.map((img) => uploadIfBase64(img, token)));
      const videos = form.videos
        .map((v) => ({ ...v, url: v.url.trim() }))
        .filter((v) => v.url);

      const payload = {
        title: form.title.trim(),
        description: form.description,
        category: form.category,
        eventDate: form.eventDate,
        location: form.location,
        coverImage,
        images,
        videos,
        published: form.published,
        featured: form.featured,
      };

      const url = editing ? `${API}/admin/events/${editing.id}` : `${API}/admin/events`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error ${res.status}`);
      }
      showToast(editing ? "Event updated" : "Event created");
      setShowModal(false);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save event", "error");
    } finally {
      setSaving(false);
    }
  }

  async function patch(ev: EventRecord, body: Record<string, unknown>, okMsg: string) {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API}/admin/events/${ev.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      showToast(okMsg);
      load();
    } catch { showToast("Failed to update", "error"); }
  }

  async function handleDelete(id: string) {
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${API}/admin/events/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      showToast("Event deleted");
      setShowDeleteConfirm(null);
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function move(ev: EventRecord, dir: -1 | 1) {
    const sorted = [...events].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((x) => x.id === ev.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${API}/admin/events/reorder/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: [
            { id: ev.id, displayOrder: other.displayOrder },
            { id: other.id, displayOrder: ev.displayOrder },
          ],
        }),
      });
      load();
    } catch { showToast("Failed to reorder", "error"); }
  }

  const sorted = [...events].sort((a, b) => a.displayOrder - b.displayOrder);
  const mediaCount = form.images.length + form.videos.filter((v) => v.url.trim()).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>Events &amp; Activities</h1>
          <p style={{ fontSize: 12, color: "#6E6257", marginTop: 2 }}>Manage the events showcase on the homepage. Latest events appear first.</p>
        </div>
        <button onClick={openAdd} className="btn-orange" style={{ padding: "9px 18px", fontSize: 13 }}>+ Add Event</button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6E6257" }}>Loading events…</div>
      ) : events.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6E6257" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No events yet</div>
          <div style={{ fontSize: 13 }}>Click &quot;Add Event&quot; to create your first event.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((ev, idx) => {
            const thumb = ev.coverImage || ev.images?.[0] || ev.videos?.find((v) => v.thumbnailUrl)?.thumbnailUrl || "";
            const count = (ev.images?.length || 0) + (ev.videos?.length || 0);
            return (
              <div key={ev.id} style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden", display: "flex", opacity: ev.published ? 1 : 0.6 }}>
                {/* Thumb */}
                <div style={{ width: 160, minHeight: 104, background: "linear-gradient(135deg,#1F1813,#352B22)", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{CATEGORY_LABELS[ev.category]}</span>
                  )}
                  {ev.featured && (
                    <span style={{ position: "absolute", top: 8, left: 8, background: "#F47920", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>★ Featured</span>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#1F1813" }}>{ev.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: ev.published ? "#E6F3E7" : "#F0EDEA", color: ev.published ? "#2E7D32" : "#6E6257" }}>{ev.published ? "PUBLISHED" : "DRAFT"}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#EEF0FE", color: "#6366F1" }}>{CATEGORY_LABELS[ev.category]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6E6257", marginBottom: 6 }}>
                      {fmtDate(ev.eventDate)}{ev.location ? ` · ${ev.location}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#A8A39A", flexWrap: "wrap" }}>
                      <span>{count} media item(s)</span>
                      <span>Order: {idx + 1}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => move(ev, -1)} disabled={idx === 0} title="Move up" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="12" height="12" fill="none" stroke="#1F1813" strokeWidth="2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button onClick={() => move(ev, 1)} disabled={idx === sorted.length - 1} title="Move down" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", cursor: idx === sorted.length - 1 ? "not-allowed" : "pointer", opacity: idx === sorted.length - 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="12" height="12" fill="none" stroke="#1F1813" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                    </div>
                    <button onClick={() => patch(ev, { published: !ev.published }, !ev.published ? "Event published" : "Event unpublished")} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: ev.published ? "#FEF3D7" : "#E6F3E7", color: ev.published ? "#D97706" : "#2E7D32", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {ev.published ? "Unpublish" : "Publish"}
                    </button>
                    <button onClick={() => patch(ev, { featured: !ev.featured }, !ev.featured ? "Marked featured" : "Removed from featured")} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E8E4DE", background: ev.featured ? "#FFF3E8" : "#fff", color: ev.featured ? "#F47920" : "#6E6257", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {ev.featured ? "★ Featured" : "☆ Feature"}
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(ev)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #E8E4DE", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setShowDeleteConfirm(ev.id)} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Event?</div>
            <div style={{ fontSize: 13, color: "#6E6257", marginBottom: 20 }}>This permanently removes the event and its media references.</div>
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
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Modal header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E4DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Event" : "New Event"}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setPreview((p) => !p)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E8E4DE", background: preview ? "#1F1813" : "#fff", color: preview ? "#fff" : "#1F1813", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {preview ? "Edit" : "Preview"}
                </button>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6E6257", fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
              {preview ? (
                /* ── PREVIEW ─────────────────────────────────────────────── */
                <div>
                  <div style={{ fontSize: 11, color: "#A8A39A", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    Card preview {form.published ? "" : "· (still a draft — not visible on site)"}
                  </div>
                  <div style={{ maxWidth: 340, border: "1px solid #E8E4DE", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", background: "linear-gradient(135deg,#1F1813,#352B22)" }}>
                      {(form.coverImage || form.images[0]) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={form.coverImage || form.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>{CATEGORY_LABELS[form.category]}</div>
                      )}
                      <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(244,121,32,0.95)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 6 }}>{CATEGORY_LABELS[form.category]}</span>
                      {mediaCount > 0 && (
                        <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(10,10,16,0.6)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6 }}>{mediaCount} media</span>
                      )}
                    </div>
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ fontSize: 12, color: "#6E6257", marginBottom: 6 }}>{fmtDate(form.eventDate)}{form.location ? ` · ${form.location}` : ""}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#1F1813", marginBottom: 6 }}>{form.title || "Event title"}</div>
                      <div style={{ fontSize: 13, color: "#6E6257", lineHeight: 1.6 }}>{form.description || "Event description preview…"}</div>
                    </div>
                  </div>
                  {form.images.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      {form.images.map((img, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={i} src={img} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #E8E4DE" }} />
                      ))}
                    </div>
                  )}
                  {form.videos.filter((v) => v.url.trim()).length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 11, color: "#A8A39A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Videos (playable)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 540 }}>
                        {form.videos.filter((v) => v.url.trim()).map((v, i) => (
                          <VideoPlayer key={i} video={v} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── FORM ────────────────────────────────────────────────── */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Title *</label>
                    <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. MXD Dealer Meet 2026" />
                  </div>

                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EventCategory }))} style={inputStyle}>
                      {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Event Date *</label>
                    <input type="date" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} style={inputStyle} />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Location (optional)</label>
                    <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="e.g. Bengaluru, Karnataka" />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Description</label>
                    <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, height: 72, resize: "vertical" }} placeholder="What happened at this event?" />
                  </div>

                  {/* Cover image */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Cover Image</label>
                    <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) onCoverPick(e.target.files[0]); e.target.value = ""; }} />
                    {form.coverImage ? (
                      <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.coverImage} alt="Cover" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #E8E4DE", display: "block" }} />
                        <button onClick={() => setForm((f) => ({ ...f, coverImage: "" }))} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>×</button>
                      </div>
                    ) : (
                      <div onClick={() => coverRef.current?.click()} style={{ border: "2px dashed #E8E4DE", borderRadius: 8, padding: "14px", textAlign: "center", cursor: "pointer", background: "#FAFAF9" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1F1813" }}>Upload cover image</div>
                        <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 2 }}>PNG, JPG, WEBP — max 5 MB</div>
                      </div>
                    )}
                  </div>

                  {/* Gallery images */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Gallery Images ({form.images.length})</label>
                    <input ref={imagesRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) onImagesPick(e.target.files); e.target.value = ""; }} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {form.images.map((img, i) => (
                        <div key={i} style={{ position: "relative", width: 76, height: 56 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, border: "1px solid #E8E4DE" }} />
                          <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>×</button>
                        </div>
                      ))}
                      <button onClick={() => imagesRef.current?.click()} style={{ width: 76, height: 56, borderRadius: 6, border: "2px dashed #E8E4DE", background: "#FAFAF9", cursor: "pointer", color: "#6E6257", fontSize: 22 }}>+</button>
                    </div>
                  </div>

                  {/* Videos */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Videos ({form.videos.length})</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {form.videos.map((v, i) => {
                        const thumb = videoThumb(v);
                        const typeLabel = v.source === "upload" ? "File" : ytId(v.url) ? "YouTube" : vmId(v.url) ? "Vimeo" : v.url ? "Link" : "—";
                        return (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ width: 56, height: 36, borderRadius: 6, background: "#1F1813", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {thumb ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>▶</span>
                              )}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: v.source === "upload" ? "#E6F3E7" : "#EEF0FE", color: v.source === "upload" ? "#2E7D32" : "#6366F1", flexShrink: 0, textTransform: "uppercase" }}>{typeLabel}</span>
                            {v.source === "upload" ? (
                              <span style={{ ...inputStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#6E6257" }}>{v.url}</span>
                            ) : (
                              <input value={v.url} onChange={(e) => updateVideoUrl(i, e.target.value)} style={inputStyle} placeholder="https://youtube.com/watch?v=… or Vimeo / .mp4 URL" />
                            )}
                            <button onClick={() => removeVideo(i)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid #FCE7E7", background: "#FCE7E7", color: "#DC2626", cursor: "pointer", fontWeight: 700 }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                    <input ref={videoRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) onVideoFilePick(e.target.files[0]); e.target.value = ""; }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={addVideoUrl} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #E8E4DE", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add video URL</button>
                      <button onClick={() => videoRef.current?.click()} disabled={videoUploading} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #E8E4DE", background: videoUploading ? "#F0EDEA" : "#fff", fontSize: 12, fontWeight: 700, cursor: videoUploading ? "wait" : "pointer" }}>
                        {videoUploading ? "Uploading…" : "⬆ Upload video file"}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#A8A39A", marginTop: 4 }}>YouTube/Vimeo links auto-generate thumbnails. Uploaded files: mp4/webm/mov, max 50 MB.</div>
                  </div>

                  {/* Toggles */}
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 24, marginTop: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1F1813" }}>
                      <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
                      Published (visible on homepage)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1F1813" }}>
                      <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />
                      Featured (shown first)
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E4DE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E8E4DE", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-orange" style={{ padding: "9px 22px", fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGuard(EventsContent);
