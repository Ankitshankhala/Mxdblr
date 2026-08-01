'use client';

/**
 * EventsActivities — homepage "Events & Activities" section (shown above
 * "Why Dealers Choose MXD"). Premium gallery of dealer meets, launches, training,
 * exhibitions and celebrations. Each card opens a lightbox with an image/video
 * carousel; videos play inline (YouTube/Vimeo iframe or HTML5 <video> for uploads).
 *
 * Data is fetched server-side in app/page.tsx and passed in as a prop. Media uses
 * plain <img loading="lazy"> (not next/image) so it works with any source —
 * Cloudinary, local /uploads, or external video posters — without remotePatterns
 * config and without the phone-thumbnail 404 class of bug. Renders nothing when
 * there are no published events.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Play, X, ChevronLeft, ChevronRight, Images } from 'lucide-react';

export type EventVideoSource = 'youtube' | 'vimeo' | 'upload' | 'url';

export interface EventVideo {
  url: string;
  thumbnailUrl: string;
  source: EventVideoSource;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  eventDate: string;
  location: string;
  coverImage: string;
  images: string[];
  videos: EventVideo[];
  featured?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCT_LAUNCH: 'Product Launch',
  DEALER_MEETUP: 'Dealer Meetup',
  TRAINING: 'Training',
  EXHIBITION: 'Exhibition',
  CELEBRATION: 'Celebration',
  OTHER: 'Event',
};

type MediaItem =
  | { kind: 'image'; src: string }
  | { kind: 'video'; video: EventVideo };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * Only http(s) URLs are safe to hand to an <img>/<video> src. Rejects
 * javascript:, data:, and any other scheme so a malformed/hostile stored URL
 * can never become an active resource. Returns '' for anything not allowed.
 */
function safeMediaUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url, 'https://x.invalid');
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

/** Build the list of media (images then videos) for an event's lightbox. */
function mediaFor(ev: EventItem): MediaItem[] {
  const imgs: MediaItem[] = (ev.images || []).map((src) => ({ kind: 'image', src }));
  const vids: MediaItem[] = (ev.videos || []).map((video) => ({ kind: 'video', video }));
  return [...imgs, ...vids];
}

/** Poster for a video: stored thumbnail → derived YouTube poster → none. */
function videoThumb(v: EventVideo): string {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  const id = youtubeId(v.url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

/** Card thumbnail: cover image → first image → first video poster → gradient. */
function cardThumb(ev: EventItem): string {
  if (ev.coverImage) return ev.coverImage;
  if (ev.images?.length) return ev.images[0];
  for (const v of ev.videos || []) {
    const t = videoThumb(v);
    if (t) return t;
  }
  return '';
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        // #A8480F on white ≈ 4.7:1 — meets WCAG AA for small text (was
        // rgba(244,121,32) ≈ 2.6:1). Still reads as the MXD orange badge.
        display: 'inline-block',
        background: '#A8480F',
        color: '#fff',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '4px 9px',
        borderRadius: 6,
      }}
    >
      {CATEGORY_LABELS[category] ?? 'Event'}
    </span>
  );
}

function MediaViewer({ item }: { item: MediaItem }) {
  if (item.kind === 'image') {
    const src = safeMediaUrl(item.src);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Event photo"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    );
  }

  const { video } = item;
  // Detect provider from the URL itself (don't rely solely on the stored source —
  // this stays correct even for older rows saved before provider normalisation).
  const yt = youtubeId(video.url);
  const vm = vimeoId(video.url);

  if (yt) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
        title="Event video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    );
  }
  if (vm) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vm}?autoplay=1`}
        title="Event video"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    );
  }
  // Uploaded file or direct link — only render an http(s) source.
  const src = safeMediaUrl(video.url);
  if (!src) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.5)' }}>
        Video unavailable
      </div>
    );
  }
  return (
    <video
      src={src}
      poster={safeMediaUrl(video.thumbnailUrl) || undefined}
      controls
      autoPlay
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
    />
  );
}

function Lightbox({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const media = mediaFor(event);
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(media.length - 1, 0));
  const dialogRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (dir: number) => {
      if (!media.length) return;
      setIndex((i) => (i + dir + media.length) % media.length);
    },
    [media.length]
  );

  useEffect(() => {
    // Remember what had focus so we can restore it when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      const nodes = root.querySelectorAll(
        'button, [href], input, select, textarea, iframe, video, [tabindex]:not([tabindex="-1"])'
      );
      const els: HTMLElement[] = [];
      nodes.forEach((n) => {
        if (n instanceof HTMLElement && !n.hasAttribute('disabled')) els.push(n);
      });
      return els;
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      // Trap Tab within the dialog (WCAG 2.4.3 focus order).
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog on open.
    (focusables()[0] ?? dialogRef.current)?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Return focus to the trigger that opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [go, onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${event.title} gallery`}
      tabIndex={-1}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(10,10,16,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <CategoryBadge category={event.category} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} /> {formatDate(event.eventDate)}
              </span>
              {event.location && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} /> {event.location}
                </span>
              )}
            </div>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>{event.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close gallery"
            className="evt-iconbtn"
            style={{ flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stage */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#000',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {media.length > 0 ? (
            <MediaViewer key={safeIndex} item={media[safeIndex]} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.5)' }}>
              No media for this event
            </div>
          )}

          {media.length > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Previous" className="evt-iconbtn" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <ChevronLeft size={22} />
              </button>
              <button onClick={() => go(1)} aria-label="Next" className="evt-iconbtn" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{event.description}</p>
        )}

        {/* Thumbnail strip */}
        {media.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {media.map((m, i) => {
              const thumb = m.kind === 'image' ? m.src : videoThumb(m.video);
              const active = i === safeIndex;
              return (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`View item ${i + 1}`}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    width: 84,
                    height: 56,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: active ? '2px solid #F47920' : '2px solid transparent',
                    background: '#1A1A2E',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {safeMediaUrl(thumb) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safeMediaUrl(thumb)} alt="" loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                      <Play size={16} />
                    </div>
                  )}
                  {m.kind === 'video' && (
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: '#fff' }}>
                      <Play size={16} fill="currentColor" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, onOpen, index }: { event: EventItem; onOpen: () => void; index: number }) {
  const thumb = cardThumb(event);
  const mediaCount = (event.images?.length || 0) + (event.videos?.length || 0);
  const hasVideo = (event.videos?.length || 0) > 0;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3) }}
      className="card evt-card"
      aria-label={`Open ${event.title} gallery`}
      style={{
        textAlign: 'left',
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #E8E4DE',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Media */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'linear-gradient(135deg, #1A1A2E, #2C2C4A)', overflow: 'hidden' }}>
        {safeMediaUrl(thumb) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeMediaUrl(thumb)}
            alt={event.title}
            loading="lazy"
            decoding="async"
            // On a broken/404 image, hide it so the gradient background shows through.
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
            className="evt-card-img"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {CATEGORY_LABELS[event.category] ?? 'Event'}
          </div>
        )}

        {/* Top-left badge */}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <CategoryBadge category={event.category} />
        </div>

        {/* Media count */}
        {mediaCount > 0 && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(10,10,16,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>
            <Images size={12} /> {mediaCount}
          </div>
        )}

        {/* Play overlay */}
        {hasVideo && (
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(244,121,32,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
              <Play size={22} fill="currentColor" />
            </span>
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6B6B7D', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={12} /> {formatDate(event.eventDate)}
          </span>
          {event.location && (
            <span style={{ fontSize: 12, color: '#6B6B7D', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} /> {event.location}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title}</h3>
        {event.description && (
          <p style={{ fontSize: 13, color: '#6B6B7D', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {event.description}
          </p>
        )}
      </div>
    </motion.button>
  );
}

export default function EventsActivities({ events }: { events: EventItem[] }) {
  const [active, setActive] = useState<EventItem | null>(null);

  if (!events || events.length === 0) return null;

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 20px 0' }}>
      <style>{`
        .evt-card:hover .evt-card-img { transform: scale(1.05); }
        .evt-card:focus-visible { outline: 3px solid #F47920; outline-offset: 2px; }
        .evt-iconbtn {
          background: rgba(255,255,255,0.12); color: #fff; border: none; cursor: pointer;
          width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center;
          justify-content: center; transition: background 0.15s;
        }
        .evt-iconbtn:hover { background: rgba(255,255,255,0.22); }
        .evt-iconbtn:focus-visible { outline: 3px solid #F47920; outline-offset: 2px; }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p style={{ fontSize: 11, color: '#F47920', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          MXD Community
        </p>
        <h2 style={{ fontWeight: 900, fontSize: 24, color: '#1A1A2E', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Events &amp; Activities
        </h2>
        <p style={{ fontSize: 14, color: '#6B6B7D', maxWidth: 480, margin: '0 auto' }}>
          Dealer meets, product launches, training programs and exhibitions from across the MXD network.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {events.map((ev, i) => (
          <EventCard key={ev.id} event={ev} index={i} onOpen={() => setActive(ev)} />
        ))}
      </div>

      {active && <Lightbox event={active} onClose={() => setActive(null)} />}
    </section>
  );
}
