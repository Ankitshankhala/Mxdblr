# Hero Banner — Design Rules (Designer Handoff)

**Component:** `web/components/home/HeroBanner.tsx`
**Admin screen:** `web/app/admin/banners/page.tsx` → Banners
**Last verified against source:** 2026-08-24

Every number in this document was read out of the live component source, not from
memory. If the component changes, this document must be re-verified before reuse.

The hero is a **code-rendered carousel**, not a flat image. You are not designing a
finished banner — you are supplying a **background photograph** (and, for two of the
three banner types, cut-out product or logo art) that the component composites text,
buttons and controls on top of. Design accordingly.

---

## 1. Deliverables per banner slide

| Asset | Size | Format | Required |
|---|---|---|---|
| Desktop background | **1920 × 700** | JPG / PNG / WEBP | Optional (slide works on flat colour) |
| Mobile background | **1080 × 1350** | JPG / PNG / WEBP | Optional — falls back to desktop image |
| Product cut-outs ×1–3 | **≥ 800 × 800**, square | **PNG, transparent bg** | `PRODUCT_PROMO` only |
| Brand logo | **≥ 720 × 600** | **PNG, transparent bg** | `BRAND_PROMO` only |

- **Max file size: 5 MB each.** Accepted extensions: `.jpg .jpeg .png .webp .gif`.
  (GIF is accepted by the uploader but must not be used — no animated hero assets.)
- Export backgrounds at ~75–80% JPG quality. These load above the fold on 3G dealer
  connections; a 4 MB hero is a failed hero even if it passes the uploader.
- No text, no logos, no price badges, no CTA buttons baked into the background image.
  All of that is rendered live by the component and will collide with yours.

---

## 2. The frame is not the image

The background is rendered `object-fit: cover`, full-bleed, into a flexible box:

- **Desktop:** minimum height **420 px**, width = full viewport. A 1920×700 source on a
  1440-wide viewport is cropped top and bottom, not letterboxed.
- **Mobile (< 768 px):** minimum height **340 px**, and the box **grows taller** to fit
  the stacked text. Expect 340–560 px of vertical crop from a 1080×1350 source.

**Rule:** the subject must survive a centre crop to a **2.7:1 letterbox on desktop** and
a **roughly 1:1 to 3:4 crop on mobile**. Nothing meaningful within 12% of any edge.

---

## 3. Safe zones — desktop (≥ 768 px)

Content is capped at **1280 px wide and centred**, with 24 px side padding and 56 px
top/bottom padding.

```
|<-- gutter -->|<---------------- 1280 px content ---------------->|<-- gutter -->|
|              |  TEXT COLUMN (max 640 px, or 560 px when a        |              |
|   [ < ]      |  product/logo panel is present)                   |     [ > ]    |
|              |  pill · headline · subtitle · 2 buttons · 01/03   | right panel  |
|              |                                                   |              |
|                              • • •  (dots)                                      |
```

- **Left 55% of the frame is text territory.** Keep it visually quiet: no faces, no
  logos, no high-frequency detail, no bright highlights. Put the subject in the
  **right 35–40%**.
- **Left and right edges:** carousel arrows are 40 px circles inset 16 px, vertically
  centred. Keep **72 px clear at both edges, full height**.
- **Bottom centre:** dot indicators sit 18 px from the bottom. Keep the **bottom 40 px,
  centre 200 px** clear.
- A decorative blurred accent circle (400 px, 6% opacity, blur 60) sits off the right
  edge. It is negligible — do not design around it, but do not fight it either.

### The desktop gradient (this is the important one)

```
linear-gradient(90deg, bg·94% -> bg·73% @45% -> bg·27% @75% -> transparent @100%)
```

Left edge is almost solid brand colour; by 75% across, the photo is 73% visible; the
right edge is **completely unmasked**. So:

- The right quarter of your image gets **no darkening at all** — it must read cleanly
  on its own and must not be so bright it fights the white headline beside it.
- The left half is heavily tinted with the slide's `bgColor`. Choose an image whose
  left half tints gracefully into that colour — a warm photo under `#0F1F0F` goes muddy.

---

## 4. Safe zones — mobile (< 768 px)

Content stacks into a **single, full-width, left-aligned column**: text first, then the
product/logo panel. Padding is 20 px sides, 40 px top, 56 px bottom.

```
linear-gradient(180deg, bg·80% -> bg·87% @60% -> bg·96% @100%)
```

**The mobile image is texture, not subject matter.** It is 80–96% obscured top to
bottom. Supply mood, depth or brand colour — never a product the dealer is supposed to
identify. If the story depends on seeing the product, use `PRODUCT_PROMO` and supply a
cut-out PNG instead; that renders above the overlay.

Arrows are hidden on mobile. Dots remain (bottom 40 px, centred).

---

## 5. Type, colour and copy rules

The component owns all typography. You cannot restyle it — you write **to** it.

| Element | Spec |
|---|---|
| Accent pill | 11 px / 700 / uppercase / 0.08em, in `accentColor` on a 13% tint. Label is fixed: "MXD® Wholesale" |
| Headline (h1) | `clamp(26px, 4.5vw, 52px)` / weight 900 / line-height 1.08 / `-0.02em` / **#FFFFFF** |
| Subtitle | 15 px / line-height 1.65 / `rgba(255,255,255,0.55)` / max 480 px wide |
| Primary CTA | `accentColor` fill, **#FFFFFF** label, 14 px / 700, 10 px radius |
| Secondary CTA | Fixed "Register as a Dealer", 1 px white-20% outline |
| Slide counter | 11 px, white 35%, format `01 / 03` |

**Copy rules that change the visual result — brief your copywriter on these:**

1. **A word ending in `.` or `!` renders in `accentColor`.** This is how headline
   emphasis works. `"Wholesale Mobile Accessories. No Minimum Bulk Orders."` puts
   *Accessories.* and *Orders.* in the accent colour. Punctuate deliberately — a stray
   full stop mid-headline will colour the wrong word.
2. **Headline: 6–10 words.** Above ~12 it wraps to four lines at 52 px and blows past
   the 420 px minimum height.
3. **Subtitle: 20–30 words**, one sentence. It is capped at 480 px on desktop.
4. **CTA label: 2–3 words.** An arrow glyph is appended automatically — don't type one.
5. `textAlignment: center` **only applies on desktop.** Mobile is always a left-aligned
   stacked column. Never design a centred mobile composition.

### Colour contract

`bgColor` and `accentColor` are set per-slide by an admin, and white text is
hard-coded over them. Non-negotiable:

- `bgColor` must be **dark** — the whole readability system assumes it. Target
  relative luminance under ~0.06 (e.g. `#1F1813`, `#0F1F0F`, `#1A0F00`).
- `accentColor` must reach **4.5:1 against white**, because white CTA text sits on an
  accent fill. Verify each pair before it ships; `#F47920` on white is ~3.0:1 and
  **fails** — the existing default is a known debt, not a licence to repeat it.
- The subtitle measures ~5.85:1 over `#1F1813` on flat colour. Over a photograph in the
  gradient's mid-zone it can drop below 4.5:1 — hence the "keep the left half quiet"
  rule. AA is the floor, not the target.

---

## 6. Motion

- Autoplay advances every **4.5 s** with a **500 ms crossfade**.
- It pauses on hover and on keyboard focus, and is **fully disabled** under
  `prefers-reduced-motion: reduce`.
- Slides crossfade only — there is no pan, zoom, parallax or Ken Burns effect. Do not
  design one and do not supply animated assets.
- 4.5 s is the entire reading budget for a slide. If the headline can't be read in one
  glance, it fails regardless of how good the image is.

---

## 7. Per-type rules

**SIMPLE** — background + text only. Carries the message on photography and copy alone.

**PRODUCT_PROMO** — 1–3 cut-out PNGs, `object-fit: contain`, with a drop shadow applied
in code. Rendered at:

| Count | Desktop | Mobile |
|---|---|---|
| 1 | 260 × 260 | 180 × 180 |
| 2 | 200 × 200 | 132 × 132 |
| 3 | 160 × 160 | 104 × 104 |

Square canvas, transparent background, product centred with ~8% breathing room, no
baked-in shadow (one is added), no reflections. At 104 px on mobile a three-product row
is *tiny* — three products means three silhouettes, not three detailed shots.

**BRAND_PROMO** — one logo PNG, `contain`, max **240 × 200** desktop / **180 × 140**
mobile. Transparent background, white or light monochrome version (it sits on a dark
tinted field), 10% internal padding.

---

## 8. Pre-handoff checklist

- [ ] Desktop 1920 × 700 and mobile 1080 × 1350 both supplied, each under 5 MB
- [ ] Subject sits in the right 35–40% on desktop; left 55% is quiet and low-detail
- [ ] 72 px clear at left and right edges; bottom-centre 200 × 40 px clear
- [ ] Composition survives a 2.7:1 desktop crop and a ~1:1 mobile crop
- [ ] Mobile asset carries no information that must be legible through an 80–96% scrim
- [ ] No text, logo, badge or button baked into any background
- [ ] Cut-outs and logos are transparent PNG with no baked shadow
- [ ] `bgColor` is dark; `accentColor` measured ≥ 4.5:1 against white
- [ ] Headline ≤ 10 words, punctuated so the *intended* words take the accent colour
- [ ] Reviewed at 375 px, 768 px, 1024 px and 1440 px viewport widths

---

## Known code gaps (not design constraints — flagged for the build team)

1. **`overlayOpacity` is dead.** The field exists in the model, is editable in the
   admin form, and is stored — but `HeroBanner.tsx` never reads it. Gradient alphas are
   hard-coded. Designers must **not** rely on it to tune scrim strength; the admin
   control currently does nothing.
2. **`accentColor` has no contrast validation** in the admin form, so an admin can set
   a colour that fails AA on the white CTA label. Worth a validator on the field.
