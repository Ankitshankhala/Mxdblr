/**
 * Video helpers for the Events feature.
 *
 * An event video is stored as { url, thumbnailUrl, source }. `source` records how
 * the video is delivered so the frontend can render the right player (YouTube/
 * Vimeo iframe vs. an HTML5 <video> for direct uploads/links). parseVideoUrl turns
 * a pasted link into that shape and derives a thumbnail where the provider exposes
 * a stable poster URL (YouTube). Uploaded videos are built in the upload route.
 */
export type VideoSource = 'youtube' | 'vimeo' | 'upload' | 'url';

export interface EventVideo {
  url: string;
  thumbnailUrl: string;
  source: VideoSource;
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

/** Normalise a pasted video URL into an EventVideo (source + derived thumbnail). */
export function parseVideoUrl(rawUrl: string): EventVideo {
  const url = rawUrl.trim();

  const yt = url.match(YOUTUBE_RE);
  if (yt) {
    return { url, thumbnailUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, source: 'youtube' };
  }

  const vimeo = url.match(VIMEO_RE);
  if (vimeo) {
    // Vimeo posters require an API call; leave empty and let the client fall back.
    return { url, thumbnailUrl: '', source: 'vimeo' };
  }

  return { url, thumbnailUrl: '', source: 'url' };
}
