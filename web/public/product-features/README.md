# Product Feature Logos

These SVGs are the icons shown for each supported technology on product cards and
the product detail "Supported Technologies" section. Each product references a
feature by **slug** (via Admin → Products → Features), and the frontend renders
`/product-features/<slug>.svg` automatically — so a logo is stored **once** here,
not re-uploaded per product. Scales to 400+ products.

## ⚠️ These are PLACEHOLDERS

Every file here is a neutral monogram tile marked "PLACEHOLDER" — **not** official
brand art. Before launch, replace each with the real official logo (keeping the
same filename/slug), or upload a new logo per feature via **Admin → Features**
(which updates the `logo` field on the `ProductFeature` record).

Sources for official marks: Qualcomm Quick Charge, USB-IF (USB-C / PD / USB4),
OPPO (VOOC / SuperVOOC), OnePlus (Warp / Dash), realme (Dart), vivo (FlashCharge),
Samsung, Huawei, Xiaomi, Motorola (TurboPower), WPC (Qi), Apple (MagSafe), and the
CE / FCC / RoHS / BIS certification marks. Respect each owner's brand/trademark
usage guidelines.

## Filenames (must match the feature slug)

Charging: `quick-charge`, `usb-pd`, `pps`, `supervooc`, `vooc`, `dash-charge`,
`warp-charge`, `dart-charge`, `flash-charge`, `samsung-sfc`, `afc`, `huawei-sc`,
`mi-turbo`, `turbopower`
Wireless: `qi`, `magsafe`
Cable: `usb-c`, `lightning`, `micro-usb`, `thunderbolt`, `usb-3-0`, `usb-3-1`, `usb-4`
Data: `data-480mbps`, `data-5gbps`, `data-10gbps`, `data-20gbps`, `data-40gbps`
Protection: `ovp`, `ocp`, `scp`, `otp`
Certification: `ce`, `fcc`, `rohs`, `bis`

Keep them square (recommended 96×96 viewBox), transparent or white background,
and legible at 24–28px on a product card.
