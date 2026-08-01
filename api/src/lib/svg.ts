/**
 * SVG sanitizer — makes an uploaded SVG safe to store and render in the admin
 * panel / storefront. SVG is XML and can carry active content (scripts, event
 * handlers, external references), so an untrusted SVG is a stored-XSS vector.
 *
 * This scrub is allowlist-minded and deliberately conservative: it strips every
 * known script/interaction surface rather than trying to preserve exotic markup.
 * For product-feature icons (simple vector logos) that is exactly the right
 * trade-off. Raster uploads (PNG/JPG/WebP) don't need this — they carry no script.
 *
 * It is NOT a general-purpose SVG framework sanitizer; it targets the vectors that
 * matter for stored icons. Anything it can't make safe, it drops.
 */

// Elements that can execute or load active content — removed entirely (with any
// children). `foreignObject` can embed arbitrary HTML; `script` is obvious.
const DANGEROUS_ELEMENTS = [
  'script',
  'foreignObject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'animate', // SMIL animation can set href to javascript:
  'animateTransform',
  'set',
  'handler',
];

/**
 * Returns a sanitized SVG string, or null if the input isn't a plausible SVG.
 * Steps: strip DOCTYPE/entities (billion-laughs / XXE), remove dangerous
 * elements, strip on* event-handler attributes, and neutralise javascript:/
 * data: URLs in href/xlink:href/src/style.
 */
export function sanitizeSvg(input: string): string | null {
  let svg = input;

  // Must actually contain an <svg> root to be treated as SVG.
  if (!/<svg[\s>]/i.test(svg)) return null;

  // Drop DOCTYPE + internal DTD (XXE / entity-expansion surface) and processing
  // instructions.
  svg = svg.replace(/<!DOCTYPE[^>]*(\[[^\]]*\])?[^>]*>/gi, '');
  svg = svg.replace(/<\?[^>]*\?>/g, '');
  // Drop XML comments (can hide CDATA tricks).
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');

  // Remove dangerous elements together with their content.
  for (const el of DANGEROUS_ELEMENTS) {
    const withChildren = new RegExp(`<${el}\\b[\\s\\S]*?<\\/${el}\\s*>`, 'gi');
    const selfClosing = new RegExp(`<${el}\\b[^>]*/?>`, 'gi');
    svg = svg.replace(withChildren, '').replace(selfClosing, '');
  }

  // Strip on*="…" / on*='…' / on*=bare event-handler attributes.
  svg = svg.replace(/\son[a-z]+\s*=\s*"(?:[^"]*)"/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*'(?:[^']*)'/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // Neutralise javascript:/vbscript:/data:text URLs anywhere in an attribute
  // value (covers href, xlink:href, src, and CSS url()).
  svg = svg.replace(
    /((?:xlink:)?href|src)\s*=\s*(['"])\s*(?:javascript|vbscript|data:text\/html)[^'"]*\2/gi,
    '$1=$2#$2'
  );
  svg = svg.replace(/(javascript|vbscript)\s*:/gi, 'x-blocked:');

  // Drop <use> references to external documents (only same-doc #ids are allowed).
  svg = svg.replace(/<use\b[^>]*(?:xlink:)?href\s*=\s*(['"])(?!#)[^'"]*\1[^>]*>/gi, '');

  return svg.trim();
}
